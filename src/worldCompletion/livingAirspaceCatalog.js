const FEATURE_CATEGORIES = Object.freeze([
  'rural-birds',
  'ridge-birds',
  'water-birds',
  'soaring-birds',
  'sailplanes',
  'civil-traffic',
  'contrails',
  'clouds',
  'atmospheric-depth',
]);

function freezeRoute(route) {
  return Object.freeze({
    ...route,
    points:
      Object.freeze(
        route.points.map(point =>
          Object.freeze([...point])
        )
      ),
  });
}

function positionById(manifest, id, fallback) {
  for (const item of manifest?.navigationReferences ?? []) {
    if (item.id === id && Array.isArray(item.position)) {
      return [...item.position];
    }
  }
  for (const item of manifest?.settlements ?? []) {
    if (item.id === id && Array.isArray(item.center)) {
      return [...item.center];
    }
  }
  for (const item of manifest?.regions ?? []) {
    if (item.id === id && Array.isArray(item.center)) {
      return [...item.center];
    }
  }
  return [...fallback];
}

function waypoint(point, altitude) {
  return [point[0], altitude, point[1]];
}

export function createWorldLivingAirspaceCatalog(
  manifest = {}
) {
  const crown = positionById(
    manifest,
    'crown-pass',
    [300, 6200],
  );
  const granite = positionById(
    manifest,
    'granite-pass',
    [-5050, 5750],
  );
  const aurora = positionById(
    manifest,
    'aurora-lake',
    [-6500, 3600],
  );
  const iron = positionById(
    manifest,
    'ironworks',
    [6260, 820],
  );
  const harbour = positionById(
    manifest,
    'harbour-town',
    [2200, -6480],
  );
  const westCoast = positionById(
    manifest,
    'western-coast',
    [-5550, -6100],
  );
  const farm = positionById(
    manifest,
    'farmstead-cluster',
    [-6500, -4700],
  );
  const redCanyon = positionById(
    manifest,
    'southeast-red-canyon',
    [6600, -3500],
  );

  const birdHabitats = Object.freeze([
    Object.freeze({
      id: 'central-rural',
      category: 'rural-birds',
      center: [-1050, 120, 980],
      radiusX: 760,
      radiusZ: 520,
      altitude: [48, 105],
      speed: 0.020,
      countShare: 0.16,
      color: 0x323739,
    }),
    Object.freeze({
      id: 'crown-ridge',
      category: 'ridge-birds',
      center: [crown[0], 560, crown[1]],
      radiusX: 1250,
      radiusZ: 880,
      altitude: [120, 260],
      speed: 0.012,
      countShare: 0.18,
      color: 0x2f3437,
    }),
    Object.freeze({
      id: 'granite-soarers',
      category: 'soaring-birds',
      center: [granite[0], 680, granite[1]],
      radiusX: 1120,
      radiusZ: 860,
      altitude: [180, 370],
      speed: 0.009,
      countShare: 0.15,
      color: 0x202629,
    }),
    Object.freeze({
      id: 'aurora-waterbirds',
      category: 'water-birds',
      center: [aurora[0], 110, aurora[1]],
      radiusX: 980,
      radiusZ: 700,
      altitude: [20, 80],
      speed: 0.021,
      countShare: 0.16,
      color: 0xc7c9c6,
    }),
    Object.freeze({
      id: 'south-coast-birds',
      category: 'water-birds',
      center: [harbour[0], 90, harbour[1]],
      radiusX: 1600,
      radiusZ: 760,
      altitude: [22, 95],
      speed: 0.019,
      countShare: 0.13,
      color: 0xd1d2cf,
    }),
    Object.freeze({
      id: 'farm-flocks',
      category: 'rural-birds',
      center: [farm[0], 140, farm[1]],
      radiusX: 1300,
      radiusZ: 880,
      altitude: [45, 120],
      speed: 0.022,
      countShare: 0.12,
      color: 0x393b38,
    }),
    Object.freeze({
      id: 'canyon-raptors',
      category: 'soaring-birds',
      center: [redCanyon[0], 520, redCanyon[1]],
      radiusX: 1200,
      radiusZ: 900,
      altitude: [160, 340],
      speed: 0.008,
      countShare: 0.10,
      color: 0x242626,
    }),
  ]);

  const trafficRoutes = Object.freeze([
    freezeRoute({
      id: 'skyline-harbour-commuter',
      category: 'civil-traffic',
      type: 'commuter',
      color: 0xe5e1d7,
      accent: 0xb6463a,
      speed: 0.012,
      phase: 0.04,
      audio: 0.72,
      contrail: false,
      points: [
        [520, 180, 520],
        [1800, 320, -900],
        [2800, 400, -2200],
        waypoint(harbour, 330),
        [800, 260, -3600],
        [-300, 190, -900],
      ],
    }),
    freezeRoute({
      id: 'western-lake-tour',
      category: 'civil-traffic',
      type: 'floatplane',
      color: 0xd9d1bd,
      accent: 0x42626d,
      speed: 0.010,
      phase: 0.27,
      audio: 0.58,
      contrail: false,
      points: [
        waypoint(aurora, 180),
        [-7100, 230, 1800],
        [-6200, 290, 800],
        [-4300, 360, 1900],
        [-5000, 250, 4200],
      ],
    }),
    freezeRoute({
      id: 'crown-sailplane',
      category: 'sailplanes',
      type: 'sailplane',
      color: 0xe7e5df,
      accent: 0x365b78,
      speed: 0.0075,
      phase: 0.38,
      audio: 0.04,
      contrail: false,
      points: [
        waypoint(crown, 920),
        [1800, 860, 5950],
        waypoint(granite, 980),
        [-2900, 820, 4800],
        [-800, 780, 5200],
      ],
    }),
    freezeRoute({
      id: 'granite-glider',
      category: 'sailplanes',
      type: 'sailplane',
      color: 0xf0eee8,
      accent: 0xa64238,
      speed: 0.0068,
      phase: 0.73,
      audio: 0.03,
      contrail: false,
      points: [
        waypoint(granite, 880),
        [-7400, 940, 6200],
        [-6200, 1050, 7100],
        [-4100, 900, 6100],
      ],
    }),
    freezeRoute({
      id: 'ironworks-trainer',
      category: 'civil-traffic',
      type: 'trainer',
      color: 0xe4d9bd,
      accent: 0xc16a32,
      speed: 0.016,
      phase: 0.19,
      audio: 0.62,
      contrail: false,
      points: [
        waypoint(iron, 280),
        [7000, 330, 2100],
        [5900, 420, 3400],
        [4700, 310, 1600],
        [5200, 260, -400],
      ],
    }),
    freezeRoute({
      id: 'coastal-patrol',
      category: 'civil-traffic',
      type: 'commuter',
      color: 0xe7e0cf,
      accent: 0x4b6c78,
      speed: 0.0125,
      phase: 0.55,
      audio: 0.60,
      contrail: false,
      points: [
        waypoint(westCoast, 210),
        [-3400, 250, -6700],
        waypoint(harbour, 260),
        [5000, 300, -6500],
        [6600, 360, -4200],
        [1000, 250, -5900],
      ],
    }),
    freezeRoute({
      id: 'canyon-mail',
      category: 'civil-traffic',
      type: 'trainer',
      color: 0xd7d0bd,
      accent: 0x994b38,
      speed: 0.014,
      phase: 0.81,
      audio: 0.55,
      contrail: false,
      points: [
        waypoint(redCanyon, 430),
        [7200, 520, -1700],
        waypoint(iron, 390),
        [5200, 360, -2800],
      ],
    }),
    freezeRoute({
      id: 'high-world-transit',
      category: 'civil-traffic',
      type: 'transport',
      color: 0xbfc8cb,
      accent: 0x30383c,
      speed: 0.007,
      phase: 0.91,
      audio: 0.40,
      contrail: true,
      points: [
        [-7600, 1250, 5000],
        [-2600, 1320, 2600],
        [2600, 1380, -200],
        [7400, 1290, -3900],
        [3300, 1260, -7200],
        [-3200, 1220, -6500],
      ],
    }),
    freezeRoute({
      id: 'farm-service',
      category: 'civil-traffic',
      type: 'commuter',
      color: 0xd8d0ba,
      accent: 0x6f5b35,
      speed: 0.013,
      phase: 0.12,
      audio: 0.52,
      contrail: false,
      points: [
        waypoint(farm, 210),
        [-5200, 260, -3600],
        [-3400, 300, -5200],
        waypoint(westCoast, 220),
      ],
    }),
  ]);

  return Object.freeze({
    version: 2,
    bounds:
      Object.freeze({
        minX: Number(manifest.bounds?.minX) || -8192,
        maxX: Number(manifest.bounds?.maxX) || 8192,
        minZ: Number(manifest.bounds?.minZ) || -8192,
        maxZ: Number(manifest.bounds?.maxZ) || 8192,
      }),
    birdHabitats,
    trafficRoutes,
    cloudRegions:
      Object.freeze([
        Object.freeze({
          id: 'lower-cumulus',
          altitude: [420, 780],
          scale: [160, 330],
          wind: [2.8, 0.55],
          opacity: 0.42,
        }),
        Object.freeze({
          id: 'upper-broken',
          altitude: [920, 1420],
          scale: [260, 520],
          wind: [5.2, 1.1],
          opacity: 0.28,
        }),
      ]),
    requiredCategories: FEATURE_CATEGORIES,
  });
}
