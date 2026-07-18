// Grass (landuse=grass / natural=grassland / leisure=park), sports fields
// (leisure=pitch/sports_centre/stadium), and paved ground features (the
// parade ground + helipad) — all real, tag-filtered PostGIS queries.
// Grass returns zero rows (no OSM coverage); sports fields + grounds
// carry real, authoritative geometry (digitized from aerial imagery
// alongside the buildings — see server/geo/import-zmu-campus.js).
// Native MapLibre fill layers — no Three.js/projection needed for flat
// 2-D ground cover.
export function addGrassLayer(map, data) {
  map.addSource('zt2-grass', { type: 'geojson', data: data.grass });
  map.addLayer({
    id: 'zt2-grass-fill', type: 'fill', source: 'zt2-grass',
    paint: { 'fill-color': '#2f8f4e', 'fill-opacity': 0.22 },
  });

  // "pitch"-kind fields get a full 3-D FIFA-style treatment from
  // FootballGround.jsx instead — excluded here so the flat fill doesn't
  // z-fight underneath the real markings/goals.
  const nonPitchFields = {
    type: 'FeatureCollection',
    features: (data.sportsfields?.features || []).filter((f) => f.properties?.leisure !== 'pitch'),
  };
  map.addSource('zt2-sportsfields', { type: 'geojson', data: nonPitchFields });
  map.addLayer({
    id: 'zt2-sportsfields-fill', type: 'fill', source: 'zt2-sportsfields',
    paint: { 'fill-color': '#2f8f4e', 'fill-opacity': 0.32 },
  });
  map.addLayer({
    id: 'zt2-sportsfields-outline', type: 'line', source: 'zt2-sportsfields',
    paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.5 },
  });

  // Parade ground / helipad — grey hardstand, not green ground cover.
  map.addSource('zt2-grounds', { type: 'geojson', data: data.grounds });
  map.addLayer({
    id: 'zt2-grounds-fill', type: 'fill', source: 'zt2-grounds',
    paint: { 'fill-color': '#3a4552', 'fill-opacity': 0.55 },
  });
  map.addLayer({
    id: 'zt2-grounds-outline', type: 'line', source: 'zt2-grounds',
    paint: { 'line-color': '#8fa4b8', 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [4, 2] },
  });

  // Standard helipad "H" ground marking — a Point at the centroid of the
  // real helipad polygon (still the real digitized boundary; only the
  // label position is derived, no new area/geometry is added), rendered
  // as a text symbol rather than fabricating painted-line geometry.
  const helipadLabels = {
    type: 'FeatureCollection',
    features: (data.grounds?.features || [])
      .filter((f) => f.properties?.kind === 'helipad')
      .map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: ringCentroid(f.geometry.coordinates[0]) }, properties: {} })),
  };
  map.addSource('zt2-grounds-label', { type: 'geojson', data: helipadLabels });
  map.addLayer({
    id: 'zt2-grounds-label-text', type: 'symbol', source: 'zt2-grounds-label',
    layout: {
      'text-field': 'H', 'text-size': 26,
      'text-font': ['Montserrat Medium', 'Open Sans Bold', 'Noto Sans Regular'],
      'text-allow-overlap': true, 'text-ignore-placement': true,
    },
    paint: { 'text-color': '#eafcff', 'text-halo-color': '#0a4a5c', 'text-halo-width': 2 },
  });
}

function ringCentroid(ring) {
  const pts = ring.slice(0, -1);
  const lon = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const lat = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  return [lon, lat];
}

export const GRASS_LAYER_IDS = {
  grass: ['zt2-grass-fill'],
  sportsfields: ['zt2-sportsfields-fill', 'zt2-sportsfields-outline'],
  grounds: ['zt2-grounds-fill', 'zt2-grounds-outline', 'zt2-grounds-label-text'],
};
