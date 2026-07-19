import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Campus 2's 8 circular structures (campus2/circular_structures.geojson —
// circle-1..6, circle-mini-1, and "central Plaza circle" — the small one
// at the star building's own centre, which is a road intersection, not a
// building part — straight from zmu_campus_2.txt) are road roundabouts,
// not landscaped plazas — rendered as a flat paved disc in
// the same dark road-surface tone RoadLayer.jsx uses (see
// materials/RoadMaterial.js's ROAD_PAINT.surface), with a thin glowing
// orange rim matching the road network's own "illuminated road" accent
// colour, so they read as part of the same road system once the actual
// road geometry connects to them (not yet digitized — placeholder pads
// only for now). No grass, no fountain, no landscaping — that was this
// layer's first pass, based on a wrong read of what these circles are.
// Radius comes directly from each circle's own digitized polygon
// (distance from its real @circle center to a ring vertex), never
// invented.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setCircles,
// setVisible, render}.

const ROAD_SURFACE_COLOR = 0x1c222b; // matches ROAD_PAINT.surface
const ROAD_GLOW_COLOR = 0xff8a3d; // matches ROAD_PAINT.glow / line accent

function buildRoundabout(cx, cz, radius) {
  const group = new THREE.Group();

  const surfaceMat = new THREE.MeshStandardMaterial({ color: ROAD_SURFACE_COLOR, roughness: 0.9 });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), surfaceMat);
  pad.position.z = 0.02;
  group.add(pad);

  const rimMat = new THREE.LineBasicMaterial({ color: ROAD_GLOW_COLOR, transparent: true, opacity: 0.7 });
  const rimPts = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    rimPts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0.05));
  }
  const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
  group.add(new THREE.Line(rimGeo, rimMat));

  group.position.set(cx, cz, 0);
  return group;
}

export function createCampus2CircleLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;

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
      scene.add(new THREE.AmbientLight(0xdfe8f0, 0.7));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fc` = campus2/circular_structures.geojson's FeatureCollection.
    setCircles(fc) {
      root.clear();
      for (const f of fc?.features || []) {
        if (f.geometry?.type !== 'Polygon') continue;
        const [centerLon, centerLat] = f.properties.center;
        const [cx, cz] = projection.projectCoordinate(centerLon, centerLat);
        const ring = f.geometry.coordinates[0];
        const [rLon, rLat] = ring[0];
        const [rx, rz] = projection.projectCoordinate(rLon, rLat);
        const radius = Math.hypot(rx - cx, rz - cz);
        root.add(buildRoundabout(cx, cz, radius));
      }
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
