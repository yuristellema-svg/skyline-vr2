import {
  THREE,
  addBox,
  addCylinder,
  addMirroredPlanform,
  addSphere,
  standard,
} from './visualPrimitives.js';

export function createGliderExternal() {
  const root = new THREE.Group();
  root.name = 'worker-airframe-glider-external';

  const white = standard(0xe2e4df, 0.72, 0.04);
  const graphite = standard(0x273137, 0.72, 0.06);
  const orange = standard(0xd37b43, 0.66, 0.04);
  const glass = standard(0x779ba7, 0.14, 0.02, { transparent: true, opacity: 0.32, depthWrite: false });

  addCylinder(root, 0.07, 0.28, 5.60, [0, -0.02, 0.18], white, [Math.PI / 2, 0, 0], 18, 'glider-slender-fuselage');
  addSphere(root, 0.32, [0, 0.24, -1.14], glass, [0.74, 0.62, 1.62], 1, 'glider-canopy');
  addBox(root, [0.055, 0.46, 1.02], [0, 0.30, -1.05], graphite, null, 'glider-canopy-spine');

  const wingPoints = [
    [0.10, -0.72],
    [4.10, -0.44],
    [5.30, -0.18],
    [5.42, 0.04],
    [4.85, 0.20],
    [0.12, 0.42],
  ];
  addMirroredPlanform(root, wingPoints, 0.075, white, [0, 0.08, -0.12], 'glider-high-aspect-wing');
  addBox(root, [0.18, 0.045, 1.02], [-4.52, 0.145, -0.02], orange, null, 'glider-left-tip-mark');
  addBox(root, [0.18, 0.045, 1.02], [4.52, 0.145, -0.02], orange, null, 'glider-right-tip-mark');

  addBox(root, [3.20, 0.055, 0.42], [0, 0.08, 2.52], white, null, 'glider-tailplane');
  addBox(root, [0.08, 0.96, 0.70], [0, 0.46, 2.42], graphite, [0.08, 0, 0], 'glider-fin');
  addBox(root, [0.085, 0.62, 0.42], [0, 0.73, 2.34], orange, [0.08, 0, 0], 'glider-rudder-mark');

  root.userData.aircraftId = 'glider';
  root.userData.audioIdentity = 'glider';
  root.userData.aiIdentity = 'skyline-sailplane';
  root.userData.powered = false;
  root.userData.propeller = null;
  root.userData.drawCallEstimate = 27;
  root.userData.triangleEstimate = 3200;
  root.userData.visualVersion = 'worker-airframe-glider-v1';
  return root;
}
