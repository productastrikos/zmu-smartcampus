import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../services/api';
import KPICard, { IcoGrad, IcoTarget, IcoTrendUp, IcoHeart, IcoAttendance, IcoActivity, IcoLock } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo } from '../components/ui';
import { TrendChart, RadarPanel, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';

/* Cadet Journey — unified longitudinal timeline on the single immutable
   Cadet ID (REQ-EAD-082). Fuses the Academic data lake (SIS/LMS grades,
   course completions) with the Military Readiness lake (HPO wearables,
   field assessments) and joins Domain-D armoury (WMS) on the same ID. */

const CAT_STYLE = {
  academic:  { color: '#3b7de8', label: 'Academic · SIS/LMS' },
  military:  { color: '#22c55e', label: 'Military Training' },
  readiness: { color: '#f59e0b', label: 'Readiness · HPO' },
  admin:     { color: '#8ca0b6', label: 'Registry' },
};

function Timeline({ events }) {
  if (!events.length) return <div style={{ padding: 20, color: 'var(--app-text-faint)', fontSize: 12 }}>No events in this category.</div>;
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
  const [detail, setDetail] = useState(null);

  const cadetId = selected || list?.cadets?.[0]?.cadet_id || null;
  const { data } = useApi(cadetId ? `/cadet-journey/${cadetId}` : '/cadet-journey');

  const events = useMemo(() => {
    if (!data?.timeline) return [];
    return filter === 'all' ? data.timeline : data.timeline.filter((e) => e.category === filter);
  }, [data, filter]);

  // Selector must stay mounted even while the per-cadet payload reloads,
  // otherwise changing the dropdown flashes the whole page to a spinner.
  const selector = list && (
    <select
      value={cadetId || ''}
      onChange={(e) => { setSelected(e.target.value); setFilter('all'); }}
      style={{
        background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)',
        borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit', maxWidth: 340,
      }}>
      {list.cadets.map((cd) => (
        <option key={cd.cadet_id} value={cd.cadet_id}>
          #{cd.order_of_merit} · {cd.cadet_id} — {cd.name} ({cd.squadron}, Yr {cd.year})
        </option>
      ))}
    </select>
  );

  const ready = data?.cadet && data.cadet.cadet_id === cadetId;

  return (
    <>
      <PageHeader
        title="Cadet Journey"
        subtitle="Unified longitudinal record on the single immutable Cadet ID (REQ-EAD-082) · Academic (SIS/LMS) + Military Readiness (HPO) + Armoury (WMS) fused on one ID"
        right={selector}
      />

      {!ready ? <Loading text="Loading cadet record…" /> : (() => {
        const c = data.cadet;
        const k = data.kpis;
        const radar = data.squadron.domains.map((d) => ({ domain: d.domain.split(' ')[0], score: d.score }));
        return (
          <>
            {/* Current status — clickable KPI cards */}
            <KPIGrid>
              <KPICard label="Academic Year" value={`Year ${k.year}`} icon={<IcoGrad />}
                subValues={[{ label: 'Programme', value: c.program.split(' ').slice(0, 2).join(' ') }, { label: 'Partner', value: c.partner }]}
                onClick={() => setDetail({
                  title: 'Academic Standing', subtitle: `${c.program} · ${c.partner}`, source: 'SIS · flow 1',
                  stats: [{ label: 'Year', value: k.year }, { label: 'GPA', value: c.gpa }, { label: 'Attendance', value: `${c.attendance}%` }],
                  content: <TrendChart data={data.wearables} x="date" height={180} series={[{ key: 'readiness', name: 'Readiness', color: C.blue, area: true }]} />,
                })} />
              <KPICard label="Composite Score" value={k.composite} unit="/ 100" icon={<IcoTarget />}
                rag={k.composite < 66 ? 'critical' : k.composite < 74 ? 'warning' : 'normal'}
                subValues={[{ label: 'Order of Merit', value: `#${k.orderOfMerit}` }, { label: 'Percentile', value: `${k.percentile}th` }]}
                onClick={() => setDetail({
                  title: 'Composite Readiness Score', subtitle: `Rank #${k.orderOfMerit} of ${list.cadets.length} · ${k.percentile}th percentile`, source: 'SIS + HPO',
                  stats: [{ label: 'Composite', value: k.composite, sub: '/ 100' }, { label: 'Squadron avg', value: k.squadronAvgComposite }, { label: 'Order of merit', value: `#${k.orderOfMerit}` }],
                })} />
              <KPICard label="GPA (SIS)" value={k.gpa} unit="/ 4.0" icon={<IcoTrendUp />}
                subValues={[{ label: 'Attendance', value: `${k.attendance}%` }]}
                onClick={() => setDetail({
                  title: 'Academic GPA', subtitle: 'SIS term roll-up', source: 'SIS / LMS',
                  stats: [{ label: 'GPA', value: k.gpa }, { label: 'Attendance', value: `${k.attendance}%` }, { label: 'At-risk', value: c.risk_level === 'high' ? 'Yes' : 'No', tone: c.risk_level === 'high' ? 'warn' : 'up' }],
                })} />
              <KPICard label="Fitness Tier" value={c.fitness_tier} icon={<IcoHeart />}
                subValues={[{ label: 'Fitness', value: `${c.fitness_score}/100` }, { label: 'Conduct', value: `${c.conduct_score}/100` }]}
                onClick={() => setDetail({
                  title: 'Physical Readiness', subtitle: `${c.fitness_tier} tier`, source: 'HPO fitness assessment',
                  stats: [{ label: 'Fitness', value: c.fitness_score }, { label: 'Military', value: c.military_score }, { label: 'Conduct', value: c.conduct_score }],
                })} />
              <KPICard label="Readiness Today" value={k.readinessToday ?? '—'} unit="/ 100" icon={<IcoActivity />}
                rag={k.acwr > 1.4 ? 'critical' : 'normal'}
                subValues={[{ label: 'ACWR', value: k.acwr ?? '—' }, { label: 'Device', value: c.garmin_device }]}
                onClick={() => setDetail({
                  title: 'Wearable Readiness', subtitle: `Garmin ${c.garmin_device} · synced ${c.device_synced_hrs_ago}h ago`, source: 'Garmin Health API · flow 4',
                  stats: [{ label: 'Readiness', value: k.readinessToday ?? '—' }, { label: 'ACWR', value: k.acwr ?? '—', tone: k.acwr > 1.4 ? 'down' : 'up' }, { label: 'Injury risk', value: k.acwr > 1.4 ? 'High' : 'Normal', tone: k.acwr > 1.4 ? 'down' : 'up' }],
                  content: <TrendChart data={data.wearables} x="date" height={200} series={[{ key: 'acwr', name: 'ACWR', color: k.acwr > 1.4 ? C.red : C.green }]} yDomain={[0, 2]} />,
                })} />
              <KPICard label="Weapons Issued (WMS)" value={k.weaponsOut} icon={<IcoLock />}
                rag={k.weaponsOut > 0 ? 'warning' : 'normal'}
                subValues={[{ label: 'Armoury', value: 'Z09' }, { label: 'Squadron', value: `${c.squadron} Sqn` }]}
                onClick={() => setDetail({
                  title: 'Armoury — Weapon Issuance', subtitle: 'WMS records on this Cadet ID · Domain D', source: 'WMS · Armoury Z09',
                  stats: [{ label: 'Currently out', value: k.weaponsOut, tone: k.weaponsOut ? 'warn' : 'up' }, { label: 'Recent txns', value: data.weapons.length }],
                  content: (
                    <DataTable
                      columns={[
                        { key: 'weapon_type', label: 'Weapon' },
                        { key: 'weapon_id', label: 'ID' },
                        { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                        { key: 'ts', label: 'When', render: (v) => timeAgo(v) },
                      ]}
                      rows={data.weapons} />
                  ),
                })} />
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

              {/* Right column — cross-module context */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Panel title="Wearable Readiness — 14 Days" sub={`Garmin ${c.garmin_device} · Health API → HPO middleware (flow 4)`}
                  right={<Link to={`/readiness?cadet=${c.cadet_id}`} className="app-timeframe-btn" style={{ textDecoration: 'none' }}>Open human twin →</Link>}>
                  <TrendChart data={data.wearables} x="date" height={170}
                    series={[
                      { key: 'readiness', name: 'Readiness', color: C.blue, area: true },
                      { key: 'sleep', name: 'Sleep h', color: C.violet },
                    ]} rightAxisKeys={['sleep']} />
                  <div style={{ marginTop: 8, fontSize: 11, display: 'flex', justifyContent: 'space-between', color: 'var(--app-text-muted)' }}>
                    <span>Latest ACWR <b style={{ color: k.acwr > 1.4 ? 'var(--app-danger)' : 'var(--app-text)' }}>{k.acwr ?? '—'}</b></span>
                    <StatusChip kind={k.acwr > 1.4 ? 'danger' : 'success'}>{k.acwr > 1.4 ? 'HIGH INJURY RISK' : 'WITHIN LIMITS'}</StatusChip>
                  </div>
                </Panel>

                <Panel title={`${data.squadron.name} Squadron — HPO Domains`} sub={`Peer cohort of ${data.squadron.peers} · squadron avg composite ${data.squadron.avgComposite}`}>
                  <RadarPanel data={radar} angleKey="domain" height={210}
                    series={[{ key: 'score', name: `${data.squadron.name} Sqn`, color: C.amber }]} />
                </Panel>

                <Panel title="Armoury — Weapon Issuance (WMS)" sub="Domain D join on the single Cadet ID">
                  {data.weapons.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--app-text-faint)', padding: '6px 2px' }}>No weapon transactions on record.</div>
                  ) : (
                    <DataTable
                      maxHeight={170}
                      columns={[
                        { key: 'weapon_type', label: 'Weapon' },
                        { key: 'weapon_id', label: 'ID' },
                        { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                        { key: 'ts', label: 'When', render: (v) => timeAgo(v) },
                      ]}
                      rows={data.weapons} />
                  )}
                </Panel>
              </div>
            </div>

            <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} {...(detail || {})} />
          </>
        );
      })()}
    </>
  );
}
