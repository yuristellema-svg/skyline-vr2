export const TAU = Math.PI * 2;

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function angleDifference(a, b) {
  return normalizeAngle(a - b);
}

export function headingVector(heading) {
  return { x: Math.sin(heading), z: -Math.cos(heading) };
}

export function rightVector(heading) {
  return { x: Math.cos(heading), z: Math.sin(heading) };
}

export function velocityHeading(velocity) {
  return Math.atan2(Number(velocity?.x) || 0, -(Number(velocity?.z) || 0));
}

export function runwayCenter(field) {
  if (!field || typeof field !== 'object') {
    throw new TypeError('runway field is required');
  }

  const nested = field.center;
  const rawX = Array.isArray(nested) ? nested[0] : (nested?.x ?? field.x);
  const rawZ = Array.isArray(nested) ? nested[1] : (nested?.z ?? field.z);
  const x = Number(rawX);
  const z = Number(rawZ);

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new TypeError('runway field requires center.x/center.z or legacy x/z coordinates');
  }

  return { x, z };
}

export function toRunwayLocal(field, position) {
  const center = runwayCenter(field);
  const dx = (Number(position?.x) || 0) - center.x;
  const dz = (Number(position?.z) || 0) - center.z;
  const forward = headingVector(field.heading);
  const right = rightVector(field.heading);
  return {
    along: dx * forward.x + dz * forward.z,
    lateral: dx * right.x + dz * right.z,
  };
}

export function fromRunwayLocal(field, local) {
  const center = runwayCenter(field);
  const forward = headingVector(field.heading);
  const right = rightVector(field.heading);
  return {
    x: center.x + forward.x * local.along + right.x * local.lateral,
    z: center.z + forward.z * local.along + right.z * local.lateral,
  };
}

export function runwayEndpoints(field) {
  const half = field.length / 2;
  return Object.freeze({
    negative: Object.freeze(fromRunwayLocal(field, { along: -half, lateral: 0 })),
    positive: Object.freeze(fromRunwayLocal(field, { along: half, lateral: 0 })),
  });
}

export function runwayCorners(field, margin = 0) {
  const halfLength = field.length / 2 + margin;
  const halfWidth = field.width / 2 + margin;
  return Object.freeze([
    Object.freeze(fromRunwayLocal(field, { along: -halfLength, lateral: -halfWidth })),
    Object.freeze(fromRunwayLocal(field, { along: -halfLength, lateral: halfWidth })),
    Object.freeze(fromRunwayLocal(field, { along: halfLength, lateral: halfWidth })),
    Object.freeze(fromRunwayLocal(field, { along: halfLength, lateral: -halfWidth })),
  ]);
}

export function containsRunwayPoint(field, position, margin = 0) {
  const local = toRunwayLocal(field, position);
  return (
    Math.abs(local.along) <= field.length / 2 + margin &&
    Math.abs(local.lateral) <= field.width / 2 + margin
  );
}

export function distanceToRunway(field, position) {
  const local = toRunwayLocal(field, position);
  const alongOutside = Math.max(0, Math.abs(local.along) - field.length / 2);
  const lateralOutside = Math.max(0, Math.abs(local.lateral) - field.width / 2);
  return Math.hypot(alongOutside, lateralOutside);
}

export function runwayDirection(field, sign = 1) {
  const directionSign = sign >= 0 ? 1 : -1;
  const heading = normalizeAngle(field.heading + (directionSign < 0 ? Math.PI : 0));
  const forward = headingVector(heading);
  return Object.freeze({ sign: directionSign, heading, forward });
}

export function runwayDirectionForVelocity(field, velocity) {
  const forward = headingVector(field.heading);
  const dot = (Number(velocity?.x) || 0) * forward.x + (Number(velocity?.z) || 0) * forward.z;
  return runwayDirection(field, dot >= 0 ? 1 : -1);
}

export function thresholdForDirection(field, sign = 1) {
  const direction = runwayDirection(field, sign);
  const along = -direction.sign * field.length / 2;
  const point = fromRunwayLocal(field, { along, lateral: 0 });
  return Object.freeze({ ...point, along, direction });
}

export function distanceFromThreshold(field, local, sign = 1) {
  const directionSign = sign >= 0 ? 1 : -1;
  return directionSign * local.along + field.length / 2;
}

export function runwayDesignator(heading) {
  let value = Math.round(((normalizeAngle(heading) * 180 / Math.PI) + 360) % 360 / 10);
  if (value === 0) value = 36;
  return String(value).padStart(2, '0');
}
