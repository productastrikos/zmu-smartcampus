import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Click popup for a CCTV camera on the twin — the live feed plus that
// camera's health, in the same style as the VMS wall on the Incident
// Management page (REC badge, timestamp burn-in, SIGNAL LOST placeholder
// for a dead camera).
//
// Anchored to the camera's own position on the map (`anchor`, container
// pixels from map.project()) rather than docked in a corner, so it reads as
// that camera's popup and you can see which unit you opened. The parent
// re-projects on every map move; this component only clamps the result to
// the viewport so the popup can't be pushed off-screen near an edge.
//
// Feed URLs come from the shared src/config/cameras.js registry via
// data/cameraRegistry.js, so there is one place stream mapping is
// configured. Health values are the camera's own derived record — see the
// honesty note at the top of cameraRegistry.js.

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(220,240,250,0.42)' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: tone || '#e8f4fb', marginTop: 1 }}>{value}</div>
    </div>
  );
}

function Bar({ pct, color }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: 'rgba(120,160,190,0.18)', overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}

const STATUS_TEXT = { online: 'Active', degraded: 'Degraded', offline: 'Offline' };

// The feed itself. `muted` + `playsInline` are what actually make autoplay
// permitted — every current browser blocks unmuted autoplay outright — and
// the explicit play() covers the case where the element is remounted with a
// new src and the autoplay attribute alone doesn't re-trigger. The promise
// is caught because a rejected play() (tab backgrounded, reduced-motion
// policy) is normal and must not surface as an unhandled rejection.
function CameraVideo({ camera }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // Each camera starts at its own point in the clip, so several open
    // feeds from the same source file don't look like the same feed.
    const seek = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = (camera.feedOffset ?? 0) * el.duration;
      }
      el.play().catch(() => {});
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener('loadedmetadata', seek, { once: true });
    return () => el.removeEventListener('loadedmetadata', seek);
  }, [camera.id, camera.videoUrl, camera.feedOffset]);

  return (
    <video
      key={camera.id}
      ref={videoRef}
      src={camera.videoUrl}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

const PANEL_W = 352;
const GAP = 20;    // clearance between the camera marker and the popup edge
const MARGIN = 12; // minimum clearance from the viewport edge

export default function CameraPanel({ camera, anchor, onClose }) {
  const clock = useClock();
  const ref = useRef(null);
  const [size, setSize] = useState({ w: PANEL_W, h: 520 });

  // Measure once rendered so the clamping below uses the popup's real
  // height rather than a guess (it varies with the analytics chip rows).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [camera?.id, camera?.analytics?.length]);

  if (!camera) return null;
  const { health } = camera;
  const css = camera.statusColor.css;
  const offline = camera.status === 'offline';
  const [lon, lat] = camera.lonLat || [null, null];

  // Prefer the right of the camera; flip to the left when that would run
  // off the edge. Falls back to a docked corner position if the parent
  // hasn't projected an anchor (camera off-screen, map not ready).
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  let left = MARGIN, top = MARGIN;
  if (anchor) {
    const fitsRight = anchor.x + GAP + size.w + MARGIN <= vw;
    left = fitsRight ? anchor.x + GAP : anchor.x - GAP - size.w;
    left = Math.max(MARGIN, Math.min(left, vw - size.w - MARGIN));
    top = Math.max(MARGIN, Math.min(anchor.y - 70, vh - size.h - MARGIN));
  }
  return (
    <div ref={ref} style={{
      position: 'fixed', left, top, zIndex: 6, width: PANEL_W,
      maxHeight: `calc(100vh - ${MARGIN * 2}px)`, overflowY: 'auto',
      background: 'rgba(8,14,22,0.94)', backdropFilter: 'blur(10px)',
      border: `1px solid ${css}66`, borderRadius: 12,
      boxShadow: `0 8px 34px rgba(0,0,0,0.55), 0 0 22px ${css}26`, overflowX: 'hidden',
      fontFamily: 'inherit', color: '#e8f4fb',
    }}>
      {/* Scoped here rather than in the global stylesheet so this panel
          stays self-contained to the Digital Twin module. */}
      <style>{'@keyframes zt2-rec-blink{0%,100%{opacity:1}50%{opacity:0.15}}'}</style>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px 9px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: css, boxShadow: `0 0 8px ${css}` }} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>{camera.id}</span>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: css,
              border: `1px solid ${css}59`, borderRadius: 4, padding: '1px 5px',
            }}>
              {STATUS_TEXT[camera.status].toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#7fd8ff', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {camera.name}
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(220,240,250,0.5)', marginTop: 1 }}>
            {camera.zone} · {camera.model}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close camera panel"
          style={{
            border: '1px solid rgba(77,226,255,0.3)', background: 'rgba(77,226,255,0.08)',
            color: '#bcefff', borderRadius: 6, width: 22, height: 22, cursor: 'pointer',
            fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* live feed */}
      <div style={{
        position: 'relative', margin: '0 13px', borderRadius: 8, overflow: 'hidden',
        background: '#05080c', border: '1px solid rgba(77,226,255,0.18)', aspectRatio: '16 / 9',
      }}>
        {offline || (!camera.videoUrl && !camera.embedUrl) ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 7,
            color: '#ff6b73', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 26, height: 26 }}>
              <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /><line x1="2" y1="2" x2="22" y2="22" />
            </svg>
            SIGNAL LOST
          </div>
        ) : camera.videoUrl ? (
          <CameraVideo camera={camera} />
        ) : (
          <iframe
            title={camera.id}
            src={camera.embedUrl}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allow="autoplay; fullscreen"
            allowFullScreen
            scrolling="no"
          />
        )}

        {!offline && (
          <div style={{
            position: 'absolute', top: 6, right: 8, display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(6,10,16,0.72)', borderRadius: 4, padding: '2px 6px',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#ff5b64', pointerEvents: 'none',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3b46', animation: 'zt2-rec-blink 1.4s ease-in-out infinite' }} />
            REC
          </div>
        )}
        <div style={{
          position: 'absolute', left: 8, bottom: 6, fontSize: 9,
          color: 'rgba(232,244,251,0.85)', textShadow: '0 1px 3px rgba(0,0,0,0.9)', pointerEvents: 'none',
        }}>
          {camera.id} · {clock.toLocaleTimeString('en-GB')} GST
        </div>
      </div>

      {/* health */}
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#7fd8ff', marginBottom: 7,
        }}>
          Camera health
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '9px 10px' }}>
          <Stat label="Frame rate" value={offline ? '—' : `${health.fps} fps`} tone={health.fps < health.fpsNominal ? '#ffb03a' : undefined} />
          <Stat label="Resolution" value={health.resolution.split(' ')[0]} />
          <Stat label="Bitrate" value={offline ? '—' : `${health.bitrateMbps} Mb/s`} />
          <Stat label="Latency" value={health.latencyMs == null ? '—' : `${health.latencyMs} ms`} tone={health.latencyMs > 250 ? '#ffb03a' : undefined} />
          <Stat label="Packet loss" value={health.packetLossPct == null ? '—' : `${health.packetLossPct}%`} tone={health.packetLossPct > 1 ? '#ffb03a' : undefined} />
          <Stat label="Uptime 30d" value={offline ? '0%' : `${health.uptimePct}%`} />
          <Stat label="Housing temp" value={`${health.tempC}°C`} tone={health.tempC > 55 ? '#ffb03a' : undefined} />
          <Stat label="PoE draw" value={`${health.poeWatts} W`} />
          <Stat label="Heartbeat" value={offline ? `${health.lastHeartbeatS}s ago` : `${health.lastHeartbeatS}s ago`} tone={offline ? '#ff6b73' : undefined} />
        </div>

        <div style={{ marginTop: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'rgba(220,240,250,0.55)' }}>
            <span>Recording storage · {health.storageDays}-day retention</span>
            <span style={{ color: '#e8f4fb', fontWeight: 700 }}>{health.storageUsedPct}%</span>
          </div>
          <Bar pct={health.storageUsedPct} color={health.storageUsedPct > 85 ? '#ff9330' : '#4de2ff'} />
        </div>

        <div style={{
          marginTop: 11, paddingTop: 9, borderTop: '1px solid rgba(77,226,255,0.15)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', fontSize: 9.5,
          color: 'rgba(220,240,250,0.55)',
        }}>
          <div>Recording: <span style={{ color: health.recording ? '#3fd17a' : '#ff6b73', fontWeight: 700 }}>{health.recording ? 'Yes' : 'No'}</span></div>
          <div>Firmware: <span style={{ color: '#e8f4fb' }}>{health.firmware}</span></div>
          <div>Lat: <span style={{ color: '#e8f4fb' }}>{lat != null ? lat.toFixed(6) : '—'}</span></div>
          <div>Lon: <span style={{ color: '#e8f4fb' }}>{lon != null ? lon.toFixed(6) : '—'}</span></div>
        </div>

        <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {camera.analytics.map((a) => (
            <span key={a} style={{
              fontSize: 9, fontWeight: 700, color: '#bcefff',
              border: '1px solid rgba(77,226,255,0.3)', background: 'rgba(77,226,255,0.08)',
              borderRadius: 4, padding: '2px 6px',
            }}>{a}</span>
          ))}
        </div>

        <div style={{ fontSize: 8.5, color: 'rgba(220,240,250,0.35)', marginTop: 9 }}>
          Health values derived from the VMS registry — demo feed, no live RTSP bridge on this page.
        </div>
      </div>
    </div>
  );
}
