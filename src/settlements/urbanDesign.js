import { makeDescriptor } from './descriptor.js';
import { FAMILY_PROFILES } from './families.js';
import {
  nearestPolylineProjection,
  orientedCorners,
  pointInPolygon,
} from './math.js';
import { createFoundationPlan } from './terrain.js';

const SPACE_STYLE = Object.freeze({
  'civic-square': Object.freeze({ color: '#b7aa92', surface: 'plaza-stone', role: 'civic-square' }),
  'market-square': Object.freeze({ color: '#a58b70', surface: 'plaza-brick', role: 'market-square' }),
  park: Object.freeze({ color: '#64745f', surface: 'park-grass', role: 'urban-park' }),
  courtyard: Object.freeze({ color: '#8e8a7d', surface: 'courtyard-stone', role: 'courtyard' }),
  promenade: Object.freeze({ color: '#a8a49a', surface: 'promenade-stone', role: 'waterfront-promenade' }),
  'loading-yard': Object.freeze({ color: '#777873', surface: 'service-concrete', role: 'loading-yard' }),
  'rail-corridor': Object.freeze({ color: '#545957', surface: 'rail-ballast', role: 'rail-service-corridor' }),
  'town-green': Object.freeze({ color: '#718069', surface: 'park-grass', role: 'town-green' }),
  'waterfront-gap': Object.freeze({ color: '#000000', surface: 'none', role: 'waterfront-gap' }),
  'service-corridor': Object.freeze({ color: '#6e706c', surface: 'service-concrete', role: 'service-corridor' }),
});

function readHeight(sampleHeight, x, z) {
  const result = sampleHeight(x, z);
  const value = typeof result === 'number' ? result : result?.height;
  if (!Number.isFinite(value)) throw new TypeError(`sampleHeight returned invalid height at ${x}, ${z}`);
  return value;
}

function districtForSite(settlement, districtId) {
  const district = settlement.districts?.find(item => item.id === districtId);
  if (district) return district;
  return {
    id: districtId ?? `${settlement.id}:default`,
    kind: settlement.kind === 'town' ? 'market' : settlement.kind === 'village' ? 'residential' : 'mixed-use',
    materialKey: null,
  };
}

function nearestRoad(site, settlement, indexed) {
  const refs = site.roadRef ? [site.roadRef] : settlement.roadRefs;
  let best = null;
  for (const roadRef of refs) {
    const road = indexed.roads.get(roadRef);
    if (!road) continue;
    const projection = nearestPolylineProjection(site.anchor, road.points);
    if (!projection || (best && projection.distance >= best.distance)) continue;
    best = { ...projection, roadRef, roadWidth: road.width ?? 10 };
  }
  return best;
}

export function publicSpaceFootprints(settlement) {
  return Object.freeze((settlement.publicSpaces ?? []).map(space => Object.freeze({
    id: `${settlement.id}:space:${space.id}`,
    footprint: Object.freeze(orientedCorners(space.anchor[0], space.anchor[1], space.width, space.depth, space.yaw ?? 0).map(Object.freeze)),
    kind: space.kind,
  })));
}

export function signatureSiteFootprints(settlement) {
  return Object.freeze((settlement.signatureSites ?? []).map(site => Object.freeze({
    id: `${settlement.id}:signature:${site.id}`,
    footprint: Object.freeze(orientedCorners(site.anchor[0], site.anchor[1], site.width, site.depth, site.yaw ?? 0).map(Object.freeze)),
    kind: 'signature-site',
  })));
}

export function buildPublicSpaceDescriptors(settlement, sampleHeight) {
  const descriptors = [];
  for (const space of settlement.publicSpaces ?? []) {
    const style = SPACE_STYLE[space.kind] ?? SPACE_STYLE.courtyard;
    if (space.renderSurface === false || style.surface === 'none') continue;
    const yaw = space.yaw ?? 0;
    const corners = orientedCorners(space.anchor[0], space.anchor[1], space.width, space.depth, yaw);
    const heights = [
      readHeight(sampleHeight, space.anchor[0], space.anchor[1]),
      ...corners.map(point => readHeight(sampleHeight, point[0], point[1])),
    ];
    const topY = Math.max(...heights) + 0.12;
    descriptors.push(makeDescriptor({
      id: `${settlement.id}:space:${space.id}`,
      settlementId: settlement.id,
      locationId: `${settlement.id}:space:${space.id}`,
      districtId: space.districtId ?? null,
      category: 'publicSpaces',
      primitive: 'box',
      role: style.role,
      x: space.anchor[0],
      y: topY - 0.12,
      z: space.anchor[1],
      width: space.width,
      height: 0.24,
      depth: space.depth,
      yaw,
      color: space.color ?? style.color,
      surface: space.surface ?? style.surface,
      qualityRank: 0,
      priority: 120,
      visibilityBand: 'district',
      collidable: false,
      essential: true,
      meta: {
        kind: space.kind,
        terrainMin: Math.min(...heights),
        terrainMax: Math.max(...heights),
        negativeSpace: true,
      },
    }));
  }
  return descriptors;
}

export function createSignatureParcels({ settlement, indexed, sampleHeight, options }) {
  const parcels = [];
  for (const site of settlement.signatureSites ?? []) {
    const profile = FAMILY_PROFILES[site.family];
    if (!profile) continue;
    const district = districtForSite(settlement, site.districtId);
    const road = nearestRoad(site, settlement, indexed);
    if (!road) throw new Error(`${settlement.id}/${site.id} cannot resolve authoritative road relationship`);
    const yaw = site.alignToRoad === false ? (site.yaw ?? road.heading) : road.heading;
    const foundation = createFoundationPlan({
      sampleHeight,
      x: site.anchor[0],
      z: site.anchor[1],
      width: site.width,
      depth: site.depth,
      yaw,
      maxTerrainDelta: site.maxTerrainDelta ?? settlement.maxTerrainDelta ?? profile.slope ?? options.maxTerrainDelta,
      maxFoundationDepth: site.maxFoundationDepth ?? settlement.maxFoundationDepth ?? options.maxFoundationDepth,
    });
    if (!foundation.accepted) throw new Error(`${settlement.id}/${site.id} signature site rejected by terrain safety`);
    const footprint = orientedCorners(site.anchor[0], site.anchor[1], site.width, site.depth, yaw);
    if (!footprint.every(point => pointInPolygon(point, settlement.footprint))) {
      throw new Error(`${settlement.id}/${site.id} signature site lies outside settlement footprint`);
    }
    parcels.push(Object.freeze({
      id: `${settlement.id}:signature:${site.id}`,
      settlementId: settlement.id,
      districtId: site.districtId,
      districtKind: district.kind,
      materialKey: site.materialKey ?? district.materialKey ?? district.kind,
      family: site.family,
      x: site.anchor[0],
      z: site.anchor[1],
      yaw,
      width: site.width,
      depth: site.depth,
      height: site.height,
      roadRef: road.roadRef,
      roadHeading: road.heading,
      roadDistance: road.distance,
      roadWidth: road.roadWidth,
      foundation,
      footprint: Object.freeze(footprint.map(Object.freeze)),
      source: 'signature-site',
      sourceIndex: parcels.length,
      score: 100000 - parcels.length,
      signature: true,
      signatureId: site.id,
      variant: site.variant ?? site.family,
    }));
  }
  return Object.freeze(parcels);
}
