import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Real natural=tree points, GPU-instanced. Zero rows exist in zmu_db for
// this site today (verified directly), so setTrees([]) leaves zero
// instances and nothing renders — but the InstancedMesh + per-instance
// random variation + wind-sway animation is fully wired for the moment
// real tree points are imported, at no extra frontend cost per tree.
// Uses the shared ProjectionService — no independent projection math.
export function createTreeLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  const MAX_TREES = 2000;

  let scene, camera, renderer, mesh, mapRef;
  let visible = true;
  let count = 0;
  let phases = new Float32Array(MAX_TREES);
  let scales = new Float32Array(MAX_TREES);
  let bases = [];
  const dummy = new THREE.Object3D();
  const clock = new THREE.Clock();

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapRef = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0x88ffcc, 1.0));

      const trunk = new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6);
      trunk.translate(0, 0.8, 0);
      const canopy = new THREE.ConeGeometry(1.1, 2.4, 7);
      canopy.translate(0, 2.4, 0);
      const geometry = geometryMerge(trunk, canopy);
      // Ground-plane convention: X=east, Y=north, Z=up (matches
      // BuildingLayer.jsx) — stand the tree upright: local-Y becomes world-Z.
      geometry.rotateX(Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ color: 0x2fbf6f, roughness: 0.8 });
      mesh = new THREE.InstancedMesh(geometry, material, MAX_TREES);
      mesh.count = 0;
      scene.add(mesh);

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setTrees(fc) {
      const features = (fc?.features || []).slice(0, MAX_TREES);
      count = features.length;
      mesh.count = count;
      bases = features.map((f) => projection.projectCoordinate(f.geometry.coordinates[0], f.geometry.coordinates[1]));
      for (let i = 0; i < count; i++) {
        phases[i] = Math.random() * Math.PI * 2;
        scales[i] = 0.8 + Math.random() * 0.5;
        dummy.position.set(bases[i][0], bases[i][1], 0);
        dummy.rotation.z = phases[i];
        dummy.scale.setScalar(scales[i]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;

      // Gentle per-instance wind sway — rotates each tree a few degrees
      // around a phase-shifted sine wave so the canopy doesn't move in lockstep.
      if (count) {
        const t = clock.getElapsedTime();
        for (let i = 0; i < count; i++) {
          dummy.position.set(bases[i][0], bases[i][1], 0);
          dummy.rotation.z = phases[i] + Math.sin(t * 0.6 + phases[i]) * 0.05;
          dummy.scale.setScalar(scales[i]);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }

      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
      if (visible && count) mapRef.triggerRepaint();
    },
  };
}

function geometryMerge(a, b) {
  // Minimal manual merge (avoids an extra three/examples import): just
  // group both geometries under one Group-like BufferGeometry via a simple
  // concat of position/normal attributes with matching index offsets.
  const merged = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const indices = [];
  let offset = 0;
  for (const geo of [a, b]) {
    const pos = geo.attributes.position.array;
    const norm = geo.attributes.normal.array;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    for (let i = 0; i < norm.length; i++) normals.push(norm[i]);
    const idx = geo.index ? geo.index.array : null;
    const vertCount = pos.length / 3;
    if (idx) for (let i = 0; i < idx.length; i++) indices.push(idx[i] + offset);
    else for (let i = 0; i < vertCount; i++) indices.push(i + offset);
    offset += vertCount;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}
