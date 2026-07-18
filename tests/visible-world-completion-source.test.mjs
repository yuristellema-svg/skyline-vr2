import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main =
  fs.readFileSync('src/main.js', 'utf8');
const menu =
  fs.readFileSync('src/menu.js', 'utf8');
const layout =
  fs.readFileSync(
    'src/workerNav/horizontalMenuLayout.js',
    'utf8',
  );
const sw =
  fs.readFileSync('sw.js', 'utf8');
const outer =
  fs.readFileSync(
    'src/worldCompletion/outerDetailSystem.js',
    'utf8',
  );

test('the live runtime wires all visible-world systems', () => {
  for (const token of [
    'createSettlementSystem',
    'createWorldSettlementManifest',
    'createOuterDetailSystem',
    'createLocalInfrastructureSystem',
    'createWorldLivingAirspaceCatalog',
    'createNavigationMapSystem',
    'skylineSettlementDiagnostics',
    'skylineOuterDetailDiagnostics',
    'skylineNavigationMapDiagnostics',
  ]) {
    assert.match(main, new RegExp(token));
  }
});

test('map exists in phone and desktop menu definitions', () => {
  assert.match(layout, /id:\s*'map'/);
  assert.match(layout, /NAVIGATION \+ PING/);
  assert.match(menu, /id === 'map'/);
  assert.match(menu, /this\.actions\.map/);
});

test('outer detail system owns no private animation loop', () => {
  assert.doesNotMatch(
    outer,
    /requestAnimationFrame\s*\(/,
  );
});

test('service worker includes completion modules', () => {
  for (const token of [
    'src/navigationMap/navigationMapSystem.js',
    'src/worldCompletion/settlementManifestAdapter.js',
    'src/worldCompletion/outerDetailSystem.js',
    'src/worldCompletion/livingAirspaceCatalog.js',
    'src/settlements/settlementSystem.js',
  ]) {
    assert.match(
      sw,
      new RegExp(
        token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ),
    );
  }
});

test('locked Biplane deployment keys remain unchanged', () => {
  assert.match(
    sw,
    /skyline-biplane-zero-radio-v4-20260718/,
  );
  assert.match(
    sw,
    /\.\/src\/main\.js\?v=biplane-zero-radio-v4/,
  );
});
