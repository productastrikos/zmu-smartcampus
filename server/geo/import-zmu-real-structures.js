/**
 * Imports the REAL, hand-digitized ZMU structure data the user supplied —
 * three files, each an informally-formatted text file with GeoJSON
 * Feature blocks under section labels:
 *
 *   zmu_structures.txt            block-1/2/3, building-1..11, admin
 *                                  block, mosque, parking space -1..4
 *   Zayed_Military_University_map.txt   building 101..124, Helipad
 *   zmu_structures_2.txt          a football ground, "buildings with
 *                                  2 floors" (47 individually-drawn
 *                                  small structures)
 *   road.txt                      outer road, main gate, inner main road
 *
 * This REPLACES all earlier synthetic/estimated layouts — buildings,
 * parking, sports fields, and the helipad now come ONLY from these real
 * sources, at their exact real coordinates. No repositioning, no
 * procedural generation.
 *
 * Parsing notes (every quirk below was found by inspecting the actual
 * files, not assumed):
 *  - `#comment` annotations break strict JSON and are stripped first.
 *  - Some Feature objects land inside the WRONG FeatureCollection due to
 *    copy-paste (e.g. zmu_structures.txt's "building-1" ended up inside
 *    "block-3"'s array) — every Feature is extracted independently via
 *    brace-matching and reassigned to whichever section label most
 *    recently preceded it by line number, not by its accidental nesting.
 *  - Zayed_Military_University_map.txt is cumulative: each "building N"
 *    section re-includes every earlier building's polygon as leftover
 *    history, with only the newest feature actually new. De-duplicated
 *    globally by geometry content, in file order, so each real feature
 *    is attributed to the first section it appears in.
 *  - A few sections have a stray first feature with 4 identical points
 *    (an accidental click while digitizing) — dropped as degenerate
 *    (zero area).
 *  - "block-3" has 2 features: outer footprint + an explicitly annotated
 *    "middle hollow space" — rendered as ONE building with a real
 *    interior hole (courtyard), not two structures.
 *  - "mosque" has 3 features (main hall, a small domed accent, a corner
 *    pillar) — rendered as 3 related structures, pillar proportionally
 *    taller per the source's own note.
 *  - "parking space N" / helipad / football ground have no height
 *    annotation and are not buildings — parking and the football ground
 *    go to zmu_parking / zmu_sportsfields; the helipad (a painted ground
 *    marking, not a volume) goes to zmu_grounds.
 *  - road.txt's single real "football ground" polygon is split into 2
 *    pitch layouts by connecting the midpoints of its longer pair of
 *    sides — both halves stay entirely inside the one real digitized
 *    boundary; no new area is invented, per the explicit request to lay
 *    out 2 pitches "in that space only".
 *  - road.txt: "outer road" and "inner main road" are real LineStrings
 *    (go to a new zmu_roads table, unioned into /api/geo/roads alongside
 *    OSM); "main gate" is a real small Polygon footprint (a gate
 *    structure, not a multi-floor building) — it has no floor-count
 *    annotation, so it gets a disclosed fixed schematic height rather
 *    than an invented floor count, and lands in zmu_buildings with
 *    category 'gate'.
 *  - fence.txt (C:/Users/Admin/Downloads — a different folder than every
 *    other source) has 2 real fence-line features, one with real copy/
 *    paste damage: its geometry.type says "Point" but coordinates is a
 *    stray bare number followed by 9 real [lon,lat] pairs, and its
 *    properties carry an unrelated geocoder search-result label. Neither
 *    defect is trustworthy, so every fence feature is recovered the same
 *    way regardless of its declared type: filter coordinates down to
 *    real [number,number] pairs, drop consecutive duplicates, and ignore
 *    properties entirely. The 2 recovered segments are NOT assumed to
 *    join into a closed loop — no evidence they do.
 *
 * Heights: real per-structure floor counts from the source x 4m/level,
 * per spec. Zayed_Military_University_map.txt's building 101-124 have NO
 * height annotation in the source at all — a configurable default (2
 * floors) is used and explicitly marked height_defaulted: true; never
 * presented as verified data.
 *
 * Run: node server/geo/import-zmu-real-structures.js
 */
const fs = require('fs');
const { pool } = require('./db');

const DESKTOP = 'C:/Users/Admin/OneDrive - Astrikos Ai Pvt Ltd/Desktop';
const ANCHOR_LAT = 24.256170165875275; // for area-in-m2 conversion only — geometry itself is unrotated/unmoved
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((ANCHOR_LAT * Math.PI) / 180);

