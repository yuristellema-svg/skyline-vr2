import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAnalyticSampler } from '../worldgen/worldgen-lib.mjs';
import { DEFAULT_AIRFIELD_CATALOG, normalizeAirfieldCatalog } from '../../src/airfields/airfieldCatalog.js';
import { resolveAirfields, terrainFitSummary } from '../../src/airfields/terrainFit.js';
import { auditFieldCorridors } from '../../src/airfields/obstacleClearance.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const recipe = JSON.parse(await readFile(resolve(root, 'world-recipe.json'), 'utf8'));
const sampler = createAnalyticSampler(recipe); const step = recipe.world.splatResolutionMeters;
const cache = new Map();
function coarse(x, z) { const key = `${x},${z}`; if (!cache.has(key)) cache.set(key, sampler.heightAt(x, z)); return cache.get(key); }
function lerp(a, b, t) { return a + (b - a) * t; }
function packedHeight(x, z) {
  const x0 = Math.floor(x / step) * step, z0 = Math.floor(z / step) * step, tx = (x - x0) / step, tz = (z - z0) / step;
  const base = lerp(lerp(coarse(x0, z0), coarse(x0 + step, z0), tx), lerp(coarse(x0, z0 + step), coarse(x0 + step, z0 + step), tx), tz);
  const city = recipe.city.plateau; const insideCity = x >= city.min[0] && x <= city.max[0] && z >= city.min[1] && z <= city.max[1];
  if (insideCity || sampler.lakeDistanceAt(x, z) < 0) return base;
  return base + (Math.sin(x * 0.173 + Math.sin(z * 0.071) * 1.7) * 0.58 + Math.sin(z * 0.287 + x * 0.109) * 0.29 + Math.sin((x - z) * 0.093) * 0.13) * recipe.terrain.detailAmplitudeMeters;
}
const catalog = normalizeAirfieldCatalog(DEFAULT_AIRFIELD_CATALOG); const fields = resolveAirfields(catalog, packedHeight);
const terrain = terrainFitSummary(fields); const approaches = fields.flatMap(field => auditFieldCorridors(field, packedHeight));
console.log(JSON.stringify({ base: 'd3e48499e90affe4dcf01fda1fdfa882fbaef8bd', terrain, approaches: approaches.map(item => ({ fieldId: item.fieldId, sign: item.sign, operational: item.operational, minimumClearance: item.minimumClearance, requiredClearance: item.requiredClearance })) }, null, 2));
if (terrain.some(item => !item.operational) || approaches.some(item => !item.operational)) process.exitCode = 1;
