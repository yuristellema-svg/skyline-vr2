const FALLBACK_BOUNDS = Object.freeze({
  minX: -8192,
  minZ: -8192,
  maxX: 8192,
  maxZ: 8192,
});

const CURATED = Object.freeze([
  Object.freeze({
    id: 'operational-skyline-municipal',
    label: 'SKYLINE MUNICIPAL',
    subtitle: 'Primary terrain-fitted operational runway',
    kind: 'airfield',
    fallback: [-1750.000, -500.000],
    sourceIds: ['skyline-municipal'],
  }),
  Object.freeze({
    id: 'operational-crown-ridge',
    label: 'CROWN RIDGE STRIP',
    subtitle: 'One-way mountain landing strip',
    kind: 'airfield',
    fallback: [-500.000, 1000.000],
    sourceIds: ['crown-ridge'],
  }),
  Object.freeze({
    id: 'operational-east-meadow-relief',
    label: 'EAST MEADOW RELIEF FIELD',
    subtitle: 'Emergency and relief landing field',
    kind: 'airfield',
    fallback: [-2000.000, -250.000],
    sourceIds: ['east-meadow-relief'],
  }),
  Object.freeze({
    id: 'skyline-city',
    label: 'SKYLINE CITY',
    subtitle: 'Main skyline, civic centre and old quarter',
    kind: 'urban',
    fallback: [2800, -2200],
    sourceIds: ['skyline-city', 'main-city', 'harbour-town'],
  }),
  Object.freeze({
    id: 'crown-pass',
    label: 'CROWN RANGE',
    subtitle: 'Mountain pass and high ridges',
    kind: 'mountain',
    fallback: [300, 6200],
    sourceIds: ['crown-pass', 'crown-village', 'north-crown-range'],
  }),
  Object.freeze({
    id: 'granite-pass',
    label: 'GRANITE PASS',
    subtitle: 'Highland road and granite lake',
    kind: 'mountain',
    fallback: [-5050, 5750],
    sourceIds: ['granite-pass', 'northwest-granite-uplands'],
  }),
  Object.freeze({
    id: 'aurora-lake',
    label: 'AURORA LAKE',
    subtitle: 'Lake country and market town',
    kind: 'lake',
    fallback: [-6500, 3600],
    sourceIds: ['aurora-lake', 'aurora-town', 'west-lake-country'],
  }),
  Object.freeze({
    id: 'lake-country-airfield',
    label: 'LAKE AIRFIELD',
    subtitle: 'Long western runway',
    kind: 'airfield',
    fallback: [-6200, 800],
    sourceIds: ['lake-country-airfield'],
  }),
  Object.freeze({
    id: 'ironworks',
    label: 'IRONWORKS',
    subtitle: 'Industrial plateau and reservoir',
    kind: 'industrial',
    fallback: [6260, 820],
    sourceIds: ['ironworks', 'east-iron-plateau'],
  }),
  Object.freeze({
    id: 'red-canyon',
    label: 'RED CANYON',
    subtitle: 'Deep southeast canyon route',
    kind: 'canyon',
    fallback: [6600, -3500],
    sourceIds: ['red-canyon', 'southeast-red-canyon'],
  }),
  Object.freeze({
    id: 'south-coast-airfield',
    label: 'COAST AIRFIELD',
    subtitle: 'Main asphalt runway by the sea',
    kind: 'airfield',
    fallback: [4200, -5900],
    sourceIds: ['south-coast-airfield'],
  }),
  Object.freeze({
    id: 'harbour-town',
    label: 'HARBOUR TOWN',
    subtitle: 'Coastal streets and open water',
    kind: 'urban',
    fallback: [2200, -6480],
    sourceIds: ['harbour-town'],
  }),
  Object.freeze({
    id: 'delta-port',
    label: 'DELTA PORT',
    subtitle: 'Causeway, river mouth and docks',
    kind: 'port',
    fallback: [5150, -6850],
    sourceIds: ['delta-port'],
  }),
]);

function finitePair(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
    ? [Number(value[0]), Number(value[1])]
    : null;
}

function normalizeBounds(input) {
  const source = input?.bounds ?? input;
  const bounds = {
    minX: Number(source?.minX),
    minZ: Number(source?.minZ),
    maxX: Number(source?.maxX),
    maxZ: Number(source?.maxZ),
  };

  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minZ) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxZ) ||
    bounds.minX >= bounds.maxX ||
    bounds.minZ >= bounds.maxZ
  ) {
    return { ...FALLBACK_BOUNDS };
  }

  return bounds;
}