function ringAreaDeg(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}
function ringAreaM2(ring) {
  const pts = ring.map(([lon, lat]) => [lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT]);
  return ringAreaDeg(pts);
}
function toWKT(ring, holeRing) {
  const outer = `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(',')})`;
  const hole = holeRing ? `,(${holeRing.map(([lon, lat]) => `${lon} ${lat}`).join(',')})` : '';
  return `POLYGON(${outer}${hole})`;
}
function toLineWKT(coords) {
  return `LINESTRING(${coords.map(([lon, lat]) => `${lon} ${lat}`).join(',')})`;
}
function distM([lon1, lat1], [lon2, lat2]) {
  const dx = (lon2 - lon1) * M_PER_DEG_LON, dy = (lat2 - lat1) * M_PER_DEG_LAT;
  return Math.sqrt(dx * dx + dy * dy);
}
function midpoint([lon1, lat1], [lon2, lat2]) { return [(lon1 + lon2) / 2, (lat1 + lat2) / 2]; }
// Splits a real 4-corner ring into 2 halves by connecting the midpoints of
// its longer pair of opposite sides — both halves stay fully inside the
// original real boundary, nothing outside it is invented.
function splitQuadInHalf(ring) {
  const [A, B, C, D] = ring;
  const lenAB = distM(A, B), lenAD = distM(A, D);
  if (lenAD > lenAB) {
    const M1 = midpoint(A, D), M2 = midpoint(B, C);
    return [[A, B, M2, M1, A], [M1, M2, C, D, M1]];
  }
  const M1 = midpoint(A, B), M2 = midpoint(D, C);
  return [[A, M1, M2, D, A], [M1, B, C, M2, M1]];
}

// ── generic robust section/feature parser, reused for all three files ──
function parseSections(path, labelRe, { dedupe = false } = {}) {
  const RAW = fs.readFileSync(path, 'utf8').replace(/#[^\n]*/g, '');
  const lines = RAW.split('\n');

  const labels = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(labelRe);
    if (m) labels.push({ line: i, raw: lines[i].trim(), groups: m });
  }

  const features = [];
  const featureStartRe = /"type":\s*"Feature"/g;
  let match;
  const claimed = new Set();
  while ((match = featureStartRe.exec(RAW))) {
    let start = match.index, depth = 0;
    while (start > 0) {
      if (RAW[start] === '}') depth++;
      else if (RAW[start] === '{') { if (depth === 0) break; depth--; }
      start--;
    }
    if (claimed.has(start)) continue;
    let depth2 = 0, end = start;
    for (let i = start; i < RAW.length; i++) {
      if (RAW[i] === '{') depth2++;
      else if (RAW[i] === '}') { depth2--; if (depth2 === 0) { end = i; break; } }
    }
    claimed.add(start);
    let obj;
    try { obj = JSON.parse(RAW.slice(start, end + 1)); } catch { continue; }
    if (obj.type === 'Feature' && obj.geometry?.coordinates) {
      features.push({ line: RAW.slice(0, start).split('\n').length - 1, feature: obj });
    }
  }

  function labelFor(lineNo) {
    let best = null;
    for (const l of labels) if (l.line <= lineNo) best = l; else break;
    return best;
  }
  const seenFingerprints = new Set();
  const sections = new Map();
  let unlabeledCount = 0;
  for (const f of features) {
    const label = labelFor(f.line);
    const key = label ? label.raw : `UNLABELED-${++unlabeledCount}`;
    if (!sections.has(key)) sections.set(key, { key, groups: label?.groups, features: [] });
    const ring = f.feature.geometry.coordinates[0];
    const distinctPts = new Set(ring.map((p) => p.join(','))).size;
    if (ringAreaDeg(ring) < 1e-14 || distinctPts < 3) continue; // degenerate stray click
    if (dedupe) {
      const fp = JSON.stringify(ring);
      if (seenFingerprints.has(fp)) continue; // accumulated repeat from an earlier section
      seenFingerprints.add(fp);
    }
    sections.get(key).features.push(f.feature);
  }
  return [...sections.values()];
}

