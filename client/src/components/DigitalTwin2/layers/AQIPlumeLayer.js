// AQI "affected area" plume — the green→yellow→red bloom over the campus
// that the Air Quality overlay shows in addition to tinting the buildings.
//
// Deliberately a NATIVE MapLibre `heatmap` layer rather than another
// Three.js custom layer: a heatmap is a screen-space density field, which
// is exactly what MapLibre's heatmap type already renders correctly (and
// cheaply) against a tilted, rotating 3-D camera. Added last, above the
// 3-D custom layers, so the affected area reads as an overlay across the
// site the way an air-quality map does.
//
// Points come from campusMetrics.makeAQIStations(), so the plume and the
// per-building tint are always derived from the same readings.

export const AQI_SOURCE_ID = 'zt2-aqi-stations';
export const AQI_HEATMAP_LAYER_ID = 'zt2-aqi-plume';
export const AQI_POINT_LAYER_ID = 'zt2-aqi-station-points';
export const AQI_LABEL_LAYER_ID = 'zt2-aqi-station-labels';

export const AQI_LAYER_IDS = [AQI_HEATMAP_LAYER_ID, AQI_POINT_LAYER_ID, AQI_LABEL_LAYER_ID];

export function addAQIPlumeLayer(map, stations, { visible = false } = {}) {
  if (map.getSource(AQI_SOURCE_ID)) {
    map.getSource(AQI_SOURCE_ID).setData(stations);
    return;
  }
  map.addSource(AQI_SOURCE_ID, { type: 'geojson', data: stations });

  map.addLayer({
    id: AQI_HEATMAP_LAYER_ID,
    type: 'heatmap',
    source: AQI_SOURCE_ID,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'heatmap-weight': ['get', 'weight'],
      // Keep individual plumes readable as distinct affected areas instead
      // of merging into one wash as you zoom in.
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 0.9, 16, 1.4, 19, 2.2],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0.0, 'rgba(0,0,0,0)',
        0.15, 'rgba(0,180,80,0.35)',
        0.35, 'rgba(90,220,60,0.55)',
        0.55, 'rgba(240,220,60,0.68)',
        0.75, 'rgba(255,140,40,0.78)',
        0.9, 'rgba(240,50,45,0.85)',
        1.0, 'rgba(150,15,20,0.9)',
      ],
      // Radius in screen px grown with zoom so a plume covers roughly the
      // same ground area at every scale rather than shrinking to a dot.
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 13, 14, 16, 40, 18, 90, 20, 190],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.75, 20, 0.6],
    },
  });

  // The stations themselves — a small ring per monitoring point so it's
  // clear the plume is interpolated FROM something, not painted freehand.
  map.addLayer({
    id: AQI_POINT_LAYER_ID,
    type: 'circle',
    source: AQI_SOURCE_ID,
    minzoom: 16.5,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'circle-radius': 4,
      'circle-color': [
        'step', ['get', 'aqi'],
        '#00c853', 50, '#f2d64b', 100, '#ff9330', 150, '#ff3b46', 200, '#9b3fd1',
      ],
      'circle-stroke-width': 1.2,
      'circle-stroke-color': 'rgba(10,20,30,0.85)',
      'circle-opacity': 0.95,
    },
  });

  map.addLayer({
    id: AQI_LABEL_LAYER_ID,
    type: 'symbol',
    source: AQI_SOURCE_ID,
    minzoom: 17.5,
    layout: {
      visibility: visible ? 'visible' : 'none',
      'text-field': ['concat', 'AQI ', ['to-string', ['get', 'aqi']]],
      'text-size': 10.5,
      'text-font': ['Montserrat Medium', 'Open Sans Bold', 'Noto Sans Regular'],
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#eaf6ff',
      'text-halo-color': 'rgba(8,14,22,0.9)',
      'text-halo-width': 1.3,
    },
  });
}

export function setAQIPlumeVisible(map, visible) {
  for (const id of AQI_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
