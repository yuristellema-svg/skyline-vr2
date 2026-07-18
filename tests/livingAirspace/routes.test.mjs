import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TRAFFIC_ROUTES,
} from '../../src/livingAirspace/catalog.js';

import {
  routeLength,
  sampleClosedRoute,
} from '../../src/livingAirspace/math.js';

test('route sampling is deterministic and finite', () => {
  for (const route of DEFAULT_TRAFFIC_ROUTES) {
    const a = sampleClosedRoute(route, 123.456);
    const b = sampleClosedRoute(route, 123.456);

    assert.deepEqual(a, b);

    for (const value of [
      a.position.x,
      a.position.y,
      a.position.z,
      a.tangent.x,
      a.tangent.y,
      a.tangent.z,
    ]) {
      assert.ok(Number.isFinite(value));
    }
  }
});

test('authored routes have meaningful flight distance', () => {
  for (const route of DEFAULT_TRAFFIC_ROUTES) {
    assert.ok(routeLength(route) > 2000);
  }
});
