import * as THREE from '../../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const PLAYER_RADIUS = 1.25;

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function headingOfVelocity(velocity) {
  return Math.atan2(velocity.x, -velocity.z);
}

function makeZone(sampleHeight, values) {
  const surfaceY = Number(sampleHeight?.(values.x, values.z)) || 0;
  return Object.freeze({
    ...values,
    surfaceY: surfaceY + 0.65,
  });
}

export function evaluateTouchdown({
  profile,
  speed,
  sinkRate,
  bankDegrees,
  headingErrorDegrees,
  throttle,
  inside,
}) {
  if (!inside) {
    return Object.freeze({
      quality: 'outside',
      valid: false,
      marginal: false,
    });
  }

  const powerSafe =
    profile.enginePower <= 0 ||
    throttle <= 0.40;

  const valid =
    powerSafe &&
    speed <= profile.touchdownSpeed * 1.08 &&
    sinkRate <= profile.touchdownSink * 1.15 &&
    bankDegrees <= profile.touchdownBank * 1.25 &&
    headingErrorDegrees <= profile.touchdownHeading * 1.25;

  if (valid) {
    return Object.freeze({
      quality: 'good',
      valid: true,
      marginal: false,
    });
  }

  const marginal =
    throttle <= 0.67 &&
    speed <= profile.touchdownSpeed * 1.34 &&
    sinkRate <= profile.touchdownSink * 1.85 &&
    bankDegrees <= profile.touchdownBank * 2.0 &&
    headingErrorDegrees <= profile.touchdownHeading * 2.0;

  return Object.freeze({
    quality:
      marginal
        ? 'bounce'
        : 'hard',
    valid: false,
    marginal,
  });
}

export class LandingSystem {
  constructor(scene, sampleHeight) {
    this.scene = scene;
    this.sampleHeight = sampleHeight;
    this.state = 'airborne';
    this.zone = null;
    this.bounces = 0;
    this.rolloutDistance = 0;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.direction = new THREE.Vector3();
    this.previousPosition = new THREE.Vector3();

    this.zones = Object.freeze([
      makeZone(sampleHeight, {
        id: 'city-runway',
        name: 'SKYLINE RUNWAY',
        x: 520,
        z: 380,
        heading: 0,
        length: 900,
        width: 76,
        surface: 'paved',
      }),
      makeZone(sampleHeight, {
        id: 'alpine-strip',
        name: 'ALPINE GRASS STRIP',
        x: -920,
        z: -260,
        heading: -18 * DEG,
        length: 600,
        width: 62,
        surface: 'grass',
      }),
    ]);

    this.root = new THREE.Group();
    this.root.name = 'skyline-landing-zones';
    scene.add(this.root);
    this.buildVisuals();
  }

  get grounded() {
    return this.state === 'rollout' || this.state === 'stopped';
  }

  buildVisuals() {
    for (const zone of this.zones) {
      const group = new THREE.Group();
      group.name = `landing-zone-${zone.id}`;
      group.position.set(zone.x, zone.surfaceY, zone.z);
      group.rotation.y = zone.heading;

      const surfaceMaterial = new THREE.MeshStandardMaterial({
        color: zone.surface === 'paved' ? 0x3f4241 : 0x64744a,
        roughness: 0.94,
        metalness: 0.02,
      });
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.width, zone.length),
        surfaceMaterial,
      );
      plane.rotation.x = -Math.PI / 2;
      group.add(plane);

