/**
 * One-off Node conversion script (NOT bundled/imported by the browser app —
 * run manually with `node client/src/utils/txtToGeojson.js`) that converts
 * the real ZMU Campus 2 coordinate data into the static GeoJSON assets the
 * app actually renders from, mirroring server/geo/export-geojson-assets.js's
 * "reference txt -> static client/src/assets/geojson/*.geojson" pattern for
 * Campus 1.
 *
 * Source: ../../../../reference/zmu_campus_2.txt (sibling to this repo,
 * NOT tracked in git) — unlike zmu_road.txt/fence.txt, this source file is
 * already one well-formed GeoJSON FeatureCollection (31 features: the
 * campus boundary, 7 circular plaza plots, and the central star-shaped
 * building's ~12 named sub-parts). This script does not re-digitize or
 * alter a single coordinate — it only SPLITS that one FeatureCollection
 * into the 3 category files the renderer consumes, and tags each central-
 * building sub-part with the height/role/pairing metadata the renderer
 * needs (which corner/middle number it belongs to, whether it's a solid
 * volume or a hollow cut-out of one).
 *
 * Output: client/src/assets/geojson/campus2/{campus_boundary,
 * central_building, circular_structures}.geojson — a dedicated `campus2/`
 * subfolder so these never collide with Campus 1's identically-named
 * campus_boundary.geojson etc.
 */
const fs = require('fs');
const path = require('path');

const REFERENCE_DIR = path.join(__dirname, '../../../../reference');
const OUT_DIR = path.join(__dirname, '../assets/geojson/campus2');

// Each solid feature in the source carries its own real "N-floor" height
// (Central Plaza is 2-floor, every corner/middle wing is 3-floor — NOT a
// uniform per-category guess) — converted to metres at 4m/floor, the same
// ratio every Campus 1 building already uses (verified against
// buildings.geojson: height/levels === 4 for every real record).
const METRES_PER_FLOOR = 4;

function parseFloors(heightStr) {
  const m = /^(\d+)\s*-?\s*floor/i.exec(heightStr || '');
  if (m) return Number(m[1]);
  // zmu_campus_2_02.txt's terrace sub-features carry a bare number
  // ("height": "2") with no "floor" suffix — same floor-count convention,
  // just without the word.
  const bare = /^(\d+)$/.exec((heightStr || '').trim());
  return bare ? Number(bare[1]) : null;
}

function loadSource() {
  const filePath = path.join(REFERENCE_DIR, 'zmu_campus_2.txt');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw); // already one valid FeatureCollection
}

// zmu_campus_2_roads.txt is NOT a well-formed JSON document like
// zmu_campus_2.txt — it's a bare, trailing-comma-terminated sequence of
// Feature objects with no wrapping array or FeatureCollection. Stripping
// the trailing comma and wrapping in [...] parses it cleanly.
function loadRoadsSource() {
  const filePath = path.join(REFERENCE_DIR, 'zmu_campus_2_roads.txt');
  const raw = fs.readFileSync(filePath, 'utf8').trim().replace(/,\s*$/, '');
  return JSON.parse(`[${raw}]`);
}

// zmu_campus_2_buildings.txt is the same bare, trailing-comma-terminated
// Feature sequence shape as zmu_campus_2_roads.txt (38 real digitized
// building footprints — building-201..236, plus building-209's own two
// "pillar" sub-features).
function loadBuildingsSource() {
  const filePath = path.join(REFERENCE_DIR, 'zmu_campus_2_buildings.txt');
  const raw = fs.readFileSync(filePath, 'utf8').trim().replace(/,\s*$/, '');
  return JSON.parse(`[${raw}]`);
}

// zmu_campus_2_02.txt is malformed differently from the others: it's
// missing its opening `{"type":"FeatureCollection","features":[` wrapper
// (the file starts directly with the first Feature's own `{`), but still
// ends with the wrapper's stray closing `]}`. Stripping that trailing `}`
// and prepending `[` reconstructs a valid Feature array.
function loadPhase3Source() {
  const filePath = path.join(REFERENCE_DIR, 'zmu_campus_2_02.txt');
  let raw = fs.readFileSync(filePath, 'utf8').trim();
  if (raw.endsWith('}')) raw = raw.slice(0, -1).trimEnd();
  return JSON.parse(`[${raw}`);
}

function metersBetween(a, b, lat0) {
  const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * mPerDegLon, (a[1] - b[1]) * 111320);
}

function isHollow(name) {
  return /hollow|empty space/i.test(name || '');
}

