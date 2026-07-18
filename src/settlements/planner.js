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
import { publicSpaceFootprints, signatureSiteFootprints } from './urbanDesign.js';

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
    materialKey: fallbackDistrictKind(settlement.kind),
  });
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

function heightProfileFor(settlement, district) {
  return district?.heightProfile ?? settlement.heightProfile ?? null;
}

function heightScaleAt(settlement, district, point) {
  const profile = heightProfileFor(settlement, district);
  if (!profile) return settlement.heightScale ?? 1;
  const distance = Math.hypot(point[0] - profile.anchor[0], point[1] - profile.anchor[1]);
  const normalized = Math.max(0, Math.min(1, 1 - distance / profile.radius));
  const shaped = Math.pow(normalized, profile.exponent ?? 1.45);
  return (settlement.heightScale ?? 1) * (profile.minScale + (profile.maxScale - profile.minScale) * shaped);
}

function designExclusions(settlement, indexed) {
  return [
    ...[...indexed.exclusions.values()].map(item => ({ id: item.id, footprint: item.footprint, kind: 'external' })),
    ...publicSpaceFootprints(settlement),
    ...signatureSiteFootprints(settlement),
  ];
}

function footprintConflicts(footprint, exclusions, padding = 0) {
  return exclusions.some(exclusion => polygonsOverlap(footprint, exclusion.footprint, padding));
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
  const districtScale = district.blockScale ?? 1;
  const width = randomBetween(random, profile.width) * districtScale;
  const depth = randomBetween(random, profile.depth) * districtScale;
  const height = randomBetween(random, profile.height) * heightScaleAt(settlement, district, [x, z]);
  const footprint = orientedCorners(x, z, width, depth, yaw);
  if (!footprint.every(point => pointInPolygon(point, settlement.footprint))) return null;
  if (settlement.districts?.length && !footprint.every(point => pointInPolygon(point, district.footprint))) return null;
  if (footprintConflicts(footprint, exclusions, options.designSpacePadding ?? 4)) return null;
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
    materialKey: district.materialKey ?? district.kind,
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
    signature: false,
    variant: district.variant ?? family,
  };
}

function spacingFor(settlement, road, district) {
  const base = settlement.kind === 'city' ? 52
    : settlement.kind === 'suburb' ? 60
      : settlement.kind === 'town' ? 54
        : settlement.kind === 'village' ? 62
          : settlement.kind === 'industrial' || settlement.kind === 'harbour' ? 92
            : 76;
  const patternMultiplier = settlement.organizingPattern === 'main-street' ? 1.08
    : settlement.organizingPattern === 'green' ? 1.2
      : settlement.organizingPattern === 'ridge' ? 1.28
        : settlement.organizingPattern === 'compound' ? 1.18
          : 1;
  const districtMultiplier = district?.kind === 'downtown' ? 0.9
    : district?.kind === 'old-quarter' ? 0.82
      : district?.kind === 'residential' ? 1.08
        : 1;
  return Math.max(34, base * patternMultiplier * districtMultiplier / Math.max(0.45, settlement.density ?? 1));
}

