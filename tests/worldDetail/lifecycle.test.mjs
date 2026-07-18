import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldDetailSystemCore } from '../../src/worldDetail/worldDetailSystem.js';
import { WORLD_DETAIL_ROOT_NAME } from '../../src/worldDetail/constants.js';

function scene() {
  return {
    children: [],
    add(object) {
      if (!this.children.includes(object)) this.children.push(object);
    },
    remove(object) {
      const index = this.children.indexOf(object);
      if (index >= 0) this.children.splice(index, 1);
    },
  };
}

function adapterFactory(counter = {}) {
  return ({ scene: target, rootName }) => {
    counter.created = (counter.created || 0) + 1;
    const root = { name: rootName };
    target.add(root);
    let phone = false;
    let quality = 'medium';
    let disposed = false;
    const collisions = [{ id: 'one' }];
    return {
      setPhoneMode(value) { phone = Boolean(value); },
      setQuality(value) { quality = value; },
      fixedStepUpdate() { counter.fixed = (counter.fixed || 0) + 1; },
      update() { counter.updated = (counter.updated || 0) + 1; },
      getCollisionDescriptors() { return collisions; },
      getStatus() {
        return { active: !disposed, phoneMode: phone, quality };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        counter.disposed = (counter.disposed || 0) + 1;
        target.remove(root);
      },
    };
  };
}

test('factory forwards full lifecycle and status', () => {
  const target = scene();
  const counter = {};
  const system = createWorldDetailSystemCore(
    { scene: target, quality: 'high' },
    adapterFactory(counter),
  );
  system.setPhoneMode(true);
  system.setQuality('low');
  system.fixedStepUpdate(1 / 90, {}, 'flying');
  system.update(1 / 60, {}, {}, 'flying');
  assert.equal(counter.created, 1);
  assert.equal(counter.fixed, 1);
  assert.equal(counter.updated, 1);
  assert.equal(system.getStatus().active, true);
  assert.equal(system.getStatus().phoneMode, true);
  assert.equal(system.getStatus().quality, 'low');
  assert.equal(system.getCollisionDescriptors().length, 1);
});

test('duplicate direct roots prevent construction', () => {
  const target = scene();
  target.add({ name: WORLD_DETAIL_ROOT_NAME });
  const counter = {};
  const system = createWorldDetailSystemCore({ scene: target }, adapterFactory(counter));
  assert.equal(system.getStatus().duplicate, true);
  assert.equal(system.getStatus().active, false);
  assert.equal(counter.created, undefined);
  assert.equal(target.children.length, 1);
});

test('disposal is idempotent and removes owned root', () => {
  const target = scene();
  const counter = {};
  const system = createWorldDetailSystemCore({ scene: target }, adapterFactory(counter));
  assert.equal(target.children.length, 1);
  system.dispose();
  system.dispose();
  assert.equal(counter.disposed, 1);
  assert.equal(target.children.length, 0);
  assert.equal(system.getStatus().disposed, true);
});

test('invalid scene returns a safe disabled object', () => {
  const system = createWorldDetailSystemCore({}, adapterFactory());
  assert.equal(system.getStatus().disabled, true);
  assert.match(system.getStatus().error, /valid scene/);
  assert.doesNotThrow(() => system.update(1 / 60, {}, {}, 'flying'));
  assert.deepEqual(system.getCollisionDescriptors(), []);
});
