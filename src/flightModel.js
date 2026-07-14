import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, clamp, damp, smoothstep } from './config.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);

const ALIGNMENT_EPSILON = 1e-4;
const ALIGNMENT_AXIS_EPSILON_SQ = 1e-12;
const TELEMETRY_CAPACITY = 600;
const TELEMETRY_STRIDE = 31;
const PATH_ANGLE_GLITCH_THRESHOLD = Math.PI * 0.25;

const T_TIME = 0;
const T_DT = 1;
const T_POSITION_X = 2;
const T_POSITION_Y = 3;
const T_POSITION_Z = 4;
const T_SPEED = 5;
const T_PATH_ANGLE = 6;
const T_NOSE_VELOCITY_DOT = 7;
const T_AXIS_X = 8;
const T_AXIS_Y = 9;
const T_AXIS_Z = 10;
const T_ATTITUDE_X = 11;
const T_ATTITUDE_Y = 12;
const T_ATTITUDE_Z = 13;
const T_ATTITUDE_W = 14;
const T_ANGULAR_VELOCITY_X = 15;
const T_ANGULAR_VELOCITY_Y = 16;
const T_ANGULAR_VELOCITY_Z = 17;
const T_INPUT_PITCH_RATE = 18;
const T_INPUT_ROLL_RATE = 19;
const T_INPUT_YAW_RATE = 20;
const T_BOOST_CHARGE = 21;
const T_BOOST_REMAINING = 22;
const T_BOOST_TRIGGERED = 23;
const T_BOOST_ARMED_REMAINING = 24;
const T_BOOST_DRAIN_REMAINING = 25;
const T_COLLISION_RESPAWN_FLAG = 26;
const T_PATH_ANGLE_DELTA = 27;
const T_ANGLE_OF_ATTACK = 28;
const T_LIFT_COEFFICIENT = 29;
const T_STALL_AMOUNT = 30;

export const TELEMETRY_EVENT_COLLISION = 1;
export const TELEMETRY_EVENT_RESPAWN = 2;

export class FlightModel {
  constructor(config = CONFIG) {
    this.config = config;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.attitude = new THREE.Quaternion();
    this.angularVelocity = new THREE.Vector3();
    this.speed = config.physics.spawnSpeed;
    this.boostCharge = 0;
    this.boostRemaining = 0;
    this.boostArmedRemaining = 0;
    this.boostDrainRemaining = 0;
    this.boostChargeCondition = false;
    this.boostJustTriggered = false;
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.stallAmount = 0;
    this.pathAngle = 0;
    this.gLoad = 1;
    this.totalDistance = 0;
    this.elapsed = 0;

    this._previousVelocity = new THREE.Vector3();
    this._velocityDirection = new THREE.Vector3(0, 0, -1);
    this._nose = new THREE.Vector3(0, 0, -1);
    this._craftUp = new THREE.Vector3(0, 1, 0);
    this._craftRight = new THREE.Vector3(1, 0, 0);
    this._targetAngularVelocity = new THREE.Vector3();
    this._rotationAxis = new THREE.Vector3(1, 0, 0);
    this._alignmentAxis = new THREE.Vector3();
    this._pitchPlaneVelocity = new THREE.Vector3(0, 0, -1);
    this._gravityPerpendicular = new THREE.Vector3();
    this._specificForce = new THREE.Vector3();
    this._worldDown = new THREE.Vector3(0, -1, 0);
    this._mushAxisWorld = new THREE.Vector3();
    this._mushAxisBody = new THREE.Vector3();
    this._deltaQuaternion = new THREE.Quaternion();
    this._alignmentQuaternion = new THREE.Quaternion();
    this._inverseAttitude = new THREE.Quaternion();

    // Both buffers are allocated once. The live ring is written without creating
    // objects; the second buffer preserves the first glitch trap capture.
    this._telemetryData = new Float64Array(TELEMETRY_CAPACITY * TELEMETRY_STRIDE);
    this._glitchTelemetryData = new Float64Array(TELEMETRY_CAPACITY * TELEMETRY_STRIDE);
    this._telemetryWriteIndex = 0;
    this._telemetryCount = 0;
    this._glitchTelemetryWriteIndex = 0;
    this._glitchTelemetryCount = 0;
    this._telemetryPendingEventFlags = 0;
    this._telemetryHasPreviousPathAngle = false;
    this._telemetryPreviousPathAngle = 0;
    this.telemetryGlitchDetected = false;
    this.telemetryGlitchTime = 0;
    this.telemetryGlitchPathAngleDelta = 0;
  }

