import { DEFAULTS } from './constants.js';
import { makeDescriptor } from './descriptor.js';
import { mixHash, rotate2 } from './math.js';

const PALETTES = Object.freeze({
  downtown: ['#6e7476', '#7d8282', '#5f686c', '#898884'],
  civic: ['#858178', '#746f67', '#929087'],
  'old-quarter': ['#81786e', '#706c65', '#948777', '#756f67'],
  residential: ['#857e74', '#767b77', '#978d7f', '#6e7774'],
  'mixed-use': ['#787a77', '#898177', '#6f7676'],
  market: ['#887d70', '#76726a', '#978a79'],
  industrial: ['#626a6c', '#72736d', '#565f62', '#7e7a70'],
  warehouse: ['#646b6d', '#73746e', '#5b6467'],
  docklands: ['#626c70', '#74756e', '#596368'],
  rural: ['#777267', '#897b65', '#676d65'],
});

function paletteFor(parcel) {
  return PALETTES[parcel.districtKind] ?? PALETTES.residential;
}

function transformed(parcel, localX, localZ) {
  const offset = rotate2(localX, localZ, parcel.yaw);
  return [parcel.x + offset[0], parcel.z + offset[1]];
}

function baseMeta(parcel, extra = {}) {
  return {
    parcelId: parcel.id,
    family: parcel.family,
    roadRef: parcel.roadRef,
    roadHeading: parcel.roadHeading,
    roadDistance: parcel.roadDistance,
    terrainMin: parcel.foundation.terrain.min,
    terrainMax: parcel.foundation.terrain.max,
    terrainDelta: parcel.foundation.terrain.delta,
    foundationTopY: parcel.foundation.topY,
    ...extra,
  };
}

function part(parcel, suffix, {
  category = 'structures',
  primitive = 'box',
  role,
  localX = 0,
  localZ = 0,
  baseY = parcel.foundation.topY,
  width,
  height,
  depth,
  yaw = parcel.yaw,
  color,
  surface = 'facade',
  qualityRank = 0,
  priority = 50,
  visibilityBand = 'district',
  emissive = false,
  collidable = false,
  essential = false,
  meta = {},
}) {
  const [x, z] = transformed(parcel, localX, localZ);
  return makeDescriptor({
    id: `${parcel.id}:${suffix}`,
    settlementId: parcel.settlementId,
    locationId: parcel.id,
    districtId: parcel.districtId,
    category,
    primitive,
    role,
    x,
    y: baseY + height * 0.5,
    z,
    width,
    height,
    depth,
    yaw,
    color,
    surface,
    qualityRank,
    priority,
    visibilityBand,
    emissive,
    collidable,
    essential,
    meta: baseMeta(parcel, meta),
  });
}

function foundation(parcel) {
  return makeDescriptor({
    id: `${parcel.id}:foundation`,
    settlementId: parcel.settlementId,
    locationId: parcel.id,
    districtId: parcel.districtId,
    category: 'foundations',
    primitive: 'box',
    role: 'terrain-conforming-foundation',
    x: parcel.x,
    y: parcel.foundation.centerY,
    z: parcel.z,
    width: parcel.width * 1.04,
    height: parcel.foundation.depthY,
    depth: parcel.depth * 1.04,
    yaw: parcel.yaw,
    color: '#545a58',
    surface: 'foundation',
    qualityRank: 0,
    priority: 95,
    visibilityBand: 'district',
    collidable: true,
    essential: true,
    meta: baseMeta(parcel, {
      terrainSamples: [
        parcel.foundation.terrain.center,
        ...parcel.foundation.terrain.corners,
      ],
      foundationBottomY: parcel.foundation.bottomY,
    }),
  });
}

