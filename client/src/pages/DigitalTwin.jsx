import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../services/api';
import { Panel, StatusChip, Loading, PageHeader, DataTable } from '../components/ui';
import BuildingTwin3D from '../components/BuildingTwin3D';

/* Every campus zone opens the same rich 3-D building twin, fed with that
   building's live ZMU telemetry, assets and security data. */

/* ── metric config for the live map colouring ──────────────── */
const METRICS = [
  { key: 'occupancy', label: 'Occupancy', unit: '%', get: (l) => l?.occupancy_pct, scale: [0, 100], low: '#123a5f', high: '#3b7de8' },
  { key: 'temp', label: 'Temperature', unit: '°C', get: (l) => l?.temp_c, scale: [21, 26], low: '#1d4ed8', high: '#ef4444' },
  { key: 'co2', label: 'Air quality', unit: 'ppm', get: (l) => l?.co2_ppm, scale: [400, 1200], low: '#15803d', high: '#f59e0b' },
  { key: 'energy', label: 'Energy', unit: 'kWh', get: (l) => l?.kwh, scale: [0, 260], low: '#134e4a', high: '#22d3ee' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t, 0, 1)));
const mul = (a, f) => a.map((v) => Math.round(clamp(v * f, 0, 255)));
const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;

/* ── landscaping: static decorative elements ───────────────── */
const TREES = [
  [285, 40], [285, 120], [285, 300], [500, 40], [500, 300], [500, 470],
  [285, 470], [285, 560], [700, 300], [690, 500], [730, 500], [770, 500],
  [40, 40], [40, 340], [40, 620], [960, 340], [820, 300],
];

function Tree({ x, y }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={x} cy={y + 3} rx="9" ry="3" fill="rgba(0,0,0,0.25)" />
      <circle cx={x} cy={y} r="7" fill="#1f6b43" />
      <circle cx={x - 3} cy={y - 2} r="5" fill="#2f8a58" />
      <circle cx={x + 3} cy={y - 1} r="4.5" fill="#268049" />
    </g>
  );
}

