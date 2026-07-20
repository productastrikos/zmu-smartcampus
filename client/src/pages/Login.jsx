import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme';
import { useLang, LangToggle } from '../i18n';

const ROLES = [
  { u: 'executive', key: 'role.executive' },
  { u: 'superadmin', key: 'role.superadmin' },
  { u: 'academics', key: 'role.academics' },
  { u: 'readiness', key: 'role.readiness' },
  { u: 'finance', key: 'role.finance' },
  { u: 'ithead', key: 'role.ithead' },
  { u: 'security', key: 'role.security' },
  { u: 'facility', key: 'role.facility' },
];

// Demo credentials — every role's password matches its username; picking a
// role in the password tab auto-fills the pair.
const CREDS = Object.fromEntries(ROLES.map((r) => [r.u, { username: r.u, password: r.u }]));

const inputStyle = {
  width: '100%', height: 44, borderRadius: 10, padding: '0 14px', fontFamily: 'inherit',
  fontSize: 13.5, color: 'var(--app-text)', background: 'var(--app-surface)',
  border: '1px solid var(--app-panel-border)', boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--app-text-faint)', marginBottom: 6,
};

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('sso'); // 'sso' | 'password'
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { t, dir } = useLang();

  async function submitLogin(payload) {
    setErr(null); setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
      const user = await res.json();
      onLogin(user);
      navigate(user.role === 'executive' ? '/executive' : '/');
    } catch (e) { setErr(String(e.message || e)); setBusy(false); }
  }

  function switchMode(m) {
    setMode(m); setErr(null); setRole(''); setUsername(''); setPassword('');
  }

  // Password tab — selecting a role auto-fills its demo username & password.
  function pickRoleWithCreds(r) {
    setRole(r); setErr(null);
    const c = CREDS[r];
    setUsername(c ? c.username : '');
    setPassword(c ? c.password : '');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!role) return setErr('Choose a role');
    if (!username.trim()) return setErr('Enter a username');
    if (!password.trim()) return setErr('Enter a password');
    submitLogin({ username: username.trim(), password, role });
  }

  function handleSso() {
    if (!role) return setErr('Choose a role first');
    submitLogin({ username: role, password: 'sso', role });
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--app-bg)', position: 'relative' }} dir={dir}>
      <div style={{ position: 'absolute', top: 18, insetInlineEnd: 20, zIndex: 5, display: 'flex', gap: 8 }}>
        <LangToggle /><ThemeToggle />
      </div>

      {/* Left — brand, ZMU campus photo background */}
      <div style={{
        flex: '0 0 58%', maxWidth: '58%', position: 'relative', overflow: 'hidden',
        backgroundImage: 'url(/images/zmu-campus-hero.jpg)', backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 60px',
      }}>
        {/* dark wash so the campus photo doesn't fight the text on top of it */}
        <div style={{ position: 'absolute', inset: 0,
          background: 'linear-gradient(150deg, rgba(30,24,14,0.88) 0%, rgba(42,33,21,0.82) 45%, rgba(30,24,14,0.75) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55,
          backgroundImage: 'radial-gradient(circle at 82% 12%, rgba(198,162,78,0.28), transparent 48%), radial-gradient(circle at 12% 90%, rgba(146,114,42,0.2), transparent 44%)' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 18, padding: '16px 22px',
            boxShadow: '0 10px 34px rgba(0,0,0,0.30)' }}>
            <img src="/images/zmu-logo-full.png" alt="Zayed Military University" style={{ height: 92, width: 'auto', display: 'block' }} />
          </div>
        </div>

        <div style={{ position: 'relative', maxWidth: 560 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#d8b866', marginBottom: 14 }}>
            {t('app.university')}
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 800, color: '#fdf7ea', lineHeight: 1.12, letterSpacing: '-0.02em' }}>
            {t('app.platform')}
          </h1>
        </div>

        <div />
      </div>

      {/* Right — sign-in form */}
      <div style={{ flex: '0 0 42%', maxWidth: '42%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 52px', background: 'var(--app-panel)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.02em' }}>{t('login.title')}</h2>
          <p style={{ fontSize: 13, color: 'var(--app-text-faint)', marginTop: 6, marginBottom: 20 }}>{t('login.subtitle')}</p>

          {/* mode toggle — SSO vs Username & Password */}
          <div style={{
            display: 'flex', gap: 4, padding: 4, borderRadius: 11, marginBottom: 20,
            background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
          }}>
            {[['sso', t('login.tabSso')], ['password', t('login.tabPassword')]].map(([m, label]) => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                style={{
                  flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em',
                  background: mode === m ? 'var(--app-accent)' : 'transparent',
                  color: mode === m ? '#231d10' : 'var(--app-text-faint)',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'sso' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>{t('login.role')}</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="" disabled>{t('login.rolePlaceholder')}</option>
                  {ROLES.map((r) => <option key={r.u} value={r.u}>{t(r.key)}</option>)}
                </select>
              </div>

              <p style={{ fontSize: 12, color: 'var(--app-text-faint)', lineHeight: 1.6, margin: 0 }}>
                {t('login.ssoHint')}
              </p>

              {err && <div style={{ fontSize: 12, color: 'var(--app-danger)', fontWeight: 600 }}>{err}</div>}

              <button type="button" onClick={handleSso} disabled={busy}
                style={{ width: '100%', height: 46, borderRadius: 10, cursor: 'pointer',
                  background: 'var(--app-accent)', border: 'none', color: '#231d10',
                  fontSize: 14, fontWeight: 750, opacity: busy ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                {busy ? '···' : t('login.uaepass')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>{t('login.role')}</label>
                <select value={role} onChange={(e) => pickRoleWithCreds(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="" disabled>{t('login.rolePlaceholder')}</option>
                  {ROLES.map((r) => <option key={r.u} value={r.u}>{t(r.key)}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>{t('login.username')}</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')} autoComplete="off" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>{t('login.password')}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')} autoComplete="new-password" style={inputStyle} />
              </div>

              {err && <div style={{ fontSize: 12, color: 'var(--app-danger)', fontWeight: 600 }}>{err}</div>}

              <button type="submit" disabled={busy}
                style={{
                  width: '100%', height: 46, borderRadius: 10, cursor: 'pointer', marginTop: 4,
                  background: 'var(--app-accent)', border: 'none', color: '#231d10',
                  fontSize: 14, fontWeight: 750, opacity: busy ? 0.6 : 1,
                }}>
                {busy ? '···' : t('login.signIn')}
              </button>
            </form>
          )}

          <p style={{ fontSize: 11, color: 'var(--app-text-faint)', textAlign: 'center', marginTop: 22, lineHeight: 1.6 }} className="ltr-num">
            {t('login.credsHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
