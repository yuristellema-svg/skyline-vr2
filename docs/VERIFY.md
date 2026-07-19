# Verification

Focused package validation:

```bash
node --test tests/airfields-*.test.mjs tests/landing-*.test.mjs tests/package-*.test.mjs
node tools/airfields/auditWorldSites.mjs
node tools/airfields/reportCapabilities.mjs
```

The installer then runs the repository-wide suite and `world:validate` before committing.

The exact-base test fixture reproduces the 4 m coarse interpolation and 0.7 m packed fine-detail pass from the world generator. The install-time audit imports the live `world-recipe.json` and `tools/worldgen/worldgen-lib.mjs`, so it fails if the base world or provisional sites no longer match.

The focused geometry suite also reproduces the two existing `tests/quick-fixes-v2.test.mjs` runway-distance cases using the legacy `{ x, z, heading, length, width }` runway shape.
