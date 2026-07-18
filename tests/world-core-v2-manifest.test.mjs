import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createWorldCoreIndex, validateWorldCoreManifest } from '../src/worldExpansion/manifest.js';
import { nearestPointOnPolyline } from '../src/worldExpansion/math.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));

function reachableRoadIds(index) {
  const adjacency = new Map([...index.roads.keys()].map(id => [id, new Set()]));
  for (const junction of index.roadJunctions.values()) {
    for (const roadId of junction.roads) {
      for (const other of junction.roads) {
        if (other !== roadId) adjacency.get(roadId)?.add(other);
      }
    }
  }
  const start = index.roads.keys().next().value;
  const visited = new Set(start ? [start] : []);
  const queue = start ? [start] : [];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}

test('world core v2 manifest is substantial, deterministic, connected and exportable', () => {
  assert.equal(validateWorldCoreManifest(manifest), manifest);
  const index = createWorldCoreIndex(manifest);
  assert.equal(manifest.schemaVersion, '2.2.0');
  assert.equal(manifest.bounds.maxX - manifest.bounds.minX, 16384);
  assert.equal(manifest.bounds.maxZ - manifest.bounds.minZ, 16384);
  assert.equal(manifest.regions.length, 9);
  assert.equal(index.roads.size, 13);
  assert.equal(index.rivers.size, 7);
  assert.equal(manifest.water.lakes.length, 4);
  assert.equal(manifest.bridges.length, 6);
  assert.equal(manifest.settlements.length, 8);
  assert.equal(manifest.landmarks.length, 6);
  assert.equal(manifest.airfields.length, 2);
  assert.equal(index.landingCatalog.length, 2);
  assert.equal(reachableRoadIds(index).size, index.roads.size, 'all road corridors must belong to one connected graph');
  assert.equal(
    manifest.settlements.reduce((sum, item) => sum + item.buildingCount, 0),
    manifest.budgets.maximumSettlementInstances,
  );
  assert.deepEqual(Object.keys(manifest.workerExports).sort(), [
    'airfieldCatalog',
    'coordinateFrame',
    'landingCatalog',
    'roadCatalog',
    'settlementCatalog',
    'waterCatalog',
  ]);
});

test('every bridge owns a bounded road segment that intersects its river corridor', () => {
  const index = createWorldCoreIndex(manifest);
  for (const bridge of manifest.bridges) {
    const road = index.roads.get(bridge.roadId);
    const river = index.rivers.get(bridge.riverId);
    const segment = road.compiled.segments[bridge.segmentIndex];
    assert.ok(segment.length <= 420, `${bridge.id} segment is too long: ${segment.length}`);
    let minimumDistance = Number.POSITIVE_INFINITY;
    let nearest = null;
    for (let step = 0; step <= 100; step += 1) {
      const t = step / 100;
      const x = segment.a[0] + segment.dx * t;
      const z = segment.a[1] + segment.dz * t;
      const candidate = nearestPointOnPolyline(x, z, river.compiled);
      if (candidate.distance < minimumDistance) {
        minimumDistance = candidate.distance;
        nearest = candidate;
      }
    }
    assert.ok(minimumDistance <= river.bankWidthMeters * 0.5, `${bridge.id} misses ${river.id} by ${minimumDistance}m`);
    const riverSegment = river.compiled.segments[nearest.segmentIndex];
    const alignment = Math.abs((segment.dx * riverSegment.dx + segment.dz * riverSegment.dz) /
      Math.max(1e-6, segment.length * riverSegment.length));
    const crossingAngle = Math.acos(Math.min(1, alignment)) * 180 / Math.PI;
    assert.ok(crossingAngle >= 35, `${bridge.id} follows the river at ${crossingAngle.toFixed(1)} degrees`);
  }
});

test('airfields map one-to-one to landing catalog, road access and authored sites', () => {
  const index = createWorldCoreIndex(manifest);
  for (const airfield of manifest.airfields) {
    assert.ok(index.roads.has(airfield.roadId));
    assert.ok(airfield.site.overrunMeters >= 100);
    assert.ok(airfield.site.apron.sizeMeters.every(value => value >= 100));
    assert.ok(airfield.site.hangarPads.length >= 2);
    assert.ok(airfield.site.reservedWorkerZoneMeters.every(value => value >= 300));
    const landing = index.landingCatalog.find(item => item.airfieldId === airfield.id);
    assert.ok(landing);
    assert.equal(landing.position[1], airfield.elevationMeters);
    assert.equal(landing.lengthMeters, airfield.runwayLengthMeters);
    assert.equal(landing.widthMeters, airfield.runwayWidthMeters);
  }
});
