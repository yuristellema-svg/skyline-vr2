import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from './testContext.mjs';

const catalog = buildCatalog();

test('main city has recognizable district-specific architecture', () => {
  const districtFamilies = {};
  for (const parcel of catalog.parcelsBySettlement['aster-core']) {
    const families = districtFamilies[parcel.districtId] ??= new Set();
    families.add(parcel.family);
  }
  assert.ok(districtFamilies['aster-downtown'].has('skyline_tower') || districtFamilies['aster-downtown'].has('podium_tower'));
  assert.ok(districtFamilies['aster-civic'].has('civic_hall'));
  assert.ok(districtFamilies['aster-old-quarter'].has('old_town_block') || districtFamilies['aster-old-quarter'].has('market_block'));
  assert.ok(Object.keys(districtFamilies).length >= 4);
});

test('the reusable kit contains distinct urban, residential, industrial, harbour and farm families', () => {
  const families = catalog.parcelFamilyCounts;
  for (const expected of [
    'skyline_tower',
    'podium_tower',
    'urban_midrise',
    'civic_hall',
    'rowhouse',
    'detached_house',
    'market_block',
    'warehouse',
    'factory_hall',
    'tank_cluster',
    'dock_warehouse',
    'barn',
    'farmhouse',
  ]) {
    assert.ok(families[expected] > 0, `${expected} missing`);
  }
});

test('only explicit individual windows and signal lamps emit', () => {
  const emitting = catalog.allDescriptors.filter(item => item.emissive);
  assert.ok(emitting.length > 500);
  assert.ok(emitting.every(item => item.role === 'actual-window' || item.role === 'actual-signal-lamp'));
  assert.ok(catalog.allDescriptors.filter(item => item.category === 'structures').every(item => item.emissive === false));
  assert.ok(catalog.allDescriptors.filter(item => item.surface === 'facade').every(item => item.emissive === false));
  assert.ok(catalog.allDescriptors.some(item => item.role === 'dark-window' && item.emissive === false));
});

test('rooftops and aerial silhouettes are represented as actual geometry parts', () => {
  const roles = catalog.roleCounts;
  assert.ok(roles['gable-roof'] > 100);
  assert.ok(roles['roof-cap'] > 20);
  assert.ok(roles['sawtooth-roof'] > 0);
  assert.ok(roles['roof-antenna'] > 0);
  assert.ok(roles['factory-stack'] > 0);
  assert.ok(roles['civic-spire'] > 0);
});
