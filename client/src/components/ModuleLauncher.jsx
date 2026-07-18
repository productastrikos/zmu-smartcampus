import React from 'react';
import { useLang } from '../i18n';

/**
 * ModuleLauncher — a row of buttons shown at the top of a core-module page
 * (Academics, Readiness). Each opens its module in a NEW browser tab via the
 * standalone shell, which has no way back to the dashboard.
 * items: [{ slug, labelKey }]
 */
export default function ModuleLauncher({ items }) {
  const { t } = useLang();
  const open = (slug) => window.open(`/standalone/${slug}`, '_blank', 'noopener,noreferrer');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)',
      borderRadius: 12, padding: '10px 14px', marginBottom: 14,
    }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-text-faint)' }}>
        {t('common.openModules')}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
        {items.map((it) => (
          <button key={it.slug} onClick={() => open(it.slug)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 650,
              padding: '7px 13px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)',
            }}>
            {t(it.labelKey)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, opacity: 0.8 }}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
