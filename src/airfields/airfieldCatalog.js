const DEG = Math.PI / 180;

export const AIRFIELD_SCHEMA_VERSION = 2;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const DEFAULTS = Object.freeze({
  surface: Object.freeze({
    type: 'paved', color: 0x3f4241, clearance: 0.28,
    rollingDragScale: 1, brakeScale: 1, lateralGrip: 1,
    maxLongitudinalGrade: 0.065, maxCrossGrade: 0.045,
    maxRoughness: 2.2, maxEarthwork: 6,
    profileStationMeters: 20, profileSmoothingPasses: 6,
  }),
  approach: Object.freeze({
    glideSlopeDegrees: 3.4, corridorLength: 1900,
    corridorWidthMultiplier: 4.5, departureLength: 1300,
    maxAltitude: 460, touchdownZoneFraction: 0.34,
    papiDistance: 210, obstacleSampleStep: 80,
  }),
  operations: Object.freeze({
    shoulder: 9, overrun: 45, startInset: 60,
    landingDirections: Object.freeze([-1, 1]),
    takeoffDirections: Object.freeze([-1, 1]),
    displacedThreshold: Object.freeze({ '-1': 0, '1': 0 }),
    allowedAircraft: Object.freeze(['zero', 'stuka', 'scout', 'biplane', 'glider']),
    takeoffAircraft: Object.freeze(['zero', 'stuka', 'scout', 'biplane']),
  }),
  lighting: Object.freeze({
    enabled: true, approach: 'minimal', edgeSpacing: 110,
    desktopLightBudget: 72, mobileLightBudget: 30,
    papi: true, locator: true,
  }),
  navigation: Object.freeze({
    ident: 'SKY', frequency: '113.40', type: 'VOR-DME', range: 5200,
    beaconOffset: Object.freeze({ along: 0, lateral: 110 }),
    towerOffset: Object.freeze({ along: 0, lateral: -135 }),
  }),
});

export const DEFAULT_AIRFIELD_CATALOG = deepFreeze({
  schemaVersion: AIRFIELD_SCHEMA_VERSION,
  coordinateSystem: 'world-xz-metres-y-up-heading-clockwise-from-north',
  source: 'skyline-world-core-v2-authoritative-airfield-sites',
  fields: [
    {
      id: 'skyline-municipal', name: 'SKYLINE MUNICIPAL', shortName: 'MUNICIPAL', kind: 'primary',
      center: { x: -6200, z: 800 }, headingDegrees: 25, length: 1280, width: 48,
      surface: { type: 'paved', color: 0x3f4241, clearance: 0.42, rollingDragScale: 0.94, brakeScale: 1.1, lateralGrip: 1.12, maxLongitudinalGrade: 0.055, maxCrossGrade: 0.045, maxRoughness: 4.2, maxEarthwork: 8 },
      operations: { shoulder: 12, overrun: 70, startInset: 75, landingDirections: [1], takeoffDirections: [-1, 1], displacedThreshold: { '-1': 35, '1': 35 } },
      lighting: { enabled: true, approach: 'precision-short', edgeSpacing: 90, desktopLightBudget: 92, mobileLightBudget: 34, papi: true, locator: true },
      navigation: { ident: 'SKY', frequency: '113.40', type: 'VOR-DME', range: 6500, beaconOffset: { along: 80, lateral: 130 }, towerOffset: { along: -170, lateral: -155 } },
    },
    {
      id: 'crown-ridge', name: 'CROWN RIDGE STRIP', shortName: 'CROWN RIDGE', kind: 'mountain',
      center: { x: -500, z: 1000 }, headingDegrees: 90, length: 520, width: 58,
      surface: { type: 'grass', color: 0x64744a, clearance: 0.26, rollingDragScale: 1.34, brakeScale: 0.74, lateralGrip: 0.72, maxLongitudinalGrade: 0.10, maxCrossGrade: 0.08, maxRoughness: 3.4, maxEarthwork: 4.5, profileStationMeters: 16 },
      approach: { glideSlopeDegrees: 4.6, corridorLength: 1500, corridorWidthMultiplier: 5.1, departureLength: 950, maxAltitude: 520, touchdownZoneFraction: 0.27, papiDistance: 140 },
      operations: { shoulder: 7, overrun: 22, startInset: 42, landingDirections: [1], takeoffDirections: [-1], displacedThreshold: { '-1': 15, '1': 28 }, allowedAircraft: ['scout', 'biplane', 'glider'], takeoffAircraft: ['scout', 'biplane'] },
      lighting: { enabled: true, approach: 'threshold-only', edgeSpacing: 145, desktopLightBudget: 34, mobileLightBudget: 18, papi: true, locator: true },
      navigation: { ident: 'CRN', frequency: '385.0', type: 'NDB', range: 3600, beaconOffset: { along: 80, lateral: 90 }, towerOffset: { along: -105, lateral: -108 } },
    },
    {
      id: 'east-meadow-relief', name: 'EAST MEADOW RELIEF FIELD', shortName: 'EAST MEADOW', kind: 'emergency',
      center: { x: 4200, z: -5900 }, headingDegrees: -10, length: 1540, width: 55,
      surface: { type: 'gravel', color: 0x777267, clearance: 0.34, rollingDragScale: 1.48, brakeScale: 0.86, lateralGrip: 0.82, maxLongitudinalGrade: 0.075, maxCrossGrade: 0.055, maxRoughness: 2.8, maxEarthwork: 5.5, profileStationMeters: 18 },
      approach: { glideSlopeDegrees: 3.9, corridorLength: 1200, corridorWidthMultiplier: 5.8, departureLength: 760, maxAltitude: 380, touchdownZoneFraction: 0.30, papiDistance: 130 },
      operations: { shoulder: 8, overrun: 30, startInset: 46, landingDirections: [-1], takeoffDirections: [1], displacedThreshold: { '-1': 18, '1': 18 } },
      lighting: { enabled: true, approach: 'threshold-only', edgeSpacing: 155, desktopLightBudget: 28, mobileLightBudget: 14, papi: false, locator: true },
      navigation: { ident: 'EMR', frequency: '347.5', type: 'NDB', range: 3000, beaconOffset: { along: 35, lateral: 82 }, towerOffset: { along: -65, lateral: -92 } },
    },
  ],
});

