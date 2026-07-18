import * as THREE from '../../vendor/three.module.min.js';
import {
  createSeededRandom,
  lerp,
  localCoordinates,
  nearestPointOnPolyline,
} from './math.js';
import {
  compileAirfieldCatalog,
  compileSettlementCatalog,
} from './layoutCompiler.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

const COLORS = Object.freeze({
  roadPrimary: [0.27, 0.27, 0.25],
  roadSecondary: [0.31, 0.30, 0.27],
  roadService: [0.36, 0.33, 0.28],
  roadShoulder: [0.42, 0.38, 0.31],
  roadMarking: [0.87, 0.82, 0.62],
  roadEdge: [0.74, 0.72, 0.64],
  waterDeep: [0.12, 0.34, 0.43],
  waterRiver: [0.18, 0.42, 0.52],
  waterShallow: [0.28, 0.52, 0.55],
  runway: [0.22, 0.23, 0.22],
  runwayShoulder: [0.34, 0.36, 0.32],
  runwayMarking: [0.89, 0.88, 0.78],
  taxiway: [0.28, 0.29, 0.27],
  apron: [0.32, 0.33, 0.31],
  lotPad: [0.44, 0.40, 0.34],
  settlementStreet: [0.34, 0.32, 0.28],
  rock: [0.44, 0.43, 0.39],
  granite: [0.48, 0.50, 0.48],
  canyon: [0.52, 0.36, 0.24],
});

class GeometryAccumulator {
  constructor(withColors = true) {
    this.positions = [];
    this.indices = [];
    this.colors = withColors ? [] : null;
  }

  vertex(x, y, z, color = null) {
    const index = this.positions.length / 3;
    this.positions.push(x, y, z);
    if (this.colors) {
      const resolved = color || [1, 1, 1];
      this.colors.push(resolved[0], resolved[1], resolved[2]);
    }
    return index;
  }

  quad(a, b, c, d, color = null) {
    const start = this.positions.length / 3;
    for (const point of [a, b, c, d]) this.vertex(point[0], point[1], point[2], color);
    this.indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
  }

  triangle(a, b, c, color = null) {
    const start = this.positions.length / 3;
    for (const point of [a, b, c]) this.vertex(point[0], point[1], point[2], color);
    this.indices.push(start, start + 1, start + 2);
  }

  transformPoint(center, heading, x, y, z) {
    const cosine = Math.cos(heading);
    const sine = Math.sin(heading);
    return [
      center[0] + x * cosine + z * sine,
      center[1] + y,
      center[2] - x * sine + z * cosine,
    ];
  }

  box(center, size, heading = 0, color = null) {
    const hx = size[0] * 0.5;
    const hy = size[1] * 0.5;
    const hz = size[2] * 0.5;
    const p = (x, y, z) => this.transformPoint(center, heading, x, y, z);
    const nbl = p(-hx, -hy, -hz);
    const nbr = p(hx, -hy, -hz);
    const nfl = p(-hx, -hy, hz);
    const nfr = p(hx, -hy, hz);
    const tbl = p(-hx, hy, -hz);
    const tbr = p(hx, hy, -hz);
    const tfl = p(-hx, hy, hz);
    const tfr = p(hx, hy, hz);
    this.quad(nbl, nbr, tbl, tbr, color);
    this.quad(nfr, nfl, tfr, tfl, color);
    this.quad(nfl, nbl, tfl, tbl, color);
    this.quad(nbr, nfr, tbr, tfr, color);
    this.quad(tbl, tbr, tfl, tfr, color);
    this.quad(nfl, nfr, nbl, nbr, color);
  }

  gableBuilding(center, size, heading, wallColor, roofColor, roofHeight = 2.4) {
    const wallHeight = Math.max(2, size[1] - roofHeight);
    const wallCenter = [center[0], center[1] - roofHeight * 0.5, center[2]];
    this.box(wallCenter, [size[0], wallHeight, size[2]], heading, wallColor);
    const hx = size[0] * 0.5;
    const hz = size[2] * 0.5;
    const baseY = wallCenter[1] + wallHeight * 0.5;
    const p = (x, y, z) => this.transformPoint([center[0], baseY, center[2]], heading, x, y, z);
    const leftBack = p(-hx, 0, -hz);
    const rightBack = p(hx, 0, -hz);
    const leftFront = p(-hx, 0, hz);
    const rightFront = p(hx, 0, hz);
    const ridgeBack = p(0, roofHeight, -hz);
    const ridgeFront = p(0, roofHeight, hz);
    this.quad(leftBack, ridgeBack, leftFront, ridgeFront, roofColor);
    this.quad(ridgeBack, rightBack, ridgeFront, rightFront, roofColor);
    this.triangle(leftBack, rightBack, ridgeBack, roofColor);
    this.triangle(rightFront, leftFront, ridgeFront, roofColor);
  }

