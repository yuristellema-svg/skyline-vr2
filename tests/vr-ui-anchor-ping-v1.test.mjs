import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.js', 'utf8');
const camera = fs.readFileSync('src/camera.js', 'utf8');
const navigation = fs.readFileSync(
  'src/navigationMap/navigationMapSystem.js',
  'utf8',
);
const sw = fs.readFileSync('sw.js', 'utf8');

test('menu pose can be frozen from an explicit headset pose', () => {
  assert.match(
    camera,
    /beginMenuPose\(\s*position = this\.camera\.position,\s*quaternion = this\.camera\.quaternion/,
  );
  assert.match(camera, /this\._menuPosition\.copy/);
  assert.match(camera, /this\._menuQuaternion\.copy/);
});

test('normal menu opens from current view without forcing aircraft-forward', () => {
  assert.match(main, /const anchor =\s*capturePauseUiPose\(\)/);
  assert.match(
    main,
    /cameraRig\.beginMenuPose\(\s*anchor\.position,\s*anchor\.quaternion/,
  );

  const openMenu = main.slice(
    main.indexOf('function openMenu('),
    main.indexOf('function resumeFromMenu()'),
  );

  const crashBlockEnd = openMenu.indexOf(
    'const anchor ='
  );

  assert.ok(crashBlockEnd > 0);
  assert.doesNotMatch(
    openMenu.slice(crashBlockEnd),
    /cameraRig\.update\(/,
  );
});

test('menu-to-map and map-to-menu transitions rebase before look reset', () => {
  const mapStart = main.indexOf(
    'function openNavigationMap()'
  );
  const mapEnd = main.indexOf(
    'function handleNavigationPing'
  );
  const transitions = main.slice(mapStart, mapEnd);

  assert.match(transitions, /capturePauseUiPose/);
  assert.equal(
    (transitions.match(/cameraRig\.beginMenuPose/g) ?? []).length,
    2,
  );
});

test('phone ping indicator is compact and horizontally stable', () => {
  assert.match(navigation, /camera\.getWorldDirection/);
  assert.match(navigation, /this\._cameraForward\.y = 0/);
  assert.match(
    navigation,
    /this\.phoneMode \? 0\.62 : 0\.82/,
  );
  assert.match(navigation, /this\.hudPlane\.quaternion\.identity/);
  assert.doesNotMatch(
    navigation,
    /this\.hudPlane\.lookAt\(0, 0, 0\)/,
  );
});

test('service worker update is forced without changing locked keys', () => {
  assert.match(sw, /SKYLINE_VR_UI_ANCHOR_PING_V1/);
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/);
});
