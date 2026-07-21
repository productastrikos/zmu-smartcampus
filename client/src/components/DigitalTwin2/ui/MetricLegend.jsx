import React from 'react';
import { OVERLAYS } from '../data/campusMetrics';

// Threshold legend for whichever analytics overlay (AQI / water / energy)
// is currently colouring the buildings. Without this the colour tint is
// unreadable — the whole point of a threshold overlay is knowing which
// band a colour means.

export default function MetricLegend({ overlayKey, summary }) {
  if (!overlayKey) return null;
  const overlay = OVERLAYS[overlayKey];
  if (!overlay) return null;

  return (
    <div style={{
      position: 'absolute', left: 16, bottom: 108, zIndex: 5,
      background: 'rgba(8,14,22,0.78)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(77,226,255,0.25)', borderRadius: 10,
      padding: '10px 13px', minWidth: 208,
      boxShadow: '0 0 24px rgba(20,160,220,0.12)', fontFamily: 'inherit',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase',
        color: '#7fd8ff', marginBottom: 7,
      }}>
        {overlay.label}
      </div>

      {overlay.bands.map((b) => (
        <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2.5px 0' }}>
          <span style={{
            width: 11, height: 11, borderRadius: 3, background: b.css,
            boxShadow: `0 0 7px ${b.css}80`, flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'rgba(220,240,250,0.88)', flex: 1 }}>{b.label}</span>
          <span style={{ fontSize: 10, color: 'rgba(220,240,250,0.5)' }}>
            {overlayKey === 'aqi'
              ? (b.to >= 500 ? `${b.from}+` : `${b.from}–${b.to}`)
              : (b.to > 100 ? `${b.from}%+` : `${b.from}–${b.to}%`)}
          </span>
        </div>
      ))}

      {overlay.unit && (
        <div style={{ fontSize: 9, color: 'rgba(220,240,250,0.42)', marginTop: 6 }}>
          Buildings tinted by {overlay.unit}
        </div>
      )}
      {overlay.hasPlume && (
        <>
          <div style={{ fontSize: 9, color: 'rgba(220,240,250,0.42)', marginTop: 6 }}>
            Plume = affected area interpolated from {summary?.stations ?? 0} monitoring stations
          </div>
          <div style={{ fontSize: 9, color: '#7fd8ff', marginTop: 4 }}>
            Buildings hidden while this overlay is on, so the affected area
            reads clearly — they return when you switch it off.
          </div>
        </>
      )}

      {summary?.worst && (
        <div style={{
          marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(77,226,255,0.15)',
          fontSize: 9.5, color: 'rgba(220,240,250,0.55)',
        }}>
          Peak: <span style={{ color: '#e8f4fb', fontWeight: 700 }}>{summary.worst.label}</span>
          {' · '}
          <span style={{ color: summary.worst.css, fontWeight: 700 }}>{summary.worst.readout}</span>
        </div>
      )}

      <div style={{ fontSize: 8.5, color: 'rgba(220,240,250,0.33)', marginTop: 6 }}>
        derived readings — no live BMS/AQI feed yet
      </div>
    </div>
  );
}
