# SKYLINE WORLD DETAIL V2.5 HANDOFF

## Package identity

- Repository: `yuristellema-svg/skyline-vr2`
- Approved source baseline: `skyline-quick-fixes-v2`
- Exact baseline SHA audited: `34e65d1d572c409f9220a437127fd4b617da81c1`
- Intended integration branch: controlled by SKYLINE CONTROL
- Package version: `2.5.0`
- Root name: `skyline-world-detail-v2-root`
- Installation state: isolated package only; not installed and not pushed

The recent SKYLINE recovery/control conversation was treated as the integration authority. This package therefore remains a sibling visual-detail layer and deliberately does not take ownership of flight physics, controls, cameras, menus, aircraft, audio, the streamed terrain generator, ocean, atmosphere, contrails, wildlife, AI traffic, boost routes, service workers or server behavior.

## What changed from the first world-detail package

The first package was safe but too generic. Version 2.5 was rebuilt around the actual authored world data from the approved baseline instead of an invented city grid.

The upgraded package now:

- reconstructs the approved city layout deterministically using the same plateau, block grammar and reserved landmark positions as the baseline city generator;
- aligns detail overlays to the real downtown tower pair, south tower pair and open-atrium landmark;
- distinguishes downtown, residential and industrial districts through separate building grammar, scale and roof language;
- adds terrain-sampled residential and industrial infill only when a valid height sampler is available;
- creates five non-grid major-road corridors with curved headings and restrained centre markings;
- enhances all five authored bridges without replacing their existing structural meshes;
- aligns the harbour to the authored river rather than an arbitrary coastline;
- aligns airfield landmarks to the exact active runway and alpine strip coordinates;
- adds discrete window panes, rooftop service detail, antennas and tiny navigation beacons;
- adds bounded world-space cloud strata and package-owned day/night response;
- exposes optional collision descriptors for only the package's newly created solid buildings;
- includes a conservative adaptive-detail governor with phone forcing and hysteresis;
- reports resource, subsystem, safety and performance diagnostics.

## Approved-world alignment

The package embeds a frozen fallback reference copied from the approved baseline and also accepts a reviewed override through `authoredReference`.

### City

- Authored city plateau: `x 420..1480`, `z -1390..-330`, elevation approximately `94 m`
- North tower pair: `x 1020`, `z -480`
- South tower pair: `x 650`, `z -1140`
- Open atrium: `x 1130`, `z -720`

The package reconstructs the existing building descriptors and places detail just outside their facades. It does not traverse the scene or inspect existing city materials.

### Authored bridges enhanced

1. `old-stone-arches`
2. `lake-rail-viaduct`
3. `central-suspension`
4. `city-canal-bridge`
5. `southern-highline`

The package adds railings, arch ribs, cables, towers or truss accents appropriate to the bridge type. It does not add duplicate decks or replace baseline collision.

### Airfields

- Skyline runway: `x 520`, `z 380`, heading `0`, length `900`, width `76`
- Alpine grass strip: `x -920`, `z -260`, heading `-18°`, length `600`, width `62`

Added airfield detail includes:

- two city-airfield hangars with curved roof silhouettes and separate doors;
- a control-tower shaft and cab;
- service sheds;
- physical approach boards rather than portal frames;
- a windsock at each airfield;
- conservative visibility and phone-mode reduction.

## Visual systems

### 1. Authored city detail

- Discrete approximately two-metre window panes rather than luminous facade bands.
- Deterministic occupancy so the same seed always produces the same lit rooms.
- Separate lit and unlit window instance sets.
- Rooftop service boxes, thin antennas and tiny actual navigation beacons.
- Exact facade and roof materials remain non-emissive.

### 2. District infill

- Residential row houses and apartments with varied footprint, height and orientation.
- Industrial warehouses, workshops, tank houses, tanks and smokestacks.
- Terrain footprint sampling rejects steep, invalid or near-water placements.
- Spawn and runway safety clearances are enforced.
- Collision descriptors are generated for accepted solid infill only.

### 3. Road hierarchy

- Five authored curved corridors with different control points and headings.
- No square repeated street lattice.
- Terrain-sampled short segments prevent visibly floating long slabs.
- Centre markings are sparse and separately budgeted.
- No moving traffic is created.

### 4. Bridge enhancement

- Existing baseline bridges remain authoritative.
- Added geometry is decorative and bridge-type-specific.
- No replacement collision or duplicate bridge deck is introduced.

### 5. Harbour and shoreline readability

- Quays, piers, mooring bollards, restrained crane silhouettes and one small navigation light.
- Placement follows the approved river polyline.
- No new ocean, water plane or terrain shelf is created.
- No structure is guessed into the scene when terrain sampling is unavailable.

### 6. Airfield navigation detail

- Hangars, doors, service buildings, tower, windsocks and approach boards.
- Exact alignment to active landing-zone coordinates.
- No HUD, landing physics or runway-guidance logic is changed.

### 7. Distant atmosphere

