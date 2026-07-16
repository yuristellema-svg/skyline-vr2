const MARKER = 'SKYLINE_RENDER_POSE_INTERPOLATION_V1';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Wiring target not found: ${label}`);
  }
  return source.replace(before, after);
}

export function wireMain(source) {
  if (source.includes(MARKER)) return source;

  source = replaceOnce(
    source,
    "import { AircraftVisualSystem } from './aircraftVisuals.js';\n",
    "import { AircraftVisualSystem } from './aircraftVisuals.js';\n" +
      "import { RenderPoseInterpolator, renderInterpolationAlpha } from './renderPoseInterpolator.js';\n",
    'main import',
  );

  source = replaceOnce(
    source,
    "const flight = new FlightModel();\n",
    "const flight = new FlightModel();\n" +
      "// SKYLINE_RENDER_POSE_INTERPOLATION_V1\n" +
      "const renderPoseInterpolator = new RenderPoseInterpolator(flight);\n" +
      "const renderPose = renderPoseInterpolator.createRenderPose(flight);\n" +
      "let sharedRenderPose = renderPose;\n",
    'interpolator construction',
  );

  source = replaceOnce(
    source,
    "  if (\n    distance <\n    CONFIG.world.floatingOriginDistance\n  ) {\n    return;\n  }",
    "  if (\n    distance <\n    CONFIG.world.floatingOriginDistance\n  ) {\n    return false;\n  }",
    'floating-origin early return',
  );

  source = replaceOnce(
    source,
    "  stereo.uiScene.updateMatrixWorld(\n    true\n  );\n}",
    "  stereo.uiScene.updateMatrixWorld(\n    true\n  );\n\n" +
      "  renderPoseInterpolator.reset(\n" +
      "    flight,\n" +
      "    'floating-origin',\n" +
      "  );\n" +
      "  return true;\n}",
    'floating-origin reset',
  );

  source = replaceOnce(
    source,
    "  updateFloatingOrigin(\n    flight.position\n  );\n\n  cameraRig.reset(flight);\n  accumulator = 0;",
    "  updateFloatingOrigin(\n    flight.position\n  );\n\n" +
      "  renderPoseInterpolator.reset(flight, 'spawn');\n" +
      "  sharedRenderPose = renderPoseInterpolator.sampleCurrent(renderPose);\n" +
      "  cameraRig.reset(sharedRenderPose);\n" +
      "  accumulator = 0;",
    'spawn reset',
  );

  source = replaceOnce(
    source,
    "  accumulator = 0;\n  lastFrame = performance.now() / 1000;\n  cameraRig.reset(flight);",
    "  accumulator = 0;\n" +
      "  lastFrame = performance.now() / 1000;\n" +
      "  renderPoseInterpolator.reset(flight, 'ensure-live');\n" +
      "  sharedRenderPose = renderPoseInterpolator.sampleCurrent(renderPose);\n" +
      "  cameraRig.reset(sharedRenderPose);",
    'ensure-live reset',
  );

  source = source.replaceAll(
    'cameraRig.reset(flight);',
    'cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));',
  );

  source = replaceOnce(
    source,
    "      flight.step(\n        CONFIG.physics.fixedStep,\n        input.controls\n      );",
    "      flight.step(\n        CONFIG.physics.fixedStep,\n        input.controls\n      );\n\n" +
      "      renderPoseInterpolator.captureFixedStep(flight);",
    'fixed-step capture',
  );

  source = replaceOnce(
    source,
    "      droppedSteps += 1;\n      droppedPhysicsThisFrame = 1;",
    "      droppedSteps += 1;\n" +
      "      droppedPhysicsThisFrame = 1;\n" +
      "      renderPoseInterpolator.reset(flight, 'dropped-physics-time');",
    'dropped-time reset',
  );

  source = replaceOnce(
    source,
    "  updateFloatingOrigin(\n    flight.position\n  );\n\n  effects.update(",
    "  const originShifted = updateFloatingOrigin(\n    flight.position\n  );\n\n" +
      "  if (originShifted) {\n" +
      "    cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));\n" +
      "  }\n\n" +
      "  const renderAlpha = renderInterpolationAlpha(\n" +
      "    accumulator,\n" +
      "    CONFIG.physics.fixedStep,\n" +
      "  );\n" +
      "  sharedRenderPose = renderPoseInterpolator.sample(\n" +
      "    renderAlpha,\n" +
      "    renderPose,\n" +
      "  );\n\n" +
      "  effects.update(",
    'per-frame shared pose',
  );

  // Only the render consumers receive the display pose. Physics, collision,
  // effects, world streaming and the HUD remain on the authoritative state.
  source = replaceOnce(
    source,
    "  cameraRig.update(\n    frameDt,\n    flight,",
    "  cameraRig.update(\n    frameDt,\n    sharedRenderPose,",
    'camera shared pose',
  );

  source = replaceOnce(
    source,
    "  aircraftVisuals.update(\n    frameDt,\n    flight,",
    "  aircraftVisuals.update(\n    frameDt,\n    sharedRenderPose,",
    'aircraft shared pose',
  );

  source = source.replaceAll(
    "    accumulator = 0;\n\n    if (\n      document.visibilityState ===",
    "    accumulator = 0;\n" +
      "    renderPoseInterpolator.reset(flight, 'visibility-change');\n\n" +
      "    if (\n      document.visibilityState ===",
  );

  source = source.replaceAll(
    "    accumulator = 0;\n\n    void acquireWakeLock();",
    "    accumulator = 0;\n" +
      "    renderPoseInterpolator.reset(flight, 'pageshow');\n\n" +
      "    void acquireWakeLock();",
  );

  return source;
}

export function wireCamera(source) {
  if (source.includes(`${MARKER}_CAMERA`)) return source;

  source = source.replace(
    "export class CameraRig {",
    `// ${MARKER}_CAMERA\n// reset() and update() consume the shared render pose. Direct viewYaw and\n// camera shake remain current-frame values, so phone head tracking stays live.\nexport class CameraRig {`,
  );

  source = source.replace('reset(flight)', 'reset(renderPose)');
  source = source.replace(
    /update\(\n    dt,\n    flight,/,
    'update(\n    dt,\n    renderPose,',
  );

  source = source.replaceAll('flight.speed', 'renderPose.speed');
  source = source.replaceAll('flight.attitude', 'renderPose.attitude');
  source = source.replaceAll('flight.position', 'renderPose.position');
  source = source.replaceAll('flight.angularVelocity', 'renderPose.angularVelocity');
  source = source.replaceAll('flight.viewYaw', 'renderPose.viewYaw');

  return source;
}

