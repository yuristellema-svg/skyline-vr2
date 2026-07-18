import {
  DISTRICT_KINDS,
  LANDMARK_KINDS,
  PUBLIC_SPACE_KINDS,
  SETTLEMENT_KINDS,
} from './constants.js';
import { FAMILY_PROFILES } from './families.js';
import { orientedCorners, pointInPolygon, polygonCentroid } from './math.js';

function invariant(condition, message) {
  if (!condition) throw new TypeError(`Settlement manifest: ${message}`);
}

function isPoint(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
}

function validatePolyline(item, label) {
  invariant(item && typeof item.id === 'string' && item.id, `${label} requires id`);
  invariant(Array.isArray(item.points) && item.points.length >= 2, `${label} ${item.id} requires at least two points`);
  invariant(item.points.every(isPoint), `${label} ${item.id} has invalid points`);
  if (item.width !== undefined) invariant(Number.isFinite(item.width) && item.width > 0, `${label} ${item.id} width must be positive`);
}

function validatePolygon(polygon, label) {
  invariant(Array.isArray(polygon) && polygon.length >= 3, `${label} requires a polygon`);
  invariant(polygon.every(isPoint), `${label} has invalid polygon points`);
}

function validateHeightProfile(profile, label) {
  if (profile === undefined) return;
  invariant(profile && typeof profile === 'object', `${label} heightProfile must be an object`);
  invariant(isPoint(profile.anchor), `${label} heightProfile requires exact anchor`);
  invariant(Number.isFinite(profile.radius) && profile.radius > 0, `${label} heightProfile radius must be positive`);
  invariant(Number.isFinite(profile.minScale) && profile.minScale > 0, `${label} heightProfile minScale must be positive`);
  invariant(Number.isFinite(profile.maxScale) && profile.maxScale >= profile.minScale, `${label} heightProfile maxScale must be >= minScale`);
  if (profile.exponent !== undefined) invariant(Number.isFinite(profile.exponent) && profile.exponent > 0, `${label} heightProfile exponent must be positive`);
}

function validateDistrict(district, settlement) {
  invariant(typeof district.id === 'string' && district.id, `${settlement.id} district requires id`);
  invariant(DISTRICT_KINDS.has(district.kind), `${settlement.id}/${district.id} has unsupported district kind ${district.kind}`);
  validatePolygon(district.footprint, `${settlement.id}/${district.id}`);
  const center = polygonCentroid(district.footprint);
  invariant(pointInPolygon(center, settlement.footprint), `${settlement.id}/${district.id} must be inside settlement footprint`);
  if (district.roadRefs !== undefined) invariant(Array.isArray(district.roadRefs) && district.roadRefs.length > 0, `${settlement.id}/${district.id} roadRefs must be non-empty`);
  if (district.familyWeights !== undefined) {
    invariant(district.familyWeights && typeof district.familyWeights === 'object', `${settlement.id}/${district.id} familyWeights must be an object`);
    invariant(Object.entries(district.familyWeights).every(([family, value]) => FAMILY_PROFILES[family] && Number.isFinite(value) && value >= 0), `${settlement.id}/${district.id} familyWeights must reference supported families with non-negative values`);
  }
  if (district.materialKey !== undefined) invariant(typeof district.materialKey === 'string' && district.materialKey, `${settlement.id}/${district.id} materialKey must be a string`);
  validateHeightProfile(district.heightProfile, `${settlement.id}/${district.id}`);
}

function validateRect(rect, label, settlement) {
  invariant(rect && typeof rect.id === 'string' && rect.id, `${label} requires id`);
  invariant(isPoint(rect.anchor), `${label} requires exact anchor`);
  invariant(Number.isFinite(rect.width) && rect.width > 0, `${label} width must be positive`);
  invariant(Number.isFinite(rect.depth) && rect.depth > 0, `${label} depth must be positive`);
  invariant(rect.yaw === undefined || Number.isFinite(rect.yaw), `${label} yaw must be finite`);
  const corners = orientedCorners(rect.anchor[0], rect.anchor[1], rect.width, rect.depth, rect.yaw ?? 0);
  invariant(corners.every(point => pointInPolygon(point, settlement.footprint)), `${label} must be inside ${settlement.id}`);
}

function validatePublicSpace(space, settlement) {
  validateRect(space, `${settlement.id} public space`, settlement);
  invariant(PUBLIC_SPACE_KINDS.has(space.kind), `${settlement.id}/${space.id} unsupported public-space kind ${space.kind}`);
  if (space.districtId !== undefined) invariant(typeof space.districtId === 'string' && space.districtId, `${settlement.id}/${space.id} districtId must be a string`);
  if (space.renderSurface !== undefined) invariant(typeof space.renderSurface === 'boolean', `${settlement.id}/${space.id} renderSurface must be boolean`);
}

