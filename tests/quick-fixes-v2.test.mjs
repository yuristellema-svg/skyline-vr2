import test from 'node:test';
import assert from 'node:assert/strict';

const {
  stukaSirenDemand,
} = await import(
  '../src/audio/stukaDiveSiren.js'
);

const {
  distanceToRunway,
} = await import(
  '../src/expansion/runwayGuidance.js'
);

test(
  'Stuka siren is silent during level flight',
  () => {
    assert.equal(
      stukaSirenDemand(
        'stuka',
        {
          speed: 84,
          pathAngle: 0,
        },
        'flying',
      ),
      0,
    );
  },
);

test(
  'Stuka siren activates in a fast steep dive',
  () => {
    const demand =
      stukaSirenDemand(
        'stuka',
        {
          speed: 84,
          pathAngle: -0.65,
        },
        'flying',
      );

    assert.ok(
      demand > 0.9,
    );
  },
);

test(
  'Stuka siren does not activate for the Zero',
  () => {
    assert.equal(
      stukaSirenDemand(
        'zero',
        {
          speed: 90,
          pathAngle: -0.8,
        },
        'flying',
      ),
      0,
    );
  },
);

test(
  'runway distance is zero above the runway',
  () => {
    const zone = {
      x: 0,
      z: 0,
      heading: 0,
      length: 900,
      width: 76,
    };

    assert.equal(
      distanceToRunway(
        zone,
        {
          x: 0,
          z: 0,
        },
      ),
      0,
    );
  },
);

test(
  'runway distance measures beyond the runway end',
  () => {
    const zone = {
      x: 0,
      z: 0,
      heading: 0,
      length: 900,
      width: 76,
    };

    const distance =
      distanceToRunway(
        zone,
        {
          x: 0,
          z: -650,
        },
      );

    assert.ok(
      distance > 190 &&
      distance < 210,
    );
  },
);
