import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
const recipePath = resolve(root, 'world-recipe.json');
const libraryPath = resolve(root, 'tools/worldgen/worldgen-lib.mjs');
const generatorPath = resolve(root, 'tools/worldgen/generate.mjs');
const testPath = resolve(root, 'tests/world-features.test.mjs');

const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
recipe.city.plateau = {
  min: [-2810, -3460],
  max: [-1890, -2540],
  elevationMeters: 40,
  featherMeters: 260,
};
recipe.city.grid = {
  ...recipe.city.grid,
  blockMinMeters: 58,
  blockMaxMeters: 86,
  streetMeters: 22,
  towerPairPositions: [[-2165, -2695], [-2400, -3290]],
  openAtriumPosition: [-2610, -2810],
};
const landmarkUpdates = new Map([
  ['north-tower-thread', { position: [-2165, -2695], headingDegrees: 24 }],
  ['south-tower-thread', { position: [-2400, -3290], headingDegrees: -28 }],
  ['open-atrium', { position: [-2610, -2810], headingDegrees: 0 }],
]);
for (const landmark of recipe.landmarks) {
  const update = landmarkUpdates.get(landmark.id);
  if (update) Object.assign(landmark, update);
}
await writeFile(recipePath, `${JSON.stringify(recipe, null, 2)}\n`);

let library = await readFile(libraryPath, 'utf8');
const oldBlend = 'height = lerp(height, city.elevationMeters, plateau * 0.96);';
const newBlend = 'height = lerp(height, city.elevationMeters, plateau);';
if (library.includes(oldBlend)) library = library.replace(oldBlend, newBlend);
else if (!library.includes(newBlend)) throw new Error('Unable to locate city terrain blend in worldgen-lib.mjs');
await writeFile(libraryPath, library);

let generator = await readFile(generatorPath, 'utf8');
const samplerAnchor = 'const sampler = createAnalyticSampler(recipe);\n';
const samplerReplacement = 'const sampler = createAnalyticSampler(recipe);\nconst cityPlateau = recipe.city.plateau;\n';
if (!generator.includes('const cityPlateau = recipe.city.plateau;')) {
  if (!generator.includes(samplerAnchor)) throw new Error('Unable to locate sampler anchor in generate.mjs');
  generator = generator.replace(samplerAnchor, samplerReplacement);
}
const candidateAnchor = '          const z = chunkMinZ + (1.5 + random() * (world.chunkSizeMeters - 3));\n          const height = sampleCoarse(x, z);';
const candidateReplacement = `          const z = chunkMinZ + (1.5 + random() * (world.chunkSizeMeters - 3));
          const cityClearance = 18;
          if (
            x >= cityPlateau.min[0] - cityClearance &&
            x <= cityPlateau.max[0] + cityClearance &&
            z >= cityPlateau.min[1] - cityClearance &&
            z <= cityPlateau.max[1] + cityClearance
          ) continue;
          const height = sampleCoarse(x, z);`;
if (!generator.includes('const cityClearance = 18;')) {
  if (!generator.includes(candidateAnchor)) throw new Error('Unable to locate prop candidate anchor in generate.mjs');
  generator = generator.replace(candidateAnchor, candidateReplacement);
}
await writeFile(generatorPath, generator);

let testSource = await readFile(testPath, 'utf8');
const startMarker = "test('city generation is deterministic with dense blocks and three protected flight corridors', () => {";
const start = testSource.indexOf(startMarker);
if (start < 0) {
  if (!testSource.includes("test('relocated city generation is deterministic")) throw new Error('Unable to locate city feature test');
} else {
  const replacement = `test('relocated city generation is deterministic, district-readable, and terrain-safe', () => {
  const first = createCityLayer(features);
  const second = createCityLayer(features);
  assert.ok(first.blockCount >= 60, \`only \${first.blockCount} occupied city blocks\`);
  assert.equal(first.blockCount, second.blockCount);
  assert.deepEqual(first.descriptors, second.descriptors);
  assert.deepEqual(first.roads, second.roads);
  assert.equal(first.threadCorridors.length, 3);
  assert.equal(first.threadCorridors.filter(item => item.id.includes('tower')).length, 2);
  assert.ok(first.threadCorridors.every(item => item.width >= 48 && item.height >= 58));
  assert.ok(first.roads.length >= 18, \`only \${first.roads.length} road strips\`);
  assert.ok(first.parks.length >= 3, \`only \${first.parks.length} parks/plazas\`);
  assert.deepEqual(new Set(Object.keys(first.districtCounts)), new Set(['downtown', 'civic', 'residential', 'industrial']));
  assert.equal(first.drawCallCount, 2, \`city uses \${first.drawCallCount} draw calls\`);
  const collision = collisionProbe();
  assert.equal(first.registerCollisions(collision), first.descriptors.length);
  assert.equal(collision.boxes.length, first.descriptors.length);
  first.dispose();
  second.dispose();
});\n`;
  testSource = `${testSource.slice(0, start)}${replacement}`;
}
await writeFile(testPath, testSource);
console.log('Applied western-plain city relocation and runtime city rebuild.');
