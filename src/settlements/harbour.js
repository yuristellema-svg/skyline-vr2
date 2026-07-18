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

export function buildHarbourDescriptors({ settlement, indexed, sampleHeight, random }) {
  if (settlement.kind !== 'harbour') return [];
  const shoreline = indexed.shorelines.get(settlement.shorelineRef);
  const waterSide = shoreline.waterSide === -1 ? -1 : 1;
  const [t0, t1] = settlement.shorelineSpan;
  const moduleCount = settlement.pierCount ?? 5;
  const descriptors = [];

  for (let index = 0; index < moduleCount; index += 1) {
    const t = t0 + (t1 - t0) * ((index + 0.5) / moduleCount);
    const sample = samplePolyline(shoreline.points, t);
    if (!sample) continue;
    const outward = sample.heading + waterSide * Math.PI * 0.5;
    const pierLength = 48 + random() * 30;
    const pierWidth = 9 + random() * 5;
    const [offsetX, offsetZ] = rotate2(0, pierLength * 0.48 * waterSide, sample.heading);
    const x = sample.point[0] + offsetX;
    const z = sample.point[1] + offsetZ;
    const shoreY = readHeight(sampleHeight, sample.point[0], sample.point[1]);
    const deckY = Math.max(indexed.manifest.waterLevel + 2.5, shoreY + 0.45);
    const road = nearestRoadLink(sample.point, settlement, indexed);
    const commonMeta = {
      shorelineRef: settlement.shorelineRef,
      shorelineT: t,
      roadRef: road?.roadRef ?? settlement.roadRefs[0],
      intentionalOverWater: true,
      exactShorelineAnchor: sample.point,
    };
    const locationId = `${settlement.id}:pier:${index}`;
    descriptors.push(makeDescriptor({
      id: `${locationId}:deck`, settlementId: settlement.id, locationId,
      districtId: `${settlement.id}:dock-edge`, category: 'structures', primitive: 'box', role: 'harbour-pier',
      x, y: deckY, z, width: pierWidth, height: 1.2, depth: pierLength, yaw: outward,
      color: '#555b59', surface: 'dock', qualityRank: 0, priority: 98,
      visibilityBand: 'district', collidable: true, essential: true, meta: commonMeta,
    }));
    const pylonCount = 4;
    for (let pylon = 0; pylon < pylonCount; pylon += 1) {
      const along = -pierLength * 0.38 + (pylon / (pylonCount - 1)) * pierLength * 0.76;
      for (const side of [-1, 1]) {
        const local = rotate2(side * pierWidth * 0.36, along, outward);
        const pylonHeight = Math.max(4, deckY - indexed.manifest.waterLevel + 2.5);
        descriptors.push(makeDescriptor({
          id: `${locationId}:pylon:${pylon}:${side}`, settlementId: settlement.id, locationId,
          districtId: `${settlement.id}:dock-edge`, category: 'details', primitive: 'cylinder', role: 'harbour-pylon',
          x: x + local[0], y: indexed.manifest.waterLevel + pylonHeight * 0.5 - 1.2, z: z + local[1],
          width: 0.75, height: pylonHeight, depth: 0.75, yaw: 0,
          color: '#454c4b', surface: 'dock', qualityRank: pylon < 2 ? 1 : 2, priority: 28,
          visibilityBand: 'micro', collidable: false, meta: commonMeta,
        }));
      }
    }
    if (index % 2 === 0) {
      const craneXz = rotate2(0, pierLength * 0.08, outward);
      descriptors.push(makeDescriptor({
        id: `${locationId}:crane`, settlementId: settlement.id, locationId,
        districtId: `${settlement.id}:dock-edge`, category: 'landmarks', primitive: 'crane', role: 'harbour-crane',
        x: x + craneXz[0], y: deckY + 14, z: z + craneXz[1],
        width: 18, height: 28, depth: 7, yaw: outward,
        color: '#596161', surface: 'metal', qualityRank: 0, priority: 88,
        visibilityBand: 'skyline', collidable: true, essential: true, meta: commonMeta,
      }));
    }
  }

  const wallSamples = 8;
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
      width: length + 1.2, height: Math.max(2, shoreY - indexed.manifest.waterLevel + 1), depth: 2.8, yaw,
      color: '#5c615d', surface: 'foundation', qualityRank: 0, priority: 72,
      visibilityBand: 'district', collidable: true, essential: true,
      meta: { shorelineRef: settlement.shorelineRef, shorelineSpan: [tA, tB], intentionalOverWater: false },
    }));
  }
  return descriptors;
}