- Two world-space low-poly cloud strata.
- Near and far materials are separate but pooled.
- Only two transparent draw calls are permitted by contract.
- Cloud tint and opacity transition smoothly from the existing `skyline:time-of-day` event.
- No second sky, fog controller, ocean or camera-relative mountain is added.

## City-glow prevention

The previous radioactive/yellow-city failure is prevented structurally:

- package facade emissive colour is black;
- package roof emissive colour is black;
- facade and roof emissive intensity are exactly zero;
- only roles `actual-window`, `actual-signal-lamp` and `actual-navigation-lamp` may emit;
- maximum actual-window intensity is bounded at `0.72`;
- the package never calls `scene.traverse`;
- it never scans, clones, recolours or converts arbitrary baseline materials;
- it never changes tone mapping or fog settings on baseline materials;
- it updates only materials owned by its own resource pool;
- window occupancy is deterministic and quality-budgeted;
- whole-building emission is rejected by the material-policy validator.

Do not combine this package with any older scene-wide city-material recolouring pass.

## Terrain, ocean and mountain safety

- `createsTerrain: false`
- `createsMountain: false`
- no cone, pyramid, standalone mountain or camera-relative terrain object exists;
- the current streamed terrain and height sampler remain authoritative;
- no new ocean or water plane exists;
- terrain-dependent roads, infill, harbour and airfield structures are suppressed when `sampleHeight` is missing or unreliable;
- authored city windows, bridge overlays and clouds can still initialize because their approved coordinates are already known;
- finite-transform validation runs during layout construction.

## Performance architecture

### Reuse and draw-call control

- A single resource pool owns all package geometry and materials.
- Repeated objects use `THREE.InstancedMesh`.
- No geometry or material is created during ordinary frame updates.
- No scene-wide material scan occurs during construction or update.
- Decorative classes have independent budgets.
- Visibility checks run at quality-dependent intervals rather than every frame.
- Transparent rendering is capped at two cloud strata.

### Quality modes

- `high`: full reviewed desktop detail.
- `medium`: default balanced detail.
- `low`: phone-safe detail.
- `auto`: begins at medium, degrades after sustained low frame rate, upgrades only after a much longer stable period, and uses a cooldown to prevent oscillation.
- `setPhoneMode(true)`: immediately forces the low budget.

Reference deterministic layout totals with a valid terrain sampler:

| Detail class | High | Medium | Phone/low |
|---|---:|---:|---:|
| Total descriptors | 5,402 | 3,110 | 1,158 |
| Lit window panes | 1,973 | 945 | 251 |
| Unlit window panes | 2,891 | 1,788 | 699 |
| Rooftop descriptors | 134 | 99 | 46 |
| Residential infill | 28 | 20 | 10 |
| Industrial infill | 24 | 16 | 8 |
| Road segments | 134 | 98 | 63 |
| Road markings | 67 | 40 | 19 |
| Traffic hints | 12 | 8 | 4 |
| Near/far cloud clusters | 12 / 8 | 8 / 6 | 4 / 3 |
| Optional collision boxes | 57 | 41 | 23 |

Counts are deterministic for a seed and may be lower when the real terrain sampler rejects unsafe placements.

## Failure isolation

The following systems are individually registered and guarded:

- `cityDetails`
- `roads`
- `bridges`
- `harbour`
- `airfield`
- `trafficHints`
- `cloudLayers`
- `dayNight`

A subsystem construction or update exception disables and cleans up that subsystem without stopping the remaining systems. A top-level construction or runtime exception disposes the owned root and converts the package to a disabled no-op object. Diagnostic failure is never allowed to throw into gameplay.

A duplicate direct root named `skyline-world-detail-v2-root` is rejected before a second root is added.

## Public API

Required API:

```js
const worldDetail = createWorldDetailSystem({
  scene,
  sampleHeight,
  spawn,
  quality,
});

worldDetail.setPhoneMode(phone);
worldDetail.fixedStepUpdate(dt, flight, phase);
worldDetail.update(dt, flight, camera, phase);
worldDetail.getStatus();
worldDetail.dispose();
```

Safe additive API:

```js
worldDetail.setQuality('auto');
const collisionBoxes = worldDetail.getCollisionDescriptors();
```

`getCollisionDescriptors()` does not mutate the collision system. SKYLINE CONTROL must explicitly review and register these boxes if collision with optional infill and airfield buildings is desired.

## Exact integration instructions for SKYLINE CONTROL

Keep the current world generator and all protected systems unchanged. Integrate this only as a sibling optional system after the current world and height sampler exist.

### Import

```js
import {
  createWorldDetailSystem,
} from './worldDetail/index.js';
```

### Construct once

```js
const worldDetail =
  createWorldDetailSystem({
    scene,
    sampleHeight:
      world.sampleHeight,
    spawn:
      CONFIG.world.spawn,
    quality: 'auto',
  });
```

### Forward phone state

