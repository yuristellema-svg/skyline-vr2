import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightWarningController } from '../src/audio/flightWarningLogic.js';

const terrain = () => 0;
const danger = {
  position: { x: 0, y: 44, z: 0 },
  velocity: { x: 0, y: -25, z: -95 },
  speed: 100,
  stallAmount: 0,
  loadFactor: 1,
};

function simulate(fps, seconds = 5) {
  const controller = new FlightWarningController();
  const events = [];
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-10; elapsed += dt) {
    events.push(...controller.update(dt, 'zero', danger, terrain, 'flying'));
  }
  return events.map(event => ({ id: event.id, time: Number(event.time.toFixed(6)) }));
}

test('warning activation is deterministic at 30, 60, 90 and 120 display FPS', () => {
  const reference = simulate(120);
  assert.ok(reference.length >= 2);
  for (const fps of [30, 60, 90]) {
    assert.deepEqual(simulate(fps), reference);
  }
});
