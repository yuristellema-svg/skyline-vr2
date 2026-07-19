import { endianness } from 'node:os';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BIOME,
  CHUNK_INDEX_BYTES,
  FORMAT_MAGIC,
  FORMAT_VERSION,
  HEADER_BYTES,
  PROP_RECORD_BYTES,
  chunkSeed,
  clamp,
  createAnalyticSampler,
  createRng,
  decodeBiome,
  distanceToPolyline,
  lerp,
  readJson,
  sha256,
  validateRecipe,
} from './worldgen-lib.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..', '..');

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.cwd(), process.argv[index + 1]) : fallback;
}

const recipePath = argumentValue('--recipe', resolve(PROJECT_ROOT, 'world-recipe.json'));
const outputRoot = argumentValue('--out', resolve(PROJECT_ROOT, 'assets', 'world'));
const packRoot = resolve(outputRoot, 'packs');

const PROP_CHOICES = Object.freeze({
  [BIOME.meadow]: [[4, 0.66], [3, 0.83], [2, 0.93], [0, 1]],
  [BIOME.conifer_forest]: [[0, 0.52], [1, 0.72], [4, 0.91], [3, 1]],
  [BIOME.broadleaf_forest]: [[2, 0.58], [1, 0.69], [4, 0.91], [3, 1]],
  [BIOME.alpine_rock]: [[3, 0.53], [4, 0.82], [0, 0.96], [1, 1]],
  [BIOME.ochre_canyon]: [[3, 0.55], [4, 0.88], [1, 0.96], [0, 1]],
  [BIOME.riparian_wetland]: [[2, 0.46], [1, 0.62], [4, 0.91], [3, 1]],
  [BIOME.urban]: [[5, 0.48], [2, 0.7], [4, 0.9], [3, 1]],
  [BIOME.water]: [],
});

function choosePropType(primaryBiome, value) {
  const choices = PROP_CHOICES[primaryBiome];
  for (let index = 0; index < choices.length; index += 1) {
    if (value <= choices[index][1]) return choices[index][0];
  }
  return 4;
}

function align4(value) {
  return (value + 3) & ~3;
}

function quantizeHeight(height, quantization) {
  return clamp(Math.round((height - quantization.offsetMeters) / quantization.scaleMeters), 0, 65535);
}

function headingForCrossing(tangentX, tangentZ) {
  const crossX = -tangentZ;
  const crossZ = tangentX;
  return Math.atan2(crossX, crossZ) * 180 / Math.PI;
}

function bridgeDeckClearance(type) {
  if (type === 'stone_arch') return 12;
  if (type === 'rail_viaduct') return 27;
  if (type === 'suspension') return 32;
  if (type === 'urban_arch') return 11;
  return 38;
}

function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeIfChanged(path, bytes) {
  try {
    const existing = await readFile(path);
    if (existing.equals(bytes)) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`  replacing unreadable output ${path}`);
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await writeFile(path, bytes);
      return true;
    } catch (error) {
      if (attempt === 19) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 50 + attempt * 25));
    }
  }
  return false;
}

await mkdir(packRoot, { recursive: true });
const recipeBytes = await readFile(recipePath);
const recipe = JSON.parse(recipeBytes.toString('utf8'));
validateRecipe(recipe);

const sampler = createAnalyticSampler(recipe);
const cityPlateau = recipe.city.plateau;
const world = recipe.world;
const worldMaxX = world.minX + world.sizeMeters;
const worldMaxZ = world.minZ + world.sizeMeters;
const coarseStep = world.splatResolutionMeters;
const coarseSamples = world.sizeMeters / coarseStep + 1;
const coarse = new Float32Array(coarseSamples * coarseSamples);

