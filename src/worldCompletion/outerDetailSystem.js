import * as THREE from '../../vendor/three.module.min.js';

function hash01(a, b, c = 0) {
  let value =
    (
      Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^
      Math.imul((b | 0) ^ 0xc2b2ae35, 0x27d4eb2f) ^
      Math.imul((c | 0) ^ 0x165667b1, 0x9e3779b1)
    ) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function safeHeight(sampleHeight, x, z) {
  try {
    const value = sampleHeight?.(x, z);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function distanceToRect(x, z, center, radius) {
  const dx = Math.max(0, Math.abs(x - center[0]) - radius[0]);
  const dz = Math.max(0, Math.abs(z - center[1]) - radius[1]);
  return Math.hypot(dx, dz);
}

function excluded(x, z, manifest) {
  for (const field of manifest.airfields ?? []) {
    const center = field.center;
    const radiusX =
      field.runwayLengthMeters * 0.65 +
      field.approachLengthMeters * 0.28;
    const radiusZ =
      field.clearWidthMeters * 0.8;
    if (
      Math.abs(x - center[0]) < radiusX &&
      Math.abs(z - center[1]) < radiusZ
    ) {
      return true;
    }
  }

  for (const settlement of manifest.settlements ?? []) {
    if (
      distanceToRect(
        x,
        z,
        settlement.center,
        [
          settlement.radius[0] + 170,
          settlement.radius[1] + 170,
        ],
      ) < 1
    ) {
      return true;
    }
  }

  return false;
}

function sampleRegionPoint(region, index, seed) {
  const angle =
    hash01(seed, index, 1) * Math.PI * 2;
  const radius =
    Math.sqrt(hash01(seed, index, 2));
  return [
    region.center[0] +
      Math.cos(angle) *
      region.radius[0] *
      radius,
    region.center[1] +
      Math.sin(angle) *
      region.radius[1] *
      radius,
  ];
}

function mergeGeometry(geometries) {
  const positions = [];
  const normals = [];
  const indices = [];
  let offset = 0;

  for (const geometry of geometries) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (const value of position.array) positions.push(value);
    for (const value of normal.array) normals.push(value);
    if (geometry.index) {
      for (const value of geometry.index.array) {
        indices.push(value + offset);
      }
    } else {
      for (let i = 0; i < position.count; i += 1) {
        indices.push(offset + i);
      }
    }
    offset += position.count;
  }

  const output = new THREE.BufferGeometry();
  output.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  output.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(normals, 3),
  );
  output.setIndex(indices);
  output.computeBoundingSphere();
  return output;
}

function createTreeGeometry(conifer) {
  const trunk = new THREE.CylinderGeometry(
    0.12,
    0.18,
    1.8,
    5,
  );
  trunk.translate(0, 0.9, 0);

  const crown = conifer
    ? new THREE.ConeGeometry(0.95, 3.5, 7)
    : new THREE.IcosahedronGeometry(1.25, 1);
  crown.translate(0, conifer ? 2.75 : 2.5, 0);

  const geometry = mergeGeometry([trunk, crown]);
  trunk.dispose();
  crown.dispose();
  return geometry;
}

function createFieldGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createPoleGeometry() {
  const pole = new THREE.CylinderGeometry(
    0.08,
    0.11,
    1,
    5,
  );
  pole.translate(0, 0.5, 0);
  return pole;
}

function matrixAt(
  mesh,
  index,
  x,
  y,
  z,
  yaw,
  scaleX,
  scaleY,
  scaleZ,
) {
  const matrix = new THREE.Matrix4();
  const quaternion =
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, yaw, 0),
    );
  matrix.compose(
    new THREE.Vector3(x, y, z),
    quaternion,
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );
  mesh.setMatrixAt(index, matrix);
}

export class OuterDetailSystem {
  constructor({
    scene,
    manifest,
    sampleHeight,
    phoneMode = false,
  } = {}) {
    this.scene = scene;
    this.manifest = manifest ?? {};
    this.sampleHeight = sampleHeight;
    this.phoneMode = Boolean(phoneMode);
    this.root = new THREE.Group();
    this.root.name = 'skyline-outer-world-detail-v1';
    this.scene.add(this.root);
    this.meshes = [];
    this.counts = {};
    this.rebuild();
  }

