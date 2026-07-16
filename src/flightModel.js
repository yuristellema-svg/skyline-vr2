import * as THREE from '../vendor/three.module.min.js';
import {
  CONFIG,
  clamp,
  damp,
  smoothstep,
} from './config.js';

import {
  getAircraftFlightProfile,
  getInitialAircraftFlightProfile,
} from './aircraftFlightProfiles.js';

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

// SKYLINE_V5_INTEGRATION
// SKYLINE_BUNDLE_B_FLIGHT_PROFILES
const TUNING = Object.freeze({
  maximumSpeed: 50000,
  maximumAcceleration: 30,
  maximumDeceleration: 34,
  controlSpeedFloor: 6,

  diveGravityMultiplier: 1.42,
  climbGravityMultiplier: 0.72,
  climbRetentionStartSpeed: 18,
  climbRetentionFullSpeed: 75,

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
  // Ordinary course corrections retain momentum. Only a genuinely hard,
  // sustained turn becomes an effective airbrake.
  turnDragCoefficient: 0.052,
  turnDragExponent: 1.48,
  maximumTurnDrag: 18,

  misalignmentStart:
    5 * Math.PI / 180,

  misalignmentFull:
    32 * Math.PI / 180,

  misalignmentDragCoefficient: 0.00016,
  misalignmentDragExponent: 1.38,
  maximumMisalignmentDrag: 14,

  // Bank angle now produces a coordinated, speed-dependent heading change.
  // Faster flight therefore creates a naturally wider, heavier turn.
  coordinatedTurnStrength: 0.88,
  coordinatedTurnMinimumSpeed: 18,
  coordinatedTurnMinimumBank: 3 * Math.PI / 180,
  coordinatedTurnMaximumBank: 65 * Math.PI / 180,
  coordinatedTurnMaximumRate: 30 * Math.PI / 180,

  // Angular input remains responsive, but no longer snaps instantly at speed.
  highSpeedAngularResponseScale: 0.38,
  highSpeedAngularReleaseScale: 2.1,

  /*
   * 50 km/h remains flyable.
   * The soft stall becomes substantial below that.
   */
  lowSpeedStallStart: 12,
  lowSpeedStallFull: 2,
  lowSpeedStallAmount: 0.72,
  stalledLiftFraction: 0.5,
  stalledSteeringFraction: 0.26,

  zeroSnapSpeed: 0.65,
  recoveryTriggerSpeed: 5,
  recoveryReleaseSpeed: 22,

  recoveryNoseDownRate:
    44 * Math.PI / 180,

  recoveryFallResponse: 7,

});


