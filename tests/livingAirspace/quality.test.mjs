import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LivingAirspaceQualityGovernor,
} from '../../src/livingAirspace/quality.js';

import {
  FEATURE_CATEGORIES,
  QUALITY_PROFILES,
} from '../../src/livingAirspace/constants.js';

test('phone starts with all feature categories preserved', () => {
  const governor =
    new LivingAirspaceQualityGovernor({
      phone: true,
      quality: 'auto',
    });

  const status = governor.getStatus();

  assert.equal(status.majorFeaturesDisabledOnPhone, false);
  assert.deepEqual(
    [...status.requiredPhoneCategories],
    [...FEATURE_CATEGORIES],
  );

  assert.ok(QUALITY_PROFILES.phone.birdCount >= 40);
  assert.ok(QUALITY_PROFILES.phone.cloudClusters >= 8);
  assert.ok(QUALITY_PROFILES.phone.contrailPoints >= 24);
  assert.ok(QUALITY_PROFILES.phone.maxAudioSources >= 4);
});

test('phone governor uses cadence and density, not feature removal', () => {
  const governor =
    new LivingAirspaceQualityGovernor({
      phone: true,
      quality: 'auto',
    });

  for (let index = 0; index < 180; index += 1) {
    governor.reportFrame(30, 1 / 30);
  }

  assert.equal(governor.profile.id, 'phone');
  assert.ok(governor.profile.birdCount > 0);
  assert.ok(governor.profile.cloudClusters > 0);
  assert.ok(governor.profile.contrailPoints > 0);
});

test('desktop can promote with sustained headroom', () => {
  const governor =
    new LivingAirspaceQualityGovernor({
      phone: false,
      quality: 'auto',
    });

  for (let index = 0; index < 720; index += 1) {
    governor.reportFrame(13.5, 1 / 60);
  }

  assert.equal(governor.profile.id, 'full');
});
