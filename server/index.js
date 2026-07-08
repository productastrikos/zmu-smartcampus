/**
 * ZMU Smart Digital Campus — API server.
 * Serves module-shaped JSON aggregated from the CSV datasets in /data
 * (the CSVs are the system-of-record for this POC; every endpoint below
 * maps to one dashboard module).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadTable } = require('./lib/csv');
const { generate, DATA_DIR } = require('./generate/generate-data');

if (!fs.existsSync(path.join(DATA_DIR, 'cadets.csv'))) {
  console.log('No datasets found — generating...');
  generate();
}

const TABLES = [
  'buildings', 'cadets', 'wearables_daily', 'hpo_domains', 'bms_hourly', 'bms_assets',
  'energy_daily', 'hrms_departments', 'hrms_recruitment', 'finance_budget', 'finance_cashflow',
  'procurement_pos', 'sis_programs', 'lms_daily', 'sis_gpa_terms', 'labs', 'library',
  'room_utilization', 'physical_security', 'siem_events', 'wms_transactions', 'parking',
  'integration_flows', 'integration_hourly', 'master_data', 'icds', 'dr_status', 'alerts',
  'ai_recommendations', 'finance_aging',
];
const db = {};
for (const t of TABLES) db[t] = loadTable(DATA_DIR, t);
console.log(`Loaded ${TABLES.length} CSV tables from /data`);

const app = express();
const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + (f ? f(x) : x), 0) / arr.length : 0);
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
const round1 = (n) => Math.round(n * 10) / 10;

/* latest BMS row per building */
function latestBms() {
  const m = {};
  for (const r of db.bms_hourly) if (!m[r.building_id] || r.ts > m[r.building_id].ts) m[r.building_id] = r;
  return m;
}
function bmsLastHours(n) {
  const cutoff = new Date(Date.now() - n * 3600 * 1000).toISOString();
  return db.bms_hourly.filter((r) => r.ts >= cutoff);
}

/* ── overview / command center ───────────────────────────── */
app.get('/api/overview', (req, res) => {
  const cadets = db.cadets;
  const latest = Object.values(latestBms());
  const last24 = bmsLastHours(24), prev24 = db.bms_hourly.filter((r) => {
    const t = new Date(r.ts).getTime(), now = Date.now();
    return t < now - 24 * 3600e3 && t >= now - 48 * 3600e3;
  });
  const kwh24 = sum(last24, (r) => r.kwh), kwhPrev = sum(prev24, (r) => r.kwh);
  const lastDay = db.wearables_daily.filter((w) => w.date === db.wearables_daily[db.wearables_daily.length - 1].date);
  const openAlerts = db.alerts.filter((a) => a.status !== 'resolved');
  const flows = db.integration_flows;

  // 24h occupancy vs energy (cross-module)
  const byHour = {};
  for (const r of last24) {
    const h = r.ts.slice(0, 13);
    (byHour[h] ||= { occ: [], kwh: 0 }).occ.push(r.occupancy_pct);
    byHour[h].kwh += r.kwh;
  }
  const occupancyEnergy = Object.entries(byHour).sort(([a], [b]) => a.localeCompare(b))
    .map(([h, v]) => ({ hour: h.slice(11) + ':00', occupancy: round1(avg(v.occ)), kwh: Math.round(v.kwh) }));

  const bySquad = {};
  for (const c of cadets) {
    const s = (bySquad[c.squadron] ||= { composite: [], fitness: [], gpa: [] });
    s.composite.push(c.composite_score); s.fitness.push(c.fitness_score); s.gpa.push(c.gpa);
  }
  const readinessDay = {};
  for (const w of lastDay) readinessDay[w.cadet_id] = w.readiness_score;

  res.json({
    asOf: new Date().toISOString(),
    kpis: {
      cadetsEnrolled: cadets.length,
      compositeReadiness: round1(avg(cadets, (c) => c.composite_score)),
      wearableReadiness: round1(avg(lastDay, (w) => w.readiness_score)),
      occupancyNow: round1(avg(latest, (r) => r.occupancy_pct)),
      energyTodayKwh: Math.round(kwh24),
      energyDeltaPct: kwhPrev ? round1(((kwh24 - kwhPrev) / kwhPrev) * 100) : 0,
      criticalAlerts: openAlerts.filter((a) => ['critical', 'high'].includes(a.severity)).length,
      openAlerts: openAlerts.length,
      integrationHealth: Math.round((flows.filter((f) => f.status === 'healthy').length / flows.length) * 100),
      budgetUtilization: Math.round(avg(db.finance_budget, (b) => b.utilization_pct)),
      attendanceAvg: round1(avg(cadets, (c) => c.attendance_pct)),
      systemsOnline: 34, systemsTotal: 35,
    },
    occupancyEnergy,
    readinessBySquadron: Object.entries(bySquad).map(([squadron, v]) => ({
      squadron,
      composite: round1(avg(v.composite)),
      fitness: round1(avg(v.fitness)),
      academic: round1(avg(v.gpa) * 25),
    })),
    domainStatus: [
      { key: 'academic', link: '/academic', name: 'Academics & Learning', status: 'healthy', metric: `${round1(avg(cadets, (c) => c.gpa))} avg GPA`, sub: `${cadets.filter((c) => c.risk_level === 'high').length} at-risk cadets` },
      { key: 'readiness', link: '/readiness', name: 'Readiness & Performance', status: 'warning', metric: `${round1(avg(lastDay, (w) => w.readiness_score))} readiness`, sub: `${lastDay.filter((w) => w.acwr > 1.4).length} high injury risk` },
      { key: 'enterprise', link: '/enterprise', name: 'Enterprise & Finance', status: 'healthy', metric: `${Math.round(avg(db.finance_budget, (b) => b.utilization_pct))}% budget used`, sub: `${db.procurement_pos.filter((p) => p.status === 'Pending Approval').length} POs pending` },
      { key: 'campus', link: '/campus-ops', name: 'Smart Campus Operations', status: 'critical', metric: `${latest.reduce((s, r) => s + r.alarm_count, 0)} active BMS alarms`, sub: 'AHU-02 fault — Academic Block B' },
    ],
    alerts: [...db.alerts].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8),
    aiRecommendations: db.ai_recommendations,
  });
});

