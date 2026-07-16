import * as THREE from '../../vendor/three.module.min.js';

import * as ZeroExternal from './zeroExternal.js';
import * as ZeroCockpit from './zeroCockpit.js';
import * as StukaExternal from './stukaExternal.js';
import * as StukaCockpit from './stukaCockpit.js';
import * as ScoutExternal from './scoutExternal.js';
import * as ScoutCockpit from './scoutCockpit.js';
import * as GliderExternal from './gliderExternal.js';
import * as ProfileAdapter from './profileAdapter.js';
import * as VisualAdapter from './visualAdapter.js';

function objectFromResult(result) {
  if (result?.isObject3D) return result;

  for (const key of [
    'root',
    'group',
    'model',
    'object',
    'external',
    'cockpit',
    'visual',
  ]) {
    if (result?.[key]?.isObject3D) {
      return result[key];
    }
  }

  return null;
}

function functionCandidates(
  namespaces,
  profileId,
  mode,
) {
  const words = [
    profileId.toLowerCase(),
    mode.toLowerCase(),
  ];

  const candidates = [];

  for (const namespace of namespaces) {
    for (const [name, value] of Object.entries(namespace || {})) {
      if (typeof value !== 'function') continue;

      const lower = name.toLowerCase();

      let score = 0;

      for (const word of words) {
        if (lower.includes(word)) score += 20;
      }

      if (lower.includes('create')) score += 8;
      if (lower.includes('build')) score += 6;
      if (lower.includes('visual')) score += 3;
      if (lower.includes('profile')) score += 2;
      if (name === 'default') score += 1;

      candidates.push({
        name,
        value,
        score,
      });
    }
  }

  return candidates.sort(
    (a, b) => b.score - a.score
  );
}

function tryBuilder(
  candidate,
  profileId,
  mode,
) {
  const fn = candidate.value;

  const context = {
    THREE,
    id: profileId,
    profileId,
    aircraftId: profileId,
    mode,
    kind: mode,
  };

  const isClass =
    /^class\s/.test(
      Function.prototype.toString.call(fn)
    );

  const attempts = isClass
    ? [
        () => new fn(context),
        () => new fn(THREE, context),
        () => new fn(profileId, context),
      ]
    : [
        () => fn(),
        () => fn(THREE),
        () => fn(context),
        () => fn(profileId, context),
        () => fn(THREE, context),
        () => fn(THREE, profileId, context),
      ];

  for (const attempt of attempts) {
    try {
      const object =
        objectFromResult(attempt());

      if (object) return object;
    } catch {
      // Try the next supported signature.
    }
  }

  return null;
}

function createResolvedBuilder(
  profileId,
  mode,
  namespaces,
  fallback,
) {
  return function buildWorkerVisual() {
    const candidates =
      functionCandidates(
        namespaces,
        profileId,
        mode,
      );

    for (const candidate of candidates) {
      const object =
        tryBuilder(
          candidate,
          profileId,
          mode,
        );

      if (object) {
        object.userData =
          object.userData || {};

        object.userData.skylineWorkerAirframe =
          true;

        object.userData.workerProfile =
          profileId;

        object.userData.workerMode =
          mode;

        return object;
      }
    }

    console.warn(
      `[Skyline AIRFRAME] Using stable fallback for ${profileId} ${mode}`
    );

    return fallback();
  };
}

const EXTERNAL_MODULES = Object.freeze({
  zero: [
    ZeroExternal,
    ProfileAdapter,
    VisualAdapter,
  ],

  stuka: [
    StukaExternal,
    ProfileAdapter,
    VisualAdapter,
  ],

  scout: [
    ScoutExternal,
    ProfileAdapter,
    VisualAdapter,
  ],

  glider: [
    GliderExternal,
    ProfileAdapter,
    VisualAdapter,
  ],
});

const COCKPIT_MODULES = Object.freeze({
  zero: [
    ZeroCockpit,
    ProfileAdapter,
    VisualAdapter,
  ],

  stuka: [
    StukaCockpit,
    ProfileAdapter,
    VisualAdapter,
  ],

  scout: [
    ScoutCockpit,
    ProfileAdapter,
    VisualAdapter,
  ],

  glider: [
    ProfileAdapter,
    VisualAdapter,
  ],
});

export function createWorkerExternalBuilder(
  profileId,
  fallback,
) {
  return createResolvedBuilder(
    profileId,
    'external',
    EXTERNAL_MODULES[profileId] || [],
    fallback,
  );
}

export function createWorkerCockpitBuilder(
  profileId,
  fallback,
) {
  return createResolvedBuilder(
    profileId,
    'cockpit',
    COCKPIT_MODULES[profileId] || [],
    fallback,
  );
}
