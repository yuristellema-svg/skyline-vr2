# Skyline VR2 settlements, cities and landmarks handoff

## Baseline and branch target

- Repository: `yuristellema-svg/skyline-vr2`
- Required baseline SHA: `d3e48499e90affe4dcf01fda1fdfa882fbaef8bd`
- Target branch: `skyline-settlements-v1`
- Runtime installation status: isolated only; not wired into `src/main.js`
- `gh-pages`: untouched

## What this build now contains

This is no longer one generic city scatter with different colours. It is a modular settlement kit with separate planning, architecture, terrain fitting, rendering, collision and diagnostic layers.

The production module set is 2,854 JavaScript lines, with a separate 31-test suite and deterministic diagnostic generator.

The isolated reference catalog demonstrates:

- one metropolitan area with four recognizable districts: downtown, civic, old quarter and riverside mixed-use;
- two lower-density suburban areas;
- two distinct towns and two villages/hamlets;
- an industrial district with factory halls, warehouses, tank clusters, stacks and pipe racks;
- a road-linked working harbour with shoreline-sampled seawalls, six piers, pylons and cranes;
- two farm regions with barns, farmhouses and silos;
- nine exact navigation-landmark sites;
- fourteen parcel-level building families;
- explicit gable, sawtooth, cap, spire, antenna, tank, crane and lattice silhouettes.

The sample catalog currently resolves to:

- 11 settlement areas;
- 16 authored district polygons;
- 9 landmark sites;
- 234 accepted non-overlapping parcels;
- 3,628 high-tier descriptors;
- 749 collision boxes;
- 38 spatial cells.

The sample coordinates remain isolated test data. They are not proposed as the real Skyline world layout.

## Architectural families

Urban:

- `skyline_tower`
- `podium_tower`
- `urban_midrise`
- `courtyard_block`
- `civic_hall`
- `old_town_block`

Residential and town:

- `rowhouse`
- `detached_house`
- `market_block`
- `village_house`

Industrial and harbour:

- `warehouse`
- `factory_hall`
- `tank_cluster`
- `dock_warehouse`

Rural:

- `barn`
- `farmhouse`

Some families are composed from several instanced parts rather than represented by one box. Examples include podium plus tower, courtyard wings, civic clock tower plus spire, sawtooth factory roof, tank clusters and lattice radio towers.

## Terrain, road and shoreline integrity

The planner never generates road endpoints or terrain heights.

Each accepted parcel:

1. originates from a referenced road or road-constrained infill cell;
2. is rotated to the nearest authoritative road heading;
3. is wholly inside its settlement and district footprint;
4. is outside all supplied exclusion polygons;
5. is sampled at its center and four oriented corners;
6. is rejected when terrain variation exceeds the family or settlement slope limit;
7. receives a terrain-conforming foundation;
8. is checked against previously accepted oriented parcel footprints.

Harbour modules sample the supplied shoreline span. Piers are explicitly marked as intentional over-water pieces. Seawalls stay on the shoreline relationship. Harbour metadata preserves the shoreline reference, shoreline parameter and nearest road reference.

## Main-city district logic

The reference main city uses explicit district polygons and weighted building families:

- Downtown prefers skyline towers, podium towers and urban mid-rises.
- Civic prefers civic halls, courtyard blocks and restrained mid-rises.
- Old Quarter prefers old-town blocks, market blocks and row houses.
- Riverside uses mixed-use mid-rise and courtyard massing.

This district input is data, not hardcoded coordinates. World Core may define a different city shape while retaining the same kit.

## Landmarks

Supported landmark kinds:

- radio tower;
- antenna mast;
- aviation beacon;
- water tower;
- church spire;
- control tower;
- silo;
- harbour crane;
- smokestack;
- lighthouse.

Radio and antenna towers are composed from separate legs and optional crossbars. Navigation lamps remain present in phone mode.

## Night-lighting safety

The previous whole-building yellow-glow failure is structurally blocked:

