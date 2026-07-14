import React, { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';

/**
 * AdvisoryPanel — general campus-wide AI advisory (purple, slide-in from right).
 * Triggered by the "AI Advisory" button in the header. Purple is reserved
 * exclusively for AI advisory across the whole app.
 */
export default function AdvisoryPanel({ open, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([fetchApi('/overview')])
      .then(([o]) => setData(o))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const k = data?.kpis;
  const derived = k ? [
    k.criticalAlerts > 0 && {
      sev: 'act now',
      title: `${k.criticalAlerts} critical/high alerts are open across domains`,
      body: 'Prioritise the BMS AHU-02 fault and the IAM credential-stuffing burst; both have automated actions queued in the agentic layer.',
    },
    k.energyDeltaPct > 5 && {
      sev: 'optimise',
      title: `Campus energy is ${k.energyDeltaPct > 0 ? 'up' : 'down'} ${Math.abs(k.energyDeltaPct)}% vs the prior 24h`,
      body: 'The dining-facility exhaust cycle is the main driver — rescheduling the purge to 22:00 is projected to save ~210 MWh/yr.',
    },
    {
      sev: 'watch',
      title: `Cohort readiness sits at ${k.compositeReadiness}/100 with ${k.wearableReadiness}/100 from wearables`,
      body: 'Saqr Company sleep is trending low; consider adjusting the night-training rotation before the next assessment.',
    },
    {
      sev: 'insight',
      title: `Budget utilisation is at ${k.budgetUtilization}% against a 50% mid-year plan`,
      body: 'ICT & Digital Services is the fastest-consuming cost centre — review Q3 commitments in the Muwazana dashboard.',
    },
  ].filter(Boolean) : [];

  const sevColor = { 'act now': 'var(--app-danger)', optimise: 'var(--app-warning)', watch: 'var(--app-info)', insight: 'var(--app-advisory)' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div className="animate-slide-in-right" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '94vw', zIndex: 1000,
        background: 'var(--app-panel)', borderLeft: '1px solid var(--app-advisory-border)',
        boxShadow: 'var(--app-shadow-lg)', display: 'flex', flexDirection: 'column',
      }}>
        {/* purple header */}
        <div style={{ background: 'var(--app-advisory-panel)', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fef9ef" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
              </svg>
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fef9ef' }}>SiA · AI Advisory</div>
              <div style={{ fontSize: 10.5, color: 'rgba(254,249,239,0.7)' }}>Campus-wide recommendations & foresight</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close advisory" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fef9ef', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {!data ? (
            <div style={{ fontSize: 12, color: 'var(--app-text-faint)', padding: 12 }}>Analysing campus telemetry…</div>
          ) : (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-advisory)', margin: '2px 0 10px' }}>
                Prioritised advisories
              </div>
              {derived.map((a, i) => (
                <div key={i} style={{
                  padding: '11px 13px', borderRadius: 11, marginBottom: 9,
                  background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                      padding: '2px 7px', borderRadius: 20, color: '#fff', background: sevColor[a.sev] || 'var(--app-advisory)',
                    }}>{a.sev}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--app-text)', lineHeight: 1.45 }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.5, marginTop: 4 }}>{a.body}</div>
                </div>
              ))}

              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-advisory)', margin: '16px 0 10px' }}>
                Agentic actions
              </div>
              {data.aiRecommendations.map((r) => (
                <div key={r.rec_id} style={{
                  padding: '11px 13px', borderRadius: 11, marginBottom: 9,
                  background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--app-advisory)', background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)', padding: '2px 7px', borderRadius: 20 }}>{r.rec_id}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--app-text-faint)' }}>{r.domain}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--app-text-faint)' }}>{r.confidence_pct}% confidence</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--app-text)', lineHeight: 1.5 }}>{r.recommendation}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--app-advisory)', marginTop: 4 }}>{r.impact}</div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--app-surface-raised)', fontSize: 10, color: 'var(--app-text-faint)' }}>
          Advisory generated by SiA · demo mode · verify before acting
        </div>
      </div>
    </>
  );
}
