import * as THREE from '../vendor/three.module.min.js';
// SKYLINE_BUNDLE_A_V2_CORE
// SKYLINE_BUNDLE_B_WORLD_SIM
import { CONFIG, clamp } from './config.js';
import { InputController, requestOrientationPermissionFromGesture } from './input.js';
import { FlightModel } from './flightModel.js';
import { CollisionSystem } from './collision.js';
import { CameraRig } from './camera.js';
import { EffectsSystem } from './effects.js';
import { StereoRenderer } from './stereo.js';
import { GazeMenu } from './menu.js';
import { VrMenuBeacon } from './vrMenuBeacon.js';
import { initialViewMode } from './workerNav/phoneViewModes.js';
// SKYLINE_WORKER_NAV_V1_MAIN
import { MonoHud } from './hud.js';
import { createWorld } from './world/world.js';
import {
  createWorldDetailSystem,
} from './worldDetail/index.js';
import { WorldPolishSystem } from './worldPolish.js?v=biplane-mobile-audio-controls-v3';
import { AircraftVisualSystem } from './aircraftVisuals.js?v=biplane-mobile-audio-controls-v3';
import { RenderPoseInterpolator, renderInterpolationAlpha } from './renderPoseInterpolator.js';
import {
  createLazyWorkerWorld,
} from './workerRuntime/lazyWorldRuntime.js';
import { PowerControlSystem } from './expansion/powerControl.js';
import { PowerStrip } from './expansion/powerStrip.js';
import { RadioBeacon } from './expansion/radioBeacon.js?v=biplane-mobile-audio-controls-v3';
import { LandingSystem } from './expansion/landingSystem.js';
import { NearWorldSystem } from './expansion/nearWorldSystem.js';
import { RunwayGuidanceSystem } from './expansion/runwayGuidance.js';
import { CockpitPowerFeedback } from './expansion/cockpitPowerFeedback.js';

const canvas = document.querySelector('#game');
const startPanel = document.querySelector('#start-panel');
const phoneStart = document.querySelector('#phone-start');
const desktopStart = document.querySelector('#desktop-start');
const startStatus = document.querySelector('#start-status');
const phoneStartLabel = phoneStart.querySelector('span');
const orientationWarning = document.querySelector('#orientation-warning');
const installHint = document.querySelector('#install-hint');
const installDismiss = document.querySelector('#install-dismiss');
const eyeMessage = document.querySelector('#eye-message');
const eyeLeft = eyeMessage.querySelector('.eye-left');
const eyeRight = eyeMessage.querySelector('.eye-right');
const hudRoot = document.querySelector('#mono-hud');

const scene = new THREE.Scene();
const stereo = new StereoRenderer(canvas);
scene.add(stereo.camera);

const input = new InputController();
const flight = new FlightModel();
// SKYLINE_RENDER_POSE_INTERPOLATION_V1
const renderPoseInterpolator = new RenderPoseInterpolator(flight);
const renderPose = renderPoseInterpolator.createRenderPose(flight);
let sharedRenderPose = renderPose;
const collision = new CollisionSystem();
const world = createWorld(scene, collision);

collision.setHeightSampler(world.sampleHeight);

// SKYLINE_WORLD_DETAIL_V25_INTEGRATION
let worldDetail = null;

function ensureWorldDetail(phone) {
  if (worldDetail) {
    worldDetail.setPhoneMode(phone);
    return worldDetail;
  }

  worldDetail =
    createWorldDetailSystem({
      scene,
      sampleHeight:
        world.sampleHeight,
      spawn:
        CONFIG.world.spawn,
      quality: 'auto',
      phone,
    });

  return worldDetail;
}

const cameraRig = new CameraRig(
  scene,
  stereo.camera,
  world.sampleHeight
);

const effects = new EffectsSystem(scene);
const hud = new MonoHud(hudRoot);

const vrMenuBeacon =
  new VrMenuBeacon(
    stereo.uiScene,
  );

const aircraftVisuals = new AircraftVisualSystem(scene);
aircraftVisuals.attach(stereo.camera);

const powerControl = new PowerControlSystem(
  flight.aircraftProfileId,
);

const powerStrip = new PowerStrip(
  stereo.uiScene,
  powerControl,
);

const radioBeacon = new RadioBeacon(
  stereo.uiScene,
);

const landingSystem = new LandingSystem(
  scene,
  world.sampleHeight,
);

const runwayGuidance =
  new RunwayGuidanceSystem(
    scene,
    landingSystem,
  );

const cockpitPowerFeedback =
  new CockpitPowerFeedback(
    scene,
  );

const nearWorld = new NearWorldSystem(
  scene,
  CONFIG.world.spawn,
);

