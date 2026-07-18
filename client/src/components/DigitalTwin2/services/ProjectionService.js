import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

// The single shared GIS projection used by every Three.js layer in this
// twin (buildings, trees, ...). Every layer calls projectCoordinate() to
// go from real lon/lat to local scene metres, and applyToCamera() to turn
// that local frame into MapLibre's clip space each frame — one
// implementation, not a separate projection calculation per layer.
//
// Local frame: (east metres, north metres) relative to a single real-world
// anchor. Kept in ordinary float-friendly numbers (tens/hundreds of
// metres) instead of raw Mercator coordinates, which lose precision at
// building scale.
export function createProjection(anchor) {
  const [anchorLon, anchorLat] = anchor;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((anchorLat * Math.PI) / 180);
  const mercOrigin = maplibregl.MercatorCoordinate.fromLngLat(anchor, 0);
  const meterScale = mercOrigin.meterInMercatorCoordinateUnits();

  return {
    anchor,

    // lon/lat -> [eastMetres, northMetres] relative to the anchor.
    projectCoordinate(lon, lat) {
      return [(lon - anchorLon) * mPerDegLon, (lat - anchorLat) * mPerDegLat];
    },

    // The MapLibre-camera-matrix transform every Three.js custom layer's
    // render(gl, options) needs, applied in place to `camera`. Handles the
    // "world size" pixel-space scaling MapLibre v5's modelViewProjectionMatrix
    // expects, and keeps projectionMatrixInverse in sync (needed for
    // raycasting via Vector3.unproject, since this camera is a plain
    // THREE.Camera rather than a Perspective/OrthographicCamera).
    applyToCamera(camera, map, options) {
      const worldSize = map.transform.worldSize;
      const m = new THREE.Matrix4().fromArray(options.modelViewProjectionMatrix);
      const l = new THREE.Matrix4()
        .makeTranslation(mercOrigin.x * worldSize, mercOrigin.y * worldSize, (mercOrigin.z || 0) * worldSize)
        .scale(new THREE.Vector3(meterScale * worldSize, -meterScale * worldSize, meterScale * worldSize));
      camera.projectionMatrix = m.multiply(l);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    },
  };
}

// [[minLon, minLat], [maxLon, maxLat]] across every feature in one or more
// FeatureCollections — used both to centre the camera and to build
// map.fitBounds() args for "zoom to fit".
export function ringBBox(...fcs) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const fc of fcs) for (const f of fc?.features || []) {
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates
      : f.geometry.type === 'LineString' ? [f.geometry.coordinates]
      : f.geometry.type === 'Point' ? [[f.geometry.coordinates]]
      : [];
    for (const ring of rings) for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (minLon === Infinity) return null;
  return [[minLon, minLat], [maxLon, maxLat]];
}

export function ringBBoxCenter(fc) {
  const bbox = ringBBox(fc);
  if (!bbox) return null;
  const [[minLon, minLat], [maxLon, maxLat]] = bbox;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}
