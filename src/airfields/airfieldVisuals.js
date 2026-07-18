import * as THREE from '../../vendor/three.module.min.js';
import { fromRunwayLocal } from './airfieldGeometry.js';
import { runwayEarthworkSkirt, runwaySurfaceGrid, runwaySurfaceHeight } from './terrainFit.js';
import { buildLightingPlan } from './lightingPlan.js';

function geometryFromGrid(grid) {
  const positions = []; for (const vertex of grid.vertices) positions.push(vertex.x, vertex.y, vertex.z);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex([...grid.indices]); geometry.computeVertexNormals(); return geometry;
}
function pushVertex(positions, field, along, lateral, lift = 0) { const world = fromRunwayLocal(field, { along, lateral }); positions.push(world.x, runwaySurfaceHeight(field, { along, lateral }) + lift, world.z); }
function makeQuad(field, centerAlong, centerLateral, length, width, lift = 0.035) {
  const hl = length / 2, hw = width / 2, positions = [];
  pushVertex(positions, field, centerAlong - hl, centerLateral - hw, lift); pushVertex(positions, field, centerAlong + hl, centerLateral - hw, lift); pushVertex(positions, field, centerAlong + hl, centerLateral + hw, lift); pushVertex(positions, field, centerAlong - hl, centerLateral + hw, lift);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex([0, 2, 1, 0, 3, 2]); geometry.computeVertexNormals(); return geometry;
}
function placeLocal(object, field, along, lateral, lift = 0) { const world = fromRunwayLocal(field, { along, lateral }); object.position.set(world.x, runwaySurfaceHeight(field, { along, lateral }) + lift, world.z); }
function lightMesh(color, radius = 0.48) { return new THREE.Mesh(new THREE.SphereGeometry(radius, 7, 5), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.9 })); }
function makeWindsock(field) {
  const group = new THREE.Group(); group.name = `windsock-${field.id}`;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 9, 7), new THREE.MeshStandardMaterial({ color: 0x6f716d, roughness: 0.82 })); mast.position.y = 4.5;
  const arm = new THREE.Group(); arm.position.y = 8.5;
  for (let index = 0; index < 3; index += 1) { const section = new THREE.Mesh(new THREE.CylinderGeometry(0.18 + index * 0.09, 0.28 + index * 0.09, 1.7, 8, 1, true), new THREE.MeshBasicMaterial({ color: index % 2 ? 0xf0e8d5 : 0xd86d45, side: THREE.DoubleSide, toneMapped: false })); section.rotation.z = Math.PI / 2; section.position.x = 1 + index * 1.55; arm.add(section); }
  group.add(mast, arm); group.userData.windArm = arm; placeLocal(group, field, field.length * 0.08, field.width / 2 + 18); return group;
}
function makeTower(field) {
  const group = new THREE.Group(); group.name = `navigation-tower-${field.id}`; const offset = field.navigation.towerOffset;
  const material = new THREE.MeshStandardMaterial({ color: 0x4b4f4f, roughness: 0.78 });
  for (const x of [-1, 1]) for (const z of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 22, 0.32), material); leg.position.set(x * 1.35, 11, z * 1.35); leg.rotation.z = -x * 0.055; group.add(leg); }
  for (const y of [5, 10, 15, 20]) { const brace = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.18), material); brace.position.y = y; group.add(brace); const cross = brace.clone(); cross.rotation.y = Math.PI / 2; group.add(cross); }
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xf3d37a, transparent: true, opacity: 0.8, toneMapped: false }); const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), beaconMaterial); beacon.position.y = 23.2; group.add(beacon); group.userData.beaconMaterial = beaconMaterial; placeLocal(group, field, offset.along, offset.lateral); return group;
}
function makeRadioBeacon(field) {
  const group = new THREE.Group(); group.name = `radio-beacon-${field.id}`; const offset = field.navigation.beaconOffset;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x525852, roughness: 0.9 })); base.position.y = 1.2;
  const material = new THREE.MeshBasicMaterial({ color: field.navigation.type === 'VOR-DME' ? 0x78d5ff : 0xffd16a, transparent: true, opacity: 0.65, toneMapped: false }); const cap = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 7), material); cap.position.y = 3.2; group.add(base, cap); group.userData.beaconMaterial = material; placeLocal(group, field, offset.along, offset.lateral); return group;
}
function addPapi(group, field, sign) {
  if (!field.lighting.papi || !field.operations.landingDirections.includes(sign)) return;
  const along = -sign * (field.length / 2 - field.approach.papiDistance); const lateral = sign * (field.width / 2 + 7);
  for (let index = 0; index < 4; index += 1) { const light = lightMesh(index < 2 ? 0xffffff : 0xe34a3b, 0.43); placeLocal(light, field, along, lateral + index * 2.1, 0.55); light.userData.papi = true; group.add(light); }
}
function makeServiceCompound(field) {
  const group = new THREE.Group(); group.name = `airfield-service-${field.id}`;
  const count = field.kind === 'primary' ? 3 : 1; const material = new THREE.MeshStandardMaterial({ color: field.kind === 'primary' ? 0x8a887f : 0x6e715f, roughness: 0.92 });
  for (let i = 0; i < count; i += 1) { const width = field.kind === 'primary' ? 24 : 15, depth = field.kind === 'primary' ? 15 : 10, building = new THREE.Mesh(new THREE.BoxGeometry(width, 7 + i * 1.5, depth), material); building.position.set(i * (width + 5), 3.5 + i * 0.75, 0); group.add(building); }
  placeLocal(group, field, -field.length * 0.16, -(field.width / 2 + 34)); return group;
}

