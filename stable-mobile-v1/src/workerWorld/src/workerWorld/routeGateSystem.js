import {
  clamp,
  dispatchDetail,
  distanceSquared,
  point3,
  sweptGateIntersection,
} from './sharedMath.js';
import { normalizeQuality } from './qualityPolicy.js';

export const DEFAULT_ROUTE_GATES = Object.freeze([
  Object.freeze({ id: 'launch', name: 'SKYLINE LAUNCH', position: [0, 600, 2050], yaw: 0, radius: 31 }),
  Object.freeze({ id: 'alpine', name: 'ALPINE NEEDLE', position: [310, 350, 3440], yaw: 0.28, radius: 35 }),
  Object.freeze({ id: 'canyon', name: 'CANYON BURN', position: [2940, 185, 830], yaw: 1.22, radius: 32 }),
  Object.freeze({ id: 'city', name: 'CITY THREAD', position: [1020, 205, -480], yaw: 0.62, radius: 29 }),
  Object.freeze({ id: 'river', name: 'RIVER RUN', position: [-420, 118, 300], yaw: 0.9, radius: 26 }),
  Object.freeze({ id: 'lake', name: 'MIRROR LAKE', position: [-2110, 132, 2110], yaw: -0.72, radius: 34 }),
  Object.freeze({ id: 'observatory', name: 'OBSERVATORY', position: [-3150, 255, 2700], yaw: 1.88, radius: 30 }),
]);

function normalizeGate(definition, index) {
  return {
    id: definition.id || `gate-${index + 1}`,
    name: definition.name || `ROUTE ${index + 1}`,
    position: point3(definition.position),
    yaw: Number(definition.yaw) || 0,
    radius: Math.max(4, Number(definition.radius) || 28),
    tubeRadius: Math.max(0.5, Number(definition.tubeRadius) || 1.35),
    halfThickness: Math.max(0.5, Number(definition.halfThickness) || 2.4),
  };
}

export class RouteGateSystem {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.THREE = options.THREE || null;
    this.eventTarget = options.eventTarget || globalThis.window || null;
    this.playerRadius = Math.max(0.5, Number(options.playerRadius) || 2.5);
    this.cooldownSeconds = Math.max(0.5, Number(options.cooldownSeconds) || 3.5);
    this.chainSeconds = Math.max(1, Number(options.chainSeconds) || 7);
    this.teleportDistance = Math.max(100, Number(options.teleportDistance) || 1200);
    this.quality = normalizeQuality(options.quality);
    this.elapsed = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.previousPosition = { x: 0, y: 0, z: 0 };
    this.hasPreviousPosition = false;
    this.disposed = false;
    this.passCount = 0;
    this.lastPass = null;
    this.lastBoostFired = null;
    this.gates = (options.gates || DEFAULT_ROUTE_GATES).map((definition, index) => ({
      definition: normalizeGate(definition, index),
      index,
      cooldown: 0,
      flash: 0,
      visual: null,
    }));

    this.root = null;
    if (options.visuals !== false && this.scene && this.THREE) this._buildVisuals();

