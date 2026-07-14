import * as THREE from '../../../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function pointSegmentDistance(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / lengthSq)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[2] + dz * t));
}

function riverDistance(points, x, z) {
  let distance = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    distance = Math.min(distance, pointSegmentDistance(x, z, points[index], points[index + 1]));
  }
  return distance;
}

function makeIntervals(min, max, blockMin, blockMax, street, random) {
  const intervals = [];
  let cursor = min + street;
  while (cursor + blockMin < max - street) {
    const size = Math.min(blockMin + random() * (blockMax - blockMin), max - street - cursor);
    if (size < blockMin * 0.72) break;
    intervals.push({ center: cursor + size * 0.5, size });
    cursor += size + street;
  }
  return intervals;
}

function addDescriptor(list, x, baseY, z, width, height, depth, yaw, label, kind = 'building') {
  list.push({ x, y: baseY + height * 0.5, z, width, height, depth, yaw, label, kind });
}

function addTowerPair(descriptors, feature, index, corridors) {
  const heading = feature.headingDegrees * DEG;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const halfSeparation = 39;
  const baseY = feature.y;
  for (const side of [-1, 1]) {
    const x = feature.position[0] + cosine * halfSeparation * side;
    const z = feature.position[1] - sine * halfSeparation * side;
    const height = side < 0 ? 142 + index * 7 : 160 - index * 8;
    addDescriptor(descriptors, x, baseY, z, 23, height, 25, heading, `${feature.id} tower`, 'tower');
  }
  addDescriptor(
    descriptors,
    feature.position[0],
    baseY + 77,
    feature.position[1],
    halfSeparation * 2 - 23,
    8,
    14,
    heading,
    `${feature.id} high skybridge`,
    'skybridge',
  );
  corridors.push({
    id: feature.id,
    center: [feature.position[0], baseY + 38, feature.position[1]],
    headingDegrees: feature.headingDegrees,
    width: 48,
    height: 70,
  });
}

function addOpenAtrium(descriptors, feature, corridors) {
  const outer = 104;
  const inner = 46;
  const corner = (outer - inner) * 0.5;
  const offset = (inner + corner) * 0.5;
  const heading = feature.headingDegrees * DEG;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const baseY = feature.y;
  for (const localX of [-offset, offset]) {
    for (const localZ of [-offset, offset]) {
      const x = feature.position[0] + cosine * localX + sine * localZ;
      const z = feature.position[1] - sine * localX + cosine * localZ;
      addDescriptor(descriptors, x, baseY, z, corner, 72, corner, heading, `${feature.id} corner`, 'atrium');
    }
  }
  addDescriptor(descriptors, feature.position[0], baseY + 58, feature.position[1] - offset, inner, 14, corner, heading, `${feature.id} north lintel`, 'atrium');
  addDescriptor(descriptors, feature.position[0], baseY + 58, feature.position[1] + offset, inner, 14, corner, heading, `${feature.id} south lintel`, 'atrium');
  corridors.push({
    id: feature.id,
    center: [feature.position[0], baseY + 29, feature.position[1]],
    headingDegrees: feature.headingDegrees,
    width: inner,
    height: 56,
  });
}

function descriptorAabb(part) {
  const cosine = Math.cos(part.yaw);
  const sine = Math.sin(part.yaw);
  const halfX = part.width * 0.5;
  const halfZ = part.depth * 0.5;
  const worldHalfX = Math.abs(cosine) * halfX + Math.abs(sine) * halfZ;
  const worldHalfZ = Math.abs(sine) * halfX + Math.abs(cosine) * halfZ;
  return {
    minX: part.x - worldHalfX,
    maxX: part.x + worldHalfX,
    minY: part.y - part.height * 0.5,
    maxY: part.y + part.height * 0.5,
    minZ: part.z - worldHalfZ,
    maxZ: part.z + worldHalfZ,
    label: part.label,
  };
}

function registerBoxes(collisionSystem, boxes) {
  if (!collisionSystem || typeof collisionSystem.addBox !== 'function') return 0;
  for (const box of boxes) {
    collisionSystem.addBox(box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ, box.label);
  }
  return boxes.length;
}

