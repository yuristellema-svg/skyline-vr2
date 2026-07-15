import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, DEG, rateFromDeflection } from '../src/config.js';
import { screenTilt } from '../src/input.js';
import { FlightModel } from '../src/flightModel.js';

const ZERO = { pitchRate: 0, rollRate: 0, viewYaw: 0 };

function stepFor(model, seconds, controls = ZERO) {
  const count = Math.round(seconds / CONFIG.physics.fixedStep);
  for (let i = 0; i < count; i += 1) {
    model.step(CONFIG.physics.fixedStep, controls);
  }
}

test('configured control curve reaches its own full rates', () => {
  const c = CONFIG.controls;
  assert.equal(
    rateFromDeflection(
      0,
      c.pitchDeadzone,
      c.pitchFullDeflection,
      c.pitchMaxRate,
      c.responseExponent,
    ),
    0,
  );
  assert.ok(
    Math.abs(
      rateFromDeflection(
        c.pitchFullDeflection,
        c.pitchDeadzone,
        c.pitchFullDeflection,
        c.pitchMaxRate,
        c.responseExponent,
      ) - c.pitchMaxRate,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(
      rateFromDeflection(
        -c.rollFullDeflection,
        c.rollDeadzone,
        c.rollFullDeflection,
        c.rollMaxRate,
        c.responseExponent,
      ) + c.rollMaxRate,
    ) < 1e-12,
  );
});

test('screen-corrected gravity tilt keeps a canonical neutral pose', () => {
  const out = { pitch: 0, roll: 0 };
  screenTilt(90, 0, 0, out);
  assert.ok(Math.abs(out.pitch) < 1e-9);
  assert.ok(Math.abs(out.roll) < 1e-9);
});

test('repeated pitch and roll flight remains finite and normalized', () => {
  const model = new FlightModel();
  model.reset(0, 8000, 0, 90);

  for (let i = 0; i < 3600; i += 1) {
    const t = i * CONFIG.physics.fixedStep;
    model.step(CONFIG.physics.fixedStep, {
      pitchRate: Math.sin(t * 0.7) * 42 * DEG,
      rollRate: Math.sin(t * 0.43) * 55 * DEG,
      viewYaw: 0,
    });

    assert.ok(
      Number.isFinite(
        model.position.x +
        model.position.y +
        model.position.z +
        model.speed +
        model.pathAngle +
        model.angleOfAttack,
      ),
    );
    assert.ok(Math.abs(model.attitude.length() - 1) < 1e-9);
  }
});

test('a sustained dive converts height into substantial extra speed', () => {
  const model = new FlightModel();
  model.reset(0, 20000, 0, 58);
  model.attitude.setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI * 0.5,
  );
  model.velocity.set(0, -58, 0);

  stepFor(model, 8);

  assert.ok(model.speed > 100, `dive speed ${model.speed}`);
  assert.ok(model.speed < CONFIG.physics.maximumSpeed);
});

test('high-energy flight keeps deliberate extreme-speed headroom', () => {
  assert.ok(CONFIG.physics.maximumSpeed >= 1000);
  assert.equal(CONFIG.physics.energy.maximumOverspeedDrag, 0);
});

test('discarded automatic capture and boost systems stay absent', () => {
  const model = new FlightModel();

  assert.equal('telemetryGlitchDetected' in model, false);
  assert.equal(typeof model.readTelemetrySnapshot, 'undefined');
  assert.equal(model.boosting, false);

  model.reset(0, 5000, 0, 120);
  model.velocity.set(0, -120, 0);
  stepFor(model, 4);

  assert.equal(model.boostCharge, 0);
  assert.equal(model.boostRemaining, 0);
});

test('turn braking remains finite and capped during hard manoeuvres', () => {
  const model = new FlightModel();
  model.reset(0, 8000, 0, 180);

  stepFor(model, 3, {
    pitchRate: 35 * DEG,
    rollRate: 65 * DEG,
    viewYaw: 0,
  });

  assert.ok(Number.isFinite(model.maneuverDragAcceleration));
  assert.ok(model.turnDragAcceleration <= 10 + 1e-9);
  assert.ok(model.misalignmentDragAcceleration <= 8 + 1e-9);
  assert.ok(model.speed > 0);
});

test('fixed-step flight is deterministic', () => {
  function simulate() {
    const model = new FlightModel();
    model.reset(0, 5000, 0, 90);

    for (let i = 0; i < 2400; i += 1) {
      const t = i * CONFIG.physics.fixedStep;
      model.step(CONFIG.physics.fixedStep, {
        pitchRate: Math.sin(t) * 22 * DEG,
        rollRate: Math.cos(t * 0.6) * 31 * DEG,
        viewYaw: 0,
      });
    }

    return [
      model.position.x,
      model.position.y,
      model.position.z,
      model.velocity.x,
      model.velocity.y,
      model.velocity.z,
      model.attitude.x,
      model.attitude.y,
      model.attitude.z,
      model.attitude.w,
      model.speed,
    ];
  }

  assert.deepEqual(simulate(), simulate());
});
