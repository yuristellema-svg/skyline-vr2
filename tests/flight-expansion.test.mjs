import test from 'node:test';
import assert from 'node:assert/strict';

class EventTargetStub {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter(item => item !== listener),
    );
  }
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
    return true;
  }
}

globalThis.window = new EventTargetStub();
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.localStorage = { getItem: () => 'zero' };

const { AIRCRAFT_FLIGHT_PROFILES } =
  await import('../src/aircraftFlightProfiles.js');
const { PowerControlSystem } =
  await import('../src/expansion/powerControl.js');
const { evaluateTouchdown } =
  await import('../src/expansion/landingSystem.js');

test('aircraft identities are clearly separated', () => {
  const { zero, stuka, scout, glider } = AIRCRAFT_FLIGHT_PROFILES;
  assert.ok(scout.rollRateScale > zero.rollRateScale);
  assert.ok(zero.rollRateScale > glider.rollRateScale);
  assert.ok(glider.rollRateScale > stuka.rollRateScale);
  assert.ok(scout.angularResponseScale > stuka.angularResponseScale * 1.6);
  assert.ok(stuka.dragScale > zero.dragScale);
});

test('glider cannot create mechanical energy', () => {
  const glider = AIRCRAFT_FLIGHT_PROFILES.glider;
  assert.equal(glider.enginePower, 0);
  assert.equal(glider.energyBias, 0);
  assert.equal(glider.gravityScaleDive, 1);
  assert.equal(glider.gravityScaleClimb, 1);
  assert.ok(glider.dragScale >= 0.7);
  assert.ok(glider.minimumEnergyLoss > 0);
});

test('power uses OFF LOW MIDDLE HIGH', () => {
  const control = new PowerControlSystem('zero');
  assert.deepEqual(
    control.options.map(item => item.label),
    ['OFF', 'LOW', 'MIDDLE', 'HIGH'],
  );
  control.setIndex(3);
  assert.equal(control.state.throttle, 1);
  control.setIndex(0);
  assert.equal(control.state.engineOn, false);
  control.dispose();
});

test('glider uses spoilers', () => {
  const control = new PowerControlSystem('glider');
  assert.deepEqual(
    control.options.map(item => item.label),
    ['CLOSED', 'HALF', 'FULL'],
  );
  control.setIndex(2);
  assert.equal(control.state.airbrake, 1);
  assert.equal(control.state.throttle, 0);
  control.dispose();
});

test('landing accepts controlled touchdown and rejects hard contact', () => {
  const profile = AIRCRAFT_FLIGHT_PROFILES.scout;
  assert.equal(evaluateTouchdown({
    profile,
    speed: 27,
    sinkRate: 2.2,
    bankDegrees: 6,
    headingErrorDegrees: 10,
    throttle: 0.34,
    inside: true,
  }).valid, true);

  assert.equal(evaluateTouchdown({
    profile,
    speed: 52,
    sinkRate: 8,
    bankDegrees: 28,
    headingErrorDegrees: 50,
    throttle: 1,
    inside: true,
  }).quality, 'hard');
});
