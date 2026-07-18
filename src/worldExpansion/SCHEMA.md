# Skyline World Core Manifest 2.2

`assets/world/world-core-v2-manifest.json` is the authoritative physical-world contract shared by the world runtime, settlement worker, airfield worker, landing/navigation systems, missions, and diagnostics.

The manifest describes one deterministic world. Consumers must not create parallel coordinate catalogs, decorative road networks, independent runway lists, or duplicate water/terrain layers.

## 1. Identity and coordinate frame

```json
{
  "format": "skyline-world-core-manifest",
  "version": 2,
  "schemaVersion": "2.2.0",
  "seed": 18172026,
  "coordinateSystem": {
    "units": "meters",
    "xAxis": "east",
    "zAxis": "north",
    "origin": "world-center"
  }
}
```

Horizontal points use `[x, z]`. Three-dimensional navigation and landing points use `[x, y, z]`. All distances, elevations, widths and radii are metres. IDs are stable integration keys; array order and display names are not identity.

`bounds` is the complete 16.384 km world. `legacyCoreBounds` marks the existing packed 8.192 km core. Inside that core, the packed terrain sampler remains authoritative. The expansion height model blends continuously around the ownership boundary and does not render a second terrain surface over it.

## 2. Streaming and phone budgets

```json
{
  "chunkSizeMeters": 512,
  "loadRadiusMeters": 2816,
  "unloadRadiusMeters": 3328,
  "fullLodThroughMeters": 896,
  "halfLodThroughMeters": 1792,
  "renderSpacingMeters": [18, 36, 72],
  "buildsPerUpdate": 1,
  "triangleBudget": 265000,
  "maximumLoadedChunks": 108,
  "skirtDepthMeters": 18,
  "cacheEntries": 72,
  "batchRebuildThreshold": 18
}
```

The same chunks and physical features exist on desktop and phone. Adaptation is limited to terrain spacing, visible distance, residency, update cadence and small-detail density.

The runtime:

- creates at most `buildsPerUpdate` new chunk geometries during an ordinary update;
- uses three merged LOD batch meshes, not one draw call per chunk;
- adds seam skirts to loaded chunk edges;
- reuses recently unloaded geometries through a bounded LRU cache;
- delays batch rebuilding until pending topology changes reach `batchRebuildThreshold` or loading settles;
- exposes resident, cached, merged-batch and static-feature geometry bytes separately.

`budgets` contains the acceptance ceilings for total phone draw calls, triangles, road subdivisions, water subdivisions, settlement instances, transparent draws and collision boxes.

## 3. Regions, biomes and terrain forms

`regions` define geographic identity and navigation purpose. A region contains:

```json
{
  "id": "crown-range",
  "kind": "mountain",
  "center": [0, 6350],
  "radius": [3700, 1750],
  "navigationRole": "high mountain crossing and ridge flight"
}
```

`biomes.palette` defines stable biome IDs, keys and colours. `biomes.regionAssignments` maps authored regions to dominant biome keys. The runtime may refine the final biome using elevation, slope, hydrology and deterministic noise, but may not move region boundaries or create a separate terrain mesh.

`terrainForms` contains five authored form classes:

- `ridges`: elongated raised massing and mountain spines;
- `valleys`: lowered safe corridors and river approaches;
- `plateaus`: flattened highlands or urban/industrial shelves;
- `escarpments`: one-sided sharp elevation transitions;
- `basins`: broad depressions around lakes and lowlands.

Every form is evaluated by the same height function used for visible terrain, collision, roads and feature placement.

## 4. Hydrology

`water` owns one southern sea level, a shoreline definition, rivers and lakes.

A river contains ordered points and a descending surface profile:

```json
{
  "id": "pine-river",
  "points": [[-7200, -3100], [-6500, -3500], [-5900, -4300]],
  "bedWidthMeters": 58,
  "bankWidthMeters": 210,
  "sourceSurfaceMeters": 47,
  "mouthSurfaceMeters": 18,
  "bedDepthMeters": 8
}
```

The terrain model carves the channel and banks from this exact polyline. The water renderer subdivides the same polyline and surface interpolation. At a road crossing without a bridge, the runtime leaves a bounded culvert gap and raises the road as a supported causeway; it does not render water through the road deck.

A lake contains `center`, elliptical `radius`, shoreline feather, surface elevation and floor elevation. Roads must route around lake interiors unless an explicitly authored bridge/causeway owns the crossing.

## 5. Road network and junctions

A road is an ordered terrain-following polyline:

```json
{
  "id": "western-highway",
  "class": "primary",
  "widthMeters": 15,
  "points": [[-3740, -300], [-4700, -1200], [-5520, -2400]],
  "connects": ["legacy-hub", "west-airfield", "pine-country"]
}
```

The height model samples the complete road network before rendering. It then:

- establishes a smoothed grade profile per road;
- enforces class-specific maximum grades;
- grades the terrain underneath the road and its shoulder rather than floating a ribbon above untouched land;
- applies settlement and airfield elevation locks where roads enter those sites;
- supports authored bridge approaches and non-bridge causeways;
- exposes the final profile through `getRoadCatalog()`.

