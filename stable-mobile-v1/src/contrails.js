import * as THREE from '../vendor/three.module.min.js';

const MAX_POINTS = 90;
const SAMPLE_INTERVAL = 0.055;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSpeed(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  if (flight?.velocity?.length) return flight.velocity.length();
  return 0;
}

function getLoad(flight) {
  for (const value of [flight?.loadFactor, flight?.gForce, flight?.currentG]) {
    if (Number.isFinite(value)) return value;
  }
  return 1;
}

function safeHeight(sampleHeight, x, z) {
  if (typeof sampleHeight !== 'function') return 0;
  try {
    const value = sampleHeight(x, z);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function makeTrail(color) {
  const array = new Float32Array(MAX_POINTS * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    fog: true,
    blending: THREE.AdditiveBlending,
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  return { line, geometry, material, points: [] };
}

export class ContrailSystem {
  constructor(scene, sampleHeight = null) {
    this.scene = scene;
    this.sampleHeight = sampleHeight;
    this.accumulator = 0;
    this.lastPosition = null;
    this.halfSpan = 2.1;

    this.left = makeTrail(0xe8f8ff);
    this.right = makeTrail(0xe8f8ff);

    this.left.line.name = 'left-wing-vortex';
    this.right.line.name = 'right-wing-vortex';

    this.scene.add(this.left.line, this.right.line);

    this.rightVector = new THREE.Vector3(1, 0, 0);
    this.leftPoint = new THREE.Vector3();
    this.rightPoint = new THREE.Vector3();

    this._aircraftListener = (event) => {
      const id = event?.detail?.id;
      this.halfSpan = id === 'stuka' ? 2.7 : id === 'scout' ? 2.5 : 1.9;
    };

    window.addEventListener('skyline:aircraft-changed', this._aircraftListener);
  }

  _clear() {
    this.left.points.length = 0;
    this.right.points.length = 0;
    this.left.geometry.setDrawRange(0, 0);
    this.right.geometry.setDrawRange(0, 0);
  }

  _push(trail, point) {
    trail.points.push(point.clone());
    if (trail.points.length > MAX_POINTS) trail.points.shift();

    const array = trail.geometry.attributes.position.array;
    for (let index = 0; index < trail.points.length; index += 1) {
      const pointIndex = index * 3;
      const item = trail.points[index];
      array[pointIndex] = item.x;
      array[pointIndex + 1] = item.y;
      array[pointIndex + 2] = item.z;
    }

    trail.geometry.setDrawRange(0, trail.points.length);
    trail.geometry.attributes.position.needsUpdate = true;
  }

  update(dt, flight, phase) {
    const safeDt = clamp(dt || 0, 0, 0.1);
    this.accumulator += safeDt;

    if (!flight?.position || phase !== 'flying') {
      this._clear();
      this.lastPosition = null;
      return;
    }

    if (this.lastPosition && this.lastPosition.distanceTo(flight.position) > 140) {
      this._clear();
    }

    this.lastPosition = flight.position.clone();

    const speed = getSpeed(flight);
    const load = getLoad(flight);
    const ground = safeHeight(this.sampleHeight, flight.position.x, flight.position.z);
    const altitudeAboveGround = flight.position.y - ground;
    const active = speed > 92 && (altitudeAboveGround > 260 || load > 3.6);

    const strength = clamp((speed - 92) / 90 + Math.max(0, load - 3.6) * 0.16, 0, 1);
    const targetOpacity = active ? 0.12 + strength * 0.2 : 0;
    this.left.material.opacity += (targetOpacity - this.left.material.opacity) * 0.08;
    this.right.material.opacity = this.left.material.opacity;

    if (!active) {
      if (this.left.points.length > 0 && this.accumulator >= SAMPLE_INTERVAL * 2) {
        this.left.points.shift();
        this.right.points.shift();
        this.accumulator = 0;
        this._rewriteWithoutPush(this.left);
        this._rewriteWithoutPush(this.right);
      }
      return;
    }

    if (this.accumulator < SAMPLE_INTERVAL) return;
    this.accumulator = 0;

    this.rightVector.set(1, 0, 0);
    if (flight.attitude?.isQuaternion) {
      this.rightVector.applyQuaternion(flight.attitude).normalize();
    } else if (flight.velocity?.isVector3 && flight.velocity.lengthSq() > 0.001) {
      const forward = flight.velocity.clone().normalize();
      this.rightVector.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    }

    this.leftPoint.copy(flight.position).addScaledVector(this.rightVector, -this.halfSpan);
    this.rightPoint.copy(flight.position).addScaledVector(this.rightVector, this.halfSpan);

    this._push(this.left, this.leftPoint);
    this._push(this.right, this.rightPoint);
  }

  _rewriteWithoutPush(trail) {
    const array = trail.geometry.attributes.position.array;
    for (let index = 0; index < trail.points.length; index += 1) {
      const pointIndex = index * 3;
      const item = trail.points[index];
      array[pointIndex] = item.x;
      array[pointIndex + 1] = item.y;
      array[pointIndex + 2] = item.z;
    }
    trail.geometry.setDrawRange(0, trail.points.length);
    trail.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    window.removeEventListener('skyline:aircraft-changed', this._aircraftListener);
    this.scene?.remove(this.left.line, this.right.line);
    this.left.geometry.dispose();
    this.left.material.dispose();
    this.right.geometry.dispose();
    this.right.material.dispose();
  }
}
