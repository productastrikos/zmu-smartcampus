import React, { useEffect, useMemo, useRef, useState } from 'react';
import { withSquads } from '../services/api';

/* Shared pieces for the extended modules (SIS / LMS / streams / merit). */

export function useExt(path) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    // withSquads scopes the request to the logged-in squadron leader's cadets.
    fetch(`/api${withSquads(path)}`).then((r) => r.json()).then((d) => live && setData(d)).catch(() => {});
    return () => { live = false; };
  }, [path, tick]);
  return { data, refresh: () => setTick((t) => t + 1) };
}

/* College filter — scopes every widget to one of ZMU's academic colleges */
export function InstitutionSwitcher({ user, college, onChange }) {
  const { data: colleges } = useExt('/ext/colleges');
  if (!colleges) return null;
  const opts = [{ code: 'ALL', label: 'All Colleges' }, ...colleges.map((c) => ({ code: c.code, label: c.label || c.name }))];
  return (
    <div className="app-timeframe-control" title="College filter — scopes every widget to a ZMU college">
      {opts.map((c) => (
        <button key={c.code}
          className={`app-timeframe-btn${college === c.code ? ' is-active' : ''}`}
          onClick={() => onChange(c.code)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* SiA advisory block — purple = AI. Rotates through a pool of context tips
   (2 at a time) on a timer, and resets whenever the pool changes (e.g. a new
   cadet is selected) so each cadet/page shows fresh, tailored guidance. */
export function Advisory({ items = [], interval = 5000, visible = 2 }) {
  const pool = items.filter(Boolean);
  const key = pool.join('|');
  const [start, setStart] = useState(0);
  useEffect(() => { setStart(0); }, [key]);
  useEffect(() => {
    if (pool.length <= visible) return undefined;
    const t = setInterval(() => setStart((s) => (s + visible) % pool.length), interval);
    return () => clearInterval(t);
  }, [key, pool.length, visible, interval]);

  const shown = [];
  for (let i = 0; i < Math.min(visible, pool.length); i++) shown.push(pool[(start + i) % pool.length]);
  const rotating = pool.length > visible;

  return (
    <div style={{ padding: '13px 15px', borderRadius: 12, background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--app-advisory)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
          </svg>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--app-advisory)' }}>SiA · AI Advisory</span>
        {rotating && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.ceil(pool.length / visible) }).map((_, i) => (
              <span key={i} style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--app-advisory)', opacity: i === Math.floor(start / visible) % Math.ceil(pool.length / visible) ? 0.9 : 0.28 }} />
            ))}
          </span>
        )}
      </div>
      <div key={start} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 7, minHeight: 34 }}>
        {shown.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--app-advisory)', fontWeight: 700, flexShrink: 0, lineHeight: 1.5 }}>›</span>
            <span style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.55 }}>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Score ring (readiness / conduct) */
export function ScoreRing({ value, size = 116, color, label }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  const col = color || (value >= 80 ? 'var(--app-success)' : value >= 65 ? 'var(--app-warning)' : 'var(--app-danger)');
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--app-surface-raised)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size / 3.6, fontWeight: 800, color: 'var(--app-text)', lineHeight: 1 }}>{value}</span>
        {label && <span style={{ fontSize: 9, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</span>}
      </div>
    </div>
  );
}

