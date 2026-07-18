import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { pulsingBeaconMaterial, pulseBeacon } from './SecurityIcons';

// Gates and watch towers — every position is derived from real geometry:
// the gate comes from the real Main Gate building footprint (category=
// 'gate', zmu_buildings); towers sit at the real campus boundary polygon's
// corner vertices (a convex-hull reduction of the real boundary ring, not
// a fabricated count/position). CCTV units themselves are NOT duplicated
// here — every camera in the scene, including the one at the gate, comes
// from CCTVLayer.jsx so there is exactly one camera-rendering path.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd,
// setSecurity, setVisible, render}.

const ZOOM_GATE = 15.8;

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

// Standard monotone-chain convex hull — reduces the real boundary ring
// (which may have many digitized vertices) to its actual corner points.
function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return [...lower, ...upper];
}

// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx).
// Vertical elements bake `geometry.rotateX(Math.PI / 2)` once so their
// default local-Y height becomes world-Z; a yaw that used to align that
// same geometry's local-Z-forward via `rotation.y = atan2(A, B)` becomes
// `rotation.z = atan2(A, -B)` post-bake (the bake also turns local-Z into
// world -Y, so the sign flips). Elements meant to lie flat (thin boxes)
// need no bake — just a direct `rotation.z` yaw of their local-X axis.
function buildGateCluster(position, direction) {
  const group = new THREE.Group();
  const dirLen = Math.hypot(direction[0], direction[1]) || 1;
  const nx = direction[0] / dirLen, nz = direction[1] / dirLen;
  const px = -nz, pz = nx;
  const width = 3;

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.5, roughness: 0.35 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x33404d, roughness: 0.6 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x101820, emissive: 0x2b5a70, emissiveIntensity: 0.4, roughness: 0.2 });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0xffb020, roughness: 0.5 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c222b, emissive: 0x2fbf6f, emissiveIntensity: 0.4, roughness: 0.4 });

  // sliding gate leaf — a slim panel resting to one side of the opening
  const leafGeo = new THREE.BoxGeometry(width * 0.85, 1.7, 0.08);
  leafGeo.rotateX(Math.PI / 2);
  const leaf = new THREE.Mesh(leafGeo, steelMat);
  leaf.position.set(position[0] - px * width * 0.55, position[1] - pz * width * 0.55, 0.85);
  leaf.rotation.z = Math.atan2(px, -pz);
  group.add(leaf);

  // barrier arm pivot post (upright) + arm (rests flat across the opening)
  const armPivotGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
  armPivotGeo.rotateX(Math.PI / 2);
  const armPivot = new THREE.Mesh(armPivotGeo, steelMat);
  armPivot.position.set(position[0] + px * width * 0.5, position[1] + pz * width * 0.5, 0.5);
  group.add(armPivot);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.5 }));
  arm.position.set(position[0] + px * width * 0.5 - nx * width * 0.4, position[1] + pz * width * 0.5 - nz * width * 0.4, 1.1);
  arm.rotation.z = Math.atan2(nz, nx);
  group.add(arm);

  // guard cabin
  const cabinGeo = new THREE.BoxGeometry(1.6, 2.1, 1.6);
  cabinGeo.rotateX(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(position[0] - nx * 2.6, position[1] - nz * 2.6, 1.05);
  group.add(cabin);
  const windowGeo = new THREE.BoxGeometry(0.9, 0.6, 0.05);
  windowGeo.rotateX(Math.PI / 2);
  const window_ = new THREE.Mesh(windowGeo, windowMat);
  window_.position.set(position[0] - nx * 2.6 + px * 0.81, position[1] - nz * 2.6 + pz * 0.81, 1.3);
  window_.rotation.z = Math.atan2(px, -pz);
  group.add(window_);

  // bollards
  const bollardGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
  bollardGeo.rotateX(Math.PI / 2);
  for (const s of [-1.2, -0.4, 0.4, 1.2]) {
    const b = new THREE.Mesh(bollardGeo, bollardMat);
    b.position.set(position[0] + px * s, position[1] + pz * s, 0.35);
    group.add(b);
  }

  // access control panel
  const panelGeo = new THREE.BoxGeometry(0.3, 0.9, 0.12);
  panelGeo.rotateX(Math.PI / 2);
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(position[0] - px * width * 0.5 - nx * 0.4, position[1] - pz * width * 0.5 - nz * 0.4, 0.9);
  group.add(panel);

  // pulsing red beacon
  const beaconMat = pulsingBeaconMaterial();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), beaconMat);
  beacon.position.set(position[0] - nx * 2.6, position[1] - nz * 2.6, 2.25);
  group.add(beacon);
  group.userData.beaconMat = beaconMat;

  return group;
}

