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
import { ringBBoxCenter } from '../components/DigitalTwin2/services/ProjectionService';
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
import { createCCTVLayer } from '../components/DigitalTwin2/components/CCTVLayer';
import { addPatrolRouteLayer, PATROL_ROUTE_LAYER_IDS, createPatrolMarkerLayer } from '../components/DigitalTwin2/components/PatrolLayer';
import SecurityAlerts from '../components/DigitalTwin2/components/SecurityAlerts';
import { createPersonnelLayer } from '../components/DigitalTwin2/components/PersonnelLayer';
import { generateRoster } from '../components/DigitalTwin2/components/PersonnelRoster';
import { buildWalkGraph } from '../components/DigitalTwin2/components/MovementEngine';
import PersonnelPopup from '../components/DigitalTwin2/components/PersonnelPopup';
import PersonnelPanel from '../components/DigitalTwin2/components/PersonnelPanel';

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
  const cctvLayerRef = useRef(null);
  const patrolMarkerLayerRef = useRef(null);
  const personnelLayerRef = useRef(null);
  const stopBoundaryPulseRef = useRef(null);
  const savedCameraRef = useRef(null);
  const cancelOrbitRef = useRef(null);
  const selectedRef = useRef(null);
  const selectedPersonRef = useRef(null);
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

    const cctvLayer = createCCTVLayer({ id: 'zt2-cctv-3d', anchor });
    map.addLayer(cctvLayer);
    cctvLayerRef.current = cctvLayer;

    const patrolMarkerLayer = createPatrolMarkerLayer({ id: 'zt2-patrol-marker-3d', anchor });
    map.addLayer(patrolMarkerLayer);
    patrolMarkerLayerRef.current = patrolMarkerLayer;

    const personnelLayer = createPersonnelLayer({ id: 'zt2-personnel-3d', anchor });
    map.addLayer(personnelLayer);
    personnelLayerRef.current = personnelLayer;

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
    // so they can never cross a building footprint or leave campus.
    const walkGraph = buildWalkGraph({ anchor, walkways: layout.walkways, roads: gis.roads });
    const roster = generateRoster({ count: 150, anchor, boundary: gis.boundary, buildings, walkGraph });
    personnelLayer.setPersonnel(roster, walkGraph);

    const gateBuilding = buildings.find((b) => b.category === 'gate');
    lightingLayer.setLights(computeLightPositions({
      anchor, roads: gis.roads, walkways: layout.walkways, buildings, parking: gis.parking,
      gate: gateBuilding?.centroid,
    }));
    securityLayer.setSecurity({ buildings, boundary: gis.boundary });
    cctvLayer.setCCTV({ buildings, roads: gis.roads, parking: gis.parking, sportsfields: gis.sportsfields, grounds: gis.grounds, boundary: gis.boundary });
    patrolMarkerLayer.setRoutes(gis.boundary);
    addBuildingLabelsLayer(map, buildings);

    // Open on the whole campus in view (same fit the "Zoom to fit" button
    // does) rather than a hardcoded close-in zoom level. fitBounds keeps
    // the map's current bearing (already 180 from the initial construction
    // above) when no bearing option is passed.
    zoomToFit(map, gis.boundary, buildingsToFeatureCollection(buildings));

    for (const key of ALL_LAYER_KEYS) {
      setNativeLayerVisible(map, key, visibility[key]);
      if (key === 'buildings') buildingsLayer.setVisible(visibility[key]);
      if (key === 'trees') treeLayer.setVisible(visibility[key]);
      if (key === 'sportsfields') footballLayer.setVisible(visibility[key]);
      if (key === 'fences') fenceLayer.setVisible(visibility[key]);
      if (key === 'walkways') pedestrianLayer.setVisible(visibility[key]);
      if (key === 'security_lighting') lightingLayer.setVisible(visibility[key]);
      if (key === 'security') securityLayer.setVisible(visibility[key]);
      if (key === 'cctv') cctvLayer.setVisible(visibility[key]);
      if (key === 'patrol') patrolMarkerLayer.setVisible(visibility[key]);
      if (key === 'personnel') personnelLayer.setVisible(visibility[key]);
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

    // pointer interaction: hover + click picking, personnel markers first
    // (smaller/easier-to-miss targets get priority), falling back to the
    // real building meshes so existing building hover/click is unaffected.
    const onMouseMove = (e) => {
      const { clientX, clientY } = e.originalEvent;
      const person = personnelLayer.pickAt(clientX, clientY);
      if (person) {
        buildingsLayer.setHoveredId(null);
        setHovered(null);
        personnelLayer.setHoveredId(person.id);
        map.getCanvas().style.cursor = 'pointer';
        setHoveredPerson({ id: person.id, x: clientX, y: clientY });
        return;
      }
      personnelLayer.setHoveredId(null);
      setHoveredPerson(null);
      const rec = buildingsLayer.pickAt(clientX, clientY);
      buildingsLayer.setHoveredId(rec?.id ?? null);
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
        buildingsLayer.setSelectedId(null);
        setSelected(null);
        selectedRef.current = null;
        setBlock3Open(false);
        setAdminBlockOpen(false);
        personnelLayer.setSelectedId(person.id);
        setSelectedPersonId(person.id);
        selectedPersonRef.current = person.id;
        return;
      }
      const rec = buildingsLayer.pickAt(clientX, clientY);
      if (!rec) { closeSelection(); return; }
      if (!selectedRef.current && !selectedPersonRef.current) savedCameraRef.current = captureCameraState(map);
      cancelOrbitRef.current?.();
      cancelOrbitRef.current = orbitToBuilding(map, rec);
      personnelLayer.setSelectedId(null);
      setSelectedPersonId(null);
      selectedPersonRef.current = null;
      buildingsLayer.setSelectedId(rec.id);
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
    setSelected(null);
    selectedRef.current = null;
    setBlock3Open(false);
    setAdminBlockOpen(false);
    personnelLayerRef.current?.setSelectedId(null);
    setSelectedPersonId(null);
    selectedPersonRef.current = null;
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

  function toggleLayer(key) {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const map = mapRef.current;
      if (map) {
        setNativeLayerVisible(map, key, next[key]);
        if (key === 'buildings') buildingsLayerRef.current?.setVisible(next[key]);
        if (key === 'trees') treeLayerRef.current?.setVisible(next[key]);
        if (key === 'sportsfields') footballLayerRef.current?.setVisible(next[key]);
        if (key === 'fences') fenceLayerRef.current?.setVisible(next[key]);
        if (key === 'walkways') pedestrianLayerRef.current?.setVisible(next[key]);
        if (key === 'security_lighting') lightingLayerRef.current?.setVisible(next[key]);
        if (key === 'security') securityLayerRef.current?.setVisible(next[key]);
        if (key === 'cctv') cctvLayerRef.current?.setVisible(next[key]);
        if (key === 'patrol') patrolMarkerLayerRef.current?.setVisible(next[key]);
        if (key === 'personnel') personnelLayerRef.current?.setVisible(next[key]);
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
    if (mapRef.current && gis) zoomToFit(mapRef.current, gis.boundary, buildingsToFeatureCollection(buildings));
  }

  const SYNTHETIC_KEYS = new Set(['buildings', 'walkways', 'security_lighting', 'security', 'cctv', 'patrol', 'personnel']);
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
      />
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
            <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', marginTop: 6, paddingTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
              {[['Dept', demo.department], ['Status', demo.status], ['Power', demo.power], ['HVAC', demo.hvac], ['Temp', demo.temperature], ['Occ.', demo.occupancy]].map(([k, v]) => (
                <div key={k} style={{ fontSize: 9.5, color: 'rgba(220,240,250,0.55)' }}>{k}: <span style={{ color: '#e8f4fb' }}>{v}</span></div>
              ))}
            </div>
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