export default function DigitalTwin() {
  const { data, error } = useApi('/twin');
  const [metric, setMetric] = useState(METRICS[0]);
  const [hover, setHover] = useState(null);
  const [twinBuilding, setTwinBuilding] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // deep-link: /digital-twin?building=Z03 opens that building's 3-D twin
  // (used by the CCTV Incident Management module — building interdependency)
  useEffect(() => {
    const bid = searchParams.get('building');
    if (bid && data) {
      const b = data.buildings.find((x) => x.building_id === bid);
      if (b) setTwinBuilding(b);
    }
  }, [searchParams, data]);

  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading campus digital twin…" />;

  const loRgb = hexToRgb(metric.low), hiRgb = hexToRgb(metric.high);
  const roofColor = (b) => {
    const v = metric.get(b.live);
    if (v == null) return [90, 100, 116];
    return mix(loRgb, hiRgb, (v - metric.scale[0]) / (metric.scale[1] - metric.scale[0]));
  };
  const val = (b) => metric.get(b.live);

  // isometric extrusion vector
  const EV = { x: 0.5, y: -1 };
  const height = (b) => clamp(b.floors || 2, 1, 6) * 8;
  const drawOrder = [...data.buildings].sort((a, b) => (a.y - b.y) || (a.x - b.x));

  return (
    <>
      <PageHeader
        title="Campus Digital Twin"
        subtitle="Live 3-D supervisory view of all campus zones · BIM/IFC geometry · click any building for its full 3-D twin (telemetry via one-way data diode, flow 5)"
        right={
          <div className="app-timeframe-control">
            {METRICS.map((m) => (
              <button key={m.key} className={`app-timeframe-btn${metric.key === m.key ? ' is-active' : ''}`} onClick={() => setMetric(m)}>
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      <Panel title={`3-D Site Model — ${metric.label}`} sub="Click any building to open its 3-D digital twin" style={{ padding: 0, overflow: 'hidden' }}>
        <svg viewBox="0 0 1010 660" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <radialGradient id="ground" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#20303a" />
              <stop offset="100%" stopColor="#161f26" />
            </radialGradient>
            <pattern id="grass" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <rect width="8" height="8" fill="#1c3a2a" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#224733" strokeWidth="2" />
            </pattern>
            <pattern id="parking" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill="#2a2f36" />
              <line x1="8" y1="2" x2="8" y2="14" stroke="#3d4650" strokeWidth="1.4" />
            </pattern>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* ground */}
          <rect x="0" y="0" width="1010" height="660" fill="url(#ground)" />

          {/* landscaped lawns */}
          <rect x="560" y="500" width="410" height="110" rx="10" fill="url(#grass)" opacity="0.9" />
          <rect x="30" y="300" width="240" height="20" rx="6" fill="url(#grass)" opacity="0.6" />

          {/* water feature */}
          <path d="M690 235 q30 -18 62 -4 q22 10 14 34 q-10 26 -44 22 q-40 -4 -44 -28 q-3 -16 12 -24 z" fill="#1e5a86" opacity="0.9" />
          <path d="M700 240 q26 -12 50 -2" stroke="#3a86b8" strokeWidth="2" fill="none" opacity="0.7" />

          {/* road network */}
          <g>
            {/* horizontal spine */}
            <rect x="0" y="330" width="1010" height="30" fill="#2b3138" />
            <line x1="0" y1="345" x2="1010" y2="345" stroke="#6b7683" strokeWidth="1.5" strokeDasharray="18 14" />
            {/* vertical connectors */}
            <rect x="272" y="0" width="26" height="660" fill="#2b3138" />
            <line x1="285" y1="0" x2="285" y2="660" stroke="#6b7683" strokeWidth="1.5" strokeDasharray="18 14" />
            <rect x="492" y="0" width="26" height="660" fill="#2b3138" />
            <line x1="505" y1="0" x2="505" y2="660" stroke="#6b7683" strokeWidth="1.5" strokeDasharray="18 14" />
            {/* roundabout */}
            <circle cx="505" cy="345" r="26" fill="#2b3138" />
            <circle cx="505" cy="345" r="12" fill="#1c3a2a" stroke="#224733" strokeWidth="2" />
          </g>

          {/* parking with car marks */}
          <g>
            <rect x="742" y="382" width="216" height="96" rx="6" fill="url(#parking)" stroke="#3d4650" strokeWidth="1" />
            {Array.from({ length: 3 }).map((_, r) => Array.from({ length: 9 }).map((__, c) => {
              const cx = 752 + c * 23, cy = 392 + r * 30;
              return (r * 9 + c) % 3 !== 0 ? <rect key={`${r}-${c}`} x={cx} y={cy} width="15" height="20" rx="2" fill={['#7f8b99', '#5b6b7a', '#9aa7b4'][(r + c) % 3]} opacity="0.85" /> : null;
            }))}
            <text x="850" y="474" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--app-text-faint)', fontWeight: 600 }}>PARKING · ANPR</text>
          </g>

          {/* parade ground markings */}
          <g pointerEvents="none">
            <rect x="560" y="500" width="410" height="110" rx="10" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.4" strokeDasharray="6 6" />
            <text x="765" y="556" textAnchor="middle" style={{ fontSize: 10, fill: 'rgba(180,220,190,0.7)', fontWeight: 700, letterSpacing: '0.12em' }}>PARADE GROUND</text>
          </g>

          {/* perimeter fence */}
          <rect x="8" y="8" width="994" height="644" rx="16" fill="none" stroke="rgba(120,140,160,0.35)" strokeWidth="2" strokeDasharray="2 7" />
          {/* main gate */}
          <rect x="468" y="646" width="74" height="12" rx="3" fill="#12243c" stroke="rgba(120,140,160,0.5)" strokeWidth="1" />
          <text x="505" y="655" textAnchor="middle" style={{ fontSize: 8, fill: 'var(--app-text-faint)', fontWeight: 700 }}>MAIN GATE</text>

          {/* trees */}
          {TREES.map((t, i) => <Tree key={i} x={t[0]} y={t[1]} />)}

          {/* buildings — isometric extruded blocks, back-to-front */}
          {drawOrder.map((b) => {
            const e = height(b);
            const vx = e * EV.x, vy = e * EV.y;
            const P1 = [b.x, b.y], P2 = [b.x + b.w, b.y], P3 = [b.x + b.w, b.y + b.h], P4 = [b.x, b.y + b.h];
            const R = (p) => [p[0] + vx, p[1] + vy];
            const poly = (pts) => pts.map((p) => p.join(',')).join(' ');
            const rc = roofColor(b);
            const roofFill = rgb(rc), rightFill = rgb(mul(rc, 0.72)), frontFill = rgb(mul(rc, 0.55));
            const cx = b.x + b.w / 2 + vx, cy = b.y + b.h / 2 + vy;
            const issues = (b.live?.alarm_count || 0) + (b.assetIssues || 0);
            const v = val(b);
            return (
              <g key={b.building_id}
                style={{ cursor: 'pointer' }}
                onClick={() => setTwinBuilding(b)}
                onMouseEnter={() => setHover(b.building_id)}
                onMouseLeave={() => setHover((h) => (h === b.building_id ? null : h))}
                filter="url(#soft)">
                {/* footprint shadow */}
                <polygon points={poly([P1, P2, P3, P4])} fill="rgba(0,0,0,0.28)" />
                {/* walls */}
                <polygon points={poly([P4, P3, R(P3), R(P4)])} fill={frontFill} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
                <polygon points={poly([P3, P2, R(P2), R(P3)])} fill={rightFill} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
                {/* roof */}
                <polygon points={poly([R(P1), R(P2), R(P3), R(P4)])}
                  fill={roofFill} stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
                {/* roof detail line */}
                <polyline points={poly([R([b.x + 6, b.y + b.h / 2]), R([b.x + b.w - 6, b.y + b.h / 2])])} stroke="rgba(255,255,255,0.18)" strokeWidth="1" fill="none" />
                {/* label + live value */}
                <text x={cx} y={cy - 3} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: '#fff', pointerEvents: 'none' }}>{b.building_id}</text>
                <text x={cx} y={cy + 9} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'rgba(255,255,255,0.92)', pointerEvents: 'none' }}>
                  {v != null ? `${v}${metric.unit}` : '—'}
                </text>
                {/* alarm / issue marker */}
                {b.live?.alarm_count > 0 && (
                  <g pointerEvents="none">
                    <circle cx={R(P2)[0] - 6} cy={R(P2)[1] + 6} r="8" fill="var(--app-danger)" opacity="0.35" className="animate-blink" />
                    <circle cx={R(P2)[0] - 6} cy={R(P2)[1] + 6} r="4.5" fill="var(--app-danger)" />
                  </g>
                )}
                {b.live?.alarm_count === 0 && issues > 0 && (
                  <circle cx={R(P2)[0] - 6} cy={R(P2)[1] + 6} r="4.5" fill="var(--app-warning)" pointerEvents="none" />
                )}
                {/* every zone is a 3-D twin */}
                <g pointerEvents="none">
                  <circle cx={R(P1)[0] + 8} cy={R(P1)[1] + 8} r="7" fill="rgba(34,211,238,0.9)" stroke="#fff" strokeWidth="0.8" />
                  <text x={R(P1)[0] + 8} y={R(P1)[1] + 11} textAnchor="middle" fontSize="8" fontWeight="700" fill="#0a2a30">3D</text>
                </g>
              </g>
            );
          })}

          {/* hover tooltip */}
          {hover && (() => {
            const b = data.buildings.find((x) => x.building_id === hover);
            if (!b) return null;
            const boxH = 66;
            const tx = clamp(b.x + b.w / 2 - 70, 6, 830), ty = clamp(b.y - height(b) - (boxH + 10), 6, 560);
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width="150" height={boxH} rx="8" fill="rgba(10,10,14,0.94)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <text x={tx + 10} y={ty + 17} style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }}>{b.name}</text>
                <text x={tx + 10} y={ty + 31} style={{ fontSize: 9, fill: '#9fb2c6' }}>{b.live?.temp_c ?? '—'}°C · {b.live?.co2_ppm ?? '—'}ppm · {b.live?.occupancy_pct ?? '—'}%</text>
                <text x={tx + 10} y={ty + 44} style={{ fontSize: 9, fill: b.live?.alarm_count ? '#f87171' : '#4ade80' }}>
                  {b.live?.alarm_count ? `${b.live.alarm_count} active alarm` : 'nominal'} · {b.live?.kwh ?? '—'} kWh
                </text>
                <text x={tx + 10} y={ty + 58} style={{ fontSize: 8.5, fill: '#22d3ee', fontWeight: 700 }}>▸ Click for full 3-D twin</text>
              </g>
            );
          })()}

          {/* north arrow */}
          <g transform="translate(958, 40)" pointerEvents="none">
            <circle r="18" fill="rgba(10,10,14,0.6)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <polygon points="0,-12 5,2 0,-2 -5,2" fill="#ef4444" />
            <polygon points="0,12 5,2 0,6 -5,2" fill="#e8eef5" />
            <text x="0" y="-20" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: '#e8eef5' }}>N</text>
          </g>

          {/* scale bar */}
          <g transform="translate(28, 632)" pointerEvents="none">
            <line x1="0" y1="0" x2="120" y2="0" stroke="#e8eef5" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#e8eef5" strokeWidth="2" />
            <line x1="60" y1="-3" x2="60" y2="3" stroke="#e8eef5" strokeWidth="1.5" />
            <line x1="120" y1="-4" x2="120" y2="4" stroke="#e8eef5" strokeWidth="2" />
            <text x="0" y="-8" style={{ fontSize: 8, fill: '#9fb2c6' }}>0</text>
            <text x="120" y="-8" textAnchor="end" style={{ fontSize: 8, fill: '#9fb2c6' }}>100 m</text>
          </g>
        </svg>

        {/* legend */}
        <div style={{ display: 'flex', gap: 18, padding: '10px 16px 14px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--app-surface-raised)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ fontWeight: 700, color: 'var(--app-text-muted)' }}>{metric.label}</span>
            <span style={{ width: 90, height: 9, borderRadius: 5, background: `linear-gradient(90deg, ${metric.low}, ${metric.high})`, display: 'inline-block' }} />
            {metric.scale[0]}–{metric.scale[1]} {metric.unit}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--app-danger)', display: 'inline-block' }} /> active alarm
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--app-warning)', display: 'inline-block' }} /> asset issue
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'rgba(34,211,238,0.9)', display: 'inline-block' }} /> 3-D twin
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--app-text-faint)' }}>
            {data.buildings.length} zones · {data.buildings.reduce((s, b) => s + (b.live?.alarm_count || 0), 0)} alarms · live
          </div>
        </div>
      </Panel>

      <div style={{ marginTop: 14 }}>
        <Panel title="Zone Summary" sub="Latest telemetry snapshot per building · click a row for its 3-D twin">
          <DataTable
            columns={[
              { key: 'building_id', label: 'Zone' },
              { key: 'name', label: 'Building' },
              { key: 'live', label: 'Temp', render: (l) => `${l?.temp_c ?? '—'} °C` },
              { key: 'live', label: 'CO₂', render: (l) => `${l?.co2_ppm ?? '—'} ppm` },
              { key: 'live', label: 'Occupancy', render: (l) => `${l?.occupancy_pct ?? '—'}%` },
              { key: 'live', label: 'kWh/h', render: (l) => l?.kwh ?? '—' },
              { key: 'assetIssues', label: 'Asset Issues', render: (v, r) => {
                  const alarms = r.live?.alarm_count || 0;
                  return alarms + v > 0
                    ? <StatusChip kind={alarms > 0 ? 'danger' : 'warning'}>{alarms > 0 ? `${alarms} ALARM` : `${v} DEGRADED`}</StatusChip>
                    : <StatusChip kind="success">NORMAL</StatusChip>;
                } },
            ]}
            rows={data.buildings}
            onRowClick={(r) => setTwinBuilding(r)} />
        </Panel>
      </div>

      {twinBuilding && (
        <BuildingTwin3D
          building={twinBuilding}
          onClose={() => { setTwinBuilding(null); if (searchParams.get('building')) setSearchParams({}, { replace: true }); }}
        />
      )}
    </>
  );
}
