import test from 'node:test'; import assert from 'node:assert/strict';
import { DEFAULT_AIRFIELD_CATALOG, normalizeAirfieldCatalog } from '../src/airfields/airfieldCatalog.js';
import { fromRunwayLocal, headingVector, thresholdForDirection } from '../src/airfields/airfieldGeometry.js';
import { resolveAirfields, runwaySurfaceHeight } from '../src/airfields/terrainFit.js';
import { computeGroundStep, estimateStoppingDistance, evaluateTouchdown } from '../src/airfields/landingMath.js';
import { approachCandidate, bestApproachForField, departureCandidate } from '../src/navigation/fieldSelection.js';
import { guidanceStatus, papiState } from '../src/navigation/approachGuidance.js';
import { radioSignal, strongestRadio } from '../src/navigation/radioNavigation.js';
import { capabilityMatrix, landingCapability, takeoffCapability } from '../src/airfields/landingCapability.js';
import { auditApproachClearance } from '../src/airfields/obstacleClearance.js';

const catalog = normalizeAirfieldCatalog(DEFAULT_AIRFIELD_CATALOG); const fields = resolveAirfields(catalog, () => 100);
const profiles = {
 zero: { id: 'zero', enginePower: 15.2, takeoffSpeed: 34, touchdownSpeed: 42, touchdownSink: 3, touchdownBank: 10, touchdownHeading: 18, rollingDrag: 1.5, brakePower: 12, airbrakeDrag: 1.2 },
 scout: { id: 'scout', enginePower: 11.8, takeoffSpeed: 23, touchdownSpeed: 31, touchdownSink: 3.2, touchdownBank: 12, touchdownHeading: 22, rollingDrag: 2.2, brakePower: 14, airbrakeDrag: 2.1 },
 biplane: { id: 'biplane', enginePower: 8.6, takeoffSpeed: 19, touchdownSpeed: 22, touchdownSink: 2.6, touchdownBank: 12, touchdownHeading: 24, rollingDrag: 2.9, brakePower: 10, airbrakeDrag: 3.2 },
 glider: { id: 'glider', enginePower: 0, takeoffSpeed: Infinity, touchdownSpeed: 27, touchdownSink: 2.8, touchdownBank: 12, touchdownHeading: 24, rollingDrag: 2.6, brakePower: 10, airbrakeDrag: 17 },
};

test('stopping distance grows quadratically and includes reaction margin', () => { const a = estimateStoppingDistance({ speed: 20, profile: profiles.zero, surface: fields[0].surface }), b = estimateStoppingDistance({ speed: 40, profile: profiles.zero, surface: fields[0].surface }); assert.ok(b.total > a.total * 2.5); assert.ok(a.reaction > 0); });

test('touchdown grading includes drift and runway remaining', () => {
  const base = { profile: profiles.zero, speed: 38, sinkRate: 2.2, bankDegrees: 5, headingErrorDegrees: 7, lateralSpeed: 1, throttle: 0.2, inside: true, touchdownWindow: true, remainingRunway: 800, surface: fields[0].surface };
  assert.equal(evaluateTouchdown(base).quality, 'good'); assert.equal(evaluateTouchdown({ ...base, touchdownWindow: false }).quality, 'late'); assert.equal(evaluateTouchdown({ ...base, remainingRunway: 40 }).quality, 'overrun-risk'); assert.equal(evaluateTouchdown({ ...base, lateralSpeed: 12 }).quality, 'hard'); assert.equal(evaluateTouchdown({ ...base, inside: false }).quality, 'outside');
});

test('ground dynamics include runway grade, braking and takeoff', () => {
  const downhill = computeGroundStep({ dt: 1, speed: 25, profile: profiles.zero, powerState: { engineOn: false, throttle: 0, brake: 0, airbrake: 0 }, surface: fields[0].surface, longitudinalGrade: -0.04 });
  const uphill = computeGroundStep({ dt: 1, speed: 25, profile: profiles.zero, powerState: { engineOn: false, throttle: 0, brake: 0, airbrake: 0 }, surface: fields[0].surface, longitudinalGrade: 0.04 }); assert.ok(downhill.speed > uphill.speed);
  const takeoff = computeGroundStep({ dt: 1, speed: 34, profile: profiles.zero, powerState: { engineOn: true, throttle: 1, brake: 0, airbrake: 0 }, surface: fields[0].surface }); assert.equal(takeoff.takeoff, true);
});

