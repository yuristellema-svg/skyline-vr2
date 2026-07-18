# Skyline VR2 settlements visual and urban-design handoff

## Branch and scope

- Repository: `yuristellema-svg/skyline-vr2`
- Branch: `skyline-settlements-v1`
- Previous branch head inspected: `97dac3e2d4469b5e50649bce617e66a3510b38dc`
- Original required baseline: `d3e48499e90affe4dcf01fda1fdfa882fbaef8bd`
- Runtime status: isolated package only; `src/main.js` is unchanged
- `gh-pages`: unchanged and unpublished

This pass rebuilds the settlement composition itself. It is not a restyled SVG diagnostic and it does not add arbitrary object volume.

## What changed visually

### Main city

Aster City now has four exact, road-linked signature anchors:

- a 176 m tapered needle;
- a 148 m stepped crown tower;
- a paired riverside gateway;
- a civic rotunda and dome.

Generated downtown buildings are deliberately lower than those anchors. An authored radial height profile produces a readable central skyline instead of randomly scattered tall blocks.

The four districts are carried by large-scale form before windows are enabled:

- **Downtown:** cool blue-grey podiums, tapered setbacks, stepped crowns and concentrated height.
- **Civic:** pale stone halls, monumental roofs, dome and a large civic square.
- **Old Quarter:** warm brick street walls, repeated gables, market square and compact rows.
- **Riverside:** lower green-grey mixed-use masses, gateway towers, promenade and a protected waterfront opening.

Six major negative spaces are protected from parcel generation: civic square, central park, old market, riverside promenade, waterfront opening and service cut. Phone quality retains all rendered public spaces and signature masses.

### Architecture

Primary forms are now deliberately different at aircraft distance. The production module includes 20 parcel families, including four signature families. Towers use podiums, setbacks, tapered shafts and crowns. Civic buildings use monumental gables, rotundas and domes. Courtyard blocks use four essential wings. Industry uses large sawtooth halls, tank compounds and stacks. Tiny rooftop clutter is secondary and mostly removed on phone.

### Harbour and industry

Port Aster is organized into berth groups `[2, 2, 1]` with open-water gaps between groups, five large shoreline-oriented piers, berth heads, two gantry cranes, two loading aprons, two exact dock halls, a promenade and a protected waterfront opening. Every pier retains its supplied shoreline parameter and nearest supplied road reference.

Forge District now has two large loading yards, a rail/service corridor, one exact factory hall and one exact tank compound. The open yards are part of the actual descriptor catalog, not decoration added only to screenshots.

### Towns and villages

The smaller locations no longer use one generic scatter pattern:

- Birch Crossing: main-street organization, market square and civic hall.
- Cedar Hollow: green-centered organization and market hall.
- Stonefield: crossroads organization and village green.
- Ridge Hamlet: ridge organization and common.

## Actual Three.js proof

`settlement-preview/` is an isolated browser harness that imports the real repository Three.js module and the actual settlement production modules. It uses:

- `THREE.WebGLRenderer`;
- the real generated geometry and pooled materials;
- `THREE.InstancedMesh`;
- the actual low, medium and high descriptor tiers;
- perspective cameras, fog and lighting;
- actual individual-window and signal-light materials.

Preview-only terrain, supplied-road strips and water make the placement relationships readable. They are not part of the production settlement package.

Controls include phone/medium/high, day/sunset/night, aerial, low approach, downtown, skyline, civic, old quarter, harbour, town and village views.

Proof files:

- `settlement-preview/screenshots/proof-sheet.png`
- `settlement-preview/screenshots/before-after.png`
- `phone-main-city.png`
- `high-main-city.png`
- `low-flight-approach.png`
- `skyline-profile.png`
- `civic-district.png`
- `old-quarter.png`
- `harbour-approach.png`
- `town-birch.png`
- `village-stonefield.png`
- `night-city.png`
- `sunset-aerial.png`
- `phone-aerial.png`

These screenshots were rendered at 1440×810 from the actual harness. They are not SVG isometric projections.

## Reference metrics

The current deterministic reference catalog produces:

- 11 settlement areas;
- 16 districts;
- 9 exact navigation landmarks;
- 82 deliberately spaced parcels, including exact signature sites;
- 18 rendered public-space surfaces;
- 934 high-tier descriptors;
- 791 medium-tier descriptors;
- 576 phone-tier descriptors;
- 305 collision boxes;
- 35 spatial cells.

| Tier | Instances | Estimated triangles | Draw calls |
|---|---:|---:|---:|
| Phone / low | 576 | 11,362 | 42 |
| Medium | 791 | 15,874 | 60 |
| High | 934 | 18,526 | 67 |

The reduced object count versus the previous package is intentional: fewer larger masses, wider street and plaza space, and less micro-detail. Phone retains 92 foundations, 178 primary structures, all 144 primary roofs, all 18 public-space surfaces and every essential signature site.

## Rendering policy

Per-instance colour is passed through an explicit instanced shader path because the city must preserve district colour separation on WebGL1-class phone paths. Opaque settlement materials remain non-emissive Lambert materials. Windows and signal lamps use separate explicit transparent light materials. Whole-building emission remains structurally impossible.

The renderer:

- performs no scene traversal;
- recolours no existing world material;
- creates no private animation loop;
- allocates no geometry during updates;
- pools geometry and surface materials;
- uses spatial distance tiers;
- keeps skyline and primary district massing on phone.

## Placement integrity retained

Every generated or exact signature parcel:

1. resolves a supplied road relationship;
2. aligns to the supplied road heading unless explicitly allowed otherwise;
3. remains inside settlement and district polygons;
4. stays outside supplied exclusions and protected public-space footprints;
5. samples terrain at its centre and all four oriented corners;
6. rejects unsafe terrain variation;
7. receives a terrain-conforming foundation;
8. is checked against all accepted oriented footprints.

The package still refuses to invent missing roads, settlement polygons, shoreline direction or terrain heights. The fallback manifest remains isolated test data only.

## Manifest additions

The version-2 schema remains backward compatible and now documents optional authored urban-design fields:

- district `materialKey`, `blockScale` and `heightProfile`;
- settlement `organizingPattern` and optional `heightProfile`;
- `publicSpaces[]`;
- `signatureSites[]`;
- harbour `berthGroups[]`.

See `src/settlements/settlementPlacement.schema.json`.

## Validation

Run:

```bash
node --test tests/settlements/*.test.mjs
node diagnostics/generate-summary.mjs
```

Current result: **39 passed, 0 failed**.

The added visual-design tests verify signature anchors, protected negative space, district-specific primary forms and colours, controlled height gradients, harbour compounds, distinct town patterns, phone massing without windows, and the real WebGL preview contract.

## Integration

The API is unchanged:

```js
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
settlements.dispose();
```

Do not integrate the fallback coordinates as the final Skyline layout. World Core must supply the authoritative roads, settlement and district polygons, exclusions, shoreline direction, public spaces and signature sites.

## Explicitly unchanged

- `src/main.js`
- `src/world/world.js`
- all existing world-generation files
- flight physics and landing
- camera and controls
- menu
- aircraft
- deployment and service-worker files
- `gh-pages`