function roadCandidates(settlement, indexed, sampleHeight, random, options) {
  const candidates = [];
  const exclusions = designExclusions(settlement, indexed);
  let sourceIndex = 0;
  for (const roadRef of settlement.roadRefs) {
    const road = indexed.roads.get(roadRef);
    if (!road) continue;
    const roadDistrict = (settlement.districts ?? []).find(district => (district.roadRefs ?? []).includes(roadRef));
    const samples = samplePolylineByDistance(road.points, spacingFor(settlement, road, roadDistrict), 18);
    for (const sample of samples) {
      for (const side of [-1, 1]) {
        const rowLimit = Math.max(1, Math.min(settlement.maxRows ?? 2, settlement.kind === 'city' || settlement.kind === 'suburb' ? 2 : 1));
        for (let row = 0; row < rowLimit; row += 1) {
          const normalYaw = sample.heading + Math.PI * 0.5;
          const preliminaryDepth = settlement.kind === 'industrial' || settlement.kind === 'harbour' ? 58 : settlement.kind === 'city' ? 48 : 30;
          const setback = (road.width ?? 10) * 0.5 + 8 + preliminaryDepth * 0.5 + row * (preliminaryDepth + 16);
          const [dx, dz] = rotate2(setback * side, 0, normalYaw);
          const point = [sample.point[0] + dx, sample.point[1] + dz];
          if (!pointInPolygon(point, settlement.footprint)) continue;
          const district = districtForPoint(settlement, point);
          if (!district) continue;
          const roadRefs = district.roadRefs ?? settlement.roadRefs;
          if (!roadRefs.includes(roadRef)) continue;
          const selectedFamily = chooseWeightedFamily(familyWeightsFor(district, settlement.kind), random);
          const profile = FAMILY_PROFILES[selectedFamily];
          const preciseSetback = (road.width ?? 10) * 0.5 + 8 + profile.depth[1] * 0.5 + row * (profile.depth[1] + 16);
          const [preciseDx, preciseDz] = rotate2(preciseSetback * side, 0, normalYaw);
          const precisePoint = [sample.point[0] + preciseDx, sample.point[1] + preciseDz];
          if (!pointInPolygon(precisePoint, settlement.footprint)) continue;
          const preciseDistrict = districtForPoint(settlement, precisePoint);
          if (!preciseDistrict || !(preciseDistrict.roadRefs ?? settlement.roadRefs).includes(roadRef)) continue;
          const nearest = nearestRoad(precisePoint, preciseDistrict.roadRefs ?? settlement.roadRefs, indexed);
          if (!nearest) continue;
          const candidate = makeCandidate({
            settlement,
            district: preciseDistrict,
            family: selectedFamily,
            x: precisePoint[0],
            z: precisePoint[1],
            yaw: nearest.heading + (random() - 0.5) * 0.025,
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

function shouldInfill(settlement) {
  if (!['city', 'suburb', 'industrial', 'harbour'].includes(settlement.kind)) return false;
  return !['main-street', 'green', 'ridge'].includes(settlement.organizingPattern);
}

function infillCandidates(settlement, indexed, sampleHeight, random, options) {
  if (!shouldInfill(settlement)) return [];
  const exclusions = designExclusions(settlement, indexed);
  const bounds = polygonBounds(settlement.footprint);
  const spacing = settlement.kind === 'city' ? 76 : settlement.kind === 'suburb' ? 82 : 112;
  const candidates = [];
  let sourceIndex = 0;
  let row = 0;
  for (let z = bounds.minZ + spacing * 0.5; z <= bounds.maxZ; z += spacing) {
    const offset = (row % 2) * spacing * 0.5;
    for (let x = bounds.minX + spacing * 0.5 + offset; x <= bounds.maxX; x += spacing) {
      const point = [x + (random() - 0.5) * 5, z + (random() - 0.5) * 5];
      if (!pointInPolygon(point, settlement.footprint)) continue;
      const district = districtForPoint(settlement, point);
      if (!district) continue;
      const road = nearestRoad(point, district.roadRefs ?? settlement.roadRefs, indexed);
      if (!road) continue;
      if (road.distance < road.roadWidth * 0.5 + options.roadClearance) continue;
      if (road.distance > (settlement.kind === 'city' ? 122 : 110)) continue;
      const family = chooseWeightedFamily(familyWeightsFor(district, settlement.kind), random);
      const candidate = makeCandidate({
        settlement,
        district,
        family,
        x: point[0],
        z: point[1],
        yaw: road.heading + (random() - 0.5) * 0.035,
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
  const profile = heightProfileFor(settlement, { heightProfile: settlement.districts?.find(item => item.id === candidate.districtId)?.heightProfile });
  const focusDistance = profile ? Math.hypot(candidate.x - profile.anchor[0], candidate.z - profile.anchor[1]) : centerDistance;
  const districtWeight = candidate.districtKind === 'downtown' ? 64
    : candidate.districtKind === 'civic' ? 58
      : candidate.districtKind === 'market' ? 48
        : candidate.districtKind === 'industrial' || candidate.districtKind === 'docklands' ? 45
          : 34;
  const familyWeight = candidate.family.includes('tower') ? 38
    : candidate.family === 'civic_hall' || candidate.family === 'civic_rotunda' ? 36
      : candidate.family === 'factory_hall' ? 30
        : 18;
  return districtWeight + familyWeight - focusDistance * 0.018 - candidate.foundation.terrain.delta * 4;
}

function acceptNonOverlapping(candidates, settlement, options) {
  const sorted = stableSort(candidates, candidate => {
    const score = scoreCandidate(candidate, settlement);
    return `${String(999999 - Math.round(score * 100)).padStart(6, '0')}:${candidate.id}`;
  });
  const accepted = [];
  const padding = settlement.parcelPadding ?? options.parcelPadding;
  const maxParcels = settlement.maxParcels ?? Math.max(10, Math.round(sorted.length * (settlement.density ?? 0.75) * 0.5));
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
    designSpacePadding: 4,
    ...options,
  };
  const random = createRng(hashString(settlement.seed, seed));
  const candidates = [
    ...roadCandidates(settlement, indexed, sampleHeight, random, mergedOptions),
    ...infillCandidates(settlement, indexed, sampleHeight, random, mergedOptions),
  ];
  const accepted = acceptNonOverlapping(candidates, settlement, mergedOptions);
  if (accepted.length === 0 && !(settlement.signatureSites?.length)) {
    throw new Error(`${settlement.id} produced no terrain-safe road-aligned parcels`);
  }
  return Object.freeze(accepted);
}

export function parcelAlignmentError(parcel) {
  return angleDifference(parcel.yaw, parcel.roadHeading);
}
