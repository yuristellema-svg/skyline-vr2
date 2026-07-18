import {
  DEFAULT_SEED,
  DISTRICT_IDS,
  WATER_LEVEL,
} from './constants.js';
import { mergeAuthoredReference } from './authoredReference.js';
import { resolveDetailBudget } from './budget.js';
import {
  deterministicUnit,
  distance2d,
  finiteTransform,
  footprintIsUsable,
  freezeList,
  hashText,
  headingBetween,
  localToWorld,
  pointSegmentDistance,
  polylineDistance,
  quadraticPoint,
  safeHeight,
  sampleFootprint,
  seededRandom,
} from './math.js';

function makeIntervals(min, max, blockMin, blockMax, street, random) {
  const intervals = [];
  let cursor = min + street;
  while (cursor + blockMin < max - street) {
    const size = Math.min(
      blockMin + random() * (blockMax - blockMin),
      max - street - cursor,
    );
    if (size < blockMin * 0.72) break;
    intervals.push({ center: cursor + size * 0.5, size });
    cursor += size + street;
  }
  return intervals;
}

function cityDescriptor(list, values) {
  list.push({
    district: 'downtown',
    kind: 'block',
    rotationY: 0,
    ...values,
  });
}

function addTowerPair(descriptors, feature, index) {
  const heading = feature.headingDegrees * Math.PI / 180;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const halfSeparation = 39;
  for (const side of [-1, 1]) {
    const x = feature.position[0] + cosine * halfSeparation * side;
    const z = feature.position[1] - sine * halfSeparation * side;
    const height = side < 0 ? 142 + index * 7 : 160 - index * 8;
    cityDescriptor(descriptors, {
      id: `${feature.id}-tower-${side}`,
      kind: 'tower',
      x,
      y: feature.y + height * 0.5,
      z,
      width: 23,
      height,
      depth: 25,
      rotationY: heading,
    });
  }
  cityDescriptor(descriptors, {
    id: `${feature.id}-skybridge`,
    kind: 'skybridge',
    x: feature.position[0],
    y: feature.y + 77,
    z: feature.position[1],
    width: halfSeparation * 2 - 23,
    height: 8,
    depth: 14,
    rotationY: heading,
  });
}

function addOpenAtrium(descriptors, feature) {
  const outer = 104;
  const inner = 46;
  const corner = (outer - inner) * 0.5;
  const offset = (inner + corner) * 0.5;
  const heading = feature.headingDegrees * Math.PI / 180;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  for (const localX of [-offset, offset]) {
    for (const localZ of [-offset, offset]) {
      cityDescriptor(descriptors, {
        id: `${feature.id}-corner-${localX}-${localZ}`,
        kind: 'atrium',
        x: feature.position[0] + cosine * localX + sine * localZ,
        y: feature.y + 36,
        z: feature.position[1] - sine * localX + cosine * localZ,
        width: corner,
        height: 72,
        depth: corner,
        rotationY: heading,
      });
    }
  }
  for (const side of [-1, 1]) {
    cityDescriptor(descriptors, {
      id: `${feature.id}-lintel-${side}`,
      kind: 'atrium',
      x: feature.position[0],
      y: feature.y + 65,
      z: feature.position[1] + side * offset,
      width: inner,
      height: 14,
      depth: corner,
      rotationY: heading,
    });
  }
}

function reconstructAuthoredCity(reference) {
  const city = reference.city;
  const random = seededRandom(hashText(city.id));
  const descriptors = [];
  const xIntervals = makeIntervals(
    city.plateau.min[0],
    city.plateau.max[0],
    city.grid.blockMin,
    city.grid.blockMax,
    city.grid.street,
    random,
  );
  const zIntervals = makeIntervals(
    city.plateau.min[1],
    city.plateau.max[1],
    city.grid.blockMin,
    city.grid.blockMax,
    city.grid.street,
    random,
  );
  const reserved = city.landmarks.filter(item => (
    item.type === 'tower_pair' || item.type === 'open_atrium'
  ));

  let blockIndex = 0;
  for (const xBlock of xIntervals) {
    for (const zBlock of zIntervals) {
      const x = xBlock.center;
      const z = zBlock.center;
      if (polylineDistance(reference.river.points, x, z) < 78) continue;
      if (reserved.some(item => Math.hypot(
        x - item.position[0],
        z - item.position[1],
      ) < 98)) continue;
      const inset = 8 + random() * 5;
      const width = Math.max(26, xBlock.size - inset);
      const depth = Math.max(26, zBlock.size - inset);
      const height = 24 + Math.pow(random(), 1.5) * 86;
      cityDescriptor(descriptors, {
        id: `authored-city-block-${blockIndex++}`,
        x,
        y: city.plateau.elevation + height * 0.5,
        z,
        width,
        height,
        depth,
      });
    }
  }

  let towerIndex = 0;
  for (const landmark of city.landmarks) {
    if (landmark.type === 'tower_pair') addTowerPair(descriptors, landmark, towerIndex++);
    if (landmark.type === 'open_atrium') addOpenAtrium(descriptors, landmark);
  }

  const center = {
    x: (city.plateau.min[0] + city.plateau.max[0]) * 0.5,
    z: (city.plateau.min[1] + city.plateau.max[1]) * 0.5,
  };

  for (const building of descriptors) {
    const coreDistance = distance2d(building, center);
    if (
      ['tower', 'atrium', 'skybridge'].includes(building.kind) ||
      building.height >= 76 ||
      coreDistance < 310
    ) {
      building.district = 'downtown';
    } else if (building.z < -1030 || building.x < 690) {
      building.district = 'industrial';
    } else {
      building.district = 'residential';
    }
    building.rank = deterministicUnit(`${building.id}:rank`);
  }

  return freezeList(descriptors);
}

