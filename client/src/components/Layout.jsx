import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AlertPanel from './AlertPanel';
import AdvisoryPanel from './AdvisoryPanel';
import SiaAgent from './SiaAgent';
import PageAdvisory from './PageAdvisory';
import { fetchApi } from '../services/api';
import { ThemeToggle } from '../theme';
import { useLang, LangToggle } from '../i18n';

/* ── sidebar nav icons (line-art) ─────────────────────────── */
const NIco = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);

/* Reduced navigation. `key` maps to an i18n string. Visibility is driven by
   ROLE_ROUTES below (an allow-list per role); superadmin has no entry and
   therefore sees everything. */
const NAV = [
  {
    section: 'nav.overview',
    items: [
      { to: '/executive', key: 'page.executive', icon: ['M3 3v18h18', 'M7 14l3-4 3 3 5-7'] },
      { to: '/', key: 'page.command', icon: ['M3 12h4l3-9 4 18 3-9h4'] },
      { to: '/digital-twin', key: 'page.twin', icon: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'] },
    ],
  },
  {
    section: 'nav.coreModules',
    items: [
      { to: '/academic', key: 'page.academic', icon: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'] },
      { to: '/readiness', key: 'page.readiness', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
      { to: '/enterprise', key: 'page.enterprise', icon: ['M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z', 'M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2'] },
      { to: '/campus-ops', key: 'page.campus', icon: ['M4 2h16v20H4z', 'M9 22v-4h6v4', 'M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01'] },
      { to: '/it-ops', key: 'page.itops', icon: ['M4 4h16v12H4z', 'M8 20h8', 'M12 16v4', 'M8 8h4M8 11h8'] },
    ],
  },
  {
    section: 'nav.platform',
    items: [
      { to: '/iot', key: 'page.iot', icon: ['M12 20v-6', 'M12 8V4', 'M5 12a7 7 0 0114 0', 'M8.5 12a3.5 3.5 0 017 0', 'M12 12h.01'] },
      { to: '/security', key: 'page.security', icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
      { to: '/incidents', key: 'page.incidents', icon: ['M23 7l-7 5 7 5V7z', 'M1 5h15v14H1z'] },
      { to: '/integration', key: 'page.integration', icon: ['M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'] },
    ],
  },
];

/* RBAC — each restricted role's allow-list. First entry is that role's home.
   `superadmin` is intentionally absent → unrestricted (sees every route). */
export const ROLE_ROUTES = {
  executive: ['/executive', '/digital-twin'],                  // exec screen + full Digital Twin
  academics: ['/academic'],                                    // Head of Academics
  readiness: ['/readiness'],                                   // Military Head
  finance: ['/enterprise'],                                    // Finance Head
  ithead: ['/it-ops', '/iot', '/integration', '/security'],    // IT Head
  security: ['/incidents'],                                    // Security Head
  facility: ['/digital-twin', '/it-ops', '/campus-ops'],       // Facility Management Head
};
export const homeFor = (role) => (ROLE_ROUTES[role] ? ROLE_ROUTES[role][0] : '/');

const TITLE_KEY = {
  '/executive': 'page.executive', '/': 'page.command', '/digital-twin': 'page.twin',
  '/academic': 'page.academic', '/readiness': 'page.readiness', '/enterprise': 'page.enterprise',
  '/campus-ops': 'page.campus', '/iot': 'page.iot', '/incidents': 'page.incidents',
  '/sis': 'page.sis', '/lms': 'page.lms', '/merit': 'page.merit',
  '/hpo': 'page.hpo', '/military': 'page.military', '/conduct': 'page.conduct',
  '/cadet-journey': 'page.cadetJourney', '/it-ops': 'page.itops',
  '/security': 'page.security', '/integration': 'page.integration',
};

export default function Layout({ children, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [clock, setClock] = useState(new Date());
  const location = useLocation();
  const { t, lang } = useLang();

  useEffect(() => {
    fetchApi('/alerts').then((d) => setAlertCount(d.alerts.filter((a) => a.status === 'open').length)).catch(() => {});
    const tm = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(tm);
  }, []);

  const sidebarW = collapsed ? 68 : 244;
  const initials = (user?.name || 'ZMU').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const allowed = ROLE_ROUTES[user?.role];
  const nav = NAV.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => !allowed || allowed.includes(it.to)),
  })).filter((sec) => sec.items.length);
  const roleLabel = t(`role.${user?.role}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Sidebar ── */}
        <aside style={{
          width: sidebarW, flexShrink: 0, background: 'var(--app-chrome-bg)',
          display: 'flex', flexDirection: 'column', padding: collapsed ? '16px 8px' : '16px 10px',
          borderInlineEnd: '1px solid var(--app-panel-border)', overflowY: 'auto', overflowX: 'hidden',
          transition: 'width 0.18s ease',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: collapsed ? '2px 0 14px' : '10px 8px 16px', textAlign: 'center',
            borderBottom: '1px solid var(--app-surface-raised)',
          }}>
            <div style={{
              width: collapsed ? 36 : 68, height: collapsed ? 36 : 68, borderRadius: 12, flexShrink: 0, padding: collapsed ? 3 : 7,
              background: '#fff', border: '1px solid var(--app-panel-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.18s ease, height 0.18s ease',
            }}>
              <img src="/images/zmu-logo-full.png" alt="ZMU" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.25 }}>{t('app.platform')}</div>
                <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>{t('app.university')}</div>
              </div>
            )}
          </div>

          <nav style={{ flex: 1, marginTop: 4 }}>
            {nav.map((sec) => (
              <div key={sec.section}>
                {!collapsed && <div className="nav-section-label">{t(sec.section)}</div>}
                {collapsed && <div style={{ height: 12 }} />}
                {sec.items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.to === '/'} title={collapsed ? t(it.key) : undefined}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}>
                    <NIco d={it.icon} />
                    {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(it.key)}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {!collapsed && (
            <div style={{ padding: '12px 10px 4px', borderTop: '1px solid var(--app-surface-raised)', fontSize: 10, color: 'var(--app-text-faint)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--app-success)', display: 'inline-block' }} className="animate-blink" />
                {t('app.university')}
              </div>
              <div className="ltr-num">{t('app.msi')}</div>
            </div>
          )}
        </aside>

        {/* ── Main column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{
            height: 'var(--app-header-h)', flexShrink: 0, background: 'var(--app-chrome-bg)',
            borderBottom: '1px solid var(--app-panel-border)',
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
          }}>
            <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title="Toggle sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t(TITLE_KEY[location.pathname] || 'app.platform')}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
                {t('app.governed')} · <span className="ltr-num">{clock.toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} GST</span>
              </div>
            </div>

            <button className="app-advisory-btn" onClick={() => setAdvisoryOpen(true)} title={t('app.aiAdvisory')}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, flexShrink: 0 }}>
                <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
              </svg>
              <span style={{ whiteSpace: 'nowrap' }}>{t('app.aiAdvisory')}</span>
            </button>

            <button className={`icon-btn${alertsOpen ? ' active' : ''}`} onClick={() => setAlertsOpen((o) => !o)} title={t('app.alerts')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {alertCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, insetInlineEnd: -5, minWidth: 16, height: 16, borderRadius: 99,
                  background: 'var(--app-danger)', color: 'var(--app-on-color)', fontSize: 9.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>{alertCount}</span>
              )}
            </button>

            <LangToggle />
            <ThemeToggle />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-chip status-chip-accent">{roleLabel}</span>
              <div style={{
                width: 34, height: 34, borderRadius: 99, background: 'linear-gradient(135deg, var(--app-accent-strong), var(--app-accent))',
                color: 'var(--app-on-color)', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }} title={user?.name}>{initials}</div>
              <button className="icon-btn" onClick={onLogout} title={t('app.signout')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </header>

          <main style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 30px', minHeight: 0, background: 'var(--app-bg)' }}>
            <PageAdvisory />
            <div className="animate-fade-in" key={location.pathname + lang}>
              {children}
            </div>
          </main>
        </div>
      </div>

      <AlertPanel open={alertsOpen} onClose={() => setAlertsOpen(false)} />
      <AdvisoryPanel open={advisoryOpen} onClose={() => setAdvisoryOpen(false)} />
      <SiaAgent />
    </div>
  );
}
