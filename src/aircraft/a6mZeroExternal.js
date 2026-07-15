import * as THREE from '../../vendor/three.module.min.js';
import {
  ZERO_COLORS,
  addBox,
  addCylinder,
  addHorizontalRoundel,
  addMesh,
  addPanelLine,
  addSideRoundel,
  addSphere,
  basic,
  createHorizontalPlanformGeometry,
  createPropellerBladeGeometry,
  createVerticalPlanformGeometry,
  standard,
} from './a6mZeroShared.js';

const PANEL_Y = 0.082;

function createWing(root, side, materials) {
  const wingPoints = [
    [0.18, -0.96],
    [2.85, -0.57],
    [3.60, -0.42, 3.86, -0.08],
    [3.96, 0.19, 3.58, 0.55],
    [2.72, 0.69],
    [0.26, 0.72],
  ];

  const geometry = createHorizontalPlanformGeometry(wingPoints, 0.14);
  const wing = addMesh(
    root,
    geometry,
    materials.ivory,
    [side * 0.02, -0.055, -0.10],
  );
  wing.scale.x = side;

  const stripe = addBox(
    root,
    [0.34, 0.032, 1.18],
    [side * 2.62, 0.095, -0.01],
    materials.red,
    [0, side * 0.025, 0],
  );
  stripe.renderOrder = 2;

  addHorizontalRoundel(
    root,
    side * 1.72,
    0.102,
    -0.06,
    0.43,
    materials.redBasic,
  );
  addHorizontalRoundel(
    root,
    side * 1.72,
    -0.142,
    -0.06,
    0.43,
    materials.redBasic,
    true,
  );

  const lineMaterial = materials.panelLine;

  for (const span of [0.64, 1.18, 1.74, 2.28, 2.82, 3.32]) {
    addPanelLine(
      root,
      [
        [side * span, PANEL_Y, -0.69 + span * 0.035],
        [side * span, PANEL_Y, 0.60],
      ],
      lineMaterial,
    );
  }

  addPanelLine(
    root,
    [
      [side * 0.54, PANEL_Y, 0.48],
      [side * 3.35, PANEL_Y, 0.50],
      [side * 3.62, PANEL_Y, 0.36],
    ],
    lineMaterial,
  );

  addPanelLine(
    root,
    [
      [side * 2.06, PANEL_Y, 0.25],
      [side * 3.58, PANEL_Y, 0.29],
    ],
    lineMaterial,
  );

  const navigation = addSphere(
    root,
    0.055,
    [side * 3.82, 0.02, 0.08],
    side < 0 ? materials.navRed : materials.navGreen,
    [1.0, 0.72, 1.1],
    10,
    6,
  );
  navigation.renderOrder = 3;

  return wing;
}

function createTailplane(root, side, materials) {
  const points = [
    [0.10, -0.40],
    [1.05, -0.28],
    [1.42, -0.18, 1.51, 0.03],
    [1.47, 0.22, 1.17, 0.32],
    [0.12, 0.43],
  ];

  const geometry = createHorizontalPlanformGeometry(points, 0.085);
  const tail = addMesh(
    root,
    geometry,
    materials.ivoryShade,
    [side * 0.01, 0.01, 2.18],
  );
  tail.scale.x = side;

  addPanelLine(
    root,
    [
      [side * 0.18, 0.059, 2.48],
      [side * 1.32, 0.059, 2.45],
    ],
    materials.panelLine,
  );

  return tail;
}

function createVerticalTail(root, materials) {
  const finPoints = [
    [1.84, 0.00],
    [1.90, 0.62],
    [2.02, 1.19, 2.28, 1.42],
    [2.53, 1.52, 2.69, 1.22],
    [2.75, 0.18],
    [2.68, 0.00],
  ];

  addMesh(
    root,
    createVerticalPlanformGeometry(finPoints, 0.11),
    materials.ivoryShade,
  );

  const rudderPoints = [
    [2.37, 0.18],
    [2.42, 1.17],
    [2.54, 1.34, 2.65, 1.16],
    [2.72, 0.18],
  ];

  addMesh(
    root,
    createVerticalPlanformGeometry(rudderPoints, 0.118),
    materials.red,
  );

  addPanelLine(
    root,
    [
      [0.061, 0.20, 2.36],
      [0.061, 1.18, 2.42],
    ],
    materials.panelLine,
  );
}

