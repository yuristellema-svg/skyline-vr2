import * as THREE from '../../vendor/three.module.min.js';

function makeMaterial(
  color,
  emissive = 0x000000,
  intensity = 0,
) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,

    emissiveIntensity:
      intensity,

    roughness: 0.62,
    metalness: 0.16,
  });
}

export class CockpitPowerFeedback {
  constructor(scene) {
    this.scene = scene;

    this.root =
      new THREE.Group();

    this.root.name =
      'skyline-cockpit-power-lever';

    this.root.visible = false;

    this.panel =
      new THREE.Group();

    this.panel.position.set(
      0.68,
      -0.28,
      -0.82,
    );

    this.root.add(
      this.panel,
    );

    const base =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.30,
          0.13,
          0.38,
        ),
        makeMaterial(
          0x272a28,
        ),
      );

    this.panel.add(base);

    this.arm =
      new THREE.Group();

    this.arm.position.set(
      0,
      0.07,
      0,
    );

    const shaft =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.035,
          0.045,
          0.42,
          10,
        ),
        makeMaterial(
          0x9f3731,
        ),
      );

    shaft.position.y =
      0.21;

    this.arm.add(shaft);

    this.knob =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.09,
          12,
          8,
        ),
        makeMaterial(
          0xc64137,
          0x250502,
          0.14,
        ),
      );

    this.knob.position.y =
      0.46;

    this.arm.add(
      this.knob,
    );

    this.panel.add(
      this.arm,
    );

    this.lamps = [];

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      const lamp =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.035,
            8,
            6,
          ),
          makeMaterial(
            0x24231f,
          ),
        );

      lamp.position.set(
        -0.105 +
          index * 0.07,
        0.10,
        0.15,
      );

      this.panel.add(lamp);
      this.lamps.push(lamp);
    }

    scene.add(this.root);
  }

  update({
    visible,
    position,
    quaternion,
    powerState,
    aircraftId,
  }) {
    this.root.visible =
      Boolean(visible);

    if (!this.root.visible) {
      return;
    }

    if (position?.isVector3) {
      this.root.position.copy(
        position,
      );
    }

    if (quaternion?.isQuaternion) {
      this.root.quaternion.copy(
        quaternion,
      );
    }

    const glider =
      aircraftId === 'glider';

    const amount =
      glider
        ? Number(
            powerState?.airbrake,
          ) || 0
        : Number(
            powerState?.throttle,
          ) || 0;

    const controlAmount =
      Math.max(
        0,
        Math.min(
          1,
          amount,
        ),
      );

    this.arm.rotation.x =
      0.62 -
      controlAmount *
        1.18;

    this.knob.material
      .color
      .setHex(
        glider
          ? 0xd0a740
          : 0xc64137,
      );

    const activeIndex =
      Math.max(
        0,
        Math.min(
          glider
            ? 2
            : 3,

          Number(
            powerState?.index,
          ) || 0,
        ),
      );

    this.lamps.forEach(
      (lamp, index) => {
        const enabled =
          !glider ||
          index < 3;

        lamp.visible =
          enabled;

        const active =
          enabled &&
          index ===
            activeIndex;

        lamp.material
          .color
          .setHex(
            active
              ? 0xffd878
              : 0x24231f,
          );

        lamp.material
          .emissive
          .setHex(
            active
              ? 0x8a4a07
              : 0x000000,
          );

        lamp.material
          .emissiveIntensity =
            active
              ? 1.1
              : 0;
      },
    );
  }

  dispose() {
    this.scene.remove(
      this.root,
    );

    this.root.traverse(
      object => {
        object.geometry
          ?.dispose?.();

        object.material
          ?.dispose?.();
      },
    );
  }
}
