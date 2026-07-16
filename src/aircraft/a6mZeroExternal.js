import * as THREE from '../../vendor/three.module.min.js';
import {
  AIRCRAFT_VISUAL_COLORS,
  addBeamBetween,
  addBox,
  addCylinder,
  addHorizontalDisk,
  addMesh,
  addPanelLine,
  addSideDisk,
  addSphere,
  basicMaterial,
  createEllipticalWingGeometry,
  createLatheBodyGeometry,
  createPlanformGeometry,
  createPropellerBladeGeometry,
  createVerticalPlanformGeometry,
  createWedgeGeometry,
  lineMaterial,
  standardMaterial,
} from './aircraftVisualShared.js';

export const A6M_ZERO_VISUAL_BOUNDS = Object.freeze({
  length: 6.35,
  span: 8.15,
  height: 2.05,
  recommendedThirdPersonDistance: 8.8,
});

function createMaterials() {
  const ivory = standardMaterial(
    AIRCRAFT_VISUAL_COLORS.zeroIvory,
    0.56,
    0.14,
  );
  const ivoryShade = standardMaterial(
    AIRCRAFT_VISUAL_COLORS.zeroIvoryShade,
    0.68,
    0.12,
  );
  const ivoryWarm = standardMaterial(0xe2dccb, 0.64, 0.10);
  const red = standardMaterial(
    AIRCRAFT_VISUAL_COLORS.zeroRed,
    0.58,
    0.08,
  );
  const redBasic = basicMaterial(
    AIRCRAFT_VISUAL_COLORS.zeroRed,
    { side: THREE.DoubleSide, toneMapped: false },
  );
  const cowling = standardMaterial(
    AIRCRAFT_VISUAL_COLORS.zeroCowling,
    0.42,
    0.22,
  );
  const cowlingShade = standardMaterial(0x242829, 0.50, 0.18);
  const frame = standardMaterial(AIRCRAFT_VISUAL_COLORS.frame, 0.55, 0.18);
  const glass = standardMaterial(
    AIRCRAFT_VISUAL_COLORS.canopyGlass,
    0.16,
    0.03,
    {
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    },
  );
  const aluminum = standardMaterial(AIRCRAFT_VISUAL_COLORS.aluminum, 0.42, 0.42);
  const exhaust = standardMaterial(0x2a2521, 0.78, 0.15);
  const gun = standardMaterial(0x242728, 0.42, 0.28);
  const propeller = standardMaterial(AIRCRAFT_VISUAL_COLORS.propeller, 0.42, 0.18);
  const propellerTip = standardMaterial(AIRCRAFT_VISUAL_COLORS.propellerTip, 0.60, 0.08);
  const panel = lineMaterial(AIRCRAFT_VISUAL_COLORS.line, 0.42);
  const weather = lineMaterial(0x8d8879, 0.20);
  const propellerBlur = basicMaterial(0x34393b, {
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const navRed = basicMaterial(0xe24c45, { toneMapped: false });
  const navGreen = basicMaterial(0x62d68e, { toneMapped: false });

  return {
    ivory,
    ivoryShade,
    ivoryWarm,
    red,
    redBasic,
    cowling,
    cowlingShade,
    frame,
    glass,
    aluminum,
    exhaust,
    gun,
    propeller,
    propellerTip,
    panel,
    weather,
    propellerBlur,
    navRed,
    navGreen,
  };
}

function createFuselage(root, materials) {
  const body = addMesh(
    root,
    createLatheBodyGeometry([
      [-2.52, 0.48],
      [-2.18, 0.50],
      [-1.55, 0.49],
      [-0.78, 0.46],
      [0.02, 0.42],
      [0.82, 0.36],
      [1.55, 0.28],
      [2.18, 0.18],
      [2.65, 0.08],
    ], 28),
    materials.ivory,
    null,
    null,
    null,
    'zero-rounded-fuselage',
  );

  const underside = addMesh(
    root,
    createLatheBodyGeometry([
      [-1.72, 0.38],
      [-0.92, 0.36],
      [0.10, 0.31],
      [0.98, 0.24],
    ], 20),
    materials.ivoryShade,
    [0, -0.045, 0.02],
    null,
    [1, 0.56, 1],
    'zero-lower-fuselage-tonal-panel',
  );

  body.userData.section = 'fuselage';
  underside.userData.section = 'underside';

  addMesh(
    root,
    createLatheBodyGeometry([
      [-3.04, 0.38],
      [-2.92, 0.47],
      [-2.70, 0.54],
      [-2.42, 0.52],
      [-2.32, 0.48],
    ], 30),
    materials.cowling,
    null,
    null,
    null,
    'zero-tapered-radial-cowling',
  );

  addMesh(
    root,
    new THREE.TorusGeometry(0.455, 0.040, 8, 40),
    materials.cowlingShade,
    [0, 0, -3.02],
    null,
    null,
    'zero-cowling-lip',
  );

  addMesh(
    root,
    new THREE.CircleGeometry(0.414, 32),
    basicMaterial(0x111314, { side: THREE.DoubleSide }),
    [0, 0, -3.024],
    null,
    null,
    'zero-engine-face',
  );

  for (let index = 0; index < 14; index += 1) {
    const angle = index / 14 * Math.PI * 2;
    const vane = addBox(
      root,
      [0.040, 0.19, 0.018],
      [Math.cos(angle) * 0.286, Math.sin(angle) * 0.286, -3.032],
      materials.exhaust,
      null,
      `zero-cowling-vane-${index + 1}`,
    );
    vane.rotation.z = angle;
  }

  for (const z of [-2.32, -1.79, -1.17, -0.51, 0.22, 0.92, 1.54, 2.08]) {
    const radius = Math.max(0.15, 0.50 - Math.max(0, z + 1.2) * 0.095);
    addMesh(
      root,
      new THREE.TorusGeometry(radius, 0.008, 4, 38),
      materials.cowlingShade,
      [0, 0, z],
      null,
      [1, 0.96, 1],
      `zero-fuselage-station-${z}`,
    );
  }

  for (const side of [-1, 1]) {
    addPanelLine(
      root,
      [
        [side * 0.48, 0.04, -2.28],
        [side * 0.42, 0.07, 0.32],
        [side * 0.24, 0.06, 1.84],
      ],
      materials.panel,
    );

    addSideDisk(
      root,
      side,
      0.385,
      0.02,
      0.66,
      0.28,
      materials.redBasic,
    );
  }

  const accessPanel = [
    [-0.43, 0.33, -1.45],
    [0.43, 0.33, -1.45],
    [0.43, 0.33, -0.92],
    [-0.43, 0.33, -0.92],
    [-0.43, 0.33, -1.45],
  ];
  addPanelLine(root, accessPanel, materials.panel);

  addPanelLine(
    root,
    [
      [-0.32, -0.42, -1.64],
      [0.32, -0.42, -1.64],
      [0.29, -0.37, -0.88],
      [-0.29, -0.37, -0.88],
      [-0.32, -0.42, -1.64],
    ],
    materials.weather,
  );
}

function createWing(root, side, materials) {
  const wing = addMesh(
    root,
    createEllipticalWingGeometry({
      side,
      rootX: 0.30,
      semiSpan: 3.73,
      rootChord: 1.78,
      tipChord: 0.22,
      rootCenterZ: -0.08,
      sweep: 0.42,
      rootThickness: 0.125,
      tipThickness: 0.025,
      spanSteps: 14,
      chordSteps: 7,
      dihedral: t => 0.05 * t,
    }),
    materials.ivory,
    null,
    null,
    null,
    `zero-${side < 0 ? 'left' : 'right'}-elliptical-wing`,
  );

  const stripe = addMesh(
    root,
    createEllipticalWingGeometry({
      side,
      rootX: 2.50,
      semiSpan: 0.22,
      rootChord: 1.00,
      tipChord: 0.86,
      rootCenterZ: 0.15,
      sweep: 0.02,
      rootThickness: 0.010,
      tipThickness: 0.008,
      spanSteps: 2,
      chordSteps: 3,
      dihedral: () => 0.079,
    }),
    materials.red,
    null,
    null,
    null,
    `zero-${side < 0 ? 'left' : 'right'}-wing-stripe`,
  );
  stripe.renderOrder = 2;

  addHorizontalDisk(
    root,
    side * 1.72,
    0.112,
    -0.06,
    0.42,
    materials.redBasic,
  );
  addHorizontalDisk(
    root,
    side * 1.72,
    -0.113,
    -0.06,
    0.42,
    materials.redBasic,
    true,
  );

  const panelY = 0.132;
  for (const span of [0.65, 1.15, 1.68, 2.20, 2.72, 3.20]) {
    addPanelLine(
      root,
      [
        [side * span, panelY, -0.72 + span * 0.055],
        [side * span, panelY, 0.58 - span * 0.028],
      ],
      materials.panel,
    );
  }

  addPanelLine(
    root,
    [
      [side * 0.72, panelY + 0.001, 0.48],
      [side * 2.18, panelY + 0.001, 0.43],
      [side * 3.44, panelY + 0.001, 0.28],
    ],
    materials.panel,
  );

  addPanelLine(
    root,
    [
      [side * 2.08, panelY + 0.002, 0.29],
      [side * 3.48, panelY + 0.002, 0.20],
    ],
    materials.panel,
  );

  addCylinder(
    root,
    0.022,
    0.022,
    0.42,
    [side * 1.32, 0.055, -0.82],
    materials.gun,
    [Math.PI / 2, 0, 0],
    8,
    true,
    `zero-wing-cannon-${side}`,
  );

  addSphere(
    root,
    0.050,
    [side * 3.94, 0.065, 0.12],
    side < 0 ? materials.navRed : materials.navGreen,
    [1.0, 0.65, 1.15],
    10,
    6,
    `zero-navigation-light-${side}`,
  );

  return wing;
}

function createTail(root, materials) {
  for (const side of [-1, 1]) {
    const tail = addMesh(
      root,
      createEllipticalWingGeometry({
        side,
        rootX: 0.10,
        semiSpan: 1.42,
        rootChord: 0.82,
        tipChord: 0.18,
        rootCenterZ: 2.15,
        sweep: 0.18,
        rootThickness: 0.062,
        tipThickness: 0.018,
        spanSteps: 8,
        chordSteps: 5,
      }),
      materials.ivoryShade,
      null,
      null,
      null,
      `zero-${side < 0 ? 'left' : 'right'}-tailplane`,
    );
    tail.position.y = 0.04;

    addPanelLine(
      root,
      [
        [side * 0.28, 0.108, 2.42],
        [side * 1.28, 0.108, 2.42],
      ],
      materials.panel,
    );
  }

  const finPoints = [
    [1.86, 0.00],
    [1.92, 0.62],
    [2.06, 1.18, 2.30, 1.43],
    [2.52, 1.55, 2.69, 1.24],
    [2.74, 0.10],
    [2.64, 0.00],
  ];
  addMesh(
    root,
    createVerticalPlanformGeometry(finPoints, 0.085),
    materials.ivoryShade,
    null,
    null,
    null,
    'zero-vertical-fin',
  );

  const rudderPoints = [
    [2.40, 0.15],
    [2.45, 1.18],
    [2.55, 1.36, 2.66, 1.18],
    [2.72, 0.15],
  ];
  addMesh(
    root,
    createVerticalPlanformGeometry(rudderPoints, 0.090),
    materials.red,
    null,
    null,
    null,
    'zero-rudder',
  );

  addPanelLine(
    root,
    [
      [0.048, 0.16, 2.40],
      [0.048, 1.18, 2.45],
    ],
    materials.panel,
  );
}

function createCanopy(root, materials) {
  const canopy = new THREE.Group();
  canopy.name = 'zero-segmented-canopy';
  root.add(canopy);

  const sections = [
    {
      name: 'windscreen',
      frontZ: -1.31,
      backZ: -0.82,
      frontWidth: 0.72,
      backWidth: 0.92,
      frontHeight: 0.48,
      backHeight: 0.67,
      baseY: 0.24,
    },
    {
      name: 'sliding-canopy',
      frontZ: -0.82,
      backZ: 0.05,
      frontWidth: 0.92,
      backWidth: 0.82,
      frontHeight: 0.67,
      backHeight: 0.59,
      baseY: 0.23,
    },
    {
      name: 'rear-canopy',
      frontZ: 0.05,
      backZ: 0.58,
      frontWidth: 0.82,
      backWidth: 0.46,
      frontHeight: 0.59,
      backHeight: 0.30,
      baseY: 0.22,
    },
  ];

  for (const section of sections) {
    const glass = addMesh(
      canopy,
      createWedgeGeometry(section),
      materials.glass,
      null,
      null,
      null,
      `zero-canopy-${section.name}`,
    );
    glass.renderOrder = 4;
  }

  const frames = [
    [[-0.36, 0.24, -1.31], [-0.28, 0.72, -1.31]],
    [[0.36, 0.24, -1.31], [0.28, 0.72, -1.31]],
    [[-0.46, 0.23, -0.82], [-0.36, 0.90, -0.82]],
    [[0.46, 0.23, -0.82], [0.36, 0.90, -0.82]],
    [[-0.41, 0.23, 0.05], [-0.32, 0.82, 0.05]],
    [[0.41, 0.23, 0.05], [0.32, 0.82, 0.05]],
    [[-0.23, 0.22, 0.58], [-0.18, 0.52, 0.58]],
    [[0.23, 0.22, 0.58], [0.18, 0.52, 0.58]],
    [[-0.28, 0.72, -1.31], [0.28, 0.72, -1.31]],
    [[-0.36, 0.90, -0.82], [0.36, 0.90, -0.82]],
    [[-0.32, 0.82, 0.05], [0.32, 0.82, 0.05]],
    [[-0.18, 0.52, 0.58], [0.18, 0.52, 0.58]],
    [[0, 0.72, -1.31], [0, 0.90, -0.82]],
    [[0, 0.90, -0.82], [0, 0.82, 0.05]],
    [[0, 0.82, 0.05], [0, 0.52, 0.58]],
  ];
  frames.forEach((frame, index) => addBeamBetween(
    canopy,
    frame[0],
    frame[1],
    0.022,
    materials.frame,
    6,
    `zero-canopy-frame-${index + 1}`,
  ));

  addBox(
    root,
    [0.92, 0.09, 1.78],
    [0, 0.19, -0.34],
    materials.ivoryWarm,
    null,
    'zero-canopy-deck',
  );
}

function createPropeller(root, materials) {
  const propeller = new THREE.Group();
  propeller.name = 'zero-propeller';
  propeller.position.set(0, 0, -3.18);
  root.add(propeller);

  const blades = new THREE.Group();
  blades.name = 'zero-propeller-blades';
  propeller.add(blades);

  const bladeGeometry = createPropellerBladeGeometry({
    length: 1.58,
    rootWidth: 0.10,
    midWidth: 0.16,
    tipWidth: 0.075,
    depth: 0.040,
  });

  for (let index = 0; index < 3; index += 1) {
    const root = new THREE.Group();
    root.rotation.z = index / 3 * Math.PI * 2;
    blades.add(root);

    const blade = addMesh(
      root,
      bladeGeometry,
      materials.propeller,
      [0, 0.05, 0],
      [0.035, 0.12, -0.10],
      null,
      `zero-propeller-blade-${index + 1}`,
    );
    blade.userData.sharedGeometry = true;

    addBox(
      root,
      [0.13, 0.17, 0.050],
      [0, 1.46, 0],
      materials.propellerTip,
      null,
      `zero-propeller-tip-${index + 1}`,
    );
  }

  addCylinder(
    propeller,
    0.17,
    0.23,
    0.32,
    [0, 0, -0.05],
    materials.aluminum,
    [-Math.PI / 2, 0, 0],
    18,
    false,
    'zero-propeller-hub',
  );

  addMesh(
    propeller,
    new THREE.ConeGeometry(0.24, 0.46, 20),
    materials.ivoryShade,
    [0, 0, -0.30],
    [-Math.PI / 2, 0, 0],
    null,
    'zero-spinner',
  );

  const blur = addMesh(
    propeller,
    new THREE.CircleGeometry(1.62, 56),
    materials.propellerBlur,
    [0, 0, 0.035],
    null,
    null,
    'zero-propeller-blur',
  );
  blur.frustumCulled = false;
  blur.renderOrder = 6;

  propeller.userData.blades = blades;
  propeller.userData.blurDisk = blur;
  root.userData.propeller = propeller;
  root.userData.propellerBlur = blur;
}

function createDetails(root, materials) {
  for (const side of [-1, 1]) {
    for (let exhaust = 0; exhaust < 4; exhaust += 1) {
      addCylinder(
        root,
        0.031,
        0.041,
        0.22,
        [side * 0.48, -0.18 + exhaust * 0.095, -2.40],
        materials.exhaust,
        [0, 0, side * Math.PI / 2],
        7,
        true,
        `zero-exhaust-${side}-${exhaust + 1}`,
      );
    }

    addCylinder(
      root,
      0.018,
      0.018,
      0.32,
      [side * 0.18, 0.27, -2.72],
      materials.gun,
      [Math.PI / 2, 0, 0],
      7,
      true,
      `zero-cowl-gun-${side}`,
    );

    addSphere(
      root,
      0.39,
      [side * 0.36, -0.055, -0.05],
      materials.ivoryShade,
      [1.45, 0.34, 1.25],
      16,
      8,
      `zero-wing-root-fairing-${side}`,
    );

    addPanelLine(
      root,
      [
        [side * 0.62, 0.126, -0.54],
        [side * 1.30, 0.126, -0.56],
        [side * 1.86, 0.126, -0.48],
      ],
      materials.weather,
    );
  }
}

export function createA6MZeroExternal() {
  const root = new THREE.Group();
  root.name = 'external-a6m-zero-white-872-v2';
  const materials = createMaterials();

  createFuselage(root, materials);
  createWing(root, -1, materials);
  createWing(root, 1, materials);
  createTail(root, materials);
  createCanopy(root, materials);
  createPropeller(root, materials);
  createDetails(root, materials);

  root.userData.engine = 'RADIAL';
  root.userData.visualVersion = 'a6m-zero-procedural-v2';
  root.userData.bounds = A6M_ZERO_VISUAL_BOUNDS;
  root.userData.materialCountHint = Object.keys(materials).length;
  return root;
}
