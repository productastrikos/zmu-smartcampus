import React from 'react';
import { useApi } from '../services/api';
import KPICard, { IcoBolt, IcoCpu, IcoWind, IcoCheck, IcoWrench } from '../components/KPICard';
import { Panel, StatusChip, Loading, PageHeader, KPIGrid, DataTable, ProgressBar } from '../components/ui';
import { TrendChart, Donut, C } from '../components/charts';

/* Enterprise IT Management — DCIM (Central Plant & Data Centre, Z12),
   software licence compliance (REQ-AL-020) and IT asset lifecycle. */

const licColor = (l) =>
  l.compliance === 'over' ? 'var(--app-danger)' : l.compliance === 'warning' ? 'var(--app-warning)' : '#3b7de8';

export default function ITManagement() {
  const { data } = useApi('/itops');
  if (!data) return <Loading text="Loading IT operations module…" />;
  const k = data.kpis;

  const donutData = [
    { name: 'Consumed', value: k.seatsConsumed, color: '#3b7de8' },
    { name: 'Available', value: Math.max(0, k.seatsTotal - k.seatsConsumed), color: '#2a2a2a' },
  ];

  return (
    <>
      <PageHeader
        title="Enterprise IT & DCIM"
        subtitle="Data centre infrastructure (Z12) · software licence management (REQ-AL-020) · IT asset lifecycle"
      />

      <KPIGrid>
        <KPICard label="PUE (Current)" value={k.pue} icon={<IcoBolt />}
          rag={k.pue > 1.6 ? 'warning' : 'normal'} subValues={[{ label: 'Target', value: '≤ 1.6' }]} />
        <KPICard label="Cooling Capacity Used" value={`${k.coolingUsedPct}%`} icon={<IcoWind />}
          rag={k.coolingUsedPct > 85 ? 'critical' : 'normal'} subValues={[{ label: 'Headroom', value: `${100 - k.coolingUsedPct}%` }]} />
        <KPICard label="UPS Battery Health" value={`${k.upsHealth}%`} icon={<IcoCheck />}
          rag={k.upsHealth < 90 ? 'warning' : 'normal'} subValues={[{ label: 'Autonomy', value: '18 min' }]} />
        <KPICard label="Licence Compliance" value={`${k.licenseCompliancePct}%`} icon={<IcoCpu />}
          rag={k.licenseCompliancePct < 70 ? 'warning' : 'normal'}
          subValues={[{ label: 'Seats', value: `${k.seatsConsumed.toLocaleString()} / ${k.seatsTotal.toLocaleString()}` }]} />
        <KPICard label="IT Assets In Service" value={`${k.assetsInService}/${k.assetsTotal}`} icon={<IcoWrench />}
          rag={k.warrantyExpiring > 8 ? 'warning' : 'normal'}
          subValues={[{ label: 'Warranty attention', value: k.warrantyExpiring }]} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Software Licences — Total vs Consumed" sub="Named-seat compliance per platform · REQ-AL-020">
          {data.licenses.map((l) => (
            <div key={l.software} style={{ marginBottom: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                <span style={{ color: 'var(--app-text)', fontWeight: 600 }}>
                  {l.software} <span style={{ color: 'var(--app-text-faint)', fontWeight: 400 }}>· {l.vendor}</span>
                </span>
                <span style={{ color: 'var(--app-text-muted)' }}>
                  {l.consumed}/{l.total} ({l.utilization_pct}%)
                  <StatusChip kind={l.compliance === 'over' ? 'danger' : l.compliance === 'warning' ? 'warning' : 'success'}>
                    {l.compliance === 'over' ? 'OVER-DEPLOYED' : l.compliance === 'warning' ? `RENEW ${l.renewal_days}d` : 'COMPLIANT'}
                  </StatusChip>
                </span>
              </div>
              <ProgressBar pct={l.utilization_pct} color={licColor(l)} />
            </div>
          ))}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Seat Pool Overview" sub="All platforms aggregated">
            <Donut data={donutData} nameKey="name" valueKey="value" height={170} />
          </Panel>
          <Panel title="PUE — 24h Trend" sub="Power usage effectiveness · DC hall A">
            <TrendChart data={data.dcimHourly} x="hour" height={150} yDomain={[1.2, 1.8]}
              series={[{ key: 'pue', name: 'PUE', color: C.amber }]} />
          </Panel>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 14 }}>
        <Panel title="DCIM — Critical Metrics" sub="Central Plant & Data Centre (Z12) · N+1 posture">
          {data.dcim.map((m) => (
            <div key={m.metric} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', marginBottom: 5, borderRadius: 8, background: 'var(--app-surface-soft)',
            }}>
              <span style={{ fontSize: 11.5, color: 'var(--app-text-muted)' }}>{m.metric}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <b style={{ fontSize: 12.5, color: 'var(--app-text)' }}>{m.value}</b>
                <span style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>target {m.target}</span>
                <StatusChip kind={m.status === 'ok' ? 'success' : 'warning'}>{m.status.toUpperCase()}</StatusChip>
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="IT Asset Lifecycle" sub="High-tier lab workstations, servers, network & AV — warranty and health tracking">
          <DataTable
            maxHeight={420}
            columns={[
              { key: 'asset_id', label: 'Asset' },
              { key: 'type', label: 'Type' },
              { key: 'model', label: 'Model' },
              { key: 'building_id', label: 'Location' },
              { key: 'warranty_end', label: 'Warranty End' },
              { key: 'warranty_status', label: 'Warranty', render: (v) => <StatusChip kind={v === 'active' ? 'success' : v === 'expiring' ? 'warning' : 'danger'}>{v.toUpperCase()}</StatusChip> },
              { key: 'health_pct', label: 'Health', render: (v) => <span style={{ color: v < 70 ? 'var(--app-danger)' : v < 85 ? 'var(--app-warning)' : 'var(--app-success)', fontWeight: 700 }}>{v}%</span>, align: 'right' },
              { key: 'status', label: 'Status', render: (v) => <StatusChip kind={v === 'in service' ? 'success' : 'warning'}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={data.assets} />
        </Panel>
      </div>
    </>
  );
}
