import * as THREE_NAMESPACE
  from '../../vendor/three.module.min.js';

export const THREE =
  THREE_NAMESPACE;

export function standard(
  color,
  roughness = 0.72,
  metalness = 0.05,
  extra = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra,
  });
}

export function basic(
  color,
  extra = {},
) {
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
  name = '',
) {
  const object =
    new THREE.Mesh(
      geometry,
      material,
    );

  if (position) {
    object.position.set(...position);
  }

  if (rotation) {
    object.rotation.set(...rotation);
  }

  if (name) {
    object.name = name;
  }

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
    name,
  );
}

export function addCylinder(
  parent,
  radiusTop,
  radiusBottom,
  height,
  position,
  material,
  rotation = null,
  segments = 14,
  name = '',
) {
  return addMesh(
    parent,
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      segments,
      1,
      false,
    ),
    material,
    position,
    rotation,
    name,
  );
}

export function addSphere(
  parent,
  radius,
  position,
  material,
  scale = null,
  detail = 1,
  name = '',
) {
  const object =
    addMesh(
      parent,
      new THREE.IcosahedronGeometry(
        radius,
        detail,
      ),
      material,
      position,
      null,
      name,
    );

  if (scale) {
    object.scale.set(...scale);
  }

  return object;
}

function planformGeometry(
  points,
  thickness,
) {
  const shape =
    new THREE.Shape();

  const first =
    points[0];

  shape.moveTo(
    first[0],
    first[1],
  );

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    shape.lineTo(
      points[index][0],
      points[index][1],
    );
  }

  shape.closePath();

  const geometry =
    new THREE.ExtrudeGeometry(
      shape,
      {
        depth: thickness,
        bevelEnabled: false,
        steps: 1,
      },
    );

  geometry.rotateX(
    Math.PI / 2,
  );

  geometry.translate(
    0,
    -thickness / 2,
    0,
  );

  return geometry;
}

export function addMirroredPlanform(
  parent,
  points,
  thickness,
  material,
  position = [0, 0, 0],
  name = 'planform',
) {
  const root =
    new THREE.Group();

  root.name = name;
  root.position.set(...position);

  const geometry =
    planformGeometry(
      points,
      thickness,
    );

  const left =
    new THREE.Mesh(
      geometry,
      material,
    );

  left.name =
    `${name}-left`;

  left.scale.x = -1;

  const right =
    new THREE.Mesh(
      geometry.clone(),
      material,
    );

  right.name =
    `${name}-right`;

  root.add(left);
  root.add(right);
  parent.add(root);

  return root;
}

export function createGauge(
  parent,
  position,
  radius,
  label,
  materials = {},
) {
  const root =
    new THREE.Group();

  root.position.set(...position);
  root.name =
    `gauge-${label.toLowerCase()}`;

  const casing =
    materials.casing ||
    standard(
      0x17191a,
      0.72,
      0.18,
    );

  const face =
    materials.face ||
    basic(
      0xd7cfad,
      {
        toneMapped: false,
      },
    );

  const needleMaterial =
    materials.needle ||
    basic(
      0xa6332d,
      {
        toneMapped: false,
      },
    );

  const body =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius,
        radius,
        0.07,
        20,
      ),
      casing,
    );

  body.rotation.x =
    Math.PI / 2;

  root.add(body);

  const dial =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        radius * 0.82,
        24,
      ),
      face,
    );

  dial.position.z = -0.04;
  root.add(dial);

  const needle =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        radius * 0.08,
        radius * 0.72,
        0.018,
      ),
      needleMaterial,
    );

  needle.position.set(
    0,
    radius * 0.25,
    -0.055,
  );

  needle.userData =
    needle.userData || {};

  root.add(needle);

  root.userData.needle =
    needle;

  parent.add(root);

  return root;
}
