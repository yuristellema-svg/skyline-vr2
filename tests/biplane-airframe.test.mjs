import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createBiplaneExternal,
} from '../src/aircraft/biplaneExternal.js';
import {
  createBiplaneCockpit,
} from '../src/aircraft/biplaneCockpit.js';
import {
  BIPLANE_MODEL,
  BIPLANE_VISUAL_BOUNDS,
  PT17_REFERENCE,
} from '../src/aircraft/biplaneSpecs.js';
import {
  BIPLANE_FLIGHT_PROFILE_PROPOSAL,
  BIPLANE_HANDLING_EXTENSIONS,
} from '../src/aircraft/biplaneProfile.js';

function collect(root) {
  const objects = [];
  root.traverse(object => objects.push(object));
  return objects;
}

function assertFiniteTransform(object) {
  for (const [label, vector] of [
    ['position', object.position],
    ['rotation', object.rotation],
    ['scale', object.scale],
  ]) {
    assert.ok(vector, `${object.name || object.type} has ${label}`);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(
        Number.isFinite(vector[axis]),
        `${object.name || object.type} ${label}.${axis} is finite`,
      );
    }
  }
  if (object.quaternion) {
    for (const axis of ['x', 'y', 'z', 'w']) {
      assert.ok(Number.isFinite(object.quaternion[axis]));
    }
  }
}

function assertFiniteGeometry(object) {
  const attribute = object.geometry?.attributes?.position;
  if (!attribute?.array) return;
  for (const value of attribute.array) {
    assert.ok(Number.isFinite(value), `${object.name} contains finite geometry`);
  }
}

test('external and dedicated cockpit factories construct unattached groups', () => {
  const external = createBiplaneExternal();
  const cockpit = createBiplaneCockpit();
  assert.notEqual(external, cockpit);
  assert.equal(external.parent, null);
  assert.equal(cockpit.parent, null);
  assert.equal(external.userData.aircraftId, 'biplane');
  assert.equal(cockpit.userData.aircraftId, 'biplane');
  assert.equal(external.userData.sharedRenderPoseCompatible, true);
  assert.equal(cockpit.userData.sharedRenderPoseCompatible, true);
  assert.equal(cockpit.userData.cameraAttached, false);
});

test('all generated transforms and explicit geometry coordinates are finite', () => {
  for (const root of [createBiplaneExternal(), createBiplaneCockpit()]) {
    for (const object of collect(root)) {
      assertFiniteTransform(object);
      assertFiniteGeometry(object);
    }
  }
});

test('fabric wing helper produces substantial non-empty procedural geometry', () => {
  const wings = collect(createBiplaneExternal()).filter(
    object => object.geometry?.userData?.proceduralType === 'fabric-wing' &&
      /-fabric-wing$/.test(object.name),
  );
  assert.equal(wings.length, 4);
  for (const wing of wings) {
    assert.ok(wing.geometry.attributes.position.count >= 400);
    const indexCount =
      wing.geometry.index?.count ??
      wing.geometry.index?.array?.length ??
      wing.geometry.index?.length ??
      0;

    assert.ok(indexCount > 1000);
  }
});

test('airframe uses real PT-17 proportions and an unequal staggered biplane layout', () => {
  assert.equal(BIPLANE_VISUAL_BOUNDS.length, 7.54);
  assert.equal(BIPLANE_VISUAL_BOUNDS.span, 9.81);
  assert.equal(BIPLANE_VISUAL_BOUNDS.height, 2.95);
  assert.ok(BIPLANE_MODEL.upperWing.outerSemiSpan > BIPLANE_MODEL.lowerWing.outerSemiSpan);

  const external = createBiplaneExternal();
  assert.ok(external.userData.wingLevels.separation >= 1.35);
  assert.ok(external.userData.wingLevels.stagger >= 0.50);
  assert.equal(external.userData.wingLevels.unequalSpan, true);
});

test('upper and lower wing levels exist with lower-wing-only ailerons', () => {
  const objects = collect(createBiplaneExternal());
  const levels = new Set(
    objects.map(object => object.userData?.wingLevel).filter(Boolean),
  );
  assert.ok(levels.has('upper'));
  assert.ok(levels.has('lower'));

  const ailerons = objects.filter(object => object.userData?.controlSurface === 'aileron');
  assert.ok(ailerons.length >= 4); // pivots and meshes
  assert.ok(ailerons.every(object => !/upper/i.test(object.name)));
  assert.ok(aileronMeshes(ailerons).every(object => object.userData.wingLevel === 'lower'));
});

function aileronMeshes(objects) {
  return objects.filter(object => object.geometry);
}

test('correct seven-cylinder Continental radial is modeled with pushrods and exhaust collector', () => {
  const external = createBiplaneExternal();
  const objects = collect(external);
  const cylinders = objects.filter(
    object => object.userData?.structuralRole === 'radial-cylinder',
  );
  assert.equal(PT17_REFERENCE.powerplant.cylinders, 7);
  assert.equal(external.userData.radialCylinderCount, 7);
  assert.equal(cylinders.length, 7);
  assert.ok(objects.some(object => /pushrod/.test(object.name)));
  assert.ok(objects.some(object => /exhaust-collector-ring/.test(object.name)));
});

