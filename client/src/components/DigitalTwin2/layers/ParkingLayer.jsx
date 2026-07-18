// Parking areas — real amenity=parking OSM polygons (none exist) UNIONed
// with zmu_parking, real authoritative geometry (2 consolidated lots,
// digitized from aerial imagery alongside the buildings — see
// server/geo/import-zmu-campus.js). Native MapLibre fill layer.
export function addParkingLayer(map, data) {
  map.addSource('zt2-parking', { type: 'geojson', data: data.parking });
  map.addLayer({
    id: 'zt2-parking-fill', type: 'fill', source: 'zt2-parking',
    paint: { 'fill-color': '#1a2230', 'fill-opacity': 0.8 },
  });
  map.addLayer({
    id: 'zt2-parking-outline', type: 'line', source: 'zt2-parking',
    paint: { 'line-color': '#4de2ff', 'line-width': 1, 'line-opacity': 0.4 },
  });
  // Future: per-space parking markings + occupancy once a live feed
  // exists. No placeholder numbers are rendered today.
}

export const PARKING_LAYER_IDS = { parking: ['zt2-parking-fill', 'zt2-parking-outline'] };
