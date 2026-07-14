import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manifest and iPhone standalone assets are valid', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'landscape');
  assert.equal(manifest.id, './');
  const touch = manifest.icons.find(icon => icon.sizes === '180x180' && icon.type === 'image/png');
  assert.ok(touch);
  assert.ok(fs.existsSync(path.join(root, touch.src.replace('./', ''))));
});

test('service worker precaches the complete Iteration 3 runtime and world metadata', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const required = [
    'index.html', 'styles.css', 'bundle.js', 'manifest.webmanifest', 'apple-touch-icon.png',
    'vendor/three.module.min.js', 'src/main.js', 'src/config.js', 'src/input.js',
    'src/flightModel.js', 'src/collision.js', 'src/camera.js', 'src/effects.js',
    'src/stereo.js', 'src/menu.js', 'src/hud.js', 'src/world/world.js',
    'assets/world/manifest.json', 'assets/world/features.json',
  ];
  for (const directory of ['runtime', 'features']) {
    for (const filename of fs.readdirSync(path.join(root, 'src', 'world', directory))) {
      if (filename.endsWith('.js')) required.push(`src/world/${directory}/${filename}`);
    }
  }
  for (const asset of required) assert.match(sw, new RegExp(asset.replaceAll('.', '\\.')));
  assert.doesNotMatch(sw, /src\/world\/testBox\.js/);
  assert.match(sw, /iteration-3-open-world/);
});

test('precache contains the spawn load region but not the full baked world', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'world', 'manifest.json'), 'utf8'));
  const cachedPaths = new Set(Array.from(
    sw.matchAll(/['"]\.\/(assets\/world\/packs\/r\d{2}_\d{2}\.wpk)['"]/g),
    match => match[1],
  ));

  const expected = new Set();
  const world = manifest.world;
  const chunksPerPack = world.packSizeMeters / world.chunkSizeMeters;
  const spawnX = CONFIG.world.spawn[0];
  const spawnZ = CONFIG.world.spawn[2];
  for (let chunkZ = 0; chunkZ < world.chunksPerSide; chunkZ += 1) {
    for (let chunkX = 0; chunkX < world.chunksPerSide; chunkX += 1) {
      const centerX = world.bounds.minX + (chunkX + 0.5) * world.chunkSizeMeters;
      const centerZ = world.bounds.minZ + (chunkZ + 0.5) * world.chunkSizeMeters;
      if (Math.hypot(centerX - spawnX, centerZ - spawnZ) > CONFIG.world.loadRadius) continue;
      const regionX = Math.floor(chunkX / chunksPerPack);
      const regionZ = Math.floor(chunkZ / chunksPerPack);
      expected.add(`assets/world/packs/r${String(regionX).padStart(2, '0')}_${String(regionZ).padStart(2, '0')}.wpk`);
    }
  }

  assert.deepEqual(cachedPaths, expected);
  assert.ok(cachedPaths.size > 0 && cachedPaths.size < manifest.packs.length);
  let cachedBytes = 0;
  for (const asset of cachedPaths) {
    const filename = path.join(root, asset);
    assert.ok(fs.existsSync(filename), `${asset} is missing`);
    cachedBytes += fs.statSync(filename).size;
  }
  const allPackBytes = manifest.packs.reduce((sum, pack) => sum + pack.byteLength, 0);
  assert.ok(cachedBytes < allPackBytes / 2, 'spawn cache accidentally includes too much of the world');
});

test('same-origin world packs use dynamic network-first caching with offline navigation fallback', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /function isWorldPackRequest\(url\)/);
  assert.match(sw, /WORLD_PACK_PATH\.test\(url\.pathname\)/);
  assert.match(sw, /if \(isWorldPackRequest\(url\)\)[\s\S]*respondWith\(networkFirst\(event\.request\)\)/);
  assert.match(sw, /async function networkFirst[\s\S]*await fetch\(request\)[\s\S]*cacheSuccessfulResponse/);
  assert.match(sw, /cache\.put\(request, response\.clone\(\)\)/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /event\.request\.mode === 'navigate'[\s\S]*networkFirst\(event\.request, true\)/);
  assert.match(sw, /caches\.match\('\.\/index\.html', \{ ignoreSearch: true \}\)/);
});

test('all local module imports resolve', () => {
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(root, 'src'));
  files.push(path.join(root, 'bundle.js'));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1] || match[2];
      if (!specifier.startsWith('.')) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), specifier)), `${file}: ${specifier}`);
    }
  }
});

test('manual world, UI and overlay rendering does not clear between passes', () => {
  const stereo = fs.readFileSync(path.join(root, 'src', 'stereo.js'), 'utf8');
  assert.match(stereo, /renderer\.autoClear\s*=\s*false/);
  assert.match(stereo, /renderer\.clearDepth\(\)[\s\S]*renderer\.render\(this\.uiScene/);
  assert.match(stereo, /renderer\.clearDepth\(\)[\s\S]*renderer\.render\(this\.overlayScene/);
});
