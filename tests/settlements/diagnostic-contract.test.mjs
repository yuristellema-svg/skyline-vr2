import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const reportUrl = new URL('../../diagnostics/baseline-feature-compatibility.json', import.meta.url);

test('baseline compatibility report names missing world-core inputs without invented coordinates', async () => {
  const report = JSON.parse(await readFile(reportUrl, 'utf8'));
  assert.equal(report.baselineSha, 'd3e48499e90affe4dcf01fda1fdfa882fbaef8bd');
  assert.equal(report.compatible, false);
  assert.ok(report.missing.some(item => item.startsWith('roads[]')));
  assert.ok(report.missing.some(item => item.startsWith('settlements[]')));
  assert.match(report.integrationDecision, /Do not infer or invent/);
});
