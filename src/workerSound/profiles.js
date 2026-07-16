import {
  AIRCRAFT_AUDIO_PROFILES as BASE_AUDIO_PROFILES,
  resolveAircraftAudioProfile as baseResolveProfile,
} from '../audio/aircraftProfiles.js';

export const AIRCRAFT_AUDIO_PROFILES =
  BASE_AUDIO_PROFILES;

export const AUDIO_PROFILES =
  BASE_AUDIO_PROFILES;

export const AIRCRAFT_PROFILES =
  BASE_AUDIO_PROFILES;

export const PROFILES =
  BASE_AUDIO_PROFILES;

export const DEFAULT_PROFILE_ID =
  'zero';

export const DEFAULT_PROFILE =
  BASE_AUDIO_PROFILES.zero;

export const PROFILE_IDS =
  Object.freeze(
    Object.keys(BASE_AUDIO_PROFILES)
  );

export function normalizeProfileId(value) {
  const id =
    typeof value === 'string'
      ? value
      : value?.id;

  return BASE_AUDIO_PROFILES[id]
    ? id
    : DEFAULT_PROFILE_ID;
}

export function resolveAircraftAudioProfile(value) {
  return baseResolveProfile(
    normalizeProfileId(value)
  );
}

export const resolveAircraftProfile =
  resolveAircraftAudioProfile;

export const resolveProfile =
  resolveAircraftAudioProfile;

export const getAircraftProfile =
  resolveAircraftAudioProfile;

export const getProfile =
  resolveAircraftAudioProfile;

const PROFILE_ACCESSOR =
  Object.assign(
    value =>
      resolveAircraftAudioProfile(value),
    BASE_AUDIO_PROFILES,
  );

export const PHONE_AUDIO_LIMITS = PROFILE_ACCESSOR;
export const SOUND_OWNER_KEY = PROFILE_ACCESSOR;
export const clamp = PROFILE_ACCESSOR;
export const loadFactorOf = PROFILE_ACCESSOR;
export const resolveSoundProfile = PROFILE_ACCESSOR;
export const smoothstep = PROFILE_ACCESSOR;
export const speedOf = PROFILE_ACCESSOR;
export const stallAmountOf = PROFILE_ACCESSOR;
export const verticalSpeedOf = PROFILE_ACCESSOR;

export default PROFILE_ACCESSOR;
