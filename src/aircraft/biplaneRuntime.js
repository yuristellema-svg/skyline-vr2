import {
  setBiplaneDetailLevel,
} from './biplaneVisualShared.js';

const DEG = Math.PI / 180;

function clamp(value, minimum, maximum, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, numeric));
}

function setNeedle(instrument, angle) {
  const needle = instrument?.userData?.needle;
  if (needle?.rotation) needle.rotation.z = angle;
}

export function computeBiplanePropellerRate({
  speed = 0,
  throttle = 0,
  engineOn = true,
} = {}) {
  const safeSpeed = Math.max(0, Number(speed) || 0);
  const safeThrottle = clamp(throttle, 0, 1);
  if (!engineOn) return Math.min(8.5, safeSpeed * 0.085);
  return 8 + safeThrottle * 76 + Math.min(12, safeSpeed * 0.12);
}

/**
 * Optional control-surface presentation. This function owns no animation loop
 * and never changes the aircraft root pose. It can be called by SKYLINE CONTROL
 * after the shared render pose has been applied.
 */
export function applyBiplaneControlState(
  external,
  cockpit,
  {
    pitch = 0,
    roll = 0,
    yaw = 0,
    throttle = 0,
    mixture = 1,
  } = {},
) {
  const safePitch = clamp(pitch, -1, 1, 0);
  const safeRoll = clamp(roll, -1, 1, 0);
  const safeYaw = clamp(yaw, -1, 1, 0);
  const safeThrottle = clamp(throttle, 0, 1, 0);
  const safeMixture = clamp(mixture, 0, 1, 1);

  const surfaces = external?.userData?.controlSurfaces;
  if (surfaces?.leftAileron?.rotation) {
    surfaces.leftAileron.rotation.x = safeRoll * 17 * DEG;
  }
  if (surfaces?.rightAileron?.rotation) {
    surfaces.rightAileron.rotation.x = -safeRoll * 17 * DEG;
  }
  if (surfaces?.elevator?.rotation) {
    surfaces.elevator.rotation.x = -safePitch * 20 * DEG;
  }
  if (surfaces?.rudder?.rotation) {
    surfaces.rudder.rotation.y = safeYaw * 24 * DEG;
  }

  const controls = cockpit?.userData?.controls;
  if (controls?.controlStick?.rotation) {
    controls.controlStick.rotation.x = safePitch * 10 * DEG;
    controls.controlStick.rotation.z = -safeRoll * 11 * DEG;
  }
  const pedals = controls?.rudderPedals || [];
  if (pedals[0]?.rotation) pedals[0].rotation.x = -safeYaw * 8 * DEG;
  if (pedals[1]?.rotation) pedals[1].rotation.x = safeYaw * 8 * DEG;
  if (controls?.throttle?.rotation) {
    controls.throttle.rotation.x = (-32 + safeThrottle * 58) * DEG;
  }
  if (controls?.mixture?.rotation) {
    controls.mixture.rotation.x = (-24 + safeMixture * 42) * DEG;
  }

  return {
    pitch: safePitch,
    roll: safeRoll,
    yaw: safeYaw,
    throttle: safeThrottle,
    mixture: safeMixture,
  };
}

export function applyBiplaneInstrumentState(
  cockpit,
  {
    speed = 0,
    altitude = 0,
    rpm = 0,
    oilPressure = 0.7,
    verticalSpeed = 0,
    cylinderTemperature = 0.55,
    fuel = 1,
    slip = 0,
    heading = 0,
  } = {},
) {
  const instruments = cockpit?.userData?.instruments || [];
  const safeSpeed = Math.max(0, Number(speed) || 0);
  const safeAltitude = Math.max(0, Number(altitude) || 0);
  const safeRpm = Math.max(0, Number(rpm) || 0);
  const safeHeading = Number.isFinite(Number(heading))
    ? Number(heading)
    : 0;

  setNeedle(instruments[0], -1.90 + clamp(safeSpeed / 70, 0, 1) * 3.45);
  setNeedle(instruments[1], -1.55 + (safeAltitude % 3000) / 3000 * 3.10);
  setNeedle(instruments[2], -1.70 + clamp(safeRpm / 2400, 0, 1) * 3.25);
  setNeedle(instruments[3], -1.45 + clamp(oilPressure, 0, 1) * 2.90);
  setNeedle(instruments[4], clamp(verticalSpeed / 12, -1, 1) * 1.25);
  setNeedle(instruments[5], -1.35 + clamp(cylinderTemperature, 0, 1) * 2.70);
  setNeedle(instruments[6], -1.35 + clamp(fuel, 0, 1) * 2.70);

  const slipBall = cockpit?.userData?.slipBall;
  if (slipBall?.position) slipBall.position.x = 0.42 + clamp(slip, -1, 1) * 0.14;

  const compass = cockpit?.userData?.compass;
  if (compass?.rotation) compass.rotation.z = -safeHeading;

  return {
    speed: safeSpeed,
    altitude: safeAltitude,
    rpm: safeRpm,
  };
}

export function setBiplaneQuality(external, cockpit, level = 1) {
  const externalLevel = setBiplaneDetailLevel(external, level);
  const cockpitLevel = setBiplaneDetailLevel(cockpit, level);
  return {
    external: externalLevel,
    cockpit: cockpitLevel,
  };
}

export function resetBiplanePresentation(external, cockpit) {
  return applyBiplaneControlState(external, cockpit, {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0,
    mixture: 1,
  });
}
