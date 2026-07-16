import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAircraftAudioTargets,
  computeBoostParameters,
  computeTrafficVoiceTarget,
} from '../src/audio/audioTargets.js';

const cruise = {
  speed: 105,
  loadFactor: 1.1,
  stallAmount: 0,
};

const loaded = {
  speed: 105,
  loadFactor: 4.2,
  stallAmount: 0,
};

test('Zero target contains a half-frequency subharmonic and uneven firing harmonics', () => {
  const zero = computeAircraftAudioTargets('zero', cruise, 'flying');
  assert.ok(Math.abs(zero.subharmonicFrequency / zero.harmonicFrequencies[0] - 0.5) < 1e-9);

  const ratios = zero.harmonicFrequencies.map(
    frequency => frequency / zero.harmonicFrequencies[0],
  );
  assert.ok(Math.abs(ratios[1] - 1.5) > 0.01);
  assert.ok(Math.abs(ratios[3] - 2.5) > 0.01);
  assert.ok(zero.propellerPulseFrequency > zero.harmonicFrequencies[0]);
});

test('Zero becomes deeper under load without excessive low-frequency gain', () => {
  const light = computeAircraftAudioTargets('zero', cruise, 'flying');
  const heavy = computeAircraftAudioTargets('zero', loaded, 'flying');

  assert.ok(heavy.engineFilter < light.engineFilter);
  assert.ok(heavy.engineLowShelfDb > light.engineLowShelfDb);
  assert.ok(heavy.subharmonicGain > light.subharmonicGain);
  assert.ok(heavy.engineLowShelfDb < 7);
});

test('extreme-speed wind, stall buffet, boost and traffic targets scale conservatively', () => {
  const normal = computeAircraftAudioTargets('zero', { speed: 120, stallAmount: 0.2 }, 'flying');
  const extreme = computeAircraftAudioTargets('zero', { speed: 1800, stallAmount: 0.9 }, 'flying');
  assert.ok(extreme.windHissGain > normal.windHissGain * 2);
  assert.ok(extreme.buffetGain > normal.buffetGain * 8);

  const boost = computeBoostParameters(12);
  assert.ok(boost.peakGain <= 0.30);
  assert.ok(boost.midEnd > boost.midStart);

  const traffic = computeTrafficVoiceTarget({ speed: 70 }, 1);
  assert.ok(traffic.gain > 0 && traffic.gain < 0.08);
});
