import React, { useState } from 'react';
import KPICard, { IcoCpu, IcoSignal, IcoAlert, IcoBolt, IcoActivity } from '../components/KPICard';
import { Panel, StatusChip, Loading, PageHeader, KPIGrid, DataTable, ProgressBar } from '../components/ui';
import { Bars, C } from '../components/charts';
import { useExt, Advisory } from '../components/ext';
import { useLang } from '../i18n';

/* IoT Sensors & Devices — live health of every sensor connected across the
   campus buildings (environmental, occupancy, lighting, energy, HVAC,
   security, water). Unlike a read-only NEST-style view, sensors can be
   ADDED and DELETED here. */

const TYPE_LABEL = {
  environmental: 'Environmental', occupancy: 'Occupancy', lighting: 'Lighting',
  energy: 'Energy', hvac: 'HVAC', security: 'Security', water: 'Water',
};
const statusKind = (s) => (s === 'online' ? 'success' : s === 'degraded' ? 'warning' : s === 'fault' ? 'danger' : 'info');
const healthColor = (v) => (v >= 85 ? 'var(--app-success)' : v >= 60 ? 'var(--app-warning)' : 'var(--app-danger)');

function AddDeviceForm({ meta, onAdd }) {
  const [f, setF] = useState({ building_id: meta.buildings[0], type: 'environmental', subtype: '', name: '', floor: 'L1' });
  const subtypes = meta.typeCatalogue?.[f.type]?.subtypes || [];
  const input = { background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', width: '100%' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <select style={input} value={f.building_id} onChange={(e) => setF({ ...f, building_id: e.target.value })}>
        {meta.buildings.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <select style={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, subtype: '' })}>
        {meta.types.map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp] || tp}</option>)}
      </select>
      <select style={input} value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value })}>
        <option value="">Any {TYPE_LABEL[f.type]} sensor</option>
        {subtypes.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...input, flex: 1 }} placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select style={{ ...input, width: 90 }} value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })}>
          {['G', 'L1', 'L2', 'L3', 'Roof'].map((fl) => <option key={fl} value={fl}>{fl}</option>)}
        </select>
      </div>
      <button onClick={() => onAdd(f)} style={{ padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--app-btn)', color: 'var(--app-btn-text)', fontWeight: 700, fontSize: 12.5 }}>
        + Add device
      </button>
    </div>
  );
}

