import test from 'node:test';
import assert from 'node:assert/strict';
import { maximumDistanceForBand } from '../../src/settlements/spatial.js';
import { QUALITY_BUDGETS } from '../../src/settlements/constants.js';
import { buildCatalog } from './testContext.mjs';

const catalog = buildCatalog();

test('collision catalog contains finite authored boxes only for collidable pieces', () => {
  assert.ok(catalog.collisionCatalog.length > 500);
  for (const box of catalog.collisionCatalog) {
    for (const key of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ']) assert.ok(Number.isFinite(box[key]));
    assert.ok(box.minX < box.maxX && box.minY < box.maxY && box.minZ < box.maxZ);
  }
  assert.equal(catalog.collisionCatalog.length, catalog.allDescriptors.filter(item => item.collidable).length);
});

test('spatial catalog covers the same settlement sites and supports shorter phone visibility', () => {
  assert.ok(catalog.spatial.cellCount > 20);
  for (const settlement of catalog.manifest.settlements) assert.ok(catalog.spatial.settlements[settlement.id]);
  const low = QUALITY_BUDGETS.low;
  const high = QUALITY_BUDGETS.high;
  assert.ok(maximumDistanceForBand('micro', low) < maximumDistanceForBand('micro', high));
  assert.equal(maximumDistanceForBand('skyline', low), Infinity);
});
