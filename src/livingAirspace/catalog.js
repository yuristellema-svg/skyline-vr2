import {
  DEFAULT_BOUNDS,
  FEATURE_CATEGORIES,
} from './constants.js';

const freezeRoute = route =>
  Object.freeze({
    ...route,
    points: Object.freeze(
      route.points.map(point =>
        Object.freeze([...point])
      )
    ),
  });

export const DEFAULT_BIRD_HABITATS = Object.freeze([
  Object.freeze({
    id: 'south-rural',
    category: 'rural-birds',
    center: [-1050, 120, 980],
    radiusX: 760,
    radiusZ: 520,
    altitude: [48, 105],
    speed: 0.020,
    countShare: 0.30,
    color: 0x323739,
  }),
  Object.freeze({
    id: 'north-ridge',
    category: 'ridge-birds',
    center: [1520, 430, -1560],
    radiusX: 920,
    radiusZ: 660,
    altitude: [90, 210],
    speed: 0.014,
    countShare: 0.25,
    color: 0x2f3437,
  }),
  Object.freeze({
    id: 'lake-waterbirds',
    category: 'water-birds',
    center: [-760, 76, -520],
    radiusX: 690,
    radiusZ: 440,
    altitude: [18, 65],
    speed: 0.023,
    countShare: 0.25,
    color: 0xc7c9c6,
  }),
  Object.freeze({
    id: 'high-soarers',
    category: 'soaring-birds',
    center: [420, 560, -120],
    radiusX: 1380,
    radiusZ: 1060,
    altitude: [180, 360],
    speed: 0.009,
    countShare: 0.20,
    color: 0x202629,
  }),
]);

export const DEFAULT_TRAFFIC_ROUTES = Object.freeze([
  freezeRoute({
    id: 'city-commuter',
    category: 'civil-traffic',
    type: 'commuter',
    color: 0xe5e1d7,
    accent: 0xb6463a,
    speed: 0.018,
    phase: 0.04,
    audio: 0.72,
    contrail: false,
    points: [
      [520, 112, 520],
      [520, 220, -120],
      [1040, 360, -980],
      [1820, 440, -1820],
      [2580, 460, -520],
      [1880, 350, 760],
      [980, 210, 980],
    ],
  }),
  freezeRoute({
    id: 'alpine-sailplane',
    category: 'sailplanes',
    type: 'sailplane',
    color: 0xe7e5df,
    accent: 0x365b78,
    speed: 0.0105,
    phase: 0.38,
    audio: 0.05,
    contrail: false,
    points: [
      [-920, 180, -260],
      [-1420, 410, -980],
      [-760, 720, -1780],
      [420, 860, -1680],
      [1120, 650, -720],
      [180, 420, 180],
    ],
  }),
  freezeRoute({
    id: 'coastal-floatplane',
    category: 'civil-traffic',
    type: 'floatplane',
    color: 0xd9d1bd,
    accent: 0x42626d,
    speed: 0.014,
    phase: 0.63,
    audio: 0.58,
    contrail: false,
    points: [
      [-1600, 95, 1600],
      [-2400, 140, 420],
      [-2200, 170, -1040],
      [-900, 130, -1840],
      [180, 120, -920],
      [-420, 105, 420],
    ],
  }),
  freezeRoute({
    id: 'high-transit-east',
    category: 'civil-traffic',
    type: 'transport',
    color: 0xbfc8cb,
    accent: 0x30383c,
    speed: 0.012,
    phase: 0.79,
    audio: 0.44,
    contrail: true,
    points: [
      [-3100, 980, 1600],
      [-900, 1080, 520],
      [1400, 1120, -640],
      [3300, 1040, -1740],
      [2400, 1010, 1520],
      [200, 960, 2420],
    ],
  }),
  freezeRoute({
    id: 'training-circuit',
    category: 'civil-traffic',
    type: 'trainer',
    color: 0xe4d9bd,
    accent: 0xc16a32,
    speed: 0.022,
    phase: 0.19,
    audio: 0.62,
    contrail: false,
    points: [
      [520, 118, 420],
      [980, 160, 180],
      [1180, 220, -420],
      [640, 260, -980],
      [-120, 220, -720],
      [-280, 160, 40],
    ],
  }),
  freezeRoute({
    id: 'western-glider',
    category: 'sailplanes',
    type: 'sailplane',
    color: 0xf0eee8,
    accent: 0xa64238,
    speed: 0.0088,
    phase: 0.91,
    audio: 0.03,
    contrail: false,
    points: [
      [-2500, 620, 600],
      [-1900, 940, -580],
      [-800, 870, -1220],
      [-240, 610, -260],
      [-1100, 520, 980],
    ],
  }),
]);

export const DEFAULT_CLOUD_REGIONS = Object.freeze([
  Object.freeze({
    id: 'lower-cumulus',
    altitude: [420, 780],
    scale: [160, 330],
    wind: [2.8, 0.55],
    opacity: 0.42,
  }),
  Object.freeze({
    id: 'upper-broken',
    altitude: [920, 1420],
    scale: [260, 520],
    wind: [5.2, 1.1],
    opacity: 0.28,
  }),
]);

export function createDefaultLivingAirspaceCatalog() {
  return Object.freeze({
    version: 1,
    bounds: Object.freeze({ ...DEFAULT_BOUNDS }),
    birdHabitats: DEFAULT_BIRD_HABITATS,
    trafficRoutes: DEFAULT_TRAFFIC_ROUTES,
    cloudRegions: DEFAULT_CLOUD_REGIONS,
    requiredCategories: FEATURE_CATEGORIES,
  });
}

export function validateLivingAirspaceCatalog(catalog) {
  const errors = [];
  const categories = new Set();

  if (!catalog || typeof catalog !== 'object') {
    return {
      valid: false,
      errors: ['catalog must be an object'],
      categories: [],
    };
  }

  const bounds = catalog.bounds;
  if (
    !bounds ||
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minZ) ||
    !Number.isFinite(bounds.maxZ) ||
    bounds.minX >= bounds.maxX ||
    bounds.minZ >= bounds.maxZ
  ) {
    errors.push('catalog bounds are invalid');
  }

  for (const habitat of catalog.birdHabitats ?? []) {
    categories.add(habitat.category);
    if (!habitat.id) errors.push('bird habitat is missing id');
    if (!Array.isArray(habitat.center) || habitat.center.length !== 3) {
      errors.push(`bird habitat ${habitat.id ?? '?'} has invalid center`);
    }
  }

  for (const route of catalog.trafficRoutes ?? []) {
    categories.add(route.category);
    if (!route.id) errors.push('traffic route is missing id');
    if (!Array.isArray(route.points) || route.points.length < 3) {
      errors.push(`traffic route ${route.id ?? '?'} needs at least three points`);
    }
  }

  for (const region of catalog.cloudRegions ?? []) {
    categories.add('clouds');
    if (!region.id) errors.push('cloud region is missing id');
  }

  for (const required of catalog.requiredCategories ?? []) {
    if (
      required !== 'contrails' &&
      required !== 'atmospheric-depth' &&
      !categories.has(required)
    ) {
      errors.push(`required category is absent: ${required}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    categories: [...categories].sort(),
  };
}