console.log(`Worldgen v3: ${world.sizeMeters} m world, ${coarseSamples}x${coarseSamples} authored terrain lattice.`);
const coarseStarted = performance.now();
for (let zIndex = 0; zIndex < coarseSamples; zIndex += 1) {
  const z = world.minZ + zIndex * coarseStep;
  const rowOffset = zIndex * coarseSamples;
  for (let xIndex = 0; xIndex < coarseSamples; xIndex += 1) {
    coarse[rowOffset + xIndex] = sampler.heightAt(world.minX + xIndex * coarseStep, z);
  }
  if (zIndex > 0 && zIndex % 256 === 0) console.log(`  terrain lattice ${Math.round(zIndex / (coarseSamples - 1) * 100)}%`);
}
console.log(`  terrain lattice complete in ${((performance.now() - coarseStarted) / 1000).toFixed(1)} s`);

function sampleCoarse(x, z) {
  const gx = clamp((x - world.minX) / coarseStep, 0, coarseSamples - 1);
  const gz = clamp((z - world.minZ) / coarseStep, 0, coarseSamples - 1);
  const x0 = Math.min(Math.floor(gx), coarseSamples - 2);
  const z0 = Math.min(Math.floor(gz), coarseSamples - 2);
  const tx = gx - x0;
  const tz = gz - z0;
  const row0 = z0 * coarseSamples;
  const row1 = row0 + coarseSamples;
  return lerp(
    lerp(coarse[row0 + x0], coarse[row0 + x0 + 1], tx),
    lerp(coarse[row1 + x0], coarse[row1 + x0 + 1], tx),
    tz,
  );
}

function detailedHeight(x, z) {
  const base = sampleCoarse(x, z);
  const city = recipe.city.plateau;
  const insideCity = x >= city.min[0] && x <= city.max[0] && z >= city.min[1] && z <= city.max[1];
  const lakeDistance = sampler.lakeDistanceAt(x, z);
  if (insideCity || lakeDistance < 0) return base;
  const fine = (
    Math.sin(x * 0.173 + Math.sin(z * 0.071) * 1.7) * 0.58
    + Math.sin(z * 0.287 + x * 0.109) * 0.29
    + Math.sin((x - z) * 0.093) * 0.13
  ) * recipe.terrain.detailAmplitudeMeters;
  return base + fine;
}

function slopeAt(x, z) {
  const h = coarseStep;
  const dx = (sampleCoarse(x + h, z) - sampleCoarse(x - h, z)) / (h * 2);
  const dz = (sampleCoarse(x, z + h) - sampleCoarse(x, z - h)) / (h * 2);
  return Math.atan(Math.hypot(dx, dz));
}

const featureScratch = new Float64Array(6);
const featurePayload = {
  format: 'skyline-world-features',
  version: FORMAT_VERSION,
  coordinateSystem: recipe.coordinateSystem,
  water: {
    river: {
      id: recipe.hydrology.river.id,
      bedWidthMeters: recipe.hydrology.river.bedWidthMeters,
      bankWidthMeters: recipe.hydrology.river.bankWidthMeters,
      points: recipe.hydrology.river.points.map((point) => {
        distanceToPolyline(sampler.riverLine, point[0], point[1], featureScratch);
        return [point[0], lerp(recipe.hydrology.river.sourceSurfaceMeters, recipe.hydrology.river.mouthSurfaceMeters, featureScratch[1]), point[1]];
      }),
    },
    lake: {
      ...recipe.hydrology.lake,
      y: recipe.hydrology.lake.surfaceMeters,
    },
  },
  city: recipe.city,
  canyons: recipe.canyons,
  bridges: recipe.bridges.map((bridge) => {
    sampler.hydroInfoAt(bridge.position[0], bridge.position[1], featureScratch);
    const surface = lerp(recipe.hydrology.river.sourceSurfaceMeters, recipe.hydrology.river.mouthSurfaceMeters, featureScratch[1]);
    return {
      ...bridge,
      y: surface + bridgeDeckClearance(bridge.type),
      waterY: surface,
      headingDegrees: headingForCrossing(featureScratch[2], featureScratch[3]),
    };
  }),
  landmarks: recipe.landmarks.map((landmark) => ({
    ...landmark,
    y: detailedHeight(landmark.position[0], landmark.position[1]),
  })),
};
const featuresBytes = Buffer.from(prettyJson(featurePayload));
await writeIfChanged(resolve(outputRoot, 'features.json'), featuresBytes);

