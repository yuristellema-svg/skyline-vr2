import * as THREE from '../vendor/three.module.min.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const direction = new THREE.Vector3();
const tangent = new THREE.Vector3();

function material(color, roughness = 0.78) {
  return new THREE.MeshLambertMaterial({ color, roughness, fog: true });
}

function buildTrafficPlane(color, accent) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 3.4, 10),
    material(color),
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.09, 0.72),
    material(color),
  );
  wing.position.z = -0.15;
  group.add(wing);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.07, 0.4),
    material(color),
  );
  tail.position.z = 1.25;
  group.add(tail);

  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.78, 0.62),
    material(accent),
  );
  fin.position.set(0, 0.38, 1.18);
  group.add(fin);

  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.37, 0.5, 12),
    material(0x232628),
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -1.82;
  group.add(nose);

  const prop = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 2.0, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x24211b, transparent: true, opacity: 0.62 }),
  );
  prop.position.z = -2.12;
  group.add(prop);
  group.userData.prop = prop;
  return group;
}

const ROUTES = Object.freeze([
  Object.freeze({ center: [800, 520, 400], radiusX: 1250, radiusZ: 820, speed: 0.050, phase: 0.1, color: 0xd8d3c4, accent: 0xb73c31 }),
  Object.freeze({ center: [-1400, 390, 1300], radiusX: 980, radiusZ: 1400, speed: 0.043, phase: 1.6, color: 0x586354, accent: 0xc4b57c }),
  Object.freeze({ center: [1700, 700, -1300], radiusX: 1500, radiusZ: 900, speed: 0.037, phase: 3.1, color: 0x8e9da0, accent: 0x343b3f }),
  Object.freeze({ center: [-1700, 820, -900], radiusX: 1100, radiusZ: 1350, speed: 0.034, phase: 4.3, color: 0xd7d0b9, accent: 0x8f3d34 }),
  Object.freeze({ center: [200, 260, -300], radiusX: 850, radiusZ: 720, speed: 0.058, phase: 5.2, color: 0x4d5960, accent: 0xc7a45b }),
  Object.freeze({ center: [1000, 1050, 1600], radiusX: 1900, radiusZ: 1450, speed: 0.029, phase: 2.4, color: 0xbfc5c0, accent: 0x963f35 }),
]);

export class AiTrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;
    this.nearestDistance = Infinity;
    this.collisionLockout = 0;
    this.root = new THREE.Group();
    this.root.name = 'ai-air-traffic';
    scene.add(this.root);

    this.aircraft = ROUTES.map((route, index) => {
      const model = buildTrafficPlane(route.color, route.accent);
      model.scale.setScalar(index === 4 ? 1.2 : 1);
      this.root.add(model);
      return { route, model, previous: new THREE.Vector3() };
    });
  }

  update(dt, flight, phase = 'flying') {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    this.elapsed += safeDt;
    this.collisionLockout = Math.max(0, this.collisionLockout - safeDt);
    this.nearestDistance = Infinity;

    for (const item of this.aircraft) {
      const { route, model } = item;
      const angle = this.elapsed * route.speed + route.phase;
      item.previous.copy(model.position);
      model.position.set(
        route.center[0] + Math.cos(angle) * route.radiusX,
        route.center[1] + Math.sin(angle * 1.73) * 95,
        route.center[2] + Math.sin(angle) * route.radiusZ,
      );

      tangent.subVectors(model.position, item.previous);
      if (tangent.lengthSq() > 1e-7) {
        tangent.normalize();
        model.quaternion.setFromUnitVectors(FORWARD, tangent);
      }
      model.userData.prop.rotation.z += safeDt * 38;

      if (flight?.position) {
        const distance = flight.position.distanceTo(model.position);
        this.nearestDistance = Math.min(this.nearestDistance, distance);
        if (phase === 'flying' && distance < 7.5 && this.collisionLockout <= 0) {
          this.collisionLockout = 4;
          window.dispatchEvent(new CustomEvent('skyline:ai-collision', {
            detail: { distance, aircraft: 'TRAFFIC' },
          }));
        }
      }
    }
  }

  dispose() {
    this.scene?.remove(this.root);
    this.root.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
  }
}
