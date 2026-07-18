import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createExpansionHeightModel } from '../src/worldExpansion/heightModel.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));
const model = createExpansionHeightModel(manifest, { coreSampleHeight: () => 74 });

function classify(x, z) {
  const height = model.sampleHeight(x, z);
  const slope = model.sampleSlope(x, z, 12);
  return model.biome.classify(x, z, height, slope, model.waterSurfaceAt(x, z));
}

test('major regions produce distinct deterministic surface identities', () => {
  const samples = [
    [-5400, 5700],
    [-6000, 1500],
    [6000, 1000],
    [-5200, -4700],
    [6900, -3500],
  ];
  const first = samples.map(([x, z]) => classify(x, z));
  const second = samples.map(([x, z]) => classify(x, z));
  assert.deepEqual(first, second);
  assert.ok(new Set(first.map(item => item.key)).size >= 4, first.map(item => item.key).join(', '));
  for (const surface of first) {
    assert.equal(surface.color.length, 3);
    assert.ok(surface.color.every(value => value >= 0 && value <= 1));
  }
});

test('infrastructure blending changes only the local surface identity', () => {
  const base = classify(-4700, -5000);
  const changed = model.biome.blendForInfrastructure(base, 0.9, 'settlement-ground');
  assert.equal(changed.key, 'settlement-ground');
  assert.notDeepEqual(changed.color, base.color);
  assert.equal(classify(-4700, -5000).key, base.key);
});
