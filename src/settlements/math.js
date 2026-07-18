export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function hashString(value, seed = 2166136261) {
  let hash = seed >>> 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mixHash(...parts) {
  let hash = 2166136261;
  for (const part of parts) hash = hashString(part, hash);
  return hash >>> 0;
}

export function createRng(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function angleDifference(a, b) {
  let difference = (a - b) % TAU;
  if (difference > Math.PI) difference -= TAU;
  if (difference < -Math.PI) difference += TAU;
  return Math.abs(difference);
}

export function rotate2(x, z, yaw) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [
    x * cosine - z * sine,
    x * sine + z * cosine,
  ];
}

export function pointInPolygon(point, polygon) {
  const [x, z] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const crosses = ((zi > z) !== (zj > z)) &&
      (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

export function polygonBounds(polygon) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return Object.freeze({ minX, maxX, minZ, maxZ });
}

export function polygonCentroid(polygon) {
  let area = 0;
  let x = 0;
  let z = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current[0] * next[1] - next[0] * current[1];
    area += cross;
    x += (current[0] + next[0]) * cross;
    z += (current[1] + next[1]) * cross;
  }
  if (Math.abs(area) < 1e-8) {
    const sum = polygon.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [sum[0] / polygon.length, sum[1] / polygon.length];
  }
  return [x / (3 * area), z / (3 * area)];
}

export function pointSegmentProjection(point, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0
    ? clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSq, 0, 1)
    : 0;
  const x = a[0] + dx * t;
  const z = a[1] + dz * t;
  return Object.freeze({
    point: Object.freeze([x, z]),
    t,
    distance: Math.hypot(point[0] - x, point[1] - z),
    heading: Math.atan2(dz, dx),
  });
}

export function nearestPolylineProjection(point, points) {
  let best = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const projection = pointSegmentProjection(point, points[index], points[index + 1]);
    if (!best || projection.distance < best.distance) {
      best = { ...projection, segmentIndex: index };
    }
  }
  return best ? Object.freeze(best) : null;
}

export function polylineLength(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += Math.hypot(
      points[index + 1][0] - points[index][0],
      points[index + 1][1] - points[index][1],
    );
  }
  return total;
}

export function samplePolyline(points, t) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(
      points[index + 1][0] - points[index][0],
      points[index + 1][1] - points[index][1],
    );
    lengths.push(length);
    total += length;
  }
  const target = clamp(t, 0, 1) * total;
  let cursor = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const next = cursor + lengths[index];
    if (target <= next || index === lengths.length - 1) {
      const local = lengths[index] > 0 ? (target - cursor) / lengths[index] : 0;
      const a = points[index];
      const b = points[index + 1];
      return Object.freeze({
        point: Object.freeze([
          lerp(a[0], b[0], local),
          lerp(a[1], b[1], local),
        ]),
        heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
        segmentIndex: index,
        distance: target,
      });
    }
    cursor = next;
  }
  return null;
}

export function samplePolylineByDistance(points, spacing, startOffset = 0) {
  const length = polylineLength(points);
  const result = [];
  if (length <= 0 || spacing <= 0) return result;
  for (let distance = startOffset; distance <= length; distance += spacing) {
    const sample = samplePolyline(points, distance / length);
    if (sample) result.push(sample);
  }
  return result;
}

export function orientedCorners(x, z, width, depth, yaw) {
  const corners = [];
  for (const local of [
    [-width * 0.5, -depth * 0.5],
    [width * 0.5, -depth * 0.5],
    [width * 0.5, depth * 0.5],
    [-width * 0.5, depth * 0.5],
  ]) {
    const rotated = rotate2(local[0], local[1], yaw);
    corners.push([x + rotated[0], z + rotated[1]]);
  }
  return corners;
}

function projectPolygon(axis, polygon) {
  let min = Infinity;
  let max = -Infinity;
  for (const point of polygon) {
    const value = point[0] * axis[0] + point[1] * axis[1];
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function axesForPolygon(polygon) {
  const axes = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz) || 1;
    axes.push([-dz / length, dx / length]);
  }
  return axes;
}

export function polygonsOverlap(a, b, padding = 0) {
  for (const axis of [...axesForPolygon(a), ...axesForPolygon(b)]) {
    const pa = projectPolygon(axis, a);
    const pb = projectPolygon(axis, b);
    if (pa.max + padding <= pb.min || pb.max + padding <= pa.min) return false;
  }
  return true;
}

export function stableSort(items, selector) {
  return items
    .map((item, index) => ({ item, index, key: selector(item) }))
    .sort((a, b) => {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return a.index - b.index;
    })
    .map(entry => entry.item);
}
