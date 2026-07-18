import { ROAD_PAINT, FOOTPATH_PAINT, FENCE_PAINT, GATE_PAINT } from '../materials/RoadMaterial';

// Roads (per-highway-type styling), footpaths, perimeter fences/gates, and
// generic point features (OSM POIs + streetlamps) — all native MapLibre
// vector layers driven straight off real lon/lat GeoJSON (MapLibre handles
// their projection itself, so there's no need to route these through
// ProjectionService — that's only for the Three.js custom layers).
// Roads, gates, and points have real rows in zmu_db today; footpaths/
// fences/lights return real-but-empty results until that OSM coverage
// exists (see server/geo/geoTwinServer.js).
export function addRoadLayer(map, data) {
  map.addSource('zt2-roads', { type: 'geojson', data: data.roads });
  map.addLayer({ id: 'zt2-roads-glow', type: 'line', source: 'zt2-roads', paint: ROAD_PAINT.glow });
  map.addLayer({ id: 'zt2-roads-surface', type: 'line', source: 'zt2-roads', paint: ROAD_PAINT.surface });
  map.addLayer({ id: 'zt2-roads-line', type: 'line', source: 'zt2-roads', paint: ROAD_PAINT.line });

  map.addSource('zt2-footpaths', { type: 'geojson', data: data.footpaths });
  map.addLayer({ id: 'zt2-footpaths-line', type: 'line', source: 'zt2-footpaths', paint: FOOTPATH_PAINT.line });

  // Real zmu_fences rows get a full 3-D steel-fence treatment from
  // FenceLayer.jsx instead — excluded here so this flat dashed line
  // doesn't double up underneath it. Only genuine OSM barrier=fence/wall
  // features (still 0 today) render flatly.
  const osmOnlyFences = { type: 'FeatureCollection', features: (data.fences?.features || []).filter((f) => f.properties?.osm_id != null) };
  map.addSource('zt2-fences', { type: 'geojson', data: osmOnlyFences });
  map.addLayer({ id: 'zt2-fences-line', type: 'line', source: 'zt2-fences', paint: FENCE_PAINT.line });

  map.addSource('zt2-gates', { type: 'geojson', data: data.gates });
  map.addLayer({ id: 'zt2-gates-dot', type: 'circle', source: 'zt2-gates', paint: GATE_PAINT.point });

  map.addSource('zt2-points', { type: 'geojson', data: data.points });
  map.addLayer({
    id: 'zt2-points-dot', type: 'circle', source: 'zt2-points',
    paint: { 'circle-radius': 3.5, 'circle-color': '#4de2ff', 'circle-opacity': 0.85, 'circle-stroke-color': '#affcff', 'circle-stroke-width': 1 },
  });

  map.addSource('zt2-lights', { type: 'geojson', data: data.lights });
  map.addLayer({
    id: 'zt2-lights-dot', type: 'circle', source: 'zt2-lights',
    paint: { 'circle-radius': 2.5, 'circle-color': '#ffe08a', 'circle-opacity': 0.9 },
  });
}

export const ROAD_LAYER_IDS = {
  roads: ['zt2-roads-glow', 'zt2-roads-surface', 'zt2-roads-line'],
  footpaths: ['zt2-footpaths-line'],
  fences: ['zt2-fences-line'],
  gates: ['zt2-gates-dot'],
  points: ['zt2-points-dot'],
  lights: ['zt2-lights-dot'],
};