  cylinder(center, radius, height, segments, color, topScale = 0.82) {
    const bottomY = center[1] - height * 0.5;
    const topY = center[1] + height * 0.5;
    const bottom = [];
    const top = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      bottom.push([center[0] + Math.cos(angle) * radius, bottomY, center[2] + Math.sin(angle) * radius]);
      top.push([center[0] + Math.cos(angle) * radius * topScale, topY, center[2] + Math.sin(angle) * radius * topScale]);
    }
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      this.quad(bottom[index], bottom[next], top[index], top[next], color);
      this.triangle([center[0], topY, center[2]], top[index], top[next], color);
    }
  }

  beamBetween(a, b, width, height, color) {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) return;
    const center = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    const heading = -Math.atan2(dx, dz);
    this.box(center, [width, height, length], heading, color);
  }

  toGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    if (this.colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  get triangles() {
    return this.indices.length / 3;
  }
}


function geometryByteSize(geometry) {
  let bytes = geometry.index?.array?.byteLength || 0;
  for (const attribute of Object.values(geometry.attributes || {})) bytes += attribute.array?.byteLength || 0;
  return bytes;
}

function featureMaterial(extra = {}) {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    fog: true,
    flatShading: true,
    side: THREE.DoubleSide,
    ...extra,
  });
}

function registerBox(collision, minX, maxX, minY, maxY, minZ, maxZ, label) {
  if (collision && typeof collision.addBox === 'function') {
    collision.addBox(minX, maxX, minY, maxY, minZ, maxZ, label);
    return 1;
  }
  return 0;
}

function roadColor(roadClass) {
  if (roadClass === 'primary') return COLORS.roadPrimary;
  if (roadClass === 'service') return COLORS.roadService;
  return COLORS.roadSecondary;
}

function segmentFrame(a, b, halfWidth) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return null;
  return {
    length,
    forwardX: dx / length,
    forwardZ: dz / length,
    rightX: -dz / length,
    rightZ: dx / length,
    halfWidth,
  };
}

function ribbonQuad(accumulator, a, b, yA, yB, halfWidth, color) {
  const frame = segmentFrame(a, b, halfWidth);
  if (!frame) return;
  const rx = frame.rightX * halfWidth;
  const rz = frame.rightZ * halfWidth;
  accumulator.quad(
    [a[0] + rx, yA, a[1] + rz],
    [a[0] - rx, yA, a[1] - rz],
    [b[0] + rx, yB, b[1] + rz],
    [b[0] - rx, yB, b[1] - rz],
    color,
  );
}

function addRoadSection(accumulator, profile, segment, t0, t1, heightModel) {
  const a = [lerp(segment.a[0], segment.b[0], t0), lerp(segment.a[1], segment.b[1], t0)];
  const b = [lerp(segment.a[0], segment.b[0], t1), lerp(segment.a[1], segment.b[1], t1)];
  const sampledA = heightModel.sampleHeight(a[0], a[1]);
  const sampledB = heightModel.sampleHeight(b[0], b[1]);
  const yA = Number.isFinite(sampledA) ? sampledA : lerp(segment.heightA, segment.heightB, t0);
  const yB = Number.isFinite(sampledB) ? sampledB : lerp(segment.heightA, segment.heightB, t1);
  const roadHalf = profile.widthMeters * 0.5;
  const shoulderHalf = roadHalf + profile.shoulderMeters;
  ribbonQuad(accumulator, a, b, yA + 0.02, yB + 0.02, shoulderHalf, COLORS.roadShoulder);
  ribbonQuad(accumulator, a, b, yA + 0.07, yB + 0.07, roadHalf, roadColor(profile.class));

  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const frame = segmentFrame(a, b, roadHalf);
  if (!frame) return;
  if (profile.class !== 'service') {
    const edgeOffset = roadHalf - 0.55;
    for (const side of [-1, 1]) {
      const offsetX = frame.rightX * edgeOffset * side;
      const offsetZ = frame.rightZ * edgeOffset * side;
      ribbonQuad(
        accumulator,
        [a[0] + offsetX, a[1] + offsetZ],
        [b[0] + offsetX, b[1] + offsetZ],
        yA + 0.085,
        yB + 0.085,
        0.12,
        COLORS.roadEdge,
      );
    }
  }
  if (profile.class === 'primary' && length > 18) {
    const dashLength = 10;
    const gap = 12;
    const count = Math.floor(length / (dashLength + gap));
    for (let dash = 0; dash < count; dash += 1) {
      const start = (dash * (dashLength + gap) + gap * 0.5) / length;
      const end = Math.min(1, start + dashLength / length);
      const d0 = [lerp(a[0], b[0], start), lerp(a[1], b[1], start)];
      const d1 = [lerp(a[0], b[0], end), lerp(a[1], b[1], end)];
      ribbonQuad(accumulator, d0, d1, lerp(yA, yB, start) + 0.095, lerp(yA, yB, end) + 0.095, 0.18, COLORS.roadMarking);
    }
  }
}

