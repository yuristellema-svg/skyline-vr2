import {
  PHONE_REQUIRED_CATEGORIES,
  QUALITY_PROFILES,
} from './constants.js';
import { clamp, finite } from './math.js';

const ORDER = Object.freeze([
  'phone',
  'balanced',
  'full',
]);

export class LivingAirspaceQualityGovernor {
  constructor(options = {}) {
    this.phoneMode = Boolean(options.phone);
    this.requested =
      options.quality ?? 'auto';
    this.level =
      this.phoneMode ? 'phone' : 'balanced';
    this.slowTime = 0;
    this.fastTime = 0;
    this.cooldown = 0;
    this.lastFrameMs = 16.7;
    this.samples = [];
    this.transitions = 0;
  }

  setPhoneMode(phone) {
    this.phoneMode = Boolean(phone);
    if (this.phoneMode && this.level === 'full') {
      this.level = 'balanced';
      this.transitions += 1;
    }
    return this.profile;
  }

  setQuality(quality = 'auto') {
    if (
      quality !== 'auto' &&
      !(quality in QUALITY_PROFILES)
    ) {
      throw new Error(`Unknown living-airspace quality: ${quality}`);
    }

    this.requested = quality;
    if (quality !== 'auto') {
      this.level = quality;
      if (this.phoneMode && quality === 'full') {
        this.level = 'balanced';
      }
    }

    return this.profile;
  }

  reportFrame(frameMs, dt = frameMs / 1000) {
    const safeMs =
      clamp(finite(frameMs, 16.7), 1, 250);
    const safeDt =
      clamp(finite(dt, safeMs / 1000), 0, 0.25);

    this.lastFrameMs = safeMs;
    this.samples.push(safeMs);
    if (this.samples.length > 120) this.samples.shift();

    if (this.requested !== 'auto') return this.profile;

    this.cooldown = Math.max(0, this.cooldown - safeDt);

    const slowThreshold =
      this.phoneMode ? 24 : 20;
    const fastThreshold =
      this.phoneMode ? 18.8 : 15.8;

    if (safeMs > slowThreshold) {
      this.slowTime += safeDt;
      this.fastTime = Math.max(0, this.fastTime - safeDt * 2);
    } else if (safeMs < fastThreshold) {
      this.fastTime += safeDt;
      this.slowTime = Math.max(0, this.slowTime - safeDt);
    } else {
      this.slowTime = Math.max(0, this.slowTime - safeDt * 0.5);
      this.fastTime = Math.max(0, this.fastTime - safeDt * 0.5);
    }

    if (this.cooldown > 0) return this.profile;

    const index = ORDER.indexOf(this.level);

    if (this.slowTime > 2.2 && index > 0) {
      this.level = ORDER[index - 1];
      this.slowTime = 0;
      this.fastTime = 0;
      this.cooldown = 4;
      this.transitions += 1;
    } else if (
      this.fastTime > 10 &&
      index < ORDER.length - 1 &&
      !(this.phoneMode && ORDER[index + 1] === 'full')
    ) {
      this.level = ORDER[index + 1];
      this.slowTime = 0;
      this.fastTime = 0;
      this.cooldown = 8;
      this.transitions += 1;
    }

    return this.profile;
  }

  get profile() {
    return QUALITY_PROFILES[this.level];
  }

  getStatus() {
    const average =
      this.samples.length
        ? this.samples.reduce((sum, value) => sum + value, 0) /
          this.samples.length
        : 0;

    return {
      phoneMode: this.phoneMode,
      requested: this.requested,
      level: this.level,
      profile: this.profile,
      averageFrameMs: average,
      lastFrameMs: this.lastFrameMs,
      transitions: this.transitions,
      requiredPhoneCategories: PHONE_REQUIRED_CATEGORIES,
      majorFeaturesDisabledOnPhone: false,
    };
  }
}
