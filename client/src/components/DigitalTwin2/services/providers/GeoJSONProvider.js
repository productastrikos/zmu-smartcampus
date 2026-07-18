// Local, offline GIS data provider — reads the static GeoJSON assets under
// client/src/assets/geojson/ (generated once from the real hand-digitized
// reference/ coordinate files by server/geo/export-geojson-assets.js; see
// that script's header for exactly how each file was derived). No network
// request, no PostgreSQL/PostGIS dependency — everything here resolves
// synchronously, `async` only to keep the same call contract a future
// live-database provider would have.
//
// This is the concrete implementation selected by ../GISDataProvider.js —
// rendering layers never import this file directly, only the facade.
import buildings from '../../../../assets/geojson/buildings.geojson';
import roads from '../../../../assets/geojson/roads.geojson';
import fences from '../../../../assets/geojson/fence.geojson';
import boundary from '../../../../assets/geojson/campus_boundary.geojson';
import sportsfields from '../../../../assets/geojson/football_ground.geojson';
import parking from '../../../../assets/geojson/parking.geojson';
import grounds from '../../../../assets/geojson/helipad.geojson';
import gates from '../../../../assets/geojson/gates.geojson';
import trees from '../../../../assets/geojson/trees.geojson';
import water from '../../../../assets/geojson/water.geojson';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

// footpaths/grass/points/lights have no digitized source anywhere (OSM
// never had coverage for this site, same as before this migration) — no
// physical asset file for them, just the same always-empty shape every
// consumer already handles via the Layers panel's "no data yet" flagging.
const ALL_LAYERS = {
  roads, footpaths: EMPTY_FC, parking, grass: EMPTY_FC, water, trees,
  fences, gates, sportsfields, lights: EMPTY_FC, points: EMPTY_FC,
  boundary, grounds,
};

// Shapes a raw building GeoJSON feature into the record every consumer
// (3-D layer, popup, personnel/movement, later live BMS/IoT wiring)
// expects — ported unchanged from the old BuildingService.js, which had
// this as a pure function with no fetch coupling.
function shapeBuilding(feature) {
  const p = feature.properties;
  return {
    id: p.id,
    display_name: p.display_name,
    category: p.category,
    geometry: feature.geometry,
    centroid: p.centroid,
    height: p.height,
    levels: p.levels,
    levels_estimated: !!p.levels_estimated,
    gross_area: p.gross_area,
    large_span: !!p.large_span,
    occupancy: null,
    osm_id: p.osm_id ?? null,
    future_bms_id: null,
    future_hvac: {},
    future_electrical: {},
    future_fire_alarm: {},
    future_water: {},
    future_cctv: {},
    future_access_control: {},
    future_energy_meters: {},
    future_occupancy: {},
    future_asset_management: {},
    future_maintenance_status: {},
  };
}

export const GeoJSONProvider = {
  async getAllLayers() {
    return ALL_LAYERS;
  },
  async getBuildings() {
    return buildings.features.map(shapeBuilding);
  },
};
