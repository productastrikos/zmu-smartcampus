import React from 'react';
import SketchfabModal from './SketchfabModal';

// Sketchfab embed UI flags — hide the in-viewer title/author overlay,
// the buy button and the watermark logo/link (top-left "by Drone5" card,
// top-right $ and share icons in the raw embed). These are Sketchfab's
// own viewer UI painted inside their (cross-origin) iframe, so they can
// only be turned off via these URL params — CSS on our side can't reach
// into another origin's iframe content.
const SKETCHFAB_URL = 'https://sketchfab.com/models/6c4a0e6d75624560bccad1578ee1eeac/embed'
  + '?ui_infos=0&ui_watermark=0&ui_watermark_link=0&ui_stop=0';
const SKETCHFAB_TITLE = 'High School 3 interior exterior';

// Demo/mock BMS values exactly as specified by the user for this
// immersive viewer — no live BMS/IoT feed exists yet (consistent with
// this module's "future_*: Not yet integrated" honesty convention
// everywhere else); these are explicit, literal demo numbers, not a
// placeholder.
const MOCK_FIELDS = [
  ['Building ID', 'BLOCK-3'],
  ['Category', 'Academic'],
  ['Floors', '3'],
  ['Area', '12,500 m²'],
  ['Occupancy', '320'],
  ['Status', 'Operational'],
  ['HVAC', 'Healthy'],
  ['Fire System', 'Healthy'],
  ['Power', '98%'],
  ['Water', 'Normal'],
  ['Security', 'Online'],
  ['CCTV', '16 Cameras'],
  ['Energy', '425 kWh'],
  ['Temperature', '22°C'],
  ['Humidity', '48%'],
];

function InfoPanel() {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(220,240,250,0.45)', marginBottom: 8 }}>
        Building Information (demo data)
      </div>
      <div style={{ borderTop: '1px solid rgba(77,226,255,0.15)', paddingTop: 6 }}>
        {MOCK_FIELDS.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 12 }}>
            <span style={{ color: 'rgba(220,240,250,0.55)' }}>{label}</span>
            <span style={{ color: '#e8f4fb', fontWeight: 600, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Block-3-specific immersive viewer — the only building with a real
// Sketchfab interior scan today. Renders nothing (and mounts no iframe)
// until `open` is true.
export default function Block3Viewer({ open, onClose }) {
  return (
    <SketchfabModal
      open={open}
      title="Block-3"
      subtitle="3D Interior Digital Twin"
      sketchfabUrl={SKETCHFAB_URL}
      sketchfabTitle={SKETCHFAB_TITLE}
      infoPanel={<InfoPanel />}
      onClose={onClose}
    />
  );
}
