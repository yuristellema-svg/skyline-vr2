# PT-17 Biplane Airframe Handoff

## Package identity

- Aircraft id: `biplane`
- Display name: `PT-17 BIPLANE`
- Approved source baseline: `origin/skyline-quick-fixes-v2`
- Package type: isolated fifth-aircraft proposal for later SKYLINE CONTROL integration
- Live roster wiring: intentionally absent

This package does not contain or replace `src/main.js`, `src/camera.js`, `src/input.js`, `src/menu.js`, `src/flightModel.js`, `src/renderPoseInterpolator.js`, world modules, audio modules, service-worker files or server files.

## Important v1 audit finding

The first ZIP bundled a compact 18-line `aircraftVisualShared.js` test stand-in. Several geometry functions in that stand-in returned empty geometries. That meant the source looked detailed while parts of the model could be visually empty in a real integration.

This revision removes that shared-file replacement entirely. It uses a dedicated, complete `biplaneVisualShared.js` implementation with real procedural vertices, indices, normals and bounding data. No existing shared aircraft helper needs to be overwritten.

## Production modules

- `src/aircraft/biplaneSpecs.js`
  - aircraft identity;
  - real-world reference dimensions;
  - seven-cylinder Continental R-670 metadata;
  - upper/lower wing geometry constants;
  - visual bounds and detail-level constants.

- `src/aircraft/biplaneVisualShared.js`
  - self-contained mesh/material primitives;
  - non-empty rounded fabric-wing generator;
  - lathed fuselage geometry;
  - planform and vertical-planform geometry;
  - wooden propeller-blade geometry;
  - beams, cables, panel lines and period gauges;
  - `setBiplaneDetailLevel()`;
  - visual-stat collection.

- `src/aircraft/biplaneExternal.js`
  - complete external PT-17-style airframe factory;
  - `createBiplaneExternal({ detailLevel })`.

- `src/aircraft/biplaneCockpit.js`
  - completely separate rear-instructor cockpit factory;
  - `createBiplaneCockpit({ detailLevel })`.

- `src/aircraft/biplaneRuntime.js`
  - optional pure presentation helpers;
  - control-surface and cockpit-control animation without an animation loop;
  - instrument animation;
  - detail-quality switching;
  - deterministic propeller-rate calculation;
  - presentation reset.

- `src/aircraft/biplaneProfile.js`
  - currently supported profile fields separated from optional future handling extensions.

## External airframe detail

The external factory now builds:

- real-scale visual bounds of approximately 7.54 m length, 9.81 m span and 2.95 m height;
- unequal-span, forward-staggered upper and lower wings;
- a separate upper centre section and fuel filler cap;
- genuinely rounded, cambered, non-zero-thickness procedural fabric wings;
- visible rib-cap strips and rear-spar/control-surface lines;
- ailerons on the lower wings only;
- N-form interplane struts;
- four cabane struts;
- crossed flying and landing wires;
- tailplane bracing and visible control cables;
- a welded-tube/fabric fuselage appearance with metal forward skin;
- a correct seven-cylinder Continental R-670-style radial, not the previous nine-cylinder approximation;
- cylinder heads, cooling fins, pushrods, ignition leads, exhaust stubs and collector ring;
- circular ring cowling;
- laminated wooden two-blade propeller and existing Skyline blur-disk contract;
- separate student and instructor open-cockpit cavities;
- separate external seats, rims, instrument hints and windscreens;
- fixed main gear with paired legs, shock links, axle, hubs and tyres;
- a tailwheel and tailwheel strut;
- separate stabilizer, elevator, fin and rudder;
- pilot step, handhold, pitot tube, navigation-light hints and restrained training markings;
- cream/yellow/blue training livery with separate fabric and metal material responses.

## Dedicated cockpit detail

The cockpit is not derived from the Zero, Stuka, Scout or Glider. It includes:

- rear-instructor open cockpit shell;
- leather cockpit rim and fabric sidewalls;
- period seat, cushion and harness;
- framed windscreen;
- seven animated gauges: IAS, ALT, RPM, OIL, VSI, TEMP and FUEL;
- magnetic compass;
- slip/skid ball;
- magneto/switch and placard details;
- control stick with its own pivot;
- left and right rudder pedals with heel trays;
- throttle and mixture quadrant;
- structural fuselage tubes;
- front-student cockpit visible ahead;
- forward nose and circular cowling relationship;
- visible upper wing, centre section, fuel cap and cabane structure;
- period Gosport voice-tube detail;
- no modern canopy and no camera attachment.

## Stable Skyline contracts

Both factories:

- return unattached `THREE.Group` roots;
- mark `sharedRenderPoseCompatible = true`;
- mark `aircraftFixed = true`;
- never attach themselves to a camera;
- never create `requestAnimationFrame`, timer or interval ownership;
- never mutate the external/cockpit root pose during optional presentation updates;
- introduce no synthetic shake or third-person vibration;
- expose the existing `userData.propeller` and `userData.propellerBlur` contract.

