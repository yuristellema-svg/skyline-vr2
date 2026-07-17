import * as THREE from '../vendor/three.module.min.js';

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1103515245 + 12345) >>> 0;
    return value / 4294967296;
  };
}

export class CitySilhouetteSystem {
  constructor(scene) {
    this.scene = scene;
    this.center = new THREE.Vector3(1020, 0, -480);
    this.root = new THREE.Group();
    this.root.name = 'distant-city-silhouette';
    this.root.position.copy(this.center);
    scene.add(this.root);

    const random = seeded(4519);
    const count = 84;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({
      color: 0x465354,
      transparent: true,
      opacity: 0.42,
      fog: true,
      depthWrite: true,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    for (let index = 0; index < count; index += 1) {
      const lane = index % 12;
      const row = Math.floor(index / 12);
      const width = 18 + random() * 34;
      const depth = 18 + random() * 34;
      const height = 30 + Math.pow(random(), 1.7) * 185;
      position.set(
        (lane - 5.5) * 58 + (random() - 0.5) * 22,
        height * 0.5 + 22,
        (row - 3) * 64 + (random() - 0.5) * 24,
      );
      scale.set(width, height, depth);
      matrix.compose(position, quaternion, scale);
      this.mesh.setMatrixAt(index, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.mesh);
  }

  update(_dt, flight) {
    if (!flight?.position) return;
    const distance = flight.position.distanceTo(this.center);
    this.root.visible = distance > 900 && distance < 7200;
    const fade = Math.max(0.12, Math.min(0.48, (distance - 900) / 2200));
    this.mesh.material.opacity = fade;
  }

  dispose() {
    this.scene?.remove(this.root);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
