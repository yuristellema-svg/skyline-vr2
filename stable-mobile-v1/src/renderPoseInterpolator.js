const EPSILON = 1e-10;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function assertPose(source, label = 'pose') {
  if (!source?.position?.clone || !source?.attitude?.clone) {
    throw new TypeError(`${label} must expose cloneable position and attitude objects`);
  }

  const p = source.position;
  const q = source.attitude;
  const finitePosition = [p.x, p.y, p.z].every(Number.isFinite);
  const finiteAttitude = [q.x, q.y, q.z, q.w].every(Number.isFinite);
  const lengthSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;

  if (!finitePosition || !finiteAttitude || lengthSq <= EPSILON) {
    throw new RangeError(`${label} contains a non-finite or zero-length transform`);
  }
}

function negateQuaternion(quaternion) {
  quaternion.set(
    -quaternion.x,
    -quaternion.y,
    -quaternion.z,
    -quaternion.w,
  );
  return quaternion;
}

function createPoseLike(source) {
  const pose = {
    position: source.position.clone(),
    attitude: source.attitude.clone(),
    speed: Number(source.speed) || 0,
    viewYaw: Number(source.viewYaw) || 0,
    pathAngle: Number(source.pathAngle) || 0,
    gLoad: Number(source.gLoad) || 0,
    stallAmount: Number(source.stallAmount) || 0,
    lowSpeedRecoveryActive: Boolean(source.lowSpeedRecoveryActive),
    isRenderPose: true,
  };

  if (source.velocity?.clone) pose.velocity = source.velocity.clone();
  if (source.angularVelocity?.clone) {
    pose.angularVelocity = source.angularVelocity.clone();
  }

  return pose;
}

function copyImmediateState(target, source) {
  target.speed = Number(source.speed) || 0;
  target.viewYaw = Number(source.viewYaw) || 0;
  target.pathAngle = Number(source.pathAngle) || 0;
  target.gLoad = Number(source.gLoad) || 0;
  target.stallAmount = Number(source.stallAmount) || 0;
  target.lowSpeedRecoveryActive = Boolean(source.lowSpeedRecoveryActive);

  if (target.velocity && source.velocity?.x !== undefined) {
    target.velocity.copy(source.velocity);
  }

  if (target.angularVelocity && source.angularVelocity?.x !== undefined) {
    target.angularVelocity.copy(source.angularVelocity);
  }

  return target;
}

function copyTransform(target, source) {
  target.position.copy(source.position);
  target.attitude.copy(source.attitude).normalize();
  return copyImmediateState(target, source);
}

/**
 * Render-only fixed-step pose interpolation.
 *
 * Physics remains authoritative. The class stores the previous and current
 * completed fixed-step poses, then exposes a display pose between them.
 * Immediate view data such as phone head yaw is copied from the current pose
 * instead of interpolated, so VR head tracking does not acquire input lag.
 */
export class RenderPoseInterpolator {
  constructor(initialPose = null) {
    this.previous = null;
    this.current = null;
    this.renderPose = null;
    this.initialized = false;
    this.resetCount = 0;
    this.lastResetReason = 'uninitialized';

    if (initialPose) this.reset(initialPose, 'initial');
  }

  createRenderPose(source = this.current) {
    if (!source) {
      throw new Error('Cannot create a render pose before initialization');
    }
    return createPoseLike(source);
  }

  reset(source, reason = 'reset') {
    assertPose(source, 'reset pose');

    if (!this.initialized) {
      this.previous = createPoseLike(source);
      this.current = createPoseLike(source);
      this.renderPose = createPoseLike(source);
      this.initialized = true;
    } else {
      copyTransform(this.previous, source);
      copyTransform(this.current, source);
      copyTransform(this.renderPose, source);
    }

    this.resetCount += 1;
    this.lastResetReason = reason;
    return this.renderPose;
  }

  captureFixedStep(source) {
    assertPose(source, 'fixed-step pose');
    if (!this.initialized) return this.reset(source, 'first-fixed-step');

    copyTransform(this.previous, this.current);
    copyTransform(this.current, source);

    // q and -q represent the same orientation. Keep successive samples in one
    // hemisphere so slerp never takes a discontinuous long path.
    if (this.previous.attitude.dot(this.current.attitude) < 0) {
      negateQuaternion(this.current.attitude);
    }

    return this.current;
  }

  sample(alpha, target = this.renderPose) {
    if (!this.initialized) {
      throw new Error('RenderPoseInterpolator has not been initialized');
    }

    const t = clamp01(alpha);
    target.position
      .copy(this.previous.position)
      .lerp(this.current.position, t);

    target.attitude
      .copy(this.previous.attitude)
      .slerp(this.current.attitude, t)
      .normalize();

    // These fields must stay current. In particular, viewYaw is direct phone
    // head tracking and must never be delayed by fixed-step interpolation.
    copyImmediateState(target, this.current);
    target.interpolationAlpha = t;
    target.isRenderPose = true;
    return target;
  }

  sampleCurrent(target = this.renderPose) {
    if (!this.initialized) {
      throw new Error('RenderPoseInterpolator has not been initialized');
    }
    copyTransform(target, this.current);
    target.interpolationAlpha = 1;
    target.isRenderPose = true;
    return target;
  }

  getStepDistance() {
    if (!this.initialized) return 0;
    return this.previous.position.distanceTo(this.current.position);
  }
}

export function renderInterpolationAlpha(accumulator, fixedStep) {
  if (!Number.isFinite(fixedStep) || fixedStep <= 0) return 0;
  return clamp01(accumulator / fixedStep);
}