export class FlightModel {
  constructor(config = CONFIG) {
    this.config = config;

    this.aircraftProfile =
      getInitialAircraftFlightProfile();

    this.aircraftProfileId =
      this.aircraftProfile.id;

    this.structuralStress = 0;
    this.structuralWarning = false;
    this.overspeedRatio = 0;
    this.blackoutAmount = 0;
    this.redoutAmount = 0;
    this._structuralWarningState = false;

    this._onAircraftProfile =
      event => {
        const profile =
          getAircraftFlightProfile(
            event?.detail?.id,
          );

        this.aircraftProfile =
          profile;

        this.aircraftProfileId =
          profile.id;
      };

    globalThis.window
      ?.addEventListener?.(
        'skyline:aircraft-changed',
        this._onAircraftProfile,
      );

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

    this._coordinatedTurnQuaternion =
      new THREE.Quaternion();

    this._horizontalRight =
      new THREE.Vector3(1, 0, 0);

    this._misalignmentAngle = 0;

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

    this.structuralStress = 0;
    this.structuralWarning = false;
    this.overspeedRatio = 0;
    this.blackoutAmount = 0;
    this.redoutAmount = 0;
    this._structuralWarningState = false;

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

    this._applyCoordinatedTurn(
      dt,
      physics,
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
      this.speed = Math.max(this.speed, 1.8);

      this.lowSpeedRecoveryActive =
        true;
    }

    this.gravityAcceleration =
      acceleration.gravity;

    this.dragAcceleration =
      acceleration.straightDrag;

    this.assistanceAcceleration =
      acceleration.energyBias;

    this.turnDragAcceleration =
      acceleration.turnDrag;

    this.misalignmentDragAcceleration =
      acceleration.misalignmentDrag;

    this.maneuverDragAcceleration =
      acceleration.turnDrag +
      acceleration.misalignmentDrag;

    this.overspeedDragAcceleration =
      acceleration.overspeedDrag;

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

    this._updateStructuralState(
      dt,
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
    const profile =
      this.aircraftProfile;

    const highSpeedBlend =
      smoothstep(
        this.config.controls
          .highSpeedControlStart,

        this.config.controls
          .highSpeedControlFull,

        this.speed,
      );

    let rateScale =
      THREE.MathUtils.lerp(
        1,

        this.config.controls
          .highSpeedControlScale,

        highSpeedBlend,
      );

    // SKYLINE_V5_1_PATH_LAG_GUARD
    // Stop the nose rotating far ahead of the
    // actual flight path during fast reversals.
    const pathLagGuard =
      smoothstep(
        12 * Math.PI / 180,
        52 * Math.PI / 180,
        this._misalignmentAngle,
      );

    rateScale *=
      THREE.MathUtils.lerp(
        1,
        0.30,
        highSpeedBlend *
          pathLagGuard,
      );

    const angularResponse =
      physics.angularResponse *
      profile.angularResponseScale *
      THREE.MathUtils.lerp(
        1,
        TUNING.highSpeedAngularResponseScale,
        highSpeedBlend,
      );

    const angularRelease =
      physics.angularRelease *
      profile.angularReleaseScale *
      THREE.MathUtils.lerp(
        1,
        TUNING.highSpeedAngularReleaseScale,
        highSpeedBlend,
      );

    this._targetAngularVelocity.set(
      controls.pitchRate *
        rateScale *
        profile.pitchRateScale,

      0,

      -controls.rollRate *
        rateScale *
        profile.rollRateScale,
    );

    this._addRecoveryAngularVelocity();

    this.angularVelocity.x =
      damp(
        this.angularVelocity.x,

        this._targetAngularVelocity.x,

        this._targetAngularVelocity.x ===
          0
          ? angularRelease
          : angularResponse,

        dt,
      );

    this.angularVelocity.y =
      damp(
        this.angularVelocity.y,

        this._targetAngularVelocity.y,

        this._targetAngularVelocity.y ===
          0
          ? angularRelease
          : angularResponse,

        dt,
      );

    this.angularVelocity.z =
      damp(
        this.angularVelocity.z,

        this._targetAngularVelocity.z,

        this._targetAngularVelocity.z ===
          0
          ? angularRelease
          : angularResponse,

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

  _applyCoordinatedTurn(
    dt,
    physics,
  ) {
    this._horizontalRight
      .crossVectors(
        this._velocityDirection,
        WORLD_UP,
      );

    if (
      this._horizontalRight.lengthSq() <
      EPSILON
    ) {
      return;
    }

    this._horizontalRight.normalize();

    const maximumBankSine =
      Math.sin(
        TUNING.coordinatedTurnMaximumBank,
      );

    const bankSine =
      clamp(
        this._craftUp.dot(
          this._horizontalRight,
        ),
        -maximumBankSine,
        maximumBankSine,
      );

    const bankAngle =
      Math.asin(bankSine);

    if (
      Math.abs(bankAngle) <
      TUNING.coordinatedTurnMinimumBank
    ) {
      return;
    }

    const turnRate =
      clamp(
        (
          physics.gravity *
          Math.tan(bankAngle) *
          TUNING.coordinatedTurnStrength *
          this.aircraftProfile
            .coordinatedTurnScale
        ) /
          Math.max(
            this.speed,
            TUNING.coordinatedTurnMinimumSpeed,
          ),
        -TUNING.coordinatedTurnMaximumRate,
        TUNING.coordinatedTurnMaximumRate,
      );

    const yawStep =
      -turnRate * dt;

    this._coordinatedTurnQuaternion
      .setFromAxisAngle(
        WORLD_UP,
        yawStep,
      );

    this._velocityDirection
      .applyQuaternion(
        this._coordinatedTurnQuaternion,
      )
      .normalize();

    this._nose
      .applyQuaternion(
        this._coordinatedTurnQuaternion,
      )
      .normalize();

    this._craftUp
      .applyQuaternion(
        this._coordinatedTurnQuaternion,
      )
      .normalize();

    this._craftRight
      .applyQuaternion(
        this._coordinatedTurnQuaternion,
      )
      .normalize();

    this.attitude
      .premultiply(
        this._coordinatedTurnQuaternion,
      )
      .normalize();

    this.pathTurnRate =
      Math.hypot(
        this.pathTurnRate,
        turnRate,
      );
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
      this.aircraftProfile
        .liftScale *
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
    const profile =
      this.aircraftProfile;

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

    const climbEnergy =
      smoothstep(
        TUNING.climbRetentionStartSpeed,
        TUNING.climbRetentionFullSpeed,
        this.speed,
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

            climbFactor *
              climbEnergy,
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
          this.speed *
          profile.dragScale,
      );

    const turnDrag =
      Math.min(
        TUNING.maximumTurnDrag,

        TUNING.turnDragCoefficient *
        this.speed *
        Math.pow(
          Math.max(
            0,
            this.pathTurnRate,
          ),

          TUNING.turnDragExponent,
        ) *
        profile.turnDragScale,
      );

    const misalignmentAmount =
      smoothstep(
        TUNING.misalignmentStart,
        TUNING.misalignmentFull,
        this._misalignmentAngle,
      );

    const misalignmentDrag =
      Math.min(
        TUNING.maximumMisalignmentDrag,

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
        ) *
        profile
          .misalignmentDragScale,
      );

    const overspeed =
      Math.max(
        0,
        this.speed -
          profile.overspeedStart,
      );

    const overspeedDrag =
      Math.min(
        profile.maxOverspeedDrag,

        profile.overspeedDrag *
          overspeed *
          overspeed,
      );

    const energyBias =
      profile.energyBias *
      (
        1 -
        clamp(
          this.stallAmount,
          0,
          1,
        )
      );

    this.overspeedRatio =
      overspeed /
      Math.max(
        1,
        profile.overspeedStart,
      );

    return {
      gravity,
      straightDrag,
      turnDrag,
      misalignmentDrag,
      overspeedDrag,
      energyBias,

      total:
        gravity +
        energyBias -
        straightDrag -
        turnDrag -
        misalignmentDrag -
        overspeedDrag,
    };
  }

  _lowSpeedStallAmount() {
    return (
      1 -
      smoothstep(
        TUNING.lowSpeedStallFull *
          this.aircraftProfile
            .stallSpeedScale,

        TUNING.lowSpeedStallStart *
          this.aircraftProfile
            .stallSpeedScale,
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

  _updateStructuralState(dt) {
    const profile =
      this.aircraftProfile;

    const positiveLoad =
      smoothstep(
        profile.structuralPositiveG *
          0.72,

        profile.structuralPositiveG *
          1.06,

        this.gLoad,
      );

    const negativeLoad =
      smoothstep(
        Math.abs(
          profile.structuralNegativeG
        ) *
          0.70,

        Math.abs(
          profile.structuralNegativeG
        ) *
          1.06,

        Math.abs(
          Math.min(
            0,
            this.gLoad,
          ),
        ),
      );

    const overspeedLoad =
      smoothstep(
        0.08,
        0.52,
        this.overspeedRatio,
      );

    const target =
      Math.max(
        positiveLoad,
        negativeLoad,
        overspeedLoad,
      );

    this.structuralStress =
      damp(
        this.structuralStress,
        target,

        target >
          this.structuralStress
          ? 2.6
          : 0.55,

        dt,
      );

    this.structuralWarning =
      this.structuralStress >
      0.52;

    if (
      this.structuralWarning !==
      this._structuralWarningState
    ) {
      this._structuralWarningState =
        this.structuralWarning;

      const EventType =
        globalThis.CustomEvent;

      if (
        typeof EventType ===
          'function' &&
        globalThis.window
          ?.dispatchEvent
      ) {
        globalThis.window
          .dispatchEvent(
            new EventType(
              'skyline:structural-warning',
              {
                detail: {
                  active:
                    this.structuralWarning,

                  stress:
                    this.structuralStress,

                  profile:
                    profile.id,
                },
              },
            ),
          );
      }
    }
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