```js
worldDetail.setPhoneMode(
  phoneMode,
);
```

Call this when the existing phone state is first known and whenever it changes. Do not create a separate device detector inside this package.

### Fixed-step forwarding

```js
worldDetail.fixedStepUpdate(
  fixedDt,
  flight,
  phase,
);
```

The present package has no gameplay physics, but the method is retained for the required stable interface and future isolated detail animation.

### Frame update

```js
worldDetail.update(
  frameDt,
  flight,
  stereo.camera,
  phase,
);
```

### Diagnostics

```js
const worldDetailStatus =
  worldDetail.getStatus();
```

Diagnostics include effective quality, requested quality, phone mode, update counts, descriptor count, collision count, adaptive-governor state, pool totals, per-subsystem status and safety assertions.

### Optional collision registration

Only after visual review, SKYLINE CONTROL may register the returned AABBs with the existing collision system using its current public box-registration method. Do not register them twice, and do not replace existing city or bridge collision.

### Dispose

```js
worldDetail.dispose();
```

### Systems that must remain authoritative

- `src/world/world.js` streamed terrain and feature generator
- the existing height sampler and collision system
- the existing ocean and atmosphere/fog
- existing clouds unless SKYLINE CONTROL explicitly decides which cloud owner remains active
- flight model and configuration physics
- input, camera and menu systems
- aircraft visuals and cockpits
- aircraft/warning audio
- current runway and landing logic
- render interpolation and floating-origin behavior

## Status contract

Important `getStatus()` fields include:

- `active`, `disposed`, `phoneMode`
- `quality`, `requestedQuality`
- `descriptorCount`, `collisionDescriptors`
- `governor`
- `resources`
- `systems`
- `performance.transparentDrawCalls`
- `performance.geometryCreatedPerFrame`
- `performance.materialCreatedPerFrame`
- `safety.sceneWideMaterialScans`
- `safety.wholeBuildingEmission`
- `safety.createsTerrain`
- `safety.createsMountain`
- `safety.createsAiTraffic`
- `safety.createsWildlife`
- `safety.createsBoostGates`

## Validation completed

Automated package tests: **38 passed, 0 failed**.

Coverage includes:

- approved authored city alignment;
- all five authored bridge overlays;
- river-aligned harbour;
- exact runway and alpine-strip alignment;
- deterministic construction and seed behavior;
- finite transforms;
- curved road network and low repetition score;
- discrete pane-sized windows;
- populated and distinct districts;
- no terrain or mountain geometry;
- missing-height-sampler suppression;
- strict window-only emission;
- zero facade/roof emission;
- bounded transparency;
- phone-mode reduction across every decorative class;
- no moving traffic, birds, wildlife or AI aircraft;
- no existing-scene traversal or recolouring;
- required and additive public API;
- geometry/material pooling and instancing;
- no cross-worker ownership;
- no service-worker, server or port behavior;
- duplicate-root prevention;
- idempotent disposal;
- disabled no-op behavior for invalid construction;
- independent subsystem construction and update failures;
- top-level failure cleanup;
- adaptive-governor hysteresis.

A Three.js-compatible lifecycle smoke test also covered construction, quality changes, night transition, collision retrieval, phone downshift and disposal. Physical visual review in the playable branch is still required before integration because this package is intentionally not installed here.

## Package files

### Production

- `src/worldDetail/authoredReference.js`
- `src/worldDetail/budget.js`
- `src/worldDetail/constants.js`
- `src/worldDetail/index.js`
- `src/worldDetail/layout.js`
- `src/worldDetail/materialPolicy.js`
- `src/worldDetail/math.js`
- `src/worldDetail/resourcePool.js`
- `src/worldDetail/runtimeMetrics.js`
- `src/worldDetail/safeRegistry.js`
- `src/worldDetail/threeRuntime.js`
- `src/worldDetail/worldDetailSystem.js`

### Tests

- `tests/worldDetail/authored-alignment.test.mjs`
- `tests/worldDetail/failure-isolation.test.mjs`
- `tests/worldDetail/governor.test.mjs`
- `tests/worldDetail/layout.test.mjs`
- `tests/worldDetail/lifecycle.test.mjs`
- `tests/worldDetail/material-policy.test.mjs`
- `tests/worldDetail/performance-contract.test.mjs`
- `tests/worldDetail/source-contract.test.mjs`

## Explicitly absent and unchanged

The ZIP contains no changes outside `src/worldDetail/`, `tests/worldDetail/` and this handoff. It contains no:

- `src/main.js`
- `src/flightModel.js`
- `src/config.js`
- `src/input.js`
- `src/camera.js`
- `src/menu.js`
- `src/aircraftVisuals.js`
- `src/windAudio.js`
- `src/worldPolish.js`
- `src/world/world.js`
- service-worker files
- server files
- installer
- copied Three.js vendor file
- audio assets
- AI aircraft
- birds or wildlife
- boost hoops
- giant mountain/cone/pyramid

Port `4176` is not referenced.
