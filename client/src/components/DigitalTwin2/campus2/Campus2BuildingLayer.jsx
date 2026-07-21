import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { makeGlassMaterial, makeEdgeMaterial, makeGlowEdgeMaterial, HOLO } from '../materials/BuildingMaterial';
import { tintGroup, defaultGlassOpacity } from '../materials/MetricTint';
import { shapeCampus2Building } from './buildingRecord';

// Campus 2's central star-shaped academic building complex
// (campus2/central_building.geojson — 22 real polygons straight from
// zmu_campus_2.txt: 11 solid volumes — the hub, 5 "corner" wings, 5
// "middle" wings — each paired with its own named "hollow/empty space"
// cut-out. The small circle at the star's own centre is a road
// intersection, not a building part — it lives in
// campus2/circular_structures.geojson / Campus2CircleLayer.jsx instead.
// Every wall follows the supplied coordinates exactly: no simplification, no
// smoothing, no procedural shape generation — each solid's hole is
// subtracted via THREE.Shape.holes (same technique BuildingLayer.jsx
// already uses for real courtyard cut-outs). Height per part comes from
// the source's own real "N-floor" property (Central Plaza is 2-floor,
// every wing is 3-floor — NOT a uniform per-category guess), converted to
// metres at 4m/floor — the same ratio verified across every real Campus 1
// building record.
//
// Same holographic "Astriverse/DSO" glass look every other building in
// this Digital Twin uses (Campus 1's mosque, admin block, etc.) — the
// shared HOLO/makeGlassMaterial/makeEdgeMaterial/makeGlowEdgeMaterial from
// materials/BuildingMaterial.js, imported read-only, not modified.
//
// Hover/select picking mirrors BuildingLayer.jsx's pickAt/setHoveredId/
// setSelectedId — each of the 11 solid parts (hub, 5 corners, 5 middles)
// is its own pickable record (see campus2/buildingRecord.js for the shared
// record shape the hover tooltip/BuildingPopup expect). For a corner wing
// (hollow cage + thin roof cap, not a full solid volume) only the cap mesh
// is raycast-pickable — the open wireframe below has no fill to hit — but
// hovering/selecting still highlights the whole wing (cap + cage together)
// since they share one set of glass/edge/glow material instances.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setBuilding,
// setVisible, pickAt, setHoveredId, setSelectedId, render}.

function ringToShape(ring, projection) {
  const pts = ring.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

// A wireframe "cage" — vertical corner pillars plus a bottom and top ring
// outline for one real ring (the outer footprint or the hole) — used for
// the corner wings' open/hollow lower body: no glass fill, just the real
// footprint's own edges, so the structure reads as open/see-through rather
// than a solid tower (matching the reference photo's open breezeway look).
function wireframeCageGeometry(ringPts, height) {
  const n = ringPts.length;
  const positions = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = ringPts[i];
    positions.push(x, y, 0, x, y, height);
  }
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ringPts[i];
    const [x2, y2] = ringPts[(i + 1) % n];
    positions.push(x1, y1, 0, x2, y2, 0);
    positions.push(x1, y1, height, x2, y2, height);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
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

export function createCampus2BuildingLayer({ id, anchor }) {
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

    // `fc` = campus2/central_building.geojson's FeatureCollection.
    setBuilding(fc) {
      root.clear();
      hoveredGroup = null;
      selectedGroup = null;
      const features = fc?.features || [];
      const solids = features.filter((f) => f.properties.role === 'solid');
      const holesByKey = new Map();
      for (const f of features) {
        if (f.properties.role !== 'hole') continue;
        const key = `${f.properties.part}-${f.properties.num ?? ''}`;
        holesByKey.set(key, f);
      }

      // The corner wings' thin roof cap sits at the plaza's (hub's) own
      // real height, not each corner's own taller height — matching the
      // reference photo's single unified thin roofline across the wings.
      const hubSolid = solids.find((s) => s.properties.part === 'hub');
      const hubHeight = hubSolid?.properties.height || 8;
      const CAP_THICKNESS_M = 0.8;

      for (const solid of solids) {
        if (solid.geometry?.type !== 'Polygon') continue;
        const key = `${solid.properties.part}-${solid.properties.num ?? ''}`;
        const hole = holesByKey.get(key);
        const height = solid.properties.height || 4;
        const isCorner = solid.properties.part === 'corner';
        const record = shapeCampus2Building(solid, 'plaza', projection);

        const outerPts = solid.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        const holePts = hole?.geometry?.type === 'Polygon'
          ? hole.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat))
          : null;

        // A higher opacity than Campus 1's default HOLO.glassOpacity (0.25)
        // — a local override here, not a change to the shared HOLO constant
        // in BuildingMaterial.js, so Campus 1's buildings are unaffected.
        const baseGlass = HOLO.glass;
        const baseEdge = HOLO.edge;
        const glass = makeGlassMaterial(0.55, baseGlass);
        const glow = makeGlowEdgeMaterial(baseEdge);
        const edge = makeEdgeMaterial(baseEdge);

        const group = new THREE.Group();

        if (isCorner) {
          // Below the plaza's height: hollow — real footprint/hole edges
          // only, no glass fill, so the wing reads as an open frame rather
          // than a solid tower.
          group.add(new THREE.LineSegments(wireframeCageGeometry(outerPts, hubHeight), glow));
          if (holePts) group.add(new THREE.LineSegments(wireframeCageGeometry(holePts, hubHeight), glow));

          // At the plaza's height: a thin solid roof cap (the real outer
          // footprint, unpunched) instead of continuing the corner's own
          // taller solid mass. The only raycast-pickable mesh for this wing.
          const capShape = new THREE.Shape(outerPts.map(([x, y]) => new THREE.Vector2(x, y)));
          const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: CAP_THICKNESS_M, bevelEnabled: false, curveSegments: 1 });
          capGeo.translate(0, 0, hubHeight);
          const capMesh = new THREE.Mesh(capGeo, glass);
          capMesh.userData.record = record;
          group.add(capMesh);
          const capEdges = new THREE.EdgesGeometry(capGeo, 20);
          group.add(new THREE.LineSegments(capEdges, glow));
          group.add(new THREE.LineSegments(capEdges, edge));
          group.userData = { record, meshes: [capMesh], glass, edge, glow, baseGlass, baseEdge };
          root.add(group);
          continue;
        }

        const shape = ringToShape(solid.geometry.coordinates[0], projection);
        if (holePts) shape.holes.push(new THREE.Path(holePts.map(([x, y]) => new THREE.Vector2(x, y))));

        const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
        const mesh = new THREE.Mesh(geo, glass);
        mesh.userData.record = record;
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
