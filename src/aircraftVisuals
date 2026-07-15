import * as THREE from '../vendor/three.module.min.js';

const STORAGE_KEY = 'skyline-aircraft-profile';

export const AIRCRAFT_PROFILES = Object.freeze([
  Object.freeze({ id: 'glider', name: 'SKYLINE GLIDER' }),
  Object.freeze({ id: 'stuka', name: 'STUKA' }),
  Object.freeze({ id: 'scout', name: 'ALPINE SCOUT' }),
]);

function material(color, roughness = 0.76, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(
  parent,
  size,
  position,
  color,
  rotation = null,
  options = {},
) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);

  const mesh = new THREE.Mesh(
    geometry,
    options.material ||
      material(color, options.roughness, options.metalness),
  );

  mesh.position.set(position[0], position[1], position[2]);

  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);

  return mesh;
}

function addCylinder(
  parent,
  radiusTop,
  radiusBottom,
  height,
  position,
  color,
  rotation = null,
  segments = 10,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      segments,
      1,
      false,
    ),
    material(color, 0.68, 0.08),
  );

  mesh.position.set(position[0], position[1], position[2]);

  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  parent.add(mesh);
  return mesh;
}

function addWingPanel(parent, points, color) {
  const shape = new THREE.Shape();

  shape.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i][0], points[i][1]);
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: false,
    steps: 1,
  });

  geometry.translate(0, 0, -0.0175);

  const mesh = new THREE.Mesh(
    geometry,
    material(color, 0.78, 0.02),
  );

  parent.add(mesh);
  return mesh;
}

function createGlider() {
  const group = new THREE.Group();
  group.name = 'aircraft-skyline-glider';

  const charcoal = 0x1a2227;
  const fabric = 0x405563;
  const accent = 0xd17c45;

  const left = addWingPanel(
    group,
    [
      [-0.18, -0.14],
      [-1.15, -0.46],
      [-1.55, -0.7],
      [-0.42, -0.62],
    ],
    fabric,
  );

  left.position.z = -1.55;
  left.rotation.x = -0.1;

  const right = left.clone();
  right.scale.x = -1;
  group.add(right);

  addBox(
    group,
    [0.42, 0.18, 1.22],
    [0, -0.42, -1.68],
    charcoal,
    [-0.07, 0, 0],
  );

  addBox(
    group,
    [0.05, 0.04, 0.86],
    [0, -0.31, -2],
    accent,
  );

  addBox(
    group,
    [0.07, 0.08, 0.3],
    [-0.41, -0.53, -1.56],
    charcoal,
    [0, 0, -0.16],
  );

  addBox(
    group,
    [0.07, 0.08, 0.3],
    [0.41, -0.53, -1.56],
    charcoal,
    [0, 0, 0.16],
  );

  return group;
}

