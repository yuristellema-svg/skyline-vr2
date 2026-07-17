class EulerLike {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }
  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  multiplyScalar(value) {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize() {
    const length = this.length() || 1;
    return this.multiplyScalar(1 / length);
  }
}

export class Quaternion {
  setFromUnitVectors() { return this; }
  setFromAxisAngle() { return this; }
}

export class Matrix4 {
  compose() {
    return this;
  }
}

class Object3D {
  constructor() {
    this.children = [];
    this.parent = null;
    this.position = new Vector3();
    this.rotation = new EulerLike();
    this.scale = new Vector3(1, 1, 1);
    this.quaternion = new Quaternion();
    this.userData = {};
    this.visible = true;
    this.name = '';
    this.frustumCulled = true;
    this.renderOrder = 0;
  }
  add(...objects) {
    for (const object of objects) {
      if (!object) continue;
      object.parent?.remove?.(object);
      object.parent = this;
      this.children.push(object);
    }
    return this;
  }
  remove(object) {
    const index = this.children.indexOf(object);
    if (index >= 0) this.children.splice(index, 1);
    if (object) object.parent = null;
    return this;
  }
  removeFromParent() {
    this.parent?.remove?.(this);
    return this;
  }
  traverse(callback) {
    callback(this);
    for (const child of this.children) child.traverse?.(callback);
  }
}

export class Group extends Object3D {
  constructor() {
    super();
    this.type = 'Group';
  }
}

class BaseGeometry {
  constructor(vertices = 0) {
    this.attributes = {
      position: {
        count: vertices,
      },
    };
    this.index = null;
    this.disposed = false;
    this.transforms = [];
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }
  setIndex(index) {
    this.index = Array.isArray(index) ? index : index?.array || index;
    return this;
  }
  setFromPoints(points) {
    this.attributes.position = { count: points.length };
    return this;
  }
  computeVertexNormals() {
    return this;
  }
  computeBoundingBox() {
    return this;
  }
  computeBoundingSphere() {
    return this;
  }
  rotateX(value) {
    this.transforms.push(['rotateX', value]);
    return this;
  }
  rotateY(value) {
    this.transforms.push(['rotateY', value]);
    return this;
  }
  translate(x, y, z) {
    this.transforms.push(['translate', x, y, z]);
    return this;
  }
  scale(x, y, z) {
    this.transforms.push(['scale', x, y, z]);
    return this;
  }
  dispose() {
    this.disposed = true;
  }
}

export class BufferGeometry extends BaseGeometry {
  constructor() {
    super(0);
    this.type = 'BufferGeometry';
  }
}

export class Float32BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }
}

export class BoxGeometry extends BaseGeometry {
  constructor() {
    super(24);
    this.type = 'BoxGeometry';
  }
}

export class CylinderGeometry extends BaseGeometry {
  constructor(_rt = 1, _rb = 1, _height = 1, segments = 8) {
    super(Math.max(24, segments * 4 + 2));
    this.type = 'CylinderGeometry';
  }
}

export class SphereGeometry extends BaseGeometry {
  constructor(_radius = 1, widthSegments = 16, heightSegments = 10) {
    super((widthSegments + 1) * (heightSegments + 1));
    this.type = 'SphereGeometry';
  }
}

export class CircleGeometry extends BaseGeometry {
  constructor(_radius = 1, segments = 16) {
    super(segments + 2);
    this.type = 'CircleGeometry';
  }
}

export class RingGeometry extends BaseGeometry {
  constructor(_inner = 0.5, _outer = 1, segments = 16) {
    super((segments + 1) * 2);
    this.type = 'RingGeometry';
  }
}

export class TorusGeometry extends BaseGeometry {
  constructor(_radius = 1, _tube = 0.1, radialSegments = 8, tubularSegments = 24) {
    super((radialSegments + 1) * (tubularSegments + 1));
    this.type = 'TorusGeometry';
  }
}

export class ConeGeometry extends BaseGeometry {
  constructor(_radius = 1, _height = 1, segments = 16) {
    super(segments * 4 + 2);
    this.type = 'ConeGeometry';
  }
}

export class LatheGeometry extends BaseGeometry {
  constructor(points = [], segments = 16) {
    super(Math.max(0, points.length * (segments + 1)));
    this.type = 'LatheGeometry';
  }
}

export class ShapeGeometry extends BaseGeometry {
  constructor(shape) {
    super(Math.max(12, (shape?.commands?.length || 4) * 3));
    this.type = 'ShapeGeometry';
  }
}

export class ExtrudeGeometry extends BaseGeometry {
  constructor(shape) {
    super(Math.max(36, (shape?.commands?.length || 6) * 12));
    this.type = 'ExtrudeGeometry';
  }
}

export class Shape {
  constructor() {
    this.commands = [];
  }
  moveTo(...args) {
    this.commands.push(['moveTo', ...args]);
  }
  lineTo(...args) {
    this.commands.push(['lineTo', ...args]);
  }
  quadraticCurveTo(...args) {
    this.commands.push(['quadraticCurveTo', ...args]);
  }
  closePath() {
    this.commands.push(['closePath']);
  }
}

class BaseMaterial {
  constructor(options = {}) {
    Object.assign(this, options);
    this.transparent = Boolean(options.transparent);
    this.opacity = options.opacity ?? 1;
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
  }
}

export class MeshStandardMaterial extends BaseMaterial {}
export class MeshBasicMaterial extends BaseMaterial {}
export class LineBasicMaterial extends BaseMaterial {}

export class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.type = 'Mesh';
    this.isMesh = true;
  }
}


export class InstancedMesh extends Mesh {
  constructor(geometry, material, count = 1) {
    super(geometry, material);
    this.type = 'InstancedMesh';
    this.count = count;
    this.instanceMatrix = { needsUpdate: false };
    this.matrices = new Array(count);
  }
  setMatrixAt(index, matrix) {
    this.matrices[index] = matrix;
  }
}

export class Line extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.type = 'Line';
    this.isLine = true;
  }
}

export class LineLoop extends Line {
  constructor(geometry, material) {
    super(geometry, material);
    this.type = 'LineLoop';
  }
}

export const DoubleSide = 2;
