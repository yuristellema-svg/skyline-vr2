import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.js', 'utf8');
const polish = fs.readFileSync('src/worldPolish.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

test('Living Airspace is wired once and duplicate cloud and AI owners stay disabled', () => {
  assert.equal(
    (main.match(/createLivingAirspaceSystem/g) ?? []).length,
    2,
  );
  assert.match(main, /livingAirspace\.setPhoneMode\(phone\)/);
  assert.match(main, /livingAirspace\.fixedStepUpdate/);
  assert.match(main, /livingAirspace\.update/);
  assert.match(main, /clouds:\s*false/);
  assert.match(main, /aiTraffic:\s*false/);
  assert.match(main, /skylineLivingAirspaceDiagnostics/);
});

test('the existing WorldPolish audio graph receives new traffic descriptors', () => {
  assert.match(polish, /trafficSourceProvider/);
  assert.match(main, /trafficSourceProvider:[\s\S]*getAudioSources/);
});

test('all Living Airspace runtime modules are in the PWA shell', () => {
  for (const file of [
    'index.js',
    'system.js',
    'constants.js',
    'catalog.js',
    'math.js',
    'quality.js',
    'resources.js',
    'birds.js',
    'traffic.js',
    'clouds.js',
    'depth.js',
  ]) {
    assert.match(
      sw,
      new RegExp(`livingAirspace/${file.replace('.', '\\.')}`),
    );
  }
});

test('locked Biplane V4 cache identifiers remain unchanged', () => {
  assert.match(index, /biplane-zero-radio-v4/);
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/);
  assert.match(sw, /zero-radio\.mp3/);
  assert.match(sw, /stuka-siren\.mp3/);
});
