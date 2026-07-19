import * as THREE from 'three';

// Shared procedural-detail building blocks for Campus 2's outdoor facility
// layers (parking, sports courts, parade ground) — every facility's real
// digitized outer footprint stays exactly as-is; everything here only adds
// realistic sub-detail WITHIN that real boundary (bay grids, kerbs, trees,
// lamp posts, markings), never invents a facility's location or extent.

// --- geometry helpers -------------------------------------------------

export function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function ringCentroid(ring) {
  const x = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const y = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return [x, y];
}

// Standard even-odd point-in-polygon test, local [x,z] meters.
export function pointInRing([px, pz], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    const hit = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

// Rotating-calipers oriented bounding box of a ring's convex hull — used to
// align a parking bay grid / court markings to the real footprint's own
// dominant edge direction instead of true-north, the way an actual site
// plan would be laid out along its access road.
function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
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

export function orientedBoundingBox(ring) {
  const hull = convexHull(ring);
  if (hull.length < 3) {
    const cx = ringCentroid(ring);
    return { center: cx, angle: 0, halfW: 10, halfH: 10 };
  }
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of hull) {
      const rx = x * cos - y * sin, ry = x * sin + y * cos;
      if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (!best || area < best.area) {
      const cosB = Math.cos(angle), sinB = Math.sin(angle);
      const localCx = (minX + maxX) / 2, localCy = (minY + maxY) / 2;
      const center = [localCx * cosB - localCy * sinB, localCx * sinB + localCy * cosB];
      best = { area, angle, halfW: (maxX - minX) / 2, halfH: (maxY - minY) / 2, center };
    }
  }
  return best;
}

// Outward offset of a closed ring by `dist` metres (mitred normals, same
// technique Campus2RoadLayer.jsx uses for road ribbons) — the basis for
// kerbs/sidewalks/grass buffers that trace a facility's real boundary
// rather than a separately-invented shape.
export function offsetRing(ring, dist) {
  const n = ring.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n], curr = ring[i], next = ring[(i + 1) % n];
    const d1 = [curr[0] - prev[0], curr[1] - prev[1]];
    const d2 = [next[0] - curr[0], next[1] - curr[1]];
    const len1 = Math.hypot(...d1) || 1, len2 = Math.hypot(...d2) || 1;
    const n1 = [-d1[1] / len1, d1[0] / len1];
    const n2 = [-d2[1] / len2, d2[0] / len2];
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    let mlen = Math.hypot(mx, my);
    if (mlen < 1e-4) { mx = n1[0]; my = n1[1]; mlen = 1; }
    mx /= mlen; my /= mlen;
    const cosHalf = Math.max(0.4, n1[0] * mx + n1[1] * my);
    const scale = Math.min(2.5, 1 / cosHalf);
    out.push([curr[0] + mx * scale * dist, curr[1] + my * scale * dist]);
  }
  return out;
}

