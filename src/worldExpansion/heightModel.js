import {
  clamp,
  compilePolyline,
  ellipseInfluence,
  fbm2,
  lerp,
  localCoordinates,
  nearestPointOnPolyline,
  pointInBounds,
  ridgedNoise2,
  smoothstep,
} from './math.js';
import { createBiomeModel } from './biomeModel.js';
import { createWorldCoreIndex } from './manifest.js';

const CORE_SEAM_METERS = 448;
const DEFAULT_ROAD_GRADE = Object.freeze({ primary: 0.055, secondary: 0.075, service: 0.11 });
const DEFAULT_ROAD_SHOULDER = Object.freeze({ primary: 5.5, secondary: 4.2, service: 3.0 });

function boundsForPoints(points, padding = 0) {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minZ = Math.min(minZ, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxZ = Math.max(maxZ, point[1]);
  }
  return Object.freeze({ minX: minX - padding, minZ: minZ - padding, maxX: maxX + padding, maxZ: maxZ + padding });
}

function pointNearBounds(x, z, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

function distanceOutsideBounds(x, z, bounds) {
  const dx = x < bounds.minX ? bounds.minX - x : x > bounds.maxX ? x - bounds.maxX : 0;
  const dz = z < bounds.minZ ? bounds.minZ - z : z > bounds.maxZ ? z - bounds.maxZ : 0;
  return Math.hypot(dx, dz);
}

function clampToBounds(x, z, bounds) {
  return [clamp(x, bounds.minX, bounds.maxX), clamp(z, bounds.minZ, bounds.maxZ)];
}

function polylineForm(x, z, forms, valueKey) {
  let result = 0;
  for (const form of forms) {
    if (form.bounds && !pointNearBounds(x, z, form.bounds)) continue;
    const nearest = nearestPointOnPolyline(x, z, form.compiled);
    const influence = 1 - smoothstep(form.halfWidthMeters * 0.18, form.halfWidthMeters, nearest.distance);
    result += influence * form[valueKey];
  }
  return result;
}

function riverSurface(river, nearest) {
  const t = nearest.along / Math.max(1, river.compiled.totalLength);
  return lerp(river.sourceSurfaceMeters, river.mouthSurfaceMeters, t);
}

function signedDistanceToSegment(x, z, segment, nearest) {
  const rightX = -segment.dz / segment.length;
  const rightZ = segment.dx / segment.length;
  return (x - nearest.x) * rightX + (z - nearest.z) * rightZ;
}

function formSide(x, z, form, nearest) {
  const segment = form.compiled.segments[Math.max(0, nearest.segmentIndex)];
  if (!segment) return 0;
  const side = signedDistanceToSegment(x, z, segment, nearest);
  return Math.sign(side || 1) * (form.side || 1);
}

function gradeClamp(values, points, locked, maximumGrade, iterations = 8) {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let index = 1; index < values.length - 1; index += 1) {
      if (locked.has(index)) continue;
      values[index] = lerp(values[index], (values[index - 1] + values[index + 1]) * 0.5, 0.23);
    }
    for (let index = 0; index < values.length - 1; index += 1) {
      const length = Math.max(1, Math.hypot(points[index + 1][0] - points[index][0], points[index + 1][1] - points[index][1]));
      const maximumDelta = length * maximumGrade;
      const delta = values[index + 1] - values[index];
      if (Math.abs(delta) <= maximumDelta) continue;
      if (!locked.has(index + 1)) values[index + 1] = values[index] + Math.sign(delta) * maximumDelta;
      else if (!locked.has(index)) values[index] = values[index + 1] - Math.sign(delta) * maximumDelta;
    }
    for (let index = values.length - 2; index >= 0; index -= 1) {
      const length = Math.max(1, Math.hypot(points[index + 1][0] - points[index][0], points[index + 1][1] - points[index][1]));
      const maximumDelta = length * maximumGrade;
      const delta = values[index] - values[index + 1];
      if (Math.abs(delta) <= maximumDelta) continue;
      if (!locked.has(index)) values[index] = values[index + 1] + Math.sign(delta) * maximumDelta;
      else if (!locked.has(index + 1)) values[index + 1] = values[index] - Math.sign(delta) * maximumDelta;
    }
  }
  return values;
}

