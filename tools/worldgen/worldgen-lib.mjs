import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const FORMAT_MAGIC = 'SVW3';
export const FORMAT_VERSION = 3;
export const HEADER_BYTES = 48;
export const CHUNK_INDEX_BYTES = 16;
export const PROP_RECORD_BYTES = 12;

export const BIOME = Object.freeze({
  meadow: 0,
  conifer_forest: 1,
  broadleaf_forest: 2,
  alpine_rock: 3,
  ochre_canyon: 4,
  riparian_wetland: 5,
  urban: 6,
  water: 7,
});

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hashLattice(x, z, seed) {
  let h = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ (seed | 0);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fz = fade(z - z0);
  const a = hashLattice(x0, z0, seed);
  const b = hashLattice(x0 + 1, z0, seed);
  const c = hashLattice(x0, z0 + 1, seed);
  const d = hashLattice(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz) * 2 - 1;
}

function fbm(x, z, seed, octaves) {
  let frequency = 1;
  let amplitude = 0.57;
  let value = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise2(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    norm += amplitude;
    frequency *= 2.03;
    amplitude *= 0.51;
  }
  return value / norm;
}

function ridgedFbm(x, z, seed, octaves) {
  let frequency = 1;
  let amplitude = 0.62;
  let value = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const ridge = 1 - Math.abs(valueNoise2(x * frequency, z * frequency, seed + octave * 1619));
    value += ridge * ridge * amplitude;
    norm += amplitude;
    frequency *= 2.08;
    amplitude *= 0.49;
  }
  return value / norm;
}

export function compilePolyline(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('A spline requires at least two points.');
  }
  const segments = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    segments.push({ ax, az, dx, dz, length, lengthSq: length * length, startLength: totalLength });
    totalLength += length;
  }
  return { points, segments, totalLength };
}

// out = [distance, normalized path position, tangentX, tangentZ, nearestX, nearestZ]
export function distanceToPolyline(polyline, x, z, out) {
  let bestDistanceSq = Infinity;
  let bestT = 0;
  let bestSegment = polyline.segments[0];
  let bestX = bestSegment.ax;
  let bestZ = bestSegment.az;
  for (let index = 0; index < polyline.segments.length; index += 1) {
    const segment = polyline.segments[index];
    const localT = clamp(((x - segment.ax) * segment.dx + (z - segment.az) * segment.dz) / segment.lengthSq, 0, 1);
    const nearX = segment.ax + segment.dx * localT;
    const nearZ = segment.az + segment.dz * localT;
    const dx = x - nearX;
    const dz = z - nearZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestT = (segment.startLength + segment.length * localT) / polyline.totalLength;
      bestSegment = segment;
      bestX = nearX;
      bestZ = nearZ;
    }
  }
  out[0] = Math.sqrt(bestDistanceSq);
  out[1] = bestT;
  out[2] = bestSegment.dx / bestSegment.length;
  out[3] = bestSegment.dz / bestSegment.length;
  out[4] = bestX;
  out[5] = bestZ;
  return out;
}

function ellipseSignedDistance(x, z, center, radius) {
  const nx = (x - center[0]) / radius[0];
  const nz = (z - center[1]) / radius[1];
  return (Math.hypot(nx, nz) - 1) * Math.min(radius[0], radius[1]);
}

function ellipseInfluence(x, z, center, radius, featherMeters) {
  const distance = ellipseSignedDistance(x, z, center, radius);
  return distance <= 0 ? 1 : 1 - smoothstep(0, featherMeters, distance);
}

function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const zi = points[i][1];
    const xj = points[j][0];
    const zj = points[j][1];
    const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToPolygon(x, z, points) {
  let bestSq = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const [ax, az] = points[i];
    const [bx, bz] = points[(i + 1) % points.length];
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const ex = x - px;
    const ez = z - pz;
    bestSq = Math.min(bestSq, ex * ex + ez * ez);
  }
  return Math.sqrt(bestSq);
}

