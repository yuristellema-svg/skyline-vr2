import {
  createSeededRandom,
  localCoordinates,
  nearestPointOnPolyline,
} from './math.js';

const DEG = Math.PI / 180;

function roadDistance(index, x, z) {
  let nearest = Number.POSITIVE_INFINITY;
  for (const road of index.roads.values()) nearest = Math.min(nearest, nearestPointOnPolyline(x, z, road.compiled).distance);
  return nearest;
}

function archetypesFor(kind) {
  if (kind.includes('industrial') || kind.includes('port')) return ['warehouse', 'shed', 'tank-house', 'office'];
  if (kind.includes('mountain')) return ['chalet', 'service-shed', 'stone-house'];
  if (kind.includes('coastal')) return ['gable-house', 'row-house', 'boathouse'];
  if (kind.includes('farm')) return ['farmhouse', 'barn', 'equipment-shed'];
  return ['gable-house', 'row-house', 'shop-house', 'civic'];
}

function dimensionsFor(archetype, random, storeys) {
  if (archetype === 'warehouse') return [28 + random() * 34, 7 + random() * 7, 24 + random() * 30];
  if (archetype === 'shed' || archetype === 'service-shed' || archetype === 'equipment-shed') return [16 + random() * 18, 5 + random() * 4, 13 + random() * 16];
  if (archetype === 'barn' || archetype === 'boathouse') return [19 + random() * 22, 7 + random() * 5, 15 + random() * 20];
  if (archetype === 'tank-house') return [18 + random() * 12, 9 + random() * 8, 18 + random() * 12];
  if (archetype === 'office' || archetype === 'civic') return [18 + random() * 17, 4.1 * storeys + 2, 15 + random() * 14];
  if (archetype === 'row-house' || archetype === 'shop-house') return [14 + random() * 12, 4.0 * storeys + 1.8, 12 + random() * 10];
  return [13 + random() * 14, 4.0 * storeys + 1.5, 11 + random() * 12];
}

