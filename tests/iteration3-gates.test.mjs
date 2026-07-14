import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, DEG } from '../src/config.js';
import { FlightModel } from '../src/flightModel.js';
import { InputController } from '../src/input.js';
import { GazeMenu } from '../src/menu.js';

const DT = CONFIG.physics.fixedStep;
const ZERO = { pitchRate: 0, rollRate: 0 };

function runEnduranceFlight() {
  const model = new FlightModel();
  const controls = { pitchRate: 0, rollRate: 0 };
  model.reset(0, 12000, 0, 90);
  model.clearTelemetry();

  let maximumSpeedStep = 0;
  let maximumQuaternionError = 0;
  let allFinite = true;
  let previousSpeed = model.speed;

  for (let i = 0; i < 72000; i += 1) {
    const time = i * DT;
    controls.pitchRate = (20 * Math.sin(time * 0.43) + 12 * Math.sin(time * 1.17)) * DEG;
    controls.rollRate = (45 * Math.sin(time * 0.29) + 18 * Math.sin(time * 0.83)) * DEG;
    model.step(DT, controls);

    maximumSpeedStep = Math.max(maximumSpeedStep, Math.abs(model.speed - previousSpeed));
    previousSpeed = model.speed;
    const qLength = Math.hypot(
      model.attitude.x,
      model.attitude.y,
      model.attitude.z,
      model.attitude.w
    );
    maximumQuaternionError = Math.max(maximumQuaternionError, Math.abs(qLength - 1));
    allFinite &&= Number.isFinite(
      model.position.x + model.position.y + model.position.z +
      model.velocity.x + model.velocity.y + model.velocity.z +
      model.speed + model.pathAngle + model.angleOfAttack +
      model.liftCoefficient + model.stallAmount + qLength
    );
  }

  return {
    model,
    maximumSpeedStep,
    maximumQuaternionError,
    allFinite,
    finalState: [
      model.position.x,
      model.position.y,
      model.position.z,
      model.velocity.x,
      model.velocity.y,
      model.velocity.z,
      model.attitude.x,
      model.attitude.y,
      model.attitude.z,
      model.attitude.w,
      model.speed,
      model.boostCharge,
      model.boostRemaining,
    ],
  };
}

function makeMenuHarness() {
  const activations = [];
  const input = {
    menuLook: { yaw: 0, pitch: 0 },
    sensitivityName: 'STANDARD',
    sampleMenuLook() {},
    beginMenuLook() {},
    recenter() {},
    cycleSensitivity() {},
  };
  const menu = Object.create(GazeMenu.prototype);
  menu.config = CONFIG;
  menu.input = input;
  menu.callbacks = {
    camera() { activations.push('camera'); return 'first'; },
    resume() { activations.push('resume'); },
  };
  menu.panels = [
    { action: 'camera', yaw: 0, pitch: 0 },
    { action: 'resume', yaw: 20 * DEG, pitch: 0 },
  ];
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
  menu._panelArmed = new Uint8Array(2);
  menu._panelArmed.fill(1);
  menu.cameraName = 'FIRST';
  menu.effectsName = 'FULL';
  menu._drawPanel = () => {};
  return { menu, input, activations };
}

test('Gate 1 endurance: deterministic ten-minute flight stays continuous and normalized', () => {
  const first = runEnduranceFlight();
  const second = runEnduranceFlight();

  assert.ok(Math.abs(first.model.elapsed - 600) < 1e-9);
  assert.equal(first.allFinite, true);
  assert.equal(first.model.telemetryGlitchDetected, false);
  assert.ok(first.maximumSpeedStep < 3, `largest speed step ${first.maximumSpeedStep} m/s`);
  assert.ok(
    first.maximumQuaternionError < 1e-12,
    `largest quaternion normalization error ${first.maximumQuaternionError}`
  );
  assert.deepEqual(first.finalState, second.finalState, 'same controls must reproduce the exact state');
  assert.equal(second.model.telemetryGlitchDetected, false);
});

