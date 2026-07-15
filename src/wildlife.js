import * as THREE from '../vendor/three.module.min.js';

const FLOCKS = Object.freeze([
  Object.freeze({ center: [-2470, 165, 1780], radius: 230, count: 8, speed: 0.085 }),
  Object.freeze({ center: [2360, 280, 1430], radius: 280, count: 8, speed: -0.068 }),
  Object.freeze({ center: [860, 220, -840], radius: 190, count: 7, speed: 0.1 }),
]);

const GLIDER_PATHS = Object.freeze([
  Object.freeze({ center: [-2110, 310, 2110], radius: 420, speed: 0.035, phase: 0.3 }),
  Object.freeze({ center: [650, 340, -1050], radius: 350, speed: -0.043, phase: 1.9 }),
  Object.freeze({ center: [2850, 390, 900], radius: 500, speed: 0.028, phase: 3.4 }),
]);

function birdGeometry() {
  const vertices = new Float32Array([
    -2.4, 0, 0,
    0, 0.35, -0.18,
    0, 0, 0.3,

    0, 0, 0.3,
    0, 0.35, -0.18,
    2.4, 0, 0,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function gliderGeometry() {
  const vertices = new Float32Array([
    -5.4, 0, 0,
    0, 0.12, -1.1,
    0, 0, 1.6,

    0, 0, 1.6,
    0, 0.12, -1.1,
    5.4, 0, 0,

    -1.8, 0.02, 1.25,
    0, 0.12, 0.65,
    1.8, 0.02, 1.25,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class WildlifeSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;

    const birdCount = FLOCKS.reduce((sum, flock) => sum + flock.count, 0);

    this.birds = new THREE.InstancedMesh(
      birdGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0x1a2427,
        side: THREE.DoubleSide,
        fog: true,
      }),
      birdCount,
    );

    this.birds.name = 'distant-bird-flocks';
    this.birds.frustumCulled = false;
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.birds);

    this.gliders = new THREE.InstancedMesh(
      gliderGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xcbd9dc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        fog: true,
      }),
      GLIDER_PATHS.length,
    );

    this.gliders.name = 'distant-sailplanes';
    this.gliders.frustumCulled = false;
    this.gliders.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.gliders);

    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
  }

  update(dt) {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    this.elapsed += safeDt;

    let birdIndex = 0;
    for (let flockIndex = 0; flockIndex < FLOCKS.length; flockIndex += 1) {
      const flock = FLOCKS[flockIndex];

      for (let local = 0; local < flock.count; local += 1) {
        const phase = this.elapsed * flock.speed + local * 0.72 + flockIndex * 1.4;
        const radius = flock.radius * (0.72 + (local % 4) * 0.075);

        this.position.set(
          flock.center[0] + Math.cos(phase) * radius,
          flock.center[1] + Math.sin(phase * 2.1 + local) * 18 + (local % 3) * 5,
          flock.center[2] + Math.sin(phase) * radius * 0.7,
        );

        const tangent = new THREE.Vector3(
          -Math.sin(phase),
          Math.cos(phase * 2.1 + local) * 0.08,
          Math.cos(phase) * 0.7,
        ).normalize();

        this.quaternion.setFromUnitVectors(this.forward, tangent);
        const wingBeat = 0.86 + Math.sin(this.elapsed * 6.8 + local * 1.7) * 0.11;
        const size = 0.7 + (local % 5) * 0.12;
        this.scale.set(size, wingBeat, size);

        this.matrix.compose(this.position, this.quaternion, this.scale);
        this.birds.setMatrixAt(birdIndex, this.matrix);
        birdIndex += 1;
      }
    }

    for (let index = 0; index < GLIDER_PATHS.length; index += 1) {
      const path = GLIDER_PATHS[index];
      const phase = this.elapsed * path.speed + path.phase;

      this.position.set(
        path.center[0] + Math.cos(phase) * path.radius,
        path.center[1] + Math.sin(phase * 1.6) * 45,
        path.center[2] + Math.sin(phase) * path.radius * 0.72,
      );

      const tangent = new THREE.Vector3(
        -Math.sin(phase),
        Math.cos(phase * 1.6) * 0.08,
        Math.cos(phase) * 0.72,
      ).normalize();

      this.quaternion.setFromUnitVectors(this.forward, tangent);
      this.scale.setScalar(1 + index * 0.08);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.gliders.setMatrixAt(index, this.matrix);
    }

    this.birds.instanceMatrix.needsUpdate = true;
    this.gliders.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene?.remove(this.birds);
    this.scene?.remove(this.gliders);
    this.birds.geometry.dispose();
    this.birds.material.dispose();
    this.gliders.geometry.dispose();
    this.gliders.material.dispose();
  }
}
