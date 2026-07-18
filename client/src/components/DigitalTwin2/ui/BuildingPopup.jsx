import React from 'react';

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 12 }}>
      <span style={{ color: 'rgba(220,240,250,0.55)' }}>{label}</span>
      <span style={{ color: '#e8f4fb', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const PLACEHOLDER = 'Not yet integrated';
const CATEGORY_LABELS = {
  administration: 'Administration', academic: 'Academic', library: 'Library', labs: 'Laboratories',
  training: 'Training', research: 'Research', student_services: 'Student Services', dining: 'Dining',
  medical: 'Medical', mosque: 'Mosque', security: 'Security', utility: 'Utility', maintenance: 'Maintenance',
  residential: 'Residential', sports_complex: 'Sports Complex', parade_hall: 'Parade Hall',
  structure: 'Structure (unclassified)', gate: 'Gate Structure',
};

// The building information panel. Real fields (display_name/category/
// height/levels/gross_area/osm_id) come straight from the shaped building
// record. category/display_name are neutral identifiers, not invented
// official names; levels/height come from a per-category configuration
// (levels_estimated: true), not verified official data. The future_*
// fields are architecture-only placeholders — no live BMS/IoT feed exists
// yet, exactly as specced.
export default function BuildingPopup({ building, onClose, onFlyTo }) {
  if (!building) return null;
  const categoryLabel = CATEGORY_LABELS[building.category] || building.category;
  return (
    <div style={{
      position: 'absolute', top: 16, right: 216, zIndex: 6, width: 270,
      background: 'rgba(8,14,22,0.82)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(77,226,255,0.3)', borderRadius: 12,
      padding: '14px 16px', boxShadow: '0 0 30px rgba(20,160,220,0.16)',
      fontFamily: 'inherit', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{building.display_name || building.id}</div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(220,240,250,0.6)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
        }}>✕</button>
      </div>
      <div style={{ fontSize: 10.5, color: '#7fd8ff', letterSpacing: '0.04em', marginBottom: 10 }}>
        {categoryLabel?.toUpperCase()}
      </div>

      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 6 }}>
        <Field label="Building ID" value={building.id} />
        <Field label="OSM ID" value={building.osm_id ?? '— (not OSM-digitized)'} />
        <Field label="Category" value={categoryLabel} />
        <Field label="Height" value={`${building.height?.toFixed(1)} m`} />
        <Field label="Levels (est.)" value={building.levels == null ? 'N/A' : building.levels_estimated ? `~${building.levels}` : building.levels} />
        <Field label="Gross area" value={`${building.gross_area?.toLocaleString()} m²`} />
        <Field label="Occupancy" value={building.occupancy ?? PLACEHOLDER} />
      </div>

      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(220,240,250,0.4)', margin: '12px 0 2px',
      }}>
        Future integration
      </div>
      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 6 }}>
        <Field label="BMS ID" value={building.future_bms_id ?? PLACEHOLDER} />
        <Field label="HVAC" value={PLACEHOLDER} />
        <Field label="Electrical" value={PLACEHOLDER} />
        <Field label="Fire alarm" value={PLACEHOLDER} />
        <Field label="Water" value={PLACEHOLDER} />
        <Field label="CCTV" value={PLACEHOLDER} />
        <Field label="Access control" value={PLACEHOLDER} />
        <Field label="Energy meters" value={PLACEHOLDER} />
        <Field label="Asset management" value={PLACEHOLDER} />
        <Field label="Maintenance status" value={PLACEHOLDER} />
      </div>

      <button
        onClick={onFlyTo}
        style={{
          marginTop: 12, width: '100%', padding: '7px 0', borderRadius: 7, cursor: 'pointer',
          border: '1px solid rgba(77,226,255,0.4)', background: 'rgba(77,226,255,0.12)',
          color: '#bcefff', fontSize: 11.5, fontWeight: 700,
        }}
      >
        Fly to building
      </button>
    </div>
  );
}