// "plaza corner-3 hollow/empty space" -> { part: 'corner', num: '3' }
// "central Plaza middle hollow/empty space-1" -> { part: 'hub', num: null }
// (the small "central Plaza circle" isn't classified here at all — it's a
// road intersection, not a building part, see the main loop below)
function classify(feature) {
  const name = feature.properties?.name || '';

  if (/^central plaza$/i.test(name)) return { part: 'hub', num: null, name };
  if (/^central plaza middle hollow/i.test(name)) return { part: 'hub', num: null, name };
  const cornerMatch = name.match(/^plaza corner-(\d+)/i);
  if (cornerMatch) return { part: 'corner', num: cornerMatch[1], name };
  const middleMatch = name.match(/^plaza middle-(\d+)/i);
  if (middleMatch) return { part: 'middle', num: middleMatch[1], name };
  return null;
}

// Classifies each real road centerline into a hierarchy tier — from the
// data itself (closure, point density, the source's own "stroke-width"
// weighting), never invented or renamed by hand:
//  - a closed loop (start ≈ end, <5m gap) is a roundabout's own carriageway
//    ring (road-2 loops tightly around circle-1's real centre)
//  - the single longest, densest path (by far — 140 real points vs the
//    next-highest's 25) is the outer perimeter ring (road-5)
//  - among what's left, the source's own stroke-width=10 features are the
//    wider connectors nearest the hub (radial tier); stroke-width=5 are
//    the narrower ones further out (internal tier)
// Width-per-tier (22/16/10m) is the brief's own hierarchy; the roundabout
// ring's width is derived from its own real loop radius, not a guess.
const TIER_WIDTH_M = { ring: 22, radial: 16, internal: 10 };

function buildRoads() {
  const raw = loadRoadsSource();
  const withMeta = raw.map((f) => {
    const coords = f.geometry.coordinates;
    const lat0 = coords[0][1];
    const closureDist = metersBetween(coords[0], coords[coords.length - 1], lat0);
    return { f, coords, lat0, closureDist, closed: closureDist < 5, points: coords.length, strokeWidth: f.properties['stroke-width'] };
  });

  const ring = withMeta.reduce((a, b) => (b.points > a.points ? b : a));

  const features = withMeta.map((r) => {
    let tier, widthMeters;
    if (r.closed) {
      tier = 'roundabout_ring';
      // Real loop radius (mean vertex distance from the loop's own
      // centroid) rather than a flat assumption — this loop's own real
      // geometry sets its own carriageway width, capped to a sensible
      // single-lane-loop range.
      const cLon = r.coords.reduce((s, p) => s + p[0], 0) / r.coords.length;
      const cLat = r.coords.reduce((s, p) => s + p[1], 0) / r.coords.length;
      const meanRadius = r.coords.reduce((s, p) => s + metersBetween(p, [cLon, cLat], r.lat0), 0) / r.coords.length;
      widthMeters = Math.max(6, Math.min(10, meanRadius * 0.35));
    } else if (r.f === ring.f) {
      tier = 'ring';
      widthMeters = TIER_WIDTH_M.ring;
    } else if (r.strokeWidth >= 10) {
      tier = 'radial';
      widthMeters = TIER_WIDTH_M.radial;
    } else {
      tier = 'internal';
      widthMeters = TIER_WIDTH_M.internal;
    }
    return {
      type: 'Feature',
      properties: {
        name: r.f.properties.name,
        strokeWidth: r.strokeWidth,
        tier,
        widthMeters: Math.round(widthMeters * 10) / 10,
        closed: r.closed,
      },
      geometry: r.f.geometry,
    };
  });

  return features;
}

// "Simple Road Generation" pass — supersedes buildRoads() above (kept,
// not deleted, in case the full real-digitized network is wanted again
// later). One perimeter (the real boundary ring), radials from the real
// hub ("central Plaza circle") out to each of the real intersection
// circles in circular_structures.geojson, and one loop connecting those
// same real circles in angular order. Earlier this snapped roundabouts to
// 5 invented compass-bearing positions (North/East/South/etc.) instead of
// the real circles — up to 145m off — so roads never actually touched the
// circles they were supposed to meet. Fixed: every roundabout position
// and radius below is read straight from the real circle polygons, so
// road endpoints land exactly on real circle centers.
const SIMPLE_ROAD_WIDTH_M = 4; // lowered again from 7m per explicit request

function destinationPoint([lon, lat], bearingDeg, distanceM) {
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const rad = (bearingDeg * Math.PI) / 180;
  return [lon + (Math.sin(rad) * distanceM) / mPerDegLon, lat + (Math.cos(rad) * distanceM) / 111320];
}

