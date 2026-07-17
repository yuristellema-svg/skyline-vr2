import * as THREE from '../vendor/three.module.min.js';
import {
  MENU_BEACON_CONFIG,
  beaconLocalPosition,
  createMenuBeaconState,
  updateMenuBeacon,
} from './workerNav/menuBeaconLogic.js';
import { clamp } from './workerNav/navContracts.js';

// SKYLINE_WORKER_NAV_V1_BEACON
export class VrMenuBeacon {
  constructor(scene) {
    this.scene = scene;
    this.state = createMenuBeaconState();
    this.worldPosition = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3();
    this.gazeDirection = new THREE.Vector3();
    this.localGazeDirection = new THREE.Vector3();
    this.inverseBaseQuaternion = new THREE.Quaternion();

    const local = beaconLocalPosition();
    this.localPosition = new THREE.Vector3(local.x, local.y, local.z);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.context = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    if ('colorSpace' in this.texture && THREE.SRGBColorSpace) {
      this.texture.colorSpace = THREE.SRGBColorSpace;
    }

    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.name = 'vr-menu-beacon';
    this.sprite.scale.set(0.39, 0.39, 1);
    this.sprite.renderOrder = 10000;
    this.sprite.visible = false;
    this.scene.add(this.sprite);
    this._draw();
  }

  get progress() { return this.state.progress; }
  get hovered() { return this.state.hovered; }
  get armed() { return this.state.armed; }

  _draw() {
    const context = this.context;
    const progress = this.state.progress;
    const hovered = this.state.hovered;
    context.clearRect(0, 0, 256, 256);

    const x = 128;
    const y = 104;
    context.beginPath();
    context.arc(x, y, 42, 0, Math.PI * 2);
    context.fillStyle = hovered
      ? 'rgba(26, 24, 17, 0.97)'
      : 'rgba(18, 18, 14, 0.86)';
    context.fill();
    context.lineWidth = hovered ? 7 : 5;
    context.strokeStyle = hovered ? '#ffe09b' : '#bf9856';
    context.stroke();

    context.beginPath();
    context.arc(x, y, 13, 0, Math.PI * 2);
    context.fillStyle = hovered ? '#fff0b5' : '#d9ad61';
    context.fill();

    if (progress > 0) {
      context.beginPath();
      context.arc(
        x,
        y,
        54,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
      );
      context.lineWidth = 10;
      context.lineCap = 'round';
      context.strokeStyle = '#ffe7a5';
      context.stroke();
    }

    context.font = 'bold 27px ui-monospace, Menlo, Consolas, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = hovered ? '#fff0bd' : '#d8bd82';
    context.fillText('MENU', x, 184);
    this.texture.needsUpdate = true;
  }

  update(dt, { active, camera, basePosition, baseQuaternion }) {
    if (!active || !camera || !basePosition || !baseQuaternion) {
      this.sprite.visible = false;
      this.state = updateMenuBeacon(this.state, { active: false, dt });
      this._draw();
      return false;
    }

    this.worldPosition
      .copy(this.localPosition)
      .applyQuaternion(baseQuaternion)
      .add(basePosition);
    this.sprite.position.copy(this.worldPosition);
    this.sprite.visible = true;

    camera.getWorldPosition(this.cameraPosition);
    camera.getWorldDirection(this.gazeDirection);
    this.inverseBaseQuaternion.copy(baseQuaternion).invert();
    this.localGazeDirection
      .copy(this.gazeDirection)
      .applyQuaternion(this.inverseBaseQuaternion)
      .normalize();

    const yaw = Math.atan2(
      this.localGazeDirection.x,
      -this.localGazeDirection.z,
    );
    const pitch = Math.asin(clamp(this.localGazeDirection.y, -1, 1));

    this.state = updateMenuBeacon(this.state, {
      active: true,
      yaw,
      pitch,
      dt,
    });
    this._draw();

    if (!this.state.activated) return false;
    this.sprite.visible = false;
    return true;
  }

  dispose() {
    this.scene?.remove(this.sprite);
    this.texture.dispose();
    this.material.dispose();
  }
}
