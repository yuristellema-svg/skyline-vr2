import { clamp, deterministicUnit } from './sharedMath.js';
import { normalizeQuality } from './qualityPolicy.js';

function materialList(material) {
  return Array.isArray(material) ? material : material ? [material] : [];
}

function cloneColor(color) {
  if (!color) return null;
  if (typeof color.clone === 'function') return color.clone();
  return {
    r: Number(color.r) || 0,
    g: Number(color.g) || 0,
    b: Number(color.b) || 0,
  };
}

function copyColor(target, source) {
  if (!target || !source) return;
  if (typeof target.copy === 'function') {
    target.copy(source);
    return;
  }
  target.r = Number(source.r) || 0;
  target.g = Number(source.g) || 0;
  target.b = Number(source.b) || 0;
}

function multiplyColor(target, scalar) {
  if (!target) return;
  if (typeof target.multiplyScalar === 'function') {
    target.multiplyScalar(scalar);
    return;
  }
  target.r *= scalar;
  target.g *= scalar;
  target.b *= scalar;
}

function lerpColor(target, destination, alpha) {
  if (!target || !destination) return;
  const t = clamp(alpha, 0, 1);
  if (typeof target.lerp === 'function') {
    target.lerp(destination, t);
    return;
  }
  target.r += (destination.r - target.r) * t;
  target.g += (destination.g - target.g) * t;
  target.b += (destination.b - target.b) * t;
}

function surfaceHint(object, material) {
  return String(
    object?.userData?.skylineSurface ||
    material?.userData?.skylineSurface ||
    '',
  ).trim().toLowerCase();
}

export function isCityNodeName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  return (
    normalized === 'skyline-city' ||
    normalized === 'skyline city' ||
    normalized.includes('skyline city blocks') ||
    normalized.includes('city block') ||
    normalized.includes('city landmark') ||
    normalized.includes('distant city')
  );
}

export function classifyCitySurface(object, material) {
  const hint = surfaceHint(object, material);
  if (hint === 'window') return 'window';
  if (hint === 'wall' || hint === 'roof' || hint === 'ground') return 'wall';

  const signature = `${object?.name || ''} ${material?.name || ''}`.toLowerCase();
  const wallSignal = /wall|facade|façade|building|tower|roof|ground|road|bridge|river|water|concrete|stone/.test(signature);
  const windowSignal = /window|office[-_ ]?glass|lit[-_ ]?glass|window[-_ ]?pane/.test(signature);

  if (wallSignal) return 'wall';
  if (windowSignal) return 'window';
  return 'other';
}

function hasCityAncestor(object, matcher) {
  let current = object;
  while (current) {
    if (matcher(current.name)) return true;
    current = current.parent;
  }
  return false;
}

export class CityNightLighting {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.eventTarget = options.eventTarget || globalThis.window || null;
    this.matcher = options.cityMatcher || isCityNodeName;
    this.quality = normalizeQuality(options.quality);
    this.scanTimer = 0;
    this.daylight = 1;
    this.twilight = 0;
    this.disposed = false;
    this.trackedObjects = new Map();
    this.trackedMaterials = new Map();
    this.warmWindow = options.warmWindow || { r: 1, g: 0.55, b: 0.22 };

