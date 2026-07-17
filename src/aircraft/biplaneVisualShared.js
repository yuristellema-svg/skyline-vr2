import * as THREE from '../../vendor/three.module.min.js';

export function standardMaterial(
  color,
  roughness = 0.7,
  metalness = 0.08,
  extra = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra,
  });
}

export function basicMaterial(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

export function lineMaterial(color, opacity = 0.48) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    fog: true,
  });
}

export function markDetail(object, level = 0) {
  object.userData.detailLevel = Math.max(0, Math.min(2, Math.trunc(level)));
  object.userData.baseVisible = object.visible !== false;
  return object;
}

export function addMesh(
  parent,
  geometry,
  material,
  position = null,
  rotation = null,
  scale = null,
  name = '',
  detailLevel = 0,
) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  if (scale) object.scale.set(...scale);
  object.name = name;
  object.castShadow = false;
  object.receiveShadow = false;
  markDetail(object, detailLevel);
  parent.add(object);
  return object;
}

export function addBox(
  parent,
  size,
  position,
  material,
  rotation = null,
  name = '',
  detailLevel = 0,
) {
  return addMesh(
    parent,
    new THREE.BoxGeometry(...size),
    material,
    position,
    rotation,
    null,
    name,
    detailLevel,
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
  name = '',
  detailLevel = 0,
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
    null,
    name,
    detailLevel,
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
  name = '',
  detailLevel = 0,
) {
  return addMesh(
    parent,
    new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
    ),
    material,
    position,
    null,
    scale,
    name,
    detailLevel,
  );
}

export function addBeamBetween(
  parent,
  start,
  end,
  radius,
  material,
  segments = 8,
  name = '',
  detailLevel = 0,
) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const midpoint = new THREE.Vector3().copy(a).add(b).multiplyScalar(0.5);
  const beam = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
    [midpoint.x, midpoint.y, midpoint.z],
    null,
    null,
    name,
    detailLevel,
  );

  if (length > 1e-6) {
    beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
  }
  return beam;
}

export function addCableBetween(
  parent,
  start,
  end,
  material,
  name = '',
  detailLevel = 1,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...start),
    new THREE.Vector3(...end),
  ]);
  const cable = new THREE.Line(geometry, material);
  cable.name = name;
  cable.frustumCulled = false;
  markDetail(cable, detailLevel);
  parent.add(cable);
  return cable;
}

export function addPanelLine(
  parent,
  points,
  material,
  name = '',
  detailLevel = 1,
  closed = false,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(point => new THREE.Vector3(...point)),
  );
  const line = closed && THREE.LineLoop
    ? new THREE.LineLoop(geometry, material)
    : new THREE.Line(geometry, material);
  line.name = name;
  line.frustumCulled = false;
  markDetail(line, detailLevel);
  parent.add(line);
  return line;
}

export function createLatheBodyGeometry(stations, radialSegments = 24) {
  const points = stations.map(([z, radius]) => new THREE.Vector2(radius, z));
  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();
  return geometry;
}

function addGridFaces(indices, offset, spanSteps, chordSteps, reverse = false) {
  const row = chordSteps + 1;
  for (let span = 0; span < spanSteps; span += 1) {
    for (let chord = 0; chord < chordSteps; chord += 1) {
      const a = offset + span * row + chord;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      if (reverse) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
}

function addEdgeFaces(indices, topOffset, bottomOffset, spanSteps, chordSteps) {
  const row = chordSteps + 1;
  for (let span = 0; span < spanSteps; span += 1) {
    for (const chord of [0, chordSteps]) {
      const ta = topOffset + span * row + chord;
      const tb = topOffset + (span + 1) * row + chord;
      const ba = bottomOffset + span * row + chord;
      const bb = bottomOffset + (span + 1) * row + chord;
      if (chord === 0) indices.push(ta, ba, tb, tb, ba, bb);
      else indices.push(ta, tb, ba, tb, bb, ba);
    }
  }

  for (const span of [0, spanSteps]) {
    for (let chord = 0; chord < chordSteps; chord += 1) {
      const ta = topOffset + span * row + chord;
      const tb = ta + 1;
      const ba = bottomOffset + span * row + chord;
      const bb = ba + 1;
      if (span === 0) indices.push(ta, tb, ba, tb, bb, ba);
      else indices.push(ta, ba, tb, tb, ba, bb);
    }
  }
}

/**
 * Fabric biplane wing with rounded tip, camber and non-zero thickness.
 * The resulting geometry is deliberately independent of the generic roster
 * helper so this package never needs to replace a shared production file.
 */
export function createFabricWingGeometry({
  side = 1,
  rootX = 0.50,
  semiSpan = 4.0,
  rootChord = 1.75,
  tipChord = 0.48,
  rootCenterZ = 0,
  sweep = 0.10,
  rootThickness = 0.10,
  tipThickness = 0.035,
  spanSteps = 18,
  chordSteps = 8,
  dihedral = 0.035,
  camber = 0.025,
} = {}) {
  const positions = [];
  const indices = [];
  const samples = [];

  for (let span = 0; span <= spanSteps; span += 1) {
    const t = span / spanSteps;
    const rounded = Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.25)));
    const chord = tipChord + (rootChord - tipChord) * Math.pow(rounded, 0.58);
    const x = side * (rootX + semiSpan * t);
    const centerZ = rootCenterZ + sweep * Math.pow(t, 1.12);
    const centerY = dihedral * Math.pow(t, 1.30);
    const thickness = tipThickness +
      (rootThickness - tipThickness) * Math.pow(1 - t, 0.72);
    samples.push({ x, centerZ, centerY, chord, thickness, t });

    for (let chordIndex = 0; chordIndex <= chordSteps; chordIndex += 1) {
      const c = chordIndex / chordSteps;
      const profile = Math.sin(Math.PI * c);
      const leadingBias = 0.50 + 0.035 * (1 - t);
      const z = centerZ + (c - leadingBias) * chord;
      const y = centerY + profile * thickness + profile * camber * (1 - 0.25 * t);
      positions.push(x, y, z);
    }
  }

  const bottomOffset = positions.length / 3;
  for (const sample of samples) {
    for (let chordIndex = 0; chordIndex <= chordSteps; chordIndex += 1) {
      const c = chordIndex / chordSteps;
      const profile = Math.sin(Math.PI * c);
      const leadingBias = 0.50 + 0.035 * (1 - sample.t);
      const z = sample.centerZ + (c - leadingBias) * sample.chord;
      const y = sample.centerY - profile * sample.thickness +
        profile * camber * 0.28;
      positions.push(sample.x, y, z);
    }
  }

  addGridFaces(indices, 0, spanSteps, chordSteps, false);
  addGridFaces(indices, bottomOffset, spanSteps, chordSteps, true);
  addEdgeFaces(indices, 0, bottomOffset, spanSteps, chordSteps);

  if (side < 0) {
    for (let index = 0; index < indices.length; index += 3) {
      const swap = indices[index + 1];
      indices[index + 1] = indices[index + 2];
      indices[index + 2] = swap;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();
  geometry.userData = {
    proceduralType: 'fabric-wing',
    side,
    spanSteps,
    chordSteps,
  };
  return geometry;
}

export function createPlanformGeometry(points, thickness = 0.06) {
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
    bevelThickness: Math.min(0.012, thickness * 0.18),
    bevelSize: 0.010,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness * 0.5, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  return geometry;
}

export function createVerticalPlanformGeometry(points, thickness = 0.06) {
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
    bevelThickness: 0.010,
    bevelSize: 0.009,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness * 0.5, 0, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  return geometry;
}

export function createPropellerBladeGeometry({
  length = 1.30,
  rootWidth = 0.10,
  midWidth = 0.18,
  tipWidth = 0.07,
  depth = 0.048,
} = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-rootWidth * 0.5, 0.12);
  shape.quadraticCurveTo(-midWidth, length * 0.36, -midWidth * 0.88, length * 0.72);
  shape.quadraticCurveTo(-tipWidth, length * 0.96, -tipWidth * 0.38, length);
  shape.quadraticCurveTo(tipWidth * 0.42, length * 1.02, tipWidth, length * 0.91);
  shape.quadraticCurveTo(midWidth * 0.76, length * 0.58, rootWidth * 0.5, 0.12);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  return geometry;
}

