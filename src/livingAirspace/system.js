import * as THREE from '../../vendor/three.module.min.js';
import {
  LIVING_AIRSPACE_VERSION,
  PHONE_REQUIRED_CATEGORIES,
} from './constants.js';
import {
  createDefaultLivingAirspaceCatalog,
  validateLivingAirspaceCatalog,
} from './catalog.js';
import {
  LivingAirspaceQualityGovernor,
} from './quality.js';
import {
  LivingAirspaceResourcePool,
} from './resources.js';
import {
  BirdFlockSystem,
} from './birds.js';
import {
  LivingTrafficSystem,
} from './traffic.js';
import {
  LivingCloudSystem,
} from './clouds.js';
import {
  AtmosphericDepthSystem,
} from './depth.js';

function disabledSystem(reason, validation = null) {
  return {
    active: false,
    fixedStepUpdate() {},
    update() {},
    setPhoneMode() {},
    setQuality() {},
    reportPerformance() {},
    getAudioSources() {
      return [];
    },
    getStatus() {
      return {
        active: false,
        version: LIVING_AIRSPACE_VERSION,
        reason,
        validation,
      };
    },
    dispose() {},
  };
}

export class LivingAirspaceSystem {
  constructor(options = {}) {
    const scene = options.scene;
    if (!scene?.add || !scene?.remove) {
      throw new Error('LivingAirspaceSystem requires a THREE.Scene.');
    }

    this.scene = scene;
    this.catalog =
      options.catalog ??
      createDefaultLivingAirspaceCatalog();

    this.validation =
      validateLivingAirspaceCatalog(this.catalog);

    if (!this.validation.valid) {
      throw new Error(
        `Invalid living-airspace catalog: ${this.validation.errors.join('; ')}`
      );
    }

    this.quality =
      new LivingAirspaceQualityGovernor({
        phone: options.phone,
        quality: options.quality ?? 'auto',
      });

    this.pool = new LivingAirspaceResourcePool();
    this.root = new THREE.Group();
    this.root.name = 'skyline-living-airspace-v1-root';
    scene.add(this.root);

    this.birds =
      new BirdFlockSystem(
        this.root,
        this.pool,
        this.catalog,
        {
          sampleHeight: options.sampleHeight,
        },
      );

    this.traffic =
      new LivingTrafficSystem(
        this.root,
        this.pool,
        this.catalog,
      );

    this.clouds =
      new LivingCloudSystem(
        this.root,
        this.pool,
        this.catalog,
        {
          seed: options.seed,
        },
      );

    this.depth =
      new AtmosphericDepthSystem(
        this.root,
        this.pool,
        this.catalog,
      );

    this.frameIndex = 0;
    this.fixedUpdateCount = 0;
    this.frameUpdateCount = 0;
    this.disposed = false;
    this.active = true;
    this.failedReason = '';

    this._applyProfile();
  }

  _applyProfile() {
    const profile = this.quality.profile;
    this.birds.setProfile(profile);
    this.traffic.setProfile(profile);
    this.clouds.setProfile(profile);
  }

  setPhoneMode(phone) {
    this.quality.setPhoneMode(phone);
    this._applyProfile();
    return this.quality.profile;
  }

  setQuality(quality = 'auto') {
    this.quality.setQuality(quality);
    this._applyProfile();
    return this.quality.profile;
  }

  reportPerformance(metrics = {}) {
    const frameMs =
      Number(metrics.frameMs) ||
      (
        Number(metrics.dt) > 0
          ? Number(metrics.dt) * 1000
          : 16.7
      );

    const before = this.quality.profile.id;
    this.quality.reportFrame(
      frameMs,
      Number(metrics.dt) || frameMs / 1000,
    );

    if (before !== this.quality.profile.id) {
      this._applyProfile();
    }

    return this.quality.getStatus();
  }

  fixedStepUpdate(
    dt,
    flight,
    phase = 'flying',
  ) {
    if (!this.active || this.disposed) return;
    if (phase === 'flying') {
      this.fixedUpdateCount += 1;
    }
  }

  update(
    dt,
    flight,
    camera,
    phase = 'flying',
  ) {
    if (!this.active || this.disposed) return;

    try {
      const safeDt =
        Math.max(0, Math.min(0.1, Number(dt) || 0));

      this.frameIndex += 1;
      this.frameUpdateCount += 1;

      const profile = this.quality.profile;

      if (
        this.frameIndex % profile.birdCadence === 0
      ) {
        this.birds.update(
          safeDt * profile.birdCadence,
          flight,
        );
      }

      if (
        this.frameIndex % profile.trafficCadence === 0
      ) {
        this.traffic.update(
          safeDt * profile.trafficCadence,
          flight,
        );
      }

      if (
        this.frameIndex % profile.cloudCadence === 0
      ) {
        this.clouds.update(
          safeDt * profile.cloudCadence,
          camera,
        );
      }

      this.depth.update(
        safeDt,
        flight,
        camera,
        phase,
      );
    } catch (error) {
      this.active = false;
      this.failedReason =
        error instanceof Error
          ? error.message
          : String(error);
    }
  }

  getAudioSources() {
    return this.traffic.getAudioSources(
      this.quality.profile.maxAudioSources,
    );
  }

  getStatus() {
    const birds = this.birds.getStatus();
    const traffic = this.traffic.getStatus();
    const clouds = this.clouds.getStatus();
    const depth = this.depth.getStatus();

    return {
      active: this.active,
      disposed: this.disposed,
      version: LIVING_AIRSPACE_VERSION,
      failedReason: this.failedReason,
      validation: this.validation,
      quality: this.quality.getStatus(),
      birds,
      traffic,
      clouds,
      depth,
      audioSources: this.getAudioSources().length,
      frameUpdateCount: this.frameUpdateCount,
      fixedUpdateCount: this.fixedUpdateCount,
      estimatedDrawCalls:
        birds.drawCalls +
        traffic.drawCalls +
        clouds.drawCalls +
        depth.drawCalls,
      resources: this.pool.getStatus(),
      phoneContract: {
        requiredCategories: PHONE_REQUIRED_CATEGORIES,
        majorFeaturesDisabled: false,
      },
      safety: {
        ownsAnimationLoop: false,
        replacesSky: false,
        replacesFog: false,
        changesFlightPhysics: false,
        createsCollisionTargets: false,
        modifiesCamera: false,
      },
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;

    this.birds.dispose();
    this.traffic.dispose();
    this.clouds.dispose();
    this.depth.dispose();

    this.scene?.remove(this.root);
    this.pool.dispose();
  }
}

export function createLivingAirspaceSystem(options = {}) {
  try {
    return new LivingAirspaceSystem(options);
  } catch (error) {
    return disabledSystem(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}