      const markingMaterial = new THREE.MeshBasicMaterial({
        color: zone.surface === 'paved' ? 0xe5ddbf : 0xe4d3a2,
        toneMapped: false,
      });
      for (
        let offset = -zone.length * 0.38;
        offset <= zone.length * 0.38;
        offset += 58
      ) {
        const mark = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8, 18),
          markingMaterial,
        );
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(0, 0.025, offset);
        group.add(mark);
      }

      for (const end of [-1, 1]) {
        for (let index = -3; index <= 3; index += 1) {
          const light = new THREE.Mesh(
            new THREE.SphereGeometry(0.65, 8, 6),
            new THREE.MeshBasicMaterial({
              color: end < 0 ? 0xe9e2bc : 0xe34a3b,
              toneMapped: false,
            }),
          );
          light.position.set(
            index * zone.width / 8,
            0.35,
            end * (zone.length / 2 - 3),
          );
          group.add(light);
        }
      }
      this.root.add(group);
    }
  }

  reset() {
    this.state = 'airborne';
    this.zone = null;
    this.bounces = 0;
    this.rolloutDistance = 0;
  }

  localCoordinates(zone, position) {
    const dx = position.x - zone.x;
    const dz = position.z - zone.z;
    const forwardX = Math.sin(zone.heading);
    const forwardZ = -Math.cos(zone.heading);
    const rightX = Math.cos(zone.heading);
    const rightZ = Math.sin(zone.heading);
    return {
      along: dx * forwardX + dz * forwardZ,
      lateral: dx * rightX + dz * rightZ,
    };
  }

  zoneAt(position, margin = 0) {
    for (const zone of this.zones) {
      const local = this.localCoordinates(zone, position);
      if (
        Math.abs(local.along) <= zone.length / 2 + margin &&
        Math.abs(local.lateral) <= zone.width / 2 + margin
      ) {
        return zone;
      }
    }
    return null;
  }

  afterFlightStep(flight, powerState) {
    if (this.grounded) {
      return { suppressCollision: true, crashReason: '' };
    }

    const zone = this.zoneAt(flight.position, 2);
    if (!zone) return { suppressCollision: false, crashReason: '' };

    const wheelHeight = flight.position.y - PLAYER_RADIUS;
    const contact = wheelHeight <= zone.surfaceY + 1.1;
    if (!contact) return { suppressCollision: true, crashReason: '' };

    const local = this.localCoordinates(zone, flight.position);
    const inside =
      Math.abs(local.along) <= zone.length / 2 &&
      Math.abs(local.lateral) <= zone.width / 2;

    this.euler.setFromQuaternion(flight.attitude, 'YXZ');
    const bankDegrees = Math.abs(this.euler.z) / DEG;
    const sinkRate = Math.max(0, -flight.velocity.y);
    const headingErrorDegrees =
      Math.abs(angleDifference(
        headingOfVelocity(flight.velocity),
        zone.heading,
      )) / DEG;

    const result = evaluateTouchdown({
      profile: flight.aircraftProfile,
      speed: flight.speed,
      sinkRate,
      bankDegrees,
      headingErrorDegrees,
      throttle: powerState.throttle,
      inside,
    });

    const detail = {
      zoneId: zone.id,
      zoneName: zone.name,
      quality: result.quality,
      speed: flight.speed,
      verticalSpeed: -sinkRate,
      bankDegrees,
      headingErrorDegrees,
    };

    if (result.valid) {
      this.beginRollout(flight, zone);
      globalThis.window?.dispatchEvent?.(
        new CustomEvent('skyline:touchdown', { detail }),
      );
      return { suppressCollision: true, crashReason: '' };
    }

    if (result.marginal && this.bounces < 1) {
      this.bounces += 1;
      flight.position.y = zone.surfaceY + PLAYER_RADIUS + 0.45;
      flight.velocity.y = Math.max(2.2, sinkRate * 0.38);
      flight.speed = flight.velocity.length();
      globalThis.window?.dispatchEvent?.(
        new CustomEvent('skyline:touchdown', { detail }),
      );
      return { suppressCollision: true, crashReason: '' };
    }

    return {
      suppressCollision: false,
      crashReason: `HARD LANDING · ${zone.name}`,
    };
  }

  beginRollout(flight, zone) {
    this.state = 'rollout';
    this.zone = zone;
    this.rolloutDistance = 0;
    flight.onGround = true;
    flight.groundZoneId = zone.id;
    flight.landingState = 'rollout';
    this.constrainToZone(flight);
  }

  constrainToZone(flight) {
    const zone = this.zone;
    this.direction.set(
      Math.sin(zone.heading),
      0,
      -Math.cos(zone.heading),
    );
    flight.position.y = zone.surfaceY + PLAYER_RADIUS;
    flight.velocity.copy(this.direction).multiplyScalar(flight.speed);
    flight.attitude.setFromEuler(
      new THREE.Euler(0, zone.heading, 0, 'YXZ'),
    );
    flight.angularVelocity.set(0, 0, 0);
  }

  stepGround(dt, flight, powerState) {
    if (!this.grounded || !this.zone) return;

    const profile = flight.aircraftProfile;
    const automaticBrake =
      !powerState.engineOn && profile.enginePower > 0
        ? 0.68
        : 0;
    const brake = Math.max(powerState.brake || 0, automaticBrake);
    const engine = powerState.engineOn
      ? profile.enginePower * powerState.throttle * 0.72
      : 0;
    const airbrake =
      profile.airbrakeDrag * (powerState.airbrake || 0) * 0.55;
    const deceleration =
      profile.rollingDrag +
      profile.brakePower * brake +
      airbrake;

    flight.speed = Math.max(
      0,
      flight.speed + (engine - deceleration) * dt,
    );

    this.previousPosition.copy(flight.position);
    this.constrainToZone(flight);
    flight.position.addScaledVector(flight.velocity, dt);
    this.rolloutDistance +=
      this.previousPosition.distanceTo(flight.position);

    if (
      profile.enginePower > 0 &&
      powerState.engineOn &&
      powerState.throttle >= 0.95 &&
      flight.speed >= profile.takeoffSpeed
    ) {
      const zone = this.zone;
      this.state = 'airborne';
      flight.onGround = false;
      flight.groundZoneId = '';
      flight.landingState = 'airborne';
      flight.position.y += 2.2;
      flight.velocity.y = 3.2;
      flight.speed = flight.velocity.length();
      flight.attitude.setFromEuler(
        new THREE.Euler(5 * DEG, zone.heading, 0, 'YXZ'),
      );
      globalThis.window?.dispatchEvent?.(
        new CustomEvent('skyline:takeoff', {
          detail: { zoneId: zone.id },
        }),
      );
      this.zone = null;
      return;
    }

    if (flight.speed <= 1.0) {
      flight.speed = 0;
      flight.velocity.set(0, 0, 0);
      if (this.state !== 'stopped') {
        this.state = 'stopped';
        flight.landingState = 'stopped';
        globalThis.window?.dispatchEvent?.(
          new CustomEvent('skyline:landed', {
            detail: {
              zoneId: this.zone.id,
              zoneName: this.zone.name,
              rolloutDistance: this.rolloutDistance,
            },
          }),
        );
      }
    } else {
      this.state = 'rollout';
      flight.landingState = 'rollout';
    }
  }

  update() {}

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
  }
}
