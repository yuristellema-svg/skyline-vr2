import { DEFAULTS } from './constants.js';
import {
  chooseWeightedFamily,
  fallbackDistrictKind,
  familyWeightsFor,
  FAMILY_PROFILES,
} from './families.js';
import {
  angleDifference,
  createRng,
  hashString,
  nearestPolylineProjection,
  orientedCorners,
  pointInPolygon,
  polygonBounds,
  polygonCentroid,
  polygonsOverlap,
  rotate2,
  samplePolylineByDistance,
  stableSort,
} from './math.js';
import { createFoundationPlan } from './terrain.js';

function districtForPoint(settlement, point) {
  for (const district of settlement.districts ?? []) {
    if (pointInPolygon(point, district.footprint)) return district;
  }
  if (settlement.districts?.length) return null;
  return Object.freeze({
    id: `${settlement.id}:default`,
    kind: fallbackDistrictKind(settlement.kind),
    footprint: settlement.footprint,
    roadRefs: settlement.roadRefs,
  });
}

function isExcluded(point, exclusions) {
  return exclusions.some(exclusion => pointInPolygon(point, exclusion.footprint));
}

function randomBetween(random, range) {
  return range[0] + random() * (range[1] - range[0]);
}

function nearestRoad(point, roadRefs, indexed) {
  let best = null;
  for (const roadRef of roadRefs) {
    const road = indexed.roads.get(roadRef);
    if (!road) continue;
    const projection = nearestPolylineProjection(point, road.points);
    if (!projection || (best && projection.distance >= best.distance)) continue;
    best = Object.freeze({ ...projection, roadRef, roadWidth: road.width ?? 10 });
  }
  return best;
}

function makeCandidate({
  settlement,
  district,
  family,
  x,
  z,
  yaw,
  road,
  random,
  sampleHeight,
  options,
  source,
  sourceIndex,
  exclusions,
}) {
  const profile = FAMILY_PROFILES[family];
  if (!profile) return null;
  const width = randomBetween(random, profile.width);
  const depth = randomBetween(random, profile.depth);
  const height = randomBetween(random, profile.height) * (settlement.heightScale ?? 1);
  const footprint = orientedCorners(x, z, width, depth, yaw);
  if (!footprint.every(point => pointInPolygon(point, settlement.footprint))) return null;
  if (settlement.districts?.length && !footprint.every(point => pointInPolygon(point, district.footprint))) return null;
  if (footprint.some(point => isExcluded(point, exclusions))) return null;
  const foundation = createFoundationPlan({
    sampleHeight,
    x,
    z,
    width,
    depth,
    yaw,
    maxTerrainDelta: settlement.maxTerrainDelta ?? profile.slope ?? options.maxTerrainDelta,
    maxFoundationDepth: settlement.maxFoundationDepth ?? options.maxFoundationDepth,
  });
  if (!foundation.accepted) return null;
  return {
    id: `${settlement.id}:parcel:${source}:${sourceIndex}`,
    settlementId: settlement.id,
    districtId: district.id,
    districtKind: district.kind,
    family,
    x,
    z,
    yaw,
    width,
    depth,
    height,
    roadRef: road.roadRef,
    roadHeading: road.heading,
    roadDistance: road.distance,
    roadWidth: road.roadWidth,
    foundation,
    footprint,
    source,
    sourceIndex,
  };
}


function roadCandidates(settlement, indexed, sampleHeight, random, options) {
  const candidates = [];
  const exclusions = [...indexed.exclusions.values()];
  let sourceIndex = 0;
  const density = Math.max(0.35, settlement.density ?? 1);
  for (const roadRef of settlement.roadRefs) {
    const road = indexed.roads.get(roadRef);
    if (!road) continue;
    const samples = samplePolylineByDistance(road.points, 34 / Math.min(1.2, density), 12);
    for (const sample of samples) {
      for (const side of [-1, 1]) {
        const basePoint = sample.point;
        const provisionalDistrict = districtForPoint(settlement, basePoint) ?? { kind: fallbackDistrictKind(settlement.kind) };
        const family = chooseWeightedFamily(familyWeightsFor(provisionalDistrict, settlement.kind), random);
        const profile = FAMILY_PROFILES[family];
        const rows = Math.max(1, Math.min(profile.rows, settlement.maxRows ?? profile.rows));
        for (let row = 0; row < rows; row += 1) {
          const setback = (road.width ?? 10) * 0.5 + 6 + profile.depth[1] * 0.5 + row * (profile.depth[1] + 11);
          const normalYaw = sample.heading + Math.PI * 0.5;
          const [dx, dz] = rotate2(setback * side, 0, normalYaw);
          const x = basePoint[0] + dx;
          const z = basePoint[1] + dz;
          const point = [x, z];
          if (!pointInPolygon(point, settlement.footprint) || isExcluded(point, exclusions)) continue;
          const district = districtForPoint(settlement, point);
          if (!district) continue;
          const roadRefs = district.roadRefs ?? settlement.roadRefs;
          if (!roadRefs.includes(roadRef)) continue;
          const selectedFamily = chooseWeightedFamily(familyWeightsFor(district, settlement.kind), random);
          const nearest = nearestRoad(point, roadRefs, indexed);
          if (!nearest) continue;
          const candidate = makeCandidate({
            settlement,
            district,
            family: selectedFamily,
            x,
            z,
            yaw: nearest.heading + (random() - 0.5) * 0.045,
            road: nearest,
            random,
            sampleHeight,
            options,
            source: `road-${roadRef}-r${row}`,
            sourceIndex: sourceIndex++,
            exclusions,
          });
          if (candidate) candidates.push(candidate);
        }
      }
    }
  }
  return candidates;
}