function createStuka() {
  const group = new THREE.Group();
  group.name = 'aircraft-stuka';

  // Historically inspired silhouette only:
  // no weapons, markings, or insignia.
  const olive = 0x39473b;
  const dark = 0x11191a;
  const underside = 0x7a8782;

  const glass = new THREE.MeshStandardMaterial({
    color: 0x91b5bc,
    roughness: 0.16,
    metalness: 0.02,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });

  addCylinder(
    group,
    0.22,
    0.34,
    1.65,
    [0, -0.28, -1.83],
    olive,
    [Math.PI / 2, 0, 0],
    12,
  );

  addCylinder(
    group,
    0.16,
    0.22,
    0.34,
    [0, -0.27, -2.84],
    dark,
    [Math.PI / 2, 0, 0],
    12,
  );

  addBox(
    group,
    [0.54, 0.12, 0.72],
    [0, -0.48, -1.43],
    underside,
    [-0.05, 0, 0],
  );

  // Inverted gull-wing shape, kept peripheral in VR.
  addBox(
    group,
    [0.9, 0.08, 0.35],
    [-0.58, -0.48, -1.63],
    olive,
    [0.02, 0.1, 0.24],
  );

  addBox(
    group,
    [1, 0.07, 0.3],
    [-1.47, -0.29, -1.67],
    olive,
    [0.01, 0.05, -0.12],
  );

  addBox(
    group,
    [0.9, 0.08, 0.35],
    [0.58, -0.48, -1.63],
    olive,
    [0.02, -0.1, -0.24],
  );

  addBox(
    group,
    [1, 0.07, 0.3],
    [1.47, -0.29, -1.67],
    olive,
    [0.01, -0.05, 0.12],
  );

  addBox(
    group,
    [0.13, 0.44, 0.18],
    [-0.75, -0.68, -1.55],
    dark,
    [0, 0, -0.08],
  );

  addBox(
    group,
    [0.13, 0.44, 0.18],
    [0.75, -0.68, -1.55],
    dark,
    [0, 0, 0.08],
  );

  addCylinder(
    group,
    0.13,
    0.13,
    0.07,
    [-0.75, -0.9, -1.55],
    dark,
    [0, 0, Math.PI / 2],
    12,
  );

  addCylinder(
    group,
    0.13,
    0.13,
    0.07,
    [0.75, -0.9, -1.55],
    dark,
    [0, 0, Math.PI / 2],
    12,
  );

  const canopy = addBox(
    group,
    [0.54, 0.36, 0.92],
    [0, -0.02, -1.08],
    0xffffff,
    [-0.12, 0, 0],
    { material: glass },
  );

  canopy.renderOrder = 2;

  addBox(
    group,
    [0.035, 0.4, 0.95],
    [0, -0.02, -1.07],
    dark,
    [-0.12, 0, 0],
  );

  addBox(
    group,
    [0.56, 0.035, 0.05],
    [0, 0.1, -1.42],
    dark,
    [-0.12, 0, 0],
  );

  addBox(
    group,
    [0.56, 0.035, 0.05],
    [0, 0.03, -0.96],
    dark,
    [-0.12, 0, 0],
  );

  return group;
}

function createScout() {
  const group = new THREE.Group();
  group.name = 'aircraft-alpine-scout';

  const cream = 0xd8d1bf;
  const blue = 0x284b61;
  const brass = 0xa7814d;
  const dark = 0x172128;

  addCylinder(
    group,
    0.1,
    0.25,
    1.54,
    [0, -0.3, -1.77],
    cream,
    [Math.PI / 2, 0, 0],
    10,
  );

  addBox(
    group,
    [0.62, 0.1, 0.72],
    [0, -0.43, -1.42],
    blue,
    [-0.04, 0, 0],
  );

  addBox(
    group,
    [1.45, 0.055, 0.32],
    [-0.85, -0.37, -1.56],
    cream,
    [0.02, 0.06, 0.08],
  );

  addBox(
    group,
    [1.45, 0.055, 0.32],
    [0.85, -0.37, -1.56],
    cream,
    [0.02, -0.06, -0.08],
  );

  addBox(
    group,
    [0.035, 0.035, 1.02],
    [0, -0.16, -1.73],
    brass,
  );

  addBox(
    group,
    [0.03, 0.28, 0.72],
    [-0.34, 0, -1.04],
    dark,
    [0, 0, -0.3],
  );

  addBox(
    group,
    [0.03, 0.28, 0.72],
    [0.34, 0, -1.04],
    dark,
    [0, 0, 0.3],
  );

  addBox(
    group,
    [0.69, 0.03, 0.03],
    [0, 0.15, -1.1],
    dark,
  );

  return group;
}

