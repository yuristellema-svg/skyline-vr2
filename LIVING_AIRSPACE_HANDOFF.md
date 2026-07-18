# Skyline Living Airspace v1

## Identity

- Repository: `yuristellema-svg/skyline-vr2`
- Branch: `skyline-living-airspace-v1`
- Exact baseline: `d3e48499e90affe4dcf01fda1fdfa882fbaef8bd`
- Phone VR is the primary target.
- This package is isolated. It does not edit `src/main.js`, `sw.js`, `index.html`, physics, camera, controls, menu, world generation or `gh-pages`.

## What this replaces

The baseline currently has fragmented owners:

- `src/optionalWorld/aiAircraft.js` uses five simple elliptical patrols.
- `src/optionalWorld/cloudField.js` creates independent billboard sprites.
- `src/contrails.js` owns only the player-wing trails.
- `src/performanceRuntime.js` can reduce whole categories, including turning contrails off.

Do not run those duplicate optional-world AI/cloud owners beside this package during final integration. Keep the player aircraft contrail system if desired; this package owns only traffic-aircraft contrails.

## Phone-first contract

Phone retains every feature category:

- rural birds;
- ridge birds;
- water birds;
- soaring birds;
- sailplanes;
- powered civilian traffic;
- high traffic contrails;
- both cloud strata;
- atmospheric depth bands;
- nearby positional-audio source descriptors.

Phone adaptation uses:

- 42 birds rather than 76;
- the same four bird ecosystems;
- the same six authored traffic routes;
- 10 cloud clusters rather than 15;
- four puffs per cluster rather than six;
- lower subsystem update cadence;
- shorter traffic-contrail history;
- four nearest audio sources rather than eight.

No major system is switched off.

## Systems

### Birds

Four deterministic ecosystems are created as four instanced draw calls. Motion includes flock variation, banking, regrouped habitat movement and soft player avoidance.

### Authored traffic

Six non-elliptical routes:

1. city commuter;
2. alpine sailplane;
3. coastal floatplane;
4. high east transit with contrail;
5. training circuit;
6. western glider.

Routes climb, cruise, descend and circle through authored waypoints. They are catalog data, so the future world-core worker can replace coordinates without rewriting runtime code.

### Clouds

Two pooled instanced low-poly cloud strata. Phone retains both layers. No sprite-per-cloud material allocation and no duplicate sky or fog controller.

### Atmospheric depth

Two restrained world-space depth bands. They do not replace the current sky or fog and can be disabled independently during final visual review.

### Audio hooks

`getAudioSources()` returns nearest traffic descriptors:

```js
{
  id,
  category,
  type,
  position,
  speed,
  gain,
  distanceSquared,
}
```

Feed these into the existing positional-traffic audio owner. Do not create a second audio graph.

## Integration API

```js
import {
  createLivingAirspaceSystem,
} from './livingAirspace/index.js';

const livingAirspace =
  createLivingAirspaceSystem({
    scene,
    sampleHeight: world.sampleHeight,
    phone: phoneMode,
    quality: 'auto',
    catalog: worldManifest?.livingAirspace,
  });

livingAirspace.setPhoneMode(phoneMode);
livingAirspace.fixedStepUpdate(dt, flight, phase);
livingAirspace.update(dt, flight, stereo.camera, phase);
livingAirspace.reportPerformance({
  dt,
  frameMs: dt * 1000,
});

const sources =
  livingAirspace.getAudioSources();

const diagnostics =
  livingAirspace.getStatus();

livingAirspace.dispose();
```

## Final integration ownership

When this package is wired:

- retire `optionalWorld` AI aircraft owner;
- retire `optionalWorld` cloud owner;
- keep only one positional traffic audio graph;
- keep the existing player-aircraft contrail system;
- use this package for distant traffic contrails;
- do not create a second atmosphere/fog owner;
- visually review the subtle depth bands before enabling them by default.

## Expected package budgets

Phone:

- birds: 42 instances / 4 draws;
- traffic: 6 routes / approximately 18 draws;
- traffic contrails: 1 draw;
- clouds: 2 draws;
- depth: 2 draws;
- package estimate: approximately 27 draws.

Full:

- birds: 76 instances / 4 draws;
- same six traffic routes;
- longer contrail history;
- 15 cloud clusters across two draws;
- package estimate remains approximately 27 draws.

Geometry and materials are pooled and no geometry or material is created during ordinary updates.

## Context actually accessed

### GitHub

- exact baseline commit `d3e48499e90affe4dcf01fda1fdfa882fbaef8bd`;
- `src/optionalWorld/index.js`;
- `src/optionalWorld/aiAircraft.js`;
- `src/optionalWorld/cloudField.js`;
- `src/contrails.js`;
- `src/performanceRuntime.js`;
- current Biplane V4 commit diff.

### Conversation context

- controlling Skyline VR2 conversation supplied by Yuri;
- current decisions that phone VR is primary;
- rejected World Detail v2.5 result and rollback decision;
- parallel worker boundaries.

### Missing or inaccessible

- GitHub write access was not granted to the connector, so the package is delivered with a guarded installer for Yuri's Codespace.
- No claim is made that inaccessible private chats were read directly.
