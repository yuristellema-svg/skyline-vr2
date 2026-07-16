export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() { return new Vec3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() {
    const length = this.length() || 1;
    return this.multiplyScalar(1 / length);
  }
  applyQuaternion(q) {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  }
}

export class Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  clone() { return new Quat(this.x, this.y, this.z, this.w); }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  dot(q) { return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w; }
  length() { return Math.hypot(this.x, this.y, this.z, this.w); }
  normalize() {
    const length = this.length() || 1;
    this.x /= length; this.y /= length; this.z /= length; this.w /= length;
    return this;
  }
  multiply(q) {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;
    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const half = angle * 0.5;
    const sine = Math.sin(half);
    this.x = axis.x * sine;
    this.y = axis.y * sine;
    this.z = axis.z * sine;
    this.w = Math.cos(half);
    return this;
  }
  slerp(qb, t) {
    if (t <= 0) return this;
    if (t >= 1) return this.copy(qb);
    let cosHalfTheta = this.dot(qb);
    let bx = qb.x, by = qb.y, bz = qb.z, bw = qb.w;
    if (cosHalfTheta < 0) {
      bx = -bx; by = -by; bz = -bz; bw = -bw;
      cosHalfTheta = -cosHalfTheta;
    }
    if (cosHalfTheta >= 1) return this;
    const sqrSinHalfTheta = 1 - cosHalfTheta * cosHalfTheta;
    if (sqrSinHalfTheta <= 1e-12) {
      const s = 1 - t;
      this.x = s * this.x + t * bx;
      this.y = s * this.y + t * by;
      this.z = s * this.z + t * bz;
      this.w = s * this.w + t * bw;
      return this.normalize();
    }
    const sinHalfTheta = Math.sqrt(sqrSinHalfTheta);
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    this.x = this.x * ratioA + bx * ratioB;
    this.y = this.y * ratioA + by * ratioB;
    this.z = this.z * ratioA + bz * ratioB;
    this.w = this.w * ratioA + bw * ratioB;
    return this;
  }
}

export function quaternionAngle(a, b) {
  const dot = Math.min(1, Math.abs(a.dot(b)));
  return 2 * Math.acos(dot);
}

export function makePose(speed = 60) {
  return {
    position: new Vec3(),
    attitude: new Quat(),
    velocity: new Vec3(0, 0, -speed),
    angularVelocity: new Vec3(),
    speed,
    viewYaw: 0,
    pathAngle: 0,
    gLoad: 1,
    stallAmount: 0,
    lowSpeedRecoveryActive: false,
  };
}
