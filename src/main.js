import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, clamp } from './config.js';
import { InputController, requestOrientationPermissionFromGesture } from './input.js';
import { FlightModel, TELEMETRY_EVENT_COLLISION } from './flightModel.js';
import { CollisionSystem } from './collision.js';
import { CameraRig } from './camera.js';
import { EffectsSystem } from './effects.js';
import { StereoRenderer } from './stereo.js';
import { GazeMenu } from './menu.js';
import { MonoHud } from './hud.js';
import { createWorld } from './world/world.js';

const canvas = document.querySelector('#game');
const startPanel = document.querySelector('#start-panel');
const phoneStart = document.querySelector('#phone-start');
const desktopStart = document.querySelector('#desktop-start');
const startStatus = document.querySelector('#start-status');
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
const collision = new CollisionSystem();
const world = createWorld(scene, collision);
collision.setHeightSampler(world.sampleHeight);
const cameraRig = new CameraRig(scene, stereo.camera, world.sampleHeight);
const effects = new EffectsSystem(scene);
const hud = new MonoHud(hudRoot);

let phase = 'boot'; // boot | calibrating | flying | paused | crashed
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
let glitchNotified = false;
let worldFlightReady = false;
let worldResetPromise = null;
let renderOriginX = 0;
let renderOriginZ = 0;
let lastWorldError = '';
let initialWorldPromise = null;

const menu = new GazeMenu(stereo.uiScene, input, {
  resume: () => {
    if (phase !== 'crashed') resumeFromMenu();
  },
  recenter: () => showTransient('RECENTERED', 1.2),
  camera: () => {
    const mode = cameraRig.toggle();
    cameraRig.reset(flight);
    menuNeedsReanchor = true;
    return mode;
  },
  respawn: () => beginRespawn('Manual respawn'),
  effects: () => effects.cycleIntensity(),
  restart: () => {
    beginRespawn('World restarted', true);
  },
});

function setStartStatus(message, error = false) {
  startStatus.textContent = message;
  startStatus.classList.toggle('error', error);
}

function setEyeMessage(message) {
  if (message === lastEyeText) return;
  lastEyeText = message;
  eyeLeft.textContent = message;
  eyeRight.textContent = message;
  eyeMessage.classList.toggle('hidden', !message);
}

function showTransient(message, seconds) {
  transientMessage = message;
  transientUntil = performance.now() / 1000 + seconds;
}

function isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function requestFullscreenFromGesture() {
  if (isStandalone() || document.fullscreenElement) return;
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (typeof request !== 'function') return;
  try {
    const result = request.call(root, { navigationUI: 'hide' });
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // iPhone Safari uses Add to Home Screen for true fullscreen.
  }
}

function updateFloatingOrigin(position) {
  const distance = Math.hypot(position.x - renderOriginX, position.z - renderOriginZ);
  if (distance < CONFIG.world.floatingOriginDistance) return;
  const step = CONFIG.world.chunkSize;
  renderOriginX = Math.round(position.x / step) * step;
  renderOriginZ = Math.round(position.z / step) * step;
  scene.position.set(-renderOriginX, 0, -renderOriginZ);
  stereo.uiScene.position.set(-renderOriginX, 0, -renderOriginZ);
  scene.updateMatrixWorld(true);
  stereo.uiScene.updateMatrixWorld(true);
}

function ensureInitialWorld() {
  if (!initialWorldPromise) {
    initialWorldPromise = world.preloadSpawn(CONFIG.world.spawn).then(() => {
      worldFlightReady = true;
      return world;
    }).catch((error) => {
      initialWorldPromise = null;
      throw error;
    });
  }
  return initialWorldPromise;
}

function configureInstallHint() {
  const isiPhone = /iPhone|iPod/i.test(navigator.userAgent);
  const dismissed = localStorage.getItem('skyline-vr-install-hint-dismissed') === '1';
  installHint.classList.toggle('hidden', !isiPhone || isStandalone() || dismissed);
  installDismiss.addEventListener('click', () => {
    localStorage.setItem('skyline-vr-install-hint-dismissed', '1');
    installHint.classList.add('hidden');
  });
}

