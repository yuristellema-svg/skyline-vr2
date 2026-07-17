import * as THREE from '../../vendor/three.module.min.js';
import { advanceWorldPosition } from './math.js';

function seeded(seed) {
  let value = seed >>> 0;

  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  const puffs = [
    [58, 72, 44],
    [96, 53, 56],
    [142, 61, 51],
    [184, 76, 39],
    [119, 83, 61],
  ];

  for (const [x, y, radius] of puffs) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,250,0.86)');
    gradient.addColorStop(0.55, 'rgba(244,246,240,0.48)');
    gradient.addColorStop(1, 'rgba(232,238,234,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

// SKYLINE_BUNDLE_B_CLOUD_LIGHTING
export class WorldSpaceCloudSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.elapsed = 0;
    this.daylight = 1;
    this.twilight = 0;

    this._timeListener = event => {
      this.daylight =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              event?.detail?.daylight
            ) || 0,
          ),
        );

      this.twilight =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              event?.detail?.twilight
            ) || 0,
          ),
        );
    };

    globalThis.window
      ?.addEventListener?.(
        'skyline:time-of-day',
        this._timeListener,
      );
    this.bounds = {
      minX: Number(options.minX) || -5200,
      maxX: Number(options.maxX) || 5200,
      minZ: Number(options.minZ) || -5200,
      maxZ: Number(options.maxZ) || 5200,
    };
    this.wind = new THREE.Vector3(
      Number(options.windX) || 2.8,
      0,
      Number(options.windZ) || 0.65,
    );

    this.root = new THREE.Group();
    this.root.name = 'Fixed world-space cloud field';
    scene.add(this.root);

    this.texture = createCloudTexture();
    this.materials = [];

    const random = seeded(Number(options.seed) || 817203);
    const count = Math.max(6, Math.floor(Number(options.count) || 14));
    this.clouds = [];

    for (let index = 0; index < count; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.texture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        fog: true,
      });
      const sprite = new THREE.Sprite(material);
      this.materials.push(material);
      const width = 150 + random() * 250;
      const height = width * (0.28 + random() * 0.12);

      sprite.position.set(
        this.bounds.minX + random() * (this.bounds.maxX - this.bounds.minX),
        360 + random() * 760,
        this.bounds.minZ + random() * (this.bounds.maxZ - this.bounds.minZ),
      );
      sprite.scale.set(width, height, 1);
      sprite.userData.phase = random() * Math.PI * 2;
      sprite.userData.opacityScale = 0.72 + random() * 0.28;
      sprite.frustumCulled = false;
      this.root.add(sprite);
      this.clouds.push(sprite);
    }
  }

  update(dt) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    this.elapsed += safeDt;

    for (const cloud of this.clouds) {
      const next = advanceWorldPosition(
        cloud.position,
        this.wind,
        safeDt,
        this.bounds,
      );

      cloud.position.set(next.x, next.y, next.z);
      const night =
        1 -
        this.daylight;

      const baseOpacity =
        (
          0.44 +
          Math.sin(
            this.elapsed *
              0.12 +
            cloud.userData.phase
          ) *
            0.04
        ) *
        cloud.userData
          .opacityScale;

      cloud.material.opacity =
        baseOpacity *
        (
          1 -
          night * 0.30
        );

      cloud.material.color
        .setRGB(
          1 -
            night * 0.50 +
            this.twilight * 0.08,

          1 -
            night * 0.46 -
            this.twilight * 0.05,

          1 -
            night * 0.34 -
            this.twilight * 0.12,
        );
    }
  }

  dispose() {
    globalThis.window
      ?.removeEventListener?.(
        'skyline:time-of-day',
        this._timeListener,
      );

    this.scene?.remove(this.root);
    this.texture.dispose();
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
  }
}
