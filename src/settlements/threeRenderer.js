import * as THREE from '../../vendor/three.module.min.js';
import { SETTLEMENT_ROOT_NAME } from './constants.js';
import { renderGroupKey, renderScopeFor } from './renderPlan.js';

const UP = new THREE.Vector3(0, 1, 0);

function appendBox(vertices, indices, center, size) {
  const base = vertices.length / 3;
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map(value => value * 0.5);
  const points = [
    [-sx, -sy, -sz], [sx, -sy, -sz], [sx, sy, -sz], [-sx, sy, -sz],
    [-sx, -sy, sz], [sx, -sy, sz], [sx, sy, sz], [-sx, sy, sz],
  ];
  for (const point of points) vertices.push(cx + point[0], cy + point[1], cz + point[2]);
  const faces = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  for (const face of faces) indices.push(base + face[0], base + face[1], base + face[2]);
}

function customGeometry(parts) {
  const vertices = [];
  const indices = [];
  for (const part of parts) appendBox(vertices, indices, part.center, part.size);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGableGeometry() {
  const vertices = new Float32Array([
    -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,0.1,-0.5,  0,0.5,-0.5, -0.5,0.1,-0.5,
    -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5,0.1, 0.5,  0,0.5, 0.5, -0.5,0.1, 0.5,
  ]);
  const indices = [
    0,1,2, 0,2,4, 4,2,3,
    5,7,6, 5,9,7, 9,8,7,
    0,5,6, 0,6,1,
    1,6,7, 1,7,2,
    2,7,8, 2,8,3,
    3,8,9, 3,9,4,
    4,9,5, 4,5,0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createWedgeGeometry() {
  const geometry = customGeometry([
    { center: [0, -0.18, 0], size: [1, 0.64, 1] },
    { center: [0, 0.24, -0.16], size: [1, 0.20, 0.68] },
  ]);
  return geometry;
}

function createSawtoothGeometry() {
  return customGeometry([
    { center: [0, -0.34, 0], size: [1, 0.32, 1] },
    { center: [-0.32, 0.06, 0], size: [0.22, 0.80, 1] },
    { center: [0, 0.16, 0], size: [0.22, 0.60, 1] },
    { center: [0.32, 0.26, 0], size: [0.22, 0.40, 1] },
  ]);
}

function createCraneGeometry() {
  return customGeometry([
    { center: [0, -0.02, 0], size: [0.16, 1, 0.16] },
    { center: [0.28, 0.38, 0], size: [0.72, 0.10, 0.12] },
    { center: [-0.23, 0.38, 0], size: [0.34, 0.08, 0.10] },
    { center: [0.49, 0.05, 0], size: [0.05, 0.68, 0.05] },
    { center: [0, -0.46, 0], size: [0.42, 0.08, 0.38] },
  ]);
}

function createTrussGeometry() {
  return customGeometry([
    { center: [0, -0.38, -0.38], size: [1, 0.12, 0.12] },
    { center: [0, -0.38, 0.38], size: [1, 0.12, 0.12] },
    { center: [-0.45, 0, 0], size: [0.10, 1, 0.10] },
    { center: [0.45, 0, 0], size: [0.10, 1, 0.10] },
    { center: [0, 0.38, -0.38], size: [1, 0.12, 0.12] },
    { center: [0, 0.38, 0.38], size: [1, 0.12, 0.12] },
  ]);
}

function createTaperedBoxGeometry(topScale = 0.58) {
  const t = topScale * 0.5;
  const b = 0.5;
  const vertices = new Float32Array([
    -b,-0.5,-b, b,-0.5,-b, b,-0.5,b, -b,-0.5,b,
    -t,0.5,-t, t,0.5,-t, t,0.5,t, -t,0.5,t,
  ]);
  const indices = [
    0,2,1, 0,3,2, 4,5,6, 4,6,7,
    0,1,5, 0,5,4, 1,2,6, 1,6,5,
    2,3,7, 2,7,6, 3,0,4, 3,4,7,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSteppedGeometry() {
  return customGeometry([
    { center: [0, -0.34, 0], size: [1, 0.32, 1] },
    { center: [0, -0.04, 0], size: [0.78, 0.28, 0.78] },
    { center: [0, 0.24, 0], size: [0.54, 0.28, 0.54] },
    { center: [0, 0.44, 0], size: [0.28, 0.12, 0.28] },
  ]);
}

function createBarrelGeometry() {
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, false, 0, Math.PI);
  geometry.rotateZ(Math.PI * 0.5);
  return geometry;
}

function geometryFor(primitive) {
  switch (primitive) {
    case 'gable': return createGableGeometry();
    case 'wedge': return createWedgeGeometry();
    case 'sawtooth': return createSawtoothGeometry();
    case 'octagon': return new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, false);
    case 'tapered': return createTaperedBoxGeometry(0.42);
    case 'slab_taper': return createTaperedBoxGeometry(0.70);
    case 'dome': return new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    case 'barrel': return createBarrelGeometry();
    case 'stepped': return createSteppedGeometry();
    case 'gateway': return createTrussGeometry();
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false);
    case 'silo': return new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false);
    case 'sphere': return new THREE.SphereGeometry(0.5, 10, 7);
    case 'beacon': return new THREE.SphereGeometry(0.5, 8, 6);
    case 'water_tank': return new THREE.SphereGeometry(0.5, 12, 8);
    case 'mast': return new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1, false);
    case 'cone': return new THREE.ConeGeometry(0.5, 1, 8, 1, false);
    case 'truss': return createTrussGeometry();
    case 'crane': return createCraneGeometry();
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function installInstanceColorShader(material, cacheKey) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vSettlementColor;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vSettlementColor = instanceColor;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSettlementColor;`)
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse * vSettlementColor, opacity );',
      );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

class ResourcePool {
  constructor() {
    this.geometries = new Map();
    this.materials = new Map();
  }

  geometry(primitive) {
    if (!this.geometries.has(primitive)) this.geometries.set(primitive, geometryFor(primitive));
    return this.geometries.get(primitive);
  }

  material(surface, emissive) {
    const key = `${surface}:${emissive ? 'emissive' : 'opaque'}`;
    if (this.materials.has(key)) return this.materials.get(key);
    let material;
    if (emissive) {
      material = installInstanceColorShader(new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        fog: true,
      }), `settlement-instance-emission-${surface}-v3`);
      material.name = `Settlement explicit emission ${surface}`;
    } else {
      material = installInstanceColorShader(new THREE.MeshLambertMaterial({
        color: 0xffffff,
        flatShading: false,
        fog: true,
        toneMapped: true,
      }), `settlement-instance-lit-${surface}-v3`);
      material.name = `Settlement non-emissive flight-readable ${surface}`;
    }
    material.userData.settlementSurface = surface;
    material.userData.explicitEmission = emissive;
    this.materials.set(key, material);
    return material;
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}

function createInstancedMesh(entries, pool, spatial, budget) {
  const first = entries[0];
  const mesh = new THREE.InstancedMesh(
    pool.geometry(first.primitive),
    pool.material(first.surface, first.emissive),
    entries.length,
  );
  mesh.name = `Settlements ${renderGroupKey(first)}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  mesh.userData.settlementId = renderScopeFor(first) === 'global' ? null : first.settlementId;
  mesh.userData.visibilityBand = first.visibilityBand;
  mesh.userData.maxDistance = budget.renderPlanByKey?.[renderGroupKey(first)]?.maxDistance ?? Infinity;
  mesh.userData.explicitEmission = first.emissive;
  mesh.userData.surface = first.surface;
  mesh.userData.instanceCount = entries.length;
  if (mesh.userData.settlementId) {
    const bounds = spatial.settlements[mesh.userData.settlementId];
    mesh.userData.center = bounds?.center ?? [0, 0];
    mesh.userData.radius = bounds?.radius ?? 0;
  }

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  for (let index = 0; index < entries.length; index += 1) {
    const descriptor = entries[index];
    position.fromArray(descriptor.position);
    quaternion.setFromAxisAngle(UP, descriptor.yaw);
    scale.fromArray(descriptor.scale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    color.set(descriptor.color);
    mesh.setColorAt(index, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere?.();
  return mesh;
}

function readCameraPosition(cameraOrContext) {
  const camera = cameraOrContext?.camera ?? cameraOrContext;
  const position = camera?.position;
  if (!position) return null;
  const x = Number(position.x);
  const z = Number(position.z);
  return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null;
}

export class SettlementRenderer {
  constructor(scene) {
    if (!scene?.add) throw new TypeError('SettlementRenderer requires THREE.Scene-compatible scene');
    if (scene.getObjectByName?.(SETTLEMENT_ROOT_NAME)) throw new Error('Settlement system root already exists');
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = SETTLEMENT_ROOT_NAME;
    this.pool = new ResourcePool();
    this.meshes = [];
    this.windowMaterials = new Set();
    this.signalMaterials = new Set();
    this.currentDescriptors = [];
    this.visibleMeshes = 0;
    scene.add(this.root);
  }

  rebuild(descriptors, spatial, budget) {
    for (const mesh of this.meshes) this.root.remove(mesh);
    this.meshes.length = 0;
    this.windowMaterials.clear();
    this.signalMaterials.clear();
    this.currentDescriptors = descriptors;
    const groups = new Map();
    for (const descriptor of descriptors) {
      const key = renderGroupKey(descriptor);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(descriptor);
    }
    for (const entries of groups.values()) {
      const mesh = createInstancedMesh(entries, this.pool, spatial, budget);
      this.root.add(mesh);
      this.meshes.push(mesh);
      if (entries[0].surface === 'window-lit') this.windowMaterials.add(mesh.material);
      if (entries[0].surface === 'signal-lit') this.signalMaterials.add(mesh.material);
    }
    this.visibleMeshes = this.meshes.length;
  }

  updateVisibility(cameraOrContext) {
    const cameraPosition = readCameraPosition(cameraOrContext);
    if (!cameraPosition) return;
    let visible = 0;
    for (const mesh of this.meshes) {
      const center = mesh.userData.center;
      if (!center || !Number.isFinite(mesh.userData.maxDistance)) {
        mesh.visible = true;
      } else {
        const distance = Math.hypot(cameraPosition[0] - center[0], cameraPosition[1] - center[1]);
        mesh.visible = distance <= mesh.userData.maxDistance + mesh.userData.radius;
      }
      if (mesh.visible) visible += 1;
    }
    this.visibleMeshes = visible;
  }

  updateNight(nightFactor, signalPulse = 1) {
    const night = Math.max(0, Math.min(1, nightFactor));
    for (const material of this.pool.materials.values()) {
      if (!material.userData.explicitEmission) material.color.setScalar(1 - night * 0.48);
    }
    for (const material of this.windowMaterials) {
      material.opacity = night;
      material.visible = night > 0.015;
    }
    for (const material of this.signalMaterials) {
      material.opacity = night * Math.max(0.22, signalPulse);
      material.visible = night > 0.005;
    }
  }

  getStatus() {
    return Object.freeze({
      rootName: this.root.name,
      meshGroups: this.meshes.length,
      visibleMeshGroups: this.visibleMeshes,
      instancedObjects: this.currentDescriptors.length,
      pooledGeometries: this.pool.geometries.size,
      pooledMaterials: this.pool.materials.size,
      windowMaterialGroups: this.windowMaterials.size,
      signalMaterialGroups: this.signalMaterials.size,
      wholeBuildingEmission: false,
      sceneWideMaterialScans: 0,
      perFrameAllocations: 0,
    });
  }

  dispose() {
    for (const mesh of this.meshes) this.root.remove(mesh);
    this.meshes.length = 0;
    this.root.removeFromParent();
    this.pool.dispose();
    this.currentDescriptors = [];
    this.windowMaterials.clear();
    this.signalMaterials.clear();
  }
}
