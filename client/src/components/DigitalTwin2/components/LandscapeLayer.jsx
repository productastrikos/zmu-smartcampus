import * as THREE from 'three';

// Builds the decorative landscape scatter (shrubs/palms/flower beds/
// ground lights/stones/small palms/decorative trees) from
// WalkwayGenerator.generateCampusLayout()'s `landscapeZones` output —
// rejection-sampled points already confined to real walkable, non-
// obstacle campus space (see WalkwayGenerator.js for the placement
// algorithm). This module only builds geometry from those points; it
// owns no MapLibre layer/scene of its own — PedestrianLayer.jsx calls
// `buildLandscapeGroup()` and adds the returned THREE.Group into its own
// scene, keeping walkways and landscaping as separate files without a
// second renderer/WebGL context.

const MAX_INSTANCES = 500;

// Merges 2 geometries' position+normal data into one BufferGeometry.
// Always normalizes both inputs to non-indexed form first: mixing an
// indexed geometry (e.g. CylinderGeometry) with one THREE never indexes
// (e.g. IcosahedronGeometry/PolyhedronGeometry) made the old index-only-
// if-both-have-one logic silently drop the index buffer entirely,
// corrupting the indexed side into garbled/spiked geometry (its position
// array was only ever meant to be read through its own index). Same bug
// class as the fan-triangulation issue documented in PedestrianLayer.jsx
// — a hand-rolled geometry-combining shortcut breaking on an input shape
// it wasn't tested against.
export function mergeTwo(a, b) {
  const na = a.index ? a.toNonIndexed() : a;
  const nb = b.index ? b.toNonIndexed() : b;
  const ap = na.attributes.position.array, an = na.attributes.normal.array;
  const bp = nb.attributes.position.array, bn = nb.attributes.normal.array;
  const positions = new Float32Array(ap.length + bp.length);
  positions.set(ap, 0); positions.set(bp, ap.length);
  const normals = new Float32Array(an.length + bn.length);
  normals.set(an, 0); normals.set(bn, an.length);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geo;
}

// Ground-plane convention: X=east, Y=north, Z=up (matches BuildingLayer.jsx).
// Every geometry with a real vertical extent bakes `rotateX(Math.PI / 2)`
// once so its default local-Y height becomes world-Z.
function shrubGeometry() {
  return new THREE.IcosahedronGeometry(0.55, 0);
}
function palmGeometry() {
  const trunk = new THREE.CylinderGeometry(0.09, 0.14, 3.4, 6);
  trunk.translate(0, 1.7, 0);
  const frond = new THREE.ConeGeometry(1.1, 0.35, 5);
  frond.translate(0, 3.4, 0);
  const geo = mergeTwo(trunk, frond);
  geo.rotateX(Math.PI / 2);
  return geo;
}
function smallPalmGeometry() {
  const trunk = new THREE.CylinderGeometry(0.06, 0.1, 1.9, 6);
  trunk.translate(0, 0.95, 0);
  const frond = new THREE.ConeGeometry(0.65, 0.22, 5);
  frond.translate(0, 1.9, 0);
  const geo = mergeTwo(trunk, frond);
  geo.rotateX(Math.PI / 2);
  return geo;
}
function decorativeTreeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.08, 0.12, 1.3, 6);
  trunk.translate(0, 0.65, 0);
  const canopy = new THREE.IcosahedronGeometry(0.7, 0);
  canopy.translate(0, 1.55, 0);
  const geo = mergeTwo(trunk, canopy);
  geo.rotateX(Math.PI / 2);
  return geo;
}
function stoneGeometry() { return new THREE.DodecahedronGeometry(0.28, 0); }
function flowerBedGeometry() {
  const g = new THREE.CylinderGeometry(0.45, 0.5, 0.3, 8);
  g.translate(0, 0.15, 0);
  g.rotateX(Math.PI / 2);
  return g;
}
function groundLightGeometry() {
  const pole = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6);
  pole.translate(0, 0.45, 0);
  const head = new THREE.SphereGeometry(0.09, 8, 8);
  head.translate(0, 0.92, 0);
  const geo = mergeTwo(pole, head);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function buildInstancedKind(points, geometry, material, seedOffset) {
  const count = Math.min(points.length, MAX_INSTANCES);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const p = points[i];
    dummy.position.set(p[0], p[1], 0);
    const s = 0.8 + ((i * 37 + seedOffset) % 40) / 100; // deterministic pseudo-variation, no per-frame randomness
    dummy.scale.setScalar(s);
    dummy.rotation.z = ((i * 53 + seedOffset) % 360) * (Math.PI / 180);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildLandscapeGroup(landscapeZones) {
  const group = new THREE.Group();
  if (!landscapeZones?.length) return group;

  const byKind = { shrub: [], palm: [], small_palm: [], decorative_tree: [], flower_bed: [], ground_light: [], stone: [] };
  for (const z of landscapeZones) byKind[z.kind]?.push(z.point);

  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x3c8f52, roughness: 0.85 });
  if (byKind.shrub.length) group.add(buildInstancedKind(byKind.shrub, shrubGeometry(), shrubMat, 1));

  const palmMat = new THREE.MeshStandardMaterial({ color: 0x2f7d45, roughness: 0.8 });
  if (byKind.palm.length) group.add(buildInstancedKind(byKind.palm, palmGeometry(), palmMat, 7));

  const smallPalmMat = new THREE.MeshStandardMaterial({ color: 0x358a4d, roughness: 0.8 });
  if (byKind.small_palm.length) group.add(buildInstancedKind(byKind.small_palm, smallPalmGeometry(), smallPalmMat, 11));

  const decoTreeMat = new THREE.MeshStandardMaterial({ color: 0x35804a, roughness: 0.82 });
  if (byKind.decorative_tree.length) group.add(buildInstancedKind(byKind.decorative_tree, decorativeTreeGeometry(), decoTreeMat, 13));

  const flowerGeo = flowerBedGeometry();
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xd6537a, roughness: 0.7, vertexColors: true });
  const flowerMesh = buildInstancedKind(byKind.flower_bed, flowerGeo, flowerMat, 3);
  if (byKind.flower_bed.length) {
    const palette = [0xd6537a, 0xe8b23d, 0xf2f2f2, 0xc75ce0];
    for (let i = 0; i < flowerMesh.count; i++) flowerMesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    group.add(flowerMesh);
  }

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b8f94, roughness: 0.95 });
  if (byKind.stone.length) group.add(buildInstancedKind(byKind.stone, stoneGeometry(), stoneMat, 5));

  const lightMat = new THREE.MeshStandardMaterial({ color: 0x3f4a56, roughness: 0.6, emissive: 0xfff0c0, emissiveIntensity: 0.6 });
  if (byKind.ground_light.length) group.add(buildInstancedKind(byKind.ground_light, groundLightGeometry(), lightMat, 9));

  return group;
}
