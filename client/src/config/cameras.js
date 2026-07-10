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
 * NOTE: the three ScreenPal clips below are reused across the six tiles
 * (each appears twice) purely for the demo wall.
 */
const V1 = 'https://go.screenpal.com/player/cOVY6QnrSe9?width=100%&height=100%&ff=1&title=0';
const V2 = 'https://go.screenpal.com/player/cOVYQHnrRSz?width=100%&height=100%&ff=1&title=0';
const V3 = 'https://go.screenpal.com/player/cOVYQmnrRSU?width=100%&height=100%&ff=1&title=0';

export const CAMERA_GRID = [
  { slot: 1, cameraId: 'CAM-01', embedUrl: V1, streamUrl: '' },
  { slot: 2, cameraId: 'CAM-02', embedUrl: V2, streamUrl: '' },
  { slot: 3, cameraId: 'CAM-03', embedUrl: V3, streamUrl: '' },
  { slot: 4, cameraId: 'CAM-04', embedUrl: V1, streamUrl: '' },
  { slot: 5, cameraId: 'CAM-05', embedUrl: V2, streamUrl: '' },
  { slot: 6, cameraId: 'CAM-06', embedUrl: V3, streamUrl: '' },
];
