// The single swap point for where Digital Twin 2's GIS data comes from.
// Every rendering layer, hook, and page in this module goes through this
// facade (or the useGIS/useBuildings hooks, which just call it) — none of
// them know or care whether the data is local GeoJSON, a live PostGIS
// database, or an OSM feed.
//
//   GISDataProvider
//        ├── GeoJSONProvider  (current — see ./providers/GeoJSONProvider.js)
//        ├── PostGISProvider  (future — same {getAllLayers, getBuildings}
//        │                     shape, backed by fetch() calls to
//        │                     server/geo/geoTwinServer.js like this app
//        │                     used to work; not implemented while that
//        │                     server is unavailable)
//        └── OSMProvider      (future — same shape again, sourced directly
//                              from an OSM extract)
//
// Swapping providers later is a one-line change here, nothing downstream.
import { GeoJSONProvider } from './providers/GeoJSONProvider';

const activeProvider = GeoJSONProvider;

export const GISDataProvider = {
  getAllLayers: () => activeProvider.getAllLayers(),
  getBuildings: () => activeProvider.getBuildings(),
};
