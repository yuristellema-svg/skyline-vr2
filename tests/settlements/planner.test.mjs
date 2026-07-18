import test from 'node:test';
import assert from 'node:assert/strict';
import { angleDifference, pointInPolygon, polygonsOverlap } from '../../src/settlements/math.js';
import { SAMPLE_WORLD_MANIFEST } from '../../src/settlements/sampleCatalog.js';
import { buildCatalog, sampleHeight } from './testContext.mjs';

test('parcel planning is deterministic including foundations and family choices', () => {
  const first = buildCatalog();
  const second = buildCatalog();
  assert.deepEqual(first.parcelsBySettlement, second.parcelsBySettlement);
  assert.deepEqual(first.allDescriptors, second.allDescriptors);
});

test('every parcel is tied to an authoritative road and aligned to it', () => {
  const catalog = buildCatalog();
  const roadIds = new Set(SAMPLE_WORLD_MANIFEST.roads.map(road => road.id));
  for (const parcels of Object.values(catalog.parcelsBySettlement)) {
    for (const parcel of parcels) {
      assert.ok(roadIds.has(parcel.roadRef), `${parcel.id} missing road`);
      assert.ok(angleDifference(parcel.yaw, parcel.roadHeading) < 0.07, `${parcel.id} not aligned`);
      assert.ok(Number.isFinite(parcel.roadDistance));
    }
  }
});

test('accepted parcel footprints do not overlap or enter exclusion polygons', () => {
  const catalog = buildCatalog();
  for (const parcels of Object.values(catalog.parcelsBySettlement)) {
    for (let left = 0; left < parcels.length; left += 1) {
      for (let right = left + 1; right < parcels.length; right += 1) {
        assert.equal(polygonsOverlap(parcels[left].footprint, parcels[right].footprint, 0.01), false, `${parcels[left].id} overlaps ${parcels[right].id}`);
      }
    }
  }
  for (const parcels of Object.values(catalog.parcelsBySettlement)) {
    for (const parcel of parcels) {
      for (const exclusion of SAMPLE_WORLD_MANIFEST.exclusions) {
        assert.equal(pointInPolygon([parcel.x, parcel.z], exclusion.footprint), false, `${parcel.id} entered ${exclusion.id}`);
      }
    }
  }
});

test('foundations conform to the full sampled footprint rather than center height only', () => {
  const catalog = buildCatalog();
  const foundations = catalog.allDescriptors.filter(item => item.role === 'terrain-conforming-foundation');
  assert.ok(foundations.length >= 80);
  for (const foundation of foundations) {
    const samples = foundation.meta.terrainSamples;
    assert.equal(samples.length, 5);
    assert.ok(samples.every(Number.isFinite));
    const terrainMin = Math.min(...samples);
    const terrainMax = Math.max(...samples);
    assert.ok(foundation.meta.foundationBottomY < terrainMin);
    assert.ok(foundation.meta.foundationTopY > terrainMax);
    const [x, , z] = foundation.position;
    assert.ok(Number.isFinite(sampleHeight(x, z)));
  }
});
