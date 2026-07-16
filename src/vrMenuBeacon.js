import * as THREE from '../vendor/three.module.min.js';

const DWELL_SECONDS = 1.10;
const TARGET_ALIGNMENT =
  Math.cos(
    THREE.MathUtils.degToRad(8),
  );

const RESET_ALIGNMENT =
  Math.cos(
    THREE.MathUtils.degToRad(14),
  );

// About 60 degrees left of the normal forward view.
const LOCAL_POSITION =
  new THREE.Vector3(
    -0.92,
    0,
    -1.48,
  );

// SKYLINE_VR_MENU_BEACON_V1
// SKYLINE_RECOVERED_REACHABLE_BEACON
export class VrMenuBeacon {
  constructor(scene) {
    this.scene = scene;
    this.progress = 0;
    this.armed = false;
    this.hovered = false;

    this.worldPosition =
      new THREE.Vector3();

    this.cameraPosition =
      new THREE.Vector3();

    this.gazeDirection =
      new THREE.Vector3();

    this.targetDirection =
      new THREE.Vector3();

    this.canvas =
      document.createElement('canvas');

    this.canvas.width = 256;
    this.canvas.height = 256;

    this.context =
      this.canvas.getContext('2d');

    this.texture =
      new THREE.CanvasTexture(
        this.canvas,
      );

    if (
      'colorSpace' in
        this.texture &&
      THREE.SRGBColorSpace
    ) {
      this.texture.colorSpace =
        THREE.SRGBColorSpace;
    }

    this.material =
      new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });

    this.sprite =
      new THREE.Sprite(
        this.material,
      );

    this.sprite.name =
      'vr-menu-beacon';

    this.sprite.scale.set(
      0.42,
      0.42,
      1,
    );

    this.sprite.renderOrder =
      10000;

    this.sprite.visible = false;

    this.scene.add(
      this.sprite,
    );

    this._draw();
  }

  _draw() {
    const context =
      this.context;

    context.clearRect(
      0,
      0,
      256,
      256,
    );

    const x = 128;
    const y = 106;

    context.beginPath();
    context.arc(
      x,
      y,
      38,
      0,
      Math.PI * 2,
    );

    context.fillStyle =
      this.hovered
        ? 'rgba(26, 24, 17, 0.96)'
        : 'rgba(18, 18, 14, 0.82)';

    context.fill();

    context.lineWidth = 5;
    context.strokeStyle =
      this.hovered
        ? '#ffe09b'
        : '#bf9856';

    context.stroke();

    context.beginPath();
    context.arc(
      x,
      y,
      14,
      0,
      Math.PI * 2,
    );

    context.fillStyle =
      this.hovered
        ? '#fff0b5'
        : '#d9ad61';

    context.fill();

    if (this.progress > 0) {
      context.beginPath();

      context.arc(
        x,
        y,
        50,
        -Math.PI / 2,
        -Math.PI / 2 +
          Math.PI *
            2 *
            this.progress,
      );

      context.lineWidth = 9;
      context.lineCap =
        'round';

      context.strokeStyle =
        '#ffe7a5';

      context.stroke();
    }

    context.font =
      'bold 25px monospace';

    context.textAlign =
      'center';

    context.textBaseline =
      'middle';

    context.fillStyle =
      this.hovered
        ? '#fff0bd'
        : '#d8bd82';

    context.fillText(
      'MENU',
      x,
      183,
    );

    this.texture.needsUpdate =
      true;
  }

  update(
    dt,
    {
      active,
      camera,
      basePosition,
      baseQuaternion,
    },
  ) {
    if (
      !active ||
      !camera ||
      !basePosition ||
      !baseQuaternion
    ) {
      this.sprite.visible =
        false;

      this.progress = 0;
      this.hovered = false;
      this.armed = false;

      return false;
    }

    this.sprite.visible = true;

    this.worldPosition
      .copy(
        LOCAL_POSITION,
      )
      .applyQuaternion(
        baseQuaternion,
      )
      .add(
        basePosition,
      );

    this.sprite.position.copy(
      this.worldPosition,
    );

    camera.getWorldPosition(
      this.cameraPosition,
    );

    camera.getWorldDirection(
      this.gazeDirection,
    );

    this.targetDirection
      .copy(
        this.worldPosition,
      )
      .sub(
        this.cameraPosition,
      )
      .normalize();

    const alignment =
      this.gazeDirection.dot(
        this.targetDirection,
      );

    if (!this.armed) {
      if (
        alignment <
        RESET_ALIGNMENT
      ) {
        this.armed = true;
      }

      this.progress = 0;
      this.hovered = false;
      this._draw();

      return false;
    }

    const hovering =
      alignment >=
      TARGET_ALIGNMENT;

    this.hovered = hovering;

    if (hovering) {
      this.progress =
        Math.min(
          1,
          this.progress +
            dt /
              DWELL_SECONDS,
        );
    } else {
      this.progress =
        Math.max(
          0,
          this.progress -
            dt * 3.5,
        );
    }

    this._draw();

    if (this.progress < 1) {
      return false;
    }

    this.progress = 0;
    this.hovered = false;
    this.armed = false;
    this.sprite.visible = false;
    this._draw();

    return true;
  }

  dispose() {
    this.scene?.remove(
      this.sprite,
    );

    this.texture.dispose();
    this.material.dispose();
  }
}
