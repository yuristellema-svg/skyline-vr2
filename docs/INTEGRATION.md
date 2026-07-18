# Integration contract

The branch preserves the existing constructors used by `src/main.js`:

```js
new LandingSystem(scene, world.sampleHeight)
new RunwayGuidanceSystem(scene, landingSystem)
```

No main-loop edits are required for the current integration.

World Core v2 should consume `fieldExclusionMasks()` to remove trees, rocks, roads and buildings from operational surfaces, then replace only the provisional catalog coordinates. It should not create a second runway list.

Optional events:

- `skyline:airfield-select`
- `skyline:airfield-cycle`
- `skyline:airfield-diagnostics`
- `skyline:airfield-spawn-request`
- `skyline:airfield-spawn-ready`
- `skyline:airfield-target-changed`
- `skyline:touchdown`
- `skyline:landed`
- `skyline:takeoff`