test('N-struts, cabanes, bracing wires and tail bracing are present', () => {
  const objects = collect(createBiplaneExternal());
  const roles = objects.map(object => object.userData?.structuralRole).filter(Boolean);
  assert.ok(roles.filter(role => role === 'interplane-strut').length >= 6);
  assert.ok(roles.filter(role => role === 'cabane-strut').length >= 4);
  assert.ok(roles.filter(role => role === 'bracing-wire').length >= 8);
  assert.ok(roles.filter(role => role === 'tail-bracing-wire').length >= 4);
  assert.ok(objects.some(object => /diagonal-n-strut/.test(object.name)));
});

test('two open external cockpits have separate rims, seats and windscreens', () => {
  const external = createBiplaneExternal();
  const objects = collect(external);
  assert.ok(external.userData.cockpits.frontCockpit);
  assert.ok(external.userData.cockpits.rearCockpit);
  assert.notEqual(
    external.userData.cockpits.frontCockpit,
    external.userData.cockpits.rearCockpit,
  );
  assert.equal(objects.filter(object => /windscreen-glass/.test(object.name)).length, 2);
  assert.ok(objects.some(object => /front-student-seat-back/.test(object.name)));
  assert.ok(objects.some(object => /rear-instructor-seat-back/.test(object.name)));
});

test('fixed taildragger gear, two-blade wooden propeller, pitot and fuel cap exist', () => {
  const external = createBiplaneExternal();
  const objects = collect(external);
  const roles = objects.map(object => object.userData?.structuralRole).filter(Boolean);
  assert.ok(roles.filter(role => role === 'landing-gear-wheel').length >= 3);
  assert.ok(roles.filter(role => role === 'landing-gear-strut').length >= 5);
  assert.equal(external.userData.propeller.userData.bladeCount, 2);
  assert.equal(
    objects.filter(object => object.userData?.structuralRole === 'propeller-blade').length,
    2,
  );
  assert.ok(objects.some(object => /pitot-tube/.test(object.name)));
  assert.ok(objects.some(object => /fuel-filler-cap/.test(object.name)));
});

test('dedicated rear cockpit contains period controls and airframe relationships', () => {
  const cockpit = createBiplaneCockpit();
  const names = collect(cockpit).map(object => object.name);
  assert.match(cockpit.name, /pt17-biplane/);
  assert.ok(names.some(name => name.includes('cockpit-rim')));
  assert.ok(names.some(name => name.includes('windscreen')));
  assert.ok(names.some(name => name.includes('instrument-panel')));
  assert.ok(names.some(name => name.includes('control-stick')));
  assert.ok(names.some(name => name.includes('rudder-pedal')));
  assert.ok(names.some(name => name.includes('throttle-quadrant')));
  assert.ok(names.some(name => name.includes('structural-tube')));
  assert.ok(names.some(name => name.includes('visible-upper-wing')));
  assert.ok(names.some(name => name.includes('visible-front-cockpit')));
  assert.ok(names.some(name => name.includes('gosport-voice-tube')));
  assert.ok(cockpit.userData.instruments.length >= 7);
  assert.equal(cockpit.userData.cockpitReference.modernCanopy, false);
});

test('model remains inside a deliberate mobile-VR visual budget', () => {
  const external = createBiplaneExternal();
  const cockpit = createBiplaneCockpit();
  assert.ok(external.userData.visualStats.meshes < 280);
  assert.ok(external.userData.visualStats.lines < 80);
  assert.ok(external.userData.visualStats.vertices < 180000);
  assert.ok(cockpit.userData.visualStats.meshes < 190);
  assert.ok(cockpit.userData.visualStats.vertices < 100000);
});

test('factories create no private loop, camera attachment or synthetic aircraft shake', () => {
  const source = [
    'biplaneExternal.js',
    'biplaneCockpit.js',
    'biplaneRuntime.js',
  ].map(filename => fs.readFileSync(
    new URL(`../src/aircraft/${filename}`, import.meta.url),
    'utf8',
  )).join('\n');

  assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /setTimeout\s*\(/);
  assert.doesNotMatch(source, /camera\s*\.\s*add\s*\(/);
  assert.doesNotMatch(source, /synthetic(?:Aircraft|Cockpit)?Shake/i);
  assert.doesNotMatch(source, /(?:root|external|cockpit)\s*\.\s*position\s*\.\s*[xyz]\s*\+=/);
});

test('profile is slow, high-lift, high-drag and uses overspeed drag instead of a cap', () => {
  const profile = BIPLANE_FLIGHT_PROFILE_PROPOSAL;
  assert.equal(profile.id, 'biplane');
  assert.equal(profile.name, 'PT-17 BIPLANE');
  assert.ok(profile.maximumLevelSpeed <= 55);
  assert.ok(profile.takeoffSpeed <= 20);
  assert.ok(profile.liftScale >= 1.28);
  assert.ok(profile.dragScale >= 1.6);
  assert.ok(profile.stallSpeedScale <= 0.70);
  assert.ok(profile.overspeedDrag > 0);
  assert.equal('hardSpeedCap' in profile, false);
  assert.equal(BIPLANE_HANDLING_EXTENSIONS.handlingIntent.noHardSpeedCap, true);
  assert.equal(BIPLANE_HANDLING_EXTENSIONS.handlingIntent.slowerDiveBuildThanZero, true);
});
