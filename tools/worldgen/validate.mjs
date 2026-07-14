import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHUNK_INDEX_BYTES,
  FORMAT_VERSION,
  HEADER_BYTES,
  PROP_RECORD_BYTES,
  parsePackHeader,
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
const worldRoot = argumentValue('--world', resolve(PROJECT_ROOT, 'assets', 'world'));
const recipeBytes = await readFile(recipePath);
const recipe = JSON.parse(recipeBytes.toString('utf8'));
const manifest = await readJson(resolve(worldRoot, 'manifest.json'));
const featuresBytes = await readFile(resolve(worldRoot, manifest.features.url));
const features = JSON.parse(featuresBytes.toString('utf8'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

validateRecipe(recipe);
check(manifest.format === 'skyline-world-manifest' && manifest.version === FORMAT_VERSION, 'manifest format/version mismatch');
check(manifest.recipeSha256 === sha256(recipeBytes), 'recipe SHA-256 mismatch');
check(manifest.features.sha256 === sha256(featuresBytes), 'features SHA-256 mismatch');
check(features.bridges?.length === 5, 'features must contain exactly five bridges');
check(features.landmarks?.length >= 5, 'features must contain at least five landmarks');
check(features.water?.river?.points?.length >= 4, 'river render spline is incomplete');
check(features.water?.lake, 'lake render definition is missing');
check(features.city?.plateau, 'city plateau definition is missing');
check(manifest.world.sizeMeters === 8192, 'world size must be 8 km by 8 km');
check(manifest.world.chunksTotal === 1024, 'world must contain 1024 logical chunks');
check(manifest.world.packsTotal === 64 && manifest.packs.length === 64, 'world must contain 64 grouped packs');
check(manifest.encoding.height.storage === 'Uint16' && manifest.encoding.height.resolutionMeters === 2, 'height encoding must be Uint16 at 2 m');
check(manifest.encoding.splat.storage === 'Uint8', 'splat encoding must be Uint8');
check(manifest.encoding.props.recordBytes === PROP_RECORD_BYTES, 'prop record size mismatch');

const packs = new Map();
const seenRegions = new Set();
const biomeUse = new Uint32Array(8);
const propTypeUse = new Uint32Array(recipe.props.catalog.length);
let checkedProps = 0;
let checkedHeightSamples = 0;
let checkedSplatSamples = 0;
let summedPackBytes = 0;
let summedProps = 0;

for (const entry of manifest.packs) {
  const key = `${entry.region[0]},${entry.region[1]}`;
  check(!seenRegions.has(key), `duplicate pack region ${key}`);
  seenRegions.add(key);
  const bytes = await readFile(resolve(worldRoot, entry.url));
  const header = parsePackHeader(bytes);
  packs.set(key, { entry, bytes, header });
  summedPackBytes += bytes.length;
  summedProps += header.propCount;

  check(bytes.length === entry.byteLength, `${entry.id}: byte length mismatch`);
  check(sha256(bytes) === entry.sha256, `${entry.id}: SHA-256 mismatch`);
  check(header.version === FORMAT_VERSION, `${entry.id}: pack version mismatch`);
  check(header.regionX === entry.region[0] && header.regionZ === entry.region[1], `${entry.id}: region header mismatch`);
  check(header.chunksPerSide === recipe.world.chunksPerPack, `${entry.id}: chunk count mismatch`);
  check(header.heightSamples === 513 && header.heightBytes === 513 * 513 * 2, `${entry.id}: height block dimensions invalid`);
  check(header.splatSamples === 257 && header.splatBytes === 257 * 257, `${entry.id}: splat block dimensions invalid`);
  check(header.propRecordBytes === PROP_RECORD_BYTES, `${entry.id}: prop record bytes invalid`);
  check(header.chunkTableOffset === HEADER_BYTES, `${entry.id}: chunk table offset invalid`);
  check(header.heightOffset >= HEADER_BYTES + 16 * CHUNK_INDEX_BYTES, `${entry.id}: height offset overlaps chunk table`);
  check(header.splatOffset >= header.heightOffset + header.heightBytes, `${entry.id}: splat offset overlaps height data`);
  check(header.propOffset >= header.splatOffset + header.splatBytes, `${entry.id}: prop offset overlaps splat data`);
  check(header.propOffset + header.propCount * PROP_RECORD_BYTES === bytes.length, `${entry.id}: prop block length invalid`);
  check(header.propCount === entry.propCount, `${entry.id}: prop count differs from manifest`);

  let expectedFirst = 0;
  for (let chunkIndex = 0; chunkIndex < 16; chunkIndex += 1) {
    const offset = header.chunkTableOffset + chunkIndex * CHUNK_INDEX_BYTES;
    const localX = chunkIndex % 4;
    const localZ = Math.floor(chunkIndex / 4);
    const heightX = bytes.readUInt16LE(offset);
    const heightZ = bytes.readUInt16LE(offset + 2);
    const splatX = bytes.readUInt16LE(offset + 4);
    const splatZ = bytes.readUInt16LE(offset + 6);
    const propFirst = bytes.readUInt32LE(offset + 8);
    const propCount = bytes.readUInt32LE(offset + 12);
    check(heightX === localX * 128 && heightZ === localZ * 128, `${entry.id}: chunk ${chunkIndex} height origin invalid`);
    check(splatX === localX * 64 && splatZ === localZ * 64, `${entry.id}: chunk ${chunkIndex} splat origin invalid`);
    check(propFirst === expectedFirst, `${entry.id}: chunk ${chunkIndex} prop range is not contiguous`);
    check(propFirst + propCount <= header.propCount, `${entry.id}: chunk ${chunkIndex} prop range exceeds block`);
    expectedFirst += propCount;

    for (let propIndex = propFirst; propIndex < propFirst + propCount; propIndex += 1) {
      const propOffset = header.propOffset + propIndex * PROP_RECORD_BYTES;
      const x = bytes.readUInt16LE(propOffset) / 65535 * 1024;
      const z = bytes.readUInt16LE(propOffset + 2) / 65535 * 1024;
      const scale = bytes.readUInt16LE(propOffset + 6) / 1000;
      const type = bytes[propOffset + 8];
      check(x >= localX * 256 - 0.05 && x <= (localX + 1) * 256 + 0.05, `${entry.id}: prop ${propIndex} is indexed under the wrong X chunk`);
      check(z >= localZ * 256 - 0.05 && z <= (localZ + 1) * 256 + 0.05, `${entry.id}: prop ${propIndex} is indexed under the wrong Z chunk`);
      check(type < recipe.props.catalog.length, `${entry.id}: prop ${propIndex} has unknown type ${type}`);
      check(scale > 0.1 && scale < 4, `${entry.id}: prop ${propIndex} scale ${scale} is unreasonable`);
      if (type < propTypeUse.length) propTypeUse[type] += 1;
      checkedProps += 1;
    }
  }
  check(expectedFirst === header.propCount, `${entry.id}: chunk prop ranges do not cover every record`);

  for (let index = 0; index < header.heightBytes; index += 2) {
    const value = bytes.readUInt16LE(header.heightOffset + index);
    check(value <= 65535, `${entry.id}: impossible height value`);
    checkedHeightSamples += 1;
  }
  for (let index = 0; index < header.splatBytes; index += 1) {
    const value = bytes[header.splatOffset + index];
    biomeUse[value & 7] += 1;
    biomeUse[(value >>> 3) & 7] += 1;
    checkedSplatSamples += 1;
  }
}

check(summedPackBytes === manifest.summary.packBytes, 'summed pack bytes differ from manifest');
check(summedProps === manifest.summary.propCount, 'summed prop count differs from manifest');
check(checkedProps === summedProps, 'validated prop count differs from pack headers');
for (let biome = 0; biome < biomeUse.length; biome += 1) check(biomeUse[biome] > 0, `biome ${biome} never appears in splat data`);
for (let type = 0; type < propTypeUse.length; type += 1) check(propTypeUse[type] > 0, `prop type ${type} never appears in placement data`);

function heightAt(pack, x, z) {
  return pack.bytes.readUInt16LE(pack.header.heightOffset + (z * pack.header.heightSamples + x) * 2);
}

function splatAt(pack, x, z) {
  return pack.bytes[pack.header.splatOffset + z * pack.header.splatSamples + x];
}

let seamHeightSamples = 0;
let seamSplatSamples = 0;
for (let z = 0; z < 8; z += 1) {
  for (let x = 0; x < 8; x += 1) {
    const pack = packs.get(`${x},${z}`);
    check(Boolean(pack), `missing region ${x},${z}`);
    if (!pack) continue;
    if (x < 7) {
      const right = packs.get(`${x + 1},${z}`);
      for (let sample = 0; sample < 513; sample += 1) {
        check(heightAt(pack, 512, sample) === heightAt(right, 0, sample), `height seam mismatch at regions ${x},${z}/${x + 1},${z}, sample ${sample}`);
        seamHeightSamples += 1;
      }
      for (let sample = 0; sample < 257; sample += 1) {
        check(splatAt(pack, 256, sample) === splatAt(right, 0, sample), `splat seam mismatch at regions ${x},${z}/${x + 1},${z}, sample ${sample}`);
        seamSplatSamples += 1;
      }
    }
    if (z < 7) {
      const top = packs.get(`${x},${z + 1}`);
      for (let sample = 0; sample < 513; sample += 1) {
        check(heightAt(pack, sample, 512) === heightAt(top, sample, 0), `height seam mismatch at regions ${x},${z}/${x},${z + 1}, sample ${sample}`);
        seamHeightSamples += 1;
      }
      for (let sample = 0; sample < 257; sample += 1) {
        check(splatAt(pack, sample, 256) === splatAt(top, sample, 0), `splat seam mismatch at regions ${x},${z}/${x},${z + 1}, sample ${sample}`);
        seamSplatSamples += 1;
      }
    }
  }
}

const recomputedContentHash = sha256(`${manifest.recipeSha256}:${manifest.features.sha256}:${manifest.packs.map((entry) => entry.sha256).join(':')}`);
check(recomputedContentHash === manifest.contentHash, 'world content hash mismatch');

if (failures.length > 0) {
  console.error(`World validation failed with ${failures.length} issue(s):`);
  for (const message of failures.slice(0, 100)) console.error(`- ${message}`);
  if (failures.length > 100) console.error(`- …and ${failures.length - 100} more`);
  process.exitCode = 1;
} else {
  console.log('World validation passed.');
  console.log(`  64 packs / ${manifest.world.chunksTotal} chunks / ${(summedPackBytes / 1048576).toFixed(2)} MiB`);
  console.log(`  ${checkedHeightSamples.toLocaleString()} Uint16 heights; ${checkedSplatSamples.toLocaleString()} Uint8 splats`);
  console.log(`  ${seamHeightSamples.toLocaleString()} height seam checks; ${seamSplatSamples.toLocaleString()} splat seam checks`);
  console.log(`  ${checkedProps.toLocaleString()} prop records; all ${propTypeUse.length} types and all ${biomeUse.length} biomes present`);
  console.log(`  content ${manifest.contentHash}`);
}
