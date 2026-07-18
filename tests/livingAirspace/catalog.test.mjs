import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultLivingAirspaceCatalog,
  validateLivingAirspaceCatalog,
  DEFAULT_TRAFFIC_ROUTES,
} from '../../src/livingAirspace/catalog.js';

import {
  FEATURE_CATEGORIES,
} from '../../src/livingAirspace/constants.js';

test('default living-airspace catalog is valid and complete', () => {
  const catalog = createDefaultLivingAirspaceCatalog();
  const result = validateLivingAirspaceCatalog(catalog);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(catalog.birdHabitats.length, 4);
  assert.equal(catalog.trafficRoutes.length, 6);
  assert.equal(catalog.cloudRegions.length, 2);
});

test('every major feature category remains required on phone', () => {
  const catalog = createDefaultLivingAirspaceCatalog();

  assert.deepEqual(
    [...catalog.requiredCategories],
    [...FEATURE_CATEGORIES],
  );
});

test('traffic catalog contains authored non-elliptical routes', () => {
  for (const route of DEFAULT_TRAFFIC_ROUTES) {
    assert.ok(route.points.length >= 5);
    assert.ok(route.points.some(point => point[1] !== route.points[0][1]));
  }

  assert.ok(
    DEFAULT_TRAFFIC_ROUTES.some(route => route.type === 'sailplane')
  );
  assert.ok(
    DEFAULT_TRAFFIC_ROUTES.some(route => route.contrail)
  );
});
