const POWER_LEVELS = Object.freeze([
  Object.freeze({ id: 'off', label: 'OFF', throttle: 0 }),
  Object.freeze({ id: 'low', label: 'LOW', throttle: 0.34 }),
  Object.freeze({ id: 'middle', label: 'MIDDLE', throttle: 0.67 }),
  Object.freeze({ id: 'high', label: 'HIGH', throttle: 1 }),
]);

const GLIDER_LEVELS = Object.freeze([
  Object.freeze({ id: 'closed', label: 'CLOSED', airbrake: 0 }),
  Object.freeze({ id: 'half', label: 'HALF', airbrake: 0.5 }),
  Object.freeze({ id: 'full', label: 'FULL', airbrake: 1 }),
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function target() {
  return globalThis.window || null;
}

export class PowerControlSystem {
  constructor(initialAircraftId = 'zero') {
    this.aircraftId = initialAircraftId;
    this.indices = new Map();
    this.brake = 0;
    this.interactionActive = false;
    this.neutralControls = {
      pitchRate: 0,
      rollRate: 0,
      viewYaw: 0,
    };

    this.onAircraft = event => {
      this.setAircraft(event?.detail?.id || 'zero', true);
    };

    this.onKeyDown = event => {
      if (event.repeat) return;
      if (event.code === 'BracketLeft') {
        event.preventDefault?.();
        this.step(-1);
      } else if (event.code === 'BracketRight') {
        event.preventDefault?.();
        this.step(1);
      } else if (event.code === 'KeyE') {
        event.preventDefault?.();
        this.toggleOff();
      } else if (event.code === 'KeyB') {
        this.setBrake(1);
      }
    };

    this.onKeyUp = event => {
      if (event.code === 'KeyB') this.setBrake(0);
    };

    target()?.addEventListener?.(
      'skyline:aircraft-changed',
      this.onAircraft,
    );
    target()?.addEventListener?.('keydown', this.onKeyDown);
    target()?.addEventListener?.('keyup', this.onKeyUp);
    this.setAircraft(initialAircraftId, false);
  }

  get isGlider() {
    return this.aircraftId === 'glider';
  }

  get options() {
    return this.isGlider ? GLIDER_LEVELS : POWER_LEVELS;
  }

  get index() {
    return this.indices.get(this.aircraftId) ??
      (this.isGlider ? 0 : 2);
  }

  get option() {
    return this.options[this.index];
  }

  get state() {
    const option = this.option;
    return Object.freeze({
      aircraftId: this.aircraftId,
      index: this.index,
      label: option.label,
      engineOn: !this.isGlider && option.throttle > 0,
      throttle: this.isGlider ? 0 : option.throttle,
      airbrake: this.isGlider ? option.airbrake : 0,
      brake: this.brake,
    });
  }

  setAircraft(id, emit = true) {
    this.aircraftId =
      ['zero', 'stuka', 'scout', 'biplane', 'glider'].includes(id)
        ? id
        : 'zero';
    if (!this.indices.has(this.aircraftId)) {
      this.indices.set(
        this.aircraftId,
        this.isGlider ? 0 : 2,
      );
    }
    if (emit) this.emit();
  }

  setIndex(index) {
    const next = clamp(
      Math.round(index),
      0,
      this.options.length - 1,
    );
    if (next === this.index) return this.state;
    this.indices.set(this.aircraftId, next);
    this.emit();
    return this.state;
  }

  step(direction) {
    return this.setIndex(this.index + Math.sign(direction || 0));
  }

  toggleOff() {
    if (this.isGlider) {
      return this.setIndex(this.index === 0 ? 1 : 0);
    }
    return this.setIndex(this.index === 0 ? 2 : 0);
  }

  setBrake(amount) {
    const next = clamp(Number(amount) || 0, 0, 1);
    if (next === this.brake) return;
    this.brake = next;
    target()?.dispatchEvent?.(
      new CustomEvent('skyline:brake-changed', {
        detail: { amount: this.brake },
      }),
    );
  }

  setInteractionActive(active) {
    this.interactionActive = Boolean(active);
  }

  controlsFor(controls) {
    if (!this.interactionActive) return controls;
    this.neutralControls.viewYaw = Number(controls?.viewYaw) || 0;
    return this.neutralControls;
  }

  reset() {
    this.brake = 0;
    this.interactionActive = false;
    this.emit();
  }

  emit() {
    target()?.dispatchEvent?.(
      new CustomEvent('skyline:power-changed', {
        detail: this.state,
      }),
    );
  }

  dispose() {
    target()?.removeEventListener?.(
      'skyline:aircraft-changed',
      this.onAircraft,
    );
    target()?.removeEventListener?.('keydown', this.onKeyDown);
    target()?.removeEventListener?.('keyup', this.onKeyUp);
  }
}

export { POWER_LEVELS, GLIDER_LEVELS };
