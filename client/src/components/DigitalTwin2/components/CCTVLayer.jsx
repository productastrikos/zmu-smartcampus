import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// PTZ camera network. Every position is derived from real geometry — no
// freehand placement:
//   - the real gate (Main Gate building centroid, same point
//     SecurityLayer.jsx places its gate cluster at)
//   - every real parking polygon centroid (gis.parking)
//   - every real road-road junction (actual line-segment intersections
//     among gis.roads' real LineStrings)
//   - every "important" building — data-driven: category !== 'structure'
//     (Administration/Mosque/Gate) plus Block-3 explicitly (the only
//     buildings that already carry a real, non-generic classification)
//   - the real sports-ground and helipad centroids (gis.sportsfields,
//     gis.grounds)
//   - every Nth real vertex of the real campus boundary ring (gis.boundary)
//
// A Three.js "custom" MapLibre layer: {id, type:'custom',
// renderingMode:'3d', onAdd, setCCTV, setVisible, render}.

const ZOOM_GATE = 16.5;
const FENCE_VERTEX_STRIDE = 6;

function segmentsIntersect([x1, z1], [x2, z2], [x3, z3], [x4, z4]) {
  const d1x = x2 - x1, d1z = z2 - z1;
  const d2x = x4 - x3, d2z = z4 - z3;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x3 - x1) * d2z - (z3 - z1) * d2x) / denom;
  const u = ((x3 - x1) * d1z - (z3 - z1) * d1x) / denom;
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null; // skip near-endpoint "intersections" (shared vertices, not real crossings)
  return [x1 + t * d1x, z1 + t * d1z];
}

function findRoadJunctions(roads, projection) {
  const segments = [];
  for (const f of roads?.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const pts = f.geometry.coordinates.map(([lon, lat]) => projection.projectCoordinate(lon, lat));
    for (let i = 1; i < pts.length; i++) segments.push([pts[i - 1], pts[i]]);
  }
  const junctions = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const hit = segmentsIntersect(segments[i][0], segments[i][1], segments[j][0], segments[j][1]);
      if (hit) junctions.push(hit);
    }
  }
  return junctions;
}

// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx).
// The `head` sub-group uses its own local convention of Y=forward,
// Z=up (rather than mimicking world axes) so panning is a single, pure
// `rotation.z` — Cylinder/Cone already point along local Y by default, so
// no extra bake/rotation is needed on the lens/cone themselves; only the
// pole (a true standing post) needs the usual rotateX(Math.PI/2) bake.
function buildCamera(x, y, phase) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a6270, metalness: 0.4, roughness: 0.5 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c222b, roughness: 0.4, metalness: 0.3 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0e13, emissive: 0x1c6fff, emissiveIntensity: 0.4, roughness: 0.2 });
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x4de2ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });

  const poleGeo = new THREE.CylinderGeometry(0.045, 0.06, 2.6, 6);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, y, 1.3);
  group.add(pole);

  const head = new THREE.Group();
  head.position.set(x, y, 2.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.16), bodyMat);
  body.position.y = 0.1;
  head.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), lensMat);
  lens.position.y = 0.32;
  head.add(lens);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12, 1, true), coneMat);
  cone.position.y = 1.9;
  head.add(cone);
  group.add(head);

  group.userData.head = head;
  group.userData.phase = phase;
  return group;
}

export function createCCTVLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;
  const cameras = [];

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

    setCCTV({ buildings, roads, parking, sportsfields, grounds, boundary }) {
      root.clear();
      cameras.length = 0;
      const points = [];

      // gate
      const gateBuilding = (buildings || []).find((b) => b.category === 'gate');
      if (gateBuilding?.centroid) points.push(projection.projectCoordinate(gateBuilding.centroid[0], gateBuilding.centroid[1]));

      // every Nth real vertex of the real campus boundary ring
      const boundaryFeature = boundary?.features?.[0];
      if (boundaryFeature?.geometry?.type === 'Polygon') {
        const ring = boundaryFeature.geometry.coordinates[0].map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        for (let i = 0; i < ring.length; i += FENCE_VERTEX_STRIDE) points.push(ring[i]);
      }

      // parking centroids
      for (const f of parking?.features || []) {
        if (f.geometry?.type !== 'Polygon') continue;
        const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        points.push([ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]);
      }

      // real road-road junctions
      points.push(...findRoadJunctions(roads, projection));

      // important buildings: real non-generic category, plus Block-3 explicitly
      for (const b of buildings || []) {
        if (!b.centroid) continue;
        if (b.category !== 'structure' || b.id === 'REAL-BLOCK-3') points.push(projection.projectCoordinate(b.centroid[0], b.centroid[1]));
      }

      // sports ground + helipad centroids
      for (const fc of [sportsfields, grounds]) {
        for (const f of fc?.features || []) {
          if (f.geometry?.type !== 'Polygon') continue;
          const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
          points.push([ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]);
        }
      }

      points.forEach(([x, z], i) => {
        const cam = buildCamera(x, z, i * 0.7);
        root.add(cam);
        cameras.push(cam);
      });
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      if (mapRef.getZoom() < ZOOM_GATE) return;
      const now = performance.now();
      for (const cam of cameras) {
        cam.userData.head.rotation.z = Math.sin(now * 0.0003 + cam.userData.phase) * 0.9;
      }
      if (cameras.length) mapRef?.triggerRepaint();
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
