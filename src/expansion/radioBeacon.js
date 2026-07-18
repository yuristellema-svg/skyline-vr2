import * as THREE from '../../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const RADIO_YAW = 68 * DEG;
const DISTANCE = 1.68;
const DWELL = 1.0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.13, 0.13, 1);
  sprite.renderOrder = 10020;
  sprite.userData.canvas = canvas;
  sprite.userData.context = context;
  sprite.userData.texture = texture;
  return sprite;
}

function drawArcPair(context, radius) {
  context.beginPath();
  context.arc(64, 64, radius, -0.72, 0.72);
  context.stroke();
  context.beginPath();
  context.arc(64, 64, radius, Math.PI - 0.72, Math.PI + 0.72);
  context.stroke();
}

function draw(sprite, enabled, hovered, progress) {
  const { canvas, context, texture } = sprite.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.beginPath();
  context.arc(64, 64, 43, 0, Math.PI * 2);
  context.fillStyle = hovered
    ? 'rgba(24,23,17,0.98)'
    : 'rgba(12,14,13,0.88)';
  context.fill();
  context.strokeStyle = enabled
    ? '#ffe39a'
    : hovered
      ? '#e6cc83'
      : '#9e8655';
  context.lineWidth = hovered ? 6 : 4;
  context.stroke();

  context.lineCap = 'round';
  context.lineWidth = 5;
  drawArcPair(context, 18);
  drawArcPair(context, 29);

  context.beginPath();
  context.arc(64, 64, 6, 0, Math.PI * 2);
  context.fillStyle = enabled ? '#ffe39a' : '#c3aa70';
  context.fill();

  if (progress > 0) {
    context.beginPath();
    context.arc(
      64,
      64,
      51,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * clamp(progress, 0, 1),
    );
    context.strokeStyle = '#fff0b4';
    context.lineWidth = 6;
    context.stroke();
  }

  texture.needsUpdate = true;
}

export class RadioBeacon {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.aircraftId = 'zero';
    this.cameraMode = 'first';
    this.progress = 0;
    this.elapsed = 0;
    this.cooldown = 0;
    this.worldPosition = new THREE.Vector3();
    this.gazeDirection = new THREE.Vector3();
    this.localGazeDirection = new THREE.Vector3();
    this.inverseBaseQuaternion = new THREE.Quaternion();

    this.sprite = makeSprite();
    this.sprite.name = 'skyline-zero-cockpit-radio-beacon';
    this.sprite.visible = false;
    scene.add(this.sprite);

    this.onAircraft = event => {
      this.aircraftId = event?.detail?.id || 'zero';
      if (!this.isAvailable()) this.forceOff();
      this.close();
    };

    this.onView = event => {
      this.cameraMode = event?.detail?.mode || 'first';
      if (!this.isAvailable()) this.forceOff();
      this.close();
    };

    this.onKeyDown = event => {
      if (
        event.repeat ||
        event.code !== 'KeyR' ||
        !this.isAvailable()
      ) {
        return;
      }
      this.toggle();
    };

    globalThis.window?.addEventListener?.('skyline:aircraft-changed', this.onAircraft);
    globalThis.window?.addEventListener?.('skyline:view-changed', this.onView);
    globalThis.window?.addEventListener?.('keydown', this.onKeyDown);
  }

  isAvailable() {
    return this.aircraftId === 'zero' && this.cameraMode === 'cockpit';
  }

  close() {
    this.sprite.visible = false;
    this.progress = 0;
    this.elapsed = 0;
    this.cooldown = Math.max(this.cooldown, 0.25);
  }

  forceOff() {
    if (!this.enabled) return false;
    this.enabled = false;
    globalThis.window?.dispatchEvent?.(
      new CustomEvent('skyline:radio-changed', {
        detail: { enabled: false },
      }),
    );
    return true;
  }

  toggle() {
    if (!this.isAvailable()) {
      this.forceOff();
      return false;
    }

    this.enabled = !this.enabled;
    this.elapsed = 0;
    this.progress = 0;
    this.cooldown = 0.75;
    globalThis.window?.dispatchEvent?.(
      new CustomEvent('skyline:radio-changed', {
        detail: { enabled: this.enabled },
      }),
    );
    return this.enabled;
  }

  update(
    dt,
    {
      active,
      camera,
      basePosition,
      baseQuaternion,
      aircraftId,
      cameraMode,
    },
  ) {
    const safeDt = clamp(Number(dt) || 0, 0, 0.1);
    this.cooldown = Math.max(0, this.cooldown - safeDt);

    if (aircraftId) this.aircraftId = aircraftId;
    if (cameraMode) this.cameraMode = cameraMode;

    if (!this.isAvailable()) {
      this.forceOff();
      this.sprite.visible = false;
      this.elapsed = 0;
      this.progress = 0;
      return;
    }

    if (!active || !camera || !basePosition || !baseQuaternion) {
      this.sprite.visible = false;
      this.elapsed = 0;
      this.progress = 0;
      return;
    }

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
    const pitch = Math.asin(
      clamp(this.localGazeDirection.y, -1, 1),
    );

    const hovered =
      Math.abs(yaw - RADIO_YAW) <= 6 * DEG &&
      Math.abs(pitch) <= 10 * DEG &&
      this.cooldown <= 0;

    this.elapsed = hovered
      ? this.elapsed + safeDt
      : Math.max(0, this.elapsed - safeDt * 2.4);
    this.progress = clamp(this.elapsed / DWELL, 0, 1);

    this.worldPosition.set(
      Math.sin(RADIO_YAW) * DISTANCE,
      0,
      -Math.cos(RADIO_YAW) * DISTANCE,
    );
    this.worldPosition.applyQuaternion(baseQuaternion).add(basePosition);
    this.sprite.position.copy(this.worldPosition);
    this.sprite.visible = true;
    draw(this.sprite, this.enabled, hovered, this.progress);

    if (this.elapsed >= DWELL) this.toggle();
  }

  dispose() {
    this.forceOff();
    this.close();
    globalThis.window?.removeEventListener?.('skyline:aircraft-changed', this.onAircraft);
    globalThis.window?.removeEventListener?.('skyline:view-changed', this.onView);
    globalThis.window?.removeEventListener?.('keydown', this.onKeyDown);
    this.scene.remove(this.sprite);
    this.sprite.material.dispose();
    this.sprite.userData.texture.dispose();
  }
}