const worldPolish = new WorldPolishSystem(
  scene,
  {
    sampleHeight:
      world.sampleHeight,
    atmosphere: true,
    audio: true,

    /*
     * Worker WORLD owns these systems on this stage.
     * Existing engine/warning audio remains untouched.
     */
    routes: false,
    wildlife: false,
    city: false,
    aiTraffic: false,
    contrails: true,
  },
);

const workerWorld =
  createLazyWorkerWorld({
    scene,
    THREE,
    eventTarget: window,
    quality: 'balanced',
  });

window.skylineWorkerWorld =
  workerWorld;

let phase = 'boot';
let phoneMode = false;
let phaseStarted = performance.now() / 1000;
let crashElapsed = 0;
let crashCountdownFinished = false;
let neutralHold = 0;
let accumulator = 0;
let lastFrame = performance.now() / 1000;
let droppedSteps = 0;
let fadeWhite = 0;
let wakeLock = null;
let lastEyeText = null;
let transientMessage = '';
let transientUntil = 0;
let menuNeedsReanchor = false;

let awaitingPhoneAudioGesture =
  false;

let phoneAudioGestureResolve =
  null;

const PHONE_START_DEFAULT_LABEL =
  phoneStartLabel?.textContent ||
  'START PHONE VR';

const menuCameraLook = {
  yaw: 0,
  pitch: 0,
};

let worldFlightReady = false;
let worldResetPromise = null;
let renderOriginX = 0;
let renderOriginZ = 0;
let lastWorldError = '';
let initialWorldPromise = null;

// SKYLINE_VR_MENU_BEACON_WIRING

const menu = new GazeMenu(
  stereo.uiScene,
  input,
  {
    resume: () => {
      if (phase !== 'crashed') {
        resumeFromMenu();
      }
    },

    recenter: () => {
      return beginHeadRecalibration();
    },

    camera: () => {
      const mode = cameraRig.toggle(phoneMode);

      window.dispatchEvent(
        new CustomEvent('skyline:view-changed', {
          detail: { mode },
        }),
      );

      if (phoneMode) {
        input.recenterViewYaw?.();
      }

      cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));
      // VIEW changes should not close the menu.
      menuNeedsReanchor = menu.isOpen;

      return mode;
    },

    respawn: () => {
      if (phase === 'crashed') {
        finishRespawn();
      } else {
        beginRespawn('Manual respawn');
      }
    },

    effects: () => {
      return effects.cycleIntensity();
    },

    restart: () => {
      window.location.reload();
    },
  }
);

menu.aircraftName = aircraftVisuals.name;

function beginHeadRecalibration() {
  if (!phoneMode) {
    input.recenter();

    showTransient(
      'RECENTERED',
      1.2,
    );

    return 'RECENTERED';
  }

  /*
   * The user selected RESET HEAD while looking
   * sideways at a menu card. Close everything and
   * allow three seconds to face naturally forward.
   */
  menu.close();
  cameraRig.endMenuPose();
  powerStrip.close();
  radioBeacon.close();

  menuNeedsReanchor = false;

  transientMessage = '';
  transientUntil = 0;

  input.calibrated = false;

  phase = 'calibrating';

  phaseStarted =
    performance.now() / 1000;

  accumulator = 0;
  lastFrame = phaseStarted;

  cameraRig.reset(
    renderPoseInterpolator
      .sampleCurrent(
        renderPose,
      ),
  );

  setEyeMessage(
    'LOOK STRAIGHT\n3',
  );

  return 'LOOK STRAIGHT';
}

function setStartStatus(
  message,
  error = false
) {
  startStatus.textContent = message;

  startStatus.classList.toggle(
    'error',
    error
  );
}

function setEyeMessage(message) {
  const mono = !stereo.stereoEnabled;
  lastEyeText = message;
  eyeMessage.classList.toggle('mono', mono);
  eyeLeft.textContent = message;
  eyeRight.textContent = mono ? '' : message;
  eyeMessage.classList.toggle('hidden', !message);
}

function showTransient(
  message,
  seconds
) {
  transientMessage = message;

  transientUntil =
    performance.now() / 1000 +
    seconds;
}

function audioIsRunning() {
  return (
    worldPolish
      .getStatus()
      ?.audio
      ?.contextState ===
    'running'
  );
}

async function requestAudioFromGesture(
  forceRebuild = false,
) {
  try {
    return await worldPolish
      .unlockAudioFromGesture(
        forceRebuild,
      );
  } catch {
    return false;
  }
}

function waitForPhoneAudioGesture() {
  awaitingPhoneAudioGesture =
    true;

  phoneStart.disabled = false;
  desktopStart.disabled = true;

  if (phoneStartLabel) {
    phoneStartLabel.textContent =
      'ENABLE SOUND & START';
  }

  setStartStatus(
    'Motion is ready. Tap once more to enable sound and fly.'
  );

  return new Promise(
    resolve => {
      phoneAudioGestureResolve =
        resolve;
    },
  );
}

