import * as THREE from '../vendor/three.module.min.js';

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: true,
  });
}

function createPeak({
  radius,
  height,
  x,
  y,
  z,
  color,
  segments,
}) {
  const peak =
    new THREE.Mesh(
      new THREE.ConeGeometry(
        radius,
        height,
        segments,
        3,
        false,
      ),
      createMaterial(color),
    );

  peak.position.set(
    x,
    y + height * 0.5,
    z,
  );

  peak.rotation.y =
    (
      x * 0.013 +
      z * 0.009
    ) %
    Math.PI;

  peak.frustumCulled = false;

  return peak;
}

// SKYLINE_RECOVERED_CROWN_MOUNTAIN
export class CrownMountainSystem {
  constructor(scene) {
    this.scene = scene;

    this.root =
      new THREE.Group();

    this.root.name =
      'crown-mountain-backdrop';

    this.root.add(
      createPeak({
        radius: 460,
        height: 1080,
        x: 0,
        y: -210,
        z: 0,
        color: 0x4f5960,
        segments: 8,
      }),

      createPeak({
        radius: 310,
        height: 820,
        x: -420,
        y: -205,
        z: 70,
        color: 0x626d73,
        segments: 7,
      }),

      createPeak({
        radius: 270,
        height: 760,
        x: 360,
        y: -210,
        z: 110,
        color: 0x485158,
        segments: 7,
      }),

      createPeak({
        radius: 180,
        height: 530,
        x: -680,
        y: -205,
        z: 180,
        color: 0x6c7476,
        segments: 6,
      }),

      createPeak({
        radius: 190,
        height: 560,
        x: 620,
        y: -205,
        z: 220,
        color: 0x59636a,
        segments: 6,
      }),
    );

    const snow =
      new THREE.Mesh(
        new THREE.ConeGeometry(
          190,
          300,
          8,
          1,
          true,
        ),

        createMaterial(
          0xd8dcde,
        ),
      );

    snow.position.set(
      0,
      480,
      0,
    );

    snow.rotation.y = 0.24;
    snow.frustumCulled = false;

    this.root.add(snow);
    this.scene.add(this.root);

    this.daylight = 1;

    this._timeListener =
      event => {
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
      };

    globalThis.window
      ?.addEventListener?.(
        'skyline:time-of-day',
        this._timeListener,
      );
  }

  update(dt, camera) {
    if (!camera) {
      return;
    }

    this.root.position.set(
      camera.position.x - 840,

      Math.max(
        -300,
        camera.position.y - 760,
      ),

      camera.position.z - 1160,
    );

    const brightness =
      0.30 +
      this.daylight * 0.70;

    this.root.traverse(
      object => {
        if (
          object.material?.color
        ) {
          object.material
            .color
            .multiplyScalar?.(1);
        }

        if (
          Number.isFinite(
            object.material
              ?.emissiveIntensity
          )
        ) {
          object.material
            .emissiveIntensity =
            0;
        }
      },
    );

    this.root.visible =
      brightness > 0.05;
  }

  dispose() {
    globalThis.window
      ?.removeEventListener?.(
        'skyline:time-of-day',
        this._timeListener,
      );

    this.scene?.remove(
      this.root,
    );

    this.root.traverse(
      object => {
        object.geometry
          ?.dispose?.();

        const materials =
          Array.isArray(
            object.material
          )
            ? object.material
            : object.material
              ? [object.material]
              : [];

        for (
          const material of
          materials
        ) {
          material.dispose?.();
        }
      },
    );
  }
}
