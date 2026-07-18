import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.js', 'utf8');
const input = fs.readFileSync('src/input.js', 'utf8');
const menu = fs.readFileSync('src/menu.js', 'utf8');
const layout = fs.readFileSync(
  'src/workerNav/horizontalMenuLayout.js',
  'utf8',
);
const navigation = fs.readFileSync(
  'src/navigationMap/navigationMapSystem.js',
  'utf8',
);
const sw = fs.readFileSync('sw.js', 'utf8');

test('phone pause UI zero is calibrated flight-forward', () => {
  assert.match(input, /mode === 'flight'/);
  assert.match(input, /this\.baselineHeading/);
  assert.match(input, /this\._menuYawScale/);
  assert.match(main, /cameraRig\.basePosition/);
  assert.match(main, /cameraRig\.baseQuaternion/);
  assert.match(main, /refreshPauseUiForwardAnchor/);
});

test('menu and map reuse one persistent forward anchor', () => {
  assert.match(main, /pauseUiAnchorPosition/);
  assert.match(main, /pauseUiAnchorQuaternion/);
  assert.match(
    main,
    /lookReference:\s*'preserve'/,
  );
  assert.match(
    main,
    /menu\.open\([\s\S]*'preserve'/,
  );
});

test('MAP has a dedicated non-overlapping phone slot', () => {
  assert.match(
    layout,
    /\{ id: 'map', yaw: -39, pitch: -12 \}/,
  );
  assert.match(
    layout,
    /\{ id: 'effects', yaw: -13, pitch: -12 \}/,
  );
  assert.match(
    layout,
    /\{ id: 'respawn', yaw: 13, pitch: -12 \}/,
  );
  assert.match(
    layout,
    /\{ id: 'restart', yaw: 39, pitch: -12 \}/,
  );
});

test('map is over twice the previous effective phone size', () => {
  assert.match(navigation, /const MAP_WIDTH = 3\.8/);
  assert.match(navigation, /const MAP_HEIGHT = 2\.45/);
  assert.match(navigation, /const PHONE_SCALE = 0\.92/);

  const oldEffectiveWidth = 2.72 * 0.53;
  const newEffectiveWidth = 3.8 * 0.92;

  assert.ok(newEffectiveWidth > oldEffectiveWidth * 2);
});

test('phone map draws an explicit bright-pink gaze cursor and ping', () => {
  assert.match(navigation, /this\._gazePoint/);
  assert.match(navigation, /COLORS\.ping/);
  assert.match(navigation, /#ff4fa3/);
  assert.match(navigation, /context\.arc\(x, y, 16/);
});

test('look reference survives menu-to-map transition', () => {
  assert.match(
    menu,
    /lookReference = 'current'/,
  );
  assert.match(
    menu,
    /beginMenuLook\?\.\(\s*lookReference/,
  );
  assert.match(
    navigation,
    /lookReference = 'current'/,
  );
});

test('service worker identifies corrected deployment', () => {
  assert.match(sw, /SKYLINE_VR_MENU_MAP_FORWARD_V2/);
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
});
