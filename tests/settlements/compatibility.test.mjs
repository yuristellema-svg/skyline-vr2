import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectSettlementManifestCompatibility,
  resolveSettlementManifest,
} from '../../src/settlements/manifest.js';
import { SAMPLE_WORLD_MANIFEST } from '../../src/settlements/sampleCatalog.js';

test('direct and nested settlement placement catalogs are accepted', () => {
  assert.equal(inspectSettlementManifestCompatibility(SAMPLE_WORLD_MANIFEST).compatible, true);
  const nested = { format: 'skyline-world-features', version: 4, settlementPlacement: SAMPLE_WORLD_MANIFEST };
  assert.equal(inspectSettlementManifestCompatibility(nested).compatible, true);
  assert.equal(resolveSettlementManifest(nested), SAMPLE_WORLD_MANIFEST);
});

test('legacy world features are rejected with actionable missing inputs instead of invented coordinates', () => {
  const legacy = {
    format: 'skyline-world-features',
    version: 3,
    water: { river: { points: [[0, 0, 0], [100, 0, 100]] } },
    city: { plateau: { min: [0, 0], max: [100, 100] } },
  };
  const report = inspectSettlementManifestCompatibility(legacy);
  assert.equal(report.compatible, false);
  assert.ok(report.missing.some(item => item.startsWith('roads')));
  assert.ok(report.missing.some(item => item.startsWith('settlements')));
  assert.throws(() => resolveSettlementManifest(legacy), /not compatible/);
});
