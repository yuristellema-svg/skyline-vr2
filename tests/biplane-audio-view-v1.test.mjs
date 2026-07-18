import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function source(relative) {
  return fs.readFileSync(
    new URL(`../${relative}`, import.meta.url),
    'utf8',
  );
}

function constructorSection(text) {
  const start = text.indexOf('constructor(');
  const end = text.indexOf('\n  _beginLoad', start);
  assert.ok(start >= 0 && end > start);
  return text.slice(start, end);
}

test('biplane is available in desktop and phone selection', () => {
  const visuals = source('src/aircraftVisuals.js');
  const profiles = source('src/aircraftFlightProfiles.js');
  const menuLayout = source('src/workerNav/horizontalMenuLayout.js');
  const index = source('index.html');

  assert.match(visuals, /id: 'biplane'/);
  assert.match(visuals, /biplane: createBiplaneExternal/);
  assert.match(visuals, /biplane: createBiplaneCockpit/);
  assert.match(visuals, /Digit\[1-5\]/);
  assert.match(profiles, /biplane: BIPLANE_FLIGHT_PROFILE_PROPOSAL/);
  assert.match(menuLayout, /buildDesktopMenuDefinitions/);
  assert.match(menuLayout, /id: 'aircraft'/);
  assert.match(index, /1 \/ 2 \/ 3 \/ 4 \/ 5 select directly/);
});

test('updated aircraft and audio modules are cache-busted', () => {
  const main = source('src/main.js');
  const worldPolish = source('src/worldPolish.js');
  const wind = source('src/windAudio.js');

  assert.match(main, /aircraftVisuals\.js\?v=biplane-zero-radio-v4/);
  assert.match(main, /worldPolish\.js\?v=biplane-zero-radio-v4/);
  assert.match(main, /radioBeacon\.js\?v=biplane-zero-radio-v4/);
  assert.match(worldPolish, /windAudio\.js\?v=biplane-zero-radio-v4/);
  assert.match(wind, /zeroRadioAudio\.js\?v=biplane-zero-radio-v4/);
  assert.match(wind, /stukaDiveSiren\.js\?v=biplane-zero-radio-v4/);
});

test('phone camera switches recenter only view yaw', () => {
  const input = source('src/input.js');
  const main = source('src/main.js');
  assert.match(input, /recenterViewYaw\(\)/);
  assert.match(
    main,
    /cameraRig\.toggle\(phoneMode\)[\s\S]{0,350}recenterViewYaw/,
  );
});

test('radio control is tiny, right-side, and Zero cockpit or third only', () => {
  const beacon = source('src/expansion/radioBeacon.js');
  assert.match(beacon, /RADIO_YAW = 68 \* DEG/);
  assert.match(beacon, /sprite\.scale\.set\(0\.13, 0\.13, 1\)/);
  assert.match(beacon, /this\.aircraftId === 'zero'/);
  assert.match(beacon, /this\.cameraMode === 'cockpit'/);
  assert.match(beacon, /this\.cameraMode === 'third'/);
  assert.match(beacon, /skyline:view-changed/);
  assert.doesNotMatch(beacon, /RADIO \$\{/);
});

test('mobile audio unlock is attached directly to touch gestures', () => {
  const main = source('src/main.js');

  assert.match(
    main,
    /const directAudioUnlock/,
  );

  assert.match(
    main,
    /phoneStart[\s\S]*desktopStart[\s\S]*pointerdown[\s\S]*touchend/,
  );

  assert.match(
    main,
    /visibilitychange/,
  );

  assert.match(
    main,
    /pageshow/,
  );

  assert.match(
    main,
    /completePhoneAudioGesture[\s\S]*requestAudioFromGesture\(\s*false/,
  );
});

test('mobile audio samples do not load in AudioContext constructors', () => {
  const radio = source('src/audio/zeroRadioAudio.js');
  const siren = source('src/audio/stukaDiveSiren.js');
  assert.doesNotMatch(constructorSection(radio), /this\._load\(/);
  assert.doesNotMatch(constructorSection(siren), /this\._load\(/);
  assert.match(radio, /_beginLoad\(forceRetry = false\)/);
  assert.match(siren, /_beginLoad\(forceRetry = false\)/);
  assert.match(radio, /profile === 'zero'/);
  assert.match(siren, /profile === 'stuka'/);
});

test('phone second tap forces a clean audio rebuild', () => {
  const main = source('src/main.js');

  assert.match(
    main,
    /completePhoneAudioGesture[\s\S]*requestAudioFromGesture\(\s*true/,
  );

  assert.match(
    main,
    /if \(awaitingPhoneAudioGesture\)[\s\S]*return/,
  );
});

test('Zero radio preloads, pauses for menu, and resumes from its offset', () => {
  const wind = source('src/windAudio.js');
  const radio = source('src/audio/zeroRadioAudio.js');

  assert.match(
    wind,
    /this\.ready = true[\s\S]*zeroRadio[\s\S]*preload/,
  );

  assert.match(radio, /cache: 'no-store'/);
  assert.match(radio, /source\.start\(0, offset\)/);
  assert.match(radio, /this\.playbackOffset/);
  assert.match(radio, /phase === 'flying'/);
  assert.match(radio, /this\._pauseSource/);
});

test('Stuka sample and FULL effects remain enabled', () => {
  const siren = source('src/audio/stukaDiveSiren.js');
  const engine = source('src/audio/aircraftEngineAudio.js');
  const effects = source('src/effects.js');
  assert.match(siren, /stuka-siren\.mp3/);
  assert.match(engine, /safeSetTarget\(this\.sirenBus\.gain, 0\.0001/);
  assert.match(effects, /this\.intensityIndex = 2/);
});

test('deployment cache keys and audio assets are updated', () => {
  const index = source('index.html');
  const sw = source('sw.js');
  assert.match(index, /biplane-zero-radio-v4/);
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /zero-radio\.mp3/);
  assert.match(sw, /stuka-siren\.mp3/);
});
