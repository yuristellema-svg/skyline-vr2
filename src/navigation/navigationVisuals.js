import * as THREE from '../../vendor/three.module.min.js';
import { fromRunwayLocal, thresholdForDirection } from '../airfields/airfieldGeometry.js';
import { runwaySurfaceHeight } from '../airfields/terrainFit.js';
const DEG = Math.PI / 180;
function material(color, opacity = 0.62) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }); }
function createApproachCue(field, sign, distance, cueMaterial) {
  const threshold = thresholdForDirection(field, sign), displaced = Number(field.operations.displacedThreshold?.[String(sign)]) || 0, thresholdAlong = threshold.along + sign * displaced, along = thresholdAlong - sign * distance;
  const center = fromRunwayLocal(field, { along, lateral: 0 }); const y = runwaySurfaceHeight(field, { along: thresholdAlong, lateral: 0 }) + Math.tan(field.approach.glideSlopeDegrees * DEG) * distance + 2.5;
  const group = new THREE.Group(); group.position.set(center.x, y, center.z); group.rotation.y = field.heading + (sign < 0 ? Math.PI : 0);
  const spread = Math.min(field.width * 1.6, field.width + distance * 0.055);
  for (const side of [-1, 1]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(10, 0.55, 1.3), cueMaterial); bar.position.x = side * spread / 2; group.add(bar); }
  group.add(new THREE.Mesh(new THREE.OctahedronGeometry(2.1, 0), cueMaterial)); group.userData.distance = distance; return group;
}
function createDepartureCue(field, sign, distance, cueMaterial) {
  const along = sign * (field.length / 2 + distance), center = fromRunwayLocal(field, { along, lateral: 0 }), y = runwaySurfaceHeight(field, { along: sign * field.length / 2, lateral: 0 }) + 18 + distance * 0.08;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(24, field.width * 0.42), 0.7, 6, 24), cueMaterial); ring.position.set(center.x, y, center.z); ring.rotation.y = field.heading + (sign < 0 ? Math.PI : 0); return ring;
}
function createLocator(field, cueMaterial) { const group = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(18, 0.8, 6, 28), cueMaterial); ring.rotation.x = Math.PI / 2; group.add(ring); const stem = new THREE.Mesh(new THREE.BoxGeometry(1, 32, 1), cueMaterial); stem.position.y = 16; group.add(stem); const center = fromRunwayLocal(field, { along: 0, lateral: 0 }); group.position.set(center.x, runwaySurfaceHeight(field, { along: 0, lateral: 0 }) + 12, center.z); return group; }
export class AirfieldNavigationVisuals {
  constructor(scene, fields) { this.scene = scene; this.fields = fields; this.root = new THREE.Group(); this.root.name = 'skyline-airfield-navigation-cues'; this.groups = new Map(); scene.add(this.root); this.build(); }
  build() {
    for (const field of this.fields) {
      const fieldGroup = new THREE.Group(); fieldGroup.name = `navigation-cues-${field.id}`; fieldGroup.visible = false;
      const cue = material(field.kind === 'mountain' ? 0xffd16a : 0x78d5ff);
      const locator = createLocator(field, cue); locator.name = 'locator'; fieldGroup.add(locator);
      for (const sign of field.operations.landingDirections) { const approach = new THREE.Group(); approach.name = 'approach'; approach.userData.sign = sign; for (const distance of [260, 560, 920, 1320].filter(d => d < field.approach.corridorLength)) approach.add(createApproachCue(field, sign, distance, cue)); fieldGroup.add(approach); }
      for (const sign of field.operations.takeoffDirections) { const departure = new THREE.Group(); departure.name = 'departure'; departure.userData.sign = sign; for (const distance of [180, 420, 720].filter(d => d < field.approach.departureLength)) departure.add(createDepartureCue(field, sign, distance, cue)); fieldGroup.add(departure); }
      this.groups.set(field.id, fieldGroup); this.root.add(fieldGroup);
    }
  }
  update(status, flight) {
    for (const [id, group] of this.groups) {
      group.visible = id === status.id && !flight?.onGround && status.distance <= 5200; if (!group.visible) continue;
      for (const child of group.children) { if (child.name === 'locator') child.visible = !status.approach && !status.departure; else child.visible = child.name === status.cue?.phase && child.userData.sign === status.directionSign; }
      const pulse = 0.5 + 0.16 * Math.sin((globalThis.performance?.now?.() || Date.now()) * 0.003); group.traverse(object => { if (object.material?.opacity != null) object.material.opacity = pulse + (status.approach ? 0.14 : 0); });
    }
  }
  dispose() { this.scene.remove(this.root); this.root.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); }); }
}
