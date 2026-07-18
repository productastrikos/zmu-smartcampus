import React from 'react';

// Small SVG ring gauge — same stroke-dasharray-ring technique as
// admin_block/BuildingDigitalTwin.tsx's KPICard, reimplemented fresh here
// (kept local rather than imported cross-feature; it's ~25 lines and the
// two features aren't otherwise coupled) and restyled to this module's
// dark-cyan palette (BuildingPopup.jsx/LayerControl.jsx) rather than that
// feature's `.bdt` theme.
export function HealthGauge({ label, value, unit = '', color, max }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(77,226,255,0.15)" strokeWidth="4" />
        <circle
          cx="23" cy="23" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 23 23)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="23" y="24" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill={color} fontFamily="inherit">
          {Math.round(value)}{unit.length <= 2 ? unit : ''}
        </text>
      </svg>
      <div style={{ fontSize: 9, color: 'rgba(220,240,250,0.6)', textAlign: 'center' }}>{label}</div>
    </div>
  );
}

function DeviceField({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 11 }}>
      <span style={{ color: 'rgba(220,240,250,0.55)' }}>{label}</span>
      <span style={{ color: '#e8f4fb', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function DeviceCard({ device }) {
  if (!device) return null;
  return (
    <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 6 }}>
      <DeviceField label="Watch model" value={device.model} />
      <DeviceField label="Serial number" value={device.serial} />
      <DeviceField label="Firmware" value={device.firmware} />
      <DeviceField label="Connection" value={device.connection} />
      <DeviceField label="GPS accuracy" value={device.gpsAccuracy} />
      <DeviceField label="Satellite lock" value={device.satelliteLock} />
      <DeviceField label="Bluetooth" value={device.bluetooth} />
      <DeviceField label="Battery" value={`${Math.round(device.battery)}%`} />
      <DeviceField label="Signal strength" value={device.signal} />
    </div>
  );
}
