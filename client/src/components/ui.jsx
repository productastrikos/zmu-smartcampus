import React from 'react';

/** Panel — glass surface with uppercase title, per design standard */
export function Panel({ title, sub, right, children, className = '', style }) {
  return (
    <div className={`glass-panel ${className}`} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div>
            <div className="panel-title">{title}</div>
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusChip({ kind, children }) {
  return <span className={`status-chip status-chip-${kind}`}>{children}</span>;
}

export const sevChip = (sev) => ({
  critical: 'danger', high: 'danger', fault: 'danger', overdue: 'danger', open: 'danger',
  medium: 'warning', warning: 'warning', degraded: 'warning', investigating: 'warning', 'In Review': 'warning', Draft: 'warning', 'pending approval': 'warning',
  low: 'info', info: 'info', advisory: 'info', out: 'info', standby: 'info',
  healthy: 'success', normal: 'success', resolved: 'success', ok: 'success', running: 'success', closed: 'success', Approved: 'success', 'action taken': 'success', acknowledged: 'accent',
}[sev] || 'accent');

export function ProgressBar({ pct, color }) {
  const c = color || (pct > 90 ? 'var(--app-danger)' : pct > 75 ? 'var(--app-warning)' : '#3b7de8');
  return (
    <div className="progress-track" style={{ width: '100%' }}>
      <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: c }} />
    </div>
  );
}

export function DataTable({ columns, rows, onRowClick, maxHeight }) {
  return (
    <div style={{ overflow: 'auto', maxHeight: maxHeight || 'none', minHeight: 0 }}>
      <table className="data-table">
        <thead style={{ position: 'sticky', top: 0, background: 'var(--app-surface)', zIndex: 1 }}>
          <tr>{columns.map((c, ci) => <th key={ci} style={c.align === 'right' ? { textAlign: 'right' } : {}}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c, ci) => (
                <td key={ci} style={c.align === 'right' ? { textAlign: 'right' } : {}}>
                  {c.render ? c.render(r[c.key], r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Loading({ text = 'Loading module…' }) {
  return (
    <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="app-loading">
        <div className="app-loading-orbit" />
        <div className="app-loading-text">{text}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="page-header-block">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div>}
    </div>
  );
}

/** KPI grid wrapper — responsive card row */
export function KPIGrid({ children, min = 196 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
