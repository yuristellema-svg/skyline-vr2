import * as THREE from '../../vendor/three.module.min.js';
import {
  calculateBoostedSpeed,
  sweptGateIntersection,
} from './math.js';

export const DEFAULT_BOOST_GATES = Object.freeze([
  Object.freeze({ name: 'SKYLINE LAUNCH', position: [0, 600, 2050], yaw: 0, radius: 31 }),
  Object.freeze({ name: 'ALPINE NEEDLE', position: [310, 350, 3440], yaw: 0.28, radius: 35 }),
  Object.freeze({ name: 'CANYON BURN', position: [2940, 185, 830], yaw: 1.22, radius: 32 }),
  Object.freeze({ name: 'CITY THREAD', position: [1020, 205, -480], yaw: 0.62, radius: 29 }),
  Object.freeze({ name: 'RIVER RUN', position: [-420, 118, 300], yaw: 0.9, radius: 26 }),
  Object.freeze({ name: 'MIRROR LAKE', position: [-2110, 132, 2110], yaw: -0.72, radius: 34 }),
  Object.freeze({ name: 'OBSERVATORY', position: [-3150, 255, 2700], yaw: 1.88, radius: 30 }),
]);

const direction = new THREE.Vector3();

function dispatchBoost(detail) {
  if (
    typeof globalThis.window?.dispatchEvent !== 'function' ||
    typeof globalThis.CustomEvent !== 'function'
  ) {
    return;
  }

  globalThis.window.dispatchEvent(
    new globalThis.CustomEvent('skyline:boost-fired', {
      detail,
    }),
  );
}

function makeGate(definition, index) {
  const group = new THREE.Group();
  group.name = `Boost hoop ${definition.name}`;
  group.position.fromArray(definition.position);
  group.rotation.y = definition.yaw || 0;

  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2d372,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const innerMaterial = outerMaterial.clone();
  innerMaterial.color.setHex(0xc44736);
  innerMaterial.opacity = 0.42;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(definition.radius, 1.7, 10, 56),
    outerMaterial,
  );

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(definition.radius - 3.8, 0.55, 8, 48),
    innerMaterial,
  );

  group.add(ring, inner);

  return {
    definition: {
      ...definition,
      tubeRadius: 1.7,
      halfThickness: 3.0,
    },
    index,
    group,
    ring,
    inner,
    outerMaterial,
    innerMaterial,
    cooldown: 0,
    flash: 0,
  };
}

export class BoostHoopSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.elapsed = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.previousPlayerPosition = new THREE.Vector3();
    this.hasPreviousPlayerPosition = false;
    this.playerRadius = Math.max(0.5, Number(options.playerRadius) || 2.5);
    this.basePercent = Math.max(0.03, Number(options.basePercent) || 0.08);
    this.chainPercent = Math.max(0, Number(options.chainPercent) || 0.004);
    this.minimumImpulse = Math.max(1, Number(options.minimumImpulse) || 7);
    this.teleportDistance = Math.max(100, Number(options.teleportDistance) || 1200);

    this.root = new THREE.Group();
    this.root.name = 'Failure-safe boost hoops';
    scene.add(this.root);

    const definitions = options.gates ?? DEFAULT_BOOST_GATES;
    this.gates = definitions.map((definition, index) => {
      const gate = makeGate(definition, index);
      this.root.add(gate.group);
      return gate;
    });
  }

  _applyBoost(flight, gate) {
    const currentSpeed = Math.max(
      0,
      Number(flight?.speed) || flight?.velocity?.length?.() || 0,
    );

    this.chain = this.chainTimer > 0 ? Math.min(8, this.chain + 1) : 1;
    this.chainTimer = 6;

    const nextSpeed = calculateBoostedSpeed(currentSpeed, this.chain, {
      basePercent: this.basePercent,
      chainPercent: this.chainPercent,
      minimumImpulse: this.minimumImpulse,
    });

    direction.copy(flight.velocity);

    if (direction.lengthSq() < 1e-8) {
      flight.getForward?.(direction);
    }

    if (direction.lengthSq() < 1e-8) {
      direction.set(0, 0, -1);
    }

    direction.normalize();
    flight.speed = nextSpeed;
    flight.velocity.copy(direction).multiplyScalar(nextSpeed);
    flight.boostAmount = 1;
    flight.boostChain = this.chain;
    flight.boostJustTriggered = true;

    const impulse = nextSpeed - currentSpeed;

    dispatchBoost({
      index: gate.index,
      name: gate.definition.name,
      chain: this.chain,
      previousSpeed: currentSpeed,
      speed: nextSpeed,
      impulse,
      percentage: currentSpeed > 0 ? impulse / currentSpeed : 0,
    });
  }

  update(dt, flight, camera, phase = 'flying') {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    this.elapsed += safeDt;
    this.chainTimer = Math.max(0, this.chainTimer - safeDt);
    if (this.chainTimer === 0) this.chain = 0;

    const currentPosition = flight?.position;
    const canTrack = Boolean(currentPosition?.isVector3);

    for (const gate of this.gates) {
      gate.cooldown = Math.max(0, gate.cooldown - safeDt);
      gate.flash = Math.max(0, gate.flash - safeDt * 2.4);

      const pulse = 0.5 + Math.sin(this.elapsed * 3.4 + gate.index) * 0.5;
      gate.ring.rotation.z += safeDt * 0.52;
      gate.inner.rotation.z -= safeDt * 0.78;
      gate.outerMaterial.opacity = 0.58 + pulse * 0.2 + gate.flash * 0.2;
      gate.innerMaterial.opacity = 0.28 + pulse * 0.18 + gate.flash * 0.3;
      gate.group.scale.setScalar(1 + gate.flash * 0.08);

      if (canTrack) {
        const distance = currentPosition.distanceTo(gate.group.position);
        gate.group.visible = distance < Math.max(4200, Number(camera?.far) || 0);
      } else {
        gate.group.visible = true;
      }
    }

    if (!canTrack) return;

    if (
      !this.hasPreviousPlayerPosition ||
      this.previousPlayerPosition.distanceTo(currentPosition) > this.teleportDistance
    ) {
      this.previousPlayerPosition.copy(currentPosition);
      this.hasPreviousPlayerPosition = true;
      return;
    }

    if (phase === 'flying') {
      for (const gate of this.gates) {
        if (gate.cooldown > 0 || !gate.group.visible) continue;

        const result = sweptGateIntersection(
          this.previousPlayerPosition,
          currentPosition,
          gate.definition,
          this.playerRadius,
        );

        if (!result.hit) continue;

        gate.cooldown = 3.5;
        gate.flash = 1;
        this._applyBoost(flight, gate);
      }
    }

    this.previousPlayerPosition.copy(currentPosition);
  }

  dispose() {
    this.scene?.remove(this.root);

    this.root.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];

      for (const material of materials) material.dispose?.();
    });
  }
}