  _clear() {
    for (const mesh of this.meshes) {
      this.root.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes.length = 0;
  }

  _makeMesh(geometry, material, count, name) {
    const mesh =
      new THREE.InstancedMesh(
        geometry,
        material,
        count,
      );
    mesh.name = name;
    mesh.instanceMatrix.setUsage(
      THREE.StaticDrawUsage,
    );
    mesh.frustumCulled = true;
    this.root.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  rebuild() {
    this._clear();

    const outerRegions =
      (this.manifest.regions ?? []).filter(
        region =>
          region.id !== 'legacy-core' &&
          Array.isArray(region.center) &&
          Array.isArray(region.radius)
      );

    const coniferTarget =
      this.phoneMode ? 620 : 1280;
    const deciduousTarget =
      this.phoneMode ? 360 : 760;
    const rockTarget =
      this.phoneMode ? 170 : 340;
    const fieldTarget =
      this.phoneMode ? 52 : 96;
    const poleTarget =
      this.phoneMode ? 120 : 240;

    const conifer =
      this._makeMesh(
        createTreeGeometry(true),
        new THREE.MeshLambertMaterial({
          color: 0x28472e,
          flatShading: true,
          fog: true,
        }),
        coniferTarget,
        'outer conifer forests',
      );

    const deciduous =
      this._makeMesh(
        createTreeGeometry(false),
        new THREE.MeshLambertMaterial({
          color: 0x48663a,
          flatShading: true,
          fog: true,
        }),
        deciduousTarget,
        'outer deciduous groves',
      );

    const rocks =
      this._makeMesh(
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.MeshLambertMaterial({
          color: 0x696b64,
          flatShading: true,
          fog: true,
        }),
        rockTarget,
        'outer rock detail',
      );

    const fields =
      this._makeMesh(
        createFieldGeometry(),
        new THREE.MeshLambertMaterial({
          color: 0x7a7843,
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
          fog: true,
        }),
        fieldTarget,
        'outer agricultural fields',
      );

    const poles =
      this._makeMesh(
        createPoleGeometry(),
        new THREE.MeshLambertMaterial({
          color: 0x3e3327,
          flatShading: true,
          fog: true,
        }),
        poleTarget,
        'outer roadside utility poles',
      );

    const placeScatter = (
      mesh,
      target,
      seed,
      type,
    ) => {
      let placed = 0;
      let attempts = 0;

      while (
        placed < target &&
        attempts < target * 20
      ) {
        const region =
          outerRegions[
            attempts % Math.max(1, outerRegions.length)
          ] ?? {
            center: [0, 0],
            radius: [7000, 7000],
            kind: '',
          };

        const point =
          sampleRegionPoint(
            region,
            attempts,
            seed,
          );

        attempts += 1;

        if (
          Math.abs(point[0]) < 4200 &&
          Math.abs(point[1]) < 4200
        ) {
          continue;
        }

        if (excluded(point[0], point[1], this.manifest)) {
          continue;
        }

        const y =
          safeHeight(
            this.sampleHeight,
            point[0],
            point[1],
          );

        const random =
          hash01(seed, attempts, 8);
        const yaw =
          hash01(seed, attempts, 9) *
          Math.PI * 2;

        if (type === 'field') {
          matrixAt(
            mesh,
            placed,
            point[0],
            y + 0.08,
            point[1],
            yaw,
            110 + random * 130,
            1,
            65 + hash01(seed, attempts, 10) * 100,
          );
        } else if (type === 'rock') {
          const scale = 2.2 + random * 7.5;
          matrixAt(
            mesh,
            placed,
            point[0],
            y + scale * 0.34,
            point[1],
            yaw,
            scale,
            scale * (0.55 + random * 0.4),
            scale,
          );
        } else {
          const height =
            type === 'conifer'
              ? 4.8 + random * 8.8
              : 4.0 + random * 6.8;
          matrixAt(
            mesh,
            placed,
            point[0],
            y,
            point[1],
            yaw,
            height * (0.24 + random * 0.05),
            height,
            height * (0.24 + random * 0.05),
          );
        }

        placed += 1;
      }

      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      return placed;
    };

    const conifers =
      placeScatter(
        conifer,
        coniferTarget,
        1817,
        'conifer',
      );

    const deciduousCount =
      placeScatter(
        deciduous,
        deciduousTarget,
        4261,
        'deciduous',
      );

    const rockCount =
      placeScatter(
        rocks,
        rockTarget,
        7757,
        'rock',
      );

    const fieldCount =
      placeScatter(
        fields,
        fieldTarget,
        9911,
        'field',
      );

    let poleCount = 0;
    const roads = this.manifest.roads ?? [];

    for (
      let roadIndex = 0;
      roadIndex < roads.length &&
      poleCount < poleTarget;
      roadIndex += 1
    ) {
      const road = roads[roadIndex];
      const points = road.points ?? [];

      for (
        let segment = 0;
        segment < points.length - 1 &&
        poleCount < poleTarget;
        segment += 1
      ) {
        const a = points[segment];
        const b = points[segment + 1];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const length = Math.hypot(dx, dz);
        const count =
          Math.max(1, Math.floor(length / 150));

        for (
          let index = 0;
          index < count &&
          poleCount < poleTarget;
          index += 1
        ) {
          const t =
            (index + 0.5) / count;
          const x = a[0] + dx * t;
          const z = a[1] + dz * t;
          if (
            Math.abs(x) < 4100 &&
            Math.abs(z) < 4100
          ) {
            continue;
          }
          if (excluded(x, z, this.manifest)) continue;

          const rightX = -dz / Math.max(1, length);
          const rightZ = dx / Math.max(1, length);
          const side =
            poleCount % 2 === 0 ? -1 : 1;
          const px = x + rightX * 12 * side;
          const pz = z + rightZ * 12 * side;
          const y =
            safeHeight(this.sampleHeight, px, pz);

          matrixAt(
            poles,
            poleCount,
            px,
            y,
            pz,
            Math.atan2(dx, dz),
            1,
            8.5,
            1,
          );
          poleCount += 1;
        }
      }
    }

    poles.count = poleCount;
    poles.instanceMatrix.needsUpdate = true;

    this.counts = Object.freeze({
      conifers,
      deciduous: deciduousCount,
      rocks: rockCount,
      fields: fieldCount,
      utilityPoles: poleCount,
    });
  }

  setPhoneMode(value) {
    const phone = Boolean(value);
    if (phone !== this.phoneMode) {
      this.phoneMode = phone;
      this.rebuild();
    }
    return this.phoneMode;
  }

  update() {}

  getStatus() {
    return Object.freeze({
      active: true,
      phoneMode: this.phoneMode,
      counts: this.counts,
      drawCalls: this.meshes.length,
      categories: Object.freeze([
        'conifers',
        'deciduous',
        'rocks',
        'fields',
        'utility-poles',
      ]),
      privateAnimationLoops: 0,
    });
  }

  dispose() {
    this._clear();
    this.scene.remove(this.root);
  }
}

export function createOuterDetailSystem(options) {
  return new OuterDetailSystem(options);
}
