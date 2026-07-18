import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Renders the 2 real football-pitch footprints (zmu_sportsfields,
// kind='pitch' — see server/geo/import-zmu-real-structures.js) as full
// FIFA-style pitches: textured grass, painted markings, 3-D goals, and 4
// perimeter floodlight towers. The real footprints (~71x42m per half,
// from splitting the one real digitized boundary) are smaller than a
// regulation pitch (90-120m x 45-90m) — every marking below is laid out
// as a *proportion* of the real footprint's own length/width (using FIFA
// ratios), not literal regulation metres, since the real space is what
// it is. Nothing here repositions or invents pitch area — only how the
// existing real rectangle is decorated.
//
// A Three.js "custom" MapLibre layer, same shape as BuildingLayer/
// TreeLayer: {id, type:'custom', renderingMode:'3d', onAdd, setPitches,
// setVisible, render}.

const LINE_COLOR = 0xf4f8ff;

function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const stripes = 10;
  const stripeW = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2e7d3f' : '#357f44';
    ctx.fillRect(i * stripeW, 0, stripeW, size);
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeNetTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= size; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  for (let y = 0; y <= size; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Oriented (u,v) frame from a real 4-corner ring: u = the longer pair of
// sides (pitch length), v = the shorter pair (pitch width).
function localFrame(pts) {
  const [A, B, , D] = pts;
  const ab = [B[0] - A[0], B[1] - A[1]];
  const ad = [D[0] - A[0], D[1] - A[1]];
  const lenAB = Math.hypot(ab[0], ab[1]);
  const lenAD = Math.hypot(ad[0], ad[1]);
  if (lenAB >= lenAD) {
    return { origin: A, uAxis: [ab[0] / lenAB, ab[1] / lenAB], uLen: lenAB, vAxis: [ad[0] / lenAD, ad[1] / lenAD], vLen: lenAD };
  }
  return { origin: A, uAxis: [ad[0] / lenAD, ad[1] / lenAD], uLen: lenAD, vAxis: [ab[0] / lenAB, ab[1] / lenAB], vLen: lenAB };
}
function toWorld(frame, u, v) {
  return [frame.origin[0] + frame.uAxis[0] * u + frame.vAxis[0] * v, frame.origin[1] + frame.uAxis[1] * u + frame.vAxis[1] * v];
}

// Accumulates every marking (straight strips, discs, rings) into ONE
// merged BufferGeometry per pitch — keeps the whole marking set to a
// single draw call instead of dozens of tiny meshes.
// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx).
function createMarkingAccumulator() {
  const positions = [];
  const indices = [];
  let vc = 0;
  return {
    addStrip(p1, p2, width, z) {
      const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
      const len = Math.hypot(dx, dz) || 1e-6;
      const nx = (-dz / len) * (width / 2), nz = (dx / len) * (width / 2);
      positions.push(
        p1[0] - nx, p1[1] - nz, z, p1[0] + nx, p1[1] + nz, z,
        p2[0] + nx, p2[1] + nz, z, p2[0] - nx, p2[1] - nz, z
      );
      indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
      vc += 4;
    },
    build() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    },
  };
}

function addCornerArc(acc, frame, u0, v0, radius, uDir, vDir, lineW, y) {
  const corner = toWorld(frame, u0, v0);
  const pA = toWorld(frame, u0 + uDir * radius, v0);
  const pB = toWorld(frame, u0, v0 + vDir * radius);
  const dirA = [pA[0] - corner[0], pA[1] - corner[1]];
  const dirB = [pB[0] - corner[0], pB[1] - corner[1]];
  const angA = Math.atan2(dirA[1], dirA[0]);
  let angB = Math.atan2(dirB[1], dirB[0]);
  let delta = angB - angA;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const N = 8;
  let prev = pA;
  for (let i = 1; i <= N; i++) {
    const ang = angA + delta * (i / N);
    const pt = [corner[0] + Math.cos(ang) * radius, corner[1] + Math.sin(ang) * radius];
    acc.addStrip(prev, pt, lineW, y);
    prev = pt;
  }
}

// Round markings (center circle, center/penalty spots) are separate
// meshes using THREE's own built-in CircleGeometry/RingGeometry, NOT
// merged into the line-strip accumulator's shared indexed buffer — kept
// as separate draw calls rather than mixed into a hand-rolled indexed
// buffer alongside quad strips. CircleGeometry/RingGeometry already lie
// flat in the XY ground plane by default under this module's real
// ground-plane convention (X=east, Y=north, Z=up) — no rotation needed.
function flatDisc(cx, cy, radius, z, material, segments = 20) {
  const geo = new THREE.CircleGeometry(radius, segments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, cy, z);
  return mesh;
}
function flatRing(cx, cy, rIn, rOut, z, material, segments = 48) {
  const geo = new THREE.RingGeometry(rIn, rOut, segments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, cy, z);
  return mesh;
}

function buildMarkings(frame, lineMat) {
  const acc = createMarkingAccumulator();
  const group = new THREE.Group();
  const { uLen, vLen } = frame;
  const LW = 0.12, Y = 0.03;
  const P = (u, v) => toWorld(frame, u, v);
  const seg = (u1, v1, u2, v2) => acc.addStrip(P(u1, v1), P(u2, v2), LW, Y);

  seg(0, 0, uLen, 0);
  seg(0, vLen, uLen, vLen);
  seg(0, 0, 0, vLen);
  seg(uLen, 0, uLen, vLen);
  seg(uLen / 2, 0, uLen / 2, vLen);

  const centerRadius = vLen * 0.135;
  const cc = P(uLen / 2, vLen / 2);
  group.add(flatRing(cc[0], cc[1], Math.max(centerRadius - LW / 2, 0.05), centerRadius + LW / 2, Y, lineMat));
  group.add(flatDisc(cc[0], cc[1], 0.2, Y, lineMat));

  const pbW = vLen * 0.593, pbD = uLen * 0.157;
  const gaW = vLen * 0.269, gaD = uLen * 0.0524;
  const spotDist = uLen * 0.105;
  const cornerR = Math.min(vLen, uLen) * 0.045;
  const vMid = vLen / 2;

  for (const end of [0, 1]) {
    const u0 = end === 0 ? 0 : uLen;
    const dir = end === 0 ? 1 : -1;
    seg(u0, vMid - pbW / 2, u0 + dir * pbD, vMid - pbW / 2);
    seg(u0, vMid + pbW / 2, u0 + dir * pbD, vMid + pbW / 2);
    seg(u0 + dir * pbD, vMid - pbW / 2, u0 + dir * pbD, vMid + pbW / 2);
    seg(u0, vMid - gaW / 2, u0 + dir * gaD, vMid - gaW / 2);
    seg(u0, vMid + gaW / 2, u0 + dir * gaD, vMid + gaW / 2);
    seg(u0 + dir * gaD, vMid - gaW / 2, u0 + dir * gaD, vMid + gaW / 2);
    const spot = P(u0 + dir * spotDist, vMid);
    group.add(flatDisc(spot[0], spot[1], 0.16, Y, lineMat));
    addCornerArc(acc, frame, u0, 0, cornerR, dir, 1, LW, Y);
    addCornerArc(acc, frame, u0, vLen, cornerR, dir, -1, LW, Y);
  }
  group.add(new THREE.Mesh(acc.build(), lineMat));
  return group;
}

function buildGoal(frame, end, netTexture) {
  const group = new THREE.Group();
  const u0 = end === 0 ? 0 : frame.uLen;
  const dir = end === 0 ? -1 : 1; // goal sits just behind the goal line
  const vMid = frame.vLen / 2;
  const goalWidth = Math.min(frame.vLen * 0.108, 7.5);
  const goalHeight = 2.3;
  const goalDepth = 1.3;
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, metalness: 0.25, roughness: 0.4 });
  const netMat = new THREE.MeshStandardMaterial({ map: netTexture, color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });

  const leftPost = toWorld(frame, u0 + dir * 0.05, vMid - goalWidth / 2);
  const rightPost = toWorld(frame, u0 + dir * 0.05, vMid + goalWidth / 2);
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, goalHeight, 8);
  postGeo.rotateX(Math.PI / 2); // stand upright: local-Y becomes world-Z
  for (const p of [leftPost, rightPost]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(p[0], p[1], goalHeight / 2);
    group.add(post);
  }
  const barLen = Math.hypot(rightPost[0] - leftPost[0], rightPost[1] - leftPost[1]);
  // crossbar lies flat (no bake) — a pure yaw aligns its default local-Y
  // (length) axis with the post-to-post ground direction.
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, barLen, 8), postMat);
  bar.position.set((leftPost[0] + rightPost[0]) / 2, (leftPost[1] + rightPost[1]) / 2, goalHeight);
  bar.rotation.z = Math.atan2(-(rightPost[0] - leftPost[0]), rightPost[1] - leftPost[1]);
  group.add(bar);

  const backLeft = toWorld(frame, u0 + dir * (0.05 + goalDepth), vMid - goalWidth / 2);
  const backRight = toWorld(frame, u0 + dir * (0.05 + goalDepth), vMid + goalWidth / 2);
  const netQuad = (p1, p2) => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([p1[0], p1[1], 0, p2[0], p2[1], 0, p2[0], p2[1], goalHeight, p1[0], p1[1], goalHeight]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, netMat);
  };
  group.add(netQuad(backLeft, backRight));
  group.add(netQuad(leftPost, backLeft));
  group.add(netQuad(rightPost, backRight));
  return group;
}

