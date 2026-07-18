import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { buildDemoBreachPath, lerpPath, distanceToFence, classifyProximity } from './GeofenceEngine';

// Renders the real hand-digitized fence lines (gis.fences — from
// fence.txt, a set of LineString segments tracing the actual perimeter
// fencing, not necessarily one closed ring) as a 3-D steel security
// fence: a textured panel (vertical bars + horizontal rails baked into
// one repeating canvas texture, rather than thousands of individual bar
// meshes), posts resampled at real 2.5m intervals, and a concrete base
// strip — all following the real digitized coordinates exactly, no
// straight-line approximation. Gate infrastructure is placed separately
// by SecurityLayer.jsx at the real Main Gate building location.
//
// A Three.js "custom" MapLibre layer, same shape as BuildingLayer/
// TreeLayer: {id, type:'custom', renderingMode:'3d', onAdd, setFences,
// setVisible, render}.

const FENCE_HEIGHT = 2.0; // within the requested 1.8-2.2m military-perimeter range
const POST_SPACING = 2.5;
const WARNING_SPACING = 20;

// Diamond wire-mesh pattern (chain-link look) rather than plain vertical
// bars, plus the same horizontal rail bands as before — bright silver
// tones (rather than the earlier dark-slate palette) so the fence reads
// clearly against the dark Carto basemap.
function makeFenceTexture() {
  const w = 128, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(150,160,170,0.22)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(224,230,236,0.95)';
  ctx.lineWidth = 1.6;
  const cell = 10;
  for (let x = -h; x <= w; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
  }
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = 'rgba(232,238,244,1)';
  for (const y of [4, h / 2, h - 4]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Barbed top-wire strand texture — a tight zigzag with small barb ticks.
function makeBarbedWireTexture() {
  const w = 64, h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(190,200,210,0.95)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  for (let x = 3; x < w; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, h / 2 - 5); ctx.lineTo(x, h / 2 + 5);
    ctx.moveTo(x - 3, h / 2 - 3); ctx.lineTo(x + 3, h / 2 + 3);
    ctx.moveTo(x - 3, h / 2 + 3); ctx.lineTo(x + 3, h / 2 - 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Small warning-sign texture — triangle + exclamation mark.
function makeWarningTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2f36';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(size / 2, 8); ctx.lineTo(size - 8, size - 10); ctx.lineTo(8, size - 10);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1e24';
  ctx.fillRect(size / 2 - 3, size * 0.38, 6, size * 0.28);
  ctx.fillRect(size / 2 - 3, size * 0.72, 6, 6);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Merges every vertical panel/base segment (across all fence lines) into
// one textured BufferGeometry — U runs continuously along real arc-length
// so the bar/rail pattern tiles consistently instead of restarting per
// segment; V spans 0 (ground) to 1 (top).
function createPanelAccumulator() {
  const positions = [], uvs = [], indices = [];
  let vc = 0;
  return {
    // Ground-plane convention: X=east, Y=north, Z=up (matches
    // BuildingLayer.jsx's ExtrudeGeometry — the one Three.js layer whose
    // orientation is unambiguously verified). p1/p2 are [east, north]
    // ground points; height is the real vertical (Z) extent.
    addSegment(p1, p2, height, u1, u2) {
      positions.push(p1[0], p1[1], 0, p2[0], p2[1], 0, p2[0], p2[1], height, p1[0], p1[1], height);
      uvs.push(u1, 0, u2, 0, u2, 1, u1, 1);
      indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
      vc += 4;
    },
    build() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    },
  };
}

// Arc-length resampling — real posts every real 2.5m along the exact
// digitized polyline (not a straight-line approximation between corners).
function resamplePolyline(pts, step) {
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

// Warning boards resampled at a real 20m step, facing outward from the
// fence line (perpendicular to the local tangent — the same
// perpendicular-offset math already used for the panel/base strips).
function buildWarningBoards(segments, texture) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.7 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3f4a56, metalness: 0.4, roughness: 0.5 });
  const boardGeo = new THREE.PlaneGeometry(0.5, 0.5);
  boardGeo.rotateX(Math.PI / 2); // stand the board upright: its local-Y extent becomes world-Z (up)
  const postGeo = new THREE.CylinderGeometry(0.03, 0.035, 1.1, 6);
  postGeo.rotateX(Math.PI / 2); // stand the post upright
  for (const pts of segments) {
    const resampled = resamplePolyline(pts, WARNING_SPACING);
    for (let i = 1; i < resampled.length - 1; i++) {
      const p = resampled[i];
      const prev = resampled[i - 1];
      const dx = p[0] - prev[0], dz = p[1] - prev[1];
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len; // outward normal (nz = north component)
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(p[0] + nx * 0.15, p[1] + nz * 0.15, 0.55);
      group.add(post);
      const board = new THREE.Mesh(boardGeo, mat);
      board.position.set(p[0] + nx * 0.15, p[1] + nz * 0.15, 1.15);
      // after the rotateX(Math.PI/2) bake-in, the board's un-yawed facing
      // is world -Y; this rotates that facing to point along (nx, nz).
      board.rotation.z = Math.atan2(nx, -nz);
      group.add(board);
    }
  }
  return group;
}

export function createFenceLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;
  let lastSegments = [];
  let breachRafId = null;
  const MAX_POSTS = 800;
  // same equirectangular approximation ProjectionService.js uses, inverted —
  // needed only to convert the demo breach marker's local position back to
  // lon/lat so the caller can fly the camera to it.
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((anchor[1] * Math.PI) / 180);
  const unproject = ([x, z]) => [anchor[0] + x / mPerDegLon, anchor[1] + z / mPerDegLat];

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
      scene.add(new THREE.AmbientLight(0x9fb4c8, 1.1));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // Accepts either shape:
    //  - LineString/MultiLineString (gis.fences, the real hand-digitized
    //    fence.txt segments — multiple runs expected, gaps at gates etc.)
    //  - Polygon/MultiPolygon (e.g. gis.boundary, the real OSM
    //    landuse=military ring) — each ring's outer boundary becomes one
    //    closed fence run.
    // Currently called with gis.boundary (now verified against live OSM
    // data) so the fence traces the full, accurate perimeter; fence.txt's
    // own digitized runs only cover a few short stretches, revisit later.
    setFences(fc) {
      root.clear();
      const features = fc?.features || [];
      const segments = [];
      for (const f of features) {
        const g = f.geometry;
        if (!g) continue;
        const lines = g.type === 'MultiLineString' ? g.coordinates
          : g.type === 'LineString' ? [g.coordinates]
          : g.type === 'Polygon' ? g.coordinates.slice(0, 1) // outer ring only
          : g.type === 'MultiPolygon' ? g.coordinates.map((poly) => poly[0])
          : [];
        for (const line of lines) segments.push(line.map(([lon, lat]) => projection.projectCoordinate(lon, lat)));
      }
      if (!segments.length) return;
      lastSegments = segments;

      // panel (vertical bars + rails, textured), top security wire, concrete base
      const panelAcc = createPanelAccumulator();
      const baseAcc = createPanelAccumulator();
      const wireAcc = createPanelAccumulator();
      const REPEAT_UNIT = POST_SPACING;
      const WIRE_H = 0.18;
      for (const pts of segments) {
        let cum = 0;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const u1 = cum / REPEAT_UNIT, u2 = (cum + segLen) / REPEAT_UNIT;
          panelAcc.addSegment(a, b, FENCE_HEIGHT, u1, u2);
          baseAcc.addSegment(a, b, 0.15, 0, 1);
          const wireU1 = cum / 0.6, wireU2 = (cum + segLen) / 0.6;
          wireAcc.addSegment(a, b, WIRE_H, wireU1, wireU2);
          cum += segLen;
        }
      }
      const fenceTex = makeFenceTexture();
      const panelMat = new THREE.MeshStandardMaterial({
        map: fenceTex, color: 0xd7dde3, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
        metalness: 0.6, roughness: 0.35, emissive: 0x8f97a0, emissiveIntensity: 0.25,
      });
      root.add(new THREE.Mesh(panelAcc.build(), panelMat));
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x6b7480, roughness: 0.85 });
      root.add(new THREE.Mesh(baseAcc.build(), baseMat));

      // top security wire — a thin barbed strand riding the fence's own
      // top edge (its ground-quad accumulator segments are lifted to
      // FENCE_HEIGHT by the mesh's own Y offset below)
      const wireMat = new THREE.MeshStandardMaterial({ map: makeBarbedWireTexture(), transparent: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
      const wireMesh = new THREE.Mesh(wireAcc.build(), wireMat);
      wireMesh.position.z = FENCE_HEIGHT;
      root.add(wireMesh);

      // warning boards every real 20m
      root.add(buildWarningBoards(segments, makeWarningTexture()));

      // posts every real 2.5m, instanced
      const postPositions = [];
      for (const pts of segments) {
        for (const p of resamplePolyline(pts, POST_SPACING)) postPositions.push(p);
      }
      const count = Math.min(postPositions.length, MAX_POSTS);
      const postMat = new THREE.MeshStandardMaterial({ color: 0xc7ced5, metalness: 0.65, roughness: 0.3 });
      const postGeo = new THREE.CylinderGeometry(0.05, 0.06, FENCE_HEIGHT, 6);
      postGeo.translate(0, FENCE_HEIGHT / 2, 0);
      postGeo.rotateX(Math.PI / 2); // stand the post upright: local-Y (height) becomes world-Z
      const postMesh = new THREE.InstancedMesh(postGeo, postMat, count);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        dummy.position.set(postPositions[i][0], postPositions[i][1], 0);
        dummy.updateMatrix();
        postMesh.setMatrixAt(i, dummy.matrix);
      }
      postMesh.instanceMatrix.needsUpdate = true;
      root.add(postMesh);
    },

    setVisible(v) { visible = v; },

    // Demo-only: no live intrusion sensor exists (see GeofenceEngine.js).
    // Animates one marker along a real fence segment's outward normal,
    // reporting proximity state each frame via onUpdate({state, distance,
    // lonLat}) so SecurityAlerts.jsx can drive its panel + camera flyTo.
    // Cancels any prior run first so repeated clicks don't stack.
    simulateBreach(onUpdate) {
      if (breachRafId) cancelAnimationFrame(breachRafId);
      if (!lastSegments.length || lastSegments[0].length < 2) return;
      const path = buildDemoBreachPath(lastSegments[0], 1);
      const allSegments = lastSegments.flatMap((pts) => pts.slice(1).map((p, i) => [pts[i], p]));

      const markerMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffe066, emissiveIntensity: 0.8, roughness: 0.4 });
      const markerGeo = new THREE.CapsuleGeometry(0.22, 0.6, 4, 8);
      markerGeo.rotateX(Math.PI / 2); // stand upright: local-Y becomes world-Z
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(path.waypoints[0][0], path.waypoints[0][1], 0.7);
      root.add(marker);

      const durationMs = 4200;
      const t0 = performance.now();
      const step = (now) => {
        const t = (now - t0) / durationMs;
        if (t >= 1) {
          root.remove(marker);
          onUpdate?.({ state: 'safe', distance: Infinity, lonLat: null, done: true });
          mapRef?.triggerRepaint();
          return;
        }
        const p = lerpPath(path.waypoints, t);
        marker.position.set(p[0], p[1], 0.7);
        const { distance } = distanceToFence(p, allSegments);
        const state = classifyProximity(distance);
        markerMat.color.set(state === 'crossing' ? 0xff3b3b : state === 'approaching' ? 0xffe066 : 0x4de2ff);
        markerMat.emissive.set(markerMat.color);
        onUpdate?.({ state, distance, lonLat: unproject(p) });
        mapRef?.triggerRepaint();
        breachRafId = requestAnimationFrame(step);
      };
      breachRafId = requestAnimationFrame(step);
    },

    render(gl, options) {
      if (!visible || !renderer) return;
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
