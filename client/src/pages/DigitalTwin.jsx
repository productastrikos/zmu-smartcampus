import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useApi } from '../services/api';
import { Panel, StatusChip, Loading, PageHeader, DataTable } from '../components/ui';
import BuildingTwin3D from '../components/BuildingTwin3D';

/* Every campus zone opens the same rich 3-D building twin, fed with that
   building's live ZMU telemetry, assets and security data. */

/* ── metric config for the live map colouring ──────────────── */
const METRICS = [
  { key: 'occupancy', label: 'Occupancy', unit: '%', get: (l) => l?.occupancy_pct, scale: [0, 100], low: '#123a5f', high: '#3b7de8' },
  { key: 'temp', label: 'Temperature', unit: '°C', get: (l) => l?.temp_c, scale: [21, 26], low: '#1d4ed8', high: '#ef4444' },
  { key: 'co2', label: 'Air quality', unit: 'ppm', get: (l) => l?.co2_ppm, scale: [400, 1200], low: '#15803d', high: '#f59e0b' },
  { key: 'energy', label: 'Energy', unit: 'kWh', get: (l) => l?.kwh, scale: [0, 260], low: '#134e4a', high: '#22d3ee' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t, 0, 1)));
const mul = (a, f) => a.map((v) => Math.round(clamp(v * f, 0, 255)));
const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;

/* ── landscaping: static decorative elements (exact SVG-space positions,
   nudged just clear of the road bands / building footprints they'd otherwise
   sit on top of — same intent as the original layout, just off the asphalt) ── */
const TREES = [
  [255, 40], [255, 120], [255, 300], [480, 40], [480, 300], [548, 475],
  [266, 470], [266, 560], [700, 300], [690, 500], [730, 500], [770, 500],
  [40, 40], [40, 310], [40, 620], [960, 310], [820, 300],
];

/* ══════════════════════════════════════════════════════════════════════════
   3-D SITE MODEL — real Three.js digital twin, built directly from the SVG
   campus blueprint. Every SVG (x,y) becomes a 3-D (X,Z) world coordinate —
   nothing is redesigned, moved, resized or invented; only extruded.
   ══════════════════════════════════════════════════════════════════════════ */

/* SVG canvas was viewBox="0 0 1010 660" — recenter it as the 3-D world origin */
const SITE_W = 1010, SITE_H = 660;
const OX = SITE_W / 2, OZ = SITE_H / 2;
const toX = (svgX) => svgX - OX;
const toZ = (svgY) => svgY - OZ;
const FLOOR_H = 4.4; // metres per storey

