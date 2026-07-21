import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { makeGlassMaterial, makeEdgeMaterial, makeGlowEdgeMaterial, HOLO } from '../materials/BuildingMaterial';
import { tintGroup, defaultGlassOpacity } from '../materials/MetricTint';
import { shapeCampus2Building } from './buildingRecord';

// Campus 2's 38 additional real building footprints
// (campus2/extra_buildings.geojson — straight from
// zmu_campus_2_buildings.txt: building-201..236, plus building-209's own
// two "pillar" sub-features). Every wall follows the supplied coordinates
// exactly — no simplification, no procedural shape generation. Height per
// building comes from the source's own real "N-floors" property, converted
// to metres at 4m/floor, same convention as the central plaza complex and
// every real Campus 1 building.
//
// Also reused as-is for campus2/buildings_02.geojson (12 more real
// footprints from zmu_campus_2_02.txt) — a second instance of this same
// layer function with a distinct `idPrefix` so both sets get unique
// picking ids.
//
// Same holographic glass treatment as the central plaza building
// (Campus2BuildingLayer.jsx) — reuses the exact same makeGlassMaterial(0.55)
// / makeEdgeMaterial() / makeGlowEdgeMaterial() so this new set of buildings
// visually matches, per explicit request.
//
// Hover/select picking mirrors BuildingLayer.jsx's pickAt/setHoveredId/
// setSelectedId exactly (manual Vector3.unproject raycasting — this
// camera's a plain THREE.Camera, not Perspective/Orthographic, so
// raycaster.setFromCamera doesn't work) so the same hover tooltip/
// BuildingPopup UI in digitalTwin_2.jsx works unmodified against Campus 2
// buildings too — see campus2/buildingRecord.js for the shared record shape.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd,
// setBuildings, setVisible, pickAt, setHoveredId, setSelectedId, render}.

function ringToShape(ring, projection) {
  const pts = ring.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

function applyVisualState(group, state) {
  const { glass, edge, glow, baseGlass, baseEdge } = group.userData;
  if (state === 'selected') {
    glass.opacity = HOLO.glassOpacityHover;
    glass.emissiveIntensity = HOLO.emissiveIntensitySelected;
    edge.color.set(HOLO.edgeSelected);
    glow.color.set(HOLO.edgeSelected);
  } else if (state === 'hover') {
    glass.opacity = HOLO.glassOpacityHover;
    glass.emissiveIntensity = HOLO.emissiveIntensityHover;
    edge.color.set(HOLO.edgeHover);
    glow.color.set(HOLO.edgeHover);
  } else if (state === 'faded') {
    glass.opacity = HOLO.glassOpacityFaded;
    edge.color.set(baseEdge);
    glow.color.set(baseEdge);
  } else {
    // 0.55 is this layer's own local opacity override, not HOLO.glassOpacity;
    // an active analytics overlay raises it further so the threshold colour
    // reads solidly (see MetricTint.js).
    glass.opacity = defaultGlassOpacity(group, 0.55);
    glass.emissiveIntensity = group.userData.metricTinted ? 0.62 : HOLO.emissiveIntensity;
    glass.color.set(baseGlass);
    glass.emissive.set(baseGlass);
    edge.color.set(baseEdge);
    glow.color.set(baseEdge);
  }
}

export function createCampus2ExtraBuildingsLayer({ id, anchor, idPrefix = 'extra' }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;
  let hoveredGroup = null;
  let selectedGroup = null;
  const raycaster = new THREE.Raycaster();

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapRef = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      root = new THREE.Group();
      scene.add(root);
      scene.add(new THREE.AmbientLight(0x335577, 1.2));
      const sun = new THREE.DirectionalLight(0x8fd0ff, 0.85);
      sun.position.set(60, 90, 120);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fc` = campus2/extra_buildings.geojson's (or buildings_02.geojson's) FeatureCollection.
    setBuildings(fc) {
      root.clear();
      hoveredGroup = null;
      selectedGroup = null;
      for (const f of fc?.features || []) {
        if (f.geometry?.type !== 'Polygon') continue;
        const height = f.properties?.height || 4;
        const record = shapeCampus2Building(f, idPrefix, projection);

        const shape = ringToShape(f.geometry.coordinates[0], projection);

        // Same local opacity override as the plaza building — matching
        // colour/opacity per explicit request, not the shared HOLO default.
        const baseGlass = HOLO.glass;
        const baseEdge = HOLO.edge;
        const glass = makeGlassMaterial(0.55, baseGlass);
        const glow = makeGlowEdgeMaterial(baseEdge);
        const edge = makeEdgeMaterial(baseEdge);

        const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
        const mesh = new THREE.Mesh(geo, glass);
        mesh.userData.record = record;

        const group = new THREE.Group();
        group.add(mesh);
        const edgesGeo = new THREE.EdgesGeometry(geo, 20);
        group.add(new THREE.LineSegments(edgesGeo, glow));
        group.add(new THREE.LineSegments(edgesGeo, edge));
        group.userData = { record, meshes: [mesh], glass, edge, glow, baseGlass, baseEdge };
        root.add(group);
      }
    },

    setVisible(v) { visible = v; },

    // Analytics overlay hook — see BuildingLayer.jsx's setMetricTint.
    setMetricTint(colorFn) {
      for (const g of root.children) {
        tintGroup(g, colorFn ? colorFn(g.userData.record) : null);
        applyVisualState(g, g === selectedGroup ? 'selected' : selectedGroup ? 'faded' : g === hoveredGroup ? 'hover' : 'default');
      }
      mapRef?.triggerRepaint();
    },

    // See BuildingLayer.jsx's pickAt for why this uses manual
    // Vector3.unproject rather than raycaster.setFromCamera.
    pickAt(clientX, clientY) {
      if (!camera || !mapRef || !root.children.length) return null;
      const rect = mapRef.getCanvas().getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
      const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
      raycaster.set(near, far.sub(near).normalize());
      const meshes = root.children.flatMap((g) => g.userData.meshes);
      const hits = raycaster.intersectObjects(meshes, false);
      return hits.length ? hits[0].object.userData.record : null;
    },

    setHoveredId(buildingId) {
      const next = buildingId ? root.children.find((g) => g.userData.record.id === buildingId) : null;
      if (next === hoveredGroup) return;
      if (hoveredGroup && hoveredGroup !== selectedGroup) applyVisualState(hoveredGroup, selectedGroup ? 'faded' : 'default');
      hoveredGroup = next;
      if (hoveredGroup && hoveredGroup !== selectedGroup) applyVisualState(hoveredGroup, 'hover');
      mapRef?.triggerRepaint();
    },

    setSelectedId(buildingId) {
      selectedGroup = buildingId ? root.children.find((g) => g.userData.record.id === buildingId) : null;
      for (const g of root.children) {
        applyVisualState(g, g === selectedGroup ? 'selected' : selectedGroup ? 'faded' : 'default');
      }
      mapRef?.triggerRepaint();
    },

    render(gl, options) {
      if (!visible || !renderer) return;
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
