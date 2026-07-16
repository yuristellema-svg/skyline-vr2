import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/menuRuntime.js', import.meta.url), 'utf8');

test('main uses the isolated menu runtime', () => {
  assert.match(main, /import \{ GazeMenu \} from '\.\/menuRuntime\.js';/);
});

test('crash waits for an explicit menu choice', () => {
  const crashSection = main.match(/function updateCrash\(dt\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(crashSection, /crashRespawnRequested/);
  assert.doesNotMatch(crashSection, /neutralHold\s*>=/);
  assert.doesNotMatch(crashSection, /finishRespawn\(\);\s*\n\s*}\s*$/);
});

test('phone menu is wide, large and uses direct horizontal direction', () => {
  assert.match(runtime, /resume: \[0, 30\]/);
  assert.match(runtime, /recenter: \[-32, 10\]/);
  assert.match(runtime, /aircraft: \[32, 10\]/);
  assert.match(runtime, /PHONE_PANEL_SCALE = 1\.48/);
  assert.match(runtime, /const selectionYaw = yaw;/);
});

test('phone activation requires steady aim', () => {
  assert.match(runtime, /REQUIRED_STABLE_SECONDS = 0\.34/);
  assert.match(runtime, /MAX_STABLE_ANGULAR_SPEED = 0\.38/);
  assert.match(runtime, /this\.dwellElapsed = 0;/);
});
