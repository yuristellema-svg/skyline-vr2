import * as THREE from '../vendor/three.module.min.js';
import {
  CONFIG,
  clamp,
  damp,
  smoothstep,
} from './config.js';

const LOCAL_FORWARD =
  new THREE.Vector3(0, 0, -1);

const LOCAL_UP =
  new THREE.Vector3(0, 1, 0);

const LOCAL_RIGHT =
  new THREE.Vector3(1, 0, 0);

const WORLD_UP =
  new THREE.Vector3(0, 1, 0);

const WORLD_RIGHT =
  new THREE.Vector3(1, 0, 0);

const WORLD_DOWN =
  new THREE.Vector3(0, -1, 0);

const EPSILON = 1e-8;
const ALIGNMENT_EPSILON = 1e-4;

const TUNING = Object.freeze({
  maximumSpeed: 5000,
  maximumAcceleration: 22,
  maximumDeceleration: 32,
  controlSpeedFloor: 6,

  diveGravityMultiplier: 1.28,
  climbGravityMultiplier: 1.08,

  gravityBlendAngle:
    30 * Math.PI / 180,

  /*
   * Straight flight barely loses speed.
   * Drag is capped so a long dive can continue
   * building extraordinary speed.
   */
  parasiticDrag: 0.000002,
  inducedDrag: 0.000012,
  maximumStraightDrag: 4,
  gravityPathBend: 0.04,

  /*
   * Actual curvature of the travelled path creates
   * the main braking force.
   *
   * Rolling around the forward axis does not count.
   */
  turnDragCoefficient: 0.11,
  turnDragExponent: 2,

  misalignmentStart:
    2 * Math.PI / 180,

  misalignmentFull:
    28 * Math.PI / 180,

  misalignmentDragCoefficient: 0.0008,
  misalignmentDragExponent: 1.45,

  /*
   * 50 km/h remains flyable.
   * The soft stall becomes substantial below that.
   */
  lowSpeedStallStart: 12,
  lowSpeedStallFull: 2,
  lowSpeedStallAmount: 0.72,
  stalledLiftFraction: 0.5,
  stalledSteeringFraction: 0.34,

  zeroSnapSpeed: 0.65,
  recoveryTriggerSpeed: 0.65,
  recoveryReleaseSpeed: 16,

  recoveryNoseDownRate:
    44 * Math.PI / 180,

  recoveryFallResponse: 7,

  telemetryInterval: 0.05,
});

export const TELEMETRY_EVENT_COLLISION = 1;
export const TELEMETRY_EVENT_RESPAWN = 2;

export class FlightModel {
  constructor(config = CONFIG) {
    this.config = config;

    this.position =
      new THREE.Vector3();

    this.velocity =
      new THREE.Vector3();

    this.attitude =
      new THREE.Quaternion();

    this.angularVelocity =
      new THREE.Vector3();

    this.speed =
      config.physics.spawnSpeed;

    this.pathAngle = 0;
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.stallAmount = 0;
    this.gLoad = 1;
    this.viewYaw = 0;

    this.boostCharge = 0;
    this.boostRemaining = 0;
    this.boostArmedRemaining = 0;
    this.boostDrainRemaining = 0;
    this.boostChargeCondition = false;
    this.boostJustTriggered = false;

    this.gravityAcceleration = 0;
    this.dragAcceleration = 0;
    this.assistanceAcceleration = 0;
    this.turnDragAcceleration = 0;
    this.misalignmentDragAcceleration = 0;
    this.maneuverDragAcceleration = 0;
    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.pathTurnRate = 0;

    this.lowSpeedRecoveryActive =
      false;

    this.totalDistance = 0;
    this.elapsed = 0;

    this._velocityDirection =
      new THREE.Vector3(0, 0, -1);

    this._previousVelocity =
      new THREE.Vector3();

    this._nose =
      new THREE.Vector3(0, 0, -1);

    this._craftUp =
      new THREE.Vector3(0, 1, 0);

    this._craftRight =
      new THREE.Vector3(1, 0, 0);

    this._targetAngularVelocity =
      new THREE.Vector3();

    this._rotationAxis =
      new THREE.Vector3(1, 0, 0);

    this._alignmentAxis =
      new THREE.Vector3();

    this._pitchPlaneVelocity =
      new THREE.Vector3(0, 0, -1);

    this._gravityPerpendicular =
      new THREE.Vector3();

    this._specificForce =
      new THREE.Vector3();

    this._recoveryAxisWorld =
      new THREE.Vector3();

    this._deltaQuaternion =
      new THREE.Quaternion();

    this._alignmentQuaternion =
      new THREE.Quaternion();

    this._misalignmentAngle = 0;

    this._telemetryFrames = [];
    this._glitchTelemetryFrames = [];
    this._telemetryAccumulator = 0;
    this._telemetryPendingEventFlags = 0;

    this._telemetryHasPreviousPathAngle =
      false;

    this._telemetryPreviousPathAngle = 0;

    this.telemetryGlitchDetected = false;
    this.telemetryGlitchTime = 0;
    this.telemetryGlitchPathAngleDelta = 0;
  }

