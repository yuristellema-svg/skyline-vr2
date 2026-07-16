import {
  AIRFRAME_PROFILE_IDS,
  WORKER_AIRFRAME_PROFILES,
  validateAirframeProfile,
} from './flightProfiles.js';

const definition = (id, values) => Object.freeze({
  id,
  menuName: WORKER_AIRFRAME_PROFILES[id].name,
  audioIdentity: WORKER_AIRFRAME_PROFILES[id].audioIdentity,
  flightProfileId: id,
  aiIdentity: WORKER_AIRFRAME_PROFILES[id].aiIdentity,
  ...values,
});

export const AIRCRAFT_REGISTRY = Object.freeze({
  zero: definition('zero', {
    externalModule: './zeroExternal.js',
    externalExport: 'createZeroExternal',
    cockpitModule: './zeroCockpit.js',
    cockpitExport: 'createZeroCockpit',
    drawCallEstimate: 88,
    triangleEstimate: 12500,
    visualRisk: 'low; wraps the mature baseline Zero model',
  }),
  stuka: definition('stuka', {
    externalModule: './stukaExternal.js',
    externalExport: 'createStukaExternal',
    cockpitModule: './stukaCockpit.js',
    cockpitExport: 'createStukaCockpit',
    drawCallEstimate: 96,
    triangleEstimate: 13900,
    visualRisk: 'low; wraps the mature baseline Stuka model',
  }),
  scout: definition('scout', {
    externalModule: './scoutExternal.js',
    externalExport: 'createScoutExternal',
    cockpitModule: './scoutCockpit.js',
    cockpitExport: 'createScoutCockpit',
    drawCallEstimate: 31,
    triangleEstimate: 3600,
    visualRisk: 'medium; new low-cost silhouette needs phone and scale playtest',
  }),
  glider: definition('glider', {
    externalModule: './gliderExternal.js',
    externalExport: 'createGliderExternal',
    cockpitModule: './gliderCockpit.js',
    cockpitExport: 'createGliderCockpit',
    drawCallEstimate: 27,
    triangleEstimate: 3200,
    visualRisk: 'medium; long wings require third-person clipping review',
  }),
});

export const AIRCRAFT_IDS = Object.freeze(Object.keys(AIRCRAFT_REGISTRY));

export function resolveAircraftDefinition(value) {
  const id = typeof value === 'string' ? value : value?.id;
  return AIRCRAFT_REGISTRY[id] ?? AIRCRAFT_REGISTRY.zero;
}

export async function loadAircraftBuilders(value) {
  const entry = resolveAircraftDefinition(value);
  const [externalModule, cockpitModule] = await Promise.all([
    import(entry.externalModule),
    import(entry.cockpitModule),
  ]);
  const external = externalModule[entry.externalExport];
  const cockpit = cockpitModule[entry.cockpitExport];
  if (typeof external !== 'function' || typeof cockpit !== 'function') {
    throw new TypeError(`Aircraft builders missing for ${entry.id}`);
  }
  return Object.freeze({ entry, external, cockpit });
}

export function validateAircraftRegistry() {
  const errors = [];
  const ids = Object.keys(AIRCRAFT_REGISTRY);
  if (new Set(ids).size !== ids.length) errors.push('duplicate aircraft IDs');
  if (ids.join('|') !== AIRFRAME_PROFILE_IDS.join('|')) errors.push('registry/profile ID mismatch');

  for (const id of ids) {
    const entry = AIRCRAFT_REGISTRY[id];
    const profile = WORKER_AIRFRAME_PROFILES[id];
    if (!entry.externalModule || !entry.cockpitModule) errors.push(`${id}: visual module missing`);
    if (!entry.audioIdentity) errors.push(`${id}: audio identity missing`);
    if (!entry.aiIdentity) errors.push(`${id}: AI identity missing`);
    errors.push(...validateAirframeProfile(profile).map(error => `${id}: ${error}`));
  }
  return errors;
}
