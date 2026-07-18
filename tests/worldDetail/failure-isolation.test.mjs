import test from 'node:test';
import assert from 'node:assert/strict';
import { SafeSubsystemRegistry } from '../../src/worldDetail/safeRegistry.js';
import { createWorldDetailSystemCore } from '../../src/worldDetail/worldDetailSystem.js';

const logger = { warn() {} };

test('one subsystem update failure does not stop another subsystem', () => {
  const registry = new SafeSubsystemRegistry(logger);
  let healthyUpdates = 0;
  let failedDisposals = 0;
  registry.register('broken', () => ({
    update() { throw new Error('broken update'); },
    dispose() { failedDisposals += 1; },
  }));
  registry.register('healthy', () => ({
    update() { healthyUpdates += 1; },
    getStatus() { return { healthyUpdates }; },
  }));
  registry.invoke('update', 1 / 60);
  registry.invoke('update', 1 / 60);
  assert.equal(failedDisposals, 1);
  assert.equal(healthyUpdates, 2);
  assert.equal(registry.status().broken.disabled, true);
  assert.equal(registry.status().healthy.active, true);
});

test('construction failure disables only that registry slot', () => {
  const registry = new SafeSubsystemRegistry(logger);
  registry.register('broken', () => { throw new Error('construction exploded'); });
  registry.register('healthy', () => ({ getStatus: () => ({ ready: true }) }));
  assert.equal(registry.status().broken.disabled, true);
  assert.equal(registry.status().healthy.ready, true);
});

test('adapter construction failure leaves startup-safe no-op system', () => {
  const scene = { children: [], add() {}, remove() {} };
  const system = createWorldDetailSystemCore(
    { scene, logger },
    () => { throw new Error('adapter exploded'); },
  );
  assert.equal(system.getStatus().disabled, true);
  assert.match(system.getStatus().error, /adapter exploded/);
  assert.doesNotThrow(() => system.fixedStepUpdate(1 / 90, {}, 'flying'));
  assert.doesNotThrow(() => system.update(1 / 60, {}, {}, 'flying'));
});

test('unexpected top-level runtime failure disposes adapter safely', () => {
  const scene = { children: [], add() {}, remove() {} };
  let disposed = 0;
  const system = createWorldDetailSystemCore({ scene, logger }, () => ({
    update() { throw new Error('top-level runtime failure'); },
    dispose() { disposed += 1; },
    getStatus() { return { active: true }; },
  }));
  system.update(1 / 60, {}, {}, 'flying');
  assert.equal(disposed, 1);
  assert.equal(system.getStatus().disabled, true);
  assert.match(system.getStatus().error, /top-level runtime failure/);
});
