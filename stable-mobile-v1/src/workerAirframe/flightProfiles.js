const RAW_FLIGHT_PROFILES = {
  zero: Object.freeze({
    id: 'zero',
    label: 'A6M Zero',
    engine: 'radial',
    propellerBlades: 3,
    propellerAxis: 'z',
    cockpitScale: 1,
    externalScale: 1,
  }),

  stuka: Object.freeze({
    id: 'stuka',
    label: 'Ju 87 Stuka',
    engine: 'inverted-v12',
    propellerBlades: 3,
    propellerAxis: 'z',
    cockpitScale: 1,
    externalScale: 1,
  }),

  scout: Object.freeze({
    id: 'scout',
    label: 'Alpine Scout',
    engine: 'inline',
    propellerBlades: 2,
    propellerAxis: 'z',
    cockpitScale: 1,
    externalScale: 1,
  }),

  glider: Object.freeze({
    id: 'glider',
    label: 'Skyline Glider',
    engine: 'none',
    propellerBlades: 0,
    propellerAxis: 'z',
    cockpitScale: 1,
    externalScale: 1,
  }),
};

export const FLIGHT_PROFILES =
  Object.freeze(RAW_FLIGHT_PROFILES);

export const AIRCRAFT_FLIGHT_PROFILES =
  FLIGHT_PROFILES;

export const DEFAULT_FLIGHT_PROFILE_ID =
  'zero';

export const DEFAULT_FLIGHT_PROFILE =
  FLIGHT_PROFILES.zero;

export function normalizeFlightProfileId(value) {
  const id =
    typeof value === 'string'
      ? value
      : value?.id;

  return FLIGHT_PROFILES[id]
    ? id
    : DEFAULT_FLIGHT_PROFILE_ID;
}

export function resolveFlightProfile(value) {
  return FLIGHT_PROFILES[
    normalizeFlightProfileId(value)
  ];
}

export const getFlightProfile =
  resolveFlightProfile;

const FLIGHT_PROFILE_ACCESSOR =
  Object.assign(
    value => resolveFlightProfile(value),
    FLIGHT_PROFILES,
  );

export const AIRFRAME_PROFILE_IDS = FLIGHT_PROFILE_ACCESSOR;
export const WORKER_AIRFRAME_PROFILES = FLIGHT_PROFILE_ACCESSOR;
export const resolveAirframeProfile = FLIGHT_PROFILE_ACCESSOR;
export const structuralWarningData = FLIGHT_PROFILE_ACCESSOR;
export const validateAirframeProfile = FLIGHT_PROFILE_ACCESSOR;

export default FLIGHT_PROFILE_ACCESSOR;
