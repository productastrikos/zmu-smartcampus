import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { stepWalkState, stepWanderState, mulberry32 } from './MovementEngine';
import { tickTelemetry } from './PersonnelRoster';

// Personnel Tracking layer — Phase 1 of the simulated Garmin-wearable
// digital twin (see PersonnelRoster.js/MovementEngine.js). No real
// wearable/BMS feed exists anywhere in this codebase; every position and
// health value here is generated/animated client-side, same honesty
// convention as every other demo layer in this module (CCTV/patrol/
// security/HVAC-incident simulations).
//
// A MapLibre "custom" Three.js layer, same shape as BuildingLayer/
// TreeLayer: {id, type:'custom', renderingMode:'3d', onAdd, setPersonnel,
// setVisible, setHoveredId, setSelectedId, pickAt, getPersonWorldPos,
// render}. Each status bucket (active/inactive/emergency/visitor/faculty/
// security) gets its own small set of InstancedMeshes (shadow, soft glow,
// inner disc, pulsing outer ring) — simpler and cheaper than an
// instanceColor buffer at this roster size (~150), and matches this
// codebase's established convention of plain per-instance matrix writes
// with no instance-level color/opacity attributes anywhere.
//
// Ground-plane axis convention: this file follows BuildingLayer.jsx's
// convention (the one Three.js layer whose orientation is unambiguously
// verified — its ExtrudeGeometry stands buildings upright correctly),
// which is X=east, Y=north, Z=up. That's the OPPOSITE of the "X=east,
// Y=up, Z=north" convention several other components/ layers (Fence/Tree/
// Pedestrian/CCTV/Security/Patrol) assume in their comments — empirically,
// with this shared ProjectionService.applyToCamera (which applies no
// compensating rotation), markers built the other way rendered standing
// straight up (perpendicular to the map) instead of lying flat. Circle/
// ring geometry is left at its Three.js default orientation (normal along
// +Z) — which is already "flat" under X,Y=ground/Z=up — so no rotateX is
// needed or applied here.

const BASE_METERS = 1.0;
const SIZE_RATIO = { active: 1.0, inactive: 0.8, hovered: 1.3, selected: 1.5, breaching: 1.8 };
function baseRatioForStatus(status) { return status === 'inactive' ? SIZE_RATIO.inactive : SIZE_RATIO.active; }

const mPerDegLatConst = 111320;

// Each marker is 4 near-coincident flat discs a few centimetres apart in
// world space (shadow/glow/disc/ring). At this projection's scale (real
// mercator units scaled by worldSize, see ProjectionService.applyToCamera)
// a few centimetres is below the depth buffer's usable precision at
// typical campus-view camera distances, so relying on the Y-offset alone
// to stack them produces inconsistent/glitchy layering between the four.
// Fixed with explicit paint order instead: depthTest+depthWrite off on all
// four (this is an always-on-top tracking overlay, like the CCTV/security
// beacons already are — it should read through other geometry, not be
// occluded by it) plus `renderOrder` so shadow -> glow -> disc -> ring
// always paints in that order regardless of depth-buffer precision.
function buildBucketMeshes(status, count, color) {
  const baseR = BASE_METERS * baseRatioForStatus(status);

  const shadowGeo = new THREE.CircleGeometry(baseR * 0.7, 16);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, depthTest: false });
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, count);
  shadowMesh.renderOrder = 0;

  const glowGeo = new THREE.CircleGeometry(baseR * 2.2, 20);
  const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const glowMesh = new THREE.InstancedMesh(glowGeo, glowMat, count);
  glowMesh.renderOrder = 1;

  const discGeo = new THREE.CircleGeometry(baseR, 20);
  const discMat = new THREE.MeshBasicMaterial({ color, depthWrite: false, depthTest: false });
  const discMesh = new THREE.InstancedMesh(discGeo, discMat, count);
  discMesh.renderOrder = 2;

  const ringGeo = new THREE.RingGeometry(baseR * 1.35, baseR * 1.6, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
  ringMesh.renderOrder = 3;

  [shadowMesh, glowMesh, discMesh, ringMesh].forEach((m) => { m.count = count; });
  return { shadowMesh, glowMesh, discMesh, ringMesh, baseR, people: [], count };
}

