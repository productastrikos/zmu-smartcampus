import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';

// Campus 2's 5 simple roundabouts (campus2/roundabouts.geojson — North,
// East, South, South-West, North-West — see txtToGeojson.js's
// buildSimpleRoadNetwork()), each a flat asphalt-coloured disc matching
// the road network's own colour, sized from the polygon's own real radius
// (never a hardcoded on-screen constant). No landscaping/kerb detail yet
// per the brief — that can layer in later the same way every other phase
// in this module has.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd,
// setRoundabouts, setVisible, render}.

const ASPHALT_COLOR = 0x4a4a4a; // matches Campus2RoadLayer.jsx

export function createCampus2RoundaboutLayer({ id, anchor }) {
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

    // `fc` = campus2/roundabouts.geojson's FeatureCollection.
    setRoundabouts(fc) {
      root.clear();
      const mat = new THREE.MeshStandardMaterial({ color: ASPHALT_COLOR, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide });
      for (const f of fc?.features || []) {
        if (f.geometry?.type !== 'Polygon') continue;
        const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
        const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
        const geo = new THREE.ShapeGeometry(shape);
        geo.translate(0, 0, 0.03);
        root.add(new THREE.Mesh(geo, mat));
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