async function completePhoneAudioGesture() {
  phoneStart.disabled = true;

  setStartStatus(
    'Enabling sound…'
  );

  const unlocked =
    await requestAudioFromGesture(
      false,
    );

  if (
    !unlocked ||
    !audioIsRunning()
  ) {
    phoneStart.disabled = false;

    setStartStatus(
      'Sound is still blocked. Tap again to retry.',
      true,
    );

    return;
  }

  awaitingPhoneAudioGesture =
    false;

  if (phoneStartLabel) {
    phoneStartLabel.textContent =
      PHONE_START_DEFAULT_LABEL;
  }

  const resolve =
    phoneAudioGestureResolve;

  phoneAudioGestureResolve =
    null;

  resolve?.(true);
}

/*
 * iPhone Safari must receive AudioContext creation/resume
 * directly inside the physical tap event, before permission
 * dialogs or other awaited work can interrupt the gesture.
 */
const directAudioUnlock = () => {
  void requestAudioFromGesture(false);
};

for (const button of [
  phoneStart,
  desktopStart,
]) {
  button.addEventListener(
    'pointerdown',
    directAudioUnlock,
    {
      capture: true,
      passive: true,
    },
  );

  button.addEventListener(
    'touchend',
    directAudioUnlock,
    {
      capture: true,
      passive: true,
    },
  );
}

document.addEventListener(
  'visibilitychange',
  () => {
    if (
      document.visibilityState ===
      'visible'
    ) {
      void requestAudioFromGesture(false);
    }
  },
);

window.addEventListener(
  'pageshow',
  () => {
    void requestAudioFromGesture(false);
  },
);

for (
  const type of [
    'pointerdown',
    'touchend',
  ]
) {
  canvas.addEventListener(
    type,
    () => {
      if (
        phoneMode &&
        phase !== 'boot' &&
        !audioIsRunning()
      ) {
        void requestAudioFromGesture(
          true,
        );
      }
    },
    {
      passive: true,
    },
  );
}

function isLandscape() {
  return (
    window.innerWidth >=
    window.innerHeight
  );
}

function isStandalone() {
  return (
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches ||
    navigator.standalone === true
  );
}

function requestFullscreenFromGesture() {
  if (
    isStandalone() ||
    document.fullscreenElement
  ) {
    return;
  }

  const root =
    document.documentElement;

  const request =
    root.requestFullscreen ||
    root.webkitRequestFullscreen;

  if (
    typeof request !==
    'function'
  ) {
    return;
  }

  try {
    const result =
      request.call(
        root,
        {
          navigationUI: 'hide',
        }
      );

    if (
      result &&
      typeof result.catch ===
        'function'
    ) {
      result.catch(() => {});
    }
  } catch {
    // iPhone Safari uses Add to Home Screen.
  }
}

function updateFloatingOrigin(
  position
) {
  const distance = Math.hypot(
    position.x - renderOriginX,
    position.z - renderOriginZ
  );

  if (
    distance <
    CONFIG.world.floatingOriginDistance
  ) {
    return false;
  }

  const step =
    CONFIG.world.chunkSize;

  renderOriginX =
    Math.round(position.x / step) *
    step;

  renderOriginZ =
    Math.round(position.z / step) *
    step;

  scene.position.set(
    -renderOriginX,
    0,
    -renderOriginZ
  );

  stereo.uiScene.position.set(
    -renderOriginX,
    0,
    -renderOriginZ
  );

  scene.updateMatrixWorld(true);
  stereo.uiScene.updateMatrixWorld(
    true
  );

  renderPoseInterpolator.reset(
    flight,
    'floating-origin',
  );
  return true;
}

function ensureInitialWorld() {
  if (!initialWorldPromise) {
    initialWorldPromise =
      world
        .preloadSpawn(
          CONFIG.world.spawn
        )
        .then(() => {
          worldFlightReady = true;
          return world;
        })
        .catch((error) => {
          initialWorldPromise = null;
          throw error;
        });
  }

  return initialWorldPromise;
}

function configureInstallHint() {
  const isiPhone =
    /iPhone|iPod/i.test(
      navigator.userAgent
    );

  const dismissed =
    localStorage.getItem(
      'skyline-vr-install-hint-dismissed'
    ) === '1';

  installHint.classList.toggle(
    'hidden',
    !isiPhone ||
      isStandalone() ||
      dismissed
  );

  installDismiss.addEventListener(
    'click',
    () => {
      localStorage.setItem(
        'skyline-vr-install-hint-dismissed',
        '1'
      );

      installHint.classList.add(
        'hidden'
      );
    }
  );
}

