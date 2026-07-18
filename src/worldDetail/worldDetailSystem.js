import { buildWorldDetailLayout } from './layout.js';
import {
  SAFETY_CONTRACT,
  WORLD_DETAIL_ROOT_NAME,
  WORLD_DETAIL_VERSION,
} from './constants.js';

function safeMessage(error) {
  return error?.message || String(error || 'Unknown world-detail failure');
}

function sceneHasDirectRoot(scene, rootName) {
  return Boolean(
    scene?.children?.some?.(child => child?.name === rootName),
  );
}

function disabledStatus({
  error = '',
  duplicate = false,
  disposed = false,
  stage = 'factory',
} = {}) {
  return Object.freeze({
    version: WORLD_DETAIL_VERSION,
    active: false,
    disabled: true,
    duplicate,
    disposed,
    error,
    failedStage: stage,
    safety: SAFETY_CONTRACT,
  });
}

export function createWorldDetailSystemCore(
  options = {},
  adapterFactory,
) {
  const scene = options.scene || null;
  const logger = options.logger || console;
  const rootName = options.rootName || WORLD_DETAIL_ROOT_NAME;
  let adapter = null;
  let disposed = false;
  let status = null;

  if (!scene?.add || !scene?.remove) {
    status = disabledStatus({
      error: 'createWorldDetailSystem requires a valid scene',
      stage: 'validation',
    });
  } else if (sceneHasDirectRoot(scene, rootName)) {
    status = disabledStatus({
      error: `World-detail root ${rootName} already exists`,
      duplicate: true,
      stage: 'duplicate-check',
    });
  } else {
    try {
      const layout = buildWorldDetailLayout({
        sampleHeight: options.sampleHeight,
        spawn: options.spawn,
        seed: options.seed,
        authoredReference: options.authoredReference,
      });
      if (typeof adapterFactory !== 'function') {
        throw new TypeError('World-detail adapter factory is missing');
      }
      adapter = adapterFactory({
        ...options,
        scene,
        rootName,
        layout,
      });
      if (!adapter || typeof adapter.update !== 'function') {
        throw new TypeError('World-detail adapter did not initialize');
      }
    } catch (error) {
      try { adapter?.dispose?.(); } catch {}
      adapter = null;
      status = disabledStatus({
        error: safeMessage(error),
        stage: 'construction',
      });
      try { logger?.warn?.('[Skyline WORLD DETAIL] Disabled safely', error); } catch {}
    }
  }

  const invoke = (method, ...args) => {
    if (disposed || !adapter) return undefined;
    try {
      return adapter[method]?.(...args);
    } catch (error) {
      try { adapter.dispose?.(); } catch {}
      adapter = null;
      status = disabledStatus({
        error: safeMessage(error),
        stage: method,
      });
      try { logger?.warn?.(`[Skyline WORLD DETAIL] ${method} failed safely`, error); } catch {}
      return undefined;
    }
  };

  return Object.freeze({
    setPhoneMode(phone) {
      invoke('setPhoneMode', phone);
    },

    setQuality(quality) {
      invoke('setQuality', quality);
    },

    fixedStepUpdate(dt, flight, phase = 'flying') {
      invoke('fixedStepUpdate', dt, flight, phase);
    },

    update(dt, flight, camera, phase = 'flying') {
      invoke('update', dt, flight, camera, phase);
    },

    getCollisionDescriptors() {
      const result = invoke('getCollisionDescriptors');
      return Array.isArray(result) ? result : [];
    },

    getStatus() {
      if (disposed) {
        return disabledStatus({
          disposed: true,
          error: status?.error || '',
          duplicate: Boolean(status?.duplicate),
          stage: 'disposed',
        });
      }
      if (!adapter) return status || disabledStatus();
      try {
        return Object.freeze({
          version: WORLD_DETAIL_VERSION,
          disabled: false,
          duplicate: false,
          error: '',
          ...(adapter.getStatus?.() || { active: true }),
        });
      } catch (error) {
        return disabledStatus({
          error: safeMessage(error),
          stage: 'status',
        });
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      try { adapter?.dispose?.(); } catch {}
      adapter = null;
    },
  });
}
