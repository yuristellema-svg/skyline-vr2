# Skyline V3 baked world

These files are generated from `/world-recipe.json` by `/tools/worldgen/generate.mjs` and are meant to be committed to GitHub Pages.

- `manifest.json` is the runtime entry point and defines every encoding and stream distance.
- `features.json` contains the river/lake geometry, city recipe, canyon, five resolved bridges, and landmark elevations.
- `packs/*.wpk` are 1 km grouped terrain/biome/prop assets.
- `generation-report.json` is the concise reproducibility and size report.

Do not hand-edit generated JSON or packs. Change the recipe, regenerate, then run `node tools/worldgen/validate.mjs`.
