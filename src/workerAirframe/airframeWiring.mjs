import { createA6MZeroExternal } from '../aircraft/a6mZeroExternal.js';

export function createZeroExternal() {
  const root = createA6MZeroExternal();
  root.name = 'worker-airframe-zero-external';
  root.userData.airframeWorker = 'skyline-worker-airframe';
  root.userData.aircraftId = 'zero';
  root.userData.audioIdentity = 'zero';
  root.userData.aiIdentity = 'zero-fighter';
  root.userData.drawCallEstimate = 88;
  root.userData.triangleEstimate = 12500;
  return root;
}