function regionInfluence(region, x, z) {
  if (region.shape === 'ellipse') {
    return ellipseInfluence(x, z, region.center, region.radius, region.featherMeters);
  }
  if (region.shape === 'polygon') {
    if (pointInPolygon(x, z, region.points)) return 1;
    return 1 - smoothstep(0, region.featherMeters, distanceToPolygon(x, z, region.points));
  }
  return 0;
}

export function validateRecipe(recipe) {
  const errors = [];
  const world = recipe.world ?? {};
  if (recipe.format !== 'skyline-world-recipe' || recipe.version !== 3) errors.push('recipe format/version must be Skyline v3');
  if (world.sizeMeters !== 8192 || world.heightResolutionMeters !== 2) errors.push('world must be 8192 m at 2 m height resolution');
  if (world.chunkSizeMeters !== 256 || world.chunksPerPack !== 4) errors.push('chunk/pack layout must be 256 m and 4x4 chunks');
  if (!Array.isArray(recipe.biomes?.palette) || recipe.biomes.palette.length !== 8) errors.push('exactly eight packed biome palette entries are required');
  if (!Array.isArray(recipe.hydrology?.river?.points) || recipe.hydrology.river.points.length < 4) errors.push('river spline is missing');
  if (!recipe.hydrology?.lake) errors.push('lake basin is missing');
  if (!Array.isArray(recipe.canyons) || recipe.canyons.length === 0) errors.push('canyon spline is missing');
  if (!recipe.city?.plateau) errors.push('city plateau is missing');
  if (!Array.isArray(recipe.bridges) || recipe.bridges.length !== 5) errors.push('exactly five bridges are required');
  if (!Array.isArray(recipe.landmarks) || recipe.landmarks.length < 5) errors.push('at least five landmarks are required');
  if (!Array.isArray(recipe.props?.catalog) || recipe.props.catalog.length < 6) errors.push('prop catalog is incomplete');
  const ids = new Set();
  for (const collection of [recipe.bridges ?? [], recipe.landmarks ?? [], recipe.biomes?.regions ?? []]) {
    for (const item of collection) {
      if (!item.id || ids.has(item.id)) errors.push(`duplicate or missing authored id: ${item.id ?? '<missing>'}`);
      ids.add(item.id);
    }
  }
  if (errors.length > 0) throw new Error(`Invalid world recipe:\n- ${errors.join('\n- ')}`);
}

