export const SETTLEMENT_ROOT_NAME = 'skyline-settlements-v1-root';

export const QUALITY_ORDER = Object.freeze({
  phone: 0,
  low: 0,
  medium: 1,
  high: 2,
});

export const CATEGORY_ORDER = Object.freeze([
  'publicSpaces',
  'foundations',
  'structures',
  'roofs',
  'windows',
  'details',
  'landmarks',
]);

/*
 * The visual pass spends the phone budget on primary massing and authored
 * public space before windows or rooftop clutter. A city must remain legible
 * with windows disabled.
 */
export const QUALITY_BUDGETS = Object.freeze({
  high: Object.freeze({
    publicSpaces: 180,
    foundations: 540,
    structures: 1360,
    roofs: 920,
    windows: 2500,
    details: 760,
    landmarks: 220,
    maxInstances: 6480,
    maxEstimatedTriangles: 980000,
    targetDrawCalls: 72,
    detailDistance: 1750,
    microDetailDistance: 1050,
  }),
  medium: Object.freeze({
    publicSpaces: 180,
    foundations: 460,
    structures: 1080,
    roofs: 710,
    windows: 1320,
    details: 430,
    landmarks: 200,
    maxInstances: 4380,
    maxEstimatedTriangles: 650000,
    targetDrawCalls: 64,
    detailDistance: 1250,
    microDetailDistance: 760,
  }),
  low: Object.freeze({
    publicSpaces: 180,
    foundations: 360,
    structures: 820,
    roofs: 570,
    windows: 420,
    details: 180,
    landmarks: 180,
    maxInstances: 2710,
    maxEstimatedTriangles: 390000,
    targetDrawCalls: 46,
    detailDistance: 850,
    microDetailDistance: 460,
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

export const PUBLIC_SPACE_KINDS = Object.freeze(new Set([
  'civic-square',
  'market-square',
  'park',
  'courtyard',
  'promenade',
  'loading-yard',
  'rail-corridor',
  'town-green',
  'waterfront-gap',
  'service-corridor',
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
  nightWindowFraction: 0.16,
  roadClearance: 10,
  parcelPadding: 7,
  maxFoundationDepth: 14,
  maxTerrainDelta: 5.5,
  cellSize: 320,
});

export const TRIANGLES_BY_PRIMITIVE = Object.freeze({
  box: 12,
  gable: 26,
  wedge: 24,
  sawtooth: 48,
  cylinder: 48,
  octagon: 64,
  tapered: 48,
  slab_taper: 36,
  dome: 144,
  barrel: 72,
  stepped: 72,
  gateway: 96,
  silo: 72,
  sphere: 120,
  beacon: 80,
  mast: 48,
  cone: 36,
  truss: 48,
  crane: 64,
  water_tank: 132,
});
