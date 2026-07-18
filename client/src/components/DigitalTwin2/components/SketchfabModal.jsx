import React, { useEffect, useState } from 'react';

// Reusable full-screen modal shell for embedding a Sketchfab model in-app
// (never a new tab/redirect). The iframe only exists in the DOM while
// `open` is true — React unmounts it on close, which is both the lazy-
// load AND the "destroy after close" requirement for free, and guarantees
// only one instance ever exists since nothing renders it outside this
// component.
export default function SketchfabModal({ open, title, subtitle, sketchfabUrl, sketchfabTitle, infoPanel, onClose }) {
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const requestFullscreen = () => {
    const el = document.getElementById('zt2-sketchfab-modal-root');
    el?.requestFullscreen?.();
  };

  return (
    <div
      id="zt2-sketchfab-modal-root"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(4,7,11,0.94)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', fontFamily: 'inherit',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid rgba(77,226,255,0.25)',
        background: 'rgba(8,14,22,0.9)',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: '#7fd8ff', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <HeaderButton label="Info" active={showInfo} onClick={() => setShowInfo((v) => !v)} />
          <HeaderButton label="Fullscreen" onClick={requestFullscreen} />
          <HeaderButton label="Close ✕" onClick={onClose} accent />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 14, gap: 14 }}>
        <div style={{
          flex: 1, minWidth: 0, borderRadius: 12, overflow: 'hidden',
          background: '#05080c', border: '1px solid rgba(77,226,255,0.2)',
          boxShadow: '0 0 30px rgba(20,160,220,0.12)',
        }}>
          {/* Exact embed code as supplied — no query params, no Viewer API,
              no attributes added/removed beyond sizing it to fill this
              container. */}
          <div className="sketchfab-embed-wrapper" style={{ width: '100%', height: '100%' }}>
            <iframe
              title={sketchfabTitle}
              frameBorder="0"
              allowFullScreen
              mozallowfullscreen="true"
              webkitallowfullscreen="true"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              xr-spatial-tracking="true"
              execution-while-out-of-viewport="true"
              execution-while-not-rendered="true"
              web-share="true"
              src={sketchfabUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>

        {showInfo && infoPanel && (
          <div style={{
            width: 300, flexShrink: 0, overflowY: 'auto', borderRadius: 12,
            background: 'rgba(8,14,22,0.85)', border: '1px solid rgba(77,226,255,0.25)',
            padding: '14px 16px',
          }}>
            {infoPanel}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderButton({ label, onClick, active, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
        border: `1px solid ${accent ? 'rgba(255,120,120,0.5)' : 'rgba(77,226,255,0.4)'}`,
        background: active ? 'rgba(77,226,255,0.22)' : accent ? 'rgba(255,90,90,0.12)' : 'rgba(77,226,255,0.1)',
        color: accent ? '#ffb3b3' : '#bcefff',
      }}
    >
      {label}
    </button>
  );
}
