import * as THREE from '../../vendor/three.module.min.js';

function aircraftShape(color, accent, glider = false) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.08,
  });
  const accentMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    toneMapped: false,
  });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.42, glider ? 8 : 6, 10),
    bodyMaterial,
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const wings = new THREE.Mesh(
    new THREE.BoxGeometry(glider ? 20 : 11, 0.22, glider ? 1 : 1.5),
    bodyMaterial,
  );
  wings.position.z = 0.3;
  group.add(wings);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(glider ? 5 : 3.8, 0.18, 0.8),
    accentMaterial,
  );
  tail.position.z = 2.4;
  group.add(tail);
  return group;
}

function birdShape() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0x25231f,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      0, 0, 0,
      -2.4, 0.45, 0.4,
      -0.15, 0.05, 0.2,
      0, 0, 0,
      2.4, 0.45, 0.4,
      0.15, 0.05, 0.2,
    ], 3),
  );
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, material));
  group.scale.setScalar(2.2);
  return group;
}

export class NearWorldSystem {
  constructor(scene, spawn) {
    this.scene = scene;
    this.spawn = spawn;
    this.phoneMode = false;
    this.elapsed = 0;
    this.gates = [];
    this.actors = [];
    this.collisionCooldown = 0;
    this.root = new THREE.Group();
    this.root.name = 'skyline-visible-world-expansion';
    scene.add(this.root);
    this.buildGates();
    this.buildActors();
  }

  setPhoneMode(phone) {
    this.phoneMode = Boolean(phone);
    this.applyBudget();
  }

