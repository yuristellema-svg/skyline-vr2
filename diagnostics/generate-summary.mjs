import { mkdir, writeFile } from 'node:fs/promises';
import { buildSettlementCatalog, summarizeCatalog } from '../src/settlements/catalogBuilder.js';
import { descriptorFootprint } from '../src/settlements/descriptor.js';
import { SAMPLE_WORLD_MANIFEST } from '../src/settlements/sampleCatalog.js';

const out = new URL('./', import.meta.url);
await mkdir(out, { recursive: true });

const sampleHeight = (x, z) =>
  14 + Math.sin(x * 0.002) * 3 + Math.cos(z * 0.0017) * 2;

const catalog = buildSettlementCatalog({
  manifest: SAMPLE_WORLD_MANIFEST,
  sampleHeight,
});

const parcelCounts = Object.fromEntries(
  Object.entries(catalog.parcelsBySettlement).map(([id, parcels]) => [id, parcels.length]),
);

const diagnostic = {
  generatedFrom: 'SAMPLE_WORLD_MANIFEST + deterministic sampleHeight',
  summary: summarizeCatalog(catalog),
  parcelCounts,
  parcelFamilyCounts: catalog.parcelFamilyCounts,
  districtParcelCounts: catalog.districtParcelCounts,
  roleCounts: catalog.roleCounts,
  tiers: Object.fromEntries(Object.entries(catalog.tiers).map(([quality, tier]) => [quality, {
    total: tier.total,
    counts: tier.counts,
    triangleEstimate: tier.triangleEstimate,
    estimatedDrawCalls: tier.renderPlan.drawCalls,
    budget: tier.budget,
  }])),
};
await writeFile(new URL('sample-counts.json', out), `${JSON.stringify(diagnostic, null, 2)}\n`);

const settlementBudgetMatrix = {
  worldId: catalog.worldId,
  qualities: ['low', 'medium', 'high'],
  settlements: Object.fromEntries(catalog.manifest.settlements.map(settlement => [
    settlement.id,
    {
      name: settlement.name,
      kind: settlement.kind,
      parcels: catalog.parcelsBySettlement[settlement.id].length,
      low: catalog.countsBySettlement.low[settlement.id] ?? null,
      medium: catalog.countsBySettlement.medium[settlement.id] ?? null,
      high: catalog.countsBySettlement.high[settlement.id] ?? null,
    },
  ])),
  landmarks: Object.fromEntries(catalog.manifest.landmarks.map(landmark => {
    const id = `landmark:${landmark.id}`;
    return [landmark.id, {
      name: landmark.name,
      kind: landmark.kind,
      low: catalog.countsBySettlement.low[id] ?? null,
      medium: catalog.countsBySettlement.medium[id] ?? null,
      high: catalog.countsBySettlement.high[id] ?? null,
    }];
  })),
};
await writeFile(
  new URL('settlement-budget-matrix.json', out),
  `${JSON.stringify(settlementBudgetMatrix, null, 2)}\n`,
);

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function boundsFromManifest(manifest) {
  const points = [
    ...manifest.roads.flatMap(item => item.points),
    ...manifest.shorelines.flatMap(item => item.points),
    ...manifest.settlements.flatMap(item => item.footprint),
    ...manifest.landmarks.map(item => item.anchor),
  ];
  return {
    minX: Math.min(...points.map(point => point[0])),
    maxX: Math.max(...points.map(point => point[0])),
    minZ: Math.min(...points.map(point => point[1])),
    maxZ: Math.max(...points.map(point => point[1])),
  };
}