function titleCase(id) {
  return String(id ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function collectPositionSources(manifest) {
  const sources = new Map();

  const add = (id, position) => {
    const pair = finitePair(position);
    if (!id || !pair || sources.has(id)) return;
    sources.set(id, pair);
  };

  for (const item of manifest?.navigationReferences ?? []) {
    add(item.id, item.position);
  }

  for (const item of manifest?.settlements ?? []) {
    add(item.id, item.center);
  }

  for (const item of manifest?.airfields ?? []) {
    add(item.id, item.center);
  }

  for (const item of manifest?.regions ?? []) {
    add(item.id, item.center);
  }

  for (const item of manifest?.water?.lakes ?? []) {
    add(item.id, item.center);
  }

  return sources;
}

function resolveCuratedPosition(item, sources) {
  for (const id of item.sourceIds) {
    if (sources.has(id)) return sources.get(id);
  }
  return [...item.fallback];
}

function normalizePolyline(item) {
  const points = (item?.points ?? [])
    .map(finitePair)
    .filter(Boolean);

  if (points.length < 2) return null;

  return Object.freeze({
    id: String(item.id ?? ''),
    class: String(item.class ?? item.kind ?? 'secondary'),
    widthMeters:
      Number(item.widthMeters ?? item.width) || 8,
    points: Object.freeze(points.map(point => Object.freeze(point))),
  });
}

function normalizeRegion(item) {
  const center = finitePair(item?.center);
  const radius = finitePair(item?.radius);
  if (!center || !radius) return null;

  return Object.freeze({
    id: String(item.id ?? ''),
    label: titleCase(item.id),
    kind: String(item.kind ?? ''),
    center: Object.freeze(center),
    radius: Object.freeze(radius),
  });
}

function normalizeLake(item) {
  const center = finitePair(item?.center);
  const radius = finitePair(item?.radius);
  if (!center || !radius) return null;

  return Object.freeze({
    id: String(item.id ?? ''),
    center: Object.freeze(center),
    radius: Object.freeze(radius),
  });
}

export function createNavigationMapCatalog(manifest = {}) {
  const bounds = normalizeBounds(manifest);
  const sources = collectPositionSources(manifest);

  const destinations = CURATED.map(item => {
    const position = resolveCuratedPosition(item, sources);
    return Object.freeze({
      id: item.id,
      label: item.label,
      subtitle: item.subtitle,
      kind: item.kind,
      position: Object.freeze(position),
    });
  });

  const roads = (manifest.roads ?? [])
    .map(normalizePolyline)
    .filter(Boolean);

  const rivers = (manifest.water?.rivers ?? [])
    .map(normalizePolyline)
    .filter(Boolean);

  const lakes = (manifest.water?.lakes ?? [])
    .map(normalizeLake)
    .filter(Boolean);

  const regions = (manifest.regions ?? [])
    .map(normalizeRegion)
    .filter(Boolean);

  return Object.freeze({
    version: 1,
    worldId:
      String(
        manifest.worldId ??
        manifest.format ??
        'skyline-world-core-v2'
      ),
    bounds: Object.freeze(bounds),
    legacyCoreBounds:
      Object.freeze(
        normalizeBounds(
          manifest.legacyCoreBounds ??
          {
            minX: -4096,
            minZ: -4096,
            maxX: 4096,
            maxZ: 4096,
          }
        )
      ),
    roads: Object.freeze(roads),
    rivers: Object.freeze(rivers),
    lakes: Object.freeze(lakes),
    regions: Object.freeze(regions),
    destinations: Object.freeze(destinations),
  });
}

export function worldToMapPixel(position, bounds, rect) {
  const pair = finitePair(position);
  if (!pair) return { x: rect.x, y: rect.y };

  const width = Math.max(1e-6, bounds.maxX - bounds.minX);
  const depth = Math.max(1e-6, bounds.maxZ - bounds.minZ);

  const u = (pair[0] - bounds.minX) / width;
  const v = (pair[1] - bounds.minZ) / depth;

  return {
    x: rect.x + u * rect.width,
    y: rect.y + (1 - v) * rect.height,
  };
}

export function mapPixelToWorld(point, bounds, rect) {
  const u = (point.x - rect.x) / rect.width;
  const v = 1 - (point.y - rect.y) / rect.height;

  return [
    bounds.minX + u * (bounds.maxX - bounds.minX),
    bounds.minZ + v * (bounds.maxZ - bounds.minZ),
  ];
}

export function formatNavigationDistance(meters) {
  const distance = Math.max(0, Number(meters) || 0);
  if (distance < 1000) return `${Math.round(distance)} M`;
  if (distance < 10000) return `${(distance / 1000).toFixed(1)} KM`;
  return `${Math.round(distance / 1000)} KM`;
}

export function distance2D(a, b) {
  const ax = Number(a?.x ?? a?.[0]) || 0;
  const az = Number(a?.z ?? a?.[1]) || 0;
  const bx = Number(b?.x ?? b?.[0]) || 0;
  const bz = Number(b?.z ?? b?.[1]) || 0;
  return Math.hypot(ax - bx, az - bz);
}

export function findNavigationTarget(targets, point) {
  if (!point) return null;

  let best = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const target of targets ?? []) {
    const rect = target.rect;
    if (
      point.x < rect.x ||
      point.x > rect.x + rect.width ||
      point.y < rect.y ||
      point.y > rect.y + rect.height
    ) {
      continue;
    }

    const area = rect.width * rect.height;
    if (area < bestArea) {
      best = target;
      bestArea = area;
    }
  }

  return best;
}

export const NAVIGATION_MAP_DESTINATION_COUNT = CURATED.length;