function windowDescriptors(parcel, building, {
  floors,
  columns,
  sideColumns = 0,
  startY = 3.2,
  floorStep = 4.6,
  windowWidth = 2.6,
  windowHeight = 1.55,
  fraction = DEFAULTS.nightWindowFraction,
  rank = 1,
}) {
  const descriptors = [];
  const warm = ['#ffd397', '#f2bd77', '#ffe1ae'];
  const [bodyX, bodyY, bodyZ] = building.position;
  const [bodyWidth, bodyHeight, bodyDepth] = building.scale;
  const baseY = bodyY - bodyHeight * 0.5;
  let sequence = 0;

  const add = ({ localX, localZ, faceYaw, floor, column, face }) => {
    const seed = mixHash(parcel.id, building.id, face, floor, column);
    const lit = (seed % 10000) / 10000 < fraction;
    if (!lit && seed % 4 !== 0) return;
    const offset = rotate2(localX, localZ, building.yaw);
    descriptors.push(makeDescriptor({
      id: `${building.id}:window:${sequence++}`,
      settlementId: parcel.settlementId,
      locationId: parcel.id,
      districtId: parcel.districtId,
      category: 'windows',
      primitive: 'box',
      role: lit ? 'actual-window' : 'dark-window',
      x: bodyX + offset[0],
      y: baseY + startY + floor * floorStep,
      z: bodyZ + offset[1],
      width: windowWidth,
      height: windowHeight,
      depth: 0.16,
      yaw: building.yaw + faceYaw,
      color: lit ? warm[seed % warm.length] : '#273033',
      surface: lit ? 'window-lit' : 'window-dark',
      qualityRank: lit ? Math.max(0, rank - 1) : rank,
      priority: lit ? 48 : 20,
      visibilityBand: lit ? 'near' : 'micro',
      emissive: lit,
      essential: false,
      meta: baseMeta(parcel, { parentId: building.id, lit }),
    }));
  };

  const safeFloors = Math.max(1, Math.min(floors, Math.floor((bodyHeight - startY) / floorStep) + 1));
  for (let floor = 0; floor < safeFloors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const localX = columns === 1 ? 0 : -bodyWidth * 0.39 + (column / (columns - 1)) * bodyWidth * 0.78;
      add({ localX, localZ: bodyDepth * 0.505, faceYaw: 0, floor, column, face: 'front' });
    }
    for (let column = 0; column < sideColumns; column += 1) {
      const localZ = sideColumns === 1 ? 0 : -bodyDepth * 0.37 + (column / (sideColumns - 1)) * bodyDepth * 0.74;
      add({ localX: bodyWidth * 0.505, localZ, faceYaw: Math.PI * 0.5, floor, column, face: 'side' });
    }
  }
  return descriptors;
}

function addRoofCap(parcel, body, descriptors, {
  primitive = 'box',
  height = 1.6,
  overhang = 0.95,
  color = '#4e5658',
  rank = 0,
  role = 'roof-cap',
}) {
  const [x, y, z] = body.position;
  const [width, bodyHeight, depth] = body.scale;
  descriptors.push(makeDescriptor({
    id: `${body.id}:roof`,
    settlementId: parcel.settlementId,
    locationId: parcel.id,
    districtId: parcel.districtId,
    category: 'roofs',
    primitive,
    role,
    x,
    y: y + bodyHeight * 0.5 + height * 0.5,
    z,
    width: width * overhang,
    height,
    depth: depth * overhang,
    yaw: body.yaw,
    color,
    surface: 'roof',
    qualityRank: rank,
    priority: 58,
    visibilityBand: 'district',
    essential: rank === 0,
    meta: baseMeta(parcel, { parentId: body.id }),
  }));
}

function urbanTower(parcel, random, descriptors, podium = false) {
  const palette = paletteFor(parcel);
  const podiumHeight = podium ? Math.min(22, parcel.height * 0.25) : 10;
  const podiumBody = part(parcel, 'podium', {
    role: 'urban-podium',
    width: parcel.width,
    height: podiumHeight,
    depth: parcel.depth,
    color: palette[1 % palette.length],
    priority: 92,
    collidable: true,
    essential: true,
  });
  descriptors.push(podiumBody);

  const towerWidth = parcel.width * (podium ? 0.62 : 0.72);
  const towerDepth = parcel.depth * (podium ? 0.60 : 0.70);
  const towerHeight = Math.max(36, parcel.height - podiumHeight);
  const tower = part(parcel, 'tower', {
    role: podium ? 'podium-tower' : 'skyline-tower',
    localX: podium ? parcel.width * 0.09 : 0,
    localZ: podium ? -parcel.depth * 0.07 : 0,
    baseY: parcel.foundation.topY + podiumHeight,
    width: towerWidth,
    height: towerHeight,
    depth: towerDepth,
    color: palette[Math.floor(random() * palette.length)],
    priority: 110,
    visibilityBand: 'skyline',
    collidable: true,
    essential: true,
  });
  descriptors.push(tower);
  addRoofCap(parcel, tower, descriptors, { height: 1.8, overhang: 0.92, rank: 0 });
  descriptors.push(...windowDescriptors(parcel, tower, {
    floors: Math.floor(towerHeight / 5.2),
    columns: Math.max(3, Math.floor(towerWidth / 7)),
    sideColumns: Math.max(2, Math.floor(towerDepth / 8)),
    startY: 3.3,
    floorStep: 5.0,
    fraction: 0.21,
    rank: 1,
  }));
  descriptors.push(part(parcel, 'roof-equipment', {
    category: 'details', role: 'rooftop-equipment',
    localX: towerWidth * 0.12, localZ: -towerDepth * 0.1,
    baseY: parcel.foundation.topY + podiumHeight + towerHeight,
    width: 5 + random() * 3, height: 3 + random() * 2, depth: 5 + random() * 3,
    color: '#5d6464', surface: 'metal', qualityRank: 1, priority: 32, visibilityBand: 'near',
  }));
  if (!podium) {
    descriptors.push(part(parcel, 'antenna', {
      category: 'details', primitive: 'mast', role: 'roof-antenna',
      baseY: parcel.foundation.topY + podiumHeight + towerHeight + 1.8,
      width: 1.4, height: 14 + random() * 10, depth: 1.4,
      color: '#4e5555', surface: 'metal', qualityRank: 1, priority: 48, visibilityBand: 'skyline',
    }));
  }
}

