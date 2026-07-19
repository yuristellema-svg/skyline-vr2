# Airfield catalog v2

`src/airfields/airfieldCatalog.js` is the runtime authority. `docs/airfield-catalog.schema.json` documents the future world-manifest contract.

Every field defines one coordinate source for:

- runway mesh and earthwork skirt;
- profile-fitted surface height used by landing physics;
- physical and displaced thresholds;
- touchdown zones, shoulders and overruns;
- permitted landing and takeoff directions;
- aircraft restrictions;
- approach and departure corridors;
- mobile and desktop light budgets;
- radio beacon identity, frequency, type and range.

The provisional coordinates are isolated catalog data. World Core v2 can replace them without changing landing, guidance or rendering algorithms.
