import * as THREE from '../vendor/three.module.min.js';
import { createJu87StukaCockpit } from './aircraft/ju87StukaCockpit.js';
import { createJu87StukaExternal } from './aircraft/ju87StukaExternal.js';
import {
  createA6MZeroExternal,
} from './aircraft/a6mZeroExternal.js';
import {
  createA6MZeroCockpit,
} from './aircraft/a6mZeroCockpit.js';

import {
  createWorkerExternalBuilder,
  createWorkerCockpitBuilder,
} from './workerAirframe/runtimeBuilders.js';

const STORAGE_KEY = 'skyline-aircraft-profile-v4';
const FORWARD = new THREE.Vector3(0, 0, -1);

export const AIRCRAFT_PROFILES = Object.freeze([
  Object.freeze({ id: 'zero', name: 'A6M ZERO · WHITE 872', engine: 'RADIAL' }),
  Object.freeze({ id: 'stuka', name: 'JU 87 STUKA', engine: 'INVERTED V12' }),
  Object.freeze({ id: 'scout', name: 'ALPINE SCOUT', engine: 'LIGHT INLINE' }),
  Object.freeze({ id: 'glider', name: 'SKYLINE GLIDER', engine: 'WIND' }),
]);

function standard(color, roughness = 0.72, metalness = 0.05, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function basic(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

function mesh(parent, geometry, material, position = null, rotation = null, scale = null) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  if (scale) object.scale.set(...scale);
  object.castShadow = false;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}

function box(parent, size, position, material, rotation = null) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, position, rotation);
}

function cylinder(parent, radii, height, position, material, rotation = null, segments = 14) {
  return mesh(
    parent,
    new THREE.CylinderGeometry(radii[0], radii[1], height, segments, 1, false),
    material,
    position,
    rotation,
  );
}

function sphere(parent, radius, position, material, scale = null, detail = 1) {
  return mesh(parent, new THREE.IcosahedronGeometry(radius, detail), material, position, null, scale);
}

function roundel(parent, x, z, radius, side = 'top') {
  const red = basic(0xc63a32, { side: THREE.DoubleSide, toneMapped: false });
  const disk = mesh(parent, new THREE.CircleGeometry(radius, 28), red);
  disk.position.set(x, side === 'top' ? 0.075 : -0.075, z);
  disk.rotation.x = side === 'top' ? -Math.PI / 2 : Math.PI / 2;
  return disk;
}

function wingShape(parent, side, bodyMaterial, accentMaterial) {
  const shape = new THREE.Shape();
  shape.moveTo(0.15, -0.72);
  shape.lineTo(2.55, -0.30);
  shape.quadraticCurveTo(3.15, -0.18, 3.32, 0.08);
  shape.quadraticCurveTo(3.24, 0.38, 2.65, 0.48);
  shape.lineTo(0.22, 0.62);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, -0.06, 0);

  const wing = new THREE.Mesh(geometry, bodyMaterial);
  wing.scale.x = side;
  wing.position.set(side * 0.12, 0, -0.22);
  parent.add(wing);

  const stripe = box(
    parent,
    [0.23, 0.025, 1.08],
    [side * 2.24, 0.085, -0.13],
    accentMaterial,
  );
  stripe.rotation.y = side * 0.02;

  roundel(parent, side * 1.58, -0.12, 0.37, 'top');
  return wing;
}

