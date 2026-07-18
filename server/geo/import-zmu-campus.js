/**
 * Rebuilds the ZMU authoritative campus tables (zmu_buildings,
 * zmu_sportsfields, zmu_parking, zmu_grounds) from a disclosed best-effort
 * digitization of real aerial imagery of the actual Zayed Military
 * University campus — not a fictional layout. Categories, clustering, and
 * relative spatial arrangement follow what's visible in the imagery:
 *   - a parade ground + helipad + large-span sports/utility buildings at
 *     one end,
 *   - an administration/gatehouse cluster near the entrance,
 *   - a dense academic/support core (library, labs, dining, medical,
 *     mosque, student services) in the middle,
 *   - two rows of long residential (barracks-style) blocks,
 *   - parking areas and an outdoor football field.
 *
 * Building names are intentionally neutral/category-based (per spec) —
 * NOT invented official names. Building heights/levels come from a
 * per-category configuration table (BUILDING_CATEGORY_CONFIG below), an
 * estimate, not verified official data — every row is marked
 * levels_estimated: true downstream.
 *
 * This is not survey-grade photogrammetry: no embedded geo-metadata exists
 * for the source image, so positions are a proportion-based best effort,
 * anchored on the one real, verified fact in zmu_db — the actual
 * landuse=military boundary polygon and the real road bearing already
 * confirmed there (~-30 degrees off north).
 *
 * Run: node server/geo/import-zmu-campus.js
 */
const { pool } = require('./db');

const ANCHOR_LON = 54.38667022649094;
const ANCHOR_LAT = 24.256170165875275;
const ROTATION_DEG = -30;

const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((ANCHOR_LAT * Math.PI) / 180);
const THETA = (ROTATION_DEG * Math.PI) / 180;

function uvToLonLat(u, v) {
  const east = u * Math.cos(THETA) - v * Math.sin(THETA);
  const north = u * Math.sin(THETA) + v * Math.cos(THETA);
  return [ANCHOR_LON + east / M_PER_DEG_LON, ANCHOR_LAT + north / M_PER_DEG_LAT];
}
function rectRing(u0, v0, u1, v1) {
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]].map(([u, v]) => uvToLonLat(u, v));
}
function toWKT(ring) {
  return `POLYGON((${ring.map(([lon, lat]) => `${lon} ${lat}`).join(',')}))`;
}

// Category defaults — an estimate/configuration, not verified official
// data (see BuildingService.js, which marks every record levels_estimated).
const BUILDING_CATEGORY_CONFIG = {
  administration: { levels: 4, heightPerLevel: 3.6 },
  academic: { levels: 3, heightPerLevel: 3.6 },
  library: { levels: 3, heightPerLevel: 3.6 },
  labs: { levels: 3, heightPerLevel: 3.6 },
  training: { levels: 2, heightPerLevel: 3.6 },
  research: { levels: 2, heightPerLevel: 3.6 },
  student_services: { levels: 2, heightPerLevel: 3.6 },
  dining: { levels: 2, heightPerLevel: 3.6 },
  medical: { levels: 3, heightPerLevel: 3.6 },
  mosque: { levels: 1, heightPerLevel: 4.2 },
  security: { levels: 1, heightPerLevel: 3.4 },
  utility: { levels: 1, heightPerLevel: 4 },
  maintenance: { levels: 2, heightPerLevel: 3.8 },
  residential: { levels: 5, heightPerLevel: 3.6 },
  // Large-span, low-rise — clear wall height + a separate roof rise, not
  // levels x storey-height (see BuildingLayer.jsx's gable-roof cap).
  sports_complex: { levels: 1, heightPerLevel: 11, largeSpan: true, roofRise: 5 },
  parade_hall: { levels: 1, heightPerLevel: 9, largeSpan: true, roofRise: 4 },
};

const buildings = [];
function addBuilding(id, display_name, category, u0, v0, u1, v1) {
  const cfg = BUILDING_CATEGORY_CONFIG[category];
  const height = cfg.levels * cfg.heightPerLevel;
  const areaM2 = Math.round(Math.abs(u1 - u0) * Math.abs(v1 - v0));
  buildings.push({
    id, display_name, category,
    levels: cfg.levels, height, gross_area: areaM2, large_span: !!cfg.largeSpan,
    ring: rectRing(u0, v0, u1, v1),
  });
}

// ── Entrance / administration cluster ──────────────────────────────────
addBuilding('ADMIN-1', 'Administration Building', 'administration', -90, 130, 30, 172);
addBuilding('GATE-1', 'Security Gatehouse', 'security', 35, 150, 55, 168);

// ── Academic / support core ─────────────────────────────────────────────
addBuilding('ACAD-A', 'Academic Block A', 'academic', -100, 82, -15, 122);
addBuilding('ACAD-B', 'Academic Block B', 'academic', -10, 82, 75, 122);
addBuilding('ACAD-C', 'Academic Block C', 'academic', 80, 86, 160, 122);
addBuilding('LIB-1', 'Library', 'library', -165, 84, -110, 120);
addBuilding('LAB-1', 'Engineering Labs', 'labs', 165, 60, 225, 96);
addBuilding('TRAIN-1', 'Training Centre', 'training', 165, 100, 225, 130);

