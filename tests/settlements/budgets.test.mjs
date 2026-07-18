import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_BUDGETS } from '../../src/settlements/constants.js';
import { buildCatalog } from './testContext.mjs';

const catalog = buildCatalog();

for (const quality of ['low', 'medium', 'high']) {
  test(`${quality} tier obeys hard instance, category and triangle budgets`, () => {
    const selection = catalog.tiers[quality];
    const budget = QUALITY_BUDGETS[quality];
    assert.ok(selection.total <= budget.maxInstances);
    assert.ok(selection.triangleEstimate <= budget.maxEstimatedTriangles);
    assert.ok(selection.renderPlan.drawCalls <= budget.targetDrawCalls, `${selection.renderPlan.drawCalls} draw calls > ${budget.targetDrawCalls}`);
    for (const [category, count] of Object.entries(selection.counts)) {
      assert.ok(count <= budget[category], `${category} ${count} > ${budget[category]}`);
    }
  });
}

test('quality tiers are nested subsets rather than alternate worlds', () => {
  const low = new Set(catalog.tiers.low.descriptors.map(item => item.id));
  const medium = new Set(catalog.tiers.medium.descriptors.map(item => item.id));
  const high = new Set(catalog.tiers.high.descriptors.map(item => item.id));
  assert.ok(low.size < medium.size && medium.size < high.size);
  for (const id of low) assert.ok(medium.has(id), `medium lost ${id}`);
  for (const id of medium) assert.ok(high.has(id), `high lost ${id}`);
});

test('phone quality preserves every settlement and all major shells', () => {
  const phone = catalog.tiers.low.descriptors;
  const ids = new Set(phone.map(item => item.settlementId));
  for (const settlement of catalog.manifest.settlements) assert.ok(ids.has(settlement.id), `${settlement.id} missing`);
  const essentialIds = new Set(catalog.allDescriptors.filter(item => item.essential && item.qualityRank === 0).map(item => item.id));
  const phoneIds = new Set(phone.map(item => item.id));
  for (const id of essentialIds) assert.ok(phoneIds.has(id), `phone removed essential ${id}`);
});
