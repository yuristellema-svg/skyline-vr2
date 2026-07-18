import { ExpansionFeatureRuntime } from './featuresRuntime.js';
import { createExpansionHeightModel } from './heightModel.js';
import { ExpansionTerrainRuntime } from './terrainRuntime.js';

export class WorldCoreExpansion {
  constructor(root, collision, manifest, options = {}) {
    this.manifest = manifest;
    this.heightModel = createExpansionHeightModel(manifest, {
      coreSampleHeight: options.coreSampleHeight,
    });
    this.terrain = new ExpansionTerrainRuntime(root, this.heightModel);
    this.features = new ExpansionFeatureRuntime(root, collision, this.heightModel);
    this.stats = {
      ready: true,
      loadedChunks: 0,
      queuedBuilds: 0,
      terrainDrawCalls: 0,
      terrainTriangles: 0,
      featureDrawCalls: this.features.stats.drawCalls,
      featureTriangles: this.features.stats.triangles,
      totalDrawCalls: this.features.stats.drawCalls,
      totalTriangles: this.features.stats.triangles,
      roadSegments: this.features.stats.roadSegments,
      settlementInstances: this.features.stats.settlementInstances,
      collisionBoxes: this.features.stats.collisionBoxes,
      cacheEntries: 0,
      cacheHits: 0,
      generatedChunks: 0,
      batchRebuilds: 0,
      seamSkirtTriangles: 0,
      residentChunkGeometryBytes: 0,
      cachedChunkGeometryBytes: 0,
      batchGeometryBytes: 0,
      featureGeometryBytes: this.features.stats.geometryBytes,
      error: '',
      revision: 1,
    };
  }

  sampleHeight(x, z) {
    return this.heightModel.sampleHeight(x, z);
  }

  sampleSlope(x, z, spacing) {
    return this.heightModel.sampleSlope(x, z, spacing);
  }

  waterSurfaceAt(x, z) {
    return this.heightModel.waterSurfaceAt(x, z);
  }

  update(playerPosition, camera, dt) {
    void camera;
    void dt;
    const terrain = this.terrain.update(playerPosition);
    const features = this.features.update(playerPosition);
    this.stats.loadedChunks = terrain.loadedChunks;
    this.stats.queuedBuilds = terrain.queuedBuilds;
    this.stats.terrainDrawCalls = terrain.terrainDrawCalls;
    this.stats.terrainTriangles = terrain.visibleTerrainTriangles;
    this.stats.featureDrawCalls = features.drawCalls;
    this.stats.featureTriangles = features.triangles;
    this.stats.totalDrawCalls = terrain.terrainDrawCalls + features.drawCalls;
    this.stats.totalTriangles = terrain.visibleTerrainTriangles + features.triangles;
    this.stats.cacheEntries = terrain.cacheEntries;
    this.stats.cacheHits = terrain.cacheHits;
    this.stats.generatedChunks = terrain.generatedChunks;
    this.stats.batchRebuilds = terrain.batchRebuilds;
    this.stats.seamSkirtTriangles = terrain.seamSkirtTriangles;
    this.stats.residentChunkGeometryBytes = terrain.residentChunkGeometryBytes;
    this.stats.cachedChunkGeometryBytes = terrain.cachedChunkGeometryBytes;
    this.stats.batchGeometryBytes = terrain.batchGeometryBytes;
    this.stats.featureGeometryBytes = features.geometryBytes;
    this.stats.error = terrain.lastError || '';
    this.stats.revision = terrain.revision + 1;
    return this.stats;
  }

  async preload(position) {
    await this.terrain.preload(position);
    this.update(position, null, 0);
    return this;
  }

  reset(position) {
    this.terrain.reset(position);
    return this.update(position, null, 0);
  }

  getStats() {
    return { ...this.stats };
  }

  getManifest() {
    return this.manifest;
  }

  getLandingCatalog() {
    return this.heightModel.index.landingCatalog;
  }

  getSettlementCatalog() {
    return this.features.getSettlementCatalog();
  }

  getRoadCatalog() {
    return Object.freeze([...this.heightModel.roadProfiles.values()].map(profile => Object.freeze({
      id: profile.id,
      class: profile.class,
      widthMeters: profile.widthMeters,
      shoulderMeters: profile.shoulderMeters,
      points: Object.freeze(profile.points.map(point => Object.freeze([...point]))),
      heights: profile.heights,
      junctions: Object.freeze([...this.heightModel.index.roadJunctions.values()]
        .filter(junction => junction.roads.includes(profile.id))
        .map(junction => Object.freeze({ id: junction.id, position: Object.freeze([...junction.position]) }))),
    })));
  }

  getAirfieldCatalog() {
    return this.features.getAirfieldCatalog();
  }

  getWaterCatalog() {
    return Object.freeze({
      seaLevelMeters: this.manifest.water.seaLevelMeters,
      shoreline: Object.freeze({ ...this.manifest.water.shoreline }),
      rivers: Object.freeze([...this.heightModel.index.rivers.values()].map(river => Object.freeze({
        id: river.id,
        points: Object.freeze(river.points.map(point => Object.freeze([...point]))),
        bedWidthMeters: river.bedWidthMeters,
        bankWidthMeters: river.bankWidthMeters,
        sourceSurfaceMeters: river.sourceSurfaceMeters,
        mouthSurfaceMeters: river.mouthSurfaceMeters,
      }))),
      lakes: Object.freeze(this.manifest.water.lakes.map(lake => Object.freeze({ ...lake }))),
    });
  }

  getDiagnostics() {
    return Object.freeze({
      manifestVersion: this.manifest.schemaVersion,
      stats: this.getStats(),
      catalogs: Object.freeze({
        roads: this.heightModel.roadProfiles.size,
        settlements: this.getSettlementCatalog().settlements.length,
        lots: this.getSettlementCatalog().lots.length,
        airfields: this.getAirfieldCatalog().length,
        landingZones: this.getLandingCatalog().length,
        rivers: this.heightModel.index.rivers.size,
        landmarks: this.heightModel.index.landmarks.size,
      }),
      safety: Object.freeze({
        privateAnimationLoops: 0,
        sceneWideMaterialScans: 0,
        duplicateTerrainLayerInsideLegacyCore: false,
        mainJsModified: false,
        phoneWorldFeatureParity: true,
      }),
    });
  }

  dispose() {
    this.terrain.dispose();
    this.features.dispose();
  }
}

export function createWorldExpansion(root, collision, manifest, options) {
  return new WorldCoreExpansion(root, collision, manifest, options);
}
