import React, { useMemo, useState } from 'react';
import { useApi } from '../services/api';
import KPICard, { IcoGrad, IcoTarget, IcoTrendUp, IcoHeart, IcoAttendance, IcoActivity } from '../components/KPICard';
import { Panel, StatusChip, Loading, PageHeader, KPIGrid } from '../components/ui';
import { TrendChart, C } from '../components/charts';

/* Cadet Journey — unified longitudinal timeline on the single immutable
   Cadet ID (REQ-EAD-082). Fuses the Academic data lake (SIS/LMS grades,
   course completions) with the Military Readiness lake (HPO wearables,
   field assessments) into one chronological record. */

const CAT_STYLE = {
  academic:  { color: '#3b7de8', label: 'Academic · SIS/LMS' },
  military:  { color: '#22c55e', label: 'Military Training' },
  readiness: { color: '#f59e0b', label: 'Readiness · HPO' },
  admin:     { color: '#8ca0b6', label: 'Registry' },
};

function Timeline({ events }) {
  return (
    <div className="cj-timeline">
      {events.map((e, i) => {
        const cs = CAT_STYLE[e.category] || CAT_STYLE.admin;
        return (
          <div key={i} className="cj-item">
            <span className="cj-dot" style={{ background: cs.color }} />
            <div className="cj-date">
              {new Date(e.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              <span style={{ color: cs.color, marginLeft: 8 }}>{cs.label}</span>
            </div>
            <div className="cj-title">{e.title}</div>
            <div className="cj-detail">{e.detail}</div>
            {e.result && <span className="cj-result">{e.result}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function CadetJourney() {
  const { data: list } = useApi('/cadet-journey');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const cadetId = selected || list?.cadets?.[0]?.cadet_id || null;
  const { data } = useApi(cadetId ? `/cadet-journey/${cadetId}` : '/cadet-journey');

  const events = useMemo(() => {
    if (!data?.timeline) return [];
    return filter === 'all' ? data.timeline : data.timeline.filter((e) => e.category === filter);
  }, [data, filter]);

  if (!list || !data?.cadet) return <Loading text="Loading cadet journey…" />;
  const c = data.cadet;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Cadet Journey"
        subtitle="Unified longitudinal record on the single immutable Cadet ID (REQ-EAD-082) · Academic (SIS/LMS) + Military Readiness (HPO) data fusion"
        right={
          <select
            value={cadetId}
            onChange={(e) => setSelected(e.target.value)}
            style={{
              background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit', maxWidth: 320,
            }}>
            {list.cadets.map((cd) => (
              <option key={cd.cadet_id} value={cd.cadet_id}>
                #{cd.order_of_merit} · {cd.cadet_id} — {cd.name} ({cd.squadron}, Yr {cd.year})
              </option>
            ))}
          </select>
        }
      />

      {/* Current status summary */}
      <KPIGrid>
        <KPICard label="Academic Year" value={`Year ${k.year}`} icon={<IcoGrad />} subValues={[{ label: 'Programme', value: c.program.split(' ').slice(0, 2).join(' ') }, { label: 'Partner', value: c.partner }]} />
        <KPICard label="Composite Score" value={k.composite} unit="/ 100" icon={<IcoTarget />} rag={k.composite < 66 ? 'critical' : k.composite < 74 ? 'warning' : 'normal'} subValues={[{ label: 'Order of Merit', value: `#${k.orderOfMerit}` }]} />
        <KPICard label="GPA (SIS)" value={k.gpa} unit="/ 4.0" icon={<IcoTrendUp />} subValues={[{ label: 'Attendance', value: `${k.attendance}%` }]} />
        <KPICard label="Fitness Tier" value={c.fitness_tier} icon={<IcoHeart />} subValues={[{ label: 'Fitness score', value: `${c.fitness_score}/100` }, { label: 'Conduct', value: `${c.conduct_score}/100` }]} />
        <KPICard label="Readiness Today" value={k.readinessToday ?? '—'} unit="/ 100" icon={<IcoActivity />}
          rag={k.acwr > 1.4 ? 'critical' : 'normal'}
          subValues={[{ label: 'ACWR', value: k.acwr ?? '—' }, { label: 'Device', value: c.garmin_device }]} />
        <KPICard label="Risk Level" value={c.risk_level.toUpperCase()} icon={<IcoAttendance />}
          rag={c.risk_level === 'high' ? 'critical' : c.risk_level === 'medium' ? 'warning' : 'normal'}
          subValues={[{ label: 'Squadron', value: `${c.squadron} Sqn` }, { label: 'Cadet ID', value: c.cadet_id }]} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        {/* Timeline */}
        <Panel
          title={`Journey Timeline — ${c.name}`}
          sub="Milestones aggregated across SIS, LMS, Military Training Wing and HPO on the single cadet ID"
          right={
            <div className="app-timeframe-control">
              {[['all', 'All'], ['academic', 'Academic'], ['military', 'Military'], ['readiness', 'Readiness']].map(([key, label]) => (
                <button key={key} className={`app-timeframe-btn${filter === key ? ' is-active' : ''}`} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
          }>
          <div style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 6 }}>
            <Timeline events={events} />
          </div>
        </Panel>

        {/* Right column — live readiness context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Wearable Readiness — 14 Days" sub={`Garmin ${c.garmin_device} · Health API → HPO middleware (flow 4)`}>
            <TrendChart data={data.wearables} x="date" height={180}
              series={[
                { key: 'readiness', name: 'Readiness', color: C.blue, area: true },
                { key: 'sleep', name: 'Sleep h', color: C.violet },
              ]} rightAxisKeys={['sleep']} />
          </Panel>
          <Panel title="Training Load & Injury Risk" sub="Acute:chronic workload ratio — 1.4 threshold per HPO policy">
            <TrendChart data={data.wearables} x="date" height={160}
              series={[
                { key: 'acwr', name: 'ACWR', color: k.acwr > 1.4 ? C.red : C.green },
              ]} yDomain={[0, 2]} />
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Status:{' '}
                <StatusChip kind={k.acwr > 1.4 ? 'danger' : 'success'}>
                  {k.acwr > 1.4 ? 'HIGH INJURY RISK' : 'WITHIN LIMITS'}
                </StatusChip>
              </span>
              <span>Latest ACWR <b style={{ color: 'var(--app-text)' }}>{k.acwr ?? '—'}</b></span>
            </div>
          </Panel>
          <Panel title="Data Lineage" sub="Governed exchange backbone">
            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', lineHeight: 1.8 }}>
              {[
                ['SIS / LMS', 'Grades, course completions — flow 1', '#3b7de8'],
                ['Military Training Wing', 'Field assessments, qualifications', '#22c55e'],
                ['HPO / Garmin', 'Wearable readiness, ACWR — flow 4', '#f59e0b'],
                ['Registry', 'Immutable Cadet ID master record', '#8ca0b6'],
              ].map(([src, desc, color]) => (
                <div key={src} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: color, flexShrink: 0, position: 'relative', top: -1 }} />
                  <span><b style={{ color: 'var(--app-text)' }}>{src}</b> — {desc}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
