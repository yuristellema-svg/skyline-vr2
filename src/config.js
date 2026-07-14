export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-playable-1.1.0',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    // Faster and much more forgiving starting state.
    spawnSpeed: 82,
    minimumSpeed: 30,

    angularResponse: 14,
    angularRelease: 18,

    aero: Object.freeze({
      liftSlope: 3.2,

      // Normal movement should almost never cause a stall.
      stallAngle: 48 * DEG,
      postStallAngle: 75 * DEG,
      postStallLiftFraction: 0.82,

      liftRateCoefficient: 0.016,
      maximumG: 7,

      // Extremely low passive drag so straight flight keeps its speed.
      parasiticDrag: 1e-5,
      inducedDrag: 2e-5,

      // Very weak forced nose-down behaviour during a stall.
      stallPitchAcceleration: 0.35,

      gravityPathBend: 0.8,
    }),

    boost3: Object.freeze({
      // Boost can now be charged with a mild dive.
      chargeSpeed: 72,
      chargePathAngle: -8 * DEG,
      chargeSeconds: 1.5,

      // More time to perform the pull-up.
      armedSeconds: 8,
      drainSeconds: 3,

      // Much easier pull-up trigger.
      triggerPitchRate: 18 * DEG,

      // Strong boost intended to allow repeated altitude gains.
      duration: 4,
      deltaSpeed: 55,
    }),

    telemetry: Object.freeze({
      frames: 600,
      glitchPathDelta: 45 * DEG,
    }),
  }),

  controls: Object.freeze({
    pitchDeadzone: 3 * DEG,
    rollDeadzone: 3 * DEG,

    pitchFullDeflection: 25 * DEG,
    rollFullDeflection: 30 * DEG,

    pitchMaxRate: 110 * DEG,
    rollMaxRate: 160 * DEG,

    responseExponent: 1.6,

    yawMenuThreshold: 45 * DEG,
    yawMenuHold: 1,

    sensorStaleAfter: 0.8,
    inputSlewSeconds: 0.06,

    highSpeedControlStart: 100,
    highSpeedControlFull: 130,
    highSpeedControlScale: 0.85,
  }),

  sensitivity: Object.freeze({
    presets: Object.freeze([
      Object.freeze({
        name: 'CALM',
        multiplier: 0.78,
      }),

      Object.freeze({
        name: 'STANDARD',
        multiplier: 1,
      }),

      Object.freeze({
        name: 'AGILE',
        multiplier: 1.22,
      }),
    ]),

    defaultIndex: 1,
  }),

  camera: Object.freeze({
    firstPersonHead: Object.freeze([
      0,
      0.62,
      -0.18,
    ]),

    monoBaseFov: 80,
    monoSpeedFov: 12,
    stereoFov: 80,

    fovSpeedStart: 60,
    fovSpeedFull: 130,

    thirdBack: 11,
    thirdUp: 3.5,
    thirdPullback: 2,

    thirdPositionResponse: 12,
    thirdRollLagSeconds: 0.08,
    thirdMaxRollLag: 10 * DEG,

    rollLagResponse: 14,

    near: 0.08,
    far: 1800,
  }),

  effects: Object.freeze({
    // More visible wind and boost effects.
    streakCount: 220,
    streakStartSpeed: 45,
    streakFullSpeed: 115,
    streakDepth: 65,
    streakRadius: 10,

    boostIntensity: 2.4,

    gVignetteStart: 4,
    gVignetteFull: 7,

    maxViewSqueeze: 0.02,
    maxVrShake: 0.18 * DEG,

    negativeGTintStart: -0.35,

    // Stronger warning shake, although stalls are now rare.
    stallBuffetAngle: 0.35 * DEG,

    promptDepth: 2.5,
  }),

  menu: Object.freeze({
    depth: 2.5,
    dwellSeconds: 1,

    panelYawStep: 12 * DEG,
    panelHitHalfAngle: 5.5 * DEG,
    panelPitchHalfAngle: 4.8 * DEG,

    panelExitHalfAngle: 7.5 * DEG,
    panelExitPitchHalfAngle: 6.8 * DEG,

    gazeSmoothingTau: 0.12,
    dwellDecaySeconds: 0.4,

    activationLockoutSeconds: 0.5,
    destructiveDwellSeconds: 1.5,
  }),

  stereo: Object.freeze({
    eyeSeparation: 0.064,
    pixelRatio: 1,
  }),

  collision: Object.freeze({
    playerRadius: 1.25,
  }),

  testBox: Object.freeze({
    spawn: Object.freeze([
      0,
      760,
      420,
    ]),

    planeSize: 12000,
    bridgeZ: -900,

    fogNear: 900,
    fogFar: 1600,
  }),

  world: Object.freeze({
    size: 8192,
    halfSize: 4096,

    sampleSpacing: 2,
    chunkSize: 256,

    loadRadius: 1792,
    unloadRadius: 2048,

    fullLodRadius: 640,
    halfLodRadius: 1152,

    renderSpacingFull: 4,
    renderSpacingHalf: 8,
    renderSpacingFar: 16,

    floatingOriginDistance: 2048,

    fogNear: 900,
    fogFar: 1600,

    spawn: Object.freeze([
      0,
      720,
      2450,
    ]),

    spawnPathAngle: -10 * DEG,

    assetRoot: './assets/world',

    maxHeapBytes: 350 * 1024 * 1024,
  }),

  performance: Object.freeze({
    maxDrawCalls: 300,
    maxVisibleTriangles: 400000,
  }),
});

export function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

export function smoothstep(min, max, value) {
  const t = clamp(
    (value - min) / (max - min),
    0,
    1,
  );

  return t * t * (3 - 2 * t);
}

export function damp(current, target, response, dt) {
  return target +
    (current - target) *
    Math.exp(-response * dt);
}

export function wrapPi(value) {
  return Math.atan2(
    Math.sin(value),
    Math.cos(value),
  );
}

export function rateFromDeflection(
  deflection,
  deadzone,
  fullDeflection,
  maxRate,
  exponent = 1.6,
) {
  const magnitude = Math.abs(deflection);

  if (magnitude <= deadzone) {
    return 0;
  }

  const normalized = clamp(
    (magnitude - deadzone) /
      (fullDeflection - deadzone),
    0,
    1,
  );

  return Math.sign(deflection) *
    maxRate *
    Math.pow(normalized, exponent);
}
