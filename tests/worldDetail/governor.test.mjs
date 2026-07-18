import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveDetailGovernor } from '../../src/worldDetail/runtimeMetrics.js';

test('phone mode forces low and releases back to requested quality', () => {
  const governor = new AdaptiveDetailGovernor({ requested: 'high', phone: false });
  assert.equal(governor.effective, 'high');
  governor.setPhoneMode(true);
  assert.equal(governor.effective, 'low');
  governor.setPhoneMode(false);
  assert.equal(governor.effective, 'high');
});

test('auto governor degrades only after sustained low frame rate', () => {
  const governor = new AdaptiveDetailGovernor({ requested: 'auto' });
  assert.equal(governor.effective, 'medium');
  for (let index = 0; index < 150; index += 1) governor.update(1 / 30);
  assert.equal(governor.effective, 'medium');
  for (let index = 0; index < 180; index += 1) governor.update(1 / 30);
  assert.equal(governor.effective, 'low');
  assert.equal(governor.status().hysteresis, true);
});

test('fixed quality does not auto-change', () => {
  const governor = new AdaptiveDetailGovernor({ requested: 'high' });
  for (let index = 0; index < 1000; index += 1) governor.update(1 / 24);
  assert.equal(governor.effective, 'high');
});