- facade, roof, foundation, concrete, metal and dock materials use black emissive colour and zero emissive intensity;
- lit windows are explicit small meshes with role `actual-window`;
- navigation lights are explicit meshes with role `actual-signal-lamp`;
- deterministic unlit windows use a separate non-emissive dark-window material;
- the system owns only its own pooled materials;
- it never runs `scene.traverse()`;
- it never recolours existing world materials;
- status reports `wholeBuildingEmission: false` and `sceneWideMaterialScans: 0`.

## Quality and phone budgets

Actual isolated reference totals:

| Tier | Instances | Estimated triangles | Estimated draw calls | Windows |
|---|---:|---:|---:|---:|
| Phone / low | 1,906 | 29,722 | 20 | 820 |
| Medium | 2,935 | 46,270 | 46 | 1,680 |
| High | 3,628 | 55,522 | 63 | 2,222 |

Hard caps are declared in `constants.js` and validated by tests. The tiers are nested subsets: low is contained in medium, and medium is contained in high.

Phone mode retains:

- every settlement area;
- every landmark site;
- every essential foundation and major shell;
- skyline and district silhouettes;
- a restrained deterministic set of lit windows.

It reduces secondary wings, dark windows, rooftop equipment, pylons and micro-detail. Near and micro visibility distances are shorter, but the world is not replaced with a different sparse layout.

## Spatial and rendering design

- Repeated parts use `THREE.InstancedMesh`.
- Geometry and materials are pooled.
- Skyline and district shells are globally grouped.
- near and micro-detail groups are scoped by settlement for distance visibility.
- no geometry or material is created in `update()` or `fixedStepUpdate()`.
- no private animation loop or timer exists.
- the caller supplies the camera, night factor and optional authoritative world time.

## Collision output

The catalog builds finite AABBs from collidable authored parts. Integration may pass the existing collision system during creation, or call `registerCollisionCatalog()` separately. Decorative windows, most micro-detail and harbour pylons are intentionally non-collidable.

## World-manifest compatibility finding

The exact baseline `assets/world/features.json` was inspected. It contains terrain-related world features, river/lake data, a city plateau, bridges and landmarks, but it does not contain the authoritative road network, settlement polygons, district polygons, shoreline direction and exclusion catalog required by this worker.

This package therefore does not infer roads from the old city grid or invent town positions. It accepts either:

- a direct version-2 settlement placement manifest; or
- a parent world manifest containing `settlementPlacement`.

`inspectSettlementManifestCompatibility()` reports missing inputs instead of silently guessing.

## Required external inputs

See `src/settlements/README.md` and the machine-readable `src/settlements/settlementPlacement.schema.json`. At minimum World Core must supply:

- `worldId` and `waterLevel`;
- road IDs, widths and polylines;
- shoreline IDs, polylines and water-side direction;
- exclusion polygons for runways, approach corridors, open water and protected areas;
- settlement IDs, kinds, footprints, road references and deterministic seeds;
- optional district polygons and family weights;
- exact landmark anchors and heights.

## Public API

```js
const system = createSettlementSystem({
  scene,
  manifest,
  sampleHeight,
  collision,
  quality: 'high',
  phoneMode,
});

system.setPhoneMode(phoneMode);
system.setQuality('medium');
system.fixedStepUpdate(fixedDt);
system.update(frameDt, {
  camera: stereo.camera,
  nightFactor,
  worldTimeSeconds,
});
system.getStatus();
system.dispose();
```

Exports:

- `createSettlementSystem`
- `buildSettlementCatalog`
- `getQualitySelection`
- `summarizeCatalog`
- `validateSettlementManifest`
- `inspectSettlementManifestCompatibility`
- `resolveSettlementManifest`
- `registerCollisionCatalog`
- `SAMPLE_WORLD_MANIFEST`

## Exact integration notes

Do not replace the world generator. Integrate this as a sibling system only after World Core supplies its final placement catalog.

```js
import {
  createSettlementSystem,
} from './settlements/index.js';
```

Construct once after the world sampler and placement catalog are ready:

```js
const settlements = createSettlementSystem({
  scene,
  manifest:
    world.features.settlementPlacement,
  sampleHeight:
    world.sampleHeight,
  collision,
  quality: 'high',
  phoneMode,
});
```

