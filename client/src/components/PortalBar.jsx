import React from 'react';
import { useLang } from '../i18n';

/* A row of "open the source portal" links shown at the top of each core
   module page. These jump to the real ZMU environment systems in a new tab;
   our value-add is the AI advisory layer on this page. */
export default function PortalBar({ portals }) {
  const { t } = useLang();
  if (!portals || !portals.length) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)',
      borderRadius: 12, padding: '10px 14px', marginBottom: 14,
    }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-text-faint)' }}>
        {t('app.openPortals')}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
        {portals.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 650,
              padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
              background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)',
            }}>
            {p.label}
            <span style={{ opacity: 0.7, fontSize: 10 }}>:{p.port} ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