function urbanMidrise(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const body = part(parcel, 'body', {
    role: 'urban-midrise', width: parcel.width, height: parcel.height, depth: parcel.depth,
    color: palette[Math.floor(random() * palette.length)], priority: 82, collidable: true, essential: true,
  });
  descriptors.push(body);
  if (random() < 0.72) {
    descriptors.push(part(parcel, 'step-wing', {
      role: 'stepped-wing', localX: parcel.width * 0.34, localZ: -parcel.depth * 0.08,
      width: parcel.width * 0.38, height: parcel.height * 0.64, depth: parcel.depth * 0.72,
      color: palette[(Math.floor(random() * palette.length) + 1) % palette.length],
      qualityRank: 1, priority: 48, collidable: true, visibilityBand: 'near',
    }));
  }
  addRoofCap(parcel, body, descriptors, { rank: 0 });
  descriptors.push(...windowDescriptors(parcel, body, {
    floors: Math.floor(parcel.height / 4.9),
    columns: Math.max(3, Math.floor(parcel.width / 7.2)),
    sideColumns: Math.max(1, Math.floor(parcel.depth / 9)),
    rank: 1,
  }));
}

function courtyardBlock(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const wingWidth = parcel.width * 0.28;
  const wingDepth = parcel.depth;
  for (const side of [-1, 1]) {
    const wing = part(parcel, `wing-${side}`, {
      role: 'courtyard-wing', localX: side * parcel.width * 0.34,
      width: wingWidth, height: parcel.height, depth: wingDepth,
      color: palette[(side > 0 ? 1 : 0) % palette.length], priority: 76,
      collidable: true, essential: true,
    });
    descriptors.push(wing);
    addRoofCap(parcel, wing, descriptors, { rank: 0, overhang: 0.96 });
    descriptors.push(...windowDescriptors(parcel, wing, {
      floors: Math.floor(parcel.height / 4.8), columns: 2, sideColumns: 2, rank: 1,
    }));
  }
  for (const side of [-1, 1]) {
    descriptors.push(part(parcel, `cross-wing-${side}`, {
      role: 'courtyard-cross-wing', localZ: side * parcel.depth * 0.35,
      width: parcel.width * 0.54, height: parcel.height * 0.82, depth: parcel.depth * 0.26,
      color: palette[2 % palette.length], qualityRank: 1, priority: 54,
      collidable: true, visibilityBand: 'near',
    }));
  }
}

function civicHall(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const body = part(parcel, 'hall', {
    role: 'civic-hall', width: parcel.width, height: parcel.height * 0.72, depth: parcel.depth,
    color: palette[0], priority: 100, collidable: true, essential: true,
  });
  descriptors.push(body);
  addRoofCap(parcel, body, descriptors, { primitive: 'gable', height: 8, overhang: 1.04, color: '#504d49', rank: 0, role: 'civic-roof' });
  const towerHeight = parcel.height * 0.78;
  descriptors.push(part(parcel, 'clock-tower', {
    role: 'civic-clock-tower', localZ: parcel.depth * 0.36,
    baseY: parcel.foundation.topY + body.scale[1] * 0.45,
    width: parcel.width * 0.22, height: towerHeight, depth: parcel.width * 0.22,
    color: palette[1], priority: 104, visibilityBand: 'skyline', collidable: true, essential: true,
  }));
  descriptors.push(part(parcel, 'spire', {
    category: 'roofs', primitive: 'cone', role: 'civic-spire', localZ: parcel.depth * 0.36,
    baseY: parcel.foundation.topY + body.scale[1] * 0.45 + towerHeight,
    width: parcel.width * 0.18, height: 12, depth: parcel.width * 0.18,
    color: '#4d5552', surface: 'roof', priority: 86, visibilityBand: 'skyline', essential: true,
  }));
  descriptors.push(...windowDescriptors(parcel, body, { floors: 2, columns: 5, sideColumns: 2, rank: 1, fraction: 0.16 }));
}

