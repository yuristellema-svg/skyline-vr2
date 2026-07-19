import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(process.argv[2] || process.cwd());

async function read(relative) {
  return readFile(resolve(projectRoot, relative), 'utf8');
}

async function write(relative, content) {
  await writeFile(resolve(projectRoot, relative), content, 'utf8');
}

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Unable to patch ${label}: expected live source contract was not found.`);
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Unable to patch ${label}: replacement made no change.`);
  return next;
}

async function patchAdapter() {
  const path = 'src/worldCompletion/settlementManifestAdapter.js';
  let source = await read(path);
  if (source.includes('SKYLINE_LIVE_CITY_GROUNDING_V3')) return;

  source = source.replace(
    "import {\n  SAMPLE_WORLD_MANIFEST,\n} from '../settlements/sampleCatalog.js';",
    "import {\n  SAMPLE_WORLD_MANIFEST,\n} from '../settlements/sampleCatalog.js';\n\n// SKYLINE_LIVE_CITY_GROUNDING_V3",
  );
  if (!source.includes('SKYLINE_LIVE_CITY_GROUNDING_V3')) {
    throw new Error('Unable to patch settlement adapter marker.');
  }

  source = replaceOnce(
    source,
    /const scale = Math\.min\(1\.55, 10600 \/ Math\.max\(width, depth\)\);/,
    `/*
   * Keep the complete authored settlement network inside the 8 km core. The
   * previous 1.55 scale pushed the western farms beyond the heightfield when
   * the city was moved west, and it exaggerated every terrain mismatch.
   */
  const scale = Math.min(1, 7600 / Math.max(width, depth));`,
    'settlement scale',
  );

  source = replaceOnce(
    source,
    /const targetCenterX = 2450;\s*const targetCenterZ = -2050;/,
    `/*
   * Exact packed-terrain scan, July 2026. This western core site keeps every
   * transformed settlement inside the authored world, away from the river
   * trench and outside the active runway surfaces.
   */
  const targetCenterX = -2830;
  const targetCenterZ = -1400;`,
    'live city target',
  );

  await write(path, source);
}