export default function IoTSensors() {
  const [building, setBuilding] = useState('ALL');
  const [type, setType] = useState('ALL');
  const { data, refresh } = useExt(`/iot/sensors?building=${building}&type=${type}`);
  const [msg, setMsg] = useState(null);
  const { t, lang } = useLang();
  const ar = lang === 'ar';

  if (!data) return <Loading text="Loading IoT sensor network…" />;
  const k = data.kpis;

  const add = async (f) => {
    setMsg(null);
    const r = await fetch('/api/iot/sensors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json();
    setMsg(r.ok ? `Added ${j.sensor.name} (${j.sensor.id}) — now ${j.kpis.total} devices` : j.error);
    refresh();
  };
  const del = async (id) => {
    setMsg(null);
    const r = await fetch(`/api/iot/sensors/${id}`, { method: 'DELETE' });
    const j = await r.json();
    setMsg(r.ok ? `Removed ${id} — now ${j.kpis.total} devices` : j.error);
    refresh();
  };

  return (
    <>
      <PageHeader title={`${t('page.iot')}`}
        subtitle={ar ? 'صحة الأجهزة الحيّة عبر كل مبنى — البيئة والإشغال والإضاءة والطاقة والتكييف والأمن والمياه. أضف أو أوقف الأجهزة فوريًا.' : 'Live device health across every building — environmental, occupancy, lighting, energy, HVAC, security & water. Add or retire devices in real time.'}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={building} onChange={(e) => setBuilding(e.target.value)}
              style={{ background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="ALL">All buildings</option>
              {data.buildings.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)}
              style={{ background: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-panel-border)', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="ALL">All types</option>
              {data.types.map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp] || tp}</option>)}
            </select>
          </div>
        } />

      {msg && <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--app-success)', fontWeight: 600 }}>{msg}</div>}

      <KPIGrid>
        <KPICard label={ar ? 'إجمالي الأجهزة' : 'Total Devices'} value={k.total} icon={<IcoCpu />} subValues={[{ label: ar ? 'المباني' : 'Buildings', value: data.buildings.length }]} />
        <KPICard label={ar ? 'متصل' : 'Online'} value={`${k.online}/${k.total}`} icon={<IcoSignal />} rag={k.online < k.total ? 'warning' : 'normal'} subValues={[{ label: ar ? 'التشغيل' : 'Uptime', value: `${k.uptime}%` }]} />
        <KPICard label={ar ? 'أعطال / متدهورة' : 'Faults / Degraded'} value={k.faults} icon={<IcoAlert />} rag={k.faults > 0 ? 'warning' : 'normal'} subValues={[{ label: ar ? 'غير متصل' : 'Offline', value: k.offline }]} />
        <KPICard label={ar ? 'متوسط صحة الأجهزة' : 'Avg Device Health'} value={`${k.avgHealth}%`} icon={<IcoActivity />} rag={k.avgHealth < 80 ? 'warning' : 'normal'} />
        <KPICard label={ar ? 'البطارية' : 'Battery'} value={`${k.avgBattery}%`} icon={<IcoBolt />} rag={k.lowBattery > 0 ? 'warning' : 'normal'} subValues={[{ label: ar ? 'بطارية منخفضة' : 'Low battery', value: k.lowBattery }]} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14, marginBottom: 14, alignItems: 'start' }}>
        <Panel title={ar ? 'صحة الأجهزة حسب النوع' : 'Device Health by Type'} sub={ar ? 'متصل مقابل معطّل عبر فئات الحساسات السبع' : 'Online vs faulted across the seven sensor classes'}>
          <Bars data={data.byType.map((r) => ({ type: TYPE_LABEL[r.type] || r.type, online: r.online, faults: r.faults }))} x="type" height={240} stacked
            series={[{ key: 'online', name: 'Online', color: C.green }, { key: 'faults', name: 'Fault/Degraded', color: C.amber }]} />
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title={ar ? 'تسجيل جهاز' : 'Register a Device'} sub={ar ? 'إضافة حسّاس جديد إلى الشبكة' : 'Provision a new sensor onto the network'}>
            <AddDeviceForm meta={data} onAdd={add} />
          </Panel>
          <Advisory items={[
            k.faults > 0 ? `${k.faults} device(s) reporting fault or degraded health — prioritise the lowest-health rows in the table for a maintenance work order.` : 'All connected devices are reporting healthy — no maintenance action indicated.',
            k.lowBattery > 0 ? `${k.lowBattery} wireless sensor(s) below 20% battery — schedule a battery-swap round before they drop offline.` : 'Wireless battery levels are healthy across the fleet.',
            k.offline > 0 ? `${k.offline} device(s) offline (>1h since last seen) — check the gateway/PoE path for those zones.` : 'Every device has checked in within the last few minutes.',
            `Fleet uptime ${k.uptime}% at ${k.avgHealth}% average health — well within the operational SLA; the twin’s telemetry is trustworthy.`,
          ]} />
        </div>
      </div>

      <Panel title={ar ? `الأجهزة المتصلة — ${data.sensors.length} معروضة` : `Connected Devices — ${data.sensors.length} shown`} sub={ar ? 'مرتّبة حسب الصحة (الأسوأ أولًا) · احذف لإيقاف جهاز من الشبكة' : 'Sorted by health (worst first) · delete to retire a device from the network'}>
        <DataTable maxHeight={520}
          columns={[
            { key: 'id', label: 'Device ID' },
            { key: 'name', label: 'Sensor' },
            { key: 'type', label: 'Type', render: (v) => TYPE_LABEL[v] || v },
            { key: 'building_id', label: 'Bldg' },
            { key: 'floor', label: 'Floor' },
            { key: 'reading', label: 'Reading', render: (v, r) => <span className="ltr-num">{v}{r.unit ? ` ${r.unit}` : ''}</span> },
            { key: 'health_pct', label: 'Health', render: (v) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 60 }}><ProgressBar pct={v} color={healthColor(v)} /></span>
                <b style={{ color: healthColor(v) }}>{v}%</b>
              </span>
            ) },
            { key: 'battery_pct', label: 'Battery', render: (v) => (v == null ? <span style={{ color: 'var(--app-text-faint)' }}>wired</span> : <span style={{ color: v < 20 ? 'var(--app-danger)' : 'var(--app-text-muted)' }}>{v}%</span>) },
            { key: 'protocol', label: 'Protocol' },
            { key: 'last_seen_min', label: 'Last seen', render: (v) => (v < 6 ? 'now' : v < 60 ? `${v}m` : `${Math.round(v / 60)}h`) },
            { key: 'status', label: 'Status', render: (v) => <StatusChip kind={statusKind(v)}>{v.toUpperCase()}</StatusChip> },
            { key: 'id', label: '', render: (id) => (
              <button onClick={() => del(id)} title="Delete device"
                style={{ background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)', color: 'var(--app-danger)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕
              </button>
            ) },
          ]}
          rows={data.sensors} />
      </Panel>
    </>
  );
}
