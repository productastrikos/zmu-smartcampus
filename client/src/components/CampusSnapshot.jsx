import React, { useMemo, useState, useEffect } from 'react';
import { useLang } from '../i18n';
import boundaryGeo from '../assets/geojson/campus_boundary.geojson';
import buildingsGeo from '../assets/geojson/buildings.geojson';
import roadsGeo from '../assets/geojson/roads.geojson';

/**
 * CampusSnapshot — a small, self-contained "Digital Twin at a glance" widget
 * (executive-screen only). Renders the real campus boundary + building
 * footprints + roads as a static, projected SVG straight from the bundled
 * GeoJSON — no MapLibre instance, no tile CDN, so it's instant. One togglable
 * feature layer on top of the static footprint:
 *   · Heatmap — personnel-density blobs per real building centroid
 * Demo/illustrative (no live positioning feed exists yet) — same "not a live
 * BMS feed" honesty convention as the rest of the twin.
 */
function ringsOf(feature) {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
const densityColor = (v) => (v > 0.7 ? '#ef4444' : v > 0.4 ? '#f59e0b' : '#22c55e');

export default function CampusSnapshot({ height = 240 }) {
  const { t } = useLang();
  const [tick, setTick] = useState(0);
  const [layers, setLayers] = useState({ heat: true });
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 3500);
    return () => clearInterval(id);
  }, []);

  const model = useMemo(() => {
    const W = 600, H = 340, pad = 16;
    const bRings = (boundaryGeo.features || []).flatMap(ringsOf);
    const buildRings = (buildingsGeo.features || []).flatMap(ringsOf);
    const roadRings = (roadsGeo.features || []).flatMap(ringsOf);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of bRings) for (const [lon, lat] of ring) {
      if (lon < minX) minX = lon; if (lon > maxX) maxX = lon;
      if (lat < minY) minY = lat; if (lat > maxY) maxY = lat;
    }
    if (!isFinite(minX)) return null;
    const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
    const px = (lon, lat) => [
      offX + (lon - minX) * scale,
      H - (offY + (lat - minY) * scale),
    ];
    const toPath = (ring, close) => ring.map(([lon, lat], i) => {
      const [x, y] = px(lon, lat);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + (close ? ' Z' : '');

    // roads sorted longest-first (by point count, a cheap length proxy) so
    // the busier/main roads render, not every tiny spur
    const roadPaths = roadRings
      .map((r) => ({ path: toPath(r, false), pts: r.length }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 8)
      .map((r) => r.path);

    const heatPoints = (buildingsGeo.features || [])
      .filter((f) => f.properties?.centroid)
      .map((f) => {
        const [lon, lat] = f.properties.centroid;
        const [x, y] = px(lon, lat);
        const base = hash01(f.properties.id || f.properties.display_name || '');
        return { x, y, base, id: f.properties.id, name: f.properties.display_name };
      });

    return {
      W, H,
      boundary: bRings.map((r) => toPath(r, true)),
      buildings: buildRings.map((r) => toPath(r, true)),
      roadPaths,
      heatPoints,
    };
  }, []);

  const heat = useMemo(() => {
    if (!model) return [];
    return model.heatPoints.map((p) => {
      const phase = p.base * Math.PI * 2;
      const drift = Math.sin(tick * 0.35 + phase) * 0.18;
      const density = Math.max(0.08, Math.min(0.95, p.base * 0.85 + drift + 0.1));
      return { ...p, density };
    });
  }, [model, tick]);

  const hottest = heat.length ? heat.reduce((a, b) => (b.density > a.density ? b : a)) : null;
  const avgDensity = heat.length ? heat.reduce((s, p) => s + p.density, 0) / heat.length : 0;

  const toggle = (key) => setLayers((l) => ({ ...l, [key]: !l[key] }));
  const CHIPS = [
    { key: 'heat', label: t('exec.twinLayerHeat') },
  ];

  return (
    <div style={{
      position: 'relative', borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--app-panel-border)', background: '#0a0f16', height,
    }}>
      {model && (
        <svg viewBox={`0 0 ${model.W} ${model.H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="cs-glow" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="#12324a" />
              <stop offset="100%" stopColor="#0a0f16" />
            </radialGradient>
            <filter id="cs-blur" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            {heat.map((p, i) => (
              <radialGradient key={`grad${i}`} id={`cs-heat-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={densityColor(p.density)} stopOpacity={0.55 * p.density + 0.15} />
                <stop offset="100%" stopColor={densityColor(p.density)} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          <rect x="0" y="0" width={model.W} height={model.H} fill="url(#cs-glow)" />

          {model.boundary.map((d, i) => (
            <path key={`b${i}`} d={d} fill="rgba(34,211,238,0.05)" stroke="#22d3ee" strokeWidth="1.4" strokeDasharray="5 4" />
          ))}
          {model.roadPaths.map((d, i) => (
            <path key={`r${i}`} d={d} fill="none" stroke="rgba(120,160,190,0.5)" strokeWidth="1.1" />
          ))}

          {layers.heat && (
            <>
              <g filter="url(#cs-blur)">
                {heat.map((p, i) => (
                  <circle key={`heat${i}`} cx={p.x} cy={p.y} r={14 + p.density * 26} fill={`url(#cs-heat-${i})`} />
                ))}
              </g>
              {heat.filter((p) => p.density > 0.4).map((p, i) => (
                <circle key={`dot${i}`} cx={p.x} cy={p.y} r="2.2" fill={densityColor(p.density)} opacity="0.9" />
              ))}
            </>
          )}

          {model.buildings.map((d, i) => (
            <path key={`h${i}`} d={d} fill="rgba(59,125,232,0.35)" stroke="#5b8de0" strokeWidth="0.6" />
          ))}
        </svg>
      )}

      <div style={{
        position: 'absolute', top: 10, insetInlineStart: 12, display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: '#bcefff',
        background: 'rgba(8,14,22,0.65)', padding: '4px 9px', borderRadius: 20, border: '1px solid rgba(77,226,255,0.25)',
      }}>
        <span className="animate-blink" style={{ width: 6, height: 6, borderRadius: 99, background: '#22c55e', display: 'inline-block' }} />
        {t('exec.twinSnapshot')}
      </div>

      {hottest && (
        <div style={{
          position: 'absolute', top: 10, insetInlineEnd: 12, textAlign: 'end',
          fontSize: 9.5, color: 'rgba(188,239,255,0.85)', background: 'rgba(8,14,22,0.65)',
          padding: '4px 9px', borderRadius: 20, border: '1px solid rgba(77,226,255,0.2)',
        }}>
          {t('exec.twinHottest')}: <b style={{ color: densityColor(hottest.density) }}>{hottest.name}</b>
        </div>
      )}

      {/* Feature layer toggles — real interactivity, mirrors the full twin's LayerControl */}
      <div style={{ position: 'absolute', top: 40, insetInlineEnd: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {CHIPS.map((c) => (
          <button key={c.key} onClick={() => toggle(c.key)}
            style={{
              fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, cursor: 'pointer',
              border: '1px solid ' + (layers[c.key] ? 'rgba(77,226,255,0.5)' : 'rgba(255,255,255,0.12)'),
              background: layers[c.key] ? 'rgba(77,226,255,0.18)' : 'rgba(8,14,22,0.5)',
              color: layers[c.key] ? '#bcefff' : 'rgba(188,239,255,0.4)',
              textAlign: 'end', whiteSpace: 'nowrap',
            }}>
            {c.label}
          </button>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: 8, insetInlineStart: 12, display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 9, color: 'rgba(188,239,255,0.75)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#22c55e' }} /> {t('exec.twinLow')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#f59e0b' }} /> {t('exec.twinMed')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#ef4444' }} /> {t('exec.twinHigh')}
        </span>
        <span className="ltr-num" style={{ marginInlineStart: 'auto', opacity: 0.8 }}>
          {t('exec.twinAvg')} {Math.round(avgDensity * 100)}%
        </span>
      </div>
    </div>
  );
}
