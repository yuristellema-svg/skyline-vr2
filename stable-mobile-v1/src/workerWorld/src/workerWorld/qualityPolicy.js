const POLICIES = Object.freeze({
  full: Object.freeze({
    id: 'full',
    birdFraction: 1,
    wildlifeHz: 24,
    sailplaneCount: 3,
    sailplaneHz: 20,
    aiCount: 5,
    aiNearHz: 30,
    aiFarHz: 10,
    aiFarDistance: 1800,
    cityScanInterval: 1.4,
    litWindowFraction: 0.42,
    gatePulse: true,
    contrails: true,
    contrailCadence: 1,
  }),
  balanced: Object.freeze({
    id: 'balanced',
    birdFraction: 0.72,
    wildlifeHz: 18,
    sailplaneCount: 3,
    sailplaneHz: 15,
    aiCount: 4,
    aiNearHz: 24,
    aiFarHz: 8,
    aiFarDistance: 1500,
    cityScanInterval: 1.8,
    litWindowFraction: 0.36,
    gatePulse: true,
    contrails: true,
    contrailCadence: 2,
  }),
  reduced: Object.freeze({
    id: 'reduced',
    birdFraction: 0.46,
    wildlifeHz: 12,
    sailplaneCount: 2,
    sailplaneHz: 10,
    aiCount: 3,
    aiNearHz: 18,
    aiFarHz: 5,
    aiFarDistance: 1200,
    cityScanInterval: 2.6,
    litWindowFraction: 0.30,
    gatePulse: false,
    contrails: true,
    contrailCadence: 4,
  }),
  minimal: Object.freeze({
    id: 'minimal',
    birdFraction: 0.25,
    wildlifeHz: 8,
    sailplaneCount: 1,
    sailplaneHz: 7,
    aiCount: 2,
    aiNearHz: 12,
    aiFarHz: 4,
    aiFarDistance: 900,
    cityScanInterval: 4,
    litWindowFraction: 0.24,
    gatePulse: false,
    contrails: false,
    contrailCadence: 12,
  }),
});

const ALIASES = Object.freeze({
  high: 'full',
  ultra: 'full',
  medium: 'balanced',
  mobile: 'reduced',
  low: 'minimal',
  phone: 'minimal',
});

export function normalizeQuality(level) {
  const requested = String(level?.id ?? level ?? 'balanced').toLowerCase();
  const normalized = ALIASES[requested] || requested;
  return POLICIES[normalized] || POLICIES.balanced;
}

export function qualityLevels() {
  return Object.keys(POLICIES);
}
