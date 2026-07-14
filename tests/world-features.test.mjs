import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createStructureLayer,
  registerStructureCollisions,
} from '../src/world/features/structures.js';
import { createWaterLayer } from '../src/world/features/water.js';
import {
  createPropLayer,
  decodePropRecord,
  PROP_KEYS,
} from '../src/world/features/props.js';
import { createCityLayer } from '../src/world/features/city.js';

const features = JSON.parse(await readFile(new URL('../assets/world/features.json', import.meta.url), 'utf8'));

function collisionProbe() {
  return {
    boxes: [],
    addBox(...args) {
      this.boxes.push(args);
    },
  };
}

test('five authored bridges are distinct, threadable, and collision-registerable', () => {
  const structures = createStructureLayer(features);
  assert.deepEqual(new Set(structures.bridgeKinds), new Set([
    'stone_arch',
    'urban_arch',
    'rail_viaduct',
    'steel_truss',
    'suspension',
  ]));
  assert.deepEqual(new Set(structures.bridgeVisualKinds), new Set([
    'stone arch',
    'wooden',
    'rail viaduct',
    'modern span',
    'suspension',
  ]));
  const bridgeGroups = structures.group.children.filter(child => child.userData.threadable);
  assert.equal(bridgeGroups.length, 5);
  assert.ok(structures.collisionBoxes.length >= 20);
  for (const box of structures.collisionBoxes) {
    assert.ok(Number.isFinite(box.minX + box.maxX + box.minY + box.maxY + box.minZ + box.maxZ));
    assert.ok(box.minX < box.maxX && box.minY < box.maxY && box.minZ < box.maxZ);
  }
  const collision = collisionProbe();
  assert.equal(structures.registerCollisions(collision), structures.collisionBoxes.length);
  assert.equal(collision.boxes.length, structures.collisionBoxes.length);
  assert.equal(registerStructureCollisions(null, structures.collisionBoxes), 0);
  structures.dispose();
});

test('scenic landmark collisions cover solids without closing flight gaps', () => {
  const structures = createStructureLayer(features);
  const expectedCounts = new Map([
    ['mirror-observatory', 2],
    ['alpine-needle', 1],
    ['forest-stone-circle', 12],
    ['southern-wind-array', 7],
  ]);
  for (const [id, expectedCount] of expectedCounts) {
    const boxes = structures.collisionBoxes.filter(box => box.label.startsWith(id));
    assert.equal(boxes.length, expectedCount, `${id} collision part count`);
    for (const box of boxes) {
      assert.ok(Number.isFinite(box.minX + box.maxX + box.minY + box.maxY + box.minZ + box.maxZ));
      assert.ok(box.minX < box.maxX && box.minY < box.maxY && box.minZ < box.maxZ);
    }
  }

  const stoneCircle = features.landmarks.find(item => item.id === 'forest-stone-circle');
  const stoneBoxes = structures.collisionBoxes.filter(box => box.label.startsWith(stoneCircle.id));
  const centerBlocked = stoneBoxes.some(box => (
    stoneCircle.position[0] >= box.minX && stoneCircle.position[0] <= box.maxX &&
    stoneCircle.position[1] >= box.minZ && stoneCircle.position[1] <= box.maxZ
  ));
  assert.equal(centerBlocked, false, 'stone-circle flight opening was blocked');

  const windBoxes = structures.collisionBoxes.filter(box => box.label.startsWith('southern-wind-array'));
  assert.ok(windBoxes.every(box => box.maxX - box.minX < 5 && box.maxZ - box.minZ < 5),
    'wind array should use individual tower boxes, not one gap-blocking box');
  structures.dispose();
});

test('river and lake share one animated two-layer fresnel water material', () => {
  const water = createWaterLayer(features);
  assert.equal(water.group.children.length, 2);
  assert.equal(water.river.material, water.lake.material);
  assert.ok(water.river.geometry.getAttribute('position').count > 100);
  assert.ok(water.lake.geometry.getAttribute('position').count > 700);
  assert.match(water.material.vertexShader, /layerA/);
  assert.match(water.material.vertexShader, /layerB/);
  assert.match(water.material.fragmentShader, /fresnel/);
  assert.match(water.material.fragmentShader, /glint/);
  water.update(12.75);
  assert.equal(water.material.uniforms.uTime.value, 12.75);
  water.dispose();
});

