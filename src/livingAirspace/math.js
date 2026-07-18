export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function seededRandom(seed = 1) {
  let value = (Number(seed) || 1) >>> 0;
  return () => {
    value = (
      Math.imul(value, 1664525) +
      1013904223
    ) >>> 0;
    return value / 4294967296;
  };
}

export function hash01(a, b = 0, c = 0) {
  let value =
    (
      Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^
      Math.imul((b | 0) ^ 0xc2b2ae35, 0x27d4eb2f) ^
      Math.imul((c | 0) ^ 0x165667b1, 0x9e3779b1)
    ) >>> 0;

  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;

  return (value >>> 0) / 4294967296;
}

function pointAt(points, index) {
  const length = points.length;
  return points[
    ((index % length) + length) % length
  ];
}

function catmullRom(a, b, c, d, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * b) +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t2 +
    (-a + 3 * b - 3 * c + d) * t3
  );
}

export function sampleClosedRoute(route, elapsed = 0) {
  const points = route.points;
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error('A closed route requires at least three points.');
  }

  const speed = Math.max(0.0001, finite(route.speed, 0.02));
  const phase = finite(route.phase, 0);
  const cycle =
    ((elapsed * speed + phase) % 1 + 1) % 1;
  const scaled = cycle * points.length;
  const index = Math.floor(scaled);
  const t = scaled - index;

  const p0 = pointAt(points, index - 1);
  const p1 = pointAt(points, index);
  const p2 = pointAt(points, index + 1);
  const p3 = pointAt(points, index + 2);

  const position = {
    x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
    y: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
    z: catmullRom(p0[2], p1[2], p2[2], p3[2], t),
  };

  const epsilon = 0.0025;
  const next = sampleClosedRouteLinear(route, cycle + epsilon);
  const previous = sampleClosedRouteLinear(route, cycle - epsilon);
  const tangent = {
    x: next.x - previous.x,
    y: next.y - previous.y,
    z: next.z - previous.z,
  };

  return { position, tangent, cycle };
}

function sampleClosedRouteLinear(route, cycleValue) {
  const points = route.points;
  const cycle =
    ((cycleValue % 1) + 1) % 1;
  const scaled = cycle * points.length;
  const index = Math.floor(scaled);
  const t = scaled - index;
  const a = pointAt(points, index);
  const b = pointAt(points, index + 1);

  return {
    x: lerp(a[0], b[0], t),
    y: lerp(a[1], b[1], t),
    z: lerp(a[2], b[2], t),
  };
}

export function routeLength(route, samples = 96) {
  let total = 0;
  let previous = sampleClosedRouteLinear(route, 0);

  for (let index = 1; index <= samples; index += 1) {
    const next =
      sampleClosedRouteLinear(route, index / samples);
    total += Math.hypot(
      next.x - previous.x,
      next.y - previous.y,
      next.z - previous.z,
    );
    previous = next;
  }

  return total;
}

export function wrapWorldPosition(position, bounds) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  if (position.x < bounds.minX) position.x += width;
  if (position.x > bounds.maxX) position.x -= width;
  if (position.z < bounds.minZ) position.z += depth;
  if (position.z > bounds.maxZ) position.z -= depth;

  return position;
}

export function distanceSquared3(a, b) {
  const dx = finite(a?.x) - finite(b?.x);
  const dy = finite(a?.y) - finite(b?.y);
  const dz = finite(a?.z) - finite(b?.z);
  return dx * dx + dy * dy + dz * dz;
}

export function safeSampleHeight(sampleHeight, x, z, fallback = 0) {
  if (typeof sampleHeight !== 'function') return fallback;
  try {
    const value = sampleHeight(x, z);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
