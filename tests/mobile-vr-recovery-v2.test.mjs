import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  CONFIG,
} = await import(
  '../src/config.js'
);

test(
  'redout thresholds begin later',
  () => {
    assert.ok(
      CONFIG.effects
        .gVignetteStart >=
        5.2,
    );

    assert.ok(
      CONFIG.effects
        .negativeGTintStart <=
        -2,
    );
  },
);

test(
  'speed streaks follow velocity rather than head view',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/effects.js',
          import.meta.url,
        ),
        'utf8',
      );

    assert.match(
      source,
      /world-velocity-speed-streaks/,
    );

    assert.match(
      source,
      /flight\.velocity/,
    );

    assert.match(
      source,
      /setFromUnitVectors/,
    );

    assert.doesNotMatch(
      source,
      /camera\.add\(this\.streaks\)/,
    );
  },
);

test(
  'RESET HEAD uses delayed calibration',
  () => {
    const main =
      fs.readFileSync(
        new URL(
          '../src/main.js',
          import.meta.url,
        ),
        'utf8',
      );

    const menu =
      fs.readFileSync(
        new URL(
          '../src/menu.js',
          import.meta.url,
        ),
        'utf8',
      );

    assert.match(
      main,
      /beginHeadRecalibration/,
    );

    assert.match(
      main,
      /LOOK STRAIGHT/,
    );

    assert.match(
      main,
      /phase = 'calibrating'/,
    );

    assert.doesNotMatch(
      menu,
      /id === 'recenter'[\s\S]{0,100}input\?\.recenter/,
    );
  },
);

test(
  'iPhone audio creates and resumes before first await',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/windAudio.js',
          import.meta.url,
        ),
        'utf8',
      );

    assert.match(
      source,
      /_discardContextForRetryNow/,
    );

    assert.match(
      source,
      /const resumePromise/,
    );

    assert.doesNotMatch(
      source,
      /await this\s*\n\s*\._discardContextForRetry/,
    );
  },
);

test(
  'stable snapshot exists',
  () => {
    assert.equal(
      fs.existsSync(
        new URL(
          '../stable-mobile-v1/index.html',
          import.meta.url,
        ),
      ),
      true,
    );

    assert.equal(
      fs.existsSync(
        new URL(
          '../stable-mobile-v1/src/main.js',
          import.meta.url,
        ),
      ),
      true,
    );
  },
);
