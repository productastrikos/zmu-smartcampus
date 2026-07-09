import React, { useState } from 'react';
import { useApi } from '../services/api';
import KPICard, { IcoPin, IcoAlert, IcoWatch, IcoShield, IcoSignal } from '../components/KPICard';
import { Panel, StatusChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo } from '../components/ui';

/* Geofencing & Cadet Tracking — Garmin wearable GPS streams ingested via
   the HPO middleware (flow 4), evaluated against campus zone polygons on
   the Digital Twin coordinate space (REQ-CAS-2). Breaches raise real-time
   alerts on the security dashboard. */

const ZONE_STYLE = {
  restricted: { fill: 'rgba(239,68,68,0.14)',  stroke: '#ef4444', label: '#fca5a5' },
  training:   { fill: 'rgba(245,158,11,0.12)', stroke: '#f59e0b', label: '#fcd34d' },
  permitted:  { fill: 'rgba(34,197,94,0.07)',  stroke: '#22c55e', label: '#86efac' },
};

function GeoMap({ zones, buildings, pings, onSelectPing, selectedId }) {
  return (
    <svg viewBox="0 0 1010 660" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* ground + roads (matches campus twin coordinate space) */}
      <rect x="0" y="0" width="1010" height="660" fill="#141a22" />
      <rect x="0" y="330" width="1010" height="30" fill="#232a33" />
      <rect x="272" y="0" width="26" height="660" fill="#232a33" />
      <rect x="492" y="0" width="26" height="660" fill="#232a33" />

      {/* buildings — flat footprints for orientation */}
      {buildings.map((b) => (
        <g key={b.building_id}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="#2b3542" stroke="#3a4757" strokeWidth="1" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 3} textAnchor="middle" fontSize="10" fill="#7d8fa5" fontWeight="600">
            {b.building_id}
          </text>
        </g>
      ))}

      {/* geofence zones */}
      {zones.map((z) => {
        const s = ZONE_STYLE[z.type] || ZONE_STYLE.permitted;
        return (
          <g key={z.zone_id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6"
              fill={s.fill} stroke={s.stroke} strokeWidth="1.6" strokeDasharray={z.type === 'restricted' ? '7 5' : 'none'} />
            <text x={z.x + 8} y={z.y + 16} fontSize="10.5" fill={s.label} fontWeight="700" letterSpacing="0.04em">
              {z.name.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* live GPS pings */}
      {pings.map((p) => {
        const breach = p.zone_status === 'breach';
        const sel = selectedId === p.cadet_id;
        return (
          <g key={p.cadet_id} style={{ cursor: 'pointer' }} onClick={() => onSelectPing(p)}>
            {breach && <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.7" className="animate-blink" />}
            <circle cx={p.x} cy={p.y} r={sel ? 6.5 : 4.5}
              fill={breach ? '#ef4444' : '#38bdf8'}
              stroke={sel ? '#fff' : 'rgba(255,255,255,0.5)'} strokeWidth={sel ? 2 : 1} />
            {(breach || sel) && (
              <text x={p.x + 10} y={p.y + 4} fontSize="10" fill={breach ? '#fca5a5' : '#bae6fd'} fontWeight="700">
                {p.cadet_id}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function Geofencing() {
  const { data } = useApi('/geofence');
  const [selected, setSelected] = useState(null);

  if (!data) return <Loading text="Loading geofencing module…" />;
  const k = data.kpis;
  const activeBreaches = data.breaches.filter((b) => b.status === 'active');

  return (
    <>
      <PageHeader
        title="Geofencing & Cadet Tracking"
        subtitle="Garmin GPS streams → HPO middleware (flow 4) → zone evaluation on the Campus Digital Twin coordinate space · breaches alert in real time"
      />

      <KPIGrid>
        <KPICard label="Cadets Tracked (live)" value={k.tracked} icon={<IcoWatch />} subValues={[{ label: 'Source', value: 'Garmin Health API' }]} />
        <KPICard label="Active Breaches" value={k.activeBreaches} icon={<IcoAlert />}
          rag={k.activeBreaches > 0 ? 'critical' : 'normal'}
          subValues={[{ label: 'Response', value: k.activeBreaches ? 'Patrol dispatched' : '—' }]} />
        <KPICard label="Breaches — 24h" value={k.breaches24h} icon={<IcoPin />} rag={k.breaches24h > 8 ? 'warning' : 'normal'} />
        <KPICard label="Restricted Zones" value={k.zonesRestricted} icon={<IcoShield />} subValues={[{ label: 'Total zones', value: data.zones.length }]} />
        <KPICard label="Device Sync Rate" value={`${k.deviceSyncRate}%`} icon={<IcoSignal />} rag={k.deviceSyncRate < 90 ? 'warning' : 'normal'} subValues={[{ label: 'Window', value: '≤ 12h' }]} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <Panel title="Live Zone Map" sub="Click a marker for cadet detail · red halo = inside restricted geofence" style={{ padding: 0, overflow: 'hidden' }}>
          <GeoMap zones={data.zones} buildings={data.buildings} pings={data.pings}
            onSelectPing={(p) => setSelected(p)} selectedId={selected?.cadet_id} />
          {selected && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--app-surface-raised)', display: 'flex', gap: 18, alignItems: 'center', fontSize: 11.5, color: 'var(--app-text-muted)', flexWrap: 'wrap' }}>
              <b style={{ color: 'var(--app-text)' }}>{selected.name}</b>
              <span>{selected.cadet_id} · {selected.squadron} Sqn</span>
              <span>Device: {selected.device}</span>
              <span>Ping {timeAgo(selected.ts)}</span>
              <StatusChip kind={selected.zone_status === 'breach' ? 'danger' : 'success'}>
                {selected.zone_status === 'breach' ? 'GEOFENCE BREACH' : 'IN PERMITTED ZONE'}
              </StatusChip>
            </div>
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activeBreaches.length > 0 && (
            <Panel title="⚠ Active Breach Response" sub="Pushed to security dashboard alert feed">
              {activeBreaches.map((b) => (
                <div key={b.breach_id} style={{
                  padding: '9px 12px', marginBottom: 6, borderRadius: 8,
                  background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text)' }}>
                    {b.name} <span style={{ color: 'var(--app-text-faint)', fontWeight: 500 }}>({b.cadet_id})</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-muted)', marginTop: 2 }}>
                    {b.zone} · {b.duration_min} min inside · {b.device} · {timeAgo(b.ts)}
                  </div>
                </div>
              ))}
            </Panel>
          )}

          <Panel title="Zone Definitions" sub="Polygon registry on twin coordinates">
            <DataTable
              columns={[
                { key: 'name', label: 'Zone' },
                { key: 'type', label: 'Type', render: (v) => <StatusChip kind={v === 'restricted' ? 'danger' : v === 'training' ? 'warning' : 'success'}>{v.toUpperCase()}</StatusChip> },
                { key: 'zone_id', label: 'ID' },
              ]}
              rows={data.zones} />
          </Panel>
        </div>
      </div>

      <Panel title="Breach Event Log — 24h" sub="Geofence evaluations logged to the security audit trail (flow 7)" style={{ marginTop: 14 }}>
        <DataTable
          maxHeight={300}
          columns={[
            { key: 'ts', label: 'Time', render: (v) => timeAgo(v) },
            { key: 'breach_id', label: 'Event' },
            { key: 'name', label: 'Cadet' },
            { key: 'cadet_id', label: 'Cadet ID' },
            { key: 'squadron', label: 'Squadron' },
            { key: 'zone', label: 'Zone' },
            { key: 'device', label: 'Device' },
            { key: 'duration_min', label: 'Duration', render: (v) => `${v} min`, align: 'right' },
            { key: 'status', label: 'Status', render: (v) => <StatusChip kind={v === 'active' ? 'danger' : v === 'responded' ? 'warning' : 'success'}>{v.toUpperCase()}</StatusChip> },
          ]}
          rows={data.breaches} />
      </Panel>
    </>
  );
}
