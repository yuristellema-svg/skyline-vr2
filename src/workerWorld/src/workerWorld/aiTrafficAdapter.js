import {
  clamp,
  dispatchDetail,
  distanceSquared,
  length3,
  lerpPoint,
  movingSphereClosestApproach,
  point3,
  sampleEllipticalRoute,
} from './sharedMath.js';
import { normalizeQuality } from './qualityPolicy.js';

export const DEFAULT_AI_ROUTES = Object.freeze([
  Object.freeze({ id: 'patrol-1', aircraftId: 'zero', center: [800, 520, 400], radiusX: 1250, radiusZ: 820, angularSpeed: 0.05, phase: 0.1, verticalAmplitude: 70, color: 0xd8d3c4, accent: 0xb73c31 }),
  Object.freeze({ id: 'patrol-2', aircraftId: 'stuka', center: [-1400, 390, 1300], radiusX: 980, radiusZ: 1400, angularSpeed: 0.043, phase: 1.6, verticalAmplitude: 55, color: 0x586354, accent: 0xc4b57c }),
  Object.freeze({ id: 'patrol-3', aircraftId: 'scout', center: [1700, 700, -1300], radiusX: 1500, radiusZ: 900, angularSpeed: 0.037, phase: 3.1, verticalAmplitude: 85, color: 0x8e9da0, accent: 0x343b3f }),
  Object.freeze({ id: 'patrol-4', aircraftId: 'zero', center: [-1700, 820, -900], radiusX: 1100, radiusZ: 1350, angularSpeed: 0.034, phase: 4.3, verticalAmplitude: 90, color: 0xd7d0b9, accent: 0x8f3d34 }),
  Object.freeze({ id: 'city-runner', aircraftId: 'scout', center: [200, 260, -300], radiusX: 850, radiusZ: 720, angularSpeed: 0.058, phase: 5.2, verticalAmplitude: 35, color: 0x4d5960, accent: 0xc7a45b }),
]);

function makeMaterial(THREE, color) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    fog: true,
    side: THREE.DoubleSide,
  });
}

function makeWingGeometry(THREE, span, chord, sweep = 0.25) {
  const halfSpan = span * 0.5;
  const halfChord = chord * 0.5;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, -halfChord,
    -halfSpan, 0, halfChord * sweep,
    0, 0, halfChord,
    0, 0, -halfChord,
    0, 0, halfChord,
    halfSpan, 0, halfChord * sweep,
  ]), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildAircraft(THREE, route) {
  const group = new THREE.Group();
  group.name = `Worker AI aircraft ${route.id}`;
  const bodyMaterial = makeMaterial(THREE, route.color || 0xd8d3c4);
  const accentMaterial = makeMaterial(THREE, route.accent || 0xb73c31);
  const darkMaterial = makeMaterial(THREE, 0x252a2c);
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 4.2, 10), bodyMaterial);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const wing = new THREE.Mesh(makeWingGeometry(THREE, 6.2, 1.2, 0.1), bodyMaterial);
  wing.position.z = -0.2;
  group.add(wing);
  const tail = new THREE.Mesh(makeWingGeometry(THREE, 2.35, 0.58, 0.2), accentMaterial);
  tail.position.z = 1.5;
  group.add(tail);
  const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.58, 12), darkMaterial);
  cowling.rotation.x = Math.PI / 2;
  cowling.position.z = -2.15;
  group.add(cowling);
  const propeller = new THREE.Group();
  propeller.position.z = -2.48;
  for (let index = 0; index < 3; index += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.55, 0.04), darkMaterial);
    blade.position.y = 0.72;
    blade.rotation.z = index * Math.PI * 2 / 3;
    propeller.add(blade);
  }
  group.add(propeller);
  group.userData.propeller = propeller;
  return group;
}

function sourceFor(route) {
  return {
    id: route.id,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    engineLevel: 0,
    aircraftId: route.aircraftId || 'scout',
    active: false,
    speed: 0,
  };
}

export class AiTrafficAdapter {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.THREE = options.THREE || null;
    this.eventTarget = options.eventTarget || globalThis.window || null;
    this.routes = options.routes || DEFAULT_AI_ROUTES;
    this.quality = normalizeQuality(options.quality);
    this.playerRadius = Math.max(0.5, Number(options.playerRadius) || 2.5);
    this.aircraftRadius = Math.max(1, Number(options.aircraftRadius) || 4.5);
    this.collisionEvents = options.collisionEvents !== false;
    this.simTime = 0;
    this.disposed = false;
    this.errorCount = 0;
    this.collisionCount = 0;
    this.previousPlayer = { x: 0, y: 0, z: 0 };
    this.hasPreviousPlayer = false;
    this.root = null;

    if (options.visuals !== false && this.scene && this.THREE) {
      this.root = new this.THREE.Group();
      this.root.name = 'Skyline worker AI traffic';
      this.scene.add(this.root);
    }