test('one-way mountain approach selection never chooses the closed end', () => {
  const field = fields.find(f => f.id === 'crown-ridge'), sign = 1, threshold = thresholdForDirection(field, sign), world = fromRunwayLocal(field, { along: threshold.along - 600, lateral: 0 }), forward = headingVector(field.heading);
  const flight = { position: { x: world.x, y: 170, z: world.z }, velocity: { x: forward.x * 35, y: -2, z: forward.z * 35 }, aircraftProfile: profiles.scout, onGround: false };
  assert.equal(bestApproachForField(field, flight).sign, 1); assert.equal(approachCandidate(field, flight, -1).operation.allowed, false);
});

test('guidance reports approach, PAPI, heading and compact cue phase', () => {
  const field = fields[0], threshold = thresholdForDirection(field, 1), distance = 700, world = fromRunwayLocal(field, { along: threshold.along - distance, lateral: 10 }), forward = headingVector(field.heading), targetY = runwaySurfaceHeight(field, threshold) + Math.tan(field.approach.glideSlopeDegrees * Math.PI / 180) * distance;
  const flight = { position: { x: world.x, y: targetY + 2, z: world.z }, velocity: { x: forward.x * 55, y: -2, z: forward.z * 55 }, aircraftProfile: profiles.zero, onGround: false };
  const status = guidanceStatus(fields, flight, field.id); assert.equal(status.approach, true); assert.equal(status.cue.phase, 'approach'); assert.equal(status.papi, 'two-white-two-red'); assert.ok(Math.abs(status.cue.horizontal) < 1);
});

test('PAPI state covers high, on-slope and low conditions', () => { assert.equal(papiState(9), 'four-white'); assert.equal(papiState(0), 'two-white-two-red'); assert.equal(papiState(-9), 'four-red'); });

test('departure guidance respects takeoff direction restrictions', () => {
  const field = fields.find(f => f.id === 'crown-ridge'), sign = -1, world = fromRunwayLocal(field, { along: -field.length / 2 - 250, lateral: 4 }), forward = headingVector(field.heading + Math.PI);
  const flight = { position: { x: world.x, y: 170, z: world.z }, velocity: { x: forward.x * 32, y: 4, z: forward.z * 32 }, aircraftProfile: profiles.scout, onGround: false };
  assert.equal(departureCandidate(field, flight, sign).operation.allowed, true); assert.equal(departureCandidate(field, flight, 1).operation.allowed, false);
});

test('radio navigation strength falls with distance and selects strongest field', () => { const field = fields[0], near = radioSignal(field, field.center), far = radioSignal(field, { x: field.center.x + 9000, z: field.center.z }); assert.ok(near.strength > far.strength); assert.equal(strongestRadio(fields, field.center).fieldId, field.id); });

test('capability matrix handles powered aircraft and glider correctly', () => {
  const primary = fields[0], crown = fields[1]; assert.equal(landingCapability(primary, profiles.zero, 1).capable, true); assert.equal(landingCapability(crown, profiles.zero, 1).allowed, false); assert.equal(landingCapability(crown, profiles.glider, 1).allowed, true); assert.equal(takeoffCapability(crown, profiles.glider, -1).allowed, false);
  assert.equal(capabilityMatrix(fields, Object.values(profiles)).length, fields.length * Object.keys(profiles).length * 4);
});

test('terrain obstacle audit detects clear and blocked approaches', () => {
  const field = fields[0]; const clear = auditApproachClearance(field, 1, () => 70); assert.equal(clear.operational, true);
  const blocked = auditApproachClearance(field, 1, (x, z) => Math.hypot(x - field.center.x, z - field.center.z) > 400 ? 250 : 70); assert.equal(blocked.operational, false); assert.ok(blocked.minimumMargin < 0);
});