Forward phone mode changes:

```js
settlements.setPhoneMode(phoneMode);
```

Fixed-step call:

```js
settlements.fixedStepUpdate(fixedDt);
```

Frame call:

```js
settlements.update(frameDt, {
  camera: stereo.camera,
  nightFactor,
  worldTimeSeconds,
});
```

Shutdown:

```js
settlements.dispose();
```

No runtime file was modified by this package. The integration owner decides the exact wiring location.

## Validation

Run:

```bash
node --test tests/settlements/*.test.mjs
node diagnostics/generate-summary.mjs
```

Current result: 31 tests passed, 0 failed.

Tests cover:

- manifest references and district validation;
- compatibility reporting for the current legacy world features;
- deterministic parcel and descriptor generation;
- road alignment;
- exclusion avoidance;
- oriented footprint overlap rejection;
- five-point terrain sampling and foundations;
- district-specific architecture;
- family and rooftop silhouette coverage;
- explicit window-only emission;
- harbour shoreline and road linkage;
- phone landmark preservation;
- nested quality tiers;
- instance, triangle and draw-call budgets across multiple terrain samplers and deterministic seeds;
- collision bounds;
- spatial visibility policy;
- forbidden imports, loops, timers, scene scans and runtime modifications.

## Generated diagnostics

- `diagnostics/sample-layout.svg` and `.png`: roads, districts, exclusions, parcels, shoreline and landmark anchors.
- `diagnostics/main-city-isometric.svg` and `.png`: close aerial silhouette view of the metropolitan kit.
- `diagnostics/sample-isometric.svg` and `.png`: entire reference-world silhouette view.
- `diagnostics/budget-summary.svg` and `.png`: actual low, medium and high budget use.
- `diagnostics/sample-counts.json`: deterministic counts and tier metrics.
- `diagnostics/settlement-budget-matrix.json`: per-location counts for low, medium and high.
- `diagnostics/baseline-feature-compatibility.json`: exact baseline-input gap report.
- `diagnostics/catalog-audit.json`: safety-contract summary.

## Files added

Production modules under `src/settlements/`:

- `archetypes.js`
- `catalogBuilder.js`
- `collisionCatalog.js`
- `constants.js`
- `descriptor.js`
- `families.js`
- `harbour.js`
- `index.js`
- `landmarks.js`
- `manifest.js`
- `math.js`
- `planner.js`
- `renderPlan.js`
- `sampleCatalog.js`
- `settlementSystem.js`
- `spatial.js`
- `terrain.js`
- `threeRenderer.js`
- `README.md`
- `settlementPlacement.schema.json`

Tests under `tests/settlements/`:

- `architecture.test.mjs`
- `budgets.test.mjs`
- `budget-stress.test.mjs`
- `collision-spatial.test.mjs`
- `compatibility.test.mjs`
- `diagnostic-contract.test.mjs`
- `harbour-landmarks.test.mjs`
- `manifest.test.mjs`
- `planner.test.mjs`
- `schema.test.mjs`
- `source-contract.test.mjs`
- `testContext.mjs`

## Explicitly unchanged

- `src/main.js`
- `src/world/world.js`
- all existing files under `src/world/`
- flight physics
- landing logic
- camera
- controls
- menu
- aircraft
- service worker and deployment files
- `gh-pages`

## Sources actually accessed

GitHub at the exact requested baseline:

- commit `d3e48499e90affe4dcf01fda1fdfa882fbaef8bd`;
- `package.json`;
- `src/config.js`;
- `src/world/world.js`;
- `src/world/features/city.js`;
- `src/world/features/structures.js`;
- `assets/world/features.json`.

Connected conversation and Library context:

- the current Chat 2 worker brief;
- recent Skyline controlling-chat context supplied in this conversation;
- recent Skyline VR2 Recovery, World Build and Navigation Package context supplied in conversation history;
- Library `WORLD_DETAIL_HANDOFF.md`.

The direct controlling-chat URL was not separately fetched as a webpage. No code was copied from `skyline-world-integration`; its rejection criteria were used only as constraints.
