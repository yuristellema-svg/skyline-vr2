export const SETTLEMENT_ROOT_NAME = 'skyline-settlements-v1-root';

export const QUALITY_ORDER = Object.freeze({
  phone: 0,
  low: 0,
  medium: 1,
  high: 2,
});

export const CATEGORY_ORDER = Object.freeze([
  'foundations',
  'structures',
  'roofs',
  'windows',
  'details',
  'landmarks',
]);

export const QUALITY_BUDGETS = Object.freeze({
  high: Object.freeze({
    foundations: 520,
    structures: 1180,
    roofs: 780,
    windows: 2800,
    details: 980,
    landmarks: 180,
    maxInstances: 6440,
    maxEstimatedTriangles: 920000,
    targetDrawCalls: 68,
    detailDistance: 1700,
    microDetailDistance: 1050,
  }),
  medium: Object.freeze({
    foundations: 420,
    structures: 900,
    roofs: 560,
    windows: 1680,
    details: 590,
    landmarks: 160,
    maxInstances: 4310,
    maxEstimatedTriangles: 590000,
    targetDrawCalls: 50,
    detailDistance: 1200,
    microDetailDistance: 760,
  }),
  low: Object.freeze({
    foundations: 300,
    structures: 650,
    roofs: 430,
    windows: 820,
    details: 290,
    landmarks: 140,
    maxInstances: 2520,
    maxEstimatedTriangles: 330000,
    targetDrawCalls: 34,
    detailDistance: 820,
    microDetailDistance: 470,
  }),
});

export const SETTLEMENT_KINDS = Object.freeze(new Set([
  'city',
  'suburb',
  'town',
  'village',
  'industrial',
  'farm',
  'harbour',
]));

export const DISTRICT_KINDS = Object.freeze(new Set([
  'downtown',
  'civic',
  'old-quarter',
  'residential',
  'mixed-use',
  'market',
  'industrial',
  'warehouse',
  'docklands',
  'rural',
]));

export const LANDMARK_KINDS = Object.freeze(new Set([
  'radio_tower',
  'antenna_mast',
  'aviation_beacon',
  'water_tower',
  'church_spire',
  'control_tower',
  'silo',
  'harbour_crane',
  'smokestack',
  'lighthouse',
]));

export const VISIBILITY_BANDS = Object.freeze({
  skyline: Object.freeze({ rank: 0, distanceMultiplier: Infinity }),
  district: Object.freeze({ rank: 0, distanceMultiplier: 1.45 }),
  near: Object.freeze({ rank: 1, distanceMultiplier: 1.0 }),
  micro: Object.freeze({ rank: 2, distanceMultiplier: 0.62 }),
});

export const DEFAULTS = Object.freeze({
  quality: 'high',
  phoneQuality: 'low',
  seed: 0x53a91f2d,
  nightWindowFraction: 0.19,
  roadClearance: 8,
  parcelPadding: 5,
  maxFoundationDepth: 14,
  maxTerrainDelta: 5.5,
  cellSize: 320,
});

export const TRIANGLES_BY_PRIMITIVE = Object.freeze({
  box: 12,
  gable: 26,
  wedge: 12,
  sawtooth: 40,
  cylinder: 48,
  silo: 72,
  sphere: 120,
  beacon: 80,
  mast: 48,
  cone: 36,
  truss: 24,
  crane: 32,
  water_tank: 132,
});