    this._timeListener = event => {
      this.daylight = clamp(event?.detail?.daylight, 0, 1);
      this.twilight = clamp(event?.detail?.twilight, 0, 1);
    };
    this.eventTarget?.addEventListener?.('skyline:time-of-day', this._timeListener);
    this._scan();
  }

  setQuality(level) {
    this.quality = normalizeQuality(level);
    for (const state of this.trackedMaterials.values()) {
      state.lit =
        state.surface === 'window' &&
        state.randomValue < this.quality.litWindowFraction;
    }
  }

  _trackObject(object) {
    if (!this.trackedObjects.has(object)) {
      this.trackedObjects.set(object, { frustumCulled: object.frustumCulled });
      object.frustumCulled = false;
      object.computeBoundingSphere?.();
    }

    for (const material of materialList(object.material)) {
      if (!material) continue;
      const surface = classifyCitySurface(object, material);
      const existing = this.trackedMaterials.get(material);
      if (existing) {
        if (surface === 'wall') existing.surface = 'wall';
        else if (surface === 'window' && existing.surface === 'other') existing.surface = 'window';
        existing.lit =
          existing.surface === 'window' &&
          existing.randomValue < this.quality.litWindowFraction;
        continue;
      }

      const signature = `${object?.name || ''}|${material?.name || ''}|${material?.id ?? 'no-id'}`;
      const randomValue = deterministicUnit(signature);
      this.trackedMaterials.set(material, {
        surface,
        randomValue,
        lit: surface === 'window' && randomValue < this.quality.litWindowFraction,
        color: cloneColor(material.color),
        emissive: cloneColor(material.emissive),
        emissiveIntensity: Number.isFinite(material.emissiveIntensity)
          ? material.emissiveIntensity
          : null,
        toneMapped: material.toneMapped,
        fog: material.fog,
      });
    }
  }

  _scan() {
    if (!this.scene?.traverse) return;
    this.scene.traverse(object => {
      if (!hasCityAncestor(object, this.matcher)) return;
      if (
        object.isMesh ||
        object.isInstancedMesh ||
        object.isLine ||
        object.isPoints ||
        object.material
      ) {
        this._trackObject(object);
      }
    });
  }

  _applyLighting() {
    const night = 1 - this.daylight;
    const illumination = Math.max(night, this.twilight * 0.45);

    for (const [material, state] of this.trackedMaterials) {
      if (state.color && material.color) {
        copyColor(material.color, state.color);
        if (state.surface === 'wall') {
          const wallScale = 0.42 + this.daylight * 0.58 + this.twilight * 0.05;
          multiplyColor(material.color, wallScale);
        } else if (state.surface === 'window') {
          const windowScale = 0.50 + this.daylight * 0.50;
          multiplyColor(material.color, windowScale);
          if (state.lit) lerpColor(material.color, this.warmWindow, illumination * 0.22);
        }
      }

      if (state.emissive && material.emissive) {
        copyColor(material.emissive, state.emissive);
        if (state.surface === 'window' && state.lit) {
          lerpColor(material.emissive, this.warmWindow, illumination * 0.68);
        }
      }

      if (state.emissiveIntensity !== null) {
        material.emissiveIntensity = state.emissiveIntensity;
        if (state.surface === 'window' && state.lit) {
          material.emissiveIntensity += illumination * 0.48;
        }
      }

      // Tone mapping and fog stay exactly as the original material configured them.
      material.toneMapped = state.toneMapped;
      material.fog = state.fog;
      material.needsUpdate = true;
    }
  }

  update(dt) {
    if (this.disposed) return;
    this.scanTimer -= Math.max(0, Number(dt) || 0);
    if (this.scanTimer <= 0) {
      this.scanTimer = this.quality.cityScanInterval;
      this._scan();
    }
    this._applyLighting();
  }

  getStatus() {
    let windows = 0;
    let litWindows = 0;
    let walls = 0;
    for (const state of this.trackedMaterials.values()) {
      if (state.surface === 'window') {
        windows += 1;
        if (state.lit) litWindows += 1;
      } else if (state.surface === 'wall') {
        walls += 1;
      }
    }
    return {
      active: !this.disposed,
      cityObjects: this.trackedObjects.size,
      materials: this.trackedMaterials.size,
      windowMaterials: windows,
      litWindowMaterials: litWindows,
      wallMaterials: walls,
      toneMappingPreserved: true,
      fogPreserved: true,
      deterministic: true,
      quality: this.quality.id,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.eventTarget?.removeEventListener?.('skyline:time-of-day', this._timeListener);
    for (const [object, state] of this.trackedObjects) {
      object.frustumCulled = state.frustumCulled;
    }
    for (const [material, state] of this.trackedMaterials) {
      if (state.color && material.color) copyColor(material.color, state.color);
      if (state.emissive && material.emissive) copyColor(material.emissive, state.emissive);
      if (state.emissiveIntensity !== null) material.emissiveIntensity = state.emissiveIntensity;
      material.toneMapped = state.toneMapped;
      material.fog = state.fog;
      material.needsUpdate = true;
    }
    this.trackedObjects.clear();
    this.trackedMaterials.clear();
  }
}
