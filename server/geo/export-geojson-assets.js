/**
 * One-time export: converts the real, hand-digitized ZMU reference data
 * (../../../reference/, sibling to this repo) into static GeoJSON assets
 * under client/src/assets/geojson/, so the Digital Twin can run fully
 * offline with no PostgreSQL/PostGIS dependency.
 *
 * This ports the parsing/cleaning logic from import-zmu-real-structures.js
 * verbatim — same functions, same handling for every real quirk in these
 * files (degenerate stray-click features, the cumulative-file de-dup in
 * Zayed_Military_University_map.txt, the fence damage recovery, height/
 * floor-count extraction from surrounding label text, gross-area via the
 * shoelace formula). Only the output sink changes: GeoJSON files on disk
 * instead of INSERT statements into zmu_db. See that file's header for
 * the full quirk-by-quirk rationale — not repeated here.
 *
 * Two differences from the DB version:
 *  - File paths point at this repo's in-tree reference/ copy, and
 *    buildFromRoads' label regex matches this copy's actual "inner road"
 *    label (the DB version's original source said "inner main road").
 *  - No boundary/perimeter coordinates exist anywhere in the source data
 *    (confirmed — none of the 5 reference files contain one; the DB
 *    version never needed one, it came from a live OSM query instead).
 *    campus_boundary.geojson is derived by chaining the real fence
 *    segments into one closed ring (chainIntoBoundaryRing below) — every
 *    vertex is a real digitized fence point, only the connecting edges
 *    across gaps are synthetic straight lines, and the output is marked
 *    `approximate: true`, never presented as surveyed data.
 *
 * Run: node server/geo/export-geojson-assets.js
 *   or: npm run generate-geojson
 */
const fs = require('fs');
const path = require('path');

const REFERENCE_DIR = path.join(__dirname, '../../../reference');
const OUTPUT_DIR = path.join(__dirname, '../../client/src/assets/geojson');

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
// Standard area-weighted polygon centroid (shoelace-derived) — replaces
// the live ST_Centroid() SQL call the DB version relied on. Falls back to
// a plain vertex average for the degenerate zero-area case.
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-14) {
    const n = ring.length;
    return ring.reduce((s, [x, y]) => [s[0] + x / n, s[1] + y / n], [0, 0]);
  }
  return [cx / (6 * a), cy / (6 * a)];
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

// ── generic robust section/feature parser, reused for the 3 multi-section files ──
function parseSections(filePath, labelRe, { dedupe = false } = {}) {
  const RAW = fs.readFileSync(filePath, 'utf8').replace(/#[^\n]*/g, '');
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
  const filePath = path.join(REFERENCE_DIR, 'zmu_structures.txt');
  const sections = parseSections(filePath, /^(block|building|builidng|admin block|mosque|parking space)\s*-?\s*(\d+)?\s*:?\s*$/i);
  const HEIGHT_RE = /height\s*=\s*(\d+)\s*floors?/i;
  const RAW_LINES = fs.readFileSync(filePath, 'utf8').replace(/#[^\n]*/g, '').split('\n');
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
    const floorsResolved = floors || 1;
    const heightM = floorsResolved * 4;

    if (kind === 'block' && num === '3' && s.features.length === 2) {
      const [outer, hole] = s.features;
      buildings.push({
        id: 'REAL-BLOCK-3', display_name: 'Block 3', category: 'structure',
        levels: floorsResolved, levels_estimated: floors == null, height: heightM,
        gross_area: Math.round(ringAreaM2(outer.geometry.coordinates[0]) - ringAreaM2(hole.geometry.coordinates[0])),
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
          levels: floorsResolved, levels_estimated: floors == null, height: h, gross_area: Math.round(ringAreaM2(ring)), ring,
        });
      });
      continue;
    }
    if (kind === 'admin block') {
      const ring = s.features[0].geometry.coordinates[0];
      buildings.push({
        id: 'REAL-ADMIN-1', display_name: 'Administration Building', category: 'administration',
        levels: floorsResolved, levels_estimated: floors == null, height: heightM, gross_area: Math.round(ringAreaM2(ring)), ring,
      });
      continue;
    }
    s.features.forEach((f, i) => {
      const label = kind === 'block' ? `Block ${num}` : `Building ${num}`;
      const ring = f.geometry.coordinates[0];
      buildings.push({
        id: `REAL-${kind.toUpperCase()}-${num}${s.features.length > 1 ? `-${i + 1}` : ''}`,
        display_name: s.features.length > 1 ? `${label} (${i + 1})` : label,
        category: 'structure', levels: floorsResolved, levels_estimated: floors == null, height: heightM,
        gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    });
  }
  return { buildings, parking };
}

function buildFromMap2() {
  const filePath = path.join(REFERENCE_DIR, 'Zayed_Military_University_map.txt');
  const sections = parseSections(filePath, /^(building\s*\d+:?|helipad)$/i, { dedupe: true });
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
        levels: DEFAULT_LEVELS, levels_estimated: true, height: DEFAULT_LEVELS * 4,
        gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    });
  }
  return { buildings, grounds };
}

