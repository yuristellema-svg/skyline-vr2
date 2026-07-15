import * as THREE from '../vendor/three.module.min.js';

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createCloud(random, scale) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({
    color: 0xf1f0e8,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    fog: true,
  });

  const puffCount = 4 + Math.floor(random() * 4);
  for (let index = 0; index < puffCount; index += 1) {
    const puff = new THREE.Mesh(
      new THREE.IcosahedronGeometry(scale * (0.34 + random() * 0.24), 1),
      material,
    );
    puff.position.set(
      (random() - 0.5) * scale * 1.5,
      (random() - 0.5) * scale * 0.26,
      (random() - 0.5) * scale * 0.68,
    );
    puff.scale.y = 0.52;
    group.add(puff);
  }

  return group;
}

export class CloudFieldSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;
    this.root = new THREE.Group();
    this.root.name = 'world-space-cloud-field';
    scene.add(this.root);

    const random = seeded(872102);
    this.clouds = [];
    for (let index = 0; index < 18; index += 1) {
      const cloud = createCloud(random, 85 + random() * 120);
      cloud.position.set(
        -3900 + random() * 7800,
        330 + random() * 720,
        -3900 + random() * 7800,
      );
      cloud.userData.drift = 1.8 + random() * 3.4;
      this.root.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(dt, flight) {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    this.elapsed += safeDt;
    const focusX = flight?.position?.x || 0;

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * safeDt;
      if (cloud.position.x - focusX > 4600) cloud.position.x -= 9000;
      if (focusX - cloud.position.x > 4600) cloud.position.x += 9000;
    }
  }

  dispose() {
    this.scene?.remove(this.root);
    this.root.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
  }
}