function infillCandidates(settlement, indexed, sampleHeight, random, options) {
  if (!['city', 'suburb', 'industrial', 'harbour'].includes(settlement.kind)) return [];
  const exclusions = [...indexed.exclusions.values()];
  const bounds = polygonBounds(settlement.footprint);
  const spacing = settlement.kind === 'city' ? 52 : settlement.kind === 'suburb' ? 56 : 76;
  const candidates = [];
  let sourceIndex = 0;
  let row = 0;
  for (let z = bounds.minZ + spacing * 0.5; z <= bounds.maxZ; z += spacing) {
    const offset = (row % 2) * spacing * 0.5;
    for (let x = bounds.minX + spacing * 0.5 + offset; x <= bounds.maxX; x += spacing) {
      const point = [x + (random() - 0.5) * 9, z + (random() - 0.5) * 9];
      if (!pointInPolygon(point, settlement.footprint) || isExcluded(point, exclusions)) continue;
      const district = districtForPoint(settlement, point);
      if (!district) continue;
      const road = nearestRoad(point, district.roadRefs ?? settlement.roadRefs, indexed);
      if (!road) continue;
      if (road.distance < road.roadWidth * 0.5 + options.roadClearance) continue;
      if (road.distance > (settlement.kind === 'city' ? 135 : 105)) continue;
      const family = chooseWeightedFamily(familyWeightsFor(district, settlement.kind), random);
      const candidate = makeCandidate({
        settlement,
        district,
        family,
        x: point[0],
        z: point[1],
        yaw: road.heading + (random() - 0.5) * 0.06,
        road,
        random,
        sampleHeight,
        options,
        source: 'infill',
        sourceIndex: sourceIndex++,
        exclusions,
      });
      if (candidate) candidates.push(candidate);
    }
    row += 1;
  }
  return candidates;
}

function scoreCandidate(candidate, settlement) {
  const center = polygonCentroid(settlement.footprint);
  const centerDistance = Math.hypot(candidate.x - center[0], candidate.z - center[1]);
  const districtWeight = candidate.districtKind === 'downtown' ? 60
    : candidate.districtKind === 'civic' ? 52
      : candidate.districtKind === 'market' ? 45
        : candidate.districtKind === 'industrial' || candidate.districtKind === 'docklands' ? 42
          : 34;
  const familyWeight = candidate.family.includes('tower') ? 40
    : candidate.family === 'civic_hall' ? 36
      : candidate.family === 'factory_hall' ? 30
        : 18;
  return districtWeight + familyWeight - centerDistance * 0.012 - candidate.foundation.terrain.delta * 4;
}

function acceptNonOverlapping(candidates, settlement, options) {
  const sorted = stableSort(candidates, candidate => {
    const score = scoreCandidate(candidate, settlement);
    return `${String(99999 - Math.round(score * 100)).padStart(5, '0')}:${candidate.id}`;
  });
  const accepted = [];
  const padding = settlement.parcelPadding ?? options.parcelPadding;
  const maxParcels = settlement.maxParcels ?? Math.max(12, Math.round(sorted.length * (settlement.density ?? 0.75) * 0.58));
  for (const candidate of sorted) {
    if (accepted.length >= maxParcels) break;
    if (accepted.some(existing => polygonsOverlap(candidate.footprint, existing.footprint, padding))) continue;
    accepted.push(Object.freeze({
      ...candidate,
      footprint: Object.freeze(candidate.footprint.map(point => Object.freeze(point))),
      score: scoreCandidate(candidate, settlement),
    }));
  }
  return accepted;
}

export function planSettlementParcels({
  settlement,
  indexed,
  sampleHeight,
  seed,
  options = {},
}) {
  const mergedOptions = {
    roadClearance: DEFAULTS.roadClearance,
    parcelPadding: DEFAULTS.parcelPadding,
    maxTerrainDelta: DEFAULTS.maxTerrainDelta,
    maxFoundationDepth: DEFAULTS.maxFoundationDepth,
    ...options,
  };
  const random = createRng(hashString(settlement.seed, seed));
  const candidates = [
    ...roadCandidates(settlement, indexed, sampleHeight, random, mergedOptions),
    ...infillCandidates(settlement, indexed, sampleHeight, random, mergedOptions),
  ];
  const accepted = acceptNonOverlapping(candidates, settlement, mergedOptions);
  if (accepted.length === 0) {
    throw new Error(`${settlement.id} produced no terrain-safe road-aligned parcels`);
  }
  return Object.freeze(accepted);
}

export function parcelAlignmentError(parcel) {
  return angleDifference(parcel.yaw, parcel.roadHeading);
}
