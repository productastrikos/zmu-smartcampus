import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGIS } from '../components/DigitalTwin2/hooks/useGIS';
import { useBuildings } from '../components/DigitalTwin2/hooks/useBuildings';
import { createBuildingsLayer } from '../components/DigitalTwin2/layers/BuildingLayer';
import { addRoadLayer, ROAD_LAYER_IDS } from '../components/DigitalTwin2/layers/RoadLayer';
import { addGrassLayer, GRASS_LAYER_IDS } from '../components/DigitalTwin2/layers/GrassLayer';
import { addParkingLayer, PARKING_LAYER_IDS } from '../components/DigitalTwin2/layers/ParkingLayer';
import { addWaterLayer, WATER_LAYER_IDS } from '../components/DigitalTwin2/layers/WaterLayer';
import { addBoundaryLayer, BOUNDARY_LAYER_IDS, startBoundaryPulse } from '../components/DigitalTwin2/layers/BoundaryLayer';
import { createTreeLayer } from '../components/DigitalTwin2/layers/TreeLayer';
import {
  clampZoomLimits, flyToBuilding, zoomToFit,
  orbitToBuilding, restoreCamera, captureCameraState,
  orbitToPerson,
} from '../components/DigitalTwin2/CameraController';
import { ringBBoxCenter, createProjection } from '../components/DigitalTwin2/services/ProjectionService';
import LayerControl, { ALL_LAYER_KEYS, ALL_FUTURE_KEYS } from '../components/DigitalTwin2/ui/LayerControl';
import BuildingPopup from '../components/DigitalTwin2/ui/BuildingPopup';
import MapLegend from '../components/DigitalTwin2/ui/MapLegend';
import { createFootballGroundLayer } from '../components/DigitalTwin2/components/FootballGround';
import { createFenceLayer } from '../components/DigitalTwin2/components/FenceLayer';
import { createPedestrianLayer } from '../components/DigitalTwin2/components/PedestrianLayer';
import { generateCampusLayout } from '../components/DigitalTwin2/components/WalkwayGenerator';
import Block3Viewer from '../components/DigitalTwin2/components/Block3Viewer';
import BuildingDigitalTwin from '../components/admin_block/BuildingDigitalTwin';
import { createLightingLayer, computeLightPositions } from '../components/DigitalTwin2/components/LightingLayer';
import { createSecurityLayer } from '../components/DigitalTwin2/components/SecurityLayer';
import { createGateLayer } from '../components/DigitalTwin2/components/GateLayer';
import { createCCTVLayer } from '../components/DigitalTwin2/components/CCTVLayer';
import CameraPanel from '../components/DigitalTwin2/ui/CameraPanel';
import CameraPopup from '../components/DigitalTwin2/ui/CameraPopup';
import MetricLegend from '../components/DigitalTwin2/ui/MetricLegend';
import {
  OVERLAYS, readBuildingMetrics, overlayColor, overlayValue, overlayReadout, bandFor, makeAQIStations,
} from '../components/DigitalTwin2/data/campusMetrics';
import { summariseCameraHealth } from '../components/DigitalTwin2/data/cameraRegistry';
import { addAQIPlumeLayer, setAQIPlumeVisible } from '../components/DigitalTwin2/layers/AQIPlumeLayer';
import {
  addCameraMarkerLayer, setCameraMarkers, setCameraMarkersVisible,
  setSelectedCameraMarker, pickCameraMarker,
} from '../components/DigitalTwin2/layers/CameraMarkerLayer';
import { addPatrolRouteLayer, PATROL_ROUTE_LAYER_IDS, createPatrolMarkerLayer } from '../components/DigitalTwin2/components/PatrolLayer';
import SecurityAlerts from '../components/DigitalTwin2/components/SecurityAlerts';
import { createPersonnelLayer } from '../components/DigitalTwin2/components/PersonnelLayer';
import { generateRoster } from '../components/DigitalTwin2/components/PersonnelRoster';
import { buildWalkGraph, createWanderState, mulberry32 } from '../components/DigitalTwin2/components/MovementEngine';
import PersonnelPopup from '../components/DigitalTwin2/components/PersonnelPopup';
import PersonnelPanel from '../components/DigitalTwin2/components/PersonnelPanel';
import { createCampus2BoundaryLayer } from '../components/DigitalTwin2/campus2/Campus2BoundaryLayer';
import { createCampus2BuildingLayer } from '../components/DigitalTwin2/campus2/Campus2BuildingLayer';
import { createCampus2ExtraBuildingsLayer } from '../components/DigitalTwin2/campus2/Campus2ExtraBuildingsLayer';
import { createCampus2CircleLayer } from '../components/DigitalTwin2/campus2/Campus2CircleLayer';
import { createCampus2RoadLayer } from '../components/DigitalTwin2/campus2/Campus2RoadLayer';
import { createCampus2RoundaboutLayer } from '../components/DigitalTwin2/campus2/Campus2RoundaboutLayer';
import { createCampus2ParkingLayer } from '../components/DigitalTwin2/campus2/Campus2ParkingLayer';
import { createCampus2FootballLayer } from '../components/DigitalTwin2/campus2/Campus2FootballLayer';
import { createCampus2CourtsLayer } from '../components/DigitalTwin2/campus2/Campus2CourtsLayer';
import { createCampus2ParadeGroundLayer } from '../components/DigitalTwin2/campus2/Campus2ParadeGroundLayer';
import { polygonCentroidLonLat } from '../components/DigitalTwin2/campus2/buildingRecord';
import campus2Boundary from '../assets/geojson/campus2/campus_boundary.geojson';
import campus2Building from '../assets/geojson/campus2/central_building.geojson';
import campus2ExtraBuildings from '../assets/geojson/campus2/extra_buildings.geojson';
import campus2Buildings02 from '../assets/geojson/campus2/buildings_02.geojson';
import campus2Circles from '../assets/geojson/campus2/circular_structures.geojson';
import campus2Roads from '../assets/geojson/campus2/roads.geojson';
import campus2Roundabouts from '../assets/geojson/campus2/roundabouts.geojson';
import campus2ParkingLot1 from '../assets/geojson/campus2/parking_lot_1.geojson';
import campus2ParkingLot2 from '../assets/geojson/campus2/parking_lot_2.geojson';
import campus2ParkingLot3 from '../assets/geojson/campus2/parking_lot_3.geojson';
import campus2ParadeGround from '../assets/geojson/campus2/parade_ground_training_area.geojson';
import campus2FootballGround1 from '../assets/geojson/campus2/football_ground_1.geojson';
import campus2FootballGround2 from '../assets/geojson/campus2/football_ground_2.geojson';
import campus2BasketballCourt from '../assets/geojson/campus2/basket_ball_court_2.geojson';
import campus2TennisCourt from '../assets/geojson/campus2/tennis_court.geojson';

const CARTO_DARK_MATTER_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
// Fallback centre (the real ZMU site) used only until the live boundary
// data has loaded and we can compute the precise centroid ourselves.
const FALLBACK_CENTER = [54.38667022649094, 24.256170165875275];

const NATIVE_LAYER_IDS = {
  ...ROAD_LAYER_IDS,
  ...GRASS_LAYER_IDS,
  ...PARKING_LAYER_IDS,
  ...WATER_LAYER_IDS,
  ...BOUNDARY_LAYER_IDS,
  patrol: PATROL_ROUTE_LAYER_IDS,
};

