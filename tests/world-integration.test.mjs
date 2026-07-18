import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from '../src/config.js';
import { CollisionSystem } from '../src/collision.js';
import { FlightModel } from '../src/flightModel.js';
import { createWorld } from '../src/world/world.js';
import { parseWorldPack, samplePackHeight } from '../src/world/runtime/index.js';

const projectRoot = resolve(import.meta.dirname, '..');
const assetRoot = resolve(projectRoot, 'assets/world');
const manifest = JSON.parse(await readFile(resolve(assetRoot, 'manifest.json'), 'utf8'));
const features = JSON.parse(await readFile(resolve(assetRoot, 'features.json'), 'utf8'));

function filesystemFetch() {
  const cache = new Map();
  return async function fetchWorldAsset(url) {
    const marker = 'assets/world/';
    const normalized = String(url).replaceAll('\\', '/');
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex < 0) return { ok: false, status: 404, statusText: 'Outside world asset root' };
    const relative = normalized.slice(markerIndex + marker.length);
    let bytes = cache.get(relative);
    if (!bytes) {
      bytes = await readFile(resolve(assetRoot, relative));
      cache.set(relative, bytes);
    }
    return {
      ok: true,
      status: 200,
      async json() { return JSON.parse(bytes.toString('utf8')); },
      async arrayBuffer() {
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      },
    };
  };
}

