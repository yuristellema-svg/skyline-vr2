export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function smoothstep(min, max, value) {
  const width = Math.max(1e-9, max - min);
  const t = clamp((value - min) / width, 0, 1);
  return t * t * (3 - 2 * t);
}

function component(value, key, index) {
  const direct = value?.[key];
  if (Number.isFinite(direct)) return direct;
  const indexed = value?.[index];
  return Number.isFinite(indexed) ? indexed : 0;
}

export function point3(value) {
  return {
    x: component(value, 'x', 0),
    y: component(value, 'y', 1),
    z: component(value, 'z', 2),
  };
}

export function copyPoint(target, source) {
  const point = point3(source);
  target.x = point.x;
  target.y = point.y;
  target.z = point.z;
  return target;
}

export function lerpPoint(target, start, end, alpha) {
  const from = point3(start);
  const to = point3(end);
  const t = clamp(alpha, 0, 1);
  target.x = from.x + (to.x - from.x) * t;
  target.y = from.y + (to.y - from.y) * t;
  target.z = from.z + (to.z - from.z) * t;
  return target;
}

export function distanceSquared(a, b) {
  const first = point3(a);
  const second = point3(b);
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const dz = first.z - second.z;
  return dx * dx + dy * dy + dz * dz;
}

export function length3(value) {
  const point = point3(value);
  return Math.hypot(point.x, point.y, point.z);
}

export function normalize3(value, fallback = { x: 0, y: 0, z: -1 }) {
  const point = point3(value);
  const length = Math.hypot(point.x, point.y, point.z);
  if (length < 1e-9) return point3(fallback);
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

export function toGateLocal(point, gate) {
  const world = point3(point);
  const center = point3(gate.position);
  const yaw = Number(gate.yaw) || 0;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const dx = world.x - center.x;
  const dy = world.y - center.y;
  const dz = world.z - center.z;
  return {
    x: cosine * dx - sine * dz,
    y: dy,
    z: sine * dx + cosine * dz,
  };
}

export function sweptGateIntersection(start, end, gate, playerRadius = 2.5) {
  const from = toGateLocal(start, gate);
  const to = toGateLocal(end, gate);
  const deltaZ = to.z - from.z;
  const halfThickness = Math.max(0.25, Number(gate.halfThickness) || 2.5);
  const slab = halfThickness + Math.max(0, Number(playerRadius) || 0);

  let time;
  if (Math.abs(deltaZ) > 1e-9) {
    time = clamp(-from.z / deltaZ, 0, 1);
  } else {
    time = Math.abs(from.z) <= Math.abs(to.z) ? 0 : 1;
  }

  const z = from.z + deltaZ * time;
  if (Math.abs(z) > slab) {
    return { hit: false, time, radialDistance: Infinity };
  }

  const x = from.x + (to.x - from.x) * time;
  const y = from.y + (to.y - from.y) * time;
  const radialDistance = Math.hypot(x, y);
  const radius = Math.max(1, Number(gate.radius) || 1);
  const tubeRadius = Math.max(0, Number(gate.tubeRadius) || 0);
  const aperture = Math.max(0.25, radius - tubeRadius + Math.max(0, playerRadius));

  const crossedPlane = from.z === 0 || to.z === 0 || Math.sign(from.z) !== Math.sign(to.z);
  const startsInsideSlab = Math.abs(from.z) <= slab;
  const endsInsideSlab = Math.abs(to.z) <= slab;
  const hit = (crossedPlane || startsInsideSlab || endsInsideSlab) && radialDistance <= aperture;

  return { hit, time, radialDistance };
}

export function movingSphereClosestApproach(aStart, aEnd, bStart, bEnd) {
  const a0 = point3(aStart);
  const a1 = point3(aEnd);
  const b0 = point3(bStart);
  const b1 = point3(bEnd);
  const relativeStart = {
    x: a0.x - b0.x,
    y: a0.y - b0.y,
    z: a0.z - b0.z,
  };
  const relativeVelocity = {
    x: (a1.x - a0.x) - (b1.x - b0.x),
    y: (a1.y - a0.y) - (b1.y - b0.y),
    z: (a1.z - a0.z) - (b1.z - b0.z),
  };
  const velocitySq =
    relativeVelocity.x ** 2 + relativeVelocity.y ** 2 + relativeVelocity.z ** 2;
  const time = velocitySq > 1e-9
    ? clamp(
      -(
        relativeStart.x * relativeVelocity.x +
        relativeStart.y * relativeVelocity.y +
        relativeStart.z * relativeVelocity.z
      ) / velocitySq,
      0,
      1,
    )
    : 0;
  const closest = {
    x: relativeStart.x + relativeVelocity.x * time,
    y: relativeStart.y + relativeVelocity.y * time,
    z: relativeStart.z + relativeVelocity.z * time,
  };
  return { time, distance: Math.hypot(closest.x, closest.y, closest.z) };
}

export function sampleEllipticalRoute(route, time) {
  const center = point3(route.center);
  const angularSpeed = Number(route.angularSpeed) || 0;
  const phase = Number(route.phase) || 0;
  const angle = time * angularSpeed + phase;
  const radiusX = Number(route.radiusX) || 0;
  const radiusZ = Number(route.radiusZ) || 0;
  const verticalAmplitude = Number(route.verticalAmplitude) || 0;
  const verticalFrequency = Number(route.verticalFrequency) || 1.7;
  return {
    position: {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle * verticalFrequency) * verticalAmplitude,
      z: center.z + Math.sin(angle) * radiusZ,
    },
    velocity: {
      x: -Math.sin(angle) * radiusX * angularSpeed,
      y:
        Math.cos(angle * verticalFrequency) *
        verticalAmplitude * angularSpeed * verticalFrequency,
      z: Math.cos(angle) * radiusZ * angularSpeed,
    },
  };
}

export function hashString(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicUnit(value) {
  return hashString(value) / 4294967295;
}

export function dispatchDetail(eventTarget, type, detail) {
  if (!eventTarget?.dispatchEvent) return false;
  try {
    const EventClass = globalThis.CustomEvent;
    const event = typeof EventClass === 'function'
      ? new EventClass(type, { detail })
      : { type, detail };
    eventTarget.dispatchEvent(event);
    return true;
  } catch {
    try {
      eventTarget.dispatchEvent({ type, detail });
      return true;
    } catch {
      return false;
    }
  }
}
