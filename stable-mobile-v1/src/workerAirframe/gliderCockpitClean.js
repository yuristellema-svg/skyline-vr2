import {
  THREE,
  addBox,
  addCylinder,
  createGauge,
  standard,
  basic,
} from './visualPrimitives.js';

export function createGliderCockpit() {
  const root = new THREE.Group();
  root.name = 'worker-airframe-glider-cockpit';
  root.position.set(0, -0.43, -0.90);

  const materials = {
    frame: standard(0x343f43, 0.68, 0.12),
    panel: standard(0x252c2f, 0.90, 0.06),
    casing: standard(0x15191b, 0.72, 0.14),
    face: basic(0xe1dcc4, { toneMapped: false }),
    needle: basic(0xb33a31, { toneMapped: false }),
    glass: standard(0x82a7b0, 0.12, 0.02, { transparent: true, opacity: 0.12, depthWrite: false }),
    orange: standard(0xd37b43, 0.68, 0.04),
  };

  addBox(root, [1.40, 0.42, 0.11], [0, -0.29, -1.12], materials.panel, [-0.05, 0, 0], 'glider-panel');
  const instruments = [
    createGauge(root, [-0.40, -0.23, -1.20], 0.15, 'IAS', materials),
    createGauge(root, [0, -0.19, -1.20], 0.18, 'ALT', materials),
    createGauge(root, [0.40, -0.23, -1.20], 0.15, 'VSI', materials),
  ];
  root.userData.instruments = instruments;

  for (const side of [-1, 1]) {
    addBox(root, [0.050, 1.02, 0.050], [side * 0.68, 0.24, -0.86], materials.frame, [0, 0, side * 0.14]);
    addBox(root, [0.075, 0.075, 1.20], [side * 0.65, -0.23, -0.50], materials.orange);
  }
  addBox(root, [1.32, 0.050, 0.050], [0, 0.72, -0.86], materials.frame);
  const windscreen = addBox(root, [1.28, 0.72, 0.022], [0, 0.31, -0.92], materials.glass, [-0.12, 0, 0]);
  windscreen.renderOrder = 4;
  addCylinder(root, 0.030, 0.035, 0.58, [0, -0.60, -0.48], materials.frame, [0.10, 0, 0], 8, 'glider-control-column');
  addBox(root, [0.28, 0.050, 0.050], [0, -0.31, -0.54], materials.frame);

  root.userData.aircraftId = 'glider';
  root.userData.aircraftFixed = true;
  root.userData.syntheticShake = false;
  root.userData.powered = false;
  root.userData.visualVersion = 'worker-airframe-glider-cockpit-v1';
  return root;
}
