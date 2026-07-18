import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORED_WORLD_REFERENCE } from '../../src/worldDetail/authoredReference.js';
import {
  buildWorldDetailLayout,
  nearestAuthoredRiverDistance,
} from '../../src/worldDetail/layout.js';

const flat = () => 94;

test('fallback reference matches the approved authored city plateau', () => {
  assert.deepEqual(AUTHORED_WORLD_REFERENCE.city.plateau.min, [420, -1390]);
  assert.deepEqual(AUTHORED_WORLD_REFERENCE.city.plateau.max, [1480, -330]);
  assert.equal(AUTHORED_WORLD_REFERENCE.city.plateau.elevation, 94);
  assert.equal(AUTHORED_WORLD_REFERENCE.source.includes('34e65d1d572c409f9220a437127fd4b617da81c1'), true);
});

test('authored city reconstruction aligns overlays to baseline buildings', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: flat });
  assert.ok(layout.city.authoredBuildings.length >= 90);
  for (const building of layout.city.authoredBuildings.filter(item => item.kind === 'block')) {
    assert.ok(building.x >= 420 && building.x <= 1480);
    assert.ok(building.z >= -1390 && building.z <= -330);
    assert.ok(Math.abs((building.y - building.height * 0.5) - 94) < 1e-9);
  }
});

test('all five authored bridges receive detail overlays', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: flat });
  assert.equal(layout.reference.bridges.length, 5);
  for (const bridge of layout.reference.bridges) {
    assert.ok(layout.bridges.details.some(item => item.id.startsWith(bridge.id)), bridge.id);
  }
  assert.ok(layout.bridges.details.some(item => item.kind === 'arch'));
  assert.ok(layout.bridges.details.some(item => item.id.includes('cable')));
  assert.ok(layout.bridges.details.some(item => item.id.includes('truss')));
});

test('harbour follows the authored river corridor', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: flat });
  for (const piece of layout.harbour.pieces) {
    assert.ok(nearestAuthoredRiverDistance(layout, piece.x, piece.z) < 190, piece.id);
  }
});

test('airfield landmarks align to the exact current runway positions', () => {
  const layout = buildWorldDetailLayout({ sampleHeight: flat });
  const cityRunway = layout.reference.airfields.find(item => item.id === 'city-runway');
  assert.equal(cityRunway.x, 520);
  assert.equal(cityRunway.z, 380);
  assert.equal(cityRunway.length, 900);
  assert.ok(layout.airfield.landmarks.some(item => item.id === 'city-runway-control-tower'));
  assert.ok(layout.airfield.landmarks.some(item => item.id === 'city-runway-windsock'));
});