  reset(
    x = 0,
    y = 760,
    z = 420,
    speed = this.config.physics.spawnSpeed,
  ) {
    this.position.set(
      x,
      y,
      z,
    );

    this.attitude.identity();

    this.angularVelocity.set(
      0,
      0,
      0,
    );

    this.speed =
      Math.max(
        0,
        speed,
      );

    this.velocity.set(
      0,
      0,
      -this.speed,
    );

    this._velocityDirection.set(
      0,
      0,
      -1,
    );

    this.pathAngle = 0;
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.stallAmount = 0;
    this.gLoad = 1;
    this.viewYaw = 0;
    this.pathTurnRate = 0;

    this._disableBoost();

    this.gravityAcceleration = 0;
    this.dragAcceleration = 0;
    this.assistanceAcceleration = 0;
    this.turnDragAcceleration = 0;
    this.misalignmentDragAcceleration = 0;
    this.maneuverDragAcceleration = 0;
    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.lowSpeedRecoveryActive =
      false;

    this.totalDistance = 0;
    this.elapsed = 0;

    this._telemetryAccumulator = 0;

    this._telemetryPendingEventFlags |=
      TELEMETRY_EVENT_RESPAWN;

    this._telemetryHasPreviousPathAngle =
      false;
  }

  step(dt, controls) {
    const physics =
      this.config.physics;

    const aero =
      physics.aero;

    this.elapsed += dt;

    this.viewYaw =
      Number.isFinite(
        controls.viewYaw,
      )
        ? controls.viewYaw
        : 0;

    this._disableBoost();

    this._previousVelocity.copy(
      this.velocity,
    );

    this._updateAxes();

    this._velocityDirection.copy(
      this.velocity,
    );

    if (
      this._velocityDirection.lengthSq() <
      EPSILON
    ) {
      this._velocityDirection.copy(
        this._nose,
      );
    } else {
      this._velocityDirection.normalize();
    }

    this._updateAerodynamicState(
      aero,
      dt * 0.5,
    );

    this._updateRecoveryState();

    this._updateAttitude(
      dt,
      controls,
      physics,
    );

    this._updateAxes();

    this._applyNearZeroRecovery(
      dt,
    );

    this._applyGravityPathBend(
      dt,
      physics,
    );

    this._updateAerodynamicState(
      aero,
      dt * 0.5,
    );

    this._alignFlightPath(
      dt,
      physics,
      aero,
    );

    this.pathAngle =
      Math.asin(
        clamp(
          this._velocityDirection.y,
          -1,
          1,
        ),
      );

    const acceleration =
      this._calculateAcceleration(
        physics,
      );

    const totalAcceleration =
      clamp(
        acceleration.total,
        -TUNING.maximumDeceleration,
        TUNING.maximumAcceleration,
      );

    const previousSpeed =
      this.speed;

    this.speed =
      clamp(
        this.speed +
          totalAcceleration *
            dt,
        0,
        TUNING.maximumSpeed,
      );

    if (
      this.speed <
        TUNING.zeroSnapSpeed &&
      this.speed <=
        previousSpeed &&
      totalAcceleration <= 0
    ) {
      this.speed = 0;

      this.lowSpeedRecoveryActive =
        true;
    }

    this.gravityAcceleration =
      acceleration.gravity;

    this.dragAcceleration =
      acceleration.straightDrag;

    this.assistanceAcceleration = 0;

    this.turnDragAcceleration =
      acceleration.turnDrag;

    this.misalignmentDragAcceleration =
      acceleration.misalignmentDrag;

    this.maneuverDragAcceleration =
      acceleration.turnDrag +
      acceleration.misalignmentDrag;

    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.velocity
      .copy(
        this._velocityDirection,
      )
      .multiplyScalar(
        this.speed,
      );

    this.position.addScaledVector(
      this.velocity,
      dt,
    );

    this.totalDistance +=
      this.speed *
      dt;

    this._updateGLoad(
      dt,
      physics,
    );

    this._recordTelemetry(
      dt,
      controls,
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
      .copy(
        LOCAL_FORWARD,
      )
      .applyQuaternion(
        this.attitude,
      )
      .normalize();

    this._craftUp
      .copy(
        LOCAL_UP,
      )
      .applyQuaternion(
        this.attitude,
      )
      .normalize();

    this._craftRight
      .copy(
        LOCAL_RIGHT,
      )
      .applyQuaternion(
        this.attitude,
      )
      .normalize();
  }

  _updateRecoveryState() {
    if (
      !this.lowSpeedRecoveryActive &&
      this.speed <=
        TUNING.recoveryTriggerSpeed
    ) {
      this.lowSpeedRecoveryActive =
        true;
    }

    if (
      this.lowSpeedRecoveryActive &&
      this.speed >=
        TUNING.recoveryReleaseSpeed
    ) {
      this.lowSpeedRecoveryActive =
        false;
    }
  }

  _recoveryAmount() {
    if (
      !this.lowSpeedRecoveryActive
    ) {
      return 0;
    }

    return THREE.MathUtils.lerp(
      1,
      0.2,
      smoothstep(
        0,
        TUNING.recoveryReleaseSpeed,
        this.speed,
      ),
    );
  }

  _updateAttitude(
    dt,
    controls,
    physics,
  ) {
    const highSpeedBlend =
      smoothstep(
        this.config.controls
          .highSpeedControlStart,

        this.config.controls
          .highSpeedControlFull,

        this.speed,
      );

    const rateScale =
      THREE.MathUtils.lerp(
        1,

        this.config.controls
          .highSpeedControlScale,

        highSpeedBlend,
      );

    this._targetAngularVelocity.set(
      controls.pitchRate *
        rateScale,

      0,

      -controls.rollRate *
        rateScale,
    );

    this._addRecoveryAngularVelocity();

    this.angularVelocity.x =
      damp(
        this.angularVelocity.x,

        this._targetAngularVelocity.x,

        this._targetAngularVelocity.x ===
          0
          ? physics.angularRelease
          : physics.angularResponse,

        dt,
      );

    this.angularVelocity.y =
      damp(
        this.angularVelocity.y,

        this._targetAngularVelocity.y,

        this._targetAngularVelocity.y ===
          0
          ? physics.angularRelease
          : physics.angularResponse,

        dt,
      );

    this.angularVelocity.z =
      damp(
        this.angularVelocity.z,

        this._targetAngularVelocity.z,

        this._targetAngularVelocity.z ===
          0
          ? physics.angularRelease
          : physics.angularResponse,

        dt,
      );

    const rotationMagnitude =
      this.angularVelocity.length();

    if (
      rotationMagnitude <=
      EPSILON
    ) {
      return;
    }

    this._rotationAxis
      .copy(
        this.angularVelocity,
      )
      .multiplyScalar(
        1 /
          rotationMagnitude,
      );

    this._deltaQuaternion
      .setFromAxisAngle(
        this._rotationAxis,

        rotationMagnitude *
          dt,
      );

    this.attitude
      .multiply(
        this._deltaQuaternion,
      )
      .normalize();
  }

  _addRecoveryAngularVelocity() {
    const recovery =
      this._recoveryAmount();

    if (recovery <= 0) {
      return;
    }

    const angle =
      Math.acos(
        clamp(
          this._nose.dot(
            WORLD_DOWN,
          ),
          -1,
          1,
        ),
      );

    if (
      angle <=
      ALIGNMENT_EPSILON
    ) {
      return;
    }

    this._recoveryAxisWorld
      .crossVectors(
        this._nose,
        WORLD_DOWN,
      );

    if (
      this._recoveryAxisWorld.lengthSq() <
      EPSILON
    ) {
      this._recoveryAxisWorld.copy(
        this._craftRight,
      );
    } else {
      this._recoveryAxisWorld.normalize();
    }

    const recoveryRate =
      Math.min(
        TUNING.recoveryNoseDownRate,

        angle *
          2.4,
      ) *
      recovery;

    /*
     * Player pitch remains stronger,
     * so holding up can resist this bias.
     */
    this._targetAngularVelocity.x +=
      this._recoveryAxisWorld.dot(
        this._craftRight,
      ) *
      recoveryRate;

    this._targetAngularVelocity.y +=
      this._recoveryAxisWorld.dot(
        this._craftUp,
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
          dt,
      );

    this._velocityDirection
      .lerp(
        WORLD_DOWN,
        blend,
      )
      .normalize();
  }

  _applyGravityPathBend(
    dt,
    physics,
  ) {
    this._gravityPerpendicular
      .copy(
        WORLD_DOWN,
      )
      .addScaledVector(
        this._velocityDirection,

        -WORLD_DOWN.dot(
          this._velocityDirection,
        ),
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
            TUNING.controlSpeedFloor,
          ),
      )
      .normalize();
  }

