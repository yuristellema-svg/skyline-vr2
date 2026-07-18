import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from './testContext.mjs';

const catalog = buildCatalog();

test('harbour modules retain exact shoreline and road linkage', () => {
  const piers = catalog.allDescriptors.filter(item => item.role === 'harbour-cargo-pier');
  const walls = catalog.allDescriptors.filter(item => item.role === 'harbour-seawall');
  const cranes = catalog.allDescriptors.filter(item => item.role === 'harbour-gantry-crane');
  assert.equal(piers.length, 5);
  assert.equal(walls.length, 10);
  assert.equal(cranes.length, 2);
  assert.ok(piers.every(item => item.meta.shorelineRef === 'main-coast'));
  assert.ok(piers.every(item => item.meta.roadRef === 'dock-road' || item.meta.roadRef === 'industrial-link'));
  assert.ok(piers.every(item => item.meta.intentionalOverWater === true));
  assert.ok(walls.every(item => item.meta.intentionalOverWater === false));
});

test('landmarks are composed silhouettes and every exact site survives phone quality', () => {
  const phoneIds = new Set(catalog.tiers.low.descriptors.map(item => item.settlementId));
  for (const landmark of catalog.manifest.landmarks) {
    assert.ok(phoneIds.has(`landmark:${landmark.id}`), `${landmark.id} missing on phone`);
  }
  assert.ok(catalog.roleCounts['lattice-tower-leg'] >= 6);
  assert.ok(catalog.roleCounts['water-tower-tank'] >= 1);
  assert.ok(catalog.roleCounts['church-spire'] >= 1);
  assert.ok(catalog.roleCounts['lighthouse'] >= 1);
  assert.ok(catalog.roleCounts['harbour-crane-landmark'] >= 1);
});