// A flat ring "strip" mesh between a ring and its offset — used for kerbs,
// grass buffers, and sidewalks that hug a real facility boundary.
export function ringStripMesh(innerRing, outerRing, z, material) {
  const n = innerRing.length;
  const positions = [], indices = [];
  for (let i = 0; i < n; i++) {
    positions.push(innerRing[i][0], innerRing[i][1], z, outerRing[i][0], outerRing[i][1], z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = ((i + 1) % n) * 2, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// A real extruded kerb — a thin raised strip along a ring, not a flat line.
export function kerbMesh(ring, { height = 0.15, width = 0.25, color = 0x8a8f96 } = {}) {
  const inner = ring;
  const outer = offsetRing(ring, width);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  group.add(ringStripMesh(inner, outer, height, mat));
  // vertical outer face so the kerb reads as a raised edge, not a flat pad
  const n = ring.length;
  const facePositions = [], faceIndices = [];
  for (let i = 0; i < n; i++) {
    facePositions.push(outer[i][0], outer[i][1], 0, outer[i][0], outer[i][1], height);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = ((i + 1) % n) * 2, d = c + 1;
    faceIndices.push(a, c, b, b, c, d);
  }
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
  faceGeo.setIndex(faceIndices);
  faceGeo.computeVertexNormals();
  group.add(new THREE.Mesh(faceGeo, mat));
  return group;
}

// --- textures -----------------------------------------------------------

// Dark asphalt with subtle noise speckling, faint oil-stain blotches and
// hairline cracks baked into one repeating canvas texture — not a flat
// colour fill.
export function makeAsphaltTexture() {
  const w = 256, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#26282c';
  ctx.fillRect(0, 0, w, h);
  // speckle noise
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const v = 20 + Math.random() * 25;
    ctx.fillStyle = `rgba(${v + 10},${v + 10},${v + 12},${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(x, y, 1, 1);
  }
  // oil stain blotches
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 22;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(10,10,12,0.35)');
    grad.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // hairline cracks
  ctx.strokeStyle = 'rgba(12,12,14,0.4)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Compacted desert-sand/gravel texture for the parade ground — beige base,
// fine grain speckling, very subtle tire-mark streaks.
export function makeCompactedSoilTexture() {
  const w = 256, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c7b48d';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const v = Math.random() * 30 - 15;
    const c = Math.max(0, Math.min(255, 199 + v));
    ctx.fillStyle = `rgba(${c},${c - 15},${c - 45},${0.25 + Math.random() * 0.25})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = 'rgba(150,132,100,0.18)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const y = 40 + i * 70 + Math.random() * 20;
    ctx.beginPath(); ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 10, w, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Light-grey concrete with faint expansion-joint lines for sidewalks.
export function makeConcreteTexture() {
  const w = 128, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#aab0b6';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const v = 150 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v + 3},0.25)`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = 'rgba(120,126,132,0.7)';
  ctx.lineWidth = 1.4;
  for (const p of [0, w / 2, w]) { ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// --- instanced landscaping / street furniture ---------------------------

// Low-poly palm tree: a tapered trunk + a cluster of angled frond cones —
// instanced so any number of placements cost one draw call each.
export function instancedPalmTrees(points, { scale = 1 } = {}) {
  const group = new THREE.Group();
  if (!points.length) return group;
  const trunkGeo = new THREE.CylinderGeometry(0.12 * scale, 0.22 * scale, 3.4 * scale, 6);
  trunkGeo.translate(0, 1.7 * scale, 0);
  trunkGeo.rotateX(Math.PI / 2);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5335, roughness: 0.9 });
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, points.length);

  const frondGeo = new THREE.ConeGeometry(0.35 * scale, 2.2 * scale, 5, 1, true);
  frondGeo.translate(0, 1.1 * scale, 0);
  frondGeo.rotateX(Math.PI / 2);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.8, side: THREE.DoubleSide });
  const frondsPerTree = 6;
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, points.length * frondsPerTree);

  const dummy = new THREE.Object3D();
  let fi = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    dummy.position.set(x, z, 0);
    dummy.rotation.z = (i * 0.7) % (Math.PI * 2);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    for (let f = 0; f < frondsPerTree; f++) {
      dummy.position.set(x, z, 3.4 * scale);
      const a = (f / frondsPerTree) * Math.PI * 2;
      dummy.rotation.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, a);
      dummy.updateMatrix();
      fronds.setMatrixAt(fi++, dummy.matrix);
    }
  }
  trunk.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;
  group.add(trunk, fronds);
  return group;
}

