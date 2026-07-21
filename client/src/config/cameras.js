/**
 * CCTV grid — manual stream mapping.
 *
 * Each entry binds a grid slot to a camera in the VMS registry
 * (data/cctv_cameras.csv, joined by cameraId).
 *
 * Provide ONE of:
 *   - embedUrl : an iframe-embeddable player URL (ScreenPal, YouTube, an
 *                HLS/WebRTC gateway page, etc.). Used as-is in an <iframe>.
 *   - streamUrl: a direct video URL a browser <video> can play
 *                (MP4/WebM, or HLS .m3u8 in Safari). RTSP must be converted
 *                at the edge (MediaMTX / go2rtc) first.
 *
 * Leave both empty ('') to render the built-in simulated feed.
 * Swap URLs here without touching any component code.
 *
 * Six local demo clips (client/public/videos/v1–v6.mp4), one per tile.
 */
const V1 = '/videos/v1.mp4';
const V2 = '/videos/v2.mp4';
const V3 = '/videos/v3.mp4';
const V4 = '/videos/v4.mp4';
const V5 = '/videos/v5.mp4';
const V6 = '/videos/v6.mp4';

export const CAMERA_GRID = [
  { slot: 1, cameraId: 'CAM-01', embedUrl: '', streamUrl: V1 },
  { slot: 2, cameraId: 'CAM-02', embedUrl: '', streamUrl: V2 },
  { slot: 3, cameraId: 'CAM-03', embedUrl: '', streamUrl: V3 },
  { slot: 4, cameraId: 'CAM-04', embedUrl: '', streamUrl: V4 },
  { slot: 5, cameraId: 'CAM-05', embedUrl: '', streamUrl: V5 },
  { slot: 6, cameraId: 'CAM-06', embedUrl: '', streamUrl: V6 },
];