function makeCityWindows(buildings) {
  const windows = [];
  for (const building of buildings) {
    if (building.kind === 'skybridge') continue;
    const bottom = building.y - building.height * 0.5;
    const floors = Math.max(1, Math.min(30, Math.floor((building.height - 5) / 4.2)));
    const frontColumns = Math.max(1, Math.min(16, Math.floor((building.width - 5) / 5.0)));
    const sideColumns = Math.max(1, Math.min(16, Math.floor((building.depth - 5) / 5.0)));
    const frontStep = building.width / (frontColumns + 1);
    const sideStep = building.depth / (sideColumns + 1);

    const addFace = (face, columns, step, span, offset) => {
      for (let floor = 0; floor < floors; floor += 1) {
        const y = bottom + 3.2 + floor * 4.2;
        if (y > bottom + building.height - 2.4) continue;
        for (let column = 0; column < columns; column += 1) {
          const localAcross = -span * 0.5 + step * (column + 1);
          const localX = face === 'front' ? localAcross : offset;
          const localZ = face === 'front' ? offset : localAcross;
          const position = localToWorld(
            building.x,
            building.z,
            localX,
            localZ,
            building.rotationY,
          );
          const id = `${building.id}:${face}:${floor}:${column}`;
          windows.push({
            id,
            district: building.district,
            buildingId: building.id,
            x: position.x,
            y,
            z: position.z,
            width: 2.05,
            height: 1.72,
            depth: 0.14,
            rotationY: building.rotationY + (face === 'side' ? Math.PI * 0.5 : 0),
            visibilityRank: deterministicUnit(`${id}:visibility`),
            occupancyRank: deterministicUnit(`${id}:occupancy`),
          });
        }
      }
    };

    addFace('front', frontColumns, frontStep, building.width, building.depth * 0.5 + 0.11);
    addFace('side', sideColumns, sideStep, building.depth, building.width * 0.5 + 0.11);
  }
  return freezeList(windows);
}

function makeRooftopDetails(buildings) {
  const details = [];
  for (const building of buildings) {
    if (building.kind === 'skybridge' || building.height < 25) continue;
    const top = building.y + building.height * 0.5;
    const count = building.height > 95 ? 3 : building.height > 55 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const randomX = deterministicUnit(`${building.id}:roof-x:${index}`) - 0.5;
      const randomZ = deterministicUnit(`${building.id}:roof-z:${index}`) - 0.5;
      const width = Math.max(2.8, building.width * (0.12 + deterministicUnit(`${building.id}:roof-w:${index}`) * 0.12));
      const depth = Math.max(2.8, building.depth * (0.12 + deterministicUnit(`${building.id}:roof-d:${index}`) * 0.12));
      const local = localToWorld(
        building.x,
        building.z,
        randomX * Math.max(0, building.width - width) * 0.6,
        randomZ * Math.max(0, building.depth - depth) * 0.6,
        building.rotationY,
      );
      details.push({
        id: `${building.id}-roof-${index}`,
        kind: index === count - 1 && building.height > 120 ? 'antenna-base' : 'service-box',
        district: building.district,
        x: local.x,
        y: top + (index === count - 1 && building.height > 120 ? 3.5 : 1.5),
        z: local.z,
        width,
        height: index === count - 1 && building.height > 120 ? 7 : 3,
        depth,
        rotationY: building.rotationY,
        rank: deterministicUnit(`${building.id}:roof-rank:${index}`),
      });
    }
  }
  return freezeList(details);
}

function runwayLocal(airfield, localX, localZ) {
  return localToWorld(airfield.x, airfield.z, localX, localZ, airfield.heading);
}

function clearOfAirfields(x, z, airfields, multiplier = 1.55) {
  for (const airfield of airfields) {
    const dx = x - airfield.x;
    const dz = z - airfield.z;
    const sine = Math.sin(airfield.heading);
    const cosine = Math.cos(airfield.heading);
    const along = dx * sine - dz * cosine;
    const lateral = dx * cosine + dz * sine;
    if (
      Math.abs(along) < airfield.length * 0.62 &&
      Math.abs(lateral) < airfield.width * multiplier
    ) return false;
  }
  return true;
}

function clearOfSpawn(x, z, spawn, radius = 260) {
  const sx = Number(spawn?.[0] ?? spawn?.x) || 0;
  const sz = Number(spawn?.[2] ?? spawn?.z) || 0;
  return Math.hypot(x - sx, z - sz) >= radius;
}

