import { MATERIAL_ROLES } from './constants.js';

const spec = (role, values) => Object.freeze({ role, ...values });

export const MATERIAL_SPECS = Object.freeze({
  downtownFacade: spec(MATERIAL_ROLES.facade, {
    color: 0x68747c,
    roughness: 0.78,
    metalness: 0.08,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  residentialFacade: spec(MATERIAL_ROLES.facade, {
    color: 0x8a8074,
    roughness: 0.90,
    metalness: 0.01,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  industrialFacade: spec(MATERIAL_ROLES.facade, {
    color: 0x626c6c,
    roughness: 0.86,
    metalness: 0.12,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  roof: spec(MATERIAL_ROLES.roof, {
    color: 0x3f474b,
    roughness: 0.86,
    metalness: 0.08,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  windowOff: spec(MATERIAL_ROLES.actualWindow, {
    color: 0x202a31,
    roughness: 0.36,
    metalness: 0.18,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  windowLit: spec(MATERIAL_ROLES.actualWindow, {
    color: 0x554c3f,
    roughness: 0.42,
    metalness: 0.08,
    emissive: 0xffb56a,
    emissiveIntensity: 0,
  }),
  road: spec(MATERIAL_ROLES.road, {
    color: 0x35393a,
    roughness: 0.98,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  roadMarking: spec(MATERIAL_ROLES.roadMarking, {
    color: 0xc9c3a9,
    roughness: 0.92,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  concrete: spec(MATERIAL_ROLES.concrete, {
    color: 0x8b8f8b,
    roughness: 0.94,
    metalness: 0.01,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  masonry: spec(MATERIAL_ROLES.masonry, {
    color: 0x827469,
    roughness: 0.96,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  steel: spec(MATERIAL_ROLES.steel, {
    color: 0x4c5960,
    roughness: 0.66,
    metalness: 0.34,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  harbour: spec(MATERIAL_ROLES.harbour, {
    color: 0x596364,
    roughness: 0.92,
    metalness: 0.10,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  signalHousing: spec(MATERIAL_ROLES.signalHousing, {
    color: 0x242827,
    roughness: 0.80,
    metalness: 0.16,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  signalLamp: spec(MATERIAL_ROLES.signalLamp, {
    color: 0x6c241c,
    roughness: 0.52,
    metalness: 0.02,
    emissive: 0xd43d2f,
    emissiveIntensity: 0.08,
  }),
  navigationLamp: spec(MATERIAL_ROLES.navigationLamp, {
    color: 0x6d1d18,
    roughness: 0.44,
    metalness: 0.02,
    emissive: 0xd84a3e,
    emissiveIntensity: 0,
  }),
  cloudNear: spec(MATERIAL_ROLES.cloud, {
    color: 0xd7dde0,
    roughness: 1,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }),
  cloudFar: spec(MATERIAL_ROLES.cloud, {
    color: 0xbfc9ce,
    roughness: 1,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  }),
  windsock: spec(MATERIAL_ROLES.windsock, {
    color: 0xb74438,
    roughness: 0.78,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
  vegetation: spec(MATERIAL_ROLES.vegetation, {
    color: 0x54614f,
    roughness: 1,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
  }),
});

const EMISSIVE_ROLES = new Set([
  MATERIAL_ROLES.actualWindow,
  MATERIAL_ROLES.signalLamp,
  MATERIAL_ROLES.navigationLamp,
]);

export function canMaterialEmit(materialOrSpec) {
  const role = materialOrSpec?.role || materialOrSpec?.userData?.skylineSurface;
  return EMISSIVE_ROLES.has(role);
}

export function validateMaterialPolicy(specs = MATERIAL_SPECS) {
  const violations = [];
  let transparentMaterials = 0;
  for (const [name, entry] of Object.entries(specs)) {
    if (entry.transparent) transparentMaterials += 1;
    const emissive = Number(entry.emissive) || 0;
    const intensity = Number(entry.emissiveIntensity) || 0;
    if ((emissive !== 0 || intensity > 0) && !canMaterialEmit(entry)) {
      violations.push(`${name}: non-window surface can emit`);
    }
    if (
      [MATERIAL_ROLES.facade, MATERIAL_ROLES.roof].includes(entry.role) &&
      (emissive !== 0 || intensity !== 0)
    ) {
      violations.push(`${name}: whole-building emission`);
    }
  }
  if (transparentMaterials > 2) {
    violations.push(`transparent material count ${transparentMaterials} exceeds 2`);
  }
  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
    transparentMaterials,
    windowOnlyEmission: violations.every(value => !value.includes('emit')),
  });
}