function buildRoads(group, heightModel) {
  const accumulator = new GeometryAccumulator(true);
  let sections = 0;
  let guardrails = 0;
  for (const profile of heightModel.roadProfiles.values()) {
    for (const segment of profile.segments) {
      if (segment.bridge) continue;
      const steps = Math.max(1, Math.ceil(segment.length / (profile.class === 'primary' ? 70 : profile.class === 'secondary' ? 84 : 96)));
      for (let index = 0; index < steps; index += 1) {
        const t0 = index / steps;
        const t1 = (index + 1) / steps;
        addRoadSection(accumulator, profile, segment, t0, t1, heightModel);
        sections += 1;
      }
      const midpoint = [(segment.a[0] + segment.b[0]) * 0.5, (segment.a[1] + segment.b[1]) * 0.5];
      const slope = heightModel.sampleSlope(midpoint[0], midpoint[1], 18);
      const nearWater = heightModel.waterSurfaceAt(midpoint[0], midpoint[1]) != null;
      if (profile.class === 'primary' && (slope > 0.16 || nearWater) && segment.length > 80) {
        const frame = segmentFrame(segment.a, segment.b, profile.widthMeters * 0.5 + 0.9);
        const count = Math.max(1, Math.floor(segment.length / 90));
        for (const side of [-1, 1]) {
          for (let rail = 0; rail < count; rail += 1) {
            const t0 = rail / count;
            const t1 = (rail + 0.82) / count;
            const offsetX = frame.rightX * frame.halfWidth * side;
            const offsetZ = frame.rightZ * frame.halfWidth * side;
            const ax = lerp(segment.a[0], segment.b[0], t0) + offsetX;
            const az = lerp(segment.a[1], segment.b[1], t0) + offsetZ;
            const endT = Math.min(1, t1);
            const bx = lerp(segment.a[0], segment.b[0], endT) + offsetX;
            const bz = lerp(segment.a[1], segment.b[1], endT) + offsetZ;
            const a = [ax, heightModel.sampleHeight(ax, az) + 0.78, az];
            const b = [bx, heightModel.sampleHeight(bx, bz) + 0.78, bz];
            accumulator.beamBetween(a, b, 0.18, 0.32, [0.46, 0.48, 0.46]);
            guardrails += 1;
          }
        }
      }
    }
  }

  for (const junction of heightModel.index.roadJunctions.values()) {
    const y = heightModel.sampleHeight(junction.position[0], junction.position[1]) + 0.12;
    const radius = junction.roads.length > 2 ? 18 : 14;
    const center = [junction.position[0], y, junction.position[1]];
    const points = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      points.push([center[0] + Math.cos(angle) * radius, y, center[2] + Math.sin(angle) * radius]);
    }
    for (let index = 0; index < points.length; index += 1) accumulator.triangle(center, points[index], points[(index + 1) % points.length], COLORS.roadSecondary);
  }

  const geometry = accumulator.toGeometry();
  const mesh = new THREE.Mesh(geometry, featureMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.name = 'Terrain-graded connected road hierarchy with shoulders and markings';
  group.add(mesh);
  return { mesh, geometry, triangles: accumulator.triangles, sections, guardrails };
}

function bridgeColor(type) {
  if (type === 'stone-arch') return [0.47, 0.42, 0.35];
  if (type === 'steel-truss') return [0.29, 0.35, 0.37];
  if (type === 'concrete-girder') return [0.50, 0.50, 0.46];
  return [0.36, 0.27, 0.19];
}

function buildBridgeTruss(accumulator, a, b, yA, yB, halfWidth, color, panelCount = 5) {
  const frame = segmentFrame(a, b, halfWidth);
  if (!frame) return;
  for (const side of [-1, 1]) {
    const offsetX = frame.rightX * (halfWidth - 0.45) * side;
    const offsetZ = frame.rightZ * (halfWidth - 0.45) * side;
    const pointsBottom = [];
    const pointsTop = [];
    for (let panel = 0; panel <= panelCount; panel += 1) {
      const t = panel / panelCount;
      const x = lerp(a[0], b[0], t) + offsetX;
      const z = lerp(a[1], b[1], t) + offsetZ;
      const y = lerp(yA, yB, t);
      pointsBottom.push([x, y + 0.45, z]);
      pointsTop.push([x, y + 4.4, z]);
      accumulator.beamBetween(pointsBottom[panel], pointsTop[panel], 0.32, 0.32, color);
      if (panel > 0) {
        accumulator.beamBetween(pointsTop[panel - 1], pointsTop[panel], 0.34, 0.34, color);
        accumulator.beamBetween(pointsBottom[panel - 1], pointsTop[panel], 0.30, 0.30, color);
        accumulator.beamBetween(pointsTop[panel - 1], pointsBottom[panel], 0.26, 0.26, color);
      }
    }
  }
}

