import * as THREE from '../../vendor/three.module.min.js';

export const AIRCRAFT_VISUAL_COLORS = Object.freeze({
  zeroIvory: 0xeee9dc,
  zeroIvoryShade: 0xc9cbc2,
  zeroRed: 0xb72f2b,
  zeroCowling: 0x171a1c,
  stukaOlive: 0x465244,
  stukaOliveDark: 0x2e3932,
  stukaUnderside: 0x9aa39d,
  stukaMarking: 0x191b1c,
  canopyGlass: 0x87a6ad,
  frame: 0x303636,
  panel: 0x24251f,
  line: 0x505754,
  leather: 0x4a3427,
  aluminum: 0xaeb6b4,
  brass: 0xad8a52,
  propeller: 0x25282a,
  propellerTip: 0xd5b45d,
});

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

export function addMesh(
  parent,
  geometry,
  material,
  position = null,
  rotation = null,
  scale = null,
  name = '',
) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  if (scale) object.scale.set(...scale);
  object.name = name;
  object.castShadow = false;
  object.receiveShadow = false;
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
) {
  return addMesh(
    parent,
    new THREE.BoxGeometry(...size),
    material,
    position,
    rotation,
    null,
    name,
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
) {
  return addMesh(
    parent,
    new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    material,
    position,
    null,
    scale,
    name,
  );
}

export function createLatheBodyGeometry(stations, radialSegments = 24) {
  const points = stations.map(([z, radius]) => new THREE.Vector2(radius, z));
  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addSurfaceVertex(
  positions,
  x,
  y,
  z,
) {
  positions.push(x, y, z);
}

function addGridFaces(indices, offset, spanSteps, chordSteps) {
  const row = chordSteps + 1;
  for (let span = 0; span < spanSteps; span += 1) {
    for (let chord = 0; chord < chordSteps; chord += 1) {
      const a = offset + span * row + chord;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
}

function addEdgeFaces(
  indices,
  topOffset,
  bottomOffset,
  spanSteps,
  chordSteps,
) {
  const row = chordSteps + 1;
  for (let span = 0; span < spanSteps; span += 1) {
    for (const chord of [0, chordSteps]) {
      const topA = topOffset + span * row + chord;
      const topB = topOffset + (span + 1) * row + chord;
      const bottomA = bottomOffset + span * row + chord;
      const bottomB = bottomOffset + (span + 1) * row + chord;
      if (chord === 0) {
        indices.push(topA, bottomA, topB, topB, bottomA, bottomB);
      } else {
        indices.push(topA, topB, bottomA, topB, bottomB, bottomA);
      }
    }
  }

  for (const span of [0, spanSteps]) {
    for (let chord = 0; chord < chordSteps; chord += 1) {
      const topA = topOffset + span * row + chord;
      const topB = topA + 1;
      const bottomA = bottomOffset + span * row + chord;
      const bottomB = bottomA + 1;
      if (span === 0) {
        indices.push(topA, topB, bottomA, topB, bottomB, bottomA);
      } else {
        indices.push(topA, bottomA, topB, topB, bottomA, bottomB);
      }
    }
  }
}

export function createEllipticalWingGeometry({
  side = 1,
  rootX = 0.34,
  semiSpan = 3.6,
  rootChord = 1.65,
  tipChord = 0.36,
  rootCenterZ = -0.08,
  sweep = 0.46,
  rootThickness = 0.15,
  tipThickness = 0.035,
  spanSteps = 12,
  chordSteps = 6,
  dihedral = null,
}) {
  const positions = [];
  const indices = [];
  const topOffset = 0;
  const samples = [];

  for (let span = 0; span <= spanSteps; span += 1) {
    const t = span / spanSteps;
    const ellipse = Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.72)));
    const chord = tipChord + (rootChord - tipChord) * Math.pow(ellipse, 0.72);
    const x = side * (rootX + semiSpan * t);
    const centerZ = rootCenterZ + sweep * Math.pow(t, 1.16);
    const centerY = typeof dihedral === 'function' ? dihedral(t) : 0;
    const thickness = tipThickness + (rootThickness - tipThickness) * Math.pow(1 - t, 0.72);

    samples.push({ x, chord, centerZ, centerY, thickness });

    for (let chordIndex = 0; chordIndex <= chordSteps; chordIndex += 1) {
      const c = chordIndex / chordSteps;
      const z = centerZ + (c - 0.52) * chord;
      const profile = Math.sin(Math.PI * c);
      const camber = profile * 0.018 * (1 - 0.35 * t);
      const y = centerY + camber + profile * thickness;
      addSurfaceVertex(positions, x, y, z);
    }
  }

  const bottomOffset = positions.length / 3;
  for (const sample of samples) {
    for (let chordIndex = 0; chordIndex <= chordSteps; chordIndex += 1) {
      const c = chordIndex / chordSteps;
      const z = sample.centerZ + (c - 0.52) * sample.chord;
      const profile = Math.sin(Math.PI * c);
      const camber = profile * 0.018;
      const y = sample.centerY + camber - profile * sample.thickness;
      addSurfaceVertex(positions, sample.x, y, z);
    }
  }

  addGridFaces(indices, topOffset, spanSteps, chordSteps);
  const reverse = [];
  addGridFaces(reverse, bottomOffset, spanSteps, chordSteps);
  for (let index = 0; index < reverse.length; index += 3) {
    indices.push(reverse[index], reverse[index + 2], reverse[index + 1]);
  }
  addEdgeFaces(indices, topOffset, bottomOffset, spanSteps, chordSteps);
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
  return geometry;
}

function interpolateSection(sections, t) {
  const scaled = t * (sections.length - 1);
  const index = Math.min(sections.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const a = sections[index];
  const b = sections[index + 1];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
    centerZ: a.centerZ + (b.centerZ - a.centerZ) * local,
    chord: a.chord + (b.chord - a.chord) * local,
    thickness: a.thickness + (b.thickness - a.thickness) * local,
  };
}

export function createGullWingGeometry({
  side = 1,
  sections,
  spanSteps = 14,
  chordSteps = 6,
}) {
  const normalized = sections.map(section => ({
    ...section,
    x: Math.abs(section.x),
  }));
  const positions = [];
  const indices = [];
  const samples = [];

  for (let span = 0; span <= spanSteps; span += 1) {
    const t = span / spanSteps;
    const sample = interpolateSection(normalized, t);
    sample.x *= side;
    samples.push(sample);
    for (let chordIndex = 0; chordIndex <= chordSteps; chordIndex += 1) {
      const c = chordIndex / chordSteps;
      const profile = Math.sin(Math.PI * c);
      const z = sample.centerZ + (c - 0.52) * sample.chord;
      addSurfaceVertex(
        positions,
        sample.x,
        sample.y + profile * sample.thickness,
        z,
      );
    }
  }

  const bottomOffset = positions.length / 3;
  for (const sample of samples) {
    for (let chordIndex = 0; chordIndex <= chordSteps; chordIndex += 1) {
      const c = chordIndex / chordSteps;
      const profile = Math.sin(Math.PI * c);
      const z = sample.centerZ + (c - 0.52) * sample.chord;
      addSurfaceVertex(
        positions,
        sample.x,
        sample.y - profile * sample.thickness,
        z,
      );
    }
  }

  addGridFaces(indices, 0, spanSteps, chordSteps);
  const reverse = [];
  addGridFaces(reverse, bottomOffset, spanSteps, chordSteps);
  for (let index = 0; index < reverse.length; index += 3) {
    indices.push(reverse[index], reverse[index + 2], reverse[index + 1]);
  }
  addEdgeFaces(indices, 0, bottomOffset, spanSteps, chordSteps);
  if (side < 0) {
    for (let index = 0; index < indices.length; index += 3) {
      const swap = indices[index + 1];
      indices[index + 1] = indices[index + 2];
      indices[index + 2] = swap;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();
  return geometry;
}

export function createPlanformGeometry(points, thickness = 0.08) {
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
    bevelThickness: Math.min(0.015, thickness * 0.18),
    bevelSize: 0.012,
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
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness * 0.5, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

export function createWedgeGeometry({
  frontZ,
  backZ,
  frontWidth,
  backWidth,
  frontHeight,
  backHeight,
  baseY = 0,
}) {
  const fw = frontWidth * 0.5;
  const bw = backWidth * 0.5;
  const positions = [
    -fw, baseY, frontZ,
     fw, baseY, frontZ,
    -fw * 0.78, baseY + frontHeight, frontZ,
     fw * 0.78, baseY + frontHeight, frontZ,
    -bw, baseY, backZ,
     bw, baseY, backZ,
    -bw * 0.78, baseY + backHeight, backZ,
     bw * 0.78, baseY + backHeight, backZ,
  ];
  const indices = [
    0, 1, 2, 1, 3, 2,
    4, 6, 5, 5, 6, 7,
    0, 2, 4, 4, 2, 6,
    1, 5, 3, 5, 7, 3,
    2, 3, 6, 3, 7, 6,
    0, 4, 1, 1, 4, 5,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function addBeamBetween(
  parent,
  start,
  end,
  radius,
  material,
  segments = 6,
  name = '',
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
  );
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return beam;
}

export function addPanelLine(parent, points, material, closed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(point => new THREE.Vector3(...point)),
  );
  const line = closed && THREE.LineLoop
    ? new THREE.LineLoop(geometry, material)
    : new THREE.Line(geometry, material);
  line.frustumCulled = false;
  parent.add(line);
  return line;
}

export function addHorizontalDisk(
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
  disk.renderOrder = 3;
  return disk;
}

export function addSideDisk(
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
  disk.renderOrder = 3;
  return disk;
}

export function createPropellerBladeGeometry({
  length = 1.55,
  rootWidth = 0.09,
  midWidth = 0.15,
  tipWidth = 0.075,
  depth = 0.045,
} = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-rootWidth * 0.5, 0.12);
  shape.quadraticCurveTo(-midWidth, length * 0.38, -midWidth * 0.86, length * 0.72);
  shape.quadraticCurveTo(-tipWidth, length * 0.94, -tipWidth * 0.40, length);
  shape.quadraticCurveTo(tipWidth * 0.45, length * 1.02, tipWidth, length * 0.91);
  shape.quadraticCurveTo(midWidth * 0.78, length * 0.58, rootWidth * 0.5, 0.12);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  return geometry;
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
  group.name = `gauge-${label.toLowerCase()}`;

  addCylinder(
    group,
    radius,
    radius,
    0.055,
    [0, 0, 0],
    materials.gaugeCasing,
    [Math.PI / 2, 0, 0],
    24,
  );
  addMesh(
    group,
    new THREE.CircleGeometry(radius * 0.86, 24),
    materials.gaugeFace,
    [0, 0, -0.031],
  );

  const tickGeometry = new THREE.BoxGeometry(
    radius * 0.045,
    radius * 0.16,
    0.018,
  );
  const ticks = new THREE.InstancedMesh(
    tickGeometry,
    materials.gaugeMark,
    12,
  );
  ticks.name = `gauge-${label.toLowerCase()}-ticks`;
  ticks.castShadow = false;
  ticks.receiveShadow = false;
  const tickMatrix = new THREE.Matrix4();
  const tickPosition = new THREE.Vector3();
  const tickQuaternion = new THREE.Quaternion();
  const tickScale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < 12; index += 1) {
    const angle = -Math.PI * 0.82 + index / 11 * Math.PI * 1.64;
    tickPosition.set(
      Math.cos(angle) * radius * 0.67,
      Math.sin(angle) * radius * 0.67,
      -0.045,
    );
    tickQuaternion.setFromAxisAngle?.(
      new THREE.Vector3(0, 0, 1),
      angle - Math.PI / 2,
    );
    tickMatrix.compose(tickPosition, tickQuaternion, tickScale);
    ticks.setMatrixAt(index, tickMatrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  group.add(ticks);

  const needle = addBox(
    group,
    [radius * 0.055, radius * 0.70, 0.020],
    [0, radius * 0.22, -0.060],
    materials.gaugeNeedle,
  );
  needle.rotation.z = initialAngle;
  group.userData.needle = needle;
  group.userData.label = label;
  parent.add(group);
  return group;
}

export function disposeAircraftTree(root) {
  const geometries = new Set();
  const materials = new Set();
  root?.traverse?.(object => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of list) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose?.();
  for (const material of materials) material.dispose?.();
  root?.removeFromParent?.();
  return {
    geometriesDisposed: geometries.size,
    materialsDisposed: materials.size,
  };
}

export function collectVisualStats(root) {
  const geometries = new Set();
  const materials = new Set();
  let meshes = 0;
  let lines = 0;
  let vertices = 0;
  let transparentMaterials = 0;

  root?.traverse?.(object => {
    if (object.isMesh || object.type === 'Mesh') meshes += 1;
    if (object.isLine || object.type === 'Line' || object.type === 'LineLoop') lines += 1;
    if (object.geometry && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      vertices += object.geometry.attributes?.position?.count || 0;
    }
    const list = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of list) materials.add(material);
  });
  for (const material of materials) {
    if (material.transparent) transparentMaterials += 1;
  }
  return {
    meshes,
    lines,
    geometries: geometries.size,
    materials: materials.size,
    vertices,
    transparentMaterials,
  };
}