function buildTower(x, y) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8f97a3, metalness: 0.5, roughness: 0.45 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.55 });
  const height = 7.5;

  const poleGeo = new THREE.CylinderGeometry(0.22, 0.32, height, 8);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, y, height / 2);
  group.add(pole);

  const platformGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.15, 8);
  platformGeo.rotateX(Math.PI / 2);
  const platform = new THREE.Mesh(platformGeo, cabinMat);
  platform.position.set(x, y, height);
  group.add(platform);
  const cabinGeo = new THREE.BoxGeometry(1.6, 1.7, 1.6);
  cabinGeo.rotateX(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(x, y, height + 0.95);
  group.add(cabin);

  const antennaGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.6, 6);
  antennaGeo.rotateX(Math.PI / 2);
  const antenna = new THREE.Mesh(antennaGeo, poleMat);
  antenna.position.set(x + 0.7, y, height + 2.6);
  group.add(antenna);

  const searchlightMat = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff3d6, emissiveIntensity: 0.6, roughness: 0.3 });
  const searchlightGeo = new THREE.ConeGeometry(0.18, 0.4, 10);
  searchlightGeo.rotateX(Math.PI / 2);
  const searchlight = new THREE.Mesh(searchlightGeo, searchlightMat);
  searchlight.position.set(x - 0.6, y, height + 1.6);
  searchlight.rotation.x = 0.9; // decorative downward/outward tilt
  group.add(searchlight);
  group.userData.searchlight = searchlight;

  const beaconMat = pulsingBeaconMaterial(0xff3b3b);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), beaconMat);
  beacon.position.set(x, y, height + 1.85);
  group.add(beacon);
  group.userData.beaconMat = beaconMat;

  return group;
}

export function createSecurityLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;
  const beaconMats = [];
  const towers = [];

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

    setSecurity({ buildings, boundary }) {
      root.clear();
      beaconMats.length = 0;
      towers.length = 0;

      // real gate 1: the Main Gate building's own centroid + long-axis direction
      const gateBuilding = (buildings || []).find((b) => b.category === 'gate');
      if (gateBuilding?.geometry) {
        const ring = gateBuilding.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
        const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
        const a = ring[0], b = ring[1] || ring[0];
        const dir = [b[0] - a[0], b[1] - a[1]];
        const cluster = buildGateCluster([cx, cz], dir);
        root.add(cluster);
        beaconMats.push(cluster.userData.beaconMat);
      }

      // towers at the real boundary's convex-hull corners
      const boundaryFeature = boundary?.features?.[0];
      if (boundaryFeature) {
        const ring = boundaryFeature.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        const hull = convexHull(ring);
        for (const [x, z] of hull) {
          const tower = buildTower(x, z);
          root.add(tower);
          beaconMats.push(tower.userData.beaconMat);
          towers.push(tower);
        }
      }
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      if (mapRef.getZoom() < ZOOM_GATE) return;
      const now = performance.now();
      for (const mat of beaconMats) pulseBeacon(mat, now);
      for (const tower of towers) {
        if (tower.userData.searchlight) tower.userData.searchlight.rotation.z = now * 0.0006;
      }
      if (beaconMats.length || towers.length) mapRef?.triggerRepaint();
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