function validateSignatureSite(site, settlement) {
  validateRect(site, `${settlement.id} signature site`, settlement);
  invariant(FAMILY_PROFILES[site.family], `${settlement.id}/${site.id} unsupported signature family ${site.family}`);
  invariant(Number.isFinite(site.height) && site.height > 0, `${settlement.id}/${site.id} height must be positive`);
  invariant(typeof site.districtId === 'string' && site.districtId, `${settlement.id}/${site.id} requires districtId`);
  if (site.roadRef !== undefined) invariant(typeof site.roadRef === 'string' && site.roadRef, `${settlement.id}/${site.id} roadRef must be a string`);
  if (site.materialKey !== undefined) invariant(typeof site.materialKey === 'string' && site.materialKey, `${settlement.id}/${site.id} materialKey must be a string`);
}

export function validateSettlementManifest(input) {
  invariant(input && typeof input === 'object', 'object required');
  invariant(input.version === 2, 'version must be 2');
  invariant(typeof input.worldId === 'string' && input.worldId, 'worldId required');
  invariant(Number.isFinite(input.waterLevel), 'waterLevel required');
  invariant(Array.isArray(input.roads), 'roads array required');
  invariant(Array.isArray(input.shorelines), 'shorelines array required');
  invariant(Array.isArray(input.exclusions), 'exclusions array required');
  invariant(Array.isArray(input.settlements), 'settlements array required');
  invariant(Array.isArray(input.landmarks), 'landmarks array required');

  const ids = new Set();
  const addId = (id, label) => {
    invariant(typeof id === 'string' && id, `${label} id required`);
    invariant(!ids.has(id), `duplicate id ${id}`);
    ids.add(id);
  };

  const roads = new Map();
  for (const road of input.roads) {
    validatePolyline(road, 'road');
    addId(road.id, 'road');
    roads.set(road.id, road);
  }

  const shorelines = new Map();
  for (const shoreline of input.shorelines) {
    validatePolyline(shoreline, 'shoreline');
    invariant(shoreline.waterSide === -1 || shoreline.waterSide === 1, `${shoreline.id} waterSide must be -1 or 1`);
    addId(shoreline.id, 'shoreline');
    shorelines.set(shoreline.id, shoreline);
  }

  for (const exclusion of input.exclusions) {
    addId(exclusion.id, 'exclusion');
    validatePolygon(exclusion.footprint, `exclusion ${exclusion.id}`);
    invariant(typeof exclusion.reason === 'string' && exclusion.reason, `${exclusion.id} requires reason`);
  }

  for (const settlement of input.settlements) {
    addId(settlement.id, 'settlement');
    invariant(SETTLEMENT_KINDS.has(settlement.kind), `${settlement.id} has unsupported kind ${settlement.kind}`);
    validatePolygon(settlement.footprint, `${settlement.id} external footprint`);
    invariant(typeof settlement.name === 'string' && settlement.name, `${settlement.id} requires name`);
    invariant(typeof settlement.seed === 'number' || typeof settlement.seed === 'string', `${settlement.id} requires deterministic seed`);
    invariant(Array.isArray(settlement.roadRefs) && settlement.roadRefs.length > 0, `${settlement.id} requires roadRefs`);
    for (const roadRef of settlement.roadRefs) invariant(roads.has(roadRef), `${settlement.id} references missing road ${roadRef}`);

    const districtIds = new Set();
    if (settlement.districts !== undefined) {
      invariant(Array.isArray(settlement.districts) && settlement.districts.length > 0, `${settlement.id} districts must be non-empty`);
      for (const district of settlement.districts) {
        validateDistrict(district, settlement);
        invariant(!districtIds.has(district.id), `${settlement.id} duplicate district ${district.id}`);
        districtIds.add(district.id);
        for (const roadRef of district.roadRefs ?? []) invariant(roads.has(roadRef), `${settlement.id}/${district.id} references missing road ${roadRef}`);
      }
    }

    const localIds = new Set();
    for (const space of settlement.publicSpaces ?? []) {
      validatePublicSpace(space, settlement);
      invariant(!localIds.has(space.id), `${settlement.id} duplicate local design id ${space.id}`);
      localIds.add(space.id);
      if (space.districtId) invariant(districtIds.size === 0 || districtIds.has(space.districtId), `${settlement.id}/${space.id} references missing district ${space.districtId}`);
    }
    for (const site of settlement.signatureSites ?? []) {
      validateSignatureSite(site, settlement);
      invariant(!localIds.has(site.id), `${settlement.id} duplicate local design id ${site.id}`);
      localIds.add(site.id);
      invariant(districtIds.size === 0 || districtIds.has(site.districtId), `${settlement.id}/${site.id} references missing district ${site.districtId}`);
      if (site.roadRef) invariant(roads.has(site.roadRef), `${settlement.id}/${site.id} references missing road ${site.roadRef}`);
    }
    validateHeightProfile(settlement.heightProfile, settlement.id);
    if (settlement.organizingPattern !== undefined) invariant(['grid', 'main-street', 'crossroads', 'green', 'ridge', 'waterfront', 'compound'].includes(settlement.organizingPattern), `${settlement.id} has unsupported organizingPattern`);

    if (settlement.kind === 'harbour') {
      invariant(typeof settlement.shorelineRef === 'string', `${settlement.id} requires shorelineRef`);
      invariant(shorelines.has(settlement.shorelineRef), `${settlement.id} references missing shoreline ${settlement.shorelineRef}`);
      invariant(Array.isArray(settlement.shorelineSpan) && settlement.shorelineSpan.length === 2 && settlement.shorelineSpan.every(Number.isFinite), `${settlement.id} requires shorelineSpan`);
      invariant(settlement.shorelineSpan[0] >= 0 && settlement.shorelineSpan[1] <= 1 && settlement.shorelineSpan[0] < settlement.shorelineSpan[1], `${settlement.id} shorelineSpan must be ordered within 0..1`);
    }
  }

  for (const landmark of input.landmarks) {
    addId(landmark.id, 'landmark');
    invariant(LANDMARK_KINDS.has(landmark.kind), `${landmark.id} has unsupported kind ${landmark.kind}`);
    invariant(isPoint(landmark.anchor), `${landmark.id} requires exact external anchor`);
    invariant(Number.isFinite(landmark.height) && landmark.height > 0, `${landmark.id} requires positive height`);
    if (landmark.roadRef) invariant(roads.has(landmark.roadRef), `${landmark.id} references missing road ${landmark.roadRef}`);
    if (landmark.shorelineRef) invariant(shorelines.has(landmark.shorelineRef), `${landmark.id} references missing shoreline ${landmark.shorelineRef}`);
  }

  return input;
}

