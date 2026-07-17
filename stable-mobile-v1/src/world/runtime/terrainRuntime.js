import * as THREE from '../../../vendor/three.module.min.js';
import { CONFIG } from '../../config.js';
import { WorldPackLoader } from './packLoader.js';
import { readChunkEntry } from './packFormat.js';
import {
  createTerrainGeometry,
  createTerrainPalette,
  terrainTriangleCount,
} from './terrainGeometry.js';

const NO_LOD = 255;

function option(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function positionX(position, fallback) {
  if (Array.isArray(position)) return option(position[0], fallback);
  return position && Number.isFinite(position.x) ? position.x : fallback;
}

function positionZ(position, fallback) {
  if (Array.isArray(position)) return option(position[2], fallback);
  return position && Number.isFinite(position.z) ? position.z : fallback;
}

export class TerrainRuntime {
  constructor(scene, options = {}) {
    if (!scene || typeof scene.add !== 'function') throw new Error('TerrainRuntime requires a THREE.Scene or Group.');
    this.scene = scene;
    this.options = options;
    this.group = new THREE.Group();
    this.group.name = 'Streamed 8 km terrain';
    this.group.matrixAutoUpdate = false;
    this.scene.add(this.group);
    this.emptyGeometry = new THREE.BufferGeometry();
    this.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: false,
      fog: true,
    });
    this.material.name = 'Shared terrain vertex-colour material';
    this.loader = new WorldPackLoader(options.assetRoot || CONFIG.world.assetRoot, options.fetchFn);
    this.manifest = null;
    this.states = null;
    this.desiredLods = null;
    this.distanceSquared = null;
    this.buildQueue = null;
    this.queueRead = 0;
    this.queueWrite = 0;
    this.queueCount = 0;
    this.palette = null;
    this.disposed = false;
    this.initialized = false;
    this.hasPendingUpdate = false;
    this.lastX = CONFIG.world.spawn[0];
    this.lastZ = CONFIG.world.spawn[2];
    this.preloadX = this.lastX;
    this.preloadZ = this.lastZ;
    this.preloadSerial = 0;
    this.activePreload = 0;
    this.renderOriginX = 0;
    this.renderOriginZ = 0;
    this.firstError = null;
    this.stats = {
      revision: 0,
      manifestHash: '',
      loadedChunks: 0,
      loadingChunks: 0,
      loadedPacks: 0,
      decodedPackBytes: 0,
      visibleTerrainTriangles: 0,
      terrainDrawCalls: 0,
      targetTerrainTriangles: 0,
      queuedBuilds: 0,
      lod4mChunks: 0,
      lod8mChunks: 0,
      lod16mChunks: 0,
      budgetLimited: false,
      lastError: '',
    };
    this.ready = this.loader.ready.then((manifest) => {
      this.#initialize(manifest);
      if (this.hasPendingUpdate) this.#updateAt(this.lastX, this.lastZ, 0);
      return this;
    });
  }

  #initialize(manifest) {
    if (this.disposed) throw new Error('Terrain runtime was disposed before initialization.');
    this.manifest = manifest;
    const world = manifest.world;
    const configured = CONFIG.world;
    this.chunkSize = world.chunkSizeMeters;
    this.chunksPerSide = world.chunksPerSide;
    this.chunksPerPack = this.chunkSize > 0 ? world.packSizeMeters / this.chunkSize : 0;
    this.loadRadius = option(this.options.loadRadius, option(configured.loadRadius, manifest.streaming.loadRadiusMeters));
    this.unloadRadius = Math.max(
      this.loadRadius,
      option(this.options.unloadRadius, option(configured.unloadRadius, manifest.streaming.unloadRadiusMeters)),
    );
    this.fullLodRadius = option(this.options.fullLodRadius, option(configured.fullLodRadius, manifest.streaming.fullLodThroughMeters));
    this.halfLodRadius = Math.max(
      this.fullLodRadius,
      option(this.options.halfLodRadius, option(configured.halfLodRadius, manifest.streaming.halfLodThroughMeters)),
    );
    this.lodSpacings = new Uint8Array([
      option(this.options.renderSpacingFull, configured.renderSpacingFull),
      option(this.options.renderSpacingHalf, configured.renderSpacingHalf),
      option(this.options.renderSpacingFar, configured.renderSpacingFar),
    ]);
    this.maxTriangles = option(this.options.maxVisibleTriangles, CONFIG.performance.maxVisibleTriangles);
    this.buildsPerUpdate = Math.max(1, Math.floor(option(this.options.buildsPerUpdate, 2)));
    this.skirtDepth = option(this.options.skirtDepth, 36);
    this.trianglesByLod = new Uint32Array(3);
    for (let lod = 0; lod < 3; lod += 1) {
      this.trianglesByLod[lod] = terrainTriangleCount(this.chunkSize, this.lodSpacings[lod]);
    }
    this.loadRadiusSquared = this.loadRadius * this.loadRadius;
    this.unloadRadiusSquared = this.unloadRadius * this.unloadRadius;
    this.fullLodRadiusSquared = this.fullLodRadius * this.fullLodRadius;
    this.halfLodRadiusSquared = this.halfLodRadius * this.halfLodRadius;
    this.palette = createTerrainPalette(manifest);

    const stateCount = this.chunksPerSide * this.chunksPerSide;
    this.states = new Array(stateCount);
    this.desiredLods = new Uint8Array(stateCount);
    this.desiredLods.fill(NO_LOD);
    this.distanceSquared = new Float64Array(stateCount);
    this.buildQueue = new Uint16Array(stateCount * 2);
    const minX = world.bounds.minX;
    const minZ = world.bounds.minZ;
    for (let chunkZ = 0; chunkZ < this.chunksPerSide; chunkZ += 1) {
      for (let chunkX = 0; chunkX < this.chunksPerSide; chunkX += 1) {
        const index = chunkZ * this.chunksPerSide + chunkX;
        const chunkMinX = minX + chunkX * this.chunkSize;
        const chunkMinZ = minZ + chunkZ * this.chunkSize;
        const regionX = Math.floor(chunkX / this.chunksPerPack);
        const regionZ = Math.floor(chunkZ / this.chunksPerPack);
        this.states[index] = {
          index,
          chunkX,
          chunkZ,
          minX: chunkMinX,
          minZ: chunkMinZ,
          maxX: chunkMinX + this.chunkSize,
          maxZ: chunkMinZ + this.chunkSize,
          centerX: chunkMinX + this.chunkSize * 0.5,
          centerZ: chunkMinZ + this.chunkSize * 0.5,
          regionX,
          regionZ,
          packMinX: minX + regionX * world.packSizeMeters,
          packMinZ: minZ + regionZ * world.packSizeMeters,
          packMaxX: minX + (regionX + 1) * world.packSizeMeters,
          packMaxZ: minZ + (regionZ + 1) * world.packSizeMeters,
          localX: chunkX % this.chunksPerPack,
          localZ: chunkZ % this.chunksPerPack,
          heightStartX: 0,
          heightStartZ: 0,
          splatStartX: 0,
          splatStartZ: 0,
          propFirst: 0,
          propCount: 0,
          propByteOffset: 0,
          desiredLod: 2,
          lod: 2,
          status: 0,
          token: 0,
          retained: false,
          queued: false,
          pack: null,
          mesh: null,
          loadPromise: null,
        };
      }
    }
    this.stats.manifestHash = manifest.contentHash;
    this.initialized = true;
    this.stats.revision += 1;
    this.#refreshStats();
  }

  update(playerPosition) {
    // A respawn preload is an atomic streaming operation. RAF updates can
    // still arrive with the stale crash position while its pack requests are
    // in flight; keep those updates pinned to the preload target so they do
    // not deactivate the very chunks the respawn is waiting for.
    const x = this.activePreload ? this.preloadX : positionX(playerPosition, this.lastX);
    const z = this.activePreload ? this.preloadZ : positionZ(playerPosition, this.lastZ);
    this.lastX = x;
    this.lastZ = z;
    if (!this.initialized || this.disposed) {
      this.hasPendingUpdate = true;
      return this.stats;
    }
    this.#updateAt(x, z, this.buildsPerUpdate);
    return this.stats;
  }

  #updateAt(x, z, buildLimit) {
    this.hasPendingUpdate = false;
    this.desiredLods.fill(NO_LOD);
    let targetTriangles = 0;
    for (let index = 0; index < this.states.length; index += 1) {
      const state = this.states[index];
      const dx = state.centerX - x;
      const dz = state.centerZ - z;
      const distanceSquared = dx * dx + dz * dz;
      this.distanceSquared[index] = distanceSquared;
      const retainedByHysteresis = state.status !== 0 && distanceSquared <= this.unloadRadiusSquared;
      if (distanceSquared > this.loadRadiusSquared && !retainedByHysteresis) continue;
      let lod = 2;
      if (distanceSquared <= this.fullLodRadiusSquared) lod = 0;
      else if (distanceSquared <= this.halfLodRadiusSquared) lod = 1;
      this.desiredLods[index] = lod;
      targetTriangles += this.trianglesByLod[lod];
    }

    let budgetLimited = false;
    while (targetTriangles > this.maxTriangles) {
      let farthest = -1;
      let farthestDistance = -1;
      for (let index = 0; index < this.states.length; index += 1) {
        if (this.desiredLods[index] >= 2 || this.distanceSquared[index] <= farthestDistance) continue;
        farthest = index;
        farthestDistance = this.distanceSquared[index];
      }
      if (farthest < 0) break;
      const oldLod = this.desiredLods[farthest];
      const newLod = oldLod + 1;
      this.desiredLods[farthest] = newLod;
      targetTriangles -= this.trianglesByLod[oldLod] - this.trianglesByLod[newLod];
      budgetLimited = true;
    }
    while (targetTriangles > this.maxTriangles) {
      let farthest = -1;
      let farthestDistance = -1;
      for (let index = 0; index < this.states.length; index += 1) {
        if (this.desiredLods[index] === NO_LOD || this.distanceSquared[index] <= farthestDistance) continue;
        // Prefer shedding chunks retained only by the 2 km unload hysteresis.
        if (farthest >= 0 && this.distanceSquared[farthest] > this.loadRadiusSquared && this.distanceSquared[index] <= this.loadRadiusSquared) continue;
        farthest = index;
        farthestDistance = this.distanceSquared[index];
      }
      if (farthest < 0) break;
      targetTriangles -= this.trianglesByLod[this.desiredLods[farthest]];
      this.desiredLods[farthest] = NO_LOD;
      budgetLimited = true;
    }

    this.stats.targetTerrainTriangles = targetTriangles;
    this.stats.budgetLimited = budgetLimited;
    // Retain/activate desired chunks before releasing stale ones. This keeps a
    // pack alive while crossing a chunk boundary within the same 1 km region.
    for (let index = 0; index < this.states.length; index += 1) {
      const state = this.states[index];
      const desired = this.desiredLods[index];
      if (desired === NO_LOD) continue;
      state.desiredLod = desired;
      if (state.status === 0) this.#activate(state);
      else if (state.status === 3 && state.lod !== desired) this.#enqueueBuild(state);
    }
    for (let index = 0; index < this.states.length; index += 1) {
      if (this.desiredLods[index] === NO_LOD && this.states[index].status !== 0) this.#deactivate(this.states[index]);
    }
    this.#drainBuildQueue(buildLimit);
    this.#refreshStats();
  }

  #activate(state) {
    state.status = 1;
    state.token += 1;
    state.retained = true;
    const token = state.token;
    state.loadPromise = this.loader.retain(state.regionX, state.regionZ).then(
      (pack) => {
        if (this.disposed || state.token !== token || state.status === 0) return;
        state.pack = pack;
        readChunkEntry(pack, state.localX, state.localZ, state);
        state.propByteOffset = pack.propOffset + state.propFirst * pack.propRecordBytes;
        state.status = 2;
        this.stats.revision += 1;
        this.#enqueueBuild(state);
      },
      (error) => {
        if (state.token !== token) return;
        this.firstError = error;
        this.stats.lastError = String(error && error.message ? error.message : error);
        state.status = 0;
        state.loadPromise = null;
        if (state.retained) this.loader.release(state.regionX, state.regionZ);
        state.retained = false;
        this.stats.revision += 1;
      },
    );
  }

  #deactivate(state) {
    state.token += 1;
    state.status = 0;
    state.queued = false;
    state.loadPromise = null;
    state.pack = null;
    if (state.mesh && state.mesh.geometry !== this.emptyGeometry) {
      this.group.remove(state.mesh);
      state.mesh.geometry.dispose();
      state.mesh.geometry = this.emptyGeometry;
      state.mesh.visible = false;
    }
    if (state.retained) this.loader.release(state.regionX, state.regionZ);
    state.retained = false;
    this.stats.revision += 1;
  }

  #enqueueBuild(state) {
    if (state.queued || state.status === 0) return;
    if (this.queueCount >= this.buildQueue.length) {
      this.firstError = new Error('Terrain build queue overflowed.');
      this.stats.lastError = this.firstError.message;
      return;
    }
    this.buildQueue[this.queueWrite] = state.index;
    this.queueWrite = (this.queueWrite + 1) % this.buildQueue.length;
    this.queueCount += 1;
    state.queued = true;
  }

  #drainBuildQueue(limit) {
    let built = 0;
    let inspected = 0;
    const inspectionLimit = this.queueCount;
    let visibleTriangles = 0;
    for (let index = 0; index < this.states.length; index += 1) {
      const state = this.states[index];
      if (state.status === 3 && state.mesh && state.mesh.visible) {
        visibleTriangles += state.mesh.geometry.userData.triangleCount || 0;
      }
    }
    while (this.queueCount > 0 && built < limit && inspected < inspectionLimit) {
      const stateIndex = this.buildQueue[this.queueRead];
      this.queueRead = (this.queueRead + 1) % this.buildQueue.length;
      this.queueCount -= 1;
      inspected += 1;
      const state = this.states[stateIndex];
      if (!state.queued) continue;
      state.queued = false;
      if ((state.status !== 2 && state.status !== 3) || !state.pack) continue;
      try {
        const lod = state.desiredLod;
        const previousTriangles = state.status === 3 && state.mesh && state.mesh.visible
          ? state.mesh.geometry.userData.triangleCount || 0
          : 0;
        const nextTriangles = this.trianglesByLod[lod];
        // Streaming must never create a transient terrain spike above the hard
        // budget. Defer an addition/upgrade until queued coarsening catches up.
        if (visibleTriangles - previousTriangles + nextTriangles > this.maxTriangles && nextTriangles >= previousTriangles) {
          this.#enqueueBuild(state);
          continue;
        }
        const geometry = createTerrainGeometry(
          state.pack,
          this.manifest,
          state,
          state.chunkX,
          state.chunkZ,
          this.lodSpacings[lod],
          this.palette,
          this.skirtDepth,
        );
        if (!state.mesh) {
          state.mesh = new THREE.Mesh(this.emptyGeometry, this.material);
          state.mesh.name = `Terrain ${state.chunkX},${state.chunkZ}`;
          state.mesh.position.set(state.minX, 0, state.minZ);
          state.mesh.castShadow = false;
          state.mesh.receiveShadow = false;
          state.mesh.matrixAutoUpdate = false;
          state.mesh.updateMatrix();
        }
        const previous = state.mesh.geometry;
        state.mesh.geometry = geometry;
        state.mesh.visible = true;
        if (state.mesh.parent !== this.group) this.group.add(state.mesh);
        if (previous !== this.emptyGeometry) previous.dispose();
        state.lod = lod;
        state.status = 3;
        visibleTriangles += nextTriangles - previousTriangles;
        this.stats.revision += 1;
        built += 1;
      } catch (error) {
        this.firstError = error;
        this.stats.lastError = String(error && error.message ? error.message : error);
        this.#deactivate(state);
      }
    }
  }

  #refreshStats() {
    let loaded = 0;
    let loading = 0;
    let triangles = 0;
    let lod4 = 0;
    let lod8 = 0;
    let lod16 = 0;
    if (this.states) {
      for (let index = 0; index < this.states.length; index += 1) {
        const state = this.states[index];
        if (state.status === 3 && state.mesh && state.mesh.visible) {
          loaded += 1;
          triangles += state.mesh.geometry.userData.triangleCount || 0;
          if (state.lod === 0) lod4 += 1;
          else if (state.lod === 1) lod8 += 1;
          else lod16 += 1;
        } else if (state.status !== 0) {
          loading += 1;
        }
      }
    }
    this.stats.loadedChunks = loaded;
    this.stats.loadingChunks = loading;
    this.stats.visibleTerrainTriangles = triangles;
    this.stats.terrainDrawCalls = loaded;
    this.stats.queuedBuilds = this.queueCount;
    this.stats.lod4mChunks = lod4;
    this.stats.lod8mChunks = lod8;
    this.stats.lod16mChunks = lod16;
    this.loader.updateStats(this.stats);
  }

  sampleHeight(worldX, worldZ) {
    return this.loader.sampleHeight(worldX, worldZ);
  }

  async preloadSpawn(position = CONFIG.world.spawn) {
    await this.ready;
    const x = positionX(position, this.lastX);
    const z = positionZ(position, this.lastZ);
    const preload = ++this.preloadSerial;
    this.activePreload = preload;
    this.preloadX = x;
    this.preloadZ = z;
    this.lastX = x;
    this.lastZ = z;
    try {
      this.firstError = null;
      this.#updateAt(x, z, 0);
      const promises = [];
      for (let index = 0; index < this.states.length; index += 1) {
        const state = this.states[index];
        if (state.status === 1 && state.loadPromise) promises.push(state.loadPromise);
      }
      await Promise.all(promises);
      if (this.firstError) throw this.firstError;
      this.#drainBuildQueue(Number.POSITIVE_INFINITY);
      this.#refreshStats();
      if (!Number.isFinite(this.sampleHeight(x, z))) {
        throw new Error(`Spawn heightfield at ${x},${z} was not preloaded.`);
      }
      return this;
    } finally {
      if (this.activePreload === preload) this.activePreload = 0;
    }
  }

  setRenderOrigin(x, z) {
    if (x && typeof x === 'object') {
      this.renderOriginX = option(x.x, this.renderOriginX);
      this.renderOriginZ = option(x.z, this.renderOriginZ);
    } else {
      this.renderOriginX = option(x, this.renderOriginX);
      this.renderOriginZ = option(z, this.renderOriginZ);
    }
    this.group.position.set(-this.renderOriginX, 0, -this.renderOriginZ);
    this.group.updateMatrix();
  }

  forEachLoadedChunk(callback) {
    if (!this.states || typeof callback !== 'function') return;
    for (let index = 0; index < this.states.length; index += 1) {
      const state = this.states[index];
      if (state.status === 3 && state.pack) callback(state);
    }
  }

  forEachLoadedPack(callback) {
    this.loader.forEachLoadedPack(callback);
  }

  getStats() {
    this.#refreshStats();
    return this.stats;
  }

  async reset() {
    if (!this.initialized) await this.ready;
    this.#clearLoaded();
    return this.preloadSpawn([this.lastX, 0, this.lastZ]);
  }

  #clearLoaded() {
    this.queueRead = 0;
    this.queueWrite = 0;
    this.queueCount = 0;
    if (this.states) {
      for (let index = 0; index < this.states.length; index += 1) {
        if (this.states[index].status !== 0) this.#deactivate(this.states[index]);
      }
    }
    this.desiredLods && this.desiredLods.fill(NO_LOD);
    this.stats.targetTerrainTriangles = 0;
    this.#refreshStats();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.#clearLoaded();
    this.scene.remove(this.group);
    this.material.dispose();
    this.emptyGeometry.dispose();
    this.loader.dispose();
    this.stats.revision += 1;
  }
}

export function createTerrainRuntime(scene, options) {
  return new TerrainRuntime(scene, options);
}
