import {
  BIPLANE_DISPLAY_NAME,
  BIPLANE_ID,
  PT17_REFERENCE,
} from './biplaneSpecs.js';

function profile(values) {
  return Object.freeze(values);
}

// Fields below mirror the currently integrated AIRCRAFT_FLIGHT_PROFILES shape.
// They can be copied directly without requiring flightModel.js changes.
export const BIPLANE_FLIGHT_PROFILE_PROPOSAL = profile({
  id: BIPLANE_ID,
  name: BIPLANE_DISPLAY_NAME,
  energyBias: 0.012,
  dragScale: 1.62,
  turnDragScale: 1.46,
  misalignmentDragScale: 1.40,
  pitchRateScale: 0.82,
  rollRateScale: 0.92,
  angularResponseScale: 1.02,
  angularReleaseScale: 0.86,
  coordinatedTurnScale: 0.90,
  liftScale: 1.30,
  stallSpeedScale: 0.68,
  enginePower: 8.6,
  engineResponse: 1.65,
  cruiseSpeed: PT17_REFERENCE.performanceReference.cruiseMps,
  maximumLevelSpeed: 54,
  takeoffSpeed: 19,
  airbrakeDrag: 3.2,
  minimumEnergyLoss: 0,
  gravityScaleDive: 0.86,
  gravityScaleClimb: 0.88,
  touchdownSpeed: 22,
  touchdownSink: 2.6,
  touchdownBank: 12,
  touchdownHeading: 24,
  rollingDrag: 2.9,
  brakePower: 10,
  overspeedStart: 67,
  overspeedDrag: 0.00335,
  maxOverspeedDrag: 25,
  structuralPositiveG: 6.0,
  structuralNegativeG: -3.0,
});

// Optional future handling extensions are isolated so SKYLINE CONTROL can
// review them without silently adding unsupported fields to the live profile.
export const BIPLANE_HANDLING_EXTENSIONS = profile({
  stallBreakSharpness: 0.50,
  postStallControlScale: 0.74,
  climbEnergyBleedScale: 1.52,
  diveAccelerationScale: 0.70,
  initialRollResponseScale: 1.08,
  sustainedRollRateScale: 0.74,
  groundRunScale: 0.64,
  handlingIntent: Object.freeze({
    slowestPoweredAircraft: true,
    excellentLowSpeedLift: true,
    forgivingStall: true,
    strongParasiteDrag: true,
    rapidClimbSpeedLoss: true,
    moderatePitchResponse: true,
    responsiveInitialRoll: true,
    limitedSustainedRollRate: true,
    shortTakeoffAndLanding: true,
    slowerDiveBuildThanZero: true,
    noHardSpeedCap: true,
  }),
});

export function createBiplaneProfileProposal() {
  return {
    ...BIPLANE_FLIGHT_PROFILE_PROPOSAL,
  };
}
