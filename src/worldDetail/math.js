export function clamp(value, min, max) {
  const finite = Number.isFinite(Number(value)) ? Number(value) : min;
  return Math.max(min, Math.min(max, finite));
}

export function smoothstep(min, max, value) {
  if (max === min) return value >= max ? 1 : 0;
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(current, target, response, dt) {
  const safeDt = clamp(dt, 0, 0.25);
  return target + (current - target) * Math.exp(-Math.max(0, response) * safeDt);
}

export function hashText(text) {
  let hash = 2166136261;
  const value = String(text ?? '');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicUnit(value) {
  let hash = typeof value === 'number' ? value >>> 0 : hashText(value);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

export function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function safeHeight(sampleHeight, x, z, fallback = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return fallback;
  if (typeof sampleHeight !== 'function') return fallback;
  try {
    const value = Number(sampleHeight(x, z));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function sampleFootprint(sampleHeight, x, z, width, depth, fallback = 0) {
  const halfX = Math.max(0, width) * 0.5;
  const halfZ = Math.max(0, depth) * 0.5;
  const values = [
    safeHeight(sampleHeight, x, z, fallback),
    safeHeight(sampleHeight, x - halfX, z - halfZ, fallback),
    safeHeight(sampleHeight, x + halfX, z - halfZ, fallback),
    safeHeight(sampleHeight, x - halfX, z + halfZ, fallback),
    safeHeight(sampleHeight, x + halfX, z + halfZ, fallback),
  ];
  return Object.freeze({
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    spread: Math.max(...values) - Math.min(...values),
    values: Object.freeze(values),
  });
}

export function footprintIsUsable(sampleHeight, x, z, width, depth, {
  fallback = 0,
  waterLevel = -12,
  minimumAboveWater = 2.5,
  maximumSpread = 8,
} = {}) {
  const sample = sampleFootprint(sampleHeight, x, z, width, depth, fallback);
  return sample.min >= waterLevel + minimumAboveWater && sample.spread <= maximumSpread;
}

export function distance2d(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0));
}

export function pointSegmentDistance(x, z, a, b) {
  const ax = Number(a?.[0] ?? a?.x) || 0;
  const az = Number(a?.[2] ?? a?.z) || 0;
  const bx = Number(b?.[0] ?? b?.x) || 0;
  const bz = Number(b?.[2] ?? b?.z) || 0;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0
    ? clamp(((x - ax) * dx + (z - az) * dz) / lengthSq, 0, 1)
    : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

export function polylineDistance(points, x, z) {
  let distance = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    distance = Math.min(distance, pointSegmentDistance(x, z, points[index], points[index + 1]));
  }
  return distance;
}

export function quadraticPoint(start, control, end, t) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    z: inverse * inverse * start.z + 2 * inverse * t * control.z + t * t * end.z,
  };
}

export function headingBetween(a, b) {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function localToWorld(x, z, localX, localZ, yaw) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return {
    x: x + cosine * localX + sine * localZ,
    z: z - sine * localX + cosine * localZ,
  };
}

export function finiteTransform(item) {
  if (!item || typeof item !== 'object') return false;
  for (const key of ['x', 'y', 'z']) {
    if (key in item && !Number.isFinite(item[key])) return false;
  }
  for (const key of ['width', 'height', 'depth', 'length', 'span', 'rotationY', 'heading']) {
    if (key in item && !Number.isFinite(item[key])) return false;
  }
  return true;
}

export function freezeList(items) {
  return Object.freeze(items.map(item => Object.freeze(item)));
}
