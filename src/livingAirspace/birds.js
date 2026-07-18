import * as THREE from '../../vendor/three.module.min.js';
import {
  hash01,
  safeSampleHeight,
} from './math.js';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const scratchPosition = new THREE.Vector3();
const scratchNext = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();
const scratchScale = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchMatrix = new THREE.Matrix4();

function allocateCounts(habitats, total) {
  const counts = habitats.map(habitat =>
    Math.max(2, Math.floor(total * habitat.countShare))
  );

  let assigned = counts.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (assigned < total) {
    counts[index % counts.length] += 1;
    assigned += 1;
    index += 1;
  }
  while (assigned > total) {
    const target = index % counts.length;
    if (counts[target] > 2) {
      counts[target] -= 1;
      assigned -= 1;
    }
    index += 1;
  }

  return counts;
}

export class BirdFlockSystem {
  constructor(scene, pool, catalog, options = {}) {
    this.scene = scene;
    this.pool = pool;
    this.catalog = catalog;
    this.sampleHeight = options.sampleHeight ?? null;
    this.elapsed = 0;
    this.updateCount = 0;
    this.root = new THREE.Group();
    this.root.name = 'Skyline living-airspace bird ecosystems';
    scene.add(this.root);

    this.materials = new Map();
    this.meshes = [];
    this.totalBirds = 0;
    this.currentProfileId = null;
  }

  _material(color) {
    const key = String(color);
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        this.pool.lambert(
          `bird-${key}`,
          color,
          { side: THREE.DoubleSide },
        ),
      );
    }
    return this.materials.get(key);
  }

  setProfile(profile) {
    if (this.currentProfileId === profile.id) return;
    this.currentProfileId = profile.id;

    for (const mesh of this.meshes) {
      this.root.remove(mesh);
    }
    this.meshes.length = 0;

    const counts =
      allocateCounts(
        this.catalog.birdHabitats,
        profile.birdCount,
      );

    this.totalBirds = 0;

    this.catalog.birdHabitats.forEach((habitat, habitatIndex) => {
      const count = counts[habitatIndex];
      const mesh = new THREE.InstancedMesh(
        this.pool.birdGeometry(),
        this._material(habitat.color),
        count,
      );

      mesh.name = `birds:${habitat.category}:${habitat.id}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = true;
      mesh.userData.habitat = habitat;
      mesh.userData.habitatIndex = habitatIndex;
      mesh.userData.count = count;
      this.root.add(mesh);
      this.meshes.push(mesh);
      this.totalBirds += count;
    });
  }

  update(dt, flight) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    this.elapsed += safeDt;
    this.updateCount += 1;

    const player = flight?.position?.isVector3
      ? flight.position
      : null;

    for (const mesh of this.meshes) {
      const habitat = mesh.userData.habitat;
      const habitatIndex = mesh.userData.habitatIndex;
      const count = mesh.userData.count;

      for (let index = 0; index < count; index += 1) {
        const phase =
          hash01(habitatIndex, index, 1) * Math.PI * 2;
        const radiusScale =
          0.38 + hash01(habitatIndex, index, 2) * 0.62;
        const angularSpeed =
          habitat.speed *
          (0.72 + hash01(habitatIndex, index, 3) * 0.56);
        const angle =
          phase + this.elapsed * angularSpeed * Math.PI * 2;

        const wobble =
          Math.sin(
            this.elapsed * (0.7 + index * 0.013) +
            phase * 1.7
          );

        scratchPosition.set(
          habitat.center[0] +
            Math.cos(angle) *
            habitat.radiusX *
            radiusScale,
          habitat.center[1],
          habitat.center[2] +
            Math.sin(angle * 0.93) *
            habitat.radiusZ *
            radiusScale,
        );

        const ground =
          safeSampleHeight(
            this.sampleHeight,
            scratchPosition.x,
            scratchPosition.z,
            habitat.center[1] - habitat.altitude[0],
          );

        const altitude =
          habitat.altitude[0] +
          (
            habitat.altitude[1] -
            habitat.altitude[0]
          ) *
          (
            0.35 +
            hash01(habitatIndex, index, 4) * 0.45 +
            wobble * 0.10
          );

        scratchPosition.y =
          Math.max(
            habitat.center[1],
            ground + altitude,
          );

        if (player) {
          const dx = scratchPosition.x - player.x;
          const dy = scratchPosition.y - player.y;
          const dz = scratchPosition.z - player.z;
          const distanceSq = dx * dx + dy * dy + dz * dz;

          if (distanceSq < 150 * 150) {
            const distance =
              Math.max(1, Math.sqrt(distanceSq));
            const strength =
              (150 - distance) / 150;
            scratchPosition.x +=
              dx / distance * strength * 90;
            scratchPosition.y +=
              18 + strength * 80;
            scratchPosition.z +=
              dz / distance * strength * 90;
          }
        }

        const nextAngle = angle + 0.018;
        scratchNext.set(
          habitat.center[0] +
            Math.cos(nextAngle) *
            habitat.radiusX *
            radiusScale,
          scratchPosition.y +
            Math.cos(this.elapsed + phase) * 0.4,
          habitat.center[2] +
            Math.sin(nextAngle * 0.93) *
            habitat.radiusZ *
            radiusScale,
        );

        scratchDirection
          .subVectors(scratchNext, scratchPosition)
          .normalize();

        scratchQuaternion
          .setFromUnitVectors(FORWARD, scratchDirection);

        const bank =
          Math.sin(angle * 1.8 + phase) * 0.42;
        scratchQuaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(
            scratchDirection,
            bank,
          ),
        );

        const flap =
          0.78 +
          Math.sin(
            this.elapsed * 7.2 +
            phase * 4
          ) * 0.18;

        const size =
          habitat.category === 'soaring-birds'
            ? 3.2
            : habitat.category === 'water-birds'
              ? 2.0
              : 1.45;

        scratchScale.set(
          size,
          size * flap,
          size,
        );

        scratchMatrix.compose(
          scratchPosition,
          scratchQuaternion,
          scratchScale,
        );
        mesh.setMatrixAt(index, scratchMatrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  getStatus() {
    return {
      totalBirds: this.totalBirds,
      habitatCount: this.meshes.length,
      updateCount: this.updateCount,
      categories:
        this.catalog.birdHabitats.map(item => item.category),
      drawCalls: this.meshes.length,
    };
  }

  dispose() {
    this.scene?.remove(this.root);
    this.meshes.length = 0;
    this.materials.clear();
  }
}
