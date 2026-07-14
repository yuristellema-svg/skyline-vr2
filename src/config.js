export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-calm-1.3.1',

  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,

    // Noticeably slower than the previous build.
    spawnSpeed: 72,
    minimumSpeed: 24,

    // Smoother and less violent turning.
    angularResponse: 10,
    angularRelease: 14,

    aero: Object.freeze({
      liftSlope: 3.2,

      // Forgiving, but an extreme pull can still stall.
      stallAngle: 45 * DEG,
      postStallAngle: 78 * DEG,
      postStallLiftFraction: 0.72,

      liftRateCoefficient: 0.017,
      maximumG: 6,

      // Moderate drag: speed matters, but it should not collapse instantly.
      parasiticDrag: 1.2e-4,
      inducedDrag: 2.8e-4,

      // Gentle stall recovery.
      stallPitchAcceleration: 0.35,
      gravityPathBend: 0.78,
    }),

    boost3: Object.freeze({
      // Requires a real but not extreme dive.
      chargeSpeed: 80,
      chargePathAngle: -10 * DEG,
      chargeSeconds: 2,

      armedSeconds: 7,
      drainSeconds: 3,

      triggerPitchRate: 15 * DEG,

      // Much weaker than the previous version.
      duration: 2.5,
      deltaSpeed: 16,
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

    pitchMaxRate: 75 * DEG,
    rollMaxRate: 120 * DEG,

    responseExponent: 1.7,

    yawMenuThreshold: 45 * DEG,
    yawMenuHold: 1,

    sensorStaleAfter: 0.8,

    // Less twitchy.
    inputSlewSeconds: 0.12,

    highSpeedControlStart: 90,
    highSpeedControlFull: 120,
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

    // Less dramatic speed zoom.
    monoSpeedFov: 6,

    stereoFov: 80,

    fovSpeedStart: 70,
    fovSpeedFull: 125,

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
    // Much less visual clutter.
    streakCount: 100,
    streakStartSpeed: 75,
    streakFullSpeed: 130,
    streakDepth: 45,
    streakRadius: 8,

    boostIntensity: 1.1,

    gVignetteStart: 5.5,
    gVignetteFull: 8.5,

    maxViewSqueeze: 0.005,

    // Disable permanent speed shake.
    maxVrShake: 0,

    negativeGTintStart: -0.7,

    // Disable stall shaking.
    stallBuffetAngle: 0,

    // Hides the giant PULL / BOOST text beyond the camera range.
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
