const DEG = Math.PI / 180;

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

function axisPlan(min, max, blockMin, blockMax, street, random) {
  const blocks = [];
  const roads = [{ center: min + street * 0.5, size: street }];
  let cursor = min + street;
  while (cursor + blockMin < max - street) {
    const available = max - street - cursor;
    const size = Math.min(blockMin + random() * (blockMax - blockMin), available);
    if (size < blockMin * 0.72) break;
    blocks.push({ center: cursor + size * 0.5, size, min: cursor, max: cursor + size });
    cursor += size;
    if (cursor < max - street * 0.45) {
      const roadSize = Math.min(street, max - cursor);
      roads.push({ center: cursor + roadSize * 0.5, size: roadSize });
      cursor += roadSize;
    }
  }
  if (cursor < max) roads.push({ center: cursor + (max - cursor) * 0.5, size: max - cursor });
  return { blocks, roads };
}

function addBox(list, x, baseY, z, width, height, depth, yaw, label, kind, district, colorKey = district) {
  list.push({
    x,
    y: baseY + height * 0.5,
    baseY,
    z,
    width,
    height,
    depth,
    yaw,
    label,
    kind,
    district,
    colorKey,
  });
}

function districtAt(city, x, z) {
  const centerX = (city.plateau.min[0] + city.plateau.max[0]) * 0.5;
  const centerZ = (city.plateau.min[1] + city.plateau.max[1]) * 0.5;
  const nx = (x - centerX) / Math.max(1, city.plateau.max[0] - city.plateau.min[0]);
  const nz = (z - centerZ) / Math.max(1, city.plateau.max[1] - city.plateau.min[1]);
  if (nx > -0.05 && nz > -0.18) return 'downtown';
  if (nx <= -0.05 && nz > -0.12) return 'civic';
  if (nx < 0.08) return 'residential';
  return 'industrial';
}

function distanceToReserved(x, z, reserved) {
  let distance = Infinity;
  for (const item of reserved) distance = Math.min(distance, Math.hypot(x - item.position[0], z - item.position[1]));
  return distance;
}

function addDowntown(descriptors, roofDescriptors, block, baseY, random, index) {
  const inset = 11 + random() * 8;
  const width = Math.max(24, block.width - inset * 2);
  const depth = Math.max(24, block.depth - inset * 2);
  const podiumHeight = 12 + random() * 10;
  addBox(descriptors, block.x, baseY, block.z, width, podiumHeight, depth, 0, `Downtown podium ${index}`, 'podium', 'downtown');
  const towerWidth = Math.max(18, width * (0.42 + random() * 0.18));
  const towerDepth = Math.max(18, depth * (0.42 + random() * 0.18));
  const towerHeight = 62 + Math.pow(random(), 0.72) * 105;
  const offsetX = (random() - 0.5) * Math.max(0, width - towerWidth - 8);
  const offsetZ = (random() - 0.5) * Math.max(0, depth - towerDepth - 8);
  addBox(descriptors, block.x + offsetX, baseY + podiumHeight, block.z + offsetZ, towerWidth, towerHeight, towerDepth, 0, `Downtown tower ${index}`, 'tower', 'downtown');
  if (random() > 0.3) {
    addBox(roofDescriptors, block.x + offsetX, baseY + podiumHeight + towerHeight, block.z + offsetZ, towerWidth * 0.35, 5 + random() * 8, towerDepth * 0.35, 0, `Downtown rooftop ${index}`, 'roof', 'downtown', 'roof');
  }
}

function addCivic(descriptors, roofDescriptors, block, baseY, random, index) {
  const courtyard = random() > 0.42;
  const height = 24 + random() * 34;
  if (courtyard && block.width > 58 && block.depth > 58) {
    const wing = Math.max(15, Math.min(block.width, block.depth) * 0.22);
    addBox(descriptors, block.x - block.width * 0.31, baseY, block.z, wing, height, block.depth * 0.72, 0, `Civic west wing ${index}`, 'civic', 'civic');
    addBox(descriptors, block.x + block.width * 0.31, baseY, block.z, wing, height * 0.88, block.depth * 0.72, 0, `Civic east wing ${index}`, 'civic', 'civic');
    addBox(descriptors, block.x, baseY, block.z + block.depth * 0.29, block.width * 0.7, height * 0.72, wing, 0, `Civic north wing ${index}`, 'civic', 'civic');
  } else {
    addBox(descriptors, block.x, baseY, block.z, block.width * 0.76, height, block.depth * 0.72, 0, `Civic hall ${index}`, 'civic', 'civic');
  }
  if (random() > 0.6) addBox(roofDescriptors, block.x, baseY + height, block.z, 10, 6, 10, 0, `Civic cupola ${index}`, 'roof', 'civic', 'roof');
}

