import React from 'react';
import { HealthGauge, DeviceCard } from './GarminHealthCard';

const ROLE_LABELS = {
  cadet: 'Cadet', faculty: 'Faculty', visitor: 'Visitor', security: 'Security',
  maintenance: 'Maintenance', medical: 'Medical / Emergency Response', administration: 'Administration',
};
const STATUS_LABELS = {
  active: 'Active — Moving', inactive: 'Inactive — Stationary', emergency: 'Emergency Response Team',
  visitor: 'Visitor', faculty: 'Faculty', security: 'Security Patrol',
};

function initials(name) {
  const parts = name.replace(/^(Cadet|Officer Cadet|Officer|Sergeant|Paramedic|Nurse)\s+/, '').split(' ');
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'rgba(220,240,250,0.4)', margin: '14px 0 6px',
    }}>
      {children}
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', fontSize: 11.5 }}>
      <span style={{ color: 'rgba(220,240,250,0.55)' }}>{label}</span>
      <span style={{ color: '#e8f4fb', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// Right-side panel opened on personnel selection — profile, health
// dashboard (gauges), current assignment, Garmin device card, and
// lightweight Phase-1 placeholders for timeline/history/alerts (full
// history storage + charts are Phase 3+ Analytics, not built yet).
export default function PersonnelPanel({ person, lonLat, onClose }) {
  if (!person) return null;
  const h = person.health;
  const isMoving = person.status !== 'inactive' && !person._idle;

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 6, width: 320,
      background: 'rgba(8,14,22,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(77,226,255,0.3)', borderRadius: 12,
      padding: '14px 16px', boxShadow: '0 0 30px rgba(20,160,220,0.16)',
      fontFamily: 'inherit', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: `${person.color}26`,
            border: `1.5px solid ${person.color}`, color: person.color, fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {initials(person.name)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{person.name}</div>
            <div style={{ fontSize: 10.5, color: '#7fd8ff' }}>{person.id} · {ROLE_LABELS[person.role] || person.role}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(220,240,250,0.6)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{
        marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5,
        color: person.color, border: `1px solid ${person.color}55`, borderRadius: 20, padding: '2px 9px',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: person.color, boxShadow: `0 0 6px ${person.color}` }} />
        {STATUS_LABELS[person.status]}
      </div>

      <SectionLabel>Current Assignment</SectionLabel>
      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 4 }}>
        <Field label="Department" value={person.department} />
        <Field label="Location" value={person.building || 'Outdoor — campus grounds'} />
        <Field label="Speed" value={isMoving ? `${person.speedMps.toFixed(1)} m/s` : '0 m/s'} />
        <Field label="Coordinates" value={lonLat ? `${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}` : '—'} />
      </div>

      <SectionLabel>Health Dashboard</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 4px', justifyItems: 'center' }}>
        <HealthGauge label="Heart Rate" value={h.heartRate} unit="" max={180} color="#ff6b6b" />
        <HealthGauge label="SpO₂" value={h.spo2} unit="%" max={100} color="#4de2ff" />
        <HealthGauge label="Body Batt." value={h.bodyBattery} unit="%" max={100} color="#3ddc71" />
        <HealthGauge label="Stress" value={h.stress} unit="" max={100} color="#eab308" />
        <HealthGauge label="Respiration" value={h.respiration} unit="" max={30} color="#a855f7" />
        <HealthGauge label="Temp" value={h.skinTemp} unit="°" max={40} color="#fb923c" />
        <HealthGauge label="Sleep" value={h.sleepScore} unit="" max={100} color="#818cf8" />
        <HealthGauge label="Calories" value={Math.min(h.calories, 3000)} unit="" max={3000} color="#f472b6" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5 }}>
        <span style={{ color: 'rgba(220,240,250,0.55)' }}>Steps today</span>
        <span style={{ color: '#e8f4fb', fontWeight: 600 }}>{Math.round(h.stepsToday).toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
        <span style={{ color: 'rgba(220,240,250,0.55)' }}>Distance walked</span>
        <span style={{ color: '#e8f4fb', fontWeight: 600 }}>{h.distanceKm.toFixed(1)} km</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
        <span style={{ color: 'rgba(220,240,250,0.55)' }}>Hydration</span>
        <span style={{ color: '#e8f4fb', fontWeight: 600 }}>{h.hydration}</span>
      </div>

      <SectionLabel>Garmin Device</SectionLabel>
      <DeviceCard device={person.device} />

      <SectionLabel>Movement &amp; Alerts</SectionLabel>
      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 4 }}>
        <Field label="Alert status" value="No active alerts" />
        <Field label="Tracking since" value="Session start" />
        <Field label="Location history" value="Not recorded yet" />
      </div>
      <div style={{ fontSize: 8.5, color: 'rgba(220,240,250,0.35)', marginTop: 10 }}>
        Simulated Garmin wearable — no live BMS/sensor feed. Geofence alerts, movement trail and full
        history are planned for a later phase.
      </div>
    </div>
  );
}