/* ── deterministic PRNG so per-building detail is stable across renders ── */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── canvas → texture helpers (procedural, no external assets/network) ── */
function makeCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}
function rRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function makeAsphaltTexture() {
  const tex = makeCanvas(160, 160, (ctx, w, h) => {
    ctx.fillStyle = '#23272d'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const v = 16 + Math.random() * 26;
      ctx.fillStyle = `rgba(${v + 24},${v + 26},${v + 30},${0.12 + Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeGrassTexture() {
  const tex = makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1c3a28'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const g = 90 + Math.random() * 70;
      ctx.strokeStyle = `rgba(${g * 0.3},${g},${g * 0.45},${0.2 + Math.random() * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 2, y - 3 - Math.random() * 4); ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeConcreteTexture() {
  const tex = makeCanvas(96, 96, (ctx, w, h) => {
    ctx.fillStyle = '#8b93a0'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(50,58,70,0.5)'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let i = 0; i < 500; i++) {
      const v = 120 + Math.random() * 40;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},0.18)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeParkingSurfaceTexture() {
  const tex = makeCanvas(160, 160, (ctx, w, h) => {
    ctx.fillStyle = '#282c33'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 20 + Math.random() * 24;
      ctx.fillStyle = `rgba(${v + 24},${v + 26},${v + 30},${0.12 + Math.random() * 0.25})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeChainLinkTexture() {
  const tex = makeCanvas(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(170,185,200,0.55)'; ctx.lineWidth = 1.1;
    for (let x = -h; x < w + h; x += 10) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeRippleTexture() {
  const tex = makeCanvas(128, 128, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#164a72'); grd.addColorStop(1, '#1e6a97');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 10; i++) {
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      const y = Math.random() * h;
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.15 + i) * 3);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* per-building facade — window grid baked into a diffuse map + a matching
   emissive map (lit windows only) so glazing glows softly at dusk */
function makeFacadeTextures(cols, rows, wall, glass, lit, seed) {
  const rand = mulberry32(seed);
  const cw = 22, ch = 30;
  const w = Math.max(1, cols) * cw, h = Math.max(1, rows) * ch;
  const flags = [];
  for (let i = 0; i < rows * cols; i++) flags.push(rand() < 0.26);
  const map = makeCanvas(w, h, (ctx) => {
    ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      ctx.fillStyle = flags[i] ? lit : glass;
      ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, 1.4);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  });
  const emissive = makeCanvas(w, h, (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      if (flags[i]) { ctx.fillStyle = lit; ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8); }
    }
  });
  return { map, emissive };
}

/* facade palette per building type — disciplined military-installation tones
   (concrete / desert beige / olive, cool security-white window glow) —
   structural variety only, footprints untouched */
const TYPE_STYLE = {
  admin:         { wall: '#9a9488', glass: '#4a5850', lit: '#dbe6ee' }, // HQ / command
  academic:      { wall: '#a89f8e', glass: '#4a5850', lit: '#dbe6ee' }, // training facility
  library:       { wall: '#8f9488', glass: '#3f4c46', lit: '#dbe6ee' }, // comms / ops centre
  labs:          { wall: '#7d8577', glass: '#3d4a42', lit: '#cfe4da' }, // equipment maintenance
  accommodation: { wall: '#8a8570', glass: '#4a5850', lit: '#e6ddc4' }, // barracks — desert beige
  sports:        { wall: '#948e7d', glass: '#4a5850', lit: '#dbe6ee' }, // indoor training hangar
  armoury:       { wall: '#6b7268', glass: '#333d36', lit: '#cdd8cd' }, // armoury — olive drab, few windows
  dining:        { wall: '#93917f', glass: '#4a5850', lit: '#e6ddc4' }, // dining facility
  assembly:      { wall: '#8f9488', glass: '#4a5850', lit: '#dbe6ee' }, // operations centre
  plant:         { wall: '#6b7268', glass: '#333d36', lit: '#cdd8cd' }, // logistics / central plant
};
const DEFAULT_STYLE = { wall: '#8f8a7a', glass: '#4a5850', lit: '#dbe6ee' };

/* ── ZMU facility identity per building — display-only override (the
   underlying data's own name/type is untouched; this just relabels what the
   twin shows for tooltips and the zone table, per building_id) ──────── */
const ZMU_FACILITY = {
  Z01: { name: 'University Administration & Command HQ', tag: 'Admissions · Faculty Offices · Command Centre' },
  Z02: { name: 'Academic Block A', tag: 'Computer Engineering · Cyber Defence · AI Lab' },
  Z03: { name: 'Academic Block B', tag: 'Geography & GIS · Mapping · Drone Simulation' },
  Z04: { name: 'Academic Block C', tag: 'Military Science · Leadership · Strategy Seminars' },
  Z05: { name: 'Central Military Library', tag: 'Digital Library · Archives · Study Pods' },
  Z06: { name: 'Cadet Residences — North', tag: 'Cadet Accommodation' },
  Z07: { name: 'Cadet Residences — South', tag: 'Cadet Accommodation' },
  Z08: { name: 'Military Physical Training Complex', tag: 'Fitness · Tactical Training · Recovery Rooms' },
  Z09: { name: 'Armoury & Equipment Store', tag: 'Weapons Storage · Equipment Issue' },
  Z10: { name: "Candidates' Club — Dining Hall", tag: 'Dining · Lounge · Recreation' },
  Z11: { name: 'Military Parade & Assembly Hall', tag: 'Ceremonies · Commissioning · Assemblies' },
  Z12: { name: 'Central Utilities & Data Centre', tag: 'Power · Water · Campus IT' },
};
const zmuFacility = (b) => ZMU_FACILITY[b.building_id] || { name: b.name, tag: '' };

/* ── little procedural props: trees, cars, people, lamps ─────────────── */
function buildTree(seed) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const trunkH = 3.2 + rand() * 2.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.36, trunkH, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 }),
  );
  trunk.position.y = trunkH / 2; trunk.castShadow = true;
  g.add(trunk);
  const foliage = new THREE.Group();
  const hue = 0.32 + rand() * 0.06;
  const nClusters = 2 + Math.round(rand());
  for (let i = 0; i < nClusters; i++) {
    const r = 2.0 + rand() * 1.7;
    const c = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.45, 0.28 + rand() * 0.12), roughness: 0.95, flatShading: true }),
    );
    c.position.set((rand() - 0.5) * 2, trunkH + r * 0.6 + i * 0.8, (rand() - 0.5) * 2);
    c.castShadow = true;
    foliage.add(c);
  }
  g.add(foliage);
  g.userData.foliage = foliage;
  g.userData.swaySeed = rand() * Math.PI * 2;
  return g;
}

function buildCar(color, seed) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.5, 4.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 }),
  );
  body.position.y = 0.42; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.42, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.2, metalness: 0.3 }),
  );
  cabin.position.set(0, 0.86, -0.15 + (rand() - 0.5) * 0.2); cabin.castShadow = true; g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.8 });
  [[0.85, -1.35], [-0.85, -1.35], [0.85, 1.35], [-0.85, 1.35]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.32, z); g.add(wheel);
  });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  [[0.6, 2.05], [-0.6, 2.05]].forEach(([x, z]) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.05), lightMat);
    hl.position.set(x, 0.5, z); g.add(hl);
  });
  return g;
}

const SKIN_TONES = [0xe8b48c, 0xc98a5f, 0x8d5a3a, 0xf0c9a0, 0x6b4530];
const OUTFIT_COLORS = [0x4a5230, 0x8a7a5a, 0x2b3a52, 0x3a3f3a, 0xa89268, 0x2f2f36, 0xc8ccc0];
function buildPerson(seed) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)], roughness: 0.8 });
  const outfit = new THREE.MeshStandardMaterial({ color: OUTFIT_COLORS[Math.floor(rand() * OUTFIT_COLORS.length)], roughness: 0.85 });
  const scale = 0.92 + rand() * 0.22;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19 * scale, 0.5 * scale, 3, 6), outfit);
  torso.position.y = 1.0 * scale; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 8, 8), skin);
  head.position.y = 1.45 * scale; head.castShadow = true; g.add(head);

  const legGeo = new THREE.CapsuleGeometry(0.075 * scale, 0.5 * scale, 2, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.9 });
  const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.11 * scale, 0.45 * scale, 0);
  const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.11 * scale, 0.45 * scale, 0);
  g.add(legL, legR);

  const armGeo = new THREE.CapsuleGeometry(0.06 * scale, 0.42 * scale, 2, 5);
  const armL = new THREE.Mesh(armGeo, outfit); armL.position.set(-0.28 * scale, 1.0 * scale, 0);
  const armR = new THREE.Mesh(armGeo, outfit); armR.position.set(0.28 * scale, 1.0 * scale, 0);
  g.add(armL, armR);

  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  g.userData.walkSeed = rand() * Math.PI * 2;
  g.userData.walkFreq = 5.2 + rand() * 1.4;
  return g;
}

function buildLamp() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), poleMat);
  pole.position.y = 2.1; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), poleMat);
  arm.position.set(0.3, 4.15, 0); g.add(arm);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8f0f4, emissive: 0xd8e8f0, emissiveIntensity: 1.4 }),
  );
  bulb.position.set(0.58, 4.05, 0); g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}

function buildFlagpole(poleH, flagW, flagH, color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, poleH, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.4, metalness: 0.55 }));
  pole.position.y = poleH / 2; pole.castShadow = true; g.add(pole);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8b878, roughness: 0.3, metalness: 0.7 }));
  ball.position.y = poleH; g.add(ball);
  const flagGeo = new THREE.PlaneGeometry(flagW, flagH, 10, 4);
  flagGeo.translate(flagW / 2, 0, 0);
  flagGeo.userData.base = flagGeo.attributes.position.array.slice();
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide }));
  flag.position.set(0.1, poleH - flagH / 2 - 0.35, 0);
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

function buildWatchtower() {
  const g = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x454d40, roughness: 0.55, metalness: 0.4 });
  const legH = 5.5;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, legH, 6), legMat);
    leg.position.set(dx * 1.3, legH / 2, dz * 1.3); leg.castShadow = true; g.add(leg);
  });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x5a6252, roughness: 0.5, metalness: 0.2 }));
  cabin.position.y = legH + 1.1; cabin.castShadow = true; g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.6, 3.05),
    new THREE.MeshStandardMaterial({ color: 0x2c3a44, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 }));
  glass.position.y = legH + 1.6; g.add(glass);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.6 }));
  roof.position.y = legH + 2.75; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xff5566, emissive: 0xff3344, emissiveIntensity: 1.1 }));
  beacon.position.y = legH + 3.4; g.add(beacon);
  return g;
}

/* static CCTV prop — pole + a rotatable head (camera housing + a translucent
   field-of-view cone) that slowly pans in the render loop. Visual only:
   no real tracking/AI detection, just signals "this area is monitored". */
function buildCCTV(poleH = 3.2) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.5, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, poleH, 6), poleMat);
  pole.position.y = poleH / 2; pole.castShadow = true; g.add(pole);

  const head = new THREE.Group();
  head.position.y = poleH;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.05), poleMat);
  arm.position.set(0.22, 0, 0); head.add(arm);
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10),
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.3, metalness: 0.6 }));
  cam.rotation.z = Math.PI / 2; cam.position.set(0.5, -0.02, 0); head.add(cam);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10),
    new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x0a2a30, roughness: 0.1, metalness: 0.4 }));
  lens.rotation.y = -Math.PI / 2; lens.position.set(0.66, -0.02, 0); head.add(lens);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  cone.rotation.z = -Math.PI / 2.35; cone.position.set(1.7, -1.1, 0); head.add(cone);
  g.add(head);
  g.userData.head = head;
  g.userData.panSeed = Math.random() * Math.PI * 2;
  return g;
}

/* small IoT prop — weather station (spinning cups) or an air-quality sensor
   box, both with a blinking status LED. Visual only, no live sensor feed. */
function buildIoTSensor(kind) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x454d40, roughness: 0.5, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.2, 6), poleMat);
  pole.position.y = 1.1; pole.castShadow = true; g.add(pole);
  if (kind === 'weather') {
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), poleMat); arm1.position.y = 2.3; g.add(arm1);
    const arm2 = arm1.clone(); arm2.rotation.y = Math.PI / 2; g.add(arm2);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.4 }));
    cup.position.y = 2.3; g.add(cup);
    g.userData.spin = arm1;
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.4 }));
    box.position.y = 2.2; g.add(box);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x3ddc84, emissiveIntensity: 1.2 }));
  led.position.set(0.08, 1.9, 0); g.add(led);
  g.userData.led = led;
  g.userData.blinkSeed = Math.random() * Math.PI * 2;
  return g;
}

/* roadside sign — pole + a baked-text board, e.g. speed limit / checkpoint */
function buildRoadSign(lines, accent) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a8f78, roughness: 0.5, metalness: 0.4 }));
  pole.position.y = 1.2; pole.castShadow = true; g.add(pole);
  const boardTex = makeCanvas(220, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 9; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#22261e'; ctx.font = 'bold 30px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (n - 1) / 2) * 34));
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6, side: THREE.DoubleSide }));
  board.position.set(0, 2.15, 0);
  g.add(board);
  return g;
}

/* ── flat ground-plane shape helpers (world-space, then laid flat) ──── */
function rectShape(x, z, w, h) {
  const s = new THREE.Shape();
  s.moveTo(x, z); s.lineTo(x + w, z); s.lineTo(x + w, z + h); s.lineTo(x, z + h); s.closePath();
  return s;
}
function roundedRectShape(x, z, w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(x + r, z);
  s.lineTo(x + w - r, z); s.quadraticCurveTo(x + w, z, x + w, z + r);
  s.lineTo(x + w, z + h - r); s.quadraticCurveTo(x + w, z + h, x + w - r, z + h);
  s.lineTo(x + r, z + h); s.quadraticCurveTo(x, z + h, x, z + h - r);
  s.lineTo(x, z + r); s.quadraticCurveTo(x, z, x + r, z);
  return s;
}
function circleShape(cx, cz, r) {
  const s = new THREE.Shape();
  s.absarc(cx, cz, r, 0, Math.PI * 2, false);
  return s;
}
function flatMesh(shape, material, y) {
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 4), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

/* ── sprite (billboard) helper for in-world labels / tooltips / markers ── */
function spawnSprite(draw, w, h, scaleX, scaleY) {
  const tex = makeCanvas(w, h, draw);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scaleX, scaleY, 1);
  sp.renderOrder = 999;
  return sp;
}

/* ── time-of-day lighting presets ─────────────────────────────────── */
const LIGHT_PRESETS = {
  day:   { sky: ['#8fc4ea', '#bfe0ee', '#e8f4f6'], fog: 0x9fc2d8, ambient: [0xdcecf6, 0.75], hemi: [0xaed6ee, 0x3d5a3a, 0.85], sun: [0xfff3dc, 2.15], exposure: 1.28, lampBoost: 0.15 },
  dusk:  { sky: ['#0c1220', '#1b2c42', '#3a4a52'], fog: 0x172436, ambient: [0x9fb6d8, 0.55], hemi: [0x6a86b0, 0x1c3324, 0.7], sun: [0xffe0b0, 1.65], exposure: 1.2, lampBoost: 1 },
  night: { sky: ['#03050a', '#070c16', '#0b1420'], fog: 0x05070d, ambient: [0x33507a, 0.26], hemi: [0x223250, 0x0b1712, 0.3], sun: [0x8fa4d0, 0.18], exposure: 1.02, lampBoost: 1.6 },
};

/* ── synthetic Garmin-style profile for a pedestrian (demo data only —
   consistent with this app's existing "SYNTHETIC DATA" banner) ─────── */
const FIRST_NAMES = ['Rashid', 'Omar', 'Khalid', 'Youssef', 'Hamdan', 'Sultan', 'Saeed', 'Marwan', 'Fatima', 'Aisha', 'Maryam', 'Noura', 'Salim', 'Zayed'];
const LAST_NAMES = ['Al Nuaimi', 'Al Falasi', 'Al Mazrouei', 'Al Suwaidi', 'Al Kaabi', 'Al Shamsi', 'Al Dhaheri', 'Al Marri'];
const ROLES = [
  { role: 'Cadet', dept: 'Academics' }, { role: 'Officer', dept: 'Command' }, { role: 'Security Guard', dept: 'Security Operations' },
  { role: 'Medical Staff', dept: 'Medical Centre' }, { role: 'Maintenance Engineer', dept: 'Facilities' }, { role: 'Administrative Staff', dept: 'Admin' },
];
function makePersonProfile(seed, id) {
  const rand = mulberry32(seed);
  const roleInfo = ROLES[Math.floor(rand() * ROLES.length)];
  return {
    id,
    name: `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`,
    employeeId: `ZMU-${1000 + Math.floor(rand() * 8999)}`,
    role: roleInfo.role,
    dept: roleInfo.dept,
    shift: rand() < 0.5 ? 'Day (06:00–18:00)' : 'Night (18:00–06:00)',
    baseHr: 62 + Math.floor(rand() * 18),
    baseSpo2: 96 + Math.floor(rand() * 4),
    baseTemp: 36.3 + rand() * 0.6,
    battery: 40 + Math.floor(rand() * 60),
  };
}

/* derives a "live" telemetry snapshot for the health dashboard — synthetic,
   jittered off the person's stable base profile + their current 3-D position */
function derivePersonLive(profile, personObj) {
  const jitter = Math.random() - 0.5;
  const hr = Math.max(48, Math.round(profile.baseHr + jitter * 10 + Math.random() * 4));
  const spo2 = Math.max(93, Math.min(100, Math.round(profile.baseSpo2 + jitter * 2)));
  const temp = profile.baseTemp + jitter * 0.2;
  const stress = hr > profile.baseHr + 14 ? 'Elevated' : hr > profile.baseHr + 5 ? 'Moderate' : 'Low';
  const steps = 3200 + Math.floor(Math.random() * 6400);
  // no real georeference exists for this demo site — offset a plausible base
  // coordinate by world position so it reads as live GPS, clearly synthetic
  const lat = 24.4539 + personObj.position.z / 90000;
  const lon = 54.3773 + personObj.position.x / 90000;
  return {
    ...profile, hr, spo2, temp, stress, steps, lat, lon,
    battery: Math.max(4, profile.battery - Math.round(Math.random())),
  };
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ color: '#6a8aaa', fontSize: 8.5 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function DigitalTwin() {
  const { data, error } = useApi('/twin');
  const [metric, setMetric] = useState(METRICS[0]);
  const [twinBuilding, setTwinBuilding] = useState(null);

  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading campus digital twin…" />;

  return (
    <>
      <PageHeader
        title="Campus Digital Twin"
        subtitle="Live 3-D supervisory view of all campus zones · BIM/IFC geometry · click any building for its full 3-D twin (telemetry via one-way data diode, flow 5)"
        right={
          <div className="app-timeframe-control">
            {METRICS.map((m) => (
              <button key={m.key} className={`app-timeframe-btn${metric.key === m.key ? ' is-active' : ''}`} onClick={() => setMetric(m)}>
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      <Panel title={`3-D Site Model — ${metric.label}`} sub="Drag to orbit · scroll to zoom · click any building to open its 3-D digital twin" style={{ padding: 0, overflow: 'hidden' }}>
        <CampusScene3D buildings={data.buildings} metric={metric} onSelectBuilding={setTwinBuilding} />

        {/* legend */}
        <div style={{ display: 'flex', gap: 18, padding: '10px 16px 14px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--app-surface-raised)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ fontWeight: 700, color: 'var(--app-text-muted)' }}>{metric.label}</span>
            <span style={{ width: 90, height: 9, borderRadius: 5, background: `linear-gradient(90deg, ${metric.low}, ${metric.high})`, display: 'inline-block' }} />
            {metric.scale[0]}–{metric.scale[1]} {metric.unit}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--app-danger)', display: 'inline-block' }} /> active alarm
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--app-warning)', display: 'inline-block' }} /> asset issue
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'rgba(34,211,238,0.9)', display: 'inline-block' }} /> 3-D twin
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--app-text-faint)' }}>
            {data.buildings.length} zones · {data.buildings.reduce((s, b) => s + (b.live?.alarm_count || 0), 0)} alarms · live
          </div>
        </div>
      </Panel>

      <div style={{ marginTop: 14 }}>
        <Panel title="Zone Summary" sub="Latest telemetry snapshot per building · click a row for its 3-D twin">
          <DataTable
            columns={[
              { key: 'building_id', label: 'Zone' },
              { key: 'name', label: 'ZMU Facility', render: (_name, r) => {
                  const f = zmuFacility(r);
                  return (
                    <div>
                      <div>{f.name}</div>
                      {f.tag && <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{f.tag}</div>}
                    </div>
                  );
                } },
              { key: 'live', label: 'Temp', render: (l) => `${l?.temp_c ?? '—'} °C` },
              { key: 'live', label: 'CO₂', render: (l) => `${l?.co2_ppm ?? '—'} ppm` },
              { key: 'live', label: 'Occupancy', render: (l) => `${l?.occupancy_pct ?? '—'}%` },
              { key: 'live', label: 'kWh/h', render: (l) => l?.kwh ?? '—' },
              { key: 'assetIssues', label: 'Asset Issues', render: (v, r) => {
                  const alarms = r.live?.alarm_count || 0;
                  return alarms + v > 0
                    ? <StatusChip kind={alarms > 0 ? 'danger' : 'warning'}>{alarms > 0 ? `${alarms} ALARM` : `${v} DEGRADED`}</StatusChip>
                    : <StatusChip kind="success">NORMAL</StatusChip>;
                } },
            ]}
            rows={data.buildings}
            onRowClick={(r) => setTwinBuilding(r)} />
        </Panel>
      </div>

      {twinBuilding && (
        <BuildingTwin3D
          building={twinBuilding}
          onClose={() => setTwinBuilding(null)}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CampusScene3D — the actual real-time-rendered 3-D digital twin
   ══════════════════════════════════════════════════════════════════════════ */
function CampusScene3D({ buildings, metric, onSelectBuilding }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const metricRef = useRef(metric);
  metricRef.current = metric;

  const [timeOfDay, setTimeOfDay] = useState('dusk');
  const [weather, setWeather] = useState('clear');
  const [cameraMode, setCameraMode] = useState('drone');
  const [personPanel, setPersonPanel] = useState(null);
  const weatherRef = useRef(weather); weatherRef.current = weather;
  const cameraModeRef = useRef(cameraMode); cameraModeRef.current = cameraMode;

  useEffect(() => {
    const cont = mountRef.current;
    if (!cont) return;
    let w = cont.clientWidth || 800, h = cont.clientHeight || 520;

    const scene = new THREE.Scene();
    let skyTex = makeCanvas(4, 256, (ctx, cw, ch) => {
      const p = LIGHT_PRESETS.dusk;
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, p.sky[0]); g.addColorStop(0.45, p.sky[1]); g.addColorStop(1, p.sky[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    });
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0x172436, 1000, 2600);

    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 3000);
    camera.position.set(260, 760, 640);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    cont.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 8, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 40;
    controls.maxDistance = 1600;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.screenSpacePanning = true;
    controls.update();
    const droneTarget = new THREE.Vector3(0, 8, 0);

    /* ── walk-mode (first-person) state ─────────────────────────────────── */
    const walkKeys = new Set();
    const walkState = { yaw: Math.PI, pitch: -0.05 };
    let prevCameraMode = 'drone';
    const onKeyDown = (e) => { walkKeys.add(e.code); };
    const onKeyUp = (e) => { walkKeys.delete(e.code); };
    const onMouseMoveLocked = (e) => {
      if (!document.pointerLockElement) return;
      walkState.yaw -= e.movementX * 0.0022;
      walkState.pitch = Math.max(-0.9, Math.min(0.9, walkState.pitch - e.movementY * 0.0022));
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMoveLocked);
    // once pointer lock engages, the OS cursor is captured and on-screen
    // buttons become unreliable to click — Escape is the browser's own
    // release gesture, so sync React state back to "drone" when that fires
    const onPointerLockChange = () => {
      if (document.pointerLockElement !== renderer.domElement && cameraModeRef.current === 'walk') {
        setCameraMode('drone');
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    /* ── lighting: time-of-day rig, swappable via LIGHT_PRESETS ────────── */
    const ambientLight = new THREE.AmbientLight(0x9fb6d8, 0.55);
    scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0x6a86b0, 0x1c3324, 0.7);
    scene.add(hemiLight);
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.65);
    sun.position.set(-420, 380, 260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -620, right: 620, top: 620, bottom: -620, near: 10, far: 1600 });
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fb4ff, 0.35);
    fill.position.set(300, 200, -300);
    scene.add(fill);

    let lampBoost = 1;
    const applyTimeOfDay = (name) => {
      const p = LIGHT_PRESETS[name] || LIGHT_PRESETS.dusk;
      const newSky = makeCanvas(4, 256, (ctx, cw, ch) => {
        const g = ctx.createLinearGradient(0, 0, 0, ch);
        g.addColorStop(0, p.sky[0]); g.addColorStop(0.45, p.sky[1]); g.addColorStop(1, p.sky[2]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      });
      skyTex.dispose();
      skyTex = newSky;
      scene.background = skyTex;
      scene.fog.color.set(p.fog);
      ambientLight.color.set(p.ambient[0]); ambientLight.intensity = p.ambient[1];
      hemiLight.color.set(p.hemi[0]); hemiLight.groundColor.set(p.hemi[1]); hemiLight.intensity = p.hemi[2];
      sun.color.set(p.sun[0]); sun.intensity = p.sun[1];
      renderer.toneMappingExposure = p.exposure;
      lampBoost = p.lampBoost;
    };
    applyTimeOfDay('dusk');

    const flags = []; // waving-flag meshes, animated in the render loop
    const lamps = [];
    const cctvs = []; // static camera props with an animated pan sweep
    const iotSensors = []; // static IoT props with a blinking status LED

    /* ── rain particles — toggled on/off, never a new dependency ───────── */
    const RAIN_COUNT = 2200;
    const rainPos = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * (SITE_W + 100);
      rainPos[i * 3 + 1] = Math.random() * 260;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * (SITE_H + 100);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xaecbe0, size: 1.1, transparent: true, opacity: 0.55, depthWrite: false });
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.visible = false;
    scene.add(rain);

    /* ── shared textures & materials ──────────────────────────────────── */
    const asphaltTex = makeAsphaltTexture();
    const grassTex = makeGrassTexture();
    const concreteTex = makeConcreteTexture();
    const parkingTex = makeParkingSurfaceTexture();
    const chainLinkTex = makeChainLinkTexture();
    const rippleTex = makeRippleTexture();

    const groundGrassTex = grassTex.clone(); groundGrassTex.needsUpdate = true; groundGrassTex.repeat.set(60, 40);
    const groundMat = new THREE.MeshStandardMaterial({ map: groundGrassTex, color: 0x9fc9a4, roughness: 0.97 });
    const ground = flatMesh(rectShape(-OX - 40, -OZ - 40, SITE_W + 80, SITE_H + 80), groundMat, 0);
    scene.add(ground);

    const lawnTex = grassTex.clone(); lawnTex.needsUpdate = true; lawnTex.repeat.set(18, 5);
    const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTex, color: 0xa8d2ac, roughness: 0.95 });
    scene.add(flatMesh(rectShape(toX(30), toZ(300), 240, 20), lawnMat, 0.02));

    /* ── roads ─────────────────────────────────────────────────────────── */
    const roadTex = asphaltTex.clone(); roadTex.needsUpdate = true;
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, color: 0x9aa2ab, roughness: 0.92, metalness: 0.05 });
    const roadEdgeMat = new THREE.MeshStandardMaterial({ color: 0xd7dde3, roughness: 0.8 });
    const roadGroup = new THREE.Group();

    const addRoadSlab = (x, z, w, d, texRepeat) => {
      const t = roadTex.clone(); t.needsUpdate = true; t.repeat.set(texRepeat[0], texRepeat[1]);
      const mat = roadMat.clone(); mat.map = t;
      roadGroup.add(flatMesh(rectShape(x, z, w, d), mat, 0.03));
    };
    const addDashedLine = (x0, z0, x1, z1, count, axis) => {
      const dx = (x1 - x0) / count, dz = (z1 - z0) / count;
      const segLen = Math.hypot(dx, dz) * 0.55;
      const w = 0.35;
      for (let i = 0; i < count; i++) {
        if (i % 2 === 1) continue;
        const cx = x0 + dx * (i + 0.5), cz = z0 + dz * (i + 0.5);
        const geo = axis === 'x' ? new THREE.BoxGeometry(segLen, 0.03, w) : new THREE.BoxGeometry(w, 0.03, segLen);
        const seg = new THREE.Mesh(geo, roadEdgeMat);
        seg.position.set(cx, 0.045, cz);
        roadGroup.add(seg);
      }
    };
    const addCurb = (x, z, w, d) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d),
        new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.85 }));
      curb.position.set(x, 0.08, z);
      curb.receiveShadow = true; curb.castShadow = true;
      roadGroup.add(curb);
    };

    // horizontal spine (svg x0..1010, y330..360)
    addRoadSlab(toX(0), toZ(330), SITE_W, 30, [60, 2]);
    addDashedLine(toX(0) + 4, toZ(345), toX(SITE_W) - 4, toZ(345), 56, 'x');
    addCurb(toX(0) + SITE_W / 2, toZ(330) - 0.2, SITE_W, 0.3);
    addCurb(toX(0) + SITE_W / 2, toZ(360) + 0.2, SITE_W, 0.3);
    // sidewalks flanking the spine
    const sideWalkTex = concreteTex.clone(); sideWalkTex.needsUpdate = true; sideWalkTex.repeat.set(50, 2);
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: sideWalkTex, color: 0xaeb6bf, roughness: 0.85 });
    roadGroup.add(flatMesh(rectShape(toX(0), toZ(330) - 6, SITE_W, 6), sidewalkMat, 0.028));
    roadGroup.add(flatMesh(rectShape(toX(0), toZ(360), SITE_W, 6), sidewalkMat, 0.028));

    // vertical connectors — road B (x492) runs directly through the Sports
    // Complex (Z08, y380-520) footprint in the source data; a road can't
    // physically continue through a building's foundation, so it's rendered
    // as two segments with a gap exactly matching that footprint instead of
    // paving straight through the building (footprint/position untouched)
    const renderVerticalRoad = (vx, gapStart, gapEnd) => {
      const segments = gapStart == null ? [[0, SITE_H]] : [[0, gapStart], [gapEnd, SITE_H]].filter(([a, b]) => b > a);
      segments.forEach(([y0, y1]) => {
        const len = y1 - y0;
        addRoadSlab(toX(vx), toZ(y0), 26, len, [2, Math.max(1, Math.round(40 * len / SITE_H))]);
        addDashedLine(toX(vx + 13), toZ(y0) + 4, toX(vx + 13), toZ(y1) - 4, Math.max(2, Math.round(56 * len / SITE_H)), 'z');
        addCurb(toX(vx) - 0.2, toZ(y0) + len / 2, 0.3, len);
        addCurb(toX(vx + 26) + 0.2, toZ(y0) + len / 2, 0.3, len);
      });
    };
    renderVerticalRoad(272, null, null);
    renderVerticalRoad(492, null, null); // full road, restored — Z08 is minimised below instead of gapping the road

    // roundabout
    const raMat = roadMat.clone(); const raTex = asphaltTex.clone(); raTex.needsUpdate = true; raTex.repeat.set(4, 4); raMat.map = raTex;
    roadGroup.add(flatMesh(circleShape(toX(505), toZ(345), 26), raMat, 0.032));
    roadGroup.add(flatMesh(circleShape(toX(505), toZ(345), 12), lawnMat.clone(), 0.04));

    // pedestrian crosswalk on the approach to the main gate
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), roadEdgeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(toX(492 + 2 + i * 4), 0.048, toZ(628));
      roadGroup.add(stripe);
    }
    // storm drain grates along the spine road shoulder
    const drainTex = makeCanvas(32, 32, (ctx, w, h) => {
      ctx.fillStyle = '#1a1d22'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90,98,108,0.9)'; ctx.lineWidth = 1.6;
      for (let dx = 4; dx < w; dx += 6) { ctx.beginPath(); ctx.moveTo(dx, 2); ctx.lineTo(dx, h - 2); ctx.stroke(); }
    });
    const drainMat = new THREE.MeshStandardMaterial({ map: drainTex, roughness: 0.7 });
    for (let x = 80; x < SITE_W; x += 180) {
      const drain = new THREE.Mesh(new THREE.CircleGeometry(1.1, 12), drainMat);
      drain.rotation.x = -Math.PI / 2;
      drain.position.set(toX(x), 0.05, toZ(332));
      roadGroup.add(drain);
    }
    scene.add(roadGroup);

    /* ── parking lot ───────────────────────────────────────────────────── */
    const parkGroup = new THREE.Group();
    const pTex = parkingTex.clone(); pTex.needsUpdate = true; pTex.repeat.set(6, 3);
    const parkMat = new THREE.MeshStandardMaterial({ map: pTex, color: 0x9aa2ab, roughness: 0.9 });
    parkGroup.add(flatMesh(roundedRectShape(toX(742), toZ(382), 216, 96, 6), parkMat, 0.03));
    // parking-line grid
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xe7ecf1, roughness: 0.7, emissive: 0x222f3d, emissiveIntensity: 0.15 });
    for (let c = 0; c <= 9; c++) {
      const x = toX(742 + c * 24);
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 26), lineMat);
      seg.rotation.x = -Math.PI / 2; seg.position.set(x, 0.05, toZ(382) + 14); parkGroup.add(seg);
      const seg2 = seg.clone(); seg2.position.set(x, 0.05, toZ(382) + 44); parkGroup.add(seg2);
      const seg3 = seg.clone(); seg3.position.set(x, 0.05, toZ(382) + 74); parkGroup.add(seg3);
    }
    // parked cars — same grid + skip pattern as the original SVG lot (utilitarian fleet colours)
    const carPalette = [0x7d8570, 0x9a9488, 0xd8d4c8, 0x4a5040, 0x8f8a7a];
    let carSeed = 1;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
      if ((r * 9 + c) % 3 === 0) continue;
      const cx = toX(742 + 10 + c * 23), cz = toZ(382 + 10 + r * 30);
      const car = buildCar(carPalette[(r + c) % carPalette.length], carSeed++);
      car.position.set(cx, 0, cz);
      car.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.05;
      parkGroup.add(car);
    }
    // ANPR / entry gate arm at the lot mouth
    const anprPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.5 }));
    anprPost.position.set(toX(742), 1.1, toZ(382) + 6);
    parkGroup.add(anprPost);
    const anprCam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.5 }));
    anprCam.position.set(toX(742) + 0.3, 2.05, toZ(382) + 6);
    parkGroup.add(anprCam);
    const parkCctv = buildCCTV(3.6);
    parkCctv.position.set(toX(958) - 4, 0, toZ(382) + 4);
    parkCctv.rotation.y = Math.PI;
    parkGroup.add(parkCctv);
    cctvs.push(parkCctv);
    const parkSensor = buildIoTSensor('air');
    parkSensor.position.set(toX(742) - 6, 0, toZ(478) - 4);
    parkGroup.add(parkSensor);
    iotSensors.push(parkSensor);
    scene.add(parkGroup);
    scene.add(spawnSprite((ctx, w2, h2) => {
      ctx.font = 'bold 26px Inter, sans-serif'; ctx.fillStyle = 'rgba(220,232,244,0.85)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PARKING · ANPR', w2 / 2, h2 / 2);
    }, 320, 44, 26, 3.6).translateX(toX(850)).translateY(4.2).translateZ(toZ(474)));

    /* ── parade ground ─────────────────────────────────────────────────── */
    const paradeTex = grassTex.clone(); paradeTex.needsUpdate = true; paradeTex.repeat.set(20, 6);
    const paradeMat = new THREE.MeshStandardMaterial({ map: paradeTex, color: 0x7fae82, roughness: 0.95 });
    scene.add(flatMesh(roundedRectShape(toX(560), toZ(500), 410, 110, 10), paradeMat, 0.025));
    // painted boundary line
    const paradeBorder = new THREE.Mesh(
      new THREE.EdgesGeometry(new THREE.ShapeGeometry(roundedRectShape(toX(560), toZ(500), 410, 110, 10))),
      new THREE.LineBasicMaterial({ color: 0xdfe9ee, transparent: true, opacity: 0.5 }),
    );
    paradeBorder.rotation.x = Math.PI / 2; paradeBorder.position.y = 0.03;
    scene.add(paradeBorder);
    scene.add(spawnSprite((ctx, w2, h2) => {
      ctx.font = 'bold 30px Inter, sans-serif'; ctx.fillStyle = 'rgba(190,225,198,0.85)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '4px';
      ctx.fillText('PARADE GROUND', w2 / 2, h2 / 2);
    }, 420, 50, 34, 4).translateX(toX(765)).translateY(4.4).translateZ(toZ(556)));
    // ceremonial flag mast + corner floodlights
    const paradeMast = buildFlagpole(11, 3.4, 2.2, 0x4a5230);
    paradeMast.position.set(toX(765), 0, toZ(522));
    scene.add(paradeMast);
    flags.push(paradeMast.userData.flag);
    [[562, 502], [968, 502], [562, 608], [968, 608]].forEach(([px, pz]) => {
      const flood = buildLamp();
      flood.scale.set(1.2, 1.4, 1.2);
      flood.position.set(toX(px), 0, toZ(pz));
      scene.add(flood);
      const fl = new THREE.PointLight(0xd8e8f0, 5, 30, 2);
      fl.position.set(toX(px), 5.6, toZ(pz));
      scene.add(fl);
      lamps.push(flood);
    });
    const weatherStation = buildIoTSensor('weather');
    weatherStation.position.set(toX(575), 0, toZ(510));
    scene.add(weatherStation);
    iotSensors.push(weatherStation);

    /* ── water feature ─────────────────────────────────────────────────── */
    const waterShape = new THREE.Shape();
    waterShape.moveTo(185, -95);
    waterShape.quadraticCurveTo(215, -113, 247, -99);
    waterShape.quadraticCurveTo(269, -89, 261, -65);
    waterShape.quadraticCurveTo(251, -39, 217, -43);
    waterShape.quadraticCurveTo(177, -47, 173, -71);
    waterShape.quadraticCurveTo(170, -87, 185, -95);
    const basin = flatMesh(waterShape, new THREE.MeshStandardMaterial({ color: 0x0c2333, roughness: 1 }), 0.02);
    scene.add(basin);
    const rTex = rippleTex.clone(); rTex.needsUpdate = true; rTex.repeat.set(3, 3);
    const waterMat = new THREE.MeshPhysicalMaterial({
      map: rTex, color: 0x2f89bd, roughness: 0.12, metalness: 0.05,
      transparent: true, opacity: 0.86, transmission: 0.25, thickness: 0.4, ior: 1.33,
    });
    const water = flatMesh(waterShape, waterMat, 0.09);
    scene.add(water);

    /* ── perimeter fence + main gate ──────────────────────────────────── */
    const fenceGroup = new THREE.Group();
    const fx0 = toX(8), fz0 = toZ(8), fw = 994, fd = 644;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x394048, roughness: 0.55, metalness: 0.4 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x454d56, roughness: 0.5, metalness: 0.45 });
    const meshMat = new THREE.MeshStandardMaterial({ map: chainLinkTex, color: 0xaeb9c4, transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.6 });
    const perim = [
      [fx0, fz0, fx0 + fw, fz0],
      [fx0 + fw, fz0, fx0 + fw, fz0 + fd],
      [fx0 + fw, fz0 + fd, fx0, fz0 + fd],
      [fx0, fz0 + fd, fx0, fz0],
    ];
    const postGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.8, 6);
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, 260);
    let postI = 0;
    const dummy = new THREE.Object3D();
    perim.forEach(([x0, z0, x1, z1]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(2, Math.round(len / 26));
      const railLen = len;
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? 0.1 : railLen, 0.08, x0 === x1 ? railLen : 0.1), railMat);
      rail1.position.set((x0 + x1) / 2, 0.5, (z0 + z1) / 2); fenceGroup.add(rail1);
      const rail2 = rail1.clone(); rail2.position.y = 1.35; fenceGroup.add(rail2);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(railLen, 1.2), meshMat);
      panel.position.set((x0 + x1) / 2, 0.9, (z0 + z1) / 2);
      panel.rotation.y = x0 === x1 ? Math.PI / 2 : 0;
      fenceGroup.add(panel);
      for (let i = 0; i <= n && postI < 260; i++) {
        const t = i / n;
        dummy.position.set(x0 + (x1 - x0) * t, 0.8, z0 + (z1 - z0) * t);
        dummy.updateMatrix();
        postMesh.setMatrixAt(postI++, dummy.matrix);
      }
    });
    postMesh.count = postI;
    postMesh.castShadow = true;
    fenceGroup.add(postMesh);
    scene.add(fenceGroup);

    // corner watchtowers — inset from the fence line
    [[fx0 + 9, fz0 + 9], [fx0 + fw - 9, fz0 + fd - 9]].forEach(([tx, tz]) => {
      const tower = buildWatchtower();
      tower.position.set(tx, 0, tz);
      scene.add(tower);
    });

    // main gate — booth + boom barrier + pillars
    const gateGroup = new THREE.Group();
    const gx = toX(468 + 37), gz = toZ(646 + 6);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.45, metalness: 0.35 });
    [-1, 1].forEach((s) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1.4), pillarMat);
      pillar.position.set(gx + s * 20, 1.3, gz); pillar.castShadow = true; gateGroup.add(pillar);
    });
    const booth = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.4, metalness: 0.2 }));
    booth.position.set(gx - 12, 1.3, gz - 4); booth.castShadow = true; gateGroup.add(booth);
    const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.2, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x9aa7b4, roughness: 0.5 }));
    boothRoof.position.set(gx - 12, 2.7, gz - 4); gateGroup.add(boothRoof);
    const boomBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8), pillarMat);
    boomBase.position.set(gx - 6, 0.5, gz); gateGroup.add(boomBase);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(9, 0.16, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.5 }));
    boom.geometry.translate(-4.4, 0, 0);
    boom.position.set(gx - 6, 1.05, gz);
    gateGroup.add(boom);
    gateGroup.add(spawnSprite((ctx, w2, h2) => {
      ctx.font = 'bold 24px Inter, sans-serif'; ctx.fillStyle = 'rgba(230,238,246,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('MAIN GATE', w2 / 2, h2 / 2);
    }, 260, 40, 18, 2.8).translateX(gx).translateY(3.6).translateZ(gz));
    // flagpole + campus insignia sign
    const gateFlagpole = buildFlagpole(7, 2.2, 1.4, 0x4a5230);
    gateFlagpole.position.set(gx + 27, 0, gz - 3);
    gateGroup.add(gateFlagpole);
    flags.push(gateFlagpole.userData.flag);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.5 }));
    signBoard.position.set(gx - 20, 2.2, gz + 4.5); signBoard.castShadow = true; gateGroup.add(signBoard);
    gateGroup.add(spawnSprite((ctx, w2, h2) => {
      ctx.fillStyle = '#3b7de8'; ctx.beginPath(); ctx.arc(w2 * 0.5, h2 * 0.36, 42, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 32px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ZMU', w2 / 2, h2 * 0.38);
      ctx.font = '600 15px Inter, sans-serif'; ctx.fillStyle = 'rgba(230,238,246,0.9)';
      ctx.fillText('RESTRICTED AREA', w2 / 2, h2 * 0.8);
    }, 260, 130, 3.2, 1.6).translateX(gx - 20).translateY(2.2).translateZ(gz + 4.42));
    // gate CCTV coverage + two static checkpoint guards
    [-1, 1].forEach((s) => {
      const cctv = buildCCTV(2.8);
      cctv.position.set(gx + s * 20, 0, gz - 1.5);
      cctv.rotation.y = s > 0 ? Math.PI * 0.75 : Math.PI * 0.25;
      gateGroup.add(cctv);
      cctvs.push(cctv);
    });
    const guard1 = buildPerson(6001);
    guard1.position.set(gx - 6.5, 0, gz - 2.2);
    guard1.rotation.y = Math.PI;
    gateGroup.add(guard1);
    const guard2 = buildPerson(6002);
    guard2.position.set(gx - 5.5, 0, gz + 2.2);
    gateGroup.add(guard2);
    scene.add(gateGroup);

    /* ── trees ─────────────────────────────────────────────────────────── */
    const treeGroup = new THREE.Group();
    const trees = TREES.map((t, i) => {
      const tree = buildTree(1000 + i * 37);
      tree.position.set(toX(t[0]), 0, toZ(t[1]));
      treeGroup.add(tree);
      return tree;
    });
    scene.add(treeGroup);

    /* ── street lamps along the spine road ────────────────────────────── */
    for (let x = 60; x < SITE_W; x += 160) {
      const lamp = buildLamp();
      lamp.position.set(toX(x), 0, toZ(330) - 3.5);
      scene.add(lamp);
      const pl = new THREE.PointLight(0xd8e8f0, 6, 26, 2);
      pl.position.set(toX(x), 4.2, toZ(330) - 3.5);
      scene.add(pl);
      lamps.push(lamp);
    }

    // roadside signage — speed limit + checkpoint notices, purely decorative
    const speedSign = buildRoadSign(['15', 'KM/H'], '#8a1f24');
    speedSign.position.set(toX(150), 0, toZ(330) - 5);
    scene.add(speedSign);
    const speedSign2 = buildRoadSign(['15', 'KM/H'], '#8a1f24');
    speedSign2.position.set(toX(860), 0, toZ(360) + 5);
    speedSign2.rotation.y = Math.PI;
    scene.add(speedSign2);
    const checkpointSign = buildRoadSign(['CHECKPOINT', 'AHEAD'], '#4a5230');
    checkpointSign.position.set(toX(525), 0, toZ(600)); // clear of road B (x492-518)
    scene.add(checkpointSign);
    const wayfindingSign = buildRoadSign(['ACADEMIC BLOCKS ↑', 'LIBRARY · CLINIC →'], '#3b7de8');
    wayfindingSign.position.set(toX(310), 0, toZ(310)); // clear of the spine road (y330-360) and Z03 (ends y290)
    scene.add(wayfindingSign);

    // outdoor fitness station beside the Physical Training Complex (Z08)
    const fitnessGroup = new THREE.Group();
    const fitnessMat = new THREE.MeshStandardMaterial({ color: 0x454d40, roughness: 0.5, metalness: 0.4 });
    const barPosts = [[-1.1, 0], [1.1, 0], [-1.1, 2.6], [1.1, 2.6]];
    barPosts.forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), fitnessMat);
      post.position.set(px, 1.15, pz); post.castShadow = true; fitnessGroup.add(post);
    });
    [0, 2.6].forEach((pz) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), fitnessMat);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.25, pz); fitnessGroup.add(bar);
    });
    fitnessGroup.add(spawnSprite((ctx, w2, h2) => {
      ctx.font = 'bold 18px Inter, sans-serif'; ctx.fillStyle = 'rgba(216,212,200,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('OUTDOOR FITNESS STATION', w2 / 2, h2 / 2);
    }, 260, 30, 16, 1.8).translateY(3.2));
    fitnessGroup.position.set(toX(306), 0, toZ(535)); // clear of road A (ends x298) and Z08's (unchanged) south edge (y520)
    scene.add(fitnessGroup);

    /* ── buildings ─────────────────────────────────────────────────────── */
    const buildingIndex = new Map();
    const pickables = [];
    const buildingGroup = new THREE.Group();

    buildings.forEach((b) => {
      const style = TYPE_STYLE[b.type] || DEFAULT_STYLE;
      const floors = Math.max(2, clamp(b.floors || 2, 1, 8));
      const bh = floors * FLOOR_H;
      const seed = hashStr(b.building_id);
      const rand = mulberry32(seed);
      const wx = toX(b.x), wz = toZ(b.y);
      // Z08's footprint overlaps road B on its east side and sits close to the
      // roundabout on its north side — the road is untouched; instead the
      // building itself is minimised via a group-level scale (every detail
      // mesh below is built from b.w/b.h in local space, so this shrinks the
      // whole building together, no per-mesh changes needed). The west and
      // south edges are anchored in place so only the two edges near the road
      // actually move.
      const isZ08 = b.building_id === 'Z08';
      const scaleX = isZ08 ? 0.78 : 1;
      const scaleZ = isZ08 ? 0.88 : 1;

      const group = new THREE.Group();
      group.position.set(wx + (b.w / 2) * scaleX, 0, wz + b.h - (b.h / 2) * scaleZ);
      group.scale.set(scaleX, 1, scaleZ);

      const colsX = Math.max(2, Math.round(b.w / 4.4));
      const colsZ = Math.max(2, Math.round(b.h / 4.4));
      const front = makeFacadeTextures(colsX, floors, style.wall, style.glass, style.lit, seed + 1);
      const back = makeFacadeTextures(colsX, floors, style.wall, style.glass, style.lit, seed + 2);
      const side1 = makeFacadeTextures(colsZ, floors, style.wall, style.glass, style.lit, seed + 3);
      const side2 = makeFacadeTextures(colsZ, floors, style.wall, style.glass, style.lit, seed + 4);
      const mkWallMat = (t) => new THREE.MeshStandardMaterial({
        map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
        roughness: 0.55, metalness: 0.12,
      });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a6470, roughness: 0.75, metalness: 0.1 });
      const bottomMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9 });

      const mass = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, bh, b.h),
        [mkWallMat(side1), mkWallMat(side2), roofMat, bottomMat, mkWallMat(front), mkWallMat(back)],
      );
      mass.position.y = bh / 2;
      mass.castShadow = true; mass.receiveShadow = true;
      mass.userData.buildingId = b.building_id;
      group.add(mass);
      pickables.push(mass);

      // roof parapet trim (also carries the metric tint — most visible from a drone view)
      const parapetMat = new THREE.MeshStandardMaterial({ color: 0x5a6470, roughness: 0.5, metalness: 0.2 });
      const parapetGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w + 0.3, 0.5, b.h + 0.3));
      const parapet = new THREE.LineSegments(parapetGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      parapet.position.y = bh + 0.25;
      group.add(parapet);
      const parapetSolid = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.2, 0.35, b.h + 0.2), parapetMat);
      parapetSolid.position.y = bh + 0.18;
      group.add(parapetSolid);

      // roof clutter — deterministic per building, flavoured by type
      const roofY = bh + 0.4;
      const eqMat = new THREE.MeshStandardMaterial({ color: 0x7c8894, roughness: 0.6, metalness: 0.3 });
      const nEq = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < nEq; i++) {
        const ew = 1.2 + rand() * 1.6, ed = 1.2 + rand() * 1.6, eh = 0.6 + rand() * 0.9;
        const eq = new THREE.Mesh(new THREE.BoxGeometry(ew, eh, ed), eqMat);
        eq.position.set((rand() - 0.5) * (b.w - ew - 1), roofY + eh / 2, (rand() - 0.5) * (b.h - ed - 1));
        eq.castShadow = true;
        group.add(eq);
      }
      if (b.type === 'plant') {
        for (let i = 0; i < 2; i++) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 14),
            new THREE.MeshStandardMaterial({ color: 0x9aa7b4, roughness: 0.4, metalness: 0.5 }));
          tank.position.set(-b.w / 4 + i * b.w / 2, roofY + 1.2, 0);
          tank.castShadow = true; group.add(tank);
        }
      }
      if (b.type === 'library') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshPhysicalMaterial({ color: 0x8fc4e6, roughness: 0.15, transparent: true, opacity: 0.55, transmission: 0.4 }));
        dome.position.set(0, roofY, 0); group.add(dome);
      }
      if (b.type === 'sports' || b.type === 'assembly') {
        // b.type === 'assembly' -> ceremonial Parade & Assembly Hall (barrel
        // vault with ribs/skylight, flanking flagpoles, floodlights, insignia)
        // b.type === 'sports'   -> Indoor Physical Training Centre (utilitarian
        // vault, large roller door, training signage)
        const isParade = b.type === 'assembly';
        // chord (2r) and length are set to EXACTLY match the wall footprint on
        // both sides — the roof must be flush with the walls, not inset from them
        const r = Math.min(b.w, b.h) / 2;
        const len = Math.max(b.w, b.h);
        const alongX = b.w > b.h;
        // a true semicircular vault's rise always equals its radius, which
        // would tower over the (much shorter) wall height at this span — a
        // gable roof (two flat sloped panels meeting at a ridge) gives the
        // same "hangar/gymnasium" read without that distortion: the pitch
        // (rise) is independent of the span, so it can match the walls exactly
        const rise = clamp(bh * 0.9, 3, r);
        const ribMat = new THREE.MeshStandardMaterial({ color: 0x2e332c, roughness: 0.5, metalness: 0.55 });
        const roofSlopeMat = new THREE.MeshStandardMaterial({
          color: isParade ? 0x8f99a4 : 0x6e7568, roughness: isParade ? 0.35 : 0.55, metalness: isParade ? 0.3 : 0.2, side: THREE.DoubleSide,
        });
        const ridgeY = roofY + rise;
        // built from explicit corner positions (not a rotated/scaled primitive)
        // so there's no risk of an orientation or squash mistake: a = ridge start,
        // b = ridge end, c/d = the matching eave edge, both flush with the walls
        const slopedPanel = (ax, az, bx, bz, cx, cz, dx, dz) => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            ax, ridgeY, az, bx, ridgeY, bz, cx, roofY, cz,
            ax, ridgeY, az, cx, roofY, cz, dx, roofY, dz,
          ]), 3));
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, roofSlopeMat);
          mesh.castShadow = true; mesh.receiveShadow = true;
          return mesh;
        };
        if (alongX) {
          group.add(slopedPanel(-len / 2, 0, len / 2, 0, len / 2, r, -len / 2, r));
          group.add(slopedPanel(-len / 2, 0, len / 2, 0, len / 2, -r, -len / 2, -r));
        } else {
          group.add(slopedPanel(0, -len / 2, 0, len / 2, r, len / 2, r, -len / 2));
          group.add(slopedPanel(0, -len / 2, 0, len / 2, -r, len / 2, -r, -len / 2));
        }
        // triangular gable end walls closing off the roof volume
        const gableEndMat = new THREE.MeshStandardMaterial({
          color: isParade ? 0x8f99a4 : 0x6e7568, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide,
        });
        const gableEnd = (ex, ez) => {
          const geo = new THREE.BufferGeometry();
          const verts = alongX
            ? [ex, ridgeY, 0, ex, roofY, r, ex, roofY, -r]
            : [0, ridgeY, ez, r, roofY, ez, -r, roofY, ez];
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, gableEndMat);
          mesh.castShadow = true;
          return mesh;
        };
        if (alongX) { group.add(gableEnd(-len / 2, 0)); group.add(gableEnd(len / 2, 0)); }
        else { group.add(gableEnd(0, -len / 2)); group.add(gableEnd(0, len / 2)); }
        // ridge cap beam
        const ridgeCap = new THREE.Mesh(
          new THREE.BoxGeometry(alongX ? len : 0.3, 0.22, alongX ? 0.3 : len), ribMat,
        );
        ridgeCap.position.y = ridgeY + 0.02;
        group.add(ridgeCap);

        // ridge skylight + roof vents, sitting right along the gable's ridge line
        const peakY = roofY + rise + 0.05;
        const skyMat = new THREE.MeshPhysicalMaterial({
          color: 0xaed4ea, roughness: 0.2, transparent: true, opacity: 0.5, transmission: 0.35, emissive: 0x0a1a26, emissiveIntensity: 0.15,
        });
        const skyDims = alongX ? [len * 0.85, 0.08, 1.1] : [1.1, 0.08, len * 0.85];
        const sky = new THREE.Mesh(new THREE.BoxGeometry(...skyDims), skyMat);
        sky.position.y = peakY;
        group.add(sky);
        const ventMat = new THREE.MeshStandardMaterial({ color: 0x454d40, roughness: 0.6, metalness: 0.3 });
        const nVents = isParade ? 3 : 2;
        for (let i = 0; i < nVents; i++) {
          const tt = (i + 0.5) / nVents - 0.5;
          const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 8), ventMat);
          if (alongX) vent.position.set(tt * len * 0.7, peakY + 0.4, 0);
          else vent.position.set(0, peakY + 0.4, tt * len * 0.7);
          vent.castShadow = true;
          group.add(vent);
        }

        if (isParade) {
          const sideX = b.w / 2 + 2;
          [-1, 1].forEach((s) => {
            const pole = buildFlagpole(5.5, 1.6, 1.0, 0x4a5230);
            pole.position.set(s * sideX, 0, b.h / 2 - 2);
            group.add(pole);
            flags.push(pole.userData.flag);
            const flood = buildLamp();
            flood.position.set(s * sideX, 0, b.h / 2 + 2);
            group.add(flood);
            lamps.push(flood);
          });
          const insignia = spawnSprite((ctx, w2, h2) => {
            ctx.fillStyle = 'rgba(74,82,48,0.92)';
            ctx.beginPath(); ctx.arc(w2 / 2, h2 / 2, w2 / 2 - 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#d8d4c8'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#d8d4c8'; ctx.font = 'bold 30px Inter, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('★', w2 / 2, h2 / 2 - 2);
          }, 80, 80, 1.6, 1.6);
          insignia.position.set(0, bh + 0.6, b.h / 2 + 0.2);
          group.add(insignia);
          const step = new THREE.Mesh(new THREE.BoxGeometry(Math.min(10, b.w * 0.5), 0.3, 1.6),
            new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.7 }));
          step.position.set(0, 0.15, b.h / 2 + 2.6);
          group.add(step);
        } else {
          const doorW = Math.min(10, b.w * 0.4);
          const bigDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW, 4.2, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x2e332c, roughness: 0.6, metalness: 0.3 }));
          bigDoor.position.set(0, 2.1, b.h / 2 + 0.08);
          group.add(bigDoor);
          for (let i = 1; i < 6; i++) {
            const seam = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.04, 0.17), ribMat);
            seam.position.set(0, i * 0.7, b.h / 2 + 0.1);
            group.add(seam);
          }
          group.add(spawnSprite((ctx, w2, h2) => {
            ctx.font = 'bold 20px Inter, sans-serif'; ctx.fillStyle = 'rgba(216,212,200,0.9)';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('PHYSICAL TRAINING CENTRE', w2 / 2, h2 / 2);
          }, 320, 34, 22, 2.3).translateY(bh + 1.5).translateZ(b.h / 2 + 0.5).translateX(0));
        }
      }
      // solar panels for larger academic/admin roofs
      if (['admin', 'academic', 'labs'].includes(b.type) && b.w * b.h > 12000) {
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x18243a, roughness: 0.25, metalness: 0.4 });
        const rows2 = 3, cols2 = 4;
        for (let r = 0; r < rows2; r++) for (let c = 0; c < cols2; c++) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(b.w / cols2 - 1, 0.08, b.h / rows2 / 3 - 0.4), panelMat);
          p.position.set(-b.w / 2 + (c + 0.5) * (b.w / cols2), roofY + 0.3, -b.h / 2.6 + r * (b.h / rows2 / 1.4));
          p.rotation.x = -0.18;
          group.add(p);
        }
      }

      // entrance canopy on the south-facing edge
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(Math.min(8, b.w * 0.4), 0.25, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x2f3a48, roughness: 0.4, metalness: 0.3 }));
      canopy.position.set(0, 2.6, b.h / 2 + 1.1);
      canopy.castShadow = true; group.add(canopy);
      [-1, 1].forEach((s) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), eqMat);
        post.position.set(s * Math.min(8, b.w * 0.4) / 2 - s * 0.3, 1.3, b.h / 2 + 2.1);
        group.add(post);
      });

      // entrance door, roof-access ladder and corner rainwater pipes — same footprint, decoration only
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.35, metalness: 0.4 }));
      door.position.set(0, 1.15, b.h / 2 + 0.06);
      group.add(door);

      const ladderMat = new THREE.MeshStandardMaterial({ color: 0x8a8f78, roughness: 0.5, metalness: 0.5 });
      const ladderX = -b.w / 2 - 0.05, ladderZ = Math.min(b.h / 2 - 1.5, b.h * 0.3);
      [-0.22, 0.22].forEach((dz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, bh * 0.75, 0.05), ladderMat);
        rail.position.set(ladderX, bh * 0.375, ladderZ + dz);
        group.add(rail);
      });
      const rungCount = Math.max(3, Math.round((bh * 0.75) / 0.6));
      for (let i = 0; i < rungCount; i++) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.44), ladderMat);
        rung.position.set(ladderX, 0.4 + i * ((bh * 0.75) / rungCount), ladderZ);
        group.add(rung);
      }

      const pipeMat = new THREE.MeshStandardMaterial({ color: 0x454d40, roughness: 0.6, metalness: 0.3 });
      [[b.w / 2 - 0.3, b.h / 2 - 0.3], [-b.w / 2 + 0.3, b.h / 2 - 0.3]].forEach(([px, pz]) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, bh, 6), pipeMat);
        pipe.position.set(px, bh / 2, pz);
        group.add(pipe);
      });

      // alarm / issue marker (pulsing beacon)
      const issues = (b.live?.alarm_count || 0) + (b.assetIssues || 0);
      let beacon = null;
      if ((b.live?.alarm_count || 0) > 0 || issues > 0) {
        const beaconColor = (b.live?.alarm_count || 0) > 0 ? 0xff5566 : 0xf5a524;
        beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10),
          new THREE.MeshStandardMaterial({ color: beaconColor, emissive: beaconColor, emissiveIntensity: 1.2 }));
        beacon.position.set(b.w / 2 - 1.5, bh + 1.6, -b.h / 2 + 1.5);
        group.add(beacon);
      }

      // "3D twin" click-affordance badge
      const badge = spawnSprite((ctx, w2, h2) => {
        ctx.fillStyle = 'rgba(34,211,238,0.92)';
        ctx.beginPath(); ctx.arc(w2 / 2, h2 / 2, w2 / 2 - 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#0a2a30'; ctx.font = 'bold 40px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('3D', w2 / 2, h2 / 2 + 2);
      }, 96, 96, 1.6, 1.6);
      badge.position.set(-b.w / 2 + 1.4, bh + 1.6, -b.h / 2 + 1.4);
      group.add(badge);

      // name + live-value label
      const labelSprite = spawnSprite(() => {}, 4, 4, 1, 1); // placeholder, filled by refreshLabel()
      group.add(labelSprite);

      buildingGroup.add(group);
      buildingIndex.set(b.building_id, { building: b, group, mass, roofMat, parapetMat, labelSprite, beacon, bh });
    });
    scene.add(buildingGroup);

    const refreshLabel = (entry) => {
      const b = entry.building;
      const m = metricRef.current;
      const v = m.get(b.live);
      const sp = spawnSprite((ctx, w2, h2) => {
        ctx.font = 'bold 30px Inter, sans-serif'; ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
        ctx.fillText(b.building_id, w2 / 2, h2 * 0.34);
        ctx.font = '600 22px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText(v != null ? `${v}${m.unit}` : '—', w2 / 2, h2 * 0.72);
      }, 260, 100, 9, 3.4);
      entry.labelSprite.material.map.dispose();
      entry.labelSprite.material.map = sp.material.map;
      entry.labelSprite.scale.copy(sp.scale);
      entry.labelSprite.material.needsUpdate = true;
      entry.labelSprite.position.set(0, entry.bh + 3.4, 0);
    };
    const applyMetricTint = () => {
      const m = metricRef.current;
      const loRgb = hexToRgb(m.low), hiRgb = hexToRgb(m.high);
      buildingIndex.forEach((entry) => {
        const v = m.get(entry.building.live);
        const rc = v == null ? [90, 100, 116] : mix(loRgb, hiRgb, (v - m.scale[0]) / (m.scale[1] - m.scale[0]));
        entry.roofMat.color.set(rgb(rc));
        entry.parapetMat.color.set(rgb(mul(rc, 0.85)));
        refreshLabel(entry);
      });
    };
    applyMetricTint();

    /* ── hover tooltip sprite ─────────────────────────────────────────── */
    const tooltip = spawnSprite(() => {}, 4, 4, 0.001, 0.001);
    tooltip.visible = false;
    scene.add(tooltip);
    const refreshTooltip = (entry) => {
      if (!entry) { tooltip.visible = false; return; }
      const b = entry.building;
      const sp = spawnSprite((ctx, w2, h2) => {
        ctx.fillStyle = 'rgba(8,12,20,0.92)';
        rRect(ctx, 4, 4, w2 - 8, h2 - 8, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
        rRect(ctx, 4, 4, w2 - 8, h2 - 8, 14); ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const facility = zmuFacility(b);
        ctx.font = 'bold 28px Inter, sans-serif'; ctx.fillStyle = '#ffffff';
        ctx.fillText(facility.name, 26, 38);
        ctx.font = '18px Inter, sans-serif'; ctx.fillStyle = '#7fb0f0';
        ctx.fillText(facility.tag, 26, 66);
        ctx.font = '22px Inter, sans-serif'; ctx.fillStyle = '#9fb2c6';
        ctx.fillText(`${b.live?.temp_c ?? '—'}°C · ${b.live?.co2_ppm ?? '—'}ppm · ${b.live?.occupancy_pct ?? '—'}%`, 26, 100);
        ctx.fillStyle = b.live?.alarm_count ? '#f87171' : '#4ade80';
        ctx.fillText(`${b.live?.alarm_count ? `${b.live.alarm_count} active alarm` : 'nominal'} · ${b.live?.kwh ?? '—'} kWh`, 26, 132);
        ctx.font = 'bold 20px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
        ctx.fillText('▸ Click for full 3-D twin', 26, 166);
      }, 480, 190, 34, 13.5);
      tooltip.material.map.dispose();
      tooltip.material.map = sp.material.map;
      tooltip.scale.copy(sp.scale);
      tooltip.material.needsUpdate = true;
      tooltip.position.set(entry.group.position.x, entry.bh + 8 + 6.75, entry.group.position.z);
      tooltip.visible = true;
    };

    /* ── ambient life: pedestrians + vehicles ─────────────────────────── */
    const pathMetrics = (wp) => {
      const cum = [0];
      for (let i = 1; i < wp.length; i++) cum.push(cum[i - 1] + Math.hypot(wp[i][0] - wp[i - 1][0], wp[i][1] - wp[i - 1][1]));
      return { wp, cum, total: cum[cum.length - 1] };
    };
    // multi-waypoint routes hugging the actual road/sidewalk network (not true
    // pathfinding, but people now turn corners along real roads instead of
    // teleporting in a straight line between two arbitrary points)
    const people = [];
    const personPickables = [];
    const PATHS = [
      [[toX(0) + 20, toZ(345)], [toX(1010) - 20, toZ(345)]],
      [[toX(285), toZ(20)], [toX(285), toZ(345)], [toX(285), toZ(640)]],
      [[toX(505), toZ(20)], [toX(505), toZ(345)], [toX(505), toZ(640)]],
      [[toX(570), toZ(505)], [toX(765), toZ(505)], [toX(960), toZ(505)]],
      [[toX(570), toZ(600)], [toX(765), toZ(600)], [toX(960), toZ(600)]],
      [[toX(748), toZ(388)], [toX(850), toZ(388)], [toX(950), toZ(388)]],
      [[toX(150), toZ(345)], [toX(150), toZ(175)]],
      [[toX(505), toZ(345)], [toX(505), toZ(640)]],
    ].map(pathMetrics);
    for (let i = 0; i < 16; i++) {
      const person = buildPerson(500 + i * 13);
      person.userData.path = PATHS[i % PATHS.length];
      person.userData.speed = 1.1 + mulberry32(900 + i)() * 0.6; // real walking pace, m/s
      person.userData.phase = mulberry32(700 + i)() * 10;
      person.userData.profile = makePersonProfile(2000 + i * 71, i);

      // hit-test radius is intentionally much bigger than the visual model —
      // a person is ~1.8m tall on a 1000m-wide site, so a literally-sized
      // target would be a couple of screen pixels at any normal zoom level
      // and effectively unclickable
      const hitbox = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 2.6, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitbox.position.y = 1.1;
      hitbox.userData = { kind: 'person', personIndex: i };
      person.add(hitbox);
      personPickables.push(hitbox);

      people.push(person);
      scene.add(person);
    }

    const vehicles = [];
    for (let i = 0; i < 4; i++) {
      const v = buildCar([0x4a5040, 0x8f8a7a, 0x37424c, 0xd8d4c8][i], 4000 + i);
      v.userData.lane = i % 2 === 0 ? toZ(345) - 6 : toZ(345) + 6;
      v.userData.speed = 22 + i * 6;
      v.userData.phase = i * 130;
      vehicles.push(v);
      scene.add(v);
    }

    /* ── raycasting: hover + click (buildings + pedestrians) ───────────── */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoveredId = null;
    let downPt = null;

    const pickAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([...pickables, ...personPickables], false);
      if (!hits.length) return null;
      const obj = hits[0].object;
      return obj.userData.kind === 'person'
        ? { kind: 'person', personIndex: obj.userData.personIndex }
        : { kind: 'building', buildingId: obj.userData.buildingId };
    };
    const onPointerMove = (e) => {
      const hit = pickAt(e.clientX, e.clientY);
      const id = hit?.kind === 'building' ? hit.buildingId : null;
      if (id !== hoveredId) {
        hoveredId = id;
        refreshTooltip(id ? buildingIndex.get(id) : null);
      }
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    };
    const onPointerDown = (e) => { downPt = { x: e.clientX, y: e.clientY }; };
    const onPointerUp = (e) => {
      if (!downPt) return;
      const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
      downPt = null;
      if (dist > 6) return;
      const hit = pickAt(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.kind === 'building') onSelectBuilding(buildingIndex.get(hit.buildingId).building);
      else {
        const personObj = people[hit.personIndex];
        setPersonPanel({ ...derivePersonLive(personObj.userData.profile, personObj), _idx: hit.personIndex });
      }
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.style.cursor = 'grab';

    /* ── resize ────────────────────────────────────────────────────────── */
    const ro = new ResizeObserver(() => {
      const nw = cont.clientWidth, nh = cont.clientHeight;
      if (nw < 2 || nh < 2) return;
      w = nw; h = nh;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(cont);

    /* ── animation loop ───────────────────────────────────────────────── */
    let raf;
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();

      trees.forEach((tree) => {
        tree.userData.foliage.rotation.z = Math.sin(t * 0.55 + tree.userData.swaySeed) * 0.03;
      });

      flags.forEach((flag, fi) => {
        const posAttr = flag.geometry.attributes.position;
        const base = flag.geometry.userData.base;
        for (let vi = 0; vi < posAttr.count; vi++) {
          const bx = base[vi * 3], by = base[vi * 3 + 1], bz = base[vi * 3 + 2];
          posAttr.array[vi * 3 + 2] = bz + Math.sin(t * 3.2 + bx * 1.6 + fi) * 0.1 * bx + Math.sin(t * 1.7 + by * 2 + fi) * 0.03;
        }
        posAttr.needsUpdate = true;
      });

      rTex.offset.x = (t * 0.015) % 1;
      rTex.offset.y = (t * 0.008) % 1;

      lamps.forEach((lamp, i) => {
        const flick = (1.1 + Math.sin(t * 3 + i) * 0.15) * lampBoost;
        lamp.userData.bulb.material.emissiveIntensity = flick;
      });

      buildingIndex.forEach((entry) => {
        if (entry.beacon) {
          const s = 0.7 + Math.abs(Math.sin(t * 3.4)) * 0.5;
          entry.beacon.scale.setScalar(s);
        }
      });

      people.forEach((p) => {
        const path = p.userData.path;
        const total = path.total;
        const sRaw = (t * p.userData.speed + p.userData.phase) % (2 * total);
        const outbound = sRaw <= total;
        const s = outbound ? sRaw : 2 * total - sRaw;
        let segI = 0;
        while (segI < path.cum.length - 2 && path.cum[segI + 1] < s) segI++;
        const segStart = path.cum[segI], segEnd = path.cum[segI + 1];
        const localFrac = segEnd > segStart ? (s - segStart) / (segEnd - segStart) : 0;
        const [ax, az] = path.wp[segI], [bx, bz] = path.wp[segI + 1];
        const dirSign = outbound ? 1 : -1;
        p.position.set(ax + (bx - ax) * localFrac, 0, az + (bz - az) * localFrac);
        p.rotation.y = Math.atan2((bx - ax) * dirSign, (bz - az) * dirSign);
        const walk = Math.sin(t * p.userData.walkFreq + p.userData.walkSeed) * 0.5;
        p.userData.legL.rotation.x = walk; p.userData.legR.rotation.x = -walk;
        p.userData.armL.rotation.x = -walk; p.userData.armR.rotation.x = walk;
      });

      cctvs.forEach((c) => { c.userData.head.rotation.y = Math.sin(t * 0.4 + c.userData.panSeed) * 0.6; });
      iotSensors.forEach((s) => {
        s.userData.led.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 2.2 + s.userData.blinkSeed)) * 0.9;
        if (s.userData.spin) s.userData.spin.rotation.y = t * 3.5;
      });

      const raining = weatherRef.current === 'rain';
      rain.visible = raining;
      if (raining) {
        const pos = rainGeo.attributes.position;
        for (let i = 0; i < RAIN_COUNT; i++) {
          let y = pos.array[i * 3 + 1] - 9;
          if (y < 0) y = 240 + Math.random() * 20;
          pos.array[i * 3 + 1] = y;
        }
        pos.needsUpdate = true;
      }

      vehicles.forEach((v) => {
        const span = SITE_W - 40;
        const cyc = ((t * v.userData.speed + v.userData.phase) % (span * 2));
        const outbound = cyc < span;
        const d = outbound ? cyc : span * 2 - cyc;
        v.position.set(toX(20) + d, 0, v.userData.lane);
        v.rotation.y = outbound ? Math.PI / 2 : -Math.PI / 2;
      });

      /* ── camera mode: drone (default orbit) / walk (first-person) / follow ── */
      const mode = cameraModeRef.current;
      if (mode !== prevCameraMode) {
        if (mode === 'walk') {
          controls.enabled = false;
          camera.position.set(gx, 1.75, gz + 26);
          walkState.yaw = Math.PI; walkState.pitch = -0.05;
          renderer.domElement.requestPointerLock?.();
        } else {
          if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
          controls.enabled = true;
          controls.target.copy(droneTarget);
        }
        prevCameraMode = mode;
      }

      if (mode === 'walk') {
        const forward = new THREE.Vector3(-Math.sin(walkState.yaw), 0, -Math.cos(walkState.yaw));
        const right = new THREE.Vector3(Math.cos(walkState.yaw), 0, -Math.sin(walkState.yaw));
        const move = new THREE.Vector3();
        if (walkKeys.has('KeyW') || walkKeys.has('ArrowUp')) move.add(forward);
        if (walkKeys.has('KeyS') || walkKeys.has('ArrowDown')) move.sub(forward);
        if (walkKeys.has('KeyA') || walkKeys.has('ArrowLeft')) move.sub(right);
        if (walkKeys.has('KeyD') || walkKeys.has('ArrowRight')) move.add(right);
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(0.22);
          camera.position.add(move);
          camera.position.x = Math.max(-495, Math.min(495, camera.position.x));
          camera.position.z = Math.max(-320, Math.min(320, camera.position.z));
        }
        camera.position.y = 1.75;
        const look = camera.position.clone().add(new THREE.Vector3(
          -Math.sin(walkState.yaw) * Math.cos(walkState.pitch),
          Math.sin(walkState.pitch),
          -Math.cos(walkState.yaw) * Math.cos(walkState.pitch),
        ));
        camera.lookAt(look);
      } else {
        if (mode === 'follow' && vehicles[0]) {
          const vp = vehicles[0].position;
          controls.target.lerp(new THREE.Vector3(vp.x, vp.y + 1.4, vp.z), 0.05);
        }
        controls.update();
      }

      renderer.render(scene, camera);
    };
    loop();

    stateRef.current = { applyMetricTint, applyTimeOfDay, people };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMoveLocked);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      controls.dispose();
      envTex.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); });
        }
      });
      renderer.dispose();
      if (cont.contains(renderer.domElement)) cont.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings]);

  useEffect(() => {
    stateRef.current?.applyMetricTint();
  }, [metric]);

  useEffect(() => {
    stateRef.current?.applyTimeOfDay(timeOfDay);
  }, [timeOfDay]);

  // while a person's dashboard is open, refresh their "live" telemetry periodically
  useEffect(() => {
    const idx = personPanel?._idx;
    if (idx == null) return undefined;
    const iv = setInterval(() => {
      const personObj = stateRef.current?.people?.[idx];
      if (!personObj) return;
      setPersonPanel((prev) => (prev ? { ...derivePersonLive(personObj.userData.profile, personObj), _idx: idx } : prev));
    }, 1500);
    return () => clearInterval(iv);
  }, [personPanel?._idx]);

  const toggleBtn = (active) => ({
    padding: '4px 9px', fontSize: 10, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
    border: '1px solid ' + (active ? 'rgba(59,125,232,0.6)' : 'rgba(255,255,255,0.18)'),
    background: active ? 'rgba(59,125,232,0.28)' : 'rgba(10,10,14,0.55)',
    color: active ? '#bcd6ff' : 'rgba(230,238,246,0.75)',
  });

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1010 / 660', background: '#111a26' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* time-of-day / weather / camera-mode controls */}
      <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['day', 'dusk', 'night'].map((td) => (
            <button key={td} onClick={() => setTimeOfDay(td)} style={toggleBtn(timeOfDay === td)}>{td[0].toUpperCase() + td.slice(1)}</button>
          ))}
          <button onClick={() => setWeather((w) => (w === 'rain' ? 'clear' : 'rain'))} style={toggleBtn(weather === 'rain')}>
            {weather === 'rain' ? 'Rain' : 'Clear'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['drone', 'walk', 'follow'].map((cm) => (
            <button key={cm} onClick={() => setCameraMode(cm)} style={toggleBtn(cameraMode === cm)}>{cm[0].toUpperCase() + cm.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* synthetic Garmin-style health dashboard for a clicked pedestrian */}
      {personPanel && (
        <div style={{ position: 'absolute', top: 76, left: 16, width: 250, background: 'rgba(8,12,20,0.94)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 14px', color: '#e8eef5', fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{personPanel.name}</div>
              <div style={{ color: '#9fb2c6', fontSize: 10 }}>{personPanel.role} · {personPanel.dept}</div>
            </div>
            <button onClick={() => setPersonPanel(null)} style={{ background: 'none', border: 'none', color: '#9fb2c6', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
          </div>
          <div style={{ fontSize: 9.5, color: '#6a8aaa', marginBottom: 8 }}>{personPanel.employeeId} · {personPanel.shift}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
            <Stat label="Heart rate" value={`${personPanel.hr} bpm`} />
            <Stat label="SpO₂" value={`${personPanel.spo2}%`} />
            <Stat label="Body temp" value={`${personPanel.temp.toFixed(1)}°C`} />
            <Stat label="Stress" value={personPanel.stress} />
            <Stat label="Battery" value={`${personPanel.battery}%`} />
            <Stat label="Steps today" value={personPanel.steps.toLocaleString()} />
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 9, color: '#6a8aaa' }}>
            GPS {personPanel.lat.toFixed(5)}, {personPanel.lon.toFixed(5)} · synthetic demo telemetry
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', top: 14, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(10,10,14,0.55)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <polygon points="11,2 14,11 11,9 8,11" fill="#ef4444" />
          <polygon points="11,20 14,11 11,13 8,11" fill="#e8eef5" />
        </svg>
        <span style={{ position: 'absolute', top: -2, fontSize: 8, fontWeight: 700, color: '#e8eef5' }}>N</span>
      </div>

      <div style={{ position: 'absolute', bottom: 14, left: 16, pointerEvents: 'none', color: '#e8eef5' }}>
        <svg width="130" height="16">
          <line x1="0" y1="8" x2="120" y2="8" stroke="#e8eef5" strokeWidth="2" />
          <line x1="0" y1="4" x2="0" y2="12" stroke="#e8eef5" strokeWidth="2" />
          <line x1="60" y1="5" x2="60" y2="11" stroke="#e8eef5" strokeWidth="1.5" />
          <line x1="120" y1="4" x2="120" y2="12" stroke="#e8eef5" strokeWidth="2" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: 120, fontSize: 8, color: '#9fb2c6', marginTop: 2 }}>
          <span>0</span><span>100 m</span>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 14, right: 16, fontSize: 9.5, color: 'rgba(230,238,246,0.55)', pointerEvents: 'none', textAlign: 'right', maxWidth: 240 }}>
        {cameraMode === 'walk' ? 'WASD to move · mouse to look · click Drone to exit' : cameraMode === 'follow' ? 'following a patrol vehicle · drag/scroll to look around' : 'drone / orbit camera · click a person for their health dashboard'}
      </div>
    </div>
  );
}
