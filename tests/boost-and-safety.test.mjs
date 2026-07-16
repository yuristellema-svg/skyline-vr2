import test from 'node:test';
import assert from 'node:assert/strict';
import { BoostTransitionTracker, boostLevelOf } from '../src/audio/boostAudio.js';
import { computeAircraftEngineTargets } from '../src/audio/aircraftEngineAudio.js';
import { computeAirflowTargets } from '../src/audio/airflowAudio.js';

function flight(speed, load = 1, stall = 0) {
  return {
    speed,
    velocity: { y: speed > 200 ? -speed * 0.35 : 0 },
    pathAngle: speed > 200 ? -0.45 : 0,
    loadFactor: load,
    stallAmount: stall,
  };
}

test('boost tracker produces one exit per activation cycle', () => {
  const tracker = new BoostTransitionTracker();
  let exits = 0;
  for (let cycle = 0; cycle < 20; cycle += 1) {
    for (const level of [0, 0.3, 1, 0.7, 0.2, 0.05, 0]) {
      if (tracker.update(level).exited) exits += 1;
    }
  }
  assert.equal(exits, 20);
});

test('boost level reader is finite and clamped', () => {
  assert.equal(boostLevelOf({ boostAmount: Infinity }), 0);
  assert.equal(boostLevelOf({ boostCharge: 2 }), 1);
  assert.equal(boostLevelOf({ boostLevel: -4 }), 0);
});

test('all computed audio gains remain finite and phone-safe', () => {
  for (const profile of ['zero', 'stuka', 'scout', 'glider']) {
    for (const speed of [0, 20, 80, 180, 400, 1200, 5000]) {
      for (const load of [0.5, 1, 4, 8, 20]) {
        const engine = computeAircraftEngineTargets(profile, flight(speed, load, 0.8), 'flying');
        const airflow = computeAirflowTargets(profile, flight(speed, load, 0.8), 'flying');
        for (const value of [
          engine.engineLevel,
          engine.mechanicalNoiseGain,
          engine.pulseGain,
          airflow.windGain,
          airflow.buffetGain,
          airflow.gliderCreakGain,
        ]) {
          assert.ok(Number.isFinite(value));
          assert.ok(value >= 0 && value <= 0.40);
        }
      }
    }
  }
});
