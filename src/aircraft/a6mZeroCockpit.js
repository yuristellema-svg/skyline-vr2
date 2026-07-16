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

function createCanopy(
  root,
  materials,
) {
  const forwardZ = -1.12;
  const rearZ = -0.20;

  for (
    const side of [-1, 1]
  ) {
    addBox(
      root,
      [0.058, 1.22, 0.058],
      [
        side * 0.76,
        0.19,
        forwardZ,
      ],
      materials.frame,
      [
        0.035,
        0,
        side * 0.11,
      ],
    );

    addBox(
      root,
      [0.052, 0.98, 0.052],
      [
        side * 0.65,
        0.19,
        rearZ,
      ],
      materials.frame,
      [
        -0.10,
        0,
        side * 0.08,
      ],
    );

    addBox(
      root,
      [0.07, 0.07, 1.12],
      [
        side * 0.73,
        -0.26,
        -0.58,
      ],
      materials.sill,
      [
        0.015,
        0,
        side * 0.025,
      ],
    );
  }

  addBox(
    root,
    [1.48, 0.060, 0.060],
    [0, 0.79, -1.07],
    materials.frame,
  );

  addBox(
    root,
    [1.28, 0.052, 0.052],
    [0, 0.71, -0.15],
    materials.frame,
  );

  addBox(
    root,
    [0.055, 1.05, 0.055],
    [0, 0.25, -1.13],
    materials.frame,
  );

  const upperBow =
    addMesh(
      root,
      new THREE.TorusGeometry(
        0.67,
        0.028,
        8,
        24,
        Math.PI,
      ),
      materials.frame,
      [0, 0.67, -0.66],
      [0, 0, Math.PI],
    );

  upperBow.scale.y = 0.62;

  const leftGlass =
    addMesh(
      root,
      new THREE.PlaneGeometry(
        0.72,
        0.92,
      ),
      materials.glass,
      [
        -0.37,
        0.27,
        -1.10,
      ],
      [
        -0.035,
        -0.040,
        0,
      ],
    );

  const rightGlass =
    addMesh(
      root,
      new THREE.PlaneGeometry(
        0.72,
        0.92,
      ),
      materials.glass,
      [
        0.37,
        0.27,
        -1.10,
      ],
      [
        -0.035,
        0.040,
        0,
      ],
    );

  leftGlass.renderOrder = 4;
  rightGlass.renderOrder = 4;
}

function createInstrumentPanel(
  root,
  materials,
) {
  const panelRoot =
    new THREE.Group();

  panelRoot.name =
    'zero-instrument-panel-v2';

  panelRoot.position.set(
    0,
    -0.27,
    -1.09,
  );

  panelRoot.rotation.x =
    -0.035;

  root.add(
    panelRoot,
  );

  addBox(
    panelRoot,
    [1.68, 0.68, 0.12],
    [0, 0, 0],
    materials.panel,
  );

  addBox(
    panelRoot,
    [1.80, 0.105, 0.22],
    [0, 0.36, 0.025],
    materials.coaming,
    [-0.055, 0, 0],
  );

  addBox(
    panelRoot,
    [0.15, 0.58, 0.15],
    [-0.84, -0.03, 0.01],
    materials.panelSide,
    [0, 0, -0.04],
  );

  addBox(
    panelRoot,
    [0.15, 0.58, 0.15],
    [0.84, -0.03, 0.01],
    materials.panelSide,
    [0, 0, 0.04],
  );

  const instruments = [
    createGauge(
      panelRoot,
      [-0.54, 0.13, 0.080],
      0.155,
      'IAS',
    ),

    createGauge(
      panelRoot,
      [-0.18, 0.16, 0.080],
      0.170,
      'ALT',
    ),

    createGauge(
      panelRoot,
      [0.20, 0.16, 0.080],
      0.170,
      'ATT',
    ),

    createGauge(
      panelRoot,
      [0.56, 0.13, 0.080],
      0.155,
      'RPM',
    ),

    createGauge(
      panelRoot,
      [-0.46, -0.20, 0.080],
      0.112,
      'VSI',
    ),

    createGauge(
      panelRoot,
      [-0.13, -0.20, 0.080],
      0.112,
      'OIL',
    ),

    createGauge(
      panelRoot,
      [0.20, -0.20, 0.080],
      0.112,
      'TEMP',
    ),

    createGauge(
      panelRoot,
      [0.53, -0.20, 0.080],
      0.112,
      'FUEL',
    ),
  ];

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    addCylinder(
      panelRoot,
      0.026,
      0.026,
      0.040,
      [
        -0.22 + index * 0.145,
        0.335,
        0.108,
      ],

      index === 1
        ? materials.warningRed
        : index === 2
          ? materials.warningAmber
          : materials.warningGreen,

      [Math.PI / 2, 0, 0],
      12,
    );
  }

  for (
    let index = 0;
    index < 7;
    index += 1
  ) {
    addCylinder(
      panelRoot,
      0.020,
      0.020,
      0.058,
      [
        -0.63 + index * 0.21,
        -0.337,
        0.100,
      ],

      index === 3
        ? materials.red
        : materials.brass,

      [Math.PI / 2, 0, 0],
      10,
    );
  }

  for (
    const x of [
      -0.72,
      -0.36,
      0,
      0.36,
      0.72,
    ]
  ) {
    addCylinder(
      panelRoot,
      0.014,
      0.014,
      0.025,
      [x, 0.315, 0.095],
      materials.screw,
      [Math.PI / 2, 0, 0],
      8,
    );
  }

  addBox(
    panelRoot,
    [0.30, 0.055, 0.025],
    [-0.36, -0.34, 0.095],
    materials.placard,
  );

  addBox(
    panelRoot,
    [0.30, 0.055, 0.025],
    [0.36, -0.34, 0.095],
    materials.placard,
  );

  return instruments;
}

