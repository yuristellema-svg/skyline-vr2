import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AircraftAudioEngine,
  AUDIO_OWNER_KEY,
} from '../src/audio/proceduralAircraftAudio.js';

class FakeEvents {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  emit(type, detail = {}) {
    this.listeners.get(type)?.({ detail });
  }
}

test('AudioContext is never created before an explicit user-interaction unlock', () => {
  let factoryCalls = 0;
  const engine = new AircraftAudioEngine({
    eventTarget: new FakeEvents(),
    ownerStore: {},
    contextFactory: () => {
      factoryCalls += 1;
      throw new Error('blocked');
    },
  });

  assert.equal(factoryCalls, 0);
  assert.equal(engine.ready, false);
  engine.dispose();
});

test('unlock failure is contained and later update/dispose calls never throw', () => {
  const engine = new AircraftAudioEngine({
    eventTarget: new FakeEvents(),
    ownerStore: {},
    contextFactory: () => {
      throw new Error('blocked by browser');
    },
  });

  assert.equal(engine.unlock(), false);
  assert.equal(engine.disabled, true);
  assert.doesNotThrow(() => engine.update(1 / 60, { speed: 80 }, null, 'flying', []));
  assert.doesNotThrow(() => engine.playBoost(4));
  assert.doesNotThrow(() => engine.dispose());
});

test('an existing audio owner blocks a duplicate engine before context creation', () => {
  let factoryCalls = 0;
  const ownerStore = {
    [AUDIO_OWNER_KEY]: { disposed: false },
  };
  const engine = new AircraftAudioEngine({
    eventTarget: new FakeEvents(),
    ownerStore,
    contextFactory: () => {
      factoryCalls += 1;
      return {};
    },
  });

  assert.equal(engine.unlock(), false);
  assert.equal(engine.duplicateBlocked, true);
  assert.equal(factoryCalls, 0);
  engine.dispose();
});

test('switching away from Stuka immediately clears siren state', () => {
  const events = new FakeEvents();
  const engine = new AircraftAudioEngine({
    eventTarget: events,
    ownerStore: {},
    contextFactory: () => null,
  });

  events.emit('skyline:aircraft-changed', { id: 'stuka' });
  engine.sirenMix = 0.9;
  events.emit('skyline:aircraft-changed', { id: 'zero' });
  assert.equal(engine.profile.id, 'zero');
  assert.equal(engine.sirenMix, 0);
  engine.dispose();
});