// Modern campus light pole — tapered pole + a small horizontal head.
export function instancedLampPosts(points, { height = 5.5 } = {}) {
  const group = new THREE.Group();
  if (!points.length) return group;
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, height, 8);
  poleGeo.translate(0, height / 2, 0);
  poleGeo.rotateX(Math.PI / 2);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.6, roughness: 0.4 });
  const pole = new THREE.InstancedMesh(poleGeo, poleMat, points.length);

  const headGeo = new THREE.BoxGeometry(0.5, 0.16, 0.16);
  headGeo.translate(0.22, 0, 0);
  headGeo.rotateX(Math.PI / 2);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xdcefff, emissive: 0x6fbfff, emissiveIntensity: 0.5, roughness: 0.3 });
  const head = new THREE.InstancedMesh(headGeo, headMat, points.length);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < points.length; i++) {
    const [x, z, rot] = points[i];
    dummy.position.set(x, z, 0);
    dummy.rotation.z = rot || 0;
    dummy.updateMatrix();
    pole.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, z, height);
    dummy.updateMatrix();
    head.setMatrixAt(i, dummy.matrix);
  }
  pole.instanceMatrix.needsUpdate = true;
  head.instanceMatrix.needsUpdate = true;
  group.add(pole, head);
  return group;
}

// Chain-link perimeter fencing — a thinner, simpler cousin of Campus 1's
// FenceLayer.jsx (same diamond-mesh canvas-texture technique) sized for a
// sports court's low boundary fence rather than a security perimeter.
export function makeChainLinkTexture() {
  const w = 64, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(140,150,160,0.12)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(220,226,232,0.85)';
  ctx.lineWidth = 1;
  const cell = 8;
  for (let x = -h; x <= w; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function courtFenceMesh(ring, { height = 3, postSpacing = 3 } = {}) {
  const group = new THREE.Group();
  const tex = makeChainLinkTexture();
  tex.repeat.set(1, 1);
  const panelMat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xd7dde3, transparent: true, opacity: 0.9, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5,
  });
  const n = ring.length;
  const positions = [], uvs = [], indices = [];
  let cum = 0, vc = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u1 = cum / postSpacing, u2 = (cum + segLen) / postSpacing;
    positions.push(a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], height, a[0], a[1], height);
    uvs.push(u1, 0, u2, 0, u2, 1, u1, 1);
    indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
    vc += 4;
    cum += segLen;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, panelMat));

  // posts
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.5, roughness: 0.5 });
  const postGeo = new THREE.CylinderGeometry(0.04, 0.05, height, 6);
  postGeo.translate(0, height / 2, 0);
  postGeo.rotateX(Math.PI / 2);
  const postPoints = [];
  cum = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = postSpacing - (cum % postSpacing);
    while (d < segLen) {
      const t = d / segLen;
      postPoints.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += postSpacing;
    }
    cum += segLen;
  }
  if (postPoints.length) {
    const posts = new THREE.InstancedMesh(postGeo, postMat, postPoints.length);
    const dummy = new THREE.Object3D();
    postPoints.forEach((p, i) => { dummy.position.set(p[0], p[1], 0); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix); });
    posts.instanceMatrix.needsUpdate = true;
    group.add(posts);
  }
  return group;
}

// A single painted line as a thin extruded strip (real, slightly-raised
// geometry, not a flat texture decal) — the basis for every court/parking
// marking below.
export function paintLine(p1, p2, width, color, z = 0.03) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * width / 2, ny = dx / len * width / 2;
  const positions = [
    p1[0] + nx, p1[1] + ny, z, p1[0] - nx, p1[1] - ny, z,
    p2[0] - nx, p2[1] - ny, z, p2[0] + nx, p2[1] + ny, z,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

// A painted arc/circle outline (line, not filled) built from segments.
export function paintArc(center, radius, startAngle, endAngle, width, color, segments = 32, z = 0.03) {
  const group = new THREE.Group();
  const step = (endAngle - startAngle) / segments;
  for (let i = 0; i < segments; i++) {
    const a1 = startAngle + i * step, a2 = startAngle + (i + 1) * step;
    const p1 = [center[0] + Math.cos(a1) * radius, center[1] + Math.sin(a1) * radius];
    const p2 = [center[0] + Math.cos(a2) * radius, center[1] + Math.sin(a2) * radius];
    group.add(paintLine(p1, p2, width, color, z));
  }
  return group;
}
