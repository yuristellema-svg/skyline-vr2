import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const paths = [
  'src/worldExpansion/index.js',
  'src/worldExpansion/math.js',
  'src/worldExpansion/manifest.js',
  'src/worldExpansion/heightModel.js',
  'src/worldExpansion/biomeModel.js',
  'src/worldExpansion/layoutCompiler.js',
  'src/worldExpansion/terrainRuntime.js',
  'src/worldExpansion/featuresRuntime.js',
  'src/world/world.js',
];
const sources = Object.fromEntries(paths.map(path => [path, fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')]));

test('world expansion owns no private frame loop or forbidden integration import', () => {
  for (const [path, source] of Object.entries(sources)) {
    assert.doesNotMatch(source, /requestAnimationFrame|setAnimationLoop/, path);
  }
  const expansionSource = Object.entries(sources).filter(([path]) => path.includes('worldExpansion')).map(([, source]) => source).join('\n');
  assert.doesNotMatch(expansionSource, /main\.js|flightModel|camera\.js|input\.js|menu\.js|audio/i);
  assert.doesNotMatch(expansionSource, /scene\.traverse|root\.traverse/);
  assert.match(sources['src/worldExpansion/featuresRuntime.js'], /heightModel\.sampleHeight\(a\[0\], a\[1\]\)/, 'road ribbons must sample final visible terrain');
});

test('world runtime integrates expansion through existing lifecycle and exports worker catalogs', () => {
  const source = sources['src/world/world.js'];
  assert.match(source, /createWorldExpansion/);
  assert.match(source, /this\.expansion\s*=\s*createWorldExpansion/);
  assert.match(source, /this\.expansion\s*\?\.update/);
  assert.match(source, /this\.expansion\s*\?\.dispose/);
  assert.match(source, /this\.expansion\s*\?\.sampleHeight/);
  for (const method of [
    'getWorldManifest',
    'getLandingCatalog',
    'getSettlementCatalog',
    'getRoadCatalog',
    'getAirfieldCatalog',
    'getWaterCatalog',
    'getWorldDiagnostics',
  ]) assert.match(source, new RegExp(`${method}\\(`), method);
});

test('phone feature contract preserves one shared world with bounded density', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));
  assert.ok(manifest.streaming.triangleBudget <= 300000);
  assert.ok(manifest.streaming.maximumLoadedChunks <= 108);
  assert.ok(manifest.streaming.cacheEntries >= 64);
  assert.equal(manifest.streaming.renderSpacingMeters.length, 3);
  assert.ok(manifest.budgets.targetPhoneDrawCalls <= 18);
  assert.equal(manifest.budgets.transparentDrawCalls, 1);
  assert.equal(manifest.airfields.length, 2);
  assert.equal(manifest.roads.length, 13);
  assert.equal(manifest.settlements.length, 8);
});
