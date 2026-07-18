import { DEFAULTS } from './constants.js';
import { makeDescriptor } from './descriptor.js';
import { mixHash, rotate2 } from './math.js';

const PALETTES = Object.freeze({
  'aster-glass': ['#718b98', '#8399a1', '#5f7782', '#9fadb0'],
  'aster-civic': ['#d6cbb2', '#c0b49b', '#e0d6c2', '#899087'],
  'aster-brick': ['#a96f55', '#bd8061', '#925e4c', '#c79773'],
  'aster-river': ['#8ea09b', '#a9b4a6', '#7f918b', '#bcc0af'],
  'suburb-light': ['#b9af9d', '#a2aaa1', '#c6bba5', '#939f98'],
  'town-warm': ['#bd8a66', '#a47259', '#caa87e', '#8b7b6c'],
  'forge-dark': ['#59666c', '#707a7e', '#827365', '#4c5a60'],
  'port-blue': ['#6d848e', '#809298', '#60727a', '#939992'],
  'farm-earth': ['#917a5c', '#a58e68', '#78806b', '#b1976e'],
  downtown: ['#718b98', '#8399a1', '#5f7782', '#9fadb0'],
  civic: ['#d6cbb2', '#c0b49b', '#e0d6c2'],
  'old-quarter': ['#a96f55', '#bd8061', '#925e4c', '#c79773'],
  residential: ['#b9af9d', '#a2aaa1', '#c6bba5'],
  'mixed-use': ['#8ea09b', '#a9b4a6', '#7f918b'],
  market: ['#bd8a66', '#a47259', '#caa87e'],
  industrial: ['#59666c', '#707a7e', '#827365'],
  warehouse: ['#48565b', '#61686a', '#5f554a'],
  docklands: ['#6d848e', '#809298', '#60727a'],
  rural: ['#917a5c', '#a58e68', '#78806b'],
});

const ROOF_COLORS = Object.freeze({
  'aster-glass': '#304650',
  'aster-civic': '#5f7169',
  'aster-brick': '#613f35',
  'aster-river': '#50645f',
  'suburb-light': '#5f625b',
  'town-warm': '#68483b',
  'forge-dark': '#29353a',
  'port-blue': '#35474f',
  'farm-earth': '#55493b',
});

function paletteFor(parcel) {
  return PALETTES[parcel.materialKey] ?? PALETTES[parcel.districtKind] ?? PALETTES.residential;
}

