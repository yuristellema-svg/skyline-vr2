import * as THREE from '../../vendor/three.module.min.js';

export class AtmosphericDepthSystem {
  constructor(scene, pool, catalog) {
    this.scene = scene;
    this.pool = pool;
    this.catalog = catalog;
    this.daylight = 1;
    this.twilight = 0;
    this.root = new THREE.Group();
    this.root.name = 'Skyline restrained atmospheric depth bands';
    scene.add(this.root);

    const width =
      Math.max(
        catalog.bounds.maxX - catalog.bounds.minX,
        catalog.bounds.maxZ - catalog.bounds.minZ,
      );

    this.materials = [];

    [
      { radius: width * 0.54, y: 280, opacity: 0.050 },
      { radius: width * 0.72, y: 520, opacity: 0.036 },
    ].forEach((item, index) => {
      const material =
        pool.basic(
          `depth-band-${index}`,
          0xbccbd0,
          {
            transparent: true,
            opacity: item.opacity,
            depthWrite: false,
            side: THREE.BackSide,
          },
        );

      const mesh =
        new THREE.Mesh(
          pool.hazeGeometry(),
          material,
        );

      mesh.name = `atmospheric-depth-band:${index}`;
      mesh.scale.set(item.radius, 580, item.radius);
      mesh.position.set(
        (
          catalog.bounds.minX +
          catalog.bounds.maxX
        ) * 0.5,
        item.y,
        (
          catalog.bounds.minZ +
          catalog.bounds.maxZ
        ) * 0.5,
      );

      this.root.add(mesh);
      this.materials.push({
        material,
        baseOpacity: item.opacity,
      });
    });

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

  update() {
    const night = 1 - this.daylight;
    for (const entry of this.materials) {
      entry.material.opacity =
        entry.baseOpacity *
        (1 - night * 0.42);
      entry.material.color.setRGB(
        0.74 - night * 0.39 + this.twilight * 0.08,
        0.80 - night * 0.42,
        0.82 - night * 0.34 - this.twilight * 0.08,
      );
    }
  }

  getStatus() {
    return {
      bandCount: this.materials.length,
      drawCalls: this.materials.length,
      replacesFog: false,
      replacesSky: false,
    };
  }

  dispose() {
    globalThis.window?.removeEventListener?.(
      'skyline:time-of-day',
      this._timeListener,
    );
    this.scene?.remove(this.root);
    this.materials.length = 0;
  }
}