  _alignFlightPath(
    dt,
    physics,
    aero,
  ) {
    const dot =
      clamp(
        this._velocityDirection.dot(
          this._nose,
        ),
        -1,
        1,
      );

    const angle =
      Math.acos(
        dot,
      );

    this._misalignmentAngle =
      angle;

    this.pathTurnRate = 0;

    if (
      angle <
      ALIGNMENT_EPSILON
    ) {
      return;
    }

    this._alignmentAxis
      .crossVectors(
        this._velocityDirection,
        this._nose,
      );

    if (
      this._alignmentAxis.lengthSq() <
      EPSILON
    ) {
      this._alignmentAxis
        .crossVectors(
          this._nose,
          WORLD_UP,
        );

      if (
        this._alignmentAxis.lengthSq() <
        EPSILON
      ) {
        this._alignmentAxis
          .crossVectors(
            this._nose,
            WORLD_RIGHT,
          );
      }
    }

    this._alignmentAxis.normalize();

    const liftRate =
      aero.liftRateCoefficient *
      Math.abs(
        this.liftCoefficient,
      ) *
      this.speed;

    const gLimitedRate =
      (
        aero.maximumG *
        physics.gravity
      ) /
      Math.max(
        this.speed,
        TUNING.controlSpeedFloor,
      );

    const stallSteeringScale =
      THREE.MathUtils.lerp(
        1,

        TUNING.stalledSteeringFraction,

        clamp(
          this.stallAmount,
          0,
          1,
        ),
      );

    const alignmentRate =
      Math.min(
        liftRate,
        gLimitedRate,
      ) *
      stallSteeringScale;

    const alignmentStep =
      Math.min(
        angle,

        alignmentRate *
          dt,
      );

    this._alignmentQuaternion
      .setFromAxisAngle(
        this._alignmentAxis,
        alignmentStep,
      );

    this._velocityDirection
      .applyQuaternion(
        this._alignmentQuaternion,
      )
      .normalize();

    this.pathTurnRate =
      dt > 0
        ? alignmentStep / dt
        : 0;
  }