export function indexManifest(input) {
  const manifest = validateSettlementManifest(input);
  return Object.freeze({
    manifest,
    roads: new Map(manifest.roads.map(item => [item.id, item])),
    shorelines: new Map(manifest.shorelines.map(item => [item.id, item])),
    exclusions: new Map(manifest.exclusions.map(item => [item.id, item])),
    settlements: new Map(manifest.settlements.map(item => [item.id, item])),
    landmarks: new Map(manifest.landmarks.map(item => [item.id, item])),
  });
}

export function inspectSettlementManifestCompatibility(input) {
  const candidate = input?.version === 2
    ? input
    : input?.settlementPlacement?.version === 2
      ? input.settlementPlacement
      : null;
  if (candidate) {
    try {
      validateSettlementManifest(candidate);
      return Object.freeze({ compatible: true, manifest: candidate, missing: Object.freeze([]) });
    } catch (error) {
      return Object.freeze({ compatible: false, manifest: candidate, missing: Object.freeze([error.message]) });
    }
  }
  const missing = [];
  if (!Array.isArray(input?.roads)) missing.push('roads[] with widths and authoritative polylines');
  if (!Array.isArray(input?.shorelines)) missing.push('shorelines[] with water-side direction');
  if (!Array.isArray(input?.exclusions)) missing.push('exclusions[] for runways, water and protected corridors');
  if (!Array.isArray(input?.settlements)) missing.push('settlements[] with footprints, roadRefs and optional districts');
  if (!Array.isArray(input?.landmarks)) missing.push('landmarks[] with exact anchors');
  if (!Number.isFinite(input?.waterLevel)) missing.push('waterLevel');
  return Object.freeze({ compatible: false, manifest: null, missing: Object.freeze(missing) });
}

export function resolveSettlementManifest(input) {
  const candidate = input?.version === 2 ? input : input?.settlementPlacement;
  if (!candidate) {
    const report = inspectSettlementManifestCompatibility(input);
    throw new TypeError(`Settlement manifest is not compatible: ${report.missing.join('; ')}`);
  }
  return validateSettlementManifest(candidate);
}
