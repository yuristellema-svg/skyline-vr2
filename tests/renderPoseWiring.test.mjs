import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  wireAircraftVisuals,
  wireCamera,
  wireMain,
} from '../wiring/renderInterpolationWiring.mjs';

const mainFixture = `import { AircraftVisualSystem } from './aircraftVisuals.js';
const flight = new FlightModel();
function updateFloatingOrigin(position) {
  const distance = 0;
  if (
    distance <
    CONFIG.world.floatingOriginDistance
  ) {
    return;
  }
  stereo.uiScene.updateMatrixWorld(
    true
  );
}
function resetFlight() {
  updateFloatingOrigin(
    flight.position
  );

  cameraRig.reset(flight);
  accumulator = 0;
}
function ensureLiveFlight() {
  accumulator = 0;
  lastFrame = performance.now() / 1000;
  cameraRig.reset(flight);
}
cameraRig.reset(flight);
function frame() {
      flight.step(
        CONFIG.physics.fixedStep,
        input.controls
      );
      droppedSteps += 1;
      droppedPhysicsThisFrame = 1;
  updateFloatingOrigin(
    flight.position
  );

  effects.update(
  cameraRig.update(
    frameDt,
    flight,
  aircraftVisuals.update(
    frameDt,
    flight,
    accumulator = 0;

    if (
      document.visibilityState ===
    accumulator = 0;

    void acquireWakeLock();
}
`;

const cameraFixture = `export class CameraRig {
  reset(flight) {
    this.a = flight.speed;
    this.b.copy(flight.position);
    this.c.copy(flight.attitude);
  }
  update(
    dt,
    flight,
    stereoEnabled,
  ) {
    this.a = flight.speed;
    this.b.copy(flight.position);
    this.c.copy(flight.attitude);
    this.d = flight.angularVelocity.z;
    this.e = flight.viewYaw;
  }
}
`;

const aircraftFixture = fs.readFileSync(
  new URL('./fixtures/aircraft-update.fixture.js', import.meta.url),
  'utf8',
);

test('main wiring captures fixed poses and shares one sampled pose', () => {
  const wired = wireMain(mainFixture);
  assert.match(wired, /RenderPoseInterpolator/);
  assert.match(wired, /captureFixedStep\(flight\)/);
  assert.match(wired, /accumulator,\n\s+CONFIG\.physics\.fixedStep/);
  assert.match(wired, /cameraRig\.update\([\s\S]*sharedRenderPose/);
  assert.match(wired, /aircraftVisuals\.update\([\s\S]*sharedRenderPose/);
  assert.match(wired, /floating-origin/);
  assert.equal(wireMain(wired), wired, 'wiring must be idempotent');
});

test('camera consumes render pose while preserving current yaw and shake stage', () => {
  const wired = wireCamera(cameraFixture);
  assert.doesNotMatch(wired, /flight\.(position|attitude|speed|viewYaw)/);
  assert.match(wired, /renderPose\.viewYaw/);
  assert.match(wired, /SKYLINE_RENDER_POSE_INTERPOLATION_V1_CAMERA/);
});

test('aircraft receives shared pose and synthetic model flutter is removed', () => {
  const wired = wireAircraftVisuals(aircraftFixture);
  assert.match(wired, /update\(dt, renderPose/);
  assert.match(wired, /externalRoot\.position\.copy\(renderPose\.position\)/);
  assert.match(wired, /cockpitRoot\.position\.set\(0, 0, 0\)/);
  assert.doesNotMatch(wired, /Math\.sin\(this\.elapsed \* 17\)/);
  assert.match(wired, /propeller\.rotation\.z/);
});