function planViewSvg() {
  const width = 1600;
  const height = 1120;
  const margin = 70;
  const bounds = boundsFromManifest(SAMPLE_WORLD_MANIFEST);
  const scale = Math.min(
    (width - margin * 2) / (bounds.maxX - bounds.minX),
    (height - margin * 2) / (bounds.maxZ - bounds.minZ),
  );
  const point = ([x, z]) => [
    margin + (x - bounds.minX) * scale,
    height - margin - (z - bounds.minZ) * scale,
  ];
  const polyline = points => points.map(item => point(item).map(value => value.toFixed(1)).join(',')).join(' ');
  const districtColors = {
    downtown: '#9ba9ad', civic: '#b3a68e', 'old-quarter': '#a99582', residential: '#a8b09d',
    'mixed-use': '#9eaaa4', market: '#b49b80', industrial: '#8d9291', warehouse: '#7f898b',
    docklands: '#84969b', rural: '#a7a183',
  };
  const settlementColors = {
    city: '#56666c', suburb: '#6e7b72', town: '#756d62', village: '#807667',
    industrial: '#555f62', harbour: '#526970', farm: '#6f755e',
  };
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#edf0ed"/>',
    '<text x="70" y="45" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#263238">Skyline settlements reference placement diagnostic</text>',
    '<text x="70" y="72" font-family="system-ui,sans-serif" font-size="15" fill="#526168">Road-linked parcels, districts, exclusions, shoreline and landmark anchors</text>',
  ];

  for (const settlement of SAMPLE_WORLD_MANIFEST.settlements) {
    lines.push(`<polygon points="${polyline(settlement.footprint)}" fill="${settlementColors[settlement.kind]}" fill-opacity="0.10" stroke="${settlementColors[settlement.kind]}" stroke-width="2"/>`);
    for (const district of settlement.districts ?? []) {
      lines.push(`<polygon points="${polyline(district.footprint)}" fill="${districtColors[district.kind] ?? '#999'}" fill-opacity="0.22" stroke="${districtColors[district.kind] ?? '#777'}" stroke-width="1.3"/>`);
    }
  }
  for (const exclusion of SAMPLE_WORLD_MANIFEST.exclusions) {
    lines.push(`<polygon points="${polyline(exclusion.footprint)}" fill="#c04b43" fill-opacity="0.18" stroke="#a03e38" stroke-width="2" stroke-dasharray="8 5"/>`);
  }
  for (const shoreline of SAMPLE_WORLD_MANIFEST.shorelines) {
    lines.push(`<polyline points="${polyline(shoreline.points)}" fill="none" stroke="#4d8493" stroke-width="9" stroke-linecap="round" opacity="0.72"/>`);
  }
  for (const road of SAMPLE_WORLD_MANIFEST.roads) {
    lines.push(`<polyline points="${polyline(road.points)}" fill="none" stroke="#38464b" stroke-width="${Math.max(2.2, road.width * scale)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.58"/>`);
  }

  for (const parcels of Object.values(catalog.parcelsBySettlement)) {
    for (const parcel of parcels) {
      lines.push(`<polygon points="${polyline(parcel.footprint)}" fill="#f4f0e7" fill-opacity="0.80" stroke="#4d5759" stroke-width="0.75"/>`);
    }
  }

  for (const landmark of SAMPLE_WORLD_MANIFEST.landmarks) {
    const [x, y] = point(landmark.anchor);
    lines.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="#d35843" stroke="#ffffff" stroke-width="2"/>`);
    lines.push(`<text x="${(x + 9).toFixed(1)}" y="${(y - 8).toFixed(1)}" font-family="system-ui,sans-serif" font-size="11" fill="#333">${escape(landmark.name)}</text>`);
  }

  const labels = SAMPLE_WORLD_MANIFEST.settlements.map(settlement => {
    const parcels = catalog.parcelsBySettlement[settlement.id];
    const centerX = parcels.reduce((sum, parcel) => sum + parcel.x, 0) / parcels.length;
    const centerZ = parcels.reduce((sum, parcel) => sum + parcel.z, 0) / parcels.length;
    const [x, y] = point([centerX, centerZ]);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#263238" paint-order="stroke" stroke="#edf0ed" stroke-width="4">${escape(settlement.name)} · ${parcels.length}</text>`;
  });
  lines.push(...labels);
  lines.push('</svg>');
  return lines.join('\n');
}
await writeFile(new URL('sample-layout.svg', out), planViewSvg());

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((value >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function isometricSvg() {
  const width = 1600;
  const height = 1000;
  const structures = catalog.tiers.high.descriptors
    .filter(item => ['foundations', 'structures', 'roofs', 'landmarks'].includes(item.category))
    .filter(item => item.visibilityBand === 'skyline' || item.essential || item.role === 'harbour-pier')
    .slice(0, 980)
    .sort((a, b) => (a.position[0] + a.position[2] + a.position[1] * 0.12) - (b.position[0] + b.position[2] + b.position[1] * 0.12));
  const project = (x, y, z) => [
    width * 0.52 + (x - z) * 0.31,
    height * 0.74 + (x + z) * 0.115 - y * 0.58,
  ];
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8ced3"/><stop offset="1" stop-color="#ece7dc"/></linearGradient></defs>',
    '<rect width="100%" height="100%" fill="url(#sky)"/>',
    '<ellipse cx="800" cy="785" rx="650" ry="150" fill="#6f7c72" opacity="0.22"/>',
    '<text x="65" y="58" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#263238">Generated aerial silhouette diagnostic</text>',
    '<text x="65" y="86" font-family="system-ui,sans-serif" font-size="15" fill="#4e5d63">Essential high-tier shells only; intended to expose scale, hierarchy and district variation</text>',
  ];
  for (const descriptor of structures) {
    const [x, y, z] = descriptor.position;
    const [sx, sy, sz] = descriptor.scale;
    const bottom = y - sy * 0.5;
    const top = y + sy * 0.5;
    const base = [
      project(x - sx * 0.5, bottom, z - sz * 0.5),
      project(x + sx * 0.5, bottom, z - sz * 0.5),
      project(x + sx * 0.5, bottom, z + sz * 0.5),
      project(x - sx * 0.5, bottom, z + sz * 0.5),
    ];
    const roof = [
      project(x - sx * 0.5, top, z - sz * 0.5),
      project(x + sx * 0.5, top, z - sz * 0.5),
      project(x + sx * 0.5, top, z + sz * 0.5),
      project(x - sx * 0.5, top, z + sz * 0.5),
    ];
    const pts = polygon => polygon.map(point => point.map(value => value.toFixed(1)).join(',')).join(' ');
    const color = descriptor.color.startsWith('#') ? descriptor.color : '#747b79';
    lines.push(`<polygon points="${pts([base[1], base[2], roof[2], roof[1]])}" fill="${shade(color, -22)}" opacity="0.90"/>`);
    lines.push(`<polygon points="${pts([base[2], base[3], roof[3], roof[2]])}" fill="${shade(color, -38)}" opacity="0.90"/>`);
    lines.push(`<polygon points="${pts(roof)}" fill="${shade(color, 18)}" opacity="0.94"/>`);
  }
  lines.push('</svg>');
  return lines.join('\n');
}
await writeFile(new URL('sample-isometric.svg', out), isometricSvg());

function budgetSvg() {
  const width = 1200;
  const height = 700;
  const qualities = ['low', 'medium', 'high'];
  const maxInstances = Math.max(...qualities.map(quality => catalog.tiers[quality].budget.maxInstances));
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#f3f1eb"/>',
    '<text x="60" y="55" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#263238">Settlement quality budget diagnostic</text>',
    '<text x="60" y="82" font-family="system-ui,sans-serif" font-size="14" fill="#57656a">Same locations; progressively fewer windows and micro-details</text>',
  ];
  qualities.forEach((quality, index) => {
    const tier = catalog.tiers[quality];
    const y = 150 + index * 165;
    const usedWidth = 850 * tier.total / maxInstances;
    const capWidth = 850 * tier.budget.maxInstances / maxInstances;
    lines.push(`<text x="60" y="${y + 25}" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#2f3a3d">${quality.toUpperCase()}</text>`);
    lines.push(`<rect x="210" y="${y}" width="${capWidth.toFixed(1)}" height="42" rx="5" fill="#d4d7d2"/>`);
    lines.push(`<rect x="210" y="${y}" width="${usedWidth.toFixed(1)}" height="42" rx="5" fill="#697b7e"/>`);
    lines.push(`<text x="${(225 + usedWidth).toFixed(1)}" y="${y + 27}" font-family="system-ui,sans-serif" font-size="15" fill="#263238">${tier.total} / ${tier.budget.maxInstances} instances</text>`);
    lines.push(`<text x="210" y="${y + 74}" font-family="system-ui,sans-serif" font-size="14" fill="#526168">${tier.renderPlan.drawCalls} draw calls · ${tier.triangleEstimate.toLocaleString()} estimated triangles · ${tier.counts.windows} windows</text>`);
  });
  lines.push('</svg>');
  return lines.join('\n');
}
await writeFile(new URL('budget-summary.svg', out), budgetSvg());

