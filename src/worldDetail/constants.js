export const WORLD_DETAIL_ROOT_NAME = 'skyline-world-detail-v2-root';
export const WORLD_DETAIL_VERSION = '2.5.0';
export const DEFAULT_SEED = 0x57d2a11;
export const WATER_LEVEL = -12;

export const DEFAULT_AIRFIELDS = Object.freeze([
  Object.freeze({
    id: 'city-runway',
    name: 'SKYLINE RUNWAY',
    x: 520,
    z: 380,
    heading: 0,
    length: 900,
    width: 76,
    surface: 'paved',
  }),
  Object.freeze({
    id: 'alpine-strip',
    name: 'ALPINE GRASS STRIP',
    x: -920,
    z: -260,
    heading: -18 * Math.PI / 180,
    length: 600,
    width: 62,
    surface: 'grass',
  }),
]);

export const MATERIAL_ROLES = Object.freeze({
  facade: 'building-facade',
  roof: 'building-roof',
  actualWindow: 'actual-window',
  road: 'major-road',
  roadMarking: 'road-marking',
  concrete: 'concrete',
  masonry: 'masonry',
  steel: 'steel',
  harbour: 'harbour',
  signalHousing: 'traffic-signal-housing',
  signalLamp: 'actual-signal-lamp',
  navigationLamp: 'actual-navigation-lamp',
  cloud: 'cloud',
  windsock: 'windsock',
  vegetation: 'vegetation',
});

export const DISTRICT_IDS = Object.freeze([
  'downtown',
  'residential',
  'industrial',
]);

export const SAFETY_CONTRACT = Object.freeze({
  modifiesExistingWorld: false,
  sceneWideMaterialScans: 0,
  arbitraryCityRecolouring: false,
  wholeBuildingEmission: false,
  createsTerrain: false,
  createsMountain: false,
  createsAiTraffic: false,
  createsWildlife: false,
  createsBoostGates: false,
  maximumTransparentDrawCalls: 2,
});
