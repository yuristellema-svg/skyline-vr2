import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture } from './helpers/loadAircraftModule.mjs';

async function loadBuilders(fixture) {
  const shared = await fixture.importModule('aircraftVisualShared.js');
  const zeroExternal = await fixture.importModule('a6mZeroExternal.js');
  const zeroCockpit = await fixture.importModule('a6mZeroCockpit.js');
  const stukaExternal = await fixture.importModule('ju87StukaExternal.js');
  const stukaCockpit = await fixture.importModule('ju87StukaCockpit.js');
  return {
    shared,
    builders: [
      zeroExternal.createA6MZeroExternal,
      zeroCockpit.createA6MZeroCockpit,
      stukaExternal.createJu87StukaExternal,
      stukaCockpit.createJu87StukaCockpit,
    ],
  };
}

test('disposeAircraftTree disposes every unique geometry and material', async () => {
  const fixture = createFixture();
  try {
    const { shared, builders } = await loadBuilders(fixture);
    for (const build of builders) {
      const model = build();
      const geometries = new Set();
      const materials = new Set();
      model.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material)
          ? object.material
          : object.material
            ? [object.material]
            : [];
        for (const material of list) materials.add(material);
      });

      const result = shared.disposeAircraftTree(model);
      assert.equal(result.geometriesDisposed, geometries.size);
      assert.equal(result.materialsDisposed, materials.size);
      for (const geometry of geometries) assert.equal(geometry.disposed, true);
      for (const material of materials) assert.equal(material.disposed, true);
    }
  } finally {
    fixture.cleanup();
  }
});

test('rebuilding models does not reuse disposed materials across instances', async () => {
  const fixture = createFixture();
  try {
    const { shared, builders } = await loadBuilders(fixture);
    for (const build of builders) {
      const first = build();
      const firstMaterials = new Set();
      first.traverse(object => {
        if (object.material) firstMaterials.add(object.material);
      });
      shared.disposeAircraftTree(first);

      const second = build();
      second.traverse(object => {
        if (object.material) {
          assert.equal(firstMaterials.has(object.material), false);
          assert.equal(object.material.disposed, false);
        }
      });
    }
  } finally {
    fixture.cleanup();
  }
});
