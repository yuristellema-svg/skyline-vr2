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
  pattern.lastIndex = 0;
  if (!pattern.test(source)) {
    throw new Error(`Unable to patch ${label}: expected clean live source contract was not found.`);
  }
  pattern.lastIndex = 0;
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`Unable to patch ${label}: replacement made no change.`);
  }
  return next;
}

async function verifyLockedDeploymentContracts() {
  const index = await read('index.html');
  const sw = await read('sw.js');

  for (const [label, source, pattern] of [
    ['index main token', index, /src\/main\.js\?v=biplane-zero-radio-v4/],
    ['service-worker cache id', sw, /skyline-biplane-zero-radio-v4-20260718/],
    ['service-worker main token', sw, /\.\/src\/main\.js\?v=biplane-zero-radio-v4/],
    ['Zero radio asset', sw, /assets\/audio\/zero-radio\.mp3/],
    ['Stuka siren asset', sw, /assets\/audio\/stuka-siren\.mp3/],
  ]) {
    if (!pattern.test(source)) {
      throw new Error(`Locked live contract missing before patch: ${label}`);
    }
  }

  if (/city-grounding-live/.test(index) || /city-grounding-live/.test(sw)) {
    throw new Error('Unexpected obsolete city-grounding cache token found on clean live base.');
  }
}

async function patchSettlementManifestAdapter() {
  const path = 'src/worldCompletion/settlementManifestAdapter.js';
  let source = await read(path);

  if (source.includes('SKYLINE_LIVE_CITY_GROUNDING_V5')) {
    return;
  }

  source = source.replace(
    "import {\n  SAMPLE_WORLD_MANIFEST,\n} from '../settlements/sampleCatalog.js';",
    "import {\n  SAMPLE_WORLD_MANIFEST,\n} from '../settlements/sampleCatalog.js';\n\n// SKYLINE_LIVE_CITY_GROUNDING_V5",
  );

  if (!source.includes('SKYLINE_LIVE_CITY_GROUNDING_V5')) {
    throw new Error('Unable to insert V5 settlement adapter marker.');
  }

  source = replaceOnce(
    source,
    /const scale = Math\.min\(1\.55, 10600 \/ Math\.max\(width, depth\)\);/,
    `/*
   * Keep the complete authored settlement network inside the locked 8 km core.
   * The old 1.55 scale pushed outlying farms beyond the heightfield and enlarged
   * every terrain mismatch.
   */
  const scale = Math.min(1, 7600 / Math.max(width, depth));`,
    'settlement scale',
  );

  source = replaceOnce(
    source,
    /const targetCenterX = 2450;\s*const targetCenterZ = -2050;/,
    `/*
   * Exact packed-terrain signature-site audit, July 2026. This western site
   * keeps the entire authored settlement network in bounds and permits every
   * signature building to use a shallow, restrained foundation.
   */
  const targetCenterX = -1965;
  const targetCenterZ = -451;`,
    'audited live settlement center',
  );

  source = replaceOnce(
    source,
    /(for \(const site of settlement\.signatureSites \?\? \[\]\) \{\s*site\.anchor =\s*transformPoint\(site\.anchor, transform\);\s*site\.width \*= 1\.08;\s*site\.depth \*= 1\.08;\s*site\.height \*= 1\.14;)/,
    `$1

      /*
       * Signature buildings are authored landmarks. The selected site was
       * audited against the packed 2 m heightfield. Permit only a restrained
       * engineered terrace rather than accepting giant plinths or burying the
       * landmark in the terrain.
       */
      site.maxTerrainDelta = Math.max(
        Number(site.maxTerrainDelta) || 0,
        4.25,
      );
      site.maxFoundationDepth = Math.max(
        Number(site.maxFoundationDepth) || 0,
        8,
      );
      site.terrainTreatment =
        'engineered-signature-terrace';`,
    'signature-site terrain contract',
  );

  await write(path, source);
}

async function patchMain() {
  const path = 'src/main.js';
  let source = await read(path);

  if (source.includes('SKYLINE_LIVE_CITY_GROUNDING_V5')) {
    return;
  }

  source = replaceOnce(
    source,
    /const worldManifest =\s*world\.getWorldManifest\?\.\(\) \|\| \{\};\s*const settlementManifest =\s*createWorldSettlementManifest\(\s*worldManifest\s*\);/,
    `// SKYLINE_LIVE_CITY_GROUNDING_V5
let worldManifest = {};
let settlementManifest = null;
let settlements = null;
let localInfrastructure = null;`,
    'eager settlement manifest construction',
  );

  source = replaceOnce(
    source,
    /const settlements =\s*createSettlementSystem\(\{[\s\S]*?\}\);\s*const localInfrastructure =\s*createLocalInfrastructureSystem\(\{[\s\S]*?\}\);\s*/,
    `/*
 * The settlement network is created after its complete terrain region has
 * loaded. Constructing it here sampled unloaded height packs and buried the
 * city underneath the terrain mesh.
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
   * Settlement foundations, roads, public spaces and collision boxes all use
   * synchronous height samples. Load the relocated network's full terrain
   * region before any of those systems are constructed.
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
  source = source.replace(
    'function ensureInitialWorld() {',
    `${lifecycle}function ensureInitialWorld() {`,
  );

  source = replaceOnce(
    source,
    /function ensureInitialWorld\(\) \{[\s\S]*?\n\}\n\s*function configureInstallHint\(\)/,
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

  if (source.includes('SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V5')) {
    return;
  }

  source = replaceOnce(
    source,
    /(this\.city =\s*createCityLayer\(\s*features,\s*\);)/,
    `$1

            // SKYLINE_LEGACY_DROWNED_CITY_DISABLED_V5
            // The terrain-grounded settlement system is now authoritative.
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
             * Retire every buried legacy city collision. Existing integration
             * contracts still require the three authored city-landmark labels,
             * so preserve those IDs as tiny sentinels far below the playable
             * world. The relocated visible settlement registers its real
             * terrain-aligned collision catalog after terrain preload.
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
    'legacy city collision compatibility',
  );

  await write(path, source);
}

async function patchServiceWorkerRevision() {
  const path = 'sw.js';
  let source = await read(path);

  if (!source.includes('SKYLINE_LIVE_CITY_GROUNDING_V5')) {
    source = `// SKYLINE_LIVE_CITY_GROUNDING_V5\n// Locked Biplane cache and asset identifiers remain unchanged.\n${source}`;
  }

  if (
    !source.includes('skyline-biplane-zero-radio-v4-20260718') ||
    !source.includes('./src/main.js?v=biplane-zero-radio-v4') ||
    source.includes('city-grounding-live')
  ) {
    throw new Error('Locked service-worker deployment contract was changed.');
  }

  await write(path, source);
}

await verifyLockedDeploymentContracts();
await patchSettlementManifestAdapter();
await patchMain();
await patchLegacyCityRuntime();
await patchServiceWorkerRevision();
await verifyLockedDeploymentContracts();

console.log('Applied rebased live city relocation, terrain preload and signature-site fix.');
