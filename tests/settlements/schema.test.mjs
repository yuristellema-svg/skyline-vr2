import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSettlementManifest } from '../../src/settlements/manifest.js';
import { SAMPLE_WORLD_MANIFEST } from '../../src/settlements/sampleCatalog.js';

const schemaUrl = new URL('../../src/settlements/settlementPlacement.schema.json', import.meta.url);

test('machine-readable placement schema documents the authoritative integration contract', async () => {
  const schema = JSON.parse(await readFile(schemaUrl, 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(schema.required, [
    'version', 'worldId', 'waterLevel', 'roads', 'shorelines', 'exclusions', 'settlements', 'landmarks',
  ]);
  assert.deepEqual(schema.$defs.shoreline.properties.waterSide.enum, [-1, 1]);
  assert.ok(schema.$defs.settlement.properties.kind.enum.includes('harbour'));
  assert.ok(schema.$defs.landmark.properties.kind.enum.includes('radio_tower'));
});

test('shoreline direction is mandatory rather than guessed', () => {
  const copy = structuredClone(SAMPLE_WORLD_MANIFEST);
  delete copy.shorelines[0].waterSide;
  assert.throws(
    () => validateSettlementManifest(copy),
    /waterSide must be -1 or 1/,
  );
});
