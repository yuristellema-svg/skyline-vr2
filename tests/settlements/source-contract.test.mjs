import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../../src/settlements/', import.meta.url);
const files = (await readdir(root)).filter(name => name.endsWith('.js'));
const sources = await Promise.all(files.map(async name => [name, await readFile(new URL(name, root), 'utf8')]));
const joined = sources.map(([, source]) => source).join('\n');

test('package owns no private animation loop, timers or scene traversal recolouring', () => {
  assert.doesNotMatch(joined, /requestAnimationFrame|setInterval\s*\(|setTimeout\s*\(|scene\.traverse\s*\(/);
  assert.doesNotMatch(joined, /emissiveIntensity\s*:\s*[1-9]|emissiveIntensity\s*=\s*[1-9]/);
});

test('package does not import or modify forbidden runtime systems', () => {
  assert.doesNotMatch(joined, /\.\.\/main\.js|flightModel|camera\.js|input\.js|menu\.js|aircraftVisuals|world\/world\.js/);
  assert.match(joined, /createsRoads:\s*false/);
  assert.match(joined, /createsTerrain:\s*false/);
  assert.match(joined, /createsWater:\s*false/);
});

test('public API exposes the complete requested lifecycle', async () => {
  const source = await readFile(new URL('../../src/settlements/settlementSystem.js', import.meta.url), 'utf8');
  for (const method of ['setPhoneMode', 'setQuality', 'fixedStepUpdate', 'update', 'getStatus', 'dispose']) {
    assert.match(source, new RegExp(`${method}\\s*\\(`));
  }
  const indexSource = await readFile(new URL('../../src/settlements/index.js', import.meta.url), 'utf8');
  assert.match(indexSource, /createSettlementSystem/);
  assert.match(indexSource, /validateSettlementManifest/);
  assert.match(indexSource, /registerCollisionCatalog/);
});

test('renderer structurally separates explicit light materials from facade materials', async () => {
  const source = await readFile(new URL('../../src/settlements/threeRenderer.js', import.meta.url), 'utf8');
  assert.match(source, /Settlement explicit emission/);
  assert.match(source, /Settlement non-emissive/);
  assert.match(source, /wholeBuildingEmission:\s*false/);
  assert.match(source, /sceneWideMaterialScans:\s*0/);
});
