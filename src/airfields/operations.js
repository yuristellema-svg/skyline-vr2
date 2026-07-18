import { runwayDirection } from './airfieldGeometry.js';

export function directionAllowed(field, operation, sign) {
  const list = operation === 'takeoff' ? field.operations.takeoffDirections : field.operations.landingDirections;
  return list.includes(sign >= 0 ? 1 : -1);
}

export function aircraftAllowed(field, profile, operation = 'landing') {
  const id = String(profile?.id || '');
  const list = operation === 'takeoff' ? field.operations.takeoffAircraft : field.operations.allowedAircraft;
  return list.includes(id);
}

export function runwayAvailableLength(field, sign = 1, operation = 'landing') {
  const normalized = sign >= 0 ? 1 : -1;
  const displaced = Number(field.operations.displacedThreshold?.[String(normalized)]) || 0;
  const overrun = operation === 'takeoff' ? 0 : Number(field.operations.overrun) || 0;
  return Math.max(0, field.length - displaced + overrun);
}

export function operationStatus(field, profile, operation, sign) {
  const direction = runwayDirection(field, sign);
  const reasons = [];
  if (!directionAllowed(field, operation, direction.sign)) reasons.push(`${operation}-direction-closed`);
  if (!aircraftAllowed(field, profile, operation)) reasons.push(`${operation}-aircraft-restricted`);
  if (field.terrainFit?.operational === false) reasons.push('terrain-fit-non-operational');
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons), direction, availableLength: runwayAvailableLength(field, direction.sign, operation) });
}