function buildFloodlight(x, y) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8f97a3, metalness: 0.5, roughness: 0.45 });
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 9, 8);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, y, 4.5);
  group.add(pole);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.3, roughness: 0.5, emissive: 0xfff2c2, emissiveIntensity: 0.5 });
  for (let i = 0; i < 4; i++) {
    const headGeo = new THREE.BoxGeometry(0.7, 0.35, 0.12);
    headGeo.rotateX(Math.PI / 2);
    const head = new THREE.Mesh(headGeo, headMat);
    const a = (i / 4) * Math.PI * 2;
    head.position.set(x + Math.cos(a) * 0.35, y + Math.sin(a) * 0.35, 8.9);
    head.rotation.z = -a;
    head.rotation.x = -0.35; // decorative downward tilt toward the pitch
    group.add(head);
  }
  const light = new THREE.PointLight(0xfff2c2, 6, 55, 2);
  light.position.set(x, y, 8.7);
  group.add(light);
  return group;
}

// Recovers the 4 outer corners of the ORIGINAL combined football-ground
// boundary from 2 split-pitch rings (see import-zmu-real-structures.js's
// splitQuadInHalf): points shared by both rings are the internal split
// midpoints, points appearing in only one ring are the real outer corners.
function combinedCorners(pitchFeatures) {
  const counts = new Map();
  const byKey = new Map();
  for (const f of pitchFeatures) {
    const ring = f.geometry.coordinates[0].slice(0, -1);
    for (const p of ring) {
      const key = p.map((n) => n.toFixed(6)).join(',');
      counts.set(key, (counts.get(key) || 0) + 1);
      byKey.set(key, p);
    }
  }
  const corners = [...counts.entries()].filter(([, c]) => c === 1).map(([k]) => byKey.get(k));
  return corners.length >= 3 ? corners : [...byKey.values()];
}