async function acquireWakeLock() {
  if (!phoneMode || document.visibilityState !== 'visible') return;
  if (!('wakeLock' in navigator)) {
    showTransient('WAKE LOCK UNAVAILABLE', 2.5);
    return;
  }
  if (wakeLock && !wakeLock.released) return;
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    wakeLock = sentinel;
    sentinel.addEventListener('release', () => {
      if (wakeLock === sentinel) wakeLock = null;
    });
  } catch (error) {
    showTransient('SCREEN MAY SLEEP', 2.5);
  }
}

function resetFlight() {
  const spawn = CONFIG.world.spawn;
  flight.reset(spawn[0], spawn[1], spawn[2], CONFIG.physics.spawnSpeed);
  flight.attitude.setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.world.spawnPathAngle);
  flight.velocity.set(
    0,
    Math.sin(CONFIG.world.spawnPathAngle) * CONFIG.physics.spawnSpeed,
    -Math.cos(CONFIG.world.spawnPathAngle) * CONFIG.physics.spawnSpeed,
  );
  updateFloatingOrigin(flight.position);
  cameraRig.reset(flight);
  accumulator = 0;
}

function startSession(phone) {
  phoneMode = phone;
  document.body.classList.add('running');
  document.body.classList.toggle('phone', phone);
  startPanel.classList.add('hidden');
  installHint.classList.add('hidden');
  input.setMode(phone ? 'phone' : 'desktop');
  stereo.setStereo(phone);
  hud.setVisible(!phone);
  effects.beginSession();
  resetFlight();
  phaseStarted = performance.now() / 1000;
  phase = phone ? 'calibrating' : 'flying';
  if (phone) void acquireWakeLock();
  else showTransient('CENTER MOUSE / W/S/A/D ALSO WORK', 3);
}

