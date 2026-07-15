import * as THREE from '../vendor/three.module.min.js';

function mountainMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: true,
  });
}

function createPeak(
  radius,
  height,
  x,
  y,
  z,
  color,
  segments = 7,
) {
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(
      radius,
      height,
      segments,
      3,
      false,
    ),
    mountainMaterial(color),
  );

  peak.position.set(
    x,
    y + height * 0.5,
    z,
  );

  peak.rotation.y =
    (x * 0.013 + z * 0.009) % Math.PI;

  peak.frustumCulled = false;

  return peak;
}

function createCloud(
  seed,
  radius,
  y,
  opacity,
) {
  const group = new THREE.Group();

  const cloudMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xe7edf0,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true,
    });

  for (let i = 0; i < 5; i += 1) {
    const variation =
      0.55 +
      ((seed + i * 17) % 20) / 100;

    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(
        radius * variation,
        7,
        5,
      ),
      cloudMaterial,
    );

    const angle = i * 1.23 + seed;

    puff.position.set(
      Math.cos(angle) * radius * 0.92,
      Math.sin(angle * 1.7) *
        radius *
        0.12,
      Math.sin(angle) * radius * 0.44,
    );

    puff.scale.y = 0.42;
    group.add(puff);
  }

  group.position.y = y;
  group.frustumCulled = false;

  return group;
}

export class SkyDecorSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;

    this.root = new THREE.Group();
    this.root.name =
      'safe-distant-sky-decor';

    scene.add(this.root);

    this.mountain = new THREE.Group();
    this.mountain.name =
      'crown-mountain-backdrop';

    this.mountain.add(
      createPeak(
        460,
        1080,
        0,
        -210,
        0,
        0x5e666a,
        8,
      ),
    );

    this.mountain.add(
      createPeak(
        310,
        820,
        -420,
        -205,
        70,
        0x697277,
        7,
      ),
    );

    this.mountain.add(
      createPeak(
        270,
        760,
        360,
        -210,
        110,
        0x555e62,
        7,
      ),
    );

    this.mountain.add(
      createPeak(
        180,
        530,
        -680,
        -205,
        180,
        0x737b7d,
        6,
      ),
    );

    this.mountain.add(
      createPeak(
        190,
        560,
        620,
        -205,
        220,
        0x636c70,
        6,
      ),
    );

    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(
        190,
        300,
        8,
        1,
        true,
      ),
      mountainMaterial(0xd8d8d3),
    );

    snow.position.set(0, 480, 0);
    snow.rotation.y = 0.24;
    snow.frustumCulled = false;

    this.mountain.add(snow);
    this.root.add(this.mountain);

    this.clouds = [
      createCloud(0.3, 110, 310, 0.24),
      createCloud(1.8, 145, 455, 0.18),
      createCloud(3.2, 90, 220, 0.2),
    ];

    this.clouds[0].position.x = -520;
    this.clouds[0].position.z = 160;

    this.clouds[1].position.x = 350;
    this.clouds[1].position.z = -80;

    this.clouds[2].position.x = 700;
    this.clouds[2].position.z = 250;

    for (const cloud of this.clouds) {
      this.root.add(cloud);
    }

    const sunMaterial =
      new THREE.SpriteMaterial({
        color: 0xffe7b2,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        fog: false,
      });

    this.sun = new THREE.Sprite(
      sunMaterial,
    );

    this.sun.scale.set(220, 220, 1);

    this.sun.position.set(
      570,
      520,
      -180,
    );

    this.sun.frustumCulled = false;
    this.root.add(this.sun);
  }

  update(dt, camera) {
    if (!camera) return;

    this.elapsed += Math.max(0, dt || 0);

    /*
     * This is a camera-relative backdrop.
     *
     * It is never inserted into:
     * - the terrain height sampler
     * - the world streamer
     * - collision checks
     * - chunk generation
     *
     * The mountain therefore cannot introduce
     * invisible collision walls or unloaded terrain.
     */
    this.root.position.set(
      camera.position.x - 840,
      Math.max(
        -300,
        camera.position.y - 760,
      ),
      camera.position.z - 1160,
    );

    this.clouds[0].position.x =
      -520 +
      Math.sin(this.elapsed * 0.006) * 55;

    this.clouds[1].position.x =
      350 +
      Math.sin(
        this.elapsed * 0.005 + 1.2,
      ) *
        75;

    this.clouds[2].position.x =
      700 +
      Math.sin(
        this.elapsed * 0.007 + 2.4,
      ) *
        45;
  }

  dispose() {
    this.scene?.remove(this.root);

    this.root.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (!object.material) return;

      const materials =
        Array.isArray(object.material)
          ? object.material
          : [object.material];

      for (const item of materials) {
        item.dispose();
      }
    });
  }
}