const LABEL_LAYER_ID = 'zt2-building-labels';
function isImportantBuilding(b) { return b.category !== 'structure' || b.id === 'REAL-BLOCK-3'; }

// Native MapLibre symbol layer for major-building name labels — same
// "important building" definition CCTV/SecurityLayer use (real,
// non-generic category, plus Block-3 explicitly). minzoom keeps them
// hidden until the user is zoomed in close enough to read them.
//
// Some real structures (currently just the mosque) are digitized as
// several small sub-parts — "Mosque — Main Hall" / "— Dome" / "— Pillar"
// — each with its own display_name and centroid. Labeling every sub-part
// put 2-3 overlapping "Mosque —…" labels on top of each other, which
// MapLibre's collision detection then resolves by randomly hiding all but
// one, reading as "the mosque label is in the wrong place". Buildings that
// share a " — " name prefix are grouped into one label at their combined
// (area-weighted) centroid instead.
function addBuildingLabelsLayer(map, buildings) {
  const groups = new Map(); // prefix -> { name, points: [[lon,lat],...] }
  for (const b of buildings.filter(isImportantBuilding)) {
    const prefix = b.display_name.split(' — ')[0];
    const g = groups.get(prefix) || { name: prefix, points: [] };
    g.points.push(b.centroid);
    groups.set(prefix, g);
  }
  const fc = {
    type: 'FeatureCollection',
    features: [...groups.values()].map((g) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: g.points.length === 1 ? g.points[0] : [
          g.points.reduce((s, p) => s + p[0], 0) / g.points.length,
          g.points.reduce((s, p) => s + p[1], 0) / g.points.length,
        ],
      },
      properties: { name: g.name },
    })),
  };
  map.addSource('zt2-building-labels', { type: 'geojson', data: fc });
  map.addLayer({
    id: LABEL_LAYER_ID, type: 'symbol', source: 'zt2-building-labels',
    minzoom: 17,
    layout: {
      'text-field': ['get', 'name'], 'text-size': 12.5,
      'text-font': ['Montserrat Medium', 'Open Sans Bold', 'Noto Sans Regular'],
      'text-offset': [0, -1.4], 'text-anchor': 'bottom',
    },
    paint: { 'text-color': '#f2f8fc', 'text-halo-color': 'rgba(10,20,30,0.85)', 'text-halo-width': 1.4 },
  });
}