export function createPersonnelLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  const mPerDegLon = mPerDegLatConst * Math.cos((anchor[1] * Math.PI) / 180);
  const unproject = ([x, z]) => [anchor[0] + x / mPerDegLon, anchor[1] + z / mPerDegLatConst];

  let scene, camera, renderer, mapRef;
  let visible = true;
  let people = [];
  let graph = null;
  let hoveredId = null;
  let selectedId = null;
  let breachId = null;
  let breachLocalPos = null;
  let telemetryAccum = 0;
  const buckets = {};
  const dummy = new THREE.Object3D();
  const raycaster = new THREE.Raycaster();
  const movementRng = mulberry32(20260717);
  // THREE.Timer, not the deprecated THREE.Clock — this one matters for
  // more than silencing the warning: Timer's Page Visibility API hookup
  // (connect(document)) zeroes the delta for the frame a backgrounded tab
  // resumes on and resets its internal clock, instead of Clock's
  // getDelta() reporting one huge multi-second (or, after a long
  // background stint, multi-minute) delta on that frame — which
  // stepWalkState/stepWanderState would otherwise read as "walk N
  // metres this frame," visible as personnel markers teleporting.
  const timer = new THREE.Timer();
  if (typeof document !== 'undefined') timer.connect(document);

  function advancePerson(p, deltaMs, now) {
    // While this person is puppeted for a fence-breach simulation (see
    // setBreachTarget/setBreachPosition below), their position is driven
    // externally by FenceLayer's real-fence-segment breach path instead of
    // their normal walk/idle state — the walk state itself is untouched,
    // so it resumes exactly where it left off once the breach ends.
    if (p.id === breachId && breachLocalPos) { p._pos = breachLocalPos; p._idle = false; return; }
    // Free-roam wandering (see MovementEngine.js's createWanderState/
    // stepWanderState) — a straight-line random-point-in-boundary walk,
    // not confined to the road-network graph's own edges. Additive: only
    // people explicitly given a p.wander state (Campus 2's personnel) use
    // this path; everyone else's p.walk/graph behaviour is unchanged.
    if (p.wander) {
      const { point, heading, idle } = stepWanderState(p.wander, deltaMs, p.speedMps, movementRng, p.wanderBoundary, now);
      p._pos = point;
      p._heading = heading;
      p._idle = idle;
      return;
    }
    if (p.status === 'inactive' || !p.walk) { p._pos = p.home; p._idle = true; return; }
    const { point, heading, idle } = stepWalkState(p.walk, graph, deltaMs, p.speedMps, movementRng, now);
    p._pos = point;
    p._heading = heading;
    p._idle = idle;
  }

  function writeBucketMatrices(bucket, deltaMs, now) {
    for (let i = 0; i < bucket.people.length; i++) {
      const p = bucket.people[i];
      advancePerson(p, deltaMs, now);
      const [x, z] = p._pos;
      const isBreaching = p.id === breachId;
      const isSelected = !isBreaching && p.id === selectedId;
      const isHovered = !isBreaching && !isSelected && p.id === hoveredId;
      const ratio = isBreaching ? SIZE_RATIO.breaching
        : isSelected ? SIZE_RATIO.selected
        : isHovered ? SIZE_RATIO.hovered
        : baseRatioForStatus(p.status);
      const scale = ratio / baseRatioForStatus(p.status);

      dummy.position.set(x, z, 0.02);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      bucket.shadowMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, z, 0.04);
      dummy.updateMatrix();
      bucket.glowMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, z, 0.06);
      dummy.updateMatrix();
      bucket.discMesh.setMatrixAt(i, dummy.matrix);

      // Faster, deeper pulse while breaching — reads as an urgent flash
      // rather than the normal gentle idle-marker breathing.
      const pulse = isBreaching
        ? 1 + Math.sin(now * 0.014) * 0.35
        : 1 + Math.sin(now * 0.004 + p.seed) * 0.12;
      dummy.position.set(x, z, 0.08);
      dummy.scale.setScalar(scale * pulse);
      dummy.updateMatrix();
      bucket.ringMesh.setMatrixAt(i, dummy.matrix);
    }
    bucket.shadowMesh.instanceMatrix.needsUpdate = true;
    bucket.glowMesh.instanceMatrix.needsUpdate = true;
    bucket.discMesh.instanceMatrix.needsUpdate = true;
    bucket.ringMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapRef = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setPersonnel(roster, walkGraph) {
      for (const b of Object.values(buckets)) {
        [b.shadowMesh, b.glowMesh, b.discMesh, b.ringMesh].forEach((m) => scene.remove(m));
      }
      Object.keys(buckets).forEach((k) => delete buckets[k]);

      people = roster || [];
      graph = walkGraph;

      const byStatus = {};
      for (const p of people) {
        p._pos = p._pos || p.home;
        (byStatus[p.status] ||= []).push(p);
      }

      for (const status of Object.keys(byStatus)) {
        const list = byStatus[status];
        const b = buildBucketMeshes(status, list.length, list[0].color);
        b.people = list;
        [b.shadowMesh, b.glowMesh, b.discMesh, b.ringMesh].forEach((m) => scene.add(m));
        buckets[status] = b;
      }
      writeAllMatrices(0, performance.now());
    },

    setVisible(v) { visible = v; },
    setHoveredId(personId) { hoveredId = personId; },
    setSelectedId(personId) { selectedId = personId; },

    // Fence-breach simulation puppeteering (see SecurityAlerts.jsx's
    // "Simulate breach" control / digitalTwin_2.jsx's handleSimulateBreach):
    // marks one person as the visible "intruder" and, each frame, overrides
    // their rendered position to FenceLayer's real-fence-segment breach
    // path instead of their own walk state — so the dot the operator sees
    // heading toward the fence line is an actual tracked person, not an
    // unrelated synthetic marker.
    setBreachTarget(personId) {
      breachId = personId || null;
      if (!breachId) breachLocalPos = null;
    },
    setBreachPosition(personId, lonLat) {
      if (personId !== breachId || !lonLat) return;
      breachLocalPos = projection.projectCoordinate(lonLat[0], lonLat[1]);
    },
    pickRandomActivePerson() {
      const actives = people.filter((p) => p.status !== 'inactive');
      if (!actives.length) return null;
      return actives[Math.floor(Math.random() * actives.length)];
    },

    getPersonWorldPos(personId) {
      const p = people.find((pp) => pp.id === personId);
      if (!p?._pos) return null;
      return { local: p._pos, lonLat: unproject(p._pos) };
    },

    // Live reference to the roster record (mutated in place every frame by
    // advancePerson/tickTelemetry) — callers that want fresh values on a
    // periodic re-render (hover tooltip, selection panel) re-call this
    // rather than caching the object from an earlier pickAt().
    getPerson(personId) {
      return people.find((pp) => pp.id === personId) ?? null;
    },

    // Raycast against each bucket's (larger, easier-to-hit) glow disc —
    // manual NDC->unproject, same camera-type-agnostic technique
    // BuildingLayer.pickAt uses (this camera's world->clip transform lives
    // entirely in projectionMatrix, so raycaster.setFromCamera won't work).
    pickAt(clientX, clientY) {
      if (!camera || !mapRef) return null;
      const rect = mapRef.getCanvas().getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
      const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
      raycaster.set(near, far.sub(near).normalize());
      const bucketList = Object.values(buckets);
      const hits = raycaster.intersectObjects(bucketList.map((b) => b.glowMesh), false);
      if (!hits.length) return null;
      const hit = hits[0];
      const bucket = bucketList.find((b) => b.glowMesh === hit.object);
      return bucket ? bucket.people[hit.instanceId] ?? null : null;
    },

    render(gl, options) {
      if (!visible || !renderer) return;
      const now = performance.now();
      timer.update(now);
      const deltaMs = timer.getDelta() * 1000;

      writeAllMatrices(deltaMs, now);

      telemetryAccum += deltaMs;
      if (telemetryAccum > 1000) {
        for (const p of people) tickTelemetry(p, now);
        telemetryAccum = 0;
      }

      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
      mapRef.triggerRepaint();
    },
  };

  function writeAllMatrices(deltaMs, now) {
    for (const status of Object.keys(buckets)) writeBucketMatrices(buckets[status], deltaMs, now);
  }
}
