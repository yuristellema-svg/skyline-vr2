import * as THREE from '../../vendor/three.module.min.js';
import { isCityNodeName } from './math.js';

function materialList(material) {
  if (Array.isArray(material)) {
    return material;
  }

  return material ? [material] : [];
}

function hasCityAncestor(object) {
  let node = object;

  while (node) {
    if (isCityNodeName(node.name)) {
      return true;
    }

    node = node.parent;
  }

  return false;
}

function isWindowMaterial(
  object,
  material,
) {
  const signature =
    `${object?.name || ''} ${material?.name || ''}`
      .toLowerCase();

  if (
    /window|glass|lamp|light|lit|office/.test(
      signature
    )
  ) {
    return true;
  }

  if (
    /road|ground|river|water|roof|wall|bridge/.test(
      signature
    )
  ) {
    return false;
  }

  return Boolean(
    material?.isMeshBasicMaterial ||
    (
      material?.transparent &&
      material?.opacity < 0.96
    )
  );
}

// SKYLINE_B_POLISH_NIGHT_WINDOWS
export class DistantCityVisibilitySystem {
  constructor(
    scene,
    options = {},
  ) {
    this.scene = scene;

    this.scanInterval =
      Math.max(
        0.25,
        Number(options.scanInterval) || 1.25,
      );

    this.scanTimer = 0;
    this.daylight = 1;
    this.twilight = 0;

    this.trackedObjects = new Map();
    this.trackedMaterials = new Map();

    this.warmWindow =
      new THREE.Color(0xffb45f);

    this._timeListener =
      event => {
        this.daylight =
          Math.max(
            0,
            Math.min(
              1,
              Number(
                event?.detail?.daylight
              ) || 0,
            ),
          );

        this.twilight =
          Math.max(
            0,
            Math.min(
              1,
              Number(
                event?.detail?.twilight
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
    if (!this.trackedObjects.has(object)) {
      this.trackedObjects.set(
        object,
        {
          frustumCulled:
            object.frustumCulled,
        },
      );

      object.frustumCulled = false;
      object.computeBoundingSphere?.();
    }

    for (
      const material of
      materialList(object.material)
    ) {
      const windowLike =
        isWindowMaterial(
          object,
          material,
        );

      const existing =
        this.trackedMaterials.get(
          material
        );

      if (existing) {
        existing.windowLike =
          existing.windowLike ||
          windowLike;

        continue;
      }

      this.trackedMaterials.set(
        material,
        {
          windowLike,

          litFactor:
            (
              (
                Number(material.id) *
                17
              ) %
              10
            ) < 7
              ? 1
              : 0.22,

          fog: material.fog,

          color:
            material.color
              ?.clone?.() ??
            null,

          emissive:
            material.emissive
              ?.clone?.() ??
            null,

          emissiveIntensity:
            Number.isFinite(
              material.emissiveIntensity
            )
              ? material.emissiveIntensity
              : null,

          toneMapped:
            material.toneMapped,
        },
      );

      material.fog = false;
      material.needsUpdate = true;
    }
  }

  _scan() {
    this.scene.traverse(
      object => {
        if (!hasCityAncestor(object)) {
          return;
        }

        if (
          object.isMesh ||
          object.isInstancedMesh ||
          object.isLine ||
          object.isPoints
        ) {
          this._trackObject(object);
        }
      },
    );
  }

  _applyLighting() {
    const night =
      1 - this.daylight;

    const illumination =
      Math.max(
        night,
        this.twilight * 0.32,
      );

    for (
      const [
        material,
        state,
      ] of this.trackedMaterials
    ) {
      if (state.color && material.color) {
        material.color.copy(state.color);

        if (state.windowLike) {
          material.color.lerp(
            this.warmWindow,
            illumination *
              state.litFactor *
              0.88,
          );
        } else {
          material.color.multiplyScalar(
            0.20 +
            this.daylight * 0.80 +
            this.twilight * 0.08
          );
        }
      }

      if (
        material.emissive &&
        state.emissive
      ) {
        material.emissive.copy(
          state.emissive
        );

        if (state.windowLike) {
          material.emissive.lerp(
            this.warmWindow,
            illumination *
              state.litFactor *
              0.92,
          );
        }
      }

      if (
        state.emissiveIntensity !== null
      ) {
        material.emissiveIntensity =
          state.emissiveIntensity +
          (
            state.windowLike
              ? illumination *
                state.litFactor *
                1.35
              : 0
          );
      }

      if (state.windowLike) {
        material.toneMapped =
          illumination < 0.08
            ? state.toneMapped
            : false;
      } else {
        material.toneMapped =
          state.toneMapped;
      }

      material.needsUpdate = true;
    }
  }

  update(dt) {
    this.scanTimer -=
      Math.max(
        0,
        Number(dt) || 0,
      );

    if (this.scanTimer <= 0) {
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
      ] of this.trackedObjects
    ) {
      object.frustumCulled =
        state.frustumCulled;
    }

    for (
      const [
        material,
        state,
      ] of this.trackedMaterials
    ) {
      material.fog = state.fog;

      if (state.color && material.color) {
        material.color.copy(
          state.color
        );
      }

      if (
        state.emissive &&
        material.emissive
      ) {
        material.emissive.copy(
          state.emissive
        );
      }

      if (
        state.emissiveIntensity !== null
      ) {
        material.emissiveIntensity =
          state.emissiveIntensity;
      }

      material.toneMapped =
        state.toneMapped;

      material.needsUpdate = true;
    }

    this.trackedObjects.clear();
    this.trackedMaterials.clear();
  }
}
