function emitDisabledEvent(name, error) {
  const target = globalThis.window ?? globalThis;

  if (
    typeof target?.dispatchEvent !== 'function' ||
    typeof globalThis.CustomEvent !== 'function'
  ) {
    return;
  }

  try {
    target.dispatchEvent(
      new globalThis.CustomEvent('skyline:optional-system-disabled', {
        detail: {
          name,
          message: error instanceof Error ? error.message : String(error),
        },
      }),
    );
  } catch {
    // Reporting must never become another failure source.
  }
}

export class SafeSystemSlot {
  constructor(name, factory, options = {}) {
    this.name = name;
    this.logger = options.logger ?? console;
    this.instance = null;
    this.error = null;
    this.disabled = false;
    this._reported = false;

    try {
      this.instance = factory();
    } catch (error) {
      this._disable(error);
    }
  }

  _disable(error) {
    if (this.disabled) return;

    this.disabled = true;
    this.error = error instanceof Error ? error : new Error(String(error));

    try {
      this.instance?.dispose?.();
    } catch {
      // Cleanup failure is deliberately ignored.
    }

    this.instance = null;

    if (!this._reported) {
      this._reported = true;
      this.logger?.error?.(
        `[Skyline] Optional system disabled: ${this.name}`,
        this.error,
      );
      emitDisabledEvent(this.name, this.error);
    }
  }

  invoke(method, ...args) {
    if (this.disabled || !this.instance) return undefined;

    const callback = this.instance[method];
    if (typeof callback !== 'function') return undefined;

    try {
      return callback.apply(this.instance, args);
    } catch (error) {
      this._disable(error);
      return undefined;
    }
  }

  get value() {
    return this.disabled ? null : this.instance;
  }

  dispose() {
    if (!this.instance) return;

    try {
      this.instance.dispose?.();
    } catch (error) {
      this._disable(error);
      return;
    }

    this.instance = null;
  }

  status() {
    return {
      name: this.name,
      active: Boolean(this.instance) && !this.disabled,
      disabled: this.disabled,
      error: this.error?.message ?? '',
    };
  }
}

export class SafeSystemRegistry {
  constructor(options = {}) {
    this.logger = options.logger ?? console;
    this.slots = new Map();
  }

  register(name, factory, enabled = true) {
    if (!enabled) return null;

    const slot = new SafeSystemSlot(name, factory, {
      logger: this.logger,
    });

    this.slots.set(name, slot);
    return slot;
  }

  invoke(name, method, ...args) {
    return this.slots.get(name)?.invoke(method, ...args);
  }

  get(name) {
    return this.slots.get(name)?.value ?? null;
  }

  status() {
    return [...this.slots.values()].map(slot => slot.status());
  }

  dispose() {
    for (const slot of this.slots.values()) slot.dispose();
    this.slots.clear();
  }
}
