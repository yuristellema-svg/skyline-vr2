import * as THREE from '../../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const BEACON_YAW = 62 * DEG;
const DISTANCE = 1.72;
const BEACON_DWELL = 1.4;
const OPTION_DWELL = 0.80;
const OPEN_TIMEOUT = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function localPosition(yaw, y = 0) {
  return new THREE.Vector3(
    Math.sin(yaw) * DISTANCE,
    y,
    -Math.cos(yaw) * DISTANCE,
  );
}

function makeSprite(width = 360, height = 170) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
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
  sprite.renderOrder = 10020;
  sprite.userData.canvas = canvas;
  sprite.userData.context = context;
  sprite.userData.texture = texture;
  return sprite;
}

function draw(sprite, text, selected, progress, beacon = false) {
  const { canvas, context, texture } = sprite.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const margin = beacon ? 34 : 18;
  context.fillStyle = selected
    ? 'rgba(25,23,16,0.98)'
    : 'rgba(15,16,14,0.90)';
  context.strokeStyle = selected ? '#ffe3a0' : '#b9924f';
  context.lineWidth = selected ? 8 : 5;
  context.fillRect(
    margin,
    margin,
    canvas.width - margin * 2,
    canvas.height - margin * 2,
  );
  context.strokeRect(
    margin,
    margin,
    canvas.width - margin * 2,
    canvas.height - margin * 2,
  );
  if (progress > 0) {
    context.fillStyle = 'rgba(255,221,145,0.38)';
    context.fillRect(
      margin + 8,
      canvas.height - margin - 19,
      (canvas.width - margin * 2 - 16) * clamp(progress, 0, 1),
      10,
    );
  }
  context.font = beacon
    ? 'bold 38px ui-monospace,Menlo,monospace'
    : 'bold 30px ui-monospace,Menlo,monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = selected ? '#fff1bd' : '#d9bd80';
  context.fillText(text, canvas.width / 2, canvas.height / 2 - 2);
  texture.needsUpdate = true;
}

export class PowerStrip {
  constructor(scene, powerControl) {
    this.scene = scene;
    this.powerControl = powerControl;
    this.open = false;
    this.progress = 0;
    this.openElapsed = 0;
    this.beaconElapsed = 0;
    this.optionElapsed = 0;
    this.optionIndex = -1;
    this.anchorYaw = 0;
    this.cooldown = 0;
    this.worldPosition = new THREE.Vector3();
    this.gazeDirection = new THREE.Vector3();
    this.localGazeDirection = new THREE.Vector3();
    this.inverseBaseQuaternion = new THREE.Quaternion();

    this.beacon = makeSprite(300, 230);
    this.beacon.name = 'skyline-power-beacon';
    this.beacon.scale.set(0.48, 0.36, 1);
    this.beacon.visible = false;
    scene.add(this.beacon);

    this.optionSprites = [];
    this.rebuildOptions();
    this.onAircraft = () => this.rebuildOptions();
    globalThis.window?.addEventListener?.(
      'skyline:aircraft-changed',
      this.onAircraft,
    );
  }

  get isOpen() {
    return this.open;
  }

  rebuildOptions() {
    for (const sprite of this.optionSprites) {
      this.scene.remove(sprite);
      sprite.material.dispose();
      sprite.userData.texture.dispose();
    }
    this.optionSprites = this.powerControl.options.map(option => {
      const sprite = makeSprite();
      sprite.name = `skyline-power-${option.id}`;
      sprite.scale.set(0.62, 0.29, 1);
      sprite.visible = false;
      this.scene.add(sprite);
      return sprite;
    });
  }

  localGaze(camera, baseQuaternion) {
    camera.getWorldDirection(this.gazeDirection);
    this.inverseBaseQuaternion.copy(baseQuaternion).invert();
    this.localGazeDirection
      .copy(this.gazeDirection)
      .applyQuaternion(this.inverseBaseQuaternion)
      .normalize();
    return {
      yaw: Math.atan2(
        this.localGazeDirection.x,
        -this.localGazeDirection.z,
      ),
      pitch: Math.asin(
        clamp(this.localGazeDirection.y, -1, 1),
      ),
    };
  }

  positionSprite(sprite, yaw, basePosition, baseQuaternion) {
    this.worldPosition
      .copy(localPosition(yaw))
      .applyQuaternion(baseQuaternion)
      .add(basePosition);
    sprite.position.copy(this.worldPosition);
  }