function buildBridges(group, collision, heightModel) {
  const accumulator = new GeometryAccumulator(true);
  let collisionBoxes = 0;
  let supports = 0;
  for (const bridge of heightModel.manifest.bridges) {
    const profile = heightModel.bridgeProfiles.get(bridge.id);
    const { a, b, targetA: yA, targetB: yB, water } = profile;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const frame = segmentFrame(a, b, bridge.deckWidthMeters * 0.5);
    const color = bridgeColor(bridge.type);
    const center = [(a[0] + b[0]) * 0.5, (yA + yB) * 0.5 - 0.55, (a[1] + b[1]) * 0.5];
    const heading = -Math.atan2(dx, dz);

    ribbonQuad(accumulator, a, b, yA + 0.14, yB + 0.14, bridge.deckWidthMeters * 0.5, COLORS.roadPrimary);
    accumulator.box(center, [bridge.deckWidthMeters, 1.1, length], heading, color);
    for (const side of [-1, 1]) {
      const offsetX = frame.rightX * (bridge.deckWidthMeters * 0.5 - 0.45) * side;
      const offsetZ = frame.rightZ * (bridge.deckWidthMeters * 0.5 - 0.45) * side;
      accumulator.beamBetween(
        [a[0] + offsetX, yA + 1.0, a[1] + offsetZ],
        [b[0] + offsetX, yB + 1.0, b[1] + offsetZ],
        0.26,
        0.52,
        color,
      );
    }

    if (bridge.type === 'steel-truss') {
      buildBridgeTruss(accumulator, a, b, yA, yB, bridge.deckWidthMeters * 0.5, color, Math.max(4, Math.round(length / 42)));
    } else if (bridge.type === 'concrete-girder') {
      for (const side of [-0.34, 0, 0.34]) {
        const offsetX = frame.rightX * bridge.deckWidthMeters * side;
        const offsetZ = frame.rightZ * bridge.deckWidthMeters * side;
        accumulator.beamBetween(
          [a[0] + offsetX, yA - 1.2, a[1] + offsetZ],
          [b[0] + offsetX, yB - 1.2, b[1] + offsetZ],
          0.85,
          1.35,
          color,
        );
      }
    } else if (bridge.type === 'timber-steel') {
      const tieCount = Math.max(5, Math.floor(length / 12));
      for (let tie = 0; tie <= tieCount; tie += 1) {
        const t = tie / tieCount;
        const x = lerp(a[0], b[0], t);
        const z = lerp(a[1], b[1], t);
        const y = lerp(yA, yB, t) - 0.15;
        accumulator.box([x, y, z], [bridge.deckWidthMeters + 0.8, 0.28, 0.9], heading, [0.31, 0.22, 0.15]);
      }
    }

    const supportCount = bridge.type === 'stone-arch' ? 3 : bridge.type === 'steel-truss' ? 2 : 2;
    for (let support = 1; support <= supportCount; support += 1) {
      const t = support / (supportCount + 1);
      const x = lerp(a[0], b[0], t);
      const z = lerp(a[1], b[1], t);
      const deckY = lerp(yA, yB, t) - 1.1;
      const ground = Math.min(heightModel.sampleHeight(x, z), water - 1.5);
      const supportHeight = Math.max(2.5, deckY - ground);
      const supportWidth = bridge.type === 'stone-arch' ? 5.2 : 3.4;
      accumulator.box([x, ground + supportHeight * 0.5, z], [supportWidth, supportHeight, bridge.deckWidthMeters * 0.66], heading, color);
      collisionBoxes += registerBox(collision, x - supportWidth, x + supportWidth, ground, deckY, z - bridge.deckWidthMeters * 0.5, z + bridge.deckWidthMeters * 0.5, `${bridge.id} support ${support}`);
      supports += 1;
    }

    if (bridge.type === 'stone-arch') {
      for (let arch = 0; arch < supportCount + 1; arch += 1) {
        const t0 = arch / (supportCount + 1);
        const t1 = (arch + 1) / (supportCount + 1);
        const x0 = lerp(a[0], b[0], t0);
        const z0 = lerp(a[1], b[1], t0);
        const x1 = lerp(a[0], b[0], t1);
        const z1 = lerp(a[1], b[1], t1);
        const span = Math.hypot(x1 - x0, z1 - z0);
        const archCenterY = lerp(yA, yB, (t0 + t1) * 0.5) - 3.0;
        accumulator.beamBetween([x0, archCenterY, z0], [x1, archCenterY, z1], 1.0, 2.0, color);
        if (span > 20) accumulator.box([(x0 + x1) * 0.5, archCenterY - 1.5, (z0 + z1) * 0.5], [bridge.deckWidthMeters * 0.78, 1.0, span * 0.45], heading, color);
      }
    }

    const halfX = Math.abs(dx / length) * length * 0.5 + Math.abs(dz / length) * bridge.deckWidthMeters * 0.5;
    const halfZ = Math.abs(dz / length) * length * 0.5 + Math.abs(dx / length) * bridge.deckWidthMeters * 0.5;
    collisionBoxes += registerBox(collision, center[0] - halfX, center[0] + halfX, Math.min(yA, yB) - 1.2, Math.max(yA, yB) + 0.45, center[2] - halfZ, center[2] + halfZ, `${bridge.id} deck`);
  }

  const geometry = accumulator.toGeometry();
  const mesh = new THREE.Mesh(geometry, featureMaterial());
  mesh.name = 'Road-owned production bridge structures';
  group.add(mesh);
  return { mesh, geometry, triangles: accumulator.triangles, collisionBoxes, supports };
}

