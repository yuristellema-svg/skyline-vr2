import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RenderPoseInterpolator,
  renderInterpolationAlpha,
} from '../src/renderPoseInterpolator.js';
import { Quat, Vec3, makePose, quaternionAngle } from './testMath.mjs';

test('position uses lerp and quaternion uses shortest-path slerp', () => {
  const start = makePose(60);
  const interpolator = new RenderPoseInterpolator(start);
  const end = makePose(140);
  end.position.set(12, -4, 8);
  end.attitude.setFromAxisAngle(new Vec3(0, 1, 0), Math.PI * 0.75);
  end.viewYaw = 0.8;
  end.angularVelocity.set(1, 2, 3);
  interpolator.captureFixedStep(end);

  const pose = interpolator.sample(0.25);
  assert.deepEqual([pose.position.x, pose.position.y, pose.position.z], [3, -1, 2]);
  assert.ok(Math.abs(pose.attitude.length() - 1) < 1e-12);
  assert.ok(quaternionAngle(start.attitude, pose.attitude) > 0);
  assert.equal(pose.viewYaw, 0.8, 'head yaw must remain current-frame responsive');
  assert.deepEqual(
    [pose.angularVelocity.x, pose.angularVelocity.y, pose.angularVelocity.z],
    [1, 2, 3],
  );
});

test('equivalent opposite-sign quaternions remain continuous', () => {
  const pose = makePose(300);
  pose.attitude.setFromAxisAngle(new Vec3(1, 0, 0), 1.2);
  const interpolator = new RenderPoseInterpolator(pose);

  const equivalent = makePose(300);
  equivalent.attitude.set(
    -pose.attitude.x,
    -pose.attitude.y,
    -pose.attitude.z,
    -pose.attitude.w,
  );
  interpolator.captureFixedStep(equivalent);

  const midpoint = interpolator.sample(0.5);
  assert.ok(quaternionAngle(midpoint.attitude, pose.attitude) < 1e-10);
  assert.ok(Math.abs(midpoint.attitude.length() - 1) < 1e-12);
});

test('reset prevents interpolation across spawn, teleport and origin changes', () => {
  const pose = makePose(600);
  const interpolator = new RenderPoseInterpolator(pose);

  const moved = makePose(600);
  moved.position.set(5, 2, -20);
  interpolator.captureFixedStep(moved);
  assert.ok(interpolator.sample(0.5).position.distanceTo(moved.position) > 0);

  const teleported = makePose(600);
  teleported.position.set(8000, 900, -6000);
  interpolator.reset(teleported, 'floating-origin');

  for (const alpha of [0, 0.1, 0.5, 0.9, 1]) {
    assert.ok(interpolator.sample(alpha).position.distanceTo(teleported.position) < 1e-12);
  }
  assert.equal(interpolator.lastResetReason, 'floating-origin');
});

test('alpha is finite and clamped', () => {
  assert.equal(renderInterpolationAlpha(1 / 240, 1 / 120), 0.5);
  assert.equal(renderInterpolationAlpha(-1, 1 / 120), 0);
  assert.equal(renderInterpolationAlpha(1, 1 / 120), 1);
  assert.equal(renderInterpolationAlpha(Number.NaN, 1 / 120), 0);
  assert.equal(renderInterpolationAlpha(1, 0), 0);
});

test('invalid transforms are rejected rather than rendered', () => {
  const pose = makePose();
  const interpolator = new RenderPoseInterpolator(pose);
  const invalid = makePose();
  invalid.position.x = Number.NaN;
  assert.throws(() => interpolator.captureFixedStep(invalid), /non-finite/);

  const invalidQuaternion = makePose();
  invalidQuaternion.attitude = new Quat(0, 0, 0, 0);
  assert.throws(() => interpolator.captureFixedStep(invalidQuaternion), /zero-length/);
});
