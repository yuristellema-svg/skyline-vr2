import {
  THREE,
  addBox,
  addCylinder,
  addMesh,
  addMirroredPlanform,
  addSphere,
  basic,
  standard,
} from './visualShared.js';

export function createScoutExternal() {
  const root = new THREE.Group();
  root.name = 'worker-airframe-scout-external';

  const cream = standard(0xd9d0b8, 0.68, 0.08);
  const blue = standard(0x294f68, 0.60, 0.12);
  const dark = standard(0x20282c, 0.48, 0.22);
  const brass = standard(0xa98752, 0.42, 0.36);
  const glass = standard(0x7da6b2, 0.16, 0.03, { transparent: true, opacity: 0.30, depthWrite: false });

  addCylinder(root, 0.12, 0.34, 4.45, [0, 0, 0.08], cream, [Math.PI / 2, 0, 0], 14, 'scout-tapered-fuselage');
  addCylinder(root, 0.34, 0.38, 0.72, [0, 0, -2.45], dark, [Math.PI / 2, 0, 0], 16, 'scout-engine-cowling');

  const wingPoints = [
    [0.18, -0.78],
    [2.40, -0.44],
    [2.95, -0.22],
    [3.06, 0.10],
    [2.58, 0.34],
    [0.22, 0.62],
  ];
  addMirroredPlanform(root, wingPoints, 0.095, blue, [0, 0.02, -0.26], 'scout-wing');

  addBox(root, [2.55, 0.075, 0.50], [0, 0.04, 1.78], cream, null, 'scout-tailplane');
  addBox(root, [0.10, 0.88, 0.62], [0, 0.42, 1.72], blue, [0.08, 0, 0], 'scout-fin');
  addSphere(root, 0.48, [0, 0.36, -0.55], glass, [0.80, 0.64, 1.28], 1, 'scout-canopy');
  addBox(root, [0.055, 0.58, 0.90], [0, 0.40, -0.54], dark, null, 'scout-canopy-spine');

  const propeller = new THREE.Group();
  propeller.name = 'scout-propeller';
  propeller.position.z = -2.86;
  root.add(propeller);
  const blade = new THREE.Shape();
  blade.moveTo(-0.045, 0.10);
  blade.lineTo(-0.075, 0.95);
  blade.quadraticCurveTo(0.02, 1.12, 0.075, 0.94);
  blade.lineTo(0.045, 0.10);
  blade.closePath();
  const bladeGeometry = new THREE.ShapeGeometry(blade, 5);
  for (let index = 0; index < 2; index += 1) {
    const mesh = addMesh(propeller, bladeGeometry.clone(), dark, null, null, `scout-propeller-blade-${index + 1}`);
    mesh.rotation.z = index * Math.PI;
  }
  addSphere(propeller, 0.15, [0, 0, 0.035], brass, [1, 1, 1.2], 1, 'scout-spinner');
  const blur = addMesh(propeller, new THREE.CircleGeometry(1.02, 32), basic(0x2d3438, {
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [0, 0, 0.02], null, 'scout-propeller-blur');

  root.userData.propeller = propeller;
  root.userData.propellerBlur = blur;
  root.userData.aircraftId = 'scout';
  root.userData.audioIdentity = 'scout';
  root.userData.aiIdentity = 'alpine-scout';
  root.userData.drawCallEstimate = 31;
  root.userData.triangleEstimate = 3600;
  root.userData.visualVersion = 'worker-airframe-scout-v1';
  return root;
}