    this.aircraft = this.routes.map((route, index) => {
      const sample = sampleEllipticalRoute(route, 0);
      const model = this.root ? buildAircraft(this.THREE, route) : null;
      if (model) {
        model.position.set(sample.position.x, sample.position.y, sample.position.z);
        this.root.add(model);
      }
      const source = sourceFor(route);
      Object.assign(source.position, sample.position);
      Object.assign(source.velocity, sample.velocity);
      source.speed = length3(sample.velocity);
      source.engineLevel = clamp(0.18 + source.speed / 115, 0.18, 0.92);
      return {
        index,
        route,
        model,
        source,
        physicsPrevious: { ...sample.position },
        physicsPosition: { ...sample.position },
        renderFrom: { ...sample.position },
        renderTo: { ...sample.position },
        renderPosition: { ...sample.position },
        renderAccumulator: 0,
        renderInterval: 1 / this.quality.aiNearHz,
        collisionCooldown: 0,
        active: false,
        failed: false,
      };
    });
    this.setQuality(this.quality.id);
  }

  setQuality(level) {
    this.quality = normalizeQuality(level);
    this.activeCount = Math.min(this.aircraft.length, this.quality.aiCount);
    this.aircraft.forEach((entry, index) => {
      entry.active = !entry.failed && index < this.activeCount;
      entry.source.active = entry.active;
      if (entry.model) entry.model.visible = entry.active;
    });
  }

  _updateEntryPhysics(entry, safeDt, player) {
    entry.collisionCooldown = Math.max(0, entry.collisionCooldown - safeDt);
    entry.physicsPrevious = { ...entry.physicsPosition };
    const sample = sampleEllipticalRoute(entry.route, this.simTime);
    entry.physicsPosition = sample.position;
    Object.assign(entry.source.position, sample.position);
    Object.assign(entry.source.velocity, sample.velocity);
    entry.source.speed = length3(sample.velocity);
    entry.source.engineLevel = clamp(0.18 + entry.source.speed / 115, 0.18, 0.92);
    entry.source.active = true;

    const distance = player
      ? Math.sqrt(distanceSquared(player, sample.position))
      : 0;
    const hz = distance > this.quality.aiFarDistance
      ? this.quality.aiFarHz
      : this.quality.aiNearHz;
    entry.renderInterval = 1 / Math.max(1, hz);
    entry.renderAccumulator += safeDt;
    if (entry.renderAccumulator >= entry.renderInterval) {
      entry.renderAccumulator %= entry.renderInterval;
      entry.renderFrom = { ...entry.renderPosition };
      entry.renderTo = { ...sample.position };
    }
  }

  _checkCollision(entry, player) {
    if (
      !this.collisionEvents ||
      !player ||
      !this.hasPreviousPlayer ||
      entry.collisionCooldown > 0
    ) return;
    const approach = movingSphereClosestApproach(
      this.previousPlayer,
      player,
      entry.physicsPrevious,
      entry.physicsPosition,
    );
    if (approach.distance > this.playerRadius + this.aircraftRadius) return;
    entry.collisionCooldown = 4;
    this.collisionCount += 1;
    dispatchDetail(this.eventTarget, 'skyline:ai-collision', {
      id: entry.route.id,
      aircraftId: entry.route.aircraftId || 'scout',
      distance: approach.distance,
      time: approach.time,
      position: { ...entry.physicsPosition },
      responseOwner: 'game-state-owner',
      mutatesFlight: false,
    });
  }

  fixedStepUpdate(dt, flight, phase = 'flying') {
    if (this.disposed) return;
    const safeDt = clamp(dt, 0, 1 / 20);
    if (phase === 'flying') this.simTime += safeDt;
    const player = flight?.position ? point3(flight.position) : null;

    for (const entry of this.aircraft) {
      if (!entry.active) {
        entry.source.active = false;
        continue;
      }
      try {
        this._updateEntryPhysics(entry, safeDt, player);
        if (phase === 'flying') this._checkCollision(entry, player);
      } catch {
        entry.failed = true;
        entry.active = false;
        entry.source.active = false;
        if (entry.model) entry.model.visible = false;
        this.errorCount += 1;
      }
    }

    if (player) {
      this.previousPlayer = player;
      this.hasPreviousPlayer = true;
    }
  }

  update(dt, _flight, _camera, _phase = 'flying') {
    if (this.disposed) return;
    const safeDt = clamp(dt, 0, 0.1);
    for (const entry of this.aircraft) {
      if (!entry.active) continue;
      try {
        const alpha = clamp(
          entry.renderAccumulator / Math.max(1e-6, entry.renderInterval),
          0,
          1,
        );
        lerpPoint(entry.renderPosition, entry.renderFrom, entry.renderTo, alpha);
        if (entry.model) {
          entry.model.position.set(
            entry.renderPosition.x,
            entry.renderPosition.y,
            entry.renderPosition.z,
          );
          const velocity = entry.source.velocity;
          this._visualVelocity ||= new this.THREE.Vector3();
          this._forward ||= new this.THREE.Vector3(0, 0, -1);
          this._visualVelocity.set(velocity.x, velocity.y, velocity.z);
          if (this._visualVelocity.lengthSq() > 1e-8) {
            this._visualVelocity.normalize();
            entry.model.quaternion.setFromUnitVectors(this._forward, this._visualVelocity);
          }
          entry.model.userData.propeller.rotation.z += safeDt * (24 + entry.source.engineLevel * 28);
        }
      } catch {
        entry.failed = true;
        entry.active = false;
        entry.source.active = false;
        if (entry.model) entry.model.visible = false;
        this.errorCount += 1;
      }
    }
  }

  getAudioSources() {
    return this.aircraft
      .filter(entry => entry.active && entry.source.active)
      .map(entry => entry.source);
  }

  getStatus() {
    return {
      active: !this.disposed,
      visibleAircraft: this.aircraft.filter(entry => entry.active).length,
      limit: this.activeCount,
      totalRoutes: this.routes.length,
      collisionEvents: this.collisionEvents,
      collisionCount: this.collisionCount,
      directGameStateMutation: false,
      interpolation: 'distance-cadenced-linear',
      sourceContract: ['id', 'position', 'velocity', 'engineLevel', 'aircraftId', 'active'],
      errorsIsolated: this.errorCount,
      quality: this.quality.id,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
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
    this.aircraft.forEach(entry => {
      entry.active = false;
      entry.source.active = false;
    });
  }
}
