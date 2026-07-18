import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import { Panel, Loading, PageHeader, StatusChip, sevChip } from '../components/ui';
import { TrendChart, Bars, C } from '../components/charts';
import { Advisory } from '../components/ext';
import KPICard, { IcoTarget, IcoHeart, IcoAlert, IcoCheck, IcoPeople, IcoActivity } from '../components/KPICard';
import KPIDetailPanel from '../components/KPIDetailPanel';
import { useLang } from '../i18n';

/* Executive Overview — a deliberately high-level, low-detail view for senior
   leadership: plain-language headline KPIs (each with a one-click, one-line
   definition), a couple of easy-to-read comparison charts, and a rotating
   AI insight panel. No operational or technical detail. */

export default function ExecutiveOverview() {
  const { data } = useApi('/overview');
  const { data: readiness } = useApi('/readiness');
  const { t } = useLang();
  const [detail, setDetail] = useState(null);
  if (!data || !readiness) return <Loading text="Loading executive overview…" />;
  const k = data.kpis;

  const insights = [
    `Cohort composite readiness sits at ${k.compositeReadiness}/100 across ${k.cadetsEnrolled} officer cadets — a stable, mission-ready posture heading into the exercise season.`,
    `${k.criticalAlerts} high-priority issue(s) are open; overall systems health is ${k.integrationHealth}%, so the figures on this page can be trusted for decisions.`,
    `Campus energy use is tracking ${k.energyDeltaPct >= 0 ? 'up' : 'down'} ${Math.abs(k.energyDeltaPct)}% on the day at ${(k.occupancyNow)}% building occupancy — usage and efficiency are moving together, as designed.`,
    `Cadet wellbeing (wearables) averages ${k.wearableReadiness}/100 with attendance at ${k.attendanceAvg}% — performance and academic signals are aligned, nothing to escalate.`,
    `AI advisories surface recommended actions — not just numbers — behind every KPI on this page; drill in only where a metric turns amber or red.`,
  ];

  return (
    <>
      <PageHeader title={t('page.executive')}
        subtitle="A plain-language snapshot for senior leadership — click any KPI for a one-line explanation and the detail behind it." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        <KPICard label="Composite Readiness" value={k.compositeReadiness} unit="/ 100" icon={<IcoTarget />}
          rag={k.compositeReadiness >= 75 ? 'normal' : 'warning'}
          subValues={[{ label: 'Cadets', value: fmt.int(k.cadetsEnrolled) }]}
          onClick={() => setDetail({
            title: 'Composite Readiness',
            definition: 'One overall score for how ready the cadet body is, blending academics, fitness and conduct.',
            subtitle: `${k.compositeReadiness}/100 across ${fmt.int(k.cadetsEnrolled)} officer cadets`,
            stats: [
              { label: 'Score', value: `${k.compositeReadiness}`, sub: '/ 100', tone: 'up' },
              { label: 'Cadets', value: fmt.int(k.cadetsEnrolled) },
              { label: 'Attendance', value: `${k.attendanceAvg}%` },
            ],
            content: <Bars data={data.readinessBySquadron} x="squadron" height={220}
              series={[{ key: 'composite', name: 'Composite score', color: C.blue }]} hideLegend />,
          })} />

        <KPICard label="Cadet Wellbeing" value={k.wearableReadiness} unit="/ 100" icon={<IcoHeart />}
          rag={k.wearableReadiness >= 75 ? 'normal' : 'warning'}
          subValues={[{ label: 'Source', value: 'Fitness trackers' }]}
          onClick={() => setDetail({
            title: 'Cadet Wellbeing',
            definition: 'A daily wellbeing score from cadets’ fitness trackers — sleep, recovery and heart health.',
            subtitle: `${k.wearableReadiness}/100 average today`,
            stats: [
              { label: 'Today', value: `${k.wearableReadiness}`, sub: '/ 100' },
              { label: 'Composite', value: `${k.compositeReadiness}`, sub: '/ 100' },
            ],
            content: <TrendChart data={readiness.trend} x="date" height={220}
              series={[{ key: 'readiness', name: 'Wellbeing score', color: C.teal, area: true }]} />,
          })} />

        <KPICard label="Open Issues" value={k.criticalAlerts} icon={<IcoAlert />}
          rag={k.criticalAlerts > 3 ? 'critical' : k.criticalAlerts > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'Total open', value: k.openAlerts }]}
          onClick={() => setDetail({
            title: 'Open Issues',
            definition: 'The number of high-priority issues currently open across the campus that need leadership attention.',
            subtitle: `${k.criticalAlerts} high-priority of ${k.openAlerts} open in total`,
            stats: [
              { label: 'High priority', value: k.criticalAlerts, tone: 'down' },
              { label: 'Open total', value: k.openAlerts },
            ],
            content: (
              <div>
                {data.domainStatus.map((d) => (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--app-surface-raised)' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{d.name}</span>
                    <StatusChip kind={sevChip(d.status)}>{d.status.toUpperCase()}</StatusChip>
                  </div>
                ))}
              </div>
            ),
          })} />

        <KPICard label="Systems Health" value={k.integrationHealth} unit="%" icon={<IcoCheck />}
          rag={k.integrationHealth >= 90 ? 'normal' : 'warning'}
          subValues={[{ label: 'Systems', value: `${k.systemsOnline}/${k.systemsTotal}` }]}
          onClick={() => setDetail({
            title: 'Systems Health',
            definition: 'How well the university’s connected digital systems are running, as one overall percentage.',
            subtitle: `${k.integrationHealth}% of connected systems healthy`,
            stats: [
              { label: 'Health', value: `${k.integrationHealth}%`, tone: k.integrationHealth < 90 ? 'warn' : 'up' },
              { label: 'Online', value: `${k.systemsOnline}/${k.systemsTotal}` },
            ],
            content: (
              <div>
                {data.domainStatus.map((d) => (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--app-surface-raised)' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{d.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>{d.metric}</span>
                  </div>
                ))}
              </div>
            ),
          })} />

        <KPICard label="Campus Occupancy" value={k.occupancyNow} unit="%" icon={<IcoPeople />} rag="normal"
          subValues={[{ label: 'Energy today', value: `${fmt.k(k.energyTodayKwh)} kWh` }]}
          onClick={() => setDetail({
            title: 'Campus Occupancy',
            definition: 'Share of campus buildings currently in use, and how that compares with today’s energy use.',
            subtitle: `${k.occupancyNow}% of campus in use right now`,
            stats: [
              { label: 'Occupancy', value: `${k.occupancyNow}%` },
              { label: 'Energy today', value: fmt.k(k.energyTodayKwh), sub: 'kWh' },
            ],
            content: <TrendChart data={data.occupancyEnergy} x="hour" height={220} rightAxisKeys={['kwh']}
              series={[
                { key: 'occupancy', name: 'Building usage %', color: C.blue, area: true },
                { key: 'kwh', name: 'Energy used', color: C.amber },
              ]} />,
          })} />

        <KPICard label="Platform Availability" value={`${k.systemsOnline}/${k.systemsTotal}`} icon={<IcoActivity />}
          rag={k.systemsOnline >= k.systemsTotal - 1 ? 'normal' : 'warning'}
          subValues={[{ label: 'Attendance', value: `${k.attendanceAvg}%` }]}
          onClick={() => setDetail({
            title: 'Platform Availability',
            definition: 'How many of the university’s digital systems are online and available right now.',
            subtitle: `${k.systemsOnline} of ${k.systemsTotal} systems online`,
            stats: [
              { label: 'Online', value: `${k.systemsOnline}/${k.systemsTotal}`, tone: 'up' },
              { label: 'Attendance', value: `${k.attendanceAvg}%` },
            ],
            content: (
              <p style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6 }}>
                {k.systemsOnline} of {k.systemsTotal} platform systems are online and reporting normally.
                Average cadet attendance today is {k.attendanceAvg}%.
              </p>
            ),
          })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Building Usage vs Energy — 24h" sub="How campus usage compares with how much energy it takes to run">
            <TrendChart data={data.occupancyEnergy} x="hour" height={240} rightAxisKeys={['kwh']}
              series={[
                { key: 'occupancy', name: 'Building usage %', color: C.blue, area: true },
                { key: 'kwh', name: 'Energy used', color: C.amber },
              ]} />
          </Panel>
          <Panel title="Cadet Wellbeing Trend" sub="Daily wellbeing score across the cohort, most recent period">
            <TrendChart data={readiness.trend} x="date" height={220}
              series={[{ key: 'readiness', name: 'Wellbeing score', color: C.teal, area: true }]} />
          </Panel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title={t('common.aiInsights')} sub="SiA — rotating executive brief">
            <Advisory items={insights} interval={6000} visible={2} />
          </Panel>
          <Panel title="Programme Health" sub="Four areas leadership tracks, at a glance">
            {data.domainStatus.map((d) => (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--app-surface-raised)' }}>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{d.name}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>{d.metric}</span>
                  <StatusChip kind={sevChip(d.status)}>{d.status.toUpperCase()}</StatusChip>
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)}
        title={detail?.title} subtitle={detail?.subtitle} definition={detail?.definition} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
