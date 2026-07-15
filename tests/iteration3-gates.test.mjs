import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, DEG } from '../src/config.js';
import { FlightModel } from '../src/flightModel.js';
import { GazeMenu } from '../src/menu.js';

const DT =
  CONFIG.physics.fixedStep;

function simulate() {
  const model =
    new FlightModel();

  const controls = {
    pitchRate: 0,
    rollRate: 0,
    viewYaw: 0,
  };

  model.reset(
    0,
    12000,
    0,
    90,
  );

  for (let i = 0; i < 7200; i += 1) {
    const time = i * DT;

    controls.pitchRate =
      (
        18 *
        Math.sin(time * 0.43) +
        10 *
        Math.sin(time * 1.17)
      ) *
      DEG;

    controls.rollRate =
      (
        38 *
        Math.sin(time * 0.29) +
        15 *
        Math.sin(time * 0.83)
      ) *
      DEG;

    model.step(
      DT,
      controls,
    );
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

test(
  'one-minute flight remains deterministic and finite',
  () => {
    const first = simulate();
    const second = simulate();

    assert.deepEqual(
      first,
      second,
    );

    assert.equal(
      first.every(Number.isFinite),
      true,
    );
  },
);

test(
  'high speed retains control while adding rotational weight',
  () => {
    const low =
      new FlightModel();

    low.reset(
      0,
      5000,
      0,
      90,
    );

    low.step(
      DT,
      {
        pitchRate:
          CONFIG.controls.pitchMaxRate,
        rollRate: 0,
        viewYaw: 0,
      },
    );

    const high =
      new FlightModel();

    high.reset(
      0,
      5000,
      0,
      900,
    );

    high.step(
      DT,
      {
        pitchRate:
          CONFIG.controls.pitchMaxRate,
        rollRate: 0,
        viewYaw: 0,
      },
    );

    assert.ok(
      high._targetAngularVelocity.x > 0,
    );

    assert.ok(
      high._targetAngularVelocity.x <
        low._targetAngularVelocity.x,
    );

    assert.ok(
      high.angularVelocity.x <
        high._targetAngularVelocity.x,
    );
  },
);

test(
  'menu offers aircraft selection in normal and crash layouts',
  () => {
    const menu =
      Object.create(
        GazeMenu.prototype,
      );

    menu.aircraftName =
      'STUKA';

    menu.cameraName =
      'FIRST';

    menu.effectsName =
      'STANDARD';

    menu.crashMode = false;

    assert.ok(
      menu
        ._definitions()
        .some(
          (item) =>
            item.id ===
            'aircraft',
        ),
    );

    menu.crashMode = true;

    assert.ok(
      menu
        ._definitions()
        .some(
          (item) =>
            item.id ===
            'aircraft',
        ),
    );
  },
);