export function createFootballGroundLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0xbfd8e8, 1.0));
      const sun = new THREE.DirectionalLight(0xffffff, 0.6);
      sun.position.set(40, 80, 60);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setPitches(fc) {
      root.clear();
      const pitchFeatures = (fc?.features || []).filter((f) => f.properties?.leisure === 'pitch');
      if (!pitchFeatures.length) return;

      const grassTex = makeGrassTexture();
      const netTex = makeNetTexture();
      const lineMat = new THREE.MeshStandardMaterial({ color: LINE_COLOR, emissive: LINE_COLOR, emissiveIntensity: 0.45, side: THREE.DoubleSide });

      for (const f of pitchFeatures) {
        const ring = f.geometry.coordinates[0];
        const localPts = ring.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        const frame = localFrame(localPts);

        // Shape's local (x,y) already IS this module's ground plane
        // (X=east, Y=north) — ShapeGeometry lies flat with no rotation
        // needed, same as BuildingLayer.jsx's ExtrudeGeometry.
        const shape = new THREE.Shape(localPts.map(([x, y]) => new THREE.Vector2(x, y)));
        const grassGeo = new THREE.ShapeGeometry(shape);
        const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.85 });
        grassTex.repeat.set(frame.uLen / 8, frame.vLen / 8);
        const grass = new THREE.Mesh(grassGeo, grassMat);
        grass.position.z = 0.01;
        root.add(grass);

        root.add(buildMarkings(frame, lineMat));
        root.add(buildGoal(frame, 0, netTex));
        root.add(buildGoal(frame, 1, netTex));
      }

      const corners = combinedCorners(pitchFeatures);
      for (const c of corners) {
        const [x, z] = projection.projectCoordinate(c[0], c[1]);
        root.add(buildFloodlight(x, z));
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
