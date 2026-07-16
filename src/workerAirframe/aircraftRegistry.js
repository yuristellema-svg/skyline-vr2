import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const required = [
  'src/workerAirframe/aircraftRegistry.js',
  'src/workerAirframe/flightProfiles.js',
  'src/workerAirframe/visualShared.js',
  'src/workerAirframe/zeroExternal.js',
  'src/workerAirframe/zeroCockpit.js',
  'src/workerAirframe/stukaExternal.js',
  'src/workerAirframe/stukaCockpit.js',
  'src/workerAirframe/scoutExternal.js',
  'src/workerAirframe/scoutCockpit.js',
  'src/workerAirframe/gliderExternal.js',
  'src/workerAirframe/gliderCockpit.js',
  'src/workerAirframe/visualAdapter.js',
  'src/workerAirframe/profileAdapter.js',
  'wiring/airframeWiring.mjs',
  'wiring/AIRFRAME_PATCH_PLAN.md',
  'tests/worker-airframe.test.mjs',
  'HANDOFF.md',
  'BASELINE_AUDIT.md',
  'TEST_RESULTS.txt',
  'CHANGED_FILES.txt',
  'ROLLBACK.md',
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing ${relative}`);
}

const changed = fs.readFileSync(path.join(root, 'CHANGED_FILES.txt'), 'utf8');
for (const forbidden of ['src/main.js', 'src/camera.js', 'src/renderPoseInterpolator.js', 'src/flightModel.js']) {
  if (changed.split(/\r?\n/).includes(forbidden)) throw new Error(`Protected file listed: ${forbidden}`);
}

const scripts = required.filter(file => /\.(?:js|mjs)$/.test(file));
for (const relative of scripts) {
  const check = spawnSync(process.execPath, ['--check', relative], { cwd: root, encoding: 'utf8' });
  if (check.status !== 0) throw new Error(`Syntax failed: ${relative}\n${check.stderr}`);
}

const tests = spawnSync(process.execPath, ['--test', 'tests/worker-airframe.test.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
process.stdout.write(tests.stdout);
process.stderr.write(tests.stderr);
if (tests.status !== 0) process.exit(tests.status || 1);
console.log('VERIFY PASSED: isolated airframe package only; protected renderer files absent.');
