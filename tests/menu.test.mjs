import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeMenu } from '../src/menu.js';

const DEG = Math.PI / 180;

function makeHarness(actions = ['camera']) {
  let activations = 0;
  const input = {
    menuLook: { yaw: 0, pitch: 0 },
    sensitivityName: 'STANDARD',
    sampleMenuLook() {},
    beginMenuLook() {},
    recenter() {},
    cycleSensitivity() {},
  };
  const menu = Object.create(GazeMenu.prototype);
  menu.config = {
    menu: {
      dwellSeconds: 1,
      panelHitHalfAngle: 5.5 * DEG,
      panelPitchHalfAngle: 4.8 * DEG,
      gazeSmoothingTau: 0,
      panelExitHalfAngle: 7.5 * DEG,
      panelExitPitchHalfAngle: 6.8 * DEG,
      dwellDecaySeconds: 0.4,
      activationLockoutSeconds: 0.5,
      destructiveDwellSeconds: 1.5,
    },
  };
  menu.input = input;
  menu.callbacks = {
    resume() { activations += 1; },
    recenter() { activations += 1; },
    camera() { activations += 1; return 'first'; },
    respawn() { activations += 1; },
    effects() { activations += 1; return 'FULL'; },
    restart() { activations += 1; },
  };
  menu.panels = actions.map((action, index) => ({
    action,
    yaw: index * 20 * DEG,
    pitch: 0,
  }));
  menu.isOpen = true;
  menu.crashMode = false;
  menu.targetIndex = -1;
  menu.latchedIndex = -1;
  menu.dwellIndex = -1;
  menu.dwellTime = 0;
  menu.exitTime = 0;
  menu.entryGrace = 0;
  menu.activationLockout = 0;
  menu.dwellProgress = 0;
  menu._smoothedGazeX = 0;
  menu._smoothedGazeY = 0;
  menu._smoothedGazeZ = -1;
  menu._smoothedYaw = 0;
  menu._smoothedPitch = 0;
  menu._gazeInitialized = false;
  menu._panelArmed = new Uint8Array(actions.length);
  menu._panelArmed.fill(1);
  menu.cameraName = 'FIRST';
  menu.effectsName = 'FULL';
  menu._drawPanel = () => {};
  return { menu, input, activationCount: () => activations };
}

test('gaze direction EMA uses a 120 ms time constant without overshoot', () => {
  const { menu, input } = makeHarness();
  menu.config.menu.gazeSmoothingTau = 0.12;
  menu._smoothGaze(1 / 60);
  input.menuLook.yaw = 12 * DEG;
  menu._smoothGaze(0.12);

  assert.ok(menu._smoothedYaw > 7.4 * DEG);
  assert.ok(menu._smoothedYaw < 7.8 * DEG);
  assert.ok(Math.abs(Math.hypot(
    menu._smoothedGazeX,
    menu._smoothedGazeY,
    menu._smoothedGazeZ
  ) - 1) < 1e-12);
});

test('panel acquisition uses separate enter and exit angles', () => {
  const { menu, input } = makeHarness();
  input.menuLook.yaw = 5 * DEG;
  menu.update(0.01);
  assert.equal(menu.targetIndex, 0);

  input.menuLook.yaw = 7 * DEG;
  menu.update(0.01);
  assert.equal(menu.targetIndex, 0, 'target should remain held outside the enter angle');

  input.menuLook.yaw = 8 * DEG;
  menu.update(0.01);
  assert.equal(menu.targetIndex, -1, 'target should release beyond the exit angle');
});

test('dwell progress decays over 0.4 seconds and resumes on re-entry', () => {
  const { menu, input } = makeHarness();
  menu.update(0.6);
  assert.ok(Math.abs(menu.dwellProgress - 0.6) < 1e-12);

  input.menuLook.yaw = 10 * DEG;
  menu.update(0.1);
  assert.ok(Math.abs(menu.dwellProgress - 0.35) < 1e-12);

  input.menuLook.yaw = 0;
  menu.update(0.1);
  assert.ok(Math.abs(menu.dwellProgress - 0.45) < 1e-12);
});

test('activation locks globally and a panel only rearms after gaze exit', () => {
  const { menu, input, activationCount } = makeHarness();
  menu.update(0.5);
  menu.update(0.5);
  assert.equal(activationCount(), 1);

  menu.update(0.6);
  menu.update(1);
  assert.equal(activationCount(), 1, 'holding gaze must not reactivate the panel');

  input.menuLook.yaw = 8 * DEG;
  menu.update(0.01);
  input.menuLook.yaw = 0;
  menu.update(1);
  assert.equal(activationCount(), 2, 'gaze exit should rearm after the lockout');
});

test('global lockout blocks a different panel for the full 0.5 seconds', () => {
  const { menu, input, activationCount } = makeHarness(['camera', 'resume']);
  menu.update(1);
  assert.equal(activationCount(), 1);

  input.menuLook.yaw = 20 * DEG;
  menu.update(0.49);
  assert.equal(activationCount(), 1);
  menu.update(0.02);
  assert.equal(activationCount(), 1);
  menu.update(0.99);
  assert.equal(activationCount(), 1);
  menu.update(0.02);
  assert.equal(activationCount(), 2);
});

test('restart world requires the destructive 1.5 second dwell', () => {
  const { menu, activationCount } = makeHarness(['restart']);
  menu.update(1);
  assert.equal(activationCount(), 0);
  menu.update(0.49);
  assert.equal(activationCount(), 0);
  menu.update(0.02);
  assert.equal(activationCount(), 1);
});