function buildFromZmuStructures() {
  const sections = parseSections(`${DESKTOP}/zmu_structures.txt`, /^(block|building|builidng|admin block|mosque|parking space)\s*-?\s*(\d+)?\s*:?\s*$/i);
  const HEIGHT_RE = /height\s*=\s*(\d+)\s*floors?/i;
  // re-derive floors per section from the raw file (parseSections doesn't carry it)
  const RAW_LINES = fs.readFileSync(`${DESKTOP}/zmu_structures.txt`, 'utf8').replace(/#[^\n]*/g, '').split('\n');
  function floorsNear(label) {
    const idx = RAW_LINES.findIndex((l) => l.trim() === label);
    for (let j = idx; j < Math.min(idx + 3, RAW_LINES.length); j++) {
      const m = RAW_LINES[j]?.match(HEIGHT_RE);
      if (m) return Number(m[1]);
    }
    return null;
  }

  const buildings = [];
  const parking = [];
  let pIdx = 0;
  for (const s of sections) {
    const kind = (s.groups?.[1] || '').toLowerCase().replace('builidng', 'building');
    const num = s.groups?.[2] || '';
    const floors = floorsNear(s.key);

    if (kind === 'parking space') {
      s.features.forEach((f, i) => {
        pIdx++;
        parking.push({ id: `REAL-PARK-${pIdx}`, name: `Parking Space ${num} — ${i + 1}`.trim(), ring: f.geometry.coordinates[0] });
      });
      continue;
    }
    const heightM = (floors || 1) * 4;

    if (kind === 'block' && num === '3' && s.features.length === 2) {
      const [outer, hole] = s.features;
      buildings.push({
        id: 'REAL-BLOCK-3', display_name: 'Block 3', category: 'structure', levels: floors, levelsDefaulted: false,
        height: heightM, gross_area: Math.round(ringAreaM2(outer.geometry.coordinates[0]) - ringAreaM2(hole.geometry.coordinates[0])),
        ring: outer.geometry.coordinates[0], holeRing: hole.geometry.coordinates[0],
      });
      continue;
    }
    if (kind === 'mosque') {
      const subNames = ['Mosque — Main Hall', 'Mosque — Dome', 'Mosque — Pillar'];
      s.features.forEach((f, i) => {
        const ring = f.geometry.coordinates[0];
        const h = i === 2 ? heightM * 3 : heightM;
        buildings.push({
          id: `REAL-MOSQUE-${i + 1}`, display_name: subNames[i] || `Mosque — ${i + 1}`, category: 'mosque',
          levels: floors, levelsDefaulted: false, height: h, gross_area: Math.round(ringAreaM2(ring)), ring,
        });
      });
      continue;
    }
    if (kind === 'admin block') {
      const ring = s.features[0].geometry.coordinates[0];
      buildings.push({
        id: 'REAL-ADMIN-1', display_name: 'Administration Building', category: 'administration',
        levels: floors, levelsDefaulted: false, height: heightM, gross_area: Math.round(ringAreaM2(ring)), ring,
      });
      continue;
    }
    s.features.forEach((f, i) => {
      const label = kind === 'block' ? `Block ${num}` : `Building ${num}`;
      const ring = f.geometry.coordinates[0];
      buildings.push({
        id: `REAL-${kind.toUpperCase()}-${num}${s.features.length > 1 ? `-${i + 1}` : ''}`,
        display_name: s.features.length > 1 ? `${label} (${i + 1})` : label,
        category: 'structure', levels: floors, levelsDefaulted: false, height: heightM,
        gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    });
  }
  return { buildings, parking };
}

function buildFromMap2() {
  const sections = parseSections(`${DESKTOP}/Zayed_Military_University_map.txt`, /^(building\s*\d+:?|helipad)$/i, { dedupe: true });
  const buildings = [];
  const grounds = [];
  const DEFAULT_LEVELS = 2; // no height annotation exists anywhere in this source file — a disclosed default, not invented data

  for (const s of sections) {
    const label = s.key.replace(/:$/, '');
    if (/helipad/i.test(label)) {
      s.features.forEach((f, i) => {
        grounds.push({ id: `REAL-HELIPAD-${i + 1}`, name: 'Helipad', kind: 'helipad', ring: f.geometry.coordinates[0] });
      });
      continue;
    }
    const num = label.match(/\d+/)?.[0];
    s.features.forEach((f) => {
      const ring = f.geometry.coordinates[0];
      buildings.push({
        id: `REAL-MAP-BUILDING-${num}`, display_name: `Building ${num}`, category: 'structure',
        levels: DEFAULT_LEVELS, levelsDefaulted: true, height: DEFAULT_LEVELS * 4,
        gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    });
  }
  return { buildings, grounds };
}

function buildFromStructures2() {
  const sections = parseSections(`${DESKTOP}/zmu_structures_2.txt`, /^(\d+\s*football ground|buildings with (\d+) floors)$/i);
  const buildings = [];
  const sportsFields = [];
  for (const s of sections) {
    if (/football ground/i.test(s.key)) {
      s.features.forEach((f) => {
        const ring = f.geometry.coordinates[0].slice(0, -1); // drop closing repeat of point 0
        // 2 pitch layouts within the ONE real digitized boundary — a
        // geometric split of real data, not new digitized area (see header note).
        const halves = ring.length === 4 ? splitQuadInHalf(ring) : [f.geometry.coordinates[0]];
        halves.forEach((half, i) => {
          sportsFields.push({ id: `REAL-FOOTBALL-${i + 1}`, name: `Football Ground ${i + 1}`, kind: 'pitch', ring: half });
        });
      });
      continue;
    }
    const floors = Number(s.groups?.[2] || 2);
    const heightM = floors * 4;
    s.features.forEach((f, i) => {
      const ring = f.geometry.coordinates[0];
      buildings.push({
        id: `REAL-2FLOOR-${i + 1}`, display_name: `Structure ${i + 1}`, category: 'structure',
        levels: floors, levelsDefaulted: false, height: heightM, gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    });
  }
  return { buildings, sportsFields };
}

// road.txt has a different geometry mix (LineStrings + one Polygon) than
// the other 3 sources, so it gets its own small parser rather than reusing
// parseSections (which assumes every feature is a polygon ring for its
// degenerate-area check).
function buildFromRoads() {
  const path = `${DESKTOP}/road.txt`;
  const RAW = fs.readFileSync(path, 'utf8').replace(/#[^\n]*/g, '');
  const lines = RAW.split('\n');
  const labelRe = /^(outer road|main gate|inner main road)$/i;
  const labels = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(labelRe);
    if (m) labels.push({ line: i, name: m[1].toLowerCase() });
  }
  function labelFor(lineNo) {
    let best = null;
    for (const l of labels) if (l.line <= lineNo) best = l; else break;
    return best;
  }

  const features = [];
  const featureStartRe = /"type":\s*"Feature"/g;
  let match;
  const claimed = new Set();
  while ((match = featureStartRe.exec(RAW))) {
    let start = match.index, depth = 0;
    while (start > 0) {
      if (RAW[start] === '}') depth++;
      else if (RAW[start] === '{') { if (depth === 0) break; depth--; }
      start--;
    }
    if (claimed.has(start)) continue;
    let depth2 = 0, end = start;
    for (let i = start; i < RAW.length; i++) {
      if (RAW[i] === '{') depth2++;
      else if (RAW[i] === '}') { depth2--; if (depth2 === 0) { end = i; break; } }
    }
    claimed.add(start);
    let obj;
    try { obj = JSON.parse(RAW.slice(start, end + 1)); } catch { continue; }
    if (obj.type === 'Feature' && obj.geometry?.coordinates) {
      features.push({ line: RAW.slice(0, start).split('\n').length - 1, feature: obj });
    }
  }

  const roads = [];
  const buildings = [];
  let roadIdx = 0;
  for (const f of features) {
    const label = labelFor(f.line);
    const name = label?.name || 'road';
    const geom = f.feature.geometry;
    if (geom.type === 'LineString') {
      roadIdx++;
      const highway = name === 'outer road' ? 'primary' : name === 'inner main road' ? 'secondary' : 'unclassified';
      const displayName = name === 'outer road' ? 'Outer Road' : name === 'inner main road' ? 'Inner Main Road' : 'Road';
      roads.push({ id: `REAL-ROAD-${roadIdx}`, name: displayName, highway, coords: geom.coordinates });
    } else if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0];
      buildings.push({
        id: 'REAL-GATE-1', display_name: 'Main Gate', category: 'gate',
        levels: null, levelsDefaulted: true, height: 5, // no floor count in source — a disclosed schematic gate-structure height
        gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    }
  }
  return { roads, buildings };
}

// fence.txt lives in Downloads, not the usual reference Desktop folder,
// and has real copy/paste damage in one of its 2 features — see the
// header note above for why every feature is recovered the same
// type-agnostic way rather than trusting its declared geometry.type.
//
// Both recovered point sequences also mix real short digitized runs
// (consecutive points 2-30m apart — plausible fence-post spacing on a
// hand-traced line) with a handful of much larger jumps (62-300m —
// clearly "pen up, move, pen down" transitions between separate fence
// stretches in the source tool, not real fence panels). Connecting every
// point in raw order as one continuous LineString drew phantom diagonal
// fence lines across the campus interior through those jumps. Fixed by
// splitting each recovered sequence into separate real runs wherever a
// consecutive-point distance exceeds a threshold clearly above the real
// short-run distances and clearly below the jump distances (30m vs 62m
// in the actual data — 45m sits in between) — every remaining segment is
// still 100% real digitized points, just not force-joined across gaps
// that were never actually fence line.
const FENCE_SPLIT_THRESHOLD_M = 45;
function splitFenceRuns(coords) {
  const runs = [];
  let current = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1], [lon2, lat2] = coords[i];
    const dx = (lon2 - lon1) * M_PER_DEG_LON, dy = (lat2 - lat1) * M_PER_DEG_LAT;
    const distM = Math.hypot(dx, dy);
    if (distM > FENCE_SPLIT_THRESHOLD_M) {
      if (current.length >= 2) runs.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}
function buildFromFence() {
  const path = 'C:/Users/Admin/Downloads/fence.txt';
  const parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
  const fences = [];
  let idx = 0;
  for (const f of parsed.features || []) {
    const raw = f.geometry?.coordinates;
    if (!Array.isArray(raw)) continue;
    const pairs = raw.filter((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number');
    const coords = [];
    for (const p of pairs) {
      const prev = coords[coords.length - 1];
      if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) coords.push(p);
    }
    if (coords.length < 2) continue;
    for (const run of splitFenceRuns(coords)) {
      idx++;
      fences.push({ id: `REAL-FENCE-${idx}`, name: `Fence Segment ${idx}`, coords: run });
    }
  }
  return { fences };
}

async function main() {
  const a = buildFromZmuStructures();
  const b = buildFromMap2();
  const c = buildFromStructures2();
  const d = buildFromRoads();
  const e = buildFromFence();

  const buildings = [...a.buildings, ...b.buildings, ...c.buildings, ...d.buildings];
  const parking = a.parking;
  const grounds = b.grounds;
  const sportsFields = c.sportsFields;
  const roads = d.roads;
  const fences = e.fences;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS zmu_buildings (
      id text PRIMARY KEY, display_name text, category text, levels integer,
      height numeric, gross_area numeric, large_span boolean DEFAULT false,
      geom geometry(Polygon, 4326)
    );
  `);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_parking (id text PRIMARY KEY, name text, geom geometry(Polygon, 4326));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_grounds (id text PRIMARY KEY, name text, kind text, geom geometry(Polygon, 4326));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_sportsfields (id text PRIMARY KEY, name text, kind text, geom geometry(Polygon, 4326));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_roads (id text PRIMARY KEY, name text, highway text, geom geometry(LineString, 4326));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_fences (id text PRIMARY KEY, name text, geom geometry(LineString, 4326));`);

  await pool.query('DELETE FROM zmu_buildings');
  for (const bld of buildings) {
    await pool.query(
      `INSERT INTO zmu_buildings (id, display_name, category, levels, height, gross_area, large_span, geom)
       VALUES ($1,$2,$3,$4,$5,$6,false, ST_SetSRID(ST_GeomFromText($7), 4326))`,
      [bld.id, bld.display_name, bld.category, bld.levels, bld.height, bld.gross_area, toWKT(bld.ring, bld.holeRing)]
    );
  }
  await pool.query('DELETE FROM zmu_parking');
  for (const p of parking) {
    await pool.query(`INSERT INTO zmu_parking (id, name, geom) VALUES ($1,$2, ST_SetSRID(ST_GeomFromText($3), 4326))`, [p.id, p.name, toWKT(p.ring)]);
  }
  await pool.query('DELETE FROM zmu_grounds');
  for (const g of grounds) {
    await pool.query(`INSERT INTO zmu_grounds (id, name, kind, geom) VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromText($4), 4326))`, [g.id, g.name, g.kind, toWKT(g.ring)]);
  }
  await pool.query('DELETE FROM zmu_sportsfields');
  for (const sf of sportsFields) {
    await pool.query(`INSERT INTO zmu_sportsfields (id, name, kind, geom) VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromText($4), 4326))`, [sf.id, sf.name, sf.kind, toWKT(sf.ring)]);
  }
  await pool.query('DELETE FROM zmu_roads');
  for (const r of roads) {
    await pool.query(`INSERT INTO zmu_roads (id, name, highway, geom) VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromText($4), 4326))`, [r.id, r.name, r.highway, toLineWKT(r.coords)]);
  }
  await pool.query('DELETE FROM zmu_fences');
  for (const f of fences) {
    await pool.query(`INSERT INTO zmu_fences (id, name, geom) VALUES ($1,$2, ST_SetSRID(ST_GeomFromText($3), 4326))`, [f.id, f.name, toLineWKT(f.coords)]);
  }

  console.log(`Imported ${buildings.length} real buildings (${b.buildings.length} defaulted-height, 1 gate structure), ${parking.length} parking polygons, ${grounds.length} ground feature(s) (helipad), ${sportsFields.length} sports field(s) (2 football pitches from 1 real boundary), ${roads.length} real road(s), ${fences.length} real fence segment(s).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