function createCanopy(root, materials) {
  const canopyRoot = new THREE.Group();
  canopyRoot.name = 'zero-canopy';
  canopyRoot.position.set(0, 0.16, -0.44);
  root.add(canopyRoot);

  const glassGeometry = new THREE.SphereGeometry(
    0.70,
    20,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52,
  );

  const glass = addMesh(
    canopyRoot,
    glassGeometry,
    materials.glass,
    [0, 0.10, 0],
    null,
    [0.78, 0.82, 1.42],
  );
  glass.renderOrder = 4;

  addBox(canopyRoot, [0.055, 0.71, 0.055], [-0.54, 0.04, -0.15], materials.frame, [0.05, 0, -0.12]);
  addBox(canopyRoot, [0.055, 0.71, 0.055], [0.54, 0.04, -0.15], materials.frame, [0.05, 0, 0.12]);
  addBox(canopyRoot, [0.055, 0.68, 0.055], [-0.45, 0.06, 0.58], materials.frame, [-0.08, 0, -0.09]);
  addBox(canopyRoot, [0.055, 0.68, 0.055], [0.45, 0.06, 0.58], materials.frame, [-0.08, 0, 0.09]);
  addBox(canopyRoot, [1.06, 0.045, 0.045], [0, 0.62, -0.38], materials.frame);
  addBox(canopyRoot, [0.98, 0.045, 0.045], [0, 0.60, 0.34], materials.frame);
  addBox(canopyRoot, [0.055, 0.055, 1.48], [0, 0.62, 0.02], materials.frame);
  addBox(canopyRoot, [1.16, 0.11, 1.63], [0, -0.17, 0.10], materials.deck);

  return canopyRoot;
}

function createPropeller(root, materials) {
  const propeller = new THREE.Group();
  propeller.name = 'zero-propeller';
  propeller.position.set(0, 0, -3.08);
  root.add(propeller);

  const bladeGeometry = createPropellerBladeGeometry();

  for (let blade = 0; blade < 3; blade += 1) {
    const bladeRoot = new THREE.Group();
    bladeRoot.rotation.z = blade / 3 * Math.PI * 2;
    propeller.add(bladeRoot);

    const bladeMesh = addMesh(
      bladeRoot,
      bladeGeometry,
      materials.propeller,
      [0, 0.08, 0],
      [0.04, 0.13, -0.10],
    );
    bladeMesh.name = `zero-propeller-blade-${blade + 1}`;

    addBox(
      bladeRoot,
      [0.13, 0.16, 0.055],
      [0, 1.47, 0],
      materials.tip,
    );
  }

  const hub = addCylinder(
    propeller,
    0.18,
    0.23,
    0.36,
    [0, 0, -0.06],
    materials.aluminum,
    [-Math.PI / 2, 0, 0],
    16,
  );
  hub.name = 'zero-propeller-hub';

  const spinner = addMesh(
    propeller,
    new THREE.ConeGeometry(0.24, 0.48, 18),
    materials.ivoryShade,
    [0, 0, -0.32],
    [-Math.PI / 2, 0, 0],
  );
  spinner.name = 'zero-spinner';

  const blur = addMesh(
    propeller,
    new THREE.CircleGeometry(1.66, 48),
    materials.propellerBlur,
    [0, 0, 0.035],
  );
  blur.name = 'zero-propeller-blur';
  blur.renderOrder = 5;
  blur.frustumCulled = false;

  root.userData.propeller = propeller;
  root.userData.propellerBlur = blur;
  return propeller;
}

function createPanelDetails(root, materials) {
  for (const z of [-1.72, -1.22, -0.70, 0.02, 0.68, 1.28, 1.83]) {
    const radius = z < -1.2 ? 0.57 : Math.max(0.20, 0.50 - Math.max(0, z - 0.4) * 0.12);
    const ring = addMesh(
      root,
      new THREE.TorusGeometry(radius, 0.012, 5, 32),
      materials.panelBasic,
      [0, 0, z],
    );
    ring.scale.y = 0.94;
  }

  for (const side of [-1, 1]) {
    addPanelLine(
      root,
      [
        [side * 0.48, 0.05, -1.70],
        [side * 0.42, 0.07, 1.70],
      ],
      materials.panelLine,
    );

    addSideRoundel(
      root,
      side,
      0.405,
      0.02,
      0.88,
      0.29,
      materials.redBasic,
    );
  }

  for (const side of [-1, 1]) {
    for (let exhaust = 0; exhaust < 4; exhaust += 1) {
      addCylinder(
        root,
        0.035,
        0.043,
        0.24,
        [side * 0.52, -0.22 + exhaust * 0.11, -2.24],
        materials.exhaust,
        [0, 0, side * Math.PI / 2],
        7,
        true,
      );
    }
  }

  for (const side of [-1, 1]) {
    addCylinder(
      root,
      0.022,
      0.022,
      0.42,
      [side * 0.64, 0.10, -1.07],
      materials.gun,
      [Math.PI / 2, 0, 0],
      8,
      true,
    );
  }
}

