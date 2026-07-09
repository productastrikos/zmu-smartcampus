/**
 * CCTV grid — manual stream mapping.
 *
 * Each entry binds a grid slot to a camera in the VMS registry
 * (data/cctv_cameras.csv, joined by cameraId) and an optional stream URL.
 *
 * streamUrl accepts any URL a browser <video> element can play:
 *   - MP4 / WebM file or endpoint
 *   - HLS (.m3u8) — plays natively in Safari; other browsers need hls.js
 *   - RTSP streams must be converted at the edge (e.g. MediaMTX / go2rtc
 *     exposing HLS or WebRTC) — paste the converted URL here.
 *
 * Leave streamUrl empty ('') to render the built-in simulated feed.
 * Swap URLs here without touching any component code.
 */
export const CAMERA_GRID = [
  { slot: 1, cameraId: 'CAM-01', streamUrl: '' },
  { slot: 2, cameraId: 'CAM-02', streamUrl: '' },
  { slot: 3, cameraId: 'CAM-03', streamUrl: '' },
  { slot: 4, cameraId: 'CAM-05', streamUrl: '' },
  { slot: 5, cameraId: 'CAM-06', streamUrl: '' },
  { slot: 6, cameraId: 'CAM-11', streamUrl: '' },
];
