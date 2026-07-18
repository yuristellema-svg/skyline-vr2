import * as THREE from '../../vendor/three.module.min.js';
import { DEFAULT_AIRFIELD_CATALOG, normalizeAirfieldCatalog } from '../airfields/airfieldCatalog.js';
import { angleDifference, containsRunwayPoint, distanceFromThreshold, headingVector, rightVector, runwayDirection, runwayDirectionForVelocity, runwayDesignator, toRunwayLocal, velocityHeading, fromRunwayLocal } from '../airfields/airfieldGeometry.js';
import { resolveAirfields, runwaySurfaceHeight, terrainFitSummary } from '../airfields/terrainFit.js';
import { computeGroundStep, evaluateTouchdown } from '../airfields/landingMath.js';
import { operationStatus } from '../airfields/operations.js';
import { AirfieldVisualSystem } from '../airfields/airfieldVisuals.js';
import { AirfieldDiagnosticsVisual } from '../airfields/airfieldDiagnostics.js';

export { evaluateTouchdown } from '../airfields/landingMath.js';
const DEG = Math.PI / 180;
const PLAYER_RADIUS = 1.25;
function dispatch(type, detail) { const target = globalThis.window, EventCtor = globalThis.CustomEvent; if (target?.dispatchEvent && typeof EventCtor === 'function') target.dispatchEvent(new EventCtor(type, { detail })); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export class LandingSystem {
  constructor(scene, sampleHeight, options = {}) {
    this.scene = scene; this.sampleHeight = sampleHeight;
    this.catalog = normalizeAirfieldCatalog(options.catalog || DEFAULT_AIRFIELD_CATALOG);
    this.zones = resolveAirfields(this.catalog, sampleHeight, options.terrainFit); this.airfields = this.zones;
    this.state = 'airborne'; this.zone = null; this.directionSign = 1; this.bounces = 0; this.rolloutDistance = 0; this.pendingCrashReason = '';
    this.groundAlong = 0; this.groundLateral = 0; this.groundLateralSpeed = 0;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ'); this.direction = new THREE.Vector3();
    this.visuals = new AirfieldVisualSystem(scene, this.zones, { sampleHeight });
    this.diagnostics = new AirfieldDiagnosticsVisual(scene, this.zones); this.root = this.visuals.root;
    this._onDiagnostics = event => this.diagnostics.setVisible(event?.detail?.visible ?? event?.detail ?? false);
    this._onSpawnRequest = event => { const hook = this.getFieldStart(event?.detail?.fieldId, event?.detail?.directionSign); if (hook) dispatch('skyline:airfield-spawn-ready', hook); };
    globalThis.window?.addEventListener?.('skyline:airfield-diagnostics', this._onDiagnostics);
    globalThis.window?.addEventListener?.('skyline:airfield-spawn-request', this._onSpawnRequest);
  }
  get grounded() { return this.state === 'rollout' || this.state === 'stopped'; }
  getField(fieldId) { return this.zones.find(field => field.id === fieldId) || null; }
  reset() { this.state = 'airborne'; this.zone = null; this.directionSign = 1; this.bounces = 0; this.rolloutDistance = 0; this.pendingCrashReason = ''; this.groundAlong = 0; this.groundLateral = 0; this.groundLateralSpeed = 0; }
  localCoordinates(zone, position) { return toRunwayLocal(zone, position); }
  surfaceHeightAt(zone, positionOrLocal) { return runwaySurfaceHeight(zone, positionOrLocal); }
  zoneAt(position, margin = 0) { return this.zones.find(zone => containsRunwayPoint(zone, position, margin)) || null; }

  afterFlightStep(flight, powerState) {
    if (this.grounded) { if (this.pendingCrashReason) { const crashReason = this.pendingCrashReason; this.pendingCrashReason = ''; return { suppressCollision: false, crashReason }; } return { suppressCollision: true, crashReason: '' }; }
    const zone = this.zoneAt(flight.position, 3); if (!zone) return { suppressCollision: false, crashReason: '' };
    const local = toRunwayLocal(zone, flight.position); const surfaceY = runwaySurfaceHeight(zone, local);
    if (flight.position.y - PLAYER_RADIUS > surfaceY + 1.1) return { suppressCollision: true, crashReason: '' };
    const inside = containsRunwayPoint(zone, flight.position, 0);
    const direction = runwayDirectionForVelocity(zone, flight.velocity);
    const operation = operationStatus(zone, flight.aircraftProfile, 'landing', direction.sign);
    if (!operation.allowed) return { suppressCollision: false, crashReason: `${operation.reasons[0]?.includes('direction') ? 'WRONG-WAY LANDING' : 'FIELD RESTRICTED'} · ${zone.name}` };
    const displaced = Number(zone.operations.displacedThreshold?.[String(direction.sign)]) || 0;
    const touchdownDistance = distanceFromThreshold(zone, local, direction.sign) - displaced;
    const touchdownWindow = touchdownDistance >= 0 && touchdownDistance <= zone.length * zone.approach.touchdownZoneFraction;
    const remainingRunway = zone.length - Math.max(0, touchdownDistance) + zone.operations.overrun;
    this.euler.setFromQuaternion(flight.attitude, 'YXZ');
    const bankDegrees = Math.abs(this.euler.z) / DEG, sinkRate = Math.max(0, -flight.velocity.y);
    const headingErrorDegrees = Math.abs(angleDifference(velocityHeading(flight.velocity), direction.heading)) / DEG;
    const right = rightVector(direction.heading); const lateralSpeed = flight.velocity.x * right.x + flight.velocity.z * right.z;
    const result = evaluateTouchdown({ profile: flight.aircraftProfile, speed: flight.speed, sinkRate, bankDegrees, headingErrorDegrees, lateralSpeed, throttle: powerState.throttle, inside, touchdownWindow, remainingRunway, surface: zone.surface });
    const detail = { zoneId: zone.id, fieldId: zone.id, zoneName: zone.name, runwayDesignator: runwayDesignator(direction.heading), quality: result.quality, speed: flight.speed, verticalSpeed: -sinkRate, bankDegrees, headingErrorDegrees, lateralSpeed, touchdownDistance, remainingRunway, stoppingDistance: result.stoppingDistance, runwayMargin: result.runwayMargin, terrainOperational: zone.terrainFit.operational };
    if (result.valid) { this.beginRollout(flight, zone, direction.sign, local, lateralSpeed); dispatch('skyline:touchdown', detail); return { suppressCollision: true, crashReason: '' }; }
    if (result.quality === 'overrun-risk') return { suppressCollision: false, crashReason: `RUNWAY TOO SHORT · ${zone.name}` };
    if (result.marginal && this.bounces < 1) { this.bounces += 1; flight.position.y = surfaceY + PLAYER_RADIUS + 0.45; flight.velocity.y = Math.max(2.2, sinkRate * 0.38); flight.speed = flight.velocity.length(); dispatch('skyline:touchdown', detail); return { suppressCollision: true, crashReason: '' }; }
    return { suppressCollision: false, crashReason: `HARD LANDING · ${zone.name}` };
  }

  beginRollout(flight, zone, directionSign = 1, local = toRunwayLocal(zone, flight.position), lateralSpeed = 0) {
    this.state = 'rollout'; this.zone = zone; this.directionSign = directionSign >= 0 ? 1 : -1; this.rolloutDistance = 0; this.pendingCrashReason = '';
    this.groundAlong = local.along; this.groundLateral = local.lateral; this.groundLateralSpeed = lateralSpeed;
    flight.onGround = true; flight.groundZoneId = zone.id; flight.landingState = 'rollout';
    this.applyGroundPose(flight);
  }

  applyGroundPose(flight) {
    const zone = this.zone, direction = runwayDirection(zone, this.directionSign), world = fromRunwayLocal(zone, { along: this.groundAlong, lateral: this.groundLateral });
    const right = rightVector(direction.heading);
    flight.position.set(world.x, runwaySurfaceHeight(zone, { along: this.groundAlong, lateral: this.groundLateral }) + PLAYER_RADIUS, world.z);
    flight.velocity.set(direction.forward.x * flight.speed + right.x * this.groundLateralSpeed, 0, direction.forward.z * flight.speed + right.z * this.groundLateralSpeed);
    flight.attitude.setFromEuler(new THREE.Euler(0, direction.heading, 0, 'YXZ')); flight.angularVelocity.set(0, 0, 0);
  }

  stepGround(dt, flight, powerState) {
    if (!this.grounded || !this.zone) return;
    const zone = this.zone, profile = flight.aircraftProfile;
    const sampleDistance = 3, before = runwaySurfaceHeight(zone, { along: this.groundAlong - this.directionSign * sampleDistance, lateral: 0 }), after = runwaySurfaceHeight(zone, { along: this.groundAlong + this.directionSign * sampleDistance, lateral: 0 });
    const grade = (after - before) / (sampleDistance * 2);
    const step = computeGroundStep({ dt, speed: flight.speed, profile, powerState, surface: zone.surface, longitudinalGrade: grade });
    flight.speed = step.speed;
    const grip = clamp(Number(zone.surface.lateralGrip) || 1, 0.1, 2); const lateralDamping = Math.exp(-dt * (1.4 + grip * 2.5 + step.brake * 2.2));
    this.groundLateralSpeed *= lateralDamping;
    this.groundAlong += this.directionSign * step.distance;
    this.groundLateral += this.groundLateralSpeed * dt;
    this.rolloutDistance += Math.hypot(step.distance, this.groundLateralSpeed * dt);
    this.applyGroundPose(flight);
    const lateralLimit = zone.width / 2 + zone.operations.shoulder, alongLimit = zone.length / 2 + zone.operations.overrun;
    if (Math.abs(this.groundLateral) > lateralLimit) { this.pendingCrashReason = `RUNWAY EXCURSION · ${zone.name}`; return; }
    if (Math.abs(this.groundAlong) > alongLimit) { this.pendingCrashReason = `RUNWAY OVERRUN · ${zone.name}`; return; }
    const takeoffOperation = operationStatus(zone, profile, 'takeoff', this.directionSign);
    if (step.takeoff && takeoffOperation.allowed) {
      const direction = runwayDirection(zone, this.directionSign); this.state = 'airborne'; flight.onGround = false; flight.groundZoneId = ''; flight.landingState = 'airborne';
      flight.position.y += 2.2; flight.velocity.set(direction.forward.x * flight.speed, 3.2, direction.forward.z * flight.speed); flight.speed = flight.velocity.length(); flight.attitude.setFromEuler(new THREE.Euler(5 * DEG, direction.heading, 0, 'YXZ'));
      dispatch('skyline:takeoff', { zoneId: zone.id, fieldId: zone.id, directionSign: this.directionSign, rolloutDistance: this.rolloutDistance }); this.zone = null; return;
    }
    if (step.takeoff && !takeoffOperation.allowed) { this.pendingCrashReason = `TAKEOFF DIRECTION CLOSED · ${zone.name}`; return; }
    if (step.stopped) { flight.speed = 0; flight.velocity.set(0, 0, 0); if (this.state !== 'stopped') { this.state = 'stopped'; flight.landingState = 'stopped'; dispatch('skyline:landed', { zoneId: zone.id, fieldId: zone.id, zoneName: zone.name, rolloutDistance: this.rolloutDistance, lateralOffset: this.groundLateral }); } } else this.state = 'rollout';
  }

  getFieldStart(fieldId = this.zones[0]?.id, directionSign = null) {
    const field = this.getField(fieldId); if (!field) return null;
    const sign = directionSign == null ? field.operations.takeoffDirections[0] : (directionSign >= 0 ? 1 : -1);
    if (!field.operations.takeoffDirections.includes(sign)) return null;
    const direction = runwayDirection(field, sign); const along = -direction.sign * (field.length / 2 - field.operations.startInset); const position = fromRunwayLocal(field, { along, lateral: 0 });
    return Object.freeze({ fieldId: field.id, fieldName: field.name, position: Object.freeze([position.x, runwaySurfaceHeight(field, { along, lateral: 0 }) + PLAYER_RADIUS, position.z]), heading: direction.heading, directionSign: direction.sign, recommendedSpeed: 0, terrainOperational: field.terrainFit.operational });
  }
  getTerrainDiagnostics() { return terrainFitSummary(this.zones); }
  setDiagnosticsVisible(visible) { return this.diagnostics.setVisible(visible); }
  update(dt = 0) { this.visuals.update(dt); }
  dispose() { globalThis.window?.removeEventListener?.('skyline:airfield-diagnostics', this._onDiagnostics); globalThis.window?.removeEventListener?.('skyline:airfield-spawn-request', this._onSpawnRequest); this.diagnostics.dispose(); this.visuals.dispose(); }
}