function createReflectorSight(
  root,
  materials,
) {
  const sightRoot =
    new THREE.Group();

  sightRoot.name =
    'zero-reflector-sight-v2';

  sightRoot.position.set(
    0,
    0.10,
    -1.00,
  );

  root.add(
    sightRoot,
  );

  addBox(
    sightRoot,
    [0.075, 0.39, 0.075],
    [0, -0.10, 0],
    materials.frame,
  );

  addBox(
    sightRoot,
    [0.34, 0.075, 0.14],
    [0, -0.27, 0.025],
    materials.frame,
  );

  addBox(
    sightRoot,
    [0.21, 0.065, 0.10],
    [0, -0.34, 0.04],
    materials.brass,
  );

  const glass =
    addMesh(
      sightRoot,
      new THREE.CircleGeometry(
        0.158,
        32,
      ),
      materials.sightGlass,
      [0, 0.19, 0],
    );

  glass.renderOrder = 5;

  const glassFrame =
    addMesh(
      sightRoot,
      new THREE.RingGeometry(
        0.155,
        0.174,
        32,
      ),
      materials.frame,
      [0, 0.19, 0.002],
    );

  glassFrame.renderOrder = 6;

  const reticle =
    new THREE.Group();

  reticle.position.set(
    0,
    0.19,
    0.006,
  );

  sightRoot.add(
    reticle,
  );

  addMesh(
    reticle,
    new THREE.RingGeometry(
      0.050,
      0.057,
      28,
    ),
    materials.reticle,
  );

  addBox(
    reticle,
    [0.003, 0.105, 0.003],
    [0, 0, 0],
    materials.reticle,
  );

  addBox(
    reticle,
    [0.105, 0.003, 0.003],
    [0, 0, 0],
    materials.reticle,
  );
}

function createLeftConsole(
  root,
  materials,
) {
  addBox(
    root,
    [0.34, 0.26, 0.68],
    [-0.91, -0.44, -0.56],
    materials.sidePanel,
    [0.04, 0, -0.05],
  );

  addBox(
    root,
    [0.24, 0.045, 0.36],
    [-0.91, -0.26, -0.57],
    materials.slot,
  );

  addBox(
    root,
    [0.055, 0.34, 0.055],
    [-0.84, -0.17, -0.59],
    materials.frame,
    [0, 0, 0.23],
  );

  addSphere(
    root,
    0.075,
    [-0.76, -0.02, -0.59],
    materials.red,
    [1.10, 0.90, 1.0],
    14,
    9,
  );

  addBox(
    root,
    [0.048, 0.28, 0.048],
    [-0.97, -0.20, -0.59],
    materials.frame,
    [0, 0, -0.17],
  );

  addSphere(
    root,
    0.055,
    [-1.00, -0.07, -0.59],
    materials.brass,
    null,
    12,
    8,
  );

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    addCylinder(
      root,
      0.022,
      0.022,
      0.050,
      [
        -0.99 + index * 0.065,
        -0.50,
        -0.23,
      ],

      index === 0
        ? materials.red
        : materials.brass,

      [Math.PI / 2, 0, 0],
      10,
    );
  }
}

