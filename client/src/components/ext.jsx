import React, { useEffect, useState } from 'react';

/* Shared pieces for the extended modules (SIS / LMS / streams / merit). */

export function useExt(path) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(`/api${path}`).then((r) => r.json()).then((d) => live && setData(d)).catch(() => {});
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

/* SiA advisory block — purple = AI, consistent with the rest of the platform */
export function Advisory({ items }) {
  return (
    <div style={{ padding: '13px 14px', borderRadius: 12, background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--app-advisory)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
          </svg>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--app-advisory)' }}>SiA · AI Advisory</span>
      </div>
      {items.map((tip, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < items.length - 1 ? 7 : 0 }}>
          <span style={{ color: 'var(--app-advisory)', fontWeight: 700, flexShrink: 0, lineHeight: 1.5 }}>›</span>
          <span style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.55 }}>{tip}</span>
        </div>
      ))}
    </div>
  );
}

/* Score ring (readiness / conduct) */
export function ScoreRing({ value, size = 110, color, label }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  const col = color || (value >= 80 ? 'var(--app-success)' : value >= 65 ? 'var(--app-warning)' : 'var(--app-danger)');
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--app-surface-raised)" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size / 4, fontWeight: 800, color: 'var(--app-text)', lineHeight: 1 }}>{value}</span>
        {label && <span style={{ fontSize: 9, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</span>}
      </div>
    </div>
  );
}

/* Roster pane — searchable cadet list shared by the three stream pages */
export function RosterPane({ rows, selectedId, onSelect, scoreKey = 'score' }) {
  const [q, setQ] = useState('');
  const filtered = rows.filter((r) => (r.name + r.company).toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or company…"
        style={{ background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit' }} />
      <div style={{ overflowY: 'auto', maxHeight: 520, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            border: '1px solid ' + (selectedId === r.id ? 'var(--app-accent-border)' : 'transparent'),
            background: selectedId === r.id ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)', color: 'var(--app-text)', fontFamily: 'inherit',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{r.company} Company · Year {r.year}</div>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 800, flexShrink: 0,
              color: r[scoreKey] >= 80 ? 'var(--app-success)' : r[scoreKey] >= 65 ? 'var(--app-warning)' : 'var(--app-danger)',
            }}>{r[scoreKey]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
