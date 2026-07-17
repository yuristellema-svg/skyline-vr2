import { RecoveredWorldSystem } from '../src/workerWorld/recoveredWorldSystem.js';

/**
 * Review helper only. This package does not install itself.
 * The integration owner supplies the same THREE namespace already used by Skyline.
 */
export function createRecoveredWorldSystem(scene, options = {}) {
  if (!options.THREE) {
    throw new Error('createRecoveredWorldSystem requires the existing THREE namespace');
  }

  return new RecoveredWorldSystem(scene, {
    THREE: options.THREE,
    eventTarget: options.eventTarget || globalThis.window || null,
    quality: options.quality || 'balanced',
    routeOptions: options.routeOptions,
    wildlifeOptions: options.wildlifeOptions,
    sailplaneOptions: options.sailplaneOptions,
    aiOptions: options.aiOptions,
    cityOptions: options.cityOptions,
    crownMountainOptions: options.crownMountainOptions,
    logger: options.logger || console,
  });
}

export const BASELINE_SYSTEM_OWNERSHIP = Object.freeze({
  streamedWorld: 'src/world/world.js',
  terrainHeightSampler: 'src/world/world.js',
  collisionSampler: 'src/collision.js',
  atmosphere: 'src/atmosphere.js via OptionalWorldSystem',
  clouds: 'src/optionalWorld/cloudField.js',
  contrails: 'src/contrails.js',
  boostPhysics: 'src/sandboxDynamics.js',
  audio: 'src/windAudio.js',
});

export const SYSTEMS_TO_DISABLE_IN_OLD_OPTIONAL_WORLD = Object.freeze([
  'routes',
  'city',
  'aiTraffic',
]);
