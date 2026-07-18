import { distanceToRunway, toRunwayLocal } from '../airfields/airfieldGeometry.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function radioSignal(field, position) {
  const distance = distanceToRunway(field, position); const range = Math.max(1, Number(field.navigation.range) || 1);
  const strength = clamp(1 - distance / range, 0, 1) ** 1.4;
  const local = toRunwayLocal(field, position);
  const bearing = Math.atan2(-local.lateral, -local.along);
  return Object.freeze({ fieldId: field.id, ident: field.navigation.ident, type: field.navigation.type, frequency: field.navigation.frequency, distance, strength, bearing, inRange: strength > 0 });
}
export function strongestRadio(fields, position) { return fields.map(field => radioSignal(field, position)).sort((a, b) => b.strength - a.strength || a.distance - b.distance)[0] || null; }
