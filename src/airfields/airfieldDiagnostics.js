import * as THREE from '../../vendor/three.module.min.js';
import { fromRunwayLocal, thresholdForDirection } from './airfieldGeometry.js';
import { runwaySurfaceHeight } from './terrainFit.js';

function lineSegments(points, color) { const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(point.x, point.y, point.z))); return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72, depthTest: false, toneMapped: false })); }
function localPoint(field, along, lateral, lift = 1) { const world = fromRunwayLocal(field, { along, lateral }); return { x: world.x, y: runwaySurfaceHeight(field, { along, lateral }) + lift, z: world.z }; }
function rectangle(field, minAlong, maxAlong, halfWidth, lift = 1) { const a = localPoint(field, minAlong, -halfWidth, lift), b = localPoint(field, minAlong, halfWidth, lift), c = localPoint(field, maxAlong, halfWidth, lift), d = localPoint(field, maxAlong, -halfWidth, lift); return [a, b, b, c, c, d, d, a]; }
function runwayBounds(field) { return rectangle(field, -field.length / 2, field.length / 2, field.width / 2); }
function touchdownBounds(field, sign) { const threshold = thresholdForDirection(field, sign), displaced = Number(field.operations.displacedThreshold?.[String(sign)]) || 0, start = threshold.along + sign * displaced, end = start + sign * field.length * field.approach.touchdownZoneFraction; return rectangle(field, Math.min(start, end), Math.max(start, end), field.width * 0.38, 1.6); }
function approachCorridorBounds(field, sign) { const threshold = thresholdForDirection(field, sign), displaced = Number(field.operations.displacedThreshold?.[String(sign)]) || 0, start = threshold.along + sign * displaced, outerAlong = start - sign * field.approach.corridorLength, thresholdHalf = field.width * 0.7, outerHalf = field.width * field.approach.corridorWidthMultiplier * 0.5; const t1 = localPoint(field, start, -thresholdHalf, 2), t2 = localPoint(field, start, thresholdHalf, 2), o1 = localPoint(field, outerAlong, -outerHalf, 2), o2 = localPoint(field, outerAlong, outerHalf, 2); return [t1, t2, t1, o1, t2, o2, o1, o2]; }
function departureCorridorBounds(field, sign) { const startAlong = sign * field.length / 2, outerAlong = startAlong + sign * field.approach.departureLength, startHalf = field.width * 0.62, outerHalf = Math.min(field.width * 2.2, field.width * 0.62 + field.approach.departureLength * 0.12); const s1 = localPoint(field, startAlong, -startHalf, 4), s2 = localPoint(field, startAlong, startHalf, 4), o1 = localPoint(field, outerAlong, -outerHalf, 4), o2 = localPoint(field, outerAlong, outerHalf, 4); return [s1, s2, s1, o1, s2, o2, o1, o2]; }
function profileLine(field) { const points = []; for (let index = 0; index < field.terrainFit.stations.length - 1; index += 1) { const a = field.terrainFit.stations[index], b = field.terrainFit.stations[index + 1]; points.push(localPoint(field, a.along, 0, 2.5), localPoint(field, b.along, 0, 2.5)); } return points; }

export class AirfieldDiagnosticsVisual {
  constructor(scene, fields) { this.scene = scene; this.fields = fields; this.root = new THREE.Group(); this.root.name = 'skyline-airfield-diagnostics'; this.root.visible = false; scene.add(this.root);
    for (const field of fields) {
      this.root.add(lineSegments(runwayBounds(field), field.terrainFit.operational ? 0x4bff93 : 0xff4b4b));
      this.root.add(lineSegments(profileLine(field), 0xffffff));
      for (const sign of field.operations.landingDirections) { this.root.add(lineSegments(approachCorridorBounds(field, sign), 0x6acbff)); this.root.add(lineSegments(touchdownBounds(field, sign), 0x4bff93)); }
      for (const sign of field.operations.takeoffDirections) this.root.add(lineSegments(departureCorridorBounds(field, sign), 0xc394ff));
    }
  }
  setVisible(visible) { this.root.visible = Boolean(visible); return this.root.visible; }
  dispose() { this.scene.remove(this.root); this.root.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); }); }
}
