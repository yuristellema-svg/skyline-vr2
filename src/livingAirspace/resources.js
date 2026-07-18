import * as THREE from '../../vendor/three.module.min.js';

export class LivingAirspaceResourcePool {
  constructor() {
    this.geometries = new Map();
    this.materials = new Map();
    this.disposed = false;
  }

  geometry(key, factory) {
    if (this.disposed) throw new Error('resource pool disposed');
    if (!this.geometries.has(key)) {
      this.geometries.set(key, factory());
    }
    return this.geometries.get(key);
  }

  material(key, factory) {
    if (this.disposed) throw new Error('resource pool disposed');
    if (!this.materials.has(key)) {
      this.materials.set(key, factory());
    }
    return this.materials.get(key);
  }

  birdGeometry() {
    return this.geometry('bird', () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([
            0, 0, -0.30,
            -0.65, 0, 0.16,
            0, 0.05, 0.05,
            0, 0, -0.30,
            0, 0.05, 0.05,
            0.65, 0, 0.16,
          ]),
          3,
        ),
      );
      geometry.computeVertexNormals();
      return geometry;
    });
  }

  cloudGeometry() {
    return this.geometry(
      'cloud-puff',
      () => new THREE.IcosahedronGeometry(1, 1),
    );
  }

  aircraftBodyGeometry() {
    return this.geometry(
      'traffic-body',
      () => {
        const geometry =
          new THREE.CylinderGeometry(0.28, 0.42, 4.8, 8);
        geometry.rotateX(Math.PI / 2);
        return geometry;
      },
    );
  }

  aircraftWingGeometry() {
    return this.geometry('traffic-wing', () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([
            0, 0, -0.65,
            -3.2, 0, 0.4,
            0, 0, 0.75,
            0, 0, -0.65,
            0, 0, 0.75,
            3.2, 0, 0.4,
          ]),
          3,
        ),
      );
      geometry.computeVertexNormals();
      return geometry;
    });
  }

  hazeGeometry() {
    return this.geometry(
      'haze-ring',
      () => new THREE.CylinderGeometry(
        1, 1, 1, 64, 1, true
      ),
    );
  }

  lambert(key, color, options = {}) {
    return this.material(
      `lambert:${key}`,
      () => new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
        fog: true,
        side: options.side ?? THREE.DoubleSide,
        transparent: Boolean(options.transparent),
        opacity: options.opacity ?? 1,
        depthWrite: options.depthWrite ?? true,
      }),
    );
  }

  basic(key, color, options = {}) {
    return this.material(
      `basic:${key}`,
      () => new THREE.MeshBasicMaterial({
        color,
        fog: true,
        transparent: Boolean(options.transparent),
        opacity: options.opacity ?? 1,
        depthWrite: options.depthWrite ?? false,
        side: options.side ?? THREE.DoubleSide,
        blending: options.blending ?? THREE.NormalBlending,
      }),
    );
  }

  line(key, color, options = {}) {
    return this.material(
      `line:${key}`,
      () => new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: options.opacity ?? 0.24,
        depthWrite: false,
        fog: true,
        blending: options.blending ?? THREE.NormalBlending,
      }),
    );
  }

  getStatus() {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.geometries.values()) {
      geometry.dispose?.();
    }
    for (const material of this.materials.values()) {
      material.dispose?.();
    }
    this.geometries.clear();
    this.materials.clear();
  }
}
