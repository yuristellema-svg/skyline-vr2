import { clamp, distanceSquared, point3 } from './sharedMath.js';
import { normalizeQuality } from './qualityPolicy.js';

export const DEFAULT_FLOCKS = Object.freeze([
  Object.freeze({ center: [-2470, 165, 1780], radius: 230, count: 8, speed: 0.085 }),
  Object.freeze({ center: [2360, 280, 1430], radius: 280, count: 8, speed: -0.068 }),
  Object.freeze({ center: [860, 220, -840], radius: 190, count: 7, speed: 0.1 }),
]);

function totalBirds(flocks) {
  return flocks.reduce((sum, flock) => sum + Math.max(0, Math.floor(flock.count || 0)), 0);
}

function createBirdGeometry(THREE) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -2.4, 0, 0,
    0, 0.35, -0.18,
    0, 0, 0.3,
    0, 0, 0.3,
    0, 0.35, -0.18,
    2.4, 0, 0,
  ]), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class WildlifeSystem {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.THREE = options.THREE || null;
    this.flocks = options.flocks || DEFAULT_FLOCKS;
    this.maxBirds = totalBirds(this.flocks);
    this.quality = normalizeQuality(options.quality);
    this.exclusionRadius = Math.max(80, Number(options.exclusionRadius) || 260);
    this.elapsed = 0;
    this.accumulator = 0;
    this.updateCount = 0;
    this.disposed = false;
    this.snapshots = Array.from({ length: this.maxBirds }, () => ({ x: 0, y: 0, z: 0, active: false }));
    this.mesh = null;

    if (options.visuals !== false && this.scene && this.THREE) this._buildVisuals();
    this.setQuality(this.quality.id);
  }

  _buildVisuals() {
    const THREE = this.THREE;
    this.mesh = new THREE.InstancedMesh(
      createBirdGeometry(THREE),
      new THREE.MeshBasicMaterial({
        color: 0x1a2427,
        side: THREE.DoubleSide,
        fog: true,
      }),
      this.maxBirds,
    );
    this.mesh.name = 'Skyline worker distant bird flocks';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.tangent = new THREE.Vector3();
    this.scene.add(this.mesh);
  }

  setQuality(level) {
    this.quality = normalizeQuality(level);
    this.activeCount = Math.max(1, Math.floor(this.maxBirds * this.quality.birdFraction));
    if (this.mesh) this.mesh.count = this.activeCount;
  }

  update(dt, flight, _camera, phase = 'flying') {
    if (this.disposed) return;
    const safeDt = clamp(dt, 0, 0.1);
    if (phase === 'flying') this.elapsed += safeDt;
    this.accumulator += safeDt;
    const interval = 1 / Math.max(1, this.quality.wildlifeHz);
    if (this.accumulator < interval) return;
    this.accumulator %= interval;
    this.updateCount += 1;

    const player = flight?.position ? point3(flight.position) : null;
    let birdIndex = 0;
    for (let flockIndex = 0; flockIndex < this.flocks.length; flockIndex += 1) {
      const flock = this.flocks[flockIndex];
      for (let local = 0; local < flock.count; local += 1) {
        if (birdIndex >= this.activeCount) break;
        const phaseValue = this.elapsed * flock.speed + local * 0.72 + flockIndex * 1.4;
        const radius = flock.radius * (0.72 + (local % 4) * 0.075);
        const position = this.snapshots[birdIndex];
        position.x = flock.center[0] + Math.cos(phaseValue) * radius;
        position.y = flock.center[1] + Math.sin(phaseValue * 2.1 + local) * 18 + (local % 3) * 5;
        position.z = flock.center[2] + Math.sin(phaseValue) * radius * 0.7;
        position.active = !player || distanceSquared(player, position) >= this.exclusionRadius ** 2;

        if (this.mesh) {
          this.position.set(position.x, position.y, position.z);
          this.tangent.set(
            -Math.sin(phaseValue),
            Math.cos(phaseValue * 2.1 + local) * 0.08,
            Math.cos(phaseValue) * 0.7,
          ).normalize();
          this.quaternion.setFromUnitVectors(this.forward, this.tangent);
          const wingBeat = 0.86 + Math.sin(this.elapsed * 6.8 + local * 1.7) * 0.11;
          const size = position.active ? 0.7 + (local % 5) * 0.12 : 0.0001;
          this.scale.set(size, position.active ? wingBeat : 0.0001, size);
          this.matrix.compose(this.position, this.quaternion, this.scale);
          this.mesh.setMatrixAt(birdIndex, this.matrix);
        }
        birdIndex += 1;
      }
      if (birdIndex >= this.activeCount) break;
    }

    for (let index = birdIndex; index < this.snapshots.length; index += 1) {
      this.snapshots[index].active = false;
    }
    if (this.mesh) this.mesh.instanceMatrix.needsUpdate = true;
  }

  getStatus() {
    return {
      active: !this.disposed,
      instanced: true,
      collision: false,
      maxBirds: this.maxBirds,
      activeBirds: this.activeCount,
      exclusionRadius: this.exclusionRadius,
      updateHz: this.quality.wildlifeHz,
      updateCount: this.updateCount,
      quality: this.quality.id,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.mesh) {
      this.scene?.remove?.(this.mesh);
      this.mesh.geometry?.dispose?.();
      this.mesh.material?.dispose?.();
    }
    this.mesh = null;
  }
}
