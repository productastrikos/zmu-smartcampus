import { WATER_PAINT } from '../materials/WaterMaterial';

// Real natural=water / waterway geometry, read straight from PostGIS.
// Zero rows exist in zmu_db for this site today (verified directly against
// planet_osm_polygon/line — the real coastline itself is already rendered
// by the Carto Dark Matter basemap, so it isn't re-fabricated here). Kept
// as a native MapLibre fill rather than a speculative Three.js animated-
// shader mesh — a real ripple/reflection shader is easy to add later, but
// there's no real water geometry to test it against yet, so building one
// now would be unverifiable code. Swap this for a proper Water2-style
// shader layer the moment real water geometry is imported.
export function addWaterLayer(map, data) {
  map.addSource('zt2-water', { type: 'geojson', data: data.water });
  map.addLayer({ id: 'zt2-water-fill', type: 'fill', source: 'zt2-water', paint: WATER_PAINT.fill });
  map.addLayer({ id: 'zt2-water-outline', type: 'line', source: 'zt2-water', paint: WATER_PAINT.outline });
}

export const WATER_LAYER_IDS = { water: ['zt2-water-fill', 'zt2-water-outline'] };