/* ── domain A: learning & academic ───────────────────────── */
app.get('/api/academic', (req, res) => {
  const cadets = db.cadets;
  const lms = db.lms_daily;
  const lmsToday = lms[lms.length - 1];
  res.json({
    kpis: {
      enrolled: cadets.length,
      avgGpa: +avg(cadets, (c) => c.gpa).toFixed(2),
      attendance: round1(avg(cadets, (c) => c.attendance_pct)),
      atRisk: cadets.filter((c) => c.risk_level === 'high').length,
      lmsActivePct: Math.round((lmsToday.active_users / 2380) * 100),
      aiQueriesToday: lmsToday.ai_assistant_queries,
      labUtilization: Math.round(avg(db.labs, (l) => l.utilization_pct)),
      libraryLoans: db.library.find((r) => r.metric === 'Loans today')?.value ?? 0,
    },
    gpaTerms: db.sis_gpa_terms,
    lms30d: lms.map((r) => ({ date: r.date.slice(5), active: r.active_users, aiQueries: r.ai_assistant_queries, submissions: r.submissions })),
    programs: db.sis_programs,
    atRiskByProgram: db.sis_programs.map((p) => ({ program: p.program.split(' ')[0] + '…', full: p.program, atRisk: p.at_risk, enrolled: p.enrolled })),
    labs: db.labs,
    library: db.library,
    meritTop: [...cadets].sort((a, b) => a.order_of_merit - b.order_of_merit).slice(0, 8),
  });
});

