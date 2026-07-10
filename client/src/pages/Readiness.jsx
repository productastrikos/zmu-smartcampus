import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../services/api';
import KPICard, { IcoTarget, IcoWatch, IcoMoon, IcoHeart, IcoAlert, IcoActivity } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable } from '../components/ui';
import { TrendChart, Bars, RadarPanel, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';

/** Human digital twin — per-cadet drill-down modal */
function CadetTwin({ id, onClose }) {
  const { data } = useApi(`/readiness/cadet/${id}`);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(0,0,0,0.55)' }} />
      <div className="animate-slide-up" style={{
        position: 'fixed', top: '6vh', left: '50%', transform: 'translateX(-50%)',
        width: 760, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', zIndex: 1000,
        background: 'var(--app-panel)', borderRadius: 16, border: '1px solid var(--app-surface-raised)',
        boxShadow: 'var(--app-shadow-lg)', padding: 20,
      }}>
        {!data ? <Loading text="Loading cadet digital twin…" /> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, #1e3a5f, #3b7de8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15,
                }}>{data.cadet.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text)' }}>{data.cadet.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>
                    {data.cadet.cadet_id} · {data.cadet.squadron} Sqn · Year {data.cadet.year} · {data.cadet.program}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 2 }}>
                    Longitudinal cadet profile (human digital twin) · Garmin {data.cadet.garmin_device} · synced {data.cadet.device_synced_hrs_ago}h ago
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { l: 'Composite', v: data.cadet.composite_score, c: '#3b7de8' },
                { l: 'Order of Merit', v: `#${data.cadet.order_of_merit}`, c: 'var(--app-text)' },
                { l: 'GPA', v: data.cadet.gpa, c: 'var(--app-text)' },
                { l: 'Fitness', v: data.cadet.fitness_score, c: 'var(--app-text)' },
                { l: 'Conduct', v: data.cadet.conduct_score, c: 'var(--app-text)' },
              ].map((x) => (
                <div key={x.l} style={{ background: 'var(--app-surface)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{x.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: x.c, marginTop: 2 }}>{x.v}</div>
                </div>
              ))}
            </div>

            <Panel title="Wearable Telemetry — 14 Days" sub="Garmin Health API → consent-governed middleware → HPO platform" style={{ marginBottom: 12 }}>
              <TrendChart data={data.series.map((s) => ({ ...s, date: s.date.slice(5) }))} x="date" height={200}
                series={[
                  { key: 'readiness_score', name: 'Readiness', color: C.blue, area: true },
                  { key: 'hrv_ms', name: 'HRV ms', color: C.violet },
                  { key: 'sleep_hours', name: 'Sleep h', color: C.cyan },
                ]}
                rightAxisKeys={['sleep_hours']} />
            </Panel>

            <Panel title="Training Load & Injury Risk" sub="Acute:chronic workload ratio — flag > 1.4">
              <TrendChart data={data.series.map((s) => ({ ...s, date: s.date.slice(5), threshold: 1.4 }))} x="date" height={170}
                series={[
                  { key: 'training_load', name: 'Load', color: C.amber, area: true },
                  { key: 'acwr', name: 'ACWR', color: C.red },
                  { key: 'threshold', name: 'Risk threshold', color: C.slate, dash: true },
                ]}
                rightAxisKeys={['acwr', 'threshold']} />
            </Panel>
          </>
        )}
      </div>
    </>
  );
}