  buildGates() {
    const [sx, sy, sz] = this.spawn;
    const positions = [
      [sx, sy - 18, sz - 300],
      [sx + 220, sy - 85, sz - 720],
      [sx - 260, sy - 150, sz - 1160],
    ];
    positions.forEach((position, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0xffcc67 : 0x87c9ff,
        transparent: true,
        opacity: 0.88,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(34 - index * 2, 2.8, 12, 52),
        material,
      );
      ring.position.set(...position);
      ring.name = `skyline-route-gate-${index + 1}`;
      this.root.add(ring);
      this.gates.push({
        object: ring,
        position: ring.position.clone(),
        radius: 40,
        used: false,
        chain: index + 1,
      });
    });
  }

  addActor(object, values) {
    object.position.copy(values.center);
    object.name = values.name;
    this.root.add(object);
    this.actors.push({ object, ...values });
  }

  buildActors() {
    const [sx, sy, sz] = this.spawn;
    for (let flock = 0; flock < 2; flock += 1) {
      for (let index = 0; index < 7; index += 1) {
        this.addActor(birdShape(), {
          type: 'bird',
          name: `skyline-bird-${flock}-${index}`,
          center: new THREE.Vector3(
            sx + (flock ? 250 : -190),
            sy - 55 - flock * 42,
            sz - 340 - flock * 280,
          ),
          radiusX: 62 + index * 4,
          radiusZ: 52 + index * 3,
          speed: (flock ? -1 : 1) * (0.22 + index * 0.012),
          phase: index * 0.72,
          phoneAllowed: index < 4,
        });
      }
    }

    const values = [
      {
        type: 'ai',
        name: 'skyline-ai-zero',
        object: aircraftShape(0xd9d2bd, 0xb33a30),
        center: new THREE.Vector3(sx + 260, sy - 40, sz - 650),
        radiusX: 300,
        radiusZ: 240,
        speed: 0.105,
        phase: 0.2,
        phoneAllowed: true,
      },
      {
        type: 'ai',
        name: 'skyline-ai-stuka',
        object: aircraftShape(0x586354, 0xc4b57c),
        center: new THREE.Vector3(sx - 410, sy - 95, sz - 930),
        radiusX: 370,
        radiusZ: 290,
        speed: -0.077,
        phase: 1.8,
        phoneAllowed: false,
      },
      {
        type: 'ai',
        name: 'skyline-ai-scout',
        object: aircraftShape(0x87989e, 0x343b3f),
        center: new THREE.Vector3(sx + 560, sy - 145, sz - 1220),
        radiusX: 430,
        radiusZ: 340,
        speed: 0.062,
        phase: 3.5,
        phoneAllowed: false,
      },
      {
        type: 'sailplane',
        name: 'skyline-sailplane-1',
        object: aircraftShape(0xe6e0cf, 0xe1763d, true),
        center: new THREE.Vector3(sx + 470, sy + 20, sz - 820),
        radiusX: 250,
        radiusZ: 190,
        speed: 0.052,
        phase: 0.8,
        phoneAllowed: true,
      },
      {
        type: 'sailplane',
        name: 'skyline-sailplane-2',
        object: aircraftShape(0xd9dfdf, 0x53728a, true),
        center: new THREE.Vector3(sx - 530, sy - 20, sz - 1080),
        radiusX: 290,
        radiusZ: 220,
        speed: -0.046,
        phase: 2.5,
        phoneAllowed: false,
      },
    ];

    for (const actor of values) {
      const { object, ...rest } = actor;
      this.addActor(object, rest);
    }
    this.applyBudget();
  }

  applyBudget() {
    for (const actor of this.actors) {
      actor.object.visible = !this.phoneMode || actor.phoneAllowed;
    }
  }

  fixedStepUpdate(_dt, flight) {
    for (const gate of this.gates) {
      if (gate.used) continue;
      if (flight.position.distanceTo(gate.position) <= gate.radius) {
        gate.used = true;
        gate.object.material.opacity = 0.22;
        flight.applyBoostImpulse?.(14 + gate.chain * 2, 0.9);
        globalThis.window?.dispatchEvent?.(
          new CustomEvent('skyline:boost-fired', {
            detail: {
              impulse: 14 + gate.chain * 2,
              speed: flight.speed,
              chain: gate.chain,
              name: `ROUTE ${gate.chain}`,
            },
          }),
        );
      }
    }
  }

  update(dt, flight) {
    const safeDt = Math.min(0.1, Math.max(0, Number(dt) || 0));
    this.elapsed += safeDt;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - safeDt);
    for (const actor of this.actors) {
      if (!actor.object.visible) continue;
      const angle = this.elapsed * actor.speed + actor.phase;
      actor.object.position.set(
        actor.center.x + Math.cos(angle) * actor.radiusX,
        actor.center.y + Math.sin(angle * 1.7) *
          (
            actor.type === 'bird'
              ? 8
              : actor.type === 'sailplane'
                ? 13
                : 18
          ),
        actor.center.z + Math.sin(angle) * actor.radiusZ,
      );
      const direction =
        Math.sign(actor.speed || 1);

      actor.object.rotation.set(
        Math.sin(angle * 1.7) * 0.035,
        -angle +
          (
            direction > 0
              ? Math.PI / 2
              : -Math.PI / 2
          ),
        actor.type === 'bird'
          ? -direction * 0.12
          : actor.type === 'sailplane'
            ? -direction * 0.14
            : -direction * 0.22,
        'YXZ',
      );
      if (
        actor.type === 'ai' &&
        this.collisionCooldown <= 0 &&
        actor.object.position.distanceTo(flight.position) < 10
      ) {
        this.collisionCooldown = 2;
        globalThis.window?.dispatchEvent?.(
          new CustomEvent('skyline:ai-collision', {
            detail: { id: actor.name },
          }),
        );
      }
    }
  }

  getStatus() {
    return Object.freeze({
      gates: this.gates.length,
      unusedGates: this.gates.filter(gate => !gate.used).length,
      visibleBirds: this.actors.filter(
        actor => actor.type === 'bird' && actor.object.visible,
      ).length,
      visibleAI: this.actors.filter(
        actor => actor.type === 'ai' && actor.object.visible,
      ).length,
      visibleSailplanes: this.actors.filter(
        actor => actor.type === 'sailplane' && actor.object.visible,
      ).length,
      phoneMode: this.phoneMode,
    });
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
  }
}
