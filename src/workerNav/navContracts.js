export const SKYLINE_NAV_BASELINE_SHA =
  '28ccda0d8497366069b1479d450a335f5add183a';

export const SKYLINE_NAV_BRANCH = 'skyline-worker-nav';
export const SKYLINE_SAFE_BRANCH = 'skyline-main-current-safe';

export const DEG = Math.PI / 180;

export const PHONE_MENU_IDS = Object.freeze([
  'resume',
  'recenter',
  'camera',
  'aircraft',
  'effects',
  'respawn',
  'restart',
]);

export const PHONE_CRASH_MENU_IDS = Object.freeze([
  'respawn',
  'aircraft',
  'restart',
]);

export const REQUIRED_RENDER_MARKERS = Object.freeze([
  'SKYLINE_RENDER_POSE_INTERPOLATION_V1',
  'renderPoseInterpolator.captureFixedStep(flight)',
  'sharedRenderPose = renderPoseInterpolator.sample(',
  'cameraRig.update(',
  'aircraftVisuals.update(',
]);

export const REQUIRED_COCKPIT_MARKERS = Object.freeze([
  'SKYLINE_BUNDLE_A_V2_WORLD_COCKPIT',
  'Cockpit follows the shared render pose instead of the head camera.',
  "this.scene?.add(this.cockpitRoot)",
  'this.cockpitRoot.position.copy(',
  'this.cockpitRoot.quaternion.copy(',
]);

export const BASELINE_BLOB_SHA = Object.freeze({
  'src/main.js': 'f13b2503cf0fc5a8367cf372d7387dc26ab9753f',
  'src/input.js': 'cf8cea7cb8714a6121d42b84527810b7b7a479fd',
  'src/config.js': '1027fceca9fc62581bb84ccb3b3db9d8eb032085',
  'src/menu.js': 'f0d12a4e814f5497598f2467dd1bc3d4af269c33',
  'src/camera.js': '88d6e571569079f084c99cd9562288c892b97d98',
  'src/vrMenuBeacon.js': '654f76a391767ee12bcc2cd89e4c7535e5f017e6',
  'src/aircraftVisuals.js': 'fc224b295f44c9d4cc271182fdd9f9c0f15bc056',
  'src/renderPoseInterpolator.js': '9733f0cea3d528b9db057890d6794aefd9289bd1',
  'src/stereo.js': 'f8a7055f8e0fad8cfcbf790cd7cc08992d0c8aad',
});

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function wrapPi(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}
