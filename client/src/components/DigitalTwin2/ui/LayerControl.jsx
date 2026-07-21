import React from 'react';
import { OVERLAYS } from '../data/campusMetrics';
import { CAMERA_KINDS, CAMERA_STATUS_COLORS } from '../data/cameraRegistry';

// Layers with real rows in zmu_db today.
// Trimmed down to just the layers currently enabled — the rest are
// commented out (not deleted) below so they're easy to bring back later.
const LIVE_LAYERS = [
  { key: 'buildings', label: 'Buildings (3-D)' },
  { key: 'roads', label: 'Roads' },
  { key: 'boundary', label: 'Campus boundary' },
  { key: 'parking', label: 'Parking' },
  { key: 'sportsfields', label: 'Football ground' },
  { key: 'grounds', label: 'Parade ground' },
  // { key: 'gates', label: 'Gates' },
  // { key: 'points', label: 'Points of interest' },
  { key: 'fences', label: 'Perimeter fence' },
  // Procedurally generated (not digitized) — see WalkwayGenerator.js —
  // always has content once buildings/roads have loaded, so it belongs
  // here rather than in EMPTY_LAYERS.
  // { key: 'walkways', label: 'Walkways & landscape' },
  // Security overlay — also procedurally generated FROM real geometry
  // (boundary corners, gate/parking/junction/fence positions — see
  // SecurityLayer.jsx/CCTVLayer.jsx/LightingLayer.jsx/PatrolLayer.jsx),
  // not digitized data, but always present once the campus has loaded.
  // { key: 'security_lighting', label: 'Street lighting (generated)' },
  { key: 'security', label: 'Gates & watch towers' },
  { key: 'cctv', label: 'CCTV network' },
  // { key: 'patrol', label: 'Patrol routes' },
  // Simulated Garmin-wearable personnel — procedurally generated/animated
  // like the security overlay above, not digitized data, but always
  // present once the campus + walkway network have loaded.
  { key: 'personnel', label: 'Personnel tracking' },
  // Second real ZMU site (boundary + central building + landscaped
  // circles), digitized from zmu_campus_2.txt — see Campus2*Layer.jsx.
  { key: 'campus2', label: 'Campus 2 (New)' },
  // Campus 2's road network (Phase 2), digitized from
  // zmu_campus_2_roads.txt — see Campus2RoadLayer.jsx. Separate toggle
  // from campus2 above so future phases (roundabouts/walkways/medians)
  // can each land as their own entry without touching this one.
  { key: 'campus2_roads', label: 'Campus 2 Roads (New)' },
  // Phase 3 — sports & parking infrastructure, digitized from
  // zmu_campus_2_02.txt — see Campus2ParkingLayer.jsx / Campus2GroundsLayer.jsx.
  { key: 'campus2_infra', label: 'Campus 2 Parking & Sports (New)' },
];

// Wired to real, tag-filtered PostGIS queries that legitimately return zero
// rows today (no fabricated geometry) — shown so the layer architecture is
// visibly complete, flagged so it's clear there's nothing to see yet.
// Commented out for now (none of these were enabled) — not deleted.
const EMPTY_LAYERS = [
  // { key: 'footpaths', label: 'Footpaths (OSM)' },
  // { key: 'grass', label: 'Grass (OSM)' },
  // { key: 'water', label: 'Water' },
  // { key: 'trees', label: 'Trees' },
  // { key: 'lights', label: 'Lighting poles' },
];

// Pure UI placeholders — no data source or rendering exists yet, per spec
// ("no fake live values yet — only prepare the architecture").
// Commented out for now (none of these were enabled) — not deleted.
const FUTURE_TOGGLES = [
  // { key: 'utilities', label: 'Utilities' },
  // { key: 'sensors', label: 'Sensors' },
  // { key: 'bms', label: 'BMS' },
];

export const ALL_LAYER_KEYS = [...LIVE_LAYERS, ...EMPTY_LAYERS].map((l) => l.key);
export const ALL_FUTURE_KEYS = FUTURE_TOGGLES.map((l) => l.key);

// Environmental / utility analytics overlays (see data/campusMetrics.js).
// These are RADIO options, not checkboxes, on purpose: each one recolours
// the same building meshes by its own threshold bands, so two at once would
// mean one silently overwriting the other. "None" restores the normal
// holographic look.
const ANALYTICS_OVERLAYS = [
  { key: 'aqi', label: OVERLAYS.aqi.label, hint: 'tints buildings + shows the affected-area plume' },
  { key: 'water', label: OVERLAYS.water.label, hint: 'tints buildings by % of permitted draw' },
  { key: 'power', label: OVERLAYS.power.label, hint: 'tints buildings by % of connected load' },
];

const CAMERA_STATUSES = [
  { key: 'online', label: 'Online' },
  { key: 'degraded', label: 'Degraded' },
  { key: 'offline', label: 'Offline' },
];