  reset(x = 0, y = 760, z = 420, speed = this.config.physics.spawnSpeed) {
    this.position.set(x, y, z);
    this.attitude.identity();
    this.angularVelocity.set(0, 0, 0);
    this.speed = speed;
    this.velocity.set(0, 0, -speed);
    this.boostCharge = 0;
    this.boostRemaining = 0;
    this.boostArmedRemaining = 0;
    this.boostDrainRemaining = 0;
    this.boostChargeCondition = false;
    this.boostJustTriggered = false;
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.stallAmount = 0;
    this.pathAngle = 0;
    this.gLoad = 1;
    this.totalDistance = 0;
    this.elapsed = 0;
    this._velocityDirection.set(0, 0, -1);
    this._alignmentAxis.set(0, 0, 0);
    this._telemetryPendingEventFlags |= TELEMETRY_EVENT_RESPAWN;
    this._telemetryHasPreviousPathAngle = false;
  }

  step(dt, controls) {
    const physics = this.config.physics;
    const aero = physics.aero;
    const boostConfig = physics.boost3;
    this.elapsed += dt;
    this.boostJustTriggered = false;
    this._previousVelocity.copy(this.velocity);

    this._velocityDirection.copy(this.velocity);
    if (this._velocityDirection.lengthSq() < 1e-8) this._velocityDirection.copy(LOCAL_FORWARD).applyQuaternion(this.attitude);
    else this._velocityDirection.normalize();
    this._nose.copy(LOCAL_FORWARD).applyQuaternion(this.attitude).normalize();
    this._craftUp.copy(LOCAL_UP).applyQuaternion(this.attitude).normalize();
    this._craftRight.copy(LOCAL_RIGHT).applyQuaternion(this.attitude).normalize();
    this._updateAerodynamicState(aero);

    const highSpeedBlend = smoothstep(
      this.config.controls.highSpeedControlStart,
      this.config.controls.highSpeedControlFull,
      this.speed
    );
    const rateScale = THREE.MathUtils.lerp(1, this.config.controls.highSpeedControlScale, highSpeedBlend);
    this._targetAngularVelocity.set(controls.pitchRate * rateScale, 0, -controls.rollRate * rateScale);
    const responseX = this._targetAngularVelocity.x === 0 ? physics.angularRelease : physics.angularResponse;
    const responseY = this._targetAngularVelocity.y === 0 ? physics.angularRelease : physics.angularResponse;
    const responseZ = this._targetAngularVelocity.z === 0 ? physics.angularRelease : physics.angularResponse;
    this.angularVelocity.x = damp(this.angularVelocity.x, this._targetAngularVelocity.x, responseX, dt);
    this.angularVelocity.y = damp(this.angularVelocity.y, this._targetAngularVelocity.y, responseY, dt);
    this.angularVelocity.z = damp(this.angularVelocity.z, this._targetAngularVelocity.z, responseZ, dt);
    if (Math.abs(this.angleOfAttack) > aero.stallAngle) {
      const restoringAcceleration = -Math.sign(this.angleOfAttack) *
        aero.stallPitchAcceleration * (Math.abs(this.angleOfAttack) - aero.stallAngle);
      this.angularVelocity.x += restoringAcceleration * dt;
    }

    const rotationMagnitude = this.angularVelocity.length();
    if (rotationMagnitude > 1e-8) {
      this._rotationAxis.copy(this.angularVelocity).multiplyScalar(1 / rotationMagnitude);
      this._deltaQuaternion.setFromAxisAngle(this._rotationAxis, rotationMagnitude * dt);
      this.attitude.multiply(this._deltaQuaternion).normalize();
    }

    this._nose.copy(LOCAL_FORWARD).applyQuaternion(this.attitude).normalize();
    this._craftUp.copy(LOCAL_UP).applyQuaternion(this.attitude).normalize();
    this._craftRight.copy(LOCAL_RIGHT).applyQuaternion(this.attitude).normalize();

    // Gravity bends the path as well as changing speed. Without this normal
    // component a slow, level craft could never truly fall into a stall.
    this._gravityPerpendicular.copy(this._worldDown)
      .addScaledVector(this._velocityDirection, -this._worldDown.dot(this._velocityDirection));
    this._velocityDirection.addScaledVector(
      this._gravityPerpendicular,
      aero.gravityPathBend * physics.gravity * dt / Math.max(this.speed, physics.minimumSpeed)
    ).normalize();
    this._updateAerodynamicState(aero);

    const dot = clamp(this._velocityDirection.dot(this._nose), -1, 1);
    const angle = Math.acos(dot);
    this._alignmentAxis.set(0, 0, 0);
    if (angle >= ALIGNMENT_EPSILON) {
      this._alignmentAxis.crossVectors(this._velocityDirection, this._nose);
      if (this._alignmentAxis.lengthSq() < ALIGNMENT_AXIS_EPSILON_SQ) {
        // Only the true antiparallel degeneracy needs an invented axis. Every
        // valid cross product already has the exact shortest-arc sign.
        this._alignmentAxis.crossVectors(this._nose, WORLD_UP);
        if (this._alignmentAxis.lengthSq() < 1e-6) {
          this._alignmentAxis.crossVectors(this._nose, WORLD_RIGHT);
        }
      }
      this._alignmentAxis.normalize();
      const liftRate = aero.liftRateCoefficient * Math.abs(this.liftCoefficient) * this.speed;
      const gLimitedRate = aero.maximumG * physics.gravity / Math.max(this.speed, physics.minimumSpeed);
      const alignmentRate = Math.min(liftRate, gLimitedRate);
      const alignmentStep = Math.min(angle, alignmentRate * dt);
      this._alignmentQuaternion.setFromAxisAngle(this._alignmentAxis, alignmentStep);
      this._velocityDirection.applyQuaternion(this._alignmentQuaternion).normalize();
    }

    this.pathAngle = Math.asin(clamp(this._velocityDirection.y, -1, 1));
    const gravityAlongPath = -physics.gravity * this._velocityDirection.y;
    const drag = aero.parasiticDrag * this.speed * this.speed +
      aero.inducedDrag * this.liftCoefficient * this.liftCoefficient * this.speed * this.speed;
    this._updateBoost(dt, controls, boostConfig);

    let boostAcceleration = 0;
    if (this.boostRemaining > 0) {
      boostAcceleration = boostConfig.deltaSpeed / boostConfig.duration;
      this.boostRemaining = Math.max(0, this.boostRemaining - dt);
    }

    this.speed = Math.max(
      physics.minimumSpeed,
      this.speed + (gravityAlongPath - drag + boostAcceleration) * dt
    );
    this.velocity.copy(this._velocityDirection).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);
    this.totalDistance += this.speed * dt;