  _calculateAcceleration(physics) {
    const diveFactor =
      smoothstep(
        0,

        TUNING.gravityBlendAngle,

        Math.max(
          0,
          -this.pathAngle,
        ),
      );

    const climbFactor =
      smoothstep(
        0,

        TUNING.gravityBlendAngle,

        Math.max(
          0,
          this.pathAngle,
        ),
      );

    const gravityMultiplier =
      this.pathAngle < 0
        ? THREE.MathUtils.lerp(
            1,

            TUNING
              .diveGravityMultiplier,

            diveFactor,
          )
        : THREE.MathUtils.lerp(
            1,

            TUNING
              .climbGravityMultiplier,

            climbFactor,
          );

    const gravity =
      -physics.gravity *
      Math.sin(
        this.pathAngle,
      ) *
      gravityMultiplier;

    const clSquared =
      this.liftCoefficient *
      this.liftCoefficient;

    const straightDrag =
      Math.min(
        TUNING.maximumStraightDrag,

        (
          TUNING.parasiticDrag +
          TUNING.inducedDrag *
            clSquared
        ) *
          this.speed *
          this.speed,
      );

    const turnDrag =
      TUNING.turnDragCoefficient *
      this.speed *
      Math.pow(
        Math.max(
          0,
          this.pathTurnRate,
        ),

        TUNING.turnDragExponent,
      );

    const misalignmentAmount =
      smoothstep(
        TUNING.misalignmentStart,
        TUNING.misalignmentFull,
        this._misalignmentAngle,
      );

    const misalignmentDrag =
      TUNING.misalignmentDragCoefficient *
      this.speed *
      this.speed *
      Math.pow(
        misalignmentAmount,

        TUNING
          .misalignmentDragExponent,
      ) *
      (
        1 -
        this._recoveryAmount()
      );

    return {
      gravity,
      straightDrag,
      turnDrag,
      misalignmentDrag,

      total:
        gravity -
        straightDrag -
        turnDrag -
        misalignmentDrag,
    };
  }

