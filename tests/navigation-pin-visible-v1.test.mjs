import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const navigation = fs.readFileSync(
  'src/navigationMap/navigationMapSystem.js',
  'utf8',
);
const sw = fs.readFileSync('sw.js', 'utf8');

test('flight ping HUD is attached directly to the active camera', () => {
  assert.match(
    navigation,
    /_attachHudToCamera\(camera\)/,
  );
  assert.match(
    navigation,
    /camera\.add\(this\.hudRoot\)/,
  );
  assert.doesNotMatch(
    navigation,
    /this\.uiScene\.add\(this\.hudRoot\)/,
  );
});

test('camera-local HUD no longer copies absolute camera coordinates', () => {
  assert.doesNotMatch(
    navigation,
    /this\.hudRoot\.position\.copy\(camera\.position\)/,
  );
  assert.doesNotMatch(
    navigation,
    /this\.hudRoot\.quaternion\.copy\(camera\.quaternion\)/,
  );
  assert.match(
    navigation,
    /this\.hudRoot\.position\.set\(0, 0, 0\)/,
  );
});

test('phone indicator is visible and readable', () => {
  assert.match(
    navigation,
    /this\.phoneMode \? 0\.88 : 0\.94/,
  );
  assert.match(
    navigation,
    /this\.phoneMode \? 0\.32 : 0\.34/,
  );
  assert.match(
    navigation,
    /this\._hudAccumulator >= 0\.05/,
  );
});

test('physical world beacon is strongly visible at long range', () => {
  assert.match(navigation, /depthTest: false/);
  assert.match(navigation, /fog: false/);
  assert.match(navigation, /distance \/ 1050/);
  assert.match(navigation, /Math\.min\(\s*8,/);
  assert.match(navigation, /renderOrder = 18000/);
});

test('service worker identifies pin visibility deployment', () => {
  assert.match(
    sw,
    /SKYLINE_NAVIGATION_PIN_VISIBLE_V1/,
  );
  assert.match(
    sw,
    /SKYLINE_VR_MENU_MAP_FORWARD_V2/,
  );
  assert.match(
    sw,
    /skyline-biplane-zero-radio-v4-20260718/,
  );
});
