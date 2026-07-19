import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import {
  orientedBoundingBox, offsetRing, ringStripMesh, instancedPalmTrees,
  instancedLampPosts, courtFenceMesh, paintLine, paintArc, makeConcreteTexture,
} from './siteFurniture';

// Campus 2's real basketball court (campus2/basket_ball_court_2.geojson)
// and tennis court (campus2/tennis_court.geojson) — from
// zmu_campus_2_02.txt's plain outline polygons — Phase 3A rebuild. Each
// court's real footprint is used as-is for its outer boundary; the blue
// playing surface, FIBA/ITF-style markings, hoops/net, fencing, floodlight
// poles, benches and surrounding trees are all generated proportionally
// within that real boundary (aligned to its own oriented bounding box, not
// true-north) rather than assuming exact regulation metres, since the
// source only digitizes one polygon per court and its true dimensions
// aren't independently verified.
//
// The source only has ONE real basketball court ("basket ball court-2" —
// there is no "court-1" in the data) — rendered twice, offset a few metres
// apart along its own short axis, to give the requested "two courts side
// by side" without inventing a second court's location from nothing.
//
// A Three.js "custom" MapLibre layer: {id, type:'custom',
// renderingMode:'3d', onAdd, setCourts, setVisible, render}.

const COURT_BLUE = 0x1f6fb2;
const COURT_GREEN = 0x2f8f4a;
const TENNIS_BLUE = 0x2b6ca3;
const TENNIS_GREEN = 0x2f8f4a;
const LINE_COLOR = 0xffffff;
const LINE_W = 0.08;

function shapeFromRing(ring) {
  return new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
}

function flatMesh(ring, color, z = 0.02) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 });
  const geo = new THREE.ShapeGeometry(shapeFromRing(ring));
  geo.translate(0, 0, z);
  return new THREE.Mesh(geo, mat);
}

function hoopAssembly(basePos, facingAngle) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.6, roughness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.05, 8);
  poleGeo.translate(0, 1.525, 0);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(basePos[0], basePos[1], 0);
  group.add(pole);

  const armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
  armGeo.translate(0.6, 0, 0);
  armGeo.rotateX(Math.PI / 2);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(basePos[0], basePos[1], 3.05);
  arm.rotation.z = facingAngle;
  group.add(arm);

  const boardMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
  const boardGeo = new THREE.BoxGeometry(1.8, 1.05, 0.05);
  boardGeo.rotateX(Math.PI / 2);
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(basePos[0] + Math.cos(facingAngle) * 1.2, basePos[1] + Math.sin(facingAngle) * 1.2, 3.4);
  board.rotation.z = facingAngle + Math.PI / 2;
  group.add(board);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, metalness: 0.5, roughness: 0.4 });
  const rimGeo = new THREE.TorusGeometry(0.23, 0.02, 8, 16);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.set(basePos[0] + Math.cos(facingAngle) * 1.55, basePos[1] + Math.sin(facingAngle) * 1.55, 3.05);
  group.add(rim);

  return group;
}

function benchMesh(pos, angle) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.8 });
  const seatGeo = new THREE.BoxGeometry(1.6, 0.4, 0.06);
  seatGeo.rotateX(Math.PI / 2);
  seatGeo.translate(0, 0, 0.45);
  const seat = new THREE.Mesh(seatGeo, mat);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.5, roughness: 0.5 });
  for (const dx of [-0.65, 0.65]) {
    const legGeo = new THREE.BoxGeometry(0.06, 0.4, 0.45);
    legGeo.rotateX(Math.PI / 2);
    legGeo.translate(dx, 0, 0.22);
    group.add(new THREE.Mesh(legGeo, legMat));
  }
  group.add(seat);
  group.position.set(pos[0], pos[1], 0);
  group.rotation.z = angle;
  return group;
}

