function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function estimateStoppingDistance({ speed, profile, surface, brake = 1, reactionSeconds = 0.35, safetyFactor = 1.18 }) {
  const rolling = Math.max(0.1, profile.rollingDrag * (Number(surface?.rollingDragScale) || 1));
  const braking = Math.max(0, profile.brakePower * (Number(surface?.brakeScale) || 1) * clamp(brake, 0, 1));
  const deceleration = Math.max(0.5, rolling + braking);
  return Object.freeze({ reaction: speed * reactionSeconds, braking: speed * speed / (2 * deceleration), total: (speed * reactionSeconds + speed * speed / (2 * deceleration)) * safetyFactor, deceleration });
}

export function evaluateTouchdown({ profile, speed, sinkRate, bankDegrees, headingErrorDegrees, lateralSpeed = 0, throttle, inside, touchdownWindow = true, remainingRunway = Infinity, surface }) {
  if (!inside) return Object.freeze({ quality: 'outside', valid: false, marginal: false, stoppingDistance: Infinity, runwayMargin: -Infinity });
  const stopping = estimateStoppingDistance({ speed, profile, surface, brake: 0.82 });
  const runwayMargin = remainingRunway - stopping.total;
  const powerSafe = profile.enginePower <= 0 || throttle <= 0.40;
  const validEnvelope = powerSafe && speed <= profile.touchdownSpeed * 1.08 && sinkRate <= profile.touchdownSink * 1.15 && bankDegrees <= profile.touchdownBank * 1.25 && headingErrorDegrees <= profile.touchdownHeading * 1.25 && Math.abs(lateralSpeed) <= 4.5;
  if (validEnvelope && touchdownWindow && runwayMargin >= 0) return Object.freeze({ quality: 'good', valid: true, marginal: false, stoppingDistance: stopping.total, runwayMargin });
  if (validEnvelope && runwayMargin >= 0) return Object.freeze({ quality: touchdownWindow ? 'good' : 'late', valid: true, marginal: !touchdownWindow, stoppingDistance: stopping.total, runwayMargin });
  const marginal = throttle <= 0.67 && speed <= profile.touchdownSpeed * 1.34 && sinkRate <= profile.touchdownSink * 1.85 && bankDegrees <= profile.touchdownBank * 2 && headingErrorDegrees <= profile.touchdownHeading * 2 && Math.abs(lateralSpeed) <= 8;
  let quality = 'hard';
  if (marginal && runwayMargin < 0) quality = 'overrun-risk';
  else if (marginal) quality = touchdownWindow ? 'bounce' : 'late';
  return Object.freeze({ quality, valid: false, marginal, stoppingDistance: stopping.total, runwayMargin });
}

export function computeGroundStep({ dt, speed, profile, powerState, surface, longitudinalGrade = 0 }) {
  const automaticBrake = !powerState.engineOn && profile.enginePower > 0 ? 0.68 : 0;
  const brake = Math.max(Number(powerState.brake) || 0, automaticBrake);
  const engine = powerState.engineOn ? profile.enginePower * (Number(powerState.throttle) || 0) * 0.72 : 0;
  const airbrake = profile.airbrakeDrag * (Number(powerState.airbrake) || 0) * 0.55;
  const rollingDrag = profile.rollingDrag * (Number(surface?.rollingDragScale) || 1);
  const brakePower = profile.brakePower * (Number(surface?.brakeScale) || 1);
  const gradeAcceleration = -9.81 * Number(longitudinalGrade || 0);
  const acceleration = engine + gradeAcceleration - rollingDrag - brakePower * brake - airbrake;
  const nextSpeed = Math.max(0, speed + acceleration * dt);
  const takeoff = profile.enginePower > 0 && powerState.engineOn && (Number(powerState.throttle) || 0) >= 0.95 && nextSpeed >= profile.takeoffSpeed;
  return Object.freeze({ speed: nextSpeed, distance: (speed + nextSpeed) * 0.5 * dt, takeoff, stopped: nextSpeed <= 1, acceleration, brake });
}
