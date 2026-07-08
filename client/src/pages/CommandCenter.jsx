import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoPeople, IcoTarget, IcoBolt, IcoAlert, IcoLink, IcoDollar } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo } from '../components/ui';
import { TrendChart, Bars, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';
import { Link } from 'react-router-dom';

const STATUS_DOT = { healthy: 'var(--app-success)', warning: 'var(--app-warning)', critical: 'var(--app-danger)' };

export default function CommandCenter() {
  const { data, error } = useApi('/overview');
  const [detail, setDetail] = useState(null);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading command center…" />;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Campus Command Center"
        subtitle="Unified operational picture across Learning, Readiness, Enterprise and Smart Operations — single cadet ID, governed exchange backbone"
        right={<StatusChip kind="info">{k.systemsOnline}/{k.systemsTotal} SYSTEMS ONLINE</StatusChip>}
      />

      <KPIGrid>
        <KPICard label="Cadets Enrolled" value={fmt.int(k.cadetsEnrolled)} icon={<IcoPeople />} rag="normal"
          subValues={[{ label: 'Attendance', value: `${k.attendanceAvg}%` }, { label: 'Named users', value: '2,380' }]}
          onClick={() => setDetail({
            title: 'Cadets Enrolled', subtitle: '300 named cadets · sized for 2,100 at full capacity', source: 'SIS · Single Cadet ID',
            stats: [
              { label: 'Attendance', value: `${k.attendanceAvg}%`, sub: 'facial-recognition T&A', tone: 'up' },
              { label: 'Composite', value: `${k.compositeReadiness}`, sub: '/ 100 avg' },
              { label: 'Named users', value: '2,380', sub: '2,100 cadets + 280 staff' },
            ],
            content: (
              <>
                <p style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                  Enrolment is keyed to the single immutable Cadet ID issued at onboarding by IAM and propagated
                  to LMS, HPO and physical access. Average attendance is {k.attendanceAvg}% via facial-recognition T&A.
                </p>
                <Bars data={data.readinessBySquadron} x="squadron" height={200}
                  series={[{ key: 'academic', name: 'Academic (scaled)', color: C.blue }]} hideLegend />
              </>
            ),
          })} />
        <KPICard label="Composite Readiness" value={k.compositeReadiness} unit="/ 100" icon={<IcoTarget />} rag="normal" trend={1.8}
          subValues={[{ label: 'Wearable readiness', value: k.wearableReadiness }, { label: 'Source', value: 'SIS + HPO' }]}
          onClick={() => setDetail({
            title: 'Composite Readiness', subtitle: 'Weighting: 40% GPA · 25% military · 25% fitness · 10% conduct', source: 'HPO + SIS',
            stats: [
              { label: 'Composite', value: `${k.compositeReadiness}`, sub: '/ 100', tone: 'up' },
              { label: 'Wearable', value: `${k.wearableReadiness}`, sub: 'Garmin-derived' },
              { label: 'Attendance', value: `${k.attendanceAvg}%` },
            ],
            content: (
              <>
                <Bars data={data.readinessBySquadron} x="squadron" height={220}
                  series={[
                    { key: 'composite', name: 'Composite', color: C.blue },
                    { key: 'fitness', name: 'Fitness', color: C.violet },
                    { key: 'academic', name: 'Academic', color: C.cyan },
                  ]} />
                <p style={{ fontSize: 11.5, color: 'var(--app-text-faint)', marginTop: 10 }}>
                  Wearable-derived readiness (Garmin Health API, daily) currently averages {k.wearableReadiness}/100 across the cohort.
                </p>
              </>
            ),
          })} />
        <KPICard label="Campus Occupancy" value={`${k.occupancyNow}%`} icon={<IcoPeople />} rag="normal"
          subValues={[{ label: 'Source', value: 'IoT + Access Control' }]}
          onClick={() => setDetail({
            title: 'Campus Occupancy', subtitle: 'Live IoT occupancy sensors across all 12 buildings', source: 'BMS / IoT · Data Diode (flow 5)',
            stats: [
              { label: 'Now', value: `${k.occupancyNow}%` },
              { label: 'Energy 24h', value: `${(k.energyTodayKwh / 1000).toFixed(1)}k`, sub: 'kWh' },
              { label: 'Systems', value: `${k.systemsOnline}/${k.systemsTotal}`, sub: 'online', tone: 'up' },
            ],
            content: <TrendChart data={data.occupancyEnergy} x="hour" height={220}
              series={[{ key: 'occupancy', name: 'Occupancy %', color: C.blue, area: true }]} />,
          })} />
        <KPICard label="Energy — 24h" value={fmt.int(k.energyTodayKwh)} unit="kWh" icon={<IcoBolt />} trend={k.energyDeltaPct}
          rag={k.energyDeltaPct > 8 ? 'warning' : 'normal'}
          subValues={[{ label: 'vs prev 24h', value: `${k.energyDeltaPct > 0 ? '+' : ''}${k.energyDeltaPct}%` }]}
          onClick={() => setDetail({
            title: 'Energy — 24h', subtitle: `${fmt.int(k.energyTodayKwh)} kWh · ${k.energyDeltaPct >= 0 ? '+' : ''}${k.energyDeltaPct}% vs prior 24h`, source: 'BMS Telemetry',
            stats: [
              { label: 'Total 24h', value: fmt.int(k.energyTodayKwh), sub: 'kWh' },
              { label: 'vs prev 24h', value: `${k.energyDeltaPct >= 0 ? '+' : ''}${k.energyDeltaPct}%`, tone: k.energyDeltaPct > 8 ? 'down' : 'up' },
              { label: 'Occupancy', value: `${k.occupancyNow}%`, sub: 'correlated' },
            ],
            content: <TrendChart data={data.occupancyEnergy} x="hour" height={220}
              series={[{ key: 'kwh', name: 'Energy kWh', color: C.amber, area: true }]} />,
          })} />
        <KPICard label="Critical / High Alerts" value={k.criticalAlerts} icon={<IcoAlert />} rag={k.criticalAlerts > 0 ? 'critical' : 'normal'}
          subValues={[{ label: 'Open total', value: k.openAlerts }]}
          onClick={() => setDetail({
            title: 'Critical / High Alerts', subtitle: `${k.criticalAlerts} of ${k.openAlerts} open alerts require attention`, source: 'Cross-Domain Correlation',
            stats: [
              { label: 'Critical / High', value: k.criticalAlerts, sub: 'need action', tone: 'down' },
              { label: 'Open total', value: k.openAlerts },
              { label: 'Integration', value: `${k.integrationHealth}%`, sub: 'flows healthy' },
            ],
            content: (
              <DataTable
                columns={[
                  { key: 'severity', label: 'Sev', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                  { key: 'domain', label: 'Domain' },
                  { key: 'title', label: 'Alert' },
                ]}
                rows={data.alerts.filter((a) => ['critical', 'high'].includes(a.severity))} />
            ),
          })} />
        <KPICard label="Integration Health" value={`${k.integrationHealth}%`} icon={<IcoLink />} rag={k.integrationHealth < 100 ? 'warning' : 'normal'}
          subValues={[{ label: 'Budget used', value: `${k.budgetUtilization}%` }]}
          onClick={() => setDetail({
            title: 'Integration Health', subtitle: `${k.integrationHealth}% of governed data flows healthy`, source: 'Integration & Data Platform',
            stats: [
              { label: 'Flows healthy', value: `${k.integrationHealth}%`, tone: k.integrationHealth < 100 ? 'warn' : 'up' },
              { label: 'Budget used', value: `${k.budgetUtilization}%` },
              { label: 'Systems', value: `${k.systemsOnline}/${k.systemsTotal}`, sub: 'online' },
            ],
            content: (
              <DataTable
                columns={[
                  { key: 'key', label: 'Domain' },
                  { key: 'name', label: 'Name' },
                  { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={data.domainStatus} />
            ),
          })} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Campus Occupancy vs Energy — 24h" sub="Cross-module correlation · IoT occupancy (flow 5) against BMS energy telemetry">
          <TrendChart data={data.occupancyEnergy} x="hour" height={240}
            series={[
              { key: 'occupancy', name: 'Occupancy %', color: C.blue, area: true },
              { key: 'kwh', name: 'Energy kWh', color: C.amber },
            ]}
            rightAxisKeys={['kwh']} />
        </Panel>

        <Panel title="Squadron Readiness" sub="Composite score (40% GPA · 25% military · 25% fitness · 10% conduct)">
          <Bars data={data.readinessBySquadron} x="squadron" height={240}
            series={[
              { key: 'composite', name: 'Composite', color: C.blue },
              { key: 'fitness', name: 'Fitness', color: C.violet },
            ]} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 14 }}>
        {data.domainStatus.map((d) => (
          <Link key={d.key} to={d.link} style={{ textDecoration: 'none' }}>
            <Panel style={{ height: '100%', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: STATUS_DOT[d.status] || 'var(--app-success)', display: 'inline-block' }} />
                <StatusChip kind={sevChip(d.status)}>{d.status.toUpperCase()}</StatusChip>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)' }}>{d.name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#3b7de8', marginTop: 6 }}>{d.metric}</div>
              <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 2 }}>{d.sub}</div>
            </Panel>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 14 }}>
        <Panel title="Agentic AI — Recommendations & Actions" sub="Autonomous correlation across OT, HPO, energy and security domains">
          {data.aiRecommendations.map((r) => (
            <div key={r.rec_id} style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 8,
              background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
                <StatusChip kind="violet">{r.rec_id}</StatusChip>
                <StatusChip kind="accent">{r.domain}</StatusChip>
                <StatusChip kind={sevChip(r.status)}>{r.status.toUpperCase()}</StatusChip>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--app-text-faint)' }}>confidence {r.confidence_pct}%</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--app-text)', lineHeight: 1.5 }}>{r.recommendation}</div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 4 }}>
                Trigger: {r.trigger} · <span style={{ color: 'var(--app-violet)' }}>{r.impact}</span>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Latest Cross-Domain Alerts" sub="Correlated feed — full list in the bell panel">
          {data.alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--app-surface-soft)', alignItems: 'flex-start' }}>
              <StatusChip kind={sevChip(a.severity)}>{a.severity.slice(0, 4).toUpperCase()}</StatusChip>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11.5, color: 'var(--app-text)', lineHeight: 1.4 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 2 }}>{a.domain} · {a.source} · {timeAgo(a.ts)}</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.subtitle} source={detail?.source} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
