import {
  BIPLANE_FLIGHT_PROFILE_PROPOSAL,
} from './aircraft/biplaneProfile.js';

const PROFILE_STORAGE_KEY =
  'skyline-aircraft-profile-v4';

function profile(values) {
  return Object.freeze(values);
}

export const AIRCRAFT_FLIGHT_PROFILES =
  Object.freeze({
    zero: profile({
      id: 'zero',
      name: 'A6M ZERO',
      energyBias: 0.04,
      dragScale: 1.02,
      turnDragScale: 0.88,
      misalignmentDragScale: 0.94,
      pitchRateScale: 1.20,
      rollRateScale: 1.32,
      angularResponseScale: 1.20,
      angularReleaseScale: 1.12,
      coordinatedTurnScale: 1.16,
      liftScale: 1.04,
      stallSpeedScale: 0.96,
      enginePower: 15.2,
      engineResponse: 2.9,
      cruiseSpeed: 95,
      maximumLevelSpeed: 165,
      takeoffSpeed: 34,
      airbrakeDrag: 1.2,
      minimumEnergyLoss: 0,
      gravityScaleDive: 1.08,
      gravityScaleClimb: 0.96,
      touchdownSpeed: 42,
      touchdownSink: 3.0,
      touchdownBank: 10,
      touchdownHeading: 18,
      rollingDrag: 1.5,
      brakePower: 12,
      overspeedStart: 185,
      overspeedDrag: 0.00115,
      maxOverspeedDrag: 16,
      structuralPositiveG: 11.5,
      structuralNegativeG: -5.0,
    }),

    stuka: profile({
      id: 'stuka',
      name: 'JU 87 STUKA',
      energyBias: 0.025,
      dragScale: 1.22,
      turnDragScale: 1.28,
      misalignmentDragScale: 1.18,
      pitchRateScale: 0.64,
      rollRateScale: 0.55,
      angularResponseScale: 0.67,
      angularReleaseScale: 0.76,
      coordinatedTurnScale: 0.68,
      liftScale: 0.93,
      stallSpeedScale: 1.12,
      enginePower: 14.0,
      engineResponse: 1.50,
      cruiseSpeed: 80,
      maximumLevelSpeed: 145,
      takeoffSpeed: 31,
      airbrakeDrag: 6.5,
      minimumEnergyLoss: 0,
      gravityScaleDive: 1.10,
      gravityScaleClimb: 0.94,
      touchdownSpeed: 38,
      touchdownSink: 3.5,
      touchdownBank: 10,
      touchdownHeading: 18,
      rollingDrag: 1.9,
      brakePower: 13,
      overspeedStart: 225,
      overspeedDrag: 0.00090,
      maxOverspeedDrag: 15,
      structuralPositiveG: 9.5,
      structuralNegativeG: -4.5,
    }),

    scout: profile({
      id: 'scout',
      name: 'ALPINE SCOUT',
      energyBias: 0.035,
      dragScale: 0.94,
      turnDragScale: 0.78,
      misalignmentDragScale: 0.84,
      pitchRateScale: 1.34,
      rollRateScale: 1.48,
      angularResponseScale: 1.35,
      angularReleaseScale: 1.24,
      coordinatedTurnScale: 1.30,
      liftScale: 1.12,
      stallSpeedScale: 0.84,
      enginePower: 11.8,
      engineResponse: 3.6,
      cruiseSpeed: 66,
      maximumLevelSpeed: 118,
      takeoffSpeed: 23,
      airbrakeDrag: 2.1,
      minimumEnergyLoss: 0,
      gravityScaleDive: 1.05,
      gravityScaleClimb: 0.97,
      touchdownSpeed: 31,
      touchdownSink: 3.2,
      touchdownBank: 12,
      touchdownHeading: 22,
      rollingDrag: 2.2,
      brakePower: 14,
      overspeedStart: 145,
      overspeedDrag: 0.00180,
      maxOverspeedDrag: 17,
      structuralPositiveG: 7.8,
      structuralNegativeG: -3.8,
    }),

    biplane: BIPLANE_FLIGHT_PROFILE_PROPOSAL,

    glider: profile({
      id: 'glider',
      name: 'SKYLINE GLIDER',
      energyBias: 0,
      dragScale: 0.90,
      turnDragScale: 0.95,
      misalignmentDragScale: 0.88,
      pitchRateScale: 0.78,
      rollRateScale: 0.88,
      angularResponseScale: 0.78,
      angularReleaseScale: 0.88,
      coordinatedTurnScale: 0.90,
      liftScale: 1.16,
      stallSpeedScale: 0.76,
      enginePower: 0,
      engineResponse: 5,
      cruiseSpeed: 42,
      maximumLevelSpeed: 74,
      takeoffSpeed: Infinity,
      airbrakeDrag: 17,
      minimumEnergyLoss: 0.45,
      gravityScaleDive: 1,
      gravityScaleClimb: 1,
      touchdownSpeed: 27,
      touchdownSink: 2.8,
      touchdownBank: 12,
      touchdownHeading: 24,
      rollingDrag: 2.6,
      brakePower: 10,
      overspeedStart: 96,
      overspeedDrag: 0.00240,
      maxOverspeedDrag: 16,
      structuralPositiveG: 6.5,
      structuralNegativeG: -3.0,
    }),
  });

export function getAircraftFlightProfile(id) {
  return (
    AIRCRAFT_FLIGHT_PROFILES[id] ??
    AIRCRAFT_FLIGHT_PROFILES.zero
  );
}

export function getInitialAircraftFlightProfile() {
  let stored = 'zero';
  try {
    stored =
      globalThis.localStorage?.getItem?.(
        PROFILE_STORAGE_KEY,
      ) ?? 'zero';
  } catch {}
  return getAircraftFlightProfile(stored);
}
