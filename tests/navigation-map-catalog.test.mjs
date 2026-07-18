import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNavigationMapCatalog,
  distance2D,
  findNavigationTarget,
  formatNavigationDistance,
  mapPixelToWorld,
  worldToMapPixel,
  NAVIGATION_MAP_DESTINATION_COUNT,
} from '../src/navigationMap/mapCatalog.js';

const manifest = {
  format: 'skyline-world-core-manifest',
  bounds: {
    minX: -8192,
    minZ: -8192,
    maxX: 8192,
    maxZ: 8192,
  },
  legacyCoreBounds: {
    minX: -4096,
    minZ: -4096,
    maxX: 4096,
    maxZ: 4096,
  },
  regions: [
    {
      id: 'southeast-red-canyon',
      kind: 'canyon-steppe',
      center: [6600, -3500],
      radius: [2050, 2550],
    },
  ],
  roads: [
    {
      id: 'test-road',
      class: 'primary',
      widthMeters: 14,
      points: [[0, 0], [1000, 1000]],
    },
  ],
  water: {
    rivers: [
      {
        id: 'test-river',
        points: [[-100, 0], [100, 200]],
      },
    ],
    lakes: [
      {
        id: 'aurora-lake',
        center: [-6500, 3600],
        radius: [820, 610],
      },
    ],
  },
  navigationReferences: [
    {
      id: 'crown-pass',
      position: [300, 6200],
    },
    {
      id: 'lake-country-airfield',
      position: [-6200, 800],
    },
  ],
};

test('catalog keeps the full curated destination set', () => {
  const catalog = createNavigationMapCatalog(manifest);

  assert.equal(
    catalog.destinations.length,
    NAVIGATION_MAP_DESTINATION_COUNT,
  );
  assert.equal(NAVIGATION_MAP_DESTINATION_COUNT, 10);
  assert.equal(catalog.roads.length, 1);
  assert.equal(catalog.rivers.length, 1);
  assert.equal(catalog.lakes.length, 1);
});

test('catalog uses authoritative World Core positions when available', () => {
  const catalog = createNavigationMapCatalog(manifest);
  const crown = catalog.destinations.find(
    destination => destination.id === 'crown-pass'
  );
  const canyon = catalog.destinations.find(
    destination => destination.id === 'red-canyon'
  );

  assert.deepEqual([...crown.position], [300, 6200]);
  assert.deepEqual([...canyon.position], [6600, -3500]);
});

test('world and map coordinate transforms round trip', () => {
  const bounds = manifest.bounds;
  const rect = { x: 10, y: 20, width: 800, height: 600 };
  const world = [4200, -5900];

  const pixel = worldToMapPixel(world, bounds, rect);
  const roundTrip = mapPixelToWorld(pixel, bounds, rect);

  assert.ok(Math.abs(roundTrip[0] - world[0]) < 1e-9);
  assert.ok(Math.abs(roundTrip[1] - world[1]) < 1e-9);
});

test('target hit testing chooses the smallest overlapping target', () => {
  const target = findNavigationTarget(
    [
      {
        id: 'large',
        rect: { x: 0, y: 0, width: 100, height: 100 },
      },
      {
        id: 'small',
        rect: { x: 30, y: 30, width: 20, height: 20 },
      },
    ],
    { x: 35, y: 35 },
  );

  assert.equal(target.id, 'small');
});

test('distance display is readable for near and far destinations', () => {
  assert.equal(formatNavigationDistance(450), '450 M');
  assert.equal(formatNavigationDistance(2450), '2.5 KM');
  assert.equal(formatNavigationDistance(13200), '13 KM');
  assert.equal(distance2D([0, 0], [3000, 4000]), 5000);
});