function createRightConsole(
  root,
  materials,
) {
  addBox(
    root,
    [0.36, 0.27, 0.65],
    [0.91, -0.44, -0.54],
    materials.sidePanel,
    [0.04, 0, 0.05],
  );

  addBox(
    root,
    [0.28, 0.18, 0.24],
    [0.91, -0.24, -0.59],
    materials.radio,
  );

  for (
    const x of [
      0.84,
      0.94,
      1.04,
    ]
  ) {
    addCylinder(
      root,
      0.037,
      0.037,
      0.052,
      [x, -0.22, -0.45],
      materials.brass,
      [Math.PI / 2, 0, 0],
      12,
    );
  }

  const trimWheel =
    addMesh(
      root,
      new THREE.TorusGeometry(
        0.125,
        0.022,
        8,
        24,
      ),
      materials.trim,
      [0.88, -0.44, -0.18],
      [0, Math.PI / 2, 0],
    );

  addCylinder(
    trimWheel,
    0.023,
    0.023,
    0.10,
    [0.10, 0, 0],
    materials.trim,
    [0, 0, Math.PI / 2],
    8,
  );

  addSphere(
    root,
    0.052,
    [0.88, -0.44, -0.18],
    materials.brass,
    null,
    12,
    8,
  );
}

function createControlColumn(
  root,
  materials,
) {
  addCylinder(
    root,
    0.037,
    0.047,
    0.72,
    [0, -0.70, -0.52],
    materials.frame,
    [0.13, 0, 0],
    12,
  );

  addBox(
    root,
    [0.34, 0.060, 0.060],
    [0, -0.36, -0.57],
    materials.frame,
  );

  addSphere(
    root,
    0.072,
    [-0.17, -0.36, -0.57],
    materials.leather,
    [1.0, 0.95, 1.0],
    14,
    9,
  );

  addSphere(
    root,
    0.072,
    [0.17, -0.36, -0.57],
    materials.leather,
    [1.0, 0.95, 1.0],
    14,
    9,
  );

  addCylinder(
    root,
    0.020,
    0.020,
    0.050,
    [0.17, -0.29, -0.57],
    materials.red,
    [Math.PI / 2, 0, 0],
    10,
  );
}

function createSeatAndFloor(
  root,
  materials,
) {
  addBox(
    root,
    [1.16, 0.075, 1.12],
    [0, -0.84, -0.20],
    materials.floor,
  );

  addBox(
    root,
    [0.70, 0.12, 0.44],
    [0, -0.73, 0.04],
    materials.seat,
    [-0.08, 0, 0],
  );

  addBox(
    root,
    [0.65, 0.62, 0.10],
    [0, -0.39, 0.22],
    materials.seat,
    [-0.15, 0, 0],
  );

  addBox(
    root,
    [0.36, 0.18, 0.11],
    [0, -0.04, 0.15],
    materials.headrest,
    [-0.12, 0, 0],
  );

  for (
    const side of [-1, 1]
  ) {
    addBox(
      root,
      [0.14, 0.48, 0.12],
      [side * 0.50, -0.40, 0.16],
      materials.seatFrame,
      [-0.12, 0, side * 0.04],
    );
  }
}

function createNoseAndRails(
  root,
  materials,
) {
  addSphere(
    root,
    0.74,
    [0, -0.64, -1.70],
    materials.ivory,
    [1.18, 0.40, 1.30],
    20,
    11,
  );

  addBox(
    root,
    [0.19, 0.16, 1.28],
    [-0.82, -0.50, -0.59],
    materials.rail,
    [0.02, 0, -0.035],
  );

  addBox(
    root,
    [0.19, 0.16, 1.28],
    [0.82, -0.50, -0.59],
    materials.rail,
    [0.02, 0, 0.035],
  );

  addMesh(
    root,
    new THREE.CircleGeometry(
      0.092,
      20,
    ),
    materials.spinner,
    [0, -0.31, -1.96],
  );

  for (
    const side of [-1, 1]
  ) {
    for (
      let index = 0;
      index < 5;
      index += 1
    ) {
      addCylinder(
        root,
        0.011,
        0.011,
        0.018,
        [
          side * 0.77,
          -0.44,
          -0.92
            + index * 0.20,
        ],
        materials.screw,
        [Math.PI / 2, 0, 0],
        8,
      );
    }
  }
}