function createZeroExternal() {
  const group = new THREE.Group();
  group.name = 'external-a6m-zero-white-872';

  const ivory = standard(0xf1eee3, 0.62, 0.10, { emissive: 0x17150f, emissiveIntensity: 0.12 });
  const ivoryDark = standard(0xd2d1c8, 0.72, 0.10, { emissive: 0x10100d, emissiveIntensity: 0.08 });
  const red = standard(0xd14a3f, 0.62, 0.08, { emissive: 0x250706, emissiveIntensity: 0.12 });
  const black = standard(0x17191a, 0.42, 0.18);
  const glass = standard(0x76939c, 0.14, 0.06, {
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const frame = standard(0x353a39, 0.5, 0.16);

  // Tapered fuselage and black radial cowling.
  cylinder(group, [0.16, 0.44], 4.65, [0, 0, 0.05], ivory, [Math.PI / 2, 0, 0], 18);
  cylinder(group, [0.46, 0.48], 0.74, [0, 0, -2.47], black, [Math.PI / 2, 0, 0], 20);
  cylinder(group, [0.11, 0.19], 0.34, [0, 0, -3.02], black, [Math.PI / 2, 0, 0], 14);

  wingShape(group, -1, ivory, red);
  wingShape(group, 1, ivory, red);

  // Tailplanes and rounded vertical fin.
  box(group, [2.42, 0.09, 0.56], [0, 0.05, 1.82], ivoryDark);
  box(group, [0.12, 0.98, 0.76], [0, 0.45, 1.78], ivoryDark, [0.10, 0, 0]);
  box(group, [0.14, 0.42, 0.58], [0, 0.96, 1.74], red, [0.10, 0, 0]);

  // Canopy bubble and dark structural frames.
  const canopy = sphere(group, 0.58, [0, 0.42, -0.62], glass, [0.83, 0.76, 1.35], 2);
  canopy.renderOrder = 3;
  box(group, [0.045, 0.68, 1.30], [0, 0.46, -0.62], frame);
  box(group, [0.94, 0.045, 0.045], [0, 0.73, -0.74], frame);
  box(group, [0.94, 0.045, 0.045], [0, 0.42, -0.21], frame);
  box(group, [0.94, 0.045, 0.045], [0, 0.36, -1.12], frame);

  // Tapered propeller with a restrained high-RPM blur disk.
  const propeller = new THREE.Group();
  propeller.name = 'zero-propeller';
  propeller.position.z = -3.24;

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.045, 0.10);
  bladeShape.quadraticCurveTo(-0.11, 0.62, -0.075, 1.18);
  bladeShape.quadraticCurveTo(0.01, 1.32, 0.085, 1.15);
  bladeShape.quadraticCurveTo(0.11, 0.60, 0.045, 0.10);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ShapeGeometry(bladeShape, 8);
  const bladeMaterial = standard(0x252829, 0.42, 0.16);
  const blades = new THREE.Group();
  for (let blade = 0; blade < 3; blade += 1) {
    const part = new THREE.Mesh(bladeGeometry, bladeMaterial);
    part.rotation.z = blade / 3 * Math.PI * 2;
    blades.add(part);
  }
  propeller.add(blades);

  const blurDisk = mesh(
    propeller,
    new THREE.CircleGeometry(1.17, 48),
    basic(0x202426, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    [0, 0, 0.025],
  );
  sphere(propeller, 0.18, [0, 0, 0.055], ivoryDark, [1, 1, 1.2]);
  propeller.userData.blades = blades;
  propeller.userData.blurDisk = blurDisk;
  group.add(propeller);
  group.userData.propeller = propeller;

  // Landing gear fairing hints, exhausts, wing panel lines and tail code.
  cylinder(group, [0.06, 0.06], 0.54, [-1.15, -0.34, -0.28], frame, [0, 0, 0.08], 8);
  cylinder(group, [0.06, 0.06], 0.54, [1.15, -0.34, -0.28], frame, [0, 0, -0.08], 8);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      box(group, [0.035, 0.02, 0.72], [side * (0.62 + index * 0.48), 0.086, 0.06], frame);
    }
    for (let exhaust = 0; exhaust < 3; exhaust += 1) {
      cylinder(group, [0.035, 0.04], 0.22, [side * 0.34, -0.23 + exhaust * 0.13, -2.20], black, [0, 0, Math.PI / 2], 7);
    }
  }

  group.userData.engine = 'RADIAL';
  return group;
}

function createStukaExternal() {
  const group = new THREE.Group();
  group.name = 'external-stuka';
  const olive = standard(0x3e4b3c, 0.8, 0.08);
  const underside = standard(0x929b94, 0.78, 0.08);
  const dark = standard(0x1b2020, 0.55, 0.14);
  const glass = standard(0x718c94, 0.18, 0.02, { transparent: true, opacity: 0.38, depthWrite: false });

  cylinder(group, [0.16, 0.36], 4.8, [0, 0, 0], olive, [Math.PI / 2, 0, 0], 14);
  cylinder(group, [0.30, 0.36], 0.78, [0, 0, -2.65], dark, [Math.PI / 2, 0, 0], 14);
  box(group, [1.5, 0.12, 0.62], [-0.84, -0.17, -0.42], olive, [0.02, 0.02, 0.24]);
  box(group, [1.55, 0.10, 0.54], [-2.15, 0.09, -0.48], olive, [0.01, 0.02, -0.13]);
  box(group, [1.5, 0.12, 0.62], [0.84, -0.17, -0.42], olive, [0.02, -0.02, -0.24]);
  box(group, [1.55, 0.10, 0.54], [2.15, 0.09, -0.48], olive, [0.01, -0.02, 0.13]);
  box(group, [2.1, 0.08, 0.52], [0, 0.04, 1.75], underside);
  box(group, [0.12, 0.92, 0.72], [0, 0.44, 1.72], olive);
  sphere(group, 0.55, [0, 0.38, -0.60], glass, [0.82, 0.7, 1.52], 1);
  for (const side of [-1, 1]) {
    box(group, [0.16, 0.92, 0.22], [side * 0.92, -0.52, -0.38], dark);
    cylinder(group, [0.16, 0.16], 0.10, [side * 0.92, -0.96, -0.38], dark, [0, 0, Math.PI / 2], 10);
  }
  group.userData.engine = 'V12';
  return group;
}