function addResidential(descriptors, roofDescriptors, block, baseY, random, index) {
  const columns = block.width > 68 ? 2 : 1;
  const rows = block.depth > 68 ? 2 : 1;
  const gap = 8;
  const width = Math.max(16, (block.width - gap * (columns + 1)) / columns);
  const depth = Math.max(16, (block.depth - gap * (rows + 1)) / rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = block.x + (column - (columns - 1) * 0.5) * (width + gap);
      const z = block.z + (row - (rows - 1) * 0.5) * (depth + gap);
      const height = 13 + random() * 20;
      addBox(descriptors, x, baseY, z, width, height, depth, 0, `Residential building ${index}-${row}-${column}`, 'residential', 'residential');
      if (random() > 0.72) addBox(roofDescriptors, x, baseY + height, z, width * 0.28, 2.5, depth * 0.35, 0, `Residential rooftop ${index}-${row}-${column}`, 'roof', 'residential', 'roof');
    }
  }
}

function addIndustrial(descriptors, roofDescriptors, block, baseY, random, index) {
  const height = 15 + random() * 20;
  const width = block.width * (0.78 + random() * 0.1);
  const depth = block.depth * (0.7 + random() * 0.14);
  addBox(descriptors, block.x, baseY, block.z, width, height, depth, 0, `Industrial hall ${index}`, 'industrial', 'industrial');
  const stacks = random() > 0.5 ? 2 : 1;
  for (let stack = 0; stack < stacks; stack += 1) {
    const x = block.x + (stack - (stacks - 1) * 0.5) * Math.min(22, width * 0.4);
    addBox(roofDescriptors, x, baseY + height, block.z, 4.5, 12 + random() * 9, 4.5, 0, `Industrial vent ${index}-${stack}`, 'roof', 'industrial', 'industrialRoof');
  }
}

function addTowerPair(descriptors, feature, index, corridors) {
  const heading = feature.headingDegrees * DEG;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const halfSeparation = 40;
  const baseY = feature.y;
  for (const side of [-1, 1]) {
    const x = feature.position[0] + cosine * halfSeparation * side;
    const z = feature.position[1] - sine * halfSeparation * side;
    const height = side < 0 ? 148 + index * 8 : 170 - index * 7;
    addBox(descriptors, x, baseY, z, 24, height, 26, heading, `${feature.id} tower`, 'landmarkTower', 'downtown', 'landmark');
  }
  addBox(descriptors, feature.position[0], baseY + 78, feature.position[1], halfSeparation * 2 - 24, 8, 15, heading, `${feature.id} high skybridge`, 'skybridge', 'downtown', 'landmark');
  corridors.push({ id: feature.id, center: [feature.position[0], baseY + 40, feature.position[1]], headingDegrees: feature.headingDegrees, width: 50, height: 74 });
}

function addOpenAtrium(descriptors, feature, corridors) {
  const outer = 108;
  const inner = 48;
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
      addBox(descriptors, x, baseY, z, corner, 74, corner, heading, `${feature.id} corner`, 'atrium', 'civic', 'landmark');
    }
  }
  addBox(descriptors, feature.position[0], baseY + 59, feature.position[1] - offset, inner, 14, corner, heading, `${feature.id} north lintel`, 'atrium', 'civic', 'landmark');
  addBox(descriptors, feature.position[0], baseY + 59, feature.position[1] + offset, inner, 14, corner, heading, `${feature.id} south lintel`, 'atrium', 'civic', 'landmark');
  corridors.push({ id: feature.id, center: [feature.position[0], baseY + 30, feature.position[1]], headingDegrees: feature.headingDegrees, width: inner, height: 58 });
}