// ── Support zone ─────────────────────────────────────────────────────────
addBuilding('DINE-1', 'Dining Facility', 'dining', -45, 32, 45, 70);
addBuilding('STORE-1', 'Utility Plant', 'utility', 60, 30, 126, 60);
addBuilding('MED-1', 'Medical Centre', 'medical', 130, 28, 175, 58);
addBuilding('SVC-1', 'Student Services', 'student_services', -215, 30, -172, 62);
addBuilding('MOSQUE-1', 'Mosque', 'mosque', -48, 0, -20, 25);

// ── Parade Hall — large-span ceremonial/assembly building ───────────────
addBuilding('HALL-1', 'Parade Hall', 'parade_hall', -165, 22, -55, 68);

// ── Indoor Sports Complex — large-span, west side near the parade ground ─
addBuilding('SPORT-1', 'Indoor Sports Complex', 'sports_complex', -300, 28, -230, 70);

// ── Service / research buildings, east side ──────────────────────────────
addBuilding('MAINT-1', 'Maintenance Building', 'maintenance', 190, 60, 230, 92);
addBuilding('RSRCH-1', 'Research Building', 'research', 190, 20, 230, 52);

// ── Residential blocks — two rows of long barracks-style buildings ──────
for (let i = 0; i < 8; i++) {
  const uCenter = -190 + i * 48;
  addBuilding(`RES-N${i + 1}`, `Residential Block N${i + 1}`, 'residential', uCenter - 7, -75, uCenter + 7, -20);
}
for (let i = 0; i < 8; i++) {
  const uCenter = -190 + i * 48;
  addBuilding(`RES-S${i + 1}`, `Residential Block S${i + 1}`, 'residential', uCenter - 7, -130, uCenter + 7, -85);
}

// ── Outdoor sports / parade ground ───────────────────────────────────────
const sportsFields = [
  { id: 'FIELD-1', name: 'Outdoor Football Field', kind: 'pitch', ring: rectRing(-300, -110, -200, -50) },
];
const grounds = [
  // The paved parade ground + helipad seen at one end of the real campus —
  // an open hardstand area, not a building, styled distinctly (grey, not green).
  { id: 'PARADE-GROUND-1', name: 'Parade Ground', kind: 'parade_ground', ring: rectRing(-300, 75, -180, 135) },
];

// ── Parking ───────────────────────────────────────────────────────────────
const parkingLots = [
  { id: 'PARK-1', name: 'Visitor Parking', ring: rectRing(-60, -170, 90, -140) },
  { id: 'PARK-2', name: 'Residential Parking', ring: rectRing(-190, -170, -70, -140) },
];

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zmu_buildings (
      id            text PRIMARY KEY,
      display_name  text,
      category      text,
      levels        integer,
      height        numeric,
      gross_area    numeric,
      large_span    boolean DEFAULT false,
      geom          geometry(Polygon, 4326)
    );
  `);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_sportsfields (id text PRIMARY KEY, name text, kind text, geom geometry(Polygon, 4326));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_parking (id text PRIMARY KEY, name text, geom geometry(Polygon, 4326));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zmu_grounds (id text PRIMARY KEY, name text, kind text, geom geometry(Polygon, 4326));`);

  await pool.query('DELETE FROM zmu_buildings');
  for (const b of buildings) {
    await pool.query(
      `INSERT INTO zmu_buildings (id, display_name, category, levels, height, gross_area, large_span, geom)
       VALUES ($1,$2,$3,$4,$5,$6,$7, ST_SetSRID(ST_GeomFromText($8), 4326))`,
      [b.id, b.display_name, b.category, b.levels, b.height, b.gross_area, b.large_span, toWKT(b.ring)]
    );
  }

  await pool.query('DELETE FROM zmu_sportsfields');
  for (const s of sportsFields) {
    await pool.query(
      `INSERT INTO zmu_sportsfields (id, name, kind, geom) VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromText($4), 4326))`,
      [s.id, s.name, s.kind, toWKT(s.ring)]
    );
  }

  await pool.query('DELETE FROM zmu_grounds');
  for (const g of grounds) {
    await pool.query(
      `INSERT INTO zmu_grounds (id, name, kind, geom) VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromText($4), 4326))`,
      [g.id, g.name, g.kind, toWKT(g.ring)]
    );
  }

  await pool.query('DELETE FROM zmu_parking');
  for (const p of parkingLots) {
    await pool.query(
      `INSERT INTO zmu_parking (id, name, geom) VALUES ($1,$2, ST_SetSRID(ST_GeomFromText($3), 4326))`,
      [p.id, p.name, toWKT(p.ring)]
    );
  }

  console.log(`Imported ${buildings.length} buildings, ${sportsFields.length} sports field(s), ${grounds.length} ground feature(s), ${parkingLots.length} parking lot(s).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