function makeInfillDistrict({
  district,
  center,
  radiusX,
  radiusZ,
  count,
  random,
  sampleHeight,
  reference,
  spawn,
}) {
  const result = [];
  let attempts = 0;
  while (result.length < count && attempts < count * 45) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = center.x + Math.cos(angle) * radiusX * radius;
    const z = center.z + Math.sin(angle) * radiusZ * radius;
    if (!clearOfSpawn(x, z, spawn)) continue;
    if (!clearOfAirfields(x, z, reference.airfields, 2.1)) continue;
    if (polylineDistance(reference.river.points, x, z) < 110) continue;

    const residential = district === 'residential';
    const archetypeRoll = random();
    const archetype = residential
      ? archetypeRoll < 0.66 ? 'row-house' : 'apartment'
      : archetypeRoll < 0.62 ? 'warehouse' : archetypeRoll < 0.84 ? 'workshop' : 'tank-house';
    const width = residential
      ? 18 + random() * 34
      : 34 + random() * 76;
    const depth = residential
      ? 16 + random() * 30
      : 30 + random() * 66;
    const height = residential
      ? archetype === 'row-house' ? 9 + random() * 10 : 20 + random() * 18
      : archetype === 'warehouse' ? 13 + random() * 16 : 18 + random() * 28;
    if (!footprintIsUsable(sampleHeight, x, z, width, depth, {
      fallback: reference.city.plateau.elevation,
      waterLevel: WATER_LEVEL,
      minimumAboveWater: 4,
      maximumSpread: residential ? 5 : 7,
    })) continue;

    const spacing = Math.max(24, Math.min(width, depth) * 0.82);
    if (result.some(item => Math.hypot(item.x - x, item.z - z) < spacing)) continue;
    const footprint = sampleFootprint(sampleHeight, x, z, width, depth, 0);
    result.push({
      id: `${district}-infill-${result.length}`,
      district,
      kind: 'infill-building',
      archetype,
      x,
      y: footprint.max + height * 0.5,
      z,
      width,
      height,
      depth,
      rotationY: angle + (random() - 0.5) * 0.32,
      rank: random(),
      collision: true,
    });
  }
  return freezeList(result);
}

function roadCurve({
  id,
  start,
  control,
  end,
  width,
  sampleHeight,
  fallbackHeight,
  segments = 24,
  priority = 0.5,
}) {
  const roads = [];
  const markings = [];
  let previous = quadraticPoint(start, control, end, 0);
  for (let index = 1; index <= segments; index += 1) {
    const current = quadraticPoint(start, control, end, index / segments);
    const length = distance2d(previous, current);
    const x = (previous.x + current.x) * 0.5;
    const z = (previous.z + current.z) * 0.5;
    const heading = headingBetween(previous, current);
    const sample = sampleFootprint(sampleHeight, x, z, width * 0.72, length, fallbackHeight);
    if (sample.min >= WATER_LEVEL + 2 && sample.spread <= 5.5) {
      const road = {
        id: `${id}-${index - 1}`,
        corridor: id,
        x,
        y: sample.max + 0.16,
        z,
        width,
        height: 0.22,
        depth: Math.max(4, length * 1.06),
        rotationY: heading,
        rank: deterministicUnit(`${id}:road:${index}`),
        priority,
      };
      roads.push(road);
      if (index % 2 === 0) {
        markings.push({
          id: `${id}-dash-${index}`,
          x,
          y: road.y + 0.14,
          z,
          width: 0.45,
          height: 0.06,
          depth: Math.max(3, length * 0.42),
          rotationY: heading,
          rank: deterministicUnit(`${id}:marking:${index}`),
        });
      }
    }
    previous = current;
  }
  return { roads, markings };
}

function makeRoadNetwork(sampleHeight, reference) {
  const fallback = reference.city.plateau.elevation;
  const corridors = [
    {
      id: 'waterfront-arterial',
      start: { x: 470, z: -1320 },
      control: { x: 900, z: -1000 },
      end: { x: 1440, z: -410 },
      width: 18,
      segments: 30,
      priority: 1,
    },
    {
      id: 'runway-city-link',
      start: { x: 600, z: -390 },
      control: { x: 310, z: -20 },
      end: { x: 415, z: 520 },
      width: 16,
      segments: 26,
      priority: 0.95,
    },
    {
      id: 'east-residential-boulevard',
      start: { x: 1410, z: -460 },
      control: { x: 1780, z: -90 },
      end: { x: 2260, z: 210 },
      width: 15,
      segments: 26,
      priority: 0.74,
    },
    {
      id: 'industrial-crescent',
      start: { x: 310, z: -1510 },
      control: { x: 820, z: -1910 },
      end: { x: 1410, z: -1510 },
      width: 17,
      segments: 28,
      priority: 0.82,
    },
    {
      id: 'west-river-road',
      start: { x: 430, z: -1180 },
      control: { x: 40, z: -650 },
      end: { x: -260, z: 20 },
      width: 14,
      segments: 24,
      priority: 0.58,
    },
  ];
  const roads = [];
  const markings = [];
  for (const corridor of corridors) {
    const built = roadCurve({
      ...corridor,
      sampleHeight,
      fallbackHeight: fallback,
    });
    roads.push(...built.roads);
    markings.push(...built.markings);
  }
  return Object.freeze({
    segments: freezeList(roads),
    markings: freezeList(markings),
    corridors: Object.freeze(corridors.map(item => Object.freeze({ ...item }))),
  });
}