function createScoutExternal() {
  const group = new THREE.Group();
  const cream = standard(0xd8d0b9, 0.74, 0.06);
  const blue = standard(0x31566c, 0.68, 0.08);
  const brass = standard(0xaa8650, 0.45, 0.42);
  cylinder(group, [0.11, 0.29], 4.2, [0, 0, 0], cream, [Math.PI / 2, 0, 0], 12);
  box(group, [5.5, 0.10, 0.72], [0, 0, -0.35], blue);
  box(group, [2.4, 0.07, 0.46], [0, 0.02, 1.56], cream);
  box(group, [0.10, 0.82, 0.66], [0, 0.40, 1.54], blue);
  box(group, [3.3, 0.04, 0.13], [0, 0.11, -0.34], brass);
  group.userData.engine = 'INLINE';
  return group;
}

function createGliderExternal() {
  const group = new THREE.Group();
  const fabric = standard(0x617985, 0.82, 0.02);
  const dark = standard(0x202a2f, 0.82, 0.02);
  const orange = standard(0xd17845, 0.72, 0.03);
  box(group, [6.5, 0.08, 1.15], [0, 0, -0.15], fabric);
  box(group, [0.62, 0.22, 3.5], [0, -0.10, 0.05], dark);
  box(group, [2.4, 0.06, 0.45], [0, 0.02, 1.78], fabric);
  box(group, [0.08, 0.74, 0.62], [0, 0.36, 1.75], orange);
  group.userData.engine = 'WIND';
  return group;
}

function gauge(parent, position, radius, label, needleAngle = 0) {
  const group = new THREE.Group();
  group.position.set(...position);
  const casing = mesh(group, new THREE.CylinderGeometry(radius, radius, 0.05, 24), standard(0x1d1c17, 0.7, 0.18), null, [Math.PI / 2, 0, 0]);
  casing.position.z = 0;
  const face = mesh(group, new THREE.CircleGeometry(radius * 0.83, 24), basic(0xd5caa6), [0, 0, -0.031]);
  const needle = box(group, [radius * 0.08, radius * 0.78, 0.025], [0, 0, -0.055], basic(0x9c3029));
  needle.rotation.z = needleAngle;
  group.userData.needle = needle;
  group.userData.label = label;
  parent.add(group);
  return group;
}