async function acquireWakeLock() {
  if (
    !phoneMode ||
    document.visibilityState !==
      'visible'
  ) {
    return;
  }

  if (!('wakeLock' in navigator)) {
    showTransient(
      'WAKE LOCK UNAVAILABLE',
      2.5
    );

    return;
  }

  if (
    wakeLock &&
    !wakeLock.released
  ) {
    return;
  }

  try {
    const sentinel =
      await navigator.wakeLock.request(
        'screen'
      );

    wakeLock = sentinel;

    sentinel.addEventListener(
      'release',
      () => {
        if (wakeLock === sentinel) {
          wakeLock = null;
        }
      }
    );
  } catch {
    showTransient(
      'SCREEN MAY SLEEP',
      2.5
    );
  }
}

function resetFlight() {
  const spawn =
    CONFIG.world.spawn;

  flight.reset(
    spawn[0],
    spawn[1],
    spawn[2],
    CONFIG.physics.spawnSpeed
  );

  flight.attitude.setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    CONFIG.world.spawnPathAngle
  );

  flight.velocity.set(
    0,
    Math.sin(
      CONFIG.world.spawnPathAngle
    ) *
      CONFIG.physics.spawnSpeed,
    -Math.cos(
      CONFIG.world.spawnPathAngle
    ) *
      CONFIG.physics.spawnSpeed
  );

  updateFloatingOrigin(
    flight.position
  );

  renderPoseInterpolator.reset(flight, 'spawn');
  sharedRenderPose = renderPoseInterpolator.sampleCurrent(renderPose);
  cameraRig.reset(sharedRenderPose);
  accumulator = 0;
}

// SKYLINE_RUNTIME_UNFREEZE
function ensureLiveFlight(forceReset = false) {
  const fallbackSpeed =
    Math.max(
      40,
      Number(CONFIG.physics.spawnSpeed) || 58,
    );

  const invalidState =
    !Number.isFinite(flight.speed) ||
    flight.speed < 2 ||
    !flight.position?.isVector3 ||
    !Number.isFinite(flight.position.y) ||
    flight.position.y < 10 ||
    !flight.velocity?.isVector3 ||
    flight.velocity.lengthSq() < 4;

  if (forceReset || invalidState) {
    resetFlight();
  }

  if (
    !Number.isFinite(flight.speed) ||
    flight.speed < 2 ||
    flight.velocity.lengthSq() < 4
  ) {
    const angle =
      Number(CONFIG.world.spawnPathAngle) || 0;

    flight.speed = fallbackSpeed;

    flight.velocity.set(
      0,
      Math.sin(angle) * fallbackSpeed,
      -Math.cos(angle) * fallbackSpeed,
    );
  }

  accumulator = 0;
  lastFrame = performance.now() / 1000;
  renderPoseInterpolator.reset(flight, 'ensure-live');
  sharedRenderPose = renderPoseInterpolator.sampleCurrent(renderPose);
  cameraRig.reset(sharedRenderPose);
}

function startSession(phone) {
  phoneMode = phone;

  document.body.classList.add(
    'running'
  );

  document.body.classList.toggle(
    'phone',
    phone
  );

  startPanel.classList.add(
    'hidden'
  );

  installHint.classList.add(
    'hidden'
  );

  input.setMode(
    phone
      ? 'phone'
      : 'desktop'
  );

  stereo.setStereo(phone);


  hud.setVisible(!phone);

  effects.beginSession();

  nearWorld.setPhoneMode(phone);
  ensureWorldDetail(phone);
  powerControl.reset();
  landingSystem.reset();
  resetFlight();

  // SKYLINE_V42_CLEAN_START_VIEW
  cameraRig.setMode(initialViewMode({ phone }));
  window.dispatchEvent(
    new CustomEvent('skyline:view-changed', {
      detail: { mode: cameraRig.mode },
    }),
  );
  cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));

  phaseStarted =
    performance.now() / 1000;

  phase =
    phone
      ? 'calibrating'
      : 'flying';

  // SKYLINE_DESKTOP_FORCE_LIVE
  if (!phone) {
    ensureLiveFlight(true);
  }

  if (phone) {
    void acquireWakeLock();
  }
}

async function waitForLandscape() {
  if (isLandscape()) {
    return;
  }

  orientationWarning.classList.remove(
    'hidden'
  );

  await new Promise((resolve) => {
    const check = () => {
      if (!isLandscape()) {
        return;
      }

      window.removeEventListener(
        'resize',
        check
      );

      window.removeEventListener(
        'orientationchange',
        check
      );

      orientationWarning.classList.add(
        'hidden'
      );

      resolve();
    };

    window.addEventListener(
      'resize',
      check
    );

    window.addEventListener(
      'orientationchange',
      check
    );
  });
}

