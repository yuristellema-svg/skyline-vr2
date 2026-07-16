import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(
    new URL(
      `../${path}`,
      import.meta.url,
    ),
    'utf8',
  );
}

test(
  'Bundle B production markers exist',
  async () => {
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

    assert.match(
      main,
      /SKYLINE_BUNDLE_B_WORLD_SIM/,
    );

    assert.match(
      flight,
      /SKYLINE_BUNDLE_B_FLIGHT_PROFILES/,
    );

    assert.match(
      atmosphere,
      /SKYLINE_BUNDLE_B_ENVIRONMENT/,
    );

    assert.match(
      effects,
      /SKYLINE_BUNDLE_B_G_FORCE/,
    );

    assert.match(
      performance,
      /SKYLINE_BUNDLE_B_PHONE_PERFORMANCE/,
    );

    assert.match(
      city,
      /SKYLINE_BUNDLE_B_CITY_LIGHTING/,
    );

    assert.match(
      clouds,
      /SKYLINE_BUNDLE_B_CLOUD_LIGHTING/,
    );
  },
);

test(
  'all four aircraft profiles exist',
  async () => {
    const profiles =
      await source(
        'src/aircraftFlightProfiles.js',
      );

    for (
      const id of [
        'zero',
        'stuka',
        'scout',
        'glider',
      ]
    ) {
      assert.match(
        profiles,
        new RegExp(
          `${id}: Object\\.freeze`,
        ),
      );
    }

    assert.match(
      profiles,
      /energyBias: -0\.015/,
    );
  },
);

test(
  'Bundle A render interpolation remains intact',
  async () => {
    const main =
      await source(
        'src/main.js',
      );

    assert.match(
      main,
      /RenderPoseInterpolator/,
    );

    assert.match(
      main,
      /sharedRenderPose/,
    );

    assert.match(
      main,
      /SKYLINE_BUNDLE_A_V2_CORE/,
    );
  },
);
