import { makeDescriptor } from './descriptor.js';
import { nearestPolylineProjection, rotate2, samplePolyline } from './math.js';

function readHeight(sampleHeight, x, z) {
  const result = sampleHeight(x, z);
  const value = typeof result === 'number' ? result : result?.height;
  if (!Number.isFinite(value)) throw new TypeError(`sampleHeight returned invalid height at ${x}, ${z}`);
  return value;
}

function nearestRoadLink(point, settlement, indexed) {
  let best = null;
  for (const roadRef of settlement.roadRefs) {
    const road = indexed.roads.get(roadRef);
    const projection = road ? nearestPolylineProjection(point, road.points) : null;
    if (projection && (!best || projection.distance < best.distance)) best = { ...projection, roadRef };
  }
  return best;
}

function groupedFractions(groupSizes) {
  const groups = Array.isArray(groupSizes) && groupSizes.length ? groupSizes : [2, 2, 1];
  const totalModules = groups.reduce((sum, value) => sum + Math.max(0, Math.floor(value)), 0);
  const gapWeight = Math.max(0, groups.length - 1) * 1.35;
  const totalWeight = totalModules + gapWeight;
  const values = [];
  let cursor = 0;
  for (let group = 0; group < groups.length; group += 1) {
    const count = Math.max(0, Math.floor(groups[group]));
    for (let index = 0; index < count; index += 1) {
      values.push({ fraction: (cursor + index + 0.5) / totalWeight, group, index });
    }
    cursor += count + (group < groups.length - 1 ? 1.35 : 0);
  }
  return values;
}

function descriptorBase(settlement, locationId, meta) {
  return {
    settlementId: settlement.id,
    locationId,
    districtId: `${settlement.id}:dock-edge`,
    meta,
  };
}

