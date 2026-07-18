import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSettlementManifest } from '../../src/settlements/manifest.js';
import { SAMPLE_WORLD_MANIFEST } from '../../src/settlements/sampleCatalog.js';

const clone = () => structuredClone(SAMPLE_WORLD_MANIFEST);

test('reference manifest is a complete externally anchored version-2 catalog', () => {
  const manifest = validateSettlementManifest(SAMPLE_WORLD_MANIFEST);
  assert.equal(manifest.version, 2);
  assert.equal(manifest.settlements.length, 11);
  assert.equal(manifest.landmarks.length, 9);
  assert.ok(manifest.roads.length >= 10);
  assert.ok(manifest.exclusions.length >= 2);
  assert.ok(manifest.settlements.filter(item => item.kind === 'town').length >= 2);
  assert.ok(manifest.settlements.some(item => item.kind === 'harbour'));
  assert.ok(manifest.settlements.some(item => item.kind === 'industrial'));
  assert.ok(manifest.settlements.filter(item => item.kind === 'farm').length >= 2);
});

test('settlements cannot omit authoritative roads or footprints', () => {
  const missingRoad = clone();
  missingRoad.settlements[0].roadRefs = ['not-real'];
  assert.throws(() => validateSettlementManifest(missingRoad), /missing road/);
  const missingFootprint = clone();
  delete missingFootprint.settlements[0].footprint;
  assert.throws(() => validateSettlementManifest(missingFootprint), /requires a polygon/);
});

test('harbour placement cannot exist without supplied shoreline linkage', () => {
  const manifest = clone();
  const harbour = manifest.settlements.find(item => item.kind === 'harbour');
  delete harbour.shorelineRef;
  assert.throws(() => validateSettlementManifest(manifest), /requires shorelineRef/);
});

test('district polygons and landmark anchors are explicit', () => {
  const districtManifest = clone();
  districtManifest.settlements[0].districts[0].footprint = [[9999, 9999], [10020, 9999], [10020, 10020]];
  assert.throws(() => validateSettlementManifest(districtManifest), /must be inside settlement footprint/);

  const landmarkManifest = clone();
  landmarkManifest.landmarks[0].anchor = ['x', 0];
  assert.throws(() => validateSettlementManifest(landmarkManifest), /exact external anchor/);
});
