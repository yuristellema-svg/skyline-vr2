export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-soft-stall-no-boost-1.4.1',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    spawnSpeed: 28,
    minimumSpeed: 15,
    preferredCruiseSpeed: 29,
    softMaximumSpeed: 44,
    maximumSpeed: 52,

    maximumAcceleration: 24,
    maximumDeceleration: 24,

    angularResponse: 14,
    angularRelease: 18,

    energy: Object.freeze({
      gravityBlendAngle: 35 * DEG,
      diveGravityMultiplier: 1.18,

      climbGravityMultiplier: 0.72,

      levelAssistFullAngle: 2 * DEG,
      levelAssistZeroAngle: 7 * DEG,
      levelAssistSpeedBand: 3,
      levelFlightAssistance: 0.55,
      levelAssistDragFraction: 0.75,

      maximumOverspeedDrag: 18,
      overspeedExponent: 2,
    }),

    aero: Object.freeze({
      liftSlope: 3.6,

      /*
       * Ordinary fast pull-ups should not stall.
       * Warning begins late and actual lift loss begins much later.
       */
      stallWarningAngle: 30 * DEG,
      stallAngle: 45 * DEG,
      postStallAngle: 75 * DEG,

      /*
       * Even during an extreme stall, retain most lift.
       * This prevents the flight path from feeling frozen.
       */
      postStallLiftFraction: 0.88,

      /*
       * Stall develops slowly but clears quickly
       * when the player stops pulling.
       */
      stallAttackTime: 0.55,
      stallReleaseTime: 0.12,

      /*
       * Completely disable forced pitch-down control.
       * Stalling affects lift but never steals control.
       */
      stallRecoveryStart: 1,
      stallRecoveryStrength: 0,

      /*
       * Slightly faster response so the flight path follows
       * the player's chosen direction more readily.
       */
      liftRateCoefficient: 0.016,
      maximumG: 6,

      parasiticDrag: 0.00042,
      inducedDrag: 0.00020,

      gravityPathBend: 1,
    }),

    /*
     * Boost disabled completely.
     *
     * The flightModel remains compatible, but these conditions
     * can never be reached during normal gameplay.
     */
    boost3: Object.freeze({
      chargeSpeed: 999,
      chargePathAngle: -89 * DEG,
      chargeSeconds: 999,

      armedSeconds: 0,
      drainSeconds: 1,

      triggerPitchRate: 999 * DEG,

      duration: 1,
      deltaSpeed: 0,
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
    streakCount: 120,
    streakStartSpeed: 30,
    streakFullSpeed: 50,
    streakDepth: 48,
    streakRadius: 8,

    boostIntensity: 1,

    gVignetteStart: 5,
    gVignetteFull: 8,

    maxViewSqueeze: 0,

    maxVrShake: 0,
    stallBuffetAngle: 0,

    negativeGTintStart: -0.7,

    promptDepth: 5000,
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
  if (min === max) {
    return value < min ? 0 : 1;
  }

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
