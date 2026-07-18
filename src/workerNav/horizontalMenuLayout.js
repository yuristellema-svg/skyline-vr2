import {
  DEG,
  clamp,
  wrapPi,
} from './navContracts.js';

const PHONE_FLIGHT_LAYOUT = Object.freeze([
  { id: 'resume', yaw: -39, pitch: 12 },
  { id: 'recenter', yaw: -13, pitch: 12 },
  { id: 'camera', yaw: 13, pitch: 12 },
  { id: 'aircraft', yaw: 39, pitch: 12 },

  { id: 'map', yaw: -39, pitch: -12 },
  { id: 'effects', yaw: -13, pitch: -12 },
  { id: 'respawn', yaw: 13, pitch: -12 },
  { id: 'restart', yaw: 39, pitch: -12 },
]);

const PHONE_CRASH_LAYOUT = Object.freeze([
  { id: 'respawn', yaw: -24, pitch: 0 },
  { id: 'aircraft', yaw: 0, pitch: 0 },
  { id: 'restart', yaw: 24, pitch: 0 },
]);

export const PHONE_MENU_CONFIG = Object.freeze({
  depth: 1.1,

  panelWidth: 0.36,
  panelHeight: 0.24,
  panelScale: 1.08,

  enterHalfAngle: 8 * DEG,
  exitHalfAngle: 10 * DEG,

  enterPitchHalfAngle: 7 * DEG,
  exitPitchHalfAngle: 9 * DEG,

  pitchHalfAngle: 16 * DEG,

  dwellSeconds: 1.05,
  destructiveDwellSeconds: 1.55,
  activationLockoutSeconds: 0.55,
});

function labelFor(id, state) {
  const labels = {
    resume: [
      'RESUME',
      'BACK TO FLIGHT',
    ],

    recenter: [
      'RECENTER',
      'RESET HEAD CENTRE',
    ],

    camera: [
      'VIEW',
      state.cameraName || 'COCKPIT',
    ],

    aircraft: [
      'AIRCRAFT',
      state.aircraftName || 'A6M ZERO',
    ],

    map: [
      'MAP',
      'NAVIGATION + PING',
    ],

    effects: [
      'EFFECTS',
      state.effectsName || 'STANDARD',
    ],

    respawn: [
      'RETURN',
      state.crashMode
        ? 'RE-ENTER FLIGHT'
        : 'START POSITION',
    ],

    restart: [
      'REBUILD',
      'RELOAD WORLD',
    ],
  };

  return labels[id];
}

export function buildPhoneMenuDefinitions({
  crashMode = false,
  cameraName = 'COCKPIT',
  aircraftName = 'A6M ZERO',
  effectsName = 'STANDARD',
} = {}) {
  const layout =
    crashMode
      ? PHONE_CRASH_LAYOUT
      : PHONE_FLIGHT_LAYOUT;

  return layout.map(item => {
    const [title, subtitle] =
      labelFor(item.id, {
        crashMode,
        cameraName,
        aircraftName,
        effectsName,
      });

    return {
      ...item,
      title,
      subtitle,
      danger:
        item.id === 'restart',
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
      {
        id: 'respawn',
        title: 'RETURN',
        subtitle: 'RE-ENTER FLIGHT',
        yaw: -13,
        pitch: 3,
      },
      {
        id: 'aircraft',
        title: 'AIRCRAFT',
        subtitle: aircraftName,
        yaw: 0,
        pitch: 3,
      },
      {
        id: 'restart',
        title: 'REBUILD',
        subtitle: 'RELOAD WORLD',
        yaw: 13,
        pitch: 3,
        danger: true,
      },
    ];
  }

  return [
    {
      id: 'resume',
      title: 'RESUME',
      subtitle: 'BACK TO FLIGHT',
      yaw: -30,
      pitch: 9,
    },
    {
      id: 'recenter',
      title: 'RECENTER',
      subtitle: 'RESET NEUTRAL',
      yaw: -10,
      pitch: 9,
    },
    {
      id: 'camera',
      title: 'VIEW',
      subtitle: cameraName,
      yaw: 10,
      pitch: 9,
    },
    {
      id: 'aircraft',
      title: 'AIRCRAFT',
      subtitle: aircraftName,
      yaw: 30,
      pitch: 9,
    },
    {
      id: 'map',
      title: 'MAP',
      subtitle: 'NAVIGATION + PING',
      yaw: -30,
      pitch: -9,
    },
    {
      id: 'effects',
      title: 'EFFECTS',
      subtitle: effectsName,
      yaw: -10,
      pitch: -9,
    },
    {
      id: 'respawn',
      title: 'RETURN',
      subtitle: 'START POSITION',
      yaw: 10,
      pitch: -9,
    },
    {
      id: 'restart',
      title: 'REBUILD',
      subtitle: 'RELOAD WORLD',
      yaw: 30,
      pitch: -9,
      danger: true,
    },
  ];
}

export function selectPhonePanel(
  definitions,
  yaw,
  pitch = 0,
  currentId = null,
  config = PHONE_MENU_CONFIG,
) {
  const safeYaw =
    Number(yaw) || 0;

  const safePitch =
    Number(pitch) || 0;

  let best = null;
  let bestScore = Infinity;

  for (const definition of definitions) {
    const continuing =
      definition.id === currentId;

    const yawLimit =
      continuing
        ? config.exitHalfAngle
        : config.enterHalfAngle;

    const pitchLimit =
      continuing
        ? config.exitPitchHalfAngle
        : config.enterPitchHalfAngle;

    const yawDistance =
      Math.abs(
        wrapPi(
          safeYaw -
          definition.yaw * DEG
        )
      );

    const pitchDistance =
      Math.abs(
        wrapPi(
          safePitch -
          definition.pitch * DEG
        )
      );

    const score =
      Math.pow(
        yawDistance / yawLimit,
        2
      ) +
      Math.pow(
        pitchDistance / pitchLimit,
        2
      );

    if (
      score <= 1 &&
      score < bestScore
    ) {
      best = definition;
      bestScore = score;
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
  {
    definitions,
    yaw = 0,
    pitch = 0,
    dt = 0,
  },
  config = PHONE_MENU_CONFIG,
) {
  const state = {
    ...createPhoneMenuDwellState(),
    ...(previous || {}),
    activatedId: null,
  };

  const safeDt =
    clamp(
      Number(dt) || 0,
      0,
      0.1
    );

  state.lockout =
    Math.max(
      0,
      state.lockout - safeDt
    );

  const candidate =
    selectPhonePanel(
      definitions,
      yaw,
      pitch,
      state.hoveredId,
      config
    );

  const candidateId =
    candidate?.id || null;

  if (
    candidateId !==
    state.hoveredId
  ) {
    state.hoveredId =
      candidateId;

    state.progress = 0;
  }

  if (
    !candidate ||
    state.lockout > 0
  ) {
    state.progress = 0;
    return state;
  }

  const dwellSeconds =
    candidate.danger
      ? config.destructiveDwellSeconds
      : config.dwellSeconds;

  state.progress =
    clamp(
      state.progress +
        safeDt / dwellSeconds,
      0,
      1
    );

  if (state.progress >= 1) {
    state.activatedId =
      candidate.id;

    state.progress = 0;

    state.lockout =
      config.activationLockoutSeconds;
  }

  return state;
}
