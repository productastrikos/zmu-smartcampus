import React from 'react';

// Hover tooltip for a CCTV camera marker — intentionally minimal (id +
// whether it's live), same fixed-position-near-cursor technique the
// building and personnel hover tooltips already use. The full health +
// feed view is the click panel, CameraPanel.jsx.

const STATUS_TEXT = { online: 'Active', degraded: 'Degraded', offline: 'Offline' };

export default function CameraPopup({ camera, x, y }) {
  if (!camera) return null;
  const css = camera.statusColor.css;
  return (
    <div style={{
      position: 'fixed', left: x + 14, top: y + 14, zIndex: 7,
      background: 'rgba(8,14,22,0.92)', border: `1px solid ${css}59`,
      borderRadius: 8, padding: '8px 11px', fontSize: 11.5, color: '#e8f4fb',
      pointerEvents: 'none', maxWidth: 240,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: css, boxShadow: `0 0 7px ${css}`,
        }} />
        <span style={{ fontWeight: 700 }}>{camera.id}</span>
        <span style={{ color: css, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
          {STATUS_TEXT[camera.status].toUpperCase()}
        </span>
      </div>
      <div style={{ color: '#7fd8ff', fontSize: 10, marginTop: 3 }}>{camera.name}</div>
      <div style={{ color: 'rgba(220,240,250,0.6)', fontSize: 9.5, marginTop: 2 }}>
        {camera.zone} · {camera.status === 'offline' ? 'no signal' : `${camera.health.fps} fps`}
      </div>
      <div style={{ color: 'rgba(220,240,250,0.35)', fontSize: 8.5, marginTop: 4 }}>
        click to open live feed &amp; health
      </div>
    </div>
  );
}
