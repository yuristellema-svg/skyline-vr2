import { fromRunwayLocal, thresholdForDirection } from './airfieldGeometry.js';
import { runwaySurfaceHeight } from './terrainFit.js';

const DEG = Math.PI / 180;
function safeHeight(sampleHeight, x, z) { const value = Number(sampleHeight?.(x, z)); return Number.isFinite(value) ? value : 0; }
export function requiredObstacleClearance(field, distance, maximum = null) {
  const cap = Number(maximum ?? (field.kind === 'mountain' ? 18 : 12));
  return Math.min(cap, 1.5 + Math.max(0, distance) * 0.045);
}
export function auditApproachClearance(field, sign, sampleHeight, options = {}) {
  const direction = sign >= 0 ? 1 : -1;
  const step = Math.max(20, Number(options.step ?? field.approach.obstacleSampleStep) || 80);
  const threshold = thresholdForDirection(field, direction);
  const displaced = Number(field.operations.displacedThreshold?.[String(direction)]) || 0;
  const thresholdAlong = threshold.along + direction * displaced;
  const thresholdY = runwaySurfaceHeight(field, { along: thresholdAlong, lateral: 0 });
  const samples = []; let minimumClearance = Infinity, minimumMargin = Infinity;
  for (let distance = step; distance <= field.approach.corridorLength; distance += step) {
    const along = thresholdAlong - direction * distance;
    const world = fromRunwayLocal(field, { along, lateral: 0 });
    const terrainY = safeHeight(sampleHeight, world.x, world.z);
    const pathY = thresholdY + Math.tan(field.approach.glideSlopeDegrees * DEG) * distance;
    const clearance = pathY - terrainY;
    const requiredClearance = requiredObstacleClearance(field, distance, options.requiredClearance);
    const margin = clearance - requiredClearance;
    minimumClearance = Math.min(minimumClearance, clearance); minimumMargin = Math.min(minimumMargin, margin);
    samples.push(Object.freeze({ distance, x: world.x, z: world.z, terrainY, pathY, clearance, requiredClearance, margin }));
  }
  return Object.freeze({ fieldId: field.id, sign: direction, minimumClearance, minimumMargin, operational: minimumMargin >= 0, samples: Object.freeze(samples), controllingSample: samples.reduce((best, sample) => !best || sample.margin < best.margin ? sample : best, null) });
}
export function auditFieldCorridors(field, sampleHeight, options = {}) { return Object.freeze(field.operations.landingDirections.map(sign => auditApproachClearance(field, sign, sampleHeight, options))); }