function circlePolygon([lon, lat], radiusM, segments = 32) {
  const coords = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (360 * i) / segments;
    coords.push(destinationPoint([lon, lat], bearing, radiusM));
  }
  return coords;
}

// A real circle feature's own centroid + mean vertex-to-centroid distance
// (its real radius) — never a hardcoded/assumed size.
function circleCenterAndRadius(feature, lat0) {
  const ring = feature.geometry.coordinates[0].slice(0, -1);
  const center = [
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
  ];
  const radiusM = ring.reduce((s, p) => s + metersBetween(p, center, lat0), 0) / ring.length;
  return { center, radiusM };
}

function buildSimpleRoadNetwork(boundaryFeatures, circleFeatures) {
  const boundaryRing = boundaryFeatures[0]?.geometry?.coordinates;
  if (!boundaryRing) return { roads: [], roundabouts: [] };
  const lat0 = boundaryRing[0][1];

  const hubFeature = circleFeatures.find((f) => /^central plaza circle$/i.test(f.properties?.name || ''));
  const outerFeatures = circleFeatures.filter((f) => f !== hubFeature);

  // The real hub circle ("central Plaza circle", at the star's own centre)
  // is the network's real centre point — not the boundary polygon's
  // arithmetic centroid, which sits ~35m off from it.
  const hub = hubFeature ? circleCenterAndRadius(hubFeature, lat0).center : (() => {
    const pts = boundaryRing.slice(0, -1);
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  })();

  const roundaboutPoints = outerFeatures
    .map((f) => {
      const { center, radiusM } = circleCenterAndRadius(f, lat0);
      const bearing = (Math.atan2(center[0] - hub[0], center[1] - hub[1]) * 180) / Math.PI;
      return { name: f.properties.name, center, radiusM, bearing: (bearing + 360) % 360 };
    })
    .sort((a, b) => a.bearing - b.bearing);

  const roads = [];
  roads.push({
    type: 'Feature',
    properties: { name: 'Perimeter Road', tier: 'ring', widthMeters: SIMPLE_ROAD_WIDTH_M },
    geometry: { type: 'LineString', coordinates: boundaryRing },
  });
  for (const r of roundaboutPoints) {
    roads.push({
      type: 'Feature',
      properties: { name: `Radial — ${r.name}`, tier: 'radial', widthMeters: SIMPLE_ROAD_WIDTH_M },
      geometry: { type: 'LineString', coordinates: [hub, r.center] },
    });
  }
  // No repeated closing point here — closed: true below tells both
  // computeNormals() and ribbonMesh() in Campus2RoadLayer.jsx to wrap the
  // last vertex back to the first via modulo indexing. Repeating the first
  // point AND setting closed: true (the previous version of this code) put
  // two identical coordinates back-to-back, which made the wrap-around
  // "edge" between them zero-length — the ribbon's mitred normal at that
  // seam collapsed to a degenerate vector, leaving a visible gap in the
  // rendered road exactly at whichever roundabout the loop happened to
  // start/end on. Dropping the duplicate lets the same close-the-ring
  // trick used everywhere else in this file (real loop of N points, no
  // repeat) mitre that seam correctly like every other vertex.
  const loopCoords = roundaboutPoints.map((r) => r.center);
  roads.push({
    type: 'Feature',
    properties: { name: 'Roundabout Loop', tier: 'loop', widthMeters: SIMPLE_ROAD_WIDTH_M, closed: true },
    geometry: { type: 'LineString', coordinates: loopCoords },
  });

  const roundabouts = roundaboutPoints.map((r) => ({
    type: 'Feature',
    properties: { name: `Roundabout ${r.name}`, center: r.center, radiusMeters: r.radiusM },
    geometry: { type: 'Polygon', coordinates: [circlePolygon(r.center, r.radiusM)] },
  }));

  return { roads, roundabouts };
}

// zmu_campus_2_buildings.txt's 38 real footprints (building-201..236, plus
// building-209-pillar-1/2) — every one a plain solid polygon, no paired
// hollow/hole cut-outs like the central star complex has. Height comes from
// each feature's own real "N-floors" property, same 4m/floor conversion as
// every other real building in this app.
function buildExtraBuildings() {
  const raw = loadBuildingsSource();
  return raw.map((f) => {
    const floors = parseFloors(f.properties?.height) ?? 1;
    return {
      type: 'Feature',
      properties: {
        name: f.properties?.name,
        levels: floors,
        height: floors * METRES_PER_FLOOR,
      },
      geometry: f.geometry,
    };
  });
}