function buildWater(group, heightModel) {
  const accumulator = new GeometryAccumulator(true);
  let segments = 0;
  let culvertGaps = 0;
  for (const river of heightModel.index.rivers.values()) {
    for (let index = 0; index < river.points.length - 1; index += 1) {
      const segment = river.compiled.segments[index];
      const subdivisions = Math.max(1, Math.ceil(segment.length / 330));
      for (let section = 0; section < subdivisions; section += 1) {
        const t0 = section / subdivisions;
        const t1 = (section + 1) / subdivisions;
        const a = [lerp(segment.a[0], segment.b[0], t0), lerp(segment.a[1], segment.b[1], t0)];
        const b = [lerp(segment.a[0], segment.b[0], t1), lerp(segment.a[1], segment.b[1], t1)];
        const midpointX = (a[0] + b[0]) * 0.5;
        const midpointZ = (a[1] + b[1]) * 0.5;
        const road = heightModel.roadSurfaceAt(midpointX, midpointZ);
        const nonBridgeRoadCrossing = road && !road.bridge &&
          road.distance <= road.profile.widthMeters * 0.5 + road.profile.shoulderMeters + 4;
        if (nonBridgeRoadCrossing) {
          culvertGaps += 1;
          continue;
        }
        const alongA = (segment.start + segment.length * t0) / Math.max(1, river.compiled.totalLength);
        const alongB = (segment.start + segment.length * t1) / Math.max(1, river.compiled.totalLength);
        const yA = lerp(river.sourceSurfaceMeters, river.mouthSurfaceMeters, alongA) + 0.05;
        const yB = lerp(river.sourceSurfaceMeters, river.mouthSurfaceMeters, alongB) + 0.05;
        ribbonQuad(accumulator, a, b, yA, yB, river.bedWidthMeters * 0.5, COLORS.waterRiver);
        ribbonQuad(accumulator, a, b, yA - 0.02, yB - 0.02, river.bankWidthMeters * 0.34, COLORS.waterShallow);
        segments += 2;
      }
    }
  }

  for (const lake of heightModel.manifest.water.lakes) {
    const center = [lake.center[0], lake.surfaceMeters + 0.05, lake.center[1]];
    const ring = [];
    const ringSegments = 40;
    for (let index = 0; index < ringSegments; index += 1) {
      const angle = index / ringSegments * Math.PI * 2;
      ring.push([lake.center[0] + Math.cos(angle) * lake.radius[0], center[1], lake.center[1] + Math.sin(angle) * lake.radius[1]]);
    }
    for (let index = 0; index < ringSegments; index += 1) accumulator.triangle(center, ring[index], ring[(index + 1) % ringSegments], COLORS.waterDeep);
    segments += ringSegments;
  }

  const shore = heightModel.manifest.water.shoreline.points;
  const seaY = heightModel.manifest.water.seaLevelMeters + 0.04;
  const south = heightModel.manifest.bounds.minZ;
  for (let index = 0; index < shore.length - 1; index += 1) {
    accumulator.quad([shore[index][0], seaY, shore[index][1]], [shore[index][0], seaY, south], [shore[index + 1][0], seaY, shore[index + 1][1]], [shore[index + 1][0], seaY, south], COLORS.waterDeep);
    const shallowZ0 = shore[index][1] - 220;
    const shallowZ1 = shore[index + 1][1] - 220;
    accumulator.quad([shore[index][0], seaY + 0.02, shore[index][1]], [shore[index][0], seaY + 0.02, shallowZ0], [shore[index + 1][0], seaY + 0.02, shore[index + 1][1]], [shore[index + 1][0], seaY + 0.02, shallowZ1], COLORS.waterShallow);
    segments += 2;
  }

  const geometry = accumulator.toGeometry();
  const mesh = new THREE.Mesh(geometry, featureMaterial({ transparent: true, opacity: 0.74, depthWrite: false, flatShading: false }));
  mesh.name = 'Terrain-matched hydrology coastline and culvert gaps';
  mesh.renderOrder = 2;
  group.add(mesh);
  return { mesh, geometry, triangles: accumulator.triangles, segments, culvertGaps };
}

function localPoint(airfield, forward, right, yOffset = 0) {
  const radians = airfield.headingDegrees * DEG;
  return [
    airfield.center[0] + Math.sin(radians) * forward + Math.cos(radians) * right,
    airfield.elevationMeters + yOffset,
    airfield.center[1] + Math.cos(radians) * forward - Math.sin(radians) * right,
  ];
}

function localRect(accumulator, airfield, forwardCenter, rightCenter, length, width, yOffset, color) {
  const hf = length * 0.5;
  const hr = width * 0.5;
  accumulator.quad(
    localPoint(airfield, forwardCenter - hf, rightCenter + hr, yOffset),
    localPoint(airfield, forwardCenter - hf, rightCenter - hr, yOffset),
    localPoint(airfield, forwardCenter + hf, rightCenter + hr, yOffset),
    localPoint(airfield, forwardCenter + hf, rightCenter - hr, yOffset),
    color,
  );
}

