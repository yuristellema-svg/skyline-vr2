import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basePackedHeight } from './fixtures/baseWorldSampler.mjs';
import { createWorldSettlementManifest } from '../src/worldCompletion/settlementManifestAdapter.js';
import { buildSettlementCatalog } from '../src/settlements/catalogBuilder.js';

const adapter = await readFile(
  new URL('../src/worldCompletion/settlementManifestAdapter.js', import.meta.url),
  'utf8',
);
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const world = await readFile(new URL('../src/world/world.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const audit = JSON.parse(await readFile(
  new URL('../EXACT_SIGNATURE_AUDIT.json', import.meta.url),
  'utf8',
));
const installer = await readFile(
  new URL('../install-live-city-grounding-v5.sh', import.meta.url),
  'utf8',
).catch(() => '');

function authoredSignatureSites(manifest) {
  return manifest.settlements.flatMap(settlement =>
    (settlement.signatureSites ?? []).map(site => ({ settlement, site }))
  );
}

test('V5 uses the audited western city transform directly from the clean live base', () => {
  assert.match(adapter, /SKYLINE_LIVE_CITY_GROUNDING_V5/);
  assert.match(adapter, /const scale = Math\.min\(1, 7600 \/ Math\.max\(width, depth\)\)/);
  assert.match(adapter, /const targetCenterX = -1965;/);
  assert.match(adapter, /const targetCenterZ = -451;/);
  assert.doesNotMatch(adapter, /const targetCenterX = 2450;/);
  assert.doesNotMatch(adapter, /const targetCenterZ = -2050;/);
  assert.match(adapter, /site\.maxTerrainDelta = Math\.max/);
  assert.match(adapter, /4\.25/);
  assert.match(adapter, /site\.maxFoundationDepth = Math\.max/);
});

test('every authored signature building passes exact packed-terrain planning', () => {
  const manifest = createWorldSettlementManifest({
    seed: 3182026,
    roads: [],
  });
  const authored = authoredSignatureSites(manifest);
  assert.ok(authored.length >= 10, 'expected complete authored signature-site set');

  const catalog = buildSettlementCatalog({
    manifest,
    sampleHeight: basePackedHeight,
  });

  const planned = Object.values(catalog.parcelsBySettlement)
    .flat()
    .filter(parcel => parcel.signature);

  assert.equal(
    planned.length,
    authored.length,
    'no signature landmark may be rejected by terrain safety',
  );

  const byId = new Map(planned.map(parcel => [parcel.signatureId, parcel]));
  for (const { settlement, site } of authored) {
    const parcel = byId.get(site.id);
    assert.ok(parcel, `${settlement.id}/${site.id} was not planned`);
    assert.ok(
      parcel.foundation.terrain.delta <= site.maxTerrainDelta + 1e-9,
      `${settlement.id}/${site.id} terrain delta ${parcel.foundation.terrain.delta.toFixed(3)} exceeds ${site.maxTerrainDelta}`,
    );
    assert.ok(
      parcel.foundation.depthY <= site.maxFoundationDepth + 1e-9,
      `${settlement.id}/${site.id} foundation depth ${parcel.foundation.depthY.toFixed(3)} exceeds ${site.maxFoundationDepth}`,
    );
  }

  const maximumDelta = Math.max(
    ...planned.map(parcel => parcel.foundation.terrain.delta),
  );
  const maximumDepth = Math.max(
    ...planned.map(parcel => parcel.foundation.depthY),
  );
  assert.ok(maximumDelta <= 4.25, `maximum signature delta is ${maximumDelta.toFixed(3)} m`);
  assert.ok(maximumDepth <= 4.80, `maximum signature foundation is ${maximumDepth.toFixed(3)} m`);
});


test('recorded exact audit matches the runtime transform and strict limits', () => {
  assert.equal(audit.baseCommit, '09d0b01fb626a29e45a262583fe1f88173939a09');
  assert.deepEqual(audit.settlementTransform.targetCenter, [-1965, -451]);
  assert.equal(audit.signatureSites.length, 10);
  assert.ok(audit.observedMaximums.terrainDeltaMeters < 4.0);
  assert.ok(audit.observedMaximums.foundationDepthMeters < 4.8);
  assert.ok(
    audit.observedMaximums.terrainDeltaMeters <=
      audit.limits.maximumSignatureTerrainDeltaMeters,
  );
});

test('settlements, roads and collisions are created only after terrain preload', () => {
  assert.match(main, /SKYLINE_LIVE_CITY_GROUNDING_V5/);
  assert.match(main, /async function initializeGroundedSettlementWorld\(\)/);
  const start = main.indexOf('async function initializeGroundedSettlementWorld()');
  const end = main.indexOf('function ensureInitialWorld()', start);
  const lifecycle = main.slice(start, end);
  const preload = lifecycle.indexOf('await world.preloadSpawn');
  const settlement = lifecycle.indexOf('createSettlementSystem');
  const infrastructure = lifecycle.indexOf('createLocalInfrastructureSystem');
  assert.ok(preload >= 0 && preload < settlement);
  assert.ok(settlement < infrastructure);
  assert.match(main, /initializeGroundedSettlementWorld\(\)[\s\S]*?world\.preloadSpawn\(\s*CONFIG\.world\.spawn/);
  assert.match(main, /settlements\?\.setPhoneMode\(phone\)/);
  assert.match(main, /settlements\?\.fixedStepUpdate\?\.\(/);
  assert.match(main, /settlements\?\.update\(/);
  assert.match(main, /localInfrastructure\?\.update\(/);
});

test('the drowned legacy box city is neither rendered nor collision-registered', () => {
  assert.match(world, /SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V5/);
  assert.match(world, /this\.city\.group\.visible = false/);

  const marker = world.indexOf('SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V5');
  const rootAddStart = world.indexOf('this.root.add(', marker);
  const rootAddEnd = world.indexOf(');', rootAddStart);
  assert.ok(rootAddStart >= 0 && rootAddEnd > rootAddStart);
  assert.doesNotMatch(world.slice(rootAddStart, rootAddEnd), /this\.city/);

  const sentinelStart = world.indexOf('retiredCityLandmarkIds', rootAddEnd);
  const expansionStart = world.indexOf('this.expansion =', sentinelStart);
  const sentinels = world.slice(sentinelStart, expansionStart);
  assert.ok(sentinelStart >= 0, 'retired city landmark sentinels missing');
  assert.doesNotMatch(sentinels, /this\.city[\s\S]*registerCollisions/);
  assert.match(sentinels, /-8192/);
  assert.match(sentinels, /tower_pair/);
  assert.match(sentinels, /open_atrium/);
  assert.match(sentinels, /retired compatibility sentinel/);
});

test('locked Biplane deployment and audio identifiers remain unchanged', () => {
  assert.match(index, /src\/main\.js\?v=biplane-zero-radio-v4/);
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/);
  assert.match(sw, /zero-radio\.mp3/);
  assert.match(sw, /stuka-siren\.mp3/);
  assert.doesNotMatch(index, /city-grounding-live/);
  assert.doesNotMatch(sw, /city-grounding-live/);
});

test('installer is rebased to the exact current clean live commit', () => {
  if (!installer) return;
  assert.match(installer, /09d0b01fb626a29e45a262583fe1f88173939a09/);
  assert.doesNotMatch(installer, /VERIFYING V3 LIVE BASE/);
  assert.match(installer, /npm test/);
  assert.match(installer, /CURRENT_LIVE/);
  assert.match(installer, /refs\/heads\/gh-pages/);
  assert.doesNotMatch(installer, /--force[^\n]*refs\/heads\/gh-pages/);
});
