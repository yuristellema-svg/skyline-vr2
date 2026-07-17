import * as THREE from '../../vendor/three.module.min.js';

import {
  BIPLANE_DISPLAY_NAME,
  BIPLANE_ID,
  BIPLANE_MODEL,
} from './biplaneSpecs.js';

import {
  addBeamBetween,
  addBox,
  addCableBetween,
  addCylinder,
  addMesh,
  addPanelLine,
  addSphere,
  basicMaterial,
  collectBiplaneVisualStats,
  createGauge,
  lineMaterial,
  markDetail,
  setBiplaneDetailLevel,
  standardMaterial,
} from './biplaneVisualShared.js';

function createMaterials() {
  const frame = standardMaterial(0x343a38, 0.56, 0.34);
  const tube = standardMaterial(0x4d5652, 0.68, 0.24);
  const panel = standardMaterial(0x292821, 0.93, 0.05);
  const panelEdge = standardMaterial(0x181917, 0.90, 0.10);
  const leather = standardMaterial(0x4b3022, 0.97, 0.01);
  const leatherLight = standardMaterial(0x6b4934, 0.95, 0.01);
  const floor = standardMaterial(0x3b342a, 0.91, 0.04);
  const sideFabric = standardMaterial(0xd7cfb3, 0.93, 0.01);
  const brass = standardMaterial(0xb08a4c, 0.46, 0.46);
  const aluminum = standardMaterial(0xa5aaa4, 0.50, 0.42);
  const red = standardMaterial(0xa33b31, 0.72, 0.08);
  const yellow = standardMaterial(0xdbae39, 0.80, 0.025);
  const yellowShade = standardMaterial(0xb98328, 0.86, 0.03);
  const cream = standardMaterial(0xe3dcc0, 0.91, 0.015);
  const navy = standardMaterial(0x243b50, 0.72, 0.08);
  const glass = standardMaterial(0x8eb6bd, 0.13, 0.02, {
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const gaugeCasing = standardMaterial(0x151716, 0.74, 0.24);
  const gaugeFace = basicMaterial(0xd7d0ae, { toneMapped: false });
  const gaugeMark = basicMaterial(0x252720, { toneMapped: false });
  const gaugeNeedle = basicMaterial(0xa5372f, { toneMapped: false });
  const cable = lineMaterial(0x262927, 0.62);
  const placard = basicMaterial(0xc8b985, { toneMapped: false });
  const slipBall = basicMaterial(0x202321, { toneMapped: false });

  return {
    frame,
    tube,
    panel,
    panelEdge,
    leather,
    leatherLight,
    floor,
    sideFabric,
    brass,
    aluminum,
    red,
    yellow,
    yellowShade,
    cream,
    navy,
    glass,
    gaugeCasing,
    gaugeFace,
    gaugeMark,
    gaugeNeedle,
    cable,
    placard,
    slipBall,
  };
}

function createCockpitShell(root, materials) {
  const shell = new THREE.Group();
  shell.name = 'biplane-rear-open-cockpit-shell';
  markDetail(shell, 0);
  root.add(shell);

  const frontArc = addMesh(
    shell,
    new THREE.TorusGeometry(0.90, 0.074, 10, 42, Math.PI),
    materials.leather,
    [0, 0.40, -0.18],
    [Math.PI / 2, 0, Math.PI],
    [1, 1.06, 1],
    'biplane-cockpit-rim-forward-arc',
  );
  frontArc.userData.section = 'cockpit-rim';

  for (const side of [-1, 1]) {
    addBox(
      shell,
      [0.075, 0.09, 1.72],
      [side * 0.86, -0.11, 0.50],
      materials.leather,
      [0.02, 0, side * 0.02],
      `biplane-cockpit-side-rim-${side < 0 ? 'left' : 'right'}`,
    ).userData.section = 'cockpit-rim';

    addBox(
      shell,
      [0.12, 0.74, 1.64],
      [side * 0.82, -0.48, 0.50],
      materials.sideFabric,
      [0, 0, side * 0.015],
      `biplane-cockpit-sidewall-fabric-${side < 0 ? 'left' : 'right'}`,
      1,
    );
  }

  addBox(
    shell,
    [1.72, 0.10, 0.12],
    [0, 0.39, 1.33],
    materials.leather,
    null,
    'biplane-cockpit-rear-rim',
  ).userData.section = 'cockpit-rim';

  addBox(
    shell,
    [1.50, 0.11, 2.02],
    [0, -0.78, 0.40],
    materials.floor,
    [0.02, 0, 0],
    'biplane-cockpit-floor',
  );

  // Rear seat, cushion and period lap/shoulder harness.
  addBox(
    shell,
    [1.22, 0.82, 0.18],
    [0, -0.34, 1.16],
    materials.leatherLight,
    [-0.18, 0, 0],
    'biplane-rear-seat-back',
    1,
  );
  addBox(
    shell,
    [1.14, 0.18, 0.72],
    [0, -0.73, 0.84],
    materials.leather,
    [0.04, 0, 0],
    'biplane-rear-seat-cushion',
    1,
  );

  for (const side of [-1, 1]) {
    addBeamBetween(
      shell,
      [side * 0.36, 0.04, 1.23],
      [side * 0.16, -0.66, 0.88],
      0.025,
      materials.navy,
      8,
      `biplane-harness-shoulder-strap-${side < 0 ? 'left' : 'right'}`,
      2,
    );
    addBeamBetween(
      shell,
      [side * 0.48, -0.67, 0.85],
      [side * 0.10, -0.57, 0.56],
      0.025,
      materials.navy,
      8,
      `biplane-harness-lap-strap-${side < 0 ? 'left' : 'right'}`,
      2,
    );
  }

  addBox(
    shell,
    [0.18, 0.10, 0.16],
    [0, -0.58, 0.56],
    materials.aluminum,
    null,
    'biplane-harness-buckle',
    2,
  );
  return shell;
}

function createWindscreen(root, materials) {
  const glass = addMesh(
    root,
    new THREE.PlaneGeometry(1.42, 0.62),
    materials.glass,
    [0, 0.55, -1.20],
    [-0.20, 0, 0],
    null,
    'biplane-cockpit-windscreen-glass',
  );
  glass.renderOrder = 4;

  addBox(
    root,
    [1.54, 0.060, 0.070],
    [0, 0.24, -1.13],
    materials.frame,
    null,
    'biplane-windscreen-base-frame',
  );

  for (const side of [-1, 1]) {
    addBeamBetween(
      root,
      [side * 0.74, 0.24, -1.13],
      [side * 0.63, 0.84, -1.24],
      0.024,
      materials.frame,
      8,
      `biplane-windscreen-side-frame-${side < 0 ? 'left' : 'right'}`,
    );
  }

  addBeamBetween(
    root,
    [0, 0.24, -1.13],
    [0, 0.86, -1.24],
    0.022,
    materials.frame,
    8,
    'biplane-windscreen-center-frame',
  );
  return glass;
}

function createInstrumentPanel(root, materials) {
  const panelRoot = new THREE.Group();
  panelRoot.name = 'biplane-instrument-panel';
  panelRoot.position.set(0, -0.17, -1.30);
  panelRoot.rotation.x = -0.055;
  root.add(panelRoot);

  addBox(
    panelRoot,
    [1.64, 0.70, 0.13],
    [0, 0, 0],
    materials.panel,
    null,
    'biplane-instrument-panel-board',
  );

  addBox(
    panelRoot,
    [1.78, 0.11, 0.24],
    [0, 0.38, 0.02],
    materials.panelEdge,
    [-0.04, 0, 0],
    'biplane-instrument-panel-coaming',
  );

  const instruments = [
    createGauge(panelRoot, [-0.53, 0.13, 0.080], 0.155, 'IAS', materials, -1.55),
    createGauge(panelRoot, [-0.17, 0.16, 0.080], 0.170, 'ALT', materials, -1.20),
    createGauge(panelRoot, [0.22, 0.16, 0.080], 0.170, 'RPM', materials, -0.90),
    createGauge(panelRoot, [0.57, 0.12, 0.080], 0.145, 'OIL', materials, -0.35),
    createGauge(panelRoot, [-0.42, -0.20, 0.080], 0.112, 'VSI', materials, -1.25),
    createGauge(panelRoot, [-0.10, -0.20, 0.080], 0.112, 'TEMP', materials, -0.70),
    createGauge(panelRoot, [0.22, -0.20, 0.080], 0.112, 'FUEL', materials, 0.10),
  ];

  const compass = new THREE.Group();
  compass.name = 'biplane-magnetic-compass';
  compass.position.set(0.54, -0.22, 0.10);
  panelRoot.add(compass);
  addCylinder(
    compass,
    0.100,
    0.100,
    0.080,
    [0, 0, 0],
    materials.gaugeCasing,
    [Math.PI / 2, 0, 0],
    20,
    false,
    'biplane-compass-casing',
    1,
  );
  addMesh(
    compass,
    new THREE.CircleGeometry(0.082, 20),
    materials.gaugeFace,
    [0, 0, -0.046],
    null,
    null,
    'biplane-compass-card',
    1,
  );
  addBox(
    compass,
    [0.018, 0.11, 0.012],
    [0, 0, -0.055],
    materials.gaugeNeedle,
    null,
    'biplane-compass-pointer',
    1,
  );

  // Simple curved slip/skid indicator.
  addBox(
    panelRoot,
    [0.42, 0.085, 0.045],
    [0.42, -0.35, 0.085],
    materials.panelEdge,
    null,
    'biplane-slip-indicator-case',
    1,
  );
  const slipBall = addSphere(
    panelRoot,
    0.034,
    [0.42, -0.35, 0.052],
    materials.slipBall,
    [1, 0.82, 0.72],
    10,
    7,
    'biplane-slip-indicator-ball',
    1,
  );

  // Magnetos, primer and period placards.
  for (let index = 0; index < 4; index += 1) {
    addCylinder(
      panelRoot,
      0.025,
      0.025,
      0.050,
      [-0.66 + index * 0.15, -0.34, 0.105],
      index === 0 ? materials.red : materials.brass,
      [Math.PI / 2, 0, 0],
      10,
      false,
      `biplane-panel-switch-${index + 1}`,
      1,
    );
  }

  addBox(
    panelRoot,
    [0.29, 0.055, 0.022],
    [-0.42, 0.35, 0.085],
    materials.placard,
    null,
    'biplane-panel-airspeed-placard',
    2,
  );
  addBox(
    panelRoot,
    [0.34, 0.055, 0.022],
    [0.40, 0.35, 0.085],
    materials.placard,
    null,
    'biplane-panel-engine-placard',
    2,
  );

  panelRoot.userData.instruments = instruments;
  panelRoot.userData.compass = compass;
  panelRoot.userData.slipBall = slipBall;
  return { panelRoot, instruments, compass, slipBall };
}

function createControlColumn(root, materials) {
  const pivot = new THREE.Group();
  pivot.name = 'biplane-control-stick-pivot';
  pivot.position.set(0, -0.73, -0.34);
  root.add(pivot);

  const shaft = addBeamBetween(
    pivot,
    [0, 0, 0],
    [0, 0.70, -0.06],
    0.036,
    materials.tube,
    10,
    'biplane-control-stick-shaft',
  );
  shaft.userData.controlRole = 'control-stick';

  addCylinder(
    pivot,
    0.060,
    0.060,
    0.22,
    [0, 0.75, -0.07],
    materials.leather,
    [0, 0, Math.PI / 2],
    14,
    false,
    'biplane-control-stick-grip',
  ).userData.controlRole = 'control-stick';

  addSphere(
    pivot,
    0.055,
    [0, 0.75, -0.07],
    materials.leather,
    [1, 0.82, 1.20],
    12,
    8,
    'biplane-control-stick-grip-end',
    1,
  );
  return pivot;
}

function createRudderPedals(root, materials) {
  const pedalRoot = new THREE.Group();
  pedalRoot.name = 'biplane-rudder-pedal-assembly';
  pedalRoot.position.set(0, -0.73, -1.04);
  root.add(pedalRoot);

  const pedals = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = `biplane-rudder-pedal-${side < 0 ? 'left' : 'right'}-pivot`;
    pivot.position.set(side * 0.39, 0, 0);
    pedalRoot.add(pivot);

    addBeamBetween(
      pivot,
      [0, 0, 0.18],
      [0, 0.24, -0.05],
      0.026,
      materials.tube,
      8,
      `biplane-rudder-pedal-${side < 0 ? 'left' : 'right'}-arm`,
    );
    addBox(
      pivot,
      [0.28, 0.10, 0.16],
      [0, 0.25, -0.10],
      materials.aluminum,
      [-0.36, 0, 0],
      `biplane-rudder-pedal-${side < 0 ? 'left' : 'right'}-pad`,
    );
    addBox(
      pivot,
      [0.34, 0.025, 0.42],
      [0, -0.04, 0.05],
      materials.floor,
      null,
      `biplane-rudder-pedal-${side < 0 ? 'left' : 'right'}-heel-tray`,
      1,
    );
    pivot.userData.controlRole = 'rudder-pedal';
    pivot.userData.side = side < 0 ? 'left' : 'right';
    pedals.push(pivot);
  }
  return { pedalRoot, pedals };
}

function createThrottleQuadrant(root, materials) {
  const quadrant = new THREE.Group();
  quadrant.name = 'biplane-throttle-quadrant';
  quadrant.position.set(-0.78, -0.25, -0.42);
  root.add(quadrant);

  addBox(
    quadrant,
    [0.18, 0.48, 0.50],
    [0, 0, 0],
    materials.panelEdge,
    [0, 0, -0.08],
    'biplane-throttle-quadrant-case',
  );

  const throttlePivot = new THREE.Group();
  throttlePivot.name = 'biplane-throttle-lever-pivot';
  throttlePivot.position.set(0.12, 0.08, -0.02);
  quadrant.add(throttlePivot);
  addBeamBetween(
    throttlePivot,
    [0, -0.10, 0],
    [0, 0.36, -0.08],
    0.025,
    materials.aluminum,
    8,
    'biplane-throttle-lever',
  );
  addSphere(
    throttlePivot,
    0.072,
    [0, 0.41, -0.09],
    materials.red,
    [1, 1, 1.10],
    12,
    8,
    'biplane-throttle-knob',
  );
  throttlePivot.userData.controlRole = 'throttle';

  const mixturePivot = new THREE.Group();
  mixturePivot.name = 'biplane-mixture-lever-pivot';
  mixturePivot.position.set(-0.04, -0.02, 0.06);
  quadrant.add(mixturePivot);
  addBeamBetween(
    mixturePivot,
    [0, -0.08, 0],
    [0, 0.26, -0.04],
    0.020,
    materials.brass,
    8,
    'biplane-mixture-lever',
    1,
  );
  addSphere(
    mixturePivot,
    0.052,
    [0, 0.30, -0.05],
    materials.brass,
    null,
    10,
    7,
    'biplane-mixture-knob',
    1,
  );

  quadrant.userData.throttlePivot = throttlePivot;
  quadrant.userData.mixturePivot = mixturePivot;
  return quadrant;
}

function createStructuralTubes(root, materials) {
  const tubes = [];
  const tubePairs = [
    [[-0.82, -0.64, -0.92], [-0.82, 0.12, 0.82]],
    [[0.82, -0.64, -0.92], [0.82, 0.12, 0.82]],
    [[-0.82, -0.54, 0.75], [-0.56, 0.36, -0.86]],
    [[0.82, -0.54, 0.75], [0.56, 0.36, -0.86]],
    [[-0.82, -0.22, -0.42], [-0.82, 0.42, -1.12]],
    [[0.82, -0.22, -0.42], [0.82, 0.42, -1.12]],
  ];

  for (let index = 0; index < tubePairs.length; index += 1) {
    const tube = addBeamBetween(
      root,
      tubePairs[index][0],
      tubePairs[index][1],
      0.030,
      materials.tube,
      8,
      `biplane-cockpit-structural-tube-${index + 1}`,
      index < 4 ? 1 : 2,
    );
    tube.userData.structuralRole = 'structural-tube';
    tubes.push(tube);
  }
  return tubes;
}

function createFrontCockpitRelationship(root, materials) {
  const front = new THREE.Group();
  front.name = 'biplane-visible-front-cockpit';
  front.position.set(0, 0.02, -1.66);
  root.add(front);

  const rim = addMesh(
    front,
    new THREE.TorusGeometry(0.70, 0.058, 8, 34, Math.PI),
    materials.leather,
    [0, 0.34, 0],
    [Math.PI / 2, 0, Math.PI],
    [1, 1.05, 1],
    'biplane-visible-front-cockpit-rim',
  );
  rim.userData.structuralRole = 'front-cockpit-rim';

  for (const side of [-1, 1]) {
    addBox(
      front,
      [0.055, 0.07, 0.82],
      [side * 0.66, 0.02, 0.33],
      materials.leather,
      null,
      `biplane-visible-front-cockpit-side-rim-${side < 0 ? 'left' : 'right'}`,
      1,
    );
  }
  addBox(
    front,
    [1.28, 0.08, 0.08],
    [0, 0.32, 0.73],
    materials.leather,
    null,
    'biplane-visible-front-cockpit-rear-rim',
    1,
  );
  return front;
}

function createUpperWingRelationship(root, materials) {
  const wingRoot = new THREE.Group();
  wingRoot.name = 'biplane-visible-upper-wing-relationship';
  root.add(wingRoot);

  addBox(
    wingRoot,
    [9.40, 0.15, 1.72],
    [0, 1.62, -1.08],
    materials.yellow,
    [0, 0, 0],
    'biplane-cockpit-visible-upper-wing',
  ).userData.structuralRole = 'visible-upper-wing';

  addBox(
    wingRoot,
    [1.56, 0.17, 1.78],
    [0, 1.61, -1.08],
    materials.yellowShade,
    null,
    'biplane-cockpit-visible-upper-center-section',
    1,
  );

  for (const side of [-1, 1]) {
    for (const [lowerZ, upperZ, suffix] of [
      [-1.28, -1.63, 'forward'],
      [-0.20, -0.51, 'rear'],
    ]) {
      addBeamBetween(
        wingRoot,
        [side * 0.46, 0.48, lowerZ],
        [side * 0.62, 1.53, upperZ],
        0.045,
        materials.navy,
        8,
        `biplane-cockpit-visible-cabane-${side < 0 ? 'left' : 'right'}-${suffix}`,
      ).userData.structuralRole = 'visible-cabane-strut';
    }
  }

  addCylinder(
    wingRoot,
    0.065,
    0.065,
    0.025,
    [0.22, 1.72, -1.10],
    materials.frame,
    [Math.PI / 2, 0, 0],
    16,
    false,
    'biplane-cockpit-visible-fuel-cap',
    2,
  );
  return wingRoot;
}

function createNoseAndCowling(root, materials) {
  const nose = new THREE.Group();
  nose.name = 'biplane-cockpit-forward-nose-and-cowling';
  root.add(nose);

  addBox(
    nose,
    [1.18, 0.70, 1.60],
    [0, -0.14, -2.42],
    materials.cream,
    [-0.045, 0, 0],
    'biplane-cockpit-visible-forward-fuselage',
  );
  addMesh(
    nose,
    new THREE.TorusGeometry(0.53, 0.055, 10, 40, Math.PI),
    materials.yellow,
    [0, 0.04, -3.15],
    [0, 0, 0],
    [1, 1, 1],
    'biplane-cockpit-visible-cowling-arc',
    1,
  );

  for (const side of [-1, 1]) {
    addPanelLine(
      nose,
      [
        [side * 0.55, 0.12, -1.58],
        [side * 0.58, 0.05, -2.95],
      ],
      materials.cable,
      `biplane-cockpit-nose-panel-line-${side < 0 ? 'left' : 'right'}`,
      2,
    );
  }
  return nose;
}

function createVoiceTube(root, materials) {
  // Stearmans used a rubber Gosport voice tube between instructor and student.
  const tube = new THREE.Group();
  tube.name = 'biplane-gosport-voice-tube';
  root.add(tube);

  addCableBetween(
    tube,
    [-0.69, -0.05, 0.92],
    [-0.74, 0.12, -0.70],
    materials.cable,
    'biplane-gosport-rubber-hose',
    2,
  );
  addCylinder(
    tube,
    0.045,
    0.065,
    0.18,
    [-0.69, 0.02, 0.95],
    materials.panelEdge,
    [0, 0, -0.48],
    12,
    true,
    'biplane-gosport-mouthpiece',
    2,
  );
  return tube;
}

export function createBiplaneCockpit({ detailLevel = 2 } = {}) {
  const root = new THREE.Group();
  root.name = 'cockpit-pt17-biplane-dedicated-v2';
  root.position.set(0, -0.50, -0.60);
  const materials = createMaterials();

  createCockpitShell(root, materials);
  const windscreen = createWindscreen(root, materials);
  const panel = createInstrumentPanel(root, materials);
  const controlStick = createControlColumn(root, materials);
  const rudder = createRudderPedals(root, materials);
  const throttleQuadrant = createThrottleQuadrant(root, materials);
  const structuralTubes = createStructuralTubes(root, materials);
  const frontCockpit = createFrontCockpitRelationship(root, materials);
  const upperWing = createUpperWingRelationship(root, materials);
  const nose = createNoseAndCowling(root, materials);
  const voiceTube = createVoiceTube(root, materials);

  root.userData.aircraftId = BIPLANE_ID;
  root.userData.displayName = BIPLANE_DISPLAY_NAME;
  root.userData.sharedRenderPoseCompatible = true;
  root.userData.aircraftFixed = true;
  root.userData.cameraAttached = false;
  root.userData.visualVersion = 'pt17-biplane-cockpit-procedural-v2';
  root.userData.instruments = panel.instruments;
  root.userData.instrumentPanel = panel.panelRoot;
  root.userData.compass = panel.compass;
  root.userData.slipBall = panel.slipBall;
  root.userData.controls = {
    controlStick,
    rudderPedals: rudder.pedals,
    throttle: throttleQuadrant.userData.throttlePivot,
    mixture: throttleQuadrant.userData.mixturePivot,
  };
  root.userData.structure = {
    structuralTubes,
    windscreen,
    frontCockpit,
    upperWing,
    nose,
    voiceTube,
  };
  root.userData.cockpitReference = Object.freeze({
    position: 'rear instructor cockpit',
    forwardVisibility: 'between cabanes and below upper wing',
    frontCockpitVisible: true,
    upperWingVisible: true,
    modernCanopy: false,
  });

  setBiplaneDetailLevel(root, detailLevel);
  root.userData.visualStats = collectBiplaneVisualStats(root);
  return root;
}