async function beginPhone(
  permissionPromise,
  initialAudioPromise,
) {
  phoneStart.disabled = true;
  desktopStart.disabled = true;

  try {
    setStartStatus(
      'Waiting for motion permission…'
    );

    if (!window.isSecureContext) {
      throw new Error(
        'Phone VR requires the secure GitHub Pages link.'
      );
    }

    const permission =
      await permissionPromise;

    if (
      permission !== 'granted'
    ) {
      throw new Error(
        'Motion access was not granted. Tap Start and choose Allow.'
      );
    }

    input.listenForOrientation();

    setStartStatus(
      'Rotate the phone to landscape.'
    );

    await waitForLandscape();

    setStartStatus(
      'Reading head movement…'
    );

    await input.waitForFreshSample();

    if (!input.yawValid) {
      throw new Error(
        'Head yaw is unavailable, so the gaze menu cannot work. Reload Safari and allow motion access.'
      );
    }

    try {
      await initialAudioPromise;
    } catch {}

    /*
     * The motion-permission dialog can interrupt
     * the AudioContext created by the first tap.
     *
     * This second tap happens after the dialog,
     * rebuilds Web Audio and verifies it is running.
     */
    await waitForPhoneAudioGesture();

    setStartStatus(
      'Loading the open world...'
    );

    await ensureInitialWorld();

    startSession(true);
  } catch (error) {
    setStartStatus(
      error.message ||
        'Phone VR could not start.',
      true
    );

    phoneStart.disabled = false;
    desktopStart.disabled = false;

    orientationWarning.classList.add(
      'hidden'
    );
  }
}

phoneStart.addEventListener(
  'click',
  () => {
    if (
      awaitingPhoneAudioGesture
    ) {
      void completePhoneAudioGesture();
      return;
    }

    const initialAudioPromise =
      requestAudioFromGesture(
        false,
      );

    let permissionPromise;

    try {
      permissionPromise =
        requestOrientationPermissionFromGesture();
    } catch (error) {
      permissionPromise =
        Promise.reject(error);
    }

    requestFullscreenFromGesture();

    void beginPhone(
      permissionPromise,
      initialAudioPromise,
    );
  }
);

async function beginDesktop() {
  phoneStart.disabled = true;
  desktopStart.disabled = true;

  try {
    setStartStatus(
      'Loading the open world...'
    );

    await ensureInitialWorld();

    startSession(false);
  } catch (error) {
    setStartStatus(
      error.message ||
        'The world could not load.',
      true
    );

    phoneStart.disabled = false;
    desktopStart.disabled = false;
  }
}

desktopStart.addEventListener(
  'click',
  () => {
    void requestAudioFromGesture(
      false,
    );

    void beginDesktop();
  }
);

function openMenu(
  crashMode = false
) {
  if (menu.isOpen) {
    return;
  }

  accumulator = 0;

  // Never leave the desktop control hint over the pause menu.
  transientMessage = '';
  transientUntil = 0;
  setEyeMessage('');

  if (!crashMode) {
    phase = 'paused';
  }

  /*
   * At high speed, collision can be detected before
   * the camera has been updated to the newest position.
   *
   * Update the camera first so the crash menu is always
   * anchored at the player's current view and stays at
   * the intended menu distance.
   */
  if (crashMode) {
    cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));
  }

  cameraRig.update(
    0,
    renderPoseInterpolator.sampleCurrent(renderPose),
    stereo.stereoEnabled,
    null,
    0,
    0,
    0,
    0
  );

  menu.cameraName =
    cameraRig.mode.toUpperCase();

  menu.effectsName =
    effects.intensityName;

  powerStrip.close();
  radioBeacon.close();
  cameraRig.beginMenuPose();

  menu.open(
    stereo.camera.position,
    stereo.camera.quaternion,
    crashMode,
    stereo.camera,
  );
}

function resumeFromMenu() {
  if (phase === 'crashed') {
    return;
  }

  menu.close();
  cameraRig.endMenuPose();

  phase = 'flying';

  /*
   * A stationary landed aircraft is valid.
   * Do not respawn it merely because speed is zero.
   */
  if (landingSystem.grounded) {
    renderPoseInterpolator.reset(
      flight,
      'landed-menu-resume',
    );

    sharedRenderPose =
      renderPoseInterpolator
        .sampleCurrent(
          renderPose,
        );

    cameraRig.reset(
      sharedRenderPose,
    );
  } else {
    ensureLiveFlight(false);
  }

  accumulator = 0;

  lastFrame =
    performance.now() / 1000;

  setEyeMessage('');
}

function prepareRespawnWorld(
  rebuildWorld
) {
  worldFlightReady = false;

  worldResetPromise =
    (
      rebuildWorld
        ? world.reset(
            CONFIG.world.spawn
          )
        : world.preloadSpawn(
            CONFIG.world.spawn
          )
    )
      .then(() => {
        worldFlightReady = true;
        worldResetPromise = null;
      })
      .catch((error) => {
        worldResetPromise = null;

        lastWorldError =
          error.message ||
          String(error);

        showTransient(
          'WORLD LOAD FAILED',
          3
        );
      });
}

