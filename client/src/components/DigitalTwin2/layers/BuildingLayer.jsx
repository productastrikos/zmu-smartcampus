import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { makeGlassMaterial, makeEdgeMaterial, makeGlowEdgeMaterial, HOLO } from '../materials/BuildingMaterial';

// Every building polygon becomes a real extruded mesh — the shape is built
// directly from the PostGIS ring (zmu_buildings — real, hand-digitized
// campus structures, see server/geo/import-zmu-real-structures.js), never
// approximated or replaced with a placeholder cube, and extruded to the
// real height. No hardcoded positions: the polygon's own coordinates,
// projected through the shared ProjectionService, are the building.
//
// Large-span buildings (sports complex, parade hall) use the same flat-
// roofed extrusion as every other building rather than a custom gable
// roof: a hand-built gable roof was tried here and — despite every
// individual vertex being verified correct and fully bounded — produced
// a corrupted, screen-filling render artifact whenever any LineSegments
// geometry spanning the building's full height was added, for both
// THREE.EdgesGeometry's auto-detected edges and an explicitly hand-built
// edge list. Root cause not identified (suspected clipping edge case
// specific to this MapLibre custom-layer camera setup); reverted to the
// proven-reliable ExtrudeGeometry path used everywhere else rather than
// ship a broken render.
// Render-only height trim (buildings read a little tall relative to their
// footprints in the 3-D view) — the popup/metadata still show the real,
// undiminished record.height, only the extruded mesh depth is scaled down.
const VISUAL_HEIGHT_SCALE = 0.8;

function buildingMesh(record, projection) {
  const rings = record.geometry.coordinates; // [outer, ...holes], each a closed [lon,lat] loop
  const toLocal = (ring) => ring.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  const pts = toLocal(rings[0]);
  const heightM = Math.max(3, (record.height || 6) * VISUAL_HEIGHT_SCALE);

  const glass = makeGlassMaterial();
  const glow = makeGlowEdgeMaterial();
  const edge = makeEdgeMaterial();
  const group = new THREE.Group();

  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  // Real interior holes (e.g. a courtyard) come straight from the
  // polygon's own additional rings — never fabricated.
  for (let i = 1; i < rings.length; i++) {
    const holePts = toLocal(rings[i]);
    shape.holes.push(new THREE.Path(holePts.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  const mainGeometry = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false, curveSegments: 1 });
  const mesh = new THREE.Mesh(mainGeometry, glass);
  mesh.userData.record = record;
  group.add(mesh);
  group.userData.meshes = [mesh];
  group.userData.mesh = mesh;
  const edgesGeo = new THREE.EdgesGeometry(mainGeometry, 20);
  group.add(new THREE.LineSegments(edgesGeo, glow));
  group.add(new THREE.LineSegments(edgesGeo, edge));

  group.userData.record = record;
  group.userData.glass = glass;
  group.userData.edge = edge;
  group.userData.glow = glow;
  return group;
}

function applyVisualState(group, state) {
  const { glass, edge, glow } = group.userData;
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
    glass.emissiveIntensity = HOLO.emissiveIntensity;
    edge.color.set(HOLO.edge);
    glow.color.set(HOLO.edge);
  } else {
    glass.opacity = HOLO.glassOpacity;
    glass.emissiveIntensity = HOLO.emissiveIntensity;
    edge.color.set(HOLO.edge);
    glow.color.set(HOLO.edge);
  }
}

// A MapLibre "custom" layer that owns a Three.js scene rendered into the
// map's own WebGL context, synced to the map camera every frame via the
// shared ProjectionService — the standard technique for floating true 3-D
// geometry over a real basemap. Also owns hover/selection picking
// (raycasting) for the buildings.
export function createBuildingsLayer({ id, anchor }) {
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

    setBuildings(records) {
      root.clear();
      hoveredGroup = null;
      selectedGroup = null;
      for (const rec of records || []) if (rec.geometry) root.add(buildingMesh(rec, projection));
    },

    setVisible(v) { visible = v; },

    // Raycast against the real building meshes at a canvas CSS-pixel
    // coordinate. Built manually with Vector3.unproject (camera-type
    // agnostic) rather than raycaster.setFromCamera, which only accepts
    // PerspectiveCamera/OrthographicCamera — this camera is a plain
    // THREE.Camera whose full world->clip transform lives entirely in
    // projectionMatrix (matrixWorld stays identity) — see render() below.
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
      // Neon-cyan pulse on the selected building — a continuous sine
      // modulation between the normal "selected" brightness and a
      // brighter peak, same continuous-repaint technique TreeLayer uses
      // for its wind sway (mapRef.triggerRepaint() every frame while
      // active, so the animation actually plays).
      if (selectedGroup) {
        const { glass, edge, glow } = selectedGroup.userData;
        const pulse = (Math.sin(performance.now() * 0.003) + 1) / 2; // 0..1
        glass.opacity = HOLO.glassOpacityHover + pulse * (0.5 - HOLO.glassOpacityHover);
        glass.emissiveIntensity = HOLO.emissiveIntensitySelected + pulse * 0.25;
        edge.opacity = 0.75 + pulse * 0.25;
        glow.opacity = 0.4 + pulse * 0.4;
        mapRef?.triggerRepaint();
      }
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