export function createA6MZeroExternal() {
  const root = new THREE.Group();
  root.name = 'external-a6m-zero-white-872-detailed';

  const materials = {
    ivory: standard(ZERO_COLORS.ivory, 0.56, 0.16),
    ivoryShade: standard(ZERO_COLORS.ivoryShade, 0.68, 0.12),
    red: standard(ZERO_COLORS.red, 0.58, 0.09),
    redBasic: basic(ZERO_COLORS.red, {
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    cowling: standard(ZERO_COLORS.cowling, 0.43, 0.22),
    frame: standard(ZERO_COLORS.frame, 0.56, 0.18),
    deck: standard(0x505956, 0.75, 0.10),
    glass: standard(ZERO_COLORS.glass, 0.16, 0.04, {
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    aluminum: standard(ZERO_COLORS.aluminum, 0.42, 0.42),
    exhaust: standard(0x2b2521, 0.72, 0.18),
    gun: standard(0x242728, 0.42, 0.26),
    propeller: standard(0x25282a, 0.42, 0.18),
    tip: standard(0xd8b35c, 0.62, 0.08),
    panelLine: new THREE.LineBasicMaterial({
      color: ZERO_COLORS.line,
      transparent: true,
      opacity: 0.48,
      fog: true,
    }),
    panelBasic: basic(ZERO_COLORS.line, {
      transparent: true,
      opacity: 0.34,
      fog: true,
    }),
    navRed: basic(0xe04d45, { toneMapped: false }),
    navGreen: basic(0x63d58e, { toneMapped: false }),
    propellerBlur: basic(0x3a3d3e, {
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  };

  // Proportioned fuselage: broad radial-engine nose, full cockpit section and
  // a long, clean taper into the Zero's compact tail.
  addCylinder(root, 0.18, 0.51, 2.85, [0, -0.01, 1.18], materials.ivoryShade, [Math.PI / 2, 0, 0], 24);
  addCylinder(root, 0.51, 0.60, 1.74, [0, 0, -1.10], materials.ivory, [Math.PI / 2, 0, 0], 24);
  addCylinder(root, 0.59, 0.65, 0.94, [0, 0, -2.44], materials.cowling, [Math.PI / 2, 0, 0], 28);

  addMesh(
    root,
    new THREE.TorusGeometry(0.61, 0.055, 8, 36),
    materials.cowling,
    [0, 0, -2.94],
  );
  addMesh(
    root,
    new THREE.CircleGeometry(0.54, 28),
    basic(0x111314, { side: THREE.DoubleSide }),
    [0, 0, -2.945],
  );

  // Cowling flaps and subtle engine face.
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const vane = addBox(
      root,
      [0.055, 0.22, 0.025],
      [Math.cos(angle) * 0.37, Math.sin(angle) * 0.37, -2.97],
      materials.exhaust,
    );
    vane.rotation.z = angle;
  }

  createWing(root, -1, materials);
  createWing(root, 1, materials);
  createTailplane(root, -1, materials);
  createTailplane(root, 1, materials);
  createVerticalTail(root, materials);
  createCanopy(root, materials);
  createPanelDetails(root, materials);
  createPropeller(root, materials);

  // Wing-root fairings and retracted-gear door hints.
  for (const side of [-1, 1]) {
    addSphere(
      root,
      0.46,
      [side * 0.42, -0.07, -0.12],
      materials.ivoryShade,
      [1.55, 0.38, 1.30],
      14,
      8,
    );

    addBox(
      root,
      [0.22, 0.035, 0.72],
      [side * 1.02, -0.132, -0.02],
      materials.ivoryShade,
      [0, side * 0.05, 0],
    );
  }

  root.userData.engine = 'RADIAL';
  root.userData.visualVersion = 'a6m-zero-procedural-v1';
  return root;
}
