import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeMenu } from '../src/menu.js';

const DEG = Math.PI / 180;

function makeHarness(
  definition = {
    id: 'camera',
    title: 'CAMERA',
    subtitle: '',
    yaw: 0,
    pitch: 0,
    danger: false,
  },
) {
  let activations = 0;

  const panel = {
    userData: {
      definition,
    },
  };

  const menu = Object.create(GazeMenu.prototype);

  menu.input = {
    mode: 'phone',
    menuLook: {
      yaw: 0,
      pitch: 0,
    },
    sampleMenuLook() {},
  };

  menu.actions = {
    camera() {
      activations += 1;
      return 'third';
    },
    effects() {
      activations += 1;
      return 'full';
    },
    resume() {
      activations += 1;
    },
  };

  menu.root = {
    visible: true,
  };

  menu.isOpen = true;
  menu.crashMode = false;
  menu.cameraName = 'FIRST';
  menu.effectsName = 'FULL';
  menu.aircraftName = 'A6M ZERO';

  // Keep this empty so unit tests do not create canvas textures.
  menu.panels = [];

  menu.hoveredPanel = null;
  menu.dwellElapsed = 0;
  menu.dwellProgress = 0;
  menu.activationLockout = 0;
  menu._smoothedYaw = 0;
  menu._smoothedPitch = 0;
  menu._hasSmoothedLook = false;
  menu._requirePhoneExit = false;
  menu._blockedPhoneId = null;

  menu._candidateAt = () => panel;

  return {
    menu,
    panel,
    activations: () => activations,
  };
}

test('phone gaze uses the current 120 ms smoothing', () => {
  const { menu } = makeHarness();

  menu._candidateAt = () => null;
  menu.update(1 / 60);

  menu.input.menuLook.yaw = 12 * DEG;
  menu.update(0.1);

  assert.ok(menu._smoothedYaw > 6 * DEG);
  assert.ok(menu._smoothedYaw < 7.5 * DEG);
});

test('holding gaze activates once and requires exit before rearming', () => {
  const {
    menu,
    panel,
    activations,
  } = makeHarness();

  for (let index = 0; index < 30; index += 1) {
    menu.update(0.1);
  }

  assert.equal(activations(), 1);

  for (let index = 0; index < 30; index += 1) {
    menu.update(0.1);
  }

  assert.equal(activations(), 1);

  menu._candidateAt = () => null;
  menu.update(0.1);

  menu._candidateAt = () => panel;

  for (let index = 0; index < 30; index += 1) {
    menu.update(0.1);
  }

  assert.equal(activations(), 2);
});

test('danger panels require the longer destructive dwell', () => {
  const {
    menu,
    activations,
  } = makeHarness({
    id: 'effects',
    title: 'TEST',
    subtitle: '',
    yaw: 0,
    pitch: 0,
    danger: true,
  });

  for (let index = 0; index < 10; index += 1) {
    menu.update(0.1);
  }

  assert.equal(activations(), 0);

  for (let index = 0; index < 12; index += 1) {
    menu.update(0.1);
  }

  assert.equal(activations(), 1);
});
