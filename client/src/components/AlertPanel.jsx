import React, { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';
import { StatusChip, sevChip, timeAgo } from './ui';

/** Slide-in cross-domain alert feed (right panel, per design standard) */
export default function AlertPanel({ open, onClose }) {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    if (open) fetchApi('/alerts').then((d) => setAlerts(d.alerts)).catch(() => {});
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div className="animate-slide-in-right" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '92vw', zIndex: 1000,
        background: 'var(--app-panel)', borderLeft: '1px solid var(--app-surface-raised)',
        boxShadow: 'var(--app-shadow-lg)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--app-surface-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="panel-title">Cross-Domain Alert Feed</div>
            <div className="panel-sub">{alerts.filter((a) => a.status === 'open').length} open · correlated across domains A–D</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close alerts">✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 8,
              background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <StatusChip kind={sevChip(a.severity)}>{a.severity.toUpperCase()}</StatusChip>
                <StatusChip kind="accent">{a.domain}</StatusChip>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--app-text-faint)' }}>{timeAgo(a.ts)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--app-text)', lineHeight: 1.45 }}>{a.title}</div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 4 }}>{a.source} · {a.status}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