/* ── domain B: military readiness / HPO ──────────────────── */
app.get('/api/readiness', (req, res) => {
  const wear = db.wearables_daily;
  const dates = [...new Set(wear.map((w) => w.date))].sort();
  const lastDate = dates[dates.length - 1];
  const today = wear.filter((w) => w.date === lastDate);
  const cadets = db.cadets;
  const cadetById = Object.fromEntries(cadets.map((c) => [c.cadet_id, c]));

  const trend = dates.map((d) => {
    const rows = wear.filter((w) => w.date === d);
    return {
      date: d.slice(5),
      readiness: round1(avg(rows, (r) => r.readiness_score)),
      hrv: round1(avg(rows, (r) => r.hrv_ms)),
      sleep: round1(avg(rows, (r) => r.sleep_hours)),
    };
  });

  const domains = {};
  for (const r of db.hpo_domains) (domains[r.domain] ||= []).push(r.score);
  const radar = Object.entries(domains).map(([domain, scores]) => ({ domain, score: round1(avg(scores)) }));

  const highRisk = today.filter((w) => w.acwr > 1.4).map((w) => ({
    ...w, name: cadetById[w.cadet_id]?.name, squadron: cadetById[w.cadet_id]?.squadron,
  })).slice(0, 12);

  const bySquad = {};
  for (const w of today) {
    const sq = cadetById[w.cadet_id]?.squadron;
    (bySquad[sq] ||= []).push(w);
  }

  res.json({
    kpis: {
      avgReadiness: round1(avg(today, (w) => w.readiness_score)),
      deviceSyncRate: round1((cadets.filter((c) => c.device_synced_hrs_ago <= 12).length / cadets.length) * 100),
      avgSleep: round1(avg(today, (w) => w.sleep_hours)),
      avgHrv: Math.round(avg(today, (w) => w.hrv_ms)),
      highInjuryRisk: today.filter((w) => w.acwr > 1.4).length,
      avgVo2: round1(avg(today, (w) => w.vo2max)),
      avgBodyBattery: Math.round(avg(today, (w) => w.body_battery)),
      avgStress: Math.round(avg(today, (w) => w.stress_avg)),
    },
    trend,
    radar,
    squadrons: Object.entries(bySquad).map(([squadron, rows]) => ({
      squadron,
      readiness: round1(avg(rows, (r) => r.readiness_score)),
      sleep: round1(avg(rows, (r) => r.sleep_hours)),
      hrv: Math.round(avg(rows, (r) => r.hrv_ms)),
      load: Math.round(avg(rows, (r) => r.training_load)),
    })),
    highRisk,
    cadets: cadets.map((c) => ({
      cadet_id: c.cadet_id, name: c.name, squadron: c.squadron, year: c.year,
      composite: c.composite_score, merit: c.order_of_merit, fitness: c.fitness_score,
      device: c.garmin_device, syncedHrs: c.device_synced_hrs_ago, risk: c.risk_level,
      readiness: today.find((w) => w.cadet_id === c.cadet_id)?.readiness_score ?? null,
    })).sort((a, b) => a.merit - b.merit),
  });
});

/* human digital twin — individual cadet drill-down */
app.get('/api/readiness/cadet/:id', (req, res) => {
  const c = db.cadets.find((x) => x.cadet_id === req.params.id);
  if (!c) return res.status(404).json({ error: 'cadet not found' });
  const series = db.wearables_daily.filter((w) => w.cadet_id === c.cadet_id)
    .sort((a, b) => a.date.localeCompare(b.date));
  res.json({ cadet: c, series });
});

/* ── domain C: enterprise (ERP / HRMS) ───────────────────── */
app.get('/api/enterprise', (req, res) => {
  const fin = db.finance_budget;
  const pos = db.procurement_pos;
  const hr = db.hrms_departments;
  const funnelOrder = ['Draft', 'Pending Approval', 'Approved', 'Issued', 'Partially Delivered', 'Delivered', 'Invoiced', 'Paid'];
  const funnel = funnelOrder.map((s) => ({
    status: s,
    count: pos.filter((p) => p.status === s).length,
    value: Math.round(sum(pos.filter((p) => p.status === s), (p) => p.value_kaed)),
  }));
  res.json({
    kpis: {
      budgetTotal: round1(sum(fin, (f) => f.budget_maed)),
      budgetUsedPct: Math.round((sum(fin, (f) => f.actual_maed) / sum(fin, (f) => f.budget_maed)) * 100),
      openPoValue: round1(sum(pos.filter((p) => !['Paid', 'Delivered', 'Invoiced'].includes(p.status)), (p) => p.value_kaed) / 1000),
      posPendingApproval: pos.filter((p) => p.status === 'Pending Approval').length,
      headcount: sum(hr, (d) => d.headcount),
      establishment: sum(hr, (d) => d.establishment),
      vacancies: sum(hr, (d) => d.vacancies),
      attrition: round1(avg(hr, (d) => d.attrition_pct)),
      outsourced: sum(hr, (d) => d.outsourced),
      roomUtilization: Math.round(avg(db.room_utilization, (r) => r.utilization_pct)),
    },
    budget: fin,
    cashflow: db.finance_cashflow,
    procurementFunnel: funnel,
    recentPos: [...pos].sort((a, b) => b.value_kaed - a.value_kaed).slice(0, 10),
    departments: hr,
    recruitment: db.hrms_recruitment,
    rooms: db.room_utilization,
    aging: db.finance_aging,
    // top vendor spend — aggregated from the PO ledger
    vendorSpend: Object.entries(pos.reduce((m, p) => { m[p.supplier] = (m[p.supplier] || 0) + p.value_kaed; return m; }, {}))
      .map(([supplier, value]) => ({ supplier, value_kaed: Math.round(value) }))
      .sort((a, b) => b.value_kaed - a.value_kaed).slice(0, 7),
    // approvals waiting — POs pending > 5 days, most-aged first
    approvals: pos.filter((p) => p.status === 'Pending Approval')
      .sort((a, b) => b.days_open - a.days_open)
      .map((p) => ({ ref: p.po_id, supplier: p.supplier, value_kaed: p.value_kaed, days: p.days_open, department: p.department }))
      .slice(0, 8),
  });
});

