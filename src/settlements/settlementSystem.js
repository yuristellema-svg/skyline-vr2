import { DEFAULTS, QUALITY_BUDGETS } from './constants.js';
import { buildSettlementCatalog, getQualitySelection } from './catalogBuilder.js';
import { registerCollisionCatalog } from './collisionCatalog.js';
import { SAMPLE_WORLD_MANIFEST } from './sampleCatalog.js';
import { SettlementRenderer } from './threeRenderer.js';

function normalizeQuality(value) {
  if (value === 'phone') return 'low';
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  throw new TypeError(`Unsupported settlement quality ${value}`);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function createSettlementSystem({
  scene,
  manifest,
  sampleHeight,
  collision = null,
  quality = DEFAULTS.quality,
  phoneMode = false,
  allowSampleCatalog = false,
  seed = DEFAULTS.seed,
  roadClearance = DEFAULTS.roadClearance,
  parcelPadding = DEFAULTS.parcelPadding,
  nightWindowFraction = DEFAULTS.nightWindowFraction,
  maxTerrainDelta = DEFAULTS.maxTerrainDelta,
  maxFoundationDepth = DEFAULTS.maxFoundationDepth,
} = {}) {
  const effectiveManifest = manifest ?? (allowSampleCatalog ? SAMPLE_WORLD_MANIFEST : null);
  if (!effectiveManifest) {
    throw new TypeError('createSettlementSystem requires an external manifest; allowSampleCatalog is isolated-test only');
  }
  const catalog = buildSettlementCatalog({
    manifest: effectiveManifest,
    sampleHeight,
    seed,
    roadClearance,
    parcelPadding,
    nightWindowFraction,
    maxTerrainDelta,
    maxFoundationDepth,
  });
  const renderer = new SettlementRenderer(scene);
  let disposed = false;
  let isPhone = Boolean(phoneMode);
  let desktopQuality = normalizeQuality(quality);
  let activeQuality = isPhone ? 'low' : desktopQuality;
  let elapsed = 0;
  let nightFactor = 0;
  let collisionsRegistered = 0;

  const rebuild = () => {
    if (disposed) return;
    const selection = getQualitySelection(catalog, activeQuality);
    const renderPlanByKey = Object.fromEntries(selection.renderPlan.groups.map(group => [group.key, group]));
    renderer.rebuild(selection.descriptors, catalog.spatial, { ...QUALITY_BUDGETS[activeQuality], renderPlanByKey });
    renderer.updateNight(nightFactor, 1);
  };

  rebuild();
  if (collision) collisionsRegistered = registerCollisionCatalog(catalog.collisionCatalog, collision);

  return Object.freeze({
    setPhoneMode(value) {
      if (disposed) return false;
      isPhone = Boolean(value);
      const next = isPhone ? 'low' : desktopQuality;
      if (next !== activeQuality) {
        activeQuality = next;
        rebuild();
      }
      return isPhone;
    },

    setQuality(value) {
      if (disposed) return activeQuality;
      desktopQuality = normalizeQuality(value);
      const next = isPhone ? 'low' : desktopQuality;
      if (next !== activeQuality) {
        activeQuality = next;
        rebuild();
      }
      return activeQuality;
    },

    fixedStepUpdate(dt) {
      if (disposed || !Number.isFinite(dt) || dt <= 0) return;
      elapsed += Math.min(dt, 0.1);
    },

    update(dt, context = {}) {
      if (disposed) return;
      if (Number.isFinite(context.nightFactor)) nightFactor = clamp01(context.nightFactor);
      if (Number.isFinite(context.worldTimeSeconds)) elapsed = Math.max(0, context.worldTimeSeconds);
      const pulse = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(elapsed * 4.1));
      renderer.updateVisibility(context.camera ?? context);
      renderer.updateNight(nightFactor, pulse);
    },

    getStatus() {
      const selection = getQualitySelection(catalog, activeQuality);
      return Object.freeze({
        enabled: !disposed,
        worldId: catalog.worldId,
        phoneMode: isPhone,
        quality: activeQuality,
        desktopQuality,
        counts: selection.counts,
        totalInstances: selection.total,
        triangleEstimate: selection.triangleEstimate,
        estimatedDrawCalls: selection.renderPlan.drawCalls,
        countsBySettlement: catalog.countsBySettlement[activeQuality],
        parcelFamilyCounts: catalog.parcelFamilyCounts,
        districtParcelCounts: catalog.districtParcelCounts,
        districtCounts: catalog.districtCounts,
        parcelCounts: Object.freeze(Object.fromEntries(
          Object.entries(catalog.parcelsBySettlement).map(([id, parcels]) => [id, parcels.length]),
        )),
        budget: QUALITY_BUDGETS[activeQuality],
        renderer: renderer.getStatus(),
        spatialCells: catalog.spatial.cellCount,
        collisionBoxes: catalog.collisionCatalog.length,
        collisionsRegistered,
        manifestInputs: Object.freeze({
          roads: catalog.manifest.roads.length,
          shorelines: catalog.manifest.shorelines.length,
          exclusions: catalog.manifest.exclusions.length,
          settlements: catalog.manifest.settlements.length,
          districts: catalog.manifest.settlements.reduce((sum, settlement) => sum + (settlement.districts?.length ?? 0), 0),
          landmarks: catalog.manifest.landmarks.length,
          externalTerrainSampler: true,
        }),
        privateAnimationLoops: 0,
        sceneWideMaterialScans: 0,
        wholeBuildingEmission: false,
        createsRoads: false,
        createsTerrain: false,
        createsWater: false,
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
    },
  });
}