async function exactBakedHeight(x, z) {
  const world = manifest.world;
  const packSize = world.packSizeMeters;
  const regionX = Math.min(world.packsPerSide - 1, Math.floor((x - world.bounds.minX) / packSize));
  const regionZ = Math.min(world.packsPerSide - 1, Math.floor((z - world.bounds.minZ) / packSize));
  const descriptor = manifest.packs.find((entry) => entry.region[0] === regionX && entry.region[1] === regionZ);
  const bytes = await readFile(resolve(assetRoot, descriptor.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return samplePackHeight(parseWorldPack(buffer, manifest, regionX, regionZ), manifest, x, z);
}

function assertFeatureCollisionCoverage(collision) {
  const labels = collision.boxes.map((box) => box.label);
  const authoredIds = [
    ...features.bridges.map((feature) => feature.id),
    ...features.landmarks.map((feature) => feature.id),
  ];
  for (const id of authoredIds) {
    assert.ok(labels.some((label) => label.startsWith(id)), `missing authored collision for ${id}`);
  }
  assert.equal(new Set(authoredIds).size, authoredIds.length, 'authored feature IDs must be unique');

  for (const bridge of features.bridges) {
    const box = collision.boxes.find((candidate) => candidate.label.startsWith(bridge.id));
    const position = new THREE.Vector3(
      (box.minX + box.maxX) * 0.5,
      (box.minY + box.maxY) * 0.5,
      (box.minZ + box.maxZ) * 0.5,
    );
    assert.equal(collision.check(position), true, `${bridge.id} collision volume should be solid`);
    assert.ok(collision.lastReason.startsWith(bridge.id), `${bridge.id} should report its authored collision label`);
  }
}

const LEGACY_WORLD_DRAW_CALLS = 431;
const ACCEPTED_WORLD_CORE_EXPANSION_DRAW_CALLS = 9;
const ACCEPTED_WORLD_DRAW_CALLS =
  LEGACY_WORLD_DRAW_CALLS +
  ACCEPTED_WORLD_CORE_EXPANSION_DRAW_CALLS;
const ACCEPTED_PROP_TRIANGLES = 459996;
const ACCEPTED_PROP_TRIANGLE_BUDGET = 460000;

function assertWorldBudgets(world) {
  const propReport = world.props.getBudgetReport();
  assert.ok(world.stats.terrainTriangles > 0);
  assert.ok(world.stats.propTriangles > 0);
  assert.ok(world.stats.totalWorldTriangles <= CONFIG.performance.maxVisibleTriangles,
    `${world.stats.totalWorldTriangles} world triangles exceeds ${CONFIG.performance.maxVisibleTriangles}`);
  assert.ok(
    world.stats.worldDrawCalls <=
      ACCEPTED_WORLD_DRAW_CALLS,
    `${world.stats.worldDrawCalls} world draws exceeds accepted baseline ${ACCEPTED_WORLD_DRAW_CALLS}`,
  );
  assert.ok(
    world.stats.expansionDrawCalls <=
      ACCEPTED_WORLD_CORE_EXPANSION_DRAW_CALLS,
    `${world.stats.expansionDrawCalls} World Core expansion draws exceeds ${ACCEPTED_WORLD_CORE_EXPANSION_DRAW_CALLS}`,
  );
  assert.ok(
    propReport.estimatedTriangles <=
      ACCEPTED_PROP_TRIANGLES,
    `${propReport.estimatedTriangles} prop triangles exceeds accepted baseline ${ACCEPTED_PROP_TRIANGLES}`,
  );
  assert.equal(
    propReport.triangleBudget,
    ACCEPTED_PROP_TRIANGLE_BUDGET,
  );

  assert.ok(
    propReport.estimatedTriangles <=
      propReport.triangleBudget,
  );
  assert.ok(
    Math.abs(
      world.stats.propTriangles -
      propReport.estimatedTriangles
    ) <= 8,
    `${world.stats.propTriangles} rendered prop triangles differs too far from estimate ${propReport.estimatedTriangles}`,
  );
  assert.equal(world.stats.propInstances, propReport.instances);
}

function resetAtIteration3Spawn(model) {
  const spawn = CONFIG.world.spawn;
  model.reset(spawn[0], spawn[1], spawn[2], CONFIG.physics.spawnSpeed);
  model.attitude.setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.world.spawnPathAngle);
  model.velocity.set(
    0,
    Math.sin(CONFIG.world.spawnPathAngle) * CONFIG.physics.spawnSpeed,
    -Math.cos(CONFIG.world.spawnPathAngle) * CONFIG.physics.spawnSpeed,
  );
}

test('actual Iteration 3 world preloads, collides, stays within budget and resets to spawn', async () => {
  const scene = new THREE.Scene();
  const collision = new CollisionSystem();
  const world = createWorld(scene, collision, { fetchFn: filesystemFetch() });
  try {
    await world.preloadSpawn(CONFIG.world.spawn);
    collision.setHeightSampler(world.sampleHeight);

    const spawnX = CONFIG.world.spawn[0];
    const spawnZ = CONFIG.world.spawn[2];
    const expectedHeight = await exactBakedHeight(spawnX, spawnZ);
    const streamedHeight = world.sampleHeight(spawnX, spawnZ);
    assert.ok(Number.isFinite(streamedHeight));
    assert.ok(Math.abs(streamedHeight - expectedHeight) < 1e-9, 'world collision uses the exact baked 2 m field');
    assert.equal(collision.check(new THREE.Vector3(spawnX, streamedHeight + collision.radius - 0.01, spawnZ)), true);
    assert.equal(collision.lastReason, 'Terrain');

    assert.equal(world.stats.ready, true);
    assert.equal(world.root.parent, scene);
    assert.equal(world.features.format, 'skyline-world-features');
    assert.equal(world.features.bridges.length, 5);
    assert.equal(world.features.landmarks.length, 8);
    assert.ok(world.terrain.group.children.length > 0, 'streamed terrain meshes are present');
    assert.ok(world.stats.loadedChunks > 0 && world.stats.loadedPacks > 0);
    assert.ok(world.stats.decodedPackBytes > 0);
    assert.ok(world.structures.group.children.length >= 5, 'bridges and scenic landmarks are present');
    assert.ok(world.city.blockCount > 50, 'the authored city is dense');
    assert.equal(world.water.group.children.length, 2, 'river and lake are both present');
    assert.ok(world.props.meshes.some((mesh) => mesh.count > 0), 'baked props are instanced into the scene');
    assertFeatureCollisionCoverage(collision);
    assertWorldBudgets(world);

    const collisionCount = collision.boxes.length;
    const collisionLabels = collision.boxes.map((box) => box.label);
    const alternate = { x: 1024, y: 500, z: -1024 };
    await world.preloadSpawn(alternate);
    assert.ok(Number.isFinite(world.sampleHeight(alternate.x, alternate.z)));
    await world.reset();

    assert.equal(world.terrain.lastX, spawnX);
    assert.equal(world.terrain.lastZ, spawnZ);
    assert.equal(world.props.focusX, spawnX);
    assert.equal(world.props.focusZ, spawnZ);
    assert.ok(Math.abs(world.sampleHeight(spawnX, spawnZ) - expectedHeight) < 1e-9);
    assert.equal(collision.boxes.length, collisionCount, 'reset must not duplicate authored collision volumes');
    assert.deepEqual(collision.boxes.map((box) => box.label), collisionLabels);
    assertWorldBudgets(world);
  } finally {
    world.dispose();
  }
  assert.equal(world.root.parent, null);
});

test('neutral unattended flight has a safe launch window from the real Iteration 3 spawn', async () => {
  const scene = new THREE.Scene();
  const collision = new CollisionSystem();
  const world = createWorld(scene, collision, { fetchFn: filesystemFetch() });
  const flight = new FlightModel();
  const controls = { pitchRate: 0, rollRate: 0, yawRate: 0, collisionRespawnFlag: 0 };
  try {
    await world.preloadSpawn(CONFIG.world.spawn);
    collision.setHeightSampler(world.sampleHeight);
    resetAtIteration3Spawn(flight);

    const steps = Math.round(20 / CONFIG.physics.fixedStep);
    let minimumClearance = Number.POSITIVE_INFINITY;
    for (let step = 0; step < steps; step += 1) {
      flight.step(CONFIG.physics.fixedStep, controls);
      const clearance = flight.position.y - world.sampleHeight(flight.position.x, flight.position.z);
      minimumClearance = Math.min(minimumClearance, clearance);
      assert.equal(
        collision.check(flight.position),
        false,
        `neutral spawn path crashed after ${(step * CONFIG.physics.fixedStep).toFixed(2)} s: ${collision.lastReason}`,
      );
      world.update(flight.position, null, CONFIG.physics.fixedStep);
    }
    assert.ok(minimumClearance > collision.radius, `minimum neutral clearance was only ${minimumClearance.toFixed(2)} m`);
  } finally {
    world.dispose();
  }
});

test('respawn preload is not invalidated by the stale crash-position stream focus', async () => {
  const baseFetch = filesystemFetch();
  let releasePacks;
  const packGate = new Promise(resolveGate => { releasePacks = resolveGate; });
  const delayedFetch = async (url) => {
    if (String(url).endsWith('.wpk')) await packGate;
    return baseFetch(url);
  };
  const scene = new THREE.Scene();
  const collision = new CollisionSystem();
  const world = createWorld(scene, collision, { fetchFn: delayedFetch });
  try {
    await world.ready;
    const preload = world.preloadSpawn(CONFIG.world.spawn);
    await Promise.resolve();
    await Promise.resolve();
    const staleCrashPosition = new THREE.Vector3(-3600, 220, -3600);
    world.update(staleCrashPosition, null, CONFIG.physics.fixedStep);
    releasePacks();
    await preload;
    assert.ok(Number.isFinite(world.terrain.sampleHeight(CONFIG.world.spawn[0], CONFIG.world.spawn[2])));
  } finally {
    releasePacks();
    world.dispose();
  }
});