function beamBetween(id, start, end, thickness, material = 'steel', rank = 0) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const horizontal = Math.hypot(dx, dz);
  const length = Math.hypot(horizontal, dy);
  return {
    id,
    kind: 'beam',
    material,
    x: (start.x + end.x) * 0.5,
    y: (start.y + end.y) * 0.5,
    z: (start.z + end.z) * 0.5,
    width: thickness,
    height: thickness,
    depth: Math.max(0.01, length),
    rotationX: -Math.atan2(dy, Math.max(0.001, horizontal)),
    rotationY: Math.atan2(dx, dz),
    rotationZ: 0,
    rank,
  };
}

function bridgePoint(bridge, along, side = 0, y = bridge.deckY) {
  const forwardX = Math.sin(bridge.heading);
  const forwardZ = -Math.cos(bridge.heading);
  const rightX = Math.cos(bridge.heading);
  const rightZ = Math.sin(bridge.heading);
  return {
    x: bridge.x + forwardX * along + rightX * side,
    y,
    z: bridge.z + forwardZ * along + rightZ * side,
  };
}

function makeBridgeDetails(reference) {
  const details = [];
  for (let bridgeIndex = 0; bridgeIndex < reference.bridges.length; bridgeIndex += 1) {
    const bridge = reference.bridges[bridgeIndex];
    const priority = 1 - bridgeIndex * 0.08;
    for (const side of [-1, 1]) {
      const offset = side * (bridge.width * 0.5 - 0.35);
      details.push(beamBetween(
        `${bridge.id}-rail-${side}`,
        bridgePoint(bridge, -bridge.span * 0.49, offset, bridge.deckY + 1.35),
        bridgePoint(bridge, bridge.span * 0.49, offset, bridge.deckY + 1.35),
        0.34,
        bridge.type.includes('stone') || bridge.type.includes('arch') ? 'masonry' : 'steel',
        0.02,
      ));
    }

    if (bridge.type === 'stone_arch' || bridge.type === 'urban_arch') {
      const archCount = bridge.type === 'stone_arch' ? 3 : 4;
      const opening = bridge.span / archCount;
      for (let index = 0; index < archCount; index += 1) {
        const along = -bridge.span * 0.5 + opening * (index + 0.5);
        const point = bridgePoint(bridge, along, 0, bridge.deckY - opening * 0.25);
        details.push({
          id: `${bridge.id}-arch-rib-${index}`,
          kind: 'arch',
          material: 'masonry',
          x: point.x,
          y: point.y,
          z: point.z,
          radius: opening * 0.34,
          tube: Math.max(0.9, opening * 0.045),
          depth: bridge.width * 0.86,
          rotationY: bridge.heading,
          rank: deterministicUnit(`${bridge.id}:arch:${index}`),
          priority,
        });
      }
    } else if (bridge.type === 'suspension') {
      const towerAlong = bridge.span * 0.31;
      for (const along of [-towerAlong, towerAlong]) {
        for (const side of [-1, 1]) {
          const offset = side * (bridge.width * 0.5 - 0.8);
          const base = bridgePoint(bridge, along, offset, bridge.deckY);
          const top = { ...base, y: bridge.deckY + 31 };
          details.push(beamBetween(`${bridge.id}-tower-${along}-${side}`, base, top, 1.8, 'steel', 0));
        }
      }
      for (const side of [-1, 1]) {
        const offset = side * bridge.width * 0.5;
        const samples = 12;
        let previous = bridgePoint(bridge, -bridge.span * 0.5, offset, bridge.deckY + 8);
        for (let index = 1; index <= samples; index += 1) {
          const along = -bridge.span * 0.5 + bridge.span * index / samples;
          const normalized = along / (bridge.span * 0.5);
          const cableY = bridge.deckY + 7 + (normalized * normalized) * 26;
          const current = bridgePoint(bridge, along, offset, cableY);
          details.push(beamBetween(
            `${bridge.id}-cable-${side}-${index}`,
            previous,
            current,
            0.28,
            'steel',
            deterministicUnit(`${bridge.id}:cable:${side}:${index}`),
          ));
          previous = current;
        }
      }
    } else {
      const bays = Math.max(5, Math.floor(bridge.span / 28));
      for (const side of [-1, 1]) {
        const offset = side * bridge.width * 0.5;
        for (let index = 0; index < bays; index += 1) {
          const a = -bridge.span * 0.5 + bridge.span * index / bays;
          const b = -bridge.span * 0.5 + bridge.span * (index + 1) / bays;
          const start = bridgePoint(bridge, a, offset, bridge.deckY + (index % 2 ? 8 : 1.5));
          const end = bridgePoint(bridge, b, offset, bridge.deckY + (index % 2 ? 1.5 : 8));
          details.push(beamBetween(
            `${bridge.id}-truss-${side}-${index}`,
            start,
            end,
            0.58,
            'steel',
            deterministicUnit(`${bridge.id}:truss:${side}:${index}`),
          ));
        }
      }
    }
  }
  return Object.freeze({
    bridges: reference.bridges,
    details: freezeList(details),
  });
}

