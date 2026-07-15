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

function makeLabel(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');

  context.fillStyle = '#27271f';
  context.fillRect(8, 8, 496, 144);
  context.strokeStyle = '#c9b77f';
  context.lineWidth = 7;
  context.strokeRect(12, 12, 488, 136);
  context.strokeStyle = 'rgba(20, 18, 12, .85)';
  context.lineWidth = 2;
  context.strokeRect(24, 24, 464, 112);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#efe4bd';
  context.font = '800 35px ui-monospace, Menlo, monospace';
  context.fillText(`BOOST · ${name}`, 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class RouteSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;
    this.chain = 0;
    this.chainTimer = 0;
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
        opacity: 0.56,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      });

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(definition.radius, 1.35, 9, 52),
        material,
      );
      group.add(ring);

      const innerMaterial = material.clone();
      innerMaterial.color.setHex(0xc34c3b);
      innerMaterial.opacity = 0.28;
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(definition.radius - 3.3, 0.48, 7, 44),
        innerMaterial,
      );
      group.add(inner);

      const tickMaterial = new THREE.MeshBasicMaterial({
        color: 0xf8eac1,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        fog: true,
      });

      for (let tick = 0; tick < 12; tick += 1) {
        const angle = tick / 12 * Math.PI * 2;
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 5.8, 0.7),
          tickMaterial,
        );
        marker.position.set(
          Math.cos(angle) * definition.radius,
          Math.sin(angle) * definition.radius,
          0,
        );
        marker.rotation.z = angle;
        group.add(marker);
      }

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeLabel(definition.name),
        transparent: true,
        opacity: 0.58,
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
      item.group.visible = distance < Math.max(3600, camera?.far || 0);
      if (!item.group.visible) continue;

      const pulse = 0.5 + Math.sin(this.elapsed * 3.2 + item.index) * 0.5;
      item.ring.rotation.z += safeDt * 0.48;
      item.inner.rotation.z -= safeDt * 0.72;
      item.material.opacity = 0.46 + pulse * 0.22;
      item.innerMaterial.opacity = 0.2 + pulse * 0.2;
      item.sprite.material.opacity = distance < 1300 ? 0.68 : 0.32;

      if (distance <= item.definition.radius * 0.78 && item.cooldown <= 0) {
        item.cooldown = 4;
        this.chain = this.chainTimer > 0 ? Math.min(12, this.chain + 1) : 1;
        this.chainTimer = 7;
        window.dispatchEvent(new CustomEvent('skyline:boost-ring', {
          detail: {
            index: item.index,
            name: item.definition.name,
            chain: this.chain,
          },
        }));
      }
    }
  }

  dispose() {
    this.scene?.remove(this.root);
    this.root.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of materials) {
        material.map?.dispose?.();
        material.dispose?.();
      }
    });
  }
}
