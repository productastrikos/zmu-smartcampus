// Always-visible map icons for the CCTV network.
//
// CCTVLayer.jsx draws each camera as real, physically-scaled 3-D geometry
// (a 2.6 m pole with a 20 cm head). That is correct and looks right up
// close, but at campus zoom a 20 cm object is a couple of pixels — the
// cameras were effectively invisible, and their 3 m pick sphere was hard to
// hit. This layer adds a native MapLibre symbol marker per camera, drawn at
// a fixed PIXEL size so it stays legible at every zoom, coloured by the
// camera's health, and used as the hover/click target (queryRenderedFeatures
// against a real symbol layer is far more reliable than raycasting a small
// sphere). The 3-D camera geometry stays exactly as it was and still shows
// through underneath as you zoom in.
//
// Native MapLibre, not Three.js, on purpose: constant-pixel-size billboards
// that never scale with the camera are precisely what a symbol layer does.

export const CAMERA_SOURCE_ID = 'zt2-camera-markers';
export const CAMERA_ICON_LAYER_ID = 'zt2-camera-icons';
export const CAMERA_SELECT_LAYER_ID = 'zt2-camera-selected-ring';

export const CAMERA_MARKER_LAYER_IDS = [CAMERA_SELECT_LAYER_ID, CAMERA_ICON_LAYER_ID];

const ICON_PX = 72; // canvas size; drawn at pixelRatio 2, so ~36 CSS px
const STATUS_COLORS = { online: '#3fd17a', degraded: '#ffb03a', offline: '#ff3b46' };

// A CCTV silhouette on a dark disc with a status-coloured ring and glow —
// generated rather than shipped as an asset so the three status variants
// stay in sync with CAMERA_STATUS_COLORS and no sprite file is needed.
function makeCameraIcon(color) {
  const s = ICON_PX;
  const canvas = document.createElement('canvas');
  canvas.width = s; canvas.height = s;
  const ctx = canvas.getContext('2d');
  const c = s / 2;
  // CanvasRenderingContext2D.roundRect is recent; square corners are a fine
  // degradation on anything that lacks it.
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };

  // outer glow
  const glow = ctx.createRadialGradient(c, c, 8, c, c, c);
  glow.addColorStop(0, `${color}66`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();

  // disc + ring
  ctx.beginPath(); ctx.arc(c, c, 21, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(9,15,23,0.94)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();

  // camera glyph — a bullet body tilted down-right, its lens, and a wall
  // bracket, drawn in the status colour so a dead camera reads red at a
  // glance without opening anything.
  ctx.save();
  ctx.translate(c, c + 1);
  ctx.rotate(-0.22);
  ctx.fillStyle = color;

  // body
  roundRect(-11, -5.5, 17, 11, 2.5);
  ctx.fill();
  // lens hood
  ctx.beginPath();
  ctx.moveTo(6, -5.5); ctx.lineTo(12.5, -3.5); ctx.lineTo(12.5, 3.5); ctx.lineTo(6, 5.5);
  ctx.closePath();
  ctx.fill();
  // bracket + mount
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(-7, 5.5); ctx.lineTo(-7, 10);
  ctx.stroke();
  roundRect(-11.5, 10, 9, 3, 1.5);
  ctx.fill();
  ctx.restore();

  return ctx.getImageData(0, 0, s, s);
}

function toFeatureCollection(cameras) {
  return {
    type: 'FeatureCollection',
    features: (cameras || [])
      .filter((c) => c.lonLat)
      .map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: c.lonLat },
        properties: { id: c.id, status: c.status, name: c.name },
      })),
  };
}

export function addCameraMarkerLayer(map, cameras, { visible = true } = {}) {
  for (const [status, color] of Object.entries(STATUS_COLORS)) {
    const name = `zt2-cam-${status}`;
    if (!map.hasImage(name)) map.addImage(name, makeCameraIcon(color), { pixelRatio: 2 });
  }

  const data = toFeatureCollection(cameras);
  if (map.getSource(CAMERA_SOURCE_ID)) {
    map.getSource(CAMERA_SOURCE_ID).setData(data);
    return;
  }
  map.addSource(CAMERA_SOURCE_ID, { type: 'geojson', data });

  // Selection ring, drawn beneath the icon. Filtered to the selected id
  // (nothing matches the sentinel until a camera is picked).
  map.addLayer({
    id: CAMERA_SELECT_LAYER_ID,
    type: 'circle',
    source: CAMERA_SOURCE_ID,
    filter: ['==', ['get', 'id'], '__none__'],
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 15, 19, 26],
      'circle-color': 'rgba(77,226,255,0.16)',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#4de2ff',
    },
  });

  map.addLayer({
    id: CAMERA_ICON_LAYER_ID,
    type: 'symbol',
    source: CAMERA_SOURCE_ID,
    layout: {
      visibility: visible ? 'visible' : 'none',
      'icon-image': ['concat', 'zt2-cam-', ['get', 'status']],
      // Never hidden by collision or by another label — an operator needs
      // to see every camera, and at 180 of them MapLibre's collision
      // detection would otherwise silently drop most of the fleet.
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.45, 16, 0.62, 18, 0.85, 20, 1],
      // Floats just above the real 3-D camera head rather than sitting on it.
      'icon-offset': [0, -14],
    },
    paint: {
      'icon-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 1],
    },
  });
}

export function setCameraMarkers(map, cameras) {
  const src = map.getSource(CAMERA_SOURCE_ID);
  if (src) src.setData(toFeatureCollection(cameras));
}

export function setCameraMarkersVisible(map, visible) {
  for (const id of CAMERA_MARKER_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}

export function setSelectedCameraMarker(map, cameraId) {
  if (map.getLayer(CAMERA_SELECT_LAYER_ID)) {
    map.setFilter(CAMERA_SELECT_LAYER_ID, ['==', ['get', 'id'], cameraId || '__none__']);
  }
}

// The camera id under a container-pixel point, or null. Uses a small search
// box rather than an exact pixel so the marker is comfortable to click.
export function pickCameraMarker(map, point, pad = 6) {
  if (!map.getLayer(CAMERA_ICON_LAYER_ID)) return null;
  const box = [
    [point.x - pad, point.y - pad],
    [point.x + pad, point.y + pad],
  ];
  const hits = map.queryRenderedFeatures(box, { layers: [CAMERA_ICON_LAYER_ID] });
  return hits.length ? hits[0].properties.id : null;
}