function beginRespawn(
  reason,
  rebuildWorld = false
) {
  if (phase === 'crashed') {
    if (rebuildWorld) {
      prepareRespawnWorld(true);
    }

    crashElapsed = 3;
    neutralHold = 0;

    return;
  }

  phase = 'crashed';
  crashElapsed = 0;
  crashCountdownFinished = false;
  neutralHold = 0;
  accumulator = 0;

  if (menu.isOpen) {
    menu.close();
    cameraRig.endMenuPose();
  }

  prepareRespawnWorld(
    rebuildWorld
  );

  openMenu(true);

  showTransient(
    reason,
    1.2
  );
}

function finishRespawn() {
  landingSystem.reset();
  powerControl.reset();
  resetFlight();
  input.recenter();
  menu.close();
  cameraRig.endMenuPose();

  phase = 'flying';

  phaseStarted =
    performance.now() / 1000;

  crashElapsed = 0;
  fadeWhite = 0;
  neutralHold = 0;

  setEyeMessage('');

  lastFrame =
    performance.now() / 1000;
}

function updateCalibration(now) {
  fadeWhite = 0;

  if (!isLandscape()) {
    phaseStarted = now;

    orientationWarning.classList.remove(
      'hidden'
    );

    setEyeMessage('ROTATE');

    return;
  }

  orientationWarning.classList.add(
    'hidden'
  );

  if (
    !input.isTrackingFresh(now)
  ) {
    phaseStarted = now;

    setEyeMessage(
      'TRACKING…'
    );

    return;
  }

  const elapsed =
    now - phaseStarted;

  const count =
    Math.max(
      1,
      3 - Math.floor(elapsed)
    );

  setEyeMessage(
    `LOOK STRAIGHT\n${count}`
  );

  if (elapsed >= 3) {
    input.recenter(now);

    phase = 'flying';
    phaseStarted = now;

    setEyeMessage('');
  }
}

function updateCrash(dt) {
  crashElapsed += dt;
  crashCountdownFinished = true;

  if (crashElapsed < 0.25) {
    fadeWhite =
      crashElapsed / 0.25;
  } else if (
    crashElapsed < 0.75
  ) {
    fadeWhite =
      1 -
      (
        crashElapsed - 0.25
      ) /
        0.5;
  } else {
    fadeWhite = 0;
  }

  setEyeMessage('');

  if (!menu.isOpen) {
    openMenu(true);
  }
}

function updateInputAndState(
  frameDt,
  now
) {
  input.updateFrame(
    frameDt,
    phase === 'flying'
  );

  if (
    input.consumeCameraToggle() &&
    phase !== 'boot' &&
    phase !== 'calibrating'
  ) {
    const mode = cameraRig.toggle(phoneMode);
    window.dispatchEvent(
      new CustomEvent('skyline:view-changed', {
        detail: { mode },
      }),
    );
    if (phoneMode) {
      input.recenterViewYaw?.();
    }
    cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));
  }

  if (
    input.consumeRespawnRequest() &&
    phase !== 'boot' &&
    phase !== 'calibrating'
  ) {
    beginRespawn(
      'Manual respawn'
    );
  }


  if (
    input.consumeMenuRequest()
  ) {
    if (phase === 'flying') {
      openMenu(false);
    } else if (
      phase === 'paused'
    ) {
      resumeFromMenu();
    }
  }

  if (
    phoneMode &&
    phase === 'flying' &&
    (
      !isLandscape() ||
      !input.calibrated ||
      !input.isTrackingFresh(now)
    )
  ) {
    phase = 'calibrating';
    phaseStarted = now;
    accumulator = 0;
  }
}


function updateLeftGazeMenu(dt) {
  const triggered =
    vrMenuBeacon.update(
      dt,
      {
        active:
          phoneMode &&
          phase === 'flying' &&
          !menu.isOpen,

        camera:
          stereo.camera,

        basePosition:
          cameraRig.basePosition,

        baseQuaternion:
          cameraRig.baseQuaternion,
      },
    );

  if (triggered) {
    openMenu(false);
  }
}

function updateMessages(now) {
  if (
    phase === 'flying' &&
    transientMessage &&
    now < transientUntil
  ) {
    setEyeMessage(
      transientMessage
    );
  } else if (
    phase === 'flying' &&
    transientMessage
  ) {
    transientMessage = '';

    setEyeMessage('');
  }
}

