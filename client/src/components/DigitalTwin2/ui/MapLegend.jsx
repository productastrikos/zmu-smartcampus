import React from 'react';

const ENTRIES = [
  { swatch: '#1c6fff', label: 'Buildings (real footprints)' },
  { swatch: '#ffb26b', label: 'Roads' },
  { swatch: '#4de2ff', label: 'Campus boundary / gates' },
  { swatch: '#2f8f4e', label: 'Football ground' },
  { swatch: '#1a2230', label: 'Parking' },
  { swatch: '#d7dde3', label: 'Perimeter fence' },
  { swatch: '#d8cdb8', label: 'Walkways & landscape' },
  { swatch: '#ff3b3b', label: 'Security (gates / towers / CCTV)' },
  { swatch: '#ff8a3d', label: 'Patrol routes' },
];

// A small, unobtrusive legend — explains the colour language of the twin
// (holographic cyan/blue buildings, orange roads, green ground cover, …)
// without duplicating the Layer Control's toggle list.
export default function MapLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 96, left: 16, zIndex: 5,
      background: 'rgba(8,14,22,0.72)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(77,226,255,0.25)', borderRadius: 10,
      padding: '8px 12px', fontFamily: 'inherit',
    }}>
      {ENTRIES.map((e) => (
        <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11 }}>
          <span style={{
            width: 10, height: 10, borderRadius: 3, background: e.swatch,
            boxShadow: `0 0 6px ${e.swatch}`, flexShrink: 0,
          }} />
          <span style={{ color: 'rgba(220,240,250,0.8)' }}>{e.label}</span>
        </div>
      ))}
    </div>
  );
}
