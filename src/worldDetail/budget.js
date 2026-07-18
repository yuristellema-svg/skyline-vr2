const QUALITY_ALIASES = Object.freeze({
  auto: 'medium',
  ultra: 'high',
  high: 'high',
  balanced: 'medium',
  medium: 'medium',
  low: 'low',
  phone: 'low',
});

export const DETAIL_BUDGETS = Object.freeze({
  high: Object.freeze({
    id: 'high',
    cityWindowFraction: 0.18,
    litWindowFraction: 0.40,
    rooftopFraction: 0.82,
    residentialBuildings: 28,
    industrialBuildings: 24,
    roadSegmentFraction: 1,
    roadMarkingFraction: 1,
    bridgeCount: 5,
    bridgeDetailFraction: 1,
    harbourPieceFraction: 1,
    airfieldDetailFraction: 1,
    trafficHintCount: 12,
    nearCloudClusters: 12,
    farCloudClusters: 8,
    cityDistance: 4200,
    windowDistance: 2600,
    minorDetailDistance: 1800,
    updateInterval: 0.20,
  }),
  medium: Object.freeze({
    id: 'medium',
    cityWindowFraction: 0.10,
    litWindowFraction: 0.34,
    rooftopFraction: 0.58,
    residentialBuildings: 20,
    industrialBuildings: 16,
    roadSegmentFraction: 0.76,
    roadMarkingFraction: 0.58,
    bridgeCount: 4,
    bridgeDetailFraction: 0.72,
    harbourPieceFraction: 0.72,
    airfieldDetailFraction: 0.72,
    trafficHintCount: 8,
    nearCloudClusters: 8,
    farCloudClusters: 6,
    cityDistance: 3500,
    windowDistance: 2100,
    minorDetailDistance: 1450,
    updateInterval: 0.28,
  }),
  low: Object.freeze({
    id: 'low',
    cityWindowFraction: 0.035,
    litWindowFraction: 0.25,
    rooftopFraction: 0.28,
    residentialBuildings: 10,
    industrialBuildings: 8,
    roadSegmentFraction: 0.46,
    roadMarkingFraction: 0.22,
    bridgeCount: 3,
    bridgeDetailFraction: 0.38,
    harbourPieceFraction: 0.42,
    airfieldDetailFraction: 0.46,
    trafficHintCount: 4,
    nearCloudClusters: 4,
    farCloudClusters: 3,
    cityDistance: 2800,
    windowDistance: 1350,
    minorDetailDistance: 900,
    updateInterval: 0.42,
  }),
});

export function normalizeQuality(value = 'auto') {
  const normalized = String(value || 'auto').trim().toLowerCase();
  return QUALITY_ALIASES[normalized] || 'medium';
}

export function resolveDetailBudget(quality = 'auto', phone = false) {
  return DETAIL_BUDGETS[phone ? 'low' : normalizeQuality(quality)];
}

export function lowerQuality(value) {
  const id = normalizeQuality(value);
  return id === 'high' ? 'medium' : 'low';
}

export function higherQuality(value) {
  const id = normalizeQuality(value);
  return id === 'low' ? 'medium' : 'high';
}