`roadJunctions` lists shared coordinates and the road IDs that meet there. Junction pads are compiled from these entries. A junction is valid only when every listed road actually reaches its coordinate within the manifest tolerance.

## 6. Bridges

A bridge never owns an arbitrary free position. It owns one exact road segment and one river:

```json
{
  "id": "pine-crossing",
  "roadId": "farm-crosslink",
  "segmentIndex": 1,
  "riverId": "pine-river",
  "type": "steel_truss",
  "deckWidthMeters": 13,
  "clearanceMeters": 12,
  "approachLengthMeters": 190
}
```

The deck endpoints are exactly:

```text
roads[roadId].points[segmentIndex]
roads[roadId].points[segmentIndex + 1]
```

Validation rejects:

- unknown roads or rivers;
- invalid segment indices;
- spans outside the bounded bridge range;
- bridge midpoints too far from the referenced river;
- shallow crossing angles that merely follow or touch a river;
- endpoints outside world bounds.

The terrain model grades both approaches and abutments while preserving a lower river bed beneath the deck. The renderer may vary towers, trusses, arches and supports by `type`, but must not move the deck or add a second collision surface.

## 7. Settlement placement contract

Each `settlements` entry is an authored placement zone attached to one real road:

```json
{
  "id": "ironworks",
  "kind": "industrial",
  "center": [6260, 820],
  "radius": [840, 640],
  "buildingCount": 64,
  "maximumStoreys": 5,
  "roadId": "eastern-trunk",
  "streetHeadingDegrees": 8,
  "layoutPattern": "industrial-grid",
  "roadSetbackMeters": 34,
  "districts": ["foundry", "warehouse", "worker-housing"]
}
```

`layoutCompiler.js` converts the eight zones into a deterministic worker-facing catalog with:

```js
{
  settlements: [{
    id,
    kind,
    center,
    radius,
    roadId,
    streetHeadingDegrees,
    layoutPattern,
    districts,
    lotIds
  }],
  lots: [{
    id,
    settlementId,
    district,
    archetype,
    position: [x, y, z],
    headingDegrees,
    footprint: [width, depth],
    storeys,
    roof,
    collision
  }]
}
```

All lot elevations come from the shared height model. The world-core renderer uses low-cost placeholder massing and collision. The settlement worker may replace visuals lot-by-lot, but must preserve lot IDs, footprints, elevations, road setbacks and collision ownership.

## 8. Airfields and landing catalog

Every physical airfield has exactly one `landingCatalogId`; every landing entry points back through `airfieldId`.

```json
{
  "id": "west-valley-airfield",
  "landingCatalogId": "west-valley-runway",
  "center": [-5480, -520],
  "headingDegrees": 34,
  "runwayLengthMeters": 1260,
  "runwayWidthMeters": 54,
  "elevationMeters": 112,
  "approachLengthMeters": 1800,
  "clearWidthMeters": 380,
  "roadId": "western-highway",
  "site": {
    "taxiways": [],
    "aprons": [],
    "hangarPads": [],
    "overrunMeters": 120
  }
}
```

The same definition owns:

- terrain flattening under runway, shoulders, overruns, taxiways and aprons;
- obstacle-clear approach corridors at both runway ends;
- road access and site elevation;
- visible runway/taxiway/apron geometry;
- worker-reserved hangar pads;
- landing/navigation position, heading, length and width.

Consumers must use `getAirfieldCatalog()` and `getLandingCatalog()`. A second hardcoded runway list is invalid.

## 9. Navigation landmarks and worker exports

`navigationReferences` supplies stable mission/navigation coordinates. `landmarks` defines physical terrain landmarks such as rock needles, mesas, waterfalls and coastal headlands. Landmark geometry is sampled against the same height model and remains part of the phone world.

`workerExports` documents the named catalogs available from the runtime. Current public methods on `SkylineWorld` are:

```js
world.sampleHeight(x, z)
world.sampleSlope(x, z, spacing)
world.getWorldManifest()
world.getRoadCatalog()
world.getSettlementCatalog()
world.getAirfieldCatalog()
world.getLandingCatalog()
world.getWaterCatalog()
world.getWorldDiagnostics()
```

Returned catalogs are frozen snapshots or manifest-owned immutable values. Workers should consume them rather than duplicate them.

## 10. Compatibility and breaking changes

Within schema version 2, additive optional fields are allowed. The following are breaking world-layout changes and require validation, diagnostics and downstream worker review:

- changing an existing stable ID;
- moving road points or junction coordinates;
- changing a bridge `roadId`, `segmentIndex` or `riverId`;
- changing river/lake geometry or water elevations;
- moving a settlement zone or changing its road ownership;
- changing an airfield center, heading, elevation, dimensions or catalog link;
- changing `legacyCoreBounds` or the coordinate frame.

Major systems may not be removed from phone mode. Phone optimisation must preserve geographic and gameplay parity.
