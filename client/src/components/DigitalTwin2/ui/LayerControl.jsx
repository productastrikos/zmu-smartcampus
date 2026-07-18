import React from 'react';

// Layers with real rows in zmu_db today.
const LIVE_LAYERS = [
  { key: 'buildings', label: 'Buildings (3-D)' },
  { key: 'roads', label: 'Roads' },
  { key: 'boundary', label: 'Campus boundary' },
  { key: 'parking', label: 'Parking' },
  { key: 'sportsfields', label: 'Football ground' },
  { key: 'grounds', label: 'Parade ground' },
  { key: 'gates', label: 'Gates' },
  { key: 'points', label: 'Points of interest' },
  { key: 'fences', label: 'Perimeter fence' },
  // Procedurally generated (not digitized) — see WalkwayGenerator.js —
  // always has content once buildings/roads have loaded, so it belongs
  // here rather than in EMPTY_LAYERS.
  { key: 'walkways', label: 'Walkways & landscape' },
  // Security overlay — also procedurally generated FROM real geometry
  // (boundary corners, gate/parking/junction/fence positions — see
  // SecurityLayer.jsx/CCTVLayer.jsx/LightingLayer.jsx/PatrolLayer.jsx),
  // not digitized data, but always present once the campus has loaded.
  { key: 'security_lighting', label: 'Street lighting (generated)' },
  { key: 'security', label: 'Gates & watch towers' },
  { key: 'cctv', label: 'CCTV network' },
  { key: 'patrol', label: 'Patrol routes' },
  // Simulated Garmin-wearable personnel — procedurally generated/animated
  // like the security overlay above, not digitized data, but always
  // present once the campus + walkway network have loaded.
  { key: 'personnel', label: 'Personnel tracking' },
];

// Wired to real, tag-filtered PostGIS queries that legitimately return zero
// rows today (no fabricated geometry) — shown so the layer architecture is
// visibly complete, flagged so it's clear there's nothing to see yet.
const EMPTY_LAYERS = [
  { key: 'footpaths', label: 'Footpaths (OSM)' },
  { key: 'grass', label: 'Grass (OSM)' },
  { key: 'water', label: 'Water' },
  { key: 'trees', label: 'Trees' },
  { key: 'lights', label: 'Lighting poles' },
];

// Pure UI placeholders — no data source or rendering exists yet, per spec
// ("no fake live values yet — only prepare the architecture").
const FUTURE_TOGGLES = [
  { key: 'utilities', label: 'Utilities' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'bms', label: 'BMS' },
];

export const ALL_LAYER_KEYS = [...LIVE_LAYERS, ...EMPTY_LAYERS].map((l) => l.key);
export const ALL_FUTURE_KEYS = FUTURE_TOGGLES.map((l) => l.key);

function Row({ item, checked, onToggle, disabled }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
      color: disabled ? 'rgba(220,240,250,0.4)' : 'rgba(220,240,250,0.88)',
      padding: '3px 0', cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.key)}
        style={{ accentColor: '#4de2ff', width: 13, height: 13, cursor: 'pointer' }}
      />
      {item.label}
      {disabled && <span style={{ fontSize: 9.5, color: 'rgba(220,240,250,0.35)' }}>(no data yet)</span>}
    </label>
  );
}

export default function LayerControl({ visibility, onToggle, emptyKeys, futureVisibility, onToggleFuture, onZoomToFit }) {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 5,
      background: 'rgba(8,14,22,0.72)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(77,226,255,0.25)', borderRadius: 10,
      padding: '10px 14px', minWidth: 190, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
      boxShadow: '0 0 24px rgba(20,160,220,0.12)', fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7fd8ff', marginBottom: 8 }}>
        Layers
      </div>
      {LIVE_LAYERS.map((l) => (
        <Row key={l.key} item={l} checked={!!visibility[l.key]} onToggle={onToggle} disabled={emptyKeys?.has(l.key)} />
      ))}

      <div style={{ height: 1, background: 'rgba(77,226,255,0.15)', margin: '8px 0' }} />
      {EMPTY_LAYERS.map((l) => (
        <Row key={l.key} item={l} checked={!!visibility[l.key]} onToggle={onToggle} disabled={emptyKeys?.has(l.key)} />
      ))}

      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(220,240,250,0.4)', margin: '10px 0 4px',
      }}>
        Future integration
      </div>
      {FUTURE_TOGGLES.map((l) => (
        <Row key={l.key} item={l} checked={!!futureVisibility[l.key]} onToggle={onToggleFuture} disabled />
      ))}

      <button
        onClick={onZoomToFit}
        style={{
          marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 7, cursor: 'pointer',
          border: '1px solid rgba(77,226,255,0.35)', background: 'rgba(77,226,255,0.1)',
          color: '#bcefff', fontSize: 11, fontWeight: 700,
        }}
      >
        Zoom to fit
      </button>
    </div>
  );
}
