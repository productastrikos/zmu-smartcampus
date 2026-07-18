/**
 * One-off import: converts data/buildings.csv (local x,y,w,h in metres,
 * top-left origin, y-down — the same layout the existing SVG/Three.js twin
 * uses) into real-world footprints in the zmu_buildings PostGIS table,
 * anchored on the actual landuse=military polygon already present in
 * zmu_db for this site. Run manually: node server/geo/import-zmu-buildings.js
 */
const path = require('path');
const { loadTable } = require('../lib/csv');
const { pool } = require('./db');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const SITE_CX = 505; // buildings.csv layout centre (SITE_W/2, SITE_H/2)
const SITE_CY = 330;

async function main() {
  const anchor = await pool.query(
    `SELECT ST_X(c) AS lon, ST_Y(c) AS lat FROM (
       SELECT ST_Centroid(ST_Transform(way, 4326)) AS c
       FROM planet_osm_polygon WHERE landuse = 'military' LIMIT 1
     ) s`
  );
  if (!anchor.rows.length) throw new Error('No landuse=military polygon found in zmu_db to anchor on');
  const { lon: anchorLon, lat: anchorLat } = anchor.rows[0];
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((anchorLat * Math.PI) / 180);
  const toLonLat = (x, y) => {
    const dx = x - SITE_CX;
    const dy = y - SITE_CY; // +y = further south in the source layout
    return [anchorLon + dx / mPerDegLon, anchorLat - dy / mPerDegLat];
  };

  await pool.query(`
    CREATE TABLE IF NOT EXISTS zmu_buildings (
      building_id text PRIMARY KEY,
      name        text,
      type        text,
      floors      integer,
      area_m2     numeric,
      height_m    numeric,
      way         geometry(Polygon, 4326)
    );
  `);

  const buildings = loadTable(DATA_DIR, 'buildings');
  await pool.query('DELETE FROM zmu_buildings');
  for (const b of buildings) {
    const ring = [
      toLonLat(b.x, b.y),
      toLonLat(b.x + b.w, b.y),
      toLonLat(b.x + b.w, b.y + b.h),
      toLonLat(b.x, b.y + b.h),
    ];
    ring.push(ring[0]);
    const wkt = `POLYGON((${ring.map(([lon, lat]) => `${lon} ${lat}`).join(',')}))`;
    const heightM = Math.max(3.5, b.floors * 3.6);
    await pool.query(
      `INSERT INTO zmu_buildings (building_id, name, type, floors, area_m2, height_m, way)
       VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_GeomFromText($7), 4326))`,
      [b.building_id, b.name, b.type, b.floors, b.area_m2, heightM, wkt]
    );
  }
  console.log(`Imported ${buildings.length} buildings into zmu_buildings, anchored at ${anchorLon}, ${anchorLat}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
