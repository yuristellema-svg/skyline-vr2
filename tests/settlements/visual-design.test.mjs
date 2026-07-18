import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog } from './testContext.mjs';

const catalog = buildCatalog();
const city = catalog.manifest.settlements.find(item => item.id === 'aster-core');

function ids(descriptors) {
  return new Set(descriptors.map(item => item.id));
}

test('main city is deliberately composed around four signature anchors', () => {
  assert.equal(city.signatureSites.length, 4);
  assert.deepEqual(new Set(city.signatureSites.map(item => item.family)), new Set([
    'signature_needle',
    'signature_crown',
    'signature_gateway',
    'civic_rotunda',
  ]));
  const phoneRoles = new Set(catalog.tiers.low.descriptors.map(item => item.role));
  for (const role of [
    'signature-needle-shaft',
    'signature-stepped-crown',
    'signature-gateway-tower',
    'civic-dome',
  ]) assert.ok(phoneRoles.has(role), `phone lost ${role}`);
});

test('city negative space survives every quality tier before windows or details', () => {
  assert.ok(city.publicSpaces.length >= 6);
  const expected = new Set([
    'civic-square',
    'urban-park',
    'market-square',
    'waterfront-promenade',
    'service-corridor',
  ]);
  for (const quality of ['low', 'medium', 'high']) {
    const roles = new Set(catalog.tiers[quality].descriptors.map(item => item.role));
    for (const role of expected) assert.ok(roles.has(role), `${quality} lost ${role}`);
  }
  const opening = city.publicSpaces.find(item => item.id === 'river-opening');
  assert.equal(opening.renderSurface, false);
  for (const parcel of catalog.parcelsBySettlement['aster-core']) {
    const dx = Math.abs(parcel.x - opening.anchor[0]);
    const dz = Math.abs(parcel.z - opening.anchor[1]);
    assert.ok(dx > opening.width * 0.45 || dz > opening.depth * 0.45, `${parcel.id} filled waterfront opening`);
  }
});

test('district identity is carried by massing, roofline and material rather than windows', () => {
  const main = catalog.allDescriptors.filter(item => item.settlementId === 'aster-core');
  const primary = main.filter(item => !['windows', 'details'].includes(item.category));
  assert.ok(primary.length > 80);
  const districtColors = new Map();
  const districtPrimitives = new Map();
  for (const item of primary) {
    if (!item.districtId) continue;
    if (!districtColors.has(item.districtId)) districtColors.set(item.districtId, new Set());
    if (!districtPrimitives.has(item.districtId)) districtPrimitives.set(item.districtId, new Set());
    districtColors.get(item.districtId).add(item.color);
    districtPrimitives.get(item.districtId).add(item.primitive);
  }
  assert.ok(districtColors.get('aster-downtown').has('#8399a1'));
  assert.ok(districtColors.get('aster-civic').has('#d6cbb2'));
  assert.ok(districtColors.get('aster-old-quarter').has('#a96f55') || districtColors.get('aster-old-quarter').has('#bd8061'));
  assert.ok(districtPrimitives.get('aster-downtown').has('tapered'));
  assert.ok(districtPrimitives.get('aster-civic').has('dome'));
  assert.ok(districtPrimitives.get('aster-old-quarter').has('gable'));
});

test('controlled height gradient makes downtown dominant without random isolated towers', () => {
  const parcels = catalog.parcelsBySettlement['aster-core'];
  const downtown = parcels.filter(item => item.districtId === 'aster-downtown');
  const old = parcels.filter(item => item.districtId === 'aster-old-quarter');
  const generatedDowntown = downtown.filter(item => !item.signature);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.max(...downtown.map(item => item.height)) >= 170);
  assert.ok(average(generatedDowntown.map(item => item.height)) > average(old.map(item => item.height)) * 2.5);
  assert.ok(generatedDowntown.every(item => item.height < 90));
});

test('harbour and industry are compounds with authored yards, groups and service gaps', () => {
  const harbour = catalog.manifest.settlements.find(item => item.id === 'port-aster');
  const industry = catalog.manifest.settlements.find(item => item.id === 'forge-district');
  assert.deepEqual(harbour.berthGroups, [2, 2, 1]);
  assert.ok(harbour.publicSpaces.filter(item => item.kind === 'loading-yard').length >= 2);
  assert.ok(harbour.publicSpaces.some(item => item.kind === 'waterfront-gap'));
  assert.ok(industry.publicSpaces.some(item => item.kind === 'rail-corridor'));
  assert.ok(industry.publicSpaces.filter(item => item.kind === 'loading-yard').length >= 2);
  const piers = catalog.allDescriptors.filter(item => item.role === 'harbour-cargo-pier');
  assert.deepEqual(new Set(piers.map(item => item.meta.berthGroup)), new Set([0, 1, 2]));
});

test('towns and villages use distinct organizing patterns and civic centres', () => {
  const byId = Object.fromEntries(catalog.manifest.settlements.map(item => [item.id, item]));
  assert.equal(byId['birch-town'].organizingPattern, 'main-street');
  assert.equal(byId['cedar-town'].organizingPattern, 'green');
  assert.equal(byId['stone-village'].organizingPattern, 'crossroads');
  assert.equal(byId['ridge-hamlet'].organizingPattern, 'ridge');
  assert.ok(byId['birch-town'].signatureSites.some(item => item.family === 'civic_hall'));
  assert.ok(byId['cedar-town'].signatureSites.some(item => item.family === 'market_block'));
  assert.ok(byId['stone-village'].publicSpaces.some(item => item.kind === 'town-green'));
});

test('phone tier retains primary massing independent of windows', () => {
  const phone = catalog.tiers.low.descriptors;
  const primary = phone.filter(item => !['windows', 'details'].includes(item.category));
  assert.ok(primary.length > 420);
  const primaryIds = ids(primary);
  for (const item of catalog.allDescriptors.filter(item => item.essential && item.qualityRank === 0 && !['windows', 'details'].includes(item.category))) {
    assert.ok(primaryIds.has(item.id), `phone lost primary mass ${item.id}`);
  }
});

test('real preview harness uses WebGLRenderer, actual renderer modules and all proof views', async () => {
  const preview = await readFile(new URL('../../settlement-preview/preview.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../../settlement-preview/index.html', import.meta.url), 'utf8');
  assert.match(preview, /new THREE\.WebGLRenderer/);
  assert.match(preview, /createSettlementSystem/);
  assert.match(preview, /SAMPLE_WORLD_MANIFEST/);
  for (const view of ['aerial', 'approach', 'downtown', 'skyline', 'civic', 'oldquarter', 'harbour', 'town', 'village']) {
    assert.match(preview, new RegExp(`${view}:`));
  }
  assert.match(html, /PHONE/);
  assert.match(html, /SUNSET/);
  assert.match(html, /NIGHT/);
});
