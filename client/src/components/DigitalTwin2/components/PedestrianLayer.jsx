import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { buildLandscapeGroup } from './LandscapeLayer';

// Renders the output of WalkwayGenerator.generateCampusLayout() — a
// procedurally generated (not digitized) pedestrian network + landscape
// scatter. The generator already works in the same local meter-space
// every Three.js layer shares, so this layer just builds meshes from its
// output directly; `projection` here is only used for the per-frame
// camera-matrix sync (applyToCamera), same as every other custom layer.
//
// A Three.js "custom" MapLibre layer, same shape as BuildingLayer/
// TreeLayer: {id, type:'custom', renderingMode:'3d', onAdd, setLayout,
// setVisible, render}.

const WALKWAY_WIDTH = 3;
const MAX_INSTANCES = 500;

function makeConcreteTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9beac';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeZebraTexture() {
  const w = 64, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2f36';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f2f4f6';
  const stripes = 5;
  for (let i = 0; i < stripes; i++) if (i % 2 === 0) ctx.fillRect((i * w) / stripes, 0, w / stripes, h);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}
function makeDotTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9beac';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#8a7f6d';
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

// Rounded joints are a separate InstancedMesh of THREE's own built-in
// CircleGeometry, left at its default orientation — under this module's
// real ground-plane convention (X=east, Y=north, Z=up, matching
// BuildingLayer.jsx), CircleGeometry already lies flat in the XY ground
// plane with no rotation needed (see PersonnelLayer.jsx). The previous
// `rotateX(-Math.PI/2)` was compensating for the OLD, incorrect
// Y=up/Z=north assumption this file used to make (see git history) —
// removing it, not adding a new one, is the fix.
function buildJointMesh(walkways) {
  const points = [];
  for (const [p1, p2] of walkways) { points.push(p1, p2); }
  const geo = new THREE.CircleGeometry(WALKWAY_WIDTH / 2, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcdc2ae, roughness: 0.95 });
  const count = Math.min(points.length, MAX_INSTANCES * 4);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(points[i][0], points[i][1], 0.016);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// One explicit-vertex ground quad per segment (same technique as
// buildCrossings' groundQuadVerts/makeGroundQuadMesh below).
function buildWalkwayMesh(walkways, texture) {
  texture.repeat.set(1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, side: THREE.DoubleSide });
  const group = new THREE.Group();
  for (const [p1, p2] of walkways) {
    const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
    const len = Math.hypot(dx, dz) || 1e-6;
    const along = [dx / len, dz / len];
    const across = [-along[1], along[0]];
    const cx = (p1[0] + p2[0]) / 2, cz = (p1[1] + p2[1]) / 2;
    group.add(makeGroundQuadMesh(groundQuadVerts(cx, cz, along, across, len, WALKWAY_WIDTH), 0.015, mat));
  }
  group.add(buildJointMesh(walkways));
  return group;
}

// Explicit-vertex ground quad, oriented by an (along, across) basis
// computed directly from the real crossing's road bearing — no
// mesh.rotation at all. Ground-plane convention: X=east, Y=north, Z=up.
function groundQuadVerts(cx, cy, along, across, lenAlong, lenAcross) {
  const ha = lenAlong / 2, hc = lenAcross / 2;
  return [
    [cx - along[0] * ha - across[0] * hc, cy - along[1] * ha - across[1] * hc],
    [cx + along[0] * ha - across[0] * hc, cy + along[1] * ha - across[1] * hc],
    [cx + along[0] * ha + across[0] * hc, cy + along[1] * ha + across[1] * hc],
    [cx - along[0] * ha + across[0] * hc, cy - along[1] * ha + across[1] * hc],
  ];
}
function makeGroundQuadMesh(corners, elevation, material) {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array(corners.flatMap(([x, y]) => [x, y, elevation]));
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function buildCrossings(crossings, zebraTex, dotTex) {
  const group = new THREE.Group();
  const zebraMat = new THREE.MeshStandardMaterial({ map: zebraTex, roughness: 0.8 });
  const dotMat = new THREE.MeshStandardMaterial({ map: dotTex, roughness: 0.9 });
  const raisedMat = new THREE.MeshStandardMaterial({ color: 0xb8ad99, roughness: 0.9 });
  for (const { point, bearing } of crossings) {
    const along = [Math.cos(bearing), Math.sin(bearing)]; // road direction
    const across = [-along[1], along[0]]; // pedestrian crossing direction
    const roadWidth = 4.5, crossingLen = WALKWAY_WIDTH;

    // raised bump beneath the crossing — a thin flat box, no bake needed
    const raised = new THREE.Mesh(new THREE.BoxGeometry(crossingLen, roadWidth, 0.08), raisedMat);
    raised.position.set(point[0], point[1], 0.04);
    raised.rotation.z = bearing;
    group.add(raised);

    // zebra stripe spanning the road width
    group.add(makeGroundQuadMesh(groundQuadVerts(point[0], point[1], along, across, roadWidth, crossingLen), 0.085, zebraMat));

    // tactile paving strips just outside the crossing, on either approach
    for (const sign of [-1, 1]) {
      const cx = point[0] + across[0] * sign * (roadWidth / 2 + 0.5);
      const cz = point[1] + across[1] * sign * (roadWidth / 2 + 0.5);
      group.add(makeGroundQuadMesh(groundQuadVerts(cx, cz, along, across, 0.8, crossingLen), 0.02, dotMat));
    }
  }
  return group;
}

export function createPedestrianLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0xaebccb, 1.15));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setLayout({ walkways, crossings, landscapeZones }) {
      root.clear();
      // Walkway ribbon + crossings were previously disabled here after
      // producing a corrupted "spike" artifact at this network's real size
      // (300+ segments) — the root cause turned out to be this whole
      // module's ground-plane axis bug (see PersonnelLayer.jsx's comment):
      // every vertex here was built as (east, elevation, north) instead of
      // this codebase's real (east, north, elevation) convention, so each
      // segment's real ground-distance (tens of metres) was being embedded
      // as a vertical/depth spike instead of a flat ground offset. Now
      // fixed at the source (groundQuadVerts/makeGroundQuadMesh/
      // buildJointMesh above), so re-enabled.
      if (walkways?.length) root.add(buildWalkwayMesh(walkways, makeConcreteTexture()));
      if (crossings?.length) root.add(buildCrossings(crossings, makeZebraTexture(), makeDotTexture()));
      root.add(buildLandscapeGroup(landscapeZones));
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
