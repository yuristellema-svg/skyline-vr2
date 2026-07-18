import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.js', 'utf8');
const menu = fs.readFileSync('src/menu.js', 'utf8');
const layout = fs.readFileSync(
  'src/workerNav/horizontalMenuLayout.js',
  'utf8',
);
const system = fs.readFileSync(
  'src/navigationMap/navigationMapSystem.js',
  'utf8',
);
const sw = fs.readFileSync('sw.js', 'utf8');

test('map is available from both phone and desktop flight menus', () => {
  assert.match(layout, /id:\s*'map'/);
  assert.match(layout, /'MAP'/);
  assert.match(menu, /id === 'map'/);
  assert.match(menu, /this\.actions\.map/);
});

test('main wires map open, live position, ping and diagnostics', () => {
  assert.match(main, /createNavigationMapSystem/);
  assert.match(main, /openNavigationMap/);
  assert.match(main, /returnToMenuFromNavigationMap/);
  assert.match(main, /navigationMap\.update/);
  assert.match(main, /skylineNavigationMapDiagnostics/);
  assert.match(main, /world\.getWorldManifest/);
});

test('navigation map owns no private frame loop', () => {
  assert.doesNotMatch(system, /requestAnimationFrame\s*\(/);
});

test('PWA shell includes every navigation map module', () => {
  for (const file of [
    'src/navigationMap/index.js',
    'src/navigationMap/mapCatalog.js',
    'src/navigationMap/navigationMapSystem.js',
  ]) {
    assert.match(
      sw,
      new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  }
});

test('locked Biplane cache identifiers remain unchanged', () => {
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/);
});