/* Cadet avatar — initials on a company-tinted disc */
const COMPANY_TINT = { Falcon: '#3b7de8', Oryx: '#14b8a6', Saqr: '#f59e0b', Ghaf: '#22c55e' };
export function Avatar({ name, company, size = 32 }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const tint = COMPANY_TINT[company] || '#64748b';
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${tint}22`, color: tint, fontWeight: 800, fontSize: size * 0.38, border: `1px solid ${tint}55`,
    }}>{initials}</span>
  );
}

const scoreColor = (v) => (v >= 80 ? 'var(--app-success)' : v >= 65 ? 'var(--app-warning)' : 'var(--app-danger)');

/* Roster pane — searchable cadet list with company quick-filters.
   Simple, consistent picker shared by the three stream pages. */
export function RosterPane({ rows, selectedId, onSelect, scoreKey = 'score' }) {
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('All');
  // Only offer company filters that actually appear in the (already squadron-
  // scoped) roster, so a squadron leader isn't shown empty companies.
  const companies = ['All', ...['Falcon', 'Oryx', 'Saqr', 'Ghaf'].filter((c) => rows.some((r) => r.company === c))];
  const filtered = rows.filter((r) =>
    (company === 'All' || r.company === company) &&
    (r.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cadet…"
        style={{ background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {companies.map((cm) => (
          <button key={cm} onClick={() => setCompany(cm)} style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid ' + (company === cm ? 'var(--app-accent-border)' : 'var(--app-panel-border)'),
            background: company === cm ? 'var(--app-accent-bg)' : 'transparent',
            color: company === cm ? 'var(--app-accent)' : 'var(--app-text-faint)',
          }}>{cm}</button>
        ))}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 480, display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 2 }}>
        {filtered.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
            border: '1px solid ' + (selectedId === r.id ? 'var(--app-accent-border)' : 'transparent'),
            background: selectedId === r.id ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)', color: 'var(--app-text)', fontFamily: 'inherit',
          }}>
            <Avatar name={r.name} company={r.company} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{r.company} · Year {r.year}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, flexShrink: 0, color: scoreColor(r[scoreKey]) }}>{r[scoreKey]}</span>
          </button>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--app-text-faint)', padding: 10, textAlign: 'center' }}>No cadets match.</div>}
      </div>
    </div>
  );
}

/* CadetPicker — a compact, searchable dropdown for pages that select a single
   cadet (Cadet Journey, SIS). Shows the current cadet prominently with prev/next
   stepping and a filterable popover; much simpler than a raw <select>. */
export function CadetPicker({ cadets, value, onChange, labelFor }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const idOf = (c) => c.id ?? c.cadet_id;
  const idx = cadets.findIndex((c) => String(idOf(c)) === String(value));
  const current = idx >= 0 ? cadets[idx] : cadets[0];
  const filtered = useMemo(() => cadets.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())), [cadets, q]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const step = (d) => {
    const n = cadets.length;
    const next = cadets[((idx < 0 ? 0 : idx) + d + n) % n];
    onChange(String(idOf(next)));
  };
  if (!current) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => step(-1)} title="Previous cadet" style={arrowBtn}>‹</button>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 10, cursor: 'pointer', minWidth: 240,
        border: '1px solid var(--app-panel-border)', background: 'var(--app-surface)', color: 'var(--app-text)', fontFamily: 'inherit',
      }}>
        <Avatar name={current.name} company={current.company} size={30} />
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.name}</div>
          <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{labelFor ? labelFor(current) : `${current.company} · Cadet ${idOf(current)}`}</div>
        </div>
        <span style={{ color: 'var(--app-text-faint)', fontSize: 11 }}>▾</span>
      </button>
      <button onClick={() => step(1)} title="Next cadet" style={arrowBtn}>›</button>

      {open && (
        <div className="animate-fade-in" style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 320, zIndex: 60,
          background: 'var(--app-panel)', border: '1px solid var(--app-surface-raised)', borderRadius: 12, boxShadow: 'var(--app-shadow-lg)', padding: 8,
        }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cadet…"
            style={{ width: '100%', background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', marginBottom: 6 }} />
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.map((c) => (
              <button key={idOf(c)} onClick={() => { onChange(String(idOf(c))); setOpen(false); setQ(''); }} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                border: '1px solid ' + (String(idOf(c)) === String(value) ? 'var(--app-accent-border)' : 'transparent'),
                background: String(idOf(c)) === String(value) ? 'var(--app-accent-bg)' : 'transparent', color: 'var(--app-text)',
              }}>
                <Avatar name={c.name} company={c.company} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>{labelFor ? labelFor(c) : `${c.company} · Year ${c.year}`}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--app-text-faint)', padding: 10, textAlign: 'center' }}>No cadets match.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const arrowBtn = {
  width: 30, height: 30, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
  border: '1px solid var(--app-panel-border)', background: 'var(--app-surface)', color: 'var(--app-text-muted)',
  fontSize: 16, fontWeight: 700, lineHeight: 1, fontFamily: 'inherit',
};