  _lowSpeedStallAmount() {
    return (
      1 -
      smoothstep(
        TUNING.lowSpeedStallFull,
        TUNING.lowSpeedStallStart,
        this.speed,
      )
    ) *
      TUNING.lowSpeedStallAmount;
  }

  _updateAerodynamicState(
    aero,
    dt,
  ) {
    this._pitchPlaneVelocity
      .copy(
        this._velocityDirection,
      )
      .addScaledVector(
        this._craftRight,

        -this._velocityDirection.dot(
          this._craftRight,
        ),
      );

    if (
      this._pitchPlaneVelocity.lengthSq() <
      EPSILON
    ) {
      this.angleOfAttack = 0;
      this.liftCoefficient = 0;

      this._approachStallAmount(
        this._lowSpeedStallAmount(),
        aero.stallReleaseTime,
        dt,
      );

      return;
    }

    this._pitchPlaneVelocity.normalize();

    this._alignmentAxis
      .crossVectors(
        this._pitchPlaneVelocity,
        this._nose,
      );

    const sine =
      this._alignmentAxis.dot(
        this._craftRight,
      );

    const cosine =
      clamp(
        this._pitchPlaneVelocity.dot(
          this._nose,
        ),
        -1,
        1,
      );

    this.angleOfAttack =
      Math.atan2(
        sine,
        cosine,
      );

    const magnitude =
      Math.abs(
        this.angleOfAttack,
      );

    const angleStall =
      smoothstep(
        aero.stallWarningAngle,
        aero.postStallAngle,
        magnitude,
      );

    const targetStall =
      Math.max(
        angleStall,
        this._lowSpeedStallAmount(),
      );

    const timeConstant =
      targetStall >
      this.stallAmount
        ? aero.stallAttackTime
        : aero.stallReleaseTime;

    this._approachStallAmount(
      targetStall,
      timeConstant,
      dt,
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
          magnitude,
        );

      liftMagnitude =
        maximumLift *
        THREE.MathUtils.lerp(
          1,

          aero
            .postStallLiftFraction,

          postStallBlend,
        );
    }

    const stallLiftScale =
      THREE.MathUtils.lerp(
        1,

        TUNING.stalledLiftFraction,

        clamp(
          this.stallAmount,
          0,
          1,
        ),
      );