test('Gate 3 boost stays armed for six seconds, then drains smoothly over two seconds', () => {
  const model = new FlightModel();
  model.reset(0, 5000, 0, 50);
  model.boostCharge = 1;
  model.boostArmedRemaining = CONFIG.physics.boost3.armedSeconds;

  let armedSteps = 0;
  while (model.boostArmedRemaining > 0 && armedSteps < 1000) {
    model.step(DT, ZERO);
    armedSteps += 1;
  }

  assert.ok(
    Math.abs(armedSteps * DT - CONFIG.physics.boost3.armedSeconds) <= DT,
    `armed lifetime ${armedSteps * DT}s`
  );
  assert.equal(model.boostCharge, 1);
  assert.equal(model.boostDrainRemaining, CONFIG.physics.boost3.drainSeconds);
  assert.equal(model.boostRemaining, 0);

  // Expiry must force the full drain even if the player remains in a valid
  // charging dive; otherwise holding the dive re-arms on the next frame.
  model.speed = 110;
  model.velocity.set(0, -110, 0);

  let drainSteps = 0;
  let previousCharge = model.boostCharge;
  let sawChargeCondition = false;
  while (model.boostCharge > 0 && drainSteps < 500) {
    model.step(DT, ZERO);
    sawChargeCondition ||= model.boostChargeCondition;
    assert.ok(model.boostCharge <= previousCharge, 'expired charge must never rise while draining');
    previousCharge = model.boostCharge;
    drainSteps += 1;
  }

  assert.ok(
    Math.abs(drainSteps * DT - CONFIG.physics.boost3.drainSeconds) <= DT,
    `drain lifetime ${drainSteps * DT}s`
  );
  assert.equal(model.boostCharge, 0);
  assert.equal(model.boostDrainRemaining, 0);
  assert.equal(model.boostJustTriggered, false);
  assert.equal(sawChargeCondition, true, 'test must exercise expiry while a fast dive remains valid');
});

test('Gate 2 controls apply a 60 ms slew and the locked 15% high-speed reduction', () => {
  const input = Object.create(InputController.prototype);
  input.config = CONFIG;
  input.mode = 'desktop';
  input.sensitivityIndex = CONFIG.sensitivity.defaultIndex;
  input.controls = { pitchRate: 0, rollRate: 0 };
  input._targetPitchRate = 0;
  input._targetRollRate = 0;
  input.desktopMouseArmed = false;
  input.mouseX = 0;
  input.mouseY = 0;
  input.keyPitch = 1;
  input.keyRoll = 0;

  input.sampleFlightControls(0.06);
  const oneTau = CONFIG.controls.pitchMaxRate * (1 - Math.exp(-1));
  assert.ok(Math.abs(input.controls.pitchRate - oneTau) < 1e-12);
  input.sampleFlightControls(0.06);
  const twoTau = CONFIG.controls.pitchMaxRate * (1 - Math.exp(-2));
  assert.ok(Math.abs(input.controls.pitchRate - twoTau) < 1e-12);
  input.keyPitch = 0;
  input.sampleFlightControls(0.06);
  assert.ok(Math.abs(input.controls.pitchRate - twoTau * Math.exp(-1)) < 1e-12);

  const lowSpeed = new FlightModel();
  lowSpeed.reset(0, 5000, 0, 99);
  lowSpeed.step(DT, { pitchRate: CONFIG.controls.pitchMaxRate, rollRate: 0 });
  const highSpeed = new FlightModel();
  highSpeed.reset(0, 5000, 0, 130);
  highSpeed.step(DT, { pitchRate: CONFIG.controls.pitchMaxRate, rollRate: 0 });
  assert.ok(Math.abs(lowSpeed._targetAngularVelocity.x / CONFIG.controls.pitchMaxRate - 1) < 1e-12);
  assert.ok(
    Math.abs(
      highSpeed._targetAngularVelocity.x / CONFIG.controls.pitchMaxRate -
      CONFIG.controls.highSpeedControlScale
    ) < 1e-12
  );
});

test('Gate 4 noisy gaze requires a deliberate dwell and cannot retrigger while held', () => {
  const { menu, input, activations } = makeMenuHarness();
  const frame = 1 / 60;

  for (let i = 0; i < 75; i += 1) {
    input.menuLook.yaw = (i % 2 === 0 ? 4.6 : -4.6) * DEG;
    input.menuLook.pitch = (i % 3 - 1) * 3.8 * DEG;
    menu.update(frame);
  }
  assert.deepEqual(activations, ['camera']);

  for (let i = 0; i < 90; i += 1) {
    input.menuLook.yaw = 0;
    input.menuLook.pitch = 0;
    menu.update(frame);
  }
  assert.deepEqual(activations, ['camera'], 'holding must not reactivate a latched panel');

  for (let i = 0; i < 36; i += 1) {
    input.menuLook.yaw = (10 + 10 * i / 35) * DEG;
    menu.update(frame);
  }
  input.menuLook.yaw = 20 * DEG;
  for (let i = 0; i < 30; i += 1) menu.update(frame);
  assert.deepEqual(activations, ['camera'], 'a brief sweep onto another panel must not select it');

  for (let i = 0; i < 40; i += 1) menu.update(frame);
  assert.deepEqual(activations, ['camera', 'resume']);
});
