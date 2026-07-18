import { DEFAULTS } from './constants.js';
import { orientedCorners } from './math.js';

function readHeight(sampleHeight, x, z) {
  const sample = sampleHeight(x, z);
  const value = typeof sample === 'number' ? sample : sample?.height;
  if (!Number.isFinite(value)) {
    throw new TypeError(`sampleHeight returned invalid height at ${x}, ${z}`);
  }
  return value;
}

export function sampleTerrainFootprint({
  sampleHeight,
  x,
  z,
  width,
  depth,
  yaw,
}) {
  const corners = orientedCorners(x, z, width, depth, yaw);
  const points = [[x, z], ...corners];
  const samples = points.map(point => readHeight(sampleHeight, point[0], point[1]));
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return Object.freeze({
    center: samples[0],
    corners: Object.freeze(samples.slice(1)),
    min,
    max,
    delta: max - min,
  });
}

export function createFoundationPlan({
  sampleHeight,
  x,
  z,
  width,
  depth,
  yaw,
  maxTerrainDelta = DEFAULTS.maxTerrainDelta,
  maxFoundationDepth = DEFAULTS.maxFoundationDepth,
}) {
  const terrain = sampleTerrainFootprint({ sampleHeight, x, z, width, depth, yaw });
  if (terrain.delta > maxTerrainDelta || terrain.delta + 0.8 > maxFoundationDepth) {
    return Object.freeze({ accepted: false, terrain });
  }
  const topY = terrain.max + 0.18;
  const bottomY = terrain.min - 0.62;
  const depthY = Math.max(0.8, topY - bottomY);
  return Object.freeze({
    accepted: true,
    terrain,
    topY,
    bottomY,
    centerY: bottomY + depthY * 0.5,
    depthY,
  });
}
