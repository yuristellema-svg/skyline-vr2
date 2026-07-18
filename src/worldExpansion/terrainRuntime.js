import * as THREE from '../../vendor/three.module.min.js';
import { clamp, pointInBounds } from './math.js';

function chunkIntersectsOnlyCore(minX, minZ, size, core) {
  return minX >= core.minX && minZ >= core.minZ && minX + size <= core.maxX && minZ + size <= core.maxZ;
}

function distanceToChunk(x, z, minX, minZ, size) {
  const nearestX = clamp(x, minX, minX + size);
  const nearestZ = clamp(z, minZ, minZ + size);
  return Math.hypot(x - nearestX, z - nearestZ);
}

function chunkKey(ix, iz) {
  return `${ix}:${iz}`;
}

function cacheKey(key, spacing) {
  return `${key}@${spacing}`;
}

function chooseSpacing(distance, streaming) {
  if (distance <= streaming.fullLodThroughMeters) return streaming.renderSpacingMeters[0];
  if (distance <= streaming.halfLodThroughMeters) return streaming.renderSpacingMeters[1];
  return streaming.renderSpacingMeters[2];
}

function geometryTriangleCount(geometry) {
  return geometry.index ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
}

function geometryByteSize(geometry) {
  let bytes = geometry.index?.array?.byteLength || 0;
  for (const attribute of Object.values(geometry.attributes || {})) bytes += attribute.array?.byteLength || 0;
  return bytes;
}