function createCockpit(profileId) {
  const group = new THREE.Group();
  group.name = `cockpit-${profileId}`;
  group.position.set(0, -0.48, -1.05);

  const frame = standard(profileId === 'zero' ? 0x333b39 : 0x2b302d, 0.66, 0.18);
  const panel = standard(0x2a2920, 0.9, 0.08);
  const leather = standard(0x4a3326, 0.94, 0.02);
  const glass = standard(0x86a6ab, 0.12, 0.03, { transparent: true, opacity: 0.15, depthWrite: false });

  // Canopy frame, side rails and instrument panel. Kept below the horizon so
  // first-person remains clean and cockpit mode feels enclosed, not blocked.
  box(group, [2.0, 0.06, 0.06], [0, 0.88, -0.92], frame);
  box(group, [0.06, 1.55, 0.06], [-0.94, 0.18, -0.92], frame, [0, 0, -0.18]);
  box(group, [0.06, 1.55, 0.06], [0.94, 0.18, -0.92], frame, [0, 0, 0.18]);
  box(group, [0.05, 1.45, 0.05], [0, 0.22, -1.08], frame);
  box(group, [1.78, 0.72, 0.12], [0, -0.22, -1.18], panel, [-0.05, 0, 0]);
  box(group, [0.32, 0.54, 0.50], [-0.96, -0.54, -0.40], leather, [0.04, 0, -0.05]);
  box(group, [0.32, 0.54, 0.50], [0.96, -0.54, -0.40], leather, [0.04, 0, 0.05]);

  const instruments = [
    gauge(group, [-0.52, -0.08, -1.25], 0.18, 'SPD', -0.8),
    gauge(group, [-0.12, -0.04, -1.25], 0.20, 'ALT', 0.4),
    gauge(group, [0.33, -0.07, -1.25], 0.18, 'RPM', 1.0),
    gauge(group, [0.68, -0.14, -1.25], 0.13, 'OIL', -0.25),
  ];
  group.userData.instruments = instruments;

  // Revi-style reflector sight and subtle windscreen glass.
  box(group, [0.08, 0.36, 0.08], [0, 0.28, -1.22], frame);
  const sight = mesh(group, new THREE.CircleGeometry(0.16, 24), basic(0xc9f2e8, {
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [0, 0.48, -1.21]);
  sight.rotation.x = 0;
  const windscreen = box(group, [1.75, 0.92, 0.03], [0, 0.44, -0.96], glass, [-0.12, 0, 0]);
  windscreen.renderOrder = 2;

  if (profileId === 'zero') {
    const red = standard(0xaf3b34, 0.72, 0.08);
    box(group, [0.08, 0.55, 0.08], [0.72, -0.10, -0.74], red, [0, 0, 0.24]);
    box(group, [0.16, 0.12, 0.18], [0.78, 0.16, -0.82], red);
  }

  return group;
}


const COCKPIT_BUILDERS_V52 = Object.freeze({
  zero: createWorkerCockpitBuilder(
    'zero',
    createA6MZeroCockpit,
  ),

  stuka: createWorkerCockpitBuilder(
    'stuka',
    createJu87StukaCockpit,
  ),

  scout: createWorkerCockpitBuilder(
    'scout',
    () => createCockpit('scout'),
  ),

  glider: createWorkerCockpitBuilder(
    'glider',
    () => createCockpit('glider'),
  ),
});

const EXTERNAL_BUILDERS = Object.freeze({
  zero: createWorkerExternalBuilder(
    'zero',
    createA6MZeroExternal,
  ),

  stuka: createWorkerExternalBuilder(
    'stuka',
    createJu87StukaExternal,
  ),

  scout: createWorkerExternalBuilder(
    'scout',
    createScoutExternal,
  ),

  glider: createWorkerExternalBuilder(
    'glider',
    createGliderExternal,
  ),
});

function storedIndex() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    const index = AIRCRAFT_PROFILES.findIndex(profile => profile.id === id);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

function disposeTree(root) {
  root?.traverse?.(object => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const item of materials) item.dispose?.();
  });
}

export class AircraftVisualSystem {
  constructor(scene) {
    this.scene = scene;
    this.camera = null;
    this.profileIndex = storedIndex();
    this.elapsed = 0;
    this.cameraMode = 'first';

    this.externalRoot = new THREE.Group();
    this.externalRoot.name = 'selected-aircraft-external-root';
    this.scene?.add(this.externalRoot);

    this.cockpitRoot = new THREE.Group();
    this.cockpitRoot.name = 'selected-aircraft-cockpit-root';
    this.scene?.add(this.cockpitRoot);

    this.externalModel = null;
    this.cockpitModel = null;
    this._rebuild();

    this._onNext = () => this.next();
    this._onSet = event => this.setProfile(event?.detail?.id ?? event?.detail?.index);
    window.addEventListener('skyline:aircraft-next', this._onNext);
    window.addEventListener('skyline:aircraft-set', this._onSet);

    this._onKeyDown = event => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'KeyV') this.next();
      else if (/^Digit[1-4]$/.test(event.code)) this.setProfile(Number(event.code.slice(-1)) - 1);
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  get profile() {
    return AIRCRAFT_PROFILES[this.profileIndex];
  }

  get name() {
    return this.profile.name;
  }

  attach(camera) {
    this.camera = camera || this.camera;

    if (this.cockpitRoot.parent !== this.scene) {
      this.scene?.remove(this.cockpitRoot);
      this.scene?.add(this.cockpitRoot);
    }
  }

  setProfile(value) {
    let index = -1;
    if (Number.isFinite(Number(value))) index = Math.trunc(Number(value));
    else if (typeof value === 'string') index = AIRCRAFT_PROFILES.findIndex(profile => profile.id === value);
    if (index < 0) return this.name;

    this.profileIndex = ((index % AIRCRAFT_PROFILES.length) + AIRCRAFT_PROFILES.length) % AIRCRAFT_PROFILES.length;
    this._rebuild();
    try { localStorage.setItem(STORAGE_KEY, this.profile.id); } catch {}

    window.dispatchEvent(new CustomEvent('skyline:aircraft-changed', {
      detail: {
        id: this.profile.id,
        index: this.profileIndex,
        name: this.profile.name,
        engine: this.profile.engine,
      },
    }));
    return this.name;
  }

