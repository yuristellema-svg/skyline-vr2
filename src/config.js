export const DEG = Math.PI / 180;

export const CONFIG = Object.freeze({
  version: 'fable-iteration-3-gated-1.0.0',
  physics: Object.freeze({
    fixedStep: 1 / 120,
    maxSubSteps: 8,
    gravity: 9.81,
    spawnSpeed: 62,
    minimumSpeed: 15,
    angularResponse: 14,
    angularRelease: 18,
    // Iteration 3 aerodynamic path model. Legacy alignment/drag values remain
    // above until Gate 2 is verified, but the flight model uses this block.
    aero: Object.freeze({
      liftSlope: 3.6,
      stallAngle: 16 * DEG,
      postStallAngle: 0.52,
      postStallLiftFraction: 0.35,
      liftRateCoefficient: 0.014,
      maximumG: 6,
      parasiticDrag: 5.8e-4,
      inducedDrag: 0.002,
      stallPitchAcceleration: 2.5,
      gravityPathBend: 1,
    }),
    boost3: Object.freeze({
      chargeSpeed: 90,
      chargePathAngle: -15 * DEG,
      chargeSeconds: 3,
      armedSeconds: 6,
      drainSeconds: 2,
      triggerPitchRate: 40 * DEG,
      duration: 3,
      deltaSpeed: 25,
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
      Object.freeze({ name: 'CALM', multiplier: 0.78 }),
      Object.freeze({ name: 'STANDARD', multiplier: 1 }),
      Object.freeze({ name: 'AGILE', multiplier: 1.22 }),
    ]),
    defaultIndex: 1,
  }),
  camera: Object.freeze({
    firstPersonHead: Object.freeze([0, 0.62, -0.18]),
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
    streakCount: 180,
    streakStartSpeed: 60,
    streakFullSpeed: 130,
    streakDepth: 52,
    streakRadius: 9,
    boostIntensity: 1.45,
    gVignetteStart: 4,
    gVignetteFull: 7,
    maxViewSqueeze: 0.02,
    maxVrShake: 0.2 * DEG,
    negativeGTintStart: -0.35,
    stallBuffetAngle: 0.15 * DEG,
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
    spawn: Object.freeze([0, 760, 420]),
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
    // A one-chunk render buffer beyond the 1.5 km visible radius keeps the
    // streaming edge fully behind the 1.6 km fog curtain.
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
    spawn: Object.freeze([0, 720, 2450]),
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
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(min, max, value) {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(current, target, response, dt) {
  return target + (current - target) * Math.exp(-response * dt);
}

export function wrapPi(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

export function rateFromDeflection(deflection, deadzone, fullDeflection, maxRate, exponent = 1.6) {
  const magnitude = Math.abs(deflection);
  if (magnitude <= deadzone) return 0;
  const normalized = clamp((magnitude - deadzone) / (fullDeflection - deadzone), 0, 1);
  return Math.sign(deflection) * maxRate * Math.pow(normalized, exponent);
}
