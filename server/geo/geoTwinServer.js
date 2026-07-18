/**
 * Standalone API for the Digital Twin 2 (digitalTwin_2.jsx) feature.
 * Serves real GeoJSON straight out of the zmu_db PostGIS database — kept
 * as its own process/port so the existing CSV-backed server/index.js and
 * client/vite proxy config never have to change.
 *
 * Run: node server/geo/geoTwinServer.js   (defaults to port 5052)
 */
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

const PORT = Number(process.env.GEO_TWIN_PORT || 5052);

const app = express();
app.use(cors());

async function featureCollection(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: JSON.parse(r.geojson),
      properties: r.properties,
    })),
  };
}

/* ── ZMU campus buildings — real footprints (in zmu_buildings), digitized
   from real aerial imagery of the actual campus (see
   server/geo/import-zmu-campus.js). Neutral category-based display names,
   not invented official names. height/levels come from a per-category
   configuration (an estimate, not verified official data — hence
   levels_estimated: true). Not OSM-digitized (OSM has no building
   footprints for this site — only the landuse=military boundary), so
   osm_id is honestly null; id is the real identifier. ────────────────── */
app.get('/api/geo/buildings', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(geom) AS geojson,
             json_build_object(
               'osm_id', NULL, 'id', id, 'display_name', display_name, 'category', category,
               'levels', levels, 'levels_estimated', true, 'height', height,
               'gross_area', gross_area, 'large_span', large_span,
               'centroid', json_build_array(ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom)))
             ) AS properties
      FROM zmu_buildings ORDER BY id
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── campus boundary — real OSM landuse=military polygon ────────────── */
app.get('/api/geo/boundary', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'landuse', landuse, 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon WHERE landuse = 'military'
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── roads — real OSM ways tagged highway=* (lines + the "roads" table),
   UNIONed with zmu_roads (the real hand-digitized outer/inner campus
   roads — OSM has no road coverage for this site; see
   server/geo/import-zmu-real-structures.js) ─────────────────────────── */
app.get('/api/geo/roads', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'highway', highway, 'osm_id', osm_id) AS properties
      FROM planet_osm_line WHERE highway IS NOT NULL
      UNION ALL
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'highway', highway, 'osm_id', osm_id) AS properties
      FROM planet_osm_roads WHERE highway IS NOT NULL
      UNION ALL
      SELECT ST_AsGeoJSON(geom) AS geojson,
             json_build_object('name', name, 'highway', highway, 'osm_id', NULL, 'id', id) AS properties
      FROM zmu_roads
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── water — natural=water / waterway, wherever OSM actually has it ─── */
app.get('/api/geo/water', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'natural', "natural", 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon WHERE "natural" = 'water' OR "landuse" = 'reservoir'
      UNION ALL
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'waterway', waterway, 'osm_id', osm_id) AS properties
      FROM planet_osm_line WHERE waterway IS NOT NULL
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── points of interest — whatever OSM nodes exist near the campus ──── */
app.get('/api/geo/points', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'amenity', amenity, 'shop', shop, 'osm_id', osm_id) AS properties
      FROM planet_osm_point
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── footpaths — real OSM highway=footway/path/pedestrian, if any exist ── */
app.get('/api/geo/footpaths', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'highway', highway, 'osm_id', osm_id) AS properties
      FROM planet_osm_line WHERE highway IN ('footway', 'path', 'pedestrian', 'steps')
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── parking — real OSM amenity=parking polygons (none exist) UNIONed
   with zmu_parking, the same authoritative-table pattern as buildings,
   digitized from the same aerial imagery ─────────────────────────────── */
app.get('/api/geo/parking', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'amenity', amenity, 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon WHERE amenity = 'parking'
      UNION ALL
      SELECT ST_AsGeoJSON(geom) AS geojson,
             json_build_object('name', name, 'amenity', 'parking', 'osm_id', NULL, 'id', id) AS properties
      FROM zmu_parking
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── trees — real OSM natural=tree points, if any exist ─────────────────── */
app.get('/api/geo/trees', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'osm_id', osm_id) AS properties
      FROM planet_osm_point WHERE "natural" = 'tree'
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── grass — real OSM landuse=grass / natural=grassland / leisure=park ──── */
app.get('/api/geo/grass', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'landuse', landuse, 'natural', "natural", 'leisure', leisure, 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon
      WHERE landuse = 'grass' OR "natural" = 'grassland' OR leisure = 'park'
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── landuse — every real OSM landuse polygon (military, grass, sand, …) ── */
app.get('/api/geo/landuse', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'landuse', landuse, 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon WHERE landuse IS NOT NULL
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── fences / walls — real OSM barrier=fence/wall (gates are separate),
   UNIONed with zmu_fences (the real hand-digitized perimeter fence lines
   — OSM has no barrier coverage for this site; see
   server/geo/import-zmu-real-structures.js) ─────────────────────────── */
app.get('/api/geo/fences', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'barrier', barrier, 'osm_id', osm_id) AS properties
      FROM planet_osm_line WHERE barrier IN ('fence', 'wall')
      UNION ALL
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'barrier', barrier, 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon WHERE barrier IN ('fence', 'wall')
      UNION ALL
      SELECT ST_AsGeoJSON(geom) AS geojson,
             json_build_object('name', name, 'barrier', 'fence', 'osm_id', NULL, 'id', id) AS properties
      FROM zmu_fences
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── gates — real OSM barrier=gate, if any exist ─────────────────────────── */
app.get('/api/geo/gates', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'barrier', barrier, 'osm_id', osm_id) AS properties
      FROM planet_osm_point WHERE barrier = 'gate'
      UNION ALL
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'barrier', barrier, 'osm_id', osm_id) AS properties
      FROM planet_osm_line WHERE barrier = 'gate'
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── sports fields — real OSM leisure=pitch/sports_centre (none exist)
   UNIONed with zmu_sportsfields, digitized from the same aerial imagery ── */
app.get('/api/geo/sportsfields', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'leisure', leisure, 'osm_id', osm_id) AS properties
      FROM planet_osm_polygon WHERE leisure IN ('pitch', 'sports_centre', 'stadium')
      UNION ALL
      SELECT ST_AsGeoJSON(geom) AS geojson,
             json_build_object('name', name, 'leisure', kind, 'osm_id', NULL, 'id', id) AS properties
      FROM zmu_sportsfields
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── lighting poles — real OSM highway=street_lamp points, if any exist ─── */
app.get('/api/geo/lights', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson,
             json_build_object('name', name, 'osm_id', osm_id) AS properties
      FROM planet_osm_point WHERE highway = 'street_lamp'
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

/* ── grounds — open hardstand/paved ground features (parade ground +
   helipad), real authoritative geometry digitized alongside the buildings
   (see server/geo/import-zmu-campus.js) — not a building, not OSM. ────── */
app.get('/api/geo/grounds', async (req, res) => {
  try {
    const fc = await featureCollection(`
      SELECT ST_AsGeoJSON(geom) AS geojson,
             json_build_object('name', name, 'kind', kind, 'osm_id', NULL, 'id', id) AS properties
      FROM zmu_grounds
    `);
    res.json(fc);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.get('/api/geo/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[geo-twin] Digital Twin 2 GIS API listening on http://localhost:${PORT}`);
});