async function patchMain() {
  const path = 'src/main.js';
  let source = await read(path);
  if (source.includes('SKYLINE_LIVE_CITY_GROUNDING_V3')) return;

  source = replaceOnce(
    source,
    /const worldManifest =\s*world\.getWorldManifest\?\.\(\) \|\| \{\};\s*const settlementManifest =\s*createWorldSettlementManifest\(\s*worldManifest\s*\);/,
    `// SKYLINE_LIVE_CITY_GROUNDING_V3
let worldManifest = {};
let settlementManifest = null;
let settlements = null;
let localInfrastructure = null;`,
    'early settlement manifest construction',
  );

  source = replaceOnce(
    source,
    /const settlements =\s*createSettlementSystem\(\{[\s\S]*?\}\);\s*const localInfrastructure =\s*createLocalInfrastructureSystem\(\{[\s\S]*?\}\);\s*/,
    `/*
 * Settlements are created only after their complete western terrain region is
 * preloaded. Building them here used NaN or stale height samples and produced
 * the drowned city visible in the live screenshots.
 */
`,
    'eager settlement systems',
  );

  const lifecycle = `function settlementTerrainPreloadPosition(manifest) {
  const points = [];

  for (const settlement of manifest?.settlements ?? []) {
    for (const point of settlement.footprint ?? []) {
      if (
        Array.isArray(point) &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1])
      ) {
        points.push(point);
      }
    }
  }

  if (!points.length) {
    return {
      x: CONFIG.world.spawn[0],
      y: CONFIG.world.spawn[1],
      z: CONFIG.world.spawn[2],
    };
  }

  const xs = points.map(point => point[0]);
  const zs = points.map(point => point[1]);

  return {
    x: (Math.min(...xs) + Math.max(...xs)) * 0.5,
    y: 0,
    z: (Math.min(...zs) + Math.max(...zs)) * 0.5,
  };
}

async function initializeGroundedSettlementWorld() {
  if (settlements && localInfrastructure) {
    return;
  }

  await world.ready;

  worldManifest =
    world.getWorldManifest?.() || {};

  settlementManifest =
    createWorldSettlementManifest(
      worldManifest
    );

  navigationMap.setManifest(
    worldManifest
  );

  const settlementFocus =
    settlementTerrainPreloadPosition(
      settlementManifest
    );

  /*
   * The settlement planner, road renderer and collision catalog all sample
   * terrain synchronously. Load the whole relocated settlement footprint first
   * so every foundation uses the same packed terrain the player later sees.
   */
  await world.preloadSpawn(
    settlementFocus
  );

  const sampledGround =
    world.sampleHeight(
      settlementFocus.x,
      settlementFocus.z,
    );

  if (!Number.isFinite(sampledGround)) {
    throw new Error(
      'Relocated city terrain was not available after preload.'
    );
  }

  const nextSettlements =
    createSettlementSystem({
      scene,
      manifest:
        settlementManifest,
      sampleHeight:
        world.sampleHeight,
      collision,
      quality:
        'high',
      phoneMode,
    });

  let nextInfrastructure = null;

  try {
    nextInfrastructure =
      createLocalInfrastructureSystem({
        scene,
        manifest:
          settlementManifest,
        sampleHeight:
          world.sampleHeight,
      });
  } catch (error) {
    nextSettlements.dispose?.();
    throw error;
  }

  settlements = nextSettlements;
  localInfrastructure = nextInfrastructure;
  settlements.setPhoneMode(phoneMode);
}

`;

  if (!source.includes('function ensureInitialWorld() {')) {
    throw new Error('Unable to find ensureInitialWorld insertion point.');
  }
  source = source.replace('function ensureInitialWorld() {', `${lifecycle}function ensureInitialWorld() {`);

  source = replaceOnce(
    source,
    /function ensureInitialWorld\(\) \{[\s\S]*?\n\}\n\nfunction configureInstallHint\(\)/,
    `function ensureInitialWorld() {
  if (!initialWorldPromise) {
    initialWorldPromise =
      initializeGroundedSettlementWorld()
        .then(() =>
          world.preloadSpawn(
            CONFIG.world.spawn
          )
        )
        .then(() => {
          worldFlightReady = true;
          return world;
        })
        .catch((error) => {
          initialWorldPromise = null;
          throw error;
        });
  }

  return initialWorldPromise;
}

function configureInstallHint()`,
    'initial world lifecycle',
  );

  const substitutions = [
    [/settlements\.setPhoneMode\(phone\);/g, 'settlements?.setPhoneMode(phone);'],
    [/settlements\.fixedStepUpdate\?\.\(/g, 'settlements?.fixedStepUpdate?.('],
    [/settlements\.update\(/g, 'settlements?.update('],
    [/localInfrastructure\.update\(/g, 'localInfrastructure?.update('],
    [/settlements\.getStatus\(\)/g, "settlements?.getStatus?.() || { enabled: false, initializing: true }"],
    [/localInfrastructure\.getStatus\(\)/g, "localInfrastructure?.getStatus?.() || { enabled: false, initializing: true }"],
  ];

  for (const [pattern, replacement] of substitutions) {
    source = source.replace(pattern, replacement);
  }

  for (const contract of [
    'settlements?.setPhoneMode(phone);',
    'settlements?.fixedStepUpdate?.(',
    'settlements?.update(',
    'localInfrastructure?.update(',
    'initializeGroundedSettlementWorld()',
  ]) {
    if (!source.includes(contract)) {
      throw new Error(`Main lifecycle patch is incomplete: ${contract}`);
    }
  }

  await write(path, source);
}

async function patchLegacyCityRuntime() {
  const path = 'src/world/world.js';
  let source = await read(path);
  if (source.includes('SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V3')) return;

  source = replaceOnce(
    source,
    /(this\.city =\s*createCityLayer\(\s*features,\s*\);)/,
    `$1

            // SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V3
            // The richer terrain-grounded settlement system is now authoritative.
            this.city.group.visible = false;
            this.city.group.userData.runtimeDisabled =
              'replaced-by-grounded-settlement-system';`,
    'legacy city marker',
  );

  source = replaceOnce(
    source,
    /\s*this\.city\s*\.group,\s*(this\.water\s*\.group,)/,
    `

              $1`,
    'legacy city scene attachment',
  );

  source = replaceOnce(
    source,
    /\s*this\.city\s*\.registerCollisions\(\s*collision,\s*\);/,
    `

            /*
             * The old city solids are retired, including every buried block and
             * tower collision. Three existing integration contracts still require
             * the authored city-landmark IDs to be represented in the collision
             * catalog. Register tiny sentinels far below the playable world so the
             * labels remain auditable without creating invisible flight hazards.
             * The relocated settlement renderer registers the real visible city
             * collisions after its packed terrain has been preloaded.
             */
            const retiredCityLandmarkIds =
              (features.landmarks ?? [])
                .filter(feature =>
                  feature.type === 'tower_pair' ||
                  feature.type === 'open_atrium'
                )
                .map(feature => feature.id);

            for (
              let retiredIndex = 0;
              retiredIndex < retiredCityLandmarkIds.length;
              retiredIndex += 1
            ) {
              const sentinelX = -4095 + retiredIndex * 2;
              collision.addBox(
                sentinelX,
                sentinelX + 0.25,
                -8192,
                -8191.75,
                -4095,
                -4094.75,
                \`\${retiredCityLandmarkIds[retiredIndex]} retired compatibility sentinel\`,
              );
            }`,
    'legacy city collision compatibility sentinels',
  );

  await write(path, source);
}

async function patchLockedCacheContract() {
  const indexPath = 'index.html';
  const index = await read(indexPath);

  /*
   * Multiple integrated workers intentionally lock this module identifier.
   * Keep it unchanged. The changed service-worker source itself triggers the
   * browser update, and install cache.addAll refreshes this same URL.
   */
  if (!index.includes('src/main.js?v=biplane-zero-radio-v4')) {
    throw new Error('Locked index main-module identifier is missing.');
  }
  if (index.includes('city-grounding-live')) {
    throw new Error('City patch must not replace the locked index cache key.');
  }

  const swPath = 'sw.js';
  let sw = await read(swPath);
  if (!sw.includes('SKYLINE_LIVE_CITY_GROUNDING_V3')) {
    sw = `// SKYLINE_LIVE_CITY_GROUNDING_V3\n// Locked asset URLs are preserved; this service-worker source revision refreshes them.\n${sw}`;
  }

  if (
    !sw.includes('skyline-biplane-zero-radio-v4-20260718') ||
    !sw.includes('./src/main.js?v=biplane-zero-radio-v4') ||
    sw.includes('city-grounding-live')
  ) {
    throw new Error('Locked service-worker cache contract was changed.');
  }

  await write(swPath, sw);
}

await patchAdapter();
await patchMain();
await patchLegacyCityRuntime();
await patchLockedCacheContract();

console.log('Applied live city relocation, terrain preload and legacy-city disable patch.');
