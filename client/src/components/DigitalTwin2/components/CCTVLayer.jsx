import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { makeCameraRecord, CAMERA_STATUS_COLORS } from '../data/cameraRegistry';

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
//   - Campus 2's own real building centroids (setCampus2Cameras), so the
//     second site is covered by the same network rather than left blank
//
// Each placed camera is bound to a full record (id / name / zone / status /
// health / feed — see data/cameraRegistry.js) and is individually pickable:
// hovering shows a small id + online-state tooltip, clicking opens the feed
// + health panel (CameraPopup.jsx / CameraPanel.jsx). The camera body is
// coloured by its own health status (green online, amber degraded, red
// offline) so a dead camera is visible on the map without opening anything.
//
// A Three.js "custom" MapLibre layer: {id, type:'custom',
// renderingMode:'3d', onAdd, setCCTV, setCampus2Cameras, getCameras,
// pickAt, setHoveredId, setSelectedId, setVisible, render}.

const ZOOM_GATE = 16.5;
const FENCE_VERTEX_STRIDE = 6;
// Invisible click target around each camera head — the real camera geometry
// is only ~0.4 m across, far too small to hit reliably at campus zoom.
const PICK_RADIUS_M = 3.2;

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

function ringCentroidLocal(feature, projection) {
  if (feature.geometry?.type !== 'Polygon') return null;
  const ring = feature.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  if (!ring.length) return null;
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
}

// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx).
// The `head` sub-group uses its own local convention of Y=forward,
// Z=up (rather than mimicking world axes) so panning is a single, pure
// `rotation.z` — Cylinder/Cone already point along local Y by default, so
// no extra bake/rotation is needed on the lens/cone themselves; only the
// pole (a true standing post) needs the usual rotateX(Math.PI/2) bake.
function buildCamera(x, y, phase, record) {
  const group = new THREE.Group();
  const statusHex = record.statusColor.hex;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a6270, metalness: 0.4, roughness: 0.5 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c222b, roughness: 0.4, metalness: 0.3 });
  // Lens + view cone take the camera's own health colour, so an offline
  // camera reads as a dead red unit on the map without any interaction.
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0e13, emissive: statusHex, emissiveIntensity: 0.9, roughness: 0.2 });
  const coneMat = new THREE.MeshBasicMaterial({ color: statusHex, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });

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

  // A fully transparent (but still raycastable) sphere around the head —
  // the actual click/hover target. depthWrite:false + opacity 0 keeps it
  // invisible and non-occluding; note it must stay `visible: true`, since
  // three.js's raycaster skips objects with visible === false.
  const pickMesh = new THREE.Mesh(
    new THREE.SphereGeometry(PICK_RADIUS_M, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  pickMesh.position.set(x, y, 2.6);
  pickMesh.userData.record = record;
  group.add(pickMesh);

  // Selection halo — a flat ring on the ground under the camera, hidden
  // until the camera is hovered or selected.
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.1, 28),
    new THREE.MeshBasicMaterial({ color: 0x4de2ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
  );
  halo.position.set(x, y, 0.08);
  halo.visible = false;
  group.add(halo);

  group.userData.head = head;
  group.userData.phase = phase;
  group.userData.record = record;
  group.userData.pickMesh = pickMesh;
  group.userData.halo = halo;
  group.userData.lens = lensMat;
  group.userData.cone = coneMat;
  return group;
}

export function createCCTVLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;
  let hoveredId = null;
  let selectedId = null;
  // Active camera filter — {statuses:Set, kinds:Set, campuses:Set}; any
  // absent/empty facet means "don't filter on that facet". A filtered-out
  // camera is hidden AND unpickable, so the map can't hand back a record
  // the operator has deliberately filtered away.
  let filter = null;
  const cameras = [];
  const raycaster = new THREE.Raycaster();

  function matchesFilter(rec) {
    if (!filter) return true;
    if (filter.statuses?.size && !filter.statuses.has(rec.status)) return false;
    if (filter.kinds?.size && !filter.kinds.has(rec.kind)) return false;
    if (filter.campuses?.size && !filter.campuses.has(rec.campus)) return false;
    return true;
  }

  // Campus 1 and Campus 2 place cameras from two independent data sets and
  // in two separate calls, so each keeps its own THREE.Group under `root`
  // and its own id sequence — re-running one never disturbs the other.
  const groups = { 1: null, 2: null };

  function resetCampus(campusNo) {
    if (groups[campusNo]) {
      root.remove(groups[campusNo]);
      for (let i = cameras.length - 1; i >= 0; i--) if (cameras[i].userData.record.campus === campusNo) cameras.splice(i, 1);
    }
    const g = new THREE.Group();
    groups[campusNo] = g;
    root.add(g);
    return g;
  }

  // `placements` = [{ point:[x,y] localMetres, kind, place }]
  function placeCameras(campusNo, placements) {
    const g = resetCampus(campusNo);
    placements.forEach(({ point, kind, place }, i) => {
      const [x, y] = point;
      const record = makeCameraRecord({
        campus: campusNo, seq: i, kind, place,
        lonLat: projection.unprojectCoordinate(x, y),
      });
      const cam = buildCamera(x, y, i * 0.7, record);
      cam.visible = matchesFilter(record);
      cam.userData.pickMesh.visible = cam.visible;
      g.add(cam);
      cameras.push(cam);
    });
  }

  function applyState(group) {
    const rec = group.userData.record;
    const isSelected = rec.id === selectedId;
    const isHovered = rec.id === hoveredId;
    group.userData.halo.visible = isSelected || isHovered;
    group.userData.halo.material.color.set(isSelected ? 0x4de2ff : 0xffffff);
    group.userData.halo.material.opacity = isSelected ? 0.85 : 0.45;
    group.userData.cone.opacity = isSelected ? 0.34 : isHovered ? 0.24 : 0.12;
    group.userData.lens.emissiveIntensity = isSelected ? 2.2 : isHovered ? 1.5 : 0.9;
  }

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
      const placements = [];

      // gate
      const gateBuilding = (buildings || []).find((b) => b.category === 'gate');
      if (gateBuilding?.centroid) {
        placements.push({
          point: projection.projectCoordinate(gateBuilding.centroid[0], gateBuilding.centroid[1]),
          kind: 'gate', place: gateBuilding.display_name,
        });
      }

      // every Nth real vertex of the real campus boundary ring
      const boundaryFeature = boundary?.features?.[0];
      if (boundaryFeature?.geometry?.type === 'Polygon') {
        const ring = boundaryFeature.geometry.coordinates[0].map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        for (let i = 0; i < ring.length; i += FENCE_VERTEX_STRIDE) {
          placements.push({ point: ring[i], kind: 'perimeter', place: `Fence post ${Math.floor(i / FENCE_VERTEX_STRIDE) + 1}` });
        }
      }

      // parking centroids
      for (const [i, f] of (parking?.features || []).entries()) {
        const c = ringCentroidLocal(f, projection);
        if (c) placements.push({ point: c, kind: 'parking', place: f.properties?.name || `Lot ${i + 1}` });
      }

      // real road-road junctions
      for (const j of findRoadJunctions(roads, projection)) placements.push({ point: j, kind: 'junction', place: null });

      // important buildings: real non-generic category, plus Block-3 explicitly
      for (const b of buildings || []) {
        if (!b.centroid) continue;
        if (b.category !== 'structure' || b.id === 'REAL-BLOCK-3') {
          placements.push({ point: projection.projectCoordinate(b.centroid[0], b.centroid[1]), kind: 'building', place: b.display_name });
        }
      }

      // sports ground + helipad centroids
      for (const fc of [sportsfields, grounds]) {
        for (const f of fc?.features || []) {
          const c = ringCentroidLocal(f, projection);
          if (c) placements.push({ point: c, kind: 'ground', place: f.properties?.name || null });
        }
      }

      placeCameras(1, placements);
    },

    // Campus 2 coverage — same camera network, fed by Campus 2's own real
    // building centroids (every `stride`-th, so the second site gets
    // realistic spread rather than one camera per structure).
    setCampus2Cameras(buildingCandidates, { stride = 2 } = {}) {
      const placements = [];
      (buildingCandidates || []).forEach((b, i) => {
        if (i % stride !== 0 || !b?.centroid) return;
        placements.push({
          point: projection.projectCoordinate(b.centroid[0], b.centroid[1]),
          kind: 'building', place: b.display_name,
        });
      });
      placeCameras(2, placements);
    },

    /**
     * Narrow which cameras are drawn/pickable.
     * @param {{statuses?:Set<string>, kinds?:Set<string>, campuses?:Set<number>}|null} next
     * @returns {string[]} ids that are still visible after filtering — the
     *   caller uses this to drop a selection/hover that just got filtered out.
     */
    setFilter(next) {
      filter = next;
      const remaining = [];
      for (const g of cameras) {
        const ok = matchesFilter(g.userData.record);
        // Both the group and its pick sphere: three.js's raycaster tests
        // `visible` on the object it is handed, and pickAt hands it the pick
        // meshes directly rather than walking down from the group.
        g.visible = ok;
        g.userData.pickMesh.visible = ok;
        if (ok) remaining.push(g.userData.record.id);
      }
      if (hoveredId && !remaining.includes(hoveredId)) hoveredId = null;
      if (selectedId && !remaining.includes(selectedId)) selectedId = null;
      mapRef?.triggerRepaint();
      return remaining;
    },

    getCameras() { return cameras.map((c) => c.userData.record); },

    getVisibleCameras() { return cameras.filter((c) => c.visible).map((c) => c.userData.record); },

    getCamera(cameraId) { return cameras.find((c) => c.userData.record.id === cameraId)?.userData.record || null; },

    // See BuildingLayer.jsx's pickAt for why this uses manual
    // Vector3.unproject rather than raycaster.setFromCamera.
    pickAt(clientX, clientY) {
      if (!visible || !camera || !mapRef || !cameras.length) return null;
      if (mapRef.getZoom() < ZOOM_GATE) return null; // cameras aren't drawn this far out — don't let them steal clicks
      const rect = mapRef.getCanvas().getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
      const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
      raycaster.set(near, far.sub(near).normalize());
      const hits = raycaster.intersectObjects(cameras.map((c) => c.userData.pickMesh), false);
      return hits.length ? hits[0].object.userData.record : null;
    },

    setHoveredId(cameraId) {
      if (hoveredId === cameraId) return;
      hoveredId = cameraId;
      for (const g of cameras) applyState(g);
      mapRef?.triggerRepaint();
    },

    setSelectedId(cameraId) {
      selectedId = cameraId;
      for (const g of cameras) applyState(g);
      mapRef?.triggerRepaint();
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      if (mapRef.getZoom() < ZOOM_GATE) return;
      const now = performance.now();
      for (const cam of cameras) {
        const rec = cam.userData.record;
        // Offline cameras don't pan — a dead unit should read as frozen.
        if (rec.status !== 'offline') {
          cam.userData.head.rotation.z = Math.sin(now * 0.0003 + cam.userData.phase) * 0.9;
        }
        // Selected camera's halo pulses, same technique BuildingLayer uses.
        if (rec.id === selectedId) {
          cam.userData.halo.material.opacity = 0.5 + ((Math.sin(now * 0.005) + 1) / 2) * 0.5;
        }
      }
      if (cameras.length) mapRef?.triggerRepaint();
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}

export { CAMERA_STATUS_COLORS };
