import * as THREE from '../../vendor/three.module.min.js';

export const ZERO_COLORS = Object.freeze({
  ivory: 0xeeeade,
  ivoryShade: 0xc9cbc4,
  red: 0xb62f2b,
  redDark: 0x7f211f,
  cowling: 0x171a1b,
  frame: 0x303838,
  panel: 0x24251f,
  leather: 0x4b3427,
  aluminum: 0xaeb5b3,
  glass: 0x8aa9b0,
  line: 0x555c59,
  brass: 0xb49357,
});

export function standard(color, roughness = 0.7, metalness = 0.08, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra,
  });
}

export function basic(color, extra = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    ...extra,
  });
}

export function addMesh(
  parent,
  geometry,
  material,
  position = null,
  rotation = null,
  scale = null,
) {
  const object = new THREE.Mesh(geometry, material);

  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  if (scale) object.scale.set(...scale);

  object.castShadow = false;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}

export function addBox(parent, size, position, material, rotation = null) {
  return addMesh(
    parent,
    new THREE.BoxGeometry(...size),
    material,
    position,
    rotation,
  );
}

export function addCylinder(
  parent,
  radiusTop,
  radiusBottom,
  length,
  position,
  material,
  rotation = [Math.PI / 2, 0, 0],
  segments = 18,
  openEnded = false,
) {
  return addMesh(
    parent,
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      length,
      segments,
      1,
      openEnded,
    ),
    material,
    position,
    rotation,
  );
}

export function addSphere(
  parent,
  radius,
  position,
  material,
  scale = null,
  widthSegments = 16,
  heightSegments = 10,
) {
  return addMesh(
    parent,
    new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    material,
    position,
    null,
    scale,
  );
}

export function createHorizontalPlanformGeometry(points, thickness = 0.1) {
  const shape = new THREE.Shape();
  const [first, ...rest] = points;
  shape.moveTo(first[0], first[1]);

  for (const point of rest) {
    if (point.length === 4) {
      shape.quadraticCurveTo(point[0], point[1], point[2], point[3]);
    } else {
      shape.lineTo(point[0], point[1]);
    }
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: Math.min(0.024, thickness * 0.22),
    bevelSize: 0.018,
    bevelSegments: 1,
    curveSegments: 8,
  });

  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness * 0.5, 0);
  geometry.computeVertexNormals();
  return geometry;
}

export function createVerticalPlanformGeometry(points, thickness = 0.08) {
  const shape = new THREE.Shape();
  const [first, ...rest] = points;
  shape.moveTo(first[0], first[1]);

  for (const point of rest) {
    if (point.length === 4) {
      shape.quadraticCurveTo(point[0], point[1], point[2], point[3]);
    } else {
      shape.lineTo(point[0], point[1]);
    }
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: Math.min(0.018, thickness * 0.22),
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 8,
  });

  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness * 0.5, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

export function addHorizontalRoundel(
  parent,
  x,
  y,
  z,
  radius,
  material,
  underside = false,
) {
  const disk = addMesh(
    parent,
    new THREE.CircleGeometry(radius, 28),
    material,
    [x, y, z],
    [underside ? Math.PI / 2 : -Math.PI / 2, 0, 0],
  );

  disk.renderOrder = 2;
  return disk;
}

export function addSideRoundel(
  parent,
  side,
  x,
  y,
  z,
  radius,
  material,
) {
  const disk = addMesh(
    parent,
    new THREE.CircleGeometry(radius, 28),
    material,
    [side * x, y, z],
    [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0],
  );

  disk.renderOrder = 2;
  return disk;
}

export function addPanelLine(parent, points, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(point => new THREE.Vector3(...point)),
  );
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  parent.add(line);
  return line;
}

export function createPropellerBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.045, 0.12);
  shape.quadraticCurveTo(-0.11, 0.48, -0.13, 0.86);
  shape.quadraticCurveTo(-0.12, 1.28, -0.045, 1.56);
  shape.quadraticCurveTo(0.03, 1.68, 0.09, 1.45);
  shape.quadraticCurveTo(0.14, 1.03, 0.12, 0.66);
  shape.quadraticCurveTo(0.10, 0.30, 0.045, 0.12);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 8,
  });

  geometry.translate(0, 0, -0.0225);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGauge(parent, position, radius, label = '') {
  const group = new THREE.Group();
  group.position.set(...position);

  const casingMaterial = standard(ZERO_COLORS.panel, 0.78, 0.16);
  const faceMaterial = basic(0xd7cfad, { toneMapped: false });
  const markMaterial = basic(0x3c3c34, { toneMapped: false });
  const needleMaterial = basic(ZERO_COLORS.red, { toneMapped: false });

  const casing = addMesh(
    group,
    new THREE.CylinderGeometry(radius, radius, 0.055, 24),
    casingMaterial,
    null,
    [Math.PI / 2, 0, 0],
  );
  casing.position.z = 0;

  addMesh(
    group,
    new THREE.CircleGeometry(radius * 0.82, 24),
    faceMaterial,
    [0, 0, 0.032],
  );

  const tickGeometry = new THREE.BoxGeometry(
    radius * 0.045,
    radius * 0.18,
    0.012,
  );
  const ticks = new THREE.InstancedMesh(tickGeometry, markMaterial, 10);
  const tickMatrix = new THREE.Matrix4();
  const tickPosition = new THREE.Vector3();
  const tickQuaternion = new THREE.Quaternion();
  const tickScale = new THREE.Vector3(1, 1, 1);
  const tickAxis = new THREE.Vector3(0, 0, 1);

  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI * 0.78 + index / 9 * Math.PI * 1.56;
    tickPosition.set(
      Math.sin(angle) * radius * 0.61,
      Math.cos(angle) * radius * 0.61,
      0.043,
    );
    tickQuaternion.setFromAxisAngle(tickAxis, -angle);
    tickMatrix.compose(tickPosition, tickQuaternion, tickScale);
    ticks.setMatrixAt(index, tickMatrix);
  }

  ticks.instanceMatrix.needsUpdate = true;
  group.add(ticks);

  const needle = addBox(
    group,
    [radius * 0.055, radius * 0.76, 0.018],
    [0, radius * 0.25, 0.052],
    needleMaterial,
  );
  needle.geometry.translate(0, -radius * 0.25, 0);
  needle.rotation.z = -0.9;

  const hub = addMesh(
    group,
    new THREE.CircleGeometry(radius * 0.085, 12),
    markMaterial,
    [0, 0, 0.061],
  );
  hub.renderOrder = 3;

  group.userData.needle = needle;
  group.userData.label = label;
  parent.add(group);
  return group;
}