function buildFromStructures2() {
  const filePath = path.join(REFERENCE_DIR, 'zmu_structures_2.txt');
  const sections = parseSections(filePath, /^(\d+\s*football ground|buildings with (\d+) floors)$/i);
  const buildings = [];
  const sportsFields = [];
  for (const s of sections) {
    if (/football ground/i.test(s.key)) {
      s.features.forEach((f) => {
        const ring = f.geometry.coordinates[0].slice(0, -1); // drop closing repeat of point 0
        // 2 pitch layouts within the ONE real digitized boundary — a
        // geometric split of real data, not new digitized area.
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
        levels: floors, levels_estimated: false, height: heightM, gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    });
  }
  return { buildings, sportsFields };
}

// zmu_road.txt has a different geometry mix (LineStrings + one Polygon)
// than the other multi-section files, so it gets its own small parser
// rather than reusing parseSections (which assumes every feature is a
// polygon ring for its degenerate-area check).
function buildFromRoads() {
  const filePath = path.join(REFERENCE_DIR, 'zmu_road.txt');
  const RAW = fs.readFileSync(filePath, 'utf8').replace(/#[^\n]*/g, '');
  const lines = RAW.split('\n');
  const labelRe = /^(outer road|main gate|inner road)$/i;
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
      const highway = name === 'outer road' ? 'primary' : name === 'inner road' ? 'secondary' : 'unclassified';
      const displayName = name === 'outer road' ? 'Outer Road' : name === 'inner road' ? 'Inner Road' : 'Road';
      roads.push({ id: `REAL-ROAD-${roadIdx}`, name: displayName, highway, coords: geom.coordinates });
    } else if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0];
      buildings.push({
        id: 'REAL-GATE-1', display_name: 'Main Gate', category: 'gate',
        levels: null, levels_estimated: true, height: 5, // no floor count in source — a disclosed schematic gate-structure height
        gross_area: Math.round(ringAreaM2(ring)), ring,
      });
    }
  }
  return { roads, buildings };
}

