import React, { useEffect, useState } from 'react';
import { useApi } from '../services/api';
import KPICard, { IcoCamera, IcoAlert, IcoClipboard, IcoDatabase } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo, ProgressBar } from '../components/ui';
import { CAMERA_GRID } from '../config/cameras';

/* Incident Management — VMS live wall + flagged footage log.
   Stream URLs are mapped manually in src/config/cameras.js; slots without
   a URL render a simulated feed so the wall stays demo-ready. */

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function CameraTile({ cam, streamUrl, clock }) {
  const offline = cam?.status === 'offline';
  return (
    <div className="cctv-tile">
      {offline ? (
        <div className="cctv-offline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ width: 26, height: 26 }}>
            <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /><line x1="2" y1="2" x2="22" y2="22" />
          </svg>
          SIGNAL LOST
        </div>
      ) : streamUrl ? (
        <video src={streamUrl} autoPlay muted loop playsInline />
      ) : (
        <div className="cctv-feed" />
      )}
      <div className="cctv-label">
        {!offline && <span className="cctv-rec" />}
        {cam?.camera_id || '—'} · {cam?.name || 'Unassigned'}
      </div>
      <div className="cctv-ts">{clock.toLocaleTimeString('en-GB')} GST</div>
      {!offline && (
        <div className="cctv-meta">
          {cam?.resolution} · {cam?.fps} fps · {cam?.analytics}
        </div>
      )}
    </div>
  );
}

export default function IncidentManagement() {
  const { data } = useApi('/cctv');
  const clock = useClock();

  if (!data) return <Loading text="Loading VMS module…" />;
  const k = data.kpis;
  const camById = Object.fromEntries(data.cameras.map((c) => [c.camera_id, c]));
  const openIncidents = data.incidents.filter((i) => i.status !== 'closed');

  return (
    <>
      <PageHeader
        title="Incident Management — CCTV"
        subtitle="VMS live wall (ORANGE network) · analytics-flagged footage · stream URLs mapped in src/config/cameras.js"
      />

      <KPIGrid>
        <KPICard label="Cameras Online" value={`${k.camerasOnline}/${k.camerasTotal}`} icon={<IcoCamera />}
          rag={k.camerasOnline < k.camerasTotal ? 'warning' : 'normal'}
          subValues={[{ label: 'Offline', value: k.camerasTotal - k.camerasOnline }]} />
        <KPICard label="Incidents — 24h" value={k.incidents24h} icon={<IcoAlert />} rag={k.incidents24h > 8 ? 'warning' : 'normal'} />
        <KPICard label="Open Incidents" value={k.openIncidents} icon={<IcoClipboard />}
          rag={k.openIncidents > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'Escalated', value: data.incidents.filter((i) => i.status === 'escalated').length }]} />
        <KPICard label="Recording Retention" value={k.retentionDays} unit="days" icon={<IcoDatabase />}
          subValues={[{ label: 'Storage used', value: `${k.storageUsedPct}%` }]} />
      </KPIGrid>

      <Panel title="Live Camera Wall" sub="6-channel operator layout · click-to-swap feeds via config" style={{ marginBottom: 14 }}>
        <div className="cctv-grid">
          {CAMERA_GRID.map((slot) => (
            <CameraTile key={slot.slot} cam={camById[slot.cameraId]} streamUrl={slot.streamUrl} clock={clock} />
          ))}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <Panel title="Flagged Footage" sub="Video-analytics detections · clips retained for evidentiary review">
          <DataTable
            maxHeight={340}
            columns={[
              { key: 'ts', label: 'Time', render: (v) => timeAgo(v) },
              { key: 'incident_id', label: 'Incident' },
              { key: 'camera_id', label: 'Camera' },
              { key: 'camera', label: 'Location' },
              { key: 'type', label: 'Type' },
              { key: 'severity', label: 'Severity', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
              { key: 'clip_s', label: 'Clip', render: (v) => `${v}s`, align: 'right' },
              { key: 'status', label: 'Status', render: (v) => <StatusChip kind={v === 'closed' ? 'success' : v === 'escalated' ? 'danger' : 'warning'}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={data.incidents} />
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Reported Incidents" sub="Operator triage queue">
            {openIncidents.slice(0, 5).map((i) => (
              <div key={i.incident_id} style={{
                padding: '9px 12px', marginBottom: 6, borderRadius: 8, background: 'var(--app-surface-soft)',
                borderLeft: `3px solid ${i.severity === 'high' ? 'var(--app-danger)' : i.severity === 'medium' ? 'var(--app-warning)' : 'var(--app-info)'}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text)' }}>{i.type} — {i.camera_id}</div>
                <div style={{ fontSize: 10.5, color: 'var(--app-text-muted)', margin: '2px 0' }}>{i.description}</div>
                <div style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>{timeAgo(i.ts)} · {i.operator} · {i.status}</div>
              </div>
            ))}
          </Panel>

          <Panel title="Camera Health" sub="VMS registry — all channels">
            <DataTable
              maxHeight={220}
              columns={[
                { key: 'camera_id', label: 'ID' },
                { key: 'name', label: 'Camera' },
                { key: 'status', label: 'Status', render: (v) => <StatusChip kind={v === 'online' ? 'success' : 'danger'}>{v.toUpperCase()}</StatusChip> },
              ]}
              rows={data.cameras} />
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginBottom: 4, fontWeight: 600 }}>STORAGE POOL — {k.storageUsedPct}% OF 90-DAY RETENTION</div>
              <ProgressBar pct={k.storageUsedPct} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