test('packed prop records decode exactly and six instanced catalogs stay six draw calls', () => {
  const buffer = new ArrayBuffer(12);
  const view = new DataView(buffer);
  view.setUint16(0, 32768, true);
  view.setUint16(2, 65535, true);
  view.setUint16(4, 16384, true);
  view.setUint16(6, 1250, true);
  view.setUint8(8, 2);
  view.setUint8(9, 17);
  view.setUint8(10, 144);
  view.setUint8(11, 1);
  const record = decodePropRecord(view, 0, { minX: -512, minZ: 100, maxX: 512, maxZ: 1124 });
  assert.ok(Math.abs(record.x - (32768 / 65535 * 1024 - 512)) < 1e-9);
  assert.equal(record.z, 1124);
  assert.ok(Math.abs(record.yaw - Math.PI * 0.5) < 1e-12);
  assert.equal(record.scale, 1.25);
  assert.equal(record.type, 2);
  assert.equal(record.variant, 17);
  assert.equal(record.tint, 144);
  assert.equal(record.flags, 1);

  const capacity = Object.fromEntries(PROP_KEYS.map(key => [key, 2]));
  const props = createPropLayer({ capacity });
  assert.equal(props.group.children.length, 6);
  props.begin();
  for (let type = 0; type < 6; type += 1) {
    assert.equal(props.add({ type, x: type * 8, z: -type * 3, yaw: type, scale: 1, variant: type, tint: 128 }, () => 42), true);
  }
  props.commit();
  assert.deepEqual(Array.from(props.counts), [1, 1, 1, 1, 1, 1]);
  assert.ok(props.meshes.every(mesh => mesh.count === 1 && mesh.isInstancedMesh));
  props.dispose();
});

test('prop LOD is deterministic and the hard triangle budget cannot be exceeded', () => {
  const capacity = Object.fromEntries(PROP_KEYS.map(key => [key, 500]));
  const options = { capacity, triangleBudget: 5000, nearRadius: 120, middleRadius: 500, farRadius: 1000 };
  const first = createPropLayer(options);
  const second = createPropLayer(options);
  first.begin(0, 0);
  second.begin(0, 0);
  for (let index = 0; index < 900; index += 1) {
    const angle = index * 2.3999632297;
    const radius = 40 + index * 1.25;
    const record = {
      type: index % 6,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      yaw: angle,
      scale: 0.8 + (index % 7) * 0.07,
      variant: index % 29,
      tint: index % 256,
    };
    first.add(record, () => 0);
    second.add(record, () => 0);
  }
  first.commit();
  second.commit();
  assert.deepEqual(Array.from(first.counts), Array.from(second.counts));
  assert.equal(first.estimatedTriangles, second.estimatedTriangles);
  assert.ok(first.estimatedTriangles <= 5000);
  assert.ok(first.rejectedByLod > 0, 'distance thinning never activated');
  assert.ok(first.rejectedByBudget > 0, 'triangle guard never activated');
  assert.equal(first.getBudgetReport().triangleBudget, 5000);
  first.dispose();
  second.dispose();
});

test('city generation is deterministic with dense blocks and three protected flight corridors', () => {
  const first = createCityLayer(features);
  const second = createCityLayer(features);
  assert.ok(first.blockCount >= 80, `only ${first.blockCount} city blocks`);
  assert.equal(first.blockCount, second.blockCount);
  assert.equal(first.descriptors.length, second.descriptors.length);
  assert.deepEqual(first.descriptors, second.descriptors);
  assert.equal(first.threadCorridors.length, 3);
  assert.equal(first.threadCorridors.filter(item => item.id.includes('tower')).length, 2);
  assert.ok(first.threadCorridors.every(item => item.width >= 46 && item.height >= 56));
  assert.equal(first.group.children.length, 1, 'all city solids share one instanced draw call');
  const collision = collisionProbe();
  assert.equal(first.registerCollisions(collision), first.descriptors.length);
  assert.equal(collision.boxes.length, first.descriptors.length);
  first.dispose();
  second.dispose();
});