function mergeChunkGeometries(states) {
  if (states.length === 0) return new THREE.BufferGeometry();
  let vertexCount = 0;
  let indexCount = 0;
  for (const state of states) {
    vertexCount += state.geometry.getAttribute('position').count;
    indexCount += state.geometry.index.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const state of states) {
    const position = state.geometry.getAttribute('position');
    const normal = state.geometry.getAttribute('normal');
    const color = state.geometry.getAttribute('color');
    positions.set(position.array, vertexOffset * 3);
    normals.set(normal.array, vertexOffset * 3);
    colors.set(color.array, vertexOffset * 3);
    const sourceIndices = state.geometry.index.array;
    for (let index = 0; index < sourceIndices.length; index += 1) indices[indexOffset + index] = sourceIndices[index] + vertexOffset;
    vertexOffset += position.count;
    indexOffset += sourceIndices.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function edgeIndices(steps, row) {
  const edges = [];
  edges.push(Array.from({ length: row }, (_, index) => index));
  edges.push(Array.from({ length: row }, (_, index) => index * row + steps));
  edges.push(Array.from({ length: row }, (_, index) => steps * row + (steps - index)));
  edges.push(Array.from({ length: row }, (_, index) => (steps - index) * row));
  return edges;
}

export class ExpansionTerrainRuntime {
  constructor(root, heightModel) {
    this.heightModel = heightModel;
    this.manifest = heightModel.manifest;
    this.streaming = this.manifest.streaming;
    this.group = new THREE.Group();
    this.group.name = 'World core v2 streamed expansion terrain';
    root.add(this.group);

    this.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: false,
      fog: true,
    });

    this.batchMeshes = new Map();
    for (const spacing of this.streaming.renderSpacingMeters) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
      mesh.name = `Expansion terrain LOD batch ${spacing}m`;
      mesh.visible = false;
      mesh.frustumCulled = true;
      this.group.add(mesh);
      this.batchMeshes.set(spacing, mesh);
    }

    this.loaded = new Map();
    this.cache = new Map();
    this.queue = [];
    this.queued = new Set();
    this.batchDirty = false;
    this.pendingBatchChanges = 0;
    this.revision = 0;
    this.lastX = Number.POSITIVE_INFINITY;
    this.lastZ = Number.POSITIVE_INFINITY;
    this.stats = {
      loadedChunks: 0,
      queuedBuilds: 0,
      terrainDrawCalls: 0,
      visibleTerrainTriangles: 0,
      revision: 0,
      lastError: '',
      cacheEntries: 0,
      cacheHits: 0,
      generatedChunks: 0,
      batchRebuilds: 0,
      seamSkirtTriangles: 0,
      residentChunkGeometryBytes: 0,
      cachedChunkGeometryBytes: 0,
      batchGeometryBytes: 0,
    };
  }

  _markBatchDirty() {
    this.batchDirty = true;
    this.pendingBatchChanges += 1;
  }

  _buildGeometry(minX, minZ, spacing) {
    const size = this.streaming.chunkSizeMeters;
    const steps = Math.max(2, Math.round(size / spacing));
    const row = steps + 1;
    const coreVertexCount = row * row;
    const edges = edgeIndices(steps, row);
    const skirtVertexCount = edges.reduce((sum, edge) => sum + edge.length, 0);
    const positions = new Float32Array((coreVertexCount + skirtVertexCount) * 3);
    const normals = new Float32Array((coreVertexCount + skirtVertexCount) * 3);
    const colors = new Float32Array((coreVertexCount + skirtVertexCount) * 3);
    const heights = new Float32Array(coreVertexCount);
    let vertex = 0;

    for (let zIndex = 0; zIndex <= steps; zIndex += 1) {
      const z = minZ + zIndex * size / steps;
      for (let xIndex = 0; xIndex <= steps; xIndex += 1) {
        const x = minX + xIndex * size / steps;
        const height = this.heightModel.sampleHeight(x, z);
        positions[vertex * 3] = x;
        positions[vertex * 3 + 1] = Number.isFinite(height) ? height : 0;
        positions[vertex * 3 + 2] = z;
        heights[vertex] = positions[vertex * 3 + 1];
        vertex += 1;
      }
    }

    for (let zIndex = 0; zIndex <= steps; zIndex += 1) {
      for (let xIndex = 0; xIndex <= steps; xIndex += 1) {
        const index = zIndex * row + xIndex;
        const x = positions[index * 3];
        const z = positions[index * 3 + 2];
        const left = heights[zIndex * row + Math.max(0, xIndex - 1)];
        const right = heights[zIndex * row + Math.min(steps, xIndex + 1)];
        const back = heights[Math.max(0, zIndex - 1) * row + xIndex];
        const front = heights[Math.min(steps, zIndex + 1) * row + xIndex];
        const gradientX = (right - left) / Math.max(1, spacing * 2);
        const gradientZ = (front - back) / Math.max(1, spacing * 2);
        const inverseNormalLength = 1 / Math.hypot(gradientX, 1, gradientZ);
        normals[index * 3] = -gradientX * inverseNormalLength;
        normals[index * 3 + 1] = inverseNormalLength;
        normals[index * 3 + 2] = -gradientZ * inverseNormalLength;
        const slope = Math.hypot(gradientX, gradientZ);
        const waterSurface = this.heightModel.waterSurfaceAt(x, z);
        let surface = this.heightModel.biome.classify(x, z, heights[index], slope, waterSurface);
        const infrastructure = this.heightModel.infrastructureInfluenceAt(x, z);
        if (infrastructure.settlement > 0.18) surface = this.heightModel.biome.blendForInfrastructure(surface, infrastructure.settlement * 0.62, 'settlement-ground');
        if (infrastructure.airfield > 0.14) surface = this.heightModel.biome.blendForInfrastructure(surface, infrastructure.airfield * 0.70, 'airfield-ground');
        colors[index * 3] = surface.color[0];
        colors[index * 3 + 1] = surface.color[1];
        colors[index * 3 + 2] = surface.color[2];
      }
    }

    const mainIndexCount = steps * steps * 6;
    const skirtIndexCount = edges.length * steps * 6;
    const indices = new Uint32Array(mainIndexCount + skirtIndexCount);
    let cursor = 0;
    for (let zIndex = 0; zIndex < steps; zIndex += 1) {
      for (let xIndex = 0; xIndex < steps; xIndex += 1) {
        const a = zIndex * row + xIndex;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices[cursor++] = a;
        indices[cursor++] = c;
        indices[cursor++] = b;
        indices[cursor++] = b;
        indices[cursor++] = c;
        indices[cursor++] = d;
      }
    }

    let skirtOffset = coreVertexCount;
    const skirtDepth = this.streaming.skirtDepthMeters || 16;
    for (const edge of edges) {
      const edgeStart = skirtOffset;
      for (const sourceIndex of edge) {
        positions[skirtOffset * 3] = positions[sourceIndex * 3];
        positions[skirtOffset * 3 + 1] = positions[sourceIndex * 3 + 1] - skirtDepth;
        positions[skirtOffset * 3 + 2] = positions[sourceIndex * 3 + 2];
        normals[skirtOffset * 3] = normals[sourceIndex * 3];
        normals[skirtOffset * 3 + 1] = normals[sourceIndex * 3 + 1];
        normals[skirtOffset * 3 + 2] = normals[sourceIndex * 3 + 2];
        colors[skirtOffset * 3] = colors[sourceIndex * 3] * 0.72;
        colors[skirtOffset * 3 + 1] = colors[sourceIndex * 3 + 1] * 0.72;
        colors[skirtOffset * 3 + 2] = colors[sourceIndex * 3 + 2] * 0.72;
        skirtOffset += 1;
      }
      for (let index = 0; index < edge.length - 1; index += 1) {
        const topA = edge[index];
        const topB = edge[index + 1];
        const bottomA = edgeStart + index;
        const bottomB = edgeStart + index + 1;
        indices[cursor++] = topA;
        indices[cursor++] = bottomA;
        indices[cursor++] = topB;
        indices[cursor++] = topB;
        indices[cursor++] = bottomA;
        indices[cursor++] = bottomB;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.seamSkirtTriangles = skirtIndexCount / 3;
    geometry.userData.spacing = spacing;
    return geometry;
  }

  _buildChunk(task) {
    const geometry = this._buildGeometry(task.minX, task.minZ, task.spacing);
    this.stats.generatedChunks += 1;
    return {
      ...task,
      geometry,
      triangles: geometryTriangleCount(geometry),
      seamSkirtTriangles: geometry.userData.seamSkirtTriangles || 0,
      geometryBytes: geometryByteSize(geometry),
    };
  }

  _cacheState(state) {
    const key = cacheKey(state.key, state.spacing);
    if (this.cache.has(key)) this.cache.get(key).geometry.dispose();
    this.cache.set(key, state);
    while (this.cache.size > (this.streaming.cacheEntries || 24)) {
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);
      oldest.geometry.dispose();
      this.cache.delete(oldestKey);
    }
  }

  _takeCached(key, spacing) {
    const resolvedKey = cacheKey(key, spacing);
    const state = this.cache.get(resolvedKey);
    if (!state) return null;
    this.cache.delete(resolvedKey);
    this.stats.cacheHits += 1;
    return state;
  }

  _removeChunk(key, cacheGeometry = true) {
    const state = this.loaded.get(key);
    if (!state) return;
    this.loaded.delete(key);
    if (cacheGeometry) this._cacheState(state);
    else state.geometry.dispose();
    this._markBatchDirty();
    this.revision += 1;
  }

  _schedule(x, z) {
    const { chunkSizeMeters: size, loadRadiusMeters } = this.streaming;
    const bounds = this.manifest.bounds;
    const core = this.manifest.legacyCoreBounds;
    const minIx = Math.floor((Math.max(bounds.minX, x - loadRadiusMeters) - bounds.minX) / size);
    const maxIx = Math.floor((Math.min(bounds.maxX - 1e-6, x + loadRadiusMeters) - bounds.minX) / size);
    const minIz = Math.floor((Math.max(bounds.minZ, z - loadRadiusMeters) - bounds.minZ) / size);
    const maxIz = Math.floor((Math.min(bounds.maxZ - 1e-6, z + loadRadiusMeters) - bounds.minZ) / size);
    const candidates = [];
    for (let iz = minIz; iz <= maxIz; iz += 1) {
      for (let ix = minIx; ix <= maxIx; ix += 1) {
        const minX = bounds.minX + ix * size;
        const minZ = bounds.minZ + iz * size;
        if (chunkIntersectsOnlyCore(minX, minZ, size, core)) continue;
        const distance = distanceToChunk(x, z, minX, minZ, size);
        if (distance > loadRadiusMeters) continue;
        const spacing = chooseSpacing(distance, this.streaming);
        const key = chunkKey(ix, iz);
        const loaded = this.loaded.get(key);
        if (loaded && loaded.spacing === spacing) continue;
        if (loaded) this._removeChunk(key, true);
        if (this.queued.has(key)) continue;
        const cached = this._takeCached(key, spacing);
        if (cached) {
          this.loaded.set(key, cached);
          this._markBatchDirty();
          this.revision += 1;
          continue;
        }
        candidates.push({ key, ix, iz, minX, minZ, spacing, distance });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.iz - b.iz || a.ix - b.ix);
    for (const item of candidates) {
      this.queue.push(item);
      this.queued.add(item.key);
    }
  }

  _unload(x, z) {
    const limit = this.streaming.unloadRadiusMeters;
    for (const [key, state] of this.loaded) {
      if (distanceToChunk(x, z, state.minX, state.minZ, this.streaming.chunkSizeMeters) > limit) this._removeChunk(key, true);
    }
  }

  _enforceBudgets(x, z) {
    let triangles = [...this.loaded.values()].reduce((sum, item) => sum + item.triangles, 0);
    if (this.loaded.size <= this.streaming.maximumLoadedChunks && triangles <= this.streaming.triangleBudget) return;
    const states = [...this.loaded.values()].sort((a, b) =>
      distanceToChunk(x, z, b.minX, b.minZ, this.streaming.chunkSizeMeters) -
      distanceToChunk(x, z, a.minX, a.minZ, this.streaming.chunkSizeMeters));
    for (const state of states) {
      if (this.loaded.size <= this.streaming.maximumLoadedChunks && triangles <= this.streaming.triangleBudget) break;
      triangles -= state.triangles;
      this._removeChunk(state.key, true);
    }
  }

  _processQueue(x, z, maximumBuilds = this.streaming.buildsPerUpdate) {
    let built = 0;
    while (built < maximumBuilds && this.queue.length > 0) {
      const task = this.queue.shift();
      this.queued.delete(task.key);
      if (distanceToChunk(x, z, task.minX, task.minZ, this.streaming.chunkSizeMeters) > this.streaming.loadRadiusMeters) continue;
      try {
        const cached = this._takeCached(task.key, task.spacing);
        const state = cached || this._buildChunk(task);
        this.loaded.set(task.key, state);
        this._markBatchDirty();
        this.revision += 1;
        built += 1;
      } catch (error) {
        this.stats.lastError = error?.message || String(error);
      }
    }
  }

  _rebuildBatches(force = false) {
    if (!this.batchDirty) return;
    const threshold = this.streaming.batchRebuildThreshold || 4;
    if (!force && this.queue.length > 0 && this.pendingBatchChanges < threshold) return;
    for (const spacing of this.streaming.renderSpacingMeters) {
      const mesh = this.batchMeshes.get(spacing);
      const states = [...this.loaded.values()]
        .filter(state => state.spacing === spacing)
        .sort((a, b) => a.iz - b.iz || a.ix - b.ix);
      const nextGeometry = mergeChunkGeometries(states);
      mesh.geometry.dispose();
      mesh.geometry = nextGeometry;
      mesh.visible = states.length > 0;
    }
    this.batchDirty = false;
    this.pendingBatchChanges = 0;
    this.stats.batchRebuilds += 1;
  }

  _refreshStats(forceBatch = false) {
    this.stats.loadedChunks = this.loaded.size;
    this.stats.queuedBuilds = this.queue.length;
    this._rebuildBatches(forceBatch || this.queue.length === 0);
    this.stats.terrainDrawCalls = [...this.batchMeshes.values()].filter(mesh => mesh.visible).length;
    this.stats.visibleTerrainTriangles = [...this.loaded.values()].reduce((sum, item) => sum + item.triangles, 0);
    this.stats.seamSkirtTriangles = [...this.loaded.values()].reduce((sum, item) => sum + item.seamSkirtTriangles, 0);
    this.stats.cacheEntries = this.cache.size;
    this.stats.residentChunkGeometryBytes = [...this.loaded.values()].reduce((sum, item) => sum + item.geometryBytes, 0);
    this.stats.cachedChunkGeometryBytes = [...this.cache.values()].reduce((sum, item) => sum + item.geometryBytes, 0);
    this.stats.batchGeometryBytes = [...this.batchMeshes.values()].reduce((sum, mesh) => sum + geometryByteSize(mesh.geometry), 0);
    this.stats.revision = this.revision;
    return this.stats;
  }

  update(playerPosition) {
    const x = Number(playerPosition?.x);
    const z = Number(playerPosition?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || !pointInBounds(x, z, this.manifest.bounds)) return this._refreshStats();
    const moved = Math.hypot(x - this.lastX, z - this.lastZ) >= this.streaming.chunkSizeMeters * 0.30;
    if (moved || !Number.isFinite(this.lastX)) {
      this.lastX = x;
      this.lastZ = z;
      this._unload(x, z);
      this._schedule(x, z);
    }
    this._processQueue(x, z);
    this._enforceBudgets(x, z);
    return this._refreshStats(false);
  }

  async preload(position) {
    const x = Number(position?.x ?? position?.[0] ?? 0);
    const z = Number(position?.z ?? position?.[2] ?? 0);
    if (!pointInBounds(x, z, this.manifest.bounds)) return this;
    this.lastX = x;
    this.lastZ = z;
    this._schedule(x, z);
    this._processQueue(x, z, Math.min(24, this.streaming.maximumLoadedChunks));
    this._enforceBudgets(x, z);
    this._refreshStats(true);
    return this;
  }

  reset(position) {
    const x = Number(position?.x ?? position?.[0] ?? 0);
    const z = Number(position?.z ?? position?.[2] ?? 0);
    this.lastX = x;
    this.lastZ = z;
    this.queue.length = 0;
    this.queued.clear();
    this._unload(x, z);
    this._schedule(x, z);
    this._processQueue(x, z, 10);
    return this._refreshStats(true);
  }

  getStats() {
    return { ...this._refreshStats(this.queue.length === 0) };
  }

  dispose() {
    for (const key of [...this.loaded.keys()]) this._removeChunk(key, false);
    for (const state of this.cache.values()) state.geometry.dispose();
    this.cache.clear();
    this.queue.length = 0;
    this.queued.clear();
    this._rebuildBatches(true);
    for (const mesh of this.batchMeshes.values()) {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    }
    this.batchMeshes.clear();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
