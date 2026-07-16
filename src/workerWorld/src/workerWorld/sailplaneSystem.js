import { clamp, point3, sampleEllipticalRoute } from './sharedMath.js';
import { normalizeQuality } from './qualityPolicy.js';

export const DEFAULT_SAILPLANE_ROUTES = Object.freeze([
  Object.freeze({ id: 'lake-glider', center: [-2110, 310, 2110], radiusX: 420, radiusZ: 302, angularSpeed: 0.035, phase: 0.3, verticalAmplitude: 45, aircraftId: 'skyline-glider' }),
  Object.freeze({ id: 'city-glider', center: [650, 340, -1050], radiusX: 350, radiusZ: 252, angularSpeed: -0.043, phase: 1.9, verticalAmplitude: 38, aircraftId: 'skyline-glider' }),
  Object.freeze({ id: 'ridge-glider', center: [2850, 390, 900], radiusX: 500, radiusZ: 360, angularSpeed: 0.028, phase: 3.4, verticalAmplitude: 52, aircraftId: 'skyline-glider' }),
]);

function createGeometry(THREE) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -5.4, 0, 0,
    0, 0.12, -1.1,
    0, 0, 1.6,
    0, 0, 1.6,
    0, 0.12, -1.1,
    5.4, 0, 0,
    -1.8, 0.02, 1.25,
    0, 0.12, 0.65,
    1.8, 0.02, 1.25,
  ]), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class SailplaneSystem {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.THREE = options.THREE || null;
    this.routes = options.routes || DEFAULT_SAILPLANE_ROUTES;
    this.quality = normalizeQuality(options.quality);
    this.elapsed = 0;
    this.accumulator = 0;
    this.updateCount = 0;
    this.disposed = false;
    this.snapshots = this.routes.map(route => ({
      id: route.id,
      position: point3(route.center),
      velocity: { x: 0, y: 0, z: 0 },
      active: false,
    }));
    this.mesh = null;
    if (options.visuals !== false && this.scene && this.THREE) this._buildVisuals();
    this.setQuality(this.quality.id);
  }

  _buildVisuals() {
    const THREE = this.THREE;
    this.mesh = new THREE.InstancedMesh(
      createGeometry(THREE),
      new THREE.MeshLambertMaterial({
        color: 0xcbd9dc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.68,
        fog: true,
      }),
      this.routes.length,
    );
    this.mesh.name = 'Skyline worker distant sailplanes';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.forward = new THREE.Vector3(0, 0, -1);
    this.scene.add(this.mesh);
  }

  setQuality(level) {
    this.quality = normalizeQuality(level);
    this.activeCount = Math.min(this.routes.length, this.quality.sailplaneCount);
    if (this.mesh) this.mesh.count = this.activeCount;
    this.snapshots.forEach((snapshot, index) => {
      snapshot.active = index < this.activeCount;
    });
  }

  update(dt, _flight, _camera, phase = 'flying') {
    if (this.disposed) return;
    const safeDt = clamp(dt, 0, 0.1);
    if (phase === 'flying') this.elapsed += safeDt;
    this.accumulator += safeDt;
    const interval = 1 / Math.max(1, this.quality.sailplaneHz);
    if (this.accumulator < interval) return;
    this.accumulator %= interval;
    this.updateCount += 1;

    for (let index = 0; index < this.activeCount; index += 1) {
      const route = this.routes[index];
      const sample = sampleEllipticalRoute(route, this.elapsed);
      const snapshot = this.snapshots[index];
      snapshot.position = sample.position;
      snapshot.velocity = sample.velocity;
      snapshot.active = true;
      if (this.mesh) {
        this.position.set(sample.position.x, sample.position.y, sample.position.z);
        this.velocity.set(sample.velocity.x, sample.velocity.y, sample.velocity.z);
        if (this.velocity.lengthSq() > 1e-8) {
          this.velocity.normalize();
          this.quaternion.setFromUnitVectors(this.forward, this.velocity);
        }
        this.scale.setScalar(1 + index * 0.08);
        this.matrix.compose(this.position, this.quaternion, this.scale);
        this.mesh.setMatrixAt(index, this.matrix);
      }
    }
    if (this.mesh) this.mesh.instanceMatrix.needsUpdate = true;
  }

  getPathSnapshots() {
    return this.snapshots.map(snapshot => ({
      id: snapshot.id,
      position: { ...snapshot.position },
      velocity: { ...snapshot.velocity },
      active: snapshot.active,
    }));
  }

  getStatus() {
    return {
      active: !this.disposed,
      instanced: true,
      collision: false,
      routeCount: this.routes.length,
      activeCount: this.activeCount,
      updateHz: this.quality.sailplaneHz,
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
