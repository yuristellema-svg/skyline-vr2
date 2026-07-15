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

/*
 * All new speed-control tuning is contained here.
 * No other file needs to be changed.
 */
const TUNING = Object.freeze({
  /*
   * Speed may genuinely reach zero.
   */
  minimumSpeed: 0,

  /*
   * Used only to keep divisions and steering calculations
   * stable when actual speed is close to zero.
   */
  controlSpeedFloor: 8,

  /*
   * Normal flight naturally settles around a fast arcade speed,
   * but this is not a hard limit.
   */
  preferredCruiseSpeed: 80,

  /*
   * No hard gameplay speed cap.
   * Quadratic wind resistance creates a natural terminal speed.
   */
  maximumSpeed: Number.POSITIVE_INFINITY,

  maximumAcceleration: 40,
  maximumDeceleration: 18,

  /*
   * Dives gain substantially more speed than climbs lose.
   */
  gravityBlendAngle:
    25 * Math.PI / 180,

  diveGravityMultiplier: 1.8,
  climbGravityMultiplier: 0.45,

  /*
   * Gentle arcade assistance during ordinary flight.
   */
  levelAssistFullAngle:
    3 * Math.PI / 180,

  levelAssistZeroAngle:
    45 * Math.PI / 180,

  levelAssistSpeedBand: 70,
  levelFlightAssistance: 2.2,
  levelAssistDragFraction: 20,

  /*
   * General wind resistance.
   */
  parasiticDrag: 0.000035,
  inducedDrag: 0.000012,

  /*
   * Keeps gravity from forcing the flight path downward
   * for too long after the player pulls upward.
   */
  gravityPathBend: 0.05,

  /*
   * Maneuver braking.
   *
   * Fast rolling is the strongest way to slow down.
   * Pitching also creates drag, but much less.
   */
  maneuverDragStrength: 11,
  maneuverDragExponent: 1.6,
  maneuverDragDeadzone: 0.1,

  maneuverDragPitchWeight: 0.28,
  maneuverDragRollWeight: 1,

  /*
   * Braking still works at low speed, allowing the HUD
   * to genuinely reach 0 km/h.
   */
  maneuverDragLowSpeedFraction: 0.35,
  maneuverDragSpeedStart: 10,
  maneuverDragSpeedFull: 80,

  /*
   * When nearly stationary, the player begins falling
   * naturally instead of remaining suspended in place.
   */
  lowSpeedFallFullSpeed: 3,
  lowSpeedFallZeroSpeed: 24,
  lowSpeedFallResponse: 3.2,
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

    /*
     * Retained for compatibility with the rest of the game.
     * Boost itself remains completely disabled.
     */
    this.boostCharge = 0;
    this.boostRemaining = 0;
    this.boostArmedRemaining = 0;
    this.boostDrainRemaining = 0;
    this.boostChargeCondition = false;
    this.boostJustTriggered = false;

    this.gravityAcceleration = 0;
    this.dragAcceleration = 0;
    this.assistanceAcceleration = 0;
    this.maneuverDragAcceleration = 0;
    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.totalDistance = 0;
    this.elapsed = 0;

    this._previousVelocity =
      new THREE.Vector3();

    this._velocityDirection =
      new THREE.Vector3(0, 0, -1);

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

    this._deltaQuaternion =
      new THREE.Quaternion();

    this._alignmentQuaternion =
      new THREE.Quaternion();

    this._telemetryFrames = [];
    this._glitchTelemetryFrames = [];

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
    this.position.set(
      x,
      y,
      z
    );

    this.attitude.identity();

    this.angularVelocity.set(
      0,
      0,
      0
    );

    this.speed =
      Math.max(
        0,
        speed
      );

    this.velocity.set(
      0,
      0,
      -this.speed
    );

    this._velocityDirection.set(
      0,
      0,
      -1
    );

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
    this.maneuverDragAcceleration = 0;
    this.overspeedDragAcceleration = 0;
    this.boostAcceleration = 0;

    this.totalDistance = 0;
    this.elapsed = 0;

    this._telemetryPendingEventFlags |=
      TELEMETRY_EVENT_RESPAWN;

    this._telemetryHasPreviousPathAngle =
      false;
  }

  step(
    dt,
    controls
  ) {
    const physics =
      this.config.physics;

    const aero =
      physics.aero;

    this.elapsed += dt;

    this._disableBoost();

    this._previousVelocity.copy(
      this.velocity
    );

    this._updateAxes();

    this._velocityDirection.copy(
      this.velocity
    );

    if (
      this._velocityDirection.lengthSq() <
      1e-8
    ) {
      this._velocityDirection.copy(
        this._nose
      );
    } else {
      this._velocityDirection.normalize();
    }

    this._updateAerodynamicState(
      aero,
      dt * 0.5
    );

    this._updateAttitude(
      dt,
      controls,
      physics,
      aero
    );

    this._updateAxes();

    this._applyLowSpeedFall(
      dt
    );

    this._applyGravityPathBend(
      dt,
      physics
    );

    this._updateAerodynamicState(
      aero,
      dt * 0.5
    );

    this._alignFlightPath(
      dt,
      physics,
      aero
    );

    this.pathAngle =
      Math.asin(
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

    const totalAcceleration =
      clamp(
        acceleration.total,
        -TUNING.maximumDeceleration,
        TUNING.maximumAcceleration
      );

    this.speed =
      clamp(
        this.speed +
          totalAcceleration *
            dt,
        TUNING.minimumSpeed,
        TUNING.maximumSpeed
      );

    this.gravityAcceleration =
      acceleration.gravity;

    this.dragAcceleration =
      acceleration.drag;

    this.assistanceAcceleration =
      acceleration.assistance;

    this.maneuverDragAcceleration =
      acceleration.maneuverDrag;

    this.overspeedDragAcceleration =
      0;

    this.boostAcceleration =
      0;

    this.velocity
      .copy(
        this._velocityDirection
      )
      .multiplyScalar(
        this.speed
      );

    this.position.addScaledVector(
      this.velocity,
      dt
    );

    this.totalDistance +=
      this.speed *
      dt;

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
      .copy(
        LOCAL_FORWARD
      )
      .applyQuaternion(
        this.attitude
      )
      .normalize();

    this._craftUp
      .copy(
        LOCAL_UP
      )
      .applyQuaternion(
        this.attitude
      )
      .normalize();

    this._craftRight
      .copy(
        LOCAL_RIGHT
      )
      .applyQuaternion(
        this.attitude
      )
      .normalize();
  }

  _updateAttitude(
    dt,
    controls,
    physics,
    aero
  ) {
    const highSpeedBlend =
      smoothstep(
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
      controls.pitchRate *
        rateScale,
      0,
      -controls.rollRate *
        rateScale
    );

    this.angularVelocity.x =
      damp(
        this.angularVelocity.x,
        this._targetAngularVelocity.x,
        this._targetAngularVelocity.x ===
          0
          ? physics.angularRelease
          : physics.angularResponse,
        dt
      );

    this.angularVelocity.y =
      damp(
        this.angularVelocity.y,
        this._targetAngularVelocity.y,
        this._targetAngularVelocity.y ===
          0
          ? physics.angularRelease
          : physics.angularResponse,
        dt
      );

    this.angularVelocity.z =
      damp(
        this.angularVelocity.z,
        this._targetAngularVelocity.z,
        this._targetAngularVelocity.z ===
          0
          ? physics.angularRelease
          : physics.angularResponse,
        dt
      );

    const stallRecovery =
      smoothstep(
        aero.stallRecoveryStart,
        1,
        this.stallAmount
      );

    if (
      stallRecovery > 0 &&
      aero.stallRecoveryStrength >
        0 &&
      Math.abs(
        this.angleOfAttack
      ) >
        1e-6
    ) {
      this.angularVelocity.x +=
        -Math.sign(
          this.angleOfAttack
        ) *
        aero.stallRecoveryStrength *
        stallRecovery *
        dt;
    }

    const rotationMagnitude =
      this.angularVelocity.length();

    if (
      rotationMagnitude <=
      1e-8
    ) {
      return;
    }

    this._rotationAxis
      .copy(
        this.angularVelocity
      )
      .multiplyScalar(
        1 /
          rotationMagnitude
      );

    this._deltaQuaternion
      .setFromAxisAngle(
        this._rotationAxis,
        rotationMagnitude *
          dt
      );

    this.attitude
      .multiply(
        this._deltaQuaternion
      )
      .normalize();
  }

  _applyLowSpeedFall(dt) {
    const fallAmount =
      1 -
      smoothstep(
        TUNING.lowSpeedFallFullSpeed,
        TUNING.lowSpeedFallZeroSpeed,
        this.speed
      );

    if (
      fallAmount <= 0
    ) {
      return;
    }

    const blend =
      1 -
      Math.exp(
        -TUNING.lowSpeedFallResponse *
          fallAmount *
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
      .copy(
        WORLD_DOWN
      )
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
    const dot =
      clamp(
        this._velocityDirection.dot(
          this._nose
        ),
        -1,
        1
      );

    const angle =
      Math.acos(
        dot
      );

    this._alignmentAxis.set(
      0,
      0,
      0
    );

    if (
      angle <
      ALIGNMENT_EPSILON
    ) {
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
      Math.abs(
        this.liftCoefficient
      ) *
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

    const alignmentRate =
      Math.min(
        liftRate,
        gLimitedRate
      );

    const alignmentStep =
      Math.min(
        angle,
        alignmentRate *
          dt
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

  _calculateAcceleration(
    physics
  ) {
    const diveFactor =
      smoothstep(
        0,
        TUNING.gravityBlendAngle,
        Math.max(
          0,
          -this.pathAngle
        )
      );

    const climbFactor =
      smoothstep(
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
        ? 1 +
          (
            TUNING
              .diveGravityMultiplier -
            1
          ) *
            diveFactor
        : 1 -
          (
            1 -
            TUNING
              .climbGravityMultiplier
          ) *
            climbFactor *
            climbEnergyAvailable;

    const gravity =
      -physics.gravity *
      Math.sin(
        this.pathAngle
      ) *
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

    const assistance =
      Math.min(
        requestedAssistance,
        drag *
          TUNING
            .levelAssistDragFraction
      );

    const maneuverDrag =
      this._calculateManeuverDrag();

    return {
      gravity,
      drag,
      assistance,
      maneuverDrag,

      total:
        gravity -
        drag +
        assistance -
        maneuverDrag,
    };
  }

  _calculateManeuverDrag() {
    const pitchRatio =
      clamp(
        Math.abs(
          this.angularVelocity.x
        ) /
          Math.max(
            this.config.controls
              .pitchMaxRate,
            1e-6
          ),
        0,
        1.5
      );

    const rollRatio =
      clamp(
        Math.abs(
          this.angularVelocity.z
        ) /
          Math.max(
            this.config.controls
              .rollMaxRate,
            1e-6
          ),
        0,
        1.5
      );

    const weightedTurn =
      Math.hypot(
        pitchRatio *
          TUNING
            .maneuverDragPitchWeight,

        rollRatio *
          TUNING
            .maneuverDragRollWeight
      );

    const turnIntensity =
      clamp(
        (
          weightedTurn -
          TUNING
            .maneuverDragDeadzone
        ) /
          Math.max(
            1e-6,
            1 -
              TUNING
                .maneuverDragDeadzone
          ),
        0,
        1.5
      );

    const speedBlend =
      smoothstep(
        TUNING
          .maneuverDragSpeedStart,
        TUNING
          .maneuverDragSpeedFull,
        this.speed
      );

    const speedFactor =
      THREE.MathUtils.lerp(
        TUNING
          .maneuverDragLowSpeedFraction,
        1,
        speedBlend
      );

    return (
      TUNING
        .maneuverDragStrength *
      Math.pow(
        turnIntensity,
        TUNING
          .maneuverDragExponent
      ) *
      speedFactor
    );
  }

  _updateAerodynamicState(
    aero,
    dt
  ) {
    this._pitchPlaneVelocity
      .copy(
        this._velocityDirection
      )
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
        0,
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

    const cosine =
      clamp(
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

    const rawStallAmount =
      smoothstep(
        aero.stallWarningAngle,
        aero.postStallAngle,
        magnitude
      );

    const timeConstant =
      rawStallAmount >
      this.stallAmount
        ? aero.stallAttackTime
        : aero.stallReleaseTime;

    this._approachStallAmount(
      rawStallAmount,
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
        1 -
        (
          1 -
          aero
            .postStallLiftFraction
        ) *
          postStallBlend;

      liftMagnitude =
        maximumLift *
        retainedLift;
    }

    this.liftCoefficient =
      Math.sign(
        this.angleOfAttack
      ) *
      liftMagnitude;
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

    this.stallAmount =
      clamp(
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
      .copy(
        this.velocity
      )
      .sub(
        this._previousVelocity
      )
      .multiplyScalar(
        1 /
          dt
      );

    this._specificForce.y +=
      physics.gravity;

    const rawG =
      this._specificForce.dot(
        this._craftUp
      ) /
      physics.gravity;

    this.gLoad =
      damp(
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

    const frame = {
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

      liftCoefficient:
        this.liftCoefficient,

      stallAmount:
        this.stallAmount,

      gLoad:
        this.gLoad,

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

      acceleration: {
        gravity:
          this.gravityAcceleration,

        drag:
          this.dragAcceleration,

        assistance:
          this
            .assistanceAcceleration,

        maneuverDrag:
          this
            .maneuverDragAcceleration,
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

    if (
      !this.telemetryGlitchDetected &&
      Math.abs(
        pathAngleDelta
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
        this._telemetryFrames.map(
          (item) => ({
            ...item,
          })
        );
    }
  }

  flagTelemetryEvent(flags) {
    this._telemetryPendingEventFlags |=
      flags;
  }

  clearTelemetry() {
    this._telemetryFrames.length = 0;
    this._glitchTelemetryFrames.length = 0;
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
      version: 2,

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
      .copy(
        LOCAL_FORWARD
      )
      .applyQuaternion(
        this.attitude
      )
      .normalize();
  }

  getUp(target) {
    return target
      .copy(
        LOCAL_UP
      )
      .applyQuaternion(
        this.attitude
      )
      .normalize();
  }

  getRight(target) {
    return target
      .copy(
        LOCAL_RIGHT
      )
      .applyQuaternion(
        this.attitude
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
