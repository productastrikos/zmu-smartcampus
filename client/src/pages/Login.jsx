import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme';
import { useLang, LangToggle } from '../i18n';

const ROLES = [
  {
    u: 'executive', key: 'role.executive', descKey: 'login.execDesc',
    icon: ['M3 3v18h18', 'M7 14l3-4 3 3 5-7'],
  },
  {
    u: 'superadmin', key: 'role.superadmin', descKey: 'login.adminDesc',
    icon: ['M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z', 'M9 12l2 2 4-4'],
  },
];

export default function Login({ onLogin }) {
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();
  const { t, dir } = useLang();

  async function doLogin(username) {
    setErr(null); setBusy(username);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
      const user = await res.json();
      onLogin(user);
      navigate(username === 'executive' ? '/executive' : '/');
    } catch (e) { setErr(String(e.message || e)); setBusy(null); }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--app-bg)', position: 'relative' }} dir={dir}>
      <div style={{ position: 'absolute', top: 18, insetInlineEnd: 20, zIndex: 5, display: 'flex', gap: 8 }}>
        <LangToggle /><ThemeToggle />
      </div>

      {/* Left — brand */}
      <div style={{
        flex: '0 0 58%', maxWidth: '58%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(150deg, #2a2115 0%, #3a2e1c 45%, #4a3a22 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 60px',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55,
          backgroundImage: 'radial-gradient(circle at 82% 12%, rgba(198,162,78,0.28), transparent 48%), radial-gradient(circle at 12% 90%, rgba(146,114,42,0.2), transparent 44%)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.22,
          backgroundImage: 'linear-gradient(rgba(255,248,233,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,248,233,0.05) 1px, transparent 1px)', backgroundSize: '46px 46px' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #6e5622, #c6a24e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#231d10', letterSpacing: '0.02em' }}>ZMU</div>
          <div style={{ width: 1, height: 34, background: 'rgba(255,248,233,0.2)' }} />
          <img src="/astrikos-logo.png" alt="Astrikos" style={{ height: 28, filter: 'brightness(2.6)' }} />
        </div>

        <div style={{ position: 'relative', maxWidth: 560 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#d8b866', marginBottom: 16 }}>
            {t('app.university')}
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 800, color: '#fdf7ea', lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 18 }}>
            {t('app.platform')}
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(253,247,234,0.78)', lineHeight: 1.65, maxWidth: 480 }}>
            {t('login.tagline')}
          </p>
        </div>

        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(253,247,234,0.5)', letterSpacing: '0.04em' }} className="ltr-num">
          Restricted · ZMU-MSI-RFP-2026 · Demonstration environment
        </div>
      </div>

      {/* Right — role picker */}
      <div style={{ flex: '0 0 42%', maxWidth: '42%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 52px', background: 'var(--app-panel)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.02em' }}>{t('login.title')}</h2>
          <p style={{ fontSize: 13, color: 'var(--app-text-faint)', marginTop: 6, marginBottom: 8 }}>{t('login.subtitle')}</p>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-text-faint)', margin: '18px 0 12px' }}>
            {t('login.chooseRole')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ROLES.map((r) => (
              <button key={r.u} onClick={() => doLogin(r.u)} disabled={busy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'start', cursor: 'pointer',
                  padding: '16px 18px', borderRadius: 14, fontFamily: 'inherit',
                  background: 'var(--app-surface)', border: '1px solid var(--app-panel-border)',
                  boxShadow: 'var(--app-shadow-sm)', opacity: busy && busy !== r.u ? 0.5 : 1,
                }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'var(--app-accent-bg)', border: '1px solid var(--app-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--app-accent)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                    {r.icon.map((d, i) => <path key={i} d={d} />)}
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 750, color: 'var(--app-text)' }}>{t(r.key)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--app-text-faint)', marginTop: 2, lineHeight: 1.4 }}>{t(r.descKey)}</span>
                </span>
                <span style={{ color: 'var(--app-accent)', fontSize: 18, flexShrink: 0 }}>{busy === r.u ? '···' : (dir === 'rtl' ? '‹' : '›')}</span>
              </button>
            ))}
          </div>

          {err && <div style={{ fontSize: 12, color: 'var(--app-danger)', fontWeight: 600, marginTop: 12 }}>{err}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }} />
            <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('login.uaepass') ? 'or' : 'or'}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }} />
          </div>

          <button type="button" onClick={() => doLogin('superadmin')}
            style={{ width: '100%', height: 44, borderRadius: 10, cursor: 'pointer',
              background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            {t('login.uaepass')}
          </button>

          <p style={{ fontSize: 11, color: 'var(--app-text-faint)', textAlign: 'center', marginTop: 22, lineHeight: 1.6 }}>
            {t('app.poweredBy')}
          </p>
        </div>
      </div>
    </div>
  );
}
