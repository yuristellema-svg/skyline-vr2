import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSettlementCatalog } from '../../src/settlements/catalogBuilder.js';
import { QUALITY_BUDGETS } from '../../src/settlements/constants.js';
import { SAMPLE_WORLD_MANIFEST } from '../../src/settlements/sampleCatalog.js';

const terrainSamplers = [
  (x, z) => 14 + Math.sin(x * 0.002) * 3 + Math.cos(z * 0.0017) * 2,
  (x, z) => 70 + Math.sin(x * 0.0017) * 2.2 + Math.cos(z * 0.0013) * 1.8,
  (x, z) => 30 + Math.sin((x + z) * 0.0011) * 1.5 + Math.cos((x - z) * 0.0019) * 2.4,
];

const seeds = [0x53a91f2d, 0x53aaA0be, 0x53ac223f, 0x53ada3c0];

test('quality budgets remain safe across terrain samplers and deterministic seeds', () => {
  for (const sampleHeight of terrainSamplers) {
    for (const seed of seeds) {
      const catalog = buildSettlementCatalog({
        manifest: SAMPLE_WORLD_MANIFEST,
        sampleHeight,
        seed,
      });
      for (const quality of ['low', 'medium', 'high']) {
        const tier = catalog.tiers[quality];
        const budget = QUALITY_BUDGETS[quality];
        assert.ok(tier.total <= budget.maxInstances, `${quality} instances exceeded for seed ${seed}`);
        assert.ok(tier.triangleEstimate <= budget.maxEstimatedTriangles, `${quality} triangles exceeded for seed ${seed}`);
        assert.ok(tier.renderPlan.drawCalls <= budget.targetDrawCalls, `${quality} draw calls exceeded for seed ${seed}`);
        for (const [category, count] of Object.entries(tier.counts)) {
          assert.ok(count <= budget[category], `${quality}/${category} exceeded for seed ${seed}`);
        }
      }
    }
  }
});