function makeHarbour(sampleHeight, reference, random) {
  const pieces = [];
  const cranes = [];
  const lamps = [];
  const riverA = { x: 820, z: -760 };
  const riverB = { x: 1500, z: -1390 };
  const heading = headingBetween(riverA, riverB);
  const right = { x: Math.cos(heading), z: -Math.sin(heading) };
  const bankOffset = 94;
  const segmentCount = 8;

  for (const side of [-1, 1]) {
    for (let index = 0; index < segmentCount; index += 1) {
      const t0 = index / segmentCount;
      const t1 = (index + 1) / segmentCount;
      const a = {
        x: riverA.x + (riverB.x - riverA.x) * t0 + right.x * bankOffset * side,
        z: riverA.z + (riverB.z - riverA.z) * t0 + right.z * bankOffset * side,
      };
      const b = {
        x: riverA.x + (riverB.x - riverA.x) * t1 + right.x * bankOffset * side,
        z: riverA.z + (riverB.z - riverA.z) * t1 + right.z * bankOffset * side,
      };
      const length = distance2d(a, b);
      const x = (a.x + b.x) * 0.5;
      const z = (a.z + b.z) * 0.5;
      const ground = safeHeight(sampleHeight, x, z, reference.city.plateau.elevation);
      pieces.push({
        id: `river-quay-${side}-${index}`,
        kind: 'quay',
        x,
        y: Math.max(ground, 38) - 1.5,
        z,
        width: 5,
        height: 6,
        depth: length * 1.05,
        rotationY: headingBetween(a, b),
        rank: deterministicUnit(`river-quay-${side}-${index}`),
        importance: 0.85,
      });
    }
  }

  for (let index = 0; index < 6; index += 1) {
    const t = 0.14 + index * 0.12;
    const side = index % 2 === 0 ? -1 : 1;
    const bank = {
      x: riverA.x + (riverB.x - riverA.x) * t + right.x * bankOffset * side,
      z: riverA.z + (riverB.z - riverA.z) * t + right.z * bankOffset * side,
    };
    const towardRiver = -side;
    const pierLength = 42 + random() * 34;
    const center = {
      x: bank.x + right.x * pierLength * 0.5 * towardRiver,
      z: bank.z + right.z * pierLength * 0.5 * towardRiver,
    };
    pieces.push({
      id: `harbour-pier-${index}`,
      kind: 'pier',
      x: center.x,
      y: 39.2,
      z: center.z,
      width: 8 + random() * 5,
      height: 1.4,
      depth: pierLength,
      rotationY: heading + Math.PI * 0.5,
      rank: random(),
      importance: index < 3 ? 0.92 : 0.55,
    });
  }

  for (let index = 0; index < 3; index += 1) {
    const t = 0.28 + index * 0.18;
    const base = {
      x: riverA.x + (riverB.x - riverA.x) * t - right.x * (bankOffset + 26),
      z: riverA.z + (riverB.z - riverA.z) * t - right.z * (bankOffset + 26),
    };
    const ground = safeHeight(sampleHeight, base.x, base.z, 44);
    const mastHeight = 34 + index * 5;
    cranes.push({
      id: `harbour-crane-mast-${index}`,
      kind: 'crane-mast',
      x: base.x,
      y: ground + mastHeight * 0.5,
      z: base.z,
      width: 2.2,
      height: mastHeight,
      depth: 2.2,
      rotationY: heading,
      rank: index / 3,
    });
    const boomEnd = {
      x: base.x + right.x * 29,
      y: ground + mastHeight + 3,
      z: base.z + right.z * 29,
    };
    cranes.push(beamBetween(
      `harbour-crane-boom-${index}`,
      { x: base.x, y: ground + mastHeight, z: base.z },
      boomEnd,
      1.35,
      'steel',
      index / 3,
    ));
  }

  const lampBase = {
    x: riverB.x - right.x * 130,
    z: riverB.z - right.z * 130,
  };
  lamps.push({
    id: 'harbour-navigation-lamp',
    x: lampBase.x,
    y: safeHeight(sampleHeight, lampBase.x, lampBase.z, 40) + 10,
    z: lampBase.z,
    width: 0.8,
    height: 0.8,
    depth: 0.8,
    rank: 0,
  });

  return Object.freeze({
    pieces: freezeList(pieces),
    cranes: freezeList(cranes),
    lamps: freezeList(lamps),
    transparentDrawCalls: 0,
  });
}

