import * as THREE from '../vendor/three.module.min.js';
import {
  CONFIG,
  clamp,
  damp,
  smoothstep,
} from './config.js';

const LOCAL_FORWARD =
  new THREE.Vector3(
    0,
    0,
    -1,
  );

const LOCAL_UP =
  new THREE.Vector3(
    0,
    1,
    0,
  );

const LOCAL_RIGHT =
  new THREE.Vector3(
    1,
    0,
    0,
  );

// SKYLINE_RENDER_POSE_INTERPOLATION_V1_CAMERA
// reset() and update() consume the shared render pose. Direct viewYaw and
// camera shake remain current-frame values, so phone head tracking stays live.
export class CameraRig {
  constructor(
    scene,
    camera,
    heightSampler =
      () => 0,
    config = CONFIG,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.heightSampler =
      heightSampler;

    this.config = config;
    this.mode = 'first';

    this.basePosition =
      new THREE.Vector3();

    this.baseQuaternion =
      new THREE.Quaternion();

    this._thirdPosition =
      new THREE.Vector3();

    this._thirdVelocity =
      new THREE.Vector3();

    this._thirdTarget =
      new THREE.Vector3();

    this._change =
      new THREE.Vector3();

    this._springTemp =
      new THREE.Vector3();

    this._localOffset =
      new THREE.Vector3();

    this._firstOffset =
      new THREE.Vector3(
        ...config.camera
          .firstPersonHead,
      );

    this._worldOffset =
      new THREE.Vector3();

    this._qRollLag =
      new THREE.Quaternion();

    this._qHeadYaw =
      new THREE.Quaternion();

    this._qYaw =
      new THREE.Quaternion();

    this._qPitch =
      new THREE.Quaternion();

    this._qShakePitch =
      new THREE.Quaternion();

    this._qShakeYaw =
      new THREE.Quaternion();

    this._qShakeRoll =
      new THREE.Quaternion();

    this._rollLagAngle = 0;

    this.firstPersonRig =
      this._buildFirstPersonRig();

    this.camera.add(
      this.firstPersonRig,
    );

    this.pilot =
      this._buildPilot();

    this.scene.add(
      this.pilot,
    );

    this.shadow =
      this._buildBlobShadow();

    this.scene.add(
      this.shadow,
    );

    this._syncVisibility();
  }

  _buildFirstPersonRig() {
    const positions =
      new Float32Array([
        -0.72,
        -0.98,
        -1.42,

        -1.36,
        -1.16,
        -1.86,

        -0.98,
        -1.28,
        -2.34,

        0.72,
        -0.98,
        -1.42,

        0.98,
        -1.28,
        -2.34,

        1.36,
        -1.16,
        -1.86,
      ]);

    const geometry =
      new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',

      new THREE.BufferAttribute(
        positions,
        3,
      ),
    );

    geometry.computeVertexNormals();

    const material =
      new THREE.MeshBasicMaterial({
        color:
          0xd98b4e,

        side:
          THREE.DoubleSide,

        transparent:
          true,

        opacity:
          0.88,

        fog:
          false,

        toneMapped:
          false,
      });

    const mesh =
      new THREE.Mesh(
        geometry,
        material,
      );

    mesh.name =
      'First-person wingsuit reference';

    mesh.frustumCulled =
      false;

