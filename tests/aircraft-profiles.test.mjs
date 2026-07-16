import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAircraftEngineTargets,
  computeStukaSirenTarget,
} from '../src/audio/aircraftEngineAudio.js';
import { computeAirflowTargets } from '../src/audio/airflowAudio.js';
import { AIRCRAFT_AUDIO_PROFILES } from '../src/audio/aircraftProfiles.js';

function flight({ speed, vy = 0, load = 1, stall = 0, pathAngle = null }) {
  return {
    speed,
    velocity: { y: vy },
    loadFactor: load,
    stallAmount: stall,
    pathAngle: pathAngle ?? Math.asin(Math.max(-1, Math.min(1, vy / Math.max(1, speed)))),
  };
}

for (const id of Object.keys(AIRCRAFT_AUDIO_PROFILES)) {
  test(`${id} profile stays finite from idle through extreme speed`, () => {
    for (const speed of [0, 12, 45, 120, 260, 900, 5000]) {
      const targets = computeAircraftEngineTargets(id, flight({ speed, load: 3.5 }), 'flying');
      const values = [
        targets.rpmHz,
        targets.engineLevel,
        targets.subFrequency,
        targets.engineFilter,
        targets.mechanicalNoiseGain,
        targets.pulseFrequency,
        targets.pulseGain,
        targets.sirenTarget,
        ...targets.harmonicFrequencies,
        ...targets.harmonicGains,
      ];
      assert.ok(values.every(Number.isFinite));
      assert.ok(targets.engineLevel >= 0 && targets.engineLevel <= 0.31);
      assert.ok(targets.sirenTarget >= 0 && targets.sirenTarget <= 1);
    }
  });
}

test('Zero load response becomes deeper and stronger without unsafe gain', () => {
  const low = computeAircraftEngineTargets('zero', flight({ speed: 105, load: 1 }), 'flying');
  const loaded = computeAircraftEngineTargets('zero', flight({ speed: 105, vy: 18, load: 5.2 }), 'flying');
  assert.ok(loaded.load > low.load);
  assert.ok(loaded.engineLevel > low.engineLevel);
  assert.ok(loaded.engineFilter > low.engineFilter);
  assert.ok(loaded.subFrequency > low.subFrequency);
  assert.ok(loaded.engineLevel <= 0.31);
});

test('Scout is lighter and mechanically faster than the Zero', () => {
  const zero = computeAircraftEngineTargets('zero', flight({ speed: 90 }), 'flying');
  const scout = computeAircraftEngineTargets('scout', flight({ speed: 90 }), 'flying');
  assert.ok(scout.rpmHz > zero.rpmHz);
  assert.ok(scout.profile.noiseGain < zero.profile.noiseGain);
  assert.ok(scout.profile.subRatio > zero.profile.subRatio);
});

test('Glider has no engine but richer airflow', () => {
  const engine = computeAircraftEngineTargets('glider', flight({ speed: 160, load: 4 }), 'flying');
  const gliderAir = computeAirflowTargets('glider', flight({ speed: 160, load: 4 }), 'flying');
  const zeroAir = computeAirflowTargets('zero', flight({ speed: 160, load: 4 }), 'flying');
  assert.equal(engine.engineLevel, 0);
  assert.ok(gliderAir.windGain > zeroAir.windGain);
  assert.ok(gliderAir.gliderCreakGain > 0);
});

test('Stuka siren is isolated and requires a fast steep dive', () => {
  const dive = flight({ speed: 145, vy: -78, pathAngle: -0.72 });
  assert.ok(computeStukaSirenTarget('stuka', dive, 'flying') > 0.65);
  assert.equal(computeStukaSirenTarget('zero', dive, 'flying'), 0);
  assert.equal(computeStukaSirenTarget('scout', dive, 'flying'), 0);
  assert.equal(computeStukaSirenTarget('glider', dive, 'flying'), 0);
  assert.equal(computeStukaSirenTarget('stuka', dive, 'paused'), 0);
  assert.equal(computeStukaSirenTarget('stuka', flight({ speed: 65, vy: -20, pathAngle: -0.7 }), 'flying'), 0);
  assert.equal(computeStukaSirenTarget('stuka', flight({ speed: 145, vy: -10, pathAngle: -0.08 }), 'flying'), 0);
});

test('rapid load changes keep every target finite and bounded', () => {
  for (let index = 0; index < 300; index += 1) {
    const speed = 20 + (index % 80) * 7;
    const load = index % 2 ? 8.5 : 0.8;
    const vy = index % 3 ? 28 : -70;
    const targets = computeAircraftEngineTargets('zero', flight({ speed, vy, load }), 'flying');
    assert.ok(Number.isFinite(targets.engineLevel));
    assert.ok(Number.isFinite(targets.engineFilter));
    assert.ok(targets.engineLevel <= 0.31);
    assert.ok(targets.mechanicalNoiseGain <= 0.20);
  }
});