function makeAirfieldLandmarks(sampleHeight, reference) {
  const landmarks = [];
  const collisions = [];
  for (const airfield of reference.airfields) {
    const cityField = airfield.id === 'city-runway';
    const side = cityField ? 1 : -1;
    const structures = cityField
      ? [
          { id: 'hangar-west', type: 'hangar', localX: -128, localZ: -190, width: 54, height: 17, depth: 72, importance: 1 },
          { id: 'hangar-east', type: 'hangar', localX: 132, localZ: -125, width: 48, height: 16, depth: 64, importance: 0.92 },
          { id: 'control-tower', type: 'control-tower', localX: 118, localZ: 72, width: 18, height: 34, depth: 18, importance: 1 },
          { id: 'service-shed', type: 'service-shed', localX: -106, localZ: 85, width: 28, height: 10, depth: 34, importance: 0.58 },
        ]
      : [
          { id: 'alpine-shed', type: 'service-shed', localX: -82, localZ: -70, width: 24, height: 9, depth: 30, importance: 0.72 },
        ];

    for (const structure of structures) {
      const point = runwayLocal(airfield, structure.localX, structure.localZ);
      const sample = sampleFootprint(sampleHeight, point.x, point.z, structure.width, structure.depth, 0);
      const descriptor = {
        id: `${airfield.id}-${structure.id}`,
        airfieldId: airfield.id,
        type: structure.type,
        x: point.x,
        y: sample.max + structure.height * 0.5,
        z: point.z,
        width: structure.width,
        height: structure.height,
        depth: structure.depth,
        rotationY: airfield.heading,
        rank: deterministicUnit(`${airfield.id}:${structure.id}`),
        importance: structure.importance,
        collision: true,
      };
      landmarks.push(descriptor);
      collisions.push(aabbFromBox(descriptor, `world-detail ${descriptor.id}`));
    }

    const windsockPoint = runwayLocal(
      airfield,
      side * (airfield.width * 0.5 + 34),
      cityField ? 110 : -80,
    );
    landmarks.push({
      id: `${airfield.id}-windsock`,
      airfieldId: airfield.id,
      type: 'windsock',
      x: windsockPoint.x,
      y: safeHeight(sampleHeight, windsockPoint.x, windsockPoint.z, 0),
      z: windsockPoint.z,
      width: 4,
      height: cityField ? 13 : 10,
      depth: 4,
      rotationY: airfield.heading,
      rank: 0,
      importance: 1,
    });

    for (const end of [-1, 1]) {
      const endZ = end * (airfield.length * 0.5 + 52);
      for (const lateral of [-1, 1]) {
        const point = runwayLocal(
          airfield,
          lateral * (airfield.width * 0.5 + 15),
          endZ,
        );
        landmarks.push({
          id: `${airfield.id}-marker-${end}-${lateral}`,
          airfieldId: airfield.id,
          type: 'approach-marker',
          x: point.x,
          y: safeHeight(sampleHeight, point.x, point.z, 0) + 2.2,
          z: point.z,
          width: 4.2,
          height: 4.4,
          depth: 0.45,
          rotationY: airfield.heading,
          rank: deterministicUnit(`${airfield.id}:marker:${end}:${lateral}`),
          importance: cityField ? 0.82 : 0.55,
        });
      }
    }
  }
  return Object.freeze({
    landmarks: freezeList(landmarks),
    collisions: freezeList(collisions),
  });
}

function makeTrafficHints(roads) {
  const selected = roads.segments
    .filter((_, index) => index % 9 === 4)
    .slice(0, 16)
    .map((road, index) => ({
      id: `traffic-hint-${index}`,
      x: road.x + Math.cos(road.rotationY) * road.width * 0.42,
      y: road.y + 4.4,
      z: road.z - Math.sin(road.rotationY) * road.width * 0.42,
      width: 0.7,
      height: 0.7,
      depth: 0.7,
      rotationY: road.rotationY,
      rank: deterministicUnit(`traffic-hint-${index}`),
    }));
  return freezeList(selected);
}

function makeClouds(random) {
  const near = [];
  const far = [];
  for (let index = 0; index < 16; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 2300 + random() * 2100;
    const width = 180 + random() * 280;
    near.push({
      id: `near-cloud-${index}`,
      x: Math.cos(angle) * radius,
      y: 520 + random() * 640,
      z: Math.sin(angle) * radius,
      width,
      height: width * (0.20 + random() * 0.10),
      depth: width * (0.46 + random() * 0.32),
      rotationY: random() * Math.PI,
      phase: random() * Math.PI * 2,
      rank: random(),
    });
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 4300 + random() * 1300;
    const width = 280 + random() * 430;
    far.push({
      id: `far-cloud-${index}`,
      x: Math.cos(angle) * radius,
      y: 760 + random() * 820,
      z: Math.sin(angle) * radius,
      width,
      height: width * (0.16 + random() * 0.08),
      depth: width * (0.52 + random() * 0.28),
      rotationY: random() * Math.PI,
      phase: random() * Math.PI * 2,
      rank: random(),
    });
  }
  return Object.freeze({ near: freezeList(near), far: freezeList(far) });
}

function aabbFromBox(box, label = box.id) {
  const cosine = Math.cos(box.rotationY || 0);
  const sine = Math.sin(box.rotationY || 0);
  const halfX = Math.abs(cosine) * box.width * 0.5 + Math.abs(sine) * box.depth * 0.5;
  const halfZ = Math.abs(sine) * box.width * 0.5 + Math.abs(cosine) * box.depth * 0.5;
  return {
    id: box.id,
    minX: box.x - halfX,
    maxX: box.x + halfX,
    minY: box.y - box.height * 0.5,
    maxY: box.y + box.height * 0.5,
    minZ: box.z - halfZ,
    maxZ: box.z + halfZ,
    label,
  };
}

