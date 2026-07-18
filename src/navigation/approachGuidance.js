import { bestApproachForField, bestDepartureForField, nearestField } from './fieldSelection.js';
import { distanceToRunway } from '../airfields/airfieldGeometry.js';
import { runwaySurfaceHeight } from '../airfields/terrainFit.js';
import { strongestRadio } from './radioNavigation.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function papiState(altitudeError, tolerance = 2.8) {
  if (altitudeError > tolerance * 2) return 'four-white';
  if (altitudeError > tolerance) return 'three-white';
  if (altitudeError < -tolerance * 2) return 'four-red';
  if (altitudeError < -tolerance) return 'three-red';
  return 'two-white-two-red';
}
export function selectGuidanceTarget(fields, flight, selectedFieldId = '') {
  if (!Array.isArray(fields) || !fields.length || !flight?.position) return null;
  const selected = selectedFieldId ? fields.find(field => field.id === selectedFieldId) : null;
  const candidates = (selected ? [selected] : fields).map(field => bestApproachForField(field, flight)).sort((a, b) => a.score - b.score);
  const best = candidates[0]; const nearest = nearestField(fields, flight.position); const field = selected || (best.withinCorridor ? best.field : nearest.field);
  return field === best.field ? best : bestApproachForField(field, flight);
}
export function guidanceStatus(fields, flight, selectedFieldId = '') {
  const target = selectGuidanceTarget(fields, flight, selectedFieldId);
  if (!target) return Object.freeze({ id: '', name: '', distance: Infinity, approach: false, selected: false });
  const surface = runwaySurfaceHeight(target.field, target.local);
  const altitudeAboveRunway = (Number(flight.position?.y) || 0) - surface;
  const distance = distanceToRunway(target.field, flight.position);
  const departureTarget = bestDepartureForField(target.field, flight);
  const approach = !flight.onGround && target.withinCorridor && target.beforeThreshold <= target.field.approach.corridorLength;
  const departure = !flight.onGround && !approach && departureTarget.withinCorridor;
  const radio = strongestRadio(fields, flight.position);
  return Object.freeze({
    id: target.field.id, name: target.field.name, shortName: target.field.shortName, kind: target.field.kind, distance, approach, departure,
    selected: target.field.id === selectedFieldId, operational: target.operation.allowed, operationReasons: target.operation.reasons,
    runwayDesignator: target.runwayDesignator, directionSign: target.sign, beforeThreshold: target.beforeThreshold,
    lateralError: target.lateralError, altitudeError: target.altitudeError, headingErrorDegrees: target.headingError * 180 / Math.PI,
    altitudeAboveRunway, departureDistance: departureTarget.distanceAfterEnd, departureLateralError: departureTarget.lateralError,
    departureHeadingErrorDegrees: departureTarget.headingError * 180 / Math.PI,
    papi: papiState(target.altitudeError), radio,
    cue: Object.freeze({ horizontal: clamp(target.lateralError / Math.max(target.halfWidth, 1), -1, 1), vertical: clamp(target.altitudeError / 80, -1, 1), heading: clamp(target.headingError / (Math.PI / 3), 0, 1), capture: approach, phase: approach ? 'approach' : departure ? 'departure' : radio?.inRange ? 'locator' : 'none' }),
    navigation: target.field.navigation,
  });
}
