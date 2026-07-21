import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n';

/**
 * SmartWatchPanel — command-staff wellness, sourced from smart watch devices
 * issued to senior officers (a consent-governed wearable middleware, the same
 * kind the cadet Garmin feed uses, kept as a separate cohort). Renders three
 * activity rings plus headline vitals. Values are demo aggregates.
 *
 * Framing note: this is deliberately positioned as a *staff* wellness readout
 * (a distinct device fleet) so it complements — rather than duplicates — the
 * cadet Garmin "wearable readiness" metric elsewhere in the platform.
 */
const RINGS = [
  { id: 'move', color: '#fa114f', track: 'rgba(250,17,79,0.18)', pct: 86 },
  { id: 'exercise', color: '#a6ff00', track: 'rgba(166,255,0,0.16)', pct: 72 },
  { id: 'stand', color: '#00e5ff', track: 'rgba(0,229,255,0.16)', pct: 92 },
];

function Ring({ id, color, track, pct, r, sw }) { /* id ignored — avoids key-spread warning */
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth={sw} />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </>
  );
}

export default function SmartWatchPanel() {
  const { t } = useLang();
  // gentle "live" heart-rate flicker so the panel feels connected
  const [hr, setHr] = useState(68);
  useEffect(() => {
    const id = setInterval(() => setHr(64 + Math.floor(Math.random() * 9)), 2600);
    return () => clearInterval(id);
  }, []);

  const vitals = [
    { label: t('exec.watch.hr'), value: hr, unit: 'bpm', color: '#fa114f' },
    { label: t('exec.watch.hrv'), value: 58, unit: 'ms', color: '#00e5ff' },
    { label: t('exec.watch.steps'), value: '7,940', unit: '', color: '#a6ff00' },
    { label: t('exec.watch.energy'), value: 486, unit: 'kcal', color: '#ff9f0a' },
  ];

  return (
    <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--app-text)' }}>
              <path d="M17 4a3 3 0 00-3-3h-4a3 3 0 00-3 3v1h10zM7 20a3 3 0 003 3h4a3 3 0 003-3v-1H7zM7 6h10v12H7z" />
            </svg>
            {t('exec.watch.title')}
          </div>
          <div className="panel-sub">{t('exec.watch.sub')}</div>
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
          color: 'var(--app-success)', background: 'var(--app-success-bg, rgba(34,197,94,0.12))',
          padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {t('exec.watch.synced')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <Ring {...RINGS[0]} r={50} sw={11} />
            <Ring {...RINGS[1]} r={37} sw={11} />
            <Ring {...RINGS[2]} r={24} sw={11} />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RINGS.map((rg) => (
            <div key={rg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: rg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: 'var(--app-text-muted)', flex: 1 }}>{t(`exec.watch.${rg.id}`)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)' }}>{rg.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginTop: 14 }}>
        {vitals.map((v) => (
          <div key={v.label} style={{ background: 'var(--app-surface-soft)', borderRadius: 9, padding: '9px 11px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{v.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 3 }}>
              <span className="ltr-num" style={{ fontSize: 17, fontWeight: 800, color: v.color, lineHeight: 1 }}>{v.value}</span>
              {v.unit && <span style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>{v.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', marginTop: 10, lineHeight: 1.5 }}>
        {t('exec.watch.foot')}
      </div>
    </div>
  );
}