function collectCollisionDescriptors(residential, industrial, airfield) {
  return freezeList([
    ...residential.filter(item => item.collision).map(item => aabbFromBox(item, `world-detail ${item.id}`)),
    ...industrial.filter(item => item.collision).map(item => aabbFromBox(item, `world-detail ${item.id}`)),
    ...airfield.collisions,
  ]);
}

function assertFiniteLayout(layout) {
  const lists = [
    ...Object.values(layout.city.authoredByDistrict),
    layout.city.windows,
    layout.city.rooftops,
    layout.city.residentialInfill,
    layout.city.industrialInfill,
    layout.roads.segments,
    layout.roads.markings,
    layout.bridges.details,
    layout.harbour.pieces,
    layout.harbour.cranes,
    layout.harbour.lamps,
    layout.airfield.landmarks,
    layout.trafficHints,
    layout.clouds.near,
    layout.clouds.far,
    layout.collisionDescriptors,
  ];
  for (const list of lists) {
    for (const item of list) {
      if (!finiteTransform(item)) throw new Error(`Non-finite world-detail transform: ${item.id || 'unknown'}`);
    }
  }
}

export function buildWorldDetailLayout({
  sampleHeight = null,
  spawn = [0, 720, 2450],
  seed = DEFAULT_SEED,
  authoredReference = null,
} = {}) {
  const reference = mergeAuthoredReference(authoredReference);
  const random = seededRandom(seed);
  const heightSamplerAvailable = typeof sampleHeight === 'function';
  const authoredBuildings = reconstructAuthoredCity(reference);
  const authoredByDistrict = Object.fromEntries(
    DISTRICT_IDS.map(id => [
      id,
      freezeList(authoredBuildings.filter(item => item.district === id)),
    ]),
  );
  const windows = makeCityWindows(authoredBuildings);
  const rooftops = makeRooftopDetails(authoredBuildings);
  const residentialInfill = heightSamplerAvailable
    ? makeInfillDistrict({
        district: 'residential',
        center: { x: 1830, z: -120 },
        radiusX: 610,
        radiusZ: 520,
        count: 28,
        random,
        sampleHeight,
        reference,
        spawn,
      })
    : freezeList([]);
  const industrialInfill = heightSamplerAvailable
    ? makeInfillDistrict({
        district: 'industrial',
        center: { x: 720, z: -1700 },
        radiusX: 720,
        radiusZ: 390,
        count: 24,
        random,
        sampleHeight,
        reference,
        spawn,
      })
    : freezeList([]);
  const roads = heightSamplerAvailable
    ? makeRoadNetwork(sampleHeight, reference)
    : Object.freeze({
        segments: freezeList([]),
        markings: freezeList([]),
        corridors: Object.freeze([]),
      });
  const bridges = makeBridgeDetails(reference);
  const harbour = heightSamplerAvailable
    ? makeHarbour(sampleHeight, reference, random)
    : Object.freeze({
        pieces: freezeList([]),
        cranes: freezeList([]),
        lamps: freezeList([]),
        transparentDrawCalls: 0,
      });
  const airfield = heightSamplerAvailable
    ? makeAirfieldLandmarks(sampleHeight, reference)
    : Object.freeze({
        landmarks: freezeList([]),
        collisions: freezeList([]),
      });
  const trafficHints = makeTrafficHints(roads);
  const clouds = makeClouds(random);
  const collisionDescriptors = collectCollisionDescriptors(
    residentialInfill,
    industrialInfill,
    airfield,
  );

  const layout = Object.freeze({
    seed,
    reference,
    spawn: Object.freeze(Array.isArray(spawn) ? [...spawn] : [spawn?.x || 0, spawn?.y || 0, spawn?.z || 0]),
    city: Object.freeze({
      authoredBuildings,
      authoredByDistrict: Object.freeze(authoredByDistrict),
      windows,
      rooftops,
      residentialInfill,
      industrialInfill,
    }),
    roads,
    bridges,
    harbour,
    airfield,
    trafficHints,
    clouds,
    collisionDescriptors,
    safety: Object.freeze({
      terrainCreated: false,
      mountainCreated: false,
      sceneScans: 0,
      existingMaterialsModified: 0,
      transparentDrawCalls: 2,
      heightSamplerAvailable,
      terrainDependentFeaturesSuppressed: !heightSamplerAvailable,
    }),
  });
  assertFiniteLayout(layout);
  return layout;
}

function rankFilter(list, fraction) {
  const safeFraction = Math.max(0, Math.min(1, fraction));
  return list.filter(item => (Number(item.rank ?? item.visibilityRank) || 0) <= safeFraction);
}

function essentialFraction(list, fraction) {
  return list.filter(item => (item.importance || 0) >= 0.9 || (item.rank || 0) <= fraction);
}