function frame(milliseconds) {
  requestAnimationFrame(frame);

  // SKYLINE_V5_1_PHYSICS_PERFORMANCE
  let physicsStepsThisFrame = 0;
  let droppedPhysicsThisFrame = 0;

  const now =
    milliseconds / 1000;

  const frameDt =
    clamp(
      now - lastFrame,
      0,
      0.1
    );

  lastFrame = now;

  updateInputAndState(
    frameDt,
    now
  );

  if (
    phase === 'calibrating'
  ) {
    updateCalibration(now);
  } else if (
    phase === 'crashed'
  ) {
    updateCrash(frameDt);
  } else if (
    phase === 'flying'
  ) {
    input.sampleFlightControls(
      frameDt
    );

    accumulator += frameDt;

    let steps = 0;

    while (
      accumulator >=
        CONFIG.physics.fixedStep &&
      steps <
        CONFIG.physics.maxSubSteps
    ) {
      const powerState = powerControl.state;
      const flightControls =
        powerControl.controlsFor(input.controls);

      if (landingSystem.grounded) {
        landingSystem.stepGround(
          CONFIG.physics.fixedStep,
          flight,
          powerState,
        );
      } else {
        flight.step(
          CONFIG.physics.fixedStep,
          flightControls,
        );
      }

      const landingResult =
        landingSystem.afterFlightStep(
          flight,
          powerState,
        );

      nearWorld.fixedStepUpdate(
        CONFIG.physics.fixedStep,
        flight,
      );

      renderPoseInterpolator.captureFixedStep(flight);

      accumulator -=
        CONFIG.physics.fixedStep;

      steps += 1;

      worldPolish.fixedStepUpdate?.(
        CONFIG.physics.fixedStep,
        flight,
        phase,
      );

      worldDetail?.fixedStepUpdate(
        CONFIG.physics.fixedStep,
        flight,
        phase,
      );

      const collisionHit =
        !landingResult.suppressCollision &&
        collision.check(flight.position);

      if (
        landingResult.crashReason ||
        collisionHit
      ) {
        beginRespawn(
          landingResult.crashReason ||
          collision.lastReason
        );
        break;
      }
    }
    physicsStepsThisFrame = steps;


    if (
      steps ===
        CONFIG.physics.maxSubSteps &&
      accumulator >=
        CONFIG.physics.fixedStep
    ) {
      accumulator = Math.min(
        accumulator,
        CONFIG.physics.fixedStep * 2,
      );

      droppedSteps += 1;
      droppedPhysicsThisFrame = 1;
      renderPoseInterpolator.reset(flight, 'dropped-physics-time');
    }
  }

  if (menu.isOpen) {
    menu.update(frameDt);
  }

  const originShifted = updateFloatingOrigin(
    flight.position
  );

  if (originShifted) {
    cameraRig.reset(renderPoseInterpolator.sampleCurrent(renderPose));
  }

  const renderAlpha = renderInterpolationAlpha(
    accumulator,
    CONFIG.physics.fixedStep,
  );
  sharedRenderPose = renderPoseInterpolator.sample(
    renderAlpha,
    renderPose,
  );

  effects.update(
    phase === 'flying'
      ? frameDt
      : 0,
    flight,
    stereo.camera
  );

  if (menu.isOpen) {
    menuCameraLook.yaw =
      phoneMode
        ? Number(
            input.menuLook?.yaw
          ) || 0
        : 0;

    menuCameraLook.pitch =
      phoneMode
        ? Number(
            input.menuLook?.pitch
          ) || 0
        : 0;
  }

  cameraRig.update(
    frameDt,
    sharedRenderPose,
    stereo.stereoEnabled,
    menu.isOpen
      ? menuCameraLook
      : null,
    menu.isOpen
      ? 0
      : effects.shakePitch,
    menu.isOpen
      ? 0
      : effects.shakeYaw,
    menu.isOpen
      ? 0
      : effects.shakeRoll,
    effects.viewSqueeze
  );

  updateLeftGazeMenu(frameDt);

  powerStrip.update(
    frameDt,
    {
      active:
        phoneMode &&
        phase === 'flying' &&
        !menu.isOpen,
      camera: stereo.camera,
      basePosition:
        cameraRig.basePosition,
      baseQuaternion:
        cameraRig.baseQuaternion,
      grounded:
        landingSystem.grounded,
    },
  );

  radioBeacon.update(
    frameDt,
    {
      active:
        phoneMode &&
        phase === 'flying' &&
        !menu.isOpen,
      camera: stereo.camera,
      basePosition:
        cameraRig.basePosition,
      baseQuaternion:
        cameraRig.baseQuaternion,
      aircraftId:
        aircraftVisuals.profile.id,
      cameraMode:
        cameraRig.mode,
    },
  );

  if (
    menuNeedsReanchor &&
    menu.isOpen
  ) {
    cameraRig.endMenuPose();

    cameraRig.update(
      0,
      sharedRenderPose,
      stereo.stereoEnabled,
      null,
      0,
      0,
      0,
      0
    );

    cameraRig.beginMenuPose();
    input.beginMenuLook();

    menu.reanchor(
      stereo.camera.position,
      stereo.camera.quaternion
    );

    menuNeedsReanchor = false;
  }

  aircraftVisuals.update(
    frameDt,
    sharedRenderPose,
    cameraRig.mode,
    cameraRig.basePosition,
    cameraRig.baseQuaternion,
    powerControl.state,
  );

  cockpitPowerFeedback.update({
    visible:
      cameraRig.mode ===
        'cockpit' &&
      phase !== 'boot',

    position:
      cameraRig.basePosition,

    quaternion:
      cameraRig.baseQuaternion,

    powerState:
      powerControl.state,

    aircraftId:
      aircraftVisuals.profile.id,
  });
  worldPolish.beginPerformanceFrame?.(
    frameDt,
    {
      physicsSteps:
        physicsStepsThisFrame,

      maxSubSteps:
        CONFIG.physics.maxSubSteps,

      dropped:
        droppedPhysicsThisFrame,

      render:
        stereo.metrics,
    },
  );


  worldPolish.update(
    frameDt,
    flight,
    stereo.camera,
    phase,
  );

  worldDetail?.update(
    frameDt,
    flight,
    stereo.camera,
    phase,
  );

  nearWorld.update(frameDt, flight);
  landingSystem.update(frameDt, flight);
  runwayGuidance.update(flight);

  const worldFocus =
    phase === 'crashed'
      ? CONFIG.world.spawn
      : flight.position;

  const worldStats =
    world.update(
      worldFocus,
      stereo.camera,
      frameDt
    );

  if (
    worldStats.error &&
    worldStats.error !==
      lastWorldError
  ) {
    lastWorldError =
      worldStats.error;

    showTransient(
      'WORLD STREAM RETRYING',
      2.5
    );
  }

  stereo.setReticle(
    flight.boostCharge,
    phoneMode
      ? Math.max(
          menu.isOpen ? menu.dwellProgress : 0,
          powerStrip.progress,
          radioBeacon.progress,
        )
      : 0,
    phase !== 'boot' &&
      (!menu.isOpen || phoneMode)
  );

  stereo.setOverlay(
    effects.vignette,
    effects.redTint,
    fadeWhite
  );

  updateMessages(now);

  hud.update(
    frameDt,
    flight,
    cameraRig.mode,
    stereo.metrics,
    droppedSteps
  );

  stereo.render(scene);

  worldPolish.endPerformanceFrame?.(
    stereo.metrics,
  );
}

