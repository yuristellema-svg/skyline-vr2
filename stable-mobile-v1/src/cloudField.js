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
    color: 0xf2f0e8,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    fog: true,
  });

  const puffCount = 5 + Math.floor(random() * 4);
  for (let index = 0; index < puffCount; index += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(scale * (0.28 + random() * 0.22), 12, 8),
      material,
    );
    puff.position.set(
      (random() - 0.5) * scale * 1.55,
      (random() - 0.5) * scale * 0.20,
      (random() - 0.5) * scale * 0.72,
    );
    puff.scale.y = 0.48;
    group.add(puff);
  }

  return group;
}

export class CloudFieldSystem {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'world-space-cloud-field-v41';
    scene.add(this.root);

    const random = seeded(872102);
    this.clouds = [];
    for (let index = 0; index < 14; index += 1) {
      const cloud = createCloud(random, 80 + random() * 115);
      cloud.position.set(
        -3900 + random() * 7800,
        380 + random() * 650,
        -3900 + random() * 7800,
      );
      cloud.userData.drift = 1.4 + random() * 2.6;
      this.root.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(dt, flight) {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    const focusX = flight?.position?.x || 0;
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * safeDt;
      if (cloud.position.x - focusX > 4700) cloud.position.x -= 9200;
      if (focusX - cloud.position.x > 4700) cloud.position.x += 9200;
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
