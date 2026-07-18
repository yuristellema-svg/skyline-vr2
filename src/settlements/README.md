# Skyline settlements module

An isolated, deterministic settlement planner and Three.js renderer. It consumes authoritative roads, settlement and district polygons, exclusions, shoreline direction and terrain sampling. It does not create roads, terrain or water and it does not wire itself into the game runtime.

## Runtime API

```js
import { createSettlementSystem } from './settlements/index.js';

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
settlements.update(frameDt, { camera, nightFactor, worldTimeSeconds });
const status = settlements.getStatus();
settlements.dispose();
```

## Urban-design inputs

The machine-readable contract is `settlementPlacement.schema.json`. Version 2 supports optional authored composition data:

```js
{
  organizingPattern: 'grid', // main-street, green, crossroads, ridge, compound, waterfront
  publicSpaces: [
    { id: 'square', kind: 'civic-square', anchor: [x, z], width: 120, depth: 90 },
    { id: 'opening', kind: 'waterfront-gap', anchor: [x, z], width: 110, depth: 80, renderSurface: false },
  ],
  signatureSites: [
    {
      id: 'needle',
      family: 'signature_needle',
      districtId: 'downtown',
      anchor: [x, z],
      width: 64,
      depth: 58,
      height: 176,
      roadRef: 'main-avenue',
    },
  ],
  districts: [{
    id: 'downtown',
    kind: 'downtown',
    materialKey: 'aster-glass',
    blockScale: 1.12,
    heightProfile: {
      anchor: [x, z], radius: 330, minScale: 0.56, maxScale: 1.18, exponent: 1.65,
    },
    footprint: [[x0, z0], [x1, z1], [x2, z2]],
    roadRefs: ['main-avenue'],
  }],
}
```

Harbours additionally require `shorelineRef`, `shorelineSpan`, mandatory shoreline `waterSide`, and may supply `berthGroups`.

## Safety and phone policy

- Every parcel resolves and aligns to a supplied road.
- Footprints stay inside authored polygons and outside exclusions, public spaces and signature reserves.
- Terrain is sampled at the centre and four corners.
- Unsafe slopes are rejected and accepted buildings receive terrain-conforming foundations.
- Phone quality preserves all essential shells, signature silhouettes, primary roofs and rendered public spaces.
- Only explicit `actual-window` and `actual-signal-lamp` descriptors emit.
- No existing scene material is scanned or recoloured.

## Preview

Serve the repository root and open `settlement-preview/`. The harness uses the actual production geometry, renderer, materials, instancing and quality tiers with perspective cameras, fog and day/sunset/night lighting.
