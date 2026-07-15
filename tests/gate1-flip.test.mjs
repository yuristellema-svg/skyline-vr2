import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, DEG } from '../src/config.js';
import { FlightModel } from '../src/flightModel.js';

const ZERO = {
  pitchRate: 0,
  rollRate: 0,
  viewYaw: 0,
};

const FORWARD =
  new THREE.Vector3(0, 0, -1);

const direction =
  new THREE.Vector3();

function separationFromNose(model) {
  direction
    .copy(model.velocity)
    .normalize();

  return Math.acos(
    THREE.MathUtils.clamp(
      direction.dot(FORWARD),
      -1,
      1,
    ),
  );
}

test(
  'near-opposite flight path converges without a speed discontinuity',
  () => {
    const model =
      new FlightModel();

    const offset =
      0.1 * DEG;

    model.reset(
      0,
      5000,
      0,
      90,
    );

    model.velocity.set(
      Math.sin(offset) * 90,
      0,
      Math.cos(offset) * 90,
    );

    let previousAngle =
      separationFromNose(model);

    let previousSpeed =
      model.speed;

    let maximumSpeedStep = 0;

    for (
      let i = 0;
      i < 2 / CONFIG.physics.fixedStep;
      i += 1
    ) {
      model.step(
        CONFIG.physics.fixedStep,
        ZERO,
      );

      const angle =
        separationFromNose(model);

      const speedStep =
        Math.abs(
          model.speed -
          previousSpeed,
        );

      maximumSpeedStep =
        Math.max(
          maximumSpeedStep,
          speedStep,
        );

      if (previousAngle > 1e-7) {
        assert.ok(
          angle <=
            previousAngle +
            1e-10,
          `separation increased at frame ${i}`,
        );
      }

      previousAngle = angle;
      previousSpeed = model.speed;
    }

    assert.ok(
      previousAngle <
        Math.PI -
        0.65,
      `final separation ${previousAngle}`,
    );

    assert.ok(
      maximumSpeedStep < 0.1,
      `largest speed step ${maximumSpeedStep} m/s`,
    );
  },
);

test(
  'sharp flight-path changes remain finite',
  () => {
    const model =
      new FlightModel();

    model.reset(
      0,
      5000,
      0,
      90,
    );

    model.velocity.set(
      0,
      model.speed,
      0,
    );

    for (let i = 0; i < 120; i += 1) {
      model.step(
        CONFIG.physics.fixedStep,
        ZERO,
      );
    }

    assert.ok(
      Number.isFinite(
        model.position.x +
        model.position.y +
        model.position.z +
        model.speed +
        model.pathAngle,
      ),
    );
  },
);