function downloadTelemetry() {
  const useGlitchCapture = flight.telemetryGlitchDetected;
  const json = flight.exportTelemetrySnapshot(useGlitchCapture, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `skyline-vr-telemetry-${useGlitchCapture ? 'glitch' : 'manual'}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showTransient('TELEMETRY SAVED', 1.5);
}

async function waitForLandscape() {
  if (isLandscape()) return;
  orientationWarning.classList.remove('hidden');
  await new Promise(resolve => {
    const check = () => {
      if (!isLandscape()) return;
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      orientationWarning.classList.add('hidden');
      resolve();
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
  });
}

async function beginPhone(permissionPromise) {
  phoneStart.disabled = true;
  desktopStart.disabled = true;
  try {
    setStartStatus('Waiting for motion permission…');
    if (!window.isSecureContext) throw new Error('Phone VR requires the secure GitHub Pages link.');
    const permission = await permissionPromise;
    if (permission !== 'granted') throw new Error('Motion access was not granted. Tap Start and choose Allow.');
    input.listenForOrientation();
    setStartStatus('Rotate the phone to landscape.');
    await waitForLandscape();
    setStartStatus('Reading head movement…');
    await input.waitForFreshSample();
    if (!input.yawValid) throw new Error('Head yaw is unavailable, so the gaze menu cannot work. Reload Safari and allow motion access.');
    setStartStatus('Loading the open world...');
    await ensureInitialWorld();
    startSession(true);
  } catch (error) {
    setStartStatus(error.message || 'Phone VR could not start.', true);
    phoneStart.disabled = false;
    desktopStart.disabled = false;
    orientationWarning.classList.add('hidden');
  }
}

phoneStart.addEventListener('click', () => {
  let permissionPromise;
  try {
    // iOS requires this permission call to be the direct consequence of the Start tap.
    permissionPromise = requestOrientationPermissionFromGesture();
  } catch (error) {
    permissionPromise = Promise.reject(error);
  }
  requestFullscreenFromGesture();
  void beginPhone(permissionPromise);
});

async function beginDesktop() {
  phoneStart.disabled = true;
  desktopStart.disabled = true;
  try {
    setStartStatus('Loading the open world...');
    await ensureInitialWorld();
    startSession(false);
  } catch (error) {
    setStartStatus(error.message || 'The world could not load.', true);
    phoneStart.disabled = false;
    desktopStart.disabled = false;
  }
}

desktopStart.addEventListener('click', () => void beginDesktop());

function openMenu(crashMode = false) {
  if (menu.isOpen) return;
  accumulator = 0;
  if (!crashMode) phase = 'paused';
  menu.cameraName = cameraRig.mode.toUpperCase();
  menu.effectsName = effects.intensityName;
  menu.open(cameraRig.basePosition, cameraRig.baseQuaternion, crashMode);
}

function resumeFromMenu() {
  if (phase === 'crashed') return;
  menu.close();
  phase = 'flying';
  accumulator = 0;
  lastFrame = performance.now() / 1000;
  setEyeMessage('');
}

function prepareRespawnWorld(rebuildWorld) {
  worldFlightReady = false;
  worldResetPromise = (rebuildWorld
    ? world.reset(CONFIG.world.spawn)
    : world.preloadSpawn(CONFIG.world.spawn)
  ).then(() => {
    worldFlightReady = true;
    worldResetPromise = null;
  }).catch((error) => {
    worldResetPromise = null;
    lastWorldError = error.message || String(error);
    showTransient('WORLD LOAD FAILED', 3);
  });
}

function beginRespawn(reason, rebuildWorld = false) {
  // The crash-menu Respawn action deliberately skips the remaining countdown,
  // but still requires the neutral/steady safety gate before returning control.
  if (phase === 'crashed') {
    if (rebuildWorld) prepareRespawnWorld(true);
    crashElapsed = 3;
    neutralHold = 0;
    return;
  }
  phase = 'crashed';
  crashElapsed = 0;
  crashCountdownFinished = false;
  neutralHold = 0;
  accumulator = 0;
  if (menu.isOpen) menu.close();
  prepareRespawnWorld(rebuildWorld);
  openMenu(true);
  showTransient(reason, 1.2);
}

function finishRespawn() {
  resetFlight();
  input.recenter();
  menu.close();
  phase = 'flying';
  phaseStarted = performance.now() / 1000;
  crashElapsed = 0;
  fadeWhite = 0;
  neutralHold = 0;
  setEyeMessage('');
  lastFrame = performance.now() / 1000;
}

function updateCalibration(now) {
  fadeWhite = 0;
  if (!isLandscape()) {
    phaseStarted = now;
    orientationWarning.classList.remove('hidden');
    setEyeMessage('ROTATE');
    return;
  }
  orientationWarning.classList.add('hidden');
  if (!input.isTrackingFresh(now)) {
    phaseStarted = now;
    setEyeMessage('TRACKING…');
    return;
  }
  const elapsed = now - phaseStarted;
  const count = Math.max(1, 3 - Math.floor(elapsed));
  setEyeMessage(`LOOK STRAIGHT\n${count}`);
  if (elapsed >= 3) {
    input.recenter(now);
    phase = 'flying';
    phaseStarted = now;
    setEyeMessage('');
  }
}

function updateCrash(dt) {
  crashElapsed += dt;
  if (crashElapsed < 0.25) fadeWhite = crashElapsed / 0.25;
  else if (crashElapsed < 0.75) fadeWhite = 1 - (crashElapsed - 0.25) / 0.5;
  else fadeWhite = 0;

  if (crashElapsed < 3) {
    const count = Math.max(1, 3 - Math.floor(crashElapsed));
    setEyeMessage(`CRASH\n${count}`);
    return;
  }
  crashCountdownFinished = true;
  if (!worldFlightReady) {
    setEyeMessage(worldResetPromise ? 'LOADING WORLD' : 'WORLD LOAD FAILED');
    return;
  }
  if (phoneMode && (!input.isTrackingFresh() || !input.isNearFlightNeutral())) {
    neutralHold = 0;
    setEyeMessage('LOOK STRAIGHT');
    return;
  }
  neutralHold += dt;
  setEyeMessage('HOLD STEADY');
  if (neutralHold >= 0.5) finishRespawn();
}

function updateInputAndState(frameDt, now) {
  input.updateFrame(frameDt, phase === 'flying');
  if (input.consumeCameraToggle() && phase !== 'boot' && phase !== 'calibrating') {
    cameraRig.toggle();
    cameraRig.reset(flight);
  }
  if (input.consumeRespawnRequest() && phase !== 'boot' && phase !== 'calibrating') beginRespawn('Manual respawn');
  if (input.consumeTelemetryRequest() && phase !== 'boot') downloadTelemetry();
  if (input.consumeMenuRequest()) {
    if (phase === 'flying') openMenu(false);
    else if (phase === 'paused') resumeFromMenu();
  }

  if (phoneMode && phase === 'flying' && (!isLandscape() || !input.calibrated || !input.isTrackingFresh(now))) {
    phase = 'calibrating';
    phaseStarted = now;
    accumulator = 0;
  }
}

function updateMessages(now) {
  if (phase === 'flying' && transientMessage && now < transientUntil) setEyeMessage(transientMessage);
  else if (phase === 'flying' && transientMessage) {
    transientMessage = '';
    setEyeMessage('');
  }
}

function frame(milliseconds) {
  requestAnimationFrame(frame);
  const now = milliseconds / 1000;
  const frameDt = clamp(now - lastFrame, 0, 0.1);
  lastFrame = now;
  updateInputAndState(frameDt, now);

  if (phase === 'calibrating') updateCalibration(now);
  else if (phase === 'crashed') updateCrash(frameDt);
  else if (phase === 'flying') {
    input.sampleFlightControls(frameDt);
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= CONFIG.physics.fixedStep && steps < CONFIG.physics.maxSubSteps) {
      flight.step(CONFIG.physics.fixedStep, input.controls);
      accumulator -= CONFIG.physics.fixedStep;
      steps += 1;
      if (collision.check(flight.position)) {
        flight.flagTelemetryEvent(TELEMETRY_EVENT_COLLISION);
        beginRespawn(collision.lastReason);
        break;
      }
    }
    if (steps === CONFIG.physics.maxSubSteps && accumulator >= CONFIG.physics.fixedStep) {
      accumulator = 0;
      droppedSteps += 1;
    }
  }

  if (menu.isOpen) menu.update(frameDt);
  updateFloatingOrigin(flight.position);
  effects.update(phase === 'flying' ? frameDt : 0, flight, stereo.camera);
  cameraRig.update(
    frameDt,
    flight,
    stereo.stereoEnabled,
    menu.isOpen ? input.menuLook : null,
    menu.isOpen ? 0 : effects.shakePitch,
    menu.isOpen ? 0 : effects.shakeYaw,
    menu.isOpen ? 0 : effects.shakeRoll,
    effects.viewSqueeze
  );
  if (menuNeedsReanchor && menu.isOpen) {
    menu.reanchor(cameraRig.basePosition, cameraRig.baseQuaternion);
    menuNeedsReanchor = false;
  }
  // Keep the spawn region resident through the post-load neutral hold. Using
  // the old impact position here could unload spawn again before finishRespawn.
  const worldFocus = phase === 'crashed' ? CONFIG.world.spawn : flight.position;
  const worldStats = world.update(worldFocus, stereo.camera, frameDt);
  if (worldStats.error && worldStats.error !== lastWorldError) {
    lastWorldError = worldStats.error;
    showTransient('WORLD STREAM RETRYING', 2.5);
  }
  stereo.setReticle(flight.boostCharge, menu.dwellProgress, phase !== 'boot');
  stereo.setOverlay(effects.vignette, effects.redTint, fadeWhite);
  updateMessages(now);
  if (flight.telemetryGlitchDetected && !glitchNotified) {
    glitchNotified = true;
    downloadTelemetry();
    showTransient('FLIGHT GLITCH CAPTURED / TELEMETRY SAVED', 4);
  }
  hud.update(frameDt, flight, cameraRig.mode, stereo.metrics, droppedSteps);
  stereo.render(scene);
}

window.addEventListener('resize', () => stereo.resize());
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now() / 1000;
  accumulator = 0;
  if (document.visibilityState === 'visible') void acquireWakeLock();
});
window.addEventListener('pageshow', () => {
  lastFrame = performance.now() / 1000;
  accumulator = 0;
  void acquireWakeLock();
});

configureInstallHint();
resetFlight();
cameraRig.update(0, flight, false, null, 0, 0, 0, 0);
hud.setVisible(false);
requestAnimationFrame(frame);

ensureInitialWorld().catch(error => setStartStatus(`World unavailable: ${error.message}`, true));

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(registration => registration.update())
    .catch(error => setStartStatus(`Offline install unavailable: ${error.message}`, true));
}
