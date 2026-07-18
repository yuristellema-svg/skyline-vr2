import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from '../vendor/three.module.min.js';
import { createExpansionHeightModel } from '../src/worldExpansion/heightModel.js';
import { ExpansionFeatureRuntime } from '../src/worldExpansion/featuresRuntime.js';
import { ExpansionTerrainRuntime } from '../src/worldExpansion/terrainRuntime.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));
const model = createExpansionHeightModel(manifest, { coreSampleHeight: () => 74 });

function settle(runtime, position, frames = 160) {
  for (let frame = 0; frame < frames; frame += 1) runtime.update(position);
  return runtime.getStats();
}

test('static authored features construct within the phone budget and dispose cleanly', () => {
  const root = new THREE.Group();
  const collisions = [];
  const runtime = new ExpansionFeatureRuntime(root, { addBox: (...box) => collisions.push(box) }, model);
  const stats = runtime.getStats();
  assert.equal(stats.drawCalls, 6);
  assert.ok(stats.triangles > 24000 && stats.triangles < 40000, `unexpected feature triangles ${stats.triangles}`);
  assert.ok(stats.roadSegments > 900 && stats.roadSegments <= manifest.budgets.maximumRoadSegments);
  assert.ok(stats.roadGuardrails > 0);
  assert.equal(stats.settlementInstances, manifest.budgets.maximumSettlementInstances);
  assert.ok(stats.settlementStreets >= manifest.settlements.length * 2);
  assert.ok(stats.waterSegments > 400 && stats.waterSegments <= manifest.budgets.maximumWaterSegments);
  assert.ok(stats.culvertGaps > 0);
  assert.ok(stats.bridgeSupports >= manifest.bridges.length);
  assert.ok(stats.airfieldPads >= 6);
  assert.equal(stats.transparentDrawCalls, manifest.budgets.transparentDrawCalls);
  assert.equal(collisions.length, stats.collisionBoxes);
  assert.ok(collisions.length > 340 && collisions.length <= manifest.budgets.maximumStaticCollisionBoxes);
  runtime.dispose();
  assert.equal(root.children.length, 0);
});

test('expansion terrain streams deterministically with skirts, cache and three draw-call batches', async () => {
  const root = new THREE.Group();
  const runtime = new ExpansionTerrainRuntime(root, model);
  const west = { x: -6200, z: 1000 };
  const nearCore = { x: -4300, z: 1000 };
  await runtime.preload(west);
  const first = settle(runtime, west);
  settle(runtime, nearCore);
  const returned = settle(runtime, west);
  assert.ok(first.loadedChunks > 50);
  assert.ok(returned.loadedChunks > 50);
  assert.ok(returned.loadedChunks <= manifest.streaming.maximumLoadedChunks);
  assert.ok(returned.visibleTerrainTriangles <= manifest.streaming.triangleBudget);
  assert.ok(returned.terrainDrawCalls > 0 && returned.terrainDrawCalls <= 3);
  assert.ok(returned.seamSkirtTriangles > 8000);
  assert.ok(returned.cacheHits > 0, 'returning to a region should reuse cached chunk geometry');
  assert.ok(returned.cacheEntries <= manifest.streaming.cacheEntries);
  assert.ok(returned.batchRebuilds < returned.generatedChunks, 'batch geometry should rebuild less often than chunks are generated');
  assert.equal(returned.lastError, '');
  runtime.dispose();
  assert.equal(root.children.length, 0);
});
