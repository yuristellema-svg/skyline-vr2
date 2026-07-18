export const LIVING_AIRSPACE_VERSION = '1.0.0';

export const QUALITY_PROFILES = Object.freeze({
  phone: Object.freeze({
    id: 'phone',
    birdCount: 42,
    birdCadence: 2,
    trafficCadence: 2,
    cloudCadence: 2,
    contrailPoints: 28,
    cloudClusters: 10,
    puffsPerCluster: 4,
    maxAudioSources: 4,
    farDistance: 6200,
  }),
  balanced: Object.freeze({
    id: 'balanced',
    birdCount: 58,
    birdCadence: 1,
    trafficCadence: 1,
    cloudCadence: 2,
    contrailPoints: 42,
    cloudClusters: 12,
    puffsPerCluster: 5,
    maxAudioSources: 6,
    farDistance: 7600,
  }),
  full: Object.freeze({
    id: 'full',
    birdCount: 76,
    birdCadence: 1,
    trafficCadence: 1,
    cloudCadence: 1,
    contrailPoints: 60,
    cloudClusters: 15,
    puffsPerCluster: 6,
    maxAudioSources: 8,
    farDistance: 9200,
  }),
});

export const DEFAULT_BOUNDS = Object.freeze({
  minX: -5600,
  maxX: 5600,
  minZ: -5600,
  maxZ: 5600,
});

export const FEATURE_CATEGORIES = Object.freeze([
  'rural-birds',
  'ridge-birds',
  'water-birds',
  'soaring-birds',
  'sailplanes',
  'civil-traffic',
  'contrails',
  'clouds',
  'atmospheric-depth',
]);

export const PHONE_REQUIRED_CATEGORIES =
  Object.freeze([...FEATURE_CATEGORIES]);
