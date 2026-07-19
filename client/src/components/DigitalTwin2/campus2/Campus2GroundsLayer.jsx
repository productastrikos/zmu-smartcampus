import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import { kerbMesh } from './siteFurniture';

// Campus 2's real football grounds (campus2/football_ground_1,
// football_ground_2.geojson — from zmu_campus_2_02.txt's plain outline
// polygons). Not part of the Phase 3A detail pass (parking/courts/parade
// ground moved to their own dedicated layers — Campus2ParkingLayer.jsx,
// Campus2CourtsLayer.jsx, Campus2ParadeGroundLayer.jsx); these keep the
// simpler turf-fill + kerb treatment since the source has no goal/marking
// coordinates for them.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setGrounds,
// setVisible, render}.

const TURF_GREEN = 0x2e7d32;

export function createCampus2GroundsLayer({ id, anchor }) {
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
      scene.add(new THREE.AmbientLight(0xdfe8f0, 0.8));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fcs` = array of football_ground_N.geojson FeatureCollections.
    setGrounds(fcs) {
      root.clear();
      for (const fc of fcs) {
        for (const f of fc?.features || []) {
          if (f.geometry?.type !== 'Polygon') continue;
          const mat = new THREE.MeshStandardMaterial({ color: TURF_GREEN, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide });

          const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
          const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
          const geo = new THREE.ShapeGeometry(shape);
          geo.translate(0, 0, 0.02);
          root.add(new THREE.Mesh(geo, mat));
          root.add(kerbMesh(ring, { height: 0.1, width: 0.18 }));
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