    return mesh;
  }

  _buildPilot() {
    const group =
      new THREE.Group();

    group.name =
      'Low-poly wingsuit pilot';

    const suit =
      new THREE.MeshLambertMaterial({
        color:
          0xd98b4e,

        flatShading:
          true,

        side:
          THREE.DoubleSide,
      });

    const dark =
      new THREE.MeshLambertMaterial({
        color:
          0x243b3e,

        flatShading:
          true,
      });

    const skin =
      new THREE.MeshLambertMaterial({
        color:
          0xd4aa82,

        flatShading:
          true,
      });

    const wingGeometry =
      new THREE.BufferGeometry();

    wingGeometry.setAttribute(
      'position',

      new THREE.BufferAttribute(
        new Float32Array([
          0,
          0,
          -1.45,

          -2.45,
          0,
          -0.35,

          0,
          0,
          1.3,

          0,
          0,
          -1.45,

          0,
          0,
          1.3,

          2.45,
          0,
          -0.35,
        ]),

        3,
      ),
    );

    wingGeometry
      .computeVertexNormals();

    const wings =
      new THREE.Mesh(
        wingGeometry,
        suit,
      );

    wings.position.y =
      0.02;

    group.add(
      wings,
    );

    const torso =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.38,
          0.52,
          2.35,
          7,
        ),

        dark,
      );

    torso.rotation.x =
      Math.PI *
      0.5;

    torso.position.z =
      -0.05;

    group.add(
      torso,
    );

    const head =
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(
          0.34,
          1,
        ),

        skin,
      );

    head.position.set(
      0,
      0.15,
      -1.45,
    );

    group.add(
      head,
    );

    for (
      const side of
      [
        -1,
        1,
      ]
    ) {
      const leg =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.13,
            0.18,
            1.55,
            6,
          ),

          dark,
        );

      leg.rotation.x =
        Math.PI *
        0.5;

      leg.position.set(
        side *
          0.23,

        -0.03,

        1.05,
      );

      group.add(
        leg,
      );
    }

    return group;
  }

  _buildBlobShadow() {
    const mesh =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          1.8,
          24,
        ),

        new THREE.MeshBasicMaterial({
          color:
            0x07100e,

          transparent:
            true,

          opacity:
            0.18,

          depthWrite:
            false,
        }),
      );

    mesh.rotation.x =
      -Math.PI *
      0.5;

    mesh.renderOrder =
      2;

    return mesh;
  }

  toggle() {
    this.mode =
      this.mode === 'first'
        ? 'cockpit'
        : this.mode === 'cockpit'
          ? 'third'
          : 'first';

    this._syncVisibility();
    return this.mode;
  }

  setMode(mode) {
    this.mode =
      mode === 'third'
        ? 'third'
        : mode === 'cockpit'
          ? 'cockpit'
          : 'first';

    this._syncVisibility();
  }

  _syncVisibility() {
    this.firstPersonRig.visible =
      false;

    this.pilot.visible =
      this.mode ===
      'third';
  }

  reset(renderPose) {
    const pullback =
      this.config.camera
        .thirdPullback *
      smoothstep(
        this.config.camera
          .fovSpeedStart,

        this.config.camera
          .fovSpeedFull,

        renderPose.speed,
      );

    this._localOffset.set(
      0,

      this.config.camera
        .thirdUp,

      this.config.camera
        .thirdBack +
        pullback,
    );

    this._worldOffset
      .copy(
        this._localOffset,
      )
      .applyQuaternion(
        renderPose.attitude,
      );

    this._thirdPosition
      .copy(
        renderPose.position,
      )
      .add(
        this._worldOffset,
      );

    this._thirdVelocity.set(
      0,
      0,
      0,
    );

    this._rollLagAngle = 0;
  }

  update(
    dt,
    renderPose,
    stereoEnabled,
    menuLook,
    shakePitch,
    shakeYaw,
    shakeRoll,
    viewSqueeze,
  ) {
    const cameraConfig =
      this.config.camera;

    if (
      this.mode !== 'third'
    ) {
      this._worldOffset
        .copy(
          this._firstOffset,
        )
        .applyQuaternion(
          renderPose.attitude,
        );

      this.basePosition
        .copy(
          renderPose.position,
        )
        .add(
          this._worldOffset,
        );

      this.baseQuaternion
        .copy(
          renderPose.attitude,
        );
    } else {
      const pullback =
        cameraConfig
          .thirdPullback *
        smoothstep(
          cameraConfig
            .fovSpeedStart,

          cameraConfig
            .fovSpeedFull,

          renderPose.speed,
        );

      this._localOffset.set(
        0,

        cameraConfig
          .thirdUp,

        cameraConfig
          .thirdBack +
          pullback,
      );

      this._worldOffset
        .copy(
          this._localOffset,
        )
        .applyQuaternion(
          renderPose.attitude,
        );

      this._thirdTarget
        .copy(
          renderPose.position,
        )
        .add(
          this._worldOffset,
        );

      this._spring(
        this._thirdPosition,
        this._thirdVelocity,
        this._thirdTarget,

        cameraConfig
          .thirdPositionResponse,

        dt,
      );

      this.basePosition
        .copy(
          this._thirdPosition,
        );

      const semanticRollRate =
        -renderPose.angularVelocity.z;

      const rollLagTarget =
        clamp(
          -semanticRollRate *
            cameraConfig
              .thirdRollLagSeconds,

          -cameraConfig
            .thirdMaxRollLag,

          cameraConfig
            .thirdMaxRollLag,
        );

      this._rollLagAngle =
        damp(
          this._rollLagAngle,

          rollLagTarget,

          cameraConfig
            .rollLagResponse,

          dt,
        );

      this._qRollLag
        .setFromAxisAngle(
          LOCAL_FORWARD,
          this._rollLagAngle,
        );

      this.baseQuaternion
        .copy(
          renderPose.attitude,
        )
        .multiply(
          this._qRollLag,
        );
    }

    this.camera.position
      .copy(
        this.basePosition,
      );

    this.camera.quaternion
      .copy(
        this.baseQuaternion,
      );

    if (menuLook) {
      this._qYaw
        .setFromAxisAngle(
          LOCAL_UP,
          -menuLook.yaw,
        );

      this._qPitch
        .setFromAxisAngle(
          LOCAL_RIGHT,
          menuLook.pitch,
        );

      this.camera.quaternion
        .multiply(
          this._qYaw,
        )
        .multiply(
          this._qPitch,
        );
    } else {
      /*
       * Horizontal head look is independent.
       * Flight direction remains unchanged.
       */
      this._qHeadYaw
        .setFromAxisAngle(
          LOCAL_UP,

          -clamp(
            Number.isFinite(
              renderPose.viewYaw,
            )
              ? renderPose.viewYaw
              : 0,

            -this.config.controls
              .headLookMaxYaw,

            this.config.controls
              .headLookMaxYaw,
          ),
        );

      this.camera.quaternion
        .multiply(
          this._qHeadYaw,
        );

      this._qShakePitch
        .setFromAxisAngle(
          LOCAL_RIGHT,
          shakePitch,
        );

      this._qShakeYaw
        .setFromAxisAngle(
          LOCAL_UP,
          shakeYaw,
        );

      this._qShakeRoll
        .setFromAxisAngle(
          LOCAL_FORWARD,
          shakeRoll,
        );

      this.camera.quaternion
        .multiply(
          this._qShakeYaw,
        )
        .multiply(
          this._qShakePitch,
        )
        .multiply(
          this._qShakeRoll,
        );
    }

    const speedFov =
      cameraConfig
        .monoSpeedFov *
      smoothstep(
        cameraConfig
          .fovSpeedStart,

        cameraConfig
          .fovSpeedFull,

        renderPose.speed,
      );

    const baseFov =
      stereoEnabled
        ? cameraConfig
            .stereoFov
        : cameraConfig
            .monoBaseFov +
          speedFov;

    this.camera.fov =
      baseFov *
      (
        1 -
        clamp(
          viewSqueeze,
          0,
          this.config.effects
            .maxViewSqueeze,
        )
      );

    this.camera
      .updateProjectionMatrix();

    this.camera
      .updateMatrixWorld(
        true,
      );

    this.pilot.position
      .copy(
        renderPose.position,
      );

    this.pilot.quaternion
      .copy(
        renderPose.attitude,
      );

    const ground =
      this.heightSampler(
        renderPose.position.x,
        renderPose.position.z,
      );

    const height =
      Math.max(
        0,
        renderPose.position.y -
          ground,
      );

    const shadowScale =
      clamp(
        1 +
          Math.sqrt(
            height,
          ) *
            0.11,

        1,
        9,
      );

    this.shadow.position.set(
      renderPose.position.x,
      ground +
        0.035,
      renderPose.position.z,
    );

    this.shadow.scale.set(
      shadowScale,
      shadowScale,
      shadowScale,
    );

    this.shadow.material.opacity =
      clamp(
        0.28 -
          height *
            0.00065,

        0.035,
        0.28,
      );
  }

  _spring(
    position,
    velocity,
    target,
    frequency,
    dt,
  ) {
    const omega =
      2 *
      Math.PI *
      frequency;

    const x =
      omega *
      dt;

    const decay =
      1 /
      (
        1 +
        x +
        0.48 *
          x *
          x +
        0.235 *
          x *
          x *
          x
      );

    this._change
      .copy(
        position,
      )
      .sub(
        target,
      );

    this._springTemp
      .copy(
        velocity,
      )
      .addScaledVector(
        this._change,
        omega,
      )
      .multiplyScalar(
        dt,
      );

    velocity
      .addScaledVector(
        this._springTemp,
        -omega,
      )
      .multiplyScalar(
        decay,
      );

    position
      .copy(
        target,
      )
      .add(
        this._change
          .add(
            this._springTemp,
          )
          .multiplyScalar(
            decay,
          ),
      );
  }
}
