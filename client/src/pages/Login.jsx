import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme';

const FEATURES = [
  { icon: 'M3 12h4l3-9 4 18 3-9h4', title: 'One command center', desc: 'Learning, readiness, enterprise and campus operations in a single view.' },
  { icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5', title: 'Live campus digital twin', desc: 'A real-time twin of every zone, building and sensor across the campus.' },
];

/* Demo accounts (RBAC) — Zayed Military University roles */
const DEMO_ACCOUNTS = [
  { u: 'superadmin', label: 'Super admin' },
  { u: 'commandant.rashid', label: 'Commandant' },
  { u: 'staff.hassan', label: 'Command staff' },
  { u: 'cadet1001', label: 'Officer Cadet' },
];

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('superadmin');
  const [password, setPassword] = useState('Zayed@2027');
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  async function doLogin(username) {
    setErr(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
      const user = await res.json();
      onLogin({ ...user, email: `${user.username}@zmu.ac.ae` });
      navigate('/');
    } catch (e) { setErr(String(e.message || e)); }
  }

  function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    doLogin(email.trim().replace(/@.*$/, ''));
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--app-bg)', position: 'relative' }}>
      {/* Theme toggle — top-right of the whole page */}
      <div style={{ position: 'absolute', top: 18, right: 20, zIndex: 5 }}>
        <ThemeToggle />
      </div>

      {/* ── Left 60% — brand / about ─────────────────────────────── */}
      <div style={{
        flex: '0 0 60%', maxWidth: '60%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(150deg, #0a1626 0%, #12243c 45%, #1a3a5f 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 60px',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.5,
          backgroundImage: 'radial-gradient(circle at 82% 12%, rgba(59,125,232,0.24), transparent 46%), radial-gradient(circle at 12% 88%, rgba(20,184,166,0.14), transparent 42%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.3,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }} />

        {/* logos */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #1e3a5f, #3b7de8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '0.02em',
          }}>ZMU</div>
          <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.18)' }} />
          <img src="/astrikos-logo.png" alt="Astrikos" style={{ height: 30, filter: 'brightness(2.4)' }} />
        </div>

        {/* title + short intro */}
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7fb0f0', marginBottom: 16 }}>
            Zayed Military University
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 18 }}>
            Smart Digital Campus
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(233,238,245,0.75)', lineHeight: 1.65, marginBottom: 38, maxWidth: 460 }}>
            The integrated platform that unifies academics, readiness and campus operations —
            built by Astrikos on the S!aP platform.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 460 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(59,125,232,0.16)', border: '1px solid rgba(127,176,240,0.28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#7fb0f0" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}>
                    {f.icon.split(' M').map((seg, i) => <path key={i} d={(i === 0 ? seg : 'M' + seg)} />)}
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#e8eef5', marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(233,238,245,0.62)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(233,238,245,0.45)', letterSpacing: '0.04em' }}>
          Restricted · ZMU-MSI-RFP-2026 · Demonstration environment
        </div>
      </div>

      {/* ── Right 40% — login / signup ───────────────────────────── */}
      <div style={{
        flex: '0 0 40%', maxWidth: '40%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 56px',
        background: 'var(--app-panel)',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 23, fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.02em' }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--app-text-faint)', marginTop: 6 }}>
              {mode === 'login' ? 'Access the ZMU Smart Digital Campus platform.' : 'Register for platform access (demo).'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--app-surface-soft)', marginBottom: 22 }}>
            {[['login', 'Sign in'], ['signup', 'Sign up']].map(([key, label]) => (
              <button key={key} onClick={() => setMode(key)}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
                  border: '1px solid ' + (mode === key ? 'rgba(59,125,232,0.35)' : 'transparent'),
                  background: mode === key ? 'rgba(59,125,232,0.14)' : 'transparent',
                  color: mode === key ? '#3b7de8' : 'var(--app-text-faint)',
                }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {mode === 'signup' && (
              <Field label="Full name" value={name} onChange={setName} placeholder="e.g. Capt. A. Al Mazrouei" type="text" />
            )}
            <Field label="Username" value={email} onChange={setEmail} placeholder="e.g. commandant.rashid" type="text" />
            <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />
            {err && <div style={{ fontSize: 12, color: 'var(--app-danger)', fontWeight: 600 }}>{err}</div>}

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-text-faint)', marginBottom: 7 }}>
                Demo roles — one-click sign in
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.u} type="button" onClick={() => doLogin(a.u)} style={{
                    padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 14, cursor: 'pointer',
                    border: '1px solid var(--app-accent-border)', background: 'var(--app-accent-bg)', color: 'var(--app-text-muted)',
                  }}>{a.label}</button>
                ))}
              </div>
            </div>

            {mode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--app-text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#3b7de8' }} /> Remember me
                </label>
                <span style={{ color: '#3b7de8', cursor: 'pointer', fontWeight: 600 }}>Forgot password?</span>
              </div>
            )}

            <button type="submit" style={{
              marginTop: 4, height: 44, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #2d6ad4, #3b7de8)', color: '#fff',
              fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(59,125,232,0.35)',
            }}>
              {mode === 'login' ? 'Sign in to platform' : 'Create account & continue'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }} />
              <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }} />
            </div>

            <button type="button" onClick={() => { onLogin({ email: 'sso@zmu.ac.ae', name: 'Duty Officer' }); navigate('/'); }}
              style={{
                height: 44, borderRadius: 9, cursor: 'pointer',
                background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
                color: 'var(--app-text)', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Continue with UAE Pass / SSO
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--app-text-faint)', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
            Powered by Astrikos S!aP · Authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--app-text-muted)' }}>{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          height: 42, borderRadius: 9, padding: '0 13px', fontSize: 13.5,
          background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
          color: 'var(--app-text)', outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(59,125,232,0.5)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--app-border)'; }}
      />
    </label>
  );
}
