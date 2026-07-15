import * as THREE from '../../vendor/three.module.min.js';
import {
  ZERO_COLORS,
  addBox,
  addCylinder,
  addMesh,
  addSphere,
  basic,
  createGauge,
  standard,
} from './a6mZeroShared.js';

function createCanopyFrame(root, materials) {
  // Side posts stay outside the central binocular field of view.
  addBox(root, [0.055, 1.16, 0.055], [-0.73, 0.18, -1.02], materials.frame, [0.03, 0, -0.12]);
  addBox(root, [0.055, 1.16, 0.055], [0.73, 0.18, -1.02], materials.frame, [0.03, 0, 0.12]);
  addBox(root, [0.052, 0.92, 0.052], [-0.64, 0.20, -0.22], materials.frame, [-0.10, 0, -0.08]);
  addBox(root, [0.052, 0.92, 0.052], [0.64, 0.20, -0.22], materials.frame, [-0.10, 0, 0.08]);
  addBox(root, [1.42, 0.052, 0.052], [0, 0.76, -0.98], materials.frame);
  addBox(root, [1.22, 0.045, 0.045], [0, 0.68, -0.12], materials.frame);

  // Thin windscreen panes. Low opacity gives enclosure without washing out the world.
  const leftGlass = addMesh(
    root,
    new THREE.PlaneGeometry(0.72, 0.90),
    materials.glass,
    [-0.37, 0.25, -1.00],
    [-0.04, -0.035, 0],
  );
  leftGlass.renderOrder = 4;

  const rightGlass = addMesh(
    root,
    new THREE.PlaneGeometry(0.72, 0.90),
    materials.glass,
    [0.37, 0.25, -1.00],
    [-0.04, 0.035, 0],
  );
  rightGlass.renderOrder = 4;
}

function createInstrumentPanel(root, materials) {
  const panelRoot = new THREE.Group();
  panelRoot.name = 'zero-instrument-panel';
  panelRoot.position.set(0, -0.31, -1.20);
  panelRoot.rotation.x = -0.045;
  root.add(panelRoot);

  addBox(panelRoot, [1.56, 0.60, 0.11], [0, 0, 0], materials.panel);
  addBox(panelRoot, [1.68, 0.08, 0.18], [0, 0.31, 0.02], materials.coaming, [-0.06, 0, 0]);
  addBox(panelRoot, [0.18, 0.52, 0.13], [-0.78, -0.02, 0.01], materials.panelSide, [0, 0, -0.06]);
  addBox(panelRoot, [0.18, 0.52, 0.13], [0.78, -0.02, 0.01], materials.panelSide, [0, 0, 0.06]);

  const instruments = [
    createGauge(panelRoot, [-0.50, 0.10, 0.075], 0.155, 'IAS'),
    createGauge(panelRoot, [-0.15, 0.13, 0.075], 0.172, 'ALT'),
    createGauge(panelRoot, [0.23, 0.10, 0.075], 0.155, 'RPM'),
    createGauge(panelRoot, [0.56, 0.13, 0.075], 0.125, 'OIL'),
    createGauge(panelRoot, [0.55, -0.18, 0.075], 0.105, 'FUEL'),
  ];

  // Small switches and warning lamps read as detail without adding textures.
  for (let index = 0; index < 5; index += 1) {
    addCylinder(
      panelRoot,
      0.022,
      0.022,
      0.055,
      [-0.53 + index * 0.22, -0.22, -0.095],
      index === 2 ? materials.red : materials.brass,
      [Math.PI / 2, 0, 0],
      10,
    );
  }

  addBox(panelRoot, [0.26, 0.06, 0.05], [-0.18, -0.22, -0.095], materials.label);
  addBox(panelRoot, [0.24, 0.06, 0.05], [0.18, -0.22, -0.095], materials.label);

  return instruments;
}

function createReflectorSight(root, materials) {
  const sightRoot = new THREE.Group();
  sightRoot.name = 'zero-reflector-sight';
  sightRoot.position.set(0, 0.08, -1.12);
  root.add(sightRoot);

  addBox(sightRoot, [0.08, 0.36, 0.08], [0, -0.09, 0], materials.frame);
  addBox(sightRoot, [0.28, 0.07, 0.13], [0, -0.25, 0.02], materials.frame);

  const glass = addMesh(
    sightRoot,
    new THREE.CircleGeometry(0.145, 28),
    materials.sightGlass,
    [0, 0.18, 0],
  );
  glass.renderOrder = 5;

  const reticle = new THREE.Group();
  reticle.position.set(0, 0.18, 0.004);
  sightRoot.add(reticle);

  addMesh(
    reticle,
    new THREE.RingGeometry(0.045, 0.052, 24),
    materials.reticle,
  );
  addBox(reticle, [0.0025, 0.085, 0.003], [0, 0, 0], materials.reticle);
  addBox(reticle, [0.085, 0.0025, 0.003], [0, 0, 0], materials.reticle);
}

