import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Campus 2's real boundary ring (campus2/campus_boundary.geojson, straight
// from zmu_campus_2.txt — the same anchor/projection as every other layer
// in this module, so it sits at its true real-world position relative to
// the existing Campus 1 geometry). Rendered exactly as specced: a thin
// dark-grey outline with a transparent fill — no pulse, no fill mesh.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setBoundary,
// setVisible, render}.
export function createCampus2BoundaryLayer({ id, anchor }) {
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
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    setBoundary(fc) {
      root.clear();
      const feature = fc?.features?.[0];
      if (!feature || feature.geometry?.type !== 'LineString') return;
      const pts = feature.geometry.coordinates.map(([lon, lat]) => {
        const [x, y] = projection.projectCoordinate(lon, lat);
        return new THREE.Vector3(x, y, 0.05);
      });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.85 });
      root.add(new THREE.Line(geo, mat));
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
