import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRCRAFT_AUDIO_PROFILES,
  resolveAircraftAudioProfile,
} from '../src/audio/aircraftAudioProfiles.js';
import {
  computeAircraftAudioTargets,
  computeStukaSirenTarget,
} from '../src/audio/audioTargets.js';

const strongDive = {
  speed: 150,
  pathAngle: -0.80,
  verticalSpeed: -105,
  loadFactor: 2.5,
};

test('all four aircraft profiles resolve exactly and remain isolated', () => {
  assert.deepEqual(Object.keys(AIRCRAFT_AUDIO_PROFILES), [
    'zero',
    'stuka',
    'scout',
    'glider',
  ]);

  for (const id of Object.keys(AIRCRAFT_AUDIO_PROFILES)) {
    assert.equal(resolveAircraftAudioProfile(id).id, id);
  }
});

test('Stuka siren target is permanently zero for Zero, Scout and Glider', () => {
  for (const id of ['zero', 'scout', 'glider']) {
    assert.equal(computeStukaSirenTarget(id, strongDive, 'flying'), 0);
    assert.equal(computeAircraftAudioTargets(id, strongDive, 'flying').sirenTarget, 0);
  }
});

test('glider has no procedural engine or propeller pulse', () => {
  const glider = computeAircraftAudioTargets('glider', { speed: 95 }, 'flying');
  assert.equal(glider.engineGain, 0);
  assert.equal(glider.subharmonicGain, 0);
  assert.equal(glider.propellerPulseGain, 0);
  assert.deepEqual(glider.harmonicFrequencies, []);
});
