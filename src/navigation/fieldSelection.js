import { angleDifference, distanceToRunway, runwayDesignator, runwayDirection, thresholdForDirection, toRunwayLocal, velocityHeading } from '../airfields/airfieldGeometry.js';
import { runwaySurfaceHeight } from '../airfields/terrainFit.js';
import { operationStatus } from '../airfields/operations.js';

const DEG = Math.PI / 180;

export function approachCandidate(field, flight, sign = 1) {
  const direction = runwayDirection(field, sign);
  const operation = operationStatus(field, flight.aircraftProfile || { id: '' }, 'landing', direction.sign);
  const threshold = thresholdForDirection(field, sign);
  const displaced = Number(field.operations.displacedThreshold?.[String(direction.sign)]) || 0;
  const effectiveThresholdAlong = threshold.along + direction.sign * displaced;
  const local = toRunwayLocal(field, flight.position);
  const beforeThreshold = -direction.sign * (local.along - effectiveThresholdAlong);
  const travelLateral = local.lateral * direction.sign;
  const widening = Math.max(1, beforeThreshold / Math.max(field.length, 1));
  const halfWidth = field.width * 0.5 * Math.min(field.approach.corridorWidthMultiplier, 1.35 + widening * 0.8);
  const targetSurface = runwaySurfaceHeight(field, { along: effectiveThresholdAlong, lateral: 0 });
  const targetAltitude = targetSurface + Math.tan(field.approach.glideSlopeDegrees * DEG) * Math.max(0, beforeThreshold);
  const altitudeError = (Number(flight.position?.y) || 0) - targetAltitude;
  const heading = velocityHeading(flight.velocity);
  const headingError = Math.abs(angleDifference(heading, direction.heading));
  const withinCorridor = operation.allowed && beforeThreshold >= -field.operations.overrun && beforeThreshold <= field.approach.corridorLength && Math.abs(travelLateral) <= halfWidth && headingError <= 72 * DEG && (Number(flight.position?.y) || 0) - targetSurface <= field.approach.maxAltitude;
  const distance = Math.hypot(beforeThreshold, travelLateral);
  const score = distance + Math.abs(travelLateral) * 4 + Math.abs(altitudeError) * 1.8 + headingError * 340 + (withinCorridor ? -600 : 0) + (operation.allowed ? 0 : 100000);
  return Object.freeze({ field, sign: direction.sign, heading: direction.heading, runwayDesignator: runwayDesignator(direction.heading), threshold, effectiveThresholdAlong, local, beforeThreshold, lateralError: travelLateral, targetAltitude, altitudeError, headingError, halfWidth, withinCorridor, distance, score, operation });
}

export function bestApproachForField(field, flight) {
  const candidates = field.operations.landingDirections.map(sign => approachCandidate(field, flight, sign));
  return candidates.sort((a, b) => a.score - b.score)[0];
}

export function nearestField(fields, position) {
  let nearest = null, distance = Infinity;
  for (const field of fields) { const next = distanceToRunway(field, position); if (next < distance) { nearest = field; distance = next; } }
  return Object.freeze({ field: nearest, distance });
}

export function departureCandidate(field, flight, sign = 1) {
  const direction = runwayDirection(field, sign);
  const operation = operationStatus(field, flight.aircraftProfile || { id: '' }, 'takeoff', direction.sign);
  const local = toRunwayLocal(field, flight.position);
  const departureEndAlong = direction.sign * field.length / 2;
  const distanceAfterEnd = direction.sign * (local.along - departureEndAlong);
  const lateralError = local.lateral * direction.sign;
  const halfWidth = Math.min(field.width * 2.2, field.width * 0.65 + Math.max(0, distanceAfterEnd) * 0.12);
  const endSurface = runwaySurfaceHeight(field, { along: departureEndAlong, lateral: 0 });
  const altitudeAboveEnd = (Number(flight.position?.y) || 0) - endSurface;
  const headingError = Math.abs(angleDifference(velocityHeading(flight.velocity), direction.heading));
  const withinCorridor = operation.allowed && distanceAfterEnd >= -field.operations.overrun && distanceAfterEnd <= field.approach.departureLength && Math.abs(lateralError) <= halfWidth && headingError <= 55 * DEG && altitudeAboveEnd >= -5 && altitudeAboveEnd <= field.approach.maxAltitude;
  const score = Math.abs(distanceAfterEnd) + Math.abs(lateralError) * 4 + headingError * 300 + (withinCorridor ? -500 : 0) + (operation.allowed ? 0 : 100000);
  return Object.freeze({ field, sign: direction.sign, heading: direction.heading, runwayDesignator: runwayDesignator(direction.heading), local, departureEndAlong, distanceAfterEnd, lateralError, altitudeAboveEnd, headingError, halfWidth, withinCorridor, score, operation });
}
export function bestDepartureForField(field, flight) { return field.operations.takeoffDirections.map(sign => departureCandidate(field, flight, sign)).sort((a, b) => a.score - b.score)[0]; }