function roofColorFor(parcel) {
  return ROOF_COLORS[parcel.materialKey] ?? '#465155';
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
  const roofColor = roofColorFor(parcel);
  const podiumHeight = Math.max(14, Math.min(30, parcel.height * (podium ? 0.23 : 0.16)));
  const podiumBody = part(parcel, 'podium', {
    role: 'urban-podium', width: parcel.width, height: podiumHeight, depth: parcel.depth,
    color: palette[1 % palette.length], priority: 104, collidable: true, essential: true,
  });
  descriptors.push(podiumBody);

  const towerWidth = parcel.width * (podium ? 0.62 : 0.68);
  const towerDepth = parcel.depth * (podium ? 0.58 : 0.64);
  const towerHeight = Math.max(48, parcel.height - podiumHeight);
  const tower = part(parcel, 'tower-lower', {
    role: podium ? 'podium-tower-lower' : 'skyline-tower-lower',
    localX: podium ? parcel.width * 0.08 : 0,
    localZ: podium ? -parcel.depth * 0.05 : 0,
    baseY: parcel.foundation.topY + podiumHeight,
    width: towerWidth, height: towerHeight * 0.62, depth: towerDepth,
    color: palette[Math.floor(random() * palette.length)], priority: 120,
    visibilityBand: 'skyline', collidable: true, essential: true,
  });
  descriptors.push(tower);
  const upper = part(parcel, 'tower-upper', {
    primitive: podium ? 'slab_taper' : 'tapered',
    role: podium ? 'podium-tower-setback' : 'skyline-tower-setback',
    localX: podium ? parcel.width * 0.08 : 0,
    localZ: podium ? -parcel.depth * 0.05 : 0,
    baseY: parcel.foundation.topY + podiumHeight + towerHeight * 0.62,
    width: towerWidth * 0.76, height: towerHeight * 0.38, depth: towerDepth * 0.76,
    color: palette[(Math.floor(random() * palette.length) + 2) % palette.length],
    priority: 124, visibilityBand: 'skyline', collidable: true, essential: true,
  });
  descriptors.push(upper);
  addRoofCap(parcel, upper, descriptors, {
    primitive: podium ? 'stepped' : 'octagon', height: podium ? 10 : 7,
    overhang: 0.82, color: roofColor, rank: 0, role: podium ? 'stepped-crown' : 'lantern-crown',
  });
  descriptors.push(...windowDescriptors(parcel, tower, {
    floors: Math.floor(tower.scale[1] / 6), columns: Math.max(3, Math.floor(towerWidth / 9)),
    sideColumns: Math.max(2, Math.floor(towerDepth / 10)), startY: 4.5, floorStep: 5.8,
    fraction: 0.16, rank: 2,
  }));
  descriptors.push(part(parcel, 'antenna', {
    category: 'details', primitive: 'mast', role: 'roof-antenna',
    baseY: upper.position[1] + upper.scale[1] * 0.5 + (podium ? 10 : 7),
    localX: podium ? parcel.width * 0.08 : 0, localZ: podium ? -parcel.depth * 0.05 : 0,
    width: 1.8, height: 18 + random() * 14, depth: 1.8,
    color: roofColor, surface: 'metal', qualityRank: 1, priority: 58,
    visibilityBand: 'skyline', essential: true,
  }));
}

function urbanMidrise(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  const baseHeight = parcel.height * 0.66;
  const body = part(parcel, 'street-wall', {
    role: 'urban-street-wall', width: parcel.width, height: baseHeight, depth: parcel.depth,
    color: palette[Math.floor(random() * palette.length)], priority: 92, collidable: true, essential: true,
  });
  descriptors.push(body);
  const setback = part(parcel, 'setback', {
    role: 'urban-midrise-setback', localX: -parcel.width * 0.08, localZ: -parcel.depth * 0.06,
    baseY: parcel.foundation.topY + baseHeight,
    width: parcel.width * 0.70, height: parcel.height - baseHeight, depth: parcel.depth * 0.68,
    color: palette[(Math.floor(random() * palette.length) + 1) % palette.length],
    priority: 90, collidable: true, essential: true,
  });
  descriptors.push(setback);
  addRoofCap(parcel, setback, descriptors, { primitive: 'slab_taper', height: 3.4, overhang: 0.94, color: roof, rank: 0 });
  descriptors.push(...windowDescriptors(parcel, body, {
    floors: Math.floor(baseHeight / 5.4), columns: Math.max(3, Math.floor(parcel.width / 9)),
    sideColumns: Math.max(1, Math.floor(parcel.depth / 11)), rank: 2, fraction: 0.14,
  }));
}

function courtyardBlock(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  const wingWidth = parcel.width * 0.26;
  const wingDepth = parcel.depth;
  for (const side of [-1, 1]) {
    const wing = part(parcel, `wing-${side}`, {
      role: 'courtyard-long-wing', localX: side * parcel.width * 0.36,
      width: wingWidth, height: parcel.height, depth: wingDepth,
      color: palette[side > 0 ? 1 : 0], priority: 90, collidable: true, essential: true,
    });
    descriptors.push(wing);
    addRoofCap(parcel, wing, descriptors, { primitive: 'barrel', height: 4, rank: 0, color: roof, role: 'courtyard-wing-roof' });
  }
  for (const side of [-1, 1]) {
    const cross = part(parcel, `cross-wing-${side}`, {
      role: 'courtyard-cross-wing', localZ: side * parcel.depth * 0.37,
      width: parcel.width * 0.58, height: parcel.height * 0.78, depth: parcel.depth * 0.22,
      color: palette[2 % palette.length], qualityRank: 0, priority: 82,
      collidable: true, visibilityBand: 'district', essential: true,
    });
    descriptors.push(cross);
    addRoofCap(parcel, cross, descriptors, { primitive: 'gable', height: 4.5, rank: 0, color: roof, role: 'courtyard-cross-roof' });
  }
}

