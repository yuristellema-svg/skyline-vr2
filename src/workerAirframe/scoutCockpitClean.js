import {
  THREE,
  addBox,
  addCylinder,
  addMesh,
  createGauge,
  standard,
  basic,
} from './visualPrimitives.js';

export function createScoutCockpit() {
  const root = new THREE.Group();
  root.name = 'worker-airframe-scout-cockpit';
  root.position.set(0, -0.45, -0.96);

  const materials = {
    frame: standard(0x303b3e, 0.62, 0.16),
    panel: standard(0x252b2c, 0.88, 0.08),
    casing: standard(0x15191a, 0.70, 0.18),
    face: basic(0xd7cfad, { toneMapped: false }),
    needle: basic(0xa6332d, { toneMapped: false }),
    glass: standard(0x82aab3, 0.14, 0.03, { transparent: true, opacity: 0.12, depthWrite: false }),
    blue: standard(0x294f68, 0.62, 0.10),
    brass: standard(0xaa8650, 0.44, 0.36),
  };

  addBox(root, [1.55, 0.48, 0.12], [0, -0.27, -1.12], materials.panel, [-0.04, 0, 0], 'scout-panel');
  const instruments = [
    createGauge(root, [-0.43, -0.22, -1.20], 0.16, 'IAS', materials),
    createGauge(root, [0, -0.18, -1.20], 0.18, 'ALT', materials),
    createGauge(root, [0.43, -0.22, -1.20], 0.16, 'RPM', materials),
  ];
  root.userData.instruments = instruments;

  for (const side of [-1, 1]) {
    addBox(root, [0.055, 1.20, 0.055], [side * 0.76, 0.20, -0.88], materials.frame, [0, 0, side * 0.12]);
    addBox(root, [0.08, 0.08, 1.08], [side * 0.72, -0.25, -0.54], materials.blue);
  }
  addBox(root, [1.50, 0.055, 0.055], [0, 0.76, -0.90], materials.frame);
  const windscreen = addBox(root, [1.42, 0.76, 0.025], [0, 0.30, -0.94], materials.glass, [-0.10, 0, 0]);
  windscreen.renderOrder = 4;
  addCylinder(root, 0.03, 0.036, 0.58, [0, -0.60, -0.48], materials.frame, [0.10, 0, 0], 8, 'scout-control-column');
  addBox(root, [0.30, 0.055, 0.055], [0, -0.31, -0.54], materials.frame);
  addCylinder(root, 0.025, 0.025, 0.42, [-0.68, -0.36, -0.42], materials.brass, [0.22, 0, -0.14], 8, 'scout-throttle');

  root.userData.aircraftId = 'scout';
  root.userData.aircraftFixed = true;
  root.userData.syntheticShake = false;
  root.userData.visualVersion = 'worker-airframe-scout-cockpit-v1';
  return root;
}