export function createCityLayout(features, options = {}) {
  if (!features?.city?.plateau || !features?.city?.grid) throw new TypeError('World city feature data is required.');
  const city = features.city;
  const random = createRng(options.seed ?? hashSeed(`${city.id}-western-plain-v1`));
  const baseY = city.plateau.elevationMeters + 0.18;
  const grid = city.grid;
  const xPlan = axisPlan(city.plateau.min[0], city.plateau.max[0], grid.blockMinMeters, grid.blockMaxMeters, grid.streetMeters, random);
  const zPlan = axisPlan(city.plateau.min[1], city.plateau.max[1], grid.blockMinMeters, grid.blockMaxMeters, grid.streetMeters, random);
  const descriptors = [];
  const roofDescriptors = [];
  const blockPads = [];
  const roads = [];
  const parks = [];
  const corridors = [];
  const reserved = (features.landmarks ?? []).filter(item => item.type === 'tower_pair' || item.type === 'open_atrium');
  const centerX = (city.plateau.min[0] + city.plateau.max[0]) * 0.5;
  const centerZ = (city.plateau.min[1] + city.plateau.max[1]) * 0.5;

  for (const road of xPlan.roads) roads.push({ x: road.center, z: centerZ, width: road.size, depth: city.plateau.max[1] - city.plateau.min[1], y: baseY - 0.08, height: 0.16, kind: 'road' });
  for (const road of zPlan.roads) roads.push({ x: centerX, z: road.center, width: city.plateau.max[0] - city.plateau.min[0], depth: road.size, y: baseY - 0.075, height: 0.17, kind: 'road' });

  let blockIndex = 0;
  let occupiedBlocks = 0;
  for (let zIndex = 0; zIndex < zPlan.blocks.length; zIndex += 1) {
    const zBlock = zPlan.blocks[zIndex];
    for (let xIndex = 0; xIndex < xPlan.blocks.length; xIndex += 1) {
      const xBlock = xPlan.blocks[xIndex];
      const x = xBlock.center;
      const z = zBlock.center;
      const width = Math.max(20, xBlock.size - 5);
      const depth = Math.max(20, zBlock.size - 5);
      const district = districtAt(city, x, z);
      const reservedDistance = distanceToReserved(x, z, reserved);
      const isPlaza = Math.hypot(x - (centerX - 78), z - (centerZ + 96)) < 70;
      const isPark = (xIndex === 1 && zIndex === 1) || (xIndex === xPlan.blocks.length - 2 && zIndex === 1);
      blockPads.push({ x, z, width, depth, y: baseY - 0.015, height: 0.13, district, kind: 'sidewalk' });
      if (isPlaza || reservedDistance < 92) {
        parks.push({ x, z, width: width * 0.9, depth: depth * 0.9, y: baseY + 0.005, height: 0.08, kind: isPlaza ? 'plaza' : 'landmarkPlaza' });
        blockIndex += 1;
        continue;
      }
      if (isPark) {
        parks.push({ x, z, width: width * 0.9, depth: depth * 0.9, y: baseY + 0.005, height: 0.08, kind: 'park' });
        blockIndex += 1;
        continue;
      }
      const block = { x, z, width, depth };
      if (district === 'downtown') addDowntown(descriptors, roofDescriptors, block, baseY, random, blockIndex);
      else if (district === 'civic') addCivic(descriptors, roofDescriptors, block, baseY, random, blockIndex);
      else if (district === 'residential') addResidential(descriptors, roofDescriptors, block, baseY, random, blockIndex);
      else addIndustrial(descriptors, roofDescriptors, block, baseY, random, blockIndex);
      occupiedBlocks += 1;
      blockIndex += 1;
    }
  }

  let towerIndex = 0;
  for (const landmark of reserved) {
    if (landmark.type === 'tower_pair') addTowerPair(descriptors, landmark, towerIndex++, corridors);
    if (landmark.type === 'open_atrium') addOpenAtrium(descriptors, landmark, corridors);
  }

  return {
    baseY,
    bounds: { minX: city.plateau.min[0], minZ: city.plateau.min[1], maxX: city.plateau.max[0], maxZ: city.plateau.max[1] },
    descriptors,
    roofDescriptors,
    blockPads,
    roads,
    parks,
    threadCorridors: corridors,
    blockCount: occupiedBlocks,
    districtCounts: descriptors.reduce((counts, item) => {
      counts[item.district] = (counts[item.district] || 0) + 1;
      return counts;
    }, {}),
  };
}
