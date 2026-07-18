import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBudgetToLayout,
  buildWorldDetailLayout,
  layoutObjectCount,
  roadNetworkRepetitionScore,
} from '../../src/worldDetail/layout.js';

function terrain(x, z) {
  if (x >= 420 && x <= 1480 && z >= -1390 && z <= -330) return 94;
  return 54 + Math.sin(x * 0.0011) * 4 + Math.cos(z * 0.0013) * 3;
}

function allDescriptors(layout) {
  return [
    ...layout.city.authoredBuildings,
    ...layout.city.windows,
    ...layout.city.rooftops,
    ...layout.city.residentialInfill,
    ...layout.city.industrialInfill,
    ...layout.roads.segments,
    ...layout.roads.markings,
    ...layout.bridges.details,
    ...layout.harbour.pieces,
    ...layout.harbour.cranes,
    ...layout.harbour.lamps,
    ...layout.airfield.landmarks,
    ...layout.trafficHints,
    ...layout.clouds.near,
    ...layout.clouds.far,
    ...layout.collisionDescriptors,
  ];
}

test('construction is deterministic for the same seed and sampler', () => {
  const first = buildWorldDetailLayout({ sampleHeight: terrain, seed: 123456 });
  const second = buildWorldDetailLayout({ sampleHeight: terrain, seed: 123456 });
  assert.deepEqual(first, second);
});

test('different seeds change optional infill and clouds but not authored references', () => {
  const first = buildWorldDetailLayout({ sampleHeight: terrain, seed: 100 });
  const second = buildWorldDetailLayout({ sampleHeight: terrain, seed: 200 });
  assert.deepEqual(first.reference, second.reference);
  assert.deepEqual(first.city.authoredBuildings, second.city.authoredBuildings);
  assert.notDeepEqual(first.city.residentialInfill, second.city.residentialInfill);
  assert.notDeepEqual(first.clouds, second.clouds);
});

test('all transforms are finite', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  for (const item of allDescriptors(layout)) {
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'number') {
        assert.equal(Number.isFinite(value), true, `${item.id || 'descriptor'} ${key}`);
      }
    }
  }
});

test('phone budget is a large reduction from high detail', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  const high = applyBudgetToLayout(layout, 'high', false);
  const phone = applyBudgetToLayout(layout, 'high', true);
  assert.ok(layoutObjectCount(phone) < layoutObjectCount(high) * 0.40);
  assert.ok(phone.city.litWindows.length < high.city.litWindows.length);
  assert.ok(phone.roads.markings.length < high.roads.markings.length);
  assert.ok(phone.clouds.near.length < high.clouds.near.length);
  assert.ok(phone.collisionDescriptors.length < high.collisionDescriptors.length);
});

test('major roads form several curved corridors, not a repeated grid', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  const score = roadNetworkRepetitionScore(layout);
  assert.equal(score.obviousSingleGrid, false);
  assert.ok(score.corridors >= 5);
  assert.ok(score.distinctHeadings >= 12);
});

test('actual windows remain discrete panes rather than facade-sized bands', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  assert.ok(layout.city.windows.length > 10000);
  for (const window of layout.city.windows.slice(0, 500)) {
    assert.ok(window.width <= 2.1);
    assert.ok(window.height <= 1.8);
    assert.ok(window.depth <= 0.2);
  }
});

test('districts are all populated and meaningfully distinct', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  for (const id of ['downtown', 'residential', 'industrial']) {
    assert.ok(layout.city.authoredByDistrict[id].length > 0, id);
  }
  assert.ok(layout.city.residentialInfill.every(item => item.district === 'residential'));
  assert.ok(layout.city.industrialInfill.every(item => item.district === 'industrial'));
  assert.ok(layout.city.industrialInfill.some(item => item.archetype === 'warehouse'));
});

test('no terrain or mountain geometry is described', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  assert.equal(layout.safety.terrainCreated, false);
  assert.equal(layout.safety.mountainCreated, false);
  const signatures = allDescriptors(layout)
    .map(item => `${item.id || ''} ${item.kind || ''}`.toLowerCase())
    .join(' ');
  assert.doesNotMatch(signatures, /giant cone|pyramid mountain|crown mountain/);
});

test('missing height sampler suppresses terrain-dependent features instead of guessing', () => {
  const layout = buildWorldDetailLayout();
  assert.equal(layout.safety.heightSamplerAvailable, false);
  assert.equal(layout.safety.terrainDependentFeaturesSuppressed, true);
  assert.equal(layout.city.residentialInfill.length, 0);
  assert.equal(layout.city.industrialInfill.length, 0);
  assert.equal(layout.roads.segments.length, 0);
  assert.equal(layout.harbour.pieces.length, 0);
  assert.equal(layout.airfield.landmarks.length, 0);
  assert.ok(layout.city.windows.length > 0);
  assert.ok(layout.bridges.details.length > 0);
});