export class AirfieldVisualSystem {
  constructor(scene, fields, options = {}) {
    this.scene = scene; this.fields = fields; this.sampleHeight = options.sampleHeight; this.root = new THREE.Group(); this.root.name = 'skyline-catalog-airfields'; this.windArms = []; this.beaconMaterials = []; this.stats = []; scene.add(this.root); this.build();
  }
  build() {
    for (const field of this.fields) {
      const group = new THREE.Group(); group.name = `airfield-${field.id}`;
      const segments = field.kind === 'primary' ? 32 : 24;
      const surface = new THREE.Mesh(geometryFromGrid(runwaySurfaceGrid(field, segments)), new THREE.MeshStandardMaterial({ color: field.surface.color, roughness: field.surface.type === 'paved' ? 0.88 : 0.98, metalness: 0.01 })); surface.name = `runway-surface-${field.id}`; group.add(surface);
      if (this.sampleHeight) { const skirt = new THREE.Mesh(geometryFromGrid(runwayEarthworkSkirt(field, this.sampleHeight, segments)), new THREE.MeshStandardMaterial({ color: field.surface.type === 'paved' ? 0x4e4b43 : 0x536143, roughness: 1, side: THREE.DoubleSide })); skirt.name = `runway-earthwork-${field.id}`; group.add(skirt); }
      const marking = new THREE.MeshBasicMaterial({ color: field.surface.type === 'paved' ? 0xe7e1cf : 0xdfd3a3, toneMapped: false });
      const centerSpacing = field.kind === 'primary' ? 55 : 75;
      for (let along = -field.length * 0.38; along <= field.length * 0.38; along += centerSpacing) group.add(new THREE.Mesh(makeQuad(field, along, 0, field.kind === 'primary' ? 24 : 15, 1.7), marking));
      for (const sign of [-1, 1]) {
        const displaced = Number(field.operations.displacedThreshold?.[String(sign)]) || 0; const thresholdAlong = sign * (field.length / 2 - displaced);
        for (let i = -3; i <= 3; i += 1) group.add(new THREE.Mesh(makeQuad(field, thresholdAlong, i * field.width / 9, 4, field.width / 13), marking));
        if (field.kind === 'primary') for (const side of [-1, 1]) group.add(new THREE.Mesh(makeQuad(field, thresholdAlong - sign * 115, side * field.width * 0.19, 35, 5), marking));
        addPapi(group, field, sign);
      }
      const plan = buildLightingPlan(field, true);
      for (const light of plan.lights) { const mesh = lightMesh(light.color, light.kind === 'approach' ? 0.45 : 0.4); placeLocal(mesh, field, light.along, light.lateral, light.kind === 'approach' ? 0.45 : 0.34); group.add(mesh); }
      const windsock = makeWindsock(field); group.add(windsock); this.windArms.push(windsock.userData.windArm);
      const tower = makeTower(field); group.add(tower); this.beaconMaterials.push(tower.userData.beaconMaterial);
      const beacon = makeRadioBeacon(field); group.add(beacon); this.beaconMaterials.push(beacon.userData.beaconMaterial);
      group.add(makeServiceCompound(field));
      this.stats.push(Object.freeze({ id: field.id, surfaceSegments: segments, mobileLights: plan.count, mobileLightBudget: plan.budget, lightKinds: plan.byKind, operational: field.terrainFit.operational, earthwork: field.terrainFit.maxEarthwork })); this.root.add(group);
    }
  }
  update() { const now = (globalThis.performance?.now?.() || Date.now()) / 1000; for (let i = 0; i < this.windArms.length; i += 1) this.windArms[i].rotation.y = Math.sin(now * 0.16 + i * 1.7) * 0.42 + i * 0.8; for (let i = 0; i < this.beaconMaterials.length; i += 1) this.beaconMaterials[i].opacity = 0.46 + 0.38 * (0.5 + 0.5 * Math.sin(now * 2.1 + i)); }
  getStats() { return this.stats.map(entry => ({ ...entry })); }
  dispose() { this.scene.remove(this.root); this.root.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); }); }
}
