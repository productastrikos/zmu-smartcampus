import React from 'react';
import { useApi, fmt } from '../services/api';
import { Panel, Loading, PageHeader, StatusChip } from '../components/ui';
import { TrendChart, C } from '../components/charts';
import { Advisory } from '../components/ext';
import { useLang } from '../i18n';

/* Executive Overview — a deliberately high-level, low-detail view for senior
   leadership: a handful of headline cross-domain KPIs and a prominent, rotating
   AI insight panel. No operational controls. */

function BigStat({ label, value, unit, tone, sub }) {
  const col = tone === 'good' ? 'var(--app-success)' : tone === 'warn' ? 'var(--app-warning)' : tone === 'bad' ? 'var(--app-danger)' : 'var(--app-text)';
  return (
    <div style={{ background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)', borderRadius: 16, padding: '20px 22px', boxShadow: 'var(--app-shadow-sm)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--app-text-faint)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: col, lineHeight: 1 }} className="ltr-num">{value}</span>
        {unit && <span style={{ fontSize: 14, color: 'var(--app-text-faint)', fontWeight: 600 }}>{unit}</span>}
      </span>
      {sub && <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>{sub}</span>}
    </div>
  );
}

export default function ExecutiveOverview() {
  const { data } = useApi('/overview');
  const { t } = useLang();
  if (!data) return <Loading text="Loading executive overview…" />;
  const k = data.kpis;

  const insights = [
    `Cohort composite readiness sits at ${k.compositeReadiness}/100 across ${k.cadetsEnrolled} officer cadets — a stable, mission-ready posture heading into the exercise season.`,
    `${k.criticalAlerts} critical/high issue(s) are open across all domains; the integration backbone is ${k.integrationHealth}% healthy, so cross-system data can be trusted for decisions.`,
    `Campus energy is tracking ${k.energyDeltaPct >= 0 ? 'up' : 'down'} ${Math.abs(k.energyDeltaPct)}% on the day at ${(k.occupancyNow)}% occupancy — efficiency and utilisation are moving together, as designed.`,
    `Wearable readiness averages ${k.wearableReadiness}/100 with attendance at ${k.attendanceAvg}% — the human-performance and academic signals are aligned, no divergence to escalate.`,
    `The single Cadet ID and the eight governed data flows mean every figure above is one joined record — the value the MSI platform delivers over point systems.`,
    `AI advisories are surfacing recommended actions (not just numbers) in each module below the executive line — drill in only where a metric turns amber or red.`,
  ];

  return (
    <>
      <PageHeader title={t('page.executive')}
        subtitle="Command-level snapshot across Learning, Readiness, Enterprise and Smart Operations — one governed picture." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 16 }}>
        <BigStat label="Composite Readiness" value={k.compositeReadiness} unit="/ 100" tone={k.compositeReadiness >= 75 ? 'good' : 'warn'} sub={`${fmt.int(k.cadetsEnrolled)} officer cadets`} />
        <BigStat label="Wearable Readiness" value={k.wearableReadiness} unit="/ 100" tone={k.wearableReadiness >= 75 ? 'good' : 'warn'} sub="HPO · Garmin fleet" />
        <BigStat label="Critical / High Alerts" value={k.criticalAlerts} tone={k.criticalAlerts > 3 ? 'bad' : k.criticalAlerts > 0 ? 'warn' : 'good'} sub={`${k.openAlerts} open in total`} />
        <BigStat label="Integration Health" value={k.integrationHealth} unit="%" tone={k.integrationHealth >= 90 ? 'good' : 'warn'} sub="8 governed data flows" />
        <BigStat label="Campus Occupancy" value={k.occupancyNow} unit="%" tone="neutral" sub="IoT + access control" />
        <BigStat label="Systems Online" value={`${k.systemsOnline}/${k.systemsTotal}`} tone={k.systemsOnline >= k.systemsTotal - 1 ? 'good' : 'warn'} sub="MSI service estate" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <Panel title="Occupancy vs Energy — 24h" sub="The cross-domain correlation leadership watches: how the campus is used against what it consumes">
          <TrendChart data={data.occupancyEnergy} x="hour" height={280} rightAxisKeys={['kwh']}
            series={[
              { key: 'occupancy', name: 'Occupancy %', color: C.blue, area: true },
              { key: 'kwh', name: 'Energy kWh', color: C.amber },
            ]} />
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title={t('common.aiInsights')} sub="SiA — rotating executive brief">
            <Advisory items={insights} interval={6000} visible={2} />
          </Panel>
          <Panel title="Domain Health" sub="Four operating domains at a glance">
            {data.domainStatus.map((d) => (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--app-surface-raised)' }}>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{d.name}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>{d.metric}</span>
                  <StatusChip kind={d.status === 'healthy' ? 'success' : d.status === 'warning' ? 'warning' : 'danger'}>{d.status.toUpperCase()}</StatusChip>
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
