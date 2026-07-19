import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import {
  orientedBoundingBox, offsetRing, ringStripMesh, instancedLampPosts,
  instancedPalmTrees, courtFenceMesh, paintLine, paintArc, makeConcreteTexture,
} from './siteFurniture';

// Campus 2's 2 real football grounds (campus2/football_ground_1|2.geojson
// — from zmu_campus_2_02.txt's plain outline polygons) — Phase 3A detail
// pass. Each ground's real footprint is used as-is for its outer boundary
// (the touchlines/goal lines); the halfway line, centre circle, penalty
// areas, six-yard boxes, corner arcs, goals and perimeter furniture are
// all generated proportionally within that real boundary (aligned to its
// own oriented bounding box), the same technique
// Campus2CourtsLayer.jsx uses, since the source only digitizes one
// polygon per pitch and its true regulation dimensions aren't
// independently verified.
//
// A Three.js "custom" MapLibre layer: {id, type:'custom',
// renderingMode:'3d', onAdd, setGrounds, setVisible, render}.

const TURF_GREEN = 0x2e7d32;
const LINE_COLOR = 0xffffff;
const LINE_W = 0.1;

function shapeFromRing(ring) {
  return new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
}

function stripedTurfTexture() {
  const w = 128, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2e7d32' : '#296e2c';
    ctx.fillRect(0, i * (h / 8), w, h / 8);
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    ctx.fillStyle = `rgba(20,60,20,${0.08 + Math.random() * 0.1})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function goalAssembly(pos, angle) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.3, roughness: 0.4 });
  const width = 7.32, height = 2.44, depth = 1.2;
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, height, 8);
  postGeo.translate(0, height / 2, 0);
  postGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, mat);
    post.position.set(pos[0] + Math.cos(angle + Math.PI / 2) * side * width / 2, pos[1] + Math.sin(angle + Math.PI / 2) * side * width / 2, 0);
    group.add(post);
  }
  const barGeo = new THREE.CylinderGeometry(0.05, 0.05, width, 8);
  barGeo.rotateZ(Math.PI / 2);
  barGeo.rotateY(angle);
  const bar = new THREE.Mesh(barGeo, mat);
  bar.position.set(pos[0], pos[1], height);
  group.add(bar);
  // simple net plane behind the goal
  const netMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
  const netGeo = new THREE.PlaneGeometry(width, height);
  netGeo.rotateX(Math.PI / 2);
  netGeo.translate(0, 0, height / 2);
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set(pos[0] - Math.cos(angle) * depth, pos[1] - Math.sin(angle) * depth, 0);
  net.rotation.z = angle;
  group.add(net);
  return group;
}

function cornerFlag(pos) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 });
  const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6);
  poleGeo.translate(0, 0.75, 0);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(pos[0], pos[1], 0);
  group.add(pole);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, side: THREE.DoubleSide });
  const flagGeo = new THREE.PlaneGeometry(0.3, 0.2);
  flagGeo.translate(0.15, -0.1, 0);
  flagGeo.rotateX(Math.PI / 2);
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(pos[0], pos[1], 1.4);
  group.add(flag);
  return group;
}

function buildPitch(ring) {
  const group = new THREE.Group();
  const obb = orientedBoundingBox(ring);
  const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
  const toWorld = (u, v) => [obb.center[0] + u * cos - v * sin, obb.center[1] + u * sin + v * cos];
  const hw = obb.halfW, hh = obb.halfH;

  // Turf — the real footprint, mowing-stripe textured.
  const turfTex = stripedTurfTexture();
  const turfMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.9 });
  const fillGeo = new THREE.ShapeGeometry(shapeFromRing(ring));
  const pos = fillGeo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const uCos = Math.cos(-obb.angle), uSin = Math.sin(-obb.angle);
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - obb.center[0], dy = pos.getY(i) - obb.center[1];
    uv[i * 2] = (dx * uCos - dy * uSin) / 6;
    uv[i * 2 + 1] = (dx * uSin + dy * uCos) / 6;
  }
  fillGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  fillGeo.translate(0, 0, 0.015);
  group.add(new THREE.Mesh(fillGeo, turfMat));

  // Touchlines/goal lines follow the real footprint itself.
  for (let i = 0; i < ring.length; i++) group.add(paintLine(ring[i], ring[(i + 1) % ring.length], LINE_W, LINE_COLOR, 0.03));

  // Halfway line + centre circle.
  group.add(paintLine(toWorld(-hw, 0), toWorld(hw, 0), LINE_W, LINE_COLOR, 0.03));
  group.add(paintArc(toWorld(0, 0), hh * 0.16, 0, Math.PI * 2, LINE_W, LINE_COLOR, 32, 0.03));

  // Penalty areas, six-yard boxes, penalty spots and arcs at both ends.
  for (const end of [-1, 1]) {
    const goalLine = end * hh;
    const penDepth = hh * 0.22, penHalfW = hw * 0.55;
    const boxDepth = hh * 0.08, boxHalfW = hw * 0.24;
    const penFront = goalLine - end * penDepth;
    const boxFront = goalLine - end * boxDepth;
    const pen = [toWorld(-penHalfW, goalLine), toWorld(penHalfW, goalLine), toWorld(penHalfW, penFront), toWorld(-penHalfW, penFront)];
    for (let i = 0; i < 3; i++) group.add(paintLine(pen[i + 1] ? pen[i] : pen[0], pen[(i + 1) % 4], LINE_W, LINE_COLOR, 0.03));
    group.add(paintLine(pen[1], pen[2], LINE_W, LINE_COLOR, 0.03));
    group.add(paintLine(pen[2], pen[3], LINE_W, LINE_COLOR, 0.03));
    group.add(paintLine(pen[3], pen[0], LINE_W, LINE_COLOR, 0.03));
    const box = [toWorld(-boxHalfW, goalLine), toWorld(boxHalfW, goalLine), toWorld(boxHalfW, boxFront), toWorld(-boxHalfW, boxFront)];
    group.add(paintLine(box[1], box[2], LINE_W, LINE_COLOR, 0.03));
    group.add(paintLine(box[2], box[3], LINE_W, LINE_COLOR, 0.03));
    group.add(paintLine(box[3], box[0], LINE_W, LINE_COLOR, 0.03));
    const spot = toWorld(0, goalLine - end * penDepth * 0.55);
    group.add(paintArc(spot, 0.1, 0, Math.PI * 2, LINE_W, LINE_COLOR, 10, 0.03));
    group.add(paintArc(toWorld(0, goalLine), penDepth * 0.55, end === 1 ? Math.PI * 0.62 : -Math.PI * 0.38, end === 1 ? Math.PI * 1.38 : Math.PI * 0.38, LINE_W, LINE_COLOR, 20, 0.03));
    group.add(goalAssembly(toWorld(0, goalLine), end === 1 ? Math.PI / 2 : -Math.PI / 2));
  }

  // Corner arcs + flags at all 4 corners.
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  for (const [cu, cv] of corners) {
    group.add(paintArc(toWorld(cu, cv), 1, 0, Math.PI * 2, LINE_W * 0.8, LINE_COLOR, 16, 0.03));
    group.add(cornerFlag(toWorld(cu, cv)));
  }

  // Fence, floodlights, concrete walking apron, trees.
  group.add(courtFenceMesh(ring, { height: 2.4, postSpacing: 4 }));
  const cornerWorld = corners.map(([u, v]) => toWorld(u, v));
  group.add(instancedLampPosts(cornerWorld, { height: 9 }));

  const apronOuter = offsetRing(ring, 2);
  const concreteTex = makeConcreteTexture();
  const apronMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
  const apronMesh = ringStripMesh(ring, apronOuter, 0.01, apronMat);
  const apos = apronMesh.geometry.attributes.position;
  const auv = new Float32Array(apos.count * 2);
  for (let i = 0; i < apos.count; i++) { auv[i * 2] = apos.getX(i) / 2; auv[i * 2 + 1] = apos.getY(i) / 2; }
  apronMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(auv, 2));
  group.add(apronMesh);

  const treeOuter = offsetRing(apronOuter, 1.6);
  group.add(instancedPalmTrees(treeOuter.filter((_, i) => i % 2 === 0)));

  return group;
}

export function createCampus2FootballLayer({ id, anchor }) {
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
      const sun = new THREE.DirectionalLight(0xffffff, 0.6);
      sun.position.set(40, 70, 100);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fcs` = array of football_ground_N.geojson FeatureCollections.
    setGrounds(fcs) {
      root.clear();
      for (const fc of fcs) {
        for (const f of fc?.features || []) {
          if (f.geometry?.type !== 'Polygon') continue;
          const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
          root.add(buildPitch(ring));
        }
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