window.addEventListener(
  'resize',
  () => {
    stereo.resize();
  }
);

document.addEventListener(
  'visibilitychange',
  () => {
    lastFrame =
      performance.now() / 1000;

    accumulator = 0;
    renderPoseInterpolator.reset(flight, 'visibility-change');

    if (
      document.visibilityState ===
      'visible'
    ) {
      void acquireWakeLock();
    }
  }
);

window.addEventListener(
  'pageshow',
  () => {
    lastFrame =
      performance.now() / 1000;

    accumulator = 0;
    renderPoseInterpolator.reset(flight, 'pageshow');

    void acquireWakeLock();
  }
);

window.skylineExpansionDiagnostics = () => ({
  power: powerControl.state,
  landing: {
    state: landingSystem.state,
    zone: landingSystem.zone?.id || null,
  },
  world: nearWorld.getStatus(),
  audio:
    worldPolish
      .getStatus()
      ?.audio,
});

window.skylineWorldDetailDiagnostics =
  () =>
    worldDetail?.getStatus?.() ??
    {
      active: false,
      state: 'not-created',
      version: '2.5.0',
    };

window.skylineWorldDetailCollisionDescriptors =
  () =>
    worldDetail
      ?.getCollisionDescriptors?.() ??
    [];

window.addEventListener(
  'pagehide',
  event => {
    if (!event.persisted) {
      worldDetail?.dispose?.();
      worldDetail = null;
    }
  },
);

configureInstallHint();
powerControl.reset();
landingSystem.reset();
resetFlight();

cameraRig.update(
  0,
  flight,
  false,
  null,
  0,
  0,
  0,
  0
);

hud.setVisible(false);

requestAnimationFrame(frame);

ensureInitialWorld().catch(
  (error) => {
    setStartStatus(
      `World unavailable: ${error.message}`,
      true
    );
  }
);

// SKYLINE_V41_PREVIEW_CACHE_FIX
const isCodespacePreview = location.hostname.endsWith('.github.dev');

if (isCodespacePreview && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .then(() => caches.keys())
    .then(keys => Promise.all(keys.map(key => caches.delete(key))))
    .catch(() => {});
}

if (
  !isCodespacePreview &&
  'serviceWorker' in navigator &&
  window.isSecureContext
) {
  navigator.serviceWorker
    .register(
      './sw.js',
      {
        updateViaCache: 'none',
      }
    )
    .then(
      (registration) =>
        registration.update()
    )
    .catch(
      (error) => {
        setStartStatus(
          `Offline install unavailable: ${error.message}`,
          true
        );
      }
    );
}


// SKYLINE_V4_AI_COLLISION
window.addEventListener('skyline:ai-collision', () => {
  if (phase === 'flying') beginRespawn('MID-AIR COLLISION');
});