function createExternalAirframe(profileId) {
  const group = new THREE.Group();
  group.name = `external-airframe-${profileId}`;

  const schemes = {
    glider: {
      body: 0x24323a,
      wing: 0x5f7884,
      accent: 0xd17c45,
    },
    stuka: {
      body: 0x39473b,
      wing: 0x4a594c,
      accent: 0x87918c,
    },
    scout: {
      body: 0xd8d1bf,
      wing: 0x315c73,
      accent: 0xa7814d,
    },
  };

  const colors = schemes[profileId] || schemes.glider;

  addCylinder(
    group,
    0.14,
    0.28,
    4.6,
    [0, 0, -0.18],
    colors.body,
    [Math.PI / 2, 0, 0],
    12,
  );

  addCylinder(
    group,
    0.05,
    0.15,
    0.65,
    [0, 0, -2.7],
    colors.accent,
    [Math.PI / 2, 0, 0],
    10,
  );

  addBox(
    group,
    [0.8, 0.12, 1.15],
    [0, 0.18, -0.6],
    colors.body,
    [-0.03, 0, 0],
  );

  if (profileId === 'stuka') {
    addBox(
      group,
      [1.65, 0.12, 0.58],
      [-0.92, -0.13, -0.52],
      colors.wing,
      [0.02, 0.03, 0.24],
    );

    addBox(
      group,
      [1.65, 0.1, 0.52],
      [-2.34, 0.12, -0.55],
      colors.wing,
      [0.01, 0.02, -0.12],
    );

    addBox(
      group,
      [1.65, 0.12, 0.58],
      [0.92, -0.13, -0.52],
      colors.wing,
      [0.02, -0.03, -0.24],
    );

    addBox(
      group,
      [1.65, 0.1, 0.52],
      [2.34, 0.12, -0.55],
      colors.wing,
      [0.01, -0.02, 0.12],
    );

    addBox(
      group,
      [0.18, 0.88, 0.24],
      [-0.92, -0.48, -0.46],
      0x172022,
    );

    addBox(
      group,
      [0.18, 0.88, 0.24],
      [0.92, -0.48, -0.46],
      0x172022,
    );
  } else if (profileId === 'scout') {
    addBox(
      group,
      [5.4, 0.1, 0.62],
      [0, 0.02, -0.4],
      colors.wing,
      [0.01, 0, 0],
    );

    addBox(
      group,
      [3.2, 0.06, 0.18],
      [0, 0.1, -0.38],
      colors.accent,
    );
  } else {
    addBox(
      group,
      [5.8, 0.08, 0.76],
      [0, -0.02, -0.22],
      colors.wing,
      [0.02, 0, 0],
    );

    addBox(
      group,
      [2.4, 0.06, 0.38],
      [0, 0.02, 1.78],
      colors.wing,
    );
  }

  addBox(
    group,
    [2.25, 0.07, 0.46],
    [0, 0.02, 1.72],
    colors.wing,
  );

  addBox(
    group,
    [0.1, 0.88, 0.72],
    [0, 0.45, 1.7],
    colors.body,
    [0.1, 0, 0],
  );

  group.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = false;
    object.receiveShadow = false;
  });

  return group;
}

const BUILDERS = Object.freeze({
  glider: createGlider,
  stuka: createStuka,
  scout: createScout,
});

function resolveStoredIndex() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    const index = AIRCRAFT_PROFILES.findIndex(
      (profile) => profile.id === stored,
    );

    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

function disposeObject(root) {
  root.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (!object.material) return;

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const item of materials) {
      item.dispose();
    }
  });
}

export class AircraftVisualSystem {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'aircraft-visual-root';
    this.root.position.set(0, 0, 0);
    this.root.renderOrder = 4;

    this.scene = scene || null;
    this.camera = null;

    this.externalRoot = new THREE.Group();
    this.externalRoot.name = 'selected-aircraft-external-root';
    this.externalRoot.visible = false;

    this.scene?.add(this.externalRoot);

    this.externalModel = null;
    this.profileIndex = resolveStoredIndex();
    this.model = null;
    this.elapsed = 0;

    this._rebuild();

    this._onNext = () => {
      this.next();
    };

    this._onSet = (event) => {
      this.setProfile(
        event?.detail?.id ?? event?.detail?.index,
      );
    };

    window.addEventListener(
      'skyline:aircraft-next',
      this._onNext,
    );

    window.addEventListener(
      'skyline:aircraft-set',
      this._onSet,
    );

    this._onKeyDown = (event) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;

      if (
        target &&
        /INPUT|TEXTAREA|SELECT/.test(target.tagName)
      ) {
        return;
      }

