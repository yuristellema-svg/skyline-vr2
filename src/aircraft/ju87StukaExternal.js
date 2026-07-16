import * as THREE from '../../vendor/three.module.min.js';
import {
  AIRCRAFT_VISUAL_COLORS,
  addBeamBetween,
  addBox,
  addCylinder,
  addHorizontalDisk,
  addMesh,
  addPanelLine,
  addSphere,
  basicMaterial,
  createGullWingGeometry,
  createLatheBodyGeometry,
  createPlanformGeometry,
  createPropellerBladeGeometry,
  createVerticalPlanformGeometry,
  createWedgeGeometry,
  lineMaterial,
  standardMaterial,
} from './aircraftVisualShared.js';

export const JU87_STUKA_VISUAL_BOUNDS = Object.freeze({
  length: 6.85,
  span: 9.05,
  height: 2.55,
  recommendedThirdPersonDistance: 9.8,
});

function createMaterials() {
  return {
    olive: standardMaterial(AIRCRAFT_VISUAL_COLORS.stukaOlive, 0.76, 0.10),
    oliveDark: standardMaterial(AIRCRAFT_VISUAL_COLORS.stukaOliveDark, 0.78, 0.10),
    underside: standardMaterial(AIRCRAFT_VISUAL_COLORS.stukaUnderside, 0.72, 0.10),
    dark: standardMaterial(0x202423, 0.50, 0.22),
    radiator: standardMaterial(0x171a1a, 0.62, 0.25),
    glass: standardMaterial(AIRCRAFT_VISUAL_COLORS.canopyGlass, 0.16, 0.03, {
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    frame: standardMaterial(0x343b37, 0.58, 0.18),
    marking: basicMaterial(AIRCRAFT_VISUAL_COLORS.stukaMarking, {
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    markingWhite: basicMaterial(0xd4d6cd, {
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    panel: lineMaterial(0x525b53, 0.46),
    weather: lineMaterial(0x9b9989, 0.18),
    propeller: standardMaterial(AIRCRAFT_VISUAL_COLORS.propeller, 0.44, 0.20),
    tip: standardMaterial(AIRCRAFT_VISUAL_COLORS.propellerTip, 0.62, 0.08),
    aluminum: standardMaterial(AIRCRAFT_VISUAL_COLORS.aluminum, 0.44, 0.42),
    propellerBlur: basicMaterial(0x34393b, {
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  };
}

function createFuselage(root, materials) {
  addMesh(
    root,
    createLatheBodyGeometry([
      [-2.78, 0.34],
      [-2.42, 0.39],
      [-1.78, 0.42],
      [-0.90, 0.44],
      [0.12, 0.40],
      [1.08, 0.34],
      [1.88, 0.25],
      [2.56, 0.13],
      [2.98, 0.06],
    ], 24),
    materials.olive,
    null,
    null,
    null,
    'stuka-long-fuselage',
  );

  addMesh(
    root,
    createLatheBodyGeometry([
      [-3.18, 0.27],
      [-2.92, 0.35],
      [-2.58, 0.39],
      [-2.28, 0.37],
    ], 24),
    materials.oliveDark,
    null,
    null,
    null,
    'stuka-long-engine-nose',
  );

  addBox(
    root,
    [0.62, 0.34, 0.62],
    [0, -0.33, -2.44],
    materials.radiator,
    [0.05, 0, 0],
    'stuka-chin-radiator',
  );
  addBox(
    root,
    [0.48, 0.035, 0.46],
    [0, -0.50, -2.44],
    materials.marking,
    [0.05, 0, 0],
    'stuka-radiator-opening',
  );

  for (const z of [-2.42, -1.78, -1.02, -0.20, 0.62, 1.36, 2.02, 2.52]) {
    const radius = Math.max(0.13, 0.42 - Math.max(0, z + 0.8) * 0.085);
    addMesh(
      root,
      new THREE.TorusGeometry(radius, 0.008, 4, 34),
      materials.oliveDark,
      [0, 0, z],
      null,
      [1, 0.96, 1],
      `stuka-fuselage-station-${z}`,
    );
  }

  for (const side of [-1, 1]) {
    addPanelLine(
      root,
      [
        [side * 0.36, 0.08, -2.44],
        [side * 0.38, 0.10, 0.42],
        [side * 0.20, 0.08, 2.24],
      ],
      materials.panel,
    );
  }
}

function createWing(root, side, materials) {
  const wing = addMesh(
    root,
    createGullWingGeometry({
      side,
      sections: [
        { x: 0.30, y: -0.01, centerZ: -0.20, chord: 1.86, thickness: 0.15 },
        { x: 1.75, y: -0.36, centerZ: -0.08, chord: 1.48, thickness: 0.12 },
        { x: 3.10, y: -0.10, centerZ: 0.08, chord: 1.02, thickness: 0.075 },
        { x: 4.40, y: 0.11, centerZ: 0.24, chord: 0.40, thickness: 0.035 },
      ],
      spanSteps: 16,
      chordSteps: 6,
    }),
    materials.olive,
    null,
    null,
    null,
    `stuka-${side < 0 ? 'left' : 'right'}-inverted-gull-wing`,
  );

  addHorizontalDisk(
    root,
    side * 2.75,
    -0.01,
    0.08,
    0.30,
    materials.markingWhite,
  );
  addBox(
    root,
    [0.52, 0.018, 0.12],
    [side * 2.75, 0.005, 0.08],
    materials.marking,
    null,
    `stuka-wing-cross-horizontal-${side}`,
  );
  addBox(
    root,
    [0.12, 0.018, 0.52],
    [side * 2.75, 0.006, 0.08],
    materials.marking,
    null,
    `stuka-wing-cross-vertical-${side}`,
  );

  addPanelLine(
    root,
    [
      [side * 0.55, 0.13, 0.48],
      [side * 1.70, -0.24, 0.52],
      [side * 3.15, 0.02, 0.50],
      [side * 4.05, 0.15, 0.38],
    ],
    materials.panel,
  );
  addPanelLine(
    root,
    [
      [side * 2.20, -0.10, 0.36],
      [side * 4.04, 0.14, 0.30],
    ],
    materials.panel,
  );

  return wing;
}

function createLandingGear(root, side, materials) {
  const fairing = addMesh(
    root,
    createLatheBodyGeometry([
      [-0.58, 0.10],
      [-0.34, 0.18],
      [0.00, 0.22],
      [0.42, 0.16],
      [0.64, 0.08],
    ], 16),
    materials.oliveDark,
    [side * 1.55, -0.72, -0.10],
    [0, 0, 0],
    [0.72, 1.85, 0.72],
    `stuka-gear-fairing-${side}`,
  );
  fairing.rotation.x = Math.PI / 2;

  addCylinder(
    root,
    0.19,
    0.19,
    0.14,
    [side * 1.55, -1.36, 0.18],
    materials.dark,
    [0, 0, Math.PI / 2],
    14,
    false,
    `stuka-wheel-${side}`,
  );
  addCylinder(
    root,
    0.06,
    0.06,
    0.18,
    [side * 1.55, -1.36, 0.18],
    materials.aluminum,
    [0, 0, Math.PI / 2],
    10,
    false,
    `stuka-wheel-hub-${side}`,
  );
}

function createDiveBrakes(root, side, materials) {
  const brake = new THREE.Group();
  brake.name = `stuka-dive-brake-${side}`;
  brake.position.set(side * 2.88, -0.25, 0.32);
  brake.rotation.z = side * -0.05;
  root.add(brake);

  addBox(brake, [1.30, 0.035, 0.10], [0, 0, 0], materials.dark, null, 'stuka-dive-brake-spine');
  for (let index = 0; index < 7; index += 1) {
    addBox(
      brake,
      [0.065, 0.035, 0.34],
      [side * (-0.52 + index * 0.17), 0, 0],
      materials.dark,
      null,
      `stuka-dive-brake-rib-${index + 1}`,
    );
  }
}

function createTail(root, materials) {
  for (const side of [-1, 1]) {
    const tail = addMesh(
      root,
      createGullWingGeometry({
        side,
        sections: [
          { x: 0.10, y: 0.06, centerZ: 2.35, chord: 0.84, thickness: 0.055 },
          { x: 1.38, y: 0.08, centerZ: 2.46, chord: 0.24, thickness: 0.020 },
        ],
        spanSteps: 7,
        chordSteps: 4,
      }),
      materials.underside,
      null,
      null,
      null,
      `stuka-tailplane-${side}`,
    );
    tail.userData.controlSurface = 'elevator';
    addPanelLine(
      root,
      [
        [side * 0.25, 0.12, 2.60],
        [side * 1.16, 0.13, 2.59],
      ],
      materials.panel,
    );
  }

  const fin = [
    [1.98, 0.00],
    [2.04, 0.72],
    [2.18, 1.32, 2.43, 1.48],
    [2.63, 1.48, 2.83, 1.20],
    [2.94, 0.10],
    [2.84, 0.00],
  ];
  addMesh(
    root,
    createVerticalPlanformGeometry(fin, 0.09),
    materials.olive,
    null,
    null,
    null,
    'stuka-vertical-fin',
  );

  const rudder = [
    [2.50, 0.14],
    [2.56, 1.28],
    [2.68, 1.37, 2.78, 1.18],
    [2.91, 0.14],
  ];
  addMesh(
    root,
    createVerticalPlanformGeometry(rudder, 0.095),
    materials.oliveDark,
    null,
    null,
    null,
    'stuka-rudder',
  );
  addPanelLine(
    root,
    [
      [0.05, 0.14, 2.50],
      [0.05, 1.25, 2.56],
    ],
    materials.panel,
  );
}

function createCanopy(root, materials) {
  const canopy = new THREE.Group();
  canopy.name = 'stuka-greenhouse-canopy';
  root.add(canopy);

  const sections = [
    { frontZ: -1.42, backZ: -0.82, frontWidth: 0.62, backWidth: 0.78, frontHeight: 0.42, backHeight: 0.68, baseY: 0.22 },
    { frontZ: -0.82, backZ: -0.05, frontWidth: 0.78, backWidth: 0.82, frontHeight: 0.68, backHeight: 0.72, baseY: 0.22 },
    { frontZ: -0.05, backZ: 0.70, frontWidth: 0.82, backWidth: 0.78, frontHeight: 0.72, backHeight: 0.66, baseY: 0.22 },
    { frontZ: 0.70, backZ: 1.18, frontWidth: 0.78, backWidth: 0.48, frontHeight: 0.66, backHeight: 0.34, baseY: 0.22 },
  ];
  sections.forEach((section, index) => {
    const glass = addMesh(
      canopy,
      createWedgeGeometry(section),
      materials.glass,
      null,
      null,
      null,
      `stuka-canopy-glass-${index + 1}`,
    );
    glass.renderOrder = 4;
  });

  const zFrames = [-1.42, -0.82, -0.05, 0.70, 1.18];
  const widths = [0.31, 0.39, 0.41, 0.39, 0.24];
  const heights = [0.64, 0.90, 0.94, 0.88, 0.56];
  for (let index = 0; index < zFrames.length; index += 1) {
    const z = zFrames[index];
    const width = widths[index];
    const top = heights[index];
    addBeamBetween(canopy, [-width, 0.22, z], [-width * 0.80, top, z], 0.021, materials.frame, 6);
    addBeamBetween(canopy, [width, 0.22, z], [width * 0.80, top, z], 0.021, materials.frame, 6);
    addBeamBetween(canopy, [-width * 0.80, top, z], [width * 0.80, top, z], 0.021, materials.frame, 6);
  }
  addBeamBetween(canopy, [0, 0.64, -1.42], [0, 0.94, -0.05], 0.020, materials.frame, 6);
  addBeamBetween(canopy, [0, 0.94, -0.05], [0, 0.56, 1.18], 0.020, materials.frame, 6);
}

function createPropeller(root, materials) {
  const propeller = new THREE.Group();
  propeller.name = 'stuka-propeller';
  propeller.position.set(0, 0, -3.30);
  root.add(propeller);

  const blades = new THREE.Group();
  propeller.add(blades);
  const bladeGeometry = createPropellerBladeGeometry({
    length: 1.50,
    rootWidth: 0.11,
    midWidth: 0.17,
    tipWidth: 0.085,
    depth: 0.045,
  });

  for (let index = 0; index < 3; index += 1) {
    const bladeRoot = new THREE.Group();
    bladeRoot.rotation.z = index / 3 * Math.PI * 2;
    blades.add(bladeRoot);
    addMesh(
      bladeRoot,
      bladeGeometry,
      materials.propeller,
      [0, 0.05, 0],
      [0.04, 0.13, -0.08],
      null,
      `stuka-propeller-blade-${index + 1}`,
    );
    addBox(
      bladeRoot,
      [0.14, 0.16, 0.052],
      [0, 1.39, 0],
      materials.tip,
    );
  }

  addCylinder(
    propeller,
    0.20,
    0.25,
    0.38,
    [0, 0, -0.06],
    materials.aluminum,
    [-Math.PI / 2, 0, 0],
    18,
    false,
    'stuka-propeller-hub',
  );
  addMesh(
    propeller,
    new THREE.ConeGeometry(0.25, 0.44, 18),
    materials.oliveDark,
    [0, 0, -0.33],
    [-Math.PI / 2, 0, 0],
    null,
    'stuka-spinner',
  );

  const blur = addMesh(
    propeller,
    new THREE.CircleGeometry(1.55, 52),
    materials.propellerBlur,
    [0, 0, 0.035],
    null,
    null,
    'stuka-propeller-blur',
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
    createLandingGear(root, side, materials);
    createDiveBrakes(root, side, materials);

    addCylinder(
      root,
      0.022,
      0.022,
      0.34,
      [side * 1.05, 0.08, -0.86],
      materials.dark,
      [Math.PI / 2, 0, 0],
      8,
      true,
      `stuka-wing-gun-${side}`,
    );

    addPanelLine(
      root,
      [
        [side * 0.58, 0.11, -0.48],
        [side * 1.70, -0.24, -0.42],
        [side * 2.88, -0.02, -0.24],
      ],
      materials.weather,
    );
  }
}

export function createJu87StukaExternal() {
  const root = new THREE.Group();
  root.name = 'external-ju87-stuka-v2';
  const materials = createMaterials();

  createFuselage(root, materials);
  createWing(root, -1, materials);
  createWing(root, 1, materials);
  createTail(root, materials);
  createCanopy(root, materials);
  createPropeller(root, materials);
  createDetails(root, materials);

  root.userData.engine = 'V12';
  root.userData.visualVersion = 'ju87-stuka-procedural-v2';
  root.userData.bounds = JU87_STUKA_VISUAL_BOUNDS;
  root.userData.materialCountHint = Object.keys(materials).length;
  return root;
}
