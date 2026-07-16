import { createJu87StukaExternal } from '../aircraft/ju87StukaExternal.js';

export function createStukaExternal() {
  const root = createJu87StukaExternal();
  root.name = 'worker-airframe-stuka-external';
  root.userData.airframeWorker = 'skyline-worker-airframe';
  root.userData.aircraftId = 'stuka';
  root.userData.audioIdentity = 'stuka';
  root.userData.aiIdentity = 'stuka-dive-bomber';
  root.userData.drawCallEstimate = 96;
  root.userData.triangleEstimate = 13900;
  return root;
}
