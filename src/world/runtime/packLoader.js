import { parseWorldPack, samplePackHeight } from './packFormat.js';

function joinAssetUrl(root, path) {
  return `${root.replace(/\/$/, '')}/${path.replace(/^\.\//, '')}`;
}

function requireResponse(response, url) {
  if (!response || response.ok === false) {
    const status = response ? `${response.status || ''} ${response.statusText || ''}`.trim() : 'no response';
    throw new Error(`Unable to load Skyline world asset ${url}: ${status}`);
  }
  return response;
}

function validateManifest(manifest) {
  if (manifest.format !== 'skyline-world-manifest' || manifest.version !== 3) {
    throw new Error('Unsupported Skyline world manifest. Expected version 3.');
  }
  const world = manifest.world;
  const height = manifest.encoding && manifest.encoding.height;
  if (!world || world.sizeMeters !== 8192 || world.chunkSizeMeters !== 256 || world.chunksPerSide !== 32) {
    throw new Error('Skyline world manifest does not describe the locked 8 km / 256 m chunk layout.');
  }
  if (!height || height.storage !== 'Uint16' || height.resolutionMeters !== 2) {
    throw new Error('Skyline world manifest does not contain the required 2 m Uint16 heightfield.');
  }
  if (!Array.isArray(manifest.packs) || manifest.packs.length !== world.packsTotal) {
    throw new Error('Skyline world manifest pack table is incomplete.');
  }
  return manifest;
}

export class WorldPackLoader {
  constructor(assetRoot, fetchFn = globalThis.fetch) {
    if (typeof fetchFn !== 'function') throw new Error('A fetch implementation is required to stream the world.');
    this.assetRoot = assetRoot;
    this.fetchFn = fetchFn;
    this.manifest = null;
    this.entries = null;
    this.packsPerSide = 0;
    this.disposed = false;
    this.ready = this.#loadManifest();
  }

  async #loadManifest() {
    const url = joinAssetUrl(this.assetRoot, 'manifest.json');
    const response = requireResponse(await this.fetchFn(url), url);
    const manifest = validateManifest(await response.json());
    if (this.disposed) throw new Error('World pack loader was disposed during manifest loading.');
    this.manifest = manifest;
    this.packsPerSide = manifest.world.packsPerSide;
    this.entries = new Array(manifest.world.packsTotal);
    for (let index = 0; index < this.entries.length; index += 1) {
      this.entries[index] = {
        descriptor: null,
        refs: 0,
        pack: null,
        promise: null,
        serial: 0,
      };
    }
    for (let index = 0; index < manifest.packs.length; index += 1) {
      const descriptor = manifest.packs[index];
      const slot = descriptor.region[1] * this.packsPerSide + descriptor.region[0];
      this.entries[slot].descriptor = descriptor;
    }
    for (let index = 0; index < this.entries.length; index += 1) {
      if (!this.entries[index].descriptor) throw new Error(`World manifest is missing pack slot ${index}.`);
    }
    return manifest;
  }

  getIndex(regionX, regionZ) {
    if (regionX < 0 || regionZ < 0 || regionX >= this.packsPerSide || regionZ >= this.packsPerSide) return -1;
    return regionZ * this.packsPerSide + regionX;
  }

  retain(regionX, regionZ) {
    const index = this.getIndex(regionX, regionZ);
    if (index < 0) return Promise.reject(new RangeError(`World pack ${regionX},${regionZ} is out of bounds.`));
    const entry = this.entries[index];
    entry.refs += 1;
    return this.#load(index, entry);
  }

  #load(index, entry) {
    if (entry.pack) return Promise.resolve(entry.pack);
    if (entry.promise) return entry.promise;
    const descriptor = entry.descriptor;
    const url = joinAssetUrl(this.assetRoot, descriptor.url);
    const serial = ++entry.serial;
    entry.promise = Promise.resolve(this.fetchFn(url))
      .then((response) => requireResponse(response, url).arrayBuffer())
      .then((buffer) => {
        const pack = parseWorldPack(buffer, this.manifest, descriptor.region[0], descriptor.region[1]);
        if (pack.byteLength !== descriptor.byteLength) {
          throw new Error(`World pack ${descriptor.id} has ${pack.byteLength} bytes, expected ${descriptor.byteLength}.`);
        }
        if (this.disposed || entry.serial !== serial) return pack;
        entry.promise = null;
        if (entry.refs > 0) entry.pack = pack;
        return pack;
      })
      .catch((error) => {
        if (entry.serial === serial) entry.promise = null;
        throw error;
      });
    return entry.promise;
  }

  release(regionX, regionZ) {
    const index = this.getIndex(regionX, regionZ);
    if (index < 0 || !this.entries) return;
    const entry = this.entries[index];
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0 && entry.pack) entry.pack = null;
  }

  getLoaded(regionX, regionZ) {
    const index = this.getIndex(regionX, regionZ);
    return index < 0 || !this.entries ? null : this.entries[index].pack;
  }

  getPackCoordinates(worldX, worldZ, target) {
    const world = this.manifest.world;
    const packSize = world.packSizeMeters;
    const maximum = world.packsPerSide - 1;
    target.x = Math.min(maximum, Math.max(0, Math.floor((worldX - world.bounds.minX) / packSize)));
    target.z = Math.min(maximum, Math.max(0, Math.floor((worldZ - world.bounds.minZ) / packSize)));
    return target;
  }

  sampleHeight(worldX, worldZ) {
    if (!this.manifest) return Number.NaN;
    const bounds = this.manifest.world.bounds;
    if (worldX < bounds.minX || worldZ < bounds.minZ || worldX > bounds.maxX || worldZ > bounds.maxZ) return Number.NaN;
    const packSize = this.manifest.world.packSizeMeters;
    const maximum = this.manifest.world.packsPerSide - 1;
    const regionX = Math.min(maximum, Math.floor((worldX - bounds.minX) / packSize));
    const regionZ = Math.min(maximum, Math.floor((worldZ - bounds.minZ) / packSize));
    const pack = this.getLoaded(regionX, regionZ);
    return pack ? samplePackHeight(pack, this.manifest, worldX, worldZ) : Number.NaN;
  }

  updateStats(target) {
    let loadedPacks = 0;
    let decodedBytes = 0;
    if (this.entries) {
      for (let index = 0; index < this.entries.length; index += 1) {
        const pack = this.entries[index].pack;
        if (pack) {
          loadedPacks += 1;
          decodedBytes += pack.byteLength;
        }
      }
    }
    target.loadedPacks = loadedPacks;
    target.decodedPackBytes = decodedBytes;
  }

  forEachLoadedPack(callback) {
    if (!this.entries || typeof callback !== 'function') return;
    const world = this.manifest.world;
    const packSize = world.packSizeMeters;
    for (let index = 0; index < this.entries.length; index += 1) {
      const pack = this.entries[index].pack;
      if (!pack) continue;
      const minX = world.bounds.minX + pack.regionX * packSize;
      const minZ = world.bounds.minZ + pack.regionZ * packSize;
      callback(pack, minX, minZ, minX + packSize, minZ + packSize);
    }
  }

  dispose() {
    this.disposed = true;
    if (!this.entries) return;
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      entry.serial += 1;
      entry.refs = 0;
      entry.pack = null;
      entry.promise = null;
    }
  }
}
