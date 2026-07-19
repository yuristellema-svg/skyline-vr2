import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCityLayout } from '../src/world/features/cityLayout.js';
import { createAnalyticSampler } from '../tools/worldgen/worldgen-lib.mjs';

const recipe = JSON.parse(await readFile(new URL('../world-recipe.json', import.meta.url), 'utf8'));
const features = JSON.parse(await readFile(new URL('../assets/world/features.json', import.meta.url), 'utf8'));

test('city moved to the western plain and old buried footprint is gone', () => {
  assert.deepEqual(recipe.city.plateau.min, [-2810, -3460]);
  assert.deepEqual(recipe.city.plateau.max, [-1890, -2540]);
  assert.equal(recipe.city.plateau.elevationMeters, 40);
  assert.ok(recipe.city.plateau.max[1] < -2500);
});

test('city core is exactly flat in the authoritative analytic terrain', () => {
  const sampler = createAnalyticSampler(recipe);
  const plateau = recipe.city.plateau;
  for (let z = plateau.min[1]; z <= plateau.max[1]; z += 80) {
    for (let x = plateau.min[0]; x <= plateau.max[0]; x += 80) {
      assert.ok(Math.abs(sampler.heightAt(x, z) - plateau.elevationMeters) < 1e-9, `${x},${z}`);
    }
  }
});

test('city layout has four districts, visible streets, parks, and deterministic solids', () => {
  const first = createCityLayout(features);
  const second = createCityLayout(features);
  assert.deepEqual(first, second);
  assert.ok(first.blockCount >= 60);
  assert.ok(first.roads.length >= 18);
  assert.ok(first.parks.length >= 3);
  assert.deepEqual(new Set(Object.keys(first.districtCounts)), new Set(['downtown', 'civic', 'residential', 'industrial']));
  assert.ok(first.descriptors.length >= 100);
  assert.ok(first.roofDescriptors.length >= 20);
});

test('all building bases and streets sit above the exact city surface', () => {
  const layout = createCityLayout(features);
  const surface = recipe.city.plateau.elevationMeters;
  for (const item of layout.descriptors) {
    const landmark = ['landmarkTower', 'atrium', 'skybridge'].includes(item.kind);
    assert.ok(item.baseY >= surface + (landmark ? -0.01 : 0.17), item.label);
  }
  for (const road of layout.roads) assert.ok(road.y - road.height * 0.5 >= surface - 0.001);
  for (const pad of layout.blockPads) assert.ok(pad.y - pad.height * 0.5 >= surface - 0.001);
});

test('city-owned landmarks moved with the city', () => {
  const plateau = recipe.city.plateau;
  const cityLandmarks = features.landmarks.filter(item => ['tower_pair', 'open_atrium'].includes(item.type));
  assert.equal(cityLandmarks.length, 3);
  for (const landmark of cityLandmarks) {
    assert.ok(landmark.position[0] > plateau.min[0] && landmark.position[0] < plateau.max[0], landmark.id);
    assert.ok(landmark.position[1] > plateau.min[1] && landmark.position[1] < plateau.max[1], landmark.id);
    assert.ok(Math.abs(landmark.y - plateau.elevationMeters) < 0.11, landmark.id);
  }
});


test('city renderer stays within two draw calls by batching solids and ground detail', async () => {
  const source = await readFile(new URL('../src/world/features/city.js', import.meta.url), 'utf8');
  assert.match(source, /solidDescriptors = \[\.\.\.layout\.descriptors, \.\.\.layout\.roofDescriptors\]/);
  assert.match(source, /surfaceDescriptors = flatDescriptors/);
  assert.match(source, /group\.add\(surfaces\.mesh, buildings\.mesh\)/);
  assert.doesNotMatch(source, /group\.add\(roads\.mesh, sidewalks\.mesh, parks\.mesh/);
});
