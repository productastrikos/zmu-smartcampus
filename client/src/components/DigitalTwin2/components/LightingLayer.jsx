import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { mergeTwo } from './LandscapeLayer';

// Street lights placed only from real-data-derived positions: every real
// road (gis.roads) and every generated walkway centerline resampled at a
// fixed real 25m arc-length step (same resampling technique as
// FenceLayer.jsx's posts), plus one near every real building centroid,
// every real parking centroid, and the real gate. Nothing is placed
// freehand.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setLights,
// setVisible, render}.

const LIGHT_SPACING = 25;
const MAX_DYNAMIC_LIGHTS = 40; // real THREE.PointLights are capped for perf — remaining fixtures rely on their own emissive material for the "lit" look
const ZOOM_GATE = 16.2; // hide entirely below this zoom to protect frame budget

function resamplePolyline(pts, step) {
  if (pts.length < 2) return [];
  const out = [pts[0]];
  let accumulated = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < 1e-6) continue;
    let start = 0;
    let need = step - accumulated;
    while (need <= segLen - start) {
      const t = (start + need) / segLen;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      start += need;
      need = step;
      accumulated = 0;
    }
    accumulated += segLen - start;
  }
  return out;
}

// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx).
function lampGeometry() {
  const pole = new THREE.CylinderGeometry(0.05, 0.07, 4.2, 6);
  pole.translate(0, 2.1, 0);
  const head = new THREE.SphereGeometry(0.14, 8, 8);
  head.translate(0, 4.28, 0);
  const geo = mergeTwo(pole, head);
  geo.rotateX(Math.PI / 2); // stand upright: local-Y (height) becomes world-Z
  return geo;
}

// Computes every real-derived light position, in local meter-space.
export function computeLightPositions({ anchor, roads, walkways, buildings, parking, gate }) {
  const projection = createProjection(anchor);
  const points = [];

  for (const f of roads?.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const pts = f.geometry.coordinates.map(([lon, lat]) => projection.projectCoordinate(lon, lat));
    points.push(...resamplePolyline(pts, LIGHT_SPACING));
  }
  for (const [p1, p2] of walkways || []) {
    points.push(...resamplePolyline([p1, p2], LIGHT_SPACING));
  }
  for (const b of buildings || []) {
    if (b.centroid) points.push(projection.projectCoordinate(b.centroid[0], b.centroid[1]));
  }
  for (const f of parking?.features || []) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    points.push([cx, cz]);
  }
  if (gate) points.push(projection.projectCoordinate(gate[0], gate[1]));

  return points;
}

export function createLightingLayer({ id, anchor }) {
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
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setLights(points) {
      root.clear();
      if (!points?.length) return;

      const mat = new THREE.MeshStandardMaterial({ color: 0x3f4a56, metalness: 0.3, roughness: 0.6, emissive: 0xfff3d6, emissiveIntensity: 0.85 });
      const geo = lampGeometry();
      const mesh = new THREE.InstancedMesh(geo, mat, points.length);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < points.length; i++) {
        dummy.position.set(points[i][0], points[i][1], 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);

      // a capped subset of real PointLights for actual local glow — evenly
      // sampled across the full set rather than just the first N, so the
      // glow isn't clustered at one end of the road network
      const step = Math.max(1, Math.floor(points.length / MAX_DYNAMIC_LIGHTS));
      for (let i = 0; i < points.length; i += step) {
        const light = new THREE.PointLight(0xfff3d6, 1.4, 18, 2);
        light.position.set(points[i][0], points[i][1], 4.2);
        root.add(light);
      }
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      if (mapRef.getZoom() < ZOOM_GATE) return;
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
