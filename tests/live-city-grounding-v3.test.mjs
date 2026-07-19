import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basePackedHeight } from './fixtures/baseWorldSampler.mjs';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const adapter = await readFile(new URL('../src/worldCompletion/settlementManifestAdapter.js', import.meta.url), 'utf8');
const world = await readFile(new URL('../src/world/world.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

const SOURCE_CENTER = [0, 155];
const ASTER_FOOTPRINT = [
  [-520, -330],
  [410, -330],
  [470, 285],
  [-390, 340],
  [-560, 120],
];
const RIVER = [
  [-4070, 3490], [-3470, 3200], [-2920, 2820], [-2440, 2390],
  [-1930, 2020], [-1430, 1510], [-920, 940], [-410, 300],
  [170, -300], [820, -760], [1500, -1390], [2230, -2190],
  [3050, -3110], [4030, -3950],
];

function transformFootprint(centerX, centerZ, scale) {
  return ASTER_FOOTPRINT.map(([x, z]) => [
    centerX + (x - SOURCE_CENTER[0]) * scale,
    centerZ + (z - SOURCE_CENTER[1]) * scale,
  ]);
}

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function terrainMetrics(polygon) {
  const xs = polygon.map(point => point[0]);
  const zs = polygon.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  let min = Infinity;
  let max = -Infinity;
  let slopeSum = 0;
  let maxSlope = 0;
  let count = 0;

  for (let z = minZ; z <= maxZ; z += 35) {
    for (let x = minX; x <= maxX; x += 35) {
      if (!pointInPolygon(x, z, polygon)) continue;
      const height = basePackedHeight(x, z);
      const dx = (basePackedHeight(x + 10, z) - basePackedHeight(x - 10, z)) / 20;
      const dz = (basePackedHeight(x, z + 10) - basePackedHeight(x, z - 10)) / 20;
      const slope = Math.hypot(dx, dz);
      min = Math.min(min, height);
      max = Math.max(max, height);
      maxSlope = Math.max(maxSlope, slope);
      slopeSum += slope;
      count += 1;
    }
  }

  return { min, max, range: max - min, maxSlope, averageSlope: slopeSum / count };
}

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared))
    : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

function distanceToRiver(x, z) {
  let distance = Infinity;
  for (let index = 0; index < RIVER.length - 1; index += 1) {
    distance = Math.min(distance, segmentDistance(x, z, RIVER[index], RIVER[index + 1]));
  }
  return distance;
}

test('live settlement city moves from the river trench to the measured western core', () => {
  assert.match(adapter, /const scale = Math\.min\(1, 7600 \/ Math\.max\(width, depth\)\)/);
  assert.match(adapter, /const targetCenterX = -2830;/);
  assert.match(adapter, /const targetCenterZ = -1400;/);

  const oldSite = terrainMetrics(transformFootprint(2450, -2050, 1.55));
  const newSite = terrainMetrics(transformFootprint(-2830, -1400, 1));

  assert.ok(oldSite.range > 200, `old drowned site unexpectedly varied only ${oldSite.range.toFixed(1)} m`);
  assert.ok(newSite.range < 48, `new city terrain range is ${newSite.range.toFixed(1)} m`);
  assert.ok(newSite.averageSlope < 0.10, `new city average slope is ${newSite.averageSlope.toFixed(3)}`);
  assert.ok(newSite.maxSlope < 0.26, `new city maximum sampled slope is ${newSite.maxSlope.toFixed(3)}`);
  assert.ok(distanceToRiver(2450, -2050) < 400);
  assert.ok(distanceToRiver(-2830, -1400) > 2800);

  // Complete sample settlement network remains inside the locked 8 km core.
  assert.ok(-2830 - 1260 >= -4096);
  assert.ok(-2830 + 1260 <= 4096);
  assert.ok(-1400 - 955 >= -4096);
  assert.ok(-1400 + 955 <= 4096);
});

test('settlements and roads are built only after their packed terrain is preloaded', () => {
  assert.match(main, /SKYLINE_LIVE_CITY_GROUNDING_V3/);
  assert.match(main, /async function initializeGroundedSettlementWorld\(\)/);
  const initializeStart = main.indexOf('async function initializeGroundedSettlementWorld()');
  const initializeEnd = main.indexOf('function ensureInitialWorld()', initializeStart);
  const lifecycle = main.slice(initializeStart, initializeEnd);
  const preloadIndex = lifecycle.indexOf('await world.preloadSpawn');
  const settlementIndex = lifecycle.indexOf('createSettlementSystem');
  const infrastructureIndex = lifecycle.indexOf('createLocalInfrastructureSystem');
  assert.ok(preloadIndex >= 0 && preloadIndex < settlementIndex);
  assert.ok(settlementIndex < infrastructureIndex);
  assert.match(main, /initializeGroundedSettlementWorld\(\)[\s\S]*?world\.preloadSpawn\(\s*CONFIG\.world\.spawn/);
  assert.match(main, /settlements\?\.setPhoneMode\(phone\)/);
  assert.match(main, /settlements\?\.fixedStepUpdate\?\.\(/);
  assert.match(main, /settlements\?\.update\(/);
  assert.match(main, /localInfrastructure\?\.update\(/);
});

test('the buried legacy box city is not rendered or collision-registered', () => {
  assert.match(world, /SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V3/);
  assert.match(world, /this\.city\.group\.visible = false/);

  const rootAddStart = world.indexOf('this.root.add(', world.indexOf('SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V3'));
  const rootAddEnd = world.indexOf(');', rootAddStart);
  assert.doesNotMatch(world.slice(rootAddStart, rootAddEnd), /this\.city/);

  const collisionStart = world.indexOf('retiredCityLandmarkIds', rootAddEnd);
  const expansionStart = world.indexOf('this.expansion =', collisionStart);
  const retiredCompatibility = world.slice(collisionStart, expansionStart);
  assert.ok(collisionStart >= 0, 'retired landmark compatibility sentinels missing');
  assert.doesNotMatch(retiredCompatibility, /this\.city[\s\S]*registerCollisions/);
  assert.match(retiredCompatibility, /-8192/);
  assert.match(retiredCompatibility, /tower_pair/);
  assert.match(retiredCompatibility, /open_atrium/);
  assert.match(retiredCompatibility, /retired compatibility sentinel/);
});

test('live page and service worker preserve every locked deployment identifier', () => {
  assert.match(index, /src\/main\.js\?v=biplane-zero-radio-v4/);
  assert.doesNotMatch(index, /city-grounding-live/);
  assert.match(sw, /SKYLINE_LIVE_CITY_GROUNDING_V3/);
  assert.match(sw, /skyline-biplane-zero-radio-v4-20260718/);
  assert.match(sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/);
  assert.doesNotMatch(sw, /city-grounding-live/);
  assert.match(sw, /zero-radio\.mp3/);
  assert.match(sw, /stuka-siren\.mp3/);
});
