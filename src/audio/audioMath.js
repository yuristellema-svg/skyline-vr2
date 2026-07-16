export function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, finite(Number(value), min)));
}

export function smoothstep(min, max, value) {
  if (!(max > min)) return value >= max ? 1 : 0;
  const x = clamp((value - min) / (max - min));
  return x * x * (3 - 2 * x);
}

export function speedOf(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  return Math.max(0, flight?.velocity?.length?.() || 0);
}

export function verticalSpeedOf(flight) {
  if (Number.isFinite(flight?.verticalSpeed)) return flight.verticalSpeed;
  if (Number.isFinite(flight?.velocity?.y)) return flight.velocity.y;
  return 0;
}

export function loadFactorOf(flight) {
  for (const value of [
    flight?.loadFactor,
    flight?.gForce,
    flight?.currentG,
    flight?.gLoad,
  ]) {
    if (Number.isFinite(value)) return Math.max(0, value);
  }
  return 1;
}

export function pathAngleOf(flight) {
  if (Number.isFinite(flight?.pathAngle)) return flight.pathAngle;
  const speed = speedOf(flight);
  if (speed < 1e-6) return 0;
  return Math.asin(clamp(verticalSpeedOf(flight) / speed, -1, 1));
}

export function stallAmountOf(flight) {
  return clamp(
    flight?.stallAmount ??
    flight?.stallSeverity ??
    flight?.stall ??
    0,
  );
}

export function safeTerrainHeight(sampleHeight, x, z) {
  if (typeof sampleHeight !== 'function') return 0;
  try {
    return finite(sampleHeight(x, z), 0);
  } catch {
    return 0;
  }
}

export function safeSetTarget(parameter, value, now, timeConstant = 0.08) {
  if (!parameter) return;
  const safeValue = finite(value, 0);
  try {
    if (typeof parameter.setTargetAtTime === 'function') {
      parameter.setTargetAtTime(safeValue, now, Math.max(0.001, timeConstant));
    } else {
      parameter.value = safeValue;
    }
  } catch {
    try { parameter.value = safeValue; } catch {}
  }
}

export function makeNoiseBuffer(context, seconds = 2.5, seed = 0x51f15e) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  let brown = 0;

  for (let index = 0; index < data.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const white = state / 4294967296 * 2 - 1;
    brown = brown * 0.986 + white * 0.014;
    data[index] = clamp(white * 0.34 + brown * 1.22, -1, 1);
  }

  return buffer;
}

export function safeDisconnect(node) {
  try { node?.disconnect?.(); } catch {}
}

export function safeStop(node, when = 0) {
  try { node?.stop?.(when); } catch {}
}