export function buildHarbourDescriptors({ settlement, indexed, sampleHeight, random }) {
  if (settlement.kind !== 'harbour') return [];
  const shoreline = indexed.shorelines.get(settlement.shorelineRef);
  const waterSide = shoreline.waterSide === -1 ? -1 : 1;
  const [t0, t1] = settlement.shorelineSpan;
  const requested = settlement.pierCount ?? 5;
  const layout = groupedFractions(settlement.berthGroups).slice(0, requested);
  const descriptors = [];

  for (let moduleIndex = 0; moduleIndex < layout.length; moduleIndex += 1) {
    const module = layout[moduleIndex];
    const t = t0 + (t1 - t0) * module.fraction;
    const sample = samplePolyline(shoreline.points, t);
    if (!sample) continue;
    const outward = sample.heading + waterSide * Math.PI * 0.5;
    const isCargoBerth = module.group < 2;
    const pierLength = isCargoBerth ? 82 + random() * 18 : 58 + random() * 12;
    const pierWidth = isCargoBerth ? 15 + random() * 3 : 11 + random() * 2;
    const [offsetX, offsetZ] = rotate2(0, pierLength * 0.48 * waterSide, sample.heading);
    const x = sample.point[0] + offsetX;
    const z = sample.point[1] + offsetZ;
    const shoreY = readHeight(sampleHeight, sample.point[0], sample.point[1]);
    const deckY = Math.max(indexed.manifest.waterLevel + 3.0, shoreY + 0.55);
    const road = nearestRoadLink(sample.point, settlement, indexed);
    const commonMeta = {
      shorelineRef: settlement.shorelineRef,
      shorelineT: t,
      roadRef: road?.roadRef ?? settlement.roadRefs[0],
      intentionalOverWater: true,
      exactShorelineAnchor: sample.point,
      berthGroup: module.group,
      berthIndex: module.index,
      functionalRole: isCargoBerth ? 'cargo-berth' : 'service-berth',
    };
    const locationId = `${settlement.id}:berth:${module.group}:${module.index}`;
    descriptors.push(makeDescriptor({
      id: `${locationId}:deck`, ...descriptorBase(settlement, locationId, commonMeta),
      category: 'structures', primitive: 'box', role: 'harbour-cargo-pier',
      x, y: deckY, z, width: pierWidth, height: 1.5, depth: pierLength, yaw: outward,
      color: '#46545a', surface: 'dock', qualityRank: 0, priority: 110,
      visibilityBand: 'district', collidable: true, essential: true,
    }));

    const headOffset = rotate2(0, pierLength * 0.44, outward);
    descriptors.push(makeDescriptor({
      id: `${locationId}:head`, ...descriptorBase(settlement, locationId, commonMeta),
      category: 'structures', primitive: 'box', role: 'harbour-berth-head',
      x: x + headOffset[0], y: deckY + 0.2, z: z + headOffset[1],
      width: pierWidth * 1.7, height: 1.5, depth: 12, yaw: outward,
      color: '#4d5b60', surface: 'dock', qualityRank: 0, priority: 102,
      visibilityBand: 'district', collidable: true, essential: true,
    }));

    const pylonCount = 4;
    for (let pylon = 0; pylon < pylonCount; pylon += 1) {
      const along = -pierLength * 0.36 + (pylon / (pylonCount - 1)) * pierLength * 0.72;
      for (const side of [-1, 1]) {
        const local = rotate2(side * pierWidth * 0.40, along, outward);
        const pylonHeight = Math.max(5, deckY - indexed.manifest.waterLevel + 3);
        descriptors.push(makeDescriptor({
          id: `${locationId}:pylon:${pylon}:${side}`, ...descriptorBase(settlement, locationId, commonMeta),
          category: 'details', primitive: 'cylinder', role: 'harbour-pylon',
          x: x + local[0], y: indexed.manifest.waterLevel + pylonHeight * 0.5 - 1.3, z: z + local[1],
          width: 0.9, height: pylonHeight, depth: 0.9, yaw: 0,
          color: '#364247', surface: 'dock', qualityRank: pylon < 2 ? 1 : 2, priority: 28,
          visibilityBand: 'micro', collidable: false,
        }));
      }
    }

    if (isCargoBerth && module.index === 0) {
      const craneOffset = rotate2(-pierWidth * 0.12, -pierLength * 0.10, outward);
      descriptors.push(makeDescriptor({
        id: `${locationId}:gantry`, ...descriptorBase(settlement, locationId, commonMeta),
        category: 'landmarks', primitive: 'crane', role: 'harbour-gantry-crane',
        x: x + craneOffset[0], y: deckY + 20, z: z + craneOffset[1],
        width: 28, height: 40 + module.group * 5, depth: 10, yaw: outward,
        color: module.group === 0 ? '#8b6848' : '#66737a', surface: 'metal',
        qualityRank: 0, priority: 118, visibilityBand: 'skyline',
        collidable: true, essential: true,
      }));
    }
  }

  const wallSamples = 10;
  for (let index = 0; index < wallSamples; index += 1) {
    const tA = t0 + (t1 - t0) * (index / wallSamples);
    const tB = t0 + (t1 - t0) * ((index + 1) / wallSamples);
    const a = samplePolyline(shoreline.points, tA);
    const b = samplePolyline(shoreline.points, tB);
    if (!a || !b) continue;
    const x = (a.point[0] + b.point[0]) * 0.5;
    const z = (a.point[1] + b.point[1]) * 0.5;
    const length = Math.hypot(b.point[0] - a.point[0], b.point[1] - a.point[1]);
    const yaw = Math.atan2(b.point[1] - a.point[1], b.point[0] - a.point[0]);
    const shoreY = Math.max(readHeight(sampleHeight, a.point[0], a.point[1]), readHeight(sampleHeight, b.point[0], b.point[1]));
    descriptors.push(makeDescriptor({
      id: `${settlement.id}:seawall:${index}`, settlementId: settlement.id,
      locationId: `${settlement.id}:seawall`, districtId: `${settlement.id}:dock-edge`,
      category: 'foundations', primitive: 'box', role: 'harbour-seawall',
      x, y: (shoreY + indexed.manifest.waterLevel) * 0.5, z,
      width: length + 1.2, height: Math.max(2, shoreY - indexed.manifest.waterLevel + 1), depth: 3.4, yaw,
      color: '#59615f', surface: 'foundation', qualityRank: 0, priority: 78,
      visibilityBand: 'district', collidable: true, essential: true,
      meta: { shorelineRef: settlement.shorelineRef, shorelineSpan: [tA, tB], intentionalOverWater: false },
    }));
  }
  return descriptors;
}
