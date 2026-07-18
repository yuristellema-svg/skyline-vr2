import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWorldDetailLayout, applyBudgetToLayout } from '../../src/worldDetail/layout.js';
import { SAFETY_CONTRACT } from '../../src/worldDetail/constants.js';

const runtime = fs.readFileSync(new URL('../../src/worldDetail/threeRuntime.js', import.meta.url), 'utf8');

const terrain = (x, z) => (
  x >= 420 && x <= 1480 && z >= -1390 && z <= -330
    ? 94
    : 52
);

test('transparent overdraw contract is limited to two cloud strata', () => {
  assert.equal(SAFETY_CONTRACT.maximumTransparentDrawCalls, 2);
  assert.match(runtime, /transparentDrawCalls:\s*2/);
  assert.doesNotMatch(runtime, /haze-ring|transparent-horizon|transparent-city/);
});

test('quality budgets reduce every major decorative class on phone', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  const high = applyBudgetToLayout(layout, 'high', false);
  const phone = applyBudgetToLayout(layout, 'high', true);
  assert.ok(phone.city.residentialInfill.length < high.city.residentialInfill.length);
  assert.ok(phone.city.industrialInfill.length < high.city.industrialInfill.length);
  assert.ok(phone.roads.segments.length < high.roads.segments.length);
  assert.ok(phone.roads.markings.length < high.roads.markings.length);
  assert.ok(phone.bridges.details.length < high.bridges.details.length);
  assert.ok(phone.harbour.pieces.length < high.harbour.pieces.length);
  assert.ok(phone.airfield.landmarks.length <= high.airfield.landmarks.length);
  assert.ok(phone.trafficHints.length < high.trafficHints.length);
});

test('layout contains no moving decorative traffic, birds or AI aircraft', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: terrain });
  assert.equal(layout.trafficHints.every(item => !('velocity' in item)), true);
  assert.equal('wildlife' in layout, false);
  assert.equal('aiTraffic' in layout, false);
  assert.equal('boostGates' in layout, false);
});
