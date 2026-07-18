import { fromRunwayLocal, toRunwayLocal } from './airfieldGeometry.js';

function safeHeight(sampleHeight, x, z) { const value = Number(sampleHeight?.(x, z)); return Number.isFinite(value) ? value : 0; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }

export function sampleTerrainGrid(field, sampleHeight, options = {}) {
  const station = Math.max(8, Number(options.stationMeters ?? field.surface.profileStationMeters) || 20);
  const alongSteps = Math.max(4, Math.ceil(field.length / station));
  const lateralSteps = Math.max(2, Math.floor(options.lateralSteps ?? 4));
  const rows = [];
  const samples = [];
  for (let ai = 0; ai <= alongSteps; ai += 1) {
    const along = -field.length / 2 + field.length * ai / alongSteps;
    const row = [];
    for (let li = 0; li <= lateralSteps; li += 1) {
      const lateral = -field.width / 2 + field.width * li / lateralSteps;
      const world = fromRunwayLocal(field, { along, lateral });
      const sample = { along, lateral, x: world.x, z: world.z, y: safeHeight(sampleHeight, world.x, world.z) };
      row.push(sample); samples.push(sample);
    }
    rows.push(row);
  }
  return Object.freeze({ rows: Object.freeze(rows.map(row => Object.freeze(row))), samples: Object.freeze(samples), stationMeters: field.length / alongSteps });
}

function smoothProfile(values, passes) {
  let profile = [...values];
  for (let pass = 0; pass < passes; pass += 1) {
    const next = [...profile];
    for (let index = 1; index < profile.length - 1; index += 1) next[index] = (profile[index - 1] + profile[index] * 2 + profile[index + 1]) / 4;
    profile = next;
  }
  return profile;
}

function enforceGrade(profile, floor, stationMeters, maxGrade) {
  const result = [...profile];
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 1; i < result.length; i += 1) result[i] = Math.min(result[i], result[i - 1] + maxGrade * stationMeters);
    for (let i = result.length - 2; i >= 0; i -= 1) result[i] = Math.min(result[i], result[i + 1] + maxGrade * stationMeters);
    for (let i = 0; i < result.length; i += 1) result[i] = Math.max(result[i], floor[i]);
  }
  return result;
}

export function fitRunwayProfile(field, sampleHeight, options = {}) {
  const grid = sampleTerrainGrid(field, sampleHeight, options);
  const clearance = Number(field.surface.clearance) || 0;
  const floor = grid.rows.map(row => Math.max(...row.map(sample => sample.y)) + clearance);
  const smoothed = smoothProfile(floor, Math.max(0, Math.floor(field.surface.profileSmoothingPasses || 0)));
  const heights = enforceGrade(smoothed, floor, grid.stationMeters, field.surface.maxLongitudinalGrade);
  const stations = heights.map((height, index) => Object.freeze({ along: grid.rows[index][0].along, height }));
  let maxGrade = 0, maxCross = 0, maxEarthwork = 0, minClearance = Infinity, maxClearance = -Infinity;
  for (let index = 0; index < stations.length; index += 1) {
    if (index) maxGrade = Math.max(maxGrade, Math.abs(stations[index].height - stations[index - 1].height) / grid.stationMeters);
    const row = grid.rows[index];
    maxCross = Math.max(maxCross, (Math.max(...row.map(s => s.y)) - Math.min(...row.map(s => s.y))) / Math.max(field.width, 1));
    for (const sample of row) {
      const delta = stations[index].height - sample.y;
      maxEarthwork = Math.max(maxEarthwork, Math.abs(delta));
      minClearance = Math.min(minClearance, delta);
      maxClearance = Math.max(maxClearance, delta);
    }
  }
  const roughness = maxClearance - minClearance;
  const issues = [];
  if (maxGrade > field.surface.maxLongitudinalGrade + 1e-8) issues.push('longitudinal-grade');
  if (maxCross > field.surface.maxCrossGrade) issues.push('cross-grade');
  if (roughness > field.surface.maxRoughness) issues.push('terrain-roughness');
  if (maxEarthwork > field.surface.maxEarthwork) issues.push('earthwork');
  return Object.freeze({
    mode: 'smoothed-longitudinal-profile', stations: Object.freeze(stations), stationMeters: grid.stationMeters,
    longitudinalGrade: maxGrade, crossGrade: maxCross, roughness, maxEarthwork,
    minimumClearance: minClearance, maximumClearance: maxClearance,
    operational: issues.length === 0, issues: Object.freeze(issues), sampleCount: grid.samples.length,
  });
}

