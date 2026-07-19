// Shapes a raw Campus 2 GeoJSON building Feature into the same record
// contract Campus 1's real buildings use (client/src/components/
// DigitalTwin2/services/providers/GeoJSONProvider.js's shapeBuilding()) —
// {id, display_name, category, geometry, centroid, height, levels, ...} —
// so the shared hover tooltip, BuildingPopup, orbitToBuilding/flyToBuilding
// and the personnel roster's building-candidate list all work unmodified
// against Campus 2 buildings too. gross_area is a real derived value (the
// polygon's own shoelace-formula footprint area × its levels), not
// invented; category is honestly 'structure' (unclassified) since no real
// per-building category data exists for Campus 2.

export function polygonAreaM2(ringLonLat, projection) {
  const pts = ringLonLat.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroidLonLat(ringLonLat) {
  const pts = ringLonLat.slice(0, -1);
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lon, lat];
}

export function shapeCampus2Building(feature, idPrefix, projection) {
  const name = feature.properties?.name || 'Campus 2 structure';
  const levels = feature.properties?.levels ?? null;
  const height = feature.properties?.height ?? 4;
  const outerRing = feature.geometry.coordinates[0];
  const footprintArea = polygonAreaM2(outerRing, projection);
  return {
    id: `CAMPUS2-${idPrefix}-${name}`,
    display_name: name,
    category: 'structure',
    geometry: feature.geometry,
    centroid: polygonCentroidLonLat(outerRing),
    height,
    levels,
    levels_estimated: true,
    gross_area: Math.round(footprintArea * Math.max(1, levels || 1)),
    large_span: false,
    occupancy: null,
    osm_id: null,
    future_bms_id: null,
  };
}
