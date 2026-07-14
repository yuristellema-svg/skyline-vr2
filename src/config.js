export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-research-conservative-1.4.0',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    // Research-backed conservative wingsuit speed envelope.
    spawnSpeed: 28,
    minimumSpeed: 15,
    preferredCruiseSpeed: 29,
    softMaximumSpeed: 44,
    maximumSpeed: 52,

    // Numerical safety.
    maximumAcceleration: 24,
    maximumDeceleration: 24,

    angularResponse: 14,
    angularRelease: 18,

    energy: Object.freeze({
      // Dives convert altitude to speed slightly more strongly.
      gravityBlendAngle: 35 * DEG,
      diveGravityMultiplier: 1.18,

      // Climbs still lose speed, but retain more momentum while above minimum speed.
      climbGravityMultiplier: 0.72,

      // Refund part of ordinary drag only near level flight.
      levelAssistFullAngle: 2 * DEG,
      levelAssistZeroAngle: 7 * DEG,
      levelAssistSpeedBand: 3,
      levelFlightAssistance: 0.55,
      levelAssistDragFraction: 0.75,

      // Progressive drag prevents runaway speed.
      maximumOverspeedDrag: 18,
      overspeedExponent: 2,
    }),

    aero: Object.freeze({
      liftSlope: 3.6,

      // Warning begins before actual lift loss.
      stallWarningAngle: 12 * DEG,
      stallAngle: 18 * DEG,
      postStallAngle: 32 * DEG,
      postStallLiftFraction: 0.55,

      // Stall develops and clears gradually.
      stallAttackTime: 0.22,
      stallReleaseTime: 0.45,

      // Forced recovery begins only in a developed stall.
      stallRecoveryStart: 0.55,
      stallRecoveryStrength: 0.65,

      liftRateCoefficient: 0.014,
      maximumG: 6,

      // Much lower induced drag than the earlier build.
      parasiticDrag: 0.00042,
      inducedDrag: 0.00020,

      gravityPathBend: 1,
    }),

    boost3: Object.freeze({
      chargeSpeed: 34,
      chargePathAngle: -12 * DEG,
      chargeSeconds: 1.1,

      // One-second pull-up window; failed charge drains gently.
      armedSeconds: 1,
      drainSeconds: 5,

      triggerPitchRate: 18 * DEG,

      duration: 1.35,
      deltaSpeed: 9,
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
    // Subtle speed cues only.
    streakCount: 120,
    streakStartSpeed: 30,
    streakFullSpeed: 50,
    streakDepth: 48,
    streakRadius: 8,

    boostIntensity: 1.25,

    gVignetteStart: 5,
    gVignetteFull: 8,

    maxViewSqueeze: 0,

    // No involuntary VR camera shake.
    maxVrShake: 0,
    stallBuffetAngle: 0,

    negativeGTintStart: -0.7,

    // Hide the large DIVE / PULL / BOOST text.
    // The existing reticle ring still displays charge subtly.
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
