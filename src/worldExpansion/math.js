export const TAU = Math.PI * 2;

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function saturate(value) {
  return clamp(value, 0, 1);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  const t = saturate((value - edge0) / Math.max(1e-9, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0, edge1, value) {
  const t = saturate((value - edge0) / Math.max(1e-9, edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function hash2(x, z, seed = 0) {
  let value = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  value ^= Math.imul((z | 0) ^ seed, 0xc2b2ae35);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x, z, seed = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fz = fade(z - iz);
  const a = hash2(ix, iz, seed) * 2 - 1;
  const b = hash2(ix + 1, iz, seed) * 2 - 1;
  const c = hash2(ix, iz + 1, seed) * 2 - 1;
  const d = hash2(ix + 1, iz + 1, seed) * 2 - 1;
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

export function fbm2(x, z, seed = 0, octaves = 5) {
  let frequency = 1;
  let amplitude = 0.5;
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    weight += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return total / Math.max(1e-9, weight);
}

export function ridgedNoise2(x, z, seed = 0, octaves = 4) {
  return 1 - Math.abs(fbm2(x, z, seed, octaves));
}

export function ellipseInfluence(x, z, center, radius, feather = 0.25) {
  const nx = (x - center[0]) / Math.max(1, radius[0]);
  const nz = (z - center[1]) / Math.max(1, radius[1]);
  const distance = Math.hypot(nx, nz);
  return 1 - smoothstep(1 - feather, 1, distance);
}

export function compilePolyline(points) {
  const segments = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length <= 1e-6) continue;
    segments.push({ a, b, dx, dz, length, start: totalLength });
    totalLength += length;
  }
  return { points, segments, totalLength };
}

export function nearestPointOnPolyline(x, z, compiled) {
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let best = { x: 0, z: 0, t: 0, segmentIndex: -1, along: 0, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < compiled.segments.length; index += 1) {
    const segment = compiled.segments[index];
    const denominator = segment.length * segment.length;
    const localT = clamp(
      ((x - segment.a[0]) * segment.dx + (z - segment.a[1]) * segment.dz) / denominator,
      0,
      1,
    );
    const px = segment.a[0] + segment.dx * localT;
    const pz = segment.a[1] + segment.dz * localT;
    const dx = x - px;
    const dz = z - pz;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      best = {
        x: px,
        z: pz,
        t: localT,
        segmentIndex: index,
        along: segment.start + segment.length * localT,
        distance: Math.sqrt(distanceSquared),
      };
    }
  }
  return best;
}

export function localCoordinates(x, z, center, headingDegrees) {
  const radians = headingDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = x - center[0];
  const dz = z - center[1];
  return {
    forward: dx * sine + dz * cosine,
    right: dx * cosine - dz * sine,
  };
}

export function createSeededRandom(seed = 1) {
  let state = seed >>> 0 || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function pointInBounds(x, z, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}