// zmu_campus_2_02.txt — "Phase 3" (sports & parking infrastructure). 20
// real features: 12 building footprints (building-237..244, some with
// "-terrace"/"-side-N-terrace" sub-parts), 3 parking lots, a parade
// ground/training area, 2 football grounds, 1 basketball court, and 1
// tennis court. The source has no bay markings, islands, trees, hoops,
// nets, fencing, or lighting coordinates for any of these — only the plain
// outline polygons — so that's all this renders; nothing here is invented
// beyond picking a plausible flat surface colour per category (done in the
// renderer, not here).
function buildPhase3() {
  const raw = loadPhase3Source();
  const buildings = [];
  const parkingLots = [];
  const grounds = [];

  for (const f of raw) {
    const name = f.properties?.name || '';
    if (/^building-/i.test(name)) {
      const floors = parseFloors(f.properties?.height) ?? 1;
      buildings.push({
        type: 'Feature',
        properties: { name, levels: floors, height: floors * METRES_PER_FLOOR },
        geometry: f.geometry,
      });
    } else if (/^parking lot-/i.test(name)) {
      parkingLots.push({ type: 'Feature', properties: { name }, geometry: f.geometry });
    } else {
      // parade ground/training area, football ground-1/2, basket ball
      // court-2, tennis court — all flat outdoor surfaces, just differing
      // in what colour they render as.
      let kind = 'ground';
      if (/parade ground/i.test(name)) kind = 'parade';
      else if (/football ground/i.test(name)) kind = 'football';
      else if (/basket ?ball/i.test(name)) kind = 'basketball';
      else if (/tennis/i.test(name)) kind = 'tennis';
      grounds.push({ type: 'Feature', properties: { name, kind }, geometry: f.geometry });
    }
  }

  return { buildings, parkingLots, grounds };
}

function build() {
  const source = loadSource();
  const boundaryFeatures = [];
  const circleFeatures = [];
  const buildingFeatures = [];

  for (const f of source.features) {
    const circleMeta = f.properties?.['@circle'];
    const name = f.properties?.name || circleMeta?.name || '';

    if (/campus.*2.*boundary|campuus_2 boundary/i.test(name)) {
      boundaryFeatures.push({
        type: 'Feature',
        properties: { name: 'Campus 2 Boundary' },
        geometry: f.geometry,
      });
      continue;
    }

    // Every @circle feature — including "central Plaza circle", the small
    // one at the star's own centre — is a road intersection, not a
    // building: same treatment (and same renderer) as the other 7. No
    // height, no building classification.
    if (circleMeta) {
      circleFeatures.push({
        type: 'Feature',
        properties: { name: circleMeta.name, center: circleMeta.center },
        geometry: f.geometry,
      });
      continue;
    }

    const cls = classify(f);
    if (!cls) {
      console.warn('Unclassified feature, skipping:', name);
      continue;
    }
    const floors = parseFloors(f.properties?.height) ?? 1;
    buildingFeatures.push({
      type: 'Feature',
      properties: {
        name: cls.name,
        part: cls.part, // 'corner' | 'middle' | 'hub'
        num: cls.num, // '1'..'5' for corner/middle, null for hub
        role: isHollow(cls.name) ? 'hole' : 'solid',
        levels: floors,
        height: floors * METRES_PER_FLOOR,
      },
      geometry: f.geometry,
    });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const writeFC = (name, features) => {
    fs.writeFileSync(
      path.join(OUT_DIR, name),
      JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    );
    console.log(`wrote ${name}: ${features.length} features`);
  };

  writeFC('campus_boundary.geojson', boundaryFeatures);
  writeFC('circular_structures.geojson', circleFeatures);
  writeFC('central_building.geojson', buildingFeatures);

  // Simple symmetrical wheel network (current) — see buildSimpleRoadNetwork().
  // buildRoads() (the real 5-segment zmu_campus_2_roads.txt network) is kept
  // defined above, just not called, in case the fuller real network is
  // wanted again later.
  const { roads, roundabouts } = buildSimpleRoadNetwork(boundaryFeatures, circleFeatures);
  writeFC('roads.geojson', roads);
  writeFC('roundabouts.geojson', roundabouts);

  writeFC('extra_buildings.geojson', buildExtraBuildings());

  // Phase 3 — sports & parking infrastructure, from zmu_campus_2_02.txt.
  const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const phase3 = buildPhase3();
  writeFC('buildings_02.geojson', phase3.buildings);
  for (const lot of phase3.parkingLots) writeFC(`${slugify(lot.properties.name)}.geojson`, [lot]);
  for (const g of phase3.grounds) writeFC(`${slugify(g.properties.name)}.geojson`, [g]);
}

if (require.main === module) build();

module.exports = { build };
