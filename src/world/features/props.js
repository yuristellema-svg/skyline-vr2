import * as THREE from '../../../vendor/three.module.min.js';

export const PROP_KEYS = Object.freeze(['pine', 'cedar', 'broadleaf', 'rock', 'scrub', 'post']);
export const PROP_RECORD_BYTES = 12;

const DEFAULT_CAPACITY = Object.freeze({
  pine: 3200,
  cedar: 3200,
  broadleaf: 3600,
  rock: 5200,
  scrub: 5200,
  post: 768,
});

const DEFAULT_LOD = Object.freeze({
  nearRadius: 480,
  middleRadius: 950,
  farRadius: 1550,
  middleKeep: 0.3,
  farKeep: 0.06,
  triangleBudget: 185000,
});

function deterministicPropSample(record) {
  let value = Math.imul(Math.round(record.x * 4), 0x1f123bb5)
    ^ Math.imul(Math.round(record.z * 4), 0x5f356495)
    ^ Math.imul((record.type | 0) + 1, 0x9e3779b1)
    ^ Math.imul((record.variant | 0) + 1, 0x85ebca77);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function coloredPart(geometry, color, matrix = null) {
  if (matrix) geometry.applyMatrix4(matrix);
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  if (nonIndexed !== geometry) geometry.dispose();
  return { geometry: nonIndexed, color: new THREE.Color(color) };
}

function mergeColored(parts) {
  let vertices = 0;
  for (const part of parts) vertices += part.geometry.getAttribute('position').count;
  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  const colors = new Float32Array(vertices * 3);
  let offset = 0;
  for (const part of parts) {
    const sourcePositions = part.geometry.getAttribute('position');
    const sourceNormals = part.geometry.getAttribute('normal');
    for (let index = 0; index < sourcePositions.count; index += 1) {
      const target = (offset + index) * 3;
      positions[target] = sourcePositions.getX(index);
      positions[target + 1] = sourcePositions.getY(index);
      positions[target + 2] = sourcePositions.getZ(index);
      normals[target] = sourceNormals.getX(index);
      normals[target + 1] = sourceNormals.getY(index);
      normals[target + 2] = sourceNormals.getZ(index);
      colors[target] = part.color.r;
      colors[target + 1] = part.color.g;
      colors[target + 2] = part.color.b;
    }
    offset += sourcePositions.count;
    part.geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function translated(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

function buildPineGeometry() {
  return mergeColored([
    coloredPart(new THREE.CylinderGeometry(0.48, 0.72, 6.5, 6), 0x5c3f2a, translated(0, 3.25, 0)),
    coloredPart(new THREE.ConeGeometry(4.5, 10.5, 7), 0x244f38, translated(0, 8.0, 0)),
    coloredPart(new THREE.ConeGeometry(3.2, 9.0, 7), 0x2e6443, translated(0, 12.5, 0)),
  ]);
}

function buildCedarGeometry() {
  return mergeColored([
    coloredPart(new THREE.CylinderGeometry(0.5, 0.78, 7.2, 6), 0x60422d, translated(0, 3.6, 0)),
    coloredPart(new THREE.ConeGeometry(4.2, 13.5, 6), 0x315746, translated(0, 9.0, 0)),
    coloredPart(new THREE.ConeGeometry(2.7, 10.0, 6), 0x3d6b53, translated(0, 14.0, 0)),
  ]);
}

function buildBroadleafGeometry() {
  return mergeColored([
    coloredPart(new THREE.CylinderGeometry(0.6, 0.9, 7.0, 6), 0x6a4930, translated(0, 3.5, 0)),
    coloredPart(new THREE.DodecahedronGeometry(4.8, 0), 0x426d38, translated(-1.7, 9.5, 0.3)),
    coloredPart(new THREE.DodecahedronGeometry(5.2, 0), 0x538146, translated(2.0, 10.1, 0)),
    coloredPart(new THREE.DodecahedronGeometry(4.5, 0), 0x37633b, translated(0.2, 13.0, -1.2)),
  ]);
}

function buildRockGeometry() {
  const geometry = new THREE.DodecahedronGeometry(2.4, 0);
  geometry.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.72, 0.86));
  geometry.applyMatrix4(translated(0, 1.72, 0));
  return mergeColored([coloredPart(geometry, 0x777a72)]);
}

function buildScrubGeometry() {
  return mergeColored([
    coloredPart(new THREE.DodecahedronGeometry(1.6, 0), 0x48663b, translated(-0.8, 1.2, 0)),
    coloredPart(new THREE.DodecahedronGeometry(1.4, 0), 0x587743, translated(0.9, 1.0, 0.35)),
  ]);
}

function buildPostGeometry() {
  return mergeColored([
    coloredPart(new THREE.BoxGeometry(0.42, 3.8, 0.42), 0x73543c, translated(0, 1.9, 0)),
    coloredPart(new THREE.BoxGeometry(0.72, 0.3, 0.72), 0xc0a46c, translated(0, 3.85, 0)),
  ]);
}

const GEOMETRY_BUILDERS = Object.freeze([
  buildPineGeometry,
  buildCedarGeometry,
  buildBroadleafGeometry,
  buildRockGeometry,
  buildScrubGeometry,
  buildPostGeometry,
]);

function normalizedView(source) {
  if (source instanceof DataView) return source;
  if (source instanceof ArrayBuffer) return new DataView(source);
  if (ArrayBuffer.isView(source)) return new DataView(source.buffer, source.byteOffset, source.byteLength);
  throw new TypeError('Packed props require an ArrayBuffer, typed array, or DataView.');
}

export function decodePropRecord(source, byteOffset, bounds, out = {}) {
  const view = normalizedView(source);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  out.x = bounds.minX + view.getUint16(byteOffset, true) / 65535 * width;
  out.z = bounds.minZ + view.getUint16(byteOffset + 2, true) / 65535 * depth;
  out.yaw = view.getUint16(byteOffset + 4, true) / 65536 * Math.PI * 2;
  out.scale = view.getUint16(byteOffset + 6, true) / 1000;
  out.type = view.getUint8(byteOffset + 8);
  out.variant = view.getUint8(byteOffset + 9);
  out.tint = view.getUint8(byteOffset + 10);
  out.flags = view.getUint8(byteOffset + 11);
  return out;
}

export class PropLayer {
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.group.name = 'Streamed instanced world props';
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.meshes = new Array(PROP_KEYS.length);
    this.capacities = new Uint32Array(PROP_KEYS.length);
    this.counts = new Uint32Array(PROP_KEYS.length);
    this.trianglesPerInstance = new Uint16Array(PROP_KEYS.length);
    this.focusX = options.focusX ?? 0;
    this.focusZ = options.focusZ ?? 0;
    this.nearRadius = options.nearRadius ?? DEFAULT_LOD.nearRadius;
    this.middleRadius = options.middleRadius ?? DEFAULT_LOD.middleRadius;
    this.farRadius = options.farRadius ?? DEFAULT_LOD.farRadius;
    this.middleKeep = options.middleKeep ?? DEFAULT_LOD.middleKeep;
    this.farKeep = options.farKeep ?? DEFAULT_LOD.farKeep;
    this.triangleBudget = options.triangleBudget ?? DEFAULT_LOD.triangleBudget;
    this.estimatedTriangles = 0;
    this.rejectedByLod = 0;
    this.rejectedByBudget = 0;
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._color = new THREE.Color();
    this._record = {};
    const capacity = { ...DEFAULT_CAPACITY, ...(options.capacity ?? {}) };
    for (let type = 0; type < PROP_KEYS.length; type += 1) {
      const key = PROP_KEYS[type];
      const geometry = GEOMETRY_BUILDERS[type]();
      const limit = Math.max(1, capacity[key] | 0);
      const mesh = new THREE.InstancedMesh(geometry, this.material, limit);
      mesh.name = `Instanced ${key}`;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes[type] = mesh;
      this.capacities[type] = limit;
      this.trianglesPerInstance[type] = geometry.getAttribute('position').count / 3;
      this.group.add(mesh);
    }
    if (options.scene) options.scene.add(this.group);
  }

  begin(focusX = this.focusX, focusZ = this.focusZ) {
    this.focusX = focusX;
    this.focusZ = focusZ;
    this.counts.fill(0);
    this.estimatedTriangles = 0;
    this.rejectedByLod = 0;
    this.rejectedByBudget = 0;
    for (const mesh of this.meshes) mesh.count = 0;
    return this;
  }

  setFocus(x, z) {
    this.focusX = x;
    this.focusZ = z;
    return this;
  }

  acceptsDistanceLod(record) {
    const dx = record.x - this.focusX;
    const dz = record.z - this.focusZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq <= this.nearRadius * this.nearRadius) return true;
    let keep;
    if (distanceSq <= this.middleRadius * this.middleRadius) {
      keep = this.middleKeep;
    } else if (distanceSq <= this.farRadius * this.farRadius) {
      keep = this.farKeep;
    } else {
      return false;
    }
    if ((record.type | 0) === 5) keep = Math.min(1, keep * 2.5);
    return deterministicPropSample(record) < keep;
  }

  add(record, heightSampler) {
    const type = record.type | 0;
    if (type < 0 || type >= this.meshes.length) return false;
    if (!this.acceptsDistanceLod(record)) {
      this.rejectedByLod += 1;
      return false;
    }
    const index = this.counts[type];
    if (index >= this.capacities[type]) return false;
    const triangles = this.trianglesPerInstance[type];
    if (this.estimatedTriangles + triangles > this.triangleBudget) {
      this.rejectedByBudget += 1;
      return false;
    }
    const baseScale = Number.isFinite(record.scale) ? record.scale : 1;
    const variant = record.variant | 0;
    const anisotropy = ((variant & 7) - 3) * 0.018;
    let scaleX = baseScale * (1 + anisotropy);
    let scaleY = baseScale * (0.94 + ((variant >>> 3) & 7) * 0.018);
    let scaleZ = baseScale * (1 - anisotropy * 0.7);
    if (type === 3) {
      scaleX *= 0.8 + (variant & 3) * 0.11;
      scaleY *= 0.7 + ((variant >>> 2) & 3) * 0.1;
    }
    const y = Number.isFinite(record.y) ? record.y : heightSampler(record.x, record.z);
    this._position.set(record.x, y, record.z);
    this._quaternion.setFromAxisAngle(UP_AXIS, record.yaw ?? 0);
    this._scale.set(scaleX, scaleY, scaleZ);
    this._matrix.compose(this._position, this._quaternion, this._scale);
    const mesh = this.meshes[type];
    mesh.setMatrixAt(index, this._matrix);
    const tint = 0.82 + (record.tint ?? 128) / 255 * 0.25;
    this._color.setRGB(tint, tint * (type === 2 ? 1.035 : 1), tint * (type === 0 ? 0.97 : 1));
    mesh.setColorAt(index, this._color);
    this.counts[type] = index + 1;
    this.estimatedTriangles += triangles;
    return true;
  }

  addPacked(source, byteOffset, count, bounds, heightSampler) {
    const view = normalizedView(source);
    let added = 0;
    for (let index = 0; index < count; index += 1) {
      decodePropRecord(view, byteOffset + index * PROP_RECORD_BYTES, bounds, this._record);
      if (this.add(this._record, heightSampler)) added += 1;
    }
    return added;
  }

  commit() {
    for (let type = 0; type < this.meshes.length; type += 1) {
      const mesh = this.meshes[type];
      mesh.count = this.counts[type];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
    }
    return this.counts;
  }

  getBudgetReport() {
    return {
      instances: Array.from(this.counts).reduce((sum, value) => sum + value, 0),
      estimatedTriangles: this.estimatedTriangles,
      triangleBudget: this.triangleBudget,
      rejectedByLod: this.rejectedByLod,
      rejectedByBudget: this.rejectedByBudget,
    };
  }

  dispose() {
    for (const mesh of this.meshes) mesh.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

export function createPropLayer(options = {}) {
  return new PropLayer(options);
}
