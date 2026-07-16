import {
  DEG,
  PHONE_CRASH_MENU_IDS,
  PHONE_MENU_IDS,
  clamp,
  wrapPi,
} from './navContracts.js';

const PHONE_YAWS = Object.freeze([-54, -36, -18, 0, 18, 36, 54]);
const CRASH_YAWS = Object.freeze([-20, 0, 20]);

export const PHONE_MENU_CONFIG = Object.freeze({
  depth: 1.55,
  panelScale: 0.76,
  enterHalfAngle: 5.5 * DEG,
  exitHalfAngle: 7.5 * DEG,
  pitchHalfAngle: 7.5 * DEG,
  dwellSeconds: 1.25,
  destructiveDwellSeconds: 1.7,
  activationLockoutSeconds: 0.75,
});

function labelFor(id, state) {
  const labels = {
    resume: ['RESUME', 'BACK TO FLIGHT'],
    recenter: ['RECENTER', 'RESET NEUTRAL'],
    camera: ['VIEW', state.cameraName || 'COCKPIT'],
    aircraft: ['AIRCRAFT', state.aircraftName || 'A6M ZERO'],
    effects: ['EFFECTS', state.effectsName || 'STANDARD'],
    respawn: ['RETURN', state.crashMode ? 'RE-ENTER FLIGHT' : 'START POSITION'],
    restart: ['REBUILD', 'RELOAD WORLD'],
  };
  return labels[id];
}

export function buildPhoneMenuDefinitions({
  crashMode = false,
  cameraName = 'COCKPIT',
  aircraftName = 'A6M ZERO',
  effectsName = 'STANDARD',
} = {}) {
  const ids = crashMode ? PHONE_CRASH_MENU_IDS : PHONE_MENU_IDS;
  const yaws = crashMode ? CRASH_YAWS : PHONE_YAWS;
  return ids.map((id, index) => {
    const [title, subtitle] = labelFor(id, {
      crashMode,
      cameraName,
      aircraftName,
      effectsName,
    });
    return {
      id,
      title,
      subtitle,
      yaw: yaws[index],
      pitch: 0,
      danger: id === 'restart',
    };
  });
}

export function buildDesktopMenuDefinitions({
  crashMode = false,
  cameraName = 'FIRST',
  aircraftName = 'A6M ZERO',
  effectsName = 'STANDARD',
} = {}) {
  if (crashMode) {
    return [
      { id: 'respawn', title: 'RETURN', subtitle: 'RE-ENTER FLIGHT', yaw: -13, pitch: 3 },
      { id: 'aircraft', title: 'AIRCRAFT', subtitle: aircraftName, yaw: 0, pitch: 3 },
      { id: 'restart', title: 'REBUILD', subtitle: 'RELOAD WORLD', yaw: 13, pitch: 3, danger: true },
    ];
  }
  return [
    { id: 'resume', title: 'RESUME', subtitle: 'BACK TO FLIGHT', yaw: -27, pitch: 8 },
    { id: 'recenter', title: 'RECENTER', subtitle: 'RESET NEUTRAL', yaw: -9, pitch: 8 },
    { id: 'camera', title: 'VIEW', subtitle: cameraName, yaw: 9, pitch: 8 },
    { id: 'aircraft', title: 'AIRCRAFT', subtitle: aircraftName, yaw: 27, pitch: 8 },
    { id: 'effects', title: 'EFFECTS', subtitle: effectsName, yaw: -18, pitch: -9 },
    { id: 'respawn', title: 'RETURN', subtitle: 'START POSITION', yaw: 0, pitch: -9 },
    { id: 'restart', title: 'REBUILD', subtitle: 'RELOAD WORLD', yaw: 18, pitch: -9, danger: true },
  ];
}

export function selectPhonePanel(
  definitions,
  yaw,
  pitch = 0,
  currentId = null,
  config = PHONE_MENU_CONFIG,
) {
  const verticalDistance =
    Math.abs(Number(pitch) || 0);

  if (
    verticalDistance >
    config.pitchHalfAngle
  ) {
    return null;
  }

  let best = null;
  let bestDistance = Infinity;

  for (const definition of definitions) {
    const limit =
      definition.id === currentId
        ? config.exitHalfAngle
        : config.enterHalfAngle;

    const distance =
      Math.abs(
        wrapPi(
          (Number(yaw) || 0) -
          definition.yaw * DEG
        )
      );

    if (
      distance <= limit &&
      distance < bestDistance
    ) {
      best = definition;
      bestDistance = distance;
    }
  }

  return best;
}

export function createPhoneMenuDwellState() {
  return {
    hoveredId: null,
    progress: 0,
    lockout: 0,
    requireExit: false,
    activatedId: null,
  };
}

export function updatePhoneMenuDwell(
  previous,
  { definitions, yaw = 0, pitch = 0, dt = 0 },
  config = PHONE_MENU_CONFIG,
) {
  const state = {
    ...createPhoneMenuDwellState(),
    ...(previous || {}),
    activatedId: null,
  };
  const safeDt = clamp(Number(dt) || 0, 0, 0.1);
  state.lockout = Math.max(0, state.lockout - safeDt);

  const candidate = selectPhonePanel(
    definitions,
    yaw,
    pitch,
    state.hoveredId,
    config,
  );
  const candidateId = candidate?.id || null;

  if (candidateId !== state.hoveredId) {
    state.hoveredId = candidateId;
    state.progress = 0;
  }

  if (!candidate) {
    state.requireExit = false;
    state.progress = 0;
    return state;
  }

  if (state.requireExit || state.lockout > 0) {
    state.progress = 0;
    return state;
  }

  const dwellSeconds = candidate.danger
    ? config.destructiveDwellSeconds
    : config.dwellSeconds;
  state.progress = clamp(state.progress + safeDt / dwellSeconds, 0, 1);

  if (state.progress >= 1) {
    state.activatedId = candidate.id;
    state.progress = 0;
    state.lockout = config.activationLockoutSeconds;
    state.requireExit = true;
  }

  return state;
}
