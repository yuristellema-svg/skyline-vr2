import { DEG, clamp, wrapPi } from './navContracts.js';

export const MENU_BEACON_CONFIG = Object.freeze({
  yaw: -50 * DEG,
  pitch: 0,
  distance: 1.55,
  dwellSeconds: 1.35,
  targetHalfAngle: 7.5 * DEG,
  exitHalfAngle: 9.5 * DEG,
  rearmHalfAngle: 12 * DEG,
  decayPerSecond: 4.5,
});

export function createMenuBeaconState() {
  return {
    progress: 0,
    hovered: false,
    armed: true,
    activated: false,
  };
}

export function beaconLocalPosition(config = MENU_BEACON_CONFIG) {
  const horizontal = Math.cos(config.pitch) * config.distance;
  return {
    x: Math.sin(config.yaw) * horizontal,
    y: Math.sin(config.pitch) * config.distance,
    z: -Math.cos(config.yaw) * horizontal,
  };
}

export function beaconAngularDistance(yaw, pitch, config = MENU_BEACON_CONFIG) {
  const yawDelta = wrapPi((Number(yaw) || 0) - config.yaw);
  const pitchDelta = wrapPi((Number(pitch) || 0) - config.pitch);
  const cosDistance = clamp(
    Math.cos(pitchDelta) * Math.cos(yawDelta),
    -1,
    1,
  );
  return Math.acos(cosDistance);
}

export function updateMenuBeacon(
  previous,
  { active, yaw = 0, pitch = 0, dt = 0 },
  config = MENU_BEACON_CONFIG,
) {
  const state = {
    ...createMenuBeaconState(),
    ...(previous || {}),
    activated: false,
  };
  const safeDt = clamp(Number(dt) || 0, 0, 0.1);

  if (!active) {
    state.progress = 0;
    state.hovered = false;
    return state;
  }

  const distance = beaconAngularDistance(yaw, pitch, config);

  if (!state.armed) {
    if (distance >= config.rearmHalfAngle) state.armed = true;
    state.progress = 0;
    state.hovered = false;
    return state;
  }

  const limit = state.hovered
    ? config.exitHalfAngle
    : config.targetHalfAngle;
  state.hovered = distance <= limit;

  if (state.hovered) {
    state.progress = clamp(
      state.progress + safeDt / config.dwellSeconds,
      0,
      1,
    );
  } else {
    state.progress = clamp(
      state.progress - safeDt * config.decayPerSecond,
      0,
      1,
    );
  }

  if (state.progress >= 1) {
    state.progress = 0;
    state.hovered = false;
    state.armed = false;
    state.activated = true;
  }

  return state;
}
