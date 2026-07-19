import { fromRunwayLocal, toRunwayLocal } from './airfieldGeometry.js';

export function fieldExclusionMasks(fields) {
  return Object.freeze(fields.map(field => Object.freeze({
    id: field.id,
    kind: 'airfield-operational-surface',
    center: Object.freeze([field.center.x, field.center.z]),
    headingDegrees: field.headingDegrees,
    halfLength: field.length / 2 + field.operations.overrun + 35,
    halfWidth: field.width / 2 + field.operations.shoulder + 28,
    excludes: Object.freeze(['trees', 'rocks', 'buildings', 'roads', 'water-props']),
  })));
}

export function pointExcludedByAirfield(fields, x, z, padding = 0) {
  for (const field of fields) {
    const local = toRunwayLocal(field, { x, z });
    if (Math.abs(local.along) <= field.length / 2 + field.operations.overrun + 35 + padding && Math.abs(local.lateral) <= field.width / 2 + field.operations.shoulder + 28 + padding) return field.id;
  }
  return '';
}

export function approachCorridorPolygons(field, sign, samples = 6) {
  const result = []; const direction = sign >= 0 ? 1 : -1;
  for (let i = 0; i <= samples; i += 1) {
    const distance = field.approach.corridorLength * i / samples;
    const along = -direction * (field.length / 2 + distance);
    const halfWidth = field.width * 0.65 + distance * 0.13;
    result.push(Object.freeze({ distance, left: Object.freeze(fromRunwayLocal(field, { along, lateral: -halfWidth })), right: Object.freeze(fromRunwayLocal(field, { along, lateral: halfWidth })) }));
  }
  return Object.freeze(result);
}
