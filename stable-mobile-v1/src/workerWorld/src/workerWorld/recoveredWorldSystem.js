import { AiTrafficAdapter } from './aiTrafficAdapter.js';
import { CityNightLighting } from './cityNightLighting.js';
import { CrownMountainSystem } from './crownMountainSystem.js';
import { normalizeQuality } from './qualityPolicy.js';
import { RouteGateSystem } from './routeGateSystem.js';
import { SailplaneSystem } from './sailplaneSystem.js';
import { WildlifeSystem } from './wildlifeSystem.js';

class SafeSlot {
  constructor(name, factory, logger = console) {
    this.name = name;
    this.logger = logger;
    this.instance = null;
    this.disabled = false;
    this.error = '';
    try {
      this.instance = factory();
    } catch (error) {
      this._disable(error);
    }
  }

  _disable(error) {
    if (this.disabled) return;
    this.disabled = true;
    this.error = error?.message || String(error || 'Unknown failure');
    try { this.instance?.dispose?.(); } catch {}
    this.instance = null;
    try { this.logger?.warn?.(`[Skyline worker world] ${this.name} disabled`, error); } catch {}
  }

  invoke(method, ...args) {
    if (this.disabled || !this.instance) return undefined;
    try {
      return this.instance?.[method]?.(...args);
    } catch (error) {
      this._disable(error);
      return undefined;
    }
  }

  status() {
    return {
      name: this.name,
      disabled: this.disabled,
      error: this.error,
      ...(this.instance?.getStatus?.() || {}),
    };
  }

  dispose() {
    if (!this.instance) return;
    try { this.instance.dispose?.(); } catch {}
    this.instance = null;
  }
}

export class RecoveredWorldSystem {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.options = options;
    this.logger = options.logger || console;
    this.disposed = false;
    this.quality = normalizeQuality(options.quality);
    const shared = {
      THREE: options.THREE,
      eventTarget: options.eventTarget || globalThis.window || null,
      quality: this.quality.id,
      visuals: options.visuals,
    };
    const factories = options.factories || {};
    this.slots = new Map();

    this._register('routeGates', () =>
      factories.routeGates?.() || new RouteGateSystem(scene, {
        ...shared,
        ...(options.routeOptions || {}),
      }));
    this._register('wildlife', () =>
      factories.wildlife?.() || new WildlifeSystem(scene, {
        ...shared,
        ...(options.wildlifeOptions || {}),
      }));
    this._register('sailplanes', () =>
      factories.sailplanes?.() || new SailplaneSystem(scene, {
        ...shared,
        ...(options.sailplaneOptions || {}),
      }));
    this._register('aiTraffic', () =>
      factories.aiTraffic?.() || new AiTrafficAdapter(scene, {
        ...shared,
        ...(options.aiOptions || {}),
      }));
    this._register('cityNightLighting', () =>
      factories.cityNightLighting?.() || new CityNightLighting(scene, {
        ...shared,
        ...(options.cityOptions || {}),
      }));
    this._register('crownMountain', () =>
      factories.crownMountain?.() || new CrownMountainSystem(scene, {
        ...shared,
        ...(options.crownMountainOptions || {}),
      }));

    this.setQuality(this.quality.id);
  }

  _register(name, factory) {
    this.slots.set(name, new SafeSlot(name, factory, this.logger));
  }

  _invoke(name, method, ...args) {
    return this.slots.get(name)?.invoke(method, ...args);
  }

  fixedStepUpdate(dt, flight, phase = 'flying') {
    if (this.disposed) return;
    this._invoke('routeGates', 'fixedStepUpdate', dt, flight, phase);
    this._invoke('aiTraffic', 'fixedStepUpdate', dt, flight, phase);
    this._invoke('crownMountain', 'fixedStepUpdate', dt, flight, phase);
  }

  update(dt, flight, camera, phase = 'flying') {
    if (this.disposed) return;
    this._invoke('routeGates', 'update', dt, flight, camera, phase);
    this._invoke('wildlife', 'update', dt, flight, camera, phase);
    this._invoke('sailplanes', 'update', dt, flight, camera, phase);
    this._invoke('aiTraffic', 'update', dt, flight, camera, phase);
    this._invoke('cityNightLighting', 'update', dt, flight, camera, phase);
    this._invoke('crownMountain', 'update', dt, flight, camera, phase);
  }

  setQuality(level) {
    this.quality = normalizeQuality(level);
    for (const slot of this.slots.values()) slot.invoke('setQuality', this.quality.id);
  }

  getAudioSources() {
    return this._invoke('aiTraffic', 'getAudioSources') || [];
  }

  getStatus() {
    const systems = {};
    for (const [name, slot] of this.slots) systems[name] = slot.status();
    return {
      active: !this.disposed,
      quality: this.quality.id,
      systems,
      preservedBaselineSystems: {
        streamedWorld: true,
        terrainCollisionSampler: true,
        ocean: true,
        atmosphereAndFog: true,
        clouds: {
          activeInBaseline: true,
          owner: 'OptionalWorldSystem',
          replacementAdded: false,
        },
        contrails: {
          activeInBaseline: true,
          owner: 'OptionalWorldSystem',
          maxPointsPerTrail: 90,
          bounded: true,
          qualityControlledBy: 'PerformanceRuntime',
          replacementAdded: false,
        },
      },
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.slots.values()) slot.dispose();
    this.slots.clear();
  }
}
