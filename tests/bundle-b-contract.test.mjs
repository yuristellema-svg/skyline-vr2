import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  AIRCRAFT_FLIGHT_PROFILES,
} from '../src/aircraftFlightProfiles.js';

async function source(path) {
  return readFile(
    new URL(`../${path}`, import.meta.url),
    'utf8',
  );
}

test('Bundle B production systems remain present', async () => {
  const [
    main,
    flight,
    atmosphere,
    effects,
    performance,
    city,
    clouds,
  ] = await Promise.all([
    source('src/main.js'),
    source('src/flightModel.js'),
    source('src/atmosphere.js'),
    source('src/effects.js'),
    source('src/performanceRuntime.js'),
    source('src/optionalWorld/distantCity.js'),
    source('src/optionalWorld/cloudField.js'),
  ]);

  assert.match(main, /SKYLINE_BUNDLE_B_WORLD_SIM/);
  assert.match(flight, /SKYLINE_BUNDLE_B_FLIGHT_PROFILES/);
  assert.match(atmosphere, /SKYLINE_BUNDLE_B_ENVIRONMENT/);
  assert.match(effects, /SKYLINE_BUNDLE_B_G_FORCE/);
  assert.match(performance, /SKYLINE_BUNDLE_B_PHONE_PERFORMANCE/);
  assert.match(
    city,
    /SKYLINE_BUNDLE_B_CITY_LIGHTING|SKYLINE_B_POLISH_NIGHT_WINDOWS/,
  );
  assert.match(
    clouds,
    /SKYLINE_BUNDLE_B_CLOUD_LIGHTING|SKYLINE_B_POLISH_CLOUD/,
  );
});

test('all five aircraft profiles are available and frozen', () => {
  const expected = new Set([
    'zero',
    'stuka',
    'scout',
    'biplane',
    'glider',
  ]);

  assert.deepEqual(
    new Set(Object.keys(AIRCRAFT_FLIGHT_PROFILES)),
    expected,
  );

  for (const id of expected) {
    const profile = AIRCRAFT_FLIGHT_PROFILES[id];

    assert.equal(profile.id, id);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Number.isFinite(profile.dragScale), true);
    assert.equal(Number.isFinite(profile.liftScale), true);
  }

  assert.equal(
    AIRCRAFT_FLIGHT_PROFILES.biplane.name,
    'PT-17 BIPLANE',
  );
});

test('Bundle A interpolation remains intact', async () => {
  const main = await source('src/main.js');

  assert.match(main, /RenderPoseInterpolator/);
  assert.match(main, /sharedRenderPose/);
  assert.match(main, /SKYLINE_BUNDLE_A_V2_CORE/);
});
