import React, { useState } from 'react';
import { useApi } from '../services/api';
import HVACIncidentModal from './HVACIncidentModal';

/* ── SVG schematic primitives ─────────────────────────────── */
function SBox({ x, y, w, h, label, sub, status, onClick, pulse }) {
  const color = { running: '#4ade80', standby: '#6b7280', fault: '#ef4444', degraded: '#f59e0b', ok: '#4ade80', online: '#60a5fa' }[status] || '#6b7280';
  const isFault = status === 'fault';
  return (
    <g onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <rect x={x} y={y} width={w} height={h} rx="4"
        fill={isFault ? 'rgba(239,68,68,0.14)' : 'rgba(10,18,36,0.92)'}
        stroke={color} strokeWidth={isFault ? 2 : 1}
        className={pulse ? 'bdt-room-fault' : undefined} />
      <text x={x + w / 2} y={sub ? y + h / 2 - 6 : y + h / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="8.5" fontWeight="700" fill={color} fontFamily="Inter,system-ui">{label}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" dominantBaseline="middle"
        fontSize="7" fill="rgba(156,163,175,0.85)" fontFamily="Inter,system-ui">{sub}</text>}
      {isFault && <text x={x + w - 8} y={y + 10} textAnchor="middle" fontSize="9" fill="#ef4444" className="animate-blink">⚠</text>}
    </g>
  );
}
function Pipe({ x1, y1, x2, y2, color = 'rgba(96,165,250,0.55)', animated }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2"
    strokeDasharray={animated ? '8 4' : undefined} className={animated ? 'bdt-flow-line' : undefined} />;
}

const SUBSYSTEMS = [
  { key: 'hvac', label: 'HVAC / BMS', icon: '❄️' },
  { key: 'power', label: 'Power & UPS', icon: '⚡' },
  { key: 'fire', label: 'Fire & Life Safety', icon: '🔥' },
  { key: 'access', label: 'Access Control', icon: '🛡️' },
  { key: 'occupancy', label: 'Occupancy & IAQ', icon: '👥' },
];

const WORKFLOW = ['Detect', 'Isolate', 'Dispatch', 'Repair', 'Recommission', 'Close'];

