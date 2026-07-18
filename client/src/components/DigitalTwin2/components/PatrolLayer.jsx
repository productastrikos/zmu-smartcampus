import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { positionAtTime } from './PatrolAnimation';

// Patrol routes trace the real campus boundary ring itself — security
// patrols walk the perimeter, so the real boundary geometry (gis.boundary,
// the same closed OSM ring FenceLayer.jsx builds the fence from) already
// IS the real patrol route; nothing invented. The route itself renders as
// a native dashed-orange MapLibre line (matches the spec's "Orange
// lines" — the 'line' layer type traces a Polygon source's outline
// directly, no conversion needed); the moving patrol marker is a small
// Three.js layer since it needs continuous per-frame animation (see
// PatrolAnimation.js).

export function addPatrolRouteLayer(map, boundaryFC) {
  map.addSource('zt2-patrol-route', { type: 'geojson', data: boundaryFC });
  map.addLayer({
    id: 'zt2-patrol-route-line', type: 'line', source: 'zt2-patrol-route',
    paint: { 'line-color': '#ff8a3d', 'line-width': 2, 'line-opacity': 0.75, 'line-dasharray': [2, 1.5] },
  });
}
export const PATROL_ROUTE_LAYER_IDS = ['zt2-patrol-route-line'];

const ZOOM_GATE = 16;

function markerGeometry() {
  return new THREE.ConeGeometry(0.35, 1.1, 8);
}

export function createPatrolMarkerLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;
  const routes = []; // [{pts, marker}]

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
      scene.add(new THREE.AmbientLight(0x9fb4c8, 1.2));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setRoutes(boundaryFC) {
      root.clear();
      routes.length = 0;
      const feature = boundaryFC?.features?.[0];
      if (!feature || feature.geometry?.type !== 'Polygon') return;
      const mat = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff8a3d, emissiveIntensity: 0.5, roughness: 0.4 });
      const geo = markerGeometry();
      const pts = feature.geometry.coordinates[0].map(([lon, lat]) => projection.projectCoordinate(lon, lat));
      // Left un-rotated: the cone's default apex axis (local +Y) already
      // lies in the ground plane, so a pure rotation.z (see render()) sweeps
      // it flat across headings with no extra tilt needed.
      const marker = new THREE.Mesh(geo, mat);
      root.add(marker);
      routes.push({ pts, marker, phase: 0 });
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      if (mapRef.getZoom() < ZOOM_GATE) return;
      const now = performance.now();
      for (const r of routes) {
        const { point, heading } = positionAtTime(r.pts, now + r.phase);
        r.marker.position.set(point[0], point[1], 0.55);
        r.marker.rotation.z = heading - Math.PI / 2;
      }
      if (routes.length) mapRef?.triggerRepaint();
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
