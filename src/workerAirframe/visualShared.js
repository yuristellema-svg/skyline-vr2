import { createJu87StukaCockpit } from '../aircraft/ju87StukaCockpit.js';

export function createStukaCockpit() {
  const root = createJu87StukaCockpit();
  root.name = 'worker-airframe-stuka-cockpit';
  root.userData.airframeWorker = 'skyline-worker-airframe';
  root.userData.aircraftId = 'stuka';
  root.userData.aircraftFixed = true;
  root.userData.syntheticShake = false;
  return root;
}