function gabledResidential(parcel, random, descriptors, role, units = 1) {
  const palette = paletteFor(parcel);
  const unitWidth = parcel.width / units;
  for (let index = 0; index < units; index += 1) {
    const localX = -parcel.width * 0.5 + unitWidth * (index + 0.5);
    const body = part(parcel, `unit-${index}`, {
      role,
      localX,
      width: unitWidth * 0.94,
      height: parcel.height,
      depth: parcel.depth,
      color: palette[(index + Math.floor(random() * palette.length)) % palette.length],
      priority: 70,
      collidable: true,
      essential: index === 0,
    });
    descriptors.push(body);
    addRoofCap(parcel, body, descriptors, {
      primitive: 'gable', height: Math.min(7, unitWidth * 0.28), overhang: 1.05,
      color: index % 2 ? '#514a43' : '#4d5351', rank: 0, role: 'gable-roof',
    });
    descriptors.push(...windowDescriptors(parcel, body, {
      floors: Math.max(1, Math.floor(parcel.height / 5)),
      columns: Math.max(1, Math.floor(unitWidth / 7)),
      sideColumns: 1,
      startY: 2.7,
      floorStep: 4.3,
      rank: 1,
      fraction: 0.20,
    }));
    if (index === 0) {
      descriptors.push(part(parcel, 'chimney', {
        category: 'details', role: 'chimney', localX: -parcel.width * 0.22, localZ: -parcel.depth * 0.1,
        baseY: parcel.foundation.topY + parcel.height,
        width: 1.4, height: 5, depth: 1.4,
        color: '#5d5149', surface: 'masonry', qualityRank: 2, priority: 22, visibilityBand: 'micro',
      }));
    }
  }
}

function marketBlock(parcel, random, descriptors) {
  gabledResidential(parcel, random, descriptors, 'market-building', Math.max(2, Math.min(4, Math.floor(parcel.width / 10))));
  descriptors.push(part(parcel, 'awning', {
    category: 'details', primitive: 'wedge', role: 'market-awning', localZ: parcel.depth * 0.53,
    baseY: parcel.foundation.topY + 3.2,
    width: parcel.width * 0.76, height: 1.2, depth: 3.2,
    color: '#6e4d3f', surface: 'fabric', qualityRank: 1, priority: 34, visibilityBand: 'near',
  }));
}

function warehouse(parcel, random, descriptors, factory = false, dock = false) {
  const palette = paletteFor(parcel);
  const body = part(parcel, 'hall', {
    role: dock ? 'dock-warehouse' : factory ? 'factory-hall' : 'warehouse',
    width: parcel.width, height: parcel.height, depth: parcel.depth,
    color: palette[Math.floor(random() * palette.length)], priority: 88,
    collidable: true, essential: true,
  });
  descriptors.push(body);
  addRoofCap(parcel, body, descriptors, {
    primitive: factory ? 'sawtooth' : 'gable',
    height: factory ? 5.5 : 6.5,
    overhang: 1.01,
    color: '#4e5657',
    rank: 0,
    role: factory ? 'sawtooth-roof' : 'industrial-roof',
  });
  descriptors.push(...windowDescriptors(parcel, body, {
    floors: 1,
    columns: Math.max(3, Math.floor(parcel.width / 11)),
    sideColumns: Math.max(2, Math.floor(parcel.depth / 14)),
    startY: parcel.height * 0.62,
    floorStep: 4,
    windowWidth: 3.4,
    windowHeight: 2.2,
    rank: 1,
    fraction: 0.13,
  }));
  if (factory) {
    const stackCount = parcel.width > 72 ? 2 : 1;
    for (let index = 0; index < stackCount; index += 1) {
      descriptors.push(part(parcel, `stack-${index}`, {
        category: 'details', primitive: 'cylinder', role: 'factory-stack',
        localX: (index - (stackCount - 1) * 0.5) * 12, localZ: -parcel.depth * 0.3,
        baseY: parcel.foundation.topY + parcel.height,
        width: 3.2, height: 24 + random() * 12, depth: 3.2,
        color: '#565c5c', surface: 'metal', qualityRank: index === 0 ? 0 : 1,
        priority: 62, visibilityBand: 'skyline', collidable: true, essential: index === 0,
      }));
    }
  }
  if (dock) {
    descriptors.push(part(parcel, 'loading-canopy', {
      category: 'details', role: 'loading-canopy', localZ: parcel.depth * 0.55,
      baseY: parcel.foundation.topY + 4.4,
      width: parcel.width * 0.78, height: 1.1, depth: 6.5,
      color: '#4f595b', surface: 'metal', qualityRank: 1, priority: 42, visibilityBand: 'near',
    }));
  }
}

