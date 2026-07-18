import {
  MATERIAL_SPECS,
  validateMaterialPolicy,
} from './materialPolicy.js';

function createMaterial(THREE, spec, name) {
  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
    emissive: spec.emissive,
    emissiveIntensity: spec.emissiveIntensity,
    transparent: Boolean(spec.transparent),
    opacity: spec.opacity ?? 1,
    depthWrite: spec.depthWrite ?? true,
    fog: true,
  });
  material.name = `world-detail-${name}`;
  material.userData.skylineSurface = spec.role;
  material.userData.skylineWorldDetailOwned = true;
  if (spec.transparent && 'forceSinglePass' in material) {
    material.forceSinglePass = true;
  }
  return material;
}

export class WorldDetailResourcePool {
  constructor(THREE) {
    if (!THREE) throw new TypeError('WorldDetailResourcePool requires THREE');
    const policy = validateMaterialPolicy();
    if (!policy.valid) {
      throw new Error(`Unsafe world-detail material policy: ${policy.violations.join(', ')}`);
    }
    this.THREE = THREE;
    this.geometries = new Map();
    this.materials = new Map();
    this.disposed = false;
  }

  geometry(name, factory) {
    if (this.disposed) throw new Error('World-detail resource pool is disposed');
    if (!this.geometries.has(name)) {
      const geometry = factory();
      geometry.name = `world-detail-${name}`;
      this.geometries.set(name, geometry);
    }
    return this.geometries.get(name);
  }

  material(name) {
    if (this.disposed) throw new Error('World-detail resource pool is disposed');
    if (!this.materials.has(name)) {
      const spec = MATERIAL_SPECS[name];
      if (!spec) throw new Error(`Unknown world-detail material ${name}`);
      this.materials.set(name, createMaterial(this.THREE, spec, name));
    }
    return this.materials.get(name);
  }

  status() {
    return Object.freeze({
      geometries: this.geometries.size,
      materials: this.materials.size,
      transparentMaterials: [...this.materials.values()].filter(item => item.transparent).length,
      sharedResources: true,
      disposed: this.disposed,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.geometries.values()) geometry.dispose?.();
    for (const material of this.materials.values()) material.dispose?.();
    this.geometries.clear();
    this.materials.clear();
  }
}
