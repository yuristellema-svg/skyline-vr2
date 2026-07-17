export const BIPLANE_ID = 'biplane';
export const BIPLANE_DISPLAY_NAME = 'PT-17 BIPLANE';

// Model 75 / PT-17 reference dimensions. Skyline aircraft use metres as the
// visual unit, so keeping these proportions close to the real airframe makes
// the fifth aircraft read correctly next to the existing roster.
export const PT17_REFERENCE = Object.freeze({
  manufacturer: 'Boeing-Stearman',
  family: 'Model 75 Kaydet',
  variant: 'PT-17',
  crew: 2,
  role: 'primary trainer',
  construction: Object.freeze({
    fuselage: 'welded steel tube with metal forward skin and fabric aft covering',
    wings: 'wood spars and ribs with fabric covering',
    bracing: 'streamlined struts with steel tie-rod bracing',
    ailerons: 'lower wings only',
  }),
  powerplant: Object.freeze({
    name: 'Continental R-670-5',
    type: 'seven-cylinder air-cooled radial',
    cylinders: 7,
    horsepower: 220,
  }),
  dimensionsMeters: Object.freeze({
    length: 7.54,
    span: 9.81,
    height: 2.95,
  }),
  performanceReference: Object.freeze({
    cruiseMps: 43,
    maximumMps: 50,
  }),
});

export const BIPLANE_MODEL = Object.freeze({
  noseZ: -3.66,
  tailZ: 3.88,
  fuselageCenterY: 0.38,

  upperWing: Object.freeze({
    y: 1.58,
    centerZ: -0.52,
    centerSectionHalfSpan: 0.76,
    outerSemiSpan: 4.145,
    rootChord: 1.78,
    tipChord: 0.52,
    thickness: 0.105,
    ribCountPerSide: 12,
  }),

  lowerWing: Object.freeze({
    y: 0.18,
    centerZ: 0.02,
    rootX: 0.52,
    outerSemiSpan: 3.95,
    rootChord: 1.72,
    tipChord: 0.48,
    thickness: 0.095,
    ribCountPerSide: 11,
  }),

  wingStagger: 0.54,
  wingSeparation: 1.40,
  mainGearTrack: 2.28,
  mainWheelRadius: 0.43,
  propellerRadius: 1.30,
  rearCockpitZ: 0.38,
  frontCockpitZ: -0.86,
});

export const BIPLANE_VISUAL_BOUNDS = Object.freeze({
  length: PT17_REFERENCE.dimensionsMeters.length,
  span: PT17_REFERENCE.dimensionsMeters.span,
  height: PT17_REFERENCE.dimensionsMeters.height,
  recommendedThirdPersonDistance: 10.8,
});

export const BIPLANE_DETAIL_LEVELS = Object.freeze({
  performance: 0,
  standard: 1,
  high: 2,
});
