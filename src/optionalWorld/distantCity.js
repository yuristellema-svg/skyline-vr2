import * as THREE from '../../vendor/three.module.min.js';
import { isCityNodeName } from './math.js';

function materialList(material) {
  if (Array.isArray(material)) {
    return material;
  }

  return material
    ? [material]
    : [];
}

function hasCityAncestor(object) {
  let node = object;

  while (node) {
    if (
      isCityNodeName(
        node.name,
      )
    ) {
      return true;
    }

    node = node.parent;
  }

  return false;
}

// SKYLINE_BUNDLE_B_CITY_LIGHTING
export class DistantCityVisibilitySystem {
  constructor(
    scene,
    options = {},
  ) {
    this.scene = scene;

    this.scanInterval =
      Math.max(
        0.25,
        Number(
          options.scanInterval
        ) || 1.25,
      );

    this.scanTimer = 0;
    this.daylight = 1;
    this.twilight = 0;

    this.trackedObjects =
      new Map();

    this.trackedMaterials =
      new Map();

    this.warmLight =
      new THREE.Color(
        0xffa85d,
      );

    this._timeListener =
      event => {
        this.daylight =
          Math.max(
            0,
            Math.min(
              1,

              Number(
                event?.detail
                  ?.daylight,
              ) || 0,
            ),
          );

        this.twilight =
          Math.max(
            0,
            Math.min(
              1,

              Number(
                event?.detail
                  ?.twilight,
              ) || 0,
            ),
          );
      };

    globalThis.window
      ?.addEventListener?.(
        'skyline:time-of-day',
        this._timeListener,
      );

    this._scan();
  }

  _trackObject(object) {
    if (
      this.trackedObjects
        .has(object)
    ) {
      return;
    }

    this.trackedObjects.set(
      object,
      {
        frustumCulled:
          object.frustumCulled,
      },
    );

    object.frustumCulled =
      false;

    object
      .computeBoundingSphere
      ?.();

    for (
      const material of
      materialList(
        object.material,
      )
    ) {
      if (
        this.trackedMaterials
          .has(material)
      ) {
        continue;
      }

      this.trackedMaterials.set(
        material,
        {
          fog: material.fog,

          emissive:
            material.emissive
              ?.clone?.() ??
            null,

          emissiveIntensity:
            Number.isFinite(
              material
                .emissiveIntensity,
            )
              ? material
                  .emissiveIntensity
              : null,
        },
      );

      material.fog = false;
      material.needsUpdate =
        true;
    }
  }

  _scan() {
    this.scene.traverse(
      object => {
        if (
          !hasCityAncestor(
            object,
          )
        ) {
          return;
        }

        if (
          object.isMesh ||
          object.isInstancedMesh ||
          object.isLine ||
          object.isPoints
        ) {
          this._trackObject(
            object,
          );
        }
      },
    );
  }

  _applyLighting() {
    const night =
      1 -
      this.daylight;

    const illumination =
      Math.max(
        night,
        this.twilight * 0.35,
      );

    for (
      const [
        material,
        state,
      ] of
      this.trackedMaterials
    ) {
      if (
        !material.emissive ||
        !state.emissive
      ) {
        continue;
      }

      material.emissive
        .copy(
          state.emissive,
        )
        .lerp(
          this.warmLight,
          illumination * 0.62,
        );

      if (
        Number.isFinite(
          material
            .emissiveIntensity,
        )
      ) {
        material.emissiveIntensity =
          (
            state
              .emissiveIntensity ??
            0
          ) +
          illumination * 0.72;
      }
    }
  }

  update(dt) {
    this.scanTimer -=
      Math.max(
        0,
        Number(dt) || 0,
      );

    if (
      this.scanTimer <= 0
    ) {
      this.scanTimer =
        this.scanInterval;

      this._scan();
    }

    this._applyLighting();
  }

  dispose() {
    globalThis.window
      ?.removeEventListener?.(
        'skyline:time-of-day',
        this._timeListener,
      );

    for (
      const [
        object,
        state,
      ] of
      this.trackedObjects
    ) {
      object.frustumCulled =
        state.frustumCulled;
    }

    for (
      const [
        material,
        state,
      ] of
      this.trackedMaterials
    ) {
      material.fog =
        state.fog;

      if (
        material.emissive &&
        state.emissive
      ) {
        material.emissive
          .copy(
            state.emissive,
          );
      }

      if (
        state.emissiveIntensity
        !== null
      ) {
        material.emissiveIntensity =
          state.emissiveIntensity;
      }

      material.needsUpdate =
        true;
    }

    this.trackedObjects.clear();
    this.trackedMaterials.clear();
  }
}
