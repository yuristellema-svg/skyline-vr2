export const FAMILY_PROFILES = Object.freeze({
  signature_needle: Object.freeze({ width: [54, 66], depth: [48, 60], height: [155, 182], spacing: 96, rows: 1, slope: 3.8 }),
  signature_crown: Object.freeze({ width: [62, 78], depth: [44, 58], height: [125, 158], spacing: 96, rows: 1, slope: 3.8 }),
  signature_gateway: Object.freeze({ width: [88, 112], depth: [44, 58], height: [105, 136], spacing: 118, rows: 1, slope: 3.8 }),
  civic_rotunda: Object.freeze({ width: [72, 92], depth: [60, 78], height: [40, 56], spacing: 105, rows: 1, slope: 3.6 }),
  skyline_tower: Object.freeze({ width: [42, 58], depth: [36, 52], height: [82, 126], spacing: 72, rows: 1, slope: 4.2 }),
  podium_tower: Object.freeze({ width: [52, 72], depth: [44, 62], height: [62, 102], spacing: 78, rows: 1, slope: 4.5 }),
  urban_midrise: Object.freeze({ width: [44, 66], depth: [38, 60], height: [30, 58], spacing: 68, rows: 2, slope: 5.0 }),
  courtyard_block: Object.freeze({ width: [62, 86], depth: [58, 82], height: [24, 44], spacing: 92, rows: 1, slope: 4.5 }),
  civic_hall: Object.freeze({ width: [62, 88], depth: [44, 68], height: [26, 42], spacing: 94, rows: 1, slope: 4.0 }),
  old_town_block: Object.freeze({ width: [38, 58], depth: [30, 48], height: [17, 29], spacing: 56, rows: 2, slope: 5.2 }),
  rowhouse: Object.freeze({ width: [30, 46], depth: [24, 36], height: [11, 18], spacing: 48, rows: 2, slope: 5.8 }),
  detached_house: Object.freeze({ width: [18, 28], depth: [17, 27], height: [8, 14], spacing: 42, rows: 1, slope: 6.5 }),
  market_block: Object.freeze({ width: [42, 62], depth: [32, 50], height: [16, 28], spacing: 64, rows: 1, slope: 5.2 }),
  village_house: Object.freeze({ width: [17, 27], depth: [17, 27], height: [8, 13], spacing: 46, rows: 1, slope: 7.0 }),
  warehouse: Object.freeze({ width: [64, 104], depth: [44, 78], height: [14, 25], spacing: 104, rows: 1, slope: 4.0 }),
  factory_hall: Object.freeze({ width: [86, 132], depth: [58, 92], height: [20, 34], spacing: 132, rows: 1, slope: 3.6 }),
  tank_cluster: Object.freeze({ width: [48, 68], depth: [46, 66], height: [20, 32], spacing: 82, rows: 1, slope: 3.8 }),
  dock_warehouse: Object.freeze({ width: [74, 116], depth: [42, 68], height: [17, 29], spacing: 112, rows: 1, slope: 3.8 }),
  barn: Object.freeze({ width: [34, 54], depth: [25, 42], height: [12, 19], spacing: 80, rows: 1, slope: 6.5 }),
  farmhouse: Object.freeze({ width: [20, 30], depth: [19, 30], height: [9, 15], spacing: 60, rows: 1, slope: 7.0 }),
});

const DEFAULT_WEIGHTS = Object.freeze({
  downtown: Object.freeze({ skyline_tower: 0.24, podium_tower: 0.36, urban_midrise: 0.28, courtyard_block: 0.12 }),
  civic: Object.freeze({ civic_hall: 0.42, civic_rotunda: 0.10, courtyard_block: 0.30, urban_midrise: 0.18 }),
  'old-quarter': Object.freeze({ old_town_block: 0.54, market_block: 0.22, rowhouse: 0.24 }),
  residential: Object.freeze({ detached_house: 0.58, rowhouse: 0.34, market_block: 0.08 }),
  'mixed-use': Object.freeze({ urban_midrise: 0.40, courtyard_block: 0.22, old_town_block: 0.22, rowhouse: 0.16 }),
  market: Object.freeze({ market_block: 0.44, old_town_block: 0.32, rowhouse: 0.24 }),
  industrial: Object.freeze({ factory_hall: 0.42, warehouse: 0.36, tank_cluster: 0.22 }),
  warehouse: Object.freeze({ warehouse: 0.58, factory_hall: 0.28, tank_cluster: 0.14 }),
  docklands: Object.freeze({ dock_warehouse: 0.62, warehouse: 0.24, tank_cluster: 0.14 }),
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
