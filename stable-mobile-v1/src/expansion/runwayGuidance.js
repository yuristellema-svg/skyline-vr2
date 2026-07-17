import * as THREE from '../../vendor/three.module.min.js';

function localCoordinates(
  zone,
  position,
) {
  const dx =
    position.x - zone.x;

  const dz =
    position.z - zone.z;

  const forwardX =
    Math.sin(zone.heading);

  const forwardZ =
    -Math.cos(zone.heading);

  const rightX =
    Math.cos(zone.heading);

  const rightZ =
    Math.sin(zone.heading);

  return {
    along:
      dx * forwardX +
      dz * forwardZ,

    lateral:
      dx * rightX +
      dz * rightZ,
  };
}

export function distanceToRunway(
  zone,
  position,
) {
  const local =
    localCoordinates(
      zone,
      position,
    );

  const alongOutside =
    Math.max(
      0,
      Math.abs(local.along) -
        zone.length / 2,
    );

  const lateralOutside =
    Math.max(
      0,
      Math.abs(local.lateral) -
        zone.width / 2,
    );

  return Math.hypot(
    alongOutside,
    lateralOutside,
  );
}

export class RunwayGuidanceSystem {
  constructor(
    scene,
    landingSystem,
  ) {
    this.scene = scene;

    this.zones =
      landingSystem.zones;

    this.root =
      new THREE.Group();

    this.root.name =
      'skyline-runway-guidance';

    scene.add(this.root);

    this.status = {
      name: '',
      distance: Infinity,
      approach: false,
    };

    this.buildVisuals();
  }

  buildVisuals() {
    for (const zone of this.zones) {
      const group =
        new THREE.Group();

      group.name =
        `runway-guidance-${zone.id}`;

      group.position.set(
        zone.x,
        zone.surfaceY,
        zone.z,
      );

      group.rotation.y =
        zone.heading;

      const material =
        new THREE.MeshBasicMaterial({
          color:
            zone.surface === 'paved'
              ? 0x78d5ff
              : 0xffd16a,

          transparent: true,
          opacity: 0.78,
          toneMapped: false,
          depthWrite: false,
        });

      for (const end of [-1, 1]) {
        for (
          let step = 0;
          step < 3;
          step += 1
        ) {
          const distance =
            zone.length / 2 +
            150 +
            step * 180;

          const width =
            zone.width *
            (
              1.08 +
              step * 0.18
            );

          const height =
            13 +
            step * 4;

          const frame =
            new THREE.Group();

          const left =
            new THREE.Mesh(
              new THREE.BoxGeometry(
                1.15,
                height,
                1.15,
              ),
              material,
            );

          left.position.set(
            -width / 2,
            height / 2,
            0,
          );

          const right =
            left.clone();

          right.position.x =
            width / 2;

          const top =
            new THREE.Mesh(
              new THREE.BoxGeometry(
                width,
                1.15,
                1.15,
              ),
              material,
            );

          top.position.y =
            height;

          frame.add(
            left,
            right,
            top,
          );

          frame.position.z =
            end * distance;

          group.add(frame);
        }
      }

      this.root.add(group);
    }
  }

  update(flight) {
    if (!flight?.position) {
      return;
    }

    let nearest = null;
    let nearestDistance =
      Infinity;

    for (const zone of this.zones) {
      const distance =
        distanceToRunway(
          zone,
          flight.position,
        );

      if (
        distance <
        nearestDistance
      ) {
        nearest = zone;

        nearestDistance =
          distance;
      }
    }

    const altitudeAbove =
      nearest
        ? flight.position.y -
          nearest.surfaceY
        : Infinity;

    const approach =
      Boolean(nearest) &&
      !flight.onGround &&
      nearestDistance <= 1400 &&
      altitudeAbove >= -5 &&
      altitudeAbove <= 320;

    this.status = {
      name:
        nearest?.name || '',

      distance:
        nearestDistance,

      approach,
    };

    flight.runwayName =
      this.status.name;

    flight.runwayDistance =
      this.status.distance;

    flight.runwayApproach =
      this.status.approach;
  }

  getStatus() {
    return {
      ...this.status,
    };
  }

  dispose() {
    this.scene.remove(
      this.root,
    );

    this.root.traverse(
      object => {
        object.geometry
          ?.dispose?.();

        object.material
          ?.dispose?.();
      },
    );
  }
}