export function compileSettlementCatalog(heightModel) {
  const { manifest, index } = heightModel;
  const settlements = [];
  const allLots = [];
  for (const settlement of manifest.settlements) {
    const random = createSeededRandom(manifest.seed ^ settlement.id.split('').reduce((sum, char) => sum + char.charCodeAt(0) * 7919, 0));
    const heading = (settlement.streetHeadingDegrees || 0) * DEG;
    const cosine = Math.cos(heading);
    const sine = Math.sin(heading);
    const cellX = settlement.kind.includes('industrial') || settlement.kind.includes('port') ? 72 : 48;
    const cellZ = settlement.kind.includes('industrial') || settlement.kind.includes('port') ? 66 : 44;
    const columns = Math.max(3, Math.floor(settlement.radius[0] * 2 / cellX));
    const rows = Math.max(3, Math.floor(settlement.radius[1] * 2 / cellZ));
    const candidates = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const localX = (column + 0.5 - columns * 0.5) * cellX + (random() - 0.5) * cellX * 0.24;
        const localZ = (row + 0.5 - rows * 0.5) * cellZ + (random() - 0.5) * cellZ * 0.24;
        const normalized = (localX / settlement.radius[0]) ** 2 + (localZ / settlement.radius[1]) ** 2;
        if (normalized > 0.94) continue;
        const x = settlement.center[0] + localX * cosine + localZ * sine;
        const z = settlement.center[1] - localX * sine + localZ * cosine;
        const water = heightModel.waterSurfaceAt(x, z);
        if (water != null) continue;
        const slope = heightModel.sampleSlope(x, z, 14);
        if (!Number.isFinite(slope) || slope > (settlement.kind.includes('mountain') ? 0.30 : 0.20)) continue;
        const nearestRoad = roadDistance(index, x, z);
        if (nearestRoad < Math.max(8, settlement.roadSetbackMeters || 18) * 0.45) continue;
        const storeys = 1 + Math.floor(random() * settlement.maximumStoreys);
        const archetypes = archetypesFor(settlement.kind);
        const archetype = archetypes[Math.floor(random() * archetypes.length) % archetypes.length];
        const dimensions = dimensionsFor(archetype, random, storeys);
        candidates.push({
          id: `${settlement.id}-lot-${candidates.length}`,
          settlementId: settlement.id,
          districtId: settlement.districts?.[Math.floor(random() * settlement.districts.length)]?.id || `${settlement.id}-core`,
          position: [x, heightModel.sampleHeight(x, z), z],
          headingDegrees: settlement.streetHeadingDegrees + (random() - 0.5) * 12,
          footprintMeters: [dimensions[0], dimensions[2]],
          heightMeters: dimensions[1],
          storeys,
          archetype,
          workerReplaceable: true,
          roadDistanceMeters: nearestRoad,
          slope,
          priority: random(),
        });
      }
    }
    let fallbackAttempts = 0;
    while (candidates.length < settlement.buildingCount && fallbackAttempts < settlement.buildingCount * 80) {
      fallbackAttempts += 1;
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 0.90;
      const localX = Math.cos(angle) * settlement.radius[0] * radius;
      const localZ = Math.sin(angle) * settlement.radius[1] * radius;
      const x = settlement.center[0] + localX * cosine + localZ * sine;
      const z = settlement.center[1] - localX * sine + localZ * cosine;
      if (heightModel.waterSurfaceAt(x, z) != null) continue;
      const slope = heightModel.sampleSlope(x, z, 14);
      if (!Number.isFinite(slope) || slope > (settlement.kind.includes('mountain') ? 0.38 : 0.28)) continue;
      const nearestRoad = roadDistance(index, x, z);
      if (nearestRoad < 7) continue;
      if (candidates.some(item => Math.hypot(item.position[0] - x, item.position[2] - z) < 18)) continue;
      const storeys = 1 + Math.floor(random() * settlement.maximumStoreys);
      const archetypes = archetypesFor(settlement.kind);
      const archetype = archetypes[Math.floor(random() * archetypes.length) % archetypes.length];
      const dimensions = dimensionsFor(archetype, random, storeys);
      candidates.push({
        id: `${settlement.id}-lot-${candidates.length}`,
        settlementId: settlement.id,
        districtId: settlement.districts?.[Math.floor(random() * settlement.districts.length)]?.id || `${settlement.id}-core`,
        position: [x, heightModel.sampleHeight(x, z), z],
        headingDegrees: settlement.streetHeadingDegrees + (random() - 0.5) * 18,
        footprintMeters: [dimensions[0], dimensions[2]],
        heightMeters: dimensions[1],
        storeys,
        archetype,
        workerReplaceable: true,
        roadDistanceMeters: nearestRoad,
        slope,
        priority: 1 + random(),
      });
    }
    candidates.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    const lots = candidates.slice(0, settlement.buildingCount);
    settlements.push({
      id: settlement.id,
      kind: settlement.kind,
      center: settlement.center,
      radius: settlement.radius,
      roadId: settlement.roadId,
      layoutPattern: settlement.layoutPattern,
      reservedWorkerZone: true,
      lots,
    });
    allLots.push(...lots);
  }
  return Object.freeze({ settlements: Object.freeze(settlements), lots: Object.freeze(allLots) });
}

export function compileAirfieldCatalog(heightModel) {
  return Object.freeze(heightModel.manifest.airfields.map(airfield => Object.freeze({
    ...airfield,
    landing: heightModel.index.landingCatalog.find(entry => entry.airfieldId === airfield.id),
    approachCorridors: Object.freeze([-1, 1].map(direction => Object.freeze({
      direction,
      headingDegrees: airfield.headingDegrees + (direction < 0 ? 180 : 0),
      lengthMeters: airfield.approachLengthMeters,
      halfWidthMeters: airfield.clearWidthMeters * 0.5,
      terrainConnected: true,
    }))),
  })));
}

export function pointInAirfieldSite(x, z, airfield) {
  const local = localCoordinates(x, z, airfield.center, airfield.headingDegrees);
  const halfLength = airfield.runwayLengthMeters * 0.5 + airfield.site.overrunMeters;
  const halfWidth = Math.max(airfield.clearWidthMeters * 0.5, airfield.runwayWidthMeters * 0.5 + airfield.site.shoulderMeters);
  return Math.abs(local.forward) <= halfLength && Math.abs(local.right) <= halfWidth;
}
