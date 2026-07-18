import {
  SAMPLE_WORLD_MANIFEST,
} from '../settlements/sampleCatalog.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectPoints(manifest) {
  const points = [];
  const add = point => {
    if (
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
    ) {
      points.push(point);
    }
  };

  for (const road of manifest.roads ?? []) {
    for (const point of road.points ?? []) add(point);
  }
  for (const shoreline of manifest.shorelines ?? []) {
    for (const point of shoreline.points ?? []) add(point);
  }
  for (const exclusion of manifest.exclusions ?? []) {
    for (const point of exclusion.footprint ?? []) add(point);
  }
  for (const settlement of manifest.settlements ?? []) {
    for (const point of settlement.footprint ?? []) add(point);
    for (const district of settlement.districts ?? []) {
      for (const point of district.footprint ?? []) add(point);
    }
    for (const space of settlement.publicSpaces ?? []) {
      add(space.anchor);
    }
    for (const site of settlement.signatureSites ?? []) {
      add(site.anchor);
    }
    add(settlement.heightProfile?.anchor);
  }
  for (const landmark of manifest.landmarks ?? []) {
    add(landmark.anchor);
  }

  return points;
}

function makeTransform(source) {
  const points = collectPoints(source);
  const xs = points.map(point => point[0]);
  const zs = points.map(point => point[1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxZ - minZ);

  /*
   * Keep the authored city kit close enough to reach from the original core,
   * while spreading its towns, harbour, farms and industry across the new
   * south/east regions. The shape is preserved rather than randomly scattered.
   */
  const scale = Math.min(1.55, 10600 / Math.max(width, depth));
  const sourceCenterX = (minX + maxX) * 0.5;
  const sourceCenterZ = (minZ + maxZ) * 0.5;
  const targetCenterX = 2450;
  const targetCenterZ = -2050;

  return point => [
    targetCenterX + (point[0] - sourceCenterX) * scale,
    targetCenterZ + (point[1] - sourceCenterZ) * scale,
  ];
}

function transformPoint(value, transform) {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    return value;
  }
  return transform(value);
}

function transformPolyline(items, transform) {
  for (const item of items ?? []) {
    item.points =
      (item.points ?? []).map(point =>
        transformPoint(point, transform)
      );
    if (Number.isFinite(item.width)) item.width *= 1.12;
  }
}

function transformPolygonItems(items, key, transform) {
  for (const item of items ?? []) {
    item[key] =
      (item[key] ?? []).map(point =>
        transformPoint(point, transform)
      );
  }
}

function transformedConnectorRoads(worldManifest) {
  const byId = new Map(
    (worldManifest?.roads ?? []).map(road => [
      road.id,
      road,
    ])
  );

  const eastern =
    byId.get('eastern-trunk') ??
    worldManifest?.roads?.[0];

  const coastal =
    byId.get('coastal-transit') ??
    worldManifest?.roads?.[1];

  const roads = [];

  if (eastern?.points?.length >= 2) {
    roads.push({
      id: 'visible-world-eastern-connector',
      class: 'primary',
      width: Number(eastern.widthMeters) || 15,
      points: eastern.points.map(point => [...point]),
    });
  }

  if (coastal?.points?.length >= 2) {
    roads.push({
      id: 'visible-world-coastal-connector',
      class: 'secondary',
      width: Number(coastal.widthMeters) || 11,
      points: coastal.points.map(point => [...point]),
    });
  }

  return roads;
}

export function createWorldSettlementManifest(
  worldManifest = {}
) {
  const manifest = clone(SAMPLE_WORLD_MANIFEST);
  const transform = makeTransform(manifest);

  manifest.worldId =
    'skyline-visible-world-settlements-v1';
  manifest.seed =
    Number(worldManifest.seed) || manifest.seed;
  manifest.waterLevel =
    Number(
      worldManifest.water?.coastline?.surfaceMeters ??
      worldManifest.waterLevel ??
      manifest.waterLevel
    ) || 0;

  transformPolyline(manifest.roads, transform);
  transformPolyline(manifest.shorelines, transform);
  transformPolygonItems(
    manifest.exclusions,
    'footprint',
    transform,
  );

  for (const settlement of manifest.settlements ?? []) {
    settlement.footprint =
      settlement.footprint.map(point =>
        transformPoint(point, transform)
      );

    for (const district of settlement.districts ?? []) {
      district.footprint =
        district.footprint.map(point =>
          transformPoint(point, transform)
        );
    }

    for (const space of settlement.publicSpaces ?? []) {
      space.anchor =
        transformPoint(space.anchor, transform);
      space.width *= 1.10;
      space.depth *= 1.10;
    }

    for (const site of settlement.signatureSites ?? []) {
      site.anchor =
        transformPoint(site.anchor, transform);
      site.width *= 1.08;
      site.depth *= 1.08;
      site.height *= 1.14;
    }

    if (settlement.heightProfile?.anchor) {
      settlement.heightProfile.anchor =
        transformPoint(
          settlement.heightProfile.anchor,
          transform,
        );
      settlement.heightProfile.radius *= 1.10;
      settlement.heightProfile.maxScale *= 1.08;
    }
  }

  for (const landmark of manifest.landmarks ?? []) {
    landmark.anchor =
      transformPoint(landmark.anchor, transform);
    landmark.height *= 1.08;
  }

  /*
   * Preserve the complete authored local road system and add two real
   * World Core connector corridors. These are authoritative inputs to
   * the settlement planner and are rendered by LocalInfrastructureSystem.
   */
  manifest.roads.push(
    ...transformedConnectorRoads(worldManifest)
  );

  return Object.freeze(manifest);
}

export function summarizeWorldSettlementManifest(manifest) {
  return Object.freeze({
    worldId: manifest.worldId,
    roads: manifest.roads.length,
    shorelines: manifest.shorelines.length,
    exclusions: manifest.exclusions.length,
    settlements: manifest.settlements.length,
    districts:
      manifest.settlements.reduce(
        (sum, item) =>
          sum + (item.districts?.length ?? 0),
        0,
      ),
    publicSpaces:
      manifest.settlements.reduce(
        (sum, item) =>
          sum + (item.publicSpaces?.length ?? 0),
        0,
      ),
    signatureSites:
      manifest.settlements.reduce(
        (sum, item) =>
          sum + (item.signatureSites?.length ?? 0),
        0,
      ),
    landmarks: manifest.landmarks.length,
  });
}
