import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture } from './helpers/loadAircraftModule.mjs';

async function withFixture(callback) {
  const fixture = createFixture();
  try {
    await callback(fixture);
  } finally {
    fixture.cleanup();
  }
}

test('A6M Zero exterior exposes the integration metadata used by aircraftVisuals.js', async () => {
  await withFixture(async fixture => {
    const module = await fixture.importModule('a6mZeroExternal.js');
    const model = module.createA6MZeroExternal();

    assert.equal(model.userData.engine, 'RADIAL');
    assert.equal(model.userData.visualVersion, 'a6m-zero-procedural-v2');
    assert.ok(model.userData.propeller, 'propeller group is required');
    assert.ok(model.userData.propellerBlur, 'propeller blur is required');
    assert.equal(model.userData.propeller.userData.blurDisk, model.userData.propellerBlur);
    assert.ok(model.userData.bounds.span > 8);
  });
});

test('Ju 87 Stuka exterior exposes the same propeller contract', async () => {
  await withFixture(async fixture => {
    const module = await fixture.importModule('ju87StukaExternal.js');
    const model = module.createJu87StukaExternal();

    assert.equal(model.userData.engine, 'V12');
    assert.equal(model.userData.visualVersion, 'ju87-stuka-procedural-v2');
    assert.ok(model.userData.propeller);
    assert.ok(model.userData.propellerBlur);
    assert.equal(model.userData.propeller.userData.blurDisk, model.userData.propellerBlur);
    assert.ok(model.userData.bounds.span > 9);
  });
});

test('both cockpits expose readable instrument arrays with animated needles', async () => {
  await withFixture(async fixture => {
    const zeroModule = await fixture.importModule('a6mZeroCockpit.js');
    const stukaModule = await fixture.importModule('ju87StukaCockpit.js');
    const zero = zeroModule.createA6MZeroCockpit();
    const stuka = stukaModule.createJu87StukaCockpit();

    assert.ok(zero.userData.instruments.length >= 5);
    assert.ok(stuka.userData.instruments.length >= 6);

    for (const cockpit of [zero, stuka]) {
      for (const gauge of cockpit.userData.instruments) {
        assert.equal(typeof gauge.userData.label, 'string');
        assert.ok(gauge.userData.needle?.rotation);
      }
    }
  });
});

test('cockpit panels stay below the forward sight line', async () => {
  await withFixture(async fixture => {
    const zeroModule = await fixture.importModule('a6mZeroCockpit.js');
    const stukaModule = await fixture.importModule('ju87StukaCockpit.js');

    assert.ok(zeroModule.A6M_ZERO_COCKPIT_BOUNDS.panelTopY < 0);
    assert.ok(stukaModule.JU87_STUKA_COCKPIT_BOUNDS.panelTopY < 0);
    assert.ok(zeroModule.A6M_ZERO_COCKPIT_BOUNDS.highestFrameY < 1.1);
    assert.ok(stukaModule.JU87_STUKA_COCKPIT_BOUNDS.highestFrameY < 1.1);
  });
});
