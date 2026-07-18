// Campus boundary — the real OSM landuse=military polygon, drawn as a
// subtle cyan outline (no fill; ground-cover polygons live in
// GrassLayer/ParkingLayer). The dark Carto Dark Matter basemap underneath
// already renders the broader real terrain (roads, land, coastline) —
// this only adds the one campus-specific boundary polygon PostGIS
// actually has.
export function addBoundaryLayer(map, data) {
  map.addSource('zt2-boundary', { type: 'geojson', data: data.boundary });
  map.addLayer({
    id: 'zt2-boundary-glow', type: 'line', source: 'zt2-boundary',
    paint: { 'line-color': '#4de2ff', 'line-width': 9, 'line-blur': 5, 'line-opacity': 0.25 },
  });
  map.addLayer({
    id: 'zt2-boundary-line', type: 'line', source: 'zt2-boundary',
    paint: { 'line-color': '#4de2ff', 'line-width': 1.4, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
  });
}

// A soft animated cyan pulse on the boundary glow — started/stopped
// alongside the layer from digitalTwin_2.jsx's wiring effect via plain
// map.setPaintProperty calls (no new Three.js layer needed for a single
// native-paint oscillation).
export function startBoundaryPulse(map) {
  const t0 = performance.now();
  const intervalId = setInterval(() => {
    if (!map.getLayer('zt2-boundary-glow')) return;
    const t = (performance.now() - t0) / 1000;
    const pulse = (Math.sin(t * 1.6) + 1) / 2; // 0..1
    map.setPaintProperty('zt2-boundary-glow', 'line-opacity', 0.18 + pulse * 0.32);
    map.setPaintProperty('zt2-boundary-glow', 'line-width', 7 + pulse * 6);
  }, 80);
  return () => clearInterval(intervalId);
}

export const BOUNDARY_LAYER_IDS = { boundary: ['zt2-boundary-glow', 'zt2-boundary-line'] };
