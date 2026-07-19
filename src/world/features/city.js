import * as THREE from '../../../vendor/three.module.min.js';
import { createCityLayout } from './cityLayout.js';

const UP = new THREE.Vector3(0, 1, 0);

function descriptorAabb(part) {
  const cosine = Math.cos(part.yaw || 0);
  const sine = Math.sin(part.yaw || 0);
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
  for (const box of boxes) collisionSystem.addBox(box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ, box.label);
  return boxes.length;
}

function createWindowMaterial() {
  const material = new THREE.MeshLambertMaterial({ color: 0xc1c3bd, vertexColors: true, flatShading: true });
  material.name = 'Shared procedural district facade material';
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityPosition;\nvarying vec3 vUnitPosition;\nvarying vec3 vUnitNormal;')
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
        vec2 windowCell = floor(facadeUv / vec2(4.8, 3.8));
        vec2 windowPosition = fract(facadeUv / vec2(4.8, 3.8));
        float frame = step(0.16, windowPosition.x) * step(windowPosition.x, 0.79)
          * step(0.2, windowPosition.y) * step(windowPosition.y, 0.75);
        float lit = step(0.63, skylineHash(windowCell));
        totalEmissiveRadiance += vec3(1.0, 0.68, 0.3) * frame * lit * verticalWall * 0.66;
      `);
  };
  material.customProgramCacheKey = () => 'skyline-city-district-windows-v1';
  return material;
}

function colorForDescriptor(color, item, index) {
  const jitter = ((index * 37) % 17) / 100;
  if (item.kind === 'road') return color.setRGB(0.12 + jitter * 0.18, 0.14 + jitter * 0.18, 0.15 + jitter * 0.18);
  if (item.kind === 'sidewalk') return color.setRGB(0.43 + jitter, 0.44 + jitter, 0.42 + jitter);
  if (item.kind === 'park') return color.setRGB(0.38 + jitter, 0.58 + jitter, 0.31 + jitter);
  if (item.kind === 'plaza' || item.kind === 'landmarkPlaza') return color.setRGB(0.72 + jitter, 0.69 + jitter, 0.61 + jitter);
  if (item.colorKey === 'landmark') return color.setRGB(0.62 + jitter, 0.69 + jitter, 0.72 + jitter);
  if (item.colorKey === 'roof') return color.setRGB(0.25 + jitter, 0.28 + jitter, 0.29 + jitter);
  if (item.colorKey === 'industrialRoof') return color.setRGB(0.31 + jitter, 0.27 + jitter, 0.23 + jitter);
  if (item.district === 'downtown') return color.setRGB(0.48 + jitter, 0.54 + jitter, 0.57 + jitter);
  if (item.district === 'civic') return color.setRGB(0.63 + jitter, 0.61 + jitter, 0.55 + jitter);
  if (item.district === 'residential') return color.setRGB(0.58 + jitter, 0.54 + jitter, 0.49 + jitter);
  return color.setRGB(0.42 + jitter, 0.43 + jitter, 0.4 + jitter);
}

function createInstancedBoxes(name, descriptors, material, colorize = false) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, descriptors.length);
  mesh.name = name;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  for (let index = 0; index < descriptors.length; index += 1) {
    const item = descriptors[index];
    position.set(item.x, item.y, item.z);
    quaternion.setFromAxisAngle(UP, item.yaw || 0);
    scale.set(item.width, item.height, item.depth);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    if (colorize) mesh.setColorAt(index, colorForDescriptor(color, item, index));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
  return { mesh, geometry };
}

function flatDescriptors(items) {
  return items.map((item, index) => ({
    ...item,
    y: item.y,
    yaw: 0,
    label: `${item.kind || 'city surface'} ${index}`,
  }));
}

export function createCityLayer(features, options = {}) {
  const layout = createCityLayout(features, options);
  const group = new THREE.Group();
  group.name = features.city.id;

  const facadeMaterial = createWindowMaterial();
  const surfaceMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });

  // Keep the rebuilt city inside the pre-existing world draw-call ceiling.
  // All solid silhouettes share one instanced box mesh; all roads, sidewalks,
  // plazas and parks share a second instanced box mesh with per-instance colour.
  const solidDescriptors = [...layout.descriptors, ...layout.roofDescriptors];
  const surfaceDescriptors = flatDescriptors([
    ...layout.roads,
    ...layout.blockPads,
    ...layout.parks,
  ]);
  const buildings = createInstancedBoxes('Instanced district buildings, landmarks and rooftops', solidDescriptors, facadeMaterial, true);
  const surfaces = createInstancedBoxes('Instanced city roads, sidewalks, plazas and parks', surfaceDescriptors, surfaceMaterial, true);
  group.add(surfaces.mesh, buildings.mesh);

  const collisionBoxes = layout.descriptors.map(descriptorAabb);
  if (options.scene) options.scene.add(group);
  if (options.collision) registerBoxes(options.collision, collisionBoxes);

  const geometries = [buildings.geometry, surfaces.geometry];
  const materials = [facadeMaterial, surfaceMaterial];
  return {
    group,
    buildings: buildings.mesh,
    descriptors: layout.descriptors,
    roofDescriptors: layout.roofDescriptors,
    roads: layout.roads,
    parks: layout.parks,
    collisionBoxes,
    threadCorridors: layout.threadCorridors,
    blockCount: layout.blockCount,
    districtCounts: layout.districtCounts,
    drawCallCount: group.children.length,
    registerCollisions(collisionSystem) {
      return registerBoxes(collisionSystem, collisionBoxes);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.removeFromParent();
    },
  };
}