function createWindowMaterial() {
  const material = new THREE.MeshLambertMaterial({
    color: 0xc1c3bd,
    vertexColors: true,
    flatShading: true,
  });
  material.name = 'Shared procedural window-grid material';
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCityPosition;\nvarying vec3 vUnitPosition;\nvarying vec3 vUnitNormal;`)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vUnitPosition = position;
        vUnitNormal = normal;
        #ifdef USE_INSTANCING
          vCityPosition = (instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vCityPosition = position;
        #endif
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vCityPosition;
        varying vec3 vUnitPosition;
        varying vec3 vUnitNormal;
        float skylineHash(vec2 value) {
          return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
        }
      `)
      .replace('vec3 totalEmissiveRadiance = emissive;', `
        vec3 totalEmissiveRadiance = emissive;
        float verticalWall = 1.0 - step(0.49, abs(vUnitPosition.y));
        vec2 facadeUv = abs(vUnitNormal.x) > abs(vUnitNormal.z)
          ? vec2(vCityPosition.z, vCityPosition.y)
          : vec2(vCityPosition.x, vCityPosition.y);
        vec2 windowCell = floor(facadeUv / vec2(4.4, 3.6));
        vec2 windowPosition = fract(facadeUv / vec2(4.4, 3.6));
        float frame = step(0.15, windowPosition.x) * step(windowPosition.x, 0.80)
          * step(0.18, windowPosition.y) * step(windowPosition.y, 0.76);
        float lit = step(0.58, skylineHash(windowCell));
        totalEmissiveRadiance += vec3(1.0, 0.71, 0.34) * frame * lit * verticalWall * 0.72;
      `);
  };
  material.customProgramCacheKey = () => 'skyline-city-windows-v4';
  return material;
}

export function createCityLayer(features, options = {}) {
  if (!features?.city?.plateau || !features?.city?.grid) throw new TypeError('World city feature data is required.');
  const city = features.city;
  const random = createRng(options.seed ?? hashSeed(city.id));
  const descriptors = [];
  const corridors = [];
  const grid = city.grid;
  const xIntervals = makeIntervals(city.plateau.min[0], city.plateau.max[0], grid.blockMinMeters, grid.blockMaxMeters, grid.streetMeters, random);
  const zIntervals = makeIntervals(city.plateau.min[1], city.plateau.max[1], grid.blockMinMeters, grid.blockMaxMeters, grid.streetMeters, random);
  const riverPoints = features.water?.river?.points ?? [];
  const reserved = (features.landmarks ?? []).filter(item => item.type === 'tower_pair' || item.type === 'open_atrium');
  for (const xBlock of xIntervals) {
    for (const zBlock of zIntervals) {
      const x = xBlock.center;
      const z = zBlock.center;
      if (riverPoints.length > 1 && riverDistance(riverPoints, x, z) < 78) continue;
      let blocked = false;
      for (const landmark of reserved) {
        if (Math.hypot(x - landmark.position[0], z - landmark.position[1]) < 98) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const inset = 8 + random() * 5;
      const width = Math.max(26, xBlock.size - inset);
      const depth = Math.max(26, zBlock.size - inset);
      const height = 24 + Math.pow(random(), 1.5) * 86;
      addDescriptor(descriptors, x, city.plateau.elevationMeters, z, width, height, depth, 0, 'City block', 'block');
    }
  }
  let towerIndex = 0;
  for (const landmark of features.landmarks ?? []) {
    if (landmark.type === 'tower_pair') addTowerPair(descriptors, landmark, towerIndex++, corridors);
    if (landmark.type === 'open_atrium') addOpenAtrium(descriptors, landmark, corridors);
  }

  const group = new THREE.Group();
  group.name = city.id;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = createWindowMaterial();
  const buildings = new THREE.InstancedMesh(geometry, material, descriptors.length);
  buildings.name = 'Instanced Skyline city blocks and landmarks';
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  for (let index = 0; index < descriptors.length; index += 1) {
    const part = descriptors[index];
    position.set(part.x, part.y, part.z);
    quaternion.setFromAxisAngle(UP, part.yaw);
    scale.set(part.width, part.height, part.depth);
    matrix.compose(position, quaternion, scale);
    buildings.setMatrixAt(index, matrix);
    const shade = part.kind === 'tower' ? 0.7 : part.kind === 'atrium' ? 0.82 : 0.65 + random() * 0.25;
    color.setRGB(shade * 0.87, shade * 0.93, shade);
    buildings.setColorAt(index, color);
  }
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  if (typeof buildings.computeBoundingSphere === 'function') buildings.computeBoundingSphere();
  group.add(buildings);
  const collisionBoxes = descriptors.map(descriptorAabb);
  if (options.scene) options.scene.add(group);
  if (options.collision) registerBoxes(options.collision, collisionBoxes);
  return {
    group,
    buildings,
    descriptors,
    collisionBoxes,
    threadCorridors: corridors,
    blockCount: descriptors.filter(item => item.kind === 'block').length,
    registerCollisions(collisionSystem) {
      return registerBoxes(collisionSystem, collisionBoxes);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
