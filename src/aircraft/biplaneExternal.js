import * as THREE from '../../vendor/three.module.min.js';

import {
  BIPLANE_DISPLAY_NAME,
  BIPLANE_ID,
  BIPLANE_MODEL,
  BIPLANE_VISUAL_BOUNDS,
  PT17_REFERENCE,
} from './biplaneSpecs.js';

import {
  addBeamBetween,
  addBox,
  addCableBetween,
  addCylinder,
  addHorizontalDisk,
  addMesh,
  addPanelLine,
  addSphere,
  basicMaterial,
  collectBiplaneVisualStats,
  createFabricWingGeometry,
  createLatheBodyGeometry,
  createPlanformGeometry,
  createPropellerBladeGeometry,
  createVerticalPlanformGeometry,
  lineMaterial,
  markDetail,
  setBiplaneDetailLevel,
  standardMaterial,
} from './biplaneVisualShared.js';

export { BIPLANE_VISUAL_BOUNDS } from './biplaneSpecs.js';

function createMaterials() {
  const trainerYellow = standardMaterial(0xdcae38, 0.80, 0.025);
  const trainerYellowLight = standardMaterial(0xe9c65a, 0.82, 0.02);
  const trainerYellowShade = standardMaterial(0xba8428, 0.88, 0.03);
  const fabricCream = standardMaterial(0xe5ddc1, 0.91, 0.015);
  const fabricCreamShade = standardMaterial(0xc7bea1, 0.94, 0.015);
  const metalCream = standardMaterial(0xd8cfb4, 0.72, 0.16);
  const navy = standardMaterial(0x243b50, 0.72, 0.08);
  const navyBasic = basicMaterial(0x243b50, {
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const steel = standardMaterial(0x444b49, 0.52, 0.36);
  const darkSteel = standardMaterial(0x202423, 0.64, 0.30);
  const engineSteel = standardMaterial(0x686e6a, 0.54, 0.42);
  const engineDark = standardMaterial(0x252928, 0.74, 0.26);
  const exhaust = standardMaterial(0x3c332c, 0.82, 0.26);
  const tire = standardMaterial(0x171817, 0.98, 0.01);
  const hub = standardMaterial(0xa3a69d, 0.50, 0.46);
  const leather = standardMaterial(0x4a3022, 0.97, 0.01);
  const seat = standardMaterial(0x5a4935, 0.94, 0.02);
  const wood = standardMaterial(0x935427, 0.68, 0.025);
  const woodLight = standardMaterial(0xc38342, 0.64, 0.02);
  const glass = standardMaterial(0x8eb6bd, 0.13, 0.02, {
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const panelLine = lineMaterial(0x6f654b, 0.42);
  const darkLine = lineMaterial(0x313533, 0.68);
  const wire = lineMaterial(0x363938, 0.66);
  const cable = lineMaterial(0x2a2c2b, 0.54);
  const redLight = basicMaterial(0xdb5649, { toneMapped: false });
  const greenLight = basicMaterial(0x55a779, { toneMapped: false });
  const blur = basicMaterial(0x8e704e, {
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  return {
    trainerYellow,
    trainerYellowLight,
    trainerYellowShade,
    fabricCream,
    fabricCreamShade,
    metalCream,
    navy,
    navyBasic,
    steel,
    darkSteel,
    engineSteel,
    engineDark,
    exhaust,
    tire,
    hub,
    leather,
    seat,
    wood,
    woodLight,
    glass,
    panelLine,
    darkLine,
    wire,
    cable,
    redLight,
    greenLight,
    blur,
  };
}

function createFuselage(root, materials) {
  const body = addMesh(
    root,
    createLatheBodyGeometry([
      [-3.32, 0.40],
      [-2.90, 0.52],
      [-2.25, 0.57],
      [-1.45, 0.59],
      [-0.55, 0.58],
      [0.35, 0.54],
      [1.20, 0.45],
      [2.05, 0.34],
      [2.78, 0.23],
      [3.36, 0.12],
      [3.62, 0.055],
    ], 30),
    materials.fabricCream,
    [0, BIPLANE_MODEL.fuselageCenterY, 0],
    null,
    [1, 0.93, 1],
    'biplane-welded-tube-fabric-fuselage',
  );
  body.userData.section = 'fuselage';
  body.userData.construction = PT17_REFERENCE.construction.fuselage;

  const lowerFabric = addMesh(
    root,
    createLatheBodyGeometry([
      [-2.42, 0.48],
      [-1.55, 0.49],
      [-0.55, 0.46],
      [0.45, 0.40],
      [1.35, 0.31],
      [2.12, 0.21],
    ], 22),
    materials.fabricCreamShade,
    [0, BIPLANE_MODEL.fuselageCenterY - 0.14, 0.02],
    null,
    [1, 0.54, 1],
    'biplane-lower-fabric-tonal-panel',
    1,
  );
  lowerFabric.userData.section = 'underside';

  const forwardMetal = addMesh(
    root,
    createLatheBodyGeometry([
      [-3.40, 0.43],
      [-3.18, 0.51],
      [-2.80, 0.56],
      [-2.34, 0.56],
      [-2.15, 0.55],
    ], 30),
    materials.metalCream,
    [0, BIPLANE_MODEL.fuselageCenterY, 0],
    null,
    [1, 0.93, 1],
    'biplane-forward-metal-skin',
  );
  forwardMetal.userData.section = 'forward-metal-skin';

  addMesh(
    root,
    new THREE.TorusGeometry(0.515, 0.055, 10, 48),
    materials.trainerYellow,
    [0, BIPLANE_MODEL.fuselageCenterY, -3.45],
    null,
    null,
    'biplane-circular-cowling-lip',
  );

  addMesh(
    root,
    new THREE.TorusGeometry(0.445, 0.022, 8, 42),
    materials.darkSteel,
    [0, BIPLANE_MODEL.fuselageCenterY, -3.48],
    null,
    null,
    'biplane-engine-retaining-ring',
    1,
  );

  for (const side of [-1, 1]) {
    addPanelLine(
      root,
      [
        [side * 0.50, 0.63, -2.38],
        [side * 0.50, 0.65, -1.25],
        [side * 0.45, 0.64, 0.35],
        [side * 0.31, 0.58, 1.88],
        [side * 0.15, 0.50, 3.15],
      ],
      materials.panelLine,
      `biplane-visible-fuselage-longeron-${side < 0 ? 'left' : 'right'}`,
      1,
    );
  }

  for (const z of [-2.35, -1.75, -1.12, -0.46, 0.18, 0.84, 1.50, 2.12, 2.68, 3.12]) {
    const radius = Math.max(0.13, 0.58 - Math.max(0, z + 0.65) * 0.10);
    addMesh(
      root,
      new THREE.TorusGeometry(radius, 0.007, 4, 38),
      materials.panelLine,
      [0, BIPLANE_MODEL.fuselageCenterY + 0.01, z],
      null,
      [1, 0.93, 1],
      `biplane-fabric-former-${String(z).replace('.', '-')}`,
      2,
    );
  }

  addBox(
    root,
    [0.10, 0.16, 4.72],
    [0, 0.85, 0.12],
    materials.navy,
    null,
    'biplane-dorsal-training-stripe',
    1,
  ).scale.x = 4.0;

  addBox(
    root,
    [0.74, 0.025, 0.64],
    [0, 0.96, -2.06],
    materials.metalCream,
    [-0.02, 0, 0],
    'biplane-forward-access-panel',
    1,
  );

  for (let index = 0; index < 8; index += 1) {
    addCylinder(
      root,
      0.014,
      0.014,
      0.020,
      [-0.28 + index * 0.08, 0.979, -2.06],
      materials.darkSteel,
      [Math.PI / 2, 0, 0],
      6,
      false,
      `biplane-access-panel-fastener-${index + 1}`,
      2,
    );
  }
}

function createRadialEngine(root, materials) {
  const engineRoot = new THREE.Group();
  engineRoot.name = 'biplane-continental-r670-seven-cylinder-radial';
  engineRoot.position.set(0, BIPLANE_MODEL.fuselageCenterY, -3.49);
  markDetail(engineRoot, 0);
  root.add(engineRoot);

  const cylinderCount = PT17_REFERENCE.powerplant.cylinders;
  const cylinderHeads = [];

  for (let index = 0; index < cylinderCount; index += 1) {
    const angle = Math.PI / 2 + index / cylinderCount * Math.PI * 2;
    const innerRadius = 0.15;
    const outerRadius = 0.405;
    const sx = Math.cos(angle) * innerRadius;
    const sy = Math.sin(angle) * innerRadius;
    const ex = Math.cos(angle) * outerRadius;
    const ey = Math.sin(angle) * outerRadius;

    const barrel = addBeamBetween(
      engineRoot,
      [sx, sy, 0],
      [ex, ey, 0],
      0.078,
      materials.engineSteel,
      12,
      `biplane-r670-cylinder-${index + 1}`,
    );
    barrel.userData.structuralRole = 'radial-cylinder';
    barrel.userData.cylinderIndex = index + 1;

    const head = addSphere(
      engineRoot,
      0.105,
      [ex, ey, -0.002],
      materials.engineDark,
      [1.18, 0.82, 0.74],
      16,
      10,
      `biplane-r670-cylinder-head-${index + 1}`,
      1,
    );
    head.userData.structuralRole = 'radial-cylinder-head';
    cylinderHeads.push(head);

    for (let fin = 0; fin < 3; fin += 1) {
      const radius = 0.090 + fin * 0.012;
      const coolingFin = addMesh(
        engineRoot,
        new THREE.TorusGeometry(radius, 0.008, 5, 18),
        materials.engineDark,
        [ex, ey, 0.012 - fin * 0.018],
        null,
        null,
        `biplane-r670-cooling-fin-${index + 1}-${fin + 1}`,
        2,
      );
      coolingFin.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0),
      );
    }

    addBeamBetween(
      engineRoot,
      [Math.cos(angle) * 0.13, Math.sin(angle) * 0.13, 0.025],
      [Math.cos(angle) * 0.35, Math.sin(angle) * 0.35, 0.025],
      0.015,
      materials.steel,
      6,
      `biplane-r670-pushrod-${index + 1}`,
      1,
    );

    addCableBetween(
      engineRoot,
      [Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, -0.025],
      [Math.cos(angle) * 0.40, Math.sin(angle) * 0.40, -0.025],
      materials.darkLine,
      `biplane-r670-ignition-lead-${index + 1}`,
      2,
    );
  }

  addCylinder(
    engineRoot,
    0.145,
    0.165,
    0.20,
    [0, 0, 0.018],
    materials.darkSteel,
    [Math.PI / 2, 0, 0],
    20,
    false,
    'biplane-r670-crankcase',
  );

  addMesh(
    engineRoot,
    new THREE.TorusGeometry(0.34, 0.025, 8, 42),
    materials.exhaust,
    [0, 0, 0.105],
    null,
    null,
    'biplane-r670-exhaust-collector-ring',
    1,
  );

  for (let index = 0; index < cylinderCount; index += 1) {
    const angle = Math.PI / 2 + index / cylinderCount * Math.PI * 2;
    addBeamBetween(
      engineRoot,
      [Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, 0.02],
      [Math.cos(angle) * 0.33, Math.sin(angle) * 0.33, 0.10],
      0.020,
      materials.exhaust,
      7,
      `biplane-r670-exhaust-stub-${index + 1}`,
      1,
    );
  }

  addBeamBetween(
    root,
    [0.28, 0.20, -3.25],
    [0.42, -0.05, -2.92],
    0.034,
    materials.exhaust,
    8,
    'biplane-exhaust-outlet',
    1,
  );

  engineRoot.userData.cylinderCount = cylinderCount;
  engineRoot.userData.cylinderHeads = cylinderHeads;
  return engineRoot;
}

function wingChordAt(config, t) {
  const rounded = Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.25)));
  return config.tipChord +
    (config.rootChord - config.tipChord) * Math.pow(rounded, 0.58);
}

function createWingPanel({
  root,
  materials,
  side,
  level,
  y,
  centerZ,
  rootX,
  semiSpan,
  rootChord,
  tipChord,
  thickness,
  ribCount,
  colorMaterial,
  undersideMaterial,
  sweep,
  dihedral,
}) {
  const panelRoot = new THREE.Group();
  panelRoot.name = `biplane-${level}-${side < 0 ? 'left' : 'right'}-wing-panel-root`;
  panelRoot.position.y = y;
  markDetail(panelRoot, 0);
  root.add(panelRoot);

  const wing = addMesh(
    panelRoot,
    createFabricWingGeometry({
      side,
      rootX,
      semiSpan,
      rootChord,
      tipChord,
      rootCenterZ: centerZ,
      sweep,
      rootThickness: thickness,
      tipThickness: thickness * 0.32,
      spanSteps: ribCount * 2,
      chordSteps: 9,
      dihedral,
      camber: level === 'upper' ? 0.030 : 0.026,
    }),
    colorMaterial,
    null,
    null,
    null,
    `biplane-${level}-${side < 0 ? 'left' : 'right'}-fabric-wing`,
  );
  wing.userData.wingLevel = level;
  wing.userData.side = side < 0 ? 'left' : 'right';
  wing.userData.construction = PT17_REFERENCE.construction.wings;

  const underside = addMesh(
    panelRoot,
    createFabricWingGeometry({
      side,
      rootX: rootX + 0.01,
      semiSpan: semiSpan - 0.02,
      rootChord: rootChord - 0.04,
      tipChord: Math.max(0.30, tipChord - 0.04),
      rootCenterZ: centerZ + 0.01,
      sweep,
      rootThickness: thickness * 0.08,
      tipThickness: thickness * 0.05,
      spanSteps: Math.max(8, ribCount),
      chordSteps: 4,
      dihedral,
      camber: -0.005,
    }),
    undersideMaterial,
    [0, -thickness * 0.86, 0],
    null,
    null,
    `biplane-${level}-${side < 0 ? 'left' : 'right'}-underside-fabric-tone`,
    2,
  );
  underside.userData.wingLevel = `${level}-underside-tone`;

  for (let rib = 1; rib <= ribCount; rib += 1) {
    const t = rib / (ribCount + 1);
    const chord = wingChordAt({ rootChord, tipChord }, t);
    const x = side * (rootX + semiSpan * t);
    const ribCenterZ = centerZ + sweep * Math.pow(t, 1.12);
    const ribY = dihedral * Math.pow(t, 1.30) + thickness + 0.014;
    const cap = addBox(
      panelRoot,
      [0.020, 0.018, chord * 0.94],
      [x, ribY, ribCenterZ],
      materials.trainerYellowLight,
      [0, 0, 0],
      `biplane-${level}-${side < 0 ? 'left' : 'right'}-rib-cap-${rib}`,
      1,
    );
    cap.userData.structuralRole = 'wing-rib';
    cap.userData.wingLevel = level;
  }

  addPanelLine(
    panelRoot,
    [
      [side * (rootX + semiSpan * 0.18), thickness + 0.028, centerZ + rootChord * 0.37],
      [side * (rootX + semiSpan * 0.56), thickness + 0.045, centerZ + sweep * 0.56 + rootChord * 0.34],
      [side * (rootX + semiSpan * 0.91), thickness + 0.062, centerZ + sweep * 0.91 + tipChord * 0.28],
    ],
    materials.darkLine,
    `biplane-${level}-${side < 0 ? 'left' : 'right'}-rear-spar-line`,
    1,
  );

  return { panelRoot, wing, underside };
}

function createAileron(root, materials, side) {
  const config = BIPLANE_MODEL.lowerWing;
  const pivot = new THREE.Group();
  pivot.name = `biplane-${side < 0 ? 'left' : 'right'}-lower-wing-aileron-pivot`;
  const hingeZ = config.centerZ + 0.50;
  pivot.position.set(0, config.y + 0.015, hingeZ);
  pivot.userData.controlSurface = 'aileron';
  pivot.userData.side = side < 0 ? 'left' : 'right';
  root.add(pivot);

  const innerX = config.rootX + config.outerSemiSpan * 0.46;
  const outerX = config.rootX + config.outerSemiSpan * 0.91;
  const centerX = side * (innerX + outerX) * 0.5;
  const span = outerX - innerX;
  const localCenterZ = 0.19;

  const mesh = addBox(
    pivot,
    [span, 0.050, 0.38],
    [centerX, 0, localCenterZ],
    materials.trainerYellowShade,
    [0, side * 0.012, 0],
    `biplane-${side < 0 ? 'left' : 'right'}-lower-wing-aileron`,
  );
  mesh.userData.controlSurface = 'aileron';
  mesh.userData.wingLevel = 'lower';

  for (let rib = 0; rib < 4; rib += 1) {
    addBox(
      pivot,
      [0.016, 0.012, 0.33],
      [
        side * (innerX + span * (0.15 + rib * 0.23)),
        0.035,
        localCenterZ,
      ],
      materials.trainerYellowLight,
      null,
      `biplane-${side < 0 ? 'left' : 'right'}-aileron-rib-${rib + 1}`,
      2,
    );
  }
  return pivot;
}

function createWings(root, materials) {
  const upper = BIPLANE_MODEL.upperWing;
  const lower = BIPLANE_MODEL.lowerWing;
  const wingPanels = [];

  const centerSection = addMesh(
    root,
    createPlanformGeometry([
      [-upper.centerSectionHalfSpan, upper.centerZ - upper.rootChord * 0.52],
      [upper.centerSectionHalfSpan, upper.centerZ - upper.rootChord * 0.52],
      [upper.centerSectionHalfSpan, upper.centerZ + upper.rootChord * 0.48],
      [-upper.centerSectionHalfSpan, upper.centerZ + upper.rootChord * 0.48],
    ], upper.thickness * 1.35),
    materials.trainerYellow,
    [0, upper.y, 0],
    null,
    null,
    'biplane-upper-wing-center-section-fuel-tank',
  );
  centerSection.userData.wingLevel = 'upper';
  centerSection.userData.structuralRole = 'upper-center-section';
  wingPanels.push(centerSection);

  addCylinder(
    root,
    0.070,
    0.070,
    0.025,
    [0.22, upper.y + 0.095, upper.centerZ - 0.08],
    materials.darkSteel,
    [Math.PI / 2, 0, 0],
    18,
    false,
    'biplane-upper-wing-fuel-filler-cap',
    1,
  );

  for (const side of [-1, 1]) {
    const upperPanel = createWingPanel({
      root,
      materials,
      side,
      level: 'upper',
      y: upper.y,
      centerZ: upper.centerZ,
      rootX: upper.centerSectionHalfSpan,
      semiSpan: upper.outerSemiSpan,
      rootChord: upper.rootChord,
      tipChord: upper.tipChord,
      thickness: upper.thickness,
      ribCount: upper.ribCountPerSide,
      colorMaterial: materials.trainerYellow,
      undersideMaterial: materials.fabricCream,
      sweep: 0.13,
      dihedral: 0.035,
    });
    wingPanels.push(upperPanel.wing);

    const lowerPanel = createWingPanel({
      root,
      materials,
      side,
      level: 'lower',
      y: lower.y,
      centerZ: lower.centerZ,
      rootX: lower.rootX,
      semiSpan: lower.outerSemiSpan,
      rootChord: lower.rootChord,
      tipChord: lower.tipChord,
      thickness: lower.thickness,
      ribCount: lower.ribCountPerSide,
      colorMaterial: materials.trainerYellow,
      undersideMaterial: materials.fabricCream,
      sweep: 0.08,
      dihedral: 0.050,
    });
    wingPanels.push(lowerPanel.wing);

    addHorizontalDisk(
      root,
      side * 2.60,
      upper.y + upper.thickness + 0.022,
      upper.centerZ - 0.05,
      0.42,
      materials.navyBasic,
      false,
      `biplane-${side < 0 ? 'left' : 'right'}-upper-wing-training-roundel`,
      1,
    );

    const lightMaterial = side < 0 ? materials.redLight : materials.greenLight;
    addSphere(
      root,
      0.055,
      [
        side * (upper.centerSectionHalfSpan + upper.outerSemiSpan - 0.08),
        upper.y + 0.05,
        upper.centerZ + 0.08,
      ],
      lightMaterial,
      [1.10, 0.70, 0.86],
      10,
      6,
      `biplane-${side < 0 ? 'left-red' : 'right-green'}-navigation-light`,
      2,
    );
  }

  const leftAileron = createAileron(root, materials, -1);
  const rightAileron = createAileron(root, materials, 1);

  return {
    wingPanels,
    leftAileron,
    rightAileron,
  };
}

function addStructuralRole(object, role) {
  object.userData.structuralRole = role;
  return object;
}

function createStrutsAndBracing(root, materials) {
  const upper = BIPLANE_MODEL.upperWing;
  const lower = BIPLANE_MODEL.lowerWing;
  const interplaneStruts = [];
  const cabaneStruts = [];
  const bracingWires = [];

  for (const side of [-1, 1]) {
    const x = side * 3.13;
    const frontLower = [x, lower.y + 0.09, lower.centerZ - 0.55];
    const rearLower = [x, lower.y + 0.09, lower.centerZ + 0.55];
    const frontUpper = [x, upper.y - 0.08, upper.centerZ - 0.57];
    const rearUpper = [x, upper.y - 0.08, upper.centerZ + 0.56];

    interplaneStruts.push(addStructuralRole(addBeamBetween(
      root,
      frontLower,
      frontUpper,
      0.052,
      materials.navy,
      8,
      `biplane-${side < 0 ? 'left' : 'right'}-interplane-front-strut`,
    ), 'interplane-strut'));

    interplaneStruts.push(addStructuralRole(addBeamBetween(
      root,
      rearLower,
      rearUpper,
      0.052,
      materials.navy,
      8,
      `biplane-${side < 0 ? 'left' : 'right'}-interplane-rear-strut`,
    ), 'interplane-strut'));

    interplaneStruts.push(addStructuralRole(addBeamBetween(
      root,
      rearLower,
      frontUpper,
      0.043,
      materials.navy,
      8,
      `biplane-${side < 0 ? 'left' : 'right'}-interplane-diagonal-n-strut`,
    ), 'interplane-strut'));

    for (const [start, end, suffix] of [
      [frontLower, rearUpper, 'bay-forward-cross-wire'],
      [rearLower, frontUpper, 'bay-rear-cross-wire'],
      [[side * 0.52, lower.y + 0.08, lower.centerZ - 0.52], frontUpper, 'inner-flying-wire'],
      [[side * 0.52, lower.y + 0.08, lower.centerZ + 0.52], rearUpper, 'inner-landing-wire'],
    ]) {
      const wire = addCableBetween(
        root,
        start,
        end,
        materials.wire,
        `biplane-${side < 0 ? 'left' : 'right'}-${suffix}`,
        1,
      );
      wire.userData.structuralRole = 'bracing-wire';
      bracingWires.push(wire);
    }
  }

  for (const side of [-1, 1]) {
    for (const [lowerZ, upperZ, suffix] of [
      [-1.20, upper.centerZ - 0.58, 'forward'],
      [0.05, upper.centerZ + 0.56, 'rear'],
    ]) {
      const lowerPoint = [side * 0.46, 0.92, lowerZ];
      const upperPoint = [side * 0.60, upper.y - 0.09, upperZ];
      const strut = addBeamBetween(
        root,
        lowerPoint,
        upperPoint,
        0.045,
        materials.navy,
        8,
        `biplane-${side < 0 ? 'left' : 'right'}-cabane-${suffix}-strut`,
      );
      strut.userData.structuralRole = 'cabane-strut';
      cabaneStruts.push(strut);
    }
  }

  for (const [start, end, suffix] of [
    [[-0.46, 0.92, -1.20], [0.60, upper.y - 0.09, upper.centerZ - 0.58], 'front-cross-a'],
    [[0.46, 0.92, -1.20], [-0.60, upper.y - 0.09, upper.centerZ - 0.58], 'front-cross-b'],
    [[-0.46, 0.92, 0.05], [0.60, upper.y - 0.09, upper.centerZ + 0.56], 'rear-cross-a'],
    [[0.46, 0.92, 0.05], [-0.60, upper.y - 0.09, upper.centerZ + 0.56], 'rear-cross-b'],
  ]) {
    const wire = addCableBetween(root, start, end, materials.wire, `biplane-cabane-${suffix}`, 2);
    wire.userData.structuralRole = 'bracing-wire';
    bracingWires.push(wire);
  }

  return { interplaneStruts, cabaneStruts, bracingWires };
}

function createExternalCockpit(root, materials, z, label) {
  const cockpitRoot = new THREE.Group();
  cockpitRoot.name = `biplane-external-${label}-open-cockpit`;
  cockpitRoot.position.set(0, 0.90, z);
  markDetail(cockpitRoot, 0);
  root.add(cockpitRoot);

  const cavity = addSphere(
    cockpitRoot,
    0.49,
    [0, -0.18, 0.03],
    materials.darkSteel,
    [0.94, 0.55, 0.86],
    18,
    10,
    `biplane-${label}-open-cockpit-cavity`,
  );
  cavity.userData.structuralRole = 'open-cockpit-cavity';

  addBox(
    cockpitRoot,
    [0.72, 0.30, 0.08],
    [0, -0.15, -0.28],
    materials.darkSteel,
    [-0.08, 0, 0],
    `biplane-${label}-external-instrument-panel-hint`,
    1,
  );

  const frontArc = addMesh(
    cockpitRoot,
    new THREE.TorusGeometry(0.50, 0.050, 8, 28, Math.PI),
    materials.leather,
    [0, 0, -0.34],
    [Math.PI / 2, 0, Math.PI],
    [1, 1.12, 1],
    `biplane-${label}-cockpit-forward-rim`,
  );
  frontArc.userData.structuralRole = 'cockpit-rim';

  for (const side of [-1, 1]) {
    addBox(
      cockpitRoot,
      [0.050, 0.065, 0.74],
      [side * 0.48, -0.01, 0.02],
      materials.leather,
      [0, 0, side * 0.02],
      `biplane-${label}-cockpit-side-rim-${side < 0 ? 'left' : 'right'}`,
    ).userData.structuralRole = 'cockpit-rim';
  }

  addBox(
    cockpitRoot,
    [0.96, 0.070, 0.06],
    [0, 0, 0.40],
    materials.leather,
    null,
    `biplane-${label}-cockpit-rear-rim`,
  ).userData.structuralRole = 'cockpit-rim';

  addBox(
    cockpitRoot,
    [0.68, 0.38, 0.16],
    [0, -0.42, 0.18],
    materials.seat,
    [-0.16, 0, 0],
    `biplane-${label}-seat-back`,
    1,
  );

  const glass = addMesh(
    cockpitRoot,
    new THREE.PlaneGeometry(0.78, 0.34),
    materials.glass,
    [0, 0.32, -0.43],
    [-0.22, 0, 0],
    null,
    `biplane-${label}-windscreen-glass`,
  );
  glass.renderOrder = 4;
  glass.userData.structuralRole = 'windscreen';

  for (const side of [-1, 1]) {
    addBeamBetween(
      cockpitRoot,
      [side * 0.40, 0.06, -0.38],
      [side * 0.34, 0.50, -0.46],
      0.018,
      materials.steel,
      7,
      `biplane-${label}-windscreen-frame-${side < 0 ? 'left' : 'right'}`,
      1,
    );
  }
  addBeamBetween(
    cockpitRoot,
    [0, 0.06, -0.38],
    [0, 0.51, -0.46],
    0.016,
    materials.steel,
    7,
    `biplane-${label}-windscreen-center-frame`,
    1,
  );
  return cockpitRoot;
}

function createLandingGear(root, materials) {
  const wheelRoots = [];
  const struts = [];
  const wheelY = -0.57;
  const wheelZ = -0.74;
  const halfTrack = BIPLANE_MODEL.mainGearTrack * 0.5;

  for (const side of [-1, 1]) {
    const axle = [side * halfTrack, wheelY, wheelZ];
    const forwardMount = [side * 0.43, 0.20, -1.20];
    const rearMount = [side * 0.48, 0.16, -0.28];

    for (const [mount, suffix] of [
      [forwardMount, 'forward'],
      [rearMount, 'rear'],
    ]) {
      const strut = addBeamBetween(
        root,
        mount,
        axle,
        0.066,
        materials.steel,
        10,
        `biplane-${side < 0 ? 'left' : 'right'}-landing-gear-${suffix}-strut`,
      );
      strut.userData.structuralRole = 'landing-gear-strut';
      struts.push(strut);
    }

    addBeamBetween(
      root,
      [side * 0.56, 0.05, -0.98],
      [side * halfTrack, wheelY + 0.04, wheelZ],
      0.038,
      materials.darkSteel,
      8,
      `biplane-${side < 0 ? 'left' : 'right'}-landing-gear-shock-link`,
      1,
    ).userData.structuralRole = 'landing-gear-shock-link';

    const wheelRoot = new THREE.Group();
    wheelRoot.name = `biplane-${side < 0 ? 'left' : 'right'}-main-wheel-root`;
    wheelRoot.position.set(...axle);
    root.add(wheelRoot);

    const tire = addMesh(
      wheelRoot,
      new THREE.TorusGeometry(BIPLANE_MODEL.mainWheelRadius, 0.105, 10, 32),
      materials.tire,
      [0, 0, 0],
      [0, Math.PI / 2, 0],
      null,
      `biplane-${side < 0 ? 'left' : 'right'}-main-wheel-tire`,
    );
    tire.userData.structuralRole = 'landing-gear-wheel';

    addCylinder(
      wheelRoot,
      0.19,
      0.19,
      0.13,
      [0, 0, 0],
      materials.hub,
      [0, 0, Math.PI / 2],
      20,
      false,
      `biplane-${side < 0 ? 'left' : 'right'}-main-wheel-hub`,
      1,
    );

    addCylinder(
      root,
      0.030,
      0.030,
      0.30,
      [side * 1.02, -0.54, wheelZ],
      materials.darkSteel,
      [0, 0, Math.PI / 2],
      10,
      false,
      `biplane-${side < 0 ? 'left' : 'right'}-wheel-axle`,
      1,
    );
    wheelRoots.push(wheelRoot);
  }

  addBeamBetween(
    root,
    [-halfTrack, wheelY + 0.02, wheelZ],
    [halfTrack, wheelY + 0.02, wheelZ],
    0.036,
    materials.darkSteel,
    10,
    'biplane-main-gear-cross-axle',
    1,
  ).userData.structuralRole = 'landing-gear-axle';

  const tailStrut = addBeamBetween(
    root,
    [0, 0.31, 3.10],
    [0, -0.12, 3.47],
    0.035,
    materials.darkSteel,
    8,
    'biplane-tailwheel-strut',
  );
  tailStrut.userData.structuralRole = 'landing-gear-strut';

  const tailWheel = addMesh(
    root,
    new THREE.TorusGeometry(0.145, 0.045, 8, 24),
    materials.tire,
    [0, -0.16, 3.53],
    [0, Math.PI / 2, 0],
    null,
    'biplane-tailwheel',
  );
  tailWheel.userData.structuralRole = 'landing-gear-wheel';

  return { wheelRoots, struts, tailWheel };
}

function createTail(root, materials) {
  const stabilizer = addMesh(
    root,
    createPlanformGeometry([
      [-2.02, 2.70],
      [-0.40, 2.48],
      [0.40, 2.48],
      [2.02, 2.70],
      [1.94, 3.22],
      [0.35, 3.10],
      [-0.35, 3.10],
      [-1.94, 3.22],
    ], 0.075),
    materials.fabricCream,
    [0, 0.66, 0],
    null,
    null,
    'biplane-horizontal-stabilizer',
  );
  stabilizer.userData.structuralRole = 'horizontal-stabilizer';

  const elevatorPivot = new THREE.Group();
  elevatorPivot.name = 'biplane-elevator-pivot';
  elevatorPivot.position.set(0, 0.69, 3.10);
  elevatorPivot.userData.controlSurface = 'elevator';
  root.add(elevatorPivot);

  const elevator = addMesh(
    elevatorPivot,
    createPlanformGeometry([
      [-1.92, -0.02],
      [1.92, -0.02],
      [1.72, 0.48],
      [0.22, 0.40],
      [-0.22, 0.40],
      [-1.72, 0.48],
    ], 0.060),
    materials.fabricCreamShade,
    null,
    null,
    null,
    'biplane-elevator-control-surface',
  );
  elevator.userData.controlSurface = 'elevator';

  const fin = addMesh(
    root,
    createVerticalPlanformGeometry([
      [2.58, 0.58],
      [2.72, 1.34],
      [2.94, 1.82],
      [3.20, 2.06],
      [3.44, 1.96],
      [3.56, 1.58],
      [3.50, 0.58],
    ], 0.075),
    materials.trainerYellow,
    [0, 0, 0],
    null,
    null,
    'biplane-rounded-vertical-fin',
  );
  fin.userData.structuralRole = 'vertical-fin';

  const rudderPivot = new THREE.Group();
  rudderPivot.name = 'biplane-rudder-pivot';
  rudderPivot.position.set(0, 0, 3.36);
  rudderPivot.userData.controlSurface = 'rudder';
  root.add(rudderPivot);

  const rudder = addMesh(
    rudderPivot,
    createVerticalPlanformGeometry([
      [0.00, 0.62],
      [0.08, 1.92],
      [0.34, 2.06],
      [0.51, 1.82],
      [0.48, 0.62],
    ], 0.060),
    materials.trainerYellowShade,
    null,
    null,
    null,
    'biplane-rudder-control-surface',
  );
  rudder.userData.controlSurface = 'rudder';

  for (const side of [-1, 1]) {
    addCableBetween(
      root,
      [side * 0.44, 0.54, 2.35],
      [side * 1.58, 0.69, 3.02],
      materials.cable,
      `biplane-${side < 0 ? 'left' : 'right'}-tailplane-upper-brace`,
      1,
    ).userData.structuralRole = 'tail-bracing-wire';
    addCableBetween(
      root,
      [side * 0.40, 0.30, 2.48],
      [side * 1.52, 0.64, 2.95],
      materials.cable,
      `biplane-${side < 0 ? 'left' : 'right'}-tailplane-lower-brace`,
      1,
    ).userData.structuralRole = 'tail-bracing-wire';

    addCableBetween(
      root,
      [side * 0.46, 0.40, 1.20],
      [side * 0.10, 0.95, 3.52],
      materials.cable,
      `biplane-${side < 0 ? 'left' : 'right'}-rudder-control-cable`,
      2,
    ).userData.structuralRole = 'control-cable';
  }

  return { stabilizer, elevatorPivot, rudderPivot };
}

function createPropeller(root, materials) {
  const propeller = new THREE.Group();
  propeller.name = 'biplane-wooden-two-blade-propeller';
  propeller.position.set(0, BIPLANE_MODEL.fuselageCenterY, BIPLANE_MODEL.noseZ - 0.10);
  root.add(propeller);

  const bladeGeometry = createPropellerBladeGeometry({
    length: BIPLANE_MODEL.propellerRadius,
    rootWidth: 0.11,
    midWidth: 0.19,
    tipWidth: 0.065,
    depth: 0.050,
  });

  const blades = new THREE.Group();
  blades.name = 'biplane-solid-wooden-propeller-blades';
  for (let bladeIndex = 0; bladeIndex < 2; bladeIndex += 1) {
    const bladeRoot = new THREE.Group();
    bladeRoot.name = `biplane-propeller-blade-root-${bladeIndex + 1}`;
    bladeRoot.rotation.z = bladeIndex * Math.PI;

    const blade = addMesh(
      bladeRoot,
      bladeGeometry,
      materials.wood,
      null,
      [0.04, 0, 0.07],
      null,
      `biplane-wooden-propeller-blade-${bladeIndex + 1}`,
    );
    blade.userData.structuralRole = 'propeller-blade';

    addBox(
      bladeRoot,
      [0.035, 0.72, 0.052],
      [0.045, 0.70, -0.030],
      materials.woodLight,
      [0, 0, 0.10],
      `biplane-propeller-lamination-${bladeIndex + 1}`,
      2,
    );
    blades.add(bladeRoot);
  }
  propeller.add(blades);

  addCylinder(
    propeller,
    0.17,
    0.19,
    0.20,
    [0, 0, 0.030],
    materials.hub,
    [Math.PI / 2, 0, 0],
    20,
    false,
    'biplane-propeller-hub',
  );

  const blurDisk = addMesh(
    propeller,
    new THREE.CircleGeometry(BIPLANE_MODEL.propellerRadius, 56),
    materials.blur,
    [0, 0, 0.070],
    null,
    null,
    'biplane-propeller-blur-disk',
  );
  blurDisk.renderOrder = 2;
  propeller.userData.blades = blades;
  propeller.userData.blurDisk = blurDisk;
  propeller.userData.bladeCount = 2;
  return propeller;
}

function createSmallDetails(root, materials) {
  // Pilot step and handhold on the left side.
  addBeamBetween(
    root,
    [-0.54, 0.18, 0.98],
    [-0.82, -0.02, 1.04],
    0.025,
    materials.darkSteel,
    7,
    'biplane-left-pilot-step',
    1,
  ).userData.structuralRole = 'pilot-step';

  addMesh(
    root,
    new THREE.TorusGeometry(0.12, 0.018, 6, 18, Math.PI),
    materials.darkSteel,
    [-0.53, 0.76, 0.94],
    [0, Math.PI / 2, 0],
    null,
    'biplane-left-cockpit-handhold',
    2,
  );

  // Pitot mast on the left lower wing.
  addBeamBetween(
    root,
    [-2.72, BIPLANE_MODEL.lowerWing.y - 0.02, -0.68],
    [-2.72, BIPLANE_MODEL.lowerWing.y - 0.08, -0.92],
    0.015,
    materials.darkSteel,
    6,
    'biplane-left-lower-wing-pitot-mast',
    2,
  );
  addBeamBetween(
    root,
    [-2.72, BIPLANE_MODEL.lowerWing.y - 0.08, -0.92],
    [-2.72, BIPLANE_MODEL.lowerWing.y - 0.08, -1.18],
    0.012,
    materials.darkSteel,
    6,
    'biplane-pitot-tube',
    2,
  );

  // Restrained serial-number panels without relying on text geometry.
  for (const side of [-1, 1]) {
    addBox(
      root,
      [0.015, 0.34, 0.74],
      [side * 0.24, 0.76, 2.46],
      materials.navy,
      [0, side * 0.16, 0],
      `biplane-${side < 0 ? 'left' : 'right'}-tail-number-panel`,
      1,
    );
    for (let stripe = 0; stripe < 3; stripe += 1) {
      addBox(
        root,
        [0.018, 0.045, 0.52],
        [side * 0.255, 0.66 + stripe * 0.10, 2.46],
        materials.trainerYellowLight,
        [0, side * 0.16, 0],
        `biplane-${side < 0 ? 'left' : 'right'}-tail-number-stroke-${stripe + 1}`,
        2,
      );
    }
  }
}

export function createBiplaneExternal({ detailLevel = 2 } = {}) {
  const root = new THREE.Group();
  root.name = 'external-pt17-biplane-procedural-v2';
  const materials = createMaterials();

  createFuselage(root, materials);
  const engine = createRadialEngine(root, materials);
  const wings = createWings(root, materials);
  const structure = createStrutsAndBracing(root, materials);
  const frontCockpit = createExternalCockpit(
    root,
    materials,
    BIPLANE_MODEL.frontCockpitZ,
    'front-student',
  );
  const rearCockpit = createExternalCockpit(
    root,
    materials,
    BIPLANE_MODEL.rearCockpitZ,
    'rear-instructor',
  );
  const landingGear = createLandingGear(root, materials);
  const tail = createTail(root, materials);
  const propeller = createPropeller(root, materials);
  createSmallDetails(root, materials);

  root.userData.aircraftId = BIPLANE_ID;
  root.userData.displayName = BIPLANE_DISPLAY_NAME;
  root.userData.engine = 'RADIAL';
  root.userData.engineName = PT17_REFERENCE.powerplant.name;
  root.userData.radialCylinderCount = PT17_REFERENCE.powerplant.cylinders;
  root.userData.propeller = propeller;
  root.userData.propellerBlur = propeller.userData.blurDisk;
  root.userData.sharedRenderPoseCompatible = true;
  root.userData.aircraftFixed = true;
  root.userData.visualVersion = 'pt17-biplane-airframe-procedural-v2';
  root.userData.bounds = BIPLANE_VISUAL_BOUNDS;
  root.userData.reference = PT17_REFERENCE;
  root.userData.wingLevels = Object.freeze({
    upperY: BIPLANE_MODEL.upperWing.y,
    lowerY: BIPLANE_MODEL.lowerWing.y,
    separation: BIPLANE_MODEL.wingSeparation,
    stagger: BIPLANE_MODEL.wingStagger,
    unequalSpan: true,
    lowerWingAileronsOnly: true,
  });
  root.userData.controlSurfaces = {
    leftAileron: wings.leftAileron,
    rightAileron: wings.rightAileron,
    elevator: tail.elevatorPivot,
    rudder: tail.rudderPivot,
  };
  root.userData.structure = {
    interplaneStruts: structure.interplaneStruts,
    cabaneStruts: structure.cabaneStruts,
    bracingWires: structure.bracingWires,
    landingGear,
  };
  root.userData.cockpits = { frontCockpit, rearCockpit };
  root.userData.engineRoot = engine;

  setBiplaneDetailLevel(root, detailLevel);
  root.userData.visualStats = collectBiplaneVisualStats(root);
  return root;
}
