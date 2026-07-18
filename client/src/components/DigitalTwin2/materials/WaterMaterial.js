// No real water polygons exist in zmu_db for this site yet (verified
// directly against planet_osm_polygon/line — zero natural=water or
// waterway rows), so water renders as a native MapLibre fill today. Kept
// as its own module so swapping to a proper Three.js Water2-style shader
// mesh (once real water geometry is imported) only touches WaterLayer.js.
export const WATER_PAINT = {
  fill: { 'fill-color': '#1c6fff', 'fill-opacity': 0.35 },
  outline: { 'line-color': '#4de2ff', 'line-width': 1, 'line-opacity': 0.5 },
};