function buildBasketballCourt(ring, offsetU = 0) {
  const group = new THREE.Group();
  const obb = orientedBoundingBox(ring);
  const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
  const toWorld = (u, v) => [obb.center[0] + (u + offsetU) * cos - v * sin, obb.center[1] + (u + offsetU) * sin + v * cos];
  const hw = obb.halfW, hh = obb.halfH;

  const outerRing = [toWorld(-hw, -hh), toWorld(hw, -hh), toWorld(hw, hh), toWorld(-hw, hh)];
  const playRing = [toWorld(-hw * 0.92, -hh * 0.85), toWorld(hw * 0.92, -hh * 0.85), toWorld(hw * 0.92, hh * 0.85), toWorld(-hw * 0.92, hh * 0.85)];

  group.add(flatMesh(outerRing, COURT_GREEN, 0.02));
  group.add(flatMesh(playRing, COURT_BLUE, 0.03));

  // FIBA-proportional markings within the play rectangle.
  const pw = hw * 0.92, ph = hh * 0.85;
  const corners = [toWorld(-pw, -ph), toWorld(pw, -ph), toWorld(pw, ph), toWorld(-pw, ph)];
  for (let i = 0; i < 4; i++) group.add(paintLine(corners[i], corners[(i + 1) % 4], LINE_W, LINE_COLOR, 0.04));
  group.add(paintLine(toWorld(-pw, 0), toWorld(pw, 0), LINE_W, LINE_COLOR, 0.04));
  group.add(paintArc(toWorld(0, 0), ph * 0.28, 0, Math.PI * 2, LINE_W, LINE_COLOR, 32, 0.04));

  for (const end of [-1, 1]) {
    const baseline = end * ph;
    const keyHalfW = pw * 0.32;
    const keyDepth = ph * 0.62;
    const ftLine = baseline - end * keyDepth;
    const key = [toWorld(-keyHalfW, baseline), toWorld(keyHalfW, baseline), toWorld(keyHalfW, ftLine), toWorld(-keyHalfW, ftLine)];
    for (let i = 0; i < 4; i++) {
      if (i === (end === 1 ? 2 : 0)) continue; // leave the baseline-facing short edge open where the hoop sits
      group.add(paintLine(key[i], key[(i + 1) % 4], LINE_W, LINE_COLOR, 0.04));
    }
    group.add(paintArc(toWorld(0, ftLine), keyHalfW, 0, Math.PI, LINE_W, LINE_COLOR, 24, 0.04));
    group.add(paintArc(toWorld(0, baseline), pw * 0.88, end === 1 ? Math.PI : 0, end === 1 ? Math.PI * 2 : Math.PI, LINE_W, LINE_COLOR, 32, 0.04));
    const facing = end === 1 ? -Math.PI / 2 : Math.PI / 2;
    group.add(hoopAssembly(toWorld(0, baseline + end * 0.3), facing));
  }

  // fence, floodlights, trees, benches, concrete apron
  group.add(courtFenceMesh(outerRing, { height: 3.5, postSpacing: 3.5 }));
  const cornerLights = outerRing.map(([x, y]) => [x, y]);
  group.add(instancedLampPosts(cornerLights.map((p) => [p[0], p[1]]), { height: 7 }));

  const apronOuter = offsetRing(outerRing, 2.2);
  const concreteTex = makeConcreteTexture();
  const apronMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
  const apronMesh = ringStripMesh(outerRing, apronOuter, 0.015, apronMat);
  const pos = apronMesh.geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 2; uv[i * 2 + 1] = pos.getY(i) / 2; }
  apronMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  group.add(apronMesh);

  const treeOuter = offsetRing(apronOuter, 1.5);
  group.add(instancedPalmTrees(treeOuter.filter((_, i) => i % 2 === 0)));

  group.add(benchMesh(toWorld(0, hh + 3), obb.angle));

  return group;
}