export default function Readiness() {
  const { data, error } = useApi('/readiness');
  const [cadetId, setCadetId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // deep-link: /readiness?cadet=ZMU-2100 opens that cadet's human twin
  // (used by the Cadet Journey module — single Cadet ID interdependency)
  useEffect(() => {
    const c = searchParams.get('cadet');
    if (c) setCadetId(c);
  }, [searchParams]);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading readiness domain…" />;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Readiness & Performance"
        subtitle="Human Performance Optimization — Garmin Health API wearables · body composition · predictive early intervention (flow 4)"
        right={<StatusChip kind={k.deviceSyncRate > 90 ? 'success' : 'warning'}>{k.deviceSyncRate}% DEVICES SYNCED ≤ 12H</StatusChip>}
      />

      <KPIGrid>
        <KPICard label="Avg Readiness Score" value={k.avgReadiness} unit="/ 100" icon={<IcoTarget />} trend={1.2} rag="normal"
          subValues={[{ label: 'Body battery', value: k.avgBodyBattery }]}
          onClick={() => setDetail({
            title: 'Avg Readiness Score', subtitle: `${k.avgReadiness}/100 · body battery ${k.avgBodyBattery}`, source: 'Garmin Health API → HPO',
            stats: [
              { label: 'Readiness', value: `${k.avgReadiness}`, sub: '/ 100', tone: 'up' },
              { label: 'Body battery', value: k.avgBodyBattery },
              { label: 'Avg sleep', value: `${k.avgSleep}h`, tone: k.avgSleep < 6.5 ? 'warn' : 'up' },
            ],
            content: <TrendChart data={data.trend} x="date" height={220}
              series={[{ key: 'readiness', name: 'Readiness', color: C.blue, area: true }]} />,
          })} />
        <KPICard label="Garmin Sync Rate" value={`${k.deviceSyncRate}%`} icon={<IcoWatch />} rag={k.deviceSyncRate < 90 ? 'warning' : 'normal'}
          subValues={[{ label: 'Fleet', value: '300 devices' }]}
          onClick={() => setDetail({
            title: 'Garmin Sync Rate', subtitle: `${k.deviceSyncRate}% of the 300-device fleet synced within 12h`, source: 'Garmin Health API — Wearable Middleware',
            stats: [
              { label: 'Synced ≤ 12h', value: `${k.deviceSyncRate}%`, tone: k.deviceSyncRate < 90 ? 'warn' : 'up' },
              { label: 'Fleet', value: '300', sub: 'devices' },
              { label: 'Avg HRV', value: `${k.avgHrv}ms` },
            ],
            content: (
              <>
                <p style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                  Every cadet is issued a Garmin device (Fenix 8 Tactical, Instinct 3 Solar, Forerunner 965 or Epix Pro Gen 2).
                  Daily telemetry pulls via the Garmin Health API into a consent-governed middleware layer before reaching the HPO platform.
                </p>
                <DataTable maxHeight={260}
                  columns={[
                    { key: 'cadet_id', label: 'Cadet' },
                    { key: 'device', label: 'Garmin Device' },
                    { key: 'syncedHrs', label: 'Synced', render: (v) => v <= 12 ? <StatusChip kind="success">{v}H AGO</StatusChip> : <StatusChip kind="warning">{v}H AGO</StatusChip> },
                  ]}
                  rows={[...data.cadets].sort((a, b) => b.syncedHrs - a.syncedHrs).slice(0, 10)} />
              </>
            ),
          })} />
        <KPICard label="Avg Sleep" value={k.avgSleep} unit="hrs" icon={<IcoMoon />} rag={k.avgSleep < 6.5 ? 'warning' : 'normal'}
          subValues={[{ label: 'Target', value: '≥ 7.0 h' }]}
          onClick={() => setDetail({
            title: 'Avg Sleep', subtitle: `${k.avgSleep}h cohort average · target ≥ 7.0h`, source: 'Garmin Health API',
            content: <TrendChart data={data.trend} x="date" height={220}
              series={[{ key: 'sleep', name: 'Sleep h', color: C.cyan, area: true }]} />,
          })} />
        <KPICard label="Avg HRV" value={k.avgHrv} unit="ms" icon={<IcoHeart />} rag="normal"
          subValues={[{ label: 'Avg stress', value: k.avgStress }]}
          onClick={() => setDetail({
            title: 'Avg HRV', subtitle: `${k.avgHrv} ms cohort average · avg stress ${k.avgStress}`, source: 'Garmin Health API',
            content: <TrendChart data={data.trend} x="date" height={220}
              series={[{ key: 'hrv', name: 'HRV ms', color: C.violet, area: true }]} />,
          })} />
        <KPICard label="High Injury Risk" value={k.highInjuryRisk} unit="cadets" icon={<IcoAlert />} rag={k.highInjuryRisk > 8 ? 'critical' : 'warning'}
          subValues={[{ label: 'Rule', value: 'ACWR > 1.4' }]}
          onClick={() => setDetail({
            title: 'High Injury Risk', subtitle: `${k.highInjuryRisk} cadets with ACWR > 1.4 — early intervention rule`, source: 'HPO Predictive Analytics',
            stats: [
              { label: 'Flagged', value: k.highInjuryRisk, sub: 'ACWR > 1.4', tone: 'down' },
              { label: 'Avg readiness', value: k.avgReadiness },
              { label: 'Avg sleep', value: `${k.avgSleep}h` },
            ],
            content: (
              <DataTable maxHeight={280}
                columns={[
                  { key: 'name', label: 'Cadet' },
                  { key: 'squadron', label: 'Sqn' },
                  { key: 'acwr', label: 'ACWR', align: 'right', render: (v) => <b style={{ color: 'var(--app-danger)' }}>{v}</b> },
                  { key: 'readiness_score', label: 'Readiness', align: 'right' },
                ]}
                rows={data.highRisk}
                onRowClick={(r) => { setDetail(null); setCadetId(r.cadet_id); }} />
            ),
          })} />
        <KPICard label="Avg VO₂max" value={k.avgVo2} icon={<IcoActivity />} trend={0.6} rag="normal"
          onClick={() => setDetail({
            title: 'Avg VO₂max', subtitle: `${k.avgVo2} cohort average`, source: 'Garmin Health API',
            content: <Bars data={data.squadrons} x="squadron" height={220} hideLegend
              series={[{ key: 'readiness', name: 'Readiness (proxy)', color: C.green }]} />,
          })} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Cohort Readiness — 14 Days" sub="Daily aggregate from wearable middleware (consent-governed)">
          <TrendChart data={data.trend} x="date" height={240}
            series={[
              { key: 'readiness', name: 'Readiness', color: C.blue, area: true },
              { key: 'hrv', name: 'HRV ms', color: C.violet },
              { key: 'sleep', name: 'Sleep h', color: C.cyan },
            ]}
            rightAxisKeys={['sleep']} />
        </Panel>
        <Panel title="Five Readiness Domains" sub="HPO mandatory domains — cohort average">
          <RadarPanel data={data.radar} angleKey="domain" height={240}
            series={[{ key: 'score', name: 'Cohort', color: C.blue }]} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Squadron Comparison" sub="Instructor-tier dashboard view">
          <Bars data={data.squadrons} x="squadron" height={230}
            series={[
              { key: 'readiness', name: 'Readiness', color: C.blue },
              { key: 'hrv', name: 'HRV', color: C.violet },
            ]} />
        </Panel>
        <Panel title="Early Intervention Queue" sub={`${data.highRisk.length} cadets · ACWR > 1.4 before Exercise Desert Shield`}
          right={<StatusChip kind="danger">PRIORITY</StatusChip>}>
          <DataTable maxHeight={230}
            columns={[
              { key: 'cadet_id', label: 'Cadet ID' },
              { key: 'name', label: 'Name' },
              { key: 'squadron', label: 'Sqn' },
              { key: 'acwr', label: 'ACWR', align: 'right', render: (v) => <b style={{ color: 'var(--app-danger)' }}>{v}</b> },
              { key: 'sleep_hours', label: 'Sleep', align: 'right' },
              { key: 'readiness_score', label: 'Readiness', align: 'right' },
            ]}
            rows={data.highRisk}
            onRowClick={(r) => setCadetId(r.cadet_id)} />
        </Panel>
      </div>

      <Panel title="Cadet Performance Register" sub="Click a cadet to open the longitudinal human digital twin"
        right={
          <button className="app-timeframe-btn is-active" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'SHOW TOP 15' : `SHOW ALL ${data.cadets.length}`}
          </button>
        }>
        <DataTable maxHeight={showAll ? 480 : 'none'}
          columns={[
            { key: 'merit', label: 'Merit #', render: (v) => <b style={{ color: '#3b7de8' }}>{v}</b> },
            { key: 'cadet_id', label: 'Cadet ID' },
            { key: 'name', label: 'Name' },
            { key: 'squadron', label: 'Squadron' },
            { key: 'year', label: 'Yr' },
            { key: 'composite', label: 'Composite', align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{v}</b> },
            { key: 'readiness', label: 'Readiness', align: 'right' },
            { key: 'device', label: 'Garmin Device' },
            { key: 'syncedHrs', label: 'Synced', render: (v) => v <= 12 ? <StatusChip kind="success">{v}H AGO</StatusChip> : <StatusChip kind="warning">{v}H AGO</StatusChip> },
            { key: 'risk', label: 'Risk', render: (v) => <StatusChip kind={v === 'high' ? 'danger' : v === 'medium' ? 'warning' : 'success'}>{v.toUpperCase()}</StatusChip> },
          ]}
          rows={showAll ? data.cadets : data.cadets.slice(0, 15)}
          onRowClick={(r) => setCadetId(r.cadet_id)} />
      </Panel>

      {cadetId && <CadetTwin id={cadetId} onClose={() => { setCadetId(null); if (searchParams.get('cadet')) setSearchParams({}, { replace: true }); }} />}

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.subtitle} source={detail?.source} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