// Camera filter — status chips (toggle any combination), plus type and
// campus pickers. `filter` is {statuses:Set, kinds:Set, campuses:Set}; an
// empty facet means "everything" rather than "nothing", so clearing all
// three status chips shows the whole fleet again instead of an empty map.
function CameraFilter({ filter, onChange, health }) {
  const toggleStatus = (key) => {
    const next = new Set(filter.statuses);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ ...filter, statuses: next });
  };

  return (
    <div style={{ margin: '2px 0 6px 21px' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {CAMERA_STATUSES.map((s) => {
          const on = filter.statuses.size === 0 || filter.statuses.has(s.key);
          const css = CAMERA_STATUS_COLORS[s.key].css;
          return (
            <button
              key={s.key}
              onClick={() => toggleStatus(s.key)}
              title={`Show ${s.label.toLowerCase()} cameras`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                border: `1px solid ${on ? `${css}88` : 'rgba(120,160,190,0.22)'}`,
                background: on ? `${css}1f` : 'transparent',
                color: on ? css : 'rgba(220,240,250,0.35)',
                borderRadius: 5, padding: '2px 6px', fontSize: 9.5, fontWeight: 700,
                fontFamily: 'inherit', lineHeight: 1.4,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: on ? css : 'rgba(120,160,190,0.35)' }} />
              {health ? health[s.key] : 0}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <select
          value={[...filter.kinds][0] || ''}
          onChange={(e) => onChange({ ...filter, kinds: e.target.value ? new Set([e.target.value]) : new Set() })}
          style={selectStyle}
        >
          <option value="">All types</option>
          {Object.entries(CAMERA_KINDS).map(([key, k]) => (
            <option key={key} value={key}>{k.label}</option>
          ))}
        </select>
        <select
          value={[...filter.campuses][0] ?? ''}
          onChange={(e) => onChange({ ...filter, campuses: e.target.value ? new Set([Number(e.target.value)]) : new Set() })}
          style={selectStyle}
        >
          <option value="">Both campuses</option>
          <option value="1">Campus 1</option>
          <option value="2">Campus 2</option>
        </select>
      </div>

      {health && (
        <div style={{ fontSize: 9, color: 'rgba(220,240,250,0.4)', marginTop: 4 }}>
          Showing {health.shown} of {health.total} cameras
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 9.5,
  background: 'rgba(8,14,22,0.9)', color: 'rgba(220,240,250,0.85)',
  border: '1px solid rgba(77,226,255,0.25)', borderRadius: 5,
  padding: '2px 4px', cursor: 'pointer',
};

function OverlayRow({ item, checked, onSelect }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5,
      color: checked ? '#bcefff' : 'rgba(220,240,250,0.88)',
      padding: '3px 0', cursor: 'pointer',
    }}>
      <input
        type="radio"
        name="zt2-analytics-overlay"
        checked={checked}
        onChange={() => onSelect(item.key)}
        style={{ accentColor: '#4de2ff', width: 13, height: 13, cursor: 'pointer', marginTop: 2 }}
      />
      <span>
        {item.label}
        {item.hint && (
          <span style={{ display: 'block', fontSize: 9, color: 'rgba(220,240,250,0.38)', lineHeight: 1.35 }}>
            {item.hint}
          </span>
        )}
      </span>
    </label>
  );
}

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

export default function LayerControl({
  visibility, onToggle, emptyKeys, futureVisibility, onToggleFuture, onZoomToFit,
  analyticsOverlay, onSelectOverlay, cameraHealth, cameraFilter, onCameraFilterChange,
}) {
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
        <React.Fragment key={l.key}>
          <Row item={l} checked={!!visibility[l.key]} onToggle={onToggle} disabled={emptyKeys?.has(l.key)} />
          {/* Fleet health right under the CCTV toggle — the camera layer is
              now clickable (feed + per-camera health), so the roll-up
              belongs where the layer itself is switched on. */}
          {l.key === 'cctv' && visibility.cctv && cameraHealth?.total > 0 && (
            <CameraFilter filter={cameraFilter} onChange={onCameraFilterChange} health={cameraHealth} />
          )}
        </React.Fragment>
      ))}

      {EMPTY_LAYERS.length > 0 && (
        <>
          <div style={{ height: 1, background: 'rgba(77,226,255,0.15)', margin: '8px 0' }} />
          {EMPTY_LAYERS.map((l) => (
            <Row key={l.key} item={l} checked={!!visibility[l.key]} onToggle={onToggle} disabled={emptyKeys?.has(l.key)} />
          ))}
        </>
      )}

      {FUTURE_TOGGLES.length > 0 && (
        <>
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(220,240,250,0.4)', margin: '10px 0 4px',
          }}>
            Future integration
          </div>
          {FUTURE_TOGGLES.map((l) => (
            <Row key={l.key} item={l} checked={!!futureVisibility[l.key]} onToggle={onToggleFuture} disabled />
          ))}
        </>
      )}

      <div style={{ height: 1, background: 'rgba(77,226,255,0.15)', margin: '9px 0 6px' }} />
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: '#7fd8ff', marginBottom: 5,
      }}>
        Environment &amp; Utilities
      </div>
      <OverlayRow
        item={{ key: null, label: 'None', hint: null }}
        checked={!analyticsOverlay}
        onSelect={onSelectOverlay}
      />
      {ANALYTICS_OVERLAYS.map((o) => (
        <OverlayRow key={o.key} item={o} checked={analyticsOverlay === o.key} onSelect={onSelectOverlay} />
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
