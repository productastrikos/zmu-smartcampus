import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Renders a real entrance-gate structure at the real Main Gate building's
// own footprint (category='gate', zmu_buildings — the same digitized
// polygon from zmu_road.txt's "main gate" section that FenceLayer.jsx and
// SecurityLayer.jsx's watch-tower placement also key off). Position and
// orientation come entirely from that real geometry — nothing freehand.
//
// Component set and rough proportions (posts ~5m, barrier arm ~4-5m span,
// guard booth ~2.5m, bollards, flagpole ~9m) are generalized from
// published UAE/GCC military-base checkpoint gate references (TYMETAL,
// FDC, Sloan Security Group) — no photo of ZMU's actual gate was
// available to match against, so this is a realistic stand-in, not a
// digitized reproduction (unlike the fence/roads, which trace real
// coordinates).
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setGate,
// setVisible, render}.

const ZOOM_GATE = 14.5; // more lenient than SecurityLayer's 15.8 — this should still read at a whole-campus zoom-to-fit

// ZMU brand gold (#C6A24E / #8A6C2E, same tokens as the login/header
// chrome) baked into a small canvas plaque texture for the archway sign.
function makeSignTexture() {
  const w = 512, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a2115');
  grad.addColorStop(1, '#1a1510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c6a24e';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = '#e8cd85';
  ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ZAYED MILITARY UNIVERSITY', w / 2, h * 0.4);
  ctx.font = '600 30px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#c6a24e';
  ctx.fillText('MAIN GATE', w / 2, h * 0.76);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// Diagonal red/white hazard stripes for the boom barrier arm — same
// canvas-texture-over-a-simple-box technique FenceLayer.jsx uses for its
// chain-link/warning-sign panels, rather than per-stripe geometry.
function makeBarrierTexture() {
  const w = 256, h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c81e2e';
  const stripe = 26;
  for (let x = -h; x < w + h; x += stripe * 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + stripe, 0); ctx.lineTo(x + stripe - h, h); ctx.lineTo(x - h, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx
// / FenceLayer.jsx). Vertical elements bake `geometry.rotateX(Math.PI/2)`
// once so local-Y height becomes world-Z; a yaw aligning that geometry's
// local-Z-forward then uses `rotation.z = atan2(A, -B)` post-bake. Flat
// (thin box) elements need no bake — just `rotation.z` on local-X.
function buildGateStructure(position, direction) {
  const group = new THREE.Group();
  const dirLen = Math.hypot(direction[0], direction[1]) || 1;
  const nx = direction[0] / dirLen, nz = direction[1] / dirLen; // "along the road" axis
  const px = -nz, pz = nx; // perpendicular — spans the roadway
  const halfSpan = 2.6; // ~5.2m lane width between the two pillars
  const postH = 5.0;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6e5622, metalness: 0.4, roughness: 0.4 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.55, roughness: 0.3 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x33404d, roughness: 0.6 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x101820, emissive: 0x2b5a70, emissiveIntensity: 0.4, roughness: 0.2 });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0xc6a24e, roughness: 0.5 });

  // Two flanking stone-clad pillars.
  const pillarGeo = new THREE.BoxGeometry(0.55, 0.55, postH);
  pillarGeo.translate(0, 0, postH / 2);
  pillarGeo.rotateX(Math.PI / 2);
  const capGeo = new THREE.BoxGeometry(0.7, 0.7, 0.25);
  capGeo.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(position[0] + px * halfSpan * s, position[1] + pz * halfSpan * s, 0);
    group.add(pillar);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(position[0] + px * halfSpan * s, position[1] + pz * halfSpan * s, postH + 0.12);
    group.add(cap);
  }

  // Overhead archway beam spanning both pillars, carrying the ZMU sign
  // plaque (faces along the road so an approaching vehicle reads it).
  const beamGeo = new THREE.BoxGeometry(halfSpan * 2 + 0.9, 0.5, 0.4);
  const beam = new THREE.Mesh(beamGeo, capMat);
  beam.position.set(position[0], position[1], postH + 0.4);
  beam.rotation.z = Math.atan2(px, -pz);
  group.add(beam);

  const signMat = new THREE.MeshStandardMaterial({ map: makeSignTexture(), roughness: 0.5 });
  const signGeo = new THREE.PlaneGeometry(halfSpan * 1.7, 0.85);
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(position[0] - nx * 0.22, position[1] - nz * 0.22, postH + 0.4);
  sign.rotation.z = Math.atan2(px, -pz);
  group.add(sign);
  const signBack = new THREE.Mesh(signGeo, signMat);
  signBack.position.set(position[0] + nx * 0.22, position[1] + nz * 0.22, postH + 0.4);
  signBack.rotation.z = Math.atan2(-px, pz);
  group.add(signBack);

  // Boom barrier — pivot post at one pillar, striped arm resting closed
  // across the lane at real checkpoint height (~1.1m).
  const pivotGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.3, 8);
  pivotGeo.rotateX(Math.PI / 2);
  const pivot = new THREE.Mesh(pivotGeo, steelMat);
  pivot.position.set(position[0] + px * halfSpan * 0.72, position[1] + pz * halfSpan * 0.72, 0.65);
  group.add(pivot);
  const armMat = new THREE.MeshStandardMaterial({ map: makeBarrierTexture(), roughness: 0.4 });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 1.5, 0.14, 0.1), armMat);
  arm.position.set(position[0] + px * halfSpan * 0.72 - nx * halfSpan * 0.75, position[1] + pz * halfSpan * 0.72 - nz * halfSpan * 0.75, 1.1);
  arm.rotation.z = Math.atan2(nz, nx);
  group.add(arm);

  // Guard booth beside the barrier, set back from the lane.
  const cabinGeo = new THREE.BoxGeometry(1.8, 2.3, 2.2);
  cabinGeo.rotateX(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(position[0] + px * halfSpan * 1.6 - nx * 1.4, position[1] + pz * halfSpan * 1.6 - nz * 1.4, 1.15);
  group.add(cabin);
  const winGeo = new THREE.BoxGeometry(1.0, 0.7, 0.05);
  winGeo.rotateX(Math.PI / 2);
  const win = new THREE.Mesh(winGeo, windowMat);
  win.position.set(
    position[0] + px * halfSpan * 1.6 - nx * 1.4 + nx * 0.91,
    position[1] + pz * halfSpan * 1.6 - nz * 1.4 + nz * 0.91,
    1.4,
  );
  win.rotation.z = Math.atan2(nx, -nz);
  group.add(win);

  // Bollards flanking the lane.
  const bollardGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8);
  bollardGeo.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    for (const t of [0.85, 1.3]) {
      const b = new THREE.Mesh(bollardGeo, bollardMat);
      b.position.set(position[0] + px * halfSpan * s * 0.55 - nx * t, position[1] + pz * halfSpan * s * 0.55 - nz * t, 0.4);
      group.add(b);
    }
  }

  // A single flagpole beside one pillar — a recognizable entrance marker
  // at wide zoom even before the archway detail reads clearly.
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.06, 9, 8);
  poleGeo.translate(0, 4.5, 0);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, steelMat);
  pole.position.set(position[0] - px * halfSpan * 1.9, position[1] - pz * halfSpan * 1.9, 0);
  group.add(pole);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xc6a24e, side: THREE.DoubleSide, roughness: 0.6 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), flagMat);
  flag.position.set(position[0] - px * halfSpan * 1.9 + nx * 0.65, position[1] - pz * halfSpan * 1.9 + nz * 0.65, 8.6);
  flag.rotation.z = Math.atan2(nx, -nz);
  group.add(flag);

  return group;
}

export function createGateLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0x9fb4c8, 1.2));
      const sun = new THREE.DirectionalLight(0xfff3d6, 0.6);
      sun.position.set(40, 60, 90);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `gateBuilding` — the real Main Gate building record (category==='gate'
    // from the buildings array). Position = its real centroid; orientation
    // = its own polygon's longest edge (same "first two ring points"
    // convention SecurityLayer.jsx's watch-tower gate marker already used,
    // which for this specific footprint is also its longest edge).
    setGate(gateBuilding) {
      root.clear();
      if (!gateBuilding?.geometry) return;
      const ring = gateBuilding.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const a = ring[0], b = ring[1] || ring[0];
      const dir = [b[0] - a[0], b[1] - a[1]];
      root.add(buildGateStructure([cx, cz], dir));
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
