import { estimateStoppingDistance } from './landingMath.js';
import { aircraftAllowed, directionAllowed, runwayAvailableLength } from './operations.js';

export function estimateTakeoffDistance(profile, surface) {
  if (!(profile.enginePower > 0) || !Number.isFinite(profile.takeoffSpeed)) return Infinity;
  const rolling = profile.rollingDrag * (Number(surface?.rollingDragScale) || 1);
  const acceleration = Math.max(0.4, profile.enginePower * 0.72 - rolling);
  return profile.takeoffSpeed * profile.takeoffSpeed / (2 * acceleration) * 1.25;
}
export function landingCapability(field, profile, sign = 1) {
  const allowed = aircraftAllowed(field, profile, 'landing') && directionAllowed(field, 'landing', sign);
  const available = runwayAvailableLength(field, sign, 'landing');
  const stop = estimateStoppingDistance({ speed: profile.touchdownSpeed * 1.04, profile, surface: field.surface, brake: 0.82 });
  return Object.freeze({ fieldId: field.id, aircraftId: profile.id, sign: sign >= 0 ? 1 : -1, operation: 'landing', allowed, availableLength: available, requiredLength: stop.total, margin: available - stop.total, capable: allowed && available >= stop.total });
}
export function takeoffCapability(field, profile, sign = 1) {
  const allowed = aircraftAllowed(field, profile, 'takeoff') && directionAllowed(field, 'takeoff', sign);
  const available = runwayAvailableLength(field, sign, 'takeoff'); const required = estimateTakeoffDistance(profile, field.surface);
  return Object.freeze({ fieldId: field.id, aircraftId: profile.id, sign: sign >= 0 ? 1 : -1, operation: 'takeoff', allowed, availableLength: available, requiredLength: required, margin: available - required, capable: allowed && available >= required });
}
export function capabilityMatrix(fields, profiles) {
  const rows = [];
  for (const field of fields) for (const profile of profiles) for (const sign of [-1, 1]) { rows.push(landingCapability(field, profile, sign)); rows.push(takeoffCapability(field, profile, sign)); }
  return Object.freeze(rows);
}
