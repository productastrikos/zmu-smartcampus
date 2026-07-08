import React, { useMemo, useState } from 'react';
import { useApi } from '../services/api';
import { StatusChip, sevChip, DataTable } from './ui';
import { TrendChart, C } from './charts';
import NestBuilding3D from './NestTwin/NestBuilding3D';

/* Full-screen 3-D building digital twin.
   The 3-D geometry is a representative BIM shell; every number shown
   around it is live ZMU dashboard data pulled from /api/twin/building/:id
   and the campus list. */

const FLOOR_TABS = [
  { id: null, label: 'All floors' },
  { id: 'F1', label: 'F1 · Lower' },
  { id: 'F2', label: 'F2 · Mid' },
  { id: 'F3', label: 'F3 · Upper' },
];

/* Map a ZMU asset fault to one of the 3-D model's visual incident types.
   Only 'fire' and 'power' produce a room highlight in the model, so we
   route life-safety faults to 'fire' and everything else (MEP/HVAC/power)
   to a generic 'power' highlight. */
function incidentFor(faultAssets) {
  if (!faultAssets.length) return null;
  const lifeSafety = faultAssets.some((a) => /fire|smoke|facp|sprinkler/i.test(a.type));
  return lifeSafety ? 'fire' : 'power';
}

export default function BuildingTwin3D({ building, onClose }) {
  const id = building.building_id;
  const { data } = useApi(`/twin/building/${id}`);
  const [floor, setFloor] = useState(null);
  const [locate, setLocate] = useState(false);

  const assets = data?.assets || [];
  const series = data?.series || [];
  const security = data?.security || null;
  const energy30d = data?.energy30d || [];

  // /api/twin/building/:id carries no `.live`; the campus list item does.
  const live = useMemo(() => {
    if (building.live) return building.live;
    const lp = series.length ? series[series.length - 1] : {};
    return { temp_c: lp.temp, co2_ppm: lp.co2, occupancy_pct: lp.occupancy, kwh: lp.kwh };
  }, [building.live, series]);

  const faultAssets = assets.filter((a) => a.status === 'fault' || a.status === 'degraded');
  const faultLead = faultAssets.find((a) => a.status === 'fault') || faultAssets[0] || null;
  const alarmCount = (live?.alarm_count || 0) + faultAssets.length;
  const incidentType = incidentFor(faultAssets);
  const incidentSim = locate && incidentType ? incidentType : null;

  const kpi = (label, value, color) => (
    <div className="bdt-kpi">
      <span className="bdt-kpi-label">{label}</span>
      <span className="bdt-kpi-val" style={{ color }}>{value}</span>
    </div>
  );

  return (
    <div className="bdt-root">
      {/* ── Header ── */}
      <div className="bdt-header">
        <span style={{ fontSize: 22 }}>🏢</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{building.name} — 3-D Digital Twin</div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,229,255,0.65)' }}>
            {building.building_id} · {building.floors} floors · {(building.area_m2 || 0).toLocaleString()} m² · BIM/IFC shell + live BMS
          </div>
        </div>
        <span className="bdt-badge bdt-badge--live"><span className="bdt-dot" />LIVE</span>
        {alarmCount > 0 && (
          <span className="bdt-badge bdt-badge--alert">
            ⚠ {faultLead ? `${faultLead.asset_id} ${faultLead.status.toUpperCase()}` : `${alarmCount} ALARM`}
          </span>
        )}
        <span className="bdt-badge bdt-badge--info">
          {live?.temp_c ?? '—'}°C · {live?.occupancy_pct ?? '—'}% occ · {live?.kwh ?? '—'} kWh
        </span>
        <button className="bdt-close" onClick={onClose}>✕ Close Twin</button>
      </div>

      {/* ── Body ── */}
      <div className="bdt-body">
        {/* Left — live telemetry + controls */}
        <div className="bdt-left">
          <div className="bdt-section-label">Live Telemetry</div>
          <div className="bdt-kpigrid">
            {kpi('Temp', `${live?.temp_c ?? '—'}°C`, (live?.temp_c ?? 0) > 24 ? '#f87171' : '#4ade80')}
            {kpi('CO₂', `${live?.co2_ppm ?? '—'}`, (live?.co2_ppm ?? 0) > 1000 ? '#fbbf24' : '#4ade80')}
            {kpi('Occupancy', `${live?.occupancy_pct ?? '—'}%`, '#60a5fa')}
            {kpi('Energy', `${live?.kwh ?? '—'}`, '#22d3ee')}
            {live?.humidity_pct != null && kpi('Humidity', `${live.humidity_pct}%`, '#a78bfa')}
            {live?.water_l != null && kpi('Water', `${live.water_l} L`, '#38bdf8')}
          </div>

          <div className="bdt-section-label" style={{ marginTop: 10 }}>Incident Controls</div>
          {incidentType ? (
            <button
              className={`bdt-simbtn bdt-simbtn--incident`}
              onClick={() => setLocate((v) => !v)}
            >
              {locate ? '✓ Fault zones highlighted' : `🎯 Locate ${faultLead?.asset_id || 'fault'} in 3-D`}
            </button>
          ) : (
            <div style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 6, padding: '8px 10px' }}>
              ✓ All monitored assets nominal
            </div>
          )}

          <div className="bdt-section-label" style={{ marginTop: 12 }}>System Health</div>
          {[
            { name: 'HVAC / BMS', ok: !faultAssets.some((a) => /ahu|fcu|chiller|pump|hvac/i.test(a.type)) },
            { name: 'Power & UPS', ok: !faultAssets.some((a) => /ups|power|panel|generator/i.test(a.type)) },
            { name: 'Fire & Life Safety', ok: !faultAssets.some((a) => /fire|smoke|facp/i.test(a.type)) },
            { name: 'Access Control', ok: !security || (security.tailgating_alerts_24h || 0) === 0 },
            { name: 'Occupancy / IAQ', ok: (live?.co2_ppm ?? 0) < 1000 },
          ].map((s) => (
            <div key={s.name} className="bdt-health-row">
              <span className="bdt-health-dot" style={{ background: s.ok ? '#4ade80' : '#ef4444' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: s.ok ? '#4ade80' : '#ef4444', fontWeight: 700 }}>{s.ok ? 'OK' : 'ALERT'}</span>
            </div>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 10, color: 'rgba(148,163,184,0.4)', lineHeight: 1.5 }}>
            BIM/IFC geometry + live BMS telemetry via one-way data diode (flow 5). Drag to orbit · scroll to zoom.
          </div>
        </div>

        {/* Center — the 3-D building */}
        <div className="bdt-center">
          <div className="bdt-floortabs">
            {FLOOR_TABS.map((t) => (
              <button
                key={t.label}
                className={`bdt-floortab${floor === t.id ? ' is-active' : ''}`}
                onClick={() => setFloor(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,229,255,0.12)' }}>
            <NestBuilding3D
              selectedFloor={floor}
              incidentSim={incidentSim}
              incidentStage={incidentSim ? 2 : 0}
              onFloorClick={(f) => setFloor((prev) => (prev === f ? null : f))}
              onRoomClick={() => {}}
            />
          </div>

          <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.5)', textAlign: 'center' }}>
            {incidentSim
              ? `${faultLead?.asset_id || 'Fault'} located — affected zones highlighted on the model`
              : floor
                ? `Isolating ${floor} — click a floor tab again to show all floors`
                : 'Live 3-D twin · click a room or floor to inspect · telemetry updates from BMS'}
          </div>
        </div>

        {/* Right — ZMU asset & security data */}
        <div className="bdt-right">
          <div className="bdt-section-label">MEP Assets · CMMS-linked</div>
          <DataTable
            maxHeight={230}
            columns={[
              { key: 'asset_id', label: 'Asset' },
              { key: 'type', label: 'Type' },
              { key: 'health_pct', label: 'Health', render: (v) => <span style={{ color: v < 60 ? '#f87171' : v < 80 ? '#fbbf24' : '#4ade80', fontWeight: 700 }}>{v}%</span> },
              { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={assets}
          />

          {security && (
            <>
              <div className="bdt-section-label" style={{ marginTop: 6 }}>Physical Security · ORANGE net</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 11.5, color: '#94a3b8' }}>
                <div>CCTV <b style={{ color: '#e2e8f0' }}>{security.cameras_online}/{security.cameras_total}</b></div>
                <div>Access 24h <b style={{ color: '#e2e8f0' }}>{(security.access_events_24h || 0).toLocaleString()}</b></div>
                <div>Denied <b style={{ color: '#fbbf24' }}>{security.denied_access_24h ?? 0}</b></div>
                <div>Tailgating <b style={{ color: security.tailgating_alerts_24h ? '#ef4444' : '#4ade80' }}>{security.tailgating_alerts_24h ?? 0}</b></div>
              </div>
            </>
          )}

          {energy30d.length > 0 && (
            <>
              <div className="bdt-section-label" style={{ marginTop: 10 }}>Energy — 30 days (Estidama)</div>
              <TrendChart data={energy30d} x="date" height={130} type="area"
                series={[{ key: 'kwh', name: 'kWh/day', color: C.amber }]} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
