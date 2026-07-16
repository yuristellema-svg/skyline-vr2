const PROFILE_STORAGE_KEY =
  'skyline-aircraft-profile-v4';

export const AIRCRAFT_FLIGHT_PROFILES =
  Object.freeze({
    zero: Object.freeze({
      id: 'zero',
      name: 'A6M ZERO',
      energyBias: 0.14,
      dragScale: 1,
      turnDragScale: 0.90,
      misalignmentDragScale: 0.95,
      pitchRateScale: 1.06,
      rollRateScale: 1.12,
      angularResponseScale: 1.08,
      angularReleaseScale: 1.08,
      coordinatedTurnScale: 1.06,
      liftScale: 1.05,
      stallSpeedScale: 0.95,
      overspeedStart: 185,
      overspeedDrag: 0.00115,
      maxOverspeedDrag: 16,
      structuralPositiveG: 11.5,
      structuralNegativeG: -5.0,
    }),

    stuka: Object.freeze({
      id: 'stuka',
      name: 'JU 87 STUKA',
      energyBias: 0.10,
      dragScale: 1.08,
      turnDragScale: 1.15,
      misalignmentDragScale: 1.10,
      pitchRateScale: 0.78,
      rollRateScale: 0.72,
      angularResponseScale: 0.82,
      angularReleaseScale: 0.86,
      coordinatedTurnScale: 0.82,
      liftScale: 0.95,
      stallSpeedScale: 1.08,
      overspeedStart: 225,
      overspeedDrag: 0.00090,
      maxOverspeedDrag: 15,
      structuralPositiveG: 9.5,
      structuralNegativeG: -4.5,
    }),

    scout: Object.freeze({
      id: 'scout',
      name: 'ALPINE SCOUT',
      energyBias: 0.16,
      dragScale: 0.88,
      turnDragScale: 0.82,
      misalignmentDragScale: 0.88,
      pitchRateScale: 1.18,
      rollRateScale: 1.25,
      angularResponseScale: 1.18,
      angularReleaseScale: 1.15,
      coordinatedTurnScale: 1.15,
      liftScale: 1.10,
      stallSpeedScale: 0.88,
      overspeedStart: 145,
      overspeedDrag: 0.00180,
      maxOverspeedDrag: 17,
      structuralPositiveG: 7.8,
      structuralNegativeG: -3.8,
    }),

    glider: Object.freeze({
      id: 'glider',
      name: 'SKYLINE GLIDER',
      energyBias: -0.015,
      dragScale: 0.42,
      turnDragScale: 0.68,
      misalignmentDragScale: 0.65,
      pitchRateScale: 0.92,
      rollRateScale: 1.03,
      angularResponseScale: 0.90,
      angularReleaseScale: 0.92,
      coordinatedTurnScale: 1.00,
      liftScale: 1.30,
      stallSpeedScale: 0.72,
      overspeedStart: 110,
      overspeedDrag: 0.00120,
      maxOverspeedDrag: 14,
      structuralPositiveG: 6.5,
      structuralNegativeG: -3.0,
    }),
  });

export function getAircraftFlightProfile(
  id,
) {
  return (
    AIRCRAFT_FLIGHT_PROFILES[id] ??
    AIRCRAFT_FLIGHT_PROFILES.zero
  );
}

export function getInitialAircraftFlightProfile() {
  let stored = 'zero';

  try {
    stored =
      globalThis.localStorage
        ?.getItem?.(
          PROFILE_STORAGE_KEY,
        ) ??
      'zero';
  } catch {}

  return getAircraftFlightProfile(
    stored,
  );
}