export function wireAircraftVisuals(source) {
  if (source.includes(`${MARKER}_AIRCRAFT`)) return source;

  const start = source.indexOf("  update(dt, flight, cameraMode = 'first') {");
  const end = source.indexOf('\n  dispose() {', start);
  if (start < 0 || end < 0) {
    throw new Error('Wiring target not found: aircraft update method');
  }

  const replacement = `  // ${MARKER}_AIRCRAFT\n  // The model consumes the same render pose as the camera. Camera shake is not\n  // applied to the external root and the cockpit root has no synthetic flutter.\n  update(dt, renderPose, cameraMode = 'first') {\n    const safeDt = Math.max(0, Math.min(0.1, dt || 0));\n    this.elapsed += safeDt;\n    this.cameraMode = cameraMode;\n\n    this.cockpitRoot.visible = cameraMode === 'cockpit';\n    this.externalRoot.visible =\n      cameraMode === 'third' && Boolean(renderPose?.position);\n\n    if (this.externalRoot.visible) {\n      this.externalRoot.position.copy(renderPose.position);\n      if (renderPose.attitude?.isQuaternion) {\n        this.externalRoot.quaternion.copy(renderPose.attitude);\n      }\n    }\n\n    const speed = Math.max(0, Number(renderPose?.speed) || 0);\n    const propeller = this.externalModel?.userData?.propeller;\n    if (propeller) {\n      propeller.rotation.z += safeDt * (18 + Math.min(112, speed * 0.50));\n    }\n\n    const propellerBlur = this.externalModel?.userData?.propellerBlur;\n    if (propellerBlur?.material) {\n      const blurAmount = Math.max(0, Math.min(1, (speed - 18) / 95));\n      propellerBlur.material.opacity = blurAmount * 0.18;\n    }\n\n    const instruments = this.cockpitModel?.userData?.instruments || [];\n    if (instruments[0]) {\n      instruments[0].userData.needle.rotation.z =\n        -1.8 + Math.min(3.6, speed / 160 * 3.6);\n    }\n    if (instruments[1]) {\n      instruments[1].userData.needle.rotation.z =\n        -1.4 + Math.min(\n          2.8,\n          Math.max(0, renderPose?.position?.y || 0) / 1800 * 2.8,\n        );\n    }\n    if (instruments[2]) {\n      instruments[2].userData.needle.rotation.z =\n        -1.4 + Math.min(2.8, speed / 120 * 2.8);\n    }\n\n    // Genuine buffet belongs to camera effects. Never shake the aircraft model.\n    this.cockpitRoot.position.set(0, 0, 0);\n  }`;

  return source.slice(0, start) + replacement + source.slice(end);
}
