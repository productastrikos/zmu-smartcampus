import React, { useState } from 'react';
import { Panel, StatusChip, Loading, PageHeader, DataTable, timeAgo } from '../components/ui';
import { useExt, InstitutionSwitcher, Advisory } from '../components/ext';

/* Composite Score & Order of Merit — four-stream fusion (Academic · Military
   · Fitness · Conduct) on the single cadet ID. Weights are ZMU policy:
   editable by the Commandant only, versioned and audited; the whole Order
   of Merit re-ranks live when they change (demo lever 4). */

const STREAM_COLORS = { academic: '#3b7de8', military: '#22c55e', fitness: '#f59e0b', conduct: '#14b8a6' };

export default function MeritBoard({ user }) {
  const [college, setCollege] = useState(user?.role === 'partner' ? user.college_code : 'ALL');
  const { data, refresh } = useExt(`/ext/merit?college=${college}`);
  const { data: wdata, refresh: wrefresh } = useExt('/ext/weights');
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState(null);

  if (!data || !wdata) return <Loading text="Computing Order of Merit…" />;
  const canEdit = ['commandant', 'superadmin'].includes(user?.role);
  const w = draft || data.weights;
  const total = w.academic + w.military + w.fitness + w.conduct;

  const apply = async () => {
    setMsg(null);
    const r = await fetch('/api/ext/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-role': user.role, 'x-user': user.username },
      body: JSON.stringify({ ...w, note: 'Set from Order of Merit board' }),
    });
    const j = await r.json();
    setMsg(r.ok ? `Weights applied (v${j.current.version}) — Order of Merit re-ranked` : j.error);
    setDraft(null); refresh(); wrefresh();
  };

  const meRank = user?.student_id ? data.table.find((r) => r.id === user.student_id) : null;

  return (
    <>
      <PageHeader title="Composite Score & Order of Merit"
        subtitle="Four-stream fusion — Academic (SIS/LMS) · Military · Fitness · Conduct — on the single immutable Cadet ID · weights are versioned ZMU policy"
        right={<InstitutionSwitcher user={user} college={college} onChange={setCollege} />} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Composite Weights" sub={canEdit ? 'Commandant policy — drag, then Apply to re-rank' : 'Set by the Commandant · read-only for your role'}>
            {['academic', 'military', 'fitness', 'conduct'].map((k) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--app-text)', fontWeight: 650, textTransform: 'capitalize' }}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: STREAM_COLORS[k], marginRight: 7 }} />{k}
                  </span>
                  <b style={{ color: 'var(--app-text)' }}>{w[k]}%</b>
                </div>
                <input type="range" min="0" max="60" value={w[k]} disabled={!canEdit}
                  onChange={(e) => setDraft({ ...w, [k]: +e.target.value })}
                  style={{ width: '100%', accentColor: STREAM_COLORS[k] }} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: total === 100 ? 'var(--app-success)' : 'var(--app-danger)' }}>Total {total}% {total !== 100 && '(must equal 100)'}</span>
              {canEdit && (
                <button disabled={total !== 100 || !draft} onClick={apply} style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12.5,
                  cursor: total === 100 && draft ? 'pointer' : 'not-allowed', opacity: total === 100 && draft ? 1 : 0.5,
                  background: 'var(--app-btn)', color: 'var(--app-btn-text)',
                }}>Apply & re-rank</button>
              )}
            </div>
            {msg && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: msg.includes('re-rank') ? 'var(--app-success)' : 'var(--app-danger)' }}>{msg}</div>}
          </Panel>

          <Panel title="Weight History" sub="Versioned & audited">
            {wdata.history.slice().reverse().slice(0, 5).map((v) => (
              <div key={v.version} style={{ padding: '6px 2px', borderBottom: '1px solid var(--app-surface-raised)', fontSize: 11.5 }}>
                <b style={{ color: 'var(--app-text)' }}>v{v.version}</b>
                <span style={{ color: 'var(--app-text-muted)' }}> — A{v.weights.academic}/M{v.weights.military}/F{v.weights.fitness}/C{v.weights.conduct}</span>
                <div style={{ color: 'var(--app-text-faint)', fontSize: 10.5 }}>{v.set_by} · {timeAgo(v.set_at)} · {v.note}</div>
              </div>
            ))}
          </Panel>

          <Advisory items={[
            `${data.table.filter((r) => r.composite < 65).length} cadets sit below a 65 composite under current weights — intervention briefs (study plan + training-load adjustments) are recommended for each.`,
            'Raising the fitness weight by 5 points would move physically strong cadets up the order — model the change with the sliders before applying; every version is audited.',
            meRank ? `Your standing: rank #${meRank.rank} of ${data.table.length}, composite ${meRank.composite}.` : 'Scoped reporting: partner registrars see only their own College; the Commandant sees all four.',
          ]} />
        </div>

        <Panel title={`Order of Merit — ${data.table.length} officer cadets`} sub={`Composite = ${w.academic}% academic + ${w.military}% military + ${w.fitness}% fitness + ${w.conduct}% conduct`}>
          <DataTable maxHeight={640}
            columns={[
              { key: 'rank', label: '#', render: (v) => <b style={{ color: v <= 3 ? '#f59e0b' : 'var(--app-text)' }}>{v <= 3 ? `★ ${v}` : v}</b> },
              { key: 'name', label: 'Officer Cadet', render: (v, r) => (
                <span style={r.id === user?.student_id ? { color: '#3b7de8', fontWeight: 700 } : undefined}>{v}{r.id === user?.student_id ? ' (you)' : ''}</span>
              ) },
              { key: 'company', label: 'Company' },
              { key: 'tenant', label: 'College' },
              { key: 'academic_pct', label: 'Acad %', align: 'right' },
              { key: 'military', label: 'Mil', align: 'right' },
              { key: 'fitness', label: 'Fit', align: 'right' },
              { key: 'conduct', label: 'Con', align: 'right' },
              { key: 'hold', label: 'Hold', render: (v) => (v ? <StatusChip kind="danger">HOLD</StatusChip> : '') },
              { key: 'composite', label: 'Composite', align: 'right', render: (v) => <b style={{ color: v >= 80 ? 'var(--app-success)' : v >= 65 ? 'var(--app-text)' : 'var(--app-danger)' }}>{v}</b> },
            ]}
            rows={data.table} />
        </Panel>
      </div>
    </>
  );
}