function buildAirfields(group, heightModel) {
  const accumulator = new GeometryAccumulator(true);
  const catalog = compileAirfieldCatalog(heightModel);
  let markings = 0;
  let pads = 0;
  for (const airfield of catalog) {
    const halfLength = airfield.runwayLengthMeters * 0.5;
    const shoulderWidth = airfield.runwayWidthMeters + airfield.site.shoulderMeters * 2;
    localRect(accumulator, airfield, 0, 0, airfield.runwayLengthMeters + airfield.site.overrunMeters * 2, airfield.clearWidthMeters, 0.02, [0.36, 0.43, 0.30]);
    localRect(accumulator, airfield, 0, 0, airfield.runwayLengthMeters + airfield.site.overrunMeters * 2, shoulderWidth, 0.07, COLORS.runwayShoulder);
    localRect(accumulator, airfield, 0, 0, airfield.runwayLengthMeters, airfield.runwayWidthMeters, 0.13, COLORS.runway);

    for (const direction of [-1, 1]) {
      const forward = direction * (halfLength - 28);
      for (let bar = -2; bar <= 2; bar += 1) {
        localRect(accumulator, airfield, forward, bar * 4.2, 14, 2.0, 0.17, COLORS.runwayMarking);
        markings += 1;
      }
    }
    const dashCount = Math.max(12, Math.floor(airfield.runwayLengthMeters / 78));
    for (let index = 0; index < dashCount; index += 1) {
      const forward = lerp(-halfLength + 45, halfLength - 45, (index + 0.5) / dashCount);
      localRect(accumulator, airfield, forward, 0, 18, 1.2, 0.18, COLORS.runwayMarking);
      markings += 1;
    }
    for (const side of [-1, 1]) localRect(accumulator, airfield, 0, side * (airfield.runwayWidthMeters * 0.5 - 0.55), airfield.runwayLengthMeters, 0.32, 0.18, COLORS.runwayMarking);

    const taxiSide = airfield.site.taxiwaySide === 'west' ? -1 : 1;
    const taxiRight = taxiSide * airfield.site.taxiwayOffsetMeters;
    localRect(accumulator, airfield, airfield.site.apron.forwardOffsetMeters * 0.5, taxiRight * 0.5, Math.abs(airfield.site.apron.forwardOffsetMeters) + 180, airfield.site.taxiwayWidthMeters, 0.10, COLORS.taxiway);
    localRect(accumulator, airfield, airfield.site.apron.forwardOffsetMeters, airfield.site.apron.rightOffsetMeters, airfield.site.apron.sizeMeters[0], airfield.site.apron.sizeMeters[1], 0.11, COLORS.apron);
    pads += 1;
    for (const pad of airfield.site.hangarPads) {
      localRect(accumulator, airfield, pad.forwardOffsetMeters, pad.rightOffsetMeters, pad.sizeMeters[0], pad.sizeMeters[1], 0.12, COLORS.lotPad);
      pads += 1;
    }
    for (const side of [-1, 1]) {
      localRect(accumulator, airfield, 0, side * (shoulderWidth * 0.5 + 5), airfield.runwayLengthMeters + 120, 2.2, 0.035, [0.25, 0.38, 0.29]);
    }
  }
  const geometry = accumulator.toGeometry();
  const mesh = new THREE.Mesh(geometry, featureMaterial({ polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.name = 'Landing-catalog airfield sites with taxiways aprons and reserved pads';
  group.add(mesh);
  return { mesh, geometry, triangles: accumulator.triangles, catalog, markings, pads };
}

function variation(color, random, amount = 0.08) {
  const delta = (random() - 0.5) * amount;
  return color.map(value => Math.max(0.05, Math.min(0.95, value + delta)));
}

function buildingPalette(kind) {
  if (kind.includes('industrial') || kind.includes('port')) return { wall: [0.43, 0.44, 0.41], roof: [0.28, 0.30, 0.30] };
  if (kind.includes('mountain')) return { wall: [0.46, 0.39, 0.31], roof: [0.25, 0.23, 0.21] };
  if (kind.includes('coastal')) return { wall: [0.58, 0.50, 0.41], roof: [0.32, 0.29, 0.27] };
  if (kind.includes('farm')) return { wall: [0.53, 0.46, 0.35], roof: [0.31, 0.25, 0.19] };
  return { wall: [0.52, 0.43, 0.33], roof: [0.30, 0.26, 0.23] };
}

function addSettlementStreet(accumulator, settlement, forwardAxis, offset, width, heightModel) {
  const heading = (settlement.streetHeadingDegrees || 0) * DEG + (forwardAxis ? 0 : Math.PI * 0.5);
  const length = forwardAxis ? settlement.radius[1] * 1.7 : settlement.radius[0] * 1.7;
  const offsetHeading = (settlement.streetHeadingDegrees || 0) * DEG + (forwardAxis ? Math.PI * 0.5 : 0);
  const centerX = settlement.center[0] + Math.sin(offsetHeading) * offset;
  const centerZ = settlement.center[1] + Math.cos(offsetHeading) * offset;
  const dx = Math.sin(heading) * length * 0.5;
  const dz = Math.cos(heading) * length * 0.5;
  const a = [centerX - dx, centerZ - dz];
  const b = [centerX + dx, centerZ + dz];
  ribbonQuad(accumulator, a, b, heightModel.sampleHeight(a[0], a[1]) + 0.10, heightModel.sampleHeight(b[0], b[1]) + 0.10, width * 0.5, COLORS.settlementStreet);
}

function buildSettlements(group, collision, heightModel) {
  const accumulator = new GeometryAccumulator(true);
  const catalog = compileSettlementCatalog(heightModel);
  let collisionBoxes = 0;
  let buildings = 0;
  let streets = 0;

  for (const settlementEntry of catalog.settlements) {
    const settlement = heightModel.index.settlements.get(settlementEntry.id);
    addSettlementStreet(accumulator, settlement, true, 0, settlement.kind.includes('industrial') ? 12 : 8, heightModel);
    addSettlementStreet(accumulator, settlement, false, 0, settlement.kind.includes('industrial') ? 12 : 8, heightModel);
    streets += 2;
    if (settlementEntry.lots.length > 42) {
      addSettlementStreet(accumulator, settlement, true, settlement.radius[0] * 0.32, 7, heightModel);
      addSettlementStreet(accumulator, settlement, true, -settlement.radius[0] * 0.32, 7, heightModel);
      streets += 2;
    }

    const random = createSeededRandom(heightModel.manifest.seed ^ settlement.id.length * 15331);
    const palette = buildingPalette(settlement.kind);
    for (const lot of settlementEntry.lots) {
      const width = lot.footprintMeters[0];
      const depth = lot.footprintMeters[1];
      const height = lot.heightMeters;
      const heading = lot.headingDegrees * DEG;
      const y = lot.position[1];
      const wall = variation(palette.wall, random, 0.11);
      const roof = variation(palette.roof, random, 0.08);
      const padCenter = [lot.position[0], y + 0.04, lot.position[2]];
      accumulator.box(padCenter, [width + 3.5, 0.08, depth + 3.5], heading, COLORS.lotPad);

      const buildingCenter = [lot.position[0], y + height * 0.5 + 0.08, lot.position[2]];
      if (lot.archetype === 'tank-house') {
        accumulator.cylinder(buildingCenter, width * 0.45, height, 10, wall, 1);
        accumulator.cylinder([buildingCenter[0], buildingCenter[1] + height * 0.55, buildingCenter[2]], width * 0.47, 1.0, 10, roof, 0.82);
      } else if (['gable-house', 'chalet', 'stone-house', 'farmhouse', 'barn', 'boathouse', 'warehouse'].includes(lot.archetype)) {
        accumulator.gableBuilding(buildingCenter, [width, height, depth], heading, wall, roof, Math.min(4.5, Math.max(1.8, height * 0.22)));
      } else {
        accumulator.box(buildingCenter, [width, height, depth], heading, wall);
        accumulator.box([buildingCenter[0], buildingCenter[1] + height * 0.5 + 0.35, buildingCenter[2]], [width * 0.92, 0.7, depth * 0.92], heading, roof);
      }
      const radiusX = Math.abs(Math.cos(heading)) * width * 0.5 + Math.abs(Math.sin(heading)) * depth * 0.5;
      const radiusZ = Math.abs(Math.sin(heading)) * width * 0.5 + Math.abs(Math.cos(heading)) * depth * 0.5;
      collisionBoxes += registerBox(collision, lot.position[0] - radiusX, lot.position[0] + radiusX, y, y + height, lot.position[2] - radiusZ, lot.position[2] + radiusZ, `${settlement.id} ${lot.id}`);
      buildings += 1;
    }
  }

  const geometry = accumulator.toGeometry();
  const mesh = new THREE.Mesh(geometry, featureMaterial());
  mesh.name = 'Deterministic settlement proxy catalog and terrain-bound lots';
  group.add(mesh);
  return { mesh, geometry, triangles: accumulator.triangles, collisionBoxes, buildings, streets, catalog };
}

function buildLandmarks(group, collision, heightModel) {
  const accumulator = new GeometryAccumulator(true);
  let collisionBoxes = 0;
  for (const landmark of heightModel.manifest.landmarks) {
    const x = landmark.position[0];
    const z = landmark.position[1];
    const ground = heightModel.sampleHeight(x, z);
    const color = landmark.type.includes('granite') || landmark.id.includes('granite') ? COLORS.granite : landmark.type.includes('rock') || landmark.type.includes('mesa') ? COLORS.canyon : COLORS.rock;
    if (landmark.type === 'rock-gate') {
      const pillarHeight = landmark.heightMeters * 0.78;
      const spacing = landmark.radiusMeters * 0.34;
      accumulator.cylinder([x - spacing, ground + pillarHeight * 0.5, z], landmark.radiusMeters * 0.12, pillarHeight, 7, color, 0.74);
      accumulator.cylinder([x + spacing, ground + pillarHeight * 0.5, z], landmark.radiusMeters * 0.12, pillarHeight, 7, color, 0.74);
      accumulator.box([x, ground + pillarHeight * 0.82, z], [spacing * 2.2, landmark.heightMeters * 0.16, landmark.radiusMeters * 0.18], 0, color);
      collisionBoxes += registerBox(collision, x - spacing - 22, x + spacing + 22, ground, ground + landmark.heightMeters, z - 24, z + 24, landmark.id);
    } else if (landmark.type === 'sea-stacks' || landmark.type === 'rock-needles') {
      const count = landmark.type === 'sea-stacks' ? 4 : 3;
      const random = createSeededRandom(heightModel.manifest.seed ^ landmark.id.length * 911);
      for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2 + random() * 0.4;
        const radius = landmark.radiusMeters * (0.18 + random() * 0.10);
        const height = landmark.heightMeters * (0.62 + random() * 0.42);
        const px = x + Math.cos(angle) * landmark.radiusMeters * 0.32;
        const pz = z + Math.sin(angle) * landmark.radiusMeters * 0.32;
        const base = heightModel.sampleHeight(px, pz);
        accumulator.cylinder([px, base + height * 0.5, pz], radius, height, 7, color, 0.35);
        collisionBoxes += registerBox(collision, px - radius, px + radius, base, base + height, pz - radius, pz + radius, `${landmark.id} ${index}`);
      }
    } else if (landmark.type === 'mesa') {
      accumulator.cylinder([x, ground + landmark.heightMeters * 0.5, z], landmark.radiusMeters, landmark.heightMeters, 10, color, 0.72);
      collisionBoxes += registerBox(collision, x - landmark.radiusMeters * 0.75, x + landmark.radiusMeters * 0.75, ground, ground + landmark.heightMeters, z - landmark.radiusMeters * 0.75, z + landmark.radiusMeters * 0.75, landmark.id);
    } else if (landmark.type === 'delta-islets') {
      for (const offset of [[-120, 20], [40, -40], [145, 70], [-20, 130]]) {
        const px = x + offset[0];
        const pz = z + offset[1];
        const base = heightModel.sampleHeight(px, pz);
        accumulator.cylinder([px, base + landmark.heightMeters * 0.35, pz], 70, landmark.heightMeters * 0.7, 9, [0.38, 0.48, 0.36], 0.72);
      }
    } else {
      accumulator.cylinder([x, ground + landmark.heightMeters * 0.5, z], landmark.radiusMeters * 0.36, landmark.heightMeters, 8, color, 0.55);
    }
  }
  const geometry = accumulator.toGeometry();
  const mesh = new THREE.Mesh(geometry, featureMaterial());
  mesh.name = 'Natural navigation landmark set';
  group.add(mesh);
  return { mesh, geometry, triangles: accumulator.triangles, collisionBoxes };
}

export class ExpansionFeatureRuntime {
  constructor(root, collision, heightModel) {
    this.heightModel = heightModel;
    this.group = new THREE.Group();
    this.group.name = 'World core v2 authored physical infrastructure';
    root.add(this.group);

    this.roads = buildRoads(this.group, heightModel);
    this.bridges = buildBridges(this.group, collision, heightModel);
    this.water = buildWater(this.group, heightModel);
    this.airfields = buildAirfields(this.group, heightModel);
    this.settlements = buildSettlements(this.group, collision, heightModel);
    this.landmarks = buildLandmarks(this.group, collision, heightModel);

    this.owned = [this.roads, this.bridges, this.water, this.airfields, this.settlements, this.landmarks];
    this.stats = Object.freeze({
      drawCalls: this.owned.length,
      triangles: this.owned.reduce((sum, item) => sum + item.triangles, 0),
      roadSegments: this.roads.sections,
      roadGuardrails: this.roads.guardrails,
      bridgeSupports: this.bridges.supports,
      waterSegments: this.water.segments,
      culvertGaps: this.water.culvertGaps,
      airfieldMarkings: this.airfields.markings,
      airfieldPads: this.airfields.pads,
      settlementInstances: this.settlements.buildings,
      settlementStreets: this.settlements.streets,
      collisionBoxes: this.bridges.collisionBoxes + this.settlements.collisionBoxes + this.landmarks.collisionBoxes,
      transparentDrawCalls: 1,
      geometryBytes: this.owned.reduce((sum, item) => sum + geometryByteSize(item.geometry), 0),
    });
  }

  update() {
    return this.stats;
  }

  getStats() {
    return this.stats;
  }

  getSettlementCatalog() {
    return this.settlements.catalog;
  }

  getAirfieldCatalog() {
    return this.airfields.catalog;
  }

  dispose() {
    for (const item of this.owned) {
      item.mesh.removeFromParent();
      item.geometry.dispose();
      item.mesh.material.dispose();
    }
    this.group.removeFromParent();
  }
}
