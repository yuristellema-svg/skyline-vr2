# Skyline live city grounding V5, rebased

Exact live base: `09d0b01fb626a29e45a262583fe1f88173939a09`.

This package applies the complete city repair directly to the clean live branch. It does not require V3 or V4 to be present.

- Relocates the detailed settlement network to the exact packed-terrain audited center `(-1965, -451)` at scale `1.0`.
- Preloads the whole settlement terrain region before foundations, roads, public spaces and collision boxes are created.
- Audits every authored signature building against the packed terrain and permits only restrained terraces.
- Disables the buried legacy procedural box city and all of its playable collision solids.
- Preserves the three legacy landmark collision labels as tiny below-world compatibility sentinels.
- Preserves all locked Biplane V4 cache, module and audio identifiers byte-for-byte.
- Runs focused city tests, the complete repository suite and world validation before any live push.
- Pushes an auditable worker branch first, verifies `gh-pages` did not move, and then performs a normal fast-forward push to live.

The exact per-landmark measurements are recorded in `EXACT_SIGNATURE_AUDIT.json`.