export function applyBudgetToLayout(layout, quality = 'auto', phone = false) {
  const budget = resolveDetailBudget(quality, phone);
  const visibleWindows = layout.city.windows.filter(
    item => item.visibilityRank <= budget.cityWindowFraction,
  );
  const litWindows = [];
  const unlitWindows = [];
  for (const window of visibleWindows) {
    if (window.occupancyRank <= budget.litWindowFraction) litWindows.push(window);
    else unlitWindows.push(window);
  }
  const residentialInfill = [...layout.city.residentialInfill]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, budget.residentialBuildings);
  const industrialInfill = [...layout.city.industrialInfill]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, budget.industrialBuildings);
  const roads = rankFilter(layout.roads.segments, budget.roadSegmentFraction)
    .sort((a, b) => b.priority - a.priority || a.rank - b.rank);
  const markings = rankFilter(layout.roads.markings, budget.roadMarkingFraction);
  const selectedBridgeIds = new Set(
    layout.bridges.bridges.slice(0, budget.bridgeCount).map(item => item.id),
  );
  const bridgeDetails = layout.bridges.details.filter(item => {
    const bridgeId = layout.bridges.bridges.find(bridge => item.id.startsWith(bridge.id))?.id;
    return bridgeId && selectedBridgeIds.has(bridgeId) && (item.rank || 0) <= budget.bridgeDetailFraction;
  });
  const harbourPieces = essentialFraction(layout.harbour.pieces, budget.harbourPieceFraction);
  const harbourCranes = rankFilter(layout.harbour.cranes, budget.harbourPieceFraction);
  const airfieldLandmarks = essentialFraction(layout.airfield.landmarks, budget.airfieldDetailFraction);
  const airfieldIds = new Set(airfieldLandmarks.map(item => item.id));
  const collisionIds = new Set([
    ...residentialInfill.map(item => item.id),
    ...industrialInfill.map(item => item.id),
    ...airfieldIds,
  ]);
  const collisionDescriptors = layout.collisionDescriptors.filter(item => collisionIds.has(item.id));

  return Object.freeze({
    budget,
    city: Object.freeze({
      authoredByDistrict: layout.city.authoredByDistrict,
      litWindows: freezeList(litWindows),
      unlitWindows: freezeList(unlitWindows),
      rooftops: freezeList(rankFilter(layout.city.rooftops, budget.rooftopFraction)),
      residentialInfill: freezeList(residentialInfill),
      industrialInfill: freezeList(industrialInfill),
    }),
    roads: Object.freeze({
      segments: freezeList(roads),
      markings: freezeList(markings),
    }),
    bridges: Object.freeze({
      bridges: freezeList(layout.bridges.bridges.filter(item => selectedBridgeIds.has(item.id))),
      details: freezeList(bridgeDetails),
    }),
    harbour: Object.freeze({
      pieces: freezeList(harbourPieces),
      cranes: freezeList(harbourCranes),
      lamps: layout.harbour.lamps,
    }),
    airfield: Object.freeze({
      landmarks: freezeList(airfieldLandmarks),
    }),
    trafficHints: freezeList(layout.trafficHints.slice(0, budget.trafficHintCount)),
    clouds: Object.freeze({
      near: freezeList([...layout.clouds.near].sort((a, b) => a.rank - b.rank).slice(0, budget.nearCloudClusters)),
      far: freezeList([...layout.clouds.far].sort((a, b) => a.rank - b.rank).slice(0, budget.farCloudClusters)),
    }),
    collisionDescriptors: freezeList(collisionDescriptors),
  });
}

export function layoutObjectCount(layout) {
  const city = layout.city || {};
  const roads = layout.roads || {};
  const bridges = layout.bridges || {};
  const harbour = layout.harbour || {};
  const airfield = layout.airfield || {};
  const clouds = layout.clouds || {};
  return (
    (city.litWindows?.length || city.windows?.length || 0) +
    (city.unlitWindows?.length || 0) +
    (city.rooftops?.length || 0) +
    (city.residentialInfill?.length || 0) +
    (city.industrialInfill?.length || 0) +
    (roads.segments?.length || 0) +
    (roads.markings?.length || 0) +
    (bridges.details?.length || 0) +
    (harbour.pieces?.length || 0) +
    (harbour.cranes?.length || 0) +
    (harbour.lamps?.length || 0) +
    (airfield.landmarks?.length || 0) +
    (layout.trafficHints?.length || 0) +
    (clouds.near?.length || 0) +
    (clouds.far?.length || 0)
  );
}

export function roadNetworkRepetitionScore(layout) {
  const headings = new Set(
    (layout.roads?.segments || []).map(item => Math.round((item.rotationY || 0) * 10) / 10),
  );
  const corridors = new Set((layout.roads?.segments || []).map(item => item.corridor));
  return Object.freeze({
    distinctHeadings: headings.size,
    corridors: corridors.size,
    obviousSingleGrid: headings.size <= 2 && corridors.size <= 2,
  });
}

export function nearestAuthoredRiverDistance(layout, x, z) {
  return polylineDistance(layout.reference.river.points, x, z);
}

export function nearestBridgeDistance(layout, x, z) {
  let distance = Infinity;
  for (const bridge of layout.reference.bridges) {
    distance = Math.min(distance, pointSegmentDistance(x, z, [bridge.x, 0, bridge.z], [bridge.x, 0, bridge.z]));
  }
  return distance;
}
