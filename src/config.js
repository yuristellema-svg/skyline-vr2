export const DEG = Math.PI / 180;

// SKYLINE_V5_INTEGRATION
// SKYLINE_V5_1_PHYSICS_PERFORMANCE
// SKYLINE_BUNDLE_B_CONFIG
export const CONFIG = Object.freeze({
  version: 'skyline-bundle-b-world-sim',

  physics: Object.freeze({
    fixedStep: 1 / 90,
    maxSubSteps: 10,
    gravity: 9.81,

    // Starts fast, but there is no automatic cruise target anymore.
    spawnSpeed: 58,
    minimumSpeed: 0,
    preferredCruiseSpeed: 0,
    softMaximumSpeed: 5000,
    maximumSpeed: 5000,

    maximumAcceleration: 30,
    maximumDeceleration: 34,

    // The aircraft now builds and releases rotation with visible inertia.
    angularResponse: 6.4,
    angularRelease: 14,

    energy: Object.freeze({
      gravityBlendAngle: 30 * DEG,

      // Height and speed deliberately trade into one another. A long dive can
      // build extreme speed, while a fast pull-up retains enough momentum to
      // support repeated dive-climb cycles.
      diveGravityMultiplier: 1.42,
      climbGravityMultiplier: 0.72,

      // No engine or invisible cruise control.
      levelAssistFullAngle: 0,
      levelAssistZeroAngle: 0,
      levelAssistSpeedBand: 0,
      levelFlightAssistance: 0,
      levelAssistDragFraction: 0,

      maximumOverspeedDrag: 0,
      overspeedExponent: 2,
    }),

    aero: Object.freeze({
      liftSlope: 3.0,

      stallWarningAngle: 20 * DEG,
      stallAngle: 35 * DEG,
      postStallAngle: 68 * DEG,
      postStallLiftFraction: 0.50,

      stallAttackTime: 0.42,
      stallReleaseTime: 0.2,

      // Recovery never steals the controls.
      stallRecoveryStart: 1,
      stallRecoveryStrength: 0,

      liftRateCoefficient: 0.034,
      maximumG: 15,

      // Very light straight-line drag.
      // Hard turns provide the real braking.
      parasiticDrag: 0.000002,
      inducedDrag: 0.000012,
      gravityPathBend: 0.04,
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

  }),

  controls: Object.freeze({
    // No steering dead zone.
    pitchDeadzone: 0,
    rollDeadzone: 0,

    pitchFullDeflection: 12 * DEG,
    rollFullDeflection: 14 * DEG,

    pitchMaxRate: 82 * DEG,
    rollMaxRate: 108 * DEG,

    responseExponent: 1.05,

    // SKYLINE_RECOVERED_VR_TUNING
    // Looking left/right is now camera look.
    headLookMaxYaw: 88 * DEG,
    headLookResponse: 10,

    // Kept for compatibility. Yaw no longer opens the menu.
    yawMenuThreshold: 180 * DEG,
    yawMenuHold: 99,

    sensorStaleAfter: 0.8,
    inputSlewSeconds: 0.05,

    highSpeedControlStart: 70,
    highSpeedControlFull: 260,
    highSpeedControlScale: 0.42,
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
    monoSpeedFov: 20,
    stereoFov: 80,

    fovSpeedStart: 50,
    fovSpeedFull: 260,

    thirdBack: 11,
    thirdUp: 3.5,
    thirdPullback: 2,

    thirdPositionResponse: 12,
    thirdRollLagSeconds: 0.08,
    thirdMaxRollLag: 10 * DEG,

    rollLagResponse: 14,

    near: 0.08,
    far: 7200,
  }),

  effects: Object.freeze({
    streakCount: 160,
    streakStartSpeed: 35,
    streakFullSpeed: 260,
    streakDepth: 110,
    streakRadius: 13,

    boostIntensity: 1,

    gVignetteStart: 4.6,
    gVignetteFull: 8.4,

    maxViewSqueeze: 0.035,
    maxVrShake: 0.12 * DEG,
    stallBuffetAngle: 18 * DEG,

    negativeGTintStart: -1.25,
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

    fogNear: 3200,
    fogFar: 5400,
  }),

  world: Object.freeze({
    size: 8192,
    halfSize: 4096,

    sampleSpacing: 2,
    chunkSize: 256,

    // Nearly the entire authored world stays around the player.
    loadRadius: 3072,
    unloadRadius: 3584,

    fullLodRadius: 640,
    halfLodRadius: 1536,

    renderSpacingFull: 4,
    renderSpacingHalf: 8,
    renderSpacingFar: 16,

    floatingOriginDistance: 2048,

    fogNear: 3200,
    fogFar: 5400,

    spawn: Object.freeze([
      0,
      720,
      2450,
    ]),

    spawnPathAngle: -2 * DEG,

    assetRoot: './assets/world',

    maxHeapBytes: 520 * 1024 * 1024,
  }),

  performance: Object.freeze({
    maxDrawCalls: 420,
    maxVisibleTriangles: 1200000,
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
        fullDeflection - deadzone,
      ),
    0,
    1,
  );

  return Math.sign(deflection) *
    maxRate *
    Math.pow(normalized, exponent);
}
