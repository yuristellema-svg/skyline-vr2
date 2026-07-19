import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.js', 'utf8');
const landing = fs.readFileSync(
  'src/expansion/landingSystem.js',
  'utf8',
);
const guidance = fs.readFileSync(
  'src/expansion/runwayGuidance.js',
  'utf8',
);
const map = fs.readFileSync(
  'src/navigationMap/mapCatalog.js',
  'utf8',
);
const sw = fs.readFileSync('sw.js', 'utf8');

test('live main keeps the constructor contract used by the deep airfield package', () => {
  assert.match(main, /new LandingSystem\(/);
  assert.match(main, /new RunwayGuidanceSystem\(/);
});

test('legacy landing and guidance files are replaced by the v2 systems', () => {
  assert.match(
    landing,
    /airfield|touchdown|runway/i,
  );
  assert.match(
    guidance,
    /airfield|approach|navigation/i,
  );
  assert.ok(landing.length > 5000);
  assert.ok(guidance.length > 2500);
});

test('all three operational fields are visible on the VR map', () => {
  for (const id of [
    'operational-skyline-municipal',
    'operational-crown-ridge',
    'operational-east-meadow-relief',
  ]) {
    assert.match(map, new RegExp(id));
  }
});

test('service worker caches the complete operational airfield runtime', () => {
  for (const token of [
    'SKYLINE_AIRFIELDS_LIVE_INTEGRATION_V2',
    './src/airfields/airfieldCatalog.js',
    './src/airfields/airfieldVisuals.js',
    './src/airfields/landingCapability.js',
    './src/airfields/terrainFit.js',
    './src/navigation/approachGuidance.js',
    './src/navigation/navigationVisuals.js',
    './src/navigation/radioNavigation.js',
    './src/expansion/landingSystem.js',
    './src/expansion/runwayGuidance.js',
  ]) {
    assert.match(
      sw,
      new RegExp(
        token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ),
    );
  }
});

test('existing map, city and pin deployments remain present', () => {
  assert.match(sw, /SKYLINE_NAVIGATION_PIN_VISIBLE_V1/);
  assert.match(sw, /SKYLINE_VR_MENU_MAP_FORWARD_V2/);
  assert.match(main, /createSettlementSystem/);
  assert.match(main, /createNavigationMapSystem/);
});
