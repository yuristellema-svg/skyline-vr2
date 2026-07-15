import * as THREE from '../vendor/three.module.min.js';

const GATES = Object.freeze([
  Object.freeze({ name: 'SKYLINE LAUNCH', position: [0, 600, 2050], yaw: 0, radius: 30 }),
  Object.freeze({ name: 'ALPINE NEEDLE', position: [310, 350, 3440], yaw: 0.28, radius: 35 }),
  Object.freeze({ name: 'CANYON BURN', position: [2940, 185, 830], yaw: 1.22, radius: 31 }),
  Object.freeze({ name: 'CITY THREAD', position: [1020, 205, -480], yaw: 0.62, radius: 28 }),
  Object.freeze({ name: 'RIVER RUN', position: [-420, 118, 300], yaw: 0.9, radius: 25 }),
  Object.freeze({ name: 'MIRROR LAKE', position: [-2110, 132, 2110], yaw: -0.72, radius: 33 }),
  Object.freeze({ name: 'OBSERVATORY', position: [-3150, 255, 2700], yaw: 1.88, radius: 29 }),
]);

const segment = new THREE.Vector3();
const fromStart = new THREE.Vector3();
const closest = new THREE.Vector3();
const direction = new THREE.Vector3();

function makeLabel(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');

  context.fillStyle = '#25231a';
  context.fillRect(8, 8, 496, 144);
  context.strokeStyle = '#d1bc78';
  context.lineWidth = 7;
  context.strokeRect(12, 12, 488, 136);
  context.strokeStyle = '#15140f';
  context.lineWidth = 2;
  context.strokeRect(24, 24, 464, 112);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f2e6be';
  context.font = '800 35px ui-monospace, Menlo, monospace';
  context.fillText(`BOOST · ${name}`, 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function segmentDistanceSquared(start, end, point) {
  segment.subVectors(end, start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared < 1e-8) return start.distanceToSquared(point);
  fromStart.subVectors(point, start);
  const t = THREE.MathUtils.clamp(fromStart.dot(segment) / lengthSquared, 0, 1);
  closest.copy(start).addScaledVector(segment, t);
  return closest.distanceToSquared(point);
}

function applyBoost(flight, chain, name) {
  const speed = Math.max(0, Number(flight?.speed) || flight?.velocity?.length?.() || 0);
  const impulse = Math.max(52, speed * (0.28 + chain * 0.014));

  direction.copy(flight?.velocity || new THREE.Vector3(0, 0, -1));
  if (direction.lengthSq() < 1e-8) flight?.getForward?.(direction);
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
  direction.normalize();

  flight.speed = Math.min(50000, speed + impulse);
  flight.velocity.copy(direction).multiplyScalar(flight.speed);
  flight.boostAmount = 1;
  flight.boostChain = chain;
  flight.boostJustTriggered = true;

  window.dispatchEvent(new CustomEvent('skyline:boost-fired', {
    detail: { impulse, speed: flight.speed, chain, name },
  }));
}

export class RouteSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.previousFlightPosition = new THREE.Vector3();
    this.hasPreviousPosition = false;
    this.root = new THREE.Group();
    this.root.name = 'boost-gate-network';
    scene.add(this.root);

    this.gates = GATES.map((definition, index) => {
      const group = new THREE.Group();
      group.position.fromArray(definition.position);
      group.rotation.y = definition.yaw;

      const material = new THREE.MeshBasicMaterial({
        color: 0xf1d476,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      });

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(definition.radius, 1.7, 10, 64),
        material,
      );
      group.add(ring);

      const innerMaterial = material.clone();
      innerMaterial.color.setHex(0xc34c3b);
      innerMaterial.opacity = 0.34;
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(definition.radius - 3.4, 0.7, 8, 52),
        innerMaterial,
      );
      group.add(inner);

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeLabel(definition.name),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        fog: true,
      }));
      sprite.scale.set(56, 17.5, 1);
      sprite.position.set(0, definition.radius + 18, 0);
      group.add(sprite);

      this.root.add(group);
      return { definition, index, group, ring, inner, material, innerMaterial, sprite, cooldown: 0 };
    });
  }

  update(dt, flight, camera, active = true) {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    this.elapsed += safeDt;
    this.chainTimer = Math.max(0, this.chainTimer - safeDt);
    if (this.chainTimer === 0) this.chain = 0;
    this.root.visible = active;
    if (!active || !flight?.position) return;

    for (const item of this.gates) {
      item.cooldown = Math.max(0, item.cooldown - safeDt);
      const distance = flight.position.distanceTo(item.group.position);
      item.group.visible = distance < Math.max(5200, camera?.far || 0);
      if (!item.group.visible) continue;

      const pulse = 0.5 + Math.sin(this.elapsed * 3.6 + item.index) * 0.5;
      item.ring.rotation.z += safeDt * 0.5;
      item.inner.rotation.z -= safeDt * 0.78;
      item.material.opacity = 0.52 + pulse * 0.28;
      item.innerMaterial.opacity = 0.24 + pulse * 0.24;
      item.sprite.material.opacity = distance < 1600 ? 0.78 : 0.42;

      const triggerRadius = item.definition.radius * 1.12;
      const crossed = this.hasPreviousPosition &&
        segmentDistanceSquared(
          this.previousFlightPosition,
          flight.position,
          item.group.position,
        ) <= triggerRadius * triggerRadius;

      if ((distance <= triggerRadius || crossed) && item.cooldown <= 0) {
        item.cooldown = 4;
        this.chain = this.chainTimer > 0 ? Math.min(12, this.chain + 1) : 1;
        this.chainTimer = 7;
        applyBoost(flight, this.chain, item.definition.name);
      }
    }

    this.previousFlightPosition.copy(flight.position);
    this.hasPreviousPosition = true;
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
      for (const material of materials) {
        material.map?.dispose?.();
        material.dispose?.();
      }
    });
  }
}
