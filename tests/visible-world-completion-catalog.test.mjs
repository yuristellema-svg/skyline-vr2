import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWorldLivingAirspaceCatalog,
} from '../src/worldCompletion/livingAirspaceCatalog.js';

const manifest = {
  bounds: {
    minX: -8192,
    maxX: 8192,
    minZ: -8192,
    maxZ: 8192,
  },
  navigationReferences: [
    {
      id: 'crown-pass',
      position: [300, 6200],
    },
    {
      id: 'aurora-lake',
      position: [-6500, 3600],
    },
    {
      id: 'harbour-town',
      position: [2200, -6480],
    },
  ],
};

test('Living Airspace now spans the complete World Core', () => {
  const catalog =
    createWorldLivingAirspaceCatalog(manifest);

  assert.ok(catalog.birdHabitats.length >= 7);
  assert.ok(catalog.trafficRoutes.length >= 9);

  const allPoints =
    catalog.trafficRoutes.flatMap(route =>
      route.points
    );

  assert.ok(
    allPoints.some(point => point[0] < -6000),
  );
  assert.ok(
    allPoints.some(point => point[0] > 6000),
  );
  assert.ok(
    allPoints.some(point => point[2] < -6000),
  );
  assert.ok(
    allPoints.some(point => point[2] > 5000),
  );

  assert.ok(
    catalog.birdHabitats.some(
      habitat => habitat.center[2] > 5000
    )
  );
  assert.ok(
    catalog.birdHabitats.some(
      habitat => habitat.center[2] < -5000
    )
  );
});

test('all phone-required airspace categories remain present', () => {
  const catalog =
    createWorldLivingAirspaceCatalog(manifest);

  const categories =
    new Set(
      catalog.birdHabitats.map(item => item.category)
    );

  assert.ok(categories.has('rural-birds'));
  assert.ok(categories.has('ridge-birds'));
  assert.ok(categories.has('water-birds'));
  assert.ok(categories.has('soaring-birds'));
  assert.ok(
    catalog.trafficRoutes.some(
      route => route.category === 'sailplanes'
    )
  );
  assert.ok(
    catalog.trafficRoutes.some(
      route => route.contrail
    )
  );
});