// Demo-only enrichment fields for the hover tooltip — deterministic per
// building (not randomized per hover) since no live BMS/IoT feed exists,
// same honesty convention as Block3Viewer's mock panel.
const DEMO_STATUSES = ['Operational', 'Operational', 'Operational', 'Maintenance'];
const DEMO_HVAC = ['Healthy', 'Healthy', 'Warning'];
function demoTooltipFields(building) {
  const seed = [...String(building.id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    department: building.category === 'structure' ? 'General' : building.category[0].toUpperCase() + building.category.slice(1),
    status: DEMO_STATUSES[seed % DEMO_STATUSES.length],
    power: `${94 + (seed % 6)}%`,
    hvac: DEMO_HVAC[seed % DEMO_HVAC.length],
    temperature: `${21 + (seed % 4)}°C`,
    occupancy: `${20 + (seed % 60)}%`,
  };
}

function setNativeLayerVisible(map, key, visible) {
  const ids = NATIVE_LAYER_IDS[key];
  if (!ids) return; // 'buildings' and 'trees' are Three.js custom layers, handled separately
  for (const id of ids) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

// Lightweight candidates (just centroid + display_name — all
// placeInactivePerson/generateRoster need) for scattering the same
// personnel-tracking green/red dots across Campus 2, from its own real
// building footprints (star complex solids + the two extra-buildings sets).
// `id` is carried too (it isn't needed by the roster, which only reads
// centroid/display_name) so the same list can seed Campus 2's CCTV cameras
// and its AQI monitoring stations — both of which derive stable per-record
// values from the id, see data/campusMetrics.js and data/cameraRegistry.js.
function campus2BuildingsForRoster() {
  const list = [];
  const push = (f, prefix) => list.push({
    id: `CAMPUS2-${prefix}-${f.properties?.name}`,
    centroid: polygonCentroidLonLat(f.geometry.coordinates[0]),
    display_name: f.properties.name,
  });
  for (const f of campus2Building?.features || []) {
    if (f.properties?.role !== 'solid') continue;
    push(f, 'plaza');
  }
  for (const f of campus2ExtraBuildings?.features || []) push(f, 'extra');
  for (const f of campus2Buildings02?.features || []) push(f, 'buildings02');
  return list;
}

function buildingsToFeatureCollection(buildings) {
  return { type: 'FeatureCollection', features: buildings.map((b) => ({ type: 'Feature', geometry: b.geometry, properties: {} })) };
}

export default function DigitalTwin2() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const buildingsLayerRef = useRef(null);
  const treeLayerRef = useRef(null);
  const footballLayerRef = useRef(null);
  const fenceLayerRef = useRef(null);
  const pedestrianLayerRef = useRef(null);
  const lightingLayerRef = useRef(null);
  const securityLayerRef = useRef(null);
  const gateLayerRef = useRef(null);
  const cctvLayerRef = useRef(null);
  const patrolMarkerLayerRef = useRef(null);
  const personnelLayerRef = useRef(null);
  const campus2BoundaryLayerRef = useRef(null);
  const campus2FenceLayerRef = useRef(null);
  const campus2BuildingLayerRef = useRef(null);
  const campus2ExtraBuildingsLayerRef = useRef(null);
  const campus2Buildings02LayerRef = useRef(null);
  const campus2CircleLayerRef = useRef(null);
  const campus2RoadLayerRef = useRef(null);
  const campus2RoundaboutLayerRef = useRef(null);
  const campus2ParkingLayerRef = useRef(null);
  const campus2FootballLayerRef = useRef(null);
  const campus2CourtsLayerRef = useRef(null);
  const campus2ParadeGroundLayerRef = useRef(null);
  const stopBoundaryPulseRef = useRef(null);
  const savedCameraRef = useRef(null);
  const cancelOrbitRef = useRef(null);
  const selectedRef = useRef(null);
  const selectedPersonRef = useRef(null);
  const selectedCameraRef = useRef(null);
  const breachFlownRef = useRef(false);

  const { data: gis, loading: gisLoading, error: gisError } = useGIS();
  const { data: buildings, loading: buildingsLoading, error: buildingsError } = useBuildings();
  const loading = gisLoading || buildingsLoading;
  const error = gisError || buildingsError;

  // All layers still in the (trimmed) Layers panel default ON — the ones
  // that used to default off (walkways, street lighting, patrol, etc.)
  // were pulled from the panel entirely for now, see LayerControl.jsx.
  const DEFAULT_OFF_KEYS = new Set([]);
  const [visibility, setVisibility] = useState(
    Object.fromEntries(ALL_LAYER_KEYS.map((k) => [k, !DEFAULT_OFF_KEYS.has(k)]))
  );
  const [futureVisibility, setFutureVisibility] = useState(Object.fromEntries(ALL_FUTURE_KEYS.map((k) => [k, false])));
  const [mapReady, setMapReady] = useState(false);
  // True once the map style has loaded AND every layer (buildings, roads,
  // fence, personnel roster, labels, initial zoom-to-fit…) has actually
  // been built — separate from `loading` below, which only covers the
  // initial GIS/buildings JSON fetch and returns long before the map/
  // scene is actually visible.
  const [sceneReady, setSceneReady] = useState(false);
  const [hovered, setHovered] = useState(null); // { building, x, y }
  const [selected, setSelected] = useState(null); // building record
  const [block3Open, setBlock3Open] = useState(false);
  const [adminBlockOpen, setAdminBlockOpen] = useState(false);
  const [breachState, setBreachState] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [hoveredPerson, setHoveredPerson] = useState(null); // { id, x, y }
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [hoveredCamera, setHoveredCamera] = useState(null); // { camera, x, y }
  const [selectedCamera, setSelectedCamera] = useState(null); // camera record
  const [cameraAnchor, setCameraAnchor] = useState(null); // selected camera's screen position, for the popup
  const [cameraHealth, setCameraHealth] = useState(null); // fleet roll-up for the Layers panel
  // Camera filter facets — an empty Set means "no filter on this facet".
  const [cameraFilter, setCameraFilter] = useState({ statuses: new Set(), kinds: new Set(), campuses: new Set() });
  // Which environmental/utility analytics overlay is recolouring the
  // buildings — 'aqi' | 'water' | 'power' | null. Exclusive by design: they
  // all tint the same meshes (see LayerControl.jsx's ANALYTICS_OVERLAYS).
  const [analyticsOverlay, setAnalyticsOverlay] = useState(null);
  const [, setLiveTick] = useState(0); // forces a re-render each second so hovered/selected personnel show fresh telemetry

  // 1. mount the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_DARK_MATTER_STYLE,
      center: FALLBACK_CENTER,
      zoom: 18.4,
      pitch: 15,
      bearing: 180,
      antialias: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left');
    clampZoomLimits(map);
    map.on('load', () => setMapReady(true));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // 2. once the map style, GIS layers, AND buildings are all ready, wire everything up
  useEffect(() => {
    if (!mapReady || !gis || !buildings.length) return;
    const map = mapRef.current;

    addBoundaryLayer(map, gis);
    addRoadLayer(map, gis);
    addGrassLayer(map, gis);
    addParkingLayer(map, gis);
    addWaterLayer(map, gis);
    addPatrolRouteLayer(map, gis.boundary);
    stopBoundaryPulseRef.current = startBoundaryPulse(map);

    const anchor = ringBBoxCenter(gis.boundary) || FALLBACK_CENTER;

    const buildingsLayer = createBuildingsLayer({ id: 'zt2-buildings-3d', anchor });
    map.addLayer(buildingsLayer);
    buildingsLayerRef.current = buildingsLayer;

    const treeLayer = createTreeLayer({ id: 'zt2-trees-3d', anchor });
    map.addLayer(treeLayer);
    treeLayerRef.current = treeLayer;

    const footballLayer = createFootballGroundLayer({ id: 'zt2-football-3d', anchor });
    map.addLayer(footballLayer);
    footballLayerRef.current = footballLayer;

    const fenceLayer = createFenceLayer({ id: 'zt2-fence-3d', anchor });
    map.addLayer(fenceLayer);
    fenceLayerRef.current = fenceLayer;

    const pedestrianLayer = createPedestrianLayer({ id: 'zt2-pedestrian-3d', anchor });
    map.addLayer(pedestrianLayer);
    pedestrianLayerRef.current = pedestrianLayer;

    const lightingLayer = createLightingLayer({ id: 'zt2-lighting-3d', anchor });
    map.addLayer(lightingLayer);
    lightingLayerRef.current = lightingLayer;

    const securityLayer = createSecurityLayer({ id: 'zt2-security-3d', anchor });
    map.addLayer(securityLayer);
    securityLayerRef.current = securityLayer;

    const gateLayer = createGateLayer({ id: 'zt2-gate-3d', anchor });
    map.addLayer(gateLayer);
    gateLayerRef.current = gateLayer;

    const cctvLayer = createCCTVLayer({ id: 'zt2-cctv-3d', anchor });
    map.addLayer(cctvLayer);
    cctvLayerRef.current = cctvLayer;

    const patrolMarkerLayer = createPatrolMarkerLayer({ id: 'zt2-patrol-marker-3d', anchor });
    map.addLayer(patrolMarkerLayer);
    patrolMarkerLayerRef.current = patrolMarkerLayer;

    // Created here (Campus 1's own personnel expect it at this point), but
    // NOT added to the map yet — see the addLayer() call further down,
    // after Campus 2's roads/fence/parking/sports layers and before its
    // building layers, so personnel paint on top of Campus 2's ground-level
    // infrastructure but still sit under its buildings (MapLibre custom
    // layers draw in addLayer() call order; painted-over pixels don't show
    // through even for this layer's always-on-top depthTest:false markers,
    // since without a shared building-layer paint AFTER it there's nothing
    // to occlude them with).
    const personnelLayer = createPersonnelLayer({ id: 'zt2-personnel-3d', anchor });

    // Campus 2 — a second, real ZMU site rendered in this SAME map/scene
    // at its own true coordinates (from zmu_campus_2.txt, converted by
    // client/src/utils/txtToGeojson.js), sharing this same anchor/
    // projection so it sits at its correct real-world position relative
    // to the Campus 1 geometry above. Entirely additive: none of the
    // Campus 1 layers above are touched.
    const campus2BoundaryLayer = createCampus2BoundaryLayer({ id: 'zt2-campus2-boundary-3d', anchor });
    map.addLayer(campus2BoundaryLayer);
    campus2BoundaryLayerRef.current = campus2BoundaryLayer;

    // Same real 3-D security fence (chain-link panel + posts + top wire +
    // warning boards) Campus 1's perimeter uses — createFenceLayer() is
    // already generic (just {id, anchor} + a boundary FeatureCollection),
    // so this is a second instance of the exact same Campus 1 layer
    // function, not a copy/fork, fed Campus 2's own real boundary.
    const campus2FenceLayer = createFenceLayer({ id: 'zt2-campus2-fence-3d', anchor });
    map.addLayer(campus2FenceLayer);
    campus2FenceLayerRef.current = campus2FenceLayer;

    // Phase 2 — simple road network (campus2/roads.geojson +
    // roundabouts.geojson, see txtToGeojson.js's buildSimpleRoadNetwork()).
    // A separate layer/toggle from the boundary/building/circles below so
    // future phases (walkways.geojson, medians.geojson) can each be added
    // the same way without touching any of this.
    // Added BEFORE the building layers below so roads/roundabouts sit as
    // the lower layer and the buildings render visibly on top of them
    // (MapLibre custom layers draw in addLayer() call order).
    const campus2RoadLayer = createCampus2RoadLayer({ id: 'zt2-campus2-roads-3d', anchor });
    map.addLayer(campus2RoadLayer);
    campus2RoadLayerRef.current = campus2RoadLayer;

    const campus2RoundaboutLayer = createCampus2RoundaboutLayer({ id: 'zt2-campus2-roundabouts-3d', anchor });
    map.addLayer(campus2RoundaboutLayer);
    campus2RoundaboutLayerRef.current = campus2RoundaboutLayer;

    // Phase 3 — sports & parking infrastructure (campus2/parking_lot_N,
    // campus2/{parade_ground_training_area,football_ground_N,
    // basket_ball_court_2,tennis_court}.geojson, all from
    // zmu_campus_2_02.txt). Added after roads/roundabouts and before the
    // building layers below, matching the requested draw order (roads →
    // parking → sports/parade → buildings on top).
    const campus2ParkingLayer = createCampus2ParkingLayer({ id: 'zt2-campus2-parking-3d', anchor });
    map.addLayer(campus2ParkingLayer);
    campus2ParkingLayerRef.current = campus2ParkingLayer;

    const campus2FootballLayer = createCampus2FootballLayer({ id: 'zt2-campus2-football-3d', anchor });
    map.addLayer(campus2FootballLayer);
    campus2FootballLayerRef.current = campus2FootballLayer;

    // Phase 3A — the detailed rebuild of the basketball/tennis courts and
    // the parade ground (bay-grid-style procedural detail generated inside
    // each real footprint — see Campus2CourtsLayer.jsx/
    // Campus2ParadeGroundLayer.jsx headers).
    const campus2CourtsLayer = createCampus2CourtsLayer({ id: 'zt2-campus2-courts-3d', anchor });
    map.addLayer(campus2CourtsLayer);
    campus2CourtsLayerRef.current = campus2CourtsLayer;

    const campus2ParadeGroundLayer = createCampus2ParadeGroundLayer({ id: 'zt2-campus2-parade-3d', anchor });
    map.addLayer(campus2ParadeGroundLayer);
    campus2ParadeGroundLayerRef.current = campus2ParadeGroundLayer;

    const campus2CircleLayer = createCampus2CircleLayer({ id: 'zt2-campus2-circles-3d', anchor });
    map.addLayer(campus2CircleLayer);
    campus2CircleLayerRef.current = campus2CircleLayer;

    // Personnel — added here, above every Campus 2 ground-level layer
    // (fence/roads/roundabouts/parking/football/courts/parade/circles) but
    // below the building layers next.
    map.addLayer(personnelLayer);
    personnelLayerRef.current = personnelLayer;

    const campus2BuildingLayer = createCampus2BuildingLayer({ id: 'zt2-campus2-building-3d', anchor });
    map.addLayer(campus2BuildingLayer);
    campus2BuildingLayerRef.current = campus2BuildingLayer;

    // 38 additional real building footprints (campus2/extra_buildings.geojson,
    // from zmu_campus_2_buildings.txt) — same holographic glass treatment as
    // the central plaza building above, added last so it also sits above
    // the road/roundabout layers.
    const campus2ExtraBuildingsLayer = createCampus2ExtraBuildingsLayer({ id: 'zt2-campus2-extra-buildings-3d', anchor });
    map.addLayer(campus2ExtraBuildingsLayer);
    campus2ExtraBuildingsLayerRef.current = campus2ExtraBuildingsLayer;

    // 12 more real building footprints (campus2/buildings_02.geojson, from
    // zmu_campus_2_02.txt) — reuses the same Campus2ExtraBuildingsLayer
    // renderer (matching holographic glass colour), just a second instance
    // with its own data, added last so it's above everything else too.
    const campus2Buildings02Layer = createCampus2ExtraBuildingsLayer({ id: 'zt2-campus2-buildings-02-3d', anchor, idPrefix: 'buildings02' });
    map.addLayer(campus2Buildings02Layer);
    campus2Buildings02LayerRef.current = campus2Buildings02Layer;

    campus2BoundaryLayer.setBoundary(campus2Boundary);
    campus2FenceLayer.setFences(campus2Boundary);
    campus2BuildingLayer.setBuilding(campus2Building);
    campus2ExtraBuildingsLayer.setBuildings(campus2ExtraBuildings);
    campus2Buildings02Layer.setBuildings(campus2Buildings02);
    campus2CircleLayer.setCircles(campus2Circles);
    campus2RoadLayer.setRoads(campus2Roads);
    campus2RoundaboutLayer.setRoundabouts(campus2Roundabouts);
    campus2ParkingLayer.setLots([campus2ParkingLot1, campus2ParkingLot2, campus2ParkingLot3]);
    campus2FootballLayer.setGrounds([campus2FootballGround1, campus2FootballGround2]);
    campus2CourtsLayer.setCourts(campus2BasketballCourt, campus2TennisCourt);
    campus2ParadeGroundLayer.setGround(campus2ParadeGround);

    buildingsLayer.setBuildings(buildings);
    treeLayer.setTrees(gis.trees);
    footballLayer.setPitches(gis.sportsfields);
    // Using the campus boundary (now verified against live OSM data) for
    // the fence run, not gis.fences — fence.txt's own digitized segments
    // only trace a few short stretches, not the full perimeter. Revisit
    // once a fuller fence.txt digitization exists.
    fenceLayer.setFences(gis.boundary);
    const layout = generateCampusLayout({
      anchor, boundary: gis.boundary, roads: gis.roads, buildings,
      parking: gis.parking, sportsfields: gis.sportsfields, grounds: gis.grounds, water: gis.water,
    });
    pedestrianLayer.setLayout(layout);

    // Simulated Garmin-wearable personnel — walk the same walkway/road
    // network (deduped into a proper node graph, see MovementEngine.js)
    // so they can never cross a building footprint or leave campus. Roads
    // now include Campus 2's real network too (its own separate, naturally
    // disconnected graph component, since the two sites are geographically
    // apart) — same mechanism, same colours, no new layer. The loop road's
    // own LineString (see txtToGeojson.js) is deliberately NOT closed with
    // a repeated first point (that combination broke the rendered ribbon's
    // mitred seam — see Campus2RoadLayer.jsx's fix), but buildWalkGraph()
    // only connects consecutive points and has no idea about the road
    // layer's own `closed` flag, so without help the walk graph sees the
    // loop as an open path missing its final closing edge. A local-only
    // copy (the imported campus2Roads asset itself is left untouched) adds
    // that edge back just for graph connectivity.
    const campus2RoadsForGraph = {
      features: (campus2Roads?.features || []).map((f) => (
        f.properties?.tier === 'loop' && f.geometry?.type === 'LineString'
          ? { ...f, geometry: { ...f.geometry, coordinates: [...f.geometry.coordinates, f.geometry.coordinates[0]] } }
          : f
      )),
    };
    const walkGraph = buildWalkGraph({
      anchor, walkways: layout.walkways,
      roads: { features: [...(gis.roads?.features || []), ...campus2RoadsForGraph.features] },
    });

    // Campus 1's roster, unchanged from before Campus 2 existed.
    const roster1 = generateRoster({ count: 150, anchor, boundary: gis.boundary, buildings, walkGraph, seed: 7 });

    // A second, dedicated batch for Campus 2, real-boundary-constrained
    // free-roam movement for its active people — see below.
    const c2Projection = createProjection(anchor);
    const c2Ring = campus2Boundary?.features?.[0]?.geometry?.coordinates || [];
    const c2Local = c2Ring.map(([lon, lat]) => c2Projection.projectCoordinate(lon, lat));

    // Campus 2's real road network is just a handful of radials/
    // roundabouts (the "interior" tiers) plus one much-more-densely-
    // digitized Perimeter Road that happens to trace the same real
    // coordinates as the security fence — confining "active" people to
    // that graph's own edges made every one of them either converge onto
    // the sparse interior paths or (since the perimeter's hundreds of
    // points dominate a uniform pick, and it shares no points with the
    // interior network) get stuck walking the boundary ring itself,
    // reading as "walking on the fence." Active Campus 2 personnel now
    // free-roam (see MovementEngine.js's createWanderState/
    // stepWanderState) to random points strictly inside the real
    // boundary polygon instead — genuinely moving around the whole
    // campus, not following road centrelines at all.
    const rngC2 = mulberry32(7331);
    const roster2 = generateRoster({
      count: 220, anchor, boundary: null, // null: placeInactivePerson only knows Campus 1's boundary
      buildings: campus2BuildingsForRoster(), walkGraph, seed: 71,
    }).map((p, i) => {
      const id = `ZMU-C2-${1000 + i}`;
      // inactive (red, static near a real building) — unchanged, already
      // works via placeInactivePerson's own building-anchored placement.
      if (p.status === 'inactive' || !c2Local.length) return { ...p, id };
      const start = c2Local[Math.floor(rngC2() * c2Local.length)];
      return {
        ...p, id, walk: null,
        wander: createWanderState(start, c2Local, rngC2), wanderBoundary: c2Local,
      };
    });

    personnelLayer.setPersonnel([...roster1, ...roster2], walkGraph);

    const gateBuilding = buildings.find((b) => b.category === 'gate');
    lightingLayer.setLights(computeLightPositions({
      anchor, roads: gis.roads, walkways: layout.walkways, buildings, parking: gis.parking,
      gate: gateBuilding?.centroid,
    }));
    securityLayer.setSecurity({ buildings, boundary: gis.boundary });
    gateLayer.setGate(gateBuilding);
    cctvLayer.setCCTV({ buildings, roads: gis.roads, parking: gis.parking, sportsfields: gis.sportsfields, grounds: gis.grounds, boundary: gis.boundary });
    // Campus 2 gets the same camera network from its own real building
    // centroids, so the second site isn't a CCTV blind spot.
    const campus2Candidates = campus2BuildingsForRoster();
    cctvLayer.setCampus2Cameras(campus2Candidates);
    setCameraHealth({ ...summariseCameraHealth(cctvLayer.getCameras()), shown: cctvLayer.getCameras().length });

    patrolMarkerLayer.setRoutes(gis.boundary);
    addBuildingLabelsLayer(map, buildings);

    // Air-quality affected-area plume — a native MapLibre heatmap over the
    // real monitoring-station points, added LAST so it paints above the
    // 3-D layers the way an air-quality overlay reads. Starts hidden; the
    // Environment & Utilities overlay picker turns it on.
    addAQIPlumeLayer(map, makeAQIStations([buildings, campus2Candidates]), { visible: false });

    // Camera map icons — added last so they sit above every other layer,
    // including the AQI plume. These, not the 3-D camera geometry, are what
    // the operator actually sees and clicks at campus zoom.
    addCameraMarkerLayer(map, cctvLayer.getCameras(), { visible: visibility.cctv });

    // Open on BOTH campuses in view (same fit the "Zoom to fit" button
    // does) rather than a hardcoded close-in zoom level or Campus 1 alone —
    // campus2Boundary's real coordinates pull the fit bounds wide enough to
    // include the whole second site. fitBounds keeps the map's current
    // bearing (already 180 from the initial construction above) when no
    // bearing option is passed.
    zoomToFit(map, gis.boundary, buildingsToFeatureCollection(buildings), campus2Boundary);

    for (const key of ALL_LAYER_KEYS) {
      setNativeLayerVisible(map, key, visibility[key]);
      if (key === 'buildings') buildingsLayer.setVisible(visibility[key]);
      if (key === 'trees') treeLayer.setVisible(visibility[key]);
      if (key === 'sportsfields') footballLayer.setVisible(visibility[key]);
      if (key === 'fences') fenceLayer.setVisible(visibility[key]);
      if (key === 'walkways') pedestrianLayer.setVisible(visibility[key]);
      if (key === 'security_lighting') lightingLayer.setVisible(visibility[key]);
      if (key === 'security') { securityLayer.setVisible(visibility[key]); gateLayer.setVisible(visibility[key]); }
      if (key === 'cctv') cctvLayer.setVisible(visibility[key]);
      if (key === 'patrol') patrolMarkerLayer.setVisible(visibility[key]);
      if (key === 'personnel') personnelLayer.setVisible(visibility[key]);
      if (key === 'campus2') {
        campus2BoundaryLayer.setVisible(visibility[key]);
        campus2FenceLayer.setVisible(visibility[key]);
        campus2BuildingLayer.setVisible(visibility[key]);
        campus2ExtraBuildingsLayer.setVisible(visibility[key]);
        campus2Buildings02Layer.setVisible(visibility[key]);
        campus2CircleLayer.setVisible(visibility[key]);
      }
      if (key === 'campus2_roads') { campus2RoadLayer.setVisible(visibility[key]); campus2RoundaboutLayer.setVisible(visibility[key]); }
      if (key === 'campus2_infra') {
        campus2ParkingLayer.setVisible(visibility[key]);
        campus2FootballLayer.setVisible(visibility[key]);
        campus2CourtsLayer.setVisible(visibility[key]);
        campus2ParadeGroundLayer.setVisible(visibility[key]);
      }
    }

    // Walkways, street lighting and patrol routes were pulled from the
    // Layers panel for now (see LayerControl.jsx) — since they're no
    // longer in ALL_LAYER_KEYS, the loop above never touches them, so
    // force them off here instead of leaving them at their created-visible
    // default. Not deleted, just hidden — flip these back on by restoring
    // their LayerControl.jsx entries.
    pedestrianLayer.setVisible(false);
    lightingLayer.setVisible(false);
    patrolMarkerLayer.setVisible(false);
    setNativeLayerVisible(map, 'patrol', false);

    // Every layer with real, pickable building meshes — Campus 1's real
    // buildings plus Campus 2's star complex / 38-building set / 12-
    // building set — tried in this order, first hit wins.
    const buildingPickLayers = [buildingsLayer, campus2BuildingLayer, campus2ExtraBuildingsLayer, campus2Buildings02Layer];

    // pointer interaction: hover + click picking, personnel markers first
    // (smaller/easier-to-miss targets get priority), falling back to the
    // real building meshes across both campuses so existing building
    // hover/click is unaffected.
    const onMouseMove = (e) => {
      const { clientX, clientY } = e.originalEvent;
      const person = personnelLayer.pickAt(clientX, clientY);
      if (person) {
        for (const l of buildingPickLayers) l.setHoveredId(null);
        setHovered(null);
        cctvLayer.setHoveredId(null);
        setHoveredCamera(null);
        personnelLayer.setHoveredId(person.id);
        map.getCanvas().style.cursor = 'pointer';
        setHoveredPerson({ id: person.id, x: clientX, y: clientY });
        return;
      }
      personnelLayer.setHoveredId(null);
      setHoveredPerson(null);

      // Cameras before buildings — a camera icon sits on top of the
      // building it watches, so the building mesh behind it would otherwise
      // always win. Picked off the marker symbol layer (a generous 6 px
      // box) rather than by raycasting the 3-D camera, which was both
      // fiddly to hit and gated to zoom ≥ 16.5.
      const cam = cctvLayer.getCamera(pickCameraMarker(map, e.point));
      if (cam) {
        for (const l of buildingPickLayers) l.setHoveredId(null);
        setHovered(null);
        cctvLayer.setHoveredId(cam.id);
        map.getCanvas().style.cursor = 'pointer';
        setHoveredCamera({ camera: cam, x: clientX, y: clientY });
        return;
      }
      cctvLayer.setHoveredId(null);
      setHoveredCamera(null);

      let rec = null;
      for (const l of buildingPickLayers) {
        rec = l.pickAt(clientX, clientY);
        if (rec) {
          for (const other of buildingPickLayers) if (other !== l) other.setHoveredId(null);
          l.setHoveredId(rec.id);
          break;
        }
      }
      if (!rec) for (const l of buildingPickLayers) l.setHoveredId(null);
      map.getCanvas().style.cursor = rec ? 'pointer' : '';
      setHovered(rec ? { building: rec, x: clientX, y: clientY } : null);
    };
    // Click: fly + orbit to the target, pulse-highlight it. Block-3 opens
    // the full immersive Sketchfab modal instead of the regular side-panel
    // popup — it's the only building with a real interior scan. Clicking a
    // personnel marker opens the Personnel panel instead of the building
    // popup/modals, orbiting a live-refollowed camera since (unlike a
    // building) the target keeps moving. Clicking empty space closes
    // whatever is open and restores the pre-selection camera view.
    const onClick = (e) => {
      const { clientX, clientY } = e.originalEvent;
      const person = personnelLayer.pickAt(clientX, clientY);
      if (person) {
        if (!selectedRef.current && !selectedPersonRef.current) savedCameraRef.current = captureCameraState(map);
        cancelOrbitRef.current?.();
        cancelOrbitRef.current = orbitToPerson(map, () => personnelLayer.getPersonWorldPos(person.id)?.lonLat ?? null);
        for (const l of buildingPickLayers) l.setSelectedId(null);
        setSelected(null);
        selectedRef.current = null;
        setBlock3Open(false);
        setAdminBlockOpen(false);
        cctvLayer.setSelectedId(null);
        setSelectedCamera(null);
        selectedCameraRef.current = null;
        personnelLayer.setSelectedId(person.id);
        setSelectedPersonId(person.id);
        selectedPersonRef.current = person.id;
        return;
      }

      // A camera click opens its feed + health panel. Unlike a building or
      // a person it does NOT fly/orbit the camera — the operator wants to
      // keep the surrounding scene in view while watching the feed.
      const cam = cctvLayer.getCamera(pickCameraMarker(map, e.point));
      if (cam) {
        // Stop any building/person orbit still running and drop the saved
        // pre-selection view — the map deliberately stays where it is, so
        // there's nothing left to restore later.
        cancelOrbitRef.current?.();
        cancelOrbitRef.current = null;
        savedCameraRef.current = null;
        for (const l of buildingPickLayers) l.setSelectedId(null);
        setSelected(null);
        selectedRef.current = null;
        setBlock3Open(false);
        setAdminBlockOpen(false);
        personnelLayer.setSelectedId(null);
        setSelectedPersonId(null);
        selectedPersonRef.current = null;
        cctvLayer.setSelectedId(cam.id);
        setSelectedCamera(cam);
        selectedCameraRef.current = cam.id;
        return;
      }

      let rec = null, hitLayer = null;
      for (const l of buildingPickLayers) {
        rec = l.pickAt(clientX, clientY);
        if (rec) { hitLayer = l; break; }
      }
      if (!rec) { closeSelection(); return; }
      if (!selectedRef.current && !selectedPersonRef.current) savedCameraRef.current = captureCameraState(map);
      cancelOrbitRef.current?.();
      cancelOrbitRef.current = orbitToBuilding(map, rec);
      cctvLayer.setSelectedId(null);
      setSelectedCamera(null);
      selectedCameraRef.current = null;
      personnelLayer.setSelectedId(null);
      setSelectedPersonId(null);
      selectedPersonRef.current = null;
      for (const l of buildingPickLayers) l.setSelectedId(l === hitLayer ? rec.id : null);
      setSelected(rec);
      selectedRef.current = rec;
      setBlock3Open(rec.id === 'REAL-BLOCK-3');
      setAdminBlockOpen(rec.id === 'REAL-ADMIN-1');
    };
    map.on('mousemove', onMouseMove);
    map.on('click', onClick);

    map.triggerRepaint();
    setSceneReady(true);
    return () => {
      map.off('mousemove', onMouseMove);
      map.off('click', onClick);
      stopBoundaryPulseRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, gis, buildings]);

  // Restores the pre-selection camera + clears highlight/fade state —
  // shared by clicking empty space, the popup/modal close button, and Esc.
  function closeSelection() {
    cancelOrbitRef.current?.();
    cancelOrbitRef.current = null;
    if (savedCameraRef.current) restoreCamera(mapRef.current, savedCameraRef.current);
    savedCameraRef.current = null;
    buildingsLayerRef.current?.setSelectedId(null);
    campus2BuildingLayerRef.current?.setSelectedId(null);
    campus2ExtraBuildingsLayerRef.current?.setSelectedId(null);
    campus2Buildings02LayerRef.current?.setSelectedId(null);
    setSelected(null);
    selectedRef.current = null;
    setBlock3Open(false);
    setAdminBlockOpen(false);
    personnelLayerRef.current?.setSelectedId(null);
    setSelectedPersonId(null);
    selectedPersonRef.current = null;
    cctvLayerRef.current?.setSelectedId(null);
    setSelectedCamera(null);
    selectedCameraRef.current = null;
  }

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') closeSelection(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Personnel telemetry mutates in place inside PersonnelLayer's render
  // loop (see tickTelemetry, ~1/s) rather than going through React state —
  // this just forces a re-render every second while a hover tooltip or
  // selection panel is open so those two read the freshest values instead
  // of a stale snapshot from the moment they were opened.
  useEffect(() => {
    if (!hoveredPerson && !selectedPersonId) return;
    const t = setInterval(() => setLiveTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [hoveredPerson, selectedPersonId]);

  // Camera filter — pushes the facets into the layer, then reconciles the
  // UI with what actually survived (a selected/hovered camera that has just
  // been filtered away must not keep its popup open).
  useEffect(() => {
    if (!sceneReady) return;
    const layer = cctvLayerRef.current;
    if (!layer) return;
    const remaining = layer.setFilter(cameraFilter);
    // The markers are the visible fleet — rebuilt from what survived the
    // filter, so a filtered-out camera can't be left clickable on the map.
    setCameraMarkers(mapRef.current, layer.getVisibleCameras());
    setCameraHealth({ ...summariseCameraHealth(layer.getCameras()), shown: remaining.length });
    setSelectedCamera((prev) => {
      if (prev && !remaining.includes(prev.id)) { selectedCameraRef.current = null; return null; }
      return prev;
    });
    setHoveredCamera((prev) => (prev && !remaining.includes(prev.camera.id) ? null : prev));
  }, [cameraFilter, sceneReady]);

  // Selection ring on the map icon — driven off the selected record rather
  // than set at each of the several call sites that can clear a selection,
  // so the ring can never be left behind on a deselected camera.
  useEffect(() => {
    if (sceneReady && mapRef.current) setSelectedCameraMarker(mapRef.current, selectedCamera?.id || null);
  }, [selectedCamera, sceneReady]);

  // Keep the camera popup pinned to its camera as the map pans/zooms/rotates.
  useEffect(() => {
    const map = mapRef.current;
    if (!selectedCamera || !map || !selectedCamera.lonLat) { setCameraAnchor(null); return; }
    const update = () => {
      const p = map.project(selectedCamera.lonLat);
      setCameraAnchor({ x: p.x, y: p.y });
    };
    update();
    map.on('move', update);
    map.on('rotate', update);
    return () => { map.off('move', update); map.off('rotate', update); };
  }, [selectedCamera]);

  // Air quality is a ground-level field, and the 3-D building masses sit
  // right on top of it — with them up, the plume is mostly hidden behind
  // walls and roofs. So the building meshes (and their labels) are
  // suppressed for the duration of the AQI overlay. The Layers-panel
  // checkboxes keep their own state untouched and are honoured again the
  // moment AQI is switched off; this is the single place both that
  // suppression and the normal toggles resolve, so the two can't disagree.
  function applyBuildingVisibility(vis, overlay) {
    const map = mapRef.current;
    const suppressed = overlay === 'aqi';
    buildingsLayerRef.current?.setVisible(!suppressed && !!vis.buildings);
    const c2 = !suppressed && !!vis.campus2;
    campus2BuildingLayerRef.current?.setVisible(c2);
    campus2ExtraBuildingsLayerRef.current?.setVisible(c2);
    campus2Buildings02LayerRef.current?.setVisible(c2);
    if (map?.getLayer(LABEL_LAYER_ID)) {
      map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', !suppressed && vis.buildings ? 'visible' : 'none');
    }
  }

  // Environment & Utilities overlay — recolours every building layer by the
  // selected metric's threshold band, and (AQI only) reveals the
  // affected-area plume while standing the buildings down. One effect
  // drives all of it so turning an overlay on/off can never leave half the
  // campus tinted or half of it hidden.
  useEffect(() => {
    if (!sceneReady) return;
    const map = mapRef.current;
    if (!map) return;
    const colorFn = analyticsOverlay ? (record) => overlayColor(analyticsOverlay, record) : null;
    for (const ref of [buildingsLayerRef, campus2BuildingLayerRef, campus2ExtraBuildingsLayerRef, campus2Buildings02LayerRef]) {
      ref.current?.setMetricTint(colorFn);
    }
    setAQIPlumeVisible(map, analyticsOverlay === 'aqi');
    applyBuildingVisibility(visibility, analyticsOverlay);
    map.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsOverlay, sceneReady]);

  // Peak reading across every building, for the legend's "Peak:" line —
  // recomputed only when the overlay or the loaded buildings change.
  const overlaySummary = React.useMemo(() => {
    if (!analyticsOverlay || !buildings.length) return null;
    const all = [...buildings, ...campus2BuildingsForRoster()];
    let worst = null;
    for (const b of all) {
      const value = overlayValue(analyticsOverlay, readBuildingMetrics(b));
      if (!worst || value > worst.value) worst = { value, label: b.display_name };
    }
    const band = worst ? bandFor(analyticsOverlay, worst.value) : null;
    return {
      stations: Math.ceil(all.length / 3),
      worst: worst && { label: worst.label, css: band.css, readout: overlayReadout(analyticsOverlay, { [analyticsOverlay]: { value: worst.value } }) },
    };
  }, [analyticsOverlay, buildings]);

  function toggleLayer(key) {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const map = mapRef.current;
      if (map) {
        setNativeLayerVisible(map, key, next[key]);
        // Building meshes resolve through applyBuildingVisibility so the
        // AQI overlay's suppression isn't undone by a checkbox click.
        if (key === 'buildings' || key === 'campus2') applyBuildingVisibility(next, analyticsOverlay);
        if (key === 'trees') treeLayerRef.current?.setVisible(next[key]);
        if (key === 'sportsfields') footballLayerRef.current?.setVisible(next[key]);
        if (key === 'fences') fenceLayerRef.current?.setVisible(next[key]);
        if (key === 'walkways') pedestrianLayerRef.current?.setVisible(next[key]);
        if (key === 'security_lighting') lightingLayerRef.current?.setVisible(next[key]);
        if (key === 'security') { securityLayerRef.current?.setVisible(next[key]); gateLayerRef.current?.setVisible(next[key]); }
        if (key === 'cctv') {
          cctvLayerRef.current?.setVisible(next[key]);
          setCameraMarkersVisible(map, next[key]);
          // Hiding the layer has to drop any open camera panel/tooltip too,
          // otherwise the feed keeps playing for a camera that's no longer
          // on the map.
          if (!next[key]) {
            cctvLayerRef.current?.setSelectedId(null);
            cctvLayerRef.current?.setHoveredId(null);
            setSelectedCamera(null);
            selectedCameraRef.current = null;
            setHoveredCamera(null);
          }
        }
        if (key === 'patrol') patrolMarkerLayerRef.current?.setVisible(next[key]);
        if (key === 'personnel') personnelLayerRef.current?.setVisible(next[key]);
        if (key === 'campus2') {
          // Building meshes were already handled by applyBuildingVisibility above.
          campus2BoundaryLayerRef.current?.setVisible(next[key]);
          campus2FenceLayerRef.current?.setVisible(next[key]);
          campus2CircleLayerRef.current?.setVisible(next[key]);
        }
        if (key === 'campus2_roads') { campus2RoadLayerRef.current?.setVisible(next[key]); campus2RoundaboutLayerRef.current?.setVisible(next[key]); }
        if (key === 'campus2_infra') {
          campus2ParkingLayerRef.current?.setVisible(next[key]);
          campus2FootballLayerRef.current?.setVisible(next[key]);
          campus2CourtsLayerRef.current?.setVisible(next[key]);
          campus2ParadeGroundLayerRef.current?.setVisible(next[key]);
        }
        map.triggerRepaint();
      }
      return next;
    });
  }

  function toggleFuture(key) {
    // Pure UI placeholder — no data source or rendering exists yet.
    setFutureVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleZoomToFit() {
    if (mapRef.current && gis) zoomToFit(mapRef.current, gis.boundary, buildingsToFeatureCollection(buildings), campus2Boundary);
  }

  const SYNTHETIC_KEYS = new Set(['buildings', 'walkways', 'security_lighting', 'security', 'cctv', 'patrol', 'personnel', 'campus2', 'campus2_roads', 'campus2_infra']);
  const emptyKeys = new Set(
    gis ? ALL_LAYER_KEYS.filter((k) => !SYNTHETIC_KEYS.has(k) && (gis[k]?.features?.length ?? 0) === 0) : []
  );

  // No live breach sensor exists — this drives FenceLayer.jsx's demo
  // animation only (see GeofenceEngine.js). FenceLayer still owns the real
  // fence-segment breach path math; a random ACTIVE personnel marker is
  // "puppeted" along that same path each frame (PersonnelLayer.setBreachPosition)
  // and given a bigger, faster-pulsing highlight (setBreachTarget) so it's
  // obvious which tracked person is the one heading toward the fence,
  // rather than an unrelated synthetic marker. Flies the camera once, the
  // first time it crosses the fence line.
  function handleSimulateBreach() {
    if (!fenceLayerRef.current) return;
    setSimulating(true);
    breachFlownRef.current = false;
    const intruder = personnelLayerRef.current?.pickRandomActivePerson();
    personnelLayerRef.current?.setBreachTarget(intruder?.id ?? null);
    fenceLayerRef.current.simulateBreach((update) => {
      if (update.done) {
        setSimulating(false);
        setBreachState(null);
        personnelLayerRef.current?.setBreachTarget(null);
        return;
      }
      setBreachState(update);
      if (intruder && update.lonLat) personnelLayerRef.current?.setBreachPosition(intruder.id, update.lonLat);
      if (update.state === 'crossing' && !breachFlownRef.current && update.lonLat) {
        breachFlownRef.current = true;
        mapRef.current?.flyTo({ center: update.lonLat, zoom: 19, pitch: 15, duration: 1200, essential: true });
      }
    });
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0a0f16' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <LayerControl
        visibility={visibility}
        onToggle={toggleLayer}
        emptyKeys={emptyKeys}
        futureVisibility={futureVisibility}
        onToggleFuture={toggleFuture}
        onZoomToFit={handleZoomToFit}
        analyticsOverlay={analyticsOverlay}
        onSelectOverlay={setAnalyticsOverlay}
        cameraHealth={cameraHealth}
        cameraFilter={cameraFilter}
        onCameraFilterChange={setCameraFilter}
      />

      <MetricLegend overlayKey={analyticsOverlay} summary={overlaySummary} />

      {selectedCamera && (
        <CameraPanel
          camera={selectedCamera}
          anchor={cameraAnchor}
          onClose={() => {
            cctvLayerRef.current?.setSelectedId(null);
            setSelectedCamera(null);
            selectedCameraRef.current = null;
          }}
        />
      )}

      {hoveredCamera && hoveredCamera.camera.id !== selectedCamera?.id && (
        <CameraPopup camera={hoveredCamera.camera} x={hoveredCamera.x} y={hoveredCamera.y} />
      )}
      {/* Map legend (colour key) panel — commented out for now, not deleted.
          <MapLegend /> */}
      {/* Security Alerts (Demo) panel — commented out for now, not deleted.
          <SecurityAlerts onSimulateBreach={handleSimulateBreach} breachState={breachState} simulating={simulating} /> */}

      {selected && selected.id !== 'REAL-BLOCK-3' && selected.id !== 'REAL-ADMIN-1' && (
        <BuildingPopup
          building={selected}
          onClose={closeSelection}
          onFlyTo={() => flyToBuilding(mapRef.current, selected)}
        />
      )}

      <Block3Viewer open={block3Open} onClose={closeSelection} />

      {adminBlockOpen && <BuildingDigitalTwin onClose={closeSelection} />}

      {selectedPersonId && (() => {
        const person = personnelLayerRef.current?.getPerson(selectedPersonId);
        if (!person) return null;
        const pos = personnelLayerRef.current?.getPersonWorldPos(selectedPersonId);
        return <PersonnelPanel person={person} lonLat={pos?.lonLat} onClose={closeSelection} />;
      })()}

      {hoveredPerson && (() => {
        const person = personnelLayerRef.current?.getPerson(hoveredPerson.id);
        if (!person) return null;
        const pos = personnelLayerRef.current?.getPersonWorldPos(hoveredPerson.id);
        return <PersonnelPopup person={person} x={hoveredPerson.x} y={hoveredPerson.y} lonLat={pos?.lonLat} />;
      })()}

      {hovered && !selected && (() => {
        const demo = demoTooltipFields(hovered.building);
        // With an analytics overlay active, the hovered building's actual
        // reading + threshold band — otherwise the colour tint alone can't
        // tell you *how far* over the threshold a building is.
        const metrics = analyticsOverlay ? readBuildingMetrics(hovered.building) : null;
        const band = metrics ? bandFor(analyticsOverlay, overlayValue(analyticsOverlay, metrics)) : null;
        return (
          <div style={{
            position: 'fixed', left: hovered.x + 14, top: hovered.y + 14, zIndex: 7,
            background: 'rgba(8,14,22,0.9)', border: '1px solid rgba(77,226,255,0.35)',
            borderRadius: 8, padding: '8px 11px', fontSize: 11.5, color: '#e8f4fb',
            pointerEvents: 'none', maxWidth: 230,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{hovered.building.display_name}</div>
            <div style={{ color: '#7fd8ff', fontSize: 10 }}>{hovered.building.category} · {hovered.building.id}</div>
            <div style={{ color: 'rgba(220,240,250,0.7)', fontSize: 10, marginTop: 3 }}>
              {hovered.building.height?.toFixed(1)} m · {hovered.building.gross_area?.toLocaleString()} m²
            </div>
            {/* With no overlay active this is the general building
                snapshot. With one active it is REPLACED by that overlay's
                own reading below — showing the generic grid's demo "Power"
                row next to a Water overlay reading made it ambiguous which
                metric the colour on the map actually meant. */}
            {!metrics && (
              <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', marginTop: 6, paddingTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
                {[['Dept', demo.department], ['Status', demo.status], ['Power', demo.power], ['HVAC', demo.hvac], ['Temp', demo.temperature], ['Occ.', demo.occupancy]].map(([k, v]) => (
                  <div key={k} style={{ fontSize: 9.5, color: 'rgba(220,240,250,0.55)' }}>{k}: <span style={{ color: '#e8f4fb' }}>{v}</span></div>
                ))}
              </div>
            )}
            {metrics && (
              <div style={{ borderTop: `1px solid ${band.css}44`, marginTop: 6, paddingTop: 5 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(220,240,250,0.45)' }}>
                  {OVERLAYS[analyticsOverlay].label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: band.css }}>
                    {overlayReadout(analyticsOverlay, metrics)}
                  </span>
                  <span style={{ fontSize: 9.5, color: band.css, fontWeight: 700 }}>{band.label}</span>
                </div>
                <div style={{ fontSize: 9.5, color: 'rgba(220,240,250,0.6)', marginTop: 2 }}>
                  {analyticsOverlay === 'power' && `${metrics.power.dailyKwh.toLocaleString()} kWh/day · ${metrics.power.demandKw} kW of ${metrics.power.connectedLoadKw} kW`}
                  {analyticsOverlay === 'water' && `${metrics.water.dailyM3} m³/day of ${metrics.water.permittedM3} m³ · ${metrics.water.intensity} L/m²`}
                  {analyticsOverlay === 'aqi' && `PM2.5 ${metrics.aqi.pm25} µg/m³ · PM10 ${metrics.aqi.pm10} µg/m³ · CO₂ ${metrics.aqi.co2} ppm`}
                </div>
              </div>
            )}
            <div style={{ fontSize: 8.5, color: 'rgba(220,240,250,0.35)', marginTop: 4 }}>demo values — no live BMS feed</div>
          </div>
        );
      })()}

      {/* Full-screen cover until the map style, GIS data AND every layer
          (buildings, roads, fence, personnel roster, labels, initial
          zoom-to-fit) have actually been built — `loading` above only
          covers the initial JSON fetch, which resolves long before the
          map/scene is actually visible, so gating on sceneReady instead
          avoids a flash of an empty/half-built map underneath. */}
      {!error && !sceneReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, background: '#0a0f16',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            border: '3px solid rgba(77,226,255,0.2)', borderTopColor: '#4de2ff',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#bcefff', letterSpacing: '0.02em' }}>
            Loading Campus Digital Twin…
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(188,239,255,0.55)' }}>
            {loading ? 'Loading live campus geometry from zmu_db…' : 'Building 3-D scene…'}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 8,
          background: 'rgba(8,14,22,0.72)', border: '1px solid rgba(77,226,255,0.25)',
          borderRadius: 10, padding: '8px 14px', fontSize: 12.5, color: '#bcefff',
        }}>
          {`Digital Twin 2 — GIS service error: ${error}`}
        </div>
      )}
    </div>
  );
}
