import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoBuilding, IcoBolt, IcoThermometer, IcoCamera, IcoTarget, IcoCar, IcoDroplet, IcoWrench } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable } from '../components/ui';
import { Bars, TrendChart, ZONE_COLORS, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';
import { Link } from 'react-router-dom';

export default function CampusOps() {
  const { data, error } = useApi('/campus');
  const [detail, setDetail] = useState(null);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading campus operations…" />;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Smart Campus Operations"
        subtitle="BMS supervisory layer · EMS analytics · CCTV & access control · WMS · IoT across 9 zones — vendor-neutral overlay on base-build systems"
        right={<Link to="/digital-twin" style={{ textDecoration: 'none' }}><StatusChip kind="accent">OPEN DIGITAL TWIN →</StatusChip></Link>}
      />

      <KPIGrid min={190}>
        <KPICard label="BMS Alarms Active" value={k.activeAlarms} icon={<IcoBuilding />} rag={k.activeAlarms > 0 ? 'critical' : 'normal'}
          subValues={[{ label: 'Assets in fault', value: k.assetsInFault }, { label: 'Degraded', value: k.assetsDegraded }]}
          onClick={() => setDetail({
            title: 'BMS Alarms Active', subtitle: `${k.activeAlarms} active alarms · ${k.assetsInFault} assets in fault`, source: 'Building Management System — Supervisory Layer',
            stats: [
              { label: 'Active alarms', value: k.activeAlarms, tone: k.activeAlarms > 0 ? 'down' : 'up' },
              { label: 'In fault', value: k.assetsInFault, sub: 'MEP assets' },
              { label: 'Degraded', value: k.assetsDegraded, tone: 'warn' },
            ],
            content: (
              <DataTable maxHeight={280}
                columns={[
                  { key: 'asset_id', label: 'Asset' },
                  { key: 'building_id', label: 'Zone' },
                  { key: 'health_pct', label: 'Health', align: 'right', render: (v) => <b style={{ color: v < 60 ? 'var(--app-danger)' : 'var(--app-warning)' }}>{v}%</b> },
                  { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={data.assets} />
            ),
          })} />
        <KPICard label="Avg Zone Temp" value={k.avgTemp} unit="°C" icon={<IcoThermometer />} rag={Math.abs(k.avgTemp - 22.5) > 1.5 ? 'warning' : 'normal'}
          subValues={[{ label: 'Setpoint', value: '22.5 °C' }, { label: 'Avg CO₂', value: `${k.avgCo2} ppm` }]}
          onClick={() => setDetail({
            title: 'Avg Zone Temp', subtitle: `${k.avgTemp}°C average vs 22.5°C setpoint · avg CO₂ ${k.avgCo2} ppm`, source: 'BMS — Environmental Controls',
            content: (
              <DataTable maxHeight={280}
                columns={[
                  { key: 'building_id', label: 'Zone' },
                  { key: 'temp', label: '°C', align: 'right' },
                  { key: 'co2', label: 'CO₂', align: 'right' },
                  { key: 'status', label: 'State', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={data.comfort} />
            ),
          })} />
        <KPICard label="Energy — 24h" value={fmt.int(k.energy24h)} unit="kWh" icon={<IcoBolt />} rag="normal"
          subValues={[{ label: 'Water', value: `${k.water24h} m³` }]}
          onClick={() => setDetail({
            title: 'Energy — 24h', subtitle: `${fmt.int(k.energy24h)} kWh · ${k.water24h} m³ water`, source: 'BMS / EMS Telemetry',
            stats: [
              { label: 'Energy 24h', value: fmt.int(k.energy24h), sub: 'kWh' },
              { label: 'Water 24h', value: k.water24h, sub: 'm³' },
              { label: 'Avg temp', value: `${k.avgTemp}°C` },
            ],
            content: <TrendChart data={data.energyByZone} x="hour" height={240} type="area" stacked
              series={data.zoneKeys.map((z, i) => ({ key: z, name: z, color: ZONE_COLORS[i % ZONE_COLORS.length] }))} />,
          })} />
        <KPICard label="CCTV Online" value={`${k.camerasOnline}/${k.camerasTotal}`} icon={<IcoCamera />}
          rag={k.camerasTotal - k.camerasOnline > 5 ? 'warning' : 'normal'}
          subValues={[{ label: 'Access events 24h', value: fmt.int(k.accessEvents) }]}
          onClick={() => setDetail({
            title: 'CCTV Online', subtitle: `${k.camerasOnline}/${k.camerasTotal} cameras online · ${fmt.int(k.accessEvents)} access events 24h`, source: 'VMS / Access Control — ORANGE Network',
            stats: [
              { label: 'Cameras online', value: `${k.camerasOnline}/${k.camerasTotal}`, tone: k.camerasTotal - k.camerasOnline > 5 ? 'warn' : 'up' },
              { label: 'Access events', value: fmt.int(k.accessEvents), sub: '24h' },
              { label: 'Weapons out', value: k.weaponsOut, sub: `${k.weaponsOverdue} overdue` },
            ],
            content: (
              <DataTable maxHeight={280}
                columns={[
                  { key: 'building_id', label: 'Zone' },
                  { key: 'cameras_online', label: 'CCTV', render: (v, r) => `${v}/${r.cameras_total}` },
                  { key: 'tailgating_alerts_24h', label: 'Tailgate', align: 'right' },
                ]}
                rows={data.security} />
            ),
          })} />
        <KPICard label="Weapons Issued Out" value={k.weaponsOut} icon={<IcoTarget />} rag={k.weaponsOverdue > 0 ? 'critical' : 'normal'}
          subValues={[{ label: 'Overdue return', value: k.weaponsOverdue }]}
          onClick={() => setDetail({
            title: 'Weapons Issued Out', subtitle: `${k.weaponsOut} out · ${k.weaponsOverdue} overdue return`, source: 'Weapon Management System — Armoury Z09',
            content: (
              <DataTable maxHeight={280}
                columns={[
                  { key: 'txn_id', label: 'Txn' },
                  { key: 'cadet_id', label: 'Cadet' },
                  { key: 'weapon_type', label: 'Type' },
                  { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
                ]}
                rows={[...data.wmsOverdue, ...data.wmsRecent].slice(0, 12)} />
            ),
          })} />
        <KPICard label="Parking Occupancy" value={`${k.parkingOccupancy}%`} icon={<IcoCar />} rag="normal"
          subValues={[{ label: 'ANPR + EV charging', value: 'live' }]}
          onClick={() => setDetail({
            title: 'Parking Occupancy', subtitle: `${k.parkingOccupancy}% campus-wide occupancy`, source: 'Parking Management — ANPR',
            content: (
              <DataTable
                columns={[
                  { key: 'zone', label: 'Zone' },
                  { key: 'occupied', label: 'Occupied', render: (v, r) => `${v}/${r.capacity}` },
                  { key: 'ev_in_use', label: 'EV', render: (v, r) => `${v}/${r.ev_chargers}` },
                ]}
                rows={data.parking} />
            ),
          })} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Energy by Zone — 24h" sub="BMS telemetry via one-way data diode · stacked kWh per building">
          <TrendChart data={data.energyByZone} x="hour" height={250} type="area" stacked
            series={data.zoneKeys.map((z, i) => ({ key: z, name: z, color: ZONE_COLORS[i % ZONE_COLORS.length] }))} />
        </Panel>

        <Panel title="Comfort & IAQ Matrix" sub="Latest telemetry per building — RAG on setpoint deviation">
          <DataTable maxHeight={250}
            columns={[
              { key: 'building_id', label: 'Zone' },
              { key: 'temp', label: '°C', align: 'right', render: (v, r) => <span style={{ color: r.status === 'critical' ? 'var(--app-danger)' : 'var(--app-text-muted)', fontWeight: r.status === 'critical' ? 700 : 400 }}>{v}</span> },
              { key: 'co2', label: 'CO₂', align: 'right', render: (v) => <span style={{ color: v > 1000 ? 'var(--app-warning)' : 'var(--app-text-muted)' }}>{v}</span> },
              { key: 'occupancy', label: 'Occ %', align: 'right' },
              { key: 'status', label: 'State', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={data.comfort} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Asset Watchlist" sub="MEP assets in fault / degraded state — CMMS work orders auto-raised"
          right={<StatusChip kind="danger">{k.assetsInFault} FAULT</StatusChip>}>
          <DataTable maxHeight={240}
            columns={[
              { key: 'asset_id', label: 'Asset' },
              { key: 'building_id', label: 'Zone' },
              { key: 'type', label: 'Type' },
              { key: 'health_pct', label: 'Health', align: 'right', render: (v) => <b style={{ color: v < 60 ? 'var(--app-danger)' : 'var(--app-warning)' }}>{v}%</b> },
              { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
              { key: 'next_maintenance', label: 'Next PM' },
            ]}
            rows={data.assets} />
        </Panel>

        <Panel title="Physical Security by Building" sub="ORANGE network — VMS, access control, intrusion">
          <DataTable maxHeight={240}
            columns={[
              { key: 'building_id', label: 'Zone' },
              { key: 'cameras_online', label: 'CCTV', render: (v, r) => <span style={{ color: v < r.cameras_total ? 'var(--app-warning)' : 'var(--app-text-muted)' }}>{v}/{r.cameras_total}</span> },
              { key: 'access_events_24h', label: 'Access 24h', align: 'right', render: (v) => v.toLocaleString() },
              { key: 'denied_access_24h', label: 'Denied', align: 'right' },
              { key: 'tailgating_alerts_24h', label: 'Tailgate', align: 'right', render: (v) => v > 0 ? <b style={{ color: 'var(--app-danger)' }}>{v}</b> : '0' },
            ]}
            rows={data.security} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14 }}>
        <Panel title="Weapon Management System — Recent Transactions" sub="Issuance / return with cadet ID binding · armoury Z09"
          right={k.weaponsOverdue > 0 ? <StatusChip kind="danger">{k.weaponsOverdue} OVERDUE</StatusChip> : <StatusChip kind="success">RECONCILED</StatusChip>}>
          <DataTable maxHeight={260}
            columns={[
              { key: 'txn_id', label: 'Txn' },
              { key: 'cadet_id', label: 'Cadet' },
              { key: 'squadron', label: 'Sqn' },
              { key: 'weapon_id', label: 'Weapon' },
              { key: 'weapon_type', label: 'Type' },
              { key: 'status', label: 'Status', render: (v) => <StatusChip kind={sevChip(v)}>{v.toUpperCase()}</StatusChip> },
            ]}
            rows={[...data.wmsOverdue, ...data.wmsRecent].slice(0, 12)} />
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Parking & Mobility" sub="ANPR barriers · EV charging">
            <DataTable
              columns={[
                { key: 'zone', label: 'Zone' },
                { key: 'occupied', label: 'Occupied', render: (v, r) => `${v}/${r.capacity}` },
                { key: 'ev_in_use', label: 'EV', render: (v, r) => `${v}/${r.ev_chargers}` },
              ]}
              rows={data.parking} />
          </Panel>
          <Panel title="Fire & Life Safety" sub="Base-build FDAS — supervisory monitoring only"
            right={<StatusChip kind="success">ALL ZONES NORMAL</StatusChip>}>
            <div style={{ fontSize: 11.5, color: 'var(--app-text-faint)', lineHeight: 1.6 }}>
              12/12 fire panels online · last full-campus test 14 Jun 2026 · AV emergency override armed (Dante/AES67) ·
              Civil Defence certification current. Safety signals subscribed read-only by the supervisory layer.
            </div>
          </Panel>
        </div>
      </div>

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.subtitle} source={detail?.source} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
