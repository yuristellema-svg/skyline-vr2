import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_SPECS,
  canMaterialEmit,
  validateMaterialPolicy,
} from '../../src/worldDetail/materialPolicy.js';
import { MATERIAL_ROLES } from '../../src/worldDetail/constants.js';

test('only actual windows and tiny lamps may emit', () => {
  const allowed = new Set([
    MATERIAL_ROLES.actualWindow,
    MATERIAL_ROLES.signalLamp,
    MATERIAL_ROLES.navigationLamp,
  ]);
  for (const [name, spec] of Object.entries(MATERIAL_SPECS)) {
    const hasEmission = (Number(spec.emissive) || 0) !== 0 || (Number(spec.emissiveIntensity) || 0) > 0;
    if (hasEmission) assert.equal(allowed.has(spec.role), true, name);
    assert.equal(canMaterialEmit(spec), allowed.has(spec.role));
  }
});

test('facades and roofs have black zero-intensity emission', () => {
  for (const [name, spec] of Object.entries(MATERIAL_SPECS)) {
    if ([MATERIAL_ROLES.facade, MATERIAL_ROLES.roof].includes(spec.role)) {
      assert.equal(spec.emissive, 0, name);
      assert.equal(spec.emissiveIntensity, 0, name);
    }
  }
});

test('transparent material policy is strictly bounded', () => {
  const policy = validateMaterialPolicy();
  assert.equal(policy.valid, true);
  assert.equal(policy.transparentMaterials, 2);
  assert.deepEqual(policy.violations, []);
});

test('unsafe full-building emission is rejected', () => {
  const unsafe = {
    ...MATERIAL_SPECS,
    unsafeFacade: {
      role: MATERIAL_ROLES.facade,
      color: 0xffffff,
      emissive: 0xffaa00,
      emissiveIntensity: 1,
    },
  };
  const policy = validateMaterialPolicy(unsafe);
  assert.equal(policy.valid, false);
  assert.ok(policy.violations.some(value => value.includes('whole-building emission')));
});