const paletteKeys = recipe.biomes.palette.map((item) => item.key);
const densityByBiome = new Float64Array(8);
for (const item of recipe.biomes.palette) densityByBiome[item.id] = recipe.props.densityByBiome[item.key];
const propCatalog = new Map(recipe.props.catalog.map((item) => [item.id, item]));
const packSize = world.chunkSizeMeters * world.chunksPerPack;
const packsPerSide = world.sizeMeters / packSize;
const chunksPerSide = world.sizeMeters / world.chunkSizeMeters;
const heightSamples = packSize / world.heightResolutionMeters + 1;
const splatSamples = packSize / world.splatResolutionMeters + 1;
const chunksPerPackTotal = world.chunksPerPack ** 2;
const chunkTableBytes = chunksPerPackTotal * CHUNK_INDEX_BYTES;
const expectedPackNames = new Set();
const packEntries = [];
const totalPropsByType = new Uint32Array(recipe.props.catalog.length);
const totalPropsByBiome = new Uint32Array(8);
let globalMinHeight = Infinity;
let globalMaxHeight = -Infinity;
let totalProps = 0;
let totalBytes = 0;

for (let regionZ = 0; regionZ < packsPerSide; regionZ += 1) {
  for (let regionX = 0; regionX < packsPerSide; regionX += 1) {
    const regionMinX = world.minX + regionX * packSize;
    const regionMinZ = world.minZ + regionZ * packSize;
    const heights = new Uint16Array(heightSamples * heightSamples);
    const splat = new Uint8Array(splatSamples * splatSamples);
    let packMinHeight = Infinity;
    let packMaxHeight = -Infinity;

    for (let zIndex = 0; zIndex < heightSamples; zIndex += 1) {
      const z = regionMinZ + zIndex * world.heightResolutionMeters;
      const row = zIndex * heightSamples;
      for (let xIndex = 0; xIndex < heightSamples; xIndex += 1) {
        const height = detailedHeight(regionMinX + xIndex * world.heightResolutionMeters, z);
        heights[row + xIndex] = quantizeHeight(height, world.heightQuantization);
        packMinHeight = Math.min(packMinHeight, height);
        packMaxHeight = Math.max(packMaxHeight, height);
      }
    }

    for (let zIndex = 0; zIndex < splatSamples; zIndex += 1) {
      const z = regionMinZ + zIndex * world.splatResolutionMeters;
      const row = zIndex * splatSamples;
      for (let xIndex = 0; xIndex < splatSamples; xIndex += 1) {
        const x = regionMinX + xIndex * world.splatResolutionMeters;
        const height = sampleCoarse(x, z);
        splat[row + xIndex] = sampler.encodeBiomeAt(x, z, height, slopeAt(x, z));
      }
    }

    const propRecords = [];
    const chunkRanges = new Array(chunksPerPackTotal);
    const packPropsByType = new Uint32Array(recipe.props.catalog.length);
    for (let localChunkZ = 0; localChunkZ < world.chunksPerPack; localChunkZ += 1) {
      for (let localChunkX = 0; localChunkX < world.chunksPerPack; localChunkX += 1) {
        const localChunkIndex = localChunkZ * world.chunksPerPack + localChunkX;
        const globalChunkX = regionX * world.chunksPerPack + localChunkX;
        const globalChunkZ = regionZ * world.chunksPerPack + localChunkZ;
        const first = propRecords.length;
        const random = createRng(chunkSeed(recipe.seed, globalChunkX, globalChunkZ));
        const chunkMinX = world.minX + globalChunkX * world.chunkSizeMeters;
        const chunkMinZ = world.minZ + globalChunkZ * world.chunkSizeMeters;
        for (let candidate = 0; candidate < recipe.props.candidatesPerChunk; candidate += 1) {
          const x = chunkMinX + (1.5 + random() * (world.chunkSizeMeters - 3));
          const z = chunkMinZ + (1.5 + random() * (world.chunkSizeMeters - 3));
          const cityClearance = 18;
          if (
            x >= cityPlateau.min[0] - cityClearance &&
            x <= cityPlateau.max[0] + cityClearance &&
            z >= cityPlateau.min[1] - cityClearance &&
            z <= cityPlateau.max[1] + cityClearance
          ) continue;
          const height = sampleCoarse(x, z);
          const slope = slopeAt(x, z);
          const biomeByte = sampler.encodeBiomeAt(x, z, height, slope);
          const biome = decodeBiome(biomeByte);
          if (biome.primary === BIOME.water || random() > densityByBiome[biome.primary]) continue;
          const type = choosePropType(biome.primary, random());
          const prop = propCatalog.get(type);
          if (prop.class === 'tree' && slope > 0.63) continue;
          if (prop.class === 'structure' && slope > 0.24) continue;
          if (prop.class !== 'rock' && slope > 0.92) continue;

          let authoredClearance = false;
          for (const bridge of recipe.bridges) {
            if (Math.hypot(x - bridge.position[0], z - bridge.position[1]) < bridge.spanMeters * 0.56 + 28) {
              authoredClearance = true;
              break;
            }
          }
          if (!authoredClearance) {
            for (const landmark of recipe.landmarks) {
              if (Math.hypot(x - landmark.position[0], z - landmark.position[1]) < 34) {
                authoredClearance = true;
                break;
              }
            }
          }
          if (authoredClearance) continue;

          const scale = lerp(prop.scale[0], prop.scale[1], random());
          const flags = (biome.primary === BIOME.riparian_wetland || biome.secondary === BIOME.riparian_wetland ? 1 : 0)
            | (slope > 0.58 ? 2 : 0);
          propRecords.push({
            x: clamp(Math.round((x - regionMinX) / packSize * 65535), 0, 65535),
            z: clamp(Math.round((z - regionMinZ) / packSize * 65535), 0, 65535),
            yaw: Math.floor(random() * 65536),
            scale: clamp(Math.round(scale * 1000), 1, 65535),
            type,
            variant: Math.floor(random() * 4),
            tint: 96 + Math.floor(random() * 144),
            flags,
          });
          packPropsByType[type] += 1;
          totalPropsByType[type] += 1;
          totalPropsByBiome[biome.primary] += 1;
        }
        chunkRanges[localChunkIndex] = { first, count: propRecords.length - first };
      }
    }

    const heightOffset = HEADER_BYTES + chunkTableBytes;
    const heightBytes = heights.byteLength;
    const splatOffset = align4(heightOffset + heightBytes);
    const splatBytes = splat.byteLength;
    const propOffset = align4(splatOffset + splatBytes);
    const packBuffer = Buffer.alloc(propOffset + propRecords.length * PROP_RECORD_BYTES);
    packBuffer.write(FORMAT_MAGIC, 0, 4, 'ascii');
    packBuffer.writeUInt16LE(FORMAT_VERSION, 4);
    packBuffer.writeUInt16LE(0b111, 6);
    packBuffer.writeUInt16LE(regionX, 8);
    packBuffer.writeUInt16LE(regionZ, 10);
    packBuffer.writeUInt16LE(world.chunksPerPack, 12);
    packBuffer.writeUInt16LE(heightSamples, 14);
    packBuffer.writeUInt16LE(splatSamples, 16);
    packBuffer.writeUInt16LE(PROP_RECORD_BYTES, 18);
    packBuffer.writeUInt32LE(heightOffset, 20);
    packBuffer.writeUInt32LE(heightBytes, 24);
    packBuffer.writeUInt32LE(splatOffset, 28);
    packBuffer.writeUInt32LE(splatBytes, 32);
    packBuffer.writeUInt32LE(HEADER_BYTES, 36);
    packBuffer.writeUInt32LE(propOffset, 40);
    packBuffer.writeUInt32LE(propRecords.length, 44);

    for (let chunkIndex = 0; chunkIndex < chunksPerPackTotal; chunkIndex += 1) {
      const localX = chunkIndex % world.chunksPerPack;
      const localZ = Math.floor(chunkIndex / world.chunksPerPack);
      const offset = HEADER_BYTES + chunkIndex * CHUNK_INDEX_BYTES;
      packBuffer.writeUInt16LE(localX * (world.chunkSizeMeters / world.heightResolutionMeters), offset);
      packBuffer.writeUInt16LE(localZ * (world.chunkSizeMeters / world.heightResolutionMeters), offset + 2);
      packBuffer.writeUInt16LE(localX * (world.chunkSizeMeters / world.splatResolutionMeters), offset + 4);
      packBuffer.writeUInt16LE(localZ * (world.chunkSizeMeters / world.splatResolutionMeters), offset + 6);
      packBuffer.writeUInt32LE(chunkRanges[chunkIndex].first, offset + 8);
      packBuffer.writeUInt32LE(chunkRanges[chunkIndex].count, offset + 12);
    }

    const heightBuffer = Buffer.from(heights.buffer, heights.byteOffset, heights.byteLength);
    const littleEndianHeightBuffer = endianness() === 'LE' ? heightBuffer : Buffer.from(heightBuffer).swap16();
    littleEndianHeightBuffer.copy(packBuffer, heightOffset);
    Buffer.from(splat.buffer, splat.byteOffset, splat.byteLength).copy(packBuffer, splatOffset);
    for (let index = 0; index < propRecords.length; index += 1) {
      const prop = propRecords[index];
      const offset = propOffset + index * PROP_RECORD_BYTES;
      packBuffer.writeUInt16LE(prop.x, offset);
      packBuffer.writeUInt16LE(prop.z, offset + 2);
      packBuffer.writeUInt16LE(prop.yaw, offset + 4);
      packBuffer.writeUInt16LE(prop.scale, offset + 6);
      packBuffer[offset + 8] = prop.type;
      packBuffer[offset + 9] = prop.variant;
      packBuffer[offset + 10] = prop.tint;
      packBuffer[offset + 11] = prop.flags;
    }

    const filename = `r${regionX.toString().padStart(2, '0')}_${regionZ.toString().padStart(2, '0')}.wpk`;
    expectedPackNames.add(filename);
    await writeIfChanged(resolve(packRoot, filename), packBuffer);
    const packHash = sha256(packBuffer);
    packEntries.push({
      id: `r${regionX}_${regionZ}`,
      url: `packs/${filename}`,
      region: [regionX, regionZ],
      bounds: {
        minX: regionMinX,
        minZ: regionMinZ,
        maxX: Math.min(regionMinX + packSize, worldMaxX),
        maxZ: Math.min(regionMinZ + packSize, worldMaxZ),
      },
      byteLength: packBuffer.length,
      sha256: packHash,
      heightRangeMeters: [Number(packMinHeight.toFixed(1)), Number(packMaxHeight.toFixed(1))],
      propCount: propRecords.length,
      propCounts: Object.fromEntries(recipe.props.catalog.map((item) => [item.key, packPropsByType[item.id]])),
    });
    globalMinHeight = Math.min(globalMinHeight, packMinHeight);
    globalMaxHeight = Math.max(globalMaxHeight, packMaxHeight);
    totalProps += propRecords.length;
    totalBytes += packBuffer.length;
  }
  console.log(`  packs row ${regionZ + 1}/${packsPerSide} complete`);
}