    this._specificForce.copy(this.velocity).sub(this._previousVelocity).multiplyScalar(1 / dt);
    this._specificForce.y += physics.gravity;
    const rawG = this._specificForce.dot(this._craftUp) / physics.gravity;
    this.gLoad = damp(this.gLoad, rawG, 6.7, dt);

    const pathAngle = this.pathAngle;
    let pathAngleDelta = 0;
    if (this._telemetryHasPreviousPathAngle) {
      pathAngleDelta = pathAngle - this._telemetryPreviousPathAngle;
    }
    this._telemetryPreviousPathAngle = pathAngle;
    this._telemetryHasPreviousPathAngle = true;
    this._writeTelemetry(
      dt,
      controls,
      pathAngle,
      clamp(this._velocityDirection.dot(this._nose), -1, 1),
      pathAngleDelta
    );
  }

  _updateAerodynamicState(aero) {
    this._pitchPlaneVelocity.copy(this._velocityDirection)
      .addScaledVector(this._craftRight, -this._velocityDirection.dot(this._craftRight));
    if (this._pitchPlaneVelocity.lengthSq() < 1e-10) {
      this.angleOfAttack = 0;
      this.liftCoefficient = 0;
      this.stallAmount = 0;
      return;
    }
    this._pitchPlaneVelocity.normalize();
    this._alignmentAxis.crossVectors(this._pitchPlaneVelocity, this._nose);
    const sine = this._alignmentAxis.dot(this._craftRight);
    const cosine = clamp(this._pitchPlaneVelocity.dot(this._nose), -1, 1);
    this.angleOfAttack = Math.atan2(sine, cosine);
    const magnitude = Math.abs(this.angleOfAttack);
    const maximumLift = aero.liftSlope * aero.stallAngle;
    let liftMagnitude;
    if (magnitude <= aero.stallAngle) {
      liftMagnitude = aero.liftSlope * magnitude;
    } else if (magnitude < aero.postStallAngle) {
      const t = (magnitude - aero.stallAngle) / (aero.postStallAngle - aero.stallAngle);
      liftMagnitude = THREE.MathUtils.lerp(maximumLift, maximumLift * aero.postStallLiftFraction, t);
    } else {
      liftMagnitude = maximumLift * aero.postStallLiftFraction;
    }
    this.liftCoefficient = Math.sign(this.angleOfAttack) * liftMagnitude;
    this.stallAmount = smoothstep(aero.stallAngle, aero.postStallAngle, magnitude);
  }

  _updateBoost(dt, controls, boostConfig) {
    this.boostChargeCondition = this.speed > boostConfig.chargeSpeed &&
      this.pathAngle < boostConfig.chargePathAngle;
    if (this.boostRemaining > 0) return;

    if (this.boostArmedRemaining > 0) {
      if (controls.pitchRate > boostConfig.triggerPitchRate) {
        this.boostCharge = 0;
        this.boostArmedRemaining = 0;
        this.boostDrainRemaining = 0;
        this.boostRemaining = boostConfig.duration;
        this.boostJustTriggered = true;
        return;
      }
      this.boostArmedRemaining = Math.max(0, this.boostArmedRemaining - dt);
      if (this.boostArmedRemaining === 0) this.boostDrainRemaining = boostConfig.drainSeconds;
      return;
    }

    if (this.boostDrainRemaining > 0) {
      this.boostCharge = Math.max(0, this.boostCharge - dt / boostConfig.drainSeconds);
      this.boostDrainRemaining = Math.max(0, this.boostDrainRemaining - dt);
      return;
    }

    if (this.boostChargeCondition) {
      this.boostCharge = clamp(this.boostCharge + dt / boostConfig.chargeSeconds, 0, 1);
      if (this.boostCharge >= 0.999999) {
        this.boostCharge = 1;
        this.boostArmedRemaining = boostConfig.armedSeconds;
      }
    }
  }

  _writeTelemetry(dt, controls, pathAngle, noseVelocityDot, pathAngleDelta) {
    const index = this._telemetryWriteIndex;
    const offset = index * TELEMETRY_STRIDE;
    const data = this._telemetryData;
    const controlFlags = Number.isFinite(controls.collisionRespawnFlag)
      ? controls.collisionRespawnFlag
      : 0;

    data[offset + T_TIME] = this.elapsed;
    data[offset + T_DT] = dt;
    data[offset + T_POSITION_X] = this.position.x;
    data[offset + T_POSITION_Y] = this.position.y;
    data[offset + T_POSITION_Z] = this.position.z;
    data[offset + T_SPEED] = this.speed;
    data[offset + T_PATH_ANGLE] = pathAngle;
    data[offset + T_NOSE_VELOCITY_DOT] = noseVelocityDot;
    data[offset + T_AXIS_X] = this._alignmentAxis.x;
    data[offset + T_AXIS_Y] = this._alignmentAxis.y;
    data[offset + T_AXIS_Z] = this._alignmentAxis.z;
    data[offset + T_ATTITUDE_X] = this.attitude.x;
    data[offset + T_ATTITUDE_Y] = this.attitude.y;
    data[offset + T_ATTITUDE_Z] = this.attitude.z;
    data[offset + T_ATTITUDE_W] = this.attitude.w;
    data[offset + T_ANGULAR_VELOCITY_X] = this.angularVelocity.x;
    data[offset + T_ANGULAR_VELOCITY_Y] = this.angularVelocity.y;
    data[offset + T_ANGULAR_VELOCITY_Z] = this.angularVelocity.z;
    data[offset + T_INPUT_PITCH_RATE] = controls.pitchRate;
    data[offset + T_INPUT_ROLL_RATE] = controls.rollRate;
    data[offset + T_INPUT_YAW_RATE] = Number.isFinite(controls.yawRate) ? controls.yawRate : 0;
    data[offset + T_BOOST_CHARGE] = this.boostCharge;
    data[offset + T_BOOST_REMAINING] = this.boostRemaining;
    data[offset + T_BOOST_TRIGGERED] = this.boostJustTriggered ? 1 : 0;
    data[offset + T_BOOST_ARMED_REMAINING] = this.boostArmedRemaining;
    data[offset + T_BOOST_DRAIN_REMAINING] = this.boostDrainRemaining;
    data[offset + T_COLLISION_RESPAWN_FLAG] = this._telemetryPendingEventFlags | controlFlags;
    data[offset + T_PATH_ANGLE_DELTA] = pathAngleDelta;
    data[offset + T_ANGLE_OF_ATTACK] = this.angleOfAttack;
    data[offset + T_LIFT_COEFFICIENT] = this.liftCoefficient;
    data[offset + T_STALL_AMOUNT] = this.stallAmount;

    this._telemetryPendingEventFlags = 0;
    this._telemetryWriteIndex = (index + 1) % TELEMETRY_CAPACITY;
    if (this._telemetryCount < TELEMETRY_CAPACITY) this._telemetryCount += 1;

    if (!this.telemetryGlitchDetected && Math.abs(pathAngleDelta) > PATH_ANGLE_GLITCH_THRESHOLD) {
      this.telemetryGlitchDetected = true;
      this.telemetryGlitchTime = this.elapsed;
      this.telemetryGlitchPathAngleDelta = pathAngleDelta;
      this._glitchTelemetryData.set(this._telemetryData);
      this._glitchTelemetryWriteIndex = this._telemetryWriteIndex;
      this._glitchTelemetryCount = this._telemetryCount;
    }
  }

  flagTelemetryEvent(flags) {
    this._telemetryPendingEventFlags |= flags;
  }

  clearTelemetry() {
    this._telemetryWriteIndex = 0;
    this._telemetryCount = 0;
    this._glitchTelemetryWriteIndex = 0;
    this._glitchTelemetryCount = 0;
    this._telemetryPendingEventFlags = 0;
    this._telemetryHasPreviousPathAngle = false;
    this.telemetryGlitchDetected = false;
    this.telemetryGlitchTime = 0;
    this.telemetryGlitchPathAngleDelta = 0;
  }

  readTelemetrySnapshot(glitchCapture = false) {
    const data = glitchCapture ? this._glitchTelemetryData : this._telemetryData;
    const count = glitchCapture ? this._glitchTelemetryCount : this._telemetryCount;
    const writeIndex = glitchCapture ? this._glitchTelemetryWriteIndex : this._telemetryWriteIndex;
    const start = count < TELEMETRY_CAPACITY ? 0 : writeIndex;
    const frames = new Array(count);

    for (let i = 0; i < count; i += 1) {
      const offset = ((start + i) % TELEMETRY_CAPACITY) * TELEMETRY_STRIDE;
      frames[i] = {
        t: data[offset + T_TIME],
        dt: data[offset + T_DT],
        pos: [
          data[offset + T_POSITION_X],
          data[offset + T_POSITION_Y],
          data[offset + T_POSITION_Z],
        ],
        speed: data[offset + T_SPEED],
        pathAngle: data[offset + T_PATH_ANGLE],
        noseVelocityDot: data[offset + T_NOSE_VELOCITY_DOT],
        axis: [data[offset + T_AXIS_X], data[offset + T_AXIS_Y], data[offset + T_AXIS_Z]],
        attitude: [
          data[offset + T_ATTITUDE_X],
          data[offset + T_ATTITUDE_Y],
          data[offset + T_ATTITUDE_Z],
          data[offset + T_ATTITUDE_W],
        ],
        angularVelocity: [
          data[offset + T_ANGULAR_VELOCITY_X],
          data[offset + T_ANGULAR_VELOCITY_Y],
          data[offset + T_ANGULAR_VELOCITY_Z],
        ],
        input: {
          pitchRate: data[offset + T_INPUT_PITCH_RATE],
          rollRate: data[offset + T_INPUT_ROLL_RATE],
          yawRate: data[offset + T_INPUT_YAW_RATE],
        },
        boost: {
          charge: data[offset + T_BOOST_CHARGE],
          remaining: data[offset + T_BOOST_REMAINING],
          armedRemaining: data[offset + T_BOOST_ARMED_REMAINING],
          drainRemaining: data[offset + T_BOOST_DRAIN_REMAINING],
          triggered: data[offset + T_BOOST_TRIGGERED] === 1,
        },
        aerodynamics: {
          angleOfAttack: data[offset + T_ANGLE_OF_ATTACK],
          liftCoefficient: data[offset + T_LIFT_COEFFICIENT],
          stallAmount: data[offset + T_STALL_AMOUNT],
        },
        collisionRespawnFlag: data[offset + T_COLLISION_RESPAWN_FLAG],
        pathAngleDelta: data[offset + T_PATH_ANGLE_DELTA],
      };
    }

    return {
      version: 1,
      capacity: TELEMETRY_CAPACITY,
      count,
      glitchCapture,
      glitch: {
        detected: this.telemetryGlitchDetected,
        t: this.telemetryGlitchTime,
        pathAngleDelta: this.telemetryGlitchPathAngleDelta,
      },
      frames,
    };
  }

  exportTelemetrySnapshot(glitchCapture = false, space = 0) {
    return JSON.stringify(this.readTelemetrySnapshot(glitchCapture), null, space);
  }

  getForward(target) {
    return target.copy(LOCAL_FORWARD).applyQuaternion(this.attitude).normalize();
  }

  getUp(target) {
    return target.copy(LOCAL_UP).applyQuaternion(this.attitude).normalize();
  }

  getRight(target) {
    return target.copy(LOCAL_RIGHT).applyQuaternion(this.attitude).normalize();
  }

  get speedKmh() {
    return this.speed * 3.6;
  }

  get boosting() {
    return this.boostRemaining > 0;
  }
}
