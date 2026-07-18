import React, { useEffect, useState } from 'react';

// Reusable full-screen modal shell for embedding a Sketchfab model in-app
// (never a new tab/redirect). The iframe only exists in the DOM while
// `open` is true — React unmounts it on close, which is both the lazy-
// load AND the "destroy after close" requirement for free, and guarantees
// only one instance ever exists since nothing renders it outside this
// component.
export default function SketchfabModal({ open, title, subtitle, sketchfabUrl, sketchfabTitle, infoPanel, onClose }) {
  const [showInfo, setShowInfo] = useState(true);
  // The iframe's own `load` event is the only cross-origin-safe signal
  // available (Sketchfab's viewer internals aren't reachable without their
  // paid Viewer API) — it fires once the embed document itself has loaded,
  // which in practice is close enough to "model is up" for a loading
  // indicator. Reset on every open/url change so re-opening shows it again.
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setIframeLoaded(false);
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, sketchfabUrl, onClose]);

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
          {/* Exact embed code as supplied — no query params beyond the
              ui_* viewer flags below, no Viewer API, no attributes added/
              removed beyond sizing it to fill this container. */}
          <div className="sketchfab-embed-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
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
              onLoad={() => setIframeLoaded(true)}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
            {/* Sketchfab paints its title/byline/watermark/buy/share chrome
                (.viewer .titlebar, .viewer .watermark) INSIDE its own
                cross-origin iframe document — our CSS can't reach in to
                hide it (Same-Origin Policy), and the ui_watermark=0 embed
                flag is only honoured for models the embedding account owns
                on a paid plan. So instead of styling it away, this covers
                that top strip with our own opaque bar, matching the
                modal's chrome, sized generously (72px) to clear the title
                bar's real height regardless of exact Sketchfab markup.
                pointerEvents: 'auto' (not 'none') on purpose — the
                watermark link underneath is a live <a> to sketchfab.com, so
                this needs to actually intercept clicks in that strip, not
                just visually paint over them. */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 72, zIndex: 2,
              background: '#05080c', pointerEvents: 'auto',
            }} />
            {/* Models with annotations (like this one) also get a bottom
                toolbar — annotation prev/next in the middle, help/settings/
                fullscreen icons on the right, and a SECOND small watermark
                badge in the bottom-LEFT corner only. Only that corner is
                covered here (not the full row like the top strip) so the
                annotation navigator and control icons stay usable.
                This model's own viewer background is a light silver-grey
                (not our app's dark theme) — a dark patch here sits on top
                of that light background and reads as an obvious black
                square, so this one's tinted to match instead of covering
                with our usual dark chrome colour. */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, width: 64, height: 56, zIndex: 2,
              background: 'linear-gradient(160deg, #eef0f2, #d8dadd)', pointerEvents: 'auto',
            }} />
            {!iframeLoaded && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14, background: '#05080c',
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  border: '3px solid rgba(77,226,255,0.2)', borderTopColor: '#4de2ff',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{ fontSize: 12, color: '#7fd8ff', letterSpacing: '0.04em' }}>
                  Loading 3-D model…
                </div>
              </div>
            )}
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
