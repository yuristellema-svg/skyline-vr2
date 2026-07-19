import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_AIRFIELD_CATALOG,
  normalizeAirfieldCatalog,
} from '../src/airfields/airfieldCatalog.js';

const catalog =
  normalizeAirfieldCatalog(
    DEFAULT_AIRFIELD_CATALOG
  );

const map = fs.readFileSync(
  'src/navigationMap/mapCatalog.js',
  'utf8',
);

const outer = fs.readFileSync(
  'src/worldCompletion/outerDetailSystem.js',
  'utf8',
);

const main = fs.readFileSync(
  'src/main.js',
  'utf8',
);

const sw = fs.readFileSync('sw.js', 'utf8');

test('Skyline Municipal now occupies the prepared Lake Country shelf', () => {
  const field =
    catalog.fields.find(
      item =>
        item.id === 'skyline-municipal'
    );

  assert.deepEqual(
    [field.center.x, field.center.z],
    [-6200, 800],
  );

  assert.equal(field.headingDegrees, 25);
  assert.equal(field.length, 1280);
  assert.equal(field.width, 48);
});

test('East Meadow now occupies the prepared South Coast shelf', () => {
  const field =
    catalog.fields.find(
      item =>
        item.id === 'east-meadow-relief'
    );

  assert.deepEqual(
    [field.center.x, field.center.z],
    [4200, -5900],
  );

  assert.equal(field.headingDegrees, -10);
  assert.equal(field.length, 1540);
  assert.equal(field.width, 55);
});

test('VR map points operational labels to the same World Core sites', () => {
  assert.match(
    map,
    /fallback:\s*\[-6200,\s*800\]/,
  );
  assert.match(
    map,
    /sourceIds:\s*\['lake-country-airfield',\s*'skyline-municipal'\]/,
  );
  assert.match(
    map,
    /fallback:\s*\[4200,\s*-5900\]/,
  );
  assert.doesNotMatch(
    map,
    /id:\s*'lake-country-airfield'/,
  );
  assert.doesNotMatch(
    map,
    /id:\s*'south-coast-airfield'/,
  );
});

test('outer detail consumes operational runway exclusions', () => {
  assert.match(
    outer,
    /pointExcludedByAirfield/,
  );
  assert.match(
    outer,
    /operationalAirfields/,
  );
  assert.match(
    main,
    /operationalAirfields:\s*landingSystem\.airfields/,
  );
});

test('service worker identifies the remapped live deployment', () => {
  assert.match(
    sw,
    /SKYLINE_AIRFIELD_WORLD_CORE_REMAP_V3/,
  );
  assert.match(
    sw,
    /SKYLINE_AIRFIELDS_LIVE_INTEGRATION_V2/,
  );
});
