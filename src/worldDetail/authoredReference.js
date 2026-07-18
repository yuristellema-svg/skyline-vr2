import { DEFAULT_AIRFIELDS } from './constants.js';

const riverPoints = [
  [-4070, 62, 3490],
  [-3470, 59.29121421597351, 3200],
  [-2920, 56.5739025563284, 2820],
  [-2440, 53.95442162984539, 2390],
  [-1930, 51.393303984305675, 2020],
  [-1430, 48.49020437896772, 1510],
  [-920, 45.38126532813061, 940],
  [-410, 42.05486569237215, 300],
  [170, 38.66280467252222, -300],
  [820, 35.426024898947, -760],
  [1500, 31.65806145361152, -1390],
  [2230, 27.255912149225416, -2190],
  [3050, 22.246525324449408, -3110],
  [4030, 17, -3950],
];

const bridges = [
  {
    id: 'old-stone-arches',
    type: 'stone_arch',
    x: -3260,
    z: 3100,
    span: 116,
    width: 12,
    deckY: 70.3578793765116,
    waterY: 58.357879376511605,
    heading: 34.64094751191629 * Math.PI / 180,
  },
  {
    id: 'lake-rail-viaduct',
    type: 'rail_viaduct',
    x: -1570,
    z: 1650,
    span: 205,
    width: 10,
    deckY: 76.29494518311355,
    waterY: 49.29494518311355,
    heading: 45.567266409857936 * Math.PI / 180,
  },
  {
    id: 'central-suspension',
    type: 'suspension',
    x: -420,
    z: 300,
    span: 275,
    width: 14,
    deckY: 74.08019739035986,
    waterY: 42.08019739035986,
    heading: 51.44953470384228 * Math.PI / 180,
  },
  {
    id: 'city-canal-bridge',
    type: 'urban_arch',
    x: 820,
    z: -760,
    span: 132,
    width: 20,
    deckY: 46.426024898947,
    waterY: 35.426024898947,
    heading: 35.28674897505972 * Math.PI / 180,
  },
  {
    id: 'southern-highline',
    type: 'steel_truss',
    x: 2290,
    z: -2260,
    span: 232,
    width: 11,
    deckY: 64.88123059583158,
    waterY: 26.881230595831582,
    heading: 48.28924267849183 * Math.PI / 180,
  },
];

const landmarks = [
  {
    id: 'north-tower-thread',
    type: 'tower_pair',
    position: [1020, -480],
    headingDegrees: 35,
    y: 92.52027893066406,
  },
  {
    id: 'south-tower-thread',
    type: 'tower_pair',
    position: [650, -1140],
    headingDegrees: -28,
    y: 94.70497131347656,
  },
  {
    id: 'open-atrium',
    type: 'open_atrium',
    position: [1130, -720],
    headingDegrees: 0,
    y: 92.4326400756836,
  },
];

export const AUTHORED_WORLD_REFERENCE = Object.freeze({
  source: 'assets/world/features.json@34e65d1d572c409f9220a437127fd4b617da81c1',
  coordinateSystem: Object.freeze({
    units: 'meters',
    xAxis: 'east',
    zAxis: 'north',
    origin: 'world-center',
  }),
  river: Object.freeze({
    id: 'skyline-river',
    bankWidth: 190,
    points: Object.freeze(riverPoints.map(point => Object.freeze(point))),
  }),
  city: Object.freeze({
    id: 'skyline-city',
    plateau: Object.freeze({
      min: Object.freeze([420, -1390]),
      max: Object.freeze([1480, -330]),
      elevation: 94,
      feather: 145,
    }),
    grid: Object.freeze({
      blockMin: 60,
      blockMax: 90,
      street: 18,
    }),
    landmarks: Object.freeze(landmarks.map(item => Object.freeze(item))),
  }),
  bridges: Object.freeze(bridges.map(item => Object.freeze(item))),
  airfields: DEFAULT_AIRFIELDS,
});

export function mergeAuthoredReference(override = null) {
  if (!override || typeof override !== 'object') return AUTHORED_WORLD_REFERENCE;
  return Object.freeze({
    ...AUTHORED_WORLD_REFERENCE,
    ...override,
    river: Object.freeze({
      ...AUTHORED_WORLD_REFERENCE.river,
      ...(override.river || {}),
    }),
    city: Object.freeze({
      ...AUTHORED_WORLD_REFERENCE.city,
      ...(override.city || {}),
    }),
    bridges: Object.freeze(
      Array.isArray(override.bridges)
        ? override.bridges.map(item => Object.freeze({ ...item }))
        : AUTHORED_WORLD_REFERENCE.bridges,
    ),
    airfields: Object.freeze(
      Array.isArray(override.airfields)
        ? override.airfields.map(item => Object.freeze({ ...item }))
        : AUTHORED_WORLD_REFERENCE.airfields,
    ),
  });
}