/* ── domain D: campus & smart ops ────────────────────────── */
app.get('/api/campus', (req, res) => {
  const latest = latestBms();
  const latestRows = Object.values(latest);
  const last24 = bmsLastHours(24);
  const sec = db.physical_security;
  const wms = db.wms_transactions;
  const buildings = db.buildings;

  const byHourZone = {};
  for (const r of last24) {
    const h = r.ts.slice(11, 13) + ':00';
    (byHourZone[h] ||= { hour: h });
    byHourZone[h][r.building_id] = (byHourZone[h][r.building_id] || 0) + r.kwh;
  }

  const comfort = buildings.map((b) => {
    const r = latest[b.building_id] || {};
    const tempDev = Math.abs(r.temp_c - 22.5);
    return {
      building_id: b.building_id, name: b.name,
      temp: r.temp_c, co2: r.co2_ppm, occupancy: r.occupancy_pct, humidity: r.humidity_pct,
      alarms: r.alarm_count,
      status: r.alarm_count > 0 || tempDev > 2 ? 'critical' : r.co2_ppm > 1000 || tempDev > 1.2 ? 'warning' : 'normal',
    };
  });

  res.json({
    kpis: {
      buildingsOnline: buildings.length,
      activeAlarms: sum(latestRows, (r) => r.alarm_count),
      avgTemp: round1(avg(latestRows, (r) => r.temp_c)),
      avgCo2: Math.round(avg(latestRows, (r) => r.co2_ppm)),
      energy24h: Math.round(sum(last24, (r) => r.kwh)),
      water24h: Math.round(sum(last24, (r) => r.water_l) / 1000),
      camerasOnline: sum(sec, (s) => s.cameras_online),
      camerasTotal: sum(sec, (s) => s.cameras_total),
      accessEvents: sum(sec, (s) => s.access_events_24h),
      weaponsOut: wms.filter((w) => w.status === 'out' || w.status === 'overdue').length,
      weaponsOverdue: wms.filter((w) => w.status === 'overdue').length,
      parkingOccupancy: Math.round((sum(db.parking, (p) => p.occupied) / sum(db.parking, (p) => p.capacity)) * 100),
      assetsInFault: db.bms_assets.filter((a) => a.status === 'fault').length,
      assetsDegraded: db.bms_assets.filter((a) => a.status === 'degraded').length,
    },
    energyByZone: Object.values(byHourZone),
    zoneKeys: buildings.map((b) => b.building_id),
    comfort,
    assets: db.bms_assets.filter((a) => a.status !== 'running').sort((a, b) => a.health_pct - b.health_pct).slice(0, 10),
    security: sec.map((s) => ({ ...s, name: buildings.find((b) => b.building_id === s.building_id)?.name })),
    wmsRecent: [...wms].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10),
    wmsOverdue: wms.filter((w) => w.status === 'overdue'),
    parking: db.parking,
    fire: buildings.map((b) => ({ building_id: b.building_id, name: b.name, status: 'normal', lastTest: '2026-06-14' })),
  });
});

/* ── digital twin ────────────────────────────────────────── */
app.get('/api/twin', (req, res) => {
  const latest = latestBms();
  const alarmAssets = db.bms_assets.filter((a) => a.status === 'fault' || a.status === 'degraded');
  res.json({
    buildings: db.buildings.map((b) => ({
      ...b,
      live: latest[b.building_id] || null,
      assetIssues: alarmAssets.filter((a) => a.building_id === b.building_id).length,
      camerasOffline: (() => {
        const s = db.physical_security.find((x) => x.building_id === b.building_id);
        return s ? s.cameras_total - s.cameras_online : 0;
      })(),
    })),
  });
});

app.get('/api/twin/building/:id', (req, res) => {
  const b = db.buildings.find((x) => x.building_id === req.params.id);
  if (!b) return res.status(404).json({ error: 'building not found' });
  const series = db.bms_hourly.filter((r) => r.building_id === b.building_id)
    .sort((a, b2) => a.ts.localeCompare(b2.ts)).slice(-24)
    .map((r) => ({ hour: r.ts.slice(11, 16), temp: r.temp_c, co2: r.co2_ppm, occupancy: r.occupancy_pct, kwh: r.kwh }));
  res.json({
    building: b,
    series,
    assets: db.bms_assets.filter((a) => a.building_id === b.building_id),
    security: db.physical_security.find((s) => s.building_id === b.building_id) || null,
    energy30d: db.energy_daily.filter((e) => e.building_id === b.building_id)
      .map((e) => ({ date: e.date.slice(5), kwh: e.kwh, water: e.water_m3 })),
  });
});

