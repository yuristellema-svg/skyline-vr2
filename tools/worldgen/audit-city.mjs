import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAnalyticSampler, distanceToPolyline } from './worldgen-lib.mjs';
import { DEFAULT_AIRFIELD_CATALOG } from '../../src/airfields/airfieldCatalog.js';

const root = resolve(process.cwd());
const recipe = JSON.parse(await readFile(resolve(root, 'world-recipe.json'), 'utf8'));
const sampler = createAnalyticSampler(recipe);
const plateau = recipe.city.plateau;
const expected = plateau.elevationMeters;
let minHeight = Infinity;
let maxHeight = -Infinity;
let maxError = 0;
let samples = 0;
for (let z = plateau.min[1]; z <= plateau.max[1]; z += 40) {
  for (let x = plateau.min[0]; x <= plateau.max[0]; x += 40) {
    const height = sampler.heightAt(x, z);
    minHeight = Math.min(minHeight, height);
    maxHeight = Math.max(maxHeight, height);
    maxError = Math.max(maxError, Math.abs(height - expected));
    samples += 1;
  }
}
const scratch = new Float64Array(6);
const centerX = (plateau.min[0] + plateau.max[0]) * 0.5;
const centerZ = (plateau.min[1] + plateau.max[1]) * 0.5;
sampler.hydroInfoAt(centerX, centerZ, scratch);
const riverDistance = scratch[0];
sampler.canyonInfoAt(centerX, centerZ, scratch);
const canyonDistance = scratch[0];
const lakeDistance = sampler.lakeDistanceAt(centerX, centerZ);
const halfDiagonal = Math.hypot((plateau.max[0] - plateau.min[0]) * 0.5, (plateau.max[1] - plateau.min[1]) * 0.5);
const nearestAirfieldClearance = Math.min(...DEFAULT_AIRFIELD_CATALOG.fields.map(field => Math.hypot(centerX - field.center.x, centerZ - field.center.z) - halfDiagonal - field.length * 0.5));
const cityLandmarks = recipe.landmarks.filter(item => ['tower_pair', 'open_atrium'].includes(item.type));
const landmarksInside = cityLandmarks.every(item => item.position[0] > plateau.min[0] && item.position[0] < plateau.max[0] && item.position[1] > plateau.min[1] && item.position[1] < plateau.max[1]);
const report = {
  version: 1,
  center: [centerX, centerZ],
  bounds: plateau,
  samples,
  terrain: { minHeight, maxHeight, maxErrorFromCityElevation: maxError },
  clearance: { riverMeters: riverDistance, lakeMeters: lakeDistance, canyonMeters: canyonDistance, nearestAirfieldOperationalClearanceMeters: nearestAirfieldClearance },
  cityLandmarks: cityLandmarks.map(item => ({ id: item.id, position: item.position })),
  pass: maxError < 0.001 && riverDistance > 900 && lakeDistance > 900 && canyonDistance > 900 && nearestAirfieldClearance > 350 && landmarksInside,
};
if (!report.pass) throw new Error(`City relocation audit failed:\n${JSON.stringify(report, null, 2)}`);
if (process.argv.includes('--write')) await writeFile(resolve(root, 'docs/CITY_RELOCATION_AUDIT.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
