import React from 'react';

const ROLE_LABELS = {
  cadet: 'Cadet', faculty: 'Faculty', visitor: 'Visitor', security: 'Security',
  maintenance: 'Maintenance', medical: 'Medical / Emergency Response', administration: 'Administration',
};
const STATUS_LABELS = {
  active: 'Active', inactive: 'Inactive', emergency: 'Emergency Response Team',
  visitor: 'Visitor', faculty: 'Faculty', security: 'Security Patrol',
};
const INACTIVE_REASONS = ['Resting', 'In a Meeting', 'In Class', 'Offline Device', 'Charging', 'On Break'];

function directionLabel(headingRad) {
  const deg = ((headingRad * 180) / Math.PI + 360) % 360;
  const dirs = ['East', 'North-East', 'North', 'North-West', 'West', 'South-West', 'South', 'South-East'];
  return dirs[Math.round(deg / 45) % 8];
}

function Field({ label, value }) {
  return (
    <div style={{ fontSize: 9.5, color: 'rgba(220,240,250,0.55)' }}>
      {label}: <span style={{ color: '#e8f4fb', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// Hover tooltip for a personnel marker — mirrors the fixed-position-div-
// near-cursor technique digitalTwin_2.jsx already uses for building hover,
// just with the much larger simulated-Garmin field set the spec calls for.
export default function PersonnelPopup({ person, x, y, lonLat }) {
  if (!person) return null;
  const idle = !person.walk || person._idle;
  const isMoving = person.status !== 'inactive' && !idle;
  const [lon, lat] = lonLat || [null, null];
  const reason = person.status === 'inactive' ? INACTIVE_REASONS[Math.floor(person.seed) % INACTIVE_REASONS.length] : null;
  const h = person.health, d = person.device;

  return (
    <div style={{
      position: 'fixed', left: x + 14, top: y + 14, zIndex: 7,
      background: 'rgba(8,14,22,0.92)', border: '1px solid rgba(77,226,255,0.35)',
      borderRadius: 8, padding: '9px 12px', fontSize: 11.5, color: '#e8f4fb',
      pointerEvents: 'none', width: 260,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 1 }}>{person.name}</div>
      <div style={{ color: '#7fd8ff', fontSize: 10 }}>
        {person.id} · {ROLE_LABELS[person.role] || person.role} · {person.department}
      </div>
      <div style={{ color: 'rgba(220,240,250,0.7)', fontSize: 10, marginTop: 2 }}>
        {person.status === 'inactive' ? `Inactive — ${reason}` : `${STATUS_LABELS[person.status]}${isMoving ? ' · moving' : ' · paused'}`}
        {person.building ? ` · ${person.building}` : person.status !== 'inactive' ? ' · Outdoor' : ''}
      </div>

      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', marginTop: 6, paddingTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
        <Field label="Lat" value={lat != null ? lat.toFixed(6) : '—'} />
        <Field label="Lon" value={lon != null ? lon.toFixed(6) : '—'} />
        <Field label="Speed" value={isMoving ? `${person.speedMps.toFixed(1)} m/s` : '0 m/s'} />
        <Field label="Direction" value={isMoving ? directionLabel(person._heading || 0) : '—'} />
        <Field label="Steps Today" value={Math.round(h.stepsToday).toLocaleString()} />
        <Field label="Distance" value={`${h.distanceKm.toFixed(1)} km`} />
        <Field label="Heart Rate" value={`${h.heartRate} bpm`} />
        <Field label="Blood Oxygen" value={`${h.spo2}%`} />
        <Field label="Respiration" value={`${h.respiration} bpm`} />
        <Field label="Stress" value={h.stress} />
        <Field label="Body Battery" value={`${Math.round(h.bodyBattery)}%`} />
        <Field label="Calories" value={Math.round(h.calories)} />
        <Field label="Skin Temp" value={`${h.skinTemp}°C`} />
        <Field label="Sleep Score" value={h.sleepScore} />
        <Field label="Hydration" value={h.hydration} />
        <Field label="Battery" value={`${Math.round(d.battery)}%`} />
        <Field label="Signal" value={d.signal} />
      </div>
      <div style={{ fontSize: 8.5, color: 'rgba(220,240,250,0.35)', marginTop: 5 }}>
        Last updated {Math.max(0, Math.round((Date.now() - person.lastUpdatedAt) / 1000))}s ago — simulated wearable, no live feed
      </div>
    </div>
  );
}
