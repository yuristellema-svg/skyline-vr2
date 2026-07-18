# Skyline settlements module

This directory is an isolated settlement renderer and placement planner. It does not create roads, terrain or water. It consumes a version-2 placement catalog supplied by the authoritative world system. The same contract is available as `settlementPlacement.schema.json` for World Core tooling and CI.

## Runtime API

```js
import {
  createSettlementSystem,
} from './settlements/index.js';

const settlements = createSettlementSystem({
  scene,
  manifest: world.features.settlementPlacement,
  sampleHeight: world.sampleHeight,
  collision,
  quality: 'high',
  phoneMode,
});

settlements.setPhoneMode(phoneMode);
settlements.setQuality('medium');
settlements.fixedStepUpdate(fixedDt);
settlements.update(frameDt, {
  camera: stereo.camera,
  nightFactor,
  worldTimeSeconds,
});

const status = settlements.getStatus();
settlements.dispose();
```

The system accepts either the direct version-2 object or a parent world manifest containing `settlementPlacement`. Shoreline `waterSide` is mandatory and must be exactly `1` or `-1`; the harbour system never guesses which side is water.

## Required manifest shape

```js
{
  version: 2,
  worldId: 'authoritative-world-id',
  waterLevel: 2,

  roads: [
    {
      id: 'road-id',
      width: 14,
      points: [[x0, z0], [x1, z1], ...],
    },
  ],

  shorelines: [
    {
      id: 'shore-id',
      waterSide: 1, // 1 or -1 relative to polyline direction
      points: [[x0, z0], [x1, z1], ...],
    },
  ],

  exclusions: [
    {
      id: 'runway-reserve',
      reason: 'authoritative runway and approach geometry',
      footprint: [[x0, z0], [x1, z1], [x2, z2], ...],
    },
  ],

  settlements: [
    {
      id: 'main-city',
      name: 'Main City',
      kind: 'city',
      seed: 'stable-seed',
      footprint: [[x0, z0], [x1, z1], [x2, z2], ...],
      roadRefs: ['road-id'],
      density: 1,
      maxParcels: 60,
      districts: [
        {
          id: 'downtown',
          kind: 'downtown',
          footprint: [[x0, z0], [x1, z1], [x2, z2], ...],
          roadRefs: ['road-id'],
          familyWeights: {
            skyline_tower: 0.25,
            podium_tower: 0.35,
            urban_midrise: 0.40,
          },
        },
      ],
    },
  ],

  landmarks: [
    {
      id: 'radio-tower',
      name: 'Radio Tower',
      kind: 'radio_tower',
      anchor: [x, z],
      height: 110,
      roadRef: 'road-id',
    },
  ],
}
```

Harbours additionally require `shorelineRef`, `shorelineSpan: [0, 1]`, and may set `pierCount`.

## Placement rules

- Every parcel is aligned to a referenced road heading.
- Every footprint is checked against settlement and district polygons.
- Runway, water and protected-corridor exclusions are rejected.
- Terrain is sampled at the center and all four footprint corners.
- Excessively steep parcels are rejected.
- Accepted buildings receive a visible foundation extending below the lowest sampled corner and supporting the shell above the highest sampled corner.
- Parcel footprints are checked for overlap before acceptance.
- Harbour modules use supplied shoreline samples and road linkage; only marked pier pieces intentionally extend over water.

## Phone policy

`setPhoneMode(true)` selects the low tier. It retains every settlement, every landmark site, and all essential building shells. It mainly removes unlit windows, secondary wings, rooftop equipment, pylons and other micro-detail. Near and micro visibility ranges are also shorter.

## Night policy

Facades, roofs and foundations have black emissive colour and zero emissive intensity. Only descriptors with role `actual-window` or `actual-signal-lamp` use explicit light materials. The system never traverses or recolours the existing scene.