const audit = {
  deterministicWorldId: catalog.worldId,
  settlementCount: catalog.manifest.settlements.length,
  districtCount: catalog.manifest.settlements.reduce((sum, item) => sum + (item.districts?.length ?? 0), 0),
  landmarkCount: catalog.manifest.landmarks.length,
  roadLinkedParcels: Object.values(catalog.parcelsBySettlement).flat().every(parcel => typeof parcel.roadRef === 'string'),
  terrainSampledFoundations: catalog.allDescriptors.filter(item => item.role === 'terrain-conforming-foundation').length,
  wholeBuildingEmission: false,
  explicitEmissiveRoles: [...new Set(catalog.allDescriptors.filter(item => item.emissive).map(item => item.role))].sort(),
  privateAnimationLoops: 0,
  sceneWideMaterialScans: 0,
  createsRoads: false,
  createsTerrain: false,
  createsWater: false,
};
await writeFile(new URL('catalog-audit.json', out), `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify(diagnostic.summary, null, 2));

function mainCityIsometricSvg() {
  const width = 1600;
  const height = 1050;
  const selectedIds = new Set(['aster-core', 'aster-north', 'aster-east', 'forge-district', 'port-aster']);
  const structures = catalog.tiers.high.descriptors
    .filter(item => selectedIds.has(item.settlementId))
    .filter(item => ['foundations', 'structures', 'roofs', 'landmarks'].includes(item.category))
    .sort((a, b) => (a.position[0] + a.position[2] + a.position[1] * 0.12) - (b.position[0] + b.position[2] + b.position[1] * 0.12));
  const project = (x, y, z) => [
    width * 0.53 + (x - z) * 0.54,
    height * 0.72 + (x + z) * 0.20 - y * 0.86,
  ];
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<defs><linearGradient id="citySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aec8cf"/><stop offset="0.66" stop-color="#e8e1d4"/><stop offset="1" stop-color="#d2d0c6"/></linearGradient></defs>',
    '<rect width="100%" height="100%" fill="url(#citySky)"/>',
    '<ellipse cx="820" cy="820" rx="735" ry="185" fill="#627069" opacity="0.24"/>',
    '<text x="60" y="58" font-family="system-ui,sans-serif" font-size="31" font-weight="700" fill="#263238">Aster metropolitan kit · close aerial diagnostic</text>',
    '<text x="60" y="88" font-family="system-ui,sans-serif" font-size="15" fill="#4f5f65">Downtown skyline, civic massing, old quarter, suburbs, Forge industry and Port Aster</text>',
  ];
  for (const descriptor of structures) {
    const [x, y, z] = descriptor.position;
    const [sx, sy, sz] = descriptor.scale;
    const bottom = y - sy * 0.5;
    const top = y + sy * 0.5;
    const base = [
      project(x - sx * 0.5, bottom, z - sz * 0.5),
      project(x + sx * 0.5, bottom, z - sz * 0.5),
      project(x + sx * 0.5, bottom, z + sz * 0.5),
      project(x - sx * 0.5, bottom, z + sz * 0.5),
    ];
    const roof = [
      project(x - sx * 0.5, top, z - sz * 0.5),
      project(x + sx * 0.5, top, z - sz * 0.5),
      project(x + sx * 0.5, top, z + sz * 0.5),
      project(x - sx * 0.5, top, z + sz * 0.5),
    ];
    const pts = polygon => polygon.map(item => item.map(value => value.toFixed(1)).join(',')).join(' ');
    const color = descriptor.color.startsWith('#') ? descriptor.color : '#747b79';
    lines.push(`<polygon points="${pts([base[1], base[2], roof[2], roof[1]])}" fill="${shade(color, -18)}" opacity="0.94"/>`);
    lines.push(`<polygon points="${pts([base[2], base[3], roof[3], roof[2]])}" fill="${shade(color, -34)}" opacity="0.94"/>`);
    lines.push(`<polygon points="${pts(roof)}" fill="${shade(color, 22)}" opacity="0.97"/>`);
  }
  const labelSites = [
    ['DOWNTOWN', [-70, -30]],
    ['CIVIC', [-370, 20]],
    ['OLD QUARTER', [300, -30]],
    ['FORGE', [20, 500]],
    ['PORT', [-300, 700]],
    ['NORTH ASTER', [-170, -510]],
    ['EAST ASTER', [610, -40]],
  ];
  for (const [label, location] of labelSites) {
    const [x, y] = project(location[0], 135, location[1]);
    const labelWidth = Math.max(76, label.length * 8.2 + 18);
    lines.push(`<rect x="${(x - labelWidth * 0.5).toFixed(1)}" y="${(y - 18).toFixed(1)}" width="${labelWidth.toFixed(1)}" height="25" rx="6" fill="#f2eee5" fill-opacity="0.88"/>`);
    lines.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="800" letter-spacing="0.8" fill="#263238">${label}</text>`);
  }
  lines.push('</svg>');
  return lines.join('\n');
}
await writeFile(new URL('main-city-isometric.svg', out), mainCityIsometricSvg());
