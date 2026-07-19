import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Campus 2's simple road network (campus2/roads.geojson — see
// txtToGeojson.js's buildSimpleRoadNetwork()): one perimeter following the
// real campus boundary, 5 straight radials from the real campus centroid
// out to 5 roundabout positions, and one loop connecting those roundabouts
// in sequence. Deliberately simple per the brief — no medians, sidewalks,
// or lane markings for now (that fuller treatment existed in an earlier
// pass and can come back the same way once asked for): each road is just
// one flat asphalt ribbon at its own width, elevated a couple of
// centimetres above the terrain to avoid z-fighting.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setRoads,
// setVisible, render}.

const ASPHALT_COLOR = 0x4a4a4a; // per brief

// Perpendicular unit normal at each vertex, mitre-averaged from its two
// adjacent segments (wraps around for closed loops); clamped so sharp
// turns don't spike the offset into a long needle.
function computeNormals(points, closed) {
  const n = points.length;
  const segDir = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  };
  const perp = ([dx, dy]) => [-dy, dx];

  const normals = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? points[(i - 1 + n) % n] : points[Math.max(0, i - 1)];
    const curr = points[i];
    const next = closed ? points[(i + 1) % n] : points[Math.min(n - 1, i + 1)];
    const nIn = perp(segDir(prev, curr));
    const nOut = perp(segDir(curr, next));
    let mx = nIn[0] + nOut[0], my = nIn[1] + nOut[1];
    let len = Math.hypot(mx, my);
    if (len < 1e-4) { mx = nIn[0]; my = nIn[1]; len = 1; } // near-180° turn — fall back to one side's normal
    mx /= len; my /= len;
    // Miter length scales as 1/cos(halfAngle); clamp so hairpin vertices
    // don't produce an absurdly long spike.
    const cosHalf = Math.max(0.35, (nIn[0] * mx + nIn[1] * my));
    const scale = Math.min(2.2, 1 / cosHalf);
    normals.push([mx * scale, my * scale]);
  }
  return normals;
}

function offsetPoints(points, normals, dist) {
  return points.map((p, i) => [p[0] + normals[i][0] * dist, p[1] + normals[i][1] * dist]);
}

// Flat quad-strip between two matched point arrays (a paved ribbon), one
// mesh, at a fixed elevation.
function ribbonMesh(innerPts, outerPts, z, material, closed) {
  const positions = [], indices = [];
  const n = innerPts.length;
  for (let i = 0; i < n; i++) {
    positions.push(innerPts[i][0], innerPts[i][1], z, outerPts[i][0], outerPts[i][1], z);
  }
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const a = (i * 2) % (n * 2), b = a + 1, c = ((i + 1) % n) * 2, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function createCampus2RoadLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0xdfe8f0, 0.8));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fc` = campus2/roads.geojson's FeatureCollection.
    setRoads(fc) {
      root.clear();
      // side: DoubleSide — the quad-strip triangulation in ribbonMesh()
      // doesn't guarantee consistent winding for every segment, and
      // MeshStandardMaterial defaults to FrontSide (back-face culled),
      // which made whole ribbons disappear depending on camera angle.
      const asphaltMat = new THREE.MeshStandardMaterial({ color: ASPHALT_COLOR, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide });

      for (const f of fc?.features || []) {
        if (f.geometry?.type !== 'LineString') continue;
        const { widthMeters, closed } = f.properties;
        const points = f.geometry.coordinates.map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        if (points.length < 2) continue;
        const normals = computeNormals(points, closed);
        const halfWidth = (widthMeters || 14) / 2;
        const inner = offsetPoints(points, normals, -halfWidth);
        const outer = offsetPoints(points, normals, halfWidth);
        root.add(ribbonMesh(inner, outer, 0.03, asphaltMat, closed));
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