function civicHall(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  const body = part(parcel, 'hall', {
    role: 'civic-hall', width: parcel.width, height: parcel.height * 0.58, depth: parcel.depth,
    color: palette[0], priority: 112, collidable: true, essential: true,
  });
  descriptors.push(body);
  addRoofCap(parcel, body, descriptors, { primitive: 'gable', height: 10, overhang: 1.04, color: roof, rank: 0, role: 'monumental-civic-roof' });
  const towerHeight = parcel.height * 0.72;
  const tower = part(parcel, 'clock-tower', {
    primitive: 'octagon', role: 'civic-clock-tower', localZ: parcel.depth * 0.28,
    baseY: parcel.foundation.topY + body.scale[1] * 0.45,
    width: parcel.width * 0.25, height: towerHeight, depth: parcel.width * 0.25,
    color: palette[1], priority: 118, visibilityBand: 'skyline', collidable: true, essential: true,
  });
  descriptors.push(tower);
  descriptors.push(part(parcel, 'spire', {
    category: 'roofs', primitive: 'cone', role: 'civic-spire', localZ: parcel.depth * 0.28,
    baseY: tower.position[1] + tower.scale[1] * 0.5,
    width: parcel.width * 0.20, height: 18, depth: parcel.width * 0.20,
    color: roof, surface: 'roof', priority: 100, visibilityBand: 'skyline', essential: true,
  }));
  descriptors.push(...windowDescriptors(parcel, body, { floors: 2, columns: 6, sideColumns: 2, rank: 2, fraction: 0.11 }));
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
      color: roofColorFor(parcel), rank: 0, role: 'gable-roof',
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
    color: roofColorFor(parcel),
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
    color: roofColorFor(parcel), rank: 0, role: barn ? 'barn-roof' : 'farmhouse-roof',
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

function signatureNeedle(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  const podium = part(parcel, 'signature-podium', {
    role: 'signature-needle-podium', width: parcel.width, height: 24, depth: parcel.depth,
    color: palette[1], priority: 150, collidable: true, essential: true, visibilityBand: 'skyline',
  });
  descriptors.push(podium);
  const shaft = part(parcel, 'signature-shaft', {
    primitive: 'octagon', role: 'signature-needle-shaft', baseY: parcel.foundation.topY + 24,
    width: parcel.width * 0.48, height: parcel.height * 0.66, depth: parcel.depth * 0.48,
    color: palette[0], priority: 160, collidable: true, essential: true, visibilityBand: 'skyline',
  });
  descriptors.push(shaft);
  const upper = part(parcel, 'signature-upper', {
    primitive: 'tapered', role: 'signature-needle-upper', baseY: shaft.position[1] + shaft.scale[1] * 0.5,
    width: parcel.width * 0.38, height: parcel.height * 0.30, depth: parcel.depth * 0.38,
    color: palette[2], priority: 164, collidable: true, essential: true, visibilityBand: 'skyline',
  });
  descriptors.push(upper);
  descriptors.push(part(parcel, 'signature-spire', {
    category: 'roofs', primitive: 'cone', role: 'signature-needle-spire',
    baseY: upper.position[1] + upper.scale[1] * 0.5,
    width: parcel.width * 0.18, height: Math.max(26, parcel.height * 0.17), depth: parcel.depth * 0.18,
    color: roof, surface: 'roof', priority: 170, visibilityBand: 'skyline', essential: true,
  }));
}

function signatureCrown(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  const podium = part(parcel, 'crown-podium', {
    role: 'signature-crown-podium', width: parcel.width, height: 20, depth: parcel.depth,
    color: palette[1], priority: 145, collidable: true, essential: true, visibilityBand: 'skyline',
  });
  descriptors.push(podium);
  const slab = part(parcel, 'crown-slab', {
    primitive: 'slab_taper', role: 'signature-crown-slab', baseY: parcel.foundation.topY + 20,
    width: parcel.width * 0.58, height: parcel.height * 0.72, depth: parcel.depth * 0.40,
    color: palette[0], priority: 158, collidable: true, essential: true, visibilityBand: 'skyline',
  });
  descriptors.push(slab);
  descriptors.push(part(parcel, 'crown-top', {
    category: 'roofs', primitive: 'stepped', role: 'signature-stepped-crown',
    baseY: slab.position[1] + slab.scale[1] * 0.5,
    width: parcel.width * 0.50, height: Math.max(18, parcel.height * 0.16), depth: parcel.depth * 0.34,
    color: roof, surface: 'roof', priority: 165, visibilityBand: 'skyline', essential: true,
  }));
}

function signatureGateway(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  const towerWidth = parcel.width * 0.30;
  const towerDepth = parcel.depth * 0.62;
  for (const side of [-1, 1]) {
    descriptors.push(part(parcel, `gateway-tower-${side}`, {
      primitive: 'slab_taper', role: 'signature-gateway-tower', localX: side * parcel.width * 0.30,
      width: towerWidth, height: parcel.height, depth: towerDepth,
      color: palette[side > 0 ? 0 : 2], priority: 158,
      collidable: true, essential: true, visibilityBand: 'skyline',
    }));
  }
  descriptors.push(part(parcel, 'gateway-bridge', {
    role: 'signature-skybridge', baseY: parcel.foundation.topY + parcel.height * 0.64,
    width: parcel.width * 0.42, height: 10, depth: towerDepth * 0.62,
    color: roof, surface: 'metal', priority: 166, collidable: true, essential: true, visibilityBand: 'skyline',
  }));
}

function civicRotunda(parcel, random, descriptors) {
  const palette = paletteFor(parcel);
  const roof = roofColorFor(parcel);
  descriptors.push(part(parcel, 'rotunda-base', {
    role: 'civic-rotunda-base', width: parcel.width, height: parcel.height * 0.32, depth: parcel.depth,
    color: palette[0], priority: 142, collidable: true, essential: true, visibilityBand: 'skyline',
  }));
  const drum = part(parcel, 'rotunda-drum', {
    primitive: 'octagon', role: 'civic-rotunda-drum', baseY: parcel.foundation.topY + parcel.height * 0.32,
    width: Math.min(parcel.width, parcel.depth) * 0.58, height: parcel.height * 0.38,
    depth: Math.min(parcel.width, parcel.depth) * 0.58, color: palette[1],
    priority: 150, collidable: true, essential: true, visibilityBand: 'skyline',
  });
  descriptors.push(drum);
  descriptors.push(part(parcel, 'rotunda-dome', {
    category: 'roofs', primitive: 'dome', role: 'civic-dome',
    baseY: drum.position[1] + drum.scale[1] * 0.5,
    width: drum.scale[0] * 1.05, height: parcel.height * 0.30, depth: drum.scale[2] * 1.05,
    color: roof, surface: 'roof', priority: 160, visibilityBand: 'skyline', essential: true,
  }));
}

export function buildParcelDescriptors(parcel, random) {
  const descriptors = [foundation(parcel)];
  switch (parcel.family) {
    case 'signature_needle':
      signatureNeedle(parcel, random, descriptors);
      break;
    case 'signature_crown':
      signatureCrown(parcel, random, descriptors);
      break;
    case 'signature_gateway':
      signatureGateway(parcel, random, descriptors);
      break;
    case 'civic_rotunda':
      civicRotunda(parcel, random, descriptors);
      break;
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
