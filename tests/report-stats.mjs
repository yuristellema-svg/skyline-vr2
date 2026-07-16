import { createFixture } from './helpers/loadAircraftModule.mjs';

const fixture = createFixture();
try {
  const shared = await fixture.importModule('aircraftVisualShared.js');
  const zeroExternal = await fixture.importModule('a6mZeroExternal.js');
  const zeroCockpit = await fixture.importModule('a6mZeroCockpit.js');
  const stukaExternal = await fixture.importModule('ju87StukaExternal.js');
  const stukaCockpit = await fixture.importModule('ju87StukaCockpit.js');

  const models = {
    zeroExternal: zeroExternal.createA6MZeroExternal(),
    zeroCockpit: zeroCockpit.createA6MZeroCockpit(),
    stukaExternal: stukaExternal.createJu87StukaExternal(),
    stukaCockpit: stukaCockpit.createJu87StukaCockpit(),
  };

  const report = {};
  for (const [name, model] of Object.entries(models)) {
    report[name] = shared.collectVisualStats(model);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  fixture.cleanup();
}
