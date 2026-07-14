const MAGIC = 0x33575653; // "SVW3" as little-endian Uint32.
const HEADER_BYTES = 48;
const CHUNK_ENTRY_BYTES = 16;

function assertRange(condition, message) {
  if (!condition) throw new Error(`Invalid Skyline world pack: ${message}`);
}

export function parseWorldPack(arrayBuffer, manifest, expectedRegionX = -1, expectedRegionZ = -1) {
  assertRange(arrayBuffer instanceof ArrayBuffer, 'payload is not an ArrayBuffer');
  assertRange(arrayBuffer.byteLength >= HEADER_BYTES, 'payload is shorter than its header');

  const view = new DataView(arrayBuffer);
  assertRange(view.getUint32(0, true) === MAGIC, 'magic is not SVW3');

  const version = view.getUint16(4, true);
  const flags = view.getUint16(6, true);
  const regionX = view.getUint16(8, true);
  const regionZ = view.getUint16(10, true);
  const chunksPerSide = view.getUint16(12, true);
  const heightSamples = view.getUint16(14, true);
  const splatSamples = view.getUint16(16, true);
  const propRecordBytes = view.getUint16(18, true);
  const heightOffset = view.getUint32(20, true);
  const heightBytes = view.getUint32(24, true);
  const splatOffset = view.getUint32(28, true);
  const splatBytes = view.getUint32(32, true);
  const chunkTableOffset = view.getUint32(36, true);
  const propOffset = view.getUint32(40, true);
  const propCount = view.getUint32(44, true);

  const chunkCount = chunksPerSide * chunksPerSide;
  assertRange(version === manifest.version, `version ${version} does not match manifest ${manifest.version}`);
  assertRange((flags & 1) !== 0, 'little-endian flag is missing');
  assertRange(expectedRegionX < 0 || regionX === expectedRegionX, `region X is ${regionX}, expected ${expectedRegionX}`);
  assertRange(expectedRegionZ < 0 || regionZ === expectedRegionZ, `region Z is ${regionZ}, expected ${expectedRegionZ}`);
  assertRange(chunksPerSide > 0, 'chunks-per-side is zero');
  assertRange(heightSamples * heightSamples * 2 === heightBytes, 'height byte count is inconsistent');
  assertRange(splatSamples * splatSamples === splatBytes, 'splat byte count is inconsistent');
  assertRange(chunkTableOffset + chunkCount * CHUNK_ENTRY_BYTES <= heightOffset, 'chunk table overlaps heights');
  assertRange(heightOffset + heightBytes <= splatOffset, 'height block overlaps splat block');
  assertRange(splatOffset + splatBytes <= propOffset, 'splat block overlaps prop block');
  assertRange(propOffset + propCount * propRecordBytes === arrayBuffer.byteLength, 'prop block does not end at EOF');

  // Supported iPhones and all current browser targets are little-endian. Keeping
  // this view over the fetched buffer avoids an unnecessary 0.5 MB copy per pack.
  const endianProbe = new Uint16Array(new Uint8Array([1, 0]).buffer)[0];
  assertRange(endianProbe === 1, 'runtime platform is not little-endian');

  return {
    arrayBuffer,
    view,
    version,
    flags,
    regionX,
    regionZ,
    chunksPerSide,
    heightSamples,
    splatSamples,
    propRecordBytes,
    heightOffset,
    heightBytes,
    splatOffset,
    splatBytes,
    chunkTableOffset,
    propOffset,
    propCount,
    heights: new Uint16Array(arrayBuffer, heightOffset, heightBytes >>> 1),
    splats: new Uint8Array(arrayBuffer, splatOffset, splatBytes),
    props: new Uint8Array(arrayBuffer, propOffset, propCount * propRecordBytes),
    byteLength: arrayBuffer.byteLength,
  };
}

export function readChunkEntry(pack, localX, localZ, target) {
  if (localX < 0 || localZ < 0 || localX >= pack.chunksPerSide || localZ >= pack.chunksPerSide) {
    throw new RangeError(`Chunk ${localX},${localZ} is outside pack ${pack.regionX},${pack.regionZ}`);
  }
  const offset = pack.chunkTableOffset + (localZ * pack.chunksPerSide + localX) * CHUNK_ENTRY_BYTES;
  const view = pack.view;
  target.heightStartX = view.getUint16(offset, true);
  target.heightStartZ = view.getUint16(offset + 2, true);
  target.splatStartX = view.getUint16(offset + 4, true);
  target.splatStartZ = view.getUint16(offset + 6, true);
  target.propFirst = view.getUint32(offset + 8, true);
  target.propCount = view.getUint32(offset + 12, true);
  return target;
}

export function decodeHeightSample(pack, manifest, sampleX, sampleZ) {
  const encoding = manifest.encoding.height;
  return encoding.offsetMeters + pack.heights[sampleZ * pack.heightSamples + sampleX] * encoding.scaleMeters;
}

export function samplePackHeight(pack, manifest, worldX, worldZ) {
  const packSize = manifest.world.packSizeMeters;
  const minX = manifest.world.bounds.minX + pack.regionX * packSize;
  const minZ = manifest.world.bounds.minZ + pack.regionZ * packSize;
  const spacing = manifest.encoding.height.resolutionMeters;
  const maximum = pack.heightSamples - 1;
  const fx = Math.max(0, Math.min(maximum, (worldX - minX) / spacing));
  const fz = Math.max(0, Math.min(maximum, (worldZ - minZ) / spacing));
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(maximum, x0 + 1);
  const z1 = Math.min(maximum, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const offset = manifest.encoding.height.offsetMeters;
  const scale = manifest.encoding.height.scaleMeters;
  const row0 = z0 * pack.heightSamples;
  const row1 = z1 * pack.heightSamples;
  const h00 = offset + pack.heights[row0 + x0] * scale;
  const h10 = offset + pack.heights[row0 + x1] * scale;
  const h01 = offset + pack.heights[row1 + x0] * scale;
  const h11 = offset + pack.heights[row1 + x1] * scale;
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * tz;
}

export const WORLD_PACK_HEADER_BYTES = HEADER_BYTES;
export const WORLD_CHUNK_ENTRY_BYTES = CHUNK_ENTRY_BYTES;