  next() {
    return this.setProfile(this.profileIndex + 1);
  }

  _rebuild() {
    if (this.externalModel) {
      this.externalRoot.remove(this.externalModel);
      disposeTree(this.externalModel);
    }
    if (this.cockpitModel) {
      this.cockpitRoot.remove(this.cockpitModel);
      disposeTree(this.cockpitModel);
    }

    this.externalModel = EXTERNAL_BUILDERS[this.profile.id]();
    const cockpitBuilder =
      COCKPIT_BUILDERS_V52[
        this.profile.id
      ];

    this.cockpitModel =
      cockpitBuilder
        ? cockpitBuilder()
        : createCockpit(
            this.profile.id,
          );
    this.externalRoot.add(this.externalModel);
    this.cockpitRoot.add(this.cockpitModel);
  }

  // SKYLINE_BUNDLE_A_V2_WORLD_COCKPIT
  // Cockpit follows the shared render pose instead of the head camera.
  // SKYLINE_RENDER_POSE_INTERPOLATION_V1_AIRCRAFT
  // The model consumes the same render pose as the camera. Camera shake is not
  // applied to the external root and the cockpit root has no synthetic flutter.
  update(
    dt,
    renderPose,
    cameraMode = 'first',
    cockpitPosition = null,
    cockpitQuaternion = null,
  ) {
    const safeDt = Math.max(0, Math.min(0.1, dt || 0));
    this.elapsed += safeDt;
    this.cameraMode = cameraMode;

    this.cockpitRoot.visible = cameraMode === 'cockpit';
    this.externalRoot.visible =
      cameraMode === 'third' && Boolean(renderPose?.position);

    if (this.cockpitRoot.visible) {
      if (cockpitPosition?.isVector3) {
        this.cockpitRoot.position.copy(
          cockpitPosition
        );
      } else if (renderPose?.position) {
        this.cockpitRoot.position.copy(
          renderPose.position
        );
      }

      if (cockpitQuaternion?.isQuaternion) {
        this.cockpitRoot.quaternion.copy(
          cockpitQuaternion
        );
      } else if (
        renderPose?.attitude?.isQuaternion
      ) {
        this.cockpitRoot.quaternion.copy(
          renderPose.attitude
        );
      }
    }

    if (this.externalRoot.visible) {
      this.externalRoot.position.copy(renderPose.position);
      if (renderPose.attitude?.isQuaternion) {
        this.externalRoot.quaternion.copy(renderPose.attitude);
      }
    }

    const speed = Math.max(0, Number(renderPose?.speed) || 0);
    const propeller = this.externalModel?.userData?.propeller;
    if (propeller) {
      propeller.rotation.z += safeDt * (18 + Math.min(112, speed * 0.50));
    }

    const propellerBlur = this.externalModel?.userData?.propellerBlur;
    if (propellerBlur?.material) {
      const blurAmount = Math.max(0, Math.min(1, (speed - 18) / 95));
      propellerBlur.material.opacity = blurAmount * 0.18;
    }

    const instruments = this.cockpitModel?.userData?.instruments || [];
    if (instruments[0]) {
      instruments[0].userData.needle.rotation.z =
        -1.8 + Math.min(3.6, speed / 160 * 3.6);
    }
    if (instruments[1]) {
      instruments[1].userData.needle.rotation.z =
        -1.4 + Math.min(
          2.8,
          Math.max(0, renderPose?.position?.y || 0) / 1800 * 2.8,
        );
    }
    if (instruments[2]) {
      instruments[2].userData.needle.rotation.z =
        -1.4 + Math.min(2.8, speed / 120 * 2.8);
    }

    // Genuine buffet belongs to camera effects.
    // Never shake the aircraft or cockpit geometry.
  }
  dispose() {
    window.removeEventListener('skyline:aircraft-next', this._onNext);
    window.removeEventListener('skyline:aircraft-set', this._onSet);
    window.removeEventListener('keydown', this._onKeyDown);
    this.scene?.remove(this.externalRoot);
    this.cockpitRoot.parent?.remove(this.cockpitRoot);
    disposeTree(this.externalRoot);
    disposeTree(this.cockpitRoot);
  }
}