export default function BuildingDigitalTwin({ buildingId, plantId, onClose }) {
  const { data: bData } = useApi(`/twin/building/${buildingId}`);
  const { data: plantData } = useApi(`/twin/building/${plantId}`);
  const [view, setView] = useState('floor');
  const [floor, setFloor] = useState(1);
  const [subsystem, setSubsystem] = useState('hvac');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [resolved, setResolved] = useState(false);

  if (!bData || !plantData) {
    return (
      <div className="bdt-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="app-loading"><div className="app-loading-orbit" /><div className="app-loading-text">Loading building digital twin…</div></div>
      </div>
    );
  }

  const { building: b, assets, security, series } = bData;
  const ahus = assets.filter((a) => a.type === 'AHU').sort((x, y) => x.asset_id.localeCompare(y.asset_id));
  const faultyAhu = resolved ? null : ahus.find((a) => a.status === 'fault');
  const fcus = assets.filter((a) => a.type === 'FCU');
  const pumps = assets.filter((a) => a.type === 'Pump');
  const chillers = plantData.assets.filter((a) => a.type === 'Chiller');
  // /api/twin/building/:id has no `.live` field (that's only on the campus-wide
  // /api/twin list) — derive the latest reading from the hourly series instead.
  const lastPoint = series && series.length ? series[series.length - 1] : {};
  const live = { temp_c: lastPoint.temp, co2_ppm: lastPoint.co2, occupancy_pct: lastPoint.occupancy, kwh: lastPoint.kwh };

  const hasHvacAlert = !!faultyAhu;
  const floors = Array.from({ length: b.floors || 3 }, (_, i) => i);
  const floorLabel = (i) => (i === 0 ? 'Ground' : `F${i}`);

  return (
    <div className="bdt-root">
      {/* ── Header ── */}
      <div className="bdt-header">
        <span style={{ fontSize: 22 }}>🏢</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{b.name} — Building Digital Twin</div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,229,255,0.65)' }}>{b.building_id} · {b.floors} floors · {b.area_m2.toLocaleString()} m² · BIM/IFC linked</div>
        </div>
        <span className="bdt-badge bdt-badge--live"><span className="bdt-dot" />LIVE</span>
        {hasHvacAlert && <span className="bdt-badge bdt-badge--alert">⚠ {faultyAhu.asset_id} FAULT</span>}
        <span className="bdt-badge bdt-badge--info">{live.temp_c ?? '—'}°C · {live.occupancy_pct ?? '—'}% occ</span>

        <div className="bdt-viewtoggle">
          {[['floor', 'Floor Plan'], ['hvac', 'HVAC Schematic']].map(([k, l]) => (
            <button key={k} className={`bdt-viewbtn${view === k ? ' is-active' : ''}`} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <button className="bdt-close" onClick={onClose}>✕ Close Twin</button>
      </div>

      {/* ── Body ── */}
      <div className="bdt-body">
        {/* Left panel */}
        <div className="bdt-left">
          <div className="bdt-section-label">Subsystems</div>
          {SUBSYSTEMS.map((s) => (
            <button key={s.key} className={`bdt-sysbtn${subsystem === s.key ? ' is-active' : ''}${s.key === 'hvac' && hasHvacAlert ? ' has-alert' : ''}`}
              onClick={() => setSubsystem(s.key)}>
              <span>{s.icon}</span><span>{s.label}</span>
              {s.key === 'hvac' && hasHvacAlert && <span className="bdt-sysbtn-dot" />}
            </button>
          ))}

          <div className="bdt-section-label" style={{ marginTop: 10 }}>Live Telemetry</div>
          <div className="bdt-kpigrid">
            <div className="bdt-kpi"><span className="bdt-kpi-label">Temp</span><span className="bdt-kpi-val" style={{ color: live.temp_c > 24 ? '#f87171' : '#4ade80' }}>{live.temp_c ?? '—'}°C</span></div>
            <div className="bdt-kpi"><span className="bdt-kpi-label">CO₂</span><span className="bdt-kpi-val" style={{ color: live.co2_ppm > 1000 ? '#fbbf24' : '#4ade80' }}>{live.co2_ppm ?? '—'}</span></div>
            <div className="bdt-kpi"><span className="bdt-kpi-label">Occupancy</span><span className="bdt-kpi-val" style={{ color: '#60a5fa' }}>{live.occupancy_pct ?? '—'}%</span></div>
            <div className="bdt-kpi"><span className="bdt-kpi-label">Energy</span><span className="bdt-kpi-val" style={{ color: '#22d3ee' }}>{live.kwh ?? '—'}</span></div>
          </div>

          <div className="bdt-section-label" style={{ marginTop: 10 }}>Incident Controls</div>
          {hasHvacAlert ? (
            <button className="bdt-simbtn bdt-simbtn--incident" onClick={() => setIncidentOpen(true)}>
              🚨 Open Incident Response — {faultyAhu.asset_id}
            </button>
          ) : (
            <div style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 6, padding: '8px 10px' }}>
              ✓ All HVAC assets nominal — incident resolved
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 10, color: 'rgba(148,163,184,0.4)', lineHeight: 1.5 }}>
            Building Digital Twin · BIM/IFC + live BMS telemetry via one-way data diode. Demo simulation console.
          </div>
        </div>

        {/* Center */}
        <div className="bdt-center">
          {view === 'floor' ? (
            <>
              <div className="bdt-floortabs">
                {floors.map((i) => (
                  <button key={i} className={`bdt-floortab${floor === i ? ' is-active' : ''}`} onClick={() => setFloor(i)}>{floorLabel(i)}</button>
                ))}
              </div>
              <div className="bdt-svgwrap">
                <svg viewBox="0 0 700 420" className="bdt-svg">
                  <rect width="700" height="420" fill="rgba(6,10,20,0.5)" rx="6" />
                  <text x="350" y="24" textAnchor="middle" fontSize="10" fill="rgba(0,229,255,0.5)" fontFamily="Inter,system-ui" letterSpacing="1">
                    {floorLabel(floor).toUpperCase()} FLOOR PLAN — {b.name.toUpperCase()}
                  </text>
                  {/* room grid — highlight fault zone on floor 1 (F1) since AHU-02 serves F1 in our narrative */}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const col = i % 4, row = Math.floor(i / 4);
                    const x = 40 + col * 155, y = 50 + row * 160;
                    const isFaultZone = floor === 1 && hasHvacAlert && i < 3;
                    const rooms = ['Lecture Hall A', 'Lecture Hall B', 'Lab 101', 'Staff Office', 'Lecture Hall C', 'Study Hall', 'Lab 102', 'Server Closet'];
                    return (
                      <SBox key={i} x={x} y={y} w={140} h={135} label={rooms[i]}
                        sub={isFaultZone ? `${(22.5 + (3 - i) * 1.1).toFixed(1)}°C ⚠` : '22.4°C ✓'}
                        status={isFaultZone ? 'fault' : 'running'} pulse={isFaultZone} />
                    );
                  })}
                </svg>
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.5)', textAlign: 'center' }}>
                {floor === 1 && hasHvacAlert
                  ? `${faultyAhu.asset_id} starved — 3 rooms on this floor running above setpoint`
                  : 'All zones on this floor within setpoint ±1°C'}
              </div>
            </>
          ) : (
            <div className="bdt-svgwrap" style={{ flexDirection: 'column' }}>
              <svg viewBox="0 0 900 460" className="bdt-svg">
                <rect width="900" height="460" fill="rgba(6,10,20,0.5)" rx="6" />
                <text x="450" y="16" textAnchor="middle" fontSize="9" fill="rgba(0,229,255,0.45)" fontFamily="Inter,system-ui" letterSpacing="1">
                  HVAC SYSTEM ARCHITECTURE — {b.name.toUpperCase()} (fed by Z12 Central Plant)
                </text>

                {/* Column 1: central plant chillers */}
                <text x="65" y="34" textAnchor="middle" fontSize="7.5" fill="rgba(96,165,250,0.4)" fontFamily="Inter,system-ui">Z12 CENTRAL PLANT</text>
                {chillers.slice(0, 4).map((c, i) => (
                  <SBox key={c.asset_id} x={8} y={42 + i * 50} w={116} h={44} label={`❄ ${c.asset_id}`} sub={`${c.health_pct}% · ${c.status}`} status={c.status} />
                ))}

                {/* Column 2: building pumps */}
                <text x="205" y="34" textAnchor="middle" fontSize="7.5" fill="rgba(96,165,250,0.4)" fontFamily="Inter,system-ui">{b.building_id} PUMPS</text>
                {pumps.map((p, i) => (
                  <SBox key={p.asset_id} x={148} y={42 + i * 56} w={112} h={44} label={`⚙ ${p.asset_id}`} sub={`${p.health_pct}% · ${p.status}`} status={p.status} />
                ))}
                {chillers.slice(0, 2).map((_, i) => <Pipe key={i} x1={124} y1={64 + i * 50} x2={148} y2={64 + i * 56} animated />)}

                {/* Column 3: AHUs */}
                <text x="345" y="34" textAnchor="middle" fontSize="7.5" fill="rgba(96,165,250,0.4)" fontFamily="Inter,system-ui">AIR HANDLING UNITS</text>
                {ahus.map((a, i) => (
                  <SBox key={a.asset_id} x={288} y={42 + i * 58} w={118} h={50}
                    label={`💨 ${a.asset_id}${a.status === 'fault' ? ' ⚠' : ''}`}
                    sub={a.status === 'fault' ? `${a.health_pct}% · FAULT` : `${a.health_pct}% · ${a.status}`}
                    status={a.status} pulse={a.status === 'fault'}
                    onClick={a.status === 'fault' ? () => setIncidentOpen(true) : undefined} />
                ))}
                {pumps.slice(0, 2).map((_, i) => <Pipe key={i} x1={260} y1={64 + i * 56} x2={288} y2={67 + i * 58} animated />)}

                {/* Column 4: FCUs / zones */}
                <text x="505" y="34" textAnchor="middle" fontSize="7.5" fill="rgba(96,165,250,0.4)" fontFamily="Inter,system-ui">FAN COIL UNITS / ZONES</text>
                {fcus.map((f, i) => {
                  const servedByFault = faultyAhu && i < 2;
                  return (
                    <SBox key={f.asset_id} x={432} y={42 + i * 50} w={130} h={40}
                      label={`🌡 ${f.asset_id}`}
                      sub={servedByFault ? 'starved ⚠' : `${f.health_pct}% · ${f.status}`}
                      status={servedByFault ? 'fault' : f.status} pulse={servedByFault} />
                  );
                })}
                {ahus.map((a, i) => (
                  <Pipe key={a.asset_id} x1={406} y1={67 + i * 58} x2={432} y2={62 + i * 50}
                    color={a.status === 'fault' ? 'rgba(239,68,68,0.5)' : 'rgba(96,165,250,0.55)'} animated={a.status !== 'fault'} />
                ))}

                {/* BMS bar */}
                <rect x="8" y="400" width="884" height="34" rx="4" fill="rgba(10,18,36,0.95)" stroke="rgba(96,165,250,0.3)" strokeWidth="1" />
                <text x="450" y="416" textAnchor="middle" fontSize="9" fill="rgba(96,165,250,0.8)" fontWeight="700" fontFamily="Inter,system-ui">
                  🖥 BMS Supervisory Layer — Vendor-neutral overlay {hasHvacAlert ? `· ⚠ ALARM ACTIVE: ${faultyAhu.asset_id}` : '· ALL NOMINAL'}
                </text>
                <text x="450" y="428" textAnchor="middle" fontSize="7.5" fill="rgba(96,165,250,0.4)" fontFamily="Inter,system-ui">
                  Data diode telemetry (flow 5) · one-way OT ingestion · CMMS-linked asset registry
                </text>
              </svg>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="bdt-right">
          <div className="bdt-section-label">SiA AI Advisory</div>
          <div className="bdt-advisory">
            <div className="bdt-advisory-title">🤖 {hasHvacAlert ? 'Active Fault Guidance' : 'Nominal — No Action Needed'}</div>
            {hasHvacAlert ? (
              <>
                <div className="bdt-advisory-action">Isolate {faultyAhu.asset_id} and transfer load to adjacent AHUs to protect the remaining classrooms.</div>
                <div className="bdt-advisory-action">Dispatch HVAC technician with bearing service kit — ETA 8 minutes from central store.</div>
                <div className="bdt-advisory-action">Predicted repair window: ~45 min. Portable cooling recommended for worst-affected rooms.</div>
              </>
            ) : (
              <div className="bdt-advisory-action">All subsystems within normal operating envelope. No advisories at this time.</div>
            )}
          </div>

          <div className="bdt-section-label" style={{ marginTop: 4 }}>Incident Workflow</div>
          {WORKFLOW.map((w, i) => {
            const activeIdx = hasHvacAlert ? 1 : resolved ? 5 : -1;
            const cls = i < activeIdx ? 'is-done' : i === activeIdx ? 'is-active' : '';
            return (
              <div key={w} className={`bdt-workflow-step ${cls}`}>
                <div className="bdt-wf-dot">{i < activeIdx ? '✓' : i + 1}</div>
                <div className="bdt-wf-label">{w}</div>
              </div>
            );
          })}

          <div className="bdt-section-label" style={{ marginTop: 10 }}>System Health</div>
          {[
            { name: 'HVAC / BMS', ok: !hasHvacAlert },
            { name: 'Power & UPS', ok: true },
            { name: 'Fire & Life Safety', ok: true },
            { name: 'Access Control', ok: !security || security.tailgating_alerts_24h === 0 },
            { name: 'Occupancy / IAQ', ok: (live.co2_ppm ?? 0) < 1000 },
          ].map((s) => (
            <div key={s.name} className="bdt-health-row">
              <span className="bdt-health-dot" style={{ background: s.ok ? '#4ade80' : '#ef4444' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: s.ok ? '#4ade80' : '#ef4444', fontWeight: 700 }}>{s.ok ? 'OK' : 'ALERT'}</span>
            </div>
          ))}
        </div>
      </div>

      {incidentOpen && (
        <HVACIncidentModal
          asset={faultyAhu}
          onClose={() => setIncidentOpen(false)}
          onResolve={() => setResolved(true)}
        />
      )}
    </div>
  );
}
