import * as THREE from '../../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const RADIO_YAW = 25 * DEG;
const DISTANCE = 1.62;
const DWELL = 1.1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 230;
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
  sprite.scale.set(0.48, 0.36, 1);
  sprite.renderOrder = 10020;
  sprite.userData.canvas = canvas;
  sprite.userData.context = context;
  sprite.userData.texture = texture;
  return sprite;
}

function draw(sprite, label, hovered, progress) {
  const { canvas, context, texture } = sprite.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const margin = 34;
  context.fillStyle = hovered ? 'rgba(25,23,16,0.98)' : 'rgba(15,16,14,0.90)';
  context.strokeStyle = hovered ? '#ffe3a0' : '#b9924f';
  context.lineWidth = hovered ? 8 : 5;
  context.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
  context.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
  if (progress > 0) {
    context.fillStyle = 'rgba(255,221,145,0.38)';
    context.fillRect(
      margin + 8,
      canvas.height - margin - 19,
      (canvas.width - margin * 2 - 16) * clamp(progress, 0, 1),
      10,
    );
  }
  context.font = 'bold 34px ui-monospace,Menlo,monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = hovered ? '#fff1bd' : '#d9bd80';
  context.fillText(label, canvas.width / 2, canvas.height / 2 - 2);
  texture.needsUpdate = true;
}

export class RadioBeacon {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.aircraftId = 'zero';
    this.progress = 0;
    this.elapsed = 0;
    this.cooldown = 0;
    this.worldPosition = new THREE.Vector3();
    this.gazeDirection = new THREE.Vector3();
    this.localGazeDirection = new THREE.Vector3();
    this.inverseBaseQuaternion = new THREE.Quaternion();

    this.sprite = makeSprite();
    this.sprite.name = 'skyline-zero-radio-beacon';
    this.sprite.visible = false;
    scene.add(this.sprite);

    this.onAircraft = event => {
      this.aircraftId = event?.detail?.id || 'zero';
      this.close();
    };
    this.onKeyDown = event => {
      if (event.repeat || event.code !== 'KeyR' || this.aircraftId !== 'zero') return;
      this.toggle();
    };
    globalThis.window?.addEventListener?.('skyline:aircraft-changed', this.onAircraft);
    globalThis.window?.addEventListener?.('keydown', this.onKeyDown);
  }

  close() {
    this.sprite.visible = false;
    this.progress = 0;
    this.elapsed = 0;
    this.cooldown = Math.max(this.cooldown, 0.35);
  }

  toggle() {
    if (this.aircraftId !== 'zero') return this.enabled;
    this.enabled = !this.enabled;
    this.elapsed = 0;
    this.progress = 0;
    this.cooldown = 0.85;
    globalThis.window?.dispatchEvent?.(
      new CustomEvent('skyline:radio-changed', {
        detail: { enabled: this.enabled },
      }),
    );
    return this.enabled;
  }

  update(dt, { active, camera, basePosition, baseQuaternion }) {
    const safeDt = clamp(Number(dt) || 0, 0, 0.1);
    this.cooldown = Math.max(0, this.cooldown - safeDt);
    if (!active || this.aircraftId !== 'zero' || !camera || !basePosition || !baseQuaternion) {
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

    const yaw = Math.atan2(this.localGazeDirection.x, -this.localGazeDirection.z);
    const pitch = Math.asin(clamp(this.localGazeDirection.y, -1, 1));
    const hovered =
      Math.abs(yaw - RADIO_YAW) <= 6 * DEG &&
      Math.abs(pitch) <= 13 * DEG &&
      this.cooldown <= 0;

    this.elapsed = hovered
      ? this.elapsed + safeDt
      : Math.max(0, this.elapsed - safeDt * 2.2);
    this.progress = clamp(this.elapsed / DWELL, 0, 1);

    this.worldPosition.set(
      Math.sin(RADIO_YAW) * DISTANCE,
      0,
      -Math.cos(RADIO_YAW) * DISTANCE,
    );
    this.worldPosition.applyQuaternion(baseQuaternion).add(basePosition);
    this.sprite.position.copy(this.worldPosition);
    this.sprite.visible = true;
    draw(this.sprite, `RADIO ${this.enabled ? 'ON' : 'OFF'}`, hovered, this.progress);

    if (this.elapsed >= DWELL) this.toggle();
  }

  dispose() {
    this.close();
    globalThis.window?.removeEventListener?.('skyline:aircraft-changed', this.onAircraft);
    globalThis.window?.removeEventListener?.('keydown', this.onKeyDown);
    this.scene.remove(this.sprite);
    this.sprite.material.dispose();
    this.sprite.userData.texture.dispose();
  }
}