for (const filename of await readdir(packRoot)) {
  if (/^r\d{2}_\d{2}\.wpk$/.test(filename) && !expectedPackNames.has(filename)) await unlink(resolve(packRoot, filename));
}

const recipeHash = sha256(recipeBytes);
const featuresHash = sha256(featuresBytes);
const contentHash = sha256(`${recipeHash}:${featuresHash}:${packEntries.map((entry) => entry.sha256).join(':')}`);
const manifest = {
  format: 'skyline-world-manifest',
  version: FORMAT_VERSION,
  contentHash,
  recipeSha256: recipeHash,
  generator: {
    name: 'Skyline deterministic offline worldgen',
    version: '3.0.0',
    dependencies: [],
  },
  world: {
    sizeMeters: world.sizeMeters,
    bounds: { minX: world.minX, minZ: world.minZ, maxX: worldMaxX, maxZ: worldMaxZ },
    heightRangeMeters: [Number(globalMinHeight.toFixed(1)), Number(globalMaxHeight.toFixed(1))],
    chunkSizeMeters: world.chunkSizeMeters,
    chunksPerSide,
    chunksTotal: chunksPerSide ** 2,
    packSizeMeters: packSize,
    packsPerSide,
    packsTotal: packEntries.length,
  },
  encoding: {
    byteOrder: 'little-endian',
    height: {
      storage: 'Uint16',
      resolutionMeters: world.heightResolutionMeters,
      samplesPerPackSide: heightSamples,
      offsetMeters: world.heightQuantization.offsetMeters,
      scaleMeters: world.heightQuantization.scaleMeters,
      decode: 'meters = offsetMeters + uint16 * scaleMeters',
    },
    splat: {
      storage: 'Uint8',
      resolutionMeters: world.splatResolutionMeters,
      samplesPerPackSide: splatSamples,
      decode: 'primary = byte & 7; secondary = (byte >> 3) & 7; blend = (byte >> 6) / 3',
      palette: recipe.biomes.palette,
    },
    props: {
      recordBytes: PROP_RECORD_BYTES,
      format: recipe.props.recordFormat,
      positionDecode: 'world = packMin + uint16 / 65535 * packSizeMeters; y = sampled terrain height',
      yawDecode: 'radians = uint16 / 65536 * TAU',
      scaleDecode: 'scale = uint16 / 1000',
      flagBits: { nearWater: 1, steepGround: 2 },
      catalog: recipe.props.catalog,
    },
    packHeader: {
      magic: FORMAT_MAGIC,
      bytes: HEADER_BYTES,
      chunkIndexBytes: CHUNK_INDEX_BYTES,
      flags: { littleEndian: 1, packedBiome: 2, propYFromTerrain: 4 },
    },
  },
  streaming: {
    fullLodThroughMeters: 768,
    halfLodThroughMeters: 1536,
    quarterLodBeyondMeters: 1536,
    loadRadiusMeters: 1536,
    unloadRadiusMeters: 2048,
    floatingOriginThresholdMeters: 2048,
  },
  features: {
    url: 'features.json',
    byteLength: featuresBytes.length,
    sha256: featuresHash,
    bridgeCount: featurePayload.bridges.length,
    landmarkCount: featurePayload.landmarks.length,
  },
  summary: {
    packBytes: totalBytes,
    propCount: totalProps,
    propCounts: Object.fromEntries(recipe.props.catalog.map((item) => [item.key, totalPropsByType[item.id]])),
    propCountsByBiome: Object.fromEntries(recipe.biomes.palette.map((item) => [item.key, totalPropsByBiome[item.id]])),
  },
  packs: packEntries,
};
const manifestBytes = Buffer.from(prettyJson(manifest));
await writeIfChanged(resolve(outputRoot, 'manifest.json'), manifestBytes);
await writeIfChanged(resolve(outputRoot, 'generation-report.json'), Buffer.from(prettyJson({
  contentHash,
  recipeSha256: recipeHash,
  world: manifest.world,
  summary: manifest.summary,
  files: {
    manifestBytes: manifestBytes.length,
    featuresBytes: featuresBytes.length,
    packBytes: totalBytes,
    totalBytes: totalBytes + manifestBytes.length + featuresBytes.length,
  },
})));

console.log(`Generated ${packEntries.length} packs, ${(totalBytes / 1048576).toFixed(2)} MiB, ${totalProps.toLocaleString()} props.`);
console.log(`Height range ${globalMinHeight.toFixed(1)}..${globalMaxHeight.toFixed(1)} m; content ${contentHash.slice(0, 16)}…`);
