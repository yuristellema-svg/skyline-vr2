export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-balanced-control-1.4.4',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    spawnSpeed: 60,
    minimumSpeed: 0,
    preferredCruiseSpeed: 70,
    softMaximumSpeed: 900,
    maximumSpeed: 1000,

    maximumAcceleration: 16,
    maximumDeceleration: 10,

    angularResponse: 14,
    angularRelease: 18,

    energy: Object.freeze({
      gravityBlendAngle: 25 * DEG,
      diveGravityMultiplier: 0.9,
      climbGravityMultiplier: 0.45,

      levelAssistFullAngle: 4 * DEG,
      levelAssistZeroAngle: 25 * DEG,
      levelAssistSpeedBand: 30,
      levelFlightAssistance: 0.55,
      levelAssistDragFraction: 2.5,

      maximumOverspeedDrag: 0,
      overspeedExponent: 2,
    }),

    aero: Object.freeze({
      liftSlope: 3.2,

      stallWarningAngle: 35 * DEG,
      stallAngle: 55 * DEG,
      postStallAngle: 90 * DEG,
      postStallLiftFraction: 0.9,

      stallAttackTime: 0.65,
      stallReleaseTime: 0.12,

      stallRecoveryStart: 1,
      stallRecoveryStrength: 0,

      liftRateCoefficient: 0.036,
      maximumG: 14,

      parasiticDrag: 0.00011,
      inducedDrag: 0.000025,
      gravityPathBend: 0.05,
    }),

    boost3: Object.freeze({
      chargeSpeed: 1000000000,
      chargePathAngle: -180 * DEG,
      chargeSeconds: 1000000000,
      armedSeconds: 0,
      drainSeconds: 1,
      triggerPitchRate: 1000000000,
      duration: 1,
      deltaSpeed: 0,
    }),

    telemetry: Object.freeze({
      frames: 600,
      glitchPathDelta: 45 * DEG,
    }),
  }),

  controls: Object.freeze({
    pitchDeadzone: 0.8 * DEG,
    rollDeadzone: 0.8 * DEG,

    pitchFullDeflection: 16 * DEG,
    rollFullDeflection: 18 * DEG,

    pitchMaxRate: 95 * DEG,
    rollMaxRate: 135 * DEG,

    responseExponent: 1.25,

    yawMenuThreshold: 45 * DEG,
    yawMenuHold: 1,

    sensorStaleAfter: 0.8,
    inputSlewSeconds: 0.04,

    highSpeedControlStart: 140,
    highSpeedControlFull: 350,
    highSpeedControlScale: 0.7,
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
    monoSpeedFov: 18,
    stereoFov: 80,

    fovSpeedStart: 60,
    fovSpeedFull: 220,

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
    streakCount: 260,
    streakStartSpeed: 40,
    streakFullSpeed: 190,
    streakDepth: 85,
    streakRadius: 12,

    boostIntensity: 1,

    gVignetteStart: 10,
    gVignetteFull: 18,

    maxViewSqueeze: 0,
    maxVrShake: 0,
    stallBuffetAngle: 0,

    negativeGTintStart: -1,

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

    spawnPathAngle: -2 * DEG,

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
