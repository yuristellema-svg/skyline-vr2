import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from '../config.js';
import { createTerrainRuntime } from './runtime/index.js';
import { createStructureLayer } from './features/structures.js';
import { createWaterLayer } from './features/water.js';
import { createCityLayer } from './features/city.js';
import { createPropLayer } from './features/props.js';

const STATIC_TRIANGLE_RESERVE = 18000;
const PROP_TRIANGLE_BUDGET = 60000;
const PROP_REBUILD_DISTANCE = 128;
const PROP_REBUILD_COOLDOWN = 0.24;

function joinUrl(root, file) {
  return `${String(root).replace(/\/$/, '')}/${file}`;
}

async function loadJson(fetchFn, url) {
  const response = await fetchFn(url);
  if (!response || !response.ok) {
    const status = response ? `${response.status || ''} ${response.statusText || ''}`.trim() : 'no response';
    throw new Error(`Unable to load Skyline world asset ${url}: ${status}`);
  }
  return response.json();
}

function buildSky(root) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x426f91) },
      uHigh: { value: new THREE.Color(0x79a9bd) },
      uHorizon: { value: new THREE.Color(0xd5c7ad) },
      uLow: { value: new THREE.Color(0x677d78) },
      uSunDirection: { value: new THREE.Vector3(-0.52, 0.67, 0.28).normalize() },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHigh;
      uniform vec3 uHorizon;
      uniform vec3 uLow;
      uniform vec3 uSunDirection;
      varying vec3 vDirection;
      void main() {
        float h = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 lower = mix(uLow, uHorizon, smoothstep(0.0, 0.53, h));
        vec3 upper = mix(uHigh, uZenith, smoothstep(0.5, 1.0, h));
        vec3 color = mix(lower, upper, smoothstep(0.42, 0.67, h));
        float sun = pow(max(0.0, dot(vDirection, uSunDirection)), 620.0);
        float glow = pow(max(0.0, dot(vDirection, uSunDirection)), 18.0);
        color += vec3(1.0, 0.72, 0.40) * glow * 0.22 + vec3(1.0, 0.91, 0.68) * sun * 2.4;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1700, 28, 16), material);
  sky.name = 'Camera-centred atmospheric sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  root.add(sky);
  return sky;
}

function addLighting(root) {
  root.add(new THREE.HemisphereLight(0xdcecf0, 0x3e4438, 1.45));
  const sun = new THREE.DirectionalLight(0xffdfad, 2.25);
  sun.position.set(-520, 670, 280);
  sun.castShadow = false;
  root.add(sun);
}

function countVisuals(root) {
  const result = { drawCalls: 0, triangles: 0 };
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry || object.visible === false) return;
    if (object.isInstancedMesh && object.count === 0) return;
    const geometry = object.geometry;
    const base = geometry.index
      ? geometry.index.count / 3
      : (geometry.getAttribute('position')?.count || 0) / 3;
    const instances = object.isInstancedMesh ? object.count : 1;
    result.drawCalls += 1;
    result.triangles += base * instances;
  });
  return result;
}