The cockpit must remain mounted beneath the existing aircraft-fixed `cockpitRoot`. Do not attach it to the head camera. The existing shared `RenderPoseInterpolator` remains the single pose source for the aircraft and camera.

## Optional presentation API

These functions are safe to ignore during initial integration:

```js
import {
  applyBiplaneControlState,
  applyBiplaneInstrumentState,
  computeBiplanePropellerRate,
  resetBiplanePresentation,
  setBiplaneQuality,
} from './aircraft/biplaneRuntime.js';
```

`applyBiplaneControlState()` animates only named local pivots:

- opposed lower-wing ailerons;
- elevator;
- rudder;
- cockpit stick;
- pedals;
- throttle and mixture levers.

It does not change flight physics or root transforms.

`applyBiplaneInstrumentState()` updates the seven cockpit gauges, compass and slip ball.

`setBiplaneQuality(external, cockpit, level)` supports:

- `0`: performance;
- `1`: standard;
- `2`: high.

The core silhouette, wings, gear, engine and cockpit remain present at level 0. Fine wires, fasteners, cooling-fin details and cockpit micro-details can be hidden without rebuilding the model.

The current `AircraftVisualSystem.update()` already owns propeller rotation. `computeBiplanePropellerRate()` is provided only as a deterministic future profile helper and must not be run alongside the existing owner unless SKYLINE CONTROL deliberately changes ownership.

## Flight-profile proposal

`BIPLANE_FLIGHT_PROFILE_PROPOSAL` contains only fields matching the currently integrated profile structure:

```js
{
  id: 'biplane',
  name: 'PT-17 BIPLANE',
  energyBias: 0.012,
  dragScale: 1.62,
  turnDragScale: 1.46,
  misalignmentDragScale: 1.40,
  pitchRateScale: 0.82,
  rollRateScale: 0.92,
  angularResponseScale: 1.02,
  angularReleaseScale: 0.86,
  coordinatedTurnScale: 0.90,
  liftScale: 1.30,
  stallSpeedScale: 0.68,
  enginePower: 8.6,
  engineResponse: 1.65,
  cruiseSpeed: 43,
  maximumLevelSpeed: 54,
  takeoffSpeed: 19,
  airbrakeDrag: 3.2,
  minimumEnergyLoss: 0,
  gravityScaleDive: 0.86,
  gravityScaleClimb: 0.88,
  touchdownSpeed: 22,
  touchdownSink: 2.6,
  touchdownBank: 12,
  touchdownHeading: 24,
  rollingDrag: 2.9,
  brakePower: 10,
  overspeedStart: 67,
  overspeedDrag: 0.00335,
  maxOverspeedDrag: 25,
  structuralPositiveG: 6.0,
  structuralNegativeG: -3.0
}
```

`maximumLevelSpeed` is a level-flight performance target, not a hard cap. Dives can continue to accelerate through progressive overspeed drag.

`BIPLANE_HANDLING_EXTENSIONS` separately records proposed future behavior that the current profile schema may not consume yet:

- gentle stall break;
- useful post-stall control;
- rapid climb energy loss;
- slow dive-speed build;
- responsive initial roll but limited sustained roll rate;
- short ground run.

Do not silently paste extension-only fields into `flightModel.js`. SKYLINE CONTROL should review them during a dedicated flight-model integration pass.

## Exact minimal integration

In `src/aircraftVisuals.js`, add imports:

```js
import {
  createBiplaneExternal,
} from './aircraft/biplaneExternal.js';

import {
  createBiplaneCockpit,
} from './aircraft/biplaneCockpit.js';
```

Add the fifth profile entry only when the roster is intentionally expanded:

```js
Object.freeze({
  id: 'biplane',
  name: 'PT-17 BIPLANE',
  engine: 'RADIAL',
})
```

Add builder mappings:

```js
EXTERNAL_BUILDERS.biplane =
  createBiplaneExternal;

COCKPIT_BUILDERS_V52.biplane =
  createBiplaneCockpit;
```

Add `BIPLANE_FLIGHT_PROFILE_PROPOSAL` values to `AIRCRAFT_FLIGHT_PROFILES.biplane` during the same controlled integration.

Roster UI, keyboard `Digit5`, radial audio and menu work remain separate responsibilities. This package intentionally does not modify them.

## Validation

The package contains 22 tests covering:

- both factories constructing;
- finite transforms and explicit geometry coordinates;
- substantial non-empty procedural wing vertices and indices;
- real proportions, unequal span and forward stagger;
- upper and lower wing levels;
- lower-wing-only ailerons;
- exactly seven radial cylinders;
- pushrods and exhaust collector;
- N-struts, cabanes and bracing;
- two external open cockpits;
- fixed taildragger gear;
- two-blade wooden propeller;
- dedicated cockpit controls and period details;
- mobile-VR geometry budgets;
- no private animation loop;
- no camera attachment;
- no synthetic shake;
- no imports from another aircraft model;
- no forbidden live-integration files;
- root-pose preservation during optional updates;
- quality-level switching;
- profile behavior and absence of a hard speed cap.

See `TEST_RESULTS.txt` for the captured run.
