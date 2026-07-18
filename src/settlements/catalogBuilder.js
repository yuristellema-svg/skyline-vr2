import {
  CATEGORY_ORDER,
  DEFAULTS,
  QUALITY_BUDGETS,
  QUALITY_ORDER,
} from './constants.js';
import { buildParcelDescriptors } from './archetypes.js';
import { buildCollisionCatalog } from './collisionCatalog.js';
import { buildHarbourDescriptors } from './harbour.js';
import { buildLandmarkDescriptors } from './landmarks.js';
import { createRng, hashString, stableSort } from './math.js';
import { indexManifest, resolveSettlementManifest } from './manifest.js';
import { planSettlementParcels } from './planner.js';
import { buildSpatialCatalog } from './spatial.js';
import { buildRenderPlan } from './renderPlan.js';

function emptyCounts() {
  return Object.fromEntries(CATEGORY_ORDER.map(category => [category, 0]));
}

function addCount(counts, descriptor) {
  counts[descriptor.category] += 1;
}

function totalCounts(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function globalDescriptorOrder(descriptors) {
  return stableSort(descriptors, descriptor => [
    descriptor.essential ? '0' : '1',
    String(descriptor.qualityRank),
    String(9999 - descriptor.priority).padStart(4, '0'),
    descriptor.category,
    descriptor.settlementId,
    descriptor.locationId,
    descriptor.id,
  ].join(':'));
}

function applyQualityBudget(allDescriptors, quality) {
  const normalizedQuality = quality === 'phone' ? 'low' : quality;
  const cutoff = QUALITY_ORDER[normalizedQuality];
  const budget = QUALITY_BUDGETS[normalizedQuality];
  const counts = emptyCounts();
  const selected = [];
  let triangleEstimate = 0;
  for (const descriptor of globalDescriptorOrder(allDescriptors)) {
    if (descriptor.qualityRank > cutoff) continue;
    if (counts[descriptor.category] >= budget[descriptor.category]) continue;
    if (selected.length >= budget.maxInstances) break;
    if (triangleEstimate + descriptor.triangleEstimate > budget.maxEstimatedTriangles) continue;
    selected.push(descriptor);
    addCount(counts, descriptor);
    triangleEstimate += descriptor.triangleEstimate;
  }
  return Object.freeze({
    quality: normalizedQuality,
    descriptors: Object.freeze(selected),
    counts: Object.freeze(counts),
    total: selected.length,
    triangleEstimate,
    budget,
  });
}

function countBy(descriptors, keySelector) {
  const result = {};
  for (const descriptor of descriptors) {
    const key = keySelector(descriptor) ?? 'none';
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.freeze(result);
}

function countsBySettlement(descriptors) {
  const result = {};
  for (const descriptor of descriptors) {
    const entry = result[descriptor.settlementId] ??= { total: 0, ...emptyCounts() };
    entry.total += 1;
    entry[descriptor.category] += 1;
  }
  for (const value of Object.values(result)) Object.freeze(value);
  return Object.freeze(result);
}

function verifyEssentialCoverage(catalog, selection) {
  const selectedIds = new Set(selection.descriptors.map(descriptor => descriptor.settlementId));
  for (const settlement of catalog.manifest.settlements) {
    if (!selectedIds.has(settlement.id)) throw new Error(`${selection.quality} budget removed settlement ${settlement.id}`);
  }
  for (const landmark of catalog.manifest.landmarks) {
    if (!selectedIds.has(`landmark:${landmark.id}`)) throw new Error(`${selection.quality} budget removed landmark ${landmark.id}`);
  }
}

export function buildSettlementCatalog({
  manifest,
  sampleHeight,
  seed = DEFAULTS.seed,
  roadClearance = DEFAULTS.roadClearance,
  parcelPadding = DEFAULTS.parcelPadding,
  nightWindowFraction = DEFAULTS.nightWindowFraction,
  maxTerrainDelta = DEFAULTS.maxTerrainDelta,
  maxFoundationDepth = DEFAULTS.maxFoundationDepth,
} = {}) {
  if (typeof sampleHeight !== 'function') {
    throw new TypeError('buildSettlementCatalog requires external sampleHeight(x, z)');
  }
  const indexed = indexManifest(resolveSettlementManifest(manifest));
  const options = {
    roadClearance,
    parcelPadding,
    nightWindowFraction,
    maxTerrainDelta,
    maxFoundationDepth,
  };
  const allDescriptors = [];
  const parcelsBySettlement = {};

  for (const settlement of indexed.manifest.settlements) {
    const parcels = planSettlementParcels({ settlement, indexed, sampleHeight, seed, options });
    parcelsBySettlement[settlement.id] = parcels;
    const random = createRng(hashString(`${settlement.seed}:architecture`, seed));
    for (const parcel of parcels) allDescriptors.push(...buildParcelDescriptors(parcel, random));
    allDescriptors.push(...buildHarbourDescriptors({ settlement, indexed, sampleHeight, random }));
  }
  for (const landmark of indexed.manifest.landmarks) {
    allDescriptors.push(...buildLandmarkDescriptors(landmark, sampleHeight));
  }

  const allParcels = Object.freeze(Object.values(parcelsBySettlement).flat());
  const sortedDescriptors = Object.freeze(stableSort(allDescriptors, descriptor => descriptor.id));
  const spatial = buildSpatialCatalog(sortedDescriptors);
  const rawTiers = {
    high: applyQualityBudget(sortedDescriptors, 'high'),
    medium: applyQualityBudget(sortedDescriptors, 'medium'),
    low: applyQualityBudget(sortedDescriptors, 'low'),
  };
  const tiers = Object.freeze(Object.fromEntries(Object.entries(rawTiers).map(([quality, tier]) => {
    const renderPlan = buildRenderPlan(tier.descriptors, spatial, QUALITY_BUDGETS[quality]);
    return [quality, Object.freeze({ ...tier, renderPlan })];
  })));
  const catalog = {
    worldId: indexed.manifest.worldId,
    manifest: indexed.manifest,
    parcelsBySettlement: Object.freeze(parcelsBySettlement),
    allDescriptors: sortedDescriptors,
    allCounts: Object.freeze(sortedDescriptors.reduce((counts, descriptor) => {
      addCount(counts, descriptor);
      return counts;
    }, emptyCounts())),
    familyDescriptorCounts: countBy(sortedDescriptors.filter(item => item.meta?.family), item => item.meta.family),
    parcelFamilyCounts: countBy(allParcels, item => item.family),
    districtParcelCounts: countBy(allParcels, item => item.districtId),
    roleCounts: countBy(sortedDescriptors, item => item.role),
    districtCounts: countBy(sortedDescriptors.filter(item => item.districtId), item => item.districtId),
    collisionCatalog: buildCollisionCatalog(sortedDescriptors),
    spatial,
    tiers,
    countsBySettlement: Object.freeze({
      high: countsBySettlement(tiers.high.descriptors),
      medium: countsBySettlement(tiers.medium.descriptors),
      low: countsBySettlement(tiers.low.descriptors),
    }),
  };
  for (const tier of Object.values(tiers)) verifyEssentialCoverage(catalog, tier);
  return Object.freeze(catalog);
}

export function getQualitySelection(catalog, quality) {
  const key = quality === 'phone' ? 'low' : quality;
  const selection = catalog?.tiers?.[key];
  if (!selection) throw new TypeError(`Unsupported settlement quality ${quality}`);
  return selection;
}

export function summarizeCatalog(catalog) {
  return Object.freeze({
    worldId: catalog.worldId,
    settlements: catalog.manifest.settlements.length,
    landmarks: catalog.manifest.landmarks.length,
    parcels: Object.values(catalog.parcelsBySettlement).reduce((sum, parcels) => sum + parcels.length, 0),
    descriptors: catalog.allDescriptors.length,
    collisions: catalog.collisionCatalog.length,
    cells: catalog.spatial.cellCount,
    counts: catalog.allCounts,
    tiers: Object.fromEntries(Object.entries(catalog.tiers).map(([key, tier]) => [key, {
      total: totalCounts(tier.counts),
      counts: tier.counts,
      triangleEstimate: tier.triangleEstimate,
    }])),
  });
}