export function addHorizontalDisk(
  parent,
  x,
  y,
  z,
  radius,
  material,
  underside = false,
  name = '',
  detailLevel = 1,
) {
  const disk = addMesh(
    parent,
    new THREE.CircleGeometry(radius, 28),
    material,
    [x, y, z],
    [underside ? Math.PI / 2 : -Math.PI / 2, 0, 0],
    null,
    name,
    detailLevel,
  );
  disk.renderOrder = 3;
  return disk;
}

export function createGauge(
  parent,
  position,
  radius,
  label,
  materials,
  initialAngle = -1.4,
) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.name = `biplane-gauge-${label.toLowerCase()}`;
  markDetail(group, 0);

  addCylinder(
    group,
    radius,
    radius,
    0.055,
    [0, 0, 0],
    materials.gaugeCasing,
    [Math.PI / 2, 0, 0],
    24,
    false,
    `${group.name}-casing`,
  );
  addMesh(
    group,
    new THREE.CircleGeometry(radius * 0.86, 24),
    materials.gaugeFace,
    [0, 0, -0.031],
    null,
    null,
    `${group.name}-face`,
  );

  for (let index = 0; index < 11; index += 1) {
    const angle = -Math.PI * 0.80 + index / 10 * Math.PI * 1.60;
    const tick = addBox(
      group,
      [radius * 0.045, radius * 0.15, 0.014],
      [
        Math.cos(angle) * radius * 0.66,
        Math.sin(angle) * radius * 0.66,
        -0.044,
      ],
      materials.gaugeMark,
      [0, 0, angle - Math.PI / 2],
      `${group.name}-tick-${index + 1}`,
      2,
    );
    tick.userData.instrumentDetail = true;
  }

  const needle = addBox(
    group,
    [radius * 0.055, radius * 0.70, 0.020],
    [0, radius * 0.22, -0.060],
    materials.gaugeNeedle,
    null,
    `${group.name}-needle`,
  );
  needle.rotation.z = initialAngle;
  group.userData.needle = needle;
  group.userData.label = label;
  parent.add(group);
  return group;
}

export function setBiplaneDetailLevel(root, level = 1) {
  const resolved = Math.max(0, Math.min(2, Math.trunc(Number(level) || 0)));
  root?.traverse?.(object => {
    const required = Number(object.userData?.detailLevel ?? 0);
    const baseVisible = object.userData?.baseVisible !== false;
    object.visible = baseVisible && required <= resolved;
  });
  if (root?.userData) root.userData.activeDetailLevel = resolved;
  return resolved;
}

export function collectBiplaneVisualStats(root) {
  const geometries = new Set();
  const materials = new Set();
  let meshes = 0;
  let lines = 0;
  let vertices = 0;

  root?.traverse?.(object => {
    if (object.isMesh || object.type === 'Mesh') meshes += 1;
    if (object.isLine || object.type === 'Line' || object.type === 'LineLoop') lines += 1;
    if (object.geometry && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      vertices += Number(object.geometry.attributes?.position?.count) || 0;
    }
    const list = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of list) materials.add(material);
  });

  return {
    meshes,
    lines,
    geometries: geometries.size,
    materials: materials.size,
    vertices,
  };
}
