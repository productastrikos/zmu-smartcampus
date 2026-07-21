import { CAMERA_GRID } from '../../../config/cameras';

// Per-camera identity + health for the CCTV cameras the Digital Twin draws
// (see CCTVLayer.jsx — every camera position is derived from real campus
// geometry: the real gate, real boundary vertices, real parking centroids,
// real road-road junctions, real important-building centroids).
//
// HONESTY NOTE: there is no live VMS connection from this page, so health
// (status/fps/uptime/latency/storage/firmware) is DERIVED DETERMINISTICALLY
// from each camera's stable id — the same camera always reports the same
// health, and swapping in a real VMS poll means replacing makeCameraRecord()
// alone. The playable feeds are the same demo clips the Incident Management
// VMS wall already uses (src/config/cameras.js), reused read-only here so
// there is exactly one place stream URLs are configured.

// Demo clips served straight from client/public. These are the DEFAULT feed
// source for the twin, and the reason is autoplay: a muted, playsInline
// <video> element is the only thing a browser will reliably start on its
// own. A cross-origin iframe player (the ScreenPal embeds below) decides
// for itself whether to autoplay and generally won't without a user
// gesture — which is exactly the "not playing automatically" behaviour on
// the twin's camera popups.
const LOCAL_CLIPS = ['/v4.mp4', '/v5.mp4', '/v9.mp4'];

// Flip to false to put the ScreenPal embeds from src/config/cameras.js back
// into the rotation alongside the local clips (six distinct feeds instead of
// three, at the cost of the embedded ones not auto-starting).
const LOCAL_CLIPS_ONLY = true;

const EMBEDS = CAMERA_GRID.map((c) => c.embedUrl).filter(Boolean);

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function unitFor(id, salt) {
  return ((hashString(`${id}::${salt}`) >>> 8) % 100000) / 100000;
}

// What kind of real geometry the camera was placed from — drives its name,
// its model, and which analytics it plausibly runs.
export const CAMERA_KINDS = {
  gate: { label: 'Main Gate', model: 'ANPR PTZ 4K', analytics: ['ANPR', 'Face capture'] },
  perimeter: { label: 'Perimeter', model: 'Thermal Bullet', analytics: ['Intrusion', 'Line crossing'] },
  parking: { label: 'Parking', model: 'PTZ Dome 4K', analytics: ['ANPR', 'Occupancy'] },
  junction: { label: 'Road Junction', model: 'Fixed Dome 1080p', analytics: ['Traffic count'] },
  building: { label: 'Building', model: 'PTZ Dome 4K', analytics: ['Loitering', 'People count'] },
  ground: { label: 'Ground', model: 'PTZ 30x Zoom', analytics: ['Crowd density'] },
};

export const CAMERA_STATUS_COLORS = {
  online: { hex: 0x3fd17a, css: '#3fd17a' },
  degraded: { hex: 0xffb03a, css: '#ffb03a' },
  offline: { hex: 0xff3b46, css: '#ff3b46' },
};

const RESOLUTIONS = ['4K (3840×2160)', '1080p (1920×1080)', '4K (3840×2160)', '5MP (2592×1944)'];
const FIRMWARE = ['v4.812.0000', 'v4.803.0021', 'v5.102.0004', 'v4.790.0117'];

/**
 * One camera's full record. `seq` is the camera's index within its campus,
 * `kind` a key of CAMERA_KINDS, `place` a real place name where one exists
 * (e.g. the building the camera watches), `lonLat` its real position.
 */
export function makeCameraRecord({ campus, seq, kind, place, lonLat }) {
  const id = `CAM-${campus === 2 ? 'C2' : 'C1'}-${String(seq + 1).padStart(3, '0')}`;
  const meta = CAMERA_KINDS[kind] || CAMERA_KINDS.building;

  // ~88% online / 8% degraded / 4% offline, stable per camera.
  const roll = unitFor(id, 'status');
  const status = roll > 0.96 ? 'offline' : roll > 0.88 ? 'degraded' : 'online';

  const feedHash = hashString(`${id}feed`);
  const useLocalClip = LOCAL_CLIPS_ONLY || feedHash % 2 === 0;

  const fpsNominal = unitFor(id, 'fps') > 0.5 ? 30 : 25;
  const fps = status === 'offline' ? 0 : status === 'degraded' ? Math.round(fpsNominal * 0.45) : fpsNominal;

  return {
    id,
    campus,
    kind,
    name: place ? `${meta.label} — ${place}` : `${meta.label} ${String(seq + 1).padStart(3, '0')}`,
    zone: `Campus ${campus} · ${meta.label}`,
    model: meta.model,
    analytics: meta.analytics,
    status,
    statusColor: CAMERA_STATUS_COLORS[status],
    lonLat,
    health: {
      fps,
      fpsNominal,
      resolution: RESOLUTIONS[hashString(id) % RESOLUTIONS.length],
      bitrateMbps: status === 'offline' ? 0 : Math.round((4 + unitFor(id, 'bitrate') * 8) * 10) / 10,
      uptimePct: status === 'offline' ? 0 : Math.round((status === 'degraded' ? 91 + unitFor(id, 'up') * 6 : 98.4 + unitFor(id, 'up') * 1.5) * 10) / 10,
      latencyMs: status === 'offline' ? null : Math.round(40 + unitFor(id, 'lat') * (status === 'degraded' ? 420 : 120)),
      packetLossPct: status === 'offline' ? null : Math.round(unitFor(id, 'loss') * (status === 'degraded' ? 7 : 0.8) * 10) / 10,
      storageDays: Math.round(30 + unitFor(id, 'store') * 60),
      storageUsedPct: Math.round(46 + unitFor(id, 'storepct') * 48),
      tempC: Math.round(38 + unitFor(id, 'temp') * 22),
      firmware: FIRMWARE[hashString(`${id}fw`) % FIRMWARE.length],
      poeWatts: Math.round((6 + unitFor(id, 'poe') * 9) * 10) / 10,
      recording: status !== 'offline',
      lastHeartbeatS: status === 'offline' ? Math.round(120 + unitFor(id, 'hb') * 4000) : Math.round(unitFor(id, 'hb') * 4),
    },
    // Demo feed for the in-map popup. Offline cameras deliberately get
    // neither source, so the popup shows SIGNAL LOST rather than a happily
    // playing video on a camera it just reported as dead.
    // Exactly one of the two is ever set, so the popup never has to choose.
    videoUrl: status === 'offline' || !useLocalClip ? '' : LOCAL_CLIPS[feedHash % LOCAL_CLIPS.length],
    embedUrl: status === 'offline' || useLocalClip || !EMBEDS.length ? '' : EMBEDS[feedHash % EMBEDS.length],
    // Deterministic 0..1 start position. With only three clips shared
    // across ~180 cameras, starting every feed at 00:00 makes it obvious
    // they're the same footage; seeking each camera to its own offset makes
    // the wall read as a set of independent feeds.
    // Capped at 80% so a feed never opens two seconds from the end and
    // immediately loops.
    feedOffset: unitFor(id, 'seek') * 0.8,
  };
}

export function summariseCameraHealth(cameras) {
  const total = cameras.length;
  const online = cameras.filter((c) => c.status === 'online').length;
  const degraded = cameras.filter((c) => c.status === 'degraded').length;
  const offline = cameras.filter((c) => c.status === 'offline').length;
  return { total, online, degraded, offline };
}
