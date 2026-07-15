import * as THREE from '../../vendor/three.module.min.js';
import {
  movingSphereClosestApproach,
  sampleEllipticalRoute,
} from './math.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const tangent = new THREE.Vector3();

const DEFAULT_ROUTES = Object.freeze([
  Object.freeze({ id: 'patrol-1', center: [800, 520, 400], radiusX: 1250, radiusZ: 820, angularSpeed: 0.05, phase: 0.1, verticalAmplitude: 70, color: 0xd8d3c4, accent: 0xb73c31 }),
  Object.freeze({ id: 'patrol-2', center: [-1400, 390, 1300], radiusX: 980, radiusZ: 1400, angularSpeed: 0.043, phase: 1.6, verticalAmplitude: 55, color: 0x586354, accent: 0xc4b57c }),
  Object.freeze({ id: 'patrol-3', center: [1700, 700, -1300], radiusX: 1500, radiusZ: 900, angularSpeed: 0.037, phase: 3.1, verticalAmplitude: 85, color: 0x8e9da0, accent: 0x343b3f }),
  Object.freeze({ id: 'patrol-4', center: [-1700, 820, -900], radiusX: 1100, radiusZ: 1350, angularSpeed: 0.034, phase: 4.3, verticalAmplitude: 90, color: 0xd7d0b9, accent: 0x8f3d34 }),
  Object.freeze({ id: 'city-runner', center: [200, 260, -300], radiusX: 850, radiusZ: 720, angularSpeed: 0.058, phase: 5.2, verticalAmplitude: 35, color: 0x4d5960, accent: 0xc7a45b }),
]);

function makeMaterial(color) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    fog: true,
    side: THREE.DoubleSide,
  });
}

function makeWingGeometry(span, chord, sweep = 0.25) {
  const halfSpan = span * 0.5;
  const halfChord = chord * 0.5;
  const positions = new Float32Array([
    0, 0, -halfChord,
    -halfSpan, 0, halfChord * sweep,
    0, 0, halfChord,
    0, 0, -halfChord,
    0, 0, halfChord,
    halfSpan, 0, halfChord * sweep,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildAircraft(route) {
  const group = new THREE.Group();
  group.name = `AI aircraft ${route.id}`;

  const bodyMaterial = makeMaterial(route.color);
  const accentMaterial = makeMaterial(route.accent);
  const darkMaterial = makeMaterial(0x252a2c);

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.42, 4.2, 10),
    bodyMaterial,
  );
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const wing = new THREE.Mesh(
    makeWingGeometry(6.2, 1.2, 0.1),
    bodyMaterial,
  );
  wing.position.z = -0.2;
  group.add(wing);

  const tail = new THREE.Mesh(
    makeWingGeometry(2.35, 0.58, 0.2),
    accentMaterial,
  );
  tail.position.z = 1.5;
  group.add(tail);

  const finGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 1.25),
    new THREE.Vector3(0, 1.0, 1.55),
    new THREE.Vector3(0, 0, 1.75),
  ]);
  finGeometry.computeVertexNormals();
  const fin = new THREE.Mesh(finGeometry, accentMaterial);
  group.add(fin);

  const cowling = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.58, 12),
    darkMaterial,
  );
  cowling.rotation.x = Math.PI / 2;
  cowling.position.z = -2.15;
  group.add(cowling);

  const propeller = new THREE.Group();
  propeller.position.z = -2.48;

  for (let index = 0; index < 3; index += 1) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.55, 0.04),
      darkMaterial,
    );
    blade.position.y = 0.72;
    blade.rotation.z = index * Math.PI * 2 / 3;
    propeller.add(blade);
  }

  group.add(propeller);
  group.userData.propeller = propeller;

  return group;
}

function dispatchCollision(detail) {
  if (
    typeof globalThis.window?.dispatchEvent !== 'function' ||
    typeof globalThis.CustomEvent !== 'function'
  ) {
    return;
  }

  globalThis.window.dispatchEvent(
    new globalThis.CustomEvent('skyline:ai-collision', {
      detail,
    }),
  );
}

export class AiAircraftSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.elapsed = 0;
    this.playerRadius = Math.max(0.5, Number(options.playerRadius) || 2.5);
    this.aircraftRadius = Math.max(1, Number(options.aircraftRadius) || 4.5);
    this.previousPlayerPosition = new THREE.Vector3();
    this.hasPreviousPlayerPosition = false;
    this.nearestDistance = Infinity;

    this.root = new THREE.Group();
    this.root.name = 'Failure-safe AI aircraft traffic';
    scene.add(this.root);

    const routes = options.routes ?? DEFAULT_ROUTES;
    this.aircraft = routes.map(route => {
      const model = buildAircraft(route);
      const sample = sampleEllipticalRoute(route, 0);
      model.position.set(
        sample.position.x,
        sample.position.y,
        sample.position.z,
      );
      this.root.add(model);

      return {
        route,
        model,
        previousPosition: model.position.clone(),
        cooldown: 0,
        audioSource: {
          id: route.id,
          position: model.position,
          speed: 0,
        },
      };
    });
  }

  update(dt, flight, phase = 'flying') {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    if (phase === 'flying') this.elapsed += safeDt;
    this.nearestDistance = Infinity;

    const playerPosition = flight?.position;
    const hasPlayer = Boolean(playerPosition?.isVector3);

    if (
      hasPlayer &&
      (!this.hasPreviousPlayerPosition ||
        this.previousPlayerPosition.distanceTo(playerPosition) > 1200)
    ) {
      this.previousPlayerPosition.copy(playerPosition);
      this.hasPreviousPlayerPosition = true;
    }

    for (const aircraft of this.aircraft) {
      aircraft.cooldown = Math.max(0, aircraft.cooldown - safeDt);
      aircraft.previousPosition.copy(aircraft.model.position);

      const sample = sampleEllipticalRoute(aircraft.route, this.elapsed);
      aircraft.model.position.set(
        sample.position.x,
        sample.position.y,
        sample.position.z,
      );

      tangent.set(
        sample.tangent.x,
        sample.tangent.y,
        sample.tangent.z,
      );

      const routeSpeed = tangent.length();

      if (routeSpeed > 1e-4) {
        tangent.multiplyScalar(1 / routeSpeed);
        aircraft.model.quaternion.setFromUnitVectors(FORWARD, tangent);
      }

      aircraft.model.userData.propeller.rotation.z += safeDt * 42;
      aircraft.audioSource.speed = routeSpeed;

      if (!hasPlayer) continue;

      const distance = playerPosition.distanceTo(aircraft.model.position);
      this.nearestDistance = Math.min(this.nearestDistance, distance);

      if (phase !== 'flying' || aircraft.cooldown > 0) continue;

      const approach = movingSphereClosestApproach(
        this.previousPlayerPosition,
        playerPosition,
        aircraft.previousPosition,
        aircraft.model.position,
      );

      if (approach.distance > this.playerRadius + this.aircraftRadius) continue;

      aircraft.cooldown = 4;
      dispatchCollision({
        aircraft: aircraft.route.id,
        distance: approach.distance,
        time: approach.time,
        position: aircraft.model.position.toArray(),
      });
    }

    if (hasPlayer) this.previousPlayerPosition.copy(playerPosition);
  }

  getAudioSources() {
    return this.aircraft.map(aircraft => aircraft.audioSource);
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
