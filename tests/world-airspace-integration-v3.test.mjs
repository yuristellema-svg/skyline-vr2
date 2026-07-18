import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CollisionSystem } from '../src/collision.js';

const main = fs.readFileSync('src/main.js', 'utf8');
const world = fs.readFileSync('src/world/world.js', 'utf8');
const collisionSource = fs.readFileSync('src/collision.js', 'utf8');
const worldIntegration = fs.readFileSync(
  'tests/world-integration.test.mjs',
  'utf8',
);
const sw = fs.readFileSync('sw.js', 'utf8');

test('authored structure labels take priority over overlapping terrain', () => {
  const collision = new CollisionSystem(() => 100, 2);
  collision.addBox(
    -5, 5,
    40, 60,
    -5, 5,
    'old-stone-arches deck',
  );

  assert.equal(collision.check({ x: 0, y: 50, z: 0 }), true);
  assert.equal(collision.lastReason, 'old-stone-arches deck');
});

test('terrain still collides when no authored structure is hit', () => {
  const collision = new CollisionSystem(() => 100, 2);
  assert.equal(collision.check({ x: 0, y: 50, z: 0 }), true);
  assert.equal(collision.lastReason, 'Terrain');
});

test('authored collision loops remain before terrain in source', () => {
  const boxIndex = collisionSource.indexOf('this.boxes.length');
  const archIndex = collisionSource.indexOf('this.arches.length');
  const terrainIndex = collisionSource.lastIndexOf(
    "this.lastReason = 'Terrain'"
  );

  assert.ok(boxIndex >= 0);
  assert.ok(archIndex > boxIndex);
  assert.ok(terrainIndex > archIndex);
});

test('World Core draw increase is separately bounded to nine draws', () => {
  assert.match(worldIntegration, /LEGACY_WORLD_DRAW_CALLS = 431/);
  assert.match(
    worldIntegration,
    /ACCEPTED_WORLD_CORE_EXPANSION_DRAW_CALLS = 9/,
  );
  assert.match(
    worldIntegration,
    /world\.stats\.expansionDrawCalls <=/,
  );
});

test('World Core and Living Airspace are wired together', () => {
  assert.match(main, /createLivingAirspaceSystem/);
  assert.match(main, /sampleHeight:\s*world\.sampleHeight/);
  assert.match(main, /skylineWorldCoreDiagnostics/);
  assert.match(main, /skylineLivingAirspaceDiagnostics/);
  assert.match(world, /createWorldExpansion/);
  assert.match(world, /world-core-v2-manifest\.json/);
});

test('PWA shell contains World Core runtime modules', () => {
  for (const file of [
    'assets/world/world-core-v2-manifest.json',
    'src/worldExpansion/index.js',
    'src/worldExpansion/biomeModel.js',
    'src/worldExpansion/featuresRuntime.js',
    'src/worldExpansion/heightModel.js',
    'src/worldExpansion/layoutCompiler.js',
    'src/worldExpansion/manifest.js',
    'src/worldExpansion/math.js',
    'src/worldExpansion/terrainRuntime.js',
  ]) {
    assert.match(
      sw,
      new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  }
});

test('locked Biplane V4 identifiers remain unchanged', () => {
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/);
  assert.match(sw, /zero-radio\.mp3/);
  assert.match(sw, /stuka-siren\.mp3/);
});
