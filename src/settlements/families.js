export const FAMILY_PROFILES = Object.freeze({
  skyline_tower: Object.freeze({ width: [30, 46], depth: [28, 44], height: [86, 146], spacing: 58, rows: 2, slope: 4.2 }),
  podium_tower: Object.freeze({ width: [38, 58], depth: [34, 54], height: [58, 108], spacing: 62, rows: 2, slope: 4.6 }),
  urban_midrise: Object.freeze({ width: [30, 48], depth: [28, 46], height: [30, 64], spacing: 52, rows: 2, slope: 5.0 }),
  courtyard_block: Object.freeze({ width: [42, 62], depth: [40, 60], height: [24, 48], spacing: 68, rows: 2, slope: 4.5 }),
  civic_hall: Object.freeze({ width: [44, 68], depth: [34, 52], height: [24, 38], spacing: 74, rows: 1, slope: 4.0 }),
  old_town_block: Object.freeze({ width: [24, 38], depth: [22, 34], height: [16, 32], spacing: 42, rows: 2, slope: 5.2 }),
  rowhouse: Object.freeze({ width: [22, 34], depth: [20, 30], height: [10, 18], spacing: 37, rows: 2, slope: 5.8 }),
  detached_house: Object.freeze({ width: [16, 26], depth: [16, 25], height: [8, 14], spacing: 36, rows: 1, slope: 6.5 }),
  market_block: Object.freeze({ width: [28, 44], depth: [24, 40], height: [14, 26], spacing: 48, rows: 1, slope: 5.5 }),
  village_house: Object.freeze({ width: [15, 24], depth: [15, 24], height: [7, 12], spacing: 40, rows: 1, slope: 7.0 }),
  warehouse: Object.freeze({ width: [48, 82], depth: [34, 64], height: [13, 24], spacing: 82, rows: 1, slope: 4.0 }),
  factory_hall: Object.freeze({ width: [58, 94], depth: [42, 72], height: [18, 32], spacing: 96, rows: 1, slope: 3.6 }),
  tank_cluster: Object.freeze({ width: [34, 52], depth: [34, 52], height: [18, 30], spacing: 64, rows: 1, slope: 3.8 }),
  dock_warehouse: Object.freeze({ width: [48, 78], depth: [32, 54], height: [14, 26], spacing: 78, rows: 1, slope: 3.8 }),
  barn: Object.freeze({ width: [30, 48], depth: [22, 38], height: [11, 18], spacing: 72, rows: 1, slope: 6.5 }),
  farmhouse: Object.freeze({ width: [18, 28], depth: [18, 28], height: [8, 14], spacing: 56, rows: 1, slope: 7.0 }),
});

const DEFAULT_WEIGHTS = Object.freeze({
  downtown: Object.freeze({ skyline_tower: 0.22, podium_tower: 0.30, urban_midrise: 0.34, courtyard_block: 0.14 }),
  civic: Object.freeze({ civic_hall: 0.38, urban_midrise: 0.32, courtyard_block: 0.30 }),
  'old-quarter': Object.freeze({ old_town_block: 0.52, market_block: 0.22, rowhouse: 0.26 }),
  residential: Object.freeze({ detached_house: 0.55, rowhouse: 0.35, market_block: 0.10 }),
  'mixed-use': Object.freeze({ urban_midrise: 0.38, old_town_block: 0.28, rowhouse: 0.22, market_block: 0.12 }),
  market: Object.freeze({ market_block: 0.46, old_town_block: 0.34, rowhouse: 0.20 }),
  industrial: Object.freeze({ factory_hall: 0.38, warehouse: 0.36, tank_cluster: 0.26 }),
  warehouse: Object.freeze({ warehouse: 0.58, factory_hall: 0.24, tank_cluster: 0.18 }),
  docklands: Object.freeze({ dock_warehouse: 0.56, warehouse: 0.25, tank_cluster: 0.19 }),
  rural: Object.freeze({ barn: 0.54, farmhouse: 0.46 }),
});

const SETTLEMENT_DISTRICT = Object.freeze({
  city: 'downtown',
  suburb: 'residential',
  town: 'market',
  village: 'residential',
  industrial: 'industrial',
  harbour: 'docklands',
  farm: 'rural',
});

export function fallbackDistrictKind(settlementKind) {
  return SETTLEMENT_DISTRICT[settlementKind] ?? 'residential';
}

export function familyWeightsFor(district, settlementKind) {
  return district?.familyWeights ?? DEFAULT_WEIGHTS[district?.kind ?? fallbackDistrictKind(settlementKind)];
}

export function chooseWeightedFamily(weights, random) {
  const entries = Object.entries(weights ?? {}).filter(([family, weight]) => weight > 0 && FAMILY_PROFILES[family]);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return 'detached_house';
  let cursor = random() * total;
  for (const [family, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return FAMILY_PROFILES[family] ? family : 'detached_house';
  }
  return FAMILY_PROFILES[entries.at(-1)?.[0]] ? entries.at(-1)[0] : 'detached_house';
}