export function createAnalyticSampler(recipe) {
  validateRecipe(recipe);
  const terrain = recipe.terrain;
  const river = recipe.hydrology.river;
  const lake = recipe.hydrology.lake;
  const city = recipe.city.plateau;
  const canyon = recipe.canyons[0];
  const riverLine = compilePolyline(river.points);
  const canyonLine = compilePolyline(canyon.points);
  const riverOut = new Float64Array(6);
  const canyonOut = new Float64Array(6);
  const biomeWeights = new Float64Array(8);

  function cityInfluence(x, z) {
    const dx = Math.max(city.min[0] - x, 0, x - city.max[0]);
    const dz = Math.max(city.min[1] - z, 0, z - city.max[1]);
    if (dx === 0 && dz === 0) return 1;
    return 1 - smoothstep(0, city.featherMeters, Math.hypot(dx, dz));
  }

  function heightAt(x, z) {
    const seed = recipe.seed;
    const warpX = valueNoise2(x * terrain.warpFrequency, z * terrain.warpFrequency, seed + 11) * terrain.warpAmplitudeMeters;
    const warpZ = valueNoise2(x * terrain.warpFrequency, z * terrain.warpFrequency, seed + 29) * terrain.warpAmplitudeMeters;
    const wx = x + warpX;
    const wz = z + warpZ;
    const rolling = fbm(wx * terrain.rollingFrequency, wz * terrain.rollingFrequency, seed + 101, 4);
    const ridges = ridgedFbm(wx * terrain.ridgeFrequency, wz * terrain.ridgeFrequency, seed + 307, 3);
    let height = terrain.baseElevationMeters + rolling * terrain.rollingAmplitudeMeters + (ridges - 0.42) * terrain.ridgeAmplitudeMeters;

    const north = terrain.northRange;
    const northStrength = ellipseInfluence(x, z, north.center, north.radius, 700);
    height += northStrength * north.heightMeters * (0.45 + ridges * 0.75);

    const east = terrain.eastEscarpment;
    const eastStrength = ellipseInfluence(x, z, east.center, east.radius, 600);
    height += eastStrength * east.heightMeters * (0.25 + ridges * 0.8);

    const plateau = cityInfluence(x, z);
    height = lerp(height, city.elevationMeters, plateau * 0.96);

    distanceToPolyline(canyonLine, x, z, canyonOut);
    if (canyonOut[0] < canyon.outerWidthMeters) {
      const carve = 1 - smoothstep(canyon.innerWidthMeters, canyon.outerWidthMeters, canyonOut[0]);
      const rimCenter = canyon.innerWidthMeters + (canyon.outerWidthMeters - canyon.innerWidthMeters) * 0.46;
      const rimWidth = (canyon.outerWidthMeters - canyon.innerWidthMeters) * 0.27;
      const rim = Math.exp(-((canyonOut[0] - rimCenter) ** 2) / (2 * rimWidth * rimWidth));
      height += rim * canyon.rimHeightMeters - carve * canyon.depthMeters;
    }

    distanceToPolyline(riverLine, x, z, riverOut);
    if (riverOut[0] < river.bankWidthMeters) {
      const surface = lerp(river.sourceSurfaceMeters, river.mouthSurfaceMeters, riverOut[1]);
      const bed = surface - river.bedDepthMeters;
      const d = riverOut[0];
      const target = d <= river.bedWidthMeters
        ? bed + (d / river.bedWidthMeters) * 2.2
        : bed + 2.2 + smoothstep(river.bedWidthMeters, river.bankWidthMeters, d) * 42;
      const carve = 1 - smoothstep(river.bedWidthMeters * 0.65, river.bankWidthMeters, d);
      height = lerp(height, Math.min(height, target), carve);
    }

    const lakeDistance = ellipseSignedDistance(x, z, lake.center, lake.radius);
    if (lakeDistance < lake.shoreFeatherMeters) {
      const lakeBlend = lakeDistance <= 0 ? 1 : 1 - smoothstep(0, lake.shoreFeatherMeters, lakeDistance);
      const radial = Math.hypot((x - lake.center[0]) / lake.radius[0], (z - lake.center[1]) / lake.radius[1]);
      const floor = lake.floorMeters + clamp(radial, 0, 1) ** 2 * 4;
      height = lerp(height, Math.min(height, floor), lakeBlend);
    }

    return clamp(height, recipe.world.heightQuantization.offsetMeters, 1200);
  }

  function hydroInfoAt(x, z, out = new Float64Array(6)) {
    return distanceToPolyline(riverLine, x, z, out);
  }

  function canyonInfoAt(x, z, out = new Float64Array(6)) {
    return distanceToPolyline(canyonLine, x, z, out);
  }

  function lakeDistanceAt(x, z) {
    return ellipseSignedDistance(x, z, lake.center, lake.radius);
  }

  function encodeBiomeAt(x, z, height, slopeRadians) {
    biomeWeights.fill(0);
    biomeWeights[BIOME.meadow] = 0.62;
    biomeWeights[BIOME.conifer_forest] = 0.12;
    biomeWeights[BIOME.broadleaf_forest] = 0.1;
    biomeWeights[BIOME.alpine_rock] = clamp((height - 175) / 145, 0, 1) * 1.4 + clamp((slopeRadians - 0.42) / 0.55, 0, 1) * 1.2;
    biomeWeights[BIOME.ochre_canyon] = 0.04;
    biomeWeights[BIOME.riparian_wetland] = 0.02;

    for (const region of recipe.biomes.regions) {
      const id = BIOME[region.biome];
      biomeWeights[id] += regionInfluence(region, x, z) * region.strength * 2.1;
    }

    distanceToPolyline(riverLine, x, z, riverOut);
    const lakeDistance = lakeDistanceAt(x, z);
    const riverSurface = lerp(river.sourceSurfaceMeters, river.mouthSurfaceMeters, riverOut[1]);
    const inRiver = riverOut[0] < river.bedWidthMeters * 0.76 && height < riverSurface + 3;
    const inLake = lakeDistance < -4 && height < lake.surfaceMeters + 3;
    if (inRiver || inLake) return BIOME.water | (BIOME.riparian_wetland << 3);

    const wetlandInfluence = Math.max(
      1 - smoothstep(river.bedWidthMeters, river.bankWidthMeters * 1.45, riverOut[0]),
      1 - smoothstep(-20, lake.shoreFeatherMeters + 180, lakeDistance),
    );
    biomeWeights[BIOME.riparian_wetland] += wetlandInfluence * 2.8;

    distanceToPolyline(canyonLine, x, z, canyonOut);
    biomeWeights[BIOME.ochre_canyon] += (1 - smoothstep(canyon.innerWidthMeters, canyon.outerWidthMeters * 1.45, canyonOut[0])) * 2.2;

    const urban = cityInfluence(x, z);
    biomeWeights[BIOME.urban] += urban * 4;

    let primary = 0;
    let secondary = 1;
    if (biomeWeights[secondary] > biomeWeights[primary]) [primary, secondary] = [secondary, primary];
    for (let id = 2; id < 7; id += 1) {
      if (biomeWeights[id] > biomeWeights[primary]) {
        secondary = primary;
        primary = id;
      } else if (biomeWeights[id] > biomeWeights[secondary]) {
        secondary = id;
      }
    }
    const secondaryShare = biomeWeights[secondary] / Math.max(0.001, biomeWeights[primary] + biomeWeights[secondary]);
    const blend = clamp(Math.round(secondaryShare * 3), 0, 3);
    return primary | (secondary << 3) | (blend << 6);
  }

  return {
    riverLine,
    canyonLine,
    heightAt,
    encodeBiomeAt,
    cityInfluence,
    hydroInfoAt,
    canyonInfoAt,
    lakeDistanceAt,
  };
}

