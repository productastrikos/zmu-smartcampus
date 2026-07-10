import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AlertPanel from './AlertPanel';
import AdvisoryPanel from './AdvisoryPanel';
import SiaAgent from './SiaAgent';
import { fetchApi } from '../services/api';
import { ThemeToggle } from '../theme';

/* ── sidebar nav icons (line-art) ─────────────────────────── */
const NIco = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/', label: 'Command Center', icon: ['M3 12h4l3-9 4 18 3-9h4'] },
      { to: '/digital-twin', label: 'Campus Digital Twin', icon: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'] },
    ],
  },
  {
    section: 'Modules',
    items: [
      { to: '/academic', label: 'Academics & Learning', icon: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'] },
      { to: '/readiness', label: 'Readiness & Performance', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
      { to: '/cadet-journey', label: 'Cadet Journey', icon: ['M12 2a4 4 0 100 8 4 4 0 000-8z', 'M6 21v-2a6 6 0 0112 0v2', 'M17 3l4 4-4 4'] },
      { to: '/enterprise', label: 'Enterprise & Finance', icon: ['M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z', 'M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2'] },
      { to: '/campus-ops', label: 'Smart Campus Operations', icon: ['M4 2h16v20H4z', 'M9 22v-4h6v4', 'M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01'] },
      { to: '/it-ops', label: 'Enterprise IT & DCIM', icon: ['M4 4h16v12H4z', 'M8 20h8', 'M12 16v4', 'M8 8h4M8 11h8'] },
    ],
  },
  {
    section: 'Platform',
    items: [
      { to: '/security', label: 'Security Operations', icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
      { to: '/incidents', label: 'Incident Management', icon: ['M23 7l-7 5 7 5V7z', 'M1 5h15v14H1z'] },
      { to: '/integration', label: 'Integration & Data', icon: ['M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'] },
    ],
  },
];

const PAGE_TITLES = {
  '/': 'Command Center',
  '/digital-twin': 'Campus Digital Twin',
  '/academic': 'Academics & Learning',
  '/readiness': 'Readiness & Performance',
  '/enterprise': 'Enterprise & Finance',
  '/campus-ops': 'Smart Campus Operations',
  '/cadet-journey': 'Cadet Journey',
  '/it-ops': 'Enterprise IT & DCIM',
  '/security': 'Security Operations',
  '/incidents': 'Incident Management — CCTV',
  '/integration': 'Integration & Data Platform',
};

export default function Layout({ children, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [clock, setClock] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    fetchApi('/alerts').then((d) => setAlertCount(d.alerts.filter((a) => a.status === 'open').length)).catch(() => {});
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const sidebarW = collapsed ? 68 : 244;
  const initials = (user?.name || 'Duty Officer').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="classification-banner">Restricted · ZMU Smart Digital Campus · Demonstration Environment — Synthetic Data</div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside style={{
          width: sidebarW, flexShrink: 0, background: 'var(--app-chrome-bg)',
          display: 'flex', flexDirection: 'column', padding: collapsed ? '16px 8px' : '16px 10px',
          borderRight: '1px solid var(--app-panel-border)', overflowY: 'auto', overflowX: 'hidden',
          transition: 'width 0.18s ease',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '2px 0 14px' : '2px 8px 14px', justifyContent: collapsed ? 'center' : 'flex-start', borderBottom: '1px solid var(--app-surface-raised)' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #1e3a5f, #3b7de8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: '0.02em',
            }}>ZMU</div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.2 }}>Smart Digital Campus</div>
                <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zayed Military University</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, marginTop: 4 }}>
            {NAV.map((sec) => (
              <div key={sec.section}>
                {!collapsed && <div className="nav-section-label">{sec.section}</div>}
                {collapsed && <div style={{ height: 12 }} />}
                {sec.items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.to === '/'} title={collapsed ? it.label : undefined}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}>
                    <NIco d={it.icon} />
                    {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Platform footer */}
          {!collapsed && (
            <div style={{ padding: '12px 10px 4px', borderTop: '1px solid var(--app-surface-raised)', fontSize: 10, color: 'var(--app-text-faint)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--app-success)', display: 'inline-block' }} className="animate-blink" />
                Powered by Astrikos S!aP
              </div>
              <div>MSI POC · ZMU-MSI-RFP-2026</div>
            </div>
          )}
        </aside>

        {/* ── Main column ─────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <header style={{
            height: 'var(--app-header-h)', flexShrink: 0, background: 'var(--app-chrome-bg)',
            borderBottom: '1px solid var(--app-panel-border)',
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
          }}>
            {/* Sidebar collapse toggle */}
            <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {PAGE_TITLES[location.pathname] || 'ZMU Platform'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
                Master Systems Integrator · Governed exchange backbone · {clock.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} GST
              </div>
            </div>

            {/* AI Advisory (purple) — replaces the live-feed chip */}
            <button className="app-advisory-btn" onClick={() => setAdvisoryOpen(true)} title="Open AI advisory"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, flexShrink: 0 }}>
                <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
              </svg>
              <span style={{ whiteSpace: 'nowrap' }}>AI Advisory</span>
            </button>

            {/* Alerts */}
            <button className={`icon-btn${alertsOpen ? ' active' : ''}`} onClick={() => setAlertsOpen((o) => !o)} title="Alert feed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {alertCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 99,
                  background: 'var(--app-danger)', color: 'var(--app-on-color)', fontSize: 9.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>{alertCount}</span>
              )}
            </button>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Profile + logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 99, background: 'linear-gradient(135deg, #1e3a5f, #3b7de8)',
                color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }} title={user?.name || 'Duty Officer'}>{initials}</div>
              <button className="icon-btn" onClick={onLogout} title="Sign out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </header>

          {/* Content */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 30px', minHeight: 0, background: 'var(--app-bg)' }}>
            <div className="animate-fade-in" key={location.pathname}>
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
