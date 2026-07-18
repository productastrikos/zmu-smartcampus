import React from 'react';

/**
 * Keyword-driven AI advisory generator so every KPI detail panel carries a
 * few purple AI-advisory insights without editing all 40+ call sites.
 * Purple is reserved exclusively for AI advisory.
 */
function advisoryFor(title = '') {
  const t = title.toLowerCase();
  const map = [
    { k: ['readiness', 'vo₂', 'vo2', 'hrv', 'sleep'], a: [
      'Readiness dips correlate with sub-6h sleep in the Saqr Company — adjust the night-training rotation.',
      'Push tailored recovery plans to cadets below 70 readiness ahead of Exercise Desert Shield.',
    ] },
    { k: ['garmin', 'sync', 'wearable'], a: [
      'A handful of devices have not synced in 24h — a reminder nudge via the cadet app should restore fleet coverage above 95%.',
      'Consent status is current for all synced cadets; no data-governance blockers.',
    ] },
    { k: ['injury', 'acwr'], a: [
      'The flagged cadets share high acute:chronic workload — a 15% load reduction is projected to cut soft-tissue injuries by ~40%.',
      'Notify company PT instructors directly from the HPO queue to action before the next field exercise.',
    ] },
    { k: ['budget', 'muwazana', 'po value', 'cash', 'dof'], a: [
      'ICT & Digital Services is consuming budget fastest — review Q3 commitments before further approvals.',
      'Forecast shows utilisation tracking slightly ahead of the mid-year plan; no funding risk this quarter.',
    ] },
    { k: ['headcount', 'attrition', 'vacanc'], a: [
      'Outsourced-manpower turnover in Facilities is driving attrition — consider extending framework contracts.',
      'Prioritise the ICT vacancies; they gate the digital-campus operations run-team.',
    ] },
    { k: ['bms', 'alarm', 'temp', 'co₂', 'co2', 'energy', 'zone'], a: [
      'AHU-02 in Academic Block B shows a rising bearing signature — a CMMS work order has been auto-raised (6-day failure window).',
      'Shifting library ventilation to demand-control during the 11:00–14:00 CO₂ peak would improve comfort and save energy.',
    ] },
    { k: ['cctv', 'security', 'auth', 'siem', 'pam', 'weapon', 'ot anomal'], a: [
      'The IAM login burst matches credential-stuffing patterns — affected accounts were auto-locked; recommend a forced reset.',
      'Two weapons are overdue for return — trigger armoury reconciliation and notify the duty NCO.',
    ] },
    { k: ['occupancy', 'parking', 'room'], a: [
      'Occupancy and energy are tightly correlated — off-peak setback schedules can be tightened without comfort impact.',
      'Under-utilised meeting rooms (68%) could absorb the classroom overflow flagged by scheduling.',
    ] },
    { k: ['cadet', 'enrol', 'gpa', 'lms', 'lab', 'librar', 'attendance', 'at-risk', 'academic', 'ai active'], a: [
      'Cadets flagged at-risk by the predictive model should be routed to faculty AI-copilot intervention plans this week.',
      'LMS engagement and attendance are strong predictors of composite score — nudge low-engagement cadets via the cadet app.',
    ] },
    { k: ['integration', 'flow', 'cadet id', 'mft', 'icd', 'dr', 'backup', 'message'], a: [
      'The OT data-diode error rate (flow 5) is elevated from schema drift on two BMS controllers — validate against ICD-005.',
      'Master-data match on the single Cadet ID is healthy at 99.8%; the few duplicates are legacy MS Access records pending migration.',
    ] },
  ];
  for (const m of map) if (m.k.some((kw) => t.includes(kw))) return m.a;
  return [
    'No anomalies detected on this metric in the current window.',
    'SiA will surface a recommendation here automatically if the trend crosses a governed threshold.',
  ];
}

/**
 * KPIDetailPanel — slide-in right panel shown when a KPI card is clicked.
 * Renders the page-supplied breakdown (content) plus an AI advisory section
 * (purple). Optional `advisory` prop overrides the auto-generated insights.
 */
/** Compact metric strip shown at the top of the detail panel. */
function StatStrip({ stats }) {
  if (!stats || !stats.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`, gap: 8, marginBottom: 14 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ background: 'var(--app-surface)', borderRadius: 10, padding: '10px 11px', border: '1px solid var(--app-panel-border)' }}>
          <div style={{ fontSize: 9, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{s.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--app-text)', marginTop: 3 }}>{s.value}</div>
          {s.sub && (
            <div style={{ fontSize: 10, marginTop: 2, color: s.tone === 'up' ? 'var(--app-success)' : s.tone === 'down' ? 'var(--app-danger)' : s.tone === 'warn' ? 'var(--app-warning)' : 'var(--app-text-faint)' }}>
              {s.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function KPIDetailPanel({ open, onClose, title, subtitle, source, advisory, definition, stats, children }) {
  if (!open) return null;
  const tips = advisory && advisory.length ? advisory : advisoryFor(title);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div className="animate-slide-in-right kpi-modal" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '94vw', zIndex: 1000,
        background: 'var(--app-panel)', borderLeft: '1px solid var(--app-surface-raised)',
        boxShadow: 'var(--app-shadow-lg)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--app-surface-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--app-text)', fontSize: 15, fontWeight: 700 }}>{title}</div>
            {subtitle && <div className="panel-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
            {source && (
              <div style={{ marginTop: 6 }}>
                <span className="status-chip status-chip-info">{source}</span>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close details" style={{ flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {definition && (
            <div style={{
              fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.55,
              padding: '10px 12px', borderRadius: 10, marginBottom: 14,
              background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)',
            }}>
              {definition}
            </div>
          )}
          <StatStrip stats={stats} />
          {children}

          {/* ── AI advisory (purple) ─────────────────────────────── */}
          <div style={{
            marginTop: 18, padding: '13px 14px', borderRadius: 12,
            background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--app-advisory)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                  <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
                </svg>
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--app-advisory)' }}>
                SiA · AI Advisory
              </span>
            </div>
            {tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < tips.length - 1 ? 8 : 0 }}>
                <span style={{ color: 'var(--app-advisory)', fontWeight: 700, flexShrink: 0, lineHeight: 1.5 }}>›</span>
                <span style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.55 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
