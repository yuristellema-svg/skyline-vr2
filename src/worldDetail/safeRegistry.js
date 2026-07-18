function errorMessage(error) {
  return error?.message || String(error || 'Unknown optional world-detail failure');
}

class SafeSlot {
  constructor(name, factory, logger) {
    this.name = name;
    this.logger = logger;
    this.instance = null;
    this.disabled = false;
    this.error = '';
    this.failureCount = 0;
    try {
      this.instance = factory();
    } catch (error) {
      this.disable(error);
    }
  }

  disable(error) {
    if (this.disabled) return;
    this.disabled = true;
    this.error = errorMessage(error);
    this.failureCount += 1;
    try { this.instance?.dispose?.(); } catch {}
    this.instance = null;
    try { this.logger?.warn?.(`[Skyline WORLD DETAIL] ${this.name} disabled`, error); } catch {}
  }

  invoke(method, ...args) {
    if (this.disabled || !this.instance) return undefined;
    try {
      return this.instance?.[method]?.(...args);
    } catch (error) {
      this.disable(error);
      return undefined;
    }
  }

  status() {
    return Object.freeze({
      name: this.name,
      active: Boolean(this.instance) && !this.disabled,
      disabled: this.disabled,
      error: this.error,
      failureCount: this.failureCount,
      ...(this.instance?.getStatus?.() || {}),
    });
  }

  dispose() {
    try { this.instance?.dispose?.(); } catch {}
    this.instance = null;
  }
}

export class SafeSubsystemRegistry {
  constructor(logger = console) {
    this.logger = logger;
    this.slots = new Map();
  }

  register(name, factory) {
    if (this.slots.has(name)) throw new Error(`Duplicate world-detail subsystem ${name}`);
    const slot = new SafeSlot(name, factory, this.logger);
    this.slots.set(name, slot);
    return slot.instance;
  }

  invoke(method, ...args) {
    for (const slot of this.slots.values()) slot.invoke(method, ...args);
  }

  invokeOne(name, method, ...args) {
    return this.slots.get(name)?.invoke(method, ...args);
  }

  get(name) {
    return this.slots.get(name)?.instance || null;
  }

  status() {
    const systems = {};
    for (const [name, slot] of this.slots) systems[name] = slot.status();
    return Object.freeze(systems);
  }

  dispose() {
    for (const slot of this.slots.values()) slot.dispose();
    this.slots.clear();
  }
}