export function decodeBiome(byte) {
  return { primary: byte & 7, secondary: (byte >>> 3) & 7, blend: (byte >>> 6) / 3 };
}

export function parsePackHeader(buffer) {
  if (buffer.length < HEADER_BYTES || buffer.toString('ascii', 0, 4) !== FORMAT_MAGIC) throw new Error('Not a Skyline V3 world pack.');
  return {
    version: buffer.readUInt16LE(4),
    flags: buffer.readUInt16LE(6),
    regionX: buffer.readUInt16LE(8),
    regionZ: buffer.readUInt16LE(10),
    chunksPerSide: buffer.readUInt16LE(12),
    heightSamples: buffer.readUInt16LE(14),
    splatSamples: buffer.readUInt16LE(16),
    propRecordBytes: buffer.readUInt16LE(18),
    heightOffset: buffer.readUInt32LE(20),
    heightBytes: buffer.readUInt32LE(24),
    splatOffset: buffer.readUInt32LE(28),
    splatBytes: buffer.readUInt32LE(32),
    chunkTableOffset: buffer.readUInt32LE(36),
    propOffset: buffer.readUInt32LE(40),
    propCount: buffer.readUInt32LE(44),
  };
}

export function createRng(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function chunkSeed(worldSeed, chunkX, chunkZ) {
  let value = (worldSeed ^ Math.imul(chunkX + 1, 0x9e3779b1) ^ Math.imul(chunkZ + 1, 0x85ebca77)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  return value >>> 0;
}
