import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { AIRFIELD_SCHEMA_VERSION, DEFAULT_AIRFIELD_CATALOG, normalizeAirfieldCatalog } from '../src/airfields/airfieldCatalog.js';
import { containsRunwayPoint, distanceToRunway, fromRunwayLocal, headingVector, runwayCorners, runwayEndpoints, toRunwayLocal } from '../src/airfields/airfieldGeometry.js';
import { fitRunwayProfile, resolveAirfield, resolveAirfields, runwayEarthworkSkirt, runwaySurfaceGrid, runwaySurfaceHeight } from '../src/airfields/terrainFit.js';
import { aircraftAllowed, directionAllowed, operationStatus, runwayAvailableLength } from '../src/airfields/operations.js';
import { buildLightingPlan } from '../src/airfields/lightingPlan.js';
import { fieldExclusionMasks, pointExcludedByAirfield, approachCorridorPolygons } from '../src/airfields/worldIntegration.js';

const catalog = normalizeAirfieldCatalog(DEFAULT_AIRFIELD_CATALOG);
const plane = field => (x, z) => { const local = toRunwayLocal(field, { x, z }); return 100 + local.along * 0.025 + Math.sin(local.along / 45) * 0.4 + Math.cos(local.lateral / 8) * 0.2; };

test('schema v2 defines primary, one-way mountain and emergency fields', () => {
  assert.equal(AIRFIELD_SCHEMA_VERSION, 2); assert.equal(catalog.fields.length, 3);
  assert.deepEqual(catalog.fields.map(f => f.kind), ['primary', 'mountain', 'emergency']);
  const crown = catalog.fields.find(f => f.id === 'crown-ridge');
  assert.deepEqual(crown.operations.landingDirections, [1]); assert.deepEqual(crown.operations.takeoffDirections, [-1]);
  assert.deepEqual(crown.operations.allowedAircraft, ['scout', 'biplane', 'glider']);
});

test('legacy runway x/z coordinates remain compatible with quick-fixes-v2', () => {
  const legacy = { x: 0, z: 0, heading: 0, length: 900, width: 76 };
  assert.equal(distanceToRunway(legacy, { x: 0, z: 0 }), 0);
  const beyondEnd = distanceToRunway(legacy, { x: 0, z: -650 });
  assert.ok(beyondEnd > 190 && beyondEnd < 210);
});

test('runway transforms, endpoints and corners remain one coordinate contract', () => {
  const field = catalog.fields[1], local = { along: 127.25, lateral: -14.5 }, world = fromRunwayLocal(field, local), roundtrip = toRunwayLocal(field, world);
  assert.ok(Math.abs(roundtrip.along - local.along) < 1e-9); assert.ok(Math.abs(roundtrip.lateral - local.lateral) < 1e-9);
  const ends = runwayEndpoints(field); assert.ok(Math.abs(Math.hypot(ends.positive.x - ends.negative.x, ends.positive.z - ends.negative.z) - field.length) < 1e-8);
  for (const corner of runwayCorners(field)) assert.equal(containsRunwayPoint(field, corner, 1e-7), true);
});

test('profile fitting follows terrain while enforcing grade and clearance', () => {
  const field = catalog.fields[0], fit = fitRunwayProfile(field, plane(field));
  assert.equal(fit.mode, 'smoothed-longitudinal-profile'); assert.ok(fit.stations.length > 20); assert.ok(fit.minimumClearance >= field.surface.clearance - 1e-8); assert.ok(fit.longitudinalGrade <= field.surface.maxLongitudinalGrade + 1e-8);
});

test('rough terrain is rejected without weakening catalog limits', () => {
  const field = catalog.fields[2], fit = fitRunwayProfile(field, (x, z) => { const l = toRunwayLocal(field, { x, z }); return 90 + Math.sin(l.along / 7) * 9 + Math.cos(l.lateral / 2) * 4; });
  assert.equal(fit.operational, false); assert.ok(fit.issues.includes('earthwork') || fit.issues.includes('terrain-roughness'));
});

