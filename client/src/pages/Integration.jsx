import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoLink, IcoActivity, IcoDatabase, IcoShield, IcoCheck, IcoGlobe } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable } from '../components/ui';
import { TrendChart, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';

const TRANSPORT_CHIP = {
  'API / ESB': 'info', 'SCIM / API': 'info', 'REST / JSON': 'info',
  'Data Diode': 'warning', MFT: 'accent', 'Syslog RFC 5424': 'accent', 'Async Repl / FedNet': 'success',
};

export default function Integration() {
  const { data, error } = useApi('/integration');
  const [detail, setDetail] = useState(null);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading integration platform…" />;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Integration & Data Platform"
        subtitle="Governed exchange backbone — API gateway & ESB/iPaaS · master data & single cadet ID · controlled file-exchange gateway · data lake & analytics"
        right={<StatusChip kind={k.flowsHealthy === k.flowsTotal ? 'success' : 'warning'}>{k.flowsHealthy}/{k.flowsTotal} FLOWS HEALTHY</StatusChip>}
      />

      <KPIGrid min={185}>
        <KPICard label="Messages — 24h" value={fmt.int(k.msgs24h)} icon={<IcoActivity />} rag="normal"
          subValues={[{ label: 'Avg API latency', value: `${k.avgLatency} ms` }]}
          onClick={() => setDetail({
            title: 'Messages — 24h', subtitle: `${fmt.int(k.msgs24h)} messages · avg API latency ${k.avgLatency} ms`, source: 'API Gateway & ESB / iPaaS',
            content: <TrendChart data={data.hourly} x="hour" height={230}
              series={[{ key: 'api_msgs', name: 'API msgs/h', color: C.blue, area: true }]} />,
          })} />
        <KPICard label="Flow Error Rate" value={`${k.avgErrorRate}%`} icon={<IcoLink />} rag={k.avgErrorRate > 1 ? 'warning' : 'normal'}
          subValues={[{ label: 'Worst', value: 'Flow 5 · 2.8%' }]}
          onClick={() => setDetail({
            title: 'Flow Error Rate', subtitle: `${k.avgErrorRate}% average across all 8 governed flows`, source: 'Integration & Data Platform',
            content: (
              <DataTable
                columns={[
                  { key: 'flow_no', label: '#' },
                  { key: 'name', label: 'Flow' },
                  { key: 'error_rate_pct', label: 'Err %', align: 'right', render: (v) => <b style={{ color: v > 1 ? 'var(--app-warning)' : 'var(--app-text)' }}>{v}</b> },
                ]}
                rows={data.flows} />
            ),
          })} />
        <KPICard label="Cadet ID Match" value={`${k.cadetIdMatch}%`} icon={<IcoDatabase />} rag="normal"
          subValues={[{ label: 'Golden records', value: '2,096' }]}
          onClick={() => setDetail({
            title: 'Cadet ID Match', subtitle: `${k.cadetIdMatch}% match rate on the single immutable Cadet ID`, source: 'Master Data Management',
            content: (
              <DataTable
                columns={[
                  { key: 'entity', label: 'Entity' },
                  { key: 'match_rate_pct', label: 'Match', align: 'right', render: (v) => `${v}%` },
                  { key: 'duplicates', label: 'Dupes', align: 'right' },
                ]}
                rows={data.masterData} />
            ),
          })} />
        <KPICard label="MFT Transfers — 24h" value={k.mftFiles24h} icon={<IcoShield />} rag="normal"
          subValues={[{ label: 'AV scan + audit', value: '100%' }]}
          onClick={() => setDetail({
            title: 'MFT Transfers — 24h', subtitle: `${k.mftFiles24h} files transferred, 100% AV-scanned and audit-logged`, source: 'Controlled File-Exchange Gateway',
            content: <TrendChart data={data.hourly} x="hour" height={230}
              series={[{ key: 'mft_files', name: 'MFT files/h', color: C.green, area: true }]} />,
          })} />
        <KPICard label="ICDs Approved" value={`${k.icdsApproved}/${k.icdsTotal}`} icon={<IcoCheck />} rag={k.icdsApproved < k.icdsTotal ? 'warning' : 'normal'}
          onClick={() => setDetail({
            title: 'ICDs Approved', subtitle: `${k.icdsApproved} of ${k.icdsTotal} Interface Control Documents approved`, source: 'ICD Governance',
            content: (
              <DataTable
                columns={[
                  { key: 'icd_id', label: 'ICD' },
                  { key: 'interface', label: 'Interface' },
                  { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={data.icds} />
            ),
          })} />
        <KPICard label="DR / Backup" value="OK" icon={<IcoGlobe />} rag="normal"
          subValues={[{ label: 'Repl. lag', value: '38 s' }, { label: 'Core42', value: '02:00' }]}
          onClick={() => setDetail({
            title: 'DR / Backup', subtitle: 'Async replication ≥ 50 km · backup to Core42 via FedNet', source: 'Resilience & Continuity (flow 8)',
            content: (
              <DataTable
                columns={[
                  { key: 'metric', label: 'Control' },
                  { key: 'value', label: 'Current', align: 'right' },
                  { key: 'status', label: '', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={data.dr} />
            ),
          })} />
      </KPIGrid>

      <Panel title="Key Data Flows 1–8" sub="Per the governed data-flow architecture — IAM-enforced authorization on every flow · TLS in transit · DLP tagging" style={{ marginBottom: 14 }}>
        {data.flows.map((f) => (
          <div key={f.flow_no} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            borderRadius: 10, background: 'var(--app-surface-soft)', marginBottom: 8, flexWrap: 'wrap',
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99, flexShrink: 0,
              background: f.status === 'healthy' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: f.status === 'healthy' ? 'var(--app-success)' : 'var(--app-warning)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
            }}>{f.flow_no}</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>{f.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{f.source} → {f.target}</div>
            </div>
            <StatusChip kind={TRANSPORT_CHIP[f.transport] || 'accent'}>{f.transport.toUpperCase()}</StatusChip>
            <div style={{ textAlign: 'right', width: 90 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)' }}>{f.msgs_24h.toLocaleString()}</div>
              <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)' }}>msgs / 24h</div>
            </div>
            <div style={{ textAlign: 'right', width: 70 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: f.error_rate_pct > 1 ? 'var(--app-warning)' : 'var(--app-text)' }}>{f.error_rate_pct}%</div>
              <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)' }}>errors</div>
            </div>
            <StatusChip kind={sevChip(f.status)}>{f.status.toUpperCase()}</StatusChip>
          </div>
        ))}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Platform Throughput — 24h" sub="API gateway · MFT gateway · data diode · syslog collectors">
          <TrendChart data={data.hourly} x="hour" height={240}
            series={[
              { key: 'api_msgs', name: 'API msgs/h', color: C.blue, area: true },
              { key: 'diode_events', name: 'Diode events/h', color: C.amber },
              { key: 'syslog_eps', name: 'Syslog EPS', color: C.violet },
              { key: 'mft_files', name: 'MFT files/h', color: C.green },
            ]}
            rightAxisKeys={['mft_files']} />
        </Panel>

        <Panel title="Master Data — Golden Records" sub="Single identifier convention across all systems">
          <DataTable
            columns={[
              { key: 'entity', label: 'Entity' },
              { key: 'records', label: 'Records', align: 'right', render: (v) => v.toLocaleString() },
              { key: 'match_rate_pct', label: 'Match', align: 'right', render: (v) => <b style={{ color: v > 98 ? 'var(--app-success)' : 'var(--app-warning)' }}>{v}%</b> },
              { key: 'duplicates', label: 'Dupes', align: 'right' },
            ]}
            rows={data.masterData} />
          <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 10, lineHeight: 1.5 }}>
            Single immutable Cadet ID issued by IAM at enrolment; propagated by joiner-mover-leaver
            provisioning to SIS, LMS, HPO, WMS and physical access (flow 3).
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
        <Panel title="Interface Control Documents" sub="ICD governance — finalized during detailed design">
          <DataTable
            columns={[
              { key: 'icd_id', label: 'ICD' },
              { key: 'interface', label: 'Interface' },
              { key: 'version', label: 'Ver', align: 'right' },
              { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={data.icds} />
        </Panel>

        <Panel title="Resilience & Continuity" sub="Async replication → DR ≥ 50 km · backup → Core42 sovereign cloud via FedNet (flow 8)">
          <DataTable
            columns={[
              { key: 'metric', label: 'Control' },
              { key: 'value', label: 'Current', align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{v}</b> },
              { key: 'target', label: 'Target', align: 'right' },
              { key: 'status', label: '', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={data.dr} />
        </Panel>
      </div>

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.subtitle} source={detail?.source} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