    this._onBoostFired = event => {
      this.lastBoostFired = event?.detail ? { ...event.detail } : null;
    };
    this.eventTarget?.addEventListener?.('skyline:boost-fired', this._onBoostFired);
  }

  _buildVisuals() {
    const THREE = this.THREE;
    this.root = new THREE.Group();
    this.root.name = 'Skyline worker route gates';
    this.scene.add(this.root);

    for (const gate of this.gates) {
      const group = new THREE.Group();
      group.name = `Route gate ${gate.definition.name}`;
      group.position.set(
        gate.definition.position.x,
        gate.definition.position.y,
        gate.definition.position.z,
      );
      group.rotation.y = gate.definition.yaw;

      const material = new THREE.MeshBasicMaterial({
        color: 0xd6bd76,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        fog: true,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(gate.definition.radius, 1.15, 8, 44),
        material,
      );
      group.add(ring);

      const tickMaterial = new THREE.MeshBasicMaterial({
        color: 0xa44a3b,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        fog: true,
      });
      const ticks = [];
      for (let index = 0; index < 4; index += 1) {
        const tick = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 4.8, 0.45),
          tickMaterial,
        );
        const angle = index * Math.PI * 0.5;
        tick.position.set(
          Math.cos(angle) * gate.definition.radius,
          Math.sin(angle) * gate.definition.radius,
          0,
        );
        tick.rotation.z = angle;
        group.add(tick);
        ticks.push(tick);
      }

      gate.visual = { group, ring, material, tickMaterial, ticks };
      this.root.add(group);
    }
  }

  _emitPass(gate, intersection) {
    this.chain = this.chainTimer > 0 ? Math.min(8, this.chain + 1) : 1;
    this.chainTimer = this.chainSeconds;
    this.passCount += 1;
    const detail = {
      gateId: gate.definition.id,
      index: gate.index,
      name: gate.definition.name,
      requestedChain: this.chain,
      crossingTime: intersection.time,
      radialDistance: intersection.radialDistance,
      cooldownSeconds: this.cooldownSeconds,
      boostOwner: 'sandbox-dynamics',
      audioContract: {
        emittedByOwner: 'skyline:boost-fired',
        listener: 'WindAudioSystem',
      },
    };
    this.lastPass = detail;
    dispatchDetail(this.eventTarget, 'skyline:boost-ring', detail);
  }

  fixedStepUpdate(dt, flight, phase = 'flying') {
    if (this.disposed) return;
    const safeDt = clamp(dt, 0, 1 / 20);
    this.chainTimer = Math.max(0, this.chainTimer - safeDt);
    if (this.chainTimer === 0) this.chain = 0;
    for (const gate of this.gates) {
      gate.cooldown = Math.max(0, gate.cooldown - safeDt);
      gate.flash = Math.max(0, gate.flash - safeDt * 2.5);
    }

    const current = flight?.position;
    if (!current) return;
    const currentPoint = point3(current);
    if (
      !this.hasPreviousPosition ||
      distanceSquared(this.previousPosition, currentPoint) > this.teleportDistance ** 2
    ) {
      this.previousPosition = currentPoint;
      this.hasPreviousPosition = true;
      return;
    }

    if (phase === 'flying') {
      for (const gate of this.gates) {
        if (gate.cooldown > 0) continue;
        const intersection = sweptGateIntersection(
          this.previousPosition,
          currentPoint,
          gate.definition,
          this.playerRadius,
        );
        if (!intersection.hit) continue;
        gate.cooldown = this.cooldownSeconds;
        gate.flash = 1;
        this._emitPass(gate, intersection);
      }
    }

    this.previousPosition = currentPoint;
  }

  update(dt, flight, camera, phase = 'flying') {
    if (this.disposed || !this.root) return;
    const safeDt = clamp(dt, 0, 0.1);
    this.elapsed += safeDt;
    this.root.visible = phase !== 'boot';
    const player = flight?.position ? point3(flight.position) : null;
    const far = Math.max(3800, Number(camera?.far) || 0);

    for (const gate of this.gates) {
      const visual = gate.visual;
      if (!visual) continue;
      const distance = player
        ? Math.sqrt(distanceSquared(player, gate.definition.position))
        : 0;
      visual.group.visible = !player || distance <= far;
      const pulse = this.quality.gatePulse
        ? 0.5 + Math.sin(this.elapsed * 2.4 + gate.index) * 0.5
        : 0.35;
      visual.ring.rotation.z += safeDt * 0.18;
      visual.material.opacity = 0.42 + pulse * 0.10 + gate.flash * 0.25;
      visual.tickMaterial.opacity = 0.46 + gate.flash * 0.30;
      const scale = 1 + gate.flash * 0.035;
      visual.group.scale.setScalar(scale);
    }
  }

  setQuality(level) {
    this.quality = normalizeQuality(level);
  }

  getStatus() {
    return {
      active: !this.disposed,
      gateCount: this.gates.length,
      passCount: this.passCount,
      chain: this.chain,
      lastPass: this.lastPass,
      lastBoostFired: this.lastBoostFired,
      mutatesFlight: false,
      crossing: 'swept-gate-plane',
      quality: this.quality.id,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.eventTarget?.removeEventListener?.('skyline:boost-fired', this._onBoostFired);
    if (this.root) {
      this.scene?.remove?.(this.root);
      this.root.traverse?.(object => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material)
          ? object.material
          : object.material ? [object.material] : [];
        for (const material of materials) material.dispose?.();
      });
    }
    this.root = null;
  }
}