test('visible mesh, physics height and terrain skirt share profile coordinates', () => {
  const field = resolveAirfield(catalog.fields[0], plane(catalog.fields[0])); const grid = runwaySurfaceGrid(field, 24), skirt = runwayEarthworkSkirt(field, plane(field), 24);
  assert.equal(grid.vertices.length, 50); assert.equal(grid.indices.length, 144); assert.ok(skirt.vertices.length > 0);
  for (const vertex of grid.vertices) assert.ok(Math.abs(vertex.y - runwaySurfaceHeight(field, vertex)) < 1e-9);
});

test('operational direction and aircraft restrictions are explicit', () => {
  const crown = catalog.fields[1], scout = { id: 'scout' }, zero = { id: 'zero' };
  assert.equal(directionAllowed(crown, 'landing', 1), true); assert.equal(directionAllowed(crown, 'landing', -1), false);
  assert.equal(aircraftAllowed(crown, scout, 'landing'), true); assert.equal(aircraftAllowed(crown, zero, 'landing'), false);
  assert.equal(operationStatus(crown, scout, 'landing', -1).allowed, false); assert.ok(runwayAvailableLength(crown, 1, 'landing') > crown.length - 50);
});

test('mobile and desktop lighting planners stay within hard budgets', () => {
  for (const field of catalog.fields) { const mobile = buildLightingPlan(field, true), desktop = buildLightingPlan(field, false); assert.ok(mobile.count <= field.lighting.mobileLightBudget); assert.ok(desktop.count <= field.lighting.desktopLightBudget); assert.ok(desktop.count >= mobile.count); assert.ok((mobile.byKind.threshold || 0) > 0); }
});

test('world-core exclusion masks cover operational surfaces but not distant points', () => {
  const masks = fieldExclusionMasks(catalog.fields); assert.equal(masks.length, 3);
  for (const field of catalog.fields) assert.equal(pointExcludedByAirfield(catalog.fields, field.center.x, field.center.z), field.id);
  assert.equal(pointExcludedByAirfield(catalog.fields, -4090, -4090), '');
});

test('approach corridor polygons widen away from threshold', () => {
  const rows = approachCorridorPolygons(catalog.fields[0], 1, 6); assert.equal(rows.length, 7);
  const near = Math.hypot(rows[0].left.x - rows[0].right.x, rows[0].left.z - rows[0].right.z), far = Math.hypot(rows.at(-1).left.x - rows.at(-1).right.x, rows.at(-1).left.z - rows.at(-1).right.z); assert.ok(far > near);
});

test('all fields resolve through the future world-manifest sampler interface', () => { const fields = resolveAirfields(catalog, (x, z) => 60 + Math.sin(x / 800) * 2 + Math.cos(z / 900) * 2); assert.equal(fields.length, 3); assert.ok(fields.every(field => field.terrainFit.stations.length > 10)); });

test('primary and relief fields use authoritative World Core airfield shelves', () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      'assets/world/world-core-v2-manifest.json',
      'utf8',
    ),
  );

  const worldFields = new Map(
    manifest.airfields.map(field => [
      field.id,
      field,
    ]),
  );

  const skyline =
    catalog.fields.find(
      field => field.id === 'skyline-municipal'
    );

  const relief =
    catalog.fields.find(
      field => field.id === 'east-meadow-relief'
    );

  const lake =
    worldFields.get('lake-country-airfield');

  const coast =
    worldFields.get('south-coast-airfield');

  assert.deepEqual(
    [skyline.center.x, skyline.center.z],
    lake.center,
  );
  assert.equal(
    skyline.headingDegrees,
    lake.headingDegrees,
  );
  assert.equal(
    skyline.length,
    lake.runwayLengthMeters,
  );

  assert.deepEqual(
    [relief.center.x, relief.center.z],
    coast.center,
  );
  assert.equal(
    relief.headingDegrees,
    coast.headingDegrees,
  );
  assert.equal(
    relief.length,
    coast.runwayLengthMeters,
  );
});