/* ── security operations (split-SIEM) ────────────────────── */
app.get('/api/security', (req, res) => {
  const ev = db.siem_events;
  const cutoff24 = new Date(Date.now() - 24 * 3600e3).toISOString();
  const last24 = ev.filter((e) => e.ts >= cutoff24);
  const sevOrder = ['critical', 'high', 'medium', 'low', 'info'];

  const byHour = {};
  for (const e of last24) {
    const h = e.ts.slice(11, 13) + ':00';
    const o = (byHour[e.ts.slice(0, 13)] ||= { hour: h, critical: 0, high: 0, medium: 0, low: 0, info: 0 });
    o[e.severity]++;
  }
  const catCount = {};
  for (const e of last24) catCount[e.category] = (catCount[e.category] || 0) + 1;

  const netCount = {};
  for (const e of last24) {
    const n = (netCount[e.network] ||= { events: 0, high: 0 });
    n.events++;
    if (['critical', 'high'].includes(e.severity)) n.high++;
  }

  res.json({
    kpis: {
      events24h: last24.length,
      criticalOpen: ev.filter((e) => e.severity === 'critical' && e.status !== 'resolved').length,
      authFailures24h: last24.filter((e) => e.category === 'auth_failure').length,
      pamSessions24h: last24.filter((e) => e.category === 'pam_session').length,
      otAnomalies24h: last24.filter((e) => e.category === 'ot_anomaly').length,
      syslogEps: db.integration_hourly[db.integration_hourly.length - 1]?.syslog_eps ?? 0,
      mttrMin: 42,
      aecertReady: 'Ready',
    },
    timeline: Object.entries(byHour).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
    categories: Object.entries(catCount).map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    networks: ['RED', 'YELLOW', 'ORANGE', 'GREY'].map((n) => ({
      network: n,
      label: { RED: 'Cadet / Residential', YELLOW: 'Military Enterprise', ORANGE: 'Physical Security / OT', GREY: 'Virtual Learning' }[n],
      ...(netCount[n] || { events: 0, high: 0 }),
    })),
    feed: [...ev].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 40),
    openIncidents: ev.filter((e) => e.status !== 'resolved' && sevOrder.indexOf(e.severity) <= 1)
      .sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8),
  });
});

/* ── integration & data platform ─────────────────────────── */
app.get('/api/integration', (req, res) => {
  const flows = db.integration_flows;
  res.json({
    kpis: {
      flowsHealthy: flows.filter((f) => f.status === 'healthy').length,
      flowsTotal: flows.length,
      msgs24h: sum(flows, (f) => f.msgs_24h),
      avgLatency: Math.round(avg(flows.filter((f) => f.transport.includes('API')), (f) => f.latency_ms)),
      avgErrorRate: round1(avg(flows, (f) => f.error_rate_pct)),
      cadetIdMatch: db.master_data.find((m) => m.entity.startsWith('Cadet'))?.match_rate_pct ?? 0,
      mftFiles24h: sum(db.integration_hourly, (h) => h.mft_files),
      icdsApproved: db.icds.filter((i) => i.status === 'Approved').length,
      icdsTotal: db.icds.length,
    },
    flows,
    hourly: db.integration_hourly.map((h) => ({ ...h, hour: h.ts.slice(11, 16) })),
    masterData: db.master_data,
    icds: db.icds,
    dr: db.dr_status,
  });
});

/* ── alerts (global slide-in panel) ──────────────────────── */
app.get('/api/alerts', (req, res) => {
  res.json({ alerts: [...db.alerts].sort((a, b) => b.ts.localeCompare(a.ts)) });
});

app.get('/api/health', (req, res) => res.json({ ok: true, tables: TABLES.length }));

const PORT = process.env.API_PORT || 5051;
const HOST = process.env.API_HOST || '0.0.0.0';
const { networkInterfaces } = require('os');
const getLocalIP = () => {
  for (const [, addrs] of Object.entries(networkInterfaces())) {
    const addr = addrs.find(a => a.family === 'IPv4' && !a.internal);
    if (addr) return addr.address;
  }
  return 'localhost';
};
const ip = getLocalIP();
app.listen(PORT, HOST, () => {
  console.log(`ZMU API listening on http://${ip}:${PORT}`);
  console.log(`  (also available at http://localhost:${PORT})`);
});
