import assert from 'node:assert/strict';
import test from 'node:test';

import { createBiplaneExternal } from '../src/aircraft/biplaneExternal.js';
import { createBiplaneCockpit } from '../src/aircraft/biplaneCockpit.js';
import {
  applyBiplaneControlState,
  applyBiplaneInstrumentState,
  computeBiplanePropellerRate,
  resetBiplanePresentation,
  setBiplaneQuality,
} from '../src/aircraft/biplaneRuntime.js';

function rootPose(root) {
  return [
    root.position.x,
    root.position.y,
    root.position.z,
    root.rotation.x,
    root.rotation.y,
    root.rotation.z,
  ];
}

test('control updater moves only named presentation controls, not shared root pose', () => {
  const external = createBiplaneExternal();
  const cockpit = createBiplaneCockpit();
  const beforeExternal = rootPose(external);
  const beforeCockpit = rootPose(cockpit);

  const resolved = applyBiplaneControlState(external, cockpit, {
    pitch: 0.7,
    roll: -0.8,
    yaw: 0.5,
    throttle: 0.9,
    mixture: 0.8,
  });

  assert.deepEqual(rootPose(external), beforeExternal);
  assert.deepEqual(rootPose(cockpit), beforeCockpit);
  assert.equal(resolved.pitch, 0.7);
  assert.notEqual(external.userData.controlSurfaces.elevator.rotation.x, 0);
  assert.notEqual(external.userData.controlSurfaces.leftAileron.rotation.x, 0);
  assert.notEqual(cockpit.userData.controls.controlStick.rotation.x, 0);
});

test('control updater clamps hostile or non-finite input safely', () => {
  const external = createBiplaneExternal();
  const cockpit = createBiplaneCockpit();
  const resolved = applyBiplaneControlState(external, cockpit, {
    pitch: Infinity,
    roll: -9,
    yaw: 12,
    throttle: NaN,
    mixture: 3,
  });
  assert.deepEqual(resolved, {
    pitch: 0,
    roll: -1,
    yaw: 1,
    throttle: 0,
    mixture: 1,
  });
});

test('instrument updater drives all seven gauges without changing cockpit pose', () => {
  const cockpit = createBiplaneCockpit();
  const before = rootPose(cockpit);
  const result = applyBiplaneInstrumentState(cockpit, {
    speed: 47,
    altitude: 1250,
    rpm: 2050,
    oilPressure: 0.8,
    verticalSpeed: 3,
    cylinderTemperature: 0.72,
    fuel: 0.45,
    slip: -0.6,
    heading: 1.2,
  });
  assert.deepEqual(rootPose(cockpit), before);
  assert.equal(result.speed, 47);
  for (const instrument of cockpit.userData.instruments) {
    assert.ok(Number.isFinite(instrument.userData.needle.rotation.z));
  }
});

test('quality policy hides fine detail while retaining core airframe', () => {
  const external = createBiplaneExternal({ detailLevel: 2 });
  const cockpit = createBiplaneCockpit({ detailLevel: 2 });
  const fineExternal = [];
  external.traverse(object => {
    if (object.userData?.detailLevel === 2) fineExternal.push(object);
  });
  assert.ok(fineExternal.length > 10);
  setBiplaneQuality(external, cockpit, 0);
  assert.ok(fineExternal.every(object => object.visible === false));
  assert.equal(external.visible, true);
  assert.equal(cockpit.visible, true);
  setBiplaneQuality(external, cockpit, 2);
  assert.ok(fineExternal.every(object => object.visible === true));
});

test('propeller-rate helper is deterministic and does not own animation state', () => {
  const idle = computeBiplanePropellerRate({ speed: 0, throttle: 0, engineOn: true });
  const full = computeBiplanePropellerRate({ speed: 50, throttle: 1, engineOn: true });
  const windmill = computeBiplanePropellerRate({ speed: 50, throttle: 1, engineOn: false });
  assert.ok(idle > 0);
  assert.ok(full > idle);
  assert.ok(windmill < full);
  assert.equal(
    computeBiplanePropellerRate({ speed: 50, throttle: 1, engineOn: true }),
    full,
  );
});

test('presentation reset returns controls to neutral', () => {
  const external = createBiplaneExternal();
  const cockpit = createBiplaneCockpit();
  applyBiplaneControlState(external, cockpit, { pitch: 1, roll: 1, yaw: 1 });
  resetBiplanePresentation(external, cockpit);
  assert.ok(Math.abs(external.userData.controlSurfaces.elevator.rotation.x) === 0);
  assert.ok(Math.abs(external.userData.controlSurfaces.leftAileron.rotation.x) === 0);
  assert.ok(Math.abs(external.userData.controlSurfaces.rudder.rotation.y) === 0);
});