// zmu_fence.txt has real copy/paste damage in one of its 2 features (its
// geometry.type says "Point" but coordinates is a stray bare number
// followed by 9 real [lon,lat] pairs; properties carries an unrelated
// geocoder search-result label). Every feature is recovered the same
// type-agnostic way: filter coordinates down to real [number,number]
// pairs, drop consecutive duplicates, ignore properties entirely. The
// recovered point sequences also mix real short digitized runs with a
// handful of much larger "pen up, move, pen down" jumps between separate
// fence stretches — split into separate real runs wherever a consecutive-
// point distance exceeds a threshold clearly between the real short-run
// distances and the jump distances.
const FENCE_SPLIT_THRESHOLD_M = 45;
function splitFenceRuns(coords) {
  const runs = [];
  let current = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1], [lon2, lat2] = coords[i];
    const dx = (lon2 - lon1) * M_PER_DEG_LON, dy = (lat2 - lat1) * M_PER_DEG_LAT;
    const dm = Math.hypot(dx, dy);
    if (dm > FENCE_SPLIT_THRESHOLD_M) {
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
  const filePath = path.join(REFERENCE_DIR, 'zmu_fence.txt');
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

// No boundary/perimeter coordinates exist anywhere in the source data.
// Derives an approximate campus boundary by greedily chaining the real
// fence segments end-to-end (nearest remaining endpoint each step), then
// closing the loop back to the start. Every vertex is a real digitized
// fence point; only the connecting edges across gaps (including the final
// closing edge) are synthetic straight lines bridging real endpoints.
function chainIntoBoundaryRing(fenceSegments) {
  if (!fenceSegments.length) return null;
  const remaining = fenceSegments.map((f) => f.coords.slice());
  let chain = remaining.shift();
  while (remaining.length) {
    const tail = chain[chain.length - 1];
    let bestIdx = -1, bestReversed = false, bestDist = Infinity;
    remaining.forEach((seg, i) => {
      const dStart = distM(tail, seg[0]);
      const dEnd = distM(tail, seg[seg.length - 1]);
      if (dStart < bestDist) { bestDist = dStart; bestIdx = i; bestReversed = false; }
      if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; bestReversed = true; }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    chain = chain.concat(bestReversed ? next.slice().reverse() : next);
  }
  const first = chain[0], last = chain[chain.length - 1];
  if (distM(first, last) > 1e-6) chain = chain.concat([first]);
  return chain;
}

function writeFC(fileName, features) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify({ type: 'FeatureCollection', features }, null, 2));
}

function buildingFeature(b) {
  return {
    type: 'Feature',
    properties: {
      id: b.id, display_name: b.display_name, category: b.category,
      height: b.height, levels: b.levels, levels_estimated: !!b.levels_estimated,
      gross_area: b.gross_area, large_span: false, osm_id: null, centroid: ringCentroid(b.ring),
    },
    geometry: { type: 'Polygon', coordinates: b.holeRing ? [b.ring, b.holeRing] : [b.ring] },
  };
}

function main() {
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

  writeFC('buildings.geojson', buildings.map(buildingFeature));

  writeFC('roads.geojson', roads.map((r) => ({
    type: 'Feature', properties: { id: r.id, name: r.name, highway: r.highway },
    geometry: { type: 'LineString', coordinates: r.coords },
  })));

  writeFC('fence.geojson', fences.map((f) => ({
    type: 'Feature', properties: { id: f.id, name: f.name },
    geometry: { type: 'LineString', coordinates: f.coords },
  })));

  const boundaryRing = chainIntoBoundaryRing(fences);
  writeFC('campus_boundary.geojson', boundaryRing ? [{
    type: 'Feature',
    properties: { name: 'Campus Boundary (derived)', approximate: true },
    geometry: { type: 'Polygon', coordinates: [boundaryRing] },
  }] : []);

  writeFC('football_ground.geojson', sportsFields.map((sf) => ({
    type: 'Feature', properties: { id: sf.id, name: sf.name, leisure: 'pitch', kind: 'pitch' },
    geometry: { type: 'Polygon', coordinates: [sf.ring] },
  })));

  writeFC('parking.geojson', parking.map((p) => ({
    type: 'Feature', properties: { id: p.id, name: p.name },
    geometry: { type: 'Polygon', coordinates: [p.ring] },
  })));

  writeFC('helipad.geojson', grounds.map((g) => ({
    type: 'Feature', properties: { id: g.id, name: g.name, kind: g.kind },
    geometry: { type: 'Polygon', coordinates: [g.ring] },
  })));

  // No digitized data exists anywhere for these — matches today's
  // always-empty behavior (they were 0-row OSM queries even with a live DB).
  writeFC('gates.geojson', []);
  writeFC('trees.geojson', []);
  writeFC('water.geojson', []);

  console.log(`Wrote GeoJSON assets to ${OUTPUT_DIR}:`);
  console.log(`  buildings: ${buildings.length} (incl. ${b.buildings.length} height-defaulted, 1 gate structure)`);
  console.log(`  parking: ${parking.length}`);
  console.log(`  roads: ${roads.length}`);
  console.log(`  fence segments: ${fences.length}`);
  console.log(`  football pitches: ${sportsFields.length}`);
  console.log(`  helipad polygons: ${grounds.length}`);
  console.log(`  campus boundary ring points: ${boundaryRing ? boundaryRing.length : 0}`);
}

main();