export function createExpansionHeightModel(manifest, options = {}) {
  const index = createWorldCoreIndex(manifest);
  const coreSampleHeight = typeof options.coreSampleHeight === 'function' ? options.coreSampleHeight : () => NaN;
  const ridges = manifest.terrainForms.ridges.map(item => ({ ...item, compiled: compilePolyline(item.points), bounds: boundsForPoints(item.points, item.halfWidthMeters) }));
  const valleys = manifest.terrainForms.valleys.map(item => ({ ...item, compiled: compilePolyline(item.points), bounds: boundsForPoints(item.points, item.halfWidthMeters) }));
  const escarpments = (manifest.terrainForms.escarpments || []).map(item => ({ ...item, compiled: compilePolyline(item.points), bounds: boundsForPoints(item.points, item.halfWidthMeters) }));
  const shoreline = { ...manifest.water.shoreline, compiled: compilePolyline(manifest.water.shoreline.points) };
  const rivers = [...index.rivers.values()].map(river => ({ ...river, bounds: boundsForPoints(river.points, river.bankWidthMeters * 0.6) }));

  function regionTerrain(x, z) {
    const seed = manifest.seed;
    const broad = fbm2(x * 0.00019, z * 0.00019, seed, 6);
    const rolling = fbm2(x * 0.00052 + 11.7, z * 0.00052 - 9.4, seed + 97, 5);
    const fine = fbm2(x * 0.00175 - 3.1, z * 0.00175 + 4.8, seed + 271, 3);
    let height = 76 + broad * 58 + rolling * 23 + fine * 5.2;
    let regionWeight = 0;
    for (const region of manifest.regions) {
      if (region.kind === 'inherited-core') continue;
      const influence = ellipseInfluence(x, z, region.center, region.radius, 0.34);
      if (influence <= 0) continue;
      const heading = (region.ridgeHeadingDegrees || 0) * Math.PI / 180;
      const rx = (x * Math.cos(heading) - z * Math.sin(heading)) * 0.00067;
      const rz = (x * Math.sin(heading) + z * Math.cos(heading)) * 0.00067;
      const ridge = ridgedNoise2(rx, rz, seed + region.id.length * 37, 5);
      const relief = (ridge - 0.43) * (region.reliefMeters || 0);
      const target = 76 + (region.baseOffsetMeters || 0) + relief;
      height = lerp(height, target, influence * 0.78);
      regionWeight = Math.max(regionWeight, influence);
    }
    height += polylineForm(x, z, ridges, 'heightMeters');
    height -= polylineForm(x, z, valleys, 'depthMeters');
    for (const form of escarpments) {
      if (!pointNearBounds(x, z, form.bounds)) continue;
      const nearest = nearestPointOnPolyline(x, z, form.compiled);
      const influence = 1 - smoothstep(form.halfWidthMeters * 0.15, form.halfWidthMeters, nearest.distance);
      const side = formSide(x, z, form, nearest);
      height += influence * form.heightMeters * side * 0.5;
    }
    return height + regionWeight * rolling * 9;
  }

  function applyPlateaus(x, z, height) {
    let result = height;
    for (const plateau of manifest.terrainForms.plateaus) {
      const dx = Math.abs(x - plateau.center[0]) / plateau.radius[0];
      const dz = Math.abs(z - plateau.center[1]) / plateau.radius[1];
      const normalized = Math.max(dx, dz);
      const featherRatio = plateau.featherMeters / Math.max(plateau.radius[0], plateau.radius[1]);
      const influence = 1 - smoothstep(1 - featherRatio, 1, normalized);
      result = lerp(result, plateau.elevationMeters, influence);
    }
    return result;
  }

  function applyBasins(x, z, height) {
    let result = height;
    for (const basin of manifest.terrainForms.basins || []) {
      const influence = ellipseInfluence(x, z, basin.center, basin.radius, basin.featherMeters / Math.max(basin.radius[0], basin.radius[1]));
      result -= influence * basin.depthMeters;
    }
    return result;
  }

  function waterSurfaceAt(x, z) {
    let lakeSurface = null;
    for (const lake of manifest.water.lakes) {
      const nx = (x - lake.center[0]) / lake.radius[0];
      const nz = (z - lake.center[1]) / lake.radius[1];
      if (nx * nx + nz * nz <= 1) lakeSurface = lakeSurface == null ? lake.surfaceMeters : Math.max(lakeSurface, lake.surfaceMeters);
    }
    if (lakeSurface != null) return lakeSurface;
    let best = null;
    for (const river of rivers) {
      if (!pointNearBounds(x, z, river.bounds)) continue;
      const nearest = nearestPointOnPolyline(x, z, river.compiled);
      if (nearest.distance <= river.bankWidthMeters * 0.5) {
        const surface = riverSurface(river, nearest);
        best = best == null ? surface : Math.max(best, surface);
      }
    }
    const shore = nearestPointOnPolyline(x, z, shoreline.compiled);
    if (z < shore.z && shore.distance < 2400) best = best == null ? manifest.water.seaLevelMeters : Math.max(best, manifest.water.seaLevelMeters);
    return best;
  }

  function applyHydrology(x, z, height) {
    let result = height;
    for (const lake of manifest.water.lakes) {
      const nx = (x - lake.center[0]) / lake.radius[0];
      const nz = (z - lake.center[1]) / lake.radius[1];
      const d = Math.sqrt(nx * nx + nz * nz);
      const influence = 1 - smoothstep(1, 1 + lake.shoreFeatherMeters / Math.max(lake.radius[0], lake.radius[1]), d);
      result = lerp(result, lake.floorMeters, influence);
    }
    for (const river of rivers) {
      if (!pointNearBounds(x, z, river.bounds)) continue;
      const nearest = nearestPointOnPolyline(x, z, river.compiled);
      const halfBank = river.bankWidthMeters * 0.5;
      const influence = 1 - smoothstep(river.bedWidthMeters * 0.5, halfBank, nearest.distance);
      if (influence > 0) result = Math.min(result, riverSurface(river, nearest) - river.bedDepthMeters * influence);
    }
    const shore = nearestPointOnPolyline(x, z, shoreline.compiled);
    const seaSide = z < shore.z;
    if (seaSide) {
      const depth = smoothstep(0, shoreline.shelfDepthMeters * 95, shore.distance) * shoreline.shelfDepthMeters;
      result = Math.min(result, manifest.water.seaLevelMeters - 1.2 - depth);
    } else {
      const beach = 1 - smoothstep(0, shoreline.beachWidthMeters, shore.distance);
      result = lerp(result, manifest.water.seaLevelMeters + 2.5, beach * 0.72);
    }
    return result;
  }

  function baseExpansionHeight(x, z) {
    let height = regionTerrain(x, z);
    height = applyPlateaus(x, z, height);
    height = applyBasins(x, z, height);
    height = applyHydrology(x, z, height);
    return height;
  }

  const bridgeProfiles = new Map();
  for (const bridge of manifest.bridges) {
    const road = index.roads.get(bridge.roadId);
    const river = index.rivers.get(bridge.riverId);
    const a = road.points[bridge.segmentIndex];
    const b = road.points[bridge.segmentIndex + 1];
    const midpoint = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    const water = waterSurfaceAt(midpoint[0], midpoint[1]) ?? riverSurface(river, nearestPointOnPolyline(midpoint[0], midpoint[1], river.compiled));
    const baseA = baseExpansionHeight(a[0], a[1]);
    const baseB = baseExpansionHeight(b[0], b[1]);
    const minimumDeck = water + bridge.clearanceMeters;
    const span = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
    const maximumDeckDelta = span * 0.025;
    const deckDelta = clamp(baseB - baseA, -maximumDeckDelta, maximumDeckDelta);
    const preferredDeck = Math.max(
      minimumDeck + Math.abs(deckDelta) * 0.5,
      Math.min((baseA + baseB) * 0.5, minimumDeck + 55),
    );
    bridgeProfiles.set(bridge.id, Object.freeze({
      bridge,
      a,
      b,
      water,
      baseA,
      baseB,
      targetA: preferredDeck - deckDelta * 0.5,
      targetB: preferredDeck + deckDelta * 0.5,
    }));
  }

  const roadProfiles = new Map();
  for (const road of index.roads.values()) {
    const heights = road.points.map(point => {
      if (pointInBounds(point[0], point[1], manifest.legacyCoreBounds)) {
        const core = coreSampleHeight(point[0], point[1]);
        if (Number.isFinite(core)) return core;
      }
      return baseExpansionHeight(point[0], point[1]);
    });
    const locked = new Set();
    road.points.forEach((point, pointIndex) => {
      if (pointInBounds(point[0], point[1], manifest.legacyCoreBounds)) locked.add(pointIndex);
    });
    for (const bridge of manifest.bridges.filter(item => item.roadId === road.id)) {
      const profile = bridgeProfiles.get(bridge.id);
      heights[bridge.segmentIndex] = profile.targetA;
      heights[bridge.segmentIndex + 1] = profile.targetB;
      locked.add(bridge.segmentIndex);
      locked.add(bridge.segmentIndex + 1);
    }
    for (const airfield of manifest.airfields) {
      road.points.forEach((point, pointIndex) => {
        if (Math.hypot(point[0] - airfield.center[0], point[1] - airfield.center[1]) > 8) return;
        heights[pointIndex] = airfield.elevationMeters + 0.24;
        locked.add(pointIndex);
      });
    }
    gradeClamp(heights, road.points, locked, DEFAULT_ROAD_GRADE[road.class] || DEFAULT_ROAD_GRADE.secondary);
    const segments = road.compiled.segments.map((segment, segmentIndex) => Object.freeze({
      ...segment,
      segmentIndex,
      heightA: heights[segmentIndex],
      heightB: heights[segmentIndex + 1],
      bridge: index.bridgeSegments.get(`${road.id}:${segmentIndex}`) || null,
    }));
    const shoulderMeters = DEFAULT_ROAD_SHOULDER[road.class] || 4;
    const earthworkWidthMeters = road.widthMeters * 0.5 + shoulderMeters + (road.class === 'primary' ? 18 : 12);
    roadProfiles.set(road.id, Object.freeze({
      id: road.id,
      class: road.class,
      widthMeters: road.widthMeters,
      shoulderMeters,
      earthworkWidthMeters,
      bounds: boundsForPoints(road.points, earthworkWidthMeters),
      points: road.points,
      heights: Object.freeze(heights),
      compiled: road.compiled,
      segments: Object.freeze(segments),
    }));
  }

  function roadSurfaceAt(x, z) {
    let best = null;
    for (const profile of roadProfiles.values()) {
      if (!pointNearBounds(x, z, profile.bounds)) continue;
      const nearest = nearestPointOnPolyline(x, z, profile.compiled);
      if (nearest.distance > profile.earthworkWidthMeters) continue;
      const segment = profile.segments[nearest.segmentIndex];
      if (!segment) continue;
      const target = lerp(segment.heightA, segment.heightB, nearest.t);
      const candidate = {
        roadId: profile.id,
        class: profile.class,
        segmentIndex: nearest.segmentIndex,
        distance: nearest.distance,
        signedDistance: signedDistanceToSegment(x, z, segment, nearest),
        height: target,
        bridge: segment.bridge,
        profile,
        nearest,
      };
      if (!best || candidate.distance < best.distance) best = candidate;
    }
    return best;
  }

  function applyRoadEarthworks(x, z, height) {
    const surface = roadSurfaceAt(x, z);
    if (!surface || surface.bridge) return height;
    const coreHalf = surface.profile.widthMeters * 0.5 + surface.profile.shoulderMeters;
    const influence = 1 - smoothstep(coreHalf, surface.profile.earthworkWidthMeters, surface.distance);
    const centerInfluence = 1 - smoothstep(0, coreHalf, surface.distance);
    const crown = Math.abs(surface.signedDistance) * (surface.class === 'primary' ? 0.008 : 0.011);
    const water = waterSurfaceAt(x, z);
    const supportedHeight = water == null ? surface.height : Math.max(surface.height, water + 1.6);
    const roadBed = supportedHeight - 0.06 + crown;
    const strength = Math.max(centerInfluence, influence * (surface.class === 'service' ? 0.78 : 0.92));
    return lerp(height, roadBed, strength);
  }

  const settlementProfiles = manifest.settlements.map(settlement => {
    let centerHeight = baseExpansionHeight(settlement.center[0], settlement.center[1]);
    centerHeight = applyRoadEarthworks(settlement.center[0], settlement.center[1], centerHeight);
    return Object.freeze({
      ...settlement,
      centerHeight,
      terraceStepMeters: settlement.kind.includes('mountain') ? 2.4 : settlement.kind.includes('industrial') || settlement.kind.includes('port') ? 1.2 : 1.6,
    });
  });

  function applySettlementTerraces(x, z, height) {
    let result = height;
    if (waterSurfaceAt(x, z) != null) return result;
    for (const settlement of settlementProfiles) {
      const influence = ellipseInfluence(x, z, settlement.center, settlement.radius, 0.28);
      if (influence <= 0) continue;
      const local = localCoordinates(x, z, settlement.center, settlement.streetHeadingDegrees || 0);
      const blockBand = Math.round(local.forward / 120);
      const target = settlement.centerHeight + blockBand * settlement.terraceStepMeters * 0.38;
      const road = roadSurfaceAt(x, z);
      const roadPreserve = road ? smoothstep(0, road.profile.earthworkWidthMeters, road.distance) : 1;
      result = lerp(result, target, influence * 0.76 * roadPreserve);
    }
    return result;
  }

  function applyAirfields(x, z, height) {
    let result = height;
    for (const airfield of manifest.airfields) {
      const local = localCoordinates(x, z, airfield.center, airfield.headingDegrees);
      const halfLength = airfield.runwayLengthMeters * 0.5;
      const shoulder = airfield.site?.shoulderMeters || 18;
      const overrun = airfield.site?.overrunMeters || 120;
      const halfWidth = airfield.runwayWidthMeters * 0.5 + shoulder;
      const longitudinal = Math.abs(local.forward);
      const lateral = Math.abs(local.right);
      const runwayInfluence = (1 - smoothstep(halfLength + overrun, halfLength + overrun + 190, longitudinal)) *
        (1 - smoothstep(halfWidth, halfWidth + 170, lateral));
      const approachInfluence = (1 - smoothstep(halfLength + airfield.approachLengthMeters, halfLength + airfield.approachLengthMeters + 260, longitudinal)) *
        (1 - smoothstep(airfield.clearWidthMeters * 0.5, airfield.clearWidthMeters * 0.5 + 240, lateral));
      const beyond = Math.max(0, longitudinal - halfLength);
      const crossfall = Math.max(0, lateral - airfield.runwayWidthMeters * 0.5) * (airfield.site?.drainageCrossfall || 0.01);
      const target = airfield.elevationMeters + Math.min(12, beyond * 0.0045) - crossfall;
      result = lerp(result, target, Math.max(runwayInfluence, approachInfluence * 0.82));
    }
    return result;
  }

  function preserveWaterBeds(x, z, height) {
    let result = height;
    const road = roadSurfaceAt(x, z);
    const roadCore = road && !road.bridge &&
      road.distance <= road.profile.widthMeters * 0.5 + road.profile.shoulderMeters + 1.5;
    const protectedBridgeEndpoint = [...bridgeProfiles.values()].some(profile =>
      Math.hypot(x - profile.a[0], z - profile.a[1]) <= Math.max(18, profile.bridge.deckWidthMeters * 1.4) ||
      Math.hypot(x - profile.b[0], z - profile.b[1]) <= Math.max(18, profile.bridge.deckWidthMeters * 1.4));
    for (const lake of manifest.water.lakes) {
      const nx = (x - lake.center[0]) / lake.radius[0];
      const nz = (z - lake.center[1]) / lake.radius[1];
      if (!roadCore && nx * nx + nz * nz <= 1) result = Math.min(result, lake.floorMeters);
    }
    for (const river of rivers) {
      if (!pointNearBounds(x, z, river.bounds)) continue;
      const nearest = nearestPointOnPolyline(x, z, river.compiled);
      if (nearest.distance > river.bedWidthMeters * 0.5) continue;
      const surface = riverSurface(river, nearest);
      const bridgeRamp = road?.bridge && (road.nearest.t < 0.16 || road.nearest.t > 0.84);
      if (!roadCore && !bridgeRamp && !protectedBridgeEndpoint) result = Math.min(result, surface - river.bedDepthMeters);
    }
    const shore = nearestPointOnPolyline(x, z, shoreline.compiled);
    if (!roadCore && z < shore.z) result = Math.min(result, manifest.water.seaLevelMeters - 1.2);
    return result;
  }

  function applyBridgeAbutments(x, z, height) {
    let result = height;
    for (const profile of bridgeProfiles.values()) {
      const radius = Math.max(16, profile.bridge.deckWidthMeters * 1.25);
      const distanceA = Math.hypot(x - profile.a[0], z - profile.a[1]);
      const distanceB = Math.hypot(x - profile.b[0], z - profile.b[1]);
      if (distanceA < radius) result = lerp(result, profile.targetA, 1 - smoothstep(0, radius, distanceA));
      if (distanceB < radius) result = lerp(result, profile.targetB, 1 - smoothstep(0, radius, distanceB));
    }
    return result;
  }

  function expansionHeight(x, z) {
    let height = baseExpansionHeight(x, z);
    height = applyRoadEarthworks(x, z, height);
    height = applySettlementTerraces(x, z, height);
    height = applyAirfields(x, z, height);
    height = preserveWaterBeds(x, z, height);
    height = applyBridgeAbutments(x, z, height);
    return height;
  }

  function sampleHeight(x, z) {
    if (!pointInBounds(x, z, manifest.bounds)) return NaN;
    if (pointInBounds(x, z, manifest.legacyCoreBounds)) {
      const core = coreSampleHeight(x, z);
      return Number.isFinite(core) ? core : expansionHeight(x, z);
    }
    const expanded = expansionHeight(x, z);
    const seamDistance = distanceOutsideBounds(x, z, manifest.legacyCoreBounds);
    if (seamDistance < CORE_SEAM_METERS) {
      const boundary = clampToBounds(x, z, manifest.legacyCoreBounds);
      const core = coreSampleHeight(boundary[0], boundary[1]);
      if (Number.isFinite(core)) return lerp(core, expanded, smoothstep(0, CORE_SEAM_METERS, seamDistance));
    }
    return expanded;
  }

  function sampleSlope(x, z, spacing = 12) {
    const left = sampleHeight(x - spacing, z);
    const right = sampleHeight(x + spacing, z);
    const back = sampleHeight(x, z - spacing);
    const front = sampleHeight(x, z + spacing);
    if (![left, right, back, front].every(Number.isFinite)) return NaN;
    return Math.hypot((right - left) / (spacing * 2), (front - back) / (spacing * 2));
  }

  function infrastructureInfluenceAt(x, z) {
    const road = roadSurfaceAt(x, z);
    let roadInfluence = 0;
    if (road && !road.bridge) roadInfluence = 1 - smoothstep(road.profile.widthMeters * 0.5, road.profile.earthworkWidthMeters, road.distance);
    let settlementInfluence = 0;
    for (const settlement of settlementProfiles) settlementInfluence = Math.max(settlementInfluence, ellipseInfluence(x, z, settlement.center, settlement.radius, 0.25));
    let airfieldInfluence = 0;
    for (const airfield of manifest.airfields) {
      const local = localCoordinates(x, z, airfield.center, airfield.headingDegrees);
      airfieldInfluence = Math.max(airfieldInfluence,
        (1 - smoothstep(airfield.runwayLengthMeters * 0.55, airfield.runwayLengthMeters * 0.75, Math.abs(local.forward))) *
        (1 - smoothstep(airfield.clearWidthMeters * 0.42, airfield.clearWidthMeters * 0.62, Math.abs(local.right))));
    }
    return { road: roadInfluence, settlement: settlementInfluence, airfield: airfieldInfluence };
  }

  const biome = createBiomeModel(manifest, index);

  return Object.freeze({
    manifest,
    index,
    biome,
    roadProfiles,
    bridgeProfiles,
    settlementProfiles: Object.freeze(settlementProfiles),
    sampleHeight,
    sampleSlope,
    roadSurfaceAt,
    waterSurfaceAt,
    infrastructureInfluenceAt,
    isInsideWorld: (x, z) => pointInBounds(x, z, manifest.bounds),
    isInsideCore: (x, z) => pointInBounds(x, z, manifest.legacyCoreBounds),
  });
}
