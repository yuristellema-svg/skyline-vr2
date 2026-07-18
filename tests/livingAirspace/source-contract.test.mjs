import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

function source(relative) {
  return fs.readFileSync(
    path.join(ROOT, relative),
    'utf8',
  );
}

test('package exposes the complete integration contract', () => {
  const system = source('src/livingAirspace/system.js');

  for (const token of [
    'setPhoneMode(phone)',
    "setQuality(quality = 'auto')",
    'reportPerformance(metrics = {})',
    'fixedStepUpdate(',
    'update(',
    'getAudioSources()',
    'getStatus()',
    'dispose()',
  ]) {
    assert.match(system, new RegExp(
      token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ));
  }
});

test('production package owns no requestAnimationFrame loop', () => {
  const productionFiles = fs.readdirSync(
    path.join(ROOT, 'src/livingAirspace'),
  );

  for (const file of productionFiles) {
    const text = source(`src/livingAirspace/${file}`);
    assert.doesNotMatch(text, /requestAnimationFrame\s*\(/);
  }
});

test('phone mode does not disable birds traffic clouds or contrails', () => {
  const constants = source('src/livingAirspace/constants.js');
  const quality = source('src/livingAirspace/quality.js');

  assert.match(constants, /'rural-birds'/);
  assert.match(constants, /'sailplanes'/);
  assert.match(constants, /'contrails'/);
  assert.match(constants, /'clouds'/);
  assert.match(quality, /majorFeaturesDisabledOnPhone:\s*false/);
});

test('package does not import or modify protected runtime modules', () => {
  const productionFiles = fs.readdirSync(
    path.join(ROOT, 'src/livingAirspace'),
  );

  const forbidden = [
    '../main.js',
    '../flightModel.js',
    '../camera.js',
    '../input.js',
    '../menu.js',
    '../world/world.js',
  ];

  for (const file of productionFiles) {
    const text = source(`src/livingAirspace/${file}`);
    for (const entry of forbidden) {
      assert.doesNotMatch(text, new RegExp(entry.replaceAll('.', '\\.')));
    }
  }
});
