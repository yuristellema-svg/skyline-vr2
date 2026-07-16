import test from 'node:test';
import assert from 'node:assert/strict';
import { WindAudioSystem } from '../src/windAudio.js';

class Param {
  constructor(value = 0) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class Node {
  constructor() {
    this.gain = new Param(0);
    this.frequency = new Param(0);
    this.Q = new Param(0);
    this.threshold = new Param(0);
    this.knee = new Param(0);
    this.ratio = new Param(0);
    this.attack = new Param(0);
    this.release = new Param(0);
    this.positionX = new Param(0);
    this.positionY = new Param(0);
    this.positionZ = new Param(0);
    this.forwardX = new Param(0);
    this.forwardY = new Param(0);
    this.forwardZ = new Param(-1);
    this.upX = new Param(0);
    this.upY = new Param(1);
    this.upZ = new Param(0);
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
  setPeriodicWave() {}
  setPosition() {}
}

class FakeContext {
  constructor() {
    this.sampleRate = 24000;
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = new Node();
    this.listener = new Node();
  }
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createOscillator() { return new Node(); }
  createBufferSource() { return new Node(); }
  createPanner() { return new Node(); }
  createPeriodicWave() { return {}; }
  createBuffer(_channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

class FakeEvents {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, detail = {}) {
    for (const handler of this.listeners.get(type) || []) handler({ detail });
  }
}

test('audio context is created only after user interaction', () => {
  const events = new FakeEvents();
  let created = 0;
  const audio = new WindAudioSystem({
    eventTarget: events,
    contextFactory: () => { created += 1; return new FakeContext(); },
  });
  assert.equal(created, 0);
  assert.equal(audio.ready, false);
  events.dispatch('pointerdown');
  assert.equal(created, 1);
  assert.equal(audio.ready, true);
  assert.doesNotThrow(() => audio.update(
    1 / 60,
    {
      position: { x: 0, y: 100, z: 0 },
      velocity: { x: 0, y: 0, z: -80 },
      speed: 80,
      loadFactor: 1,
    },
    null,
    'flying',
    [],
  ));
  assert.doesNotThrow(() => audio.dispose());
});

test('audio failure never escapes into rendering or physics', () => {
  const events = new FakeEvents();
  const audio = new WindAudioSystem({
    eventTarget: events,
    contextFactory: () => { throw new Error('blocked'); },
  });
  assert.doesNotThrow(() => events.dispatch('keydown'));
  assert.equal(audio.disabled, true);
  assert.doesNotThrow(() => audio.update(1 / 60, {}, null, 'flying', []));
  assert.doesNotThrow(() => audio.dispose());
});

test('duplicate audio engine is prevented', () => {
  const events = new FakeEvents();
  const first = new WindAudioSystem({ eventTarget: events, contextFactory: () => new FakeContext() });
  const second = new WindAudioSystem({ eventTarget: events, contextFactory: () => new FakeContext() });
  assert.equal(second.disabled, true);
  assert.equal(second.duplicate, true);
  first.dispose();
  second.dispose();
});