function createSideControls(root, materials) {
  // Left throttle quadrant.
  addBox(root, [0.30, 0.24, 0.54], [-0.88, -0.42, -0.55], materials.sidePanel, [0.04, 0, -0.05]);
  addBox(root, [0.08, 0.34, 0.08], [-0.80, -0.18, -0.58], materials.red, [0, 0, 0.22]);
  addSphere(root, 0.07, [-0.74, -0.03, -0.58], materials.red, [1.0, 0.8, 1.0], 12, 8);

  // Right trim and radio boxes.
  addBox(root, [0.32, 0.24, 0.48], [0.88, -0.42, -0.50], materials.sidePanel, [0.04, 0, 0.05]);
  addCylinder(root, 0.08, 0.08, 0.065, [0.84, -0.22, -0.58], materials.brass, [Math.PI / 2, 0, 0], 14);
  addCylinder(root, 0.055, 0.055, 0.065, [0.98, -0.27, -0.58], materials.brass, [Math.PI / 2, 0, 0], 14);

  // Control column is low and narrow, never covering the horizon.
  addCylinder(root, 0.035, 0.045, 0.68, [0, -0.69, -0.55], materials.frame, [0.12, 0, 0], 10);
  addBox(root, [0.30, 0.055, 0.055], [0, -0.37, -0.59], materials.frame);
  addSphere(root, 0.065, [-0.15, -0.37, -0.59], materials.leather, null, 12, 8);
  addSphere(root, 0.065, [0.15, -0.37, -0.59], materials.leather, null, 12, 8);
}

function createNoseAndRails(root, materials) {
  // Only the upper cowling shoulders are visible. The middle stays low and open.
  addSphere(
    root,
    0.74,
    [0, -0.60, -1.66],
    materials.ivory,
    [1.16, 0.42, 1.26],
    18,
    10,
  );

  addBox(root, [0.18, 0.16, 1.20], [-0.79, -0.48, -0.55], materials.rail, [0.02, 0, -0.04]);
  addBox(root, [0.18, 0.16, 1.20], [0.79, -0.48, -0.55], materials.rail, [0.02, 0, 0.04]);

  // Small center spinner reference gives speed/attitude context without obstruction.
  addMesh(
    root,
    new THREE.CircleGeometry(0.085, 18),
    materials.spinner,
    [0, -0.30, -1.90],
  );
}

export function createA6MZeroCockpit() {
  const root = new THREE.Group();
  root.name = 'cockpit-a6m-zero-white-872-detailed';
  root.position.set(0, -0.52, -0.88);

  const materials = {
    frame: standard(ZERO_COLORS.frame, 0.60, 0.20),
    panel: standard(ZERO_COLORS.panel, 0.88, 0.08),
    panelSide: standard(0x34352d, 0.82, 0.08),
    coaming: standard(0x1a1b18, 0.92, 0.04),
    sidePanel: standard(0x3e463f, 0.82, 0.08),
    rail: standard(0x555f58, 0.74, 0.10),
    leather: standard(ZERO_COLORS.leather, 0.93, 0.02),
    ivory: standard(ZERO_COLORS.ivory, 0.60, 0.14),
    red: standard(ZERO_COLORS.red, 0.62, 0.08),
    brass: standard(ZERO_COLORS.brass, 0.48, 0.40),
    label: basic(0xcfc49a, { toneMapped: false }),
    spinner: basic(0xaeb5b3, { toneMapped: false }),
    glass: standard(ZERO_COLORS.glass, 0.12, 0.02, {
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    sightGlass: basic(0xbde9df, {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    reticle: basic(0xb8f4d8, {
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    }),
  };

  createCanopyFrame(root, materials);
  const instruments = createInstrumentPanel(root, materials);
  createReflectorSight(root, materials);
  createSideControls(root, materials);
  createNoseAndRails(root, materials);

  root.userData.instruments = instruments;
  root.userData.visualVersion = 'a6m-zero-cockpit-procedural-v1';
  return root;
}
