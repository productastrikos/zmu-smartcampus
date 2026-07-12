import React, { useMemo, useState } from 'react';
import { Panel, StatusChip, Loading, PageHeader } from '../components/ui';
import { useExt, InstitutionSwitcher, Advisory, ScoreRing, RosterPane } from '../components/ext';

/* Stream source systems — the three feeds behind the cadet composite:
   HPO Fitness & Readiness (:8086) · Military Training Record (:8087) ·
   Conduct & Discipline Register (:8088), reimplemented on the shared roster
   with the same demo levers (recorded events recompute scores live;
   conduct below 65 places an automatic SIS registration hold). */

const CFG = {
  hpo: {
    title: 'HPO Fitness & Readiness', weight: '20% of composite',
    sub: 'Physical-readiness stream · fitness tests, DEXA body composition, wearables · source of record for the fitness score',
  },
  military: {
    title: 'Military Training Record', weight: '25% of composite',
    sub: 'Military stream · drills, field exercises, leadership evaluation, marksmanship · Military Training Wing system of record',
  },
  conduct: {
    title: 'Conduct & Discipline Register', weight: '15% of composite',
    sub: 'Conduct stream · honour standing and merit/demerit ledger · below 65 places an automatic SIS registration hold',
  },
};

const box = { background: 'var(--app-surface-soft)', borderRadius: 8, padding: '8px 10px' };
const lbl = { fontSize: 9, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 };
const val = { fontSize: 15, fontWeight: 700, color: 'var(--app-text)' };
const Metric = ({ l, v }) => <div style={box}><div style={lbl}>{l}</div><div style={val}>{v ?? '—'}</div></div>;
const inputStyle = { background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', width: '100%' };

export default function StreamPage({ user, which }) {
  const cfg = CFG[which];
  const [college, setCollege] = useState(user?.role === 'partner' ? user.college_code : 'ALL');
  const { data: rows, refresh } = useExt(`/ext/stream/${which}?college=${college}`);
  const [sel, setSel] = useState(user?.student_id || null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);

  const selected = useMemo(() => rows?.find((r) => r.id === (sel || rows?.[0]?.id)), [rows, sel]);
  if (!rows) return <Loading text={`Loading ${cfg.title}…`} />;
  const c = selected;

  const post = async (url, body) => {
    setMsg(null);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    setMsg(r.ok
      ? `Recorded — score ${j.score} (${j.delta >= 0 ? '+' : ''}${j.delta ?? ''}) · composite now ${j.composite}${j.hold != null ? (j.hold ? ' · SIS HOLD PLACED' : ' · no hold') : ''}`
      : j.error);
    refresh();
  };

  const canLever = user?.role !== 'cadet' && user?.role !== 'partner';

  return (
    <>
      <PageHeader title={cfg.title} subtitle={`${cfg.sub} · feeds cadet composite (${cfg.weight})`}
        right={<InstitutionSwitcher user={user} college={college} onChange={setCollege} />} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,2fr)', gap: 14, alignItems: 'start' }}>
        <Panel title="Cadet Cohort" sub={`${rows.length} officer cadets · Falcon · Oryx · Saqr · Ghaf`}>
          <RosterPane rows={rows} selectedId={c?.id} onSelect={setSel} />
        </Panel>

        {c && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Panel title={`${c.name}`} sub={`${c.company} Company · Year ${c.year} · Cadet ${c.id} · ${c.tenant}`}>
              <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
                <ScoreRing value={c.score} label={which === 'conduct' ? 'Conduct' : which === 'military' ? 'Military' : 'Readiness'} />
                <div style={{ flex: 1, minWidth: 260, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  {which === 'hpo' && (<>
                    <Metric l="2.4 km run" v={c.run_mmss} />
                    <Metric l="Push-ups (2 min)" v={c.pushups} />
                    <Metric l="Sit-ups (2 min)" v={c.situps} />
                    <Metric l="Plank hold" v={c.plank_mmss} />
                    <Metric l="DEXA body fat" v={c.dexa_bodyfat_pct != null ? `${c.dexa_bodyfat_pct}%` : null} />
                    <Metric l="VO₂ max" v={c.vo2max} />
                    <Metric l="Resting HR" v={c.resting_hr != null ? `${c.resting_hr} bpm` : null} />
                    <Metric l="Sleep score" v={c.sleep_score} />
                    <Metric l="Training readiness" v={c.training_readiness} />
                    <Metric l="Lean mass" v={c.lean_mass_kg != null ? `${c.lean_mass_kg} kg` : null} />
                  </>)}
                  {which === 'military' && (<>
                    <Metric l="Drills completed" v={c.drills_completed} />
                    <Metric l="Field exercises" v={c.field_exercises} />
                    <Metric l="Leadership eval" v={c.leadership_eval != null ? `${c.leadership_eval} / 5` : null} />
                    <Metric l="Marksmanship" v={c.marksmanship ? `${c.marksmanship} (${c.marksmanship_pct}%)` : null} />
                    <Metric l="Tactical assessment" v={c.tactical_assessment} />
                    <Metric l="Parade discipline" v={c.discipline_on_parade} />
                    <Metric l="Last exercise" v={c.last_exercise} />
                    <Metric l="Band" v={c.band} />
                  </>)}
                  {which === 'conduct' && (<>
                    <Metric l="Honour standing" v={c.standing} />
                    <Metric l="Merits" v={c.merits} />
                    <Metric l="Demerits" v={c.demerits} />
                    <Metric l="Sanctions" v={c.sanctions} />
                    <div style={box}>
                      <div style={lbl}>SIS registration</div>
                      <div style={{ ...val, color: c.hold ? 'var(--app-danger)' : 'var(--app-success)' }}>{c.hold ? 'HOLD' : 'Clear'}</div>
                    </div>
                    <Metric l="Last review" v={c.last_review} />
                  </>)}
                </div>
              </div>
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
              {canLever ? (
                <Panel title={which === 'hpo' ? 'Record Fitness Test' : which === 'military' ? 'Record Evaluation' : 'Merit / Demerit'}
                  sub="Demo lever — recompute is immediate; composite & Order of Merit re-rank">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {which === 'hpo' && (<>
                      <input style={inputStyle} placeholder="2.4 km run seconds (e.g. 585)" value={form.run || ''} onChange={(e) => setForm({ ...form, run: e.target.value })} />
                      <input style={inputStyle} placeholder="Push-ups, 2 min (e.g. 62)" value={form.push || ''} onChange={(e) => setForm({ ...form, push: e.target.value })} />
                      <input style={inputStyle} placeholder="Sit-ups, 2 min (e.g. 58)" value={form.sit || ''} onChange={(e) => setForm({ ...form, sit: e.target.value })} />
                      <button className="app-btn-primary" style={{ padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--app-btn)', color: 'var(--app-btn-text)', fontWeight: 700, fontSize: 12.5 }}
                        onClick={() => post('/api/ext/hpo/test', { student_id: c.id, run_sec: +form.run, pushups: +form.push, situps: +form.sit })}>
                        Record Test Result
                      </button>
                    </>)}
                    {which === 'military' && (<>
                      <input style={inputStyle} placeholder="Leadership eval 0–5 (e.g. 4.4)" value={form.lead || ''} onChange={(e) => setForm({ ...form, lead: e.target.value })} />
                      <input style={inputStyle} placeholder="Marksmanship % (e.g. 88)" value={form.marks || ''} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                      <input style={inputStyle} placeholder="Tactical assessment 0–100 (e.g. 84)" value={form.tac || ''} onChange={(e) => setForm({ ...form, tac: e.target.value })} />
                      <button style={{ padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--app-btn)', color: 'var(--app-btn-text)', fontWeight: 700, fontSize: 12.5 }}
                        onClick={() => post('/api/ext/military/eval', { student_id: c.id, leadership: +form.lead, marksmanship_pct: +form.marks, tactical: +form.tac })}>
                        Record Evaluation
                      </button>
                    </>)}
                    {which === 'conduct' && (<>
                      <input style={inputStyle} placeholder="Points (e.g. 3)" value={form.pts || ''} onChange={(e) => setForm({ ...form, pts: e.target.value })} />
                      <input style={inputStyle} placeholder="Note (e.g. Exemplary turnout inspection)" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--app-success-border)', cursor: 'pointer', background: 'var(--app-success-bg)', color: 'var(--app-success)', fontWeight: 700, fontSize: 12.5 }}
                          onClick={() => post('/api/ext/conduct/event', { student_id: c.id, type: 'merit', points: +form.pts || 1, note: form.note })}>
                          Award Merit
                        </button>
                        <button style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--app-danger-border)', cursor: 'pointer', background: 'var(--app-danger-bg)', color: 'var(--app-danger)', fontWeight: 700, fontSize: 12.5 }}
                          onClick={() => post('/api/ext/conduct/event', { student_id: c.id, type: 'demerit', points: +form.pts || 1, note: form.note })}>
                          Record Demerit
                        </button>
                      </div>
                    </>)}
                    {msg && <div style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes('HOLD') ? 'var(--app-danger)' : 'var(--app-success)' }}>{msg}</div>}
                  </div>
                </Panel>
              ) : (
                <Panel title="Read-only view" sub="Levers are restricted to command staff">
                  <div style={{ fontSize: 12, color: 'var(--app-text-faint)' }}>Your role can review stream records but not record new events.</div>
                </Panel>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {which === 'conduct' && c.ledger?.length > 0 && (
                  <Panel title="Merit / Demerit Ledger" sub="Most recent first">
                    {c.ledger.slice(0, 6).map((e, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 2px', borderBottom: '1px solid var(--app-surface-raised)', fontSize: 12 }}>
                        <StatusChip kind={e.type === 'merit' ? 'success' : 'danger'}>{e.points > 0 ? `+${e.points}` : e.points}</StatusChip>
                        <span style={{ flex: 1, color: 'var(--app-text-muted)' }}>{e.note}</span>
                        <span style={{ color: 'var(--app-text-faint)', fontSize: 10.5 }}>{e.date_label}</span>
                      </div>
                    ))}
                  </Panel>
                )}
                <Advisory items={
                  which === 'hpo' ? [
                    c.score < 65 ? `${c.name.split(' ')[0]} is below the 65 readiness floor — propose a supervised 4-week conditioning block before the next field exercise.`
                      : `Readiness ${c.score} (${c.band}) — training load is sustainable; next DEXA due within 60 days.`,
                    'Cohort insight: sub-6h sleepers average 9 points lower readiness — flag habitual short sleepers to company PT instructors.',
                  ] : which === 'military' ? [
                    c.marksmanship_pct >= 90 ? `Marksmanship ${c.marksmanship_pct}% (${c.marksmanship}) — nominate for the inter-college shooting team.`
                      : `Marksmanship ${c.marksmanship_pct}% — schedule range remediation; Expert threshold is 90%.`,
                    `Leadership eval ${c.leadership_eval}/5 across ${c.field_exercises} field exercises — trend feeds the commissioning board pack.`,
                  ] : [
                    c.hold ? `Active registration hold — ${c.name.split(' ')[0]} cannot register for classes until conduct returns above 65 (merits release it automatically).`
                      : `Honour standing "${c.standing}" — ${c.merits} merits vs ${c.demerits} demerits this term.`,
                    'Pattern watch: demerits clustered on barracks standards respond best to peer-mentor pairing, not sanctions.',
                  ]
                } />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