export class SkylineWorld {
  constructor(scene, collision, options = {}) {
    this.scene = scene;
    this.collision = collision;
    this.fetchFn = options.fetchFn || globalThis.fetch?.bind(globalThis);
    if (typeof this.fetchFn !== 'function') throw new Error('Skyline world requires fetch support.');
    this.root = new THREE.Group();
    this.root.name = 'Skyline Iteration 3 authored world';
    scene.add(this.root);
    scene.background = new THREE.Color(0x94b1bb);
    scene.fog = new THREE.Fog(0x94b1bb, CONFIG.world.fogNear, CONFIG.world.fogFar);
    addLighting(this.root);
    this.sky = buildSky(this.root);
    this.clouds = null;
    this.terrain = createTerrainRuntime(this.root, {
      assetRoot: CONFIG.world.assetRoot,
      fetchFn: this.fetchFn,
      maxVisibleTriangles: CONFIG.performance.maxVisibleTriangles - PROP_TRIANGLE_BUDGET - STATIC_TRIANGLE_RESERVE,
      buildsPerUpdate: 2,
    });
    this.features = null;
    this.structures = null;
    this.city = null;
    this.water = null;
    this.props = null;
    this.elapsed = 0;
    this.error = null;
    this._lastTerrainRevision = -1;
    this._lastPropX = Number.POSITIVE_INFINITY;
    this._lastPropZ = Number.POSITIVE_INFINITY;
    this._propCooldown = 0;
    this._loadedChunks = [];
    this._packBounds = { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
    this._staticMetrics = { drawCalls: 0, triangles: 0 };
    this.sampleHeight = this.sampleHeight.bind(this);
    this.stats = {
      ready: false,
      loadedChunks: 0,
      loadedPacks: 0,
      decodedPackBytes: 0,
      terrainTriangles: 0,
      propTriangles: 0,
      totalWorldTriangles: 0,
      worldDrawCalls: 0,
      propInstances: 0,
      revision: 0,
      error: '',
    };
    const featureUrl = joinUrl(CONFIG.world.assetRoot, 'features.json');
    this.ready = Promise.all([
      this.terrain.ready,
      loadJson(this.fetchFn, featureUrl),
    ]).then(([, features]) => {
      this.features = features;
      this.structures = createStructureLayer(features);
      this.city = createCityLayer(features);
      this.water = createWaterLayer(features, { fog: scene.fog });
      this.props = createPropLayer({ triangleBudget: PROP_TRIANGLE_BUDGET });
      this.root.add(this.structures.group, this.city.group, this.water.group, this.props.group);
      this.structures.registerCollisions(collision);
      this.city.registerCollisions(collision);
      this._staticMetrics = countVisuals(this.root);
      this.stats.ready = true;
      this.stats.revision += 1;
      return this;
    }).catch((error) => {
      this.error = error;
      this.stats.error = error?.message || String(error);
      throw error;
    });
  }

  sampleHeight(x, z) {
    const height = this.terrain.sampleHeight(x, z);
    return Number.isFinite(height) ? height : 0;
  }

  async preloadSpawn(position = CONFIG.world.spawn) {
    await this.ready;
    await this.terrain.preloadSpawn(position);
    this._rebuildProps(position.x ?? position[0], position.z ?? position[2]);
    this._refreshStats();
    return this;
  }

  update(playerPosition, camera, dt) {
    this.elapsed += Math.max(0, dt || 0);
    this._propCooldown = Math.max(0, this._propCooldown - Math.max(0, dt || 0));
    const terrainStats = this.terrain.update(playerPosition);
    if (camera) this.sky.position.copy(camera.position);
    if (this.water) this.water.update(this.elapsed);
    if (!this.props || !terrainStats) return this.stats;

    const x = Number.isFinite(playerPosition?.x) ? playerPosition.x : CONFIG.world.spawn[0];
    const z = Number.isFinite(playerPosition?.z) ? playerPosition.z : CONFIG.world.spawn[2];
    const moved = Math.hypot(x - this._lastPropX, z - this._lastPropZ) >= PROP_REBUILD_DISTANCE;
    const settled = terrainStats.loadingChunks === 0 && terrainStats.queuedBuilds === 0;
    if (
      this._propCooldown === 0 && settled &&
      (terrainStats.revision !== this._lastTerrainRevision || moved)
    ) {
      this._rebuildProps(x, z);
    }
    this._refreshStats();
    return this.stats;
  }

  _rebuildProps(x, z) {
    if (!this.props) return;
    const chunks = this._loadedChunks;
    chunks.length = 0;
    this.terrain.forEachLoadedChunk((state) => chunks.push(state));
    chunks.sort((a, b) => {
      const adx = a.centerX - x;
      const adz = a.centerZ - z;
      const bdx = b.centerX - x;
      const bdz = b.centerZ - z;
      return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
    });
    this.props.begin(x, z);
    const packSize = this.terrain.manifest.world.packSizeMeters;
    for (let index = 0; index < chunks.length; index += 1) {
      const state = chunks[index];
      const bounds = this._packBounds;
      bounds.minX = state.packMinX;
      bounds.minZ = state.packMinZ;
      bounds.maxX = state.packMinX + packSize;
      bounds.maxZ = state.packMinZ + packSize;
      this.props.addPacked(
        state.pack.arrayBuffer,
        state.propByteOffset,
        state.propCount,
        bounds,
        this.sampleHeight,
      );
    }
    this.props.commit();
    this._lastTerrainRevision = this.terrain.stats.revision;
    this._lastPropX = x;
    this._lastPropZ = z;
    this._propCooldown = PROP_REBUILD_COOLDOWN;
    this.stats.revision += 1;
  }

  _refreshStats() {
    const terrain = this.terrain.getStats();
    const prop = this.props?.getBudgetReport() || { instances: 0, estimatedTriangles: 0 };
    const propDraws = this.props
      ? this.props.meshes.reduce((sum, mesh) => sum + (mesh.count > 0 ? 1 : 0), 0)
      : 0;
    // Static metrics include terrain/props at construction time with zero active
    // instances/chunks, so only the fixed feature/sky/cloud geometry remains.
    this.stats.loadedChunks = terrain.loadedChunks;
    this.stats.loadedPacks = terrain.loadedPacks;
    this.stats.decodedPackBytes = terrain.decodedPackBytes;
    this.stats.terrainTriangles = terrain.visibleTerrainTriangles;
    this.stats.propTriangles = prop.estimatedTriangles;
    this.stats.totalWorldTriangles = terrain.visibleTerrainTriangles + prop.estimatedTriangles + this._staticMetrics.triangles;
    this.stats.worldDrawCalls = terrain.terrainDrawCalls + propDraws + this._staticMetrics.drawCalls;
    this.stats.propInstances = prop.instances;
    this.stats.error = terrain.lastError || this.error?.message || '';
  }

  async reset(position = CONFIG.world.spawn) {
    await this.ready;
    this.terrain.lastX = position.x ?? position[0];
    this.terrain.lastZ = position.z ?? position[2];
    await this.terrain.reset();
    this._rebuildProps(position.x ?? position[0], position.z ?? position[2]);
    this._refreshStats();
  }

  dispose() {
    this.terrain.dispose();
    this.structures?.dispose();
    this.city?.dispose();
    this.water?.dispose();
    this.props?.dispose();
    this.root.traverse((object) => {
      if (object === this.clouds || object === this.sky) {
        object.geometry?.dispose();
        object.material?.dispose();
      }
    });
    this.root.removeFromParent();
  }
}

export function createWorld(scene, collision, options) {
  return new SkylineWorld(scene, collision, options);
}
