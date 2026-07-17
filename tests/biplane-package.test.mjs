import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionDirectory = path.join(root, 'src', 'aircraft');
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, 'BIPLANE_PACKAGE_MANIFEST.json'),
  'utf8',
));
const names = fs.readdirSync(productionDirectory)
  .filter(name => name.startsWith('biplane'))
  .sort();

const requiredModules = [
  'biplaneCockpit.js',
  'biplaneExternal.js',
  'biplaneProfile.js',
  'biplaneRuntime.js',
  'biplaneSpecs.js',
  'biplaneVisualShared.js',
];

test('package contains the complete isolated biplane module set', () => {
  for (const name of requiredModules) {
    assert.ok(names.includes(name), name);
    assert.ok(manifest.files.includes(`src/aircraft/${name}`), name);
  }
  assert.equal(manifest.liveRosterWiringIncluded, false);
});

test('production modules do not import another aircraft cockpit or model', () => {
  const source = requiredModules.map(name => fs.readFileSync(
    path.join(productionDirectory, name),
    'utf8',
  )).join('\n');
  assert.doesNotMatch(source, /a6m|zeroCockpit|stuka|scout|glider/i);
});

test('package manifest excludes forbidden live integration files', () => {
  const forbidden = new Set([
    'src/main.js',
    'src/camera.js',
    'src/input.js',
    'src/menu.js',
    'src/flightModel.js',
    'src/renderPoseInterpolator.js',
    'src/worldPolish.js',
    'src/windAudio.js',
    'sw.js',
    'tools/serve.mjs',
  ]);
  for (const relative of manifest.files) {
    assert.equal(forbidden.has(relative), false, relative);
  }
});
