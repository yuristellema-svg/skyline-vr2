import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { FlightModel } from '../src/flightModel.js';

test(
  'extreme reversal cannot leave aircraft travelling backward',
  () => {
    const flight =
      new FlightModel();

    flight.reset(
      0,
      760,
      0,
      65,
    );

    flight.attitude.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI,
    );

    flight.step(
      1 / 120,
      {
        pitchRate: 0,
        rollRate: 0,
        viewYaw: 0,
      },
    );

    const nose =
      new THREE.Vector3();

    flight.getForward(nose);

    const direction =
      flight.velocity
        .clone()
        .normalize();

    assert.ok(
      nose.dot(direction) > 0,
      'velocity must remain in the forward hemisphere',
    );
  },
);
