# Terrain fit and landing gameplay

## Terrain surface

A flat runway plane was rejected. Each runway now uses a station-based longitudinal profile sampled across the full width. The profile is smoothed, constrained by maximum grade, raised to maintain clearance, then used by both the visible mesh and landing physics.

The runtime also builds terrain skirts down to the sampled world surface, preventing floating runway edges. Diagnostics expose profile grade, cross-grade, roughness, earthwork and controlling approach-clearance samples.

## Touchdown

Touchdown evaluation considers:

- aircraft-specific speed, sink, bank and heading limits;
- lateral drift;
- throttle state;
- physical and displaced threshold;
- touchdown-zone location;
- runway remaining;
- estimated stopping distance for that aircraft and surface;
- field, aircraft and one-way-operation restrictions.

A safe late touchdown can continue only when the stopping-distance margin remains positive. A technically gentle touchdown with insufficient runway becomes `RUNWAY TOO SHORT`, not a fake success.

## Ground run

Rollout retains touchdown lateral drift and damps it according to surface grip and braking. It no longer snaps the aircraft to the centerline every frame. Longitudinal runway grade affects acceleration. Shoulder excursions, overruns, closed-direction takeoffs, stopping and powered takeoff are separate states.
