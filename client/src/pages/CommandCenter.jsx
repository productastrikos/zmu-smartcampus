import React, { useState, useMemo } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoPeople, IcoTarget, IcoBolt, IcoAlert, IcoLink, IcoDollar, IcoAttendance, IcoCpu } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo } from '../components/ui';
import { TrendChart, Bars, C, ZONE_COLORS } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';
import CampusSnapshot from '../components/CampusSnapshot';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';

const STATUS_DOT = { healthy: 'var(--app-success)', warning: 'var(--app-warning)', critical: 'var(--app-danger)' };

// yyyy-mm → the following yyyy-mm, for building forecast month labels
function nextMonth(m) {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm, 1); // mm is already "next" since Date months are 0-based
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CommandCenter({ titleKey }) {
  const { data, error } = useApi('/overview');
  const { data: iot } = useApi('/iot/sensors');
  const { data: merit } = useApi('/ext/merit?college=ALL');
  const { data: enterprise } = useApi('/enterprise');
  const { data: campus } = useApi('/campus');
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const chip = (s) => (ar ? t(`status.${s}`) : s.toUpperCase());
  const [detail, setDetail] = useState(null);

  const forecast = useMemo(() => {
    const cf = enterprise?.cashflow;
    if (!cf || !cf.length) return [];
    const last3 = cf.slice(-3);
    const avgOut = last3.reduce((s, c) => s + c.outflow_maed, 0) / last3.length;
    const historical = cf.slice(-6).map((c) => ({ month: c.month.slice(2), actual: c.outflow_maed }));
    if (historical.length) historical[historical.length - 1].forecast = historical[historical.length - 1].actual;
    let cur = cf[cf.length - 1].month;
    const points = [];
    for (let i = 0; i < 3; i++) { cur = nextMonth(cur); points.push({ month: cur.slice(2), forecast: Math.round(avgOut * 10) / 10 }); }
    return [...historical, ...points];
  }, [enterprise]);

  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text={t('cc.loading')} />;
  const k = data.kpis;
  const dev = iot?.kpis; // device-health rollup from the IoT inventory
  const criticalDevices = (iot?.sensors || []).filter((s) => s.status !== 'online').slice(0, 6);
  const topRankers = (merit?.table || []).slice(0, 6);

  return (
    <>
      <PageHeader
        title={t(titleKey || 'cc.title')}
        subtitle={t('cc.subtitle')}
        right={<StatusChip kind="info">{k.systemsOnline}/{k.systemsTotal} {t('cc.systemsOnline')}</StatusChip>}
      />

      <KPIGrid>
        <KPICard label={t('cc.kpi.cadets')} value={fmt.int(k.cadetsEnrolled)} icon={<IcoPeople />} rag="normal"
          subValues={[{ label: t('exec.sub.attendance'), value: `${k.attendanceAvg}%` }, { label: t('cc.sub.companies'), value: '4' }]}
          onClick={() => setDetail({
            title: 'Cadets Enrolled', subtitle: `${k.cadetsEnrolled} officer cadets across four companies`, source: 'SIS · Single Cadet ID',
            stats: [
              { label: 'Attendance', value: `${k.attendanceAvg}%`, sub: 'facial-recognition T&A', tone: 'up' },
              { label: 'Composite', value: `${k.compositeReadiness}`, sub: '/ 100 avg' },
              { label: 'Companies', value: 'Falcon · Oryx · Saqr · Ghaf' },
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
        <KPICard label={t('cc.kpi.composite')} value={k.compositeReadiness} unit="/ 100" icon={<IcoTarget />} rag="normal" trend={1.8}
          subValues={[{ label: t('cc.sub.wearable'), value: k.wearableReadiness }, { label: t('exec.sub.source'), value: 'SIS + HPO' }]}
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
        <KPICard label={t('cc.kpi.occupancy')} value={`${k.occupancyNow}%`} icon={<IcoPeople />} rag="normal"
          subValues={[{ label: t('exec.sub.source'), value: 'IoT + Access Control' }]}
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
        <KPICard label={t('cc.kpi.energy')} value={fmt.int(k.energyTodayKwh)} unit="kWh" icon={<IcoBolt />} trend={k.energyDeltaPct}
          rag={k.energyDeltaPct > 8 ? 'warning' : 'normal'}
          subValues={[{ label: t('cc.sub.vsPrev'), value: `${k.energyDeltaPct > 0 ? '+' : ''}${k.energyDeltaPct}%` }]}
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
        <KPICard label={t('cc.kpi.alerts')} value={k.criticalAlerts} icon={<IcoAlert />} rag={k.criticalAlerts > 0 ? 'critical' : 'normal'}
          subValues={[{ label: t('cc.sub.openTotal'), value: k.openAlerts }]}
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
        <KPICard label={t('cc.kpi.integration')} value={`${k.integrationHealth}%`} icon={<IcoLink />} rag={k.integrationHealth < 100 ? 'warning' : 'normal'}
          subValues={[{ label: t('cc.sub.budgetUsed'), value: `${k.budgetUtilization}%` }]}
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

        {/* Executive-lens additions — attendance, energy consumption, budget, device health */}
        <KPICard label={t('exec.kpi.attendance')} value={`${k.attendanceAvg}%`} icon={<IcoAttendance />}
          rag={k.attendanceAvg < 88 ? 'warning' : 'normal'}
          subValues={[{ label: t('exec.sub.source'), value: ar ? 'التعرّف على الوجه' : 'Facial recognition' }]}
          onClick={() => setDetail({
            title: t('exec.kpi.attendance'), subtitle: `${k.attendanceAvg}% ${ar ? 'متوسط الدفعة' : 'cohort average'}`, source: 'SIS · Facial-recognition T&A',
            content: <Bars data={data.readinessBySquadron} x="squadron" height={220}
              series={[{ key: 'academic', name: ar ? 'أكاديمي' : 'Academic', color: C.blue }]} hideLegend />,
          })} />

        <KPICard label={t('exec.kpi.budget')} value={`${k.budgetUtilization}%`} icon={<IcoDollar />}
          rag={k.budgetUtilization > 55 ? 'warning' : 'normal'}
          subValues={[{ label: t('exec.sub.midYearPlan'), value: '50%' }]}
          onClick={() => setDetail({
            title: t('exec.kpi.budget'), subtitle: `${k.budgetUtilization}% ${ar ? 'مُستخدم مقابل خطة ٥٠٪ لمنتصف العام' : 'utilized vs 50% mid-year plan'}`, source: 'ERP — Muwazana / Finance',
            stats: [
              { label: ar ? 'المُستخدم' : 'Utilized', value: `${k.budgetUtilization}%`, tone: k.budgetUtilization > 55 ? 'down' : 'up' },
              { label: ar ? 'خطة منتصف العام' : 'Mid-year plan', value: '50%' },
            ],
          })} />

        <KPICard label={t('exec.kpi.deviceHealth')} value={dev ? `${dev.avgHealth}%` : '—'} icon={<IcoCpu />}
          rag={dev && dev.avgHealth < 85 ? 'warning' : 'normal'}
          subValues={[{ label: t('exec.sub.devicesOnline'), value: dev ? `${dev.online}/${dev.total}` : '—' }]}
          onClick={() => dev && setDetail({
            title: t('exec.kpi.deviceHealth'), subtitle: `${dev.avgHealth}% ${ar ? 'متوسط صحة الأجهزة عبر ' : 'average across '}${dev.total} ${ar ? 'جهازًا' : 'devices'}`, source: 'IoT Device Inventory',
            stats: [
              { label: ar ? 'الصحة' : 'Avg health', value: `${dev.avgHealth}%`, tone: dev.avgHealth < 85 ? 'warn' : 'up' },
              { label: t('status.online'), value: `${dev.online}/${dev.total}` },
              { label: ar ? 'أعطال' : 'Faults', value: dev.faults, tone: 'down' },
            ],
          })} />
      </KPIGrid>

      {/* Executive-lens row — the live campus digital-twin snapshot (heatmap,
          moving personnel, patrol) + top rankers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 14, marginBottom: 14, alignItems: 'stretch' }}>
        <Panel title={t('exec.panel.twin')} sub={t('exec.panel.twinSub')}>
          <CampusSnapshot height={248} />
        </Panel>
        <Panel title={t('exec.panel.topRankers')} sub={t('exec.panel.topRankersSub')}>
          <DataTable maxHeight={248}
            columns={[
              { key: 'rank', label: '#', render: (v) => <b style={{ color: '#3b7de8' }}>{v}</b> },
              { key: 'name', label: t('exec.col.cadet') },
              { key: 'company', label: t('exec.col.company') },
              { key: 'composite', label: t('exec.col.composite'), align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{v}</b> },
            ]}
            rows={topRankers} />
        </Panel>
      </div>

      {/* Budget & spending POV — cost-center burn plus a forward projection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title={t('exec.panel.budgetByCostCenter')} sub={t('exec.panel.budgetByCostCenterSub')}>
          {enterprise ? (
            <Bars data={enterprise.budget} x="cost_center" layout="vertical" height={240}
              series={[
                { key: 'budget_maed', name: ar ? 'الميزانية' : 'Budget', color: C.slate },
                { key: 'actual_maed', name: ar ? 'الفعلي' : 'Actual', color: C.blue },
              ]} />
          ) : <Loading />}
        </Panel>
        <Panel title={t('exec.panel.budgetForecast')} sub={t('exec.panel.budgetForecastSub')}>
          {forecast.length ? (
            <TrendChart data={forecast} x="month" height={240}
              series={[
                { key: 'actual', name: t('exec.actual'), color: C.blue, area: true },
                { key: 'forecast', name: t('exec.forecast'), color: C.amber, dash: true },
              ]} />
          ) : <Loading />}
        </Panel>
      </div>

      {/* Device health + building energy POV */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 14, marginBottom: 14 }}>
        <Panel title={t('exec.panel.criticalDevices')} sub={t('exec.panel.criticalDevicesSub')}
          right={<StatusChip kind={criticalDevices.length ? 'danger' : 'success'}>{criticalDevices.length}</StatusChip>}>
          <DataTable maxHeight={240}
            columns={[
              { key: 'name', label: t('exec.col.device') },
              { key: 'building', label: t('exec.col.building') },
              { key: 'health_pct', label: t('exec.col.health'), align: 'right', render: (v) => <b style={{ color: v < 40 ? 'var(--app-danger)' : 'var(--app-warning)' }}>{v}%</b> },
              { key: 'status', label: t('exec.col.status'), render: (v) => <StatusChip kind={sevChip(v)}>{chip(v)}</StatusChip> },
            ]}
            rows={criticalDevices} />
        </Panel>
        <Panel title={t('exec.panel.energyByZone')} sub={t('exec.panel.energyByZoneSub')}>
          {campus ? (
            <TrendChart data={campus.energyByZone} x="hour" height={240} type="area" stacked
              series={campus.zoneKeys.map((z, i) => ({ key: z, name: z, color: ZONE_COLORS[i % ZONE_COLORS.length] }))} />
          ) : <Loading />}
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title={t('cc.panel.occEnergy')} sub={t('cc.panel.occEnergySub')}>
          <TrendChart data={data.occupancyEnergy} x="hour" height={240}
            series={[
              { key: 'occupancy', name: ar ? 'الإشغال ٪' : 'Occupancy %', color: C.blue, area: true },
              { key: 'kwh', name: ar ? 'الطاقة ك.و.س' : 'Energy kWh', color: C.amber },
            ]}
            rightAxisKeys={['kwh']} />
        </Panel>

        <Panel title={t('cc.panel.company')} sub={t('cc.panel.companySub')}>
          <Bars data={data.readinessBySquadron} x="squadron" height={240}
            series={[
              { key: 'composite', name: ar ? 'المركّبة' : 'Composite', color: C.blue },
              { key: 'fitness', name: ar ? 'اللياقة' : 'Fitness', color: C.violet },
            ]} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 14 }}>
        {data.domainStatus.map((d) => (
          <Link key={d.key} to={d.link} style={{ textDecoration: 'none' }}>
            <Panel style={{ height: '100%', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: STATUS_DOT[d.status] || 'var(--app-success)', display: 'inline-block' }} />
                <StatusChip kind={sevChip(d.status)}>{chip(d.status)}</StatusChip>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)' }}>{d.name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#3b7de8', marginTop: 6 }}>{d.metric}</div>
              <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 2 }}>{d.sub}</div>
            </Panel>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 14 }}>
        <Panel title={t('cc.panel.agentic')} sub={t('cc.panel.agenticSub')}>
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

        <Panel title={t('cc.panel.latestAlerts')} sub={t('cc.panel.latestAlertsSub')}>
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
