import * as THREE from '../../vendor/three.module.min.js';
import {
  hash01,
  wrapWorldPosition,
} from './math.js';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

export class LivingCloudSystem {
  constructor(scene, pool, catalog, options = {}) {
    this.scene = scene;
    this.pool = pool;
    this.catalog = catalog;
    this.bounds = catalog.bounds;
    this.seed = Number(options.seed) || 52931;
    this.elapsed = 0;
    this.updateCount = 0;
    this.profile = null;
    this.daylight = 1;
    this.twilight = 0;
    this.layers = [];

    this.root = new THREE.Group();
    this.root.name = 'Skyline pooled volumetric cloud strata';
    scene.add(this.root);

    this._timeListener = event => {
      this.daylight =
        Math.max(
          0,
          Math.min(
            1,
            Number(event?.detail?.daylight) || 0
          ),
        );
      this.twilight =
        Math.max(
          0,
          Math.min(
            1,
            Number(event?.detail?.twilight) || 0
          ),
        );
    };

    globalThis.window?.addEventListener?.(
      'skyline:time-of-day',
      this._timeListener,
    );
  }

  setProfile(profile) {
    if (this.profile?.id === profile.id) return;
    this.profile = profile;

    for (const layer of this.layers) {
      this.root.remove(layer.mesh);
    }
    this.layers.length = 0;

    const regionCount = this.catalog.cloudRegions.length;
    const clustersPerRegion =
      Math.max(
        2,
        Math.floor(profile.cloudClusters / regionCount),
      );

    this.catalog.cloudRegions.forEach((region, regionIndex) => {
      const totalInstances =
        clustersPerRegion * profile.puffsPerCluster;

      const material =
        this.pool.lambert(
          `cloud-layer-${region.id}`,
          0xffffff,
          {
            transparent: true,
            opacity: region.opacity,
            depthWrite: false,
          },
        );

      const mesh =
        new THREE.InstancedMesh(
          this.pool.cloudGeometry(),
          material,
          totalInstances,
        );

      mesh.name = `cloud-layer:${region.id}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = true;

      const clusters = [];

      for (
        let clusterIndex = 0;
        clusterIndex < clustersPerRegion;
        clusterIndex += 1
      ) {
        clusters.push({
          x:
            this.bounds.minX +
            hash01(this.seed, regionIndex, clusterIndex) *
            (this.bounds.maxX - this.bounds.minX),
          z:
            this.bounds.minZ +
            hash01(this.seed + 7, regionIndex, clusterIndex) *
            (this.bounds.maxZ - this.bounds.minZ),
          y:
            region.altitude[0] +
            hash01(this.seed + 13, regionIndex, clusterIndex) *
            (region.altitude[1] - region.altitude[0]),
          phase:
            hash01(this.seed + 19, regionIndex, clusterIndex) *
            Math.PI * 2,
        });
      }

      this.root.add(mesh);
      this.layers.push({
        region,
        regionIndex,
        mesh,
        material,
        clusters,
        puffsPerCluster: profile.puffsPerCluster,
      });
    });

    this._writeMatrices();
  }

  _writeMatrices() {
    for (const layer of this.layers) {
      let instance = 0;

      for (
        let clusterIndex = 0;
        clusterIndex < layer.clusters.length;
        clusterIndex += 1
      ) {
        const cluster = layer.clusters[clusterIndex];

        for (
          let puffIndex = 0;
          puffIndex < layer.puffsPerCluster;
          puffIndex += 1
        ) {
          const angle =
            (
              puffIndex /
              Math.max(1, layer.puffsPerCluster)
            ) *
            Math.PI * 2 +
            cluster.phase;

          const radius =
            0.18 +
            hash01(
              this.seed + 31,
              clusterIndex,
              puffIndex
            ) * 0.54;

          const baseScale =
            layer.region.scale[0] +
            hash01(
              this.seed + 43,
              clusterIndex,
              puffIndex
            ) *
            (
              layer.region.scale[1] -
              layer.region.scale[0]
            );

          position.set(
            cluster.x +
              Math.cos(angle) * baseScale * radius,
            cluster.y +
              Math.sin(angle * 1.7) * baseScale * 0.08,
            cluster.z +
              Math.sin(angle) * baseScale * radius,
          );

          quaternion.setFromEuler(
            new THREE.Euler(
              0,
              hash01(
                this.seed + 53,
                clusterIndex,
                puffIndex
              ) * Math.PI,
              0,
            ),
          );

          scale.set(
            baseScale,
            baseScale *
              (
                0.26 +
                hash01(
                  this.seed + 61,
                  clusterIndex,
                  puffIndex
                ) * 0.18
              ),
            baseScale *
              (
                0.58 +
                hash01(
                  this.seed + 67,
                  clusterIndex,
                  puffIndex
                ) * 0.36
              ),
          );

          matrix.compose(position, quaternion, scale);
          layer.mesh.setMatrixAt(instance, matrix);
          instance += 1;
        }
      }

      layer.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt) {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    this.elapsed += safeDt;
    this.updateCount += 1;

    for (const layer of this.layers) {
      const windX = layer.region.wind[0];
      const windZ = layer.region.wind[1];

      for (const cluster of layer.clusters) {
        cluster.x += windX * safeDt;
        cluster.z += windZ * safeDt;
        wrapWorldPosition(cluster, this.bounds);
      }

      const night = 1 - this.daylight;
      layer.material.opacity =
        layer.region.opacity *
        (1 - night * 0.34);

      layer.material.color.setRGB(
        1 - night * 0.52 + this.twilight * 0.08,
        1 - night * 0.47 - this.twilight * 0.04,
        1 - night * 0.38 - this.twilight * 0.10,
      );
    }

    this._writeMatrices();
  }

  getStatus() {
    return {
      layerCount: this.layers.length,
      clusterCount:
        this.layers.reduce(
          (sum, layer) => sum + layer.clusters.length,
          0,
        ),
      puffCount:
        this.layers.reduce(
          (sum, layer) =>
            sum +
            layer.clusters.length *
            layer.puffsPerCluster,
          0,
        ),
      drawCalls: this.layers.length,
      updateCount: this.updateCount,
    };
  }

  dispose() {
    globalThis.window?.removeEventListener?.(
      'skyline:time-of-day',
      this._timeListener,
    );
    this.scene?.remove(this.root);
    this.layers.length = 0;
  }
}
