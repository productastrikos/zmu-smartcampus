import React, { useEffect, useRef, useState } from 'react';
import { fetchApi } from '../services/api';
import { askSia, suggestedQuestions } from '../services/siaKnowledge';

const WELCOME = {
  generic: "Hi, I'm SiA — the Smart Digital Campus assistant. Ask me about attendance, readiness, energy, security or the digital twin.",
  erp: "Hi, I'm the SiA ERP Assistant. Ask me about budget, procurement, headcount, attrition, cash flow or the DoF interface.",
};

/** Shared chat body — messages, persistent suggested questions, input. */
function ChatBody({ mode, height }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME[mode] }]);
  const [ctx, setCtx] = useState({});
  const scrollRef = useRef(null);
  const questions = suggestedQuestions(mode);

  useEffect(() => {
    Promise.all([fetchApi('/overview'), fetchApi('/enterprise')])
      .then(([overview, enterprise]) => setCtx({ overview, enterprise }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reply = askSia(mode, trimmed, ctx);
    setMessages((m) => [...m, { role: 'user', text: trimmed }, { role: 'bot', text: reply }]);
    setInput('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height, minHeight: 0 }}>
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '86%', padding: '8px 11px', borderRadius: 12, fontSize: 12, lineHeight: 1.5,
            background: m.role === 'user' ? 'var(--app-advisory)' : 'var(--app-surface)',
            color: m.role === 'user' ? '#fff' : 'var(--app-text)',
            border: m.role === 'user' ? 'none' : '1px solid var(--app-panel-border)',
          }}>
            {m.text}
          </div>
        ))}
      </div>

      {/* Persistent suggested questions — always visible */}
      <div style={{ padding: '8px 10px 4px', borderTop: '1px solid var(--app-surface-raised)' }}>
        <div style={{ fontSize: 9, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
          Suggested questions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 84, overflowY: 'auto' }}>
          {questions.map((q) => (
            <button key={q} onClick={() => send(q)}
              style={{
                fontSize: 10.5, padding: '5px 9px', borderRadius: 20, cursor: 'pointer',
                background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
                color: 'var(--app-text-muted)', whiteSpace: 'nowrap',
              }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: 10, borderTop: '1px solid var(--app-surface-raised)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder={mode === 'erp' ? 'Ask about budget, POs, headcount…' : 'Ask about attendance, readiness…'}
          style={{
            flex: 1, background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--app-text)', outline: 'none',
          }}
        />
        <button onClick={() => send(input)} className="app-advisory-btn" style={{ height: 34, padding: '0 12px' }}>Send</button>
      </div>
    </div>
  );
}

function ChatHeader({ mode }) {
  return (
    <div style={{ background: 'var(--app-advisory-panel)', padding: '13px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fef9ef" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fef9ef' }}>{mode === 'erp' ? 'SiA · ERP Assistant' : 'SiA · Campus Assistant'}</div>
          <div style={{ fontSize: 10, color: 'rgba(254,249,239,0.65)' }}>{mode === 'erp' ? 'Scoped to the Enterprise & Finance module' : 'Available across the whole campus'}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline ERP assistant — embedded in the Enterprise (ERP) module page only.
 * Use: <SiaAgentInline mode="erp" />
 */
export function SiaAgentInline({ mode = 'erp' }) {
  return (
    <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0, border: '1px solid var(--app-advisory-border)' }}>
      <ChatHeader mode={mode} />
      <ChatBody mode={mode} height={420} />
    </div>
  );
}

/**
 * Floating generic assistant — available on every page (mounted in Layout).
 * Generic only; the ERP assistant is a separate inline panel on the ERP module.
 */
export default function SiaAgent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Launcher — labelled + purple, clearly visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open SiA assistant"
        title="SiA Campus Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1100,
          display: 'flex', alignItems: 'center', gap: 9, height: 52, padding: '0 20px 0 16px',
          borderRadius: 999, border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--app-advisory), var(--app-advisory-strong))',
          color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '0.01em',
          boxShadow: '0 8px 28px rgba(124, 58, 237, 0.55)',
        }}
      >
        {open ? (
          <span style={{ fontSize: 18, fontWeight: 700, width: 20, textAlign: 'center' }}>✕</span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              <circle cx="9" cy="10" r="0.7" fill="currentColor" /><circle cx="12" cy="10" r="0.7" fill="currentColor" /><circle cx="15" cy="10" r="0.7" fill="currentColor" />
            </svg>
            <span>Ask SiA</span>
          </>
        )}
      </button>

      {open && (
        <div className="animate-slide-up" style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 1100, width: 384, maxWidth: '92vw',
          height: 540, maxHeight: '74vh', background: 'var(--app-panel)', borderRadius: 16,
          border: '1px solid var(--app-advisory-border)', boxShadow: 'var(--app-shadow-lg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <ChatHeader mode="generic" />
          <ChatBody mode="generic" height="100%" />
        </div>
      )}
    </>
  );
}
