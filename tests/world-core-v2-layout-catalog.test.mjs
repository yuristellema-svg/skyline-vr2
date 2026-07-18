import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createExpansionHeightModel } from '../src/worldExpansion/heightModel.js';
import { compileAirfieldCatalog, compileSettlementCatalog, pointInAirfieldSite } from '../src/worldExpansion/layoutCompiler.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));
const model = createExpansionHeightModel(manifest, { coreSampleHeight: () => 74 });

test('settlement catalog deterministically fills all replacement-ready lots', () => {
  const first = compileSettlementCatalog(model);
  const second = compileSettlementCatalog(model);
  assert.deepEqual(first, second);
  assert.equal(first.settlements.length, manifest.settlements.length);
  assert.equal(first.lots.length, manifest.budgets.maximumSettlementInstances);
  assert.equal(new Set(first.lots.map(lot => lot.id)).size, first.lots.length);
  for (const settlement of first.settlements) {
    const definition = manifest.settlements.find(item => item.id === settlement.id);
    assert.equal(settlement.lots.length, definition.buildingCount, settlement.id);
    assert.equal(settlement.reservedWorkerZone, true);
  }
  for (const lot of first.lots) {
    assert.equal(lot.workerReplaceable, true);
    assert.ok(lot.position.every(Number.isFinite));
    assert.ok(lot.footprintMeters.every(value => value > 8));
    assert.ok(lot.heightMeters > 4);
    assert.equal(model.waterSurfaceAt(lot.position[0], lot.position[2]), null, lot.id);
    assert.ok(lot.slope <= 0.38, `${lot.id} slope ${lot.slope}`);
    assert.ok(lot.roadDistanceMeters >= 7);
  }
});

test('airfield catalog exposes full sites and two safe approach directions per runway', () => {
  const catalog = compileAirfieldCatalog(model);
  assert.equal(catalog.length, 2);
  for (const airfield of catalog) {
    assert.ok(airfield.landing);
    assert.equal(airfield.approachCorridors.length, 2);
    assert.ok(pointInAirfieldSite(...airfield.center, airfield));
    assert.ok(airfield.site.apron.sizeMeters.every(value => value >= 100));
    assert.ok(airfield.site.hangarPads.length >= 2);
    for (const corridor of airfield.approachCorridors) {
      assert.equal(corridor.terrainConnected, true);
      assert.equal(corridor.lengthMeters, airfield.approachLengthMeters);
      assert.equal(corridor.halfWidthMeters, airfield.clearWidthMeters * 0.5);
    }
    const heading = airfield.headingDegrees * Math.PI / 180;
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    for (const direction of [-1, 1]) {
      const endDistance = airfield.runwayLengthMeters * 0.5;
      const x = airfield.center[0] + forwardX * endDistance * direction;
      const z = airfield.center[1] + forwardZ * endDistance * direction;
      assert.ok(Math.abs(model.sampleHeight(x, z) - airfield.elevationMeters) < 0.8, `${airfield.id} runway end not flat`);
    }
  }
});
