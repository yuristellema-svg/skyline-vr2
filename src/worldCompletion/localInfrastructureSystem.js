import * as THREE from '../../vendor/three.module.min.js';

function safeHeight(sampleHeight, x, z) {
  try {
    const value = sampleHeight?.(x, z);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function ribbonGeometry(points, width, sampleHeight) {
  const positions = [];
  const indices = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const previous =
      points[Math.max(0, index - 1)];
    const next =
      points[Math.min(points.length - 1, index + 1)];

    const dx = next[0] - previous[0];
    const dz = next[1] - previous[1];
    const length = Math.max(1e-6, Math.hypot(dx, dz));
    const rx = -dz / length * width * 0.5;
    const rz = dx / length * width * 0.5;
    const y =
      safeHeight(sampleHeight, point[0], point[1]) +
      0.14;

    positions.push(
      point[0] + rx, y, point[1] + rz,
      point[0] - rx, y, point[1] - rz,
    );

    if (index < points.length - 1) {
      const offset = index * 2;
      indices.push(
        offset,
        offset + 2,
        offset + 1,
        offset + 1,
        offset + 2,
        offset + 3,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export class LocalInfrastructureSystem {
  constructor({
    scene,
    manifest,
    sampleHeight,
  } = {}) {
    this.scene = scene;
    this.manifest = manifest;
    this.sampleHeight = sampleHeight;
    this.root = new THREE.Group();
    this.root.name =
      'skyline-settlement-local-infrastructure';
    this.scene.add(this.root);
    this.meshes = [];

    const roadMaterial =
      new THREE.MeshLambertMaterial({
        color: 0x3f3c35,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        fog: true,
      });

    const primaryMaterial =
      new THREE.MeshLambertMaterial({
        color: 0x343532,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        fog: true,
      });

    for (const road of manifest.roads ?? []) {
      if ((road.points?.length ?? 0) < 2) continue;
      const geometry =
        ribbonGeometry(
          road.points,
          Number(road.width) || 8,
          sampleHeight,
        );
      const mesh =
        new THREE.Mesh(
          geometry,
          road.class === 'primary'
            ? primaryMaterial
            : roadMaterial,
        );
      mesh.name = `settlement-local-road:${road.id}`;
      this.root.add(mesh);
      this.meshes.push(mesh);
    }
  }

  update() {}

  getStatus() {
    return Object.freeze({
      roadMeshes: this.meshes.length,
      drawCalls: this.meshes.length,
    });
  }

  dispose() {
    this.scene.remove(this.root);
    const materials = new Set();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      materials.add(mesh.material);
    }
    for (const material of materials) material.dispose();
    this.meshes.length = 0;
  }
}

export function createLocalInfrastructureSystem(options) {
  return new LocalInfrastructureSystem(options);
}
