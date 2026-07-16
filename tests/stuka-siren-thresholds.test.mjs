import test from 'node:test';
import assert from 'node:assert/strict';
import { approach } from '../src/audio/audioMath.js';
import {
  computeSirenFrequencies,
  computeStukaSirenTarget,
  computeAircraftAudioTargets,
} from '../src/audio/audioTargets.js';

const dive = {
  speed: 150,
  pathAngle: -0.82,
  verticalSpeed: -110,
};

test('Stuka dive siren requires speed, angle, descent rate and flying phase', () => {
  assert.ok(computeStukaSirenTarget('stuka', dive, 'flying') > 0.90);
  assert.equal(computeStukaSirenTarget('stuka', { ...dive, speed: 70 }, 'flying'), 0);
  assert.equal(computeStukaSirenTarget('stuka', { ...dive, pathAngle: -0.20 }, 'flying'), 0);
  assert.equal(computeStukaSirenTarget('stuka', { ...dive, verticalSpeed: -8 }, 'flying'), 0);
  assert.equal(computeStukaSirenTarget('stuka', dive, 'paused'), 0);
});

test('dual Stuka siren voices are nearby but non-identical for audible beating', () => {
  const targets = computeAircraftAudioTargets('stuka', dive, 'flying');
  const frequencies = computeSirenFrequencies(targets, 0.85);
  const ratio = frequencies.secondary / frequencies.primary;
  assert.ok(ratio > 1.01 && ratio < 1.03);
  assert.ok(frequencies.primary > 500);
  assert.ok(frequencies.bandpass > frequencies.primary);
});

test('siren envelope rises gradually and releases smoothly', () => {
  const firstFrame = approach(0, 1, 1 / 60, 0.72);
  assert.ok(firstFrame > 0 && firstFrame < 0.04);

  let rise = 0;
  for (let index = 0; index < 90; index += 1) {
    rise = approach(rise, 1, 1 / 60, 0.72);
  }
  assert.ok(rise > 0.80 && rise < 1);

  const firstRelease = approach(rise, 0, 1 / 60, 0.30);
  assert.ok(firstRelease > 0 && firstRelease < rise);
});