function tankCluster(parcel, random, descriptors) {
  const radius = Math.min(parcel.width, parcel.depth) * 0.18;
  const positions = [[-0.22, -0.18], [0.23, -0.14], [0, 0.24]];
  for (let index = 0; index < positions.length; index += 1) {
    const [fx, fz] = positions[index];
    descriptors.push(part(parcel, `tank-${index}`, {
      primitive: 'silo', role: 'storage-tank',
      localX: parcel.width * fx, localZ: parcel.depth * fz,
      width: radius * 2, height: parcel.height * (0.72 + index * 0.08), depth: radius * 2,
      color: index % 2 ? '#777970' : '#686e6c', surface: 'metal',
      qualityRank: index === 0 ? 0 : 1, priority: 76 - index * 6,
      visibilityBand: 'district', collidable: true, essential: index === 0,
    }));
  }
  descriptors.push(part(parcel, 'pipe-rack', {
    category: 'details', primitive: 'truss', role: 'pipe-rack',
    localZ: parcel.depth * 0.40,
    baseY: parcel.foundation.topY + 4,
    width: parcel.width * 0.72, height: 7, depth: 3,
    color: '#50595a', surface: 'metal', qualityRank: 1, priority: 38, visibilityBand: 'near',
  }));
}

function farmBuilding(parcel, random, descriptors, barn = false) {
  const palette = paletteFor(parcel);
  const body = part(parcel, 'body', {
    role: barn ? 'barn' : 'farmhouse',
    width: parcel.width, height: parcel.height, depth: parcel.depth,
    color: palette[Math.floor(random() * palette.length)], priority: 74,
    collidable: true, essential: true,
  });
  descriptors.push(body);
  addRoofCap(parcel, body, descriptors, {
    primitive: 'gable', height: barn ? 8 : 5.5, overhang: 1.06,
    color: barn ? '#514a41' : '#505552', rank: 0, role: barn ? 'barn-roof' : 'farmhouse-roof',
  });
  if (!barn) descriptors.push(...windowDescriptors(parcel, body, { floors: 2, columns: 2, sideColumns: 1, rank: 1, fraction: 0.18 }));
  if (barn) {
    descriptors.push(part(parcel, 'silo', {
      category: 'details', primitive: 'silo', role: 'farm-silo',
      localX: parcel.width * 0.58, localZ: -parcel.depth * 0.12,
      width: 8, height: 20, depth: 8,
      color: '#777a71', surface: 'metal', qualityRank: 1, priority: 52, visibilityBand: 'district',
      collidable: true,
    }));
  }
}

export function buildParcelDescriptors(parcel, random) {
  const descriptors = [foundation(parcel)];
  switch (parcel.family) {
    case 'skyline_tower':
      urbanTower(parcel, random, descriptors, false);
      break;
    case 'podium_tower':
      urbanTower(parcel, random, descriptors, true);
      break;
    case 'urban_midrise':
      urbanMidrise(parcel, random, descriptors);
      break;
    case 'courtyard_block':
      courtyardBlock(parcel, random, descriptors);
      break;
    case 'civic_hall':
      civicHall(parcel, random, descriptors);
      break;
    case 'old_town_block':
      gabledResidential(parcel, random, descriptors, 'old-town-building', Math.max(2, Math.min(3, Math.floor(parcel.width / 11))));
      break;
    case 'rowhouse':
      gabledResidential(parcel, random, descriptors, 'rowhouse', Math.max(2, Math.min(4, Math.floor(parcel.width / 8))));
      break;
    case 'detached_house':
    case 'village_house':
      gabledResidential(parcel, random, descriptors, parcel.family, 1);
      break;
    case 'market_block':
      marketBlock(parcel, random, descriptors);
      break;
    case 'factory_hall':
      warehouse(parcel, random, descriptors, true, false);
      break;
    case 'warehouse':
      warehouse(parcel, random, descriptors, false, false);
      break;
    case 'dock_warehouse':
      warehouse(parcel, random, descriptors, false, true);
      break;
    case 'tank_cluster':
      tankCluster(parcel, random, descriptors);
      break;
    case 'barn':
      farmBuilding(parcel, random, descriptors, true);
      break;
    case 'farmhouse':
      farmBuilding(parcel, random, descriptors, false);
      break;
    default:
      urbanMidrise(parcel, random, descriptors);
      break;
  }
  return descriptors;
}
