import { isCityNodeName } from './math.js';

function materialList(material) {
  if (Array.isArray(material)) return material;
  return material ? [material] : [];
}

function hasCityAncestor(object) {
  let node = object;

  while (node) {
    if (isCityNodeName(node.name)) return true;
    node = node.parent;
  }

  return false;
}

export class DistantCityVisibilitySystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.scanInterval = Math.max(0.25, Number(options.scanInterval) || 1.25);
    this.scanTimer = 0;
    this.trackedObjects = new Map();
    this.trackedMaterials = new Map();
    this._scan();
  }

  _trackObject(object) {
    if (this.trackedObjects.has(object)) return;

    this.trackedObjects.set(object, {
      frustumCulled: object.frustumCulled,
    });

    object.frustumCulled = false;
    object.computeBoundingSphere?.();

    for (const material of materialList(object.material)) {
      if (!this.trackedMaterials.has(material)) {
        this.trackedMaterials.set(material, {
          fog: material.fog,
        });
      }

      material.fog = false;
      material.needsUpdate = true;
    }
  }

  _scan() {
    this.scene.traverse(object => {
      if (!hasCityAncestor(object)) return;

      if (
        object.isMesh ||
        object.isInstancedMesh ||
        object.isLine ||
        object.isPoints
      ) {
        this._trackObject(object);
      }
    });
  }

  update(dt) {
    this.scanTimer -= Math.max(0, Number(dt) || 0);
    if (this.scanTimer > 0) return;

    this.scanTimer = this.scanInterval;
    this._scan();
  }

  dispose() {
    for (const [object, state] of this.trackedObjects) {
      object.frustumCulled = state.frustumCulled;
    }

    for (const [material, state] of this.trackedMaterials) {
      material.fog = state.fog;
      material.needsUpdate = true;
    }

    this.trackedObjects.clear();
    this.trackedMaterials.clear();
  }
}