      if (event.code === 'KeyV') {
        this.next();
      } else if (event.code === 'Digit1') {
        this.setProfile(0);
      } else if (event.code === 'Digit2') {
        this.setProfile(1);
      } else if (event.code === 'Digit3') {
        this.setProfile(2);
      }
    };

    window.addEventListener(
      'keydown',
      this._onKeyDown,
    );
  }

  get profile() {
    return AIRCRAFT_PROFILES[this.profileIndex];
  }

  get name() {
    return this.profile.name;
  }

  attach(camera) {
    if (!camera || this.camera === camera) return;

    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }

    this.camera = camera;
    camera.add(this.root);
  }

  setProfile(value) {
    let index = -1;

    if (Number.isFinite(Number(value))) {
      index = Math.trunc(Number(value));
    } else if (typeof value === 'string') {
      index = AIRCRAFT_PROFILES.findIndex(
        (profile) => profile.id === value,
      );
    }

    if (index < 0) {
      return this.name;
    }

    this.profileIndex =
      ((index % AIRCRAFT_PROFILES.length) +
        AIRCRAFT_PROFILES.length) %
      AIRCRAFT_PROFILES.length;

    this._rebuild();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        this.profile.id,
      );
    } catch {
      // Local storage is optional.
    }

    window.dispatchEvent(
      new CustomEvent('skyline:aircraft-changed', {
        detail: {
          id: this.profile.id,
          index: this.profileIndex,
          name: this.profile.name,
        },
      }),
    );

    return this.name;
  }

  next() {
    return this.setProfile(this.profileIndex + 1);
  }

  _rebuild() {
    if (this.model) {
      this.root.remove(this.model);
      disposeObject(this.model);
    }

    this.model = BUILDERS[this.profile.id]();
    this.model.scale.setScalar(0.92);
    this.root.add(this.model);

    if (this.externalModel) {
      this.externalRoot.remove(this.externalModel);
      disposeObject(this.externalModel);
    }

    this.externalModel = createExternalAirframe(
      this.profile.id,
    );

    this.externalRoot.add(this.externalModel);
  }

  update(dt, flight) {
    this.elapsed += Math.max(0, dt || 0);

    const speed = Number.isFinite(flight?.speed)
      ? flight.speed
      : flight?.velocity?.length?.() || 0;

    const flutter = Math.min(
      1,
      Math.max(0, (speed - 70) / 110),
    );

    const load = Number.isFinite(flight?.loadFactor)
      ? flight.loadFactor
      : 1;

    // Determine first-person versus chase view only from
    // distance. CameraRig itself remains untouched.
    const cameraDistance =
      this.camera?.position?.distanceTo?.(
        flight?.position,
      ) ?? 0;

    this.root.visible = cameraDistance < 3.5;

    this.externalRoot.visible =
      cameraDistance >= 3.5 &&
      Boolean(flight?.position);

    if (this.externalRoot.visible) {
      this.externalRoot.position.copy(
        flight.position,
      );

      if (flight?.attitude?.isQuaternion) {
        this.externalRoot.quaternion.copy(
          flight.attitude,
        );
      } else if (
        flight?.velocity?.isVector3 &&
        flight.velocity.lengthSq() > 0.001
      ) {
        const forward = flight.velocity
          .clone()
          .normalize();

        this.externalRoot.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          forward,
        );
      }
    }

    // Tiny visual movement only.
    this.root.position.y =
      -0.01 -
      Math.max(0, load - 1) * 0.003;

    this.root.position.x =
      Math.sin(this.elapsed * 7.3) *
      0.0015 *
      flutter;

    this.root.rotation.z =
      Math.sin(this.elapsed * 9.1) *
      0.0012 *
      flutter;
  }

  dispose() {
    window.removeEventListener(
      'skyline:aircraft-next',
      this._onNext,
    );

    window.removeEventListener(
      'skyline:aircraft-set',
      this._onSet,
    );

    window.removeEventListener(
      'keydown',
      this._onKeyDown,
    );

    this.scene?.remove(this.externalRoot);

    if (this.model) {
      disposeObject(this.model);
    }

    if (this.externalModel) {
      disposeObject(this.externalModel);
    }
  }
}
