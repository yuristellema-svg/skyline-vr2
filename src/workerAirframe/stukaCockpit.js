import { resolveAirframeProfile, structuralWarningData } from './flightProfiles.js';

export function toLegacyFlightProfile(value) {
  const profile = resolveAirframeProfile(value);
  return Object.freeze({
    id: profile.id,
    name: profile.name,
    energyBias: profile.energyBias,
    dragScale: profile.dragScale,
    turnDragScale: profile.turnDragScale,
    misalignmentDragScale: profile.misalignmentDragScale,
    pitchRateScale: profile.pitchRateScale,
    rollRateScale: profile.rollRateScale,
    angularResponseScale: profile.angularResponseScale,
    angularReleaseScale: profile.angularReleaseScale,
    coordinatedTurnScale: profile.coordinatedTurnScale,
    liftScale: profile.liftScale,
    stallSpeedScale: profile.stallSpeedScale,
    overspeedStart: profile.overspeedStart,
    overspeedDrag: profile.overspeedDrag,
    maxOverspeedDrag: profile.maxOverspeedDrag,
    structuralPositiveG: profile.structuralPositiveG,
    structuralNegativeG: profile.structuralNegativeG,
  });
}

export function aircraftChangedEventDetail(value, index = 0) {
  const profile = resolveAirframeProfile(value);
  return Object.freeze({
    id: profile.id,
    index,
    name: profile.name,
    engine: profile.powered ? profile.audioIdentity : 'WIND',
    audioIdentity: profile.audioIdentity,
    aiIdentity: profile.aiIdentity,
  });
}

export function deriveAirframeWarningData(value, flightState) {
  return structuralWarningData(resolveAirframeProfile(value), flightState);
}

export function verifyBaselineProfileContract(source) {
  const required = [
    'energyBias',
    'turnDragScale',
    'rollRateScale',
    'overspeedStart',
    'structuralPositiveG',
  ];
  return Object.freeze({
    compatible: required.every(token => String(source).includes(token)),
    missing: required.filter(token => !String(source).includes(token)),
  });
}
