import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import {
  orientedBoundingBox, offsetRing, ringStripMesh, kerbMesh, instancedPalmTrees,
  makeCompactedSoilTexture, makeConcreteTexture, paintLine,
} from './siteFurniture';

// Campus 2's real parade/training ground
// (campus2/parade_ground_training_area.geojson, from zmu_campus_2_02.txt's
// single "parade ground/ training area" polygon) — Phase 3A rebuild. The
// real footprint is the ground's exact outer boundary; everything inside
// it (compacted-soil texture, marching guide lines, assembly markings,
// flag pole, reviewing platform) and around it (concrete edge, walking
// path, palm trees) is generated within/around that real boundary, aligned
// to its own oriented bounding box.
//
// A Three.js "custom" MapLibre layer: {id, type:'custom',
// renderingMode:'3d', onAdd, setGround, setVisible, render}.

function shapeFromRing(ring) {
  return new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
}

function flagPole(pos) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8dbdd, metalness: 0.6, roughness: 0.35 });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 6, 8);
  poleGeo.translate(0, 3, 0);
  poleGeo.rotateX(Math.PI / 2);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(pos[0], pos[1], 0);
  group.add(pole);

  const flagMat = new THREE.MeshStandardMaterial({ color: 0x1c8a4a, side: THREE.DoubleSide, roughness: 0.7 });
  const flagGeo = new THREE.PlaneGeometry(1.1, 0.7);
  flagGeo.translate(0.55, -0.35, 0);
  flagGeo.rotateX(Math.PI / 2);
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(pos[0], pos[1], 5.6);
  group.add(flag);

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.85 });
  const baseGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.2, 12);
  baseGeo.rotateX(Math.PI / 2);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(pos[0], pos[1], 0.1);
  group.add(base);

  return group;
}

function reviewingPlatform(toWorld, u, v, w, d) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb9beC4, roughness: 0.85 });
  const ring = [toWorld(u - w / 2, v - d / 2), toWorld(u + w / 2, v - d / 2), toWorld(u + w / 2, v + d / 2), toWorld(u - w / 2, v + d / 2)];
  const geo = new THREE.ExtrudeGeometry(shapeFromRing(ring), { depth: 0.6, bevelEnabled: false, curveSegments: 1 });
  group.add(new THREE.Mesh(geo, mat));
  const edgesGeo = new THREE.EdgesGeometry(geo, 20);
  group.add(new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x5b6066 })));
  // simple railing along the front edge
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.5, roughness: 0.4 });
  const railGeo = new THREE.BoxGeometry(w, 0.06, 0.06);
  railGeo.rotateX(Math.PI / 2);
  const front = toWorld(u, v - d / 2);
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.position.set(front[0], front[1], 1.0);
  group.add(rail);
  return group;
}

export function createCampus2ParadeGroundLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0xe8e0d0, 0.9));
      const sun = new THREE.DirectionalLight(0xfff2d8, 0.6);
      sun.position.set(50, 80, 100);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fc` = parade_ground_training_area.geojson's single-feature FeatureCollection.
    setGround(fc) {
      root.clear();
      const f = fc?.features?.[0];
      if (f?.geometry?.type !== 'Polygon') return;
      const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
      const obb = orientedBoundingBox(ring);
      const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
      const toWorld = (u, v) => [obb.center[0] + u * cos - v * sin, obb.center[1] + u * sin + v * cos];

      // Compacted soil/gravel surface — the real footprint, textured.
      const soilTex = makeCompactedSoilTexture();
      const soilMat = new THREE.MeshStandardMaterial({ map: soilTex, roughness: 0.95 });
      const fillGeo = new THREE.ShapeGeometry(shapeFromRing(ring));
      const pos = fillGeo.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 10; uv[i * 2 + 1] = pos.getY(i) / 10; }
      fillGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      fillGeo.translate(0, 0, 0.01);
      root.add(new THREE.Mesh(fillGeo, soilMat));

      // Marching guide lines — parallel lines spanning most of the ground,
      // spaced every ~5m along the short axis, plus assembly markings (a
      // grid of small square tick marks) near one end.
      const LINE_COLOR = 0xe8ddc0;
      for (let v = -obb.halfH + 4; v < obb.halfH - 2; v += 5) {
        root.add(paintLine(toWorld(-obb.halfW * 0.85, v), toWorld(obb.halfW * 0.85, v), 0.1, LINE_COLOR, 0.03));
      }
      const gridV = -obb.halfH + 3;
      for (let u = -obb.halfW * 0.7; u <= obb.halfW * 0.7; u += 2.5) {
        root.add(paintLine(toWorld(u, gridV - 0.4), toWorld(u, gridV + 0.4), 0.08, LINE_COLOR, 0.03));
      }

      // Flag pole + small reviewing platform at the "front" of the ground.
      root.add(flagPole(toWorld(0, -obb.halfH - 1.2)));
      root.add(reviewingPlatform(toWorld, obb.halfW * 0.6, -obb.halfH + 2, 6, 3));

      // Concrete edge + walking path + palm trees outside — no grass
      // inside the ground itself, per the brief.
      root.add(kerbMesh(ring, { height: 0.15, width: 0.25, color: 0x9a9d9f }));
      const kerbOuter = offsetRing(ring, 0.25);
      const walkOuter = offsetRing(kerbOuter, 2.2);
      const concreteTex = makeConcreteTexture();
      const walkMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
      const walkMesh = ringStripMesh(kerbOuter, walkOuter, 0.02, walkMat);
      const wpos = walkMesh.geometry.attributes.position;
      const wuv = new Float32Array(wpos.count * 2);
      for (let i = 0; i < wpos.count; i++) { wuv[i * 2] = wpos.getX(i) / 2; wuv[i * 2 + 1] = wpos.getY(i) / 2; }
      walkMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
      root.add(walkMesh);

      const landscapeOuter = offsetRing(walkOuter, 2);
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.95 });
      root.add(ringStripMesh(walkOuter, landscapeOuter, 0.015, grassMat));
      root.add(instancedPalmTrees(landscapeOuter.filter((_, i) => i % 2 === 0)));
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
