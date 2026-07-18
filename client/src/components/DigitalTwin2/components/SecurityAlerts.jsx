import React, { useState } from 'react';

// The demo/inert alert catalog from the spec — fence breach is the one
// type that's actually wired to a working simulation (via
// FenceLayer.jsx's simulateBreach + GeofenceEngine.js); the rest have no
// real sensor feed (no BMS/IoT integration exists yet, same as every
// other "future_*" field in this module) and are shown as inert demo
// entries with hover detail rather than fabricated ongoing incidents.
const ALERT_TYPES = [
  { key: 'fence_breach', label: 'Fence breach', detail: 'Live demo: triggered by "Simulate breach" below.', live: true },
  { key: 'unauthorized_access', label: 'Unauthorized access', detail: 'No access-control feed integrated yet.' },
  { key: 'camera_offline', label: 'Camera offline', detail: 'No CCTV health feed integrated yet.' },
  { key: 'fire_alarm', label: 'Fire alarm', detail: 'No fire-panel feed integrated yet.' },
  { key: 'power_outage', label: 'Power outage', detail: 'No power-monitoring feed integrated yet.' },
  { key: 'intrusion', label: 'Intrusion', detail: 'No motion-sensor feed integrated yet.' },
  { key: 'medical_emergency', label: 'Medical emergency', detail: 'No emergency-call feed integrated yet.' },
];

const STATE_COLOR = { safe: '#4de2ff', approaching: '#ffe066', crossing: '#ff3b3b' };
const STATE_LABEL = { safe: 'Monitoring', approaching: 'Approaching fence line', crossing: 'FENCE CROSSED' };

export default function SecurityAlerts({ onSimulateBreach, breachState, simulating }) {
  const [hoverKey, setHoverKey] = useState(null);

  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16, zIndex: 5, width: 250,
      background: 'rgba(8,14,22,0.78)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(77,226,255,0.25)', borderRadius: 10,
      padding: '10px 14px', fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7fd8ff', marginBottom: 8 }}>
        Security Alerts (Demo)
      </div>

      <button
        onClick={onSimulateBreach}
        disabled={simulating}
        style={{
          width: '100%', padding: '7px 0', borderRadius: 7, marginBottom: 8,
          cursor: simulating ? 'default' : 'pointer', fontSize: 11.5, fontWeight: 700,
          border: '1px solid rgba(255,138,61,0.45)',
          background: simulating ? 'rgba(255,138,61,0.08)' : 'rgba(255,138,61,0.16)',
          color: '#ffb26b',
        }}
      >
        {simulating ? 'Simulating…' : 'Simulate Breach'}
      </button>

      {breachState && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 8,
          borderRadius: 6, background: 'rgba(255,255,255,0.04)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: STATE_COLOR[breachState.state], boxShadow: `0 0 6px ${STATE_COLOR[breachState.state]}`,
          }} />
          <span style={{ fontSize: 10.5, color: '#e8f4fb' }}>
            {STATE_LABEL[breachState.state]} · {breachState.distance.toFixed(1)}m
          </span>
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 6 }}>
        {ALERT_TYPES.map((a) => (
          <div
            key={a.key}
            onMouseEnter={() => setHoverKey(a.key)}
            onMouseLeave={() => setHoverKey(null)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11.5, cursor: 'default' }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: a.live ? '#ff3b3b' : 'rgba(220,240,250,0.3)',
            }} />
            <span style={{ color: a.live ? '#e8f4fb' : 'rgba(220,240,250,0.55)' }}>{a.label}</span>
            {hoverKey === a.key && (
              <div style={{
                position: 'absolute', right: 0, bottom: '100%', marginBottom: 4, width: 190, zIndex: 10,
                background: 'rgba(8,14,22,0.95)', border: '1px solid rgba(77,226,255,0.3)',
                borderRadius: 6, padding: '6px 9px', fontSize: 10, color: 'rgba(220,240,250,0.8)',
              }}>
                {a.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