  close() {
    this.open = false;
    this.progress = 0;
    this.openElapsed = 0;
    this.beaconElapsed = 0;
    this.optionElapsed = 0;
    this.optionIndex = -1;
    this.cooldown = 0.85;
    this.powerControl.setInteractionActive(false);
    for (const sprite of this.optionSprites) sprite.visible = false;
  }

  update(
    dt,
    {
      active,
      camera,
      basePosition,
      baseQuaternion,
      grounded = false,
    },
  ) {
    const safeDt = clamp(Number(dt) || 0, 0, 0.1);
    this.cooldown = Math.max(0, this.cooldown - safeDt);

    if (!active || !camera || !basePosition || !baseQuaternion) {
      this.beacon.visible = false;
      this.close();
      return;
    }

    const gaze = this.localGaze(camera, baseQuaternion);

    if (!this.open) {
      for (const sprite of this.optionSprites) sprite.visible = false;
      this.beacon.visible = true;
      this.positionSprite(
        this.beacon,
        BEACON_YAW,
        basePosition,
        baseQuaternion,
      );
      const hovered =
        Math.abs(gaze.yaw - BEACON_YAW) <= 4.5 * DEG &&
        Math.abs(gaze.pitch) <= 10 * DEG &&
        this.cooldown <= 0;
      this.beaconElapsed = hovered
        ? this.beaconElapsed + safeDt
        : Math.max(0, this.beaconElapsed - safeDt * 2.2);
      this.progress = clamp(this.beaconElapsed / BEACON_DWELL, 0, 1);
      const beaconLabel =
        this.powerControl.isGlider
          ? `SPOILERS ${this.powerControl.state.label}`
          : `PWR ${this.powerControl.state.label}`;

      draw(
        this.beacon,
        beaconLabel,
        hovered,
        this.progress,
        true,
      );
      if (this.beaconElapsed >= BEACON_DWELL) {
        this.open = true;
        this.anchorYaw =
          this.powerControl.isGlider
            ? 14 * DEG
            : 12 * DEG;
        this.openElapsed = 0;
        this.beaconElapsed = 0;
        this.progress = 0;
        this.beacon.visible = false;
        this.powerControl.setInteractionActive(true);
      }
      return;
    }

    this.beacon.visible = false;
    this.openElapsed += safeDt;
    if (this.openElapsed >= OPEN_TIMEOUT) {
      this.close();
      return;
    }

    const count = this.optionSprites.length;
    const spacing =
      count === 3
        ? 17 * DEG
        : 14 * DEG;
    const start = this.anchorYaw - spacing * (count - 1) / 2;
    let candidate = -1;
    let best = Infinity;

    for (let index = 0; index < count; index += 1) {
      const optionYaw = start + spacing * index;
      const difference = Math.abs(gaze.yaw - optionYaw);
      if (difference < best && difference <= 7 * DEG) {
        candidate = index;
        best = difference;
      }
    }
    if (Math.abs(gaze.pitch) > 20 * DEG) candidate = -1;

    if (candidate === this.optionIndex && candidate >= 0) {
      this.optionElapsed += safeDt;
    } else {
      this.optionIndex = candidate;
      this.optionElapsed = 0;
    }

    this.progress = candidate >= 0
      ? clamp(this.optionElapsed / OPTION_DWELL, 0, 1)
      : 0;

    for (let index = 0; index < count; index += 1) {
      const sprite = this.optionSprites[index];
      const optionYaw = start + spacing * index;
      sprite.visible = true;
      this.positionSprite(
        sprite,
        optionYaw,
        basePosition,
        baseQuaternion,
      );
      const option =
        this.powerControl.options[index];

      const label =
        grounded &&
        !this.powerControl.isGlider &&
        option.id === 'off'
          ? 'OFF / BRAKE'
          : option.label;

      const selected =
        index === candidate ||
        (
          candidate < 0 &&
          index === this.powerControl.index
        );

      draw(
        sprite,
        label,
        selected,
        index === candidate
          ? this.progress
          : 0,
      );
    }

    if (candidate >= 0 && this.optionElapsed >= OPTION_DWELL) {
      this.powerControl.setIndex(candidate);
      this.close();
    }
  }

  dispose() {
    this.close();
    globalThis.window?.removeEventListener?.(
      'skyline:aircraft-changed',
      this.onAircraft,
    );
    for (const sprite of [this.beacon, ...this.optionSprites]) {
      this.scene.remove(sprite);
      sprite.material.dispose();
      sprite.userData.texture.dispose();
    }
  }
}