    this.liftCoefficient =
      Math.sign(
        this.angleOfAttack,
      ) *
      liftMagnitude *
      stallLiftScale;
  }

  _approachStallAmount(
    target,
    timeConstant,
    dt,
  ) {
    const response =
      1 -
      Math.exp(
        -dt /
          Math.max(
            1e-4,
            timeConstant,
          ),
      );

    this.stallAmount =
      clamp(
        this.stallAmount +
          (
            target -
            this.stallAmount
          ) *
            response,

        0,
        1,
      );
  }

  _updateGLoad(
    dt,
    physics,
  ) {
    this._specificForce
      .copy(
        this.velocity,
      )
      .sub(
        this._previousVelocity,
      )
      .multiplyScalar(
        1 /
          dt,
      );

    this._specificForce.y +=
      physics.gravity;

    const rawG =
      this._specificForce.dot(
        this._craftUp,
      ) /
      physics.gravity;

    this.gLoad =
      damp(
        this.gLoad,
        rawG,
        6.7,
        dt,
      );
  }

  _recordTelemetry(
    dt,
    controls,
  ) {
    let pathAngleDelta = 0;

    if (
      this._telemetryHasPreviousPathAngle
    ) {
      pathAngleDelta =
        this.pathAngle -
        this._telemetryPreviousPathAngle;
    }

    this._telemetryPreviousPathAngle =
      this.pathAngle;

    this._telemetryHasPreviousPathAngle =
      true;

    if (
      !this.telemetryGlitchDetected &&
      Math.abs(
        pathAngleDelta,
      ) >
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

    this._telemetryAccumulator +=
      dt;

    if (
      this._telemetryAccumulator <
      TUNING.telemetryInterval
    ) {
      return;
    }

    this._telemetryAccumulator = 0;

    this._telemetryFrames.push({
      t:
        this.elapsed,

      dt,

      pos: [
        this.position.x,
        this.position.y,
        this.position.z,
      ],

      speed:
        this.speed,

      pathAngle:
        this.pathAngle,

      angleOfAttack:
        this.angleOfAttack,

      stallAmount:
        this.stallAmount,

      gLoad:
        this.gLoad,

      viewYaw:
        this.viewYaw,

      pathTurnRate:
        this.pathTurnRate,

      turnDrag:
        this.turnDragAcceleration,

      misalignmentDrag:
        this
          .misalignmentDragAcceleration,

      input: {
        pitchRate:
          controls.pitchRate,

        rollRate:
          controls.rollRate,

        yawRate:
          Number.isFinite(
            controls.yawRate,
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
              .collisionRespawnFlag,
          )
            ? controls
                .collisionRespawnFlag
            : 0
        ),

      pathAngleDelta,
    });

    this._telemetryPendingEventFlags = 0;

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

    this._telemetryHasPreviousPathAngle =
      false;

    this.telemetryGlitchDetected = false;
    this.telemetryGlitchTime = 0;
    this.telemetryGlitchPathAngleDelta = 0;
  }

  readTelemetrySnapshot(
    glitchCapture = false,
  ) {
    const frames =
      glitchCapture
        ? this._glitchTelemetryFrames
        : this._telemetryFrames;

    return {
      version: 5,

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
    space = 0,
  ) {
    return JSON.stringify(
      this.readTelemetrySnapshot(
        glitchCapture,
      ),
      null,
      space,
    );
  }

  getForward(target) {
    return target
      .copy(
        LOCAL_FORWARD,
      )
      .applyQuaternion(
        this.attitude,
      )
      .normalize();
  }

  getUp(target) {
    return target
      .copy(
        LOCAL_UP,
      )
      .applyQuaternion(
        this.attitude,
      )
      .normalize();
  }

  getRight(target) {
    return target
      .copy(
        LOCAL_RIGHT,
      )
      .applyQuaternion(
        this.attitude,
      )
      .normalize();
  }

  get speedKmh() {
    return (
      this.speed *
      3.6
    );
  }

  get boosting() {
    return false;
  }
}
