export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(min, max, value) {
  const t = clamp((value - min) / Math.max(1e-9, max - min), 0, 1);
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
  const halfThickness = Math.max(0.5, Number(gate.halfThickness) || 2.5);
  const slab = halfThickness + Math.max(0, playerRadius);

  let time = 0;

  if (Math.abs(deltaZ) > 1e-8) {
    time = clamp(-from.z / deltaZ, 0, 1);
  } else {
    time = Math.abs(from.z) <= Math.abs(to.z) ? 0 : 1;
  }

  const z = from.z + deltaZ * time;

  if (Math.abs(z) > slab) {
    return {
      hit: false,
      time,
      radialDistance: Infinity,
      planeDistance: Math.abs(z),
    };
  }

  const x = from.x + (to.x - from.x) * time;
  const y = from.y + (to.y - from.y) * time;
  const radialDistance = Math.hypot(x, y);
  const aperture = Math.max(
    0,
    (Number(gate.radius) || 0) -
      (Number(gate.tubeRadius) || 1.5) -
      Math.max(0, playerRadius),
  );

  return {
    hit: radialDistance <= aperture,
    time,
    radialDistance,
    planeDistance: Math.abs(z),
    aperture,
  };
}

export function calculateBoostedSpeed(speed, chain = 1, options = {}) {
  const current = Math.max(0, Number(speed) || 0);
  const basePercent = Math.max(0, Number(options.basePercent) || 0.08);
  const chainPercent = Math.max(0, Number(options.chainPercent) || 0.004);
  const minimumImpulse = Math.max(0, Number(options.minimumImpulse) || 7);
  const chainIndex = Math.min(7, Math.max(0, Math.floor(Number(chain) || 1) - 1));

  // Boosts remain uncapped, but their percentage becomes progressively calmer
  // at extreme speed so one hoop never destroys steering or simulation stability.
  const speedFade = 1 - 0.55 * smoothstep(160, 700, current);
  const effectivePercent = (basePercent + chainIndex * chainPercent) * speedFade;
  const minimumFade = 1 - 0.70 * smoothstep(120, 500, current);
  const impulse = Math.max(
    minimumImpulse * minimumFade,
    current * effectivePercent,
  );

  return current + impulse;
}

export function movingSphereClosestApproach(
  playerStart,
  playerEnd,
  otherStart,
  otherEnd,
) {
  const p0 = point3(playerStart);
  const p1 = point3(playerEnd);
  const q0 = point3(otherStart);
  const q1 = point3(otherEnd);

  const relativeStart = {
    x: p0.x - q0.x,
    y: p0.y - q0.y,
    z: p0.z - q0.z,
  };

  const relativeVelocity = {
    x: (p1.x - p0.x) - (q1.x - q0.x),
    y: (p1.y - p0.y) - (q1.y - q0.y),
    z: (p1.z - p0.z) - (q1.z - q0.z),
  };

  const speedSquared =
    relativeVelocity.x ** 2 +
    relativeVelocity.y ** 2 +
    relativeVelocity.z ** 2;

  const time = speedSquared > 1e-10
    ? clamp(
      -(
        relativeStart.x * relativeVelocity.x +
        relativeStart.y * relativeVelocity.y +
        relativeStart.z * relativeVelocity.z
      ) / speedSquared,
      0,
      1,
    )
    : 0;

  const closest = {
    x: relativeStart.x + relativeVelocity.x * time,
    y: relativeStart.y + relativeVelocity.y * time,
    z: relativeStart.z + relativeVelocity.z * time,
  };

  return {
    time,
    distance: Math.hypot(closest.x, closest.y, closest.z),
  };
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
    tangent: {
      x: -Math.sin(angle) * radiusX * angularSpeed,
      y:
        Math.cos(angle * verticalFrequency) *
        verticalAmplitude *
        angularSpeed *
        verticalFrequency,
      z: Math.cos(angle) * radiusZ * angularSpeed,
    },
  };
}

export function advanceWorldPosition(position, velocity, dt, bounds) {
  const current = point3(position);
  const drift = point3(velocity);
  const safeDt = Math.max(0, Number(dt) || 0);
  const result = {
    x: current.x + drift.x * safeDt,
    y: current.y + drift.y * safeDt,
    z: current.z + drift.z * safeDt,
  };

  const minX = Number(bounds?.minX);
  const maxX = Number(bounds?.maxX);
  const minZ = Number(bounds?.minZ);
  const maxZ = Number(bounds?.maxZ);

  if (Number.isFinite(minX) && Number.isFinite(maxX) && maxX > minX) {
    const width = maxX - minX;
    while (result.x < minX) result.x += width;
    while (result.x > maxX) result.x -= width;
  }

  if (Number.isFinite(minZ) && Number.isFinite(maxZ) && maxZ > minZ) {
    const depth = maxZ - minZ;
    while (result.z < minZ) result.z += depth;
    while (result.z > maxZ) result.z -= depth;
  }

  return result;
}

export function isCityNodeName(name) {
  const normalized = String(name || '').trim().toLowerCase();

  return (
    normalized === 'skyline-city' ||
    normalized.includes('skyline city blocks') ||
    normalized.includes('city block') ||
    normalized.includes('city landmark')
  );
}
