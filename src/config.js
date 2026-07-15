export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-relaxed-energy-1.4.5',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    spawnSpeed: 58,
    minimumSpeed: 0,
    preferredCruiseSpeed: 55,
    softMaximumSpeed: 900,
    maximumSpeed: 1000,

    maximumAcceleration: 10,
    maximumDeceleration: 16,

    angularResponse: 12,
    angularRelease: 16,

    energy: Object.freeze({
      gravityBlendAngle: 28 * DEG,
      diveGravityMultiplier: 0.78,
      climbGravityMultiplier: 1.12,

      levelAssistFullAngle: 3 * DEG,
      levelAssistZeroAngle: 17 * DEG,
      levelAssistSpeedBand: 22,
      levelFlightAssistance: 0.48,
      levelAssistDragFraction: 2.2,

      maximumOverspeedDrag: 0,
      overspeedExponent: 2,
    }),

    aero: Object.freeze({
      liftSlope: 3.0,

      stallWarningAngle: 28 * DEG,
      stallAngle: 48 * DEG,
      postStallAngle: 82 * DEG,
      postStallLiftFraction: 0.78,

      stallAttackTime: 0.45,
      stallReleaseTime: 0.18,

      stallRecoveryStart: 1,
      stallRecoveryStrength: 0,

      liftRateCoefficient: 0.031,
      maximumG: 11,

      parasiticDrag: 0.00013,
      inducedDrag: 0.00004,
      gravityPathBend: 0.06,
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
    // No dead zone for VR or mouse.
    pitchDeadzone: 0,
    rollDeadzone: 0,

    // Much less physical movement reaches full steering.
    pitchFullDeflection: 12 * DEG,
    rollFullDeflection: 14 * DEG,

    // Responsive but calmer maximum turning rates.
    pitchMaxRate: 86 * DEG,
    rollMaxRate: 116 * DEG,

    responseExponent: 1.05,

    yawMenuThreshold: 45 * DEG,
    yawMenuHold: 1,

    sensorStaleAfter: 0.8,
    inputSlewSeconds: 0.055,

    highSpeedControlStart: 120,
    highSpeedControlFull: 320,
    highSpeedControlScale: 0.72,
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

    fovSpeedStart: 50,
    fovSpeedFull: 210,

    thirdBack: 11,
    thirdUp: 3.5,
    thirdPullback: 2,

    thirdPositionResponse: 12,
    thirdRollLagSeconds: 0.08,
    thirdMaxRollLag: 10 * DEG,

    rollLagResponse: 14,

    near: 0.08,
    far: 4200,
  }),

  effects: Object.freeze({
    streakCount: 260,
    streakStartSpeed: 38,
    streakFullSpeed: 210,
    streakDepth: 95,
    streakRadius: 12,

    boostIntensity: 1,

    gVignetteStart: 8,
    gVignetteFull: 14,

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

    fogNear: 1900,
    fogFar: 3600,
  }),

  world: Object.freeze({
    size: 8192,
    halfSize: 4096,

    sampleSpacing: 2,
    chunkSize: 256,

    loadRadius: 3200,
    unloadRadius: 3584,

    fullLodRadius: 704,
    halfLodRadius: 1664,

    renderSpacingFull: 4,
    renderSpacingHalf: 8,
    renderSpacingFar: 16,

    floatingOriginDistance: 2048,

    fogNear: 1900,
    fogFar: 3600,

    spawn: Object.freeze([
      0,
      720,
      2450,
    ]),

    spawnPathAngle: -2 * DEG,

    assetRoot: './assets/world',

    maxHeapBytes: 450 * 1024 * 1024,
  }),

  performance: Object.freeze({
    maxDrawCalls: 360,
    maxVisibleTriangles: 680000,
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
      Math.max(
        1e-6,
        fullDeflection - deadzone
      ),
    0,
    1,
  );

  return Math.sign(deflection) *
    maxRate *
    Math.pow(normalized, exponent);
}
