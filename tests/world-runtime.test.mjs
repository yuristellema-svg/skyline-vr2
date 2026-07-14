import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from '../vendor/three.module.min.js';
import {
  createTerrainGeometry,
  createTerrainPalette,
  createTerrainRuntime,
  parseWorldPack,
  readChunkEntry,
  samplePackHeight,
  terrainTriangleCount,
} from '../src/world/runtime/index.js';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'assets/world/manifest.json'), 'utf8'));
const firstDescriptor = manifest.packs.find((entry) => entry.region[0] === 0 && entry.region[1] === 0);
const packBytes = await readFile(resolve(root, 'assets/world', firstDescriptor.url));
const packBuffer = packBytes.buffer.slice(packBytes.byteOffset, packBytes.byteOffset + packBytes.byteLength);

test('SVW3 parser exposes the locked compact height, splat, chunk and prop layout', () => {
  const pack = parseWorldPack(packBuffer.slice(0), manifest, 0, 0);
  assert.equal(pack.heightSamples, 513);
  assert.equal(pack.splatSamples, 257);
  assert.equal(pack.heights.length, 513 * 513);
  assert.equal(pack.splats.length, 257 * 257);
  assert.equal(pack.props.length, pack.propCount * 12);

  const entry = {};
  readChunkEntry(pack, 2, 3, entry);
  assert.deepEqual(
    [entry.heightStartX, entry.heightStartZ, entry.splatStartX, entry.splatStartZ],
    [256, 384, 128, 192],
  );
  assert.ok(entry.propFirst + entry.propCount <= pack.propCount);

  const exactX = manifest.world.bounds.minX + 44;
  const exactZ = manifest.world.bounds.minZ + 78;
  const sampleX = 22;
  const sampleZ = 39;
  const encoded = pack.heights[sampleZ * pack.heightSamples + sampleX];
  const expected = manifest.encoding.height.offsetMeters + encoded * manifest.encoding.height.scaleMeters;
  assert.ok(Math.abs(samplePackHeight(pack, manifest, exactX, exactZ) - expected) < 1e-9);
});

test('4/8/16 metre terrain grids include skirts, normals, colours and deterministic budgets', () => {
  const pack = parseWorldPack(packBuffer.slice(0), manifest, 0, 0);
  const entry = {};
  readChunkEntry(pack, 0, 0, entry);
  const palette = createTerrainPalette(manifest);
  for (const spacing of [4, 8, 16]) {
    const geometry = createTerrainGeometry(pack, manifest, entry, 0, 0, spacing, palette, 36);
    const segments = 256 / spacing;
    const expectedVertices = (segments + 1) ** 2 + (segments + 1) * 4;
    const expectedTriangles = terrainTriangleCount(256, spacing);
    assert.equal(geometry.getAttribute('position').count, expectedVertices);
    assert.equal(geometry.getAttribute('normal').count, expectedVertices);
    assert.equal(geometry.getAttribute('color').count, expectedVertices);
    assert.equal(geometry.index.count, expectedTriangles * 3);
    assert.equal(geometry.userData.triangleCount, expectedTriangles);
    assert.ok(geometry.boundingBox.min.y < geometry.getAttribute('position').getY(0));
    assert.ok(geometry.boundingSphere.radius > 100);
    geometry.dispose();
  }
  assert.deepEqual(
    [terrainTriangleCount(256, 4), terrainTriangleCount(256, 8), terrainTriangleCount(256, 16)],
    [8704, 2304, 640],
  );
});

test('runtime preloads exact collision data, streams deterministically, reports metrics and disposes', async () => {
  const buffers = new Map();
  let packFetches = 0;
  async function fetchFn(url) {
    if (url.endsWith('/manifest.json')) {
      return { ok: true, async json() { return manifest; } };
    }
    const relative = url.slice(url.indexOf('/packs/') + 1);
    let bytes = buffers.get(relative);
    if (!bytes) {
      bytes = await readFile(resolve(root, 'assets/world', relative));
      buffers.set(relative, bytes);
    }
    packFetches += 1;
    return {
      ok: true,
      async arrayBuffer() {
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      },
    };
  }

  const scene = new THREE.Scene();
  const runtime = createTerrainRuntime(scene, {
    assetRoot: 'memory://world',
    fetchFn,
    loadRadius: 0,
    unloadRadius: 0,
    fullLodRadius: 0,
    halfLodRadius: 0,
    maxVisibleTriangles: 9000,
    buildsPerUpdate: 1,
  });
  await runtime.preloadSpawn({ x: -3968, z: -3968 });
  const height = runtime.sampleHeight(-3968.5, -3968.5);
  assert.ok(Number.isFinite(height), '2 m source data is synchronously available after preload');
  assert.ok(Number.isNaN(runtime.sampleHeight(5000, 5000)), 'outside-world height is not fabricated');
  assert.equal(runtime.stats.loadedChunks, 1);
  assert.equal(runtime.stats.loadedPacks, 1);
  assert.equal(runtime.stats.terrainDrawCalls, 1);
  assert.equal(runtime.stats.visibleTerrainTriangles, 8704);
  assert.equal(runtime.stats.decodedPackBytes, firstDescriptor.byteLength);
  assert.ok(runtime.stats.revision > 1);
  assert.equal(runtime.material.map, null);

  let loadedChunk = null;
  runtime.forEachLoadedChunk((chunk) => { loadedChunk = chunk; });
  assert.ok(loadedChunk);
  assert.equal(loadedChunk.propByteOffset, loadedChunk.pack.propOffset + loadedChunk.propFirst * 12);
  assert.ok(loadedChunk.propCount >= 0);
  let loadedPacks = 0;
  runtime.forEachLoadedPack((pack, minX, minZ, maxX, maxZ) => {
    loadedPacks += 1;
    assert.equal(pack.regionX, 0);
    assert.deepEqual([minX, minZ, maxX, maxZ], [-4096, -4096, -3072, -3072]);
  });
  assert.equal(loadedPacks, 1);

  const firstGeometry = loadedChunk.mesh.geometry;
  let disposed = false;
  firstGeometry.addEventListener('dispose', () => { disposed = true; });
  await runtime.preloadSpawn({ x: -3712, z: -3968 });
  assert.equal(disposed, true);
  assert.equal(packFetches, 1, 'moving inside a retained pack does not refetch it');
  assert.equal(runtime.stats.loadedChunks, 1);

  runtime.setRenderOrigin(100, 200);
  assert.deepEqual(runtime.group.position.toArray(), [-100, 0, -200]);
  const beforeResetRevision = runtime.stats.revision;
  await runtime.reset();
  assert.ok(runtime.stats.revision > beforeResetRevision);
  assert.equal(runtime.stats.loadedChunks, 1);
  assert.ok(Number.isFinite(runtime.sampleHeight(-3712, -3968)));

  runtime.dispose();
  assert.equal(runtime.stats.loadedChunks, 0);
  assert.equal(runtime.stats.loadedPacks, 0);
  assert.equal(runtime.group.parent, null);
});
