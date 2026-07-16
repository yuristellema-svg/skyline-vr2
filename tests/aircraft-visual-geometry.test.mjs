import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture } from './helpers/loadAircraftModule.mjs';

async function buildAll(fixture) {
  const shared = await fixture.importModule('aircraftVisualShared.js');
  const zeroExternal = await fixture.importModule('a6mZeroExternal.js');
  const zeroCockpit = await fixture.importModule('a6mZeroCockpit.js');
  const stukaExternal = await fixture.importModule('ju87StukaExternal.js');
  const stukaCockpit = await fixture.importModule('ju87StukaCockpit.js');

  return {
    shared,
    zeroExternal: zeroExternal.createA6MZeroExternal(),
    zeroCockpit: zeroCockpit.createA6MZeroCockpit(),
    stukaExternal: stukaExternal.createJu87StukaExternal(),
    stukaCockpit: stukaCockpit.createJu87StukaCockpit(),
  };
}

test('all model builders instantiate without external assets or browser globals', async () => {
  const fixture = createFixture();
  try {
    const models = await buildAll(fixture);
    for (const [name, model] of Object.entries(models)) {
      if (name === 'shared') continue;
      assert.ok(model.children.length > 0, `${name} should contain geometry`);
    }
  } finally {
    fixture.cleanup();
  }
});

test('geometry stays inside the mobile VR budget', async () => {
  const fixture = createFixture();
  try {
    const models = await buildAll(fixture);
    const limits = {
      zeroExternal: { meshes: 130, vertices: 22000, transparentMaterials: 4 },
      zeroCockpit: { meshes: 110, vertices: 13000, transparentMaterials: 4 },
      stukaExternal: { meshes: 145, vertices: 24000, transparentMaterials: 4 },
      stukaCockpit: { meshes: 120, vertices: 14500, transparentMaterials: 4 },
    };

    for (const [name, limit] of Object.entries(limits)) {
      const stats = models.shared.collectVisualStats(models[name]);
      assert.ok(stats.meshes <= limit.meshes, `${name} meshes ${stats.meshes}`);
      assert.ok(stats.vertices <= limit.vertices, `${name} vertices ${stats.vertices}`);
      assert.ok(
        stats.transparentMaterials <= limit.transparentMaterials,
        `${name} transparent materials ${stats.transparentMaterials}`,
      );
    }
  } finally {
    fixture.cleanup();
  }
});

test('no aircraft mesh enables expensive shadows or texture maps', async () => {
  const fixture = createFixture();
  try {
    const models = await buildAll(fixture);
    for (const [name, model] of Object.entries(models)) {
      if (name === 'shared') continue;
      model.traverse(object => {
        if (!object.isMesh) return;
        assert.equal(object.castShadow, false, `${name} castShadow`);
        assert.equal(object.receiveShadow, false, `${name} receiveShadow`);
        const materials = Array.isArray(object.material)
          ? object.material
          : object.material
            ? [object.material]
            : [];
        for (const material of materials) {
          assert.equal(material.map, undefined, `${name} must not use texture maps`);
        }
      });
    }
  } finally {
    fixture.cleanup();
  }
});

test('recognition details exist as named geometry rather than placeholder boxes', async () => {
  const fixture = createFixture();
  try {
    const models = await buildAll(fixture);
    const names = model => {
      const found = new Set();
      model.traverse(object => {
        if (object.name) found.add(object.name);
      });
      return found;
    };

    const zeroNames = names(models.zeroExternal);
    assert.ok(zeroNames.has('zero-rounded-fuselage'));
    assert.ok(zeroNames.has('zero-tapered-radial-cowling'));
    assert.ok(zeroNames.has('zero-segmented-canopy'));
    assert.ok(zeroNames.has('zero-rudder'));
    assert.ok(zeroNames.has('zero-propeller'));

    const stukaNames = names(models.stukaExternal);
    assert.ok(stukaNames.has('stuka-long-engine-nose'));
    assert.ok(stukaNames.has('stuka-greenhouse-canopy'));
    assert.ok(stukaNames.has('stuka-rudder'));
    assert.ok(stukaNames.has('stuka-propeller'));
    assert.ok([...stukaNames].some(name => name.includes('inverted-gull-wing')));
    assert.ok([...stukaNames].some(name => name.includes('dive-brake')));
    assert.ok([...stukaNames].some(name => name.includes('gear-fairing')));
  } finally {
    fixture.cleanup();
  }
});
