import {
  compilePolyline,
  nearestPointOnPolyline,
  pointInBounds,
} from './math.js';

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function requirePositive(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new Error(`${label} must be positive`);
}

function requirePoint(point, label) {
  if (!Array.isArray(point) || point.length < 2) throw new Error(`${label} must be [x,z]`);
  requireFinite(point[0], `${label}[0]`);
  requireFinite(point[1], `${label}[1]`);
}

function uniqueById(items, label) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.id || typeof item.id !== 'string') throw new Error(`${label} entry missing id`);
    if (map.has(item.id)) throw new Error(`${label} contains duplicate id ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

function pointDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function validatePolyline(item, label, bounds) {
  if (!Array.isArray(item.points) || item.points.length < 2) throw new Error(`${label} needs at least two points`);
  item.points.forEach((point, index) => {
    requirePoint(point, `${label} point ${index}`);
    if (bounds && !pointInBounds(point[0], point[1], bounds)) throw new Error(`${label} leaves world bounds`);
  });
  const compiled = compilePolyline(item.points);
  if (compiled.totalLength <= 1) throw new Error(`${label} has no usable length`);
  return compiled;
}

function validateRoadGraph(manifest, roads) {
  const graph = new Map([...roads.keys()].map(id => [id, new Set()]));
  const endpointTolerance = 8;
  const roadValues = [...roads.values()];
  for (let aIndex = 0; aIndex < roadValues.length; aIndex += 1) {
    const a = roadValues[aIndex];
    const aEndpoints = [a.points[0], a.points[a.points.length - 1]];
    for (let bIndex = aIndex + 1; bIndex < roadValues.length; bIndex += 1) {
      const b = roadValues[bIndex];
      const bEndpoints = [b.points[0], b.points[b.points.length - 1]];
      if (aEndpoints.some(ap => bEndpoints.some(bp => pointDistance(ap, bp) <= endpointTolerance))) {
        graph.get(a.id).add(b.id);
        graph.get(b.id).add(a.id);
      }
    }
  }

  const junctions = uniqueById(manifest.roadJunctions, 'roadJunctions');
  for (const junction of junctions.values()) {
    requirePoint(junction.position, `road junction ${junction.id} position`);
    if (!Array.isArray(junction.roads) || junction.roads.length === 0) throw new Error(`Road junction ${junction.id} has no roads`);
    for (const roadId of junction.roads) {
      const road = roads.get(roadId);
      if (!road) throw new Error(`Road junction ${junction.id} references missing road ${roadId}`);
      const nearest = nearestPointOnPolyline(junction.position[0], junction.position[1], road.compiled);
      if (nearest.distance > 18) throw new Error(`Road junction ${junction.id} is ${nearest.distance.toFixed(1)}m from road ${roadId}`);
    }
    for (const roadId of junction.roads) {
      for (const otherId of junction.roads) {
        if (roadId !== otherId) graph.get(roadId).add(otherId);
      }
    }
  }

  const start = roadValues.find(road => road.points.some(point =>
    point[0] >= manifest.legacyCoreBounds.minX && point[0] <= manifest.legacyCoreBounds.maxX &&
    point[1] >= manifest.legacyCoreBounds.minZ && point[1] <= manifest.legacyCoreBounds.maxZ));
  if (!start) throw new Error('Road network has no legacy-core connection');
  const visited = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current)) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  if (visited.size !== roads.size) {
    const missing = [...roads.keys()].filter(id => !visited.has(id));
    throw new Error(`Road network is disconnected: ${missing.join(', ')}`);
  }
  return { graph, junctions };
}

export function validateWorldCoreManifest(manifest) {
  if (manifest?.format !== 'skyline-world-core-manifest') throw new Error('Unsupported world core manifest format');
  if (manifest.version !== 2) throw new Error('World core manifest version must be 2');
  const bounds = manifest.bounds;
  const core = manifest.legacyCoreBounds;
  for (const [label, value] of Object.entries(bounds || {})) requireFinite(value, `bounds.${label}`);
  for (const [label, value] of Object.entries(core || {})) requireFinite(value, `legacyCoreBounds.${label}`);
  if (!(bounds.minX < core.minX && bounds.minZ < core.minZ && bounds.maxX > core.maxX && bounds.maxZ > core.maxZ)) {
    throw new Error('Expansion bounds must surround the legacy core');
  }

  const roadDefinitions = uniqueById(manifest.roads, 'roads');
  const riverDefinitions = uniqueById(manifest.water?.rivers, 'rivers');
  const roads = new Map();
  const rivers = new Map();
  const settlements = uniqueById(manifest.settlements, 'settlements');
  const airfields = uniqueById(manifest.airfields, 'airfields');
  const landingCatalog = uniqueById(manifest.landingCatalog, 'landingCatalog');
  const regions = uniqueById(manifest.regions, 'regions');
  const bridges = uniqueById(manifest.bridges, 'bridges');
  const landmarks = uniqueById(manifest.landmarks, 'landmarks');

  for (const region of regions.values()) {
    requirePoint(region.center, `region ${region.id} center`);
    requirePoint(region.radius, `region ${region.id} radius`);
    requirePositive(region.radius[0], `region ${region.id} radius x`);
    requirePositive(region.radius[1], `region ${region.id} radius z`);
  }

  for (const road of roadDefinitions.values()) {
    const compiled = validatePolyline(road, `Road ${road.id}`, bounds);
    requirePositive(road.widthMeters, `road ${road.id} widthMeters`);
    if (!['primary', 'secondary', 'service'].includes(road.class)) throw new Error(`Road ${road.id} has unsupported class ${road.class}`);
    roads.set(road.id, { ...road, compiled });
  }

  for (const river of riverDefinitions.values()) {
    const compiled = validatePolyline(river, `River ${river.id}`, bounds);
    requirePositive(river.bedWidthMeters, `river ${river.id} bedWidthMeters`);
    requirePositive(river.bankWidthMeters, `river ${river.id} bankWidthMeters`);
    if (river.bankWidthMeters <= river.bedWidthMeters) throw new Error(`River ${river.id} bank width must exceed bed width`);
    rivers.set(river.id, { ...river, compiled });
  }

  for (const collectionName of ['ridges', 'valleys', 'escarpments']) {
    for (const form of manifest.terrainForms?.[collectionName] || []) {
      validatePolyline(form, `${collectionName} ${form.id}`, bounds);
      requirePositive(form.halfWidthMeters, `${collectionName} ${form.id} halfWidthMeters`);
    }
  }
  for (const collectionName of ['plateaus', 'basins']) {
    for (const form of manifest.terrainForms?.[collectionName] || []) {
      requirePoint(form.center, `${collectionName} ${form.id} center`);
      requirePoint(form.radius, `${collectionName} ${form.id} radius`);
    }
  }

  for (const bridge of bridges.values()) {
    const road = roads.get(bridge.roadId);
    const river = rivers.get(bridge.riverId);
    if (!road) throw new Error(`Bridge ${bridge.id} references missing road ${bridge.roadId}`);
    if (!river) throw new Error(`Bridge ${bridge.id} references missing river ${bridge.riverId}`);
    if (!Number.isInteger(bridge.segmentIndex) || bridge.segmentIndex < 0 || bridge.segmentIndex >= road.points.length - 1) {
      throw new Error(`Bridge ${bridge.id} has invalid road segment index`);
    }
    const a = road.points[bridge.segmentIndex];
    const b = road.points[bridge.segmentIndex + 1];
    const midpoint = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    const crossing = nearestPointOnPolyline(midpoint[0], midpoint[1], river.compiled);
    const crossingDistance = crossing.distance;
    if (crossingDistance > river.bankWidthMeters * 0.7) {
      throw new Error(`Bridge ${bridge.id} does not cross ${river.id}; midpoint is ${crossingDistance.toFixed(1)}m away`);
    }
    const roadDx = b[0] - a[0];
    const roadDz = b[1] - a[1];
    const riverSegment = river.compiled.segments[crossing.segmentIndex];
    const alignment = Math.abs((roadDx * riverSegment.dx + roadDz * riverSegment.dz) /
      Math.max(1e-6, pointDistance(a, b) * riverSegment.length));
    const crossingAngleDegrees = Math.acos(Math.min(1, alignment)) * 180 / Math.PI;
    if (crossingAngleDegrees < 35) {
      throw new Error(`Bridge ${bridge.id} follows ${river.id} instead of crossing it (${crossingAngleDegrees.toFixed(1)} degrees)`);
    }
    const span = pointDistance(a, b);
    if (span < 40 || span > 420) throw new Error(`Bridge ${bridge.id} span ${span.toFixed(1)}m is outside production bounds`);
  }

  for (const settlement of settlements.values()) {
    requirePoint(settlement.center, `settlement ${settlement.id} center`);
    requirePoint(settlement.radius, `settlement ${settlement.id} radius`);
    if (!roads.has(settlement.roadId)) throw new Error(`Settlement ${settlement.id} references missing road`);
    requirePositive(settlement.buildingCount, `settlement ${settlement.id} buildingCount`);
    if (!Number.isInteger(settlement.buildingCount)) throw new Error(`Settlement ${settlement.id} buildingCount must be an integer`);
  }

  for (const airfield of airfields.values()) {
    requirePoint(airfield.center, `airfield ${airfield.id} center`);
    if (!roads.has(airfield.roadId)) throw new Error(`Airfield ${airfield.id} references missing access road`);
    const landing = landingCatalog.get(airfield.landingCatalogId);
    if (!landing || landing.airfieldId !== airfield.id) throw new Error(`Airfield ${airfield.id} has no matching landing catalog entry`);
    if (landing.position?.[1] !== airfield.elevationMeters) throw new Error(`Airfield ${airfield.id} elevation differs from landing catalog`);
    if (landing.lengthMeters !== airfield.runwayLengthMeters || landing.widthMeters !== airfield.runwayWidthMeters) {
      throw new Error(`Airfield ${airfield.id} geometry differs from landing catalog`);
    }
    if (!airfield.site?.apron || !Array.isArray(airfield.site.hangarPads)) throw new Error(`Airfield ${airfield.id} lacks site reservation data`);
  }

  for (const landmark of landmarks.values()) {
    requirePoint(landmark.position, `landmark ${landmark.id} position`);
    if (!pointInBounds(landmark.position[0], landmark.position[1], bounds)) throw new Error(`Landmark ${landmark.id} leaves world bounds`);
  }

  validateRoadGraph(manifest, roads);
  const expectedSettlements = [...settlements.values()].reduce((sum, item) => sum + item.buildingCount, 0);
  if (expectedSettlements > manifest.budgets.maximumSettlementInstances) {
    throw new Error('Settlement instance count exceeds manifest budget');
  }
  requirePositive(manifest.streaming.chunkSizeMeters, 'streaming.chunkSizeMeters');
  requirePositive(manifest.streaming.loadRadiusMeters, 'streaming.loadRadiusMeters');
  if (manifest.streaming.unloadRadiusMeters <= manifest.streaming.loadRadiusMeters) throw new Error('Unload radius must exceed load radius');

  return manifest;
}

export function createWorldCoreIndex(manifest) {
  validateWorldCoreManifest(manifest);
  const roads = new Map(manifest.roads.map(road => [road.id, { ...road, compiled: compilePolyline(road.points) }]));
  const rivers = new Map(manifest.water.rivers.map(river => [river.id, { ...river, compiled: compilePolyline(river.points) }]));
  const roadNetwork = validateRoadGraph(manifest, roads);
  const bridgeSegments = new Map();
  for (const bridge of manifest.bridges) bridgeSegments.set(`${bridge.roadId}:${bridge.segmentIndex}`, bridge);
  return Object.freeze({
    manifest,
    roads,
    rivers,
    bridgeSegments,
    roadGraph: roadNetwork.graph,
    roadJunctions: roadNetwork.junctions,
    airfields: new Map(manifest.airfields.map(item => [item.id, item])),
    settlements: new Map(manifest.settlements.map(item => [item.id, item])),
    landmarks: new Map(manifest.landmarks.map(item => [item.id, item])),
    landingCatalog: Object.freeze(manifest.landingCatalog.map(item => Object.freeze({ ...item }))),
  });
}
