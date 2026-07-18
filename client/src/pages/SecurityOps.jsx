import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoShield, IcoAlert, IcoLock, IcoActivity, IcoSignal, IcoClock } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo } from '../components/ui';
import { Bars, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';

const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#38bdf8', info: '#64748b' };
const NET_COLORS = { RED: '#ef4444', YELLOW: '#f59e0b', ORANGE: '#f97316', GREY: '#94a3b8' };

export default function SecurityOps() {
  const { data, error } = useApi('/security');
  const [detail, setDetail] = useState(null);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading security operations…" />;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Security Operations — Split-SIEM"
        subtitle="On-prem collection · sovereign-cloud analytics tier · every platform forwards syslog RFC 5424 / CEF (flow 7) · NDR + PAM"
        right={<StatusChip kind="success">aeCERT / NCSC REPORTING: {k.aecertReady.toUpperCase()}</StatusChip>}
      />

      <KPIGrid min={185}>
        <KPICard label="Events — 24h" value={fmt.int(k.events24h)} icon={<IcoActivity />} rag="normal"
          subValues={[{ label: 'Syslog EPS', value: fmt.int(k.syslogEps) }]}
          onClick={() => setDetail({
            title: 'Events — 24h', subtitle: `${fmt.int(k.events24h)} events · ${fmt.int(k.syslogEps)} syslog EPS`, source: 'Split-SIEM',
            content: <Bars data={data.timeline} x="hour" height={240} stacked
              series={['critical', 'high', 'medium', 'low', 'info'].map((s) => ({ key: s, name: s, color: SEV_COLORS[s] }))} />,
          })} />
        <KPICard label="Critical Open" value={k.criticalOpen} icon={<IcoAlert />} rag={k.criticalOpen > 0 ? 'critical' : 'normal'}
          subValues={[{ label: 'SOC MTTR', value: `${k.mttrMin} min` }]}
          onClick={() => setDetail({
            title: 'Critical Open', subtitle: `${k.criticalOpen} critical incidents open · MTTR ${k.mttrMin} min`, source: 'SOC Queue',
            content: (
              <DataTable maxHeight={280}
                columns={[
                  { key: 'ts', label: 'Time', render: (v) => timeAgo(v) },
                  { key: 'source', label: 'Source' },
                  { key: 'message', label: 'Event' },
                  { key: 'status', label: 'State', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={data.openIncidents} />
            ),
          })} />
        <KPICard label="Auth Failures — 24h" value={k.authFailures24h} icon={<IcoLock />} rag={k.authFailures24h > 120 ? 'warning' : 'normal'}
          subValues={[{ label: 'Adaptive MFA', value: 'enforced' }]}
          onClick={() => setDetail({
            title: 'Auth Failures — 24h', subtitle: `${k.authFailures24h} failed logins · adaptive MFA enforced`, source: 'IAM / IdP',
            content: (
              <p style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.7 }}>
                Adaptive, risk-based MFA is enforced on every access point. A burst of {k.authFailures24h} failed
                logins in the last 24h includes a suspected credential-stuffing cluster on IAM — see the live
                event feed below for the raw entries and auto-lockout actions.
              </p>
            ),
          })} />
        <KPICard label="PAM Sessions — 24h" value={k.pamSessions24h} icon={<IcoShield />} rag="normal"
          subValues={[{ label: 'Recording', value: '100%' }]}
          onClick={() => setDetail({
            title: 'PAM Sessions — 24h', subtitle: `${k.pamSessions24h} privileged sessions, 100% recorded`, source: 'PAM Vault',
            content: (
              <p style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.7 }}>
                Every privileged-access checkout (admin, DBA, network engineer) is brokered through the PAM vault
                and fully session-recorded, with the recording indexed against the identity and target asset.
              </p>
            ),
          })} />
        <KPICard label="OT Anomalies — 24h" value={k.otAnomalies24h} icon={<IcoSignal />} rag={k.otAnomalies24h > 10 ? 'warning' : 'normal'}
          subValues={[{ label: 'Source', value: 'Diode telemetry' }]}
          onClick={() => setDetail({
            title: 'OT Anomalies — 24h', subtitle: `${k.otAnomalies24h} anomalies flagged from OT telemetry`, source: 'BMS/IoT via Data Diode (flow 5)',
            content: (
              <DataTable maxHeight={260}
                columns={[
                  { key: 'ts', label: 'Time', render: (v) => timeAgo(v) },
                  { key: 'message', label: 'Event' },
                ]}
                rows={data.feed.filter((e) => e.category === 'ot_anomaly')} />
            ),
          })} />
        <KPICard label="NTP Discipline" value="Stratum-2" icon={<IcoClock />} rag="normal"
          subValues={[{ label: 'Drift', value: '< 2 ms' }]}
          onClick={() => setDetail({
            title: 'NTP Discipline', subtitle: 'Stratum-2 campus authoritative time, < 2ms drift', source: 'NTP — GNSS-disciplined',
            content: (
              <p style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.7 }}>
                The campus authoritative time service runs at minimum stratum-2, sourced from a stratum-1
                GPS/PTP-disciplined upstream, feeding every platform for consistent forensic timestamping
                across the split-SIEM.
              </p>
            ),
          })} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Event Volume by Severity — 24h" sub="Correlated across all forwarding platforms">
          <Bars data={data.timeline} x="hour" height={240} stacked
            series={['critical', 'high', 'medium', 'low', 'info'].map((s) => ({ key: s, name: s, color: SEV_COLORS[s] }))} />
        </Panel>

        <Panel title="Network Segmentation" sub="Four-network model — separate identity stores per classification">
          {data.networks.map((n) => (
            <div key={n.network} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              background: 'var(--app-surface-soft)', marginBottom: 8,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: NET_COLORS[n.network], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text)' }}>{n.network}</div>
                <div style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>{n.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)' }}>{n.events.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: n.high > 0 ? 'var(--app-danger)' : 'var(--app-text-faint)' }}>{n.high} high+</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', lineHeight: 1.5, marginTop: 4 }}>
            BLUE (MoD classified) is externally managed — interface points only, no telemetry ingested.
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Top Event Categories — 24h" sub="Use-case tuning input for SOC">
          <Bars data={data.categories} x="category" layout="vertical" height={250} hideLegend
            series={[{ key: 'count', name: 'Events', color: C.blue }]} />
        </Panel>

        <Panel title="Open High-Severity Incidents" sub="SOC queue — auto-enriched with asset & identity context">
          <DataTable maxHeight={250}
            columns={[
              { key: 'ts', label: 'Time', render: (v) => timeAgo(v) },
              { key: 'severity', label: 'Sev', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
              { key: 'source', label: 'Source' },
              { key: 'message', label: 'Event' },
              { key: 'status', label: 'State', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={data.openIncidents} />
        </Panel>
      </div>

      <Panel title="Live Event Feed" sub="Most recent 40 events · syslog RFC 5424 normalised"
        right={<StatusChip kind="info">STREAMING</StatusChip>}>
        <div className="log-feed" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {data.feed.map((e, i) => (
            <div key={i} className="log-line">
              <span style={{ color: 'var(--app-text-faint)', flexShrink: 0 }}>{e.ts.slice(5, 19).replace('T', ' ')}</span>
              <span style={{ color: SEV_COLORS[e.severity], fontWeight: 700, width: 62, flexShrink: 0 }}>{e.severity.toUpperCase()}</span>
              <span style={{ color: NET_COLORS[e.network], width: 58, flexShrink: 0 }}>{e.network}</span>
              <span style={{ color: 'var(--app-text-muted)', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.source}</span>
              <span style={{ color: 'var(--app-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.message}</span>
            </div>
          ))}
        </div>
      </Panel>

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.subtitle} source={detail?.source} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