function finite(value, label) { const number = Number(value); if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`); return number; }
function positive(value, label) { const number = finite(value, label); if (number <= 0) throw new RangeError(`${label} must be positive`); return number; }
function mergeSection(base, next) { return { ...base, ...(next || {}) }; }
function normalizeDirections(value, label) {
  const source = Array.isArray(value) ? value : [-1, 1];
  const result = [...new Set(source.map(item => Number(item) >= 0 ? 1 : -1))];
  if (!result.length) throw new RangeError(`${label} requires at least one direction`);
  return Object.freeze(result);
}

export function normalizeAirfieldDefinition(input) {
  if (!input || typeof input !== 'object') throw new TypeError('airfield must be an object');
  const id = String(input.id || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new TypeError(`invalid airfield id: ${id}`);
  const center = input.center || {};
  const surface = mergeSection(DEFAULTS.surface, input.surface);
  const approach = mergeSection(DEFAULTS.approach, input.approach);
  const operations = mergeSection(DEFAULTS.operations, input.operations);
  const lighting = mergeSection(DEFAULTS.lighting, input.lighting);
  const navigation = mergeSection(DEFAULTS.navigation, input.navigation);
  const normalized = {
    id, name: String(input.name || id).trim(), shortName: String(input.shortName || input.name || id).trim(), kind: String(input.kind || 'regional'),
    center: { x: finite(center.x, `${id}.center.x`), z: finite(center.z, `${id}.center.z`) },
    headingDegrees: finite(input.headingDegrees ?? 0, `${id}.headingDegrees`),
    heading: finite(input.headingDegrees ?? 0, `${id}.headingDegrees`) * DEG,
    length: positive(input.length, `${id}.length`), width: positive(input.width, `${id}.width`),
    surface, approach, lighting,
    operations: {
      ...operations,
      landingDirections: normalizeDirections(operations.landingDirections, `${id}.landingDirections`),
      takeoffDirections: normalizeDirections(operations.takeoffDirections, `${id}.takeoffDirections`),
      displacedThreshold: { ...DEFAULTS.operations.displacedThreshold, ...(operations.displacedThreshold || {}) },
      allowedAircraft: Object.freeze([...(operations.allowedAircraft || DEFAULTS.operations.allowedAircraft)]),
      takeoffAircraft: Object.freeze([...(operations.takeoffAircraft || DEFAULTS.operations.takeoffAircraft)]),
    },
    navigation: { ...navigation, beaconOffset: mergeSection(DEFAULTS.navigation.beaconOffset, navigation.beaconOffset), towerOffset: mergeSection(DEFAULTS.navigation.towerOffset, navigation.towerOffset) },
  };
  if (normalized.width >= normalized.length) throw new RangeError(`${id}.width must be smaller than length`);
  if (normalized.approach.touchdownZoneFraction <= 0 || normalized.approach.touchdownZoneFraction >= 0.6) throw new RangeError(`${id}.touchdownZoneFraction invalid`);
  return deepFreeze(normalized);
}

export function normalizeAirfieldCatalog(catalog = DEFAULT_AIRFIELD_CATALOG) {
  if (Number(catalog?.schemaVersion) !== AIRFIELD_SCHEMA_VERSION) throw new RangeError(`unsupported airfield schema version: ${catalog?.schemaVersion}`);
  const fields = (catalog.fields || []).map(normalizeAirfieldDefinition);
  if (!fields.length) throw new RangeError('airfield catalog must contain at least one field');
  const ids = new Set();
  for (const field of fields) { if (ids.has(field.id)) throw new RangeError(`duplicate airfield id: ${field.id}`); ids.add(field.id); }
  return deepFreeze({ schemaVersion: AIRFIELD_SCHEMA_VERSION, coordinateSystem: String(catalog.coordinateSystem || DEFAULT_AIRFIELD_CATALOG.coordinateSystem), source: String(catalog.source || 'runtime'), fields });
}
