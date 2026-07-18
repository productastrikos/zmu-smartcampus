import React from 'react';
import { useLang } from '../i18n';

/* ─── SVG Icon library (line-art, 24×24 viewBox) — design standard ─── */
const Ico = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" className="w-[26px] h-[22px]">
    {children}
  </svg>
);
export const IcoAlert      = () => <Ico><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></Ico>;
export const IcoBarChart   = () => <Ico><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ico>;
export const IcoClock      = () => <Ico><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>;
export const IcoCheck      = () => <Ico><polyline points="20 6 9 17 4 12"/></Ico>;
export const IcoShield     = () => <Ico><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></Ico>;
export const IcoPin        = () => <Ico><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></Ico>;
export const IcoCalendar   = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;
export const IcoPeople     = () => <Ico><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></Ico>;
export const IcoWrench     = () => <Ico><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></Ico>;
export const IcoLock       = () => <Ico><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></Ico>;
export const IcoDollar     = () => <Ico><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></Ico>;
export const IcoTrendUp    = () => <Ico><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></Ico>;
export const IcoBolt       = () => <Ico><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Ico>;
export const IcoClipboard  = () => <Ico><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></Ico>;
export const IcoThermometer= () => <Ico><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></Ico>;
export const IcoWind       = () => <Ico><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></Ico>;
export const IcoFire       = () => <Ico><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-7 7 7 7 0 01-3.5-13.5"/></Ico>;
export const IcoLink       = () => <Ico><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></Ico>;
export const IcoSignal     = () => <Ico><path d="M2 20h.01M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></Ico>;
export const IcoGlobe      = () => <Ico><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></Ico>;
export const IcoAttendance = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></Ico>;
export const IcoHeart      = () => <Ico><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></Ico>;
export const IcoWatch      = () => <Ico><circle cx="12" cy="12" r="6"/><path d="M12 9v3l1.5 1.5"/><path d="M16.5 4.2L16 2h-8l-.5 2.2"/><path d="M7.5 19.8L8 22h8l.5-2.2"/></Ico>;
export const IcoMoon       = () => <Ico><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></Ico>;
export const IcoActivity   = () => <Ico><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ico>;
export const IcoBook       = () => <Ico><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></Ico>;
export const IcoGrad       = () => <Ico><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></Ico>;
export const IcoCpu        = () => <Ico><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></Ico>;
export const IcoBuilding   = () => <Ico><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="9.01" y2="6"/><line x1="15" y1="6" x2="15.01" y2="6"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/><path d="M9 22v-4h6v4"/></Ico>;
export const IcoCamera     = () => <Ico><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></Ico>;
export const IcoTarget     = () => <Ico><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Ico>;
export const IcoCar        = () => <Ico><path d="M5 17h-2v-6l2-5h12l2 5v6h-2"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/><path d="M5 11h14"/></Ico>;
export const IcoDatabase   = () => <Ico><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></Ico>;
export const IcoDroplet    = () => <Ico><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></Ico>;

export function deriveRag(color) {
  if (!color) return 'normal';
  if (color.includes('red')) return 'critical';
  if (color.includes('amber') || color.includes('yellow') || color.includes('orange')) return 'warning';
  return 'normal';
}

/**
 * KPICard — enterprise-grade stat tile (design standard: productastrikos/UserInterface)
 */
export default function KPICard({ label, value, unit, icon, color, rag: ragProp, trend, onClick, subValues }) {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const hasTrend = trend !== null && trend !== undefined;
  const isPos = (trend || 0) >= 0;
  const rag = ragProp || deriveRag(color);

  const RAG_KEY = { normal: 'status.normal', warning: 'status.warning', critical: 'status.critical' };
  const ragStyles = {
    normal:   { color: '#22c55e', dot: '#16a34a' },
    warning:  { color: '#f59e0b', dot: '#d97706' },
    critical: { color: '#ef4444', dot: '#dc2626' },
  }[rag] || { color: '#22c55e', dot: '#16a34a' };
  const ragLabel = ar ? t(RAG_KEY[rag] || 'status.normal') : t(RAG_KEY[rag] || 'status.normal').toUpperCase();

  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', minHeight: 0, position: 'relative' }}
    >
      {/* Row 1: icon + label + trend badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div className="rounded-xl flex items-center justify-center leading-none app-kpi-icon"
          style={{ width: '30px', height: '30px', fontSize: '1.1rem', flexShrink: 0, color: '#38bdf8' }}>
          {icon || '▣'}
        </div>
        <p className="font-semibold leading-tight flex-1"
          style={{ color: 'var(--app-text-muted)', fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </p>
        {hasTrend && (
          <span className="kpi-trend-badge font-semibold flex items-center leading-tight gap-0.5"
            style={{
              fontSize: '10px',
              color: isPos ? '#22c55e' : '#ef4444',
              background: isPos ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              padding: '2px 6px', borderRadius: '5px', flexShrink: 0,
            }}>
            <span style={{ fontSize: '8px' }}>{isPos ? '▲' : '▼'}</span>
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </span>
        )}
      </div>

      {/* Row 2: large value */}
      <div style={{ flexShrink: 0, marginTop: '12px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span className="font-bold leading-none tracking-tight"
          style={{ color: 'var(--app-text)', fontSize: 'clamp(1.6rem, 2.4vw, 2.2rem)' }}>
          {value}
        </span>
        {unit && <span style={{ color: 'var(--app-text-faint)', fontSize: '0.8rem', fontWeight: 500 }}>{unit}</span>}
      </div>

      {/* Row 3: sub-values */}
      {subValues && subValues.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
          {subValues.map((sv, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', color: 'var(--app-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sv.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 600 }}>{sv.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Divider — marginTop:auto pins the RAG + VIEW DETAILS footer to the
          bottom so every card's action row aligns uniformly across a row. */}
      <div className="kpi-card-divider" style={{ height: '1px', background: 'var(--app-border)', marginTop: 'auto', marginBottom: 9, flexShrink: 0 }} />

      {/* Row 4: RAG badge + detail action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', color: ragStyles.color, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ragStyles.dot, display: 'inline-block', flexShrink: 0 }} />
          {ragLabel}
        </span>
        {onClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            aria-label={`Details for ${label}`}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '10px', fontWeight: 700, color: '#22d3ee',
              textDecoration: 'underline', textUnderlineOffset: '2px',
              cursor: 'pointer', letterSpacing: '0.05em', lineHeight: 1,
            }}>
            {ar ? t('common.viewDetails') : t('common.viewDetails').toUpperCase()}
          </button>
        )}
      </div>
    </div>
  );
}
