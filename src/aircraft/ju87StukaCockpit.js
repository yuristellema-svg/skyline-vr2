import * as THREE from '../../vendor/three.module.min.js';
import {
  AIRCRAFT_VISUAL_COLORS,
  addBeamBetween,
  addBox,
  addCylinder,
  addMesh,
  addPanelLine,
  addSphere,
  basicMaterial,
  createGauge,
  createLatheBodyGeometry,
  createWedgeGeometry,
  lineMaterial,
  standardMaterial,
} from './aircraftVisualShared.js';

export const JU87_STUKA_COCKPIT_BOUNDS = Object.freeze({
  width: 2.12,
  forwardExtent: 3.20,
  highestFrameY: 1.02,
  panelTopY: -0.04,
});

function createMaterials() {
  return {
    frame: standardMaterial(0x343b37, 0.62, 0.18),
    panel: standardMaterial(0x242820, 0.88, 0.08),
    panelEdge: standardMaterial(0x171a16, 0.72, 0.18),
    leather: standardMaterial(AIRCRAFT_VISUAL_COLORS.leather, 0.92, 0.02),
    olive: standardMaterial(AIRCRAFT_VISUAL_COLORS.stukaOlive, 0.76, 0.10),
    oliveDark: standardMaterial(AIRCRAFT_VISUAL_COLORS.stukaOliveDark, 0.78, 0.10),
    radiator: standardMaterial(0x181a19, 0.62, 0.24),
    brass: standardMaterial(AIRCRAFT_VISUAL_COLORS.brass, 0.42, 0.38),
    glass: standardMaterial(AIRCRAFT_VISUAL_COLORS.canopyGlass, 0.14, 0.03, {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    gaugeCasing: standardMaterial(0x171914, 0.70, 0.20),
    gaugeFace: basicMaterial(0xd4ceb0, { toneMapped: false }),
    gaugeMark: basicMaterial(0x353830, { toneMapped: false }),
    gaugeNeedle: basicMaterial(0xa8322b, { toneMapped: false }),
    sightGlass: basicMaterial(0xb2e6de, {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    sightLine: lineMaterial(0x91d9cf, 0.38),
  };
}

function createGreenhouse(root, materials) {
  const glass = addMesh(
    root,
    createWedgeGeometry({
      frontZ: -1.55,
      backZ: 0.62,
      frontWidth: 1.32,
      backWidth: 1.78,
      frontHeight: 0.54,
      backHeight: 0.92,
      baseY: -0.12,
    }),
    materials.glass,
    null,
    null,
    null,
    'stuka-cockpit-greenhouse-glass',
  );
  glass.renderOrder = 5;

  const zFrames = [-1.55, -1.05, -0.45, 0.18, 0.62];
  const widths = [0.66, 0.78, 0.86, 0.90, 0.88];
  const heights = [0.42, 0.66, 0.82, 0.90, 0.80];

  for (let index = 0; index < zFrames.length; index += 1) {
    const z = zFrames[index];
    const width = widths[index];
    const top = heights[index];
    addBeamBetween(
      root,
      [-width, -0.12, z],
      [-width * 0.82, top, z],
      0.024,
      materials.frame,
      6,
      `stuka-cockpit-left-frame-${index + 1}`,
    );
    addBeamBetween(
      root,
      [width, -0.12, z],
      [width * 0.82, top, z],
      0.024,
      materials.frame,
      6,
      `stuka-cockpit-right-frame-${index + 1}`,
    );
    addBeamBetween(
      root,
      [-width * 0.82, top, z],
      [width * 0.82, top, z],
      0.024,
      materials.frame,
      6,
      `stuka-cockpit-roof-frame-${index + 1}`,
    );
  }

  addBeamBetween(root, [0, 0.42, -1.55], [0, 0.82, -0.45], 0.022, materials.frame, 6);
  addBeamBetween(root, [0, 0.82, -0.45], [0, 0.80, 0.62], 0.022, materials.frame, 6);
}

function createPanel(root, materials) {
  addBox(
    root,
    [1.78, 0.58, 0.14],
    [0, -0.32, -1.28],
    materials.panel,
    [-0.045, 0, 0],
    'stuka-low-instrument-panel',
  );
  addBox(
    root,
    [1.86, 0.065, 0.18],
    [0, -0.015, -1.23],
    materials.panelEdge,
    null,
    'stuka-panel-glare-shield',
  );

  const instruments = [
    createGauge(root, [-0.56, -0.24, -1.37], 0.17, 'IAS', materials, -1.8),
    createGauge(root, [-0.18, -0.21, -1.37], 0.19, 'ALT', materials, -1.4),
    createGauge(root, [0.22, -0.24, -1.37], 0.17, 'RPM', materials, -1.4),
    createGauge(root, [0.56, -0.28, -1.37], 0.13, 'OIL', materials, -0.8),
    createGauge(root, [-0.25, -0.50, -1.37], 0.12, 'VSI', materials, 0),
    createGauge(root, [0.10, -0.50, -1.37], 0.12, 'TURN', materials, 0),
  ];
  root.userData.instruments = instruments;

  addBox(root, [0.10, 0.40, 0.10], [0, 0.11, -1.20], materials.frame, null, 'stuka-gunsight-pedestal');
  addMesh(
    root,
    new THREE.RingGeometry(0.12, 0.15, 24),
    materials.sightGlass,
    [0, 0.34, -1.21],
    null,
    null,
    'stuka-reflector-sight-ring',
  );
  addMesh(
    root,
    new THREE.CircleGeometry(0.115, 24),
    materials.sightGlass,
    [0, 0.34, -1.215],
    null,
    null,
    'stuka-reflector-sight-glass',
  );
  addPanelLine(root, [[-0.08, 0.34, -1.22], [0.08, 0.34, -1.22]], materials.sightLine);
  addPanelLine(root, [[0, 0.26, -1.22], [0, 0.42, -1.22]], materials.sightLine);
}

function createControls(root, materials) {
  addBox(root, [0.30, 0.54, 0.54], [-0.94, -0.52, -0.38], materials.leather, [0.04, 0, -0.04], 'stuka-left-console');
  addBox(root, [0.30, 0.54, 0.54], [0.94, -0.52, -0.38], materials.leather, [0.04, 0, 0.04], 'stuka-right-console');

  addCylinder(
    root,
    0.027,
    0.030,
    0.54,
    [-0.78, -0.29, -0.45],
    materials.frame,
    [0.24, 0, -0.18],
    8,
    false,
    'stuka-throttle-lever',
  );
  addSphere(root, 0.072, [-0.83, -0.04, -0.48], materials.brass, null, 10, 6, 'stuka-throttle-grip');

  addCylinder(
    root,
    0.034,
    0.040,
    0.62,
    [0, -0.59, -0.54],
    materials.frame,
    [0.10, 0, 0],
    8,
    false,
    'stuka-control-column',
  );
  addBox(root, [0.34, 0.060, 0.060], [0, -0.29, -0.60], materials.frame, null, 'stuka-control-grip');

  for (let index = 0; index < 3; index += 1) {
    addCylinder(
      root,
      0.023,
      0.023,
      0.22,
      [0.60 + index * 0.11, -0.42, -0.69],
      materials.brass,
      [0.30, 0, -0.12],
      8,
      false,
      `stuka-trim-control-${index + 1}`,
    );
  }
}

function createForwardNose(root, materials) {
  addMesh(
    root,
    createLatheBodyGeometry([
      [-3.20, 0.28],
      [-2.92, 0.36],
      [-2.50, 0.39],
      [-2.02, 0.36],
      [-1.55, 0.31],
    ], 24),
    materials.oliveDark,
    [0, -0.57, 0],
    null,
    [1.0, 0.62, 1.0],
    'stuka-visible-engine-nose',
  );

  addBox(
    root,
    [0.54, 0.27, 0.48],
    [0, -0.70, -2.35],
    materials.radiator,
    [0.04, 0, 0],
    'stuka-visible-radiator',
  );

  for (const side of [-1, 1]) {
    addCylinder(
      root,
      0.018,
      0.018,
      0.28,
      [side * 0.21, -0.34, -1.68],
      materials.frame,
      [Math.PI / 2, 0, 0],
      7,
      true,
      `stuka-cockpit-gun-trough-${side}`,
    );
  }
}

export function createJu87StukaCockpit() {
  const root = new THREE.Group();
  root.name = 'cockpit-ju87-stuka-v2';
  root.position.set(0, -0.47, -0.98);
  const materials = createMaterials();

  createGreenhouse(root, materials);
  createPanel(root, materials);
  createControls(root, materials);
  createForwardNose(root, materials);

  root.userData.visualVersion = 'ju87-stuka-cockpit-v2';
  root.userData.bounds = JU87_STUKA_COCKPIT_BOUNDS;
  return root;
}
