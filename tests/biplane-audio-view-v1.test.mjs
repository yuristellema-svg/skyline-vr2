import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function source(relative) {
  return fs.readFileSync(
    new URL(`../${relative}`, import.meta.url),
    'utf8',
  );
}

test('biplane is registered as aircraft five with its own builders and profile', () => {
  const visuals = source('src/aircraftVisuals.js');
  const profiles = source('src/aircraftFlightProfiles.js');
  const power = source('src/expansion/powerControl.js');

  assert.match(visuals, /id: 'biplane'/);
  assert.match(visuals, /biplane: createBiplaneExternal/);
  assert.match(visuals, /biplane: createBiplaneCockpit/);
  assert.match(visuals, /Digit\[1-5\]/);
  assert.match(
    profiles,
    /biplane: BIPLANE_FLIGHT_PROFILE_PROPOSAL/,
  );
  assert.match(power, /'biplane'/);
});

test('phone camera switches recenter only view yaw', () => {
  const input = source('src/input.js');
  const main = source('src/main.js');

  assert.match(input, /recenterViewYaw\(\)/);
  assert.match(
    main,
    /cameraRig\.toggle\(phoneMode\)[\s\S]{0,200}recenterViewYaw/,
  );
});

test('Zero radio is off by default and restricted to Zero', () => {
  const beacon = source('src/expansion/radioBeacon.js');
  const radio = source('src/audio/zeroRadioAudio.js');

  assert.match(beacon, /this\.enabled = false/);
  assert.match(beacon, /this\.aircraftId !== 'zero'/);
  assert.match(radio, /profile === 'zero'/);
  assert.match(radio, /zero-radio\.mp3/);
});

test('Stuka uses the uploaded sample and duplicate procedural siren is muted', () => {
  const siren = source('src/audio/stukaDiveSiren.js');
  const engine = source('src/audio/aircraftEngineAudio.js');

  assert.match(siren, /stuka-siren\.mp3/);
  assert.match(siren, /profile !== 'stuka'/);
  assert.match(
    engine,
    /safeSetTarget\(this\.sirenBus\.gain, 0\.0001/,
  );
});

test('FULL effects is the default', () => {
  const effects = source('src/effects.js');

  assert.match(
    effects,
    /this\.intensityIndex = 2/,
  );
});

test('deployment cache keys and audio assets are updated', () => {
  const index = source('index.html');
  const sw = source('sw.js');

  assert.match(
    index,
    /biplane-audio-view-v1-r2/,
  );
  assert.match(
    sw,
    /skyline-biplane-audio-view-v1-r2-20260718/,
  );
  assert.match(sw, /zero-radio\.mp3/);
  assert.match(sw, /stuka-siren\.mp3/);
});
