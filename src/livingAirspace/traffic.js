import * as THREE from '../../vendor/three.module.min.js';
import {
  clamp,
  distanceSquared3,
  sampleClosedRoute,
} from './math.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const position = new THREE.Vector3();
const tangent = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const bankQuaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();

function typeScale(type) {
  if (type === 'sailplane') return [1.0, 0.72, 1.42];
  if (type === 'transport') return [1.55, 1.35, 1.48];
  if (type === 'floatplane') return [1.10, 1.05, 1.12];
  if (type === 'trainer') return [0.82, 0.86, 0.88];
  return [1, 1, 1];
}

function makeTrail(pool, route, maxPoints) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array(maxPoints * 3),
      3,
    ),
  );
  geometry.setDrawRange(0, 0);
  const material =
    pool.line(
      `traffic-contrail-${route.id}`,
      0xeaf7ff,
      { opacity: 0.18 },
    );
  const line = new THREE.Line(geometry, material);
  line.name = `traffic-contrail:${route.id}`;
  line.frustumCulled = false;

  return {
    line,
    geometry,
    points: [],
    maxPoints,
  };
}

export class LivingTrafficSystem {
  constructor(scene, pool, catalog) {
    this.scene = scene;
    this.pool = pool;
    this.catalog = catalog;
    this.elapsed = 0;
    this.updateCount = 0;
    this.root = new THREE.Group();
    this.root.name = 'Skyline authored living air traffic';
    scene.add(this.root);

    this.entries = [];
    this.trails = [];
    this.profile = null;

    for (const route of catalog.trafficRoutes) {
      const group = new THREE.Group();
      group.name = `living-traffic:${route.id}`;

      const body = new THREE.Mesh(
        pool.aircraftBodyGeometry(),
        pool.lambert(
          `traffic-body-${route.id}`,
          route.color,
        ),
      );
      const wing = new THREE.Mesh(
        pool.aircraftWingGeometry(),
        pool.lambert(
          `traffic-wing-${route.id}`,
          route.color,
        ),
      );
      const tail = new THREE.Mesh(
        pool.aircraftWingGeometry(),
        pool.lambert(
          `traffic-accent-${route.id}`,
          route.accent,
        ),
      );
      tail.scale.set(0.38, 0.38, 0.38);
      tail.position.z = 1.75;

      group.add(body, wing, tail);
      this.root.add(group);

      this.entries.push({
        route,
        group,
        previous: new THREE.Vector3(),
        speed: 0,
        audioSource: {
          id: route.id,
          category: route.category,
          type: route.type,
          position: group.position,
          speed: 0,
          gain: route.audio,
        },
      });
    }
  }

  setProfile(profile) {
    if (this.profile?.id === profile.id) return;
    this.profile = profile;

    for (const trail of this.trails) {
      this.root.remove(trail.line);
      trail.geometry.dispose();
    }
    this.trails.length = 0;

    for (const entry of this.entries) {
      if (!entry.route.contrail) continue;
      const trail =
        makeTrail(
          this.pool,
          entry.route,
          profile.contrailPoints,
        );
      this.root.add(trail.line);
      this.trails.push({
        ...trail,
        routeId: entry.route.id,
      });
    }
  }

  _updateTrail(routeId, point) {
    const trail =
      this.trails.find(item => item.routeId === routeId);
    if (!trail) return;

    trail.points.push(point.clone());
    while (trail.points.length > trail.maxPoints) {
      trail.points.shift();
    }

    const array =
      trail.geometry.attributes.position.array;
    trail.points.forEach((item, index) => {
      const offset = index * 3;
      array[offset] = item.x;
      array[offset + 1] = item.y;
      array[offset + 2] = item.z;
    });
    trail.geometry.setDrawRange(0, trail.points.length);
    trail.geometry.attributes.position.needsUpdate = true;
  }

  update(dt, flight) {
    const safeDt = clamp(Number(dt) || 0, 0, 0.1);
    this.elapsed += safeDt;
    this.updateCount += 1;

    for (const entry of this.entries) {
      entry.previous.copy(entry.group.position);

      const sample =
        sampleClosedRoute(entry.route, this.elapsed);

      position.set(
        sample.position.x,
        sample.position.y,
        sample.position.z,
      );
      tangent.set(
        sample.tangent.x,
        sample.tangent.y,
        sample.tangent.z,
      );

      const tangentLength = tangent.length();
      if (tangentLength > 1e-5) {
        tangent.multiplyScalar(1 / tangentLength);
        quaternion.setFromUnitVectors(FORWARD, tangent);

        const bank =
          clamp(sample.tangent.y * 0.018, -0.32, 0.32);
        bankQuaternion.setFromAxisAngle(FORWARD, bank);
        quaternion.multiply(bankQuaternion);
      }

      const values = typeScale(entry.route.type);
      scale.set(values[0], values[1], values[2]);
      matrix.compose(position, quaternion, scale);
      entry.group.matrix.copy(matrix);
      entry.group.matrixAutoUpdate = false;

      entry.speed =
        entry.previous.distanceTo(position) /
        Math.max(1e-4, safeDt);
      entry.audioSource.speed = entry.speed;

      if (
        entry.route.contrail &&
        this.updateCount % 2 === 0
      ) {
        this._updateTrail(
          entry.route.id,
          position,
        );
      }
    }

    const player = flight?.position;
    if (player?.isVector3) {
      for (const entry of this.entries) {
        entry.audioSource.distanceSquared =
          distanceSquared3(player, entry.group.position);
      }
    }
  }

  getAudioSources(maxSources = 6) {
    return [...this.entries]
      .sort(
        (a, b) =>
          (a.audioSource.distanceSquared ?? Infinity) -
          (b.audioSource.distanceSquared ?? Infinity)
      )
      .slice(0, Math.max(1, maxSources))
      .map(entry => entry.audioSource);
  }

  getStatus() {
    return {
      routeCount: this.entries.length,
      activeRouteIds: this.entries.map(entry => entry.route.id),
      sailplaneCount:
        this.entries.filter(
          entry => entry.route.type === 'sailplane'
        ).length,
      contrailRouteCount: this.trails.length,
      contrailPointBudget:
        this.trails.reduce(
          (sum, trail) => sum + trail.maxPoints,
          0,
        ),
      updateCount: this.updateCount,
      drawCalls:
        this.entries.length * 3 + this.trails.length,
    };
  }

  dispose() {
    this.scene?.remove(this.root);
    for (const trail of this.trails) {
      trail.geometry.dispose();
    }
    this.entries.length = 0;
    this.trails.length = 0;
  }
}
