import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const productionModules = [
  './src/worldDetail/authoredReference.js',
  './src/worldDetail/budget.js',
  './src/worldDetail/constants.js',
  './src/worldDetail/index.js',
  './src/worldDetail/layout.js',
  './src/worldDetail/materialPolicy.js',
  './src/worldDetail/math.js',
  './src/worldDetail/resourcePool.js',
  './src/worldDetail/runtimeMetrics.js',
  './src/worldDetail/safeRegistry.js',
  './src/worldDetail/threeRuntime.js',
  './src/worldDetail/worldDetailSystem.js',
];

test('WORLD detail v2.5 is wired as an optional sibling', () => {
  assert.match(main, /SKYLINE_WORLD_DETAIL_V25_INTEGRATION/);
  assert.match(main, /createWorldDetailSystem/);
  assert.match(main, /ensureWorldDetail\(phone\)/);
  assert.match(main, /worldDetail\?\.fixedStepUpdate/);
  assert.match(main, /worldDetail\?\.update/);
  assert.match(main, /skylineWorldDetailDiagnostics/);
});

test('WORLD detail does not register optional collision automatically', () => {
  assert.doesNotMatch(main, /collision\.(add|register|insert).*worldDetail/);
  assert.match(main, /skylineWorldDetailCollisionDescriptors/);
});

test('every WORLD production module is available to the service worker', () => {
  for (const modulePath of productionModules) {
    assert.ok(sw.includes(modulePath), modulePath);
  }
  assert.match(sw, /skyline-world-detail-v25-/);
});

test('index cache-busts the integrated main module', () => {
  assert.match(index, /main\.js\?v=.*world-detail-v25-/);
});
