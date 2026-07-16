import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWarningConditions,
  FlightWarningController,
  sampleTerrainApproach,
} from '../src/audio/flightWarningLogic.js';

const flat = () => 0;

function flight({ y, speed, vy = 0, vx = 0, vz = -speed, stall = 0, load = 1 }) {
  return {
    position: { x: 0, y, z: 0 },
    velocity: { x: vx, y: vy, z: vz },
    speed,
    stallAmount: stall,
    loadFactor: load,
  };
}

function run(controller, seconds, fps, profile, state, terrain = flat) {
  const events = [];
  const dt = 1 / fps;
  for (let time = 0; time < seconds - 1e-9; time += dt) {
    events.push(...controller.update(dt, profile, state, terrain, 'flying'));
  }
  return events;
}

test('PULL UP requires genuine projected terrain impact', () => {
  const state = flight({ y: 45, speed: 105, vy: -25 });
  const conditions = computeWarningConditions('zero', state, flat, 'flying');
  assert.equal(conditions.pull_up, true);
  assert.ok(conditions.terrain.projectedImpactSeconds <= 2.5);
});

test('TERRAIN precedes PULL UP for a less immediate approach', () => {
  const state = flight({ y: 110, speed: 110, vy: -30 });
  const conditions = computeWarningConditions('zero', state, flat, 'flying');
  assert.equal(conditions.pull_up, false);
  assert.equal(conditions.terrain_warning, true);
});

test('safe low pass does not trigger terrain or low-speed warning', () => {
  const state = flight({ y: 24, speed: 62, vy: 0 });
  const conditions = computeWarningConditions('zero', state, flat, 'flying');
  assert.equal(conditions.pull_up, false);
  assert.equal(conditions.terrain_warning, false);
  assert.equal(conditions.low_speed, false);
});

test('normal climb near terrain does not trigger LOW SPEED', () => {
  const state = flight({ y: 30, speed: 23, vy: 9, stall: 0.6 });
  const conditions = computeWarningConditions('zero', state, flat, 'flying');
  assert.equal(conditions.low_speed, false);
  assert.equal(conditions.pull_up, false);
});

test('LOW SPEED requires terrain proximity plus degrading energy', () => {
  const state = flight({ y: 42, speed: 20, vy: -4, stall: 0.62 });
  const controller = new FlightWarningController();
  const events = run(controller, 1.2, 60, 'zero', state);
  assert.ok(events.some(event => event.id === 'low_speed'));
});

test('warning uses sampled terrain, not raw world Y', () => {
  const highWorld = flight({ y: 1010, speed: 95, vy: -24 });
  const mountain = () => 970;
  const lowWorld = flight({ y: 1010, speed: 95, vy: -24 });
  const seaLevel = () => 0;
  assert.equal(computeWarningConditions('zero', highWorld, mountain, 'flying').pull_up, true);
  assert.equal(computeWarningConditions('zero', lowWorld, seaLevel, 'flying').pull_up, false);
});

test('rising terrain is included in projected clearance', () => {
  const state = flight({ y: 160, speed: 90, vy: -12, vx: 35, vz: 0 });
  const rising = x => Math.max(0, x * 0.8);
  const approach = sampleTerrainApproach(state, rising);
  assert.ok(approach.minClearance < approach.agl);
  assert.ok(approach.terrainRiseRate > 0);
});

test('warning cooldown prevents constant repeated messages', () => {
  const state = flight({ y: 45, speed: 105, vy: -25 });
  const controller = new FlightWarningController();
  const events = run(controller, 1.8, 120, 'zero', state);
  assert.equal(events.filter(event => event.id === 'pull_up').length, 1);
  const later = run(controller, 3.0, 120, 'zero', state);
  assert.ok(later.filter(event => event.id === 'pull_up').length <= 2);
});

test('warning hysteresis clears only after sustained safe state', () => {
  const controller = new FlightWarningController();
  run(controller, 0.8, 120, 'zero', flight({ y: 45, speed: 105, vy: -25 }));
  assert.equal(controller.active, 'pull_up');
  run(controller, 0.12, 120, 'zero', flight({ y: 280, speed: 105, vy: 3 }));
  assert.equal(controller.active, 'pull_up');
  run(controller, 0.30, 120, 'zero', flight({ y: 280, speed: 105, vy: 3 }));
  assert.equal(controller.active, 'none');
});

test('terrain approach matrix distinguishes sink-rate severity', () => {
  const mild = computeWarningConditions(
    'zero',
    flight({ y: 140, speed: 95, vy: -4 }),
    flat,
    'flying',
  );
  const moderate = computeWarningConditions(
    'zero',
    flight({ y: 110, speed: 105, vy: -30 }),
    flat,
    'flying',
  );
  const severe = computeWarningConditions(
    'zero',
    flight({ y: 45, speed: 105, vy: -25 }),
    flat,
    'flying',
  );
  assert.equal(mild.pull_up, false);
  assert.equal(mild.terrain_warning, false);
  assert.equal(moderate.terrain_warning, true);
  assert.equal(severe.pull_up, true);
});
