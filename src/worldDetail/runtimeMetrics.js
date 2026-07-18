import { clamp } from './math.js';
import { higherQuality, lowerQuality, normalizeQuality } from './budget.js';

export class AdaptiveDetailGovernor {
  constructor({ requested = 'auto', phone = false } = {}) {
    this.requested = String(requested || 'auto').toLowerCase();
    this.phone = Boolean(phone);
    this.effective = this.phone ? 'low' : normalizeQuality(this.requested);
    this.frameSeconds = 1 / 60;
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
    this.changeCooldown = 0;
    this.changes = 0;
  }

  setPhoneMode(phone) {
    this.phone = Boolean(phone);
    if (this.phone) this.effective = 'low';
    else this.effective = normalizeQuality(this.requested);
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
    this.changeCooldown = 8;
    return this.effective;
  }

  setRequested(value) {
    this.requested = String(value || 'auto').toLowerCase();
    if (!this.phone) this.effective = normalizeQuality(this.requested);
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
    this.changeCooldown = 8;
    return this.effective;
  }

  update(dt) {
    const safeDt = clamp(dt, 0, 0.1);
    if (safeDt <= 0) return false;
    this.frameSeconds += (safeDt - this.frameSeconds) * Math.min(1, safeDt * 1.6);
    this.changeCooldown = Math.max(0, this.changeCooldown - safeDt);
    if (this.phone || this.requested !== 'auto') return false;

    const fps = 1 / Math.max(1 / 240, this.frameSeconds);
    if (fps < 46) {
      this.lowFpsSeconds += safeDt;
      this.highFpsSeconds = Math.max(0, this.highFpsSeconds - safeDt * 2);
    } else if (fps > 57) {
      this.highFpsSeconds += safeDt;
      this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - safeDt * 2);
    } else {
      this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - safeDt);
      this.highFpsSeconds = Math.max(0, this.highFpsSeconds - safeDt);
    }

    if (this.changeCooldown > 0) return false;
    let next = this.effective;
    if (this.lowFpsSeconds >= 6) next = lowerQuality(this.effective);
    else if (this.highFpsSeconds >= 16) next = higherQuality(this.effective);
    if (next === this.effective) return false;

    this.effective = next;
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
    this.changeCooldown = 10;
    this.changes += 1;
    return true;
  }

  status() {
    const fps = 1 / Math.max(1 / 240, this.frameSeconds);
    return Object.freeze({
      requested: this.requested,
      effective: this.effective,
      phone: this.phone,
      frameAverageMs: this.frameSeconds * 1000,
      estimatedFps: fps,
      lowFpsSeconds: this.lowFpsSeconds,
      highFpsSeconds: this.highFpsSeconds,
      changeCooldown: this.changeCooldown,
      changes: this.changes,
      hysteresis: true,
      degradeHoldSeconds: 6,
      upgradeHoldSeconds: 16,
    });
  }
}
