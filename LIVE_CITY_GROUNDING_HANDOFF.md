# Skyline live city grounding v3

This patch targets the current live `gh-pages` runtime rather than the old isolated world base.

It performs three coupled fixes:

1. Moves the authored settlement network to the measured western-core site centered at `(-2830, -1400)` and restores scale `1.0`, keeping the complete network within the locked 8 km terrain.
2. Preloads the complete settlement terrain region before building foundations, roads, collision boxes, public spaces and landmarks. It then restores the normal spawn preload.
3. Removes the buried legacy procedural box city from the runtime scene and collision system while preserving the three required legacy landmark collision labels as tiny non-playable sentinels below the world.

V3 also preserves every locked Biplane V4 deployment identifier exactly:

- `index.html` keeps `./src/main.js?v=biplane-zero-radio-v4`;
- `sw.js` keeps `skyline-biplane-zero-radio-v4-20260718`;
- `sw.js` keeps `./src/main.js?v=biplane-zero-radio-v4`;
- Zero radio and Stuka siren asset paths remain unchanged.

The changed service-worker source triggers the update while its install step refreshes the existing locked URLs. No integrated worker cache contract is renamed.

The installer publishes only after the focused grounding audit and the full repository test suite pass. It first pushes an auditable worker branch, verifies that `gh-pages` has not moved during validation, and then fast-forwards the live branch.
