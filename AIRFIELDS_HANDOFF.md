# Skyline Airfields and Navigation v1, deep rebuild

Base: `d3e48499e90affe4dcf01fda1fdfa882fbaef8bd`

Branch target: `skyline-airfields-navigation-v1`

This package replaces the earlier flat, decorative runway implementation with profile-fitted operational airfields.

## Delivered

- 3 provisional fields audited against exact packed base terrain;
- shared catalog/schema for visuals, physics and navigation;
- smoothed terrain-following runway profiles and earthwork skirts;
- displaced thresholds, touchdown zones, shoulders and overruns;
- one-way mountain and emergency operations;
- aircraft restrictions and capability matrix;
- stopping-distance-aware touchdown grading;
- lateral-drift rollout, slope effects, excursions, overruns and takeoff;
- PAPI data, locator/approach/departure world-space cues;
- VOR-DME/NDB signal model;
- mobile/desktop light-budget planner;
- approach terrain-obstacle audit;
- world-core exclusion masks;
- diagnostics for runway bounds, touchdown zones, profile and corridors;
- field-selection and respawn hooks without menu redesign.

## Exact-base audit result

- Skyline Municipal: grade 4.67%, cross-grade 3.58%, max earthwork 3.00 m, approach margin +1.33 m.
- Crown Ridge: grade 7.91%, cross-grade 5.71%, max earthwork 3.57 m, approach margin +14.34 m.
- East Meadow Relief: grade 5.89%, cross-grade 2.31%, max earthwork 1.87 m, approach margin +7.39 m.

All allowed aircraft/field/direction capability rows pass the model. Glider landing is supported; self-powered glider takeoff is never enabled.

## Legacy compatibility

`distanceToRunway` keeps the exact quick-fixes-v2 public contract. It accepts both schema-v2 fields with `center: { x, z }` and legacy runway objects with top-level `x` and `z`. The original zero-on-runway and beyond-runway-end tests are included in the focused suite.
