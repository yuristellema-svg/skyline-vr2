import { distanceToRunway } from '../airfields/airfieldGeometry.js';
import { guidanceStatus } from '../navigation/approachGuidance.js';
import { AirfieldNavigationVisuals } from '../navigation/navigationVisuals.js';

export { distanceToRunway } from '../airfields/airfieldGeometry.js';

function dispatch(type, detail) {
  const target = globalThis.window;
  const EventCtor = globalThis.CustomEvent;
  if (!target?.dispatchEvent || typeof EventCtor !== 'function') return;
  target.dispatchEvent(new EventCtor(type, { detail }));
}

export class RunwayGuidanceSystem {
  constructor(scene, landingSystem) {
    this.scene = scene;
    this.landingSystem = landingSystem;
    this.zones = landingSystem.zones;
    this.selectedFieldId = '';
    this.status = {
      id: '',
      name: '',
      distance: Infinity,
      approach: false,
      selected: false,
    };
    this.previousFieldId = '';
    this.visuals = new AirfieldNavigationVisuals(scene, this.zones);
    this.root = this.visuals.root;
    this._onSelect = event => {
      this.selectField(event?.detail?.fieldId ?? event?.detail?.id ?? event?.detail ?? '');
    };
    this._onCycle = event => {
      this.cycleField(Number(event?.detail?.direction) || 1);
    };
    globalThis.window?.addEventListener?.('skyline:airfield-select', this._onSelect);
    globalThis.window?.addEventListener?.('skyline:airfield-cycle', this._onCycle);
  }

  selectField(fieldId = '') {
    const id = String(fieldId || '');
    if (!id) {
      this.selectedFieldId = '';
      return true;
    }
    if (!this.zones.some(field => field.id === id)) return false;
    this.selectedFieldId = id;
    return true;
  }

  cycleField(direction = 1) {
    const ids = this.zones.map(field => field.id);
    if (ids.length === 0) return '';
    const current = ids.indexOf(this.selectedFieldId || this.status.id);
    const step = direction >= 0 ? 1 : -1;
    const next = current < 0
      ? (step > 0 ? 0 : ids.length - 1)
      : (current + step + ids.length) % ids.length;
    this.selectedFieldId = ids[next];
    return this.selectedFieldId;
  }

  update(flight) {
    if (!flight?.position) return;
    const status = guidanceStatus(this.zones, flight, this.selectedFieldId);
    this.status = status;
    flight.runwayName = status.name;
    flight.runwayDistance = status.distance;
    flight.runwayApproach = status.approach;
    flight.runwayDeparture = status.departure || false;
    flight.runwayId = status.id;
    flight.runwayDesignator = status.runwayDesignator || '';
    flight.runwayLateralError = status.lateralError ?? 0;
    flight.runwayAltitudeError = status.altitudeError ?? 0;
    flight.runwayHeadingError = status.headingErrorDegrees ?? 0;
    flight.runwayCue = status.cue || null;
    flight.runwayPapi = status.papi || '';
    flight.runwayRadio = status.radio || null;
    flight.runwayOperationReasons = status.operationReasons || [];
    flight.runwayOperational = status.operational !== false;
    this.visuals.update(status, flight);

    if (status.id && status.id !== this.previousFieldId) {
      this.previousFieldId = status.id;
      dispatch('skyline:airfield-target-changed', {
        ...status,
        spawnHook: this.landingSystem.getFieldStart(status.id, status.directionSign),
      });
    }
  }

  getStatus() {
    return { ...this.status, cue: this.status.cue ? { ...this.status.cue } : null };
  }

  getRespawnHook(fieldId = this.status.id, directionSign = this.status.directionSign) {
    return this.landingSystem.getFieldStart(fieldId, directionSign);
  }

  getCatalog() {
    return this.landingSystem.catalog;
  }

  dispose() {
    globalThis.window?.removeEventListener?.('skyline:airfield-select', this._onSelect);
    globalThis.window?.removeEventListener?.('skyline:airfield-cycle', this._onCycle);
    this.visuals.dispose();
  }
}
