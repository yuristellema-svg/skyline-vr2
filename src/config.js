export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-open-speed-1.4.2',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    // Starts at 162 km/h.
    spawnSpeed: 45,

    // Prevents completely dead, uncontrollable flight.
    minimumSpeed: 25,

    preferredCruiseSpeed: 45,

    // Effectively removes the old 178 km/h speed ceiling.
    // 1000 m/s is only an extreme numerical safety limit.
    softMaximumSpeed: 900,
    maximumSpeed: 1000,

    maximumAcceleration: 30,

    // Prevents speed from disappearing instantly during a pull-up.
    maximumDeceleration: 4.5,

    angularResponse: 14,
    angularRelease: 18,

    energy: Object.freeze({
      gravityBlendAngle: 30 * DEG,

      // Diving produces noticeably more speed.
      diveGravityMultiplier: 1.35,

      // Climbing still costs speed, but far less.
      climbGravityMultiplier: 0.28,

      // Nearly maintain speed during ordinary level flight.
      levelAssistFullAngle: 3 * DEG,
      levelAssistZeroAngle: 10 * DEG,
      levelAssistSpeedBand: 8,
      levelFlightAssistance: 1.2,
      levelAssistDragFraction: 0.9,

      // No artificial high-speed braking.
      maximumOverspeedDrag: 0,
      overspeedExponent: 2,
    }),

    aero: Object.freeze({
      liftSlope: 3.2,

      // Stall remains possible only during a very extreme sustained pull.
      stallWarningAngle: 45 * DEG,
      stallAngle: 65 * DEG,
      postStallAngle: 95 * DEG,

      // A stall barely reduces lift and never locks controls.
      postStallLiftFraction: 0.92,

      stallAttackTime: 0.8,
      stallReleaseTime: 0.08,

      stallRecoveryStart: 1,
      stallRecoveryStrength: 0,

      // Makes the real movement direction follow where you look much faster.
      liftRateCoefficient: 0.03,
      maximumG: 14,

      // Much less speed destruction during pull-ups.
      parasiticDrag: 0.000035,
      inducedDrag: 0.00002,

      // Greatly reduces the persistent downward pull.
      gravityPathBend: 0.2,
    }),

    // Boost is fully disabled.
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
    pitchDeadzone: 3 * DEG,
    rollDeadzone: 3 * DEG,

    pitchFullDeflection: 25 * DEG,
    rollFullDeflection: 30 * DEG,

    pitchMaxRate: 100 * DEG,
    rollMaxRate: 150 * DEG,

    responseExponent: 1.6,

    yawMenuThreshold: 45 * DEG,
    yawMenuHold: 1,

    sensorStaleAfter: 0.8,
    inputSlewSeconds: 0.07,

    highSpeedControlStart: 120,
    highSpeedControlFull: 220,
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
    monoSpeedFov: 10,
    stereoFov: 80,

    fovSpeedStart: 45,
    fovSpeedFull: 180,

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
    streakCount: 160,
    streakStartSpeed: 45,
    streakFullSpeed: 220,
    streakDepth: 55,
    streakRadius: 9,

    boostIntensity: 1,

    gVignetteStart: 7,
    gVignetteFull: 12,

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