export function createA6MZeroCockpit() {
  const root =
    new THREE.Group();

  root.name =
    'cockpit-a6m-zero-white-872-detailed-v2';

  root.position.set(
    0,
    -0.48,
    -0.82,
  );

  const materials = {
    frame:
      standard(
        0x283130,
        0.56,
        0.24,
      ),

    sill:
      standard(
        0x46514c,
        0.72,
        0.14,
      ),

    panel:
      standard(
        0x20221d,
        0.88,
        0.10,
      ),

    panelSide:
      standard(
        0x30342e,
        0.84,
        0.10,
      ),

    coaming:
      standard(
        0x171816,
        0.96,
        0.03,
      ),

    sidePanel:
      standard(
        0x3b463f,
        0.82,
        0.10,
      ),

    slot:
      standard(
        0x171916,
        0.90,
        0.08,
      ),

    radio:
      standard(
        0x242925,
        0.78,
        0.18,
      ),

    trim:
      standard(
        0xa88b58,
        0.48,
        0.46,
      ),

    rail:
      standard(
        0x53615a,
        0.70,
        0.14,
      ),

    floor:
      standard(
        0x313a34,
        0.88,
        0.08,
      ),

    seat:
      standard(
        0x4f5b52,
        0.86,
        0.10,
      ),

    seatFrame:
      standard(
        0x303834,
        0.72,
        0.18,
      ),

    headrest:
      standard(
        ZERO_COLORS.leather,
        0.95,
        0.02,
      ),

    leather:
      standard(
        ZERO_COLORS.leather,
        0.94,
        0.02,
      ),

    ivory:
      standard(
        ZERO_COLORS.ivory,
        0.62,
        0.14,
      ),

    red:
      standard(
        ZERO_COLORS.red,
        0.60,
        0.10,
      ),

    brass:
      standard(
        ZERO_COLORS.brass,
        0.46,
        0.46,
      ),

    screw:
      standard(
        0x9a9582,
        0.48,
        0.46,
      ),

    placard:
      basic(
        0xd3c89e,
        {
          toneMapped: false,
        },
      ),

    spinner:
      basic(
        0xb9c0be,
        {
          toneMapped: false,
        },
      ),

    warningRed:
      standard(
        0xc44231,
        0.48,
        0.10,
        {
          emissive: 0x5a0905,
          emissiveIntensity: 0.75,
        },
      ),

    warningAmber:
      standard(
        0xe2a83a,
        0.48,
        0.10,
        {
          emissive: 0x633600,
          emissiveIntensity: 0.65,
        },
      ),

    warningGreen:
      standard(
        0x78a66d,
        0.48,
        0.10,
        {
          emissive: 0x173711,
          emissiveIntensity: 0.45,
        },
      ),

    glass:
      standard(
        ZERO_COLORS.glass,
        0.12,
        0.02,
        {
          transparent: true,
          opacity: 0.070,
          depthWrite: false,
          side: THREE.DoubleSide,
        },
      ),

    sightGlass:
      basic(
        0xbde9df,
        {
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        },
      ),

    reticle:
      basic(
        0xb9f5d9,
        {
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
          toneMapped: false,
        },
      ),
  };

  createCanopy(
    root,
    materials,
  );

  const instruments =
    createInstrumentPanel(
      root,
      materials,
    );

  createReflectorSight(
    root,
    materials,
  );

  createLeftConsole(
    root,
    materials,
  );

  createRightConsole(
    root,
    materials,
  );

  createControlColumn(
    root,
    materials,
  );

  createSeatAndFloor(
    root,
    materials,
  );

  createNoseAndRails(
    root,
    materials,
  );

  root.userData.instruments =
    instruments;

  root.userData.visualVersion =
    'a6m-zero-cockpit-procedural-v2';

  return root;
}
