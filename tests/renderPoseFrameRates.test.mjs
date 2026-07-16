import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RenderPoseInterpolator,
  renderInterpolationAlpha,
} from '../src/renderPoseInterpolator.js';
import { Quat, Vec3, makePose, quaternionAngle } from './testMath.mjs';

const FIXED_STEP = 1 / 120;
const DISPLAY_RATES = [30, 60, 90, 120];
const SPEEDS = [60, 140, 300, 600];
const FORWARD = new Vec3(0, 0, -1);
const UP = new Vec3(0, 1, 0);
const RIGHT = new Vec3(1, 0, 0);

function commandFor(scenario, time) {
  switch (scenario) {
    case 'sustained-turn':
      return { yawRate: 0.42, pitchRate: 0, acceleration: 0 };
    case 'rapid-reversal':
      return {
        yawRate: time < 1.25 ? 0.95 : time < 2.5 ? -0.95 : 0.18,
        pitchRate: time > 2.5 ? 0.22 : 0,
        acceleration: 0,
      };
    case 'dive':
      return { yawRate: 0.08, pitchRate: -0.32, acceleration: 10 };
    case 'boost-exit':
      return { yawRate: time > 1.1 ? 0.55 : 0.05, pitchRate: 0.08, acceleration: 0 };
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

function stepSynthetic(state, dt, scenario, time, boostState) {
  const command = commandFor(scenario, time);
  if (scenario === 'boost-exit' && !boostState.fired && time >= 1) {
    state.speed *= 1.26;
    boostState.fired = true;
  }
  state.speed = Math.max(1, state.speed + command.acceleration * dt);

  const yaw = new Quat().setFromAxisAngle(UP, command.yawRate * dt);
  const pitch = new Quat().setFromAxisAngle(RIGHT, command.pitchRate * dt);
  state.attitude.multiply(yaw).multiply(pitch).normalize();

  const forward = FORWARD.clone().applyQuaternion(state.attitude).normalize();
  state.velocity.copy(forward).multiplyScalar(state.speed);
  state.position.addScaledVector(state.velocity, dt);
  state.angularVelocity.set(command.pitchRate, command.yawRate, 0);
  state.pathAngle = Math.asin(Math.max(-1, Math.min(1, forward.y)));
  state.gLoad = 1 + Math.abs(command.yawRate) * state.speed / 80;
}

function simulate(displayHz, initialSpeed, scenario) {
  const state = makePose(initialSpeed);
  const interpolator = new RenderPoseInterpolator(state);
  const output = interpolator.createRenderPose(state);
  const boostState = { fired: false };
  const frameDt = 1 / displayHz;
  const duration = 4;
  let accumulator = 0;
  let fixedTime = 0;
  let previousRendered = output.position.clone();
  let previousQuaternion = output.attitude.clone();
  let maxRenderedStep = 0;
  let maxAngularStep = 0;
  let maxLag = 0;

  for (let frame = 0; frame < Math.round(duration * displayHz); frame += 1) {
    accumulator += frameDt;
    while (accumulator + 1e-12 >= FIXED_STEP) {
      fixedTime += FIXED_STEP;
      stepSynthetic(state, FIXED_STEP, scenario, fixedTime, boostState);
      interpolator.captureFixedStep(state);
      accumulator -= FIXED_STEP;
    }

    const alpha = renderInterpolationAlpha(accumulator, FIXED_STEP);
    const renderPose = interpolator.sample(alpha, output);

    for (const value of [
      renderPose.position.x,
      renderPose.position.y,
      renderPose.position.z,
      renderPose.attitude.x,
      renderPose.attitude.y,
      renderPose.attitude.z,
      renderPose.attitude.w,
    ]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(Math.abs(renderPose.attitude.length() - 1) < 1e-9);

    const renderedStep = renderPose.position.distanceTo(previousRendered);
    const angularStep = quaternionAngle(renderPose.attitude, previousQuaternion);
    maxRenderedStep = Math.max(maxRenderedStep, renderedStep);
    maxAngularStep = Math.max(maxAngularStep, angularStep);
    maxLag = Math.max(maxLag, renderPose.position.distanceTo(state.position));

    // The render pose can lag by at most one completed fixed step. Camera and
    // aircraft share this pose, so there is no relative camera/model jitter.
    assert.ok(
      renderPose.position.distanceTo(state.position) <=
        interpolator.getStepDistance() + 1e-7,
      `visual lag exceeded one fixed step at ${displayHz} Hz`,
    );

    previousRendered.copy(renderPose.position);
    previousQuaternion.copy(renderPose.attitude);

    if (Math.abs(fixedTime - 2) < FIXED_STEP * 0.51) {
      // Floating origin changes scene coordinates, not physics coordinates.
      // Resetting the pose prevents a blend over the origin discontinuity.
      interpolator.reset(state, 'floating-origin');
    }
  }

  return {
    position: output.position.clone(),
    attitude: output.attitude.clone(),
    maxRenderedStep,
    maxAngularStep,
    maxLag,
  };
}

for (const speed of SPEEDS) {
  for (const scenario of [
    'sustained-turn',
    'rapid-reversal',
    'dive',
    'boost-exit',
  ]) {
    test(`${scenario} at ${speed} m/s remains continuous at 30/60/90/120 Hz`, () => {
      const results = new Map(
        DISPLAY_RATES.map(rate => [rate, simulate(rate, speed, scenario)]),
      );
      const reference = results.get(120);

      for (const rate of DISPLAY_RATES) {
        const result = results.get(rate);
        const positionalTolerance = Math.max(1e-6, speed * FIXED_STEP * 1.35);
        assert.ok(
          result.position.distanceTo(reference.position) <= positionalTolerance,
          `${rate} Hz final position diverged for ${scenario} at ${speed} m/s`,
        );
        assert.ok(
          quaternionAngle(result.attitude, reference.attitude) < 2e-4,
          `${rate} Hz final attitude diverged for ${scenario} at ${speed} m/s`,
        );
        assert.ok(result.maxRenderedStep < speed * (1 / 30 + FIXED_STEP) * 1.8 + 30);
        assert.ok(result.maxAngularStep < 0.18);
      }
    });
  }
}