export function fitRunwayPlane(field, sampleHeight, options = {}) {
  const profile = fitRunwayProfile(field, sampleHeight, options);
  const first = profile.stations[0], last = profile.stations.at(-1);
  const slopeAlong = (last.height - first.height) / Math.max(field.length, 1);
  const base = interpolateProfile(profile, 0);
  return Object.freeze({ ...profile, base, slopeAlong, slopeLateral: 0, maximumResidual: profile.maxEarthwork });
}

function interpolateProfile(profile, along) {
  const stations = profile.stations;
  if (along <= stations[0].along) return stations[0].height;
  if (along >= stations.at(-1).along) return stations.at(-1).height;
  let low = 0, high = stations.length - 1;
  while (high - low > 1) { const middle = (low + high) >> 1; if (stations[middle].along <= along) low = middle; else high = middle; }
  const a = stations[low], b = stations[high];
  return lerp(a.height, b.height, clamp((along - a.along) / Math.max(1e-9, b.along - a.along), 0, 1));
}

export function resolveAirfield(field, sampleHeight, options = {}) {
  const terrainFit = fitRunwayProfile(field, sampleHeight, options);
  const centerHeight = interpolateProfile(terrainFit, 0);
  return Object.freeze({ ...field, x: field.center.x, z: field.center.z, surfaceY: centerHeight, slopeAlong: 0, slopeLateral: 0, terrainFit });
}
export function resolveAirfields(catalog, sampleHeight, options = {}) { return Object.freeze(catalog.fields.map(field => resolveAirfield(field, sampleHeight, options))); }
export function runwaySurfaceHeight(field, positionOrLocal) {
  const local = positionOrLocal && ('along' in positionOrLocal || 'lateral' in positionOrLocal) ? positionOrLocal : toRunwayLocal(field, positionOrLocal);
  if (field.terrainFit?.stations) return interpolateProfile(field.terrainFit, Number(local.along) || 0);
  return field.surfaceY + (field.slopeAlong || 0) * (Number(local.along) || 0) + (field.slopeLateral || 0) * (Number(local.lateral) || 0);
}
export function runwaySurfaceGrid(field, segments = 20) {
  const count = Math.max(1, Math.floor(segments)); const vertices = []; const indices = [];
  for (let index = 0; index <= count; index += 1) {
    const along = -field.length / 2 + field.length * index / count;
    for (const lateral of [-field.width / 2, field.width / 2]) {
      const world = fromRunwayLocal(field, { along, lateral });
      vertices.push(Object.freeze({ x: world.x, y: runwaySurfaceHeight(field, { along, lateral }), z: world.z, along, lateral }));
    }
    if (index < count) { const base = index * 2; indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); }
  }
  return Object.freeze({ vertices: Object.freeze(vertices), indices: Object.freeze(indices), segments: count });
}
export function runwayEarthworkSkirt(field, sampleHeight, segments = 20) {
  const vertices = [];
  const indices = [];
  const addEdge = (points) => {
    const offset = vertices.length;
    for (const point of points) {
      const world = fromRunwayLocal(field, point);
      vertices.push(
        Object.freeze({ x: world.x, y: runwaySurfaceHeight(field, point), z: world.z, ...point }),
        Object.freeze({ x: world.x, y: safeHeight(sampleHeight, world.x, world.z) - 0.15, z: world.z, ...point }),
      );
    }
    for (let index = 0; index < points.length - 1; index += 1) {
      const base = offset + index * 2;
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  };

  const longCount = Math.max(1, Math.floor(segments));
  for (const lateral of [-field.width / 2, field.width / 2]) {
    const points = [];
    for (let index = 0; index <= longCount; index += 1) {
      points.push({
        along: -field.length / 2 + field.length * index / longCount,
        lateral,
      });
    }
    addEdge(points);
  }

  const crossCount = Math.max(2, Math.ceil(field.width / 10));
  for (const along of [-field.length / 2, field.length / 2]) {
    const points = [];
    for (let index = 0; index <= crossCount; index += 1) {
      points.push({
        along,
        lateral: -field.width / 2 + field.width * index / crossCount,
      });
    }
    addEdge(points);
  }

  return Object.freeze({
    vertices: Object.freeze(vertices),
    indices: Object.freeze(indices),
  });
}
export function terrainFitSummary(fields) { return fields.map(field => ({ id: field.id, operational: field.terrainFit.operational, issues: [...field.terrainFit.issues], longitudinalGrade: field.terrainFit.longitudinalGrade, crossGrade: field.terrainFit.crossGrade, roughness: field.terrainFit.roughness, maxEarthwork: field.terrainFit.maxEarthwork, sampleCount: field.terrainFit.sampleCount })); }