function buildTennisCourt(ring) {
  const group = new THREE.Group();
  const obb = orientedBoundingBox(ring);
  const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
  const toWorld = (u, v) => [obb.center[0] + u * cos - v * sin, obb.center[1] + u * sin + v * cos];
  const hw = obb.halfW, hh = obb.halfH;

  const outerRing = [toWorld(-hw, -hh), toWorld(hw, -hh), toWorld(hw, hh), toWorld(-hw, hh)];
  const playRing = [toWorld(-hw * 0.9, -hh * 0.88), toWorld(hw * 0.9, -hh * 0.88), toWorld(hw * 0.9, hh * 0.88), toWorld(-hw * 0.9, hh * 0.88)];
  group.add(flatMesh(outerRing, TENNIS_GREEN, 0.02));
  group.add(flatMesh(playRing, TENNIS_BLUE, 0.03));

  const pw = hw * 0.9, ph = hh * 0.88;
  // doubles sidelines (outer), singles sidelines (92% width), baselines
  const doubles = [toWorld(-pw, -ph), toWorld(pw, -ph), toWorld(pw, ph), toWorld(-pw, ph)];
  for (let i = 0; i < 4; i++) group.add(paintLine(doubles[i], doubles[(i + 1) % 4], LINE_W, LINE_COLOR, 0.04));
  const singlesW = pw * 0.83;
  group.add(paintLine(toWorld(-singlesW, -ph), toWorld(-singlesW, ph), LINE_W, LINE_COLOR, 0.04));
  group.add(paintLine(toWorld(singlesW, -ph), toWorld(singlesW, ph), LINE_W, LINE_COLOR, 0.04));
  // service lines at ~57% of half-length from the net, centre service line
  const serviceZ = ph * 0.57;
  group.add(paintLine(toWorld(-singlesW, -serviceZ), toWorld(singlesW, -serviceZ), LINE_W, LINE_COLOR, 0.04));
  group.add(paintLine(toWorld(-singlesW, serviceZ), toWorld(singlesW, serviceZ), LINE_W, LINE_COLOR, 0.04));
  group.add(paintLine(toWorld(0, -serviceZ), toWorld(0, serviceZ), LINE_W, LINE_COLOR, 0.04));

  // net + posts at the centre line
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.5, roughness: 0.5 });
  const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.07, 8);
  postGeo.translate(0, 0.535, 0);
  postGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const p = toWorld(side * (pw + 0.9), 0);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(p[0], p[1], 0);
    group.add(post);
  }
  const netMat = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const netA = toWorld(-(pw + 0.9), 0), netB = toWorld(pw + 0.9, 0);
  const netLen = Math.hypot(netB[0] - netA[0], netB[1] - netA[1]);
  const netGeo = new THREE.PlaneGeometry(netLen, 0.9);
  netGeo.rotateX(Math.PI / 2);
  netGeo.translate(0, 0, 0.6);
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set((netA[0] + netB[0]) / 2, (netA[1] + netB[1]) / 2, 0);
  net.rotation.z = Math.atan2(netB[1] - netA[1], netB[0] - netA[0]);
  group.add(net);

  group.add(courtFenceMesh(outerRing, { height: 3.6, postSpacing: 3.5 }));
  group.add(instancedLampPosts(outerRing, { height: 7 }));

  const apronOuter = offsetRing(outerRing, 2);
  const concreteTex = makeConcreteTexture();
  const apronMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
  const apronMesh = ringStripMesh(outerRing, apronOuter, 0.015, apronMat);
  const pos = apronMesh.geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 2; uv[i * 2 + 1] = pos.getY(i) / 2; }
  apronMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  group.add(apronMesh);

  const treeOuter = offsetRing(apronOuter, 1.5);
  group.add(instancedPalmTrees(treeOuter.filter((_, i) => i % 2 === 0)));

  // player seating: a bench along the side
  group.add(benchMesh(toWorld(hw + 3, 0), obb.angle + Math.PI / 2));
  // umpire chair — a simple raised seat near the net
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.4, roughness: 0.5 });
  const chairLegGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6);
  chairLegGeo.translate(0, 0.8, 0);
  chairLegGeo.rotateX(Math.PI / 2);
  const chairSeatGeo = new THREE.BoxGeometry(0.6, 0.5, 0.06);
  chairSeatGeo.rotateX(Math.PI / 2);
  chairSeatGeo.translate(0, 0, 1.6);
  const chairPos = toWorld(pw + 1.6, 0.3);
  const chairLeg = new THREE.Mesh(chairLegGeo, chairMat);
  chairLeg.position.set(chairPos[0], chairPos[1], 0);
  const chairSeat = new THREE.Mesh(chairSeatGeo, chairMat);
  chairSeat.position.set(chairPos[0], chairPos[1], 0);
  group.add(chairLeg, chairSeat);

  return group;
}

export function createCampus2CourtsLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0xdfe8f0, 0.9));
      const sun = new THREE.DirectionalLight(0xffffff, 0.65);
      sun.position.set(40, 70, 100);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `basketballFc`/`tennisFc` = the real single-feature FeatureCollections.
    setCourts(basketballFc, tennisFc) {
      root.clear();
      const bFeature = basketballFc?.features?.[0];
      if (bFeature?.geometry?.type === 'Polygon') {
        const ring = bFeature.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        const obb = orientedBoundingBox(ring);
        const gap = obb.halfW * 0.08 + 4.5; // ~4-5m between the two courts
        root.add(buildBasketballCourt(ring, -gap));
        root.add(buildBasketballCourt(ring, gap));
      }
      const tFeature = tennisFc?.features?.[0];
      if (tFeature?.geometry?.type === 'Polygon') {
        const ring = tFeature.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        root.add(buildTennisCourt(ring));
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
