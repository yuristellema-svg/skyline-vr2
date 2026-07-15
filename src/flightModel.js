import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, clamp, damp, smoothstep } from './config.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);
const WORLD_DOWN = new THREE.Vector3(0, -1, 0);

const ALIGNMENT_EPSILON = 1e-4;
const ALIGNMENT_AXIS_EPSILON_SQ = 1e-12;

const TUNING = Object.freeze({
  minimumSpeed: 0,
  maximumSpeed: 1000,
  controlSpeedFloor: 6,

  maximumAcceleration: 16,
  maximumDeceleration: 10,

  gravityBlendAngle: 25 * Math.PI / 180,
  diveGravityMultiplier: 0.9,
  climbGravityMultiplier: 0.45,

  preferredCruiseSpeed: 70,
  levelAssistFullAngle: 4 * Math.PI / 180,
  levelAssistZeroAngle: 25 * Math.PI / 180,
  levelAssistSpeedBand: 30,
  levelFlightAssistance: 0.55,
  levelAssistDragFraction: 2.5,

  parasiticDrag: 0.00011,
  inducedDrag: 0.000025,
  gravityPathBend: 0.05,

  misalignmentStartAngle: 3 * Math.PI / 180,
  misalignmentFullAngle: 30 * Math.PI / 180,
  misalignmentBaseDrag: 1.4,
  misalignmentSpeedDrag: 0.00028,
  misalignmentExponent: 1.45,

  lowSpeedStallStart: 18,
  lowSpeedStallFull: 4,
  lowSpeedStallAmount: 0.62,
  stalledLiftFraction: 0.72,
  stalledSteeringFraction: 0.38,

  recoveryTriggerSpeed: 1.5,
  recoveryReleaseSpeed: 25,
  recoveryNoseDownRate: 45 * Math.PI / 180,
  recoveryFallResponse: 5,

  telemetryInterval: 0.05,
});

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
    this.pathAngle = 0;
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.stallAmount = 0;
    this.gLoad = 1;

    this.boostCharge = 0;
    this.boostRemaining = 0;
    this.boostArmedRemaining = 0;
    this.boostDrainRemaining = 0;
    this.boostChargeCondition = false;
    this.boostJustTriggered = false;

    this.gravityAcceleration = 0;
    this.dragAcceleration = 0;
    this.assistanceAcceleration = 0;
    this.misalignmentDragAcceleration = 0;
    this.maneuverDragAcceleration = 0;
    this.lowSpeedRecoveryActive = false;
    this._misalignmentAngle = 0;
    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

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
    this._recoveryAxisWorld = new THREE.Vector3();
    this._deltaQuaternion = new THREE.Quaternion();
    this._alignmentQuaternion = new THREE.Quaternion();

    this._telemetryFrames = [];
    this._glitchTelemetryFrames = [];
    this._telemetryAccumulator = 0;
    this._telemetryPendingEventFlags = 0;
    this._telemetryHasPreviousPathAngle = false;
    this._telemetryPreviousPathAngle = 0;

    this.telemetryGlitchDetected = false;
    this.telemetryGlitchTime = 0;
    this.telemetryGlitchPathAngleDelta = 0;
  }

  reset(
    x = 0,
    y = 760,
    z = 420,
    speed = this.config.physics.spawnSpeed
  ) {
    this.position.set(x, y, z);
    this.attitude.identity();
    this.angularVelocity.set(0, 0, 0);

    this.speed = Math.max(0, speed);
    this.velocity.set(0, 0, -this.speed);
    this._velocityDirection.set(0, 0, -1);

    this.pathAngle = 0;
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.stallAmount = 0;
    this.gLoad = 1;

    this._disableBoost();

    this.gravityAcceleration = 0;
    this.dragAcceleration = 0;
    this.assistanceAcceleration = 0;
    this.misalignmentDragAcceleration = 0;
    this.maneuverDragAcceleration = 0;
    this.lowSpeedRecoveryActive = false;
    this._misalignmentAngle = 0;
    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.totalDistance = 0;
    this.elapsed = 0;
    this._telemetryAccumulator = 0;
    this._telemetryPendingEventFlags |=
      TELEMETRY_EVENT_RESPAWN;
    this._telemetryHasPreviousPathAngle = false;
  }

  step(dt, controls) {
    const physics = this.config.physics;
    const aero = physics.aero;

    this.elapsed += dt;
    this._disableBoost();
    this._previousVelocity.copy(this.velocity);

    this._updateAxes();
    this._velocityDirection.copy(this.velocity);

    if (this._velocityDirection.lengthSq() < 1e-8) {
      this._velocityDirection.copy(this._nose);
    } else {
      this._velocityDirection.normalize();
    }

    this._updateAerodynamicState(
      aero,
      dt * 0.5
    );

    this._updateRecoveryState();

    this._updateAttitude(
      dt,
      controls,
      physics
    );

    this._updateAxes();
    this._applyNearZeroRecovery(dt);
    this._applyGravityPathBend(dt, physics);
    this._captureMisalignment();

    this._updateAerodynamicState(
      aero,
      dt * 0.5
    );

    this._alignFlightPath(
      dt,
      physics,
      aero
    );

    this.pathAngle = Math.asin(
      clamp(
        this._velocityDirection.y,
        -1,
        1
      )
    );

    const acceleration =
      this._calculateAcceleration(
        physics
      );

    const totalAcceleration = clamp(
      acceleration.total,
      -TUNING.maximumDeceleration,
      TUNING.maximumAcceleration
    );

    this.speed = clamp(
      this.speed +
        totalAcceleration * dt,
      TUNING.minimumSpeed,
      TUNING.maximumSpeed
    );

    this.gravityAcceleration =
      acceleration.gravity;

    this.dragAcceleration =
      acceleration.drag;

    this.assistanceAcceleration =
      acceleration.assistance;

    this.misalignmentDragAcceleration =
      acceleration.misalignmentDrag;

    this.maneuverDragAcceleration =
      acceleration.misalignmentDrag;

    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.velocity
      .copy(this._velocityDirection)
      .multiplyScalar(this.speed);

    this.position.addScaledVector(
      this.velocity,
      dt
    );

    this.totalDistance +=
      this.speed * dt;

    this._updateGLoad(
      dt,
      physics
    );

    this._recordTelemetry(
      dt,
      controls
    );
  }

  _disableBoost() {
    this.boostCharge = 0;
    this.boostRemaining = 0;
    this.boostArmedRemaining = 0;
    this.boostDrainRemaining = 0;
    this.boostChargeCondition = false;
    this.boostJustTriggered = false;
  }

  _updateAxes() {
    this._nose
      .copy(LOCAL_FORWARD)
      .applyQuaternion(this.attitude)
      .normalize();

    this._craftUp
      .copy(LOCAL_UP)
      .applyQuaternion(this.attitude)
      .normalize();

    this._craftRight
      .copy(LOCAL_RIGHT)
      .applyQuaternion(this.attitude)
      .normalize();
  }

  _updateRecoveryState() {
    if (
      !this.lowSpeedRecoveryActive &&
      this.speed <=
        TUNING.recoveryTriggerSpeed
    ) {
      this.lowSpeedRecoveryActive = true;
    }

    if (
      this.lowSpeedRecoveryActive &&
      this.speed >=
        TUNING.recoveryReleaseSpeed
    ) {
      this.lowSpeedRecoveryActive = false;
    }
  }

  _recoveryAmount() {
    if (!this.lowSpeedRecoveryActive) {
      return 0;
    }

    return THREE.MathUtils.lerp(
      1,
      0.35,
      smoothstep(
        0,
        TUNING.recoveryReleaseSpeed,
        this.speed
      )
    );
  }

  _captureMisalignment() {
    this._misalignmentAngle = Math.acos(
      clamp(
        this._velocityDirection.dot(
          this._nose
        ),
        -1,
        1
      )
    );
  }

  _lowSpeedStallAmount() {
    return (
      1 -
      smoothstep(
        TUNING.lowSpeedStallFull,
        TUNING.lowSpeedStallStart,
        this.speed
      )
    ) * TUNING.lowSpeedStallAmount;
  }

  _updateAttitude(
    dt,
    controls,
    physics
  ) {
    const highSpeedBlend = smoothstep(
      this.config.controls
        .highSpeedControlStart,
      this.config.controls
        .highSpeedControlFull,
      this.speed
    );

    const rateScale =
      THREE.MathUtils.lerp(
        1,
        this.config.controls
          .highSpeedControlScale,
        highSpeedBlend
      );

    this._targetAngularVelocity.set(
      controls.pitchRate * rateScale,
      0,
      -controls.rollRate * rateScale
    );

    this._addRecoveryAngularVelocity();

    this.angularVelocity.x = damp(
      this.angularVelocity.x,
      this._targetAngularVelocity.x,
      this._targetAngularVelocity.x === 0
        ? physics.angularRelease
        : physics.angularResponse,
      dt
    );

    this.angularVelocity.y = damp(
      this.angularVelocity.y,
      this._targetAngularVelocity.y,
      this._targetAngularVelocity.y === 0
        ? physics.angularRelease
        : physics.angularResponse,
      dt
    );

    this.angularVelocity.z = damp(
      this.angularVelocity.z,
      this._targetAngularVelocity.z,
      this._targetAngularVelocity.z === 0
        ? physics.angularRelease
        : physics.angularResponse,
      dt
    );

    const rotationMagnitude =
      this.angularVelocity.length();

    if (rotationMagnitude <= 1e-8) {
      return;
    }

    this._rotationAxis
      .copy(this.angularVelocity)
      .multiplyScalar(
        1 / rotationMagnitude
      );

    this._deltaQuaternion.setFromAxisAngle(
      this._rotationAxis,
      rotationMagnitude * dt
    );

    this.attitude
      .multiply(this._deltaQuaternion)
      .normalize();
  }

  _addRecoveryAngularVelocity() {
    const recovery =
      this._recoveryAmount();

    if (recovery <= 0) {
      return;
    }

    const noseDownDot = clamp(
      this._nose.dot(WORLD_DOWN),
      -1,
      1
    );

    const angle = Math.acos(
      noseDownDot
    );

    if (angle <= 1e-4) {
      return;
    }

    this._recoveryAxisWorld.crossVectors(
      this._nose,
      WORLD_DOWN
    );

    if (
      this._recoveryAxisWorld.lengthSq() <
      1e-10
    ) {
      this._recoveryAxisWorld.copy(
        this._craftRight
      );
    } else {
      this._recoveryAxisWorld.normalize();
    }

    const recoveryRate =
      Math.min(
        TUNING.recoveryNoseDownRate,
        angle * 2.5
      ) *
      recovery;

    this._targetAngularVelocity.x +=
      this._recoveryAxisWorld.dot(
        this._craftRight
      ) *
      recoveryRate;

    this._targetAngularVelocity.y +=
      this._recoveryAxisWorld.dot(
        this._craftUp
      ) *
      recoveryRate;
  }

  _applyNearZeroRecovery(dt) {
    const recovery =
      this._recoveryAmount();

    if (recovery <= 0) {
      return;
    }

    const blend =
      1 -
      Math.exp(
        -TUNING.recoveryFallResponse *
          recovery *
          dt
      );

    this._velocityDirection
      .lerp(
        WORLD_DOWN,
        blend
      )
      .normalize();
  }

  _applyGravityPathBend(
    dt,
    physics
  ) {
    this._gravityPerpendicular
      .copy(WORLD_DOWN)
      .addScaledVector(
        this._velocityDirection,
        -WORLD_DOWN.dot(
          this._velocityDirection
        )
      );

    this._velocityDirection
      .addScaledVector(
        this._gravityPerpendicular,
        (
          TUNING.gravityPathBend *
          physics.gravity *
          dt
        ) /
          Math.max(
            this.speed,
            TUNING.controlSpeedFloor
          )
      )
      .normalize();
  }

  _alignFlightPath(
    dt,
    physics,
    aero
  ) {
    const dot = clamp(
      this._velocityDirection.dot(
        this._nose
      ),
      -1,
      1
    );

    const angle = Math.acos(dot);

    this._alignmentAxis.set(
      0,
      0,
      0
    );

    if (angle < ALIGNMENT_EPSILON) {
      return;
    }

    this._alignmentAxis.crossVectors(
      this._velocityDirection,
      this._nose
    );

    if (
      this._alignmentAxis.lengthSq() <
      ALIGNMENT_AXIS_EPSILON_SQ
    ) {
      this._alignmentAxis.crossVectors(
        this._nose,
        WORLD_UP
      );

      if (
        this._alignmentAxis.lengthSq() <
        1e-6
      ) {
        this._alignmentAxis.crossVectors(
          this._nose,
          WORLD_RIGHT
        );
      }
    }

    this._alignmentAxis.normalize();

    const liftRate =
      aero.liftRateCoefficient *
      Math.abs(this.liftCoefficient) *
      this.speed;

    const gLimitedRate =
      (
        aero.maximumG *
        physics.gravity
      ) /
      Math.max(
        this.speed,
        TUNING.controlSpeedFloor
      );

    const stallSteeringScale =
      THREE.MathUtils.lerp(
        1,
        TUNING.stalledSteeringFraction,
        clamp(
          this.stallAmount,
          0,
          1
        )
      );

    const alignmentRate =
      Math.min(
        liftRate,
        gLimitedRate
      ) *
      stallSteeringScale;

    const alignmentStep = Math.min(
      angle,
      alignmentRate * dt
    );

    this._alignmentQuaternion
      .setFromAxisAngle(
        this._alignmentAxis,
        alignmentStep
      );

    this._velocityDirection
      .applyQuaternion(
        this._alignmentQuaternion
      )
      .normalize();
  }

  _calculateAcceleration(physics) {
    const diveFactor = smoothstep(
      0,
      TUNING.gravityBlendAngle,
      Math.max(
        0,
        -this.pathAngle
      )
    );

    const climbFactor = smoothstep(
      0,
      TUNING.gravityBlendAngle,
      Math.max(
        0,
        this.pathAngle
      )
    );

    const climbEnergyAvailable =
      smoothstep(
        TUNING.controlSpeedFloor,
        TUNING.preferredCruiseSpeed,
        this.speed
      );

    const gravityMultiplier =
      this.pathAngle < 0
        ? THREE.MathUtils.lerp(
            1,
            TUNING
              .diveGravityMultiplier,
            diveFactor
          )
        : THREE.MathUtils.lerp(
            1,
            TUNING
              .climbGravityMultiplier,
            climbFactor *
              climbEnergyAvailable
          );

    const gravity =
      -physics.gravity *
      Math.sin(this.pathAngle) *
      gravityMultiplier;

    const clSquared =
      this.liftCoefficient *
      this.liftCoefficient;

    const drag =
      (
        TUNING.parasiticDrag +
        TUNING.inducedDrag *
          clSquared
      ) *
      this.speed *
      this.speed;

    const levelFactor =
      1 -
      smoothstep(
        TUNING
          .levelAssistFullAngle,
        TUNING
          .levelAssistZeroAngle,
        Math.abs(
          this.pathAngle
        )
      );

    const cruiseNeed =
      1 -
      smoothstep(
        TUNING
          .preferredCruiseSpeed,
        TUNING
          .preferredCruiseSpeed +
          TUNING
            .levelAssistSpeedBand,
        this.speed
      );

    const stallSuppression =
      Math.pow(
        1 -
          clamp(
            this.stallAmount,
            0,
            1
          ),
        2
      );

    const requestedAssistance =
      TUNING
        .levelFlightAssistance *
      levelFactor *
      cruiseNeed *
      stallSuppression;

    const assistance = Math.min(
      requestedAssistance,
      drag *
        TUNING
          .levelAssistDragFraction
    );

    const misalignmentDrag =
      this._calculateMisalignmentDrag();

    return {
      gravity,
      drag,
      assistance,
      misalignmentDrag,

      total:
        gravity -
        drag +
        assistance -
        misalignmentDrag,
    };
  }

  _calculateMisalignmentDrag() {
    const misalignment = smoothstep(
      TUNING
        .misalignmentStartAngle,
      TUNING
        .misalignmentFullAngle,
      this._misalignmentAngle
    );

    if (misalignment <= 0) {
      return 0;
    }

    const recoveryRelease =
      1 -
      this._recoveryAmount();

    return (
      (
        TUNING
          .misalignmentBaseDrag +
        TUNING
          .misalignmentSpeedDrag *
          this.speed *
          this.speed
      ) *
      Math.pow(
        misalignment,
        TUNING
          .misalignmentExponent
      ) *
      recoveryRelease
    );
  }

  _updateAerodynamicState(
    aero,
    dt
  ) {
    this._pitchPlaneVelocity
      .copy(this._velocityDirection)
      .addScaledVector(
        this._craftRight,
        -this._velocityDirection.dot(
          this._craftRight
        )
      );

    if (
      this._pitchPlaneVelocity.lengthSq() <
      1e-10
    ) {
      this.angleOfAttack = 0;
      this.liftCoefficient = 0;

      this._approachStallAmount(
        this._lowSpeedStallAmount(),
        aero.stallReleaseTime,
        dt
      );

      return;
    }

    this._pitchPlaneVelocity.normalize();

    this._alignmentAxis.crossVectors(
      this._pitchPlaneVelocity,
      this._nose
    );

    const sine =
      this._alignmentAxis.dot(
        this._craftRight
      );

    const cosine = clamp(
      this._pitchPlaneVelocity.dot(
        this._nose
      ),
      -1,
      1
    );

    this.angleOfAttack =
      Math.atan2(
        sine,
        cosine
      );

    const magnitude =
      Math.abs(
        this.angleOfAttack
      );

    const angleStall = smoothstep(
      aero.stallWarningAngle,
      aero.postStallAngle,
      magnitude
    );

    const targetStall = Math.max(
      angleStall,
      this._lowSpeedStallAmount()
    );

    const timeConstant =
      targetStall > this.stallAmount
        ? aero.stallAttackTime
        : aero.stallReleaseTime;

    this._approachStallAmount(
      targetStall,
      timeConstant,
      dt
    );

    const maximumLift =
      aero.liftSlope *
      aero.stallAngle;

    let liftMagnitude;

    if (
      magnitude <=
      aero.stallAngle
    ) {
      liftMagnitude =
        aero.liftSlope *
        magnitude;
    } else {
      const postStallBlend =
        smoothstep(
          aero.stallAngle,
          aero.postStallAngle,
          magnitude
        );

      const retainedLift =
        THREE.MathUtils.lerp(
          1,
          aero.postStallLiftFraction,
          postStallBlend
        );

      liftMagnitude =
        maximumLift *
        retainedLift;
    }

    const stallLiftScale =
      THREE.MathUtils.lerp(
        1,
        TUNING.stalledLiftFraction,
        clamp(
          this.stallAmount,
          0,
          1
        )
      );

    this.liftCoefficient =
      Math.sign(
        this.angleOfAttack
      ) *
      liftMagnitude *
      stallLiftScale;
  }

  _approachStallAmount(
    target,
    timeConstant,
    dt
  ) {
    const response =
      1 -
      Math.exp(
        -dt /
          Math.max(
            1e-4,
            timeConstant
          )
      );

    this.stallAmount = clamp(
      this.stallAmount +
        (
          target -
          this.stallAmount
        ) *
          response,
      0,
      1
    );
  }

  _updateGLoad(
    dt,
    physics
  ) {
    this._specificForce
      .copy(this.velocity)
      .sub(this._previousVelocity)
      .multiplyScalar(
        1 / dt
      );

    this._specificForce.y +=
      physics.gravity;

    const rawG =
      this._specificForce.dot(
        this._craftUp
      ) /
      physics.gravity;

    this.gLoad = damp(
      this.gLoad,
      rawG,
      6.7,
      dt
    );
  }

  _recordTelemetry(
    dt,
    controls
  ) {
    let pathAngleDelta = 0;

    if (
      this._telemetryHasPreviousPathAngle
    ) {
      pathAngleDelta =
        this.pathAngle -
        this
          ._telemetryPreviousPathAngle;
    }

    this._telemetryPreviousPathAngle =
      this.pathAngle;

    this._telemetryHasPreviousPathAngle =
      true;

    if (
      !this.telemetryGlitchDetected &&
      Math.abs(pathAngleDelta) >
        this.config.physics
          .telemetry
          .glitchPathDelta
    ) {
      this.telemetryGlitchDetected =
        true;

      this.telemetryGlitchTime =
        this.elapsed;

      this.telemetryGlitchPathAngleDelta =
        pathAngleDelta;

      this._glitchTelemetryFrames =
        this._telemetryFrames.slice();
    }

    this._telemetryAccumulator += dt;

    if (
      this._telemetryAccumulator <
      TUNING.telemetryInterval
    ) {
      return;
    }

    this._telemetryAccumulator = 0;

    const frame = {
      t: this.elapsed,

      dt,

      pos: [
        this.position.x,
        this.position.y,
        this.position.z,
      ],

      speed: this.speed,

      pathAngle:
        this.pathAngle,

      angleOfAttack:
        this.angleOfAttack,

      stallAmount:
        this.stallAmount,

      gLoad:
        this.gLoad,

      misalignmentDrag:
        this
          .misalignmentDragAcceleration,

      angularVelocity: [
        this.angularVelocity.x,
        this.angularVelocity.y,
        this.angularVelocity.z,
      ],

      input: {
        pitchRate:
          controls.pitchRate,

        rollRate:
          controls.rollRate,

        yawRate:
          Number.isFinite(
            controls.yawRate
          )
            ? controls.yawRate
            : 0,
      },

      collisionRespawnFlag:
        this
          ._telemetryPendingEventFlags |
        (
          Number.isFinite(
            controls
              .collisionRespawnFlag
          )
            ? controls
                .collisionRespawnFlag
            : 0
        ),

      pathAngleDelta,
    };

    this._telemetryPendingEventFlags =
      0;

    this._telemetryFrames.push(
      frame
    );

    const capacity =
      this.config.physics
        .telemetry.frames;

    if (
      this._telemetryFrames.length >
      capacity
    ) {
      this._telemetryFrames.shift();
    }
  }

  flagTelemetryEvent(flags) {
    this._telemetryPendingEventFlags |=
      flags;
  }

  clearTelemetry() {
    this._telemetryFrames.length = 0;
    this._glitchTelemetryFrames.length = 0;
    this._telemetryAccumulator = 0;
    this._telemetryPendingEventFlags = 0;
    this._telemetryHasPreviousPathAngle = false;

    this.telemetryGlitchDetected = false;
    this.telemetryGlitchTime = 0;
    this.telemetryGlitchPathAngleDelta = 0;
  }

  readTelemetrySnapshot(
    glitchCapture = false
  ) {
    const frames =
      glitchCapture
        ? this._glitchTelemetryFrames
        : this._telemetryFrames;

    return {
      version: 3,

      capacity:
        this.config.physics
          .telemetry.frames,

      count:
        frames.length,

      glitchCapture,

      glitch: {
        detected:
          this.telemetryGlitchDetected,

        t:
          this.telemetryGlitchTime,

        pathAngleDelta:
          this
            .telemetryGlitchPathAngleDelta,
      },

      frames,
    };
  }

  exportTelemetrySnapshot(
    glitchCapture = false,
    space = 0
  ) {
    return JSON.stringify(
      this.readTelemetrySnapshot(
        glitchCapture
      ),
      null,
      space
    );
  }

  getForward(target) {
    return target
      .copy(LOCAL_FORWARD)
      .applyQuaternion(
        this.attitude
      )
      .normalize();
  }

  getUp(target) {
    return target
      .copy(LOCAL_UP)
      .applyQuaternion(
        this.attitude
      )
      .normalize();
  }

  getRight(target) {
    return target
      .copy(LOCAL_RIGHT)
      .applyQuaternion(
        this.attitude
      )
      .normalize();
  }

  get speedKmh() {
    return this.speed * 3.6;
  }

  get boosting() {
    return false;
  }
}
