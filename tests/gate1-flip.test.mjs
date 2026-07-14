import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, DEG } from '../src/config.js';
import {
  FlightModel,
  TELEMETRY_EVENT_COLLISION,
} from '../src/flightModel.js';

const ZERO = { pitchRate: 0, rollRate: 0 };
const FORWARD = new THREE.Vector3(0, 0, -1);
const direction = new THREE.Vector3();

function separationFromNose(model) {
  direction.copy(model.velocity).normalize();
  return Math.acos(THREE.MathUtils.clamp(direction.dot(FORWARD), -1, 1));
}

test('179.9 degree separation converges monotonically without a speed discontinuity', () => {
  const model = new FlightModel();
  const offset = 0.1 * DEG;
  model.reset(0, 5000, 0, 90);
  model.velocity.set(Math.sin(offset) * 90, 0, Math.cos(offset) * 90);

  let previousAngle = separationFromNose(model);
  let previousSpeed = model.speed;
  let maximumSpeedStep = 0;

  for (let i = 0; i < 2 / CONFIG.physics.fixedStep; i += 1) {
    model.step(CONFIG.physics.fixedStep, ZERO);
    const angle = separationFromNose(model);
    const speedStep = Math.abs(model.speed - previousSpeed);
    maximumSpeedStep = Math.max(maximumSpeedStep, speedStep);
    if (previousAngle > 1e-7) {
      assert.ok(
        angle <= previousAngle + 1e-10,
        `separation increased at frame ${i}: ${previousAngle} -> ${angle}`
      );
    } else {
      assert.ok(angle < 1e-7, `aligned state drifted at frame ${i}: ${angle}`);
    }
    previousAngle = angle;
    previousSpeed = model.speed;
  }

  // Gate 2 deliberately limits path authority by available lift and G. Gate 1
  // requires monotonic shortest-arc convergence in two seconds, not an
  // unphysical guarantee that a near-opposite path is already fully aligned.
  assert.ok(previousAngle < Math.PI - 0.75, `final separation ${previousAngle}`);
  // Gate 2's continuous parasitic + induced drag can legitimately exceed the
  // old prototype's 0.02 m/s tick; the bug criterion is an abrupt discontinuity.
  assert.ok(maximumSpeedStep < 0.1, `largest speed step ${maximumSpeedStep} m/s`);
  assert.equal(model.telemetryGlitchDetected, false);
});

test('telemetry is a 600-frame ordered ring and preserves the first glitch capture', () => {
  const model = new FlightModel();
  model.reset(0, 5000, 0, 70);
  model.clearTelemetry();

  for (let i = 0; i < 605; i += 1) model.step(CONFIG.physics.fixedStep, ZERO);
  model.flagTelemetryEvent(TELEMETRY_EVENT_COLLISION);
  model.step(CONFIG.physics.fixedStep, ZERO);

  const live = model.readTelemetrySnapshot();
  assert.equal(live.capacity, 600);
  assert.equal(live.count, 600);
  assert.ok(live.frames[0].t < live.frames.at(-1).t);
  assert.equal(live.frames.at(-1).collisionRespawnFlag, TELEMETRY_EVENT_COLLISION);

  model.velocity.set(0, model.speed, 0);
  model.step(CONFIG.physics.fixedStep, ZERO);
  assert.equal(model.telemetryGlitchDetected, true);

  const captured = model.readTelemetrySnapshot(true);
  assert.equal(captured.count, 600);
  assert.ok(Math.abs(captured.glitch.pathAngleDelta) > 45 * DEG);
  assert.doesNotThrow(() => JSON.parse(model.exportTelemetrySnapshot(true)));
});
