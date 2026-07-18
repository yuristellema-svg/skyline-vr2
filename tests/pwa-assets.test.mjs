import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8',
  );
}

test('manifest and iPhone assets are valid', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));

  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.orientation, 'landscape');

  assert.ok(
    manifest.icons.some(
      icon =>
        icon.src === './icon.svg' &&
        icon.type === 'image/svg+xml',
    ),
  );

  assert.ok(
    fs.existsSync(
      path.join(root, 'icon.svg'),
    ),
  );

  assert.ok(
    fs.existsSync(
      path.join(root, 'apple-touch-icon.png'),
    ),
  );
});

test('service worker contains the current runtime and new assets', () => {
  const sw = read('sw.js');

  const required = [
    'index.html',
    'styles.css',
    'manifest.webmanifest',
    'apple-touch-icon.png',
    'vendor/three.module.min.js',
    'src/main.js',
    'src/config.js',
    'src/input.js',
    'src/flightModel.js',
    'src/camera.js',
    'src/menu.js',
    'src/aircraftVisuals.js',
    'src/aircraftFlightProfiles.js',
    'src/windAudio.js',
    'src/expansion/radioBeacon.js',
    'src/audio/zeroRadioAudio.js',
    'src/audio/stukaDiveSiren.js',
    'src/aircraft/biplaneCockpit.js',
    'src/aircraft/biplaneExternal.js',
    'assets/audio/zero-radio.mp3',
    'assets/audio/stuka-siren.mp3',
  ];

  for (const asset of required) {
    assert.match(
      sw,
      new RegExp(asset.replaceAll('.', '\\.')),
      asset,
    );
  }

  assert.match(
    sw,
    /skyline-biplane-mobile-audio-controls-v2-20260718/,
  );
});

test('service worker updates from the network first', () => {
  const sw = read('sw.js');

  assert.match(sw, /async function networkFirst/);
  assert.match(sw, /await fetch\(request\)/);
  assert.match(sw, /cache\.put\(request, response\.clone\(\)\)/);
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(
    sw,
    /networkFirst\(request, '\.\/index\.html'\)/,
  );
});

test('all local JavaScript imports resolve', () => {
  const files = [];

  const walk = directory => {
    for (
      const entry of fs.readdirSync(
        directory,
        { withFileTypes: true },
      )
    ) {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        files.push(full);
      }
    }
  };

  walk(path.join(root, 'src'));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');

    for (
      const match of source.matchAll(
        /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g,
      )
    ) {
      const specifier = match[1] || match[2];

      if (!specifier.startsWith('.')) {
        continue;
      }

      const fileSpecifier =
        specifier.replace(/[?#].*$/, '');

      assert.ok(
        fs.existsSync(
          path.resolve(
            path.dirname(file),
            fileSpecifier,
          ),
        ),
        `${file}: ${specifier}`,
      );
    }
  }
});
