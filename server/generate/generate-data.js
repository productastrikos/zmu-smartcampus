/**
 * ZMU Smart Digital Campus — synthetic dataset generator.
 *
 * Generates every CSV in /data following the RFP data-flow architecture:
 *  - Single immutable Cadet ID joins SIS, LMS, HPO/wearables, WMS and attendance.
 *  - Campus OT (BMS/IoT) telemetry flows one-way via data diode (flow 5).
 *  - All platforms forward security events to the split-SIEM (flow 7).
 *  - Replication/backup posture per Resilience & Continuity (flow 8).
 *
 * Deterministic (seeded RNG) so regeneration is stable; timestamps are
 * anchored to generation time so the demo always looks live.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

/* ── seeded RNG (mulberry32) ─────────────────────────────── */
let _seed = 0x5eed2026;
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const rf = (min, max, dp = 1) => +(rnd() * (max - min) + min).toFixed(dp);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ── time anchors ────────────────────────────────────────── */
const NOW = new Date();
NOW.setMinutes(0, 0, 0);
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const hoursAgo = (h) => new Date(NOW.getTime() - h * HOUR);
const daysAgo = (d) => new Date(NOW.getTime() - d * DAY);
const iso = (dt) => dt.toISOString();
const isoDay = (dt) => dt.toISOString().slice(0, 10);

/* ── csv writer ──────────────────────────────────────────── */
function writeCSV(name, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  fs.writeFileSync(path.join(DATA_DIR, name), lines.join('\n'), 'utf8');
  console.log(`  ${name}  (${rows.length} rows)`);
}

function generate() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('Generating ZMU demo datasets →', DATA_DIR);

  /* ════════════ 1. BUILDINGS (campus digital twin geometry) ════════════ */
  const buildings = [
    { building_id: 'Z01', name: 'Command HQ & Admin',        type: 'admin',        floors: 4, area_m2: 9800,  x: 60,  y: 60,  w: 180, h: 110 },
    { building_id: 'Z02', name: 'Academic Block A',          type: 'academic',     floors: 3, area_m2: 12400, x: 300, y: 60,  w: 170, h: 100 },
    { building_id: 'Z03', name: 'Academic Block B',          type: 'academic',     floors: 3, area_m2: 11200, x: 300, y: 200, w: 170, h: 90  },
    { building_id: 'Z04', name: 'Applied Labs Centre',       type: 'labs',         floors: 2, area_m2: 8600,  x: 60,  y: 200, w: 180, h: 90  },
    { building_id: 'Z05', name: 'Central Library',           type: 'library',      floors: 3, area_m2: 7400,  x: 530, y: 60,  w: 140, h: 100 },
    { building_id: 'Z06', name: 'Cadet Accommodation North', type: 'accommodation',floors: 5, area_m2: 15800, x: 60,  y: 380, w: 200, h: 100 },
    { building_id: 'Z07', name: 'Cadet Accommodation South', type: 'accommodation',floors: 5, area_m2: 15800, x: 60,  y: 510, w: 200, h: 90  },
    { building_id: 'Z08', name: 'HPO & Sports Complex',      type: 'sports',       floors: 2, area_m2: 13600, x: 320, y: 380, w: 200, h: 140 },
    { building_id: 'Z09', name: 'Armoury & WMS',             type: 'armoury',      floors: 1, area_m2: 2400,  x: 580, y: 380, w: 120, h: 90  },
    { building_id: 'Z10', name: 'Dining Facility',           type: 'dining',       floors: 2, area_m2: 5200,  x: 530, y: 200, w: 140, h: 90  },
    { building_id: 'Z11', name: 'Auditorium & Parade Hall',  type: 'assembly',     floors: 2, area_m2: 6800,  x: 710, y: 60,  w: 120, h: 100 },
    { building_id: 'Z12', name: 'Central Plant & Data Centre', type: 'plant',      floors: 2, area_m2: 4600,  x: 860, y: 60,  w: 90,  h: 230 },
  ];
  writeCSV('buildings.csv',
    ['building_id', 'name', 'type', 'floors', 'area_m2', 'x', 'y', 'w', 'h'],
    buildings);

  /* ════════════ 2. CADETS (single immutable Cadet ID) ════════════ */
  const firstNames = ['Ahmed', 'Mohammed', 'Khalid', 'Saif', 'Rashid', 'Hamdan', 'Omar', 'Sultan', 'Majid', 'Salem', 'Hamad', 'Abdulla', 'Mansoor', 'Tariq', 'Yousef', 'Ali', 'Ibrahim', 'Khalifa', 'Saeed', 'Nasser', 'Faisal', 'Obaid', 'Marwan', 'Juma', 'Suhail', 'Butti', 'Theyab', 'Zayed'];
  const lastNames = ['Al Mazrouei', 'Al Shamsi', 'Al Dhaheri', 'Al Ameri', 'Al Kaabi', 'Al Mansoori', 'Al Hammadi', 'Al Suwaidi', 'Al Marri', 'Al Blooshi', 'Al Zaabi', 'Al Naqbi', 'Al Ketbi', 'Al Falasi', 'Al Romaithi', 'Al Muhairi', 'Al Qubaisi', 'Al Shehhi'];
  const squadrons = ['Falcon', 'Oryx', 'Ghaf', 'Saluki', 'Fursan', 'Wadeema'];
  const programs = [
    { program: 'Defence & Security Studies',        partner: 'Rabdan Academy' },
    { program: 'Computer & Cyber Engineering',       partner: 'Khalifa University' },
    { program: 'Aerospace & Mechanical Engineering', partner: 'Khalifa University' },
    { program: 'International Relations & Strategy', partner: 'Sorbonne University AD' },
    { program: 'GIS & Geospatial Intelligence',      partner: 'Sorbonne University AD' },
    { program: 'Military Leadership & Command',      partner: 'ZMU Core' },
  ];
  const garminModels = ['Fenix 8 Tactical', 'Instinct 3 Solar', 'Forerunner 965', 'Epix Pro Gen 2'];

  const N_CADETS = 300;
  const cadets = [];
  for (let i = 0; i < N_CADETS; i++) {
    const prog = programs[i % programs.length];
    const gpa = clamp(rf(2.0, 4.0, 2) + (rnd() < 0.15 ? -0.4 : 0), 1.6, 4.0);
    const military = ri(58, 98);
    const fitness = ri(55, 99);
    const conduct = ri(70, 100);
    const composite = +(0.4 * (gpa / 4) * 100 + 0.25 * military + 0.25 * fitness + 0.10 * conduct).toFixed(1);
    const attendance = rf(82, 99.5, 1);
    const risk = composite < 66 || attendance < 83.5 ? 'high' : composite < 74 ? 'medium' : 'low';
    cadets.push({
      cadet_id: `ZMU-${2100 + i}`,
      name: `${pick(firstNames)} ${pick(firstNames)} ${pick(lastNames)}`,
      squadron: squadrons[i % squadrons.length],
      year: ri(1, 4),
      program: prog.program,
      partner: prog.partner,
      gpa: gpa.toFixed(2),
      military_score: military,
      fitness_score: fitness,
      conduct_score: conduct,
      composite_score: composite,
      attendance_pct: attendance,
      risk_level: risk,
      garmin_device: pick(garminModels),
      device_synced_hrs_ago: rnd() < 0.93 ? ri(0, 8) : ri(24, 96),
      accommodation: i % 2 === 0 ? 'Z06' : 'Z07',
    });
  }
  // order of merit from composite
  [...cadets].sort((a, b) => b.composite_score - a.composite_score)
    .forEach((c, idx) => { c.order_of_merit = idx + 1; });
  writeCSV('cadets.csv',
    ['cadet_id', 'name', 'squadron', 'year', 'program', 'partner', 'gpa', 'military_score', 'fitness_score', 'conduct_score', 'composite_score', 'order_of_merit', 'attendance_pct', 'risk_level', 'garmin_device', 'device_synced_hrs_ago', 'accommodation'],
    cadets);

  /* ════════════ 3. WEARABLES — Garmin Health API daily pulls (flow 4) ═══ */
  const wearRows = [];
  const DAYS_W = 14;
  for (const c of cadets) {
    // per-cadet baselines
    const baseHr = ri(46, 62);
    const baseHrv = ri(55, 105);
    const baseVo2 = rf(44, 58, 1);
    const loadBase = ri(280, 520);
    const poorSleeper = rnd() < 0.12;
    for (let d = DAYS_W - 1; d >= 0; d--) {
      const date = isoDay(daysAgo(d));
      const sleepH = clamp(rf(poorSleeper ? 4.4 : 6.0, poorSleeper ? 6.4 : 8.6), 3.5, 9.5);
      const hrv = clamp(Math.round(baseHrv + (sleepH - 7) * 6 + rf(-8, 8)), 28, 130);
      const load = Math.round(loadBase * rf(0.6, 1.5));
      const readiness = clamp(Math.round(
        0.35 * (sleepH / 8) * 100 + 0.30 * (hrv / 110) * 100 + 0.20 * (1 - Math.abs(load - loadBase) / loadBase) * 100 + 0.15 * (c.fitness_score)
      ), 20, 100);
      wearRows.push({
        cadet_id: c.cadet_id,
        date,
        resting_hr: Math.round(baseHr + (7 - sleepH) * 1.5 + rf(-2, 2)),
        hrv_ms: hrv,
        sleep_hours: sleepH.toFixed(1),
        sleep_score: clamp(Math.round(sleepH * 11 + rf(-6, 8)), 25, 100),
        steps: ri(6000, 22000),
        training_load: load,
        stress_avg: clamp(Math.round(55 - hrv / 3 + rf(-8, 12)), 8, 90),
        body_battery: clamp(Math.round(readiness * 0.9 + rf(-10, 10)), 5, 100),
        spo2: rf(94.5, 99, 1),
        vo2max: baseVo2,
        readiness_score: readiness,
        // acute:chronic workload ratio — ~4-5% of cadets over the 1.4 injury-risk threshold
        acwr: rnd() < 0.045 ? rf(1.42, 1.68, 2) : rf(0.68, 1.32, 2),
      });
    }
  }
  writeCSV('wearables_daily.csv',
    ['cadet_id', 'date', 'resting_hr', 'hrv_ms', 'sleep_hours', 'sleep_score', 'steps', 'training_load', 'stress_avg', 'body_battery', 'spo2', 'vo2max', 'readiness_score', 'acwr'],
    wearRows);
  const highRiskToday = wearRows.filter((w) => w.date === isoDay(daysAgo(0)) && w.acwr > 1.4).length;

  /* ════════════ 4. HPO readiness domains (5 mandatory domains) ════════ */
  const domains = ['Physical Fitness', 'Sleep & Recovery', 'Medical Status', 'Cognitive Readiness', 'Nutrition & Body Comp'];
  const domRows = [];
  for (const sq of squadrons) {
    for (const dom of domains) {
      domRows.push({
        squadron: sq,
        domain: dom,
        score: dom === 'Sleep & Recovery' && sq === 'Saluki' ? ri(58, 64) : ri(68, 94),
      });
    }
  }
  writeCSV('hpo_domains.csv', ['squadron', 'domain', 'score'], domRows);

  /* ════════════ 5. BMS hourly telemetry (OT → one-way diode, flow 5) ═══ */
  const occupancyProfile = (type, hr, dow) => {
    const weekend = dow === 5 || dow === 6; // Fri/Sat UAE weekend
    switch (type) {
      case 'academic': return weekend ? rf(2, 8) : hr >= 8 && hr <= 16 ? rf(55, 92) : rf(2, 12);
      case 'labs': return weekend ? rf(1, 6) : hr >= 9 && hr <= 18 ? rf(45, 85) : rf(1, 10);
      case 'library': return hr >= 9 && hr <= 22 ? rf(30, (hr >= 11 && hr <= 14) ? 88 : 70) : rf(1, 6);
      case 'accommodation': return hr >= 21 || hr <= 6 ? rf(78, 96) : rf(15, 45);
      case 'sports': return (hr >= 5 && hr <= 7) || (hr >= 16 && hr <= 19) ? rf(60, 95) : rf(5, 30);
      case 'dining': return [6, 7, 12, 13, 18, 19].includes(hr) ? rf(65, 95) : rf(3, 18);
      case 'admin': return weekend ? rf(2, 6) : hr >= 7 && hr <= 15 ? rf(50, 80) : rf(2, 10);
      case 'assembly': return hr >= 7 && hr <= 9 ? rf(40, 90) : rf(1, 12);
      case 'armoury': return (hr >= 5 && hr <= 8) || (hr >= 15 && hr <= 18) ? rf(30, 70) : rf(2, 10);
      case 'plant': return rf(4, 10);
      default: return rf(5, 40);
    }
  };
  const bmsRows = [];
  const HOURS_BMS = 72;
  for (const b of buildings) {
    for (let h = HOURS_BMS - 1; h >= 0; h--) {
      const ts = hoursAgo(h);
      const hr = ts.getHours();
      const dow = ts.getDay();
      const occ = occupancyProfile(b.type, hr, dow);
      // July Abu Dhabi: outdoor 33-47°C, cooling load dominant midday
      const outdoor = 33 + 12 * Math.max(0, Math.sin(((hr - 6) / 24) * Math.PI * 2)) + rf(-1, 1);
      let temp = 22.5 + rf(-0.8, 0.8) + occ / 120;
      let alarm = 0;
      // Storyline 1: AHU-02 fault in Academic Block B → temp drift last 18h
      if (b.building_id === 'Z03' && h < 18) { temp += (18 - h) * 0.17; if (h < 10) alarm = 1; }
      // Storyline 2: Library CO2 spike midday
      let co2 = Math.round(430 + occ * 7 + rf(-40, 40));
      if (b.building_id === 'Z05' && hr >= 11 && hr <= 14) co2 = Math.round(1150 + rf(-80, 160));
      // Storyline 3: Dining energy spike yesterday evening
      let kwh = +(b.area_m2 * (0.011 + 0.00018 * (outdoor - 24)) * (0.55 + occ / 130)).toFixed(1);
      if (b.building_id === 'Z10' && h >= 26 && h <= 30) kwh = +(kwh * 1.9).toFixed(1);
      bmsRows.push({
        building_id: b.building_id,
        ts: iso(ts),
        temp_c: temp.toFixed(1),
        humidity_pct: rf(42, 58, 0),
        co2_ppm: co2,
        occupancy_pct: occ.toFixed(0),
        kwh,
        water_l: Math.round(b.area_m2 * (0.6 + occ / 90) * rf(0.7, 1.3)),
        alarm_count: alarm,
      });
    }
  }
  writeCSV('bms_hourly.csv',
    ['building_id', 'ts', 'temp_c', 'humidity_pct', 'co2_ppm', 'occupancy_pct', 'kwh', 'water_l', 'alarm_count'],
    bmsRows);

  /* ════════════ 6. BMS / MEP assets ════════════ */
  const assetTypes = [
    { type: 'AHU', per: 3 }, { type: 'Chiller', only: 'Z12', per: 4 }, { type: 'FCU', per: 6 },
    { type: 'Pump', per: 2 }, { type: 'Elevator', per: 2 }, { type: 'UPS', per: 1 },
  ];
  const assets = [];
  let assetSeq = 1;
  for (const b of buildings) {
    for (const at of assetTypes) {
      if (at.only && at.only !== b.building_id) continue;
      if (at.type === 'Chiller' && b.building_id !== 'Z12') continue;
      const n = at.type === 'FCU' ? Math.max(2, Math.round(b.area_m2 / 2600)) : at.per;
      for (let k = 1; k <= n; k++) {
        let health = ri(82, 99);
        let status = 'running';
        const id = `${at.type}-${String(assetSeq++).padStart(3, '0')}`;
        // Storyline: failing AHU in Z03
        if (b.building_id === 'Z03' && at.type === 'AHU' && k === 2) { health = 41; status = 'fault'; }
        else if (rnd() < 0.06) { health = ri(55, 74); status = 'degraded'; }
        else if (rnd() < 0.05) { status = 'standby'; }
        assets.push({
          asset_id: id,
          building_id: b.building_id,
          type: at.type,
          health_pct: health,
          status,
          runtime_hours: ri(1200, 26000),
          next_maintenance: isoDay(new Date(NOW.getTime() + ri(3, 120) * DAY)),
        });
      }
    }
  }
  writeCSV('bms_assets.csv',
    ['asset_id', 'building_id', 'type', 'health_pct', 'status', 'runtime_hours', 'next_maintenance'],
    assets);

  /* ════════════ 7. Energy daily (EMS overlay, 30 days) ════════════ */
  const energyRows = [];
  for (let d = 29; d >= 0; d--) {
    const date = isoDay(daysAgo(d));
    for (const b of buildings) {
      const base = b.area_m2 * 0.24;
      energyRows.push({
        building_id: b.building_id,
        date,
        kwh: Math.round(base * rf(0.85, 1.2)),
        water_m3: Math.round(b.area_m2 * 0.011 * rf(0.8, 1.25)),
        solar_kwh: b.building_id === 'Z08' || b.building_id === 'Z06' ? Math.round(420 * rf(0.7, 1.1)) : 0,
      });
    }
  }
  writeCSV('energy_daily.csv', ['building_id', 'date', 'kwh', 'water_m3', 'solar_kwh'], energyRows);

  /* ════════════ 8. HRMS — departments & manpower (ERP flow 2) ════════ */
  const hrms = [
    { department: 'Academic Affairs',        military: 42,  civilian: 128, outsourced: 12, establishment: 196, attrition_pct: 4.1 },
    { department: 'Military Training Wing',  military: 165, civilian: 18,  outsourced: 6,  establishment: 205, attrition_pct: 2.2 },
    { department: 'Cadet Affairs',           military: 58,  civilian: 34,  outsourced: 8,  establishment: 108, attrition_pct: 3.4 },
    { department: 'ICT & Digital Services',  military: 12,  civilian: 64,  outsourced: 22, establishment: 110, attrition_pct: 7.8 },
    { department: 'Facilities & Campus Ops', military: 8,   civilian: 52,  outsourced: 96, establishment: 168, attrition_pct: 9.5 },
    { department: 'Finance & Procurement',   military: 6,   civilian: 48,  outsourced: 4,  establishment: 62,  attrition_pct: 5.0 },
    { department: 'Medical & HPO',           military: 22,  civilian: 46,  outsourced: 10, establishment: 86,  attrition_pct: 4.6 },
    { department: 'Security & Protocol',     military: 74,  civilian: 12,  outsourced: 28, establishment: 120, attrition_pct: 3.1 },
  ];
  hrms.forEach((d) => { d.headcount = d.military + d.civilian + d.outsourced; d.vacancies = d.establishment - d.headcount; });
  writeCSV('hrms_departments.csv',
    ['department', 'military', 'civilian', 'outsourced', 'headcount', 'establishment', 'vacancies', 'attrition_pct'],
    hrms);

  const recruit = [
    { stage: 'Manpower Requests', count: 64 }, { stage: 'Approved Vacancies', count: 51 },
    { stage: 'Shortlisted', count: 208 }, { stage: 'Interviewed', count: 96 },
    { stage: 'Security Clearance', count: 38 }, { stage: 'Offers Accepted', count: 27 }, { stage: 'Onboarded (QTD)', count: 19 },
  ];
  writeCSV('hrms_recruitment.csv', ['stage', 'count'], recruit);

  /* ════════════ 9. ERP Finance — Muwazana budget vs actual ════════════ */
  const costCenters = [
    { cost_center: 'Academic Programs',      budget_m: 86.0 },
    { cost_center: 'Military Training',      budget_m: 64.5 },
    { cost_center: 'Campus Operations & FM', budget_m: 58.2 },
    { cost_center: 'ICT & Digital Campus',   budget_m: 92.4 },
    { cost_center: 'Manpower & HR',          budget_m: 148.6 },
    { cost_center: 'Medical & HPO',          budget_m: 22.8 },
    { cost_center: 'Logistics & Supply',     budget_m: 31.5 },
  ];
  const finRows = costCenters.map((cc) => {
    const utilization = rf(0.38, 0.62, 2); // mid-year
    const actual = +(cc.budget_m * utilization).toFixed(1);
    const committed = +(cc.budget_m * rf(0.08, 0.2, 2)).toFixed(1);
    return {
      cost_center: cc.cost_center,
      budget_maed: cc.budget_m,
      actual_maed: actual,
      committed_maed: committed,
      utilization_pct: Math.round((actual / cc.budget_m) * 100),
      variance_pct: Math.round(((actual / cc.budget_m) - 0.5) * 100), // vs 50% mid-year plan
    };
  });
  writeCSV('finance_budget.csv',
    ['cost_center', 'budget_maed', 'actual_maed', 'committed_maed', 'utilization_pct', 'variance_pct'],
    finRows);

  const cashflow = [];
  for (let m = 11; m >= 0; m--) {
    const dt = new Date(NOW.getFullYear(), NOW.getMonth() - m, 1);
    const inflow = rf(28, 52, 1);
    const outflow = rf(24, 48, 1);
    cashflow.push({
      month: dt.toISOString().slice(0, 7),
      inflow_maed: inflow,
      outflow_maed: outflow,
      dof_transfer_maed: rf(18, 30, 1),
    });
  }
  writeCSV('finance_cashflow.csv', ['month', 'inflow_maed', 'outflow_maed', 'dof_transfer_maed'], cashflow);

  // AP / AR aging buckets (ERP finance)
  writeCSV('finance_aging.csv', ['bucket', 'receivables_kaed', 'payables_kaed'], [
    { bucket: 'Current', receivables_kaed: ri(3200, 4200), payables_kaed: ri(2600, 3600) },
    { bucket: '1–30 days', receivables_kaed: ri(1400, 2200), payables_kaed: ri(1100, 1800) },
    { bucket: '31–60 days', receivables_kaed: ri(700, 1200), payables_kaed: ri(500, 950) },
    { bucket: '61–90 days', receivables_kaed: ri(300, 600), payables_kaed: ri(200, 480) },
    { bucket: '90+ days', receivables_kaed: ri(120, 340), payables_kaed: ri(80, 260) },
  ]);

  /* ════════════ 10. Procurement — PO pipeline ════════════ */
  const suppliers = ['Gulf Dynamics LLC', 'Emirates Advanced Tech', 'Falcon Facilities Co', 'Injaz IT Solutions', 'Barakah Foods Group', 'Al Ain Uniforms', 'Etisalat e&', 'Core42', 'Khalifa Labs Supply', 'Desert Logistics'];
  const poCategories = ['IT Hardware', 'Lab Equipment', 'FM Services', 'Catering', 'Uniforms & Kit', 'Software Licences', 'Training Services', 'Medical Supplies'];
  const poStatuses = ['Draft', 'Pending Approval', 'Approved', 'Issued', 'Partially Delivered', 'Delivered', 'Invoiced', 'Paid'];
  const pos = [];
  for (let i = 0; i < 60; i++) {
    const st = pick(poStatuses);
    pos.push({
      po_id: `PO-26-${String(1400 + i)}`,
      supplier: pick(suppliers),
      category: pick(poCategories),
      value_kaed: ri(45, 4200),
      status: st,
      days_open: st === 'Paid' ? ri(12, 60) : ri(1, 45),
      department: pick(hrms).department,
    });
  }
  writeCSV('procurement_pos.csv',
    ['po_id', 'supplier', 'category', 'value_kaed', 'status', 'days_open', 'department'],
    pos);

  /* ════════════ 11. SIS / LMS — academic (flow 1) ════════════ */
  const progAgg = {};
  for (const c of cadets) {
    const p = (progAgg[c.program] ||= { program: c.program, partner: c.partner, enrolled: 0, gpaSum: 0, attSum: 0, at_risk: 0 });
    p.enrolled++; p.gpaSum += +c.gpa; p.attSum += +c.attendance_pct;
    if (c.risk_level === 'high') p.at_risk++;
  }
  writeCSV('sis_programs.csv',
    ['program', 'partner', 'enrolled', 'avg_gpa', 'avg_attendance', 'at_risk'],
    Object.values(progAgg).map((p) => ({
      program: p.program, partner: p.partner, enrolled: p.enrolled,
      avg_gpa: (p.gpaSum / p.enrolled).toFixed(2),
      avg_attendance: (p.attSum / p.enrolled).toFixed(1),
      at_risk: p.at_risk,
    })));

  const lmsRows = [];
  for (let d = 29; d >= 0; d--) {
    const dt = daysAgo(d);
    const weekend = dt.getDay() === 5 || dt.getDay() === 6;
    lmsRows.push({
      date: isoDay(dt),
      active_users: weekend ? ri(240, 520) : ri(1450, 2150),
      logins: weekend ? ri(400, 800) : ri(2400, 4200),
      submissions: weekend ? ri(60, 200) : ri(480, 980),
      video_hours: weekend ? ri(80, 220) : ri(600, 1400),
      ai_assistant_queries: weekend ? ri(120, 400) : ri(900, 2600),
      arabic_pct: rf(28, 44, 0),
    });
  }
  writeCSV('lms_daily.csv',
    ['date', 'active_users', 'logins', 'submissions', 'video_hours', 'ai_assistant_queries', 'arabic_pct'],
    lmsRows);

  const gpaTerms = ['Fall 24', 'Spring 25', 'Fall 25', 'Spring 26'];
  writeCSV('sis_gpa_terms.csv', ['term', 'avg_gpa', 'pass_rate', 'composite_avg'],
    gpaTerms.map((t, i) => ({
      term: t,
      avg_gpa: (2.92 + i * 0.07 + rf(-0.04, 0.04, 2)).toFixed(2),
      pass_rate: (88 + i * 1.6 + rf(-1, 1)).toFixed(1),
      composite_avg: (74 + i * 1.2 + rf(-1, 1)).toFixed(1),
    })));

  /* ════════════ 12. Labs & Library ════════════ */
  const labs = [
    { lab: 'Cyber Range Lab', partner: 'Khalifa University', workstations: 40 },
    { lab: 'Aerospace CAD Lab', partner: 'Khalifa University', workstations: 36 },
    { lab: 'GIS Lab 1', partner: 'Sorbonne University AD', workstations: 30 },
    { lab: 'GIS Lab 2', partner: 'Sorbonne University AD', workstations: 30 },
    { lab: 'Simulation & Wargaming Lab', partner: 'Rabdan Academy', workstations: 28 },
    { lab: 'AI & Data Lab', partner: 'Khalifa University', workstations: 34 },
    { lab: 'Languages Lab', partner: 'ZMU Core', workstations: 32 },
  ];
  writeCSV('labs.csv', ['lab', 'partner', 'workstations', 'utilization_pct', 'sessions_today', 'faults_open'],
    labs.map((l) => ({ ...l, utilization_pct: ri(38, 92), sessions_today: ri(2, 9), faults_open: rnd() < 0.3 ? ri(1, 3) : 0 })));

  writeCSV('library.csv', ['metric', 'value'], [
    { metric: 'Items in catalogue', value: 84200 },
    { metric: 'Loans today', value: ri(120, 260) },
    { metric: 'RFID kiosk self-checkouts', value: ri(80, 190) },
    { metric: 'E-resource sessions', value: ri(400, 900) },
    { metric: 'Occupancy now (%)', value: ri(35, 80) },
    { metric: 'Overdue items', value: ri(30, 90) },
  ]);

  /* ════════════ 13. Room / facility utilization (scheduling) ════════ */
  writeCSV('room_utilization.csv', ['space_type', 'total', 'booked_today', 'utilization_pct', 'no_show_pct'], [
    { space_type: 'Classrooms', total: 96, booked_today: 81, utilization_pct: 84, no_show_pct: 6 },
    { space_type: 'Lecture Halls', total: 12, booked_today: 9, utilization_pct: 75, no_show_pct: 4 },
    { space_type: 'Labs', total: 27, booked_today: 19, utilization_pct: 70, no_show_pct: 8 },
    { space_type: 'Meeting Rooms', total: 44, booked_today: 30, utilization_pct: 68, no_show_pct: 12 },
    { space_type: 'Training Grounds', total: 8, booked_today: 7, utilization_pct: 88, no_show_pct: 2 },
    { space_type: 'Auditoriums', total: 3, booked_today: 2, utilization_pct: 66, no_show_pct: 0 },
  ]);

  /* ════════════ 14. Security / CCTV / Access ════════════ */
  writeCSV('physical_security.csv',
    ['building_id', 'cameras_total', 'cameras_online', 'access_events_24h', 'denied_access_24h', 'tailgating_alerts_24h', 'doors_offline'],
    buildings.map((b) => {
      const cams = Math.max(8, Math.round(b.area_m2 / 320));
      return {
        building_id: b.building_id,
        cameras_total: cams,
        cameras_online: cams - (rnd() < 0.25 ? ri(1, 2) : 0),
        access_events_24h: ri(200, 3200),
        denied_access_24h: ri(0, 28),
        tailgating_alerts_24h: rnd() < 0.3 ? ri(1, 4) : 0,
        doors_offline: rnd() < 0.15 ? 1 : 0,
      };
    }));

  /* ════════════ 15. SIEM events (flow 7, RFC 5424) ════════════ */
  const networks = ['RED', 'YELLOW', 'ORANGE', 'GREY'];
  const evtCategories = [
    { cat: 'auth_failure', sev: ['low', 'medium'], w: 30 },
    { cat: 'malware_blocked', sev: ['medium', 'high'], w: 6 },
    { cat: 'policy_violation', sev: ['low', 'medium'], w: 14 },
    { cat: 'pam_session', sev: ['info'], w: 18 },
    { cat: 'ids_alert', sev: ['medium', 'high'], w: 8 },
    { cat: 'firewall_deny', sev: ['info', 'low'], w: 40 },
    { cat: 'ot_anomaly', sev: ['medium', 'high'], w: 4 },
    { cat: 'config_change', sev: ['info', 'low'], w: 10 },
    { cat: 'usb_blocked', sev: ['low', 'medium'], w: 5 },
  ];
  const evtSources = ['IAM/IdP', 'ERP Prod', 'LMS', 'SIS', 'BMS Gateway', 'VMS Cluster', 'Data Diode', 'WMS', 'Core Switch', 'WAF', 'MDM/UEM', 'MFT Gateway', 'HPO Platform'];
  const wsum = evtCategories.reduce((s, c) => s + c.w, 0);
  const pickCat = () => { let r = rnd() * wsum; for (const c of evtCategories) { r -= c.w; if (r <= 0) return c; } return evtCategories[0]; };
  const msgs = {
    auth_failure: 'Authentication failure — invalid credentials',
    malware_blocked: 'Malware signature blocked at endpoint',
    policy_violation: 'DLP tag violation on outbound transfer',
    pam_session: 'Privileged session recorded (PAM vault checkout)',
    ids_alert: 'NDR sensor flagged anomalous lateral traffic',
    firewall_deny: 'Segment policy denied cross-zone connection',
    ot_anomaly: 'OT telemetry outside modelled envelope',
    config_change: 'Configuration change committed (RFC 5424 audit)',
    usb_blocked: 'USB mass storage blocked by UEM policy',
  };
  const secEvents = [];
  for (let i = 0; i < 1600; i++) {
    const c = pickCat();
    const sev = pick(c.sev);
    const ts = new Date(NOW.getTime() - rnd() * 72 * HOUR);
    secEvents.push({
      ts: iso(ts),
      source: pick(evtSources),
      network: pick(networks),
      severity: sev,
      category: c.cat,
      message: msgs[c.cat],
      status: sev === 'critical'
        ? (NOW.getTime() - ts.getTime() > 20 * HOUR ? 'resolved' : pick(['open', 'investigating']))
        : rnd() < 0.85 ? 'resolved' : pick(['open', 'investigating']),
    });
  }
  // Storyline: brute-force cluster on IAM 6h ago
  for (let i = 0; i < 40; i++) {
    secEvents.push({
      ts: iso(new Date(NOW.getTime() - (5.6 + rnd() * 0.9) * HOUR)),
      source: 'IAM/IdP', network: 'YELLOW', severity: i < 3 ? 'critical' : 'high',
      category: 'auth_failure', message: 'Burst of failed logins — possible credential stuffing (auto-locked)',
      status: i < 3 ? 'investigating' : 'resolved',
    });
  }
  secEvents.sort((a, b) => a.ts.localeCompare(b.ts));
  writeCSV('siem_events.csv', ['ts', 'source', 'network', 'severity', 'category', 'message', 'status'], secEvents);

  /* ════════════ 16. WMS — weapon issuance ════════════ */
  const weaponTypes = ['M4 Carbine', 'M16A4', 'Sig P320', 'Training Rifle (Blue)'];
  const wmsRows = [];
  let issuedNow = 0;
  for (let i = 0; i < 180; i++) {
    const cadet = pick(cadets);
    const issued = new Date(NOW.getTime() - rnd() * 48 * HOUR);
    const returned = rnd() < 0.78;
    const overdue = !returned && NOW.getTime() - issued.getTime() > 10 * HOUR && rnd() < 0.2;
    if (!returned) issuedNow++;
    wmsRows.push({
      txn_id: `WMS-${8200 + i}`,
      ts: iso(issued),
      cadet_id: cadet.cadet_id,
      squadron: cadet.squadron,
      weapon_id: `WPN-${String(ri(1, 900)).padStart(4, '0')}`,
      weapon_type: pick(weaponTypes),
      action: 'issue',
      returned: returned ? 'yes' : 'no',
      status: overdue ? 'overdue' : returned ? 'closed' : 'out',
      armoury: 'Z09',
    });
  }
  writeCSV('wms_transactions.csv',
    ['txn_id', 'ts', 'cadet_id', 'squadron', 'weapon_id', 'weapon_type', 'action', 'returned', 'status', 'armoury'],
    wmsRows);

  /* ════════════ 17. Parking & mobility ════════════ */
  writeCSV('parking.csv', ['zone', 'capacity', 'occupied', 'anpr_events_24h', 'ev_chargers', 'ev_in_use'], [
    { zone: 'P1 — Main Gate', capacity: 420, occupied: ri(210, 400), anpr_events_24h: ri(600, 1400), ev_chargers: 12, ev_in_use: ri(2, 12) },
    { zone: 'P2 — Academic', capacity: 260, occupied: ri(120, 250), anpr_events_24h: ri(300, 800), ev_chargers: 8, ev_in_use: ri(1, 8) },
    { zone: 'P3 — Accommodation', capacity: 180, occupied: ri(60, 160), anpr_events_24h: ri(150, 420), ev_chargers: 6, ev_in_use: ri(0, 6) },
    { zone: 'P4 — Sports & Events', capacity: 340, occupied: ri(40, 300), anpr_events_24h: ri(100, 900), ev_chargers: 10, ev_in_use: ri(0, 10) },
  ]);

  /* ════════════ 18. Integration flows (per data-flow slide, 1-8) ═══════ */
  writeCSV('integration_flows.csv',
    ['flow_no', 'name', 'source', 'target', 'transport', 'msgs_24h', 'error_rate_pct', 'latency_ms', 'status'],
    [
      { flow_no: 1, name: 'SIS ↔ LMS / Library / Labs — enrolment, grades, content', source: 'SIS', target: 'LMS / ILS / Labs', transport: 'API / ESB', msgs_24h: 48200, error_rate_pct: 0.2, latency_ms: 180, status: 'healthy' },
      { flow_no: 2, name: 'ERP ↔ SIS / Scheduling — HR load, billing, budgets, DoF', source: 'ERP', target: 'SIS / Scheduler / DoF', transport: 'API / ESB', msgs_24h: 12600, error_rate_pct: 0.4, latency_ms: 260, status: 'healthy' },
      { flow_no: 3, name: 'IAM → all systems — accounts, entitlements, physical access', source: 'IAM / IdP', target: 'All platforms', transport: 'SCIM / API', msgs_24h: 5400, error_rate_pct: 0.1, latency_ms: 140, status: 'healthy' },
      { flow_no: 4, name: 'Wearables / HPO ↔ analytics — readiness scores to SIS', source: 'Garmin Health API', target: 'HPO / Data Lake / SIS', transport: 'REST / JSON', msgs_24h: 86400, error_rate_pct: 1.1, latency_ms: 420, status: 'healthy' },
      { flow_no: 5, name: 'OT → IT one-way telemetry via data diode', source: 'BMS / IoT (Domain D)', target: 'Data Platform', transport: 'Data Diode', msgs_24h: 152000, error_rate_pct: 2.8, latency_ms: 90, status: 'warning' },
      { flow_no: 6, name: 'Partner & DoF exchange — validated, ICD-governed gateway', source: 'KU / Rabdan / SUAD / DoF', target: 'File-Exchange Gateway', transport: 'MFT', msgs_24h: 340, error_rate_pct: 0.0, latency_ms: 1500, status: 'healthy' },
      { flow_no: 7, name: 'All platforms → split-SIEM — auth / privileged / config events', source: 'All platforms', target: 'Split-SIEM', transport: 'Syslog RFC 5424', msgs_24h: 96400, error_rate_pct: 0.3, latency_ms: 60, status: 'healthy' },
      { flow_no: 8, name: 'Replication → DR ≥ 50 km; backup → Core42 via FedNet', source: 'Primary DC (Z12)', target: 'DR Site / Core42', transport: 'Async Repl / FedNet', msgs_24h: 288, error_rate_pct: 0.0, latency_ms: 8, status: 'healthy' },
    ]);

  const intHourly = [];
  for (let h = 23; h >= 0; h--) {
    const ts = hoursAgo(h);
    const hr = ts.getHours();
    const busy = hr >= 7 && hr <= 16 ? 1.6 : 0.7;
    intHourly.push({
      ts: iso(ts),
      api_msgs: Math.round(2600 * busy * rf(0.8, 1.2)),
      mft_files: Math.round(16 * busy * rf(0.5, 1.4)),
      diode_events: Math.round(6300 * rf(0.85, 1.15)),
      syslog_eps: Math.round(1100 * rf(0.8, 1.3)),
    });
  }
  writeCSV('integration_hourly.csv', ['ts', 'api_msgs', 'mft_files', 'diode_events', 'syslog_eps'], intHourly);

  /* ════════════ 19. Master data quality (single cadet ID) ════════════ */
  writeCSV('master_data.csv', ['entity', 'records', 'match_rate_pct', 'duplicates', 'golden_records'], [
    { entity: 'Cadet ID (immutable)', records: 2100, match_rate_pct: 99.8, duplicates: 4, golden_records: 2096 },
    { entity: 'Staff / HR ID', records: 1075, match_rate_pct: 98.9, duplicates: 12, golden_records: 1063 },
    { entity: 'Course Catalogue', records: 468, match_rate_pct: 97.4, duplicates: 12, golden_records: 456 },
    { entity: 'Asset Register', records: 18400, match_rate_pct: 96.2, duplicates: 690, golden_records: 17710 },
    { entity: 'Supplier Master', records: 842, match_rate_pct: 98.1, duplicates: 16, golden_records: 826 },
  ]);

  writeCSV('icds.csv', ['icd_id', 'interface', 'version', 'status'], [
    { icd_id: 'ICD-001', interface: 'SIS ↔ LMS (OneRoster + xAPI)', version: 'v1.3', status: 'Approved' },
    { icd_id: 'ICD-002', interface: 'ERP ↔ DoF statutory interface', version: 'v0.9', status: 'In Review' },
    { icd_id: 'ICD-003', interface: 'IAM SCIM provisioning', version: 'v1.1', status: 'Approved' },
    { icd_id: 'ICD-004', interface: 'Garmin Health API ↔ HPO middleware', version: 'v1.0', status: 'Approved' },
    { icd_id: 'ICD-005', interface: 'BMS/IoT diode telemetry schema', version: 'v1.2', status: 'Approved' },
    { icd_id: 'ICD-006', interface: 'Partner MFT exchange (KU/Rabdan/SUAD)', version: 'v0.8', status: 'Draft' },
    { icd_id: 'ICD-007', interface: 'Syslog RFC 5424 / CEF forwarding', version: 'v1.0', status: 'Approved' },
    { icd_id: 'ICD-008', interface: 'DR replication & Core42 backup', version: 'v1.0', status: 'Approved' },
  ]);

  /* ════════════ 20. Resilience & continuity (flow 8) ════════════ */
  writeCSV('dr_status.csv', ['metric', 'value', 'target', 'status'], [
    { metric: 'Async replication lag (DR ≥ 50 km)', value: '38 s', target: '< 60 s', status: 'ok' },
    { metric: 'RPO — enterprise systems', value: '11 min', target: '15 min', status: 'ok' },
    { metric: 'RTO — tier-1 apps', value: '52 min', target: '60 min', status: 'ok' },
    { metric: 'Last backup → Core42 (FedNet)', value: '02:00 today', target: 'Daily', status: 'ok' },
    { metric: 'Immutable copies retained', value: '14', target: '≥ 14', status: 'ok' },
    { metric: 'Last DR failover test', value: '42 days ago', target: '≤ 90 days', status: 'ok' },
    { metric: 'ERP availability (30d)', value: '99.97%', target: '99.95%', status: 'ok' },
    { metric: 'LMS availability (30d)', value: '99.91%', target: '99.90%', status: 'warning' },
  ]);

  /* ════════════ 21. Cross-domain alert feed ════════════ */
  const alerts = [
    { hrs: 0.4, domain: 'Campus Ops', severity: 'critical', title: 'AHU-02 Academic Block B — supply fan fault, zone temp 25.4°C and rising', source: 'BMS Supervisory Layer' },
    { hrs: 1.2, domain: 'Security', severity: 'high', title: 'Credential-stuffing burst on IAM — 40 failed logins, 3 accounts auto-locked', source: 'Split-SIEM' },
    { hrs: 2.1, domain: 'Readiness', severity: 'high', title: `${highRiskToday} cadets flagged high injury risk (ACWR > 1.4) ahead of field exercise`, source: 'HPO Predictive Analytics' },
    { hrs: 3.0, domain: 'Campus Ops', severity: 'medium', title: 'Library reading hall CO₂ above 1100 ppm — ventilation boost recommended', source: 'IoT / IAQ Sensors' },
    { hrs: 4.5, domain: 'Integration', severity: 'medium', title: 'Data diode (flow 5) error rate 2.8% — schema drift on 2 BMS controllers', source: 'Integration Platform' },
    { hrs: 6.2, domain: 'Campus Ops', severity: 'medium', title: '2 weapons overdue for return > 10h — armoury reconciliation required', source: 'WMS' },
    { hrs: 8.0, domain: 'Academic', severity: 'medium', title: 'Saluki squadron avg sleep 5.9h — academic performance correlation flagged', source: 'AI Learning Analytics' },
    { hrs: 9.4, domain: 'Enterprise', severity: 'low', title: 'ICT budget utilization 61% vs 50% plan — review Q3 commitments (Muwazana)', source: 'ERP Finance' },
    { hrs: 12.6, domain: 'Campus Ops', severity: 'low', title: 'Dining facility energy spike +90% vs baseline yesterday evening', source: 'EMS Analytics' },
    { hrs: 15.1, domain: 'Academic', severity: 'low', title: 'Partner roster sync (SUAD) delayed 25 min — within SLA, monitoring', source: 'MFT Gateway' },
    { hrs: 20.3, domain: 'Security', severity: 'low', title: '3 CCTV cameras offline in Accommodation North — work order raised', source: 'VMS Health Monitor' },
    { hrs: 26.0, domain: 'Enterprise', severity: 'low', title: '14 purchase requisitions pending approval > 5 days', source: 'ERP Procurement' },
  ];
  writeCSV('alerts.csv', ['ts', 'domain', 'severity', 'title', 'source', 'status'],
    alerts.map((a, i) => ({
      ts: iso(new Date(NOW.getTime() - a.hrs * HOUR)),
      domain: a.domain, severity: a.severity, title: a.title, source: a.source,
      status: i < 5 ? 'open' : pick(['open', 'acknowledged', 'resolved']),
    })));

  /* ════════════ 22. Agentic AI recommendations ════════════ */
  writeCSV('ai_recommendations.csv', ['rec_id', 'domain', 'trigger', 'recommendation', 'impact', 'confidence_pct', 'status'], [
    { rec_id: 'AI-101', domain: 'Campus Ops', trigger: 'AHU-02 vibration + temp drift (Academic Block B)', recommendation: 'Auto-created CMMS work order WO-2214; shifted load to AHU-01/03; predicted bearing failure in 6 days', impact: 'Avoids unplanned outage of 14 classrooms', confidence_pct: 92, status: 'action taken' },
    { rec_id: 'AI-102', domain: 'Readiness', trigger: `${highRiskToday} cadets ACWR > 1.4 before Exercise Desert Shield`, recommendation: 'Propose modified training load for flagged cadets; notify squadron PT instructors via HPO', impact: 'Projected 40% reduction in soft-tissue injuries', confidence_pct: 87, status: 'pending approval' },
    { rec_id: 'AI-103', domain: 'Energy', trigger: 'Dining kWh spike +90% (kitchen exhaust runtime)', recommendation: 'Reschedule exhaust purge cycle to 22:00; recommission VFD setpoints', impact: 'Est. saving 210 MWh/yr (≈ AED 96k)', confidence_pct: 84, status: 'pending approval' },
    { rec_id: 'AI-104', domain: 'Academic', trigger: 'Saluki squadron sleep < 6h correlating with quiz scores −8%', recommendation: 'Adjust night-training rotation; push study-plan changes to affected cadets in LMS', impact: 'Protects composite scores of 50 cadets', confidence_pct: 78, status: 'advisory' },
    { rec_id: 'AI-105', domain: 'Security', trigger: 'Repeated tailgating alerts at Labs Centre east door', recommendation: 'Increase door close-delay enforcement; dispatch patrol check 17:00–19:00', impact: 'Closes ORANGE-network physical gap', confidence_pct: 81, status: 'action taken' },
  ]);

  /* ════════════ 23. Cadet journey — unified timeline per cadet ID ══════
     Fuses SIS/LMS academic milestones with HPO/military readiness events
     on the single immutable Cadet ID (REQ-EAD-082). */
  const journeyRows = [];
  const termsByYear = [
    ['Fall 22', 'Spring 23'], ['Fall 23', 'Spring 24'],
    ['Fall 24', 'Spring 25'], ['Fall 25', 'Spring 26'],
  ];
  const simLabs = ['Simulation & Wargaming Lab — Scenario Bravo', 'Cyber Range — Defensive Ops Exercise', 'GIS Lab — Terrain Analysis Capstone', 'AI & Data Lab — Intelligence Fusion Module'];
  const fieldEx = ['Exercise Desert Shield (field phase)', 'Exercise Falcon Dawn (night navigation)', 'Live-fire qualification — Range 2', 'Joint exercise with Rabdan Academy'];
  for (const c of cadets) {
    const yearsIn = c.year; // years since enrolment
    const enrol = daysAgo(Math.round(yearsIn * 365 + ri(20, 60)));
    journeyRows.push({
      cadet_id: c.cadet_id, ts: iso(enrol), category: 'admin',
      title: 'Enrolment — immutable Cadet ID issued',
      detail: `Registered in SIS · ${c.program} (${c.partner}) · Squadron ${c.squadron}`,
      result: c.cadet_id,
    });
    journeyRows.push({
      cadet_id: c.cadet_id, ts: iso(new Date(enrol.getTime() + 12 * DAY)), category: 'military',
      title: 'Basic military induction completed',
      detail: 'Drill, fieldcraft and weapons-handling foundation phase',
      result: pick(['Pass', 'Pass', 'Pass with distinction']),
    });
    // one GPA event per completed term
    const startIdx = 4 - yearsIn;
    for (let t = startIdx; t < 4; t++) {
      const [fall, spring] = termsByYear[t];
      const termDaysAgo = (4 - t) * 330 - ri(0, 40);
      if (termDaysAgo > 30) {
        const g = clamp(+c.gpa + rf(-0.35, 0.3, 2), 1.5, 4.0).toFixed(2);
        journeyRows.push({
          cadet_id: c.cadet_id, ts: iso(daysAgo(termDaysAgo)), category: 'academic',
          title: `Term result — ${fall}`,
          detail: `SIS grade roll-up · attendance ${rf(80, 99, 1)}%`,
          result: `GPA ${g}`,
        });
      }
      const sprDaysAgo = (4 - t) * 330 - 165 - ri(0, 40);
      if (sprDaysAgo > 30) {
        const g = clamp(+c.gpa + rf(-0.3, 0.35, 2), 1.5, 4.0).toFixed(2);
        journeyRows.push({
          cadet_id: c.cadet_id, ts: iso(daysAgo(sprDaysAgo)), category: 'academic',
          title: `Term result — ${spring}`,
          detail: `SIS grade roll-up · attendance ${rf(80, 99, 1)}%`,
          result: `GPA ${g}`,
        });
      }
    }
    // sim labs, field exercises, fitness tests spread over tenure
    const nEvents = 2 + yearsIn;
    for (let e = 0; e < nEvents; e++) {
      const dAgo = ri(20, yearsIn * 330);
      journeyRows.push({
        cadet_id: c.cadet_id, ts: iso(daysAgo(dAgo)), category: 'academic',
        title: `${pick(simLabs)} — completed`,
        detail: 'LMS competency record synced to SIS via flow 1',
        result: `${ri(68, 98)}%`,
      });
      journeyRows.push({
        cadet_id: c.cadet_id, ts: iso(daysAgo(ri(15, yearsIn * 320))), category: 'military',
        title: pick(fieldEx),
        detail: 'Military Training Wing assessment record',
        result: pick(['Pass', 'Pass', 'Pass', 'Retest scheduled']),
      });
    }
    journeyRows.push({
      cadet_id: c.cadet_id, ts: iso(daysAgo(ri(5, 90))), category: 'readiness',
      title: 'HPO fitness assessment (quarterly)',
      detail: `VO₂max ${rf(44, 58, 1)} · body composition within standard`,
      result: `Fitness ${c.fitness_score}/100`,
    });
    if (c.risk_level === 'high') {
      journeyRows.push({
        cadet_id: c.cadet_id, ts: iso(daysAgo(ri(2, 21))), category: 'readiness',
        title: 'Early-intervention flag raised',
        detail: 'HPO predictive analytics — composite/attendance below threshold',
        result: 'Support plan active',
      });
    }
    const lastW = wearRows.filter((w) => w.cadet_id === c.cadet_id).at(-1);
    if (lastW && lastW.acwr > 1.4) {
      journeyRows.push({
        cadet_id: c.cadet_id, ts: iso(hoursAgo(ri(2, 30))), category: 'readiness',
        title: 'Injury-risk flag — ACWR above 1.4',
        detail: `Garmin ${c.garmin_device} workload trend · training load modification proposed`,
        result: `ACWR ${lastW.acwr}`,
      });
    }
  }
  journeyRows.sort((a, b) => a.cadet_id.localeCompare(b.cadet_id) || a.ts.localeCompare(b.ts));
  writeCSV('cadet_journey.csv', ['cadet_id', 'ts', 'category', 'title', 'detail', 'result'], journeyRows);

  /* ════════════ 24. CCTV / VMS — camera registry & flagged footage ═════ */
  const cctvCams = [
    { camera_id: 'CAM-01', name: 'Main Gate — ANPR Lane',      building_id: 'Z01', location: 'Perimeter · Main entrance' },
    { camera_id: 'CAM-02', name: 'Armoury Entrance',           building_id: 'Z09', location: 'WMS issue counter' },
    { camera_id: 'CAM-03', name: 'Academic Block B — Corridor',building_id: 'Z03', location: 'Level 2 east wing' },
    { camera_id: 'CAM-04', name: 'Parade Ground — North',      building_id: 'Z11', location: 'Assembly & parade hall apron' },
    { camera_id: 'CAM-05', name: 'Accommodation North — Lobby',building_id: 'Z06', location: 'Cadet entrance turnstiles' },
    { camera_id: 'CAM-06', name: 'Data Centre Cage',           building_id: 'Z12', location: 'DC hall A · rack rows 1-4' },
    { camera_id: 'CAM-07', name: 'Dining Facility — Service',  building_id: 'Z10', location: 'Servery & seating' },
    { camera_id: 'CAM-08', name: 'Sports Complex — Pool Deck', building_id: 'Z08', location: 'HPO aquatic centre' },
    { camera_id: 'CAM-09', name: 'Library Reading Hall',       building_id: 'Z05', location: 'Level 1 open study' },
    { camera_id: 'CAM-10', name: 'Labs Centre — East Door',    building_id: 'Z04', location: 'Tailgating watch zone' },
    { camera_id: 'CAM-11', name: 'South Perimeter — Fence 7',  building_id: 'Z07', location: 'Thermal · perimeter run' },
    { camera_id: 'CAM-12', name: 'Roundabout — Traffic',       building_id: 'Z01', location: 'Central spine junction' },
  ];
  writeCSV('cctv_cameras.csv',
    ['camera_id', 'name', 'building_id', 'location', 'status', 'fps', 'resolution', 'analytics'],
    cctvCams.map((c, i) => ({
      ...c,
      status: i === 10 ? 'offline' : 'online',
      fps: pick([15, 25, 30]),
      resolution: pick(['1080p', '4MP', '4K']),
      analytics: pick(['motion+object', 'ANPR', 'facial-ready', 'thermal', 'motion+object']),
    })));

  const cctvIncidentTypes = [
    { type: 'Tailgating', sev: 'high', desc: 'Two entries on single credential — access control cross-check' },
    { type: 'Unattended object', sev: 'medium', desc: 'Static object > 10 min in circulation zone' },
    { type: 'Perimeter motion', sev: 'high', desc: 'After-hours motion on thermal perimeter camera' },
    { type: 'Crowd density', sev: 'low', desc: 'Occupancy above comfort threshold in zone' },
    { type: 'Camera obstruction', sev: 'medium', desc: 'Lens blocked / scene change detected' },
    { type: 'Vehicle in restricted lane', sev: 'medium', desc: 'ANPR mismatch against authorised list' },
    { type: 'Loitering', sev: 'low', desc: 'Dwell time exceeded near controlled door' },
  ];
  const cctvIncidents = [];
  for (let i = 0; i < 14; i++) {
    const t = pick(cctvIncidentTypes);
    const cam = pick(cctvCams);
    cctvIncidents.push({
      incident_id: `VMS-${String(3400 + i)}`,
      ts: iso(new Date(NOW.getTime() - rf(0.2, 36) * HOUR)),
      camera_id: cam.camera_id, camera: cam.name,
      type: t.type, severity: t.sev, description: t.desc,
      clip_s: ri(8, 90),
      status: pick(['flagged', 'under review', 'escalated', 'closed', 'closed']),
      operator: pick(['SecOps-1', 'SecOps-2', 'Auto-Analytics']),
    });
  }
  cctvIncidents.sort((a, b) => b.ts.localeCompare(a.ts));
  writeCSV('cctv_incidents.csv',
    ['incident_id', 'ts', 'camera_id', 'camera', 'type', 'severity', 'description', 'clip_s', 'status', 'operator'],
    cctvIncidents);

  /* ════════════ 26. Enterprise IT — software licences (REQ-AL-020) ═════ */
  const licenses = [
    { software: 'MATLAB & Simulink',        vendor: 'MathWorks',    total: 120,  consumed: 96,  renewal: 92 },
    { software: 'Microsoft 365 E5',         vendor: 'Microsoft',    total: 2400, consumed: 2231, renewal: 210 },
    { software: 'AutoCAD / Fusion',         vendor: 'Autodesk',     total: 80,   consumed: 74,  renewal: 152 },
    { software: 'ArcGIS Pro',               vendor: 'Esri',         total: 70,   consumed: 61,  renewal: 61 },
    { software: 'Ansys Workbench',          vendor: 'Ansys',        total: 40,   consumed: 38,  renewal: 121 },
    { software: 'Adobe Creative Cloud',     vendor: 'Adobe',        total: 60,   consumed: 41,  renewal: 240 },
    { software: 'SolidWorks',               vendor: 'Dassault',     total: 45,   consumed: 45,  renewal: 33 },
    { software: 'Cyber Range Platform',     vendor: 'Cyberbit',     total: 50,   consumed: 32,  renewal: 300 },
    { software: 'SPSS Statistics',          vendor: 'IBM',          total: 35,   consumed: 22,  renewal: 180 },
  ];
  writeCSV('it_licenses.csv',
    ['software', 'vendor', 'total', 'consumed', 'utilization_pct', 'renewal_days', 'compliance'],
    licenses.map((l) => ({
      software: l.software, vendor: l.vendor, total: l.total, consumed: l.consumed,
      utilization_pct: Math.round((l.consumed / l.total) * 100),
      renewal_days: l.renewal,
      compliance: l.consumed > l.total ? 'over' : l.consumed / l.total > 0.92 || l.renewal < 45 ? 'warning' : 'compliant',
    })));

  /* ════════════ 27. DCIM — data centre infrastructure (Z12) ════════════ */
  const dcimHourly = [];
  for (let h = 23; h >= 0; h--) {
    const ts = hoursAgo(h);
    const hr = ts.getHours();
    const itLoad = rf(182, 214, 1);
    const pue = rf(hr >= 11 && hr <= 16 ? 1.52 : 1.38, hr >= 11 && hr <= 16 ? 1.62 : 1.5, 2);
    dcimHourly.push({
      ts: iso(ts),
      pue,
      it_load_kw: itLoad,
      cooling_kw: +(itLoad * (pue - 1) * 0.82).toFixed(1),
      ups_charge_pct: ri(96, 100),
    });
  }
  writeCSV('dcim_hourly.csv', ['ts', 'pue', 'it_load_kw', 'cooling_kw', 'ups_charge_pct'], dcimHourly);

  writeCSV('dcim_status.csv', ['metric', 'value', 'target', 'status'], [
    { metric: 'PUE (current)', value: dcimHourly.at(-1).pue, target: '≤ 1.6', status: 'ok' },
    { metric: 'Cooling capacity used', value: '71%', target: '≤ 85%', status: 'ok' },
    { metric: 'UPS battery health', value: '97%', target: '≥ 90%', status: 'ok' },
    { metric: 'UPS autonomy at load', value: '18 min', target: '≥ 12 min', status: 'ok' },
    { metric: 'Generator fuel level', value: '88%', target: '≥ 75%', status: 'ok' },
    { metric: 'Rack space utilised', value: '64%', target: '≤ 80%', status: 'ok' },
    { metric: 'DC hall temperature', value: '22.4°C', target: '20–25°C', status: 'ok' },
    { metric: 'Redundancy posture', value: 'N+1', target: 'N+1', status: 'ok' },
  ]);

  /* IT asset lifecycle — high-tier workstations, servers, network */
  const itAssetTypes = [
    { type: 'Workstation (High-Tier)', models: ['Dell Precision 7960', 'HP Z8 Fury G5'], locs: ['Z04', 'Z02', 'Z03'] },
    { type: 'Server', models: ['Dell PowerEdge R760', 'HPE DL380 Gen11'], locs: ['Z12'] },
    { type: 'Core Switch', models: ['Cisco C9500-48Y4C', 'Aruba CX 8360'], locs: ['Z12', 'Z01'] },
    { type: 'Storage Array', models: ['Pure FlashArray X70', 'NetApp AFF A400'], locs: ['Z12'] },
    { type: 'UPS Module', models: ['Vertiv EXM2', 'Schneider Galaxy VS'], locs: ['Z12'] },
    { type: 'AV / Smart Classroom', models: ['Crestron UC-ENGINE', 'Poly X70'], locs: ['Z02', 'Z03', 'Z11'] },
  ];
  const itAssets = [];
  let itSeq = 1;
  for (const at of itAssetTypes) {
    const n = at.type.includes('Workstation') ? 12 : at.type === 'AV / Smart Classroom' ? 8 : 5;
    for (let k = 0; k < n; k++) {
      const purchasedDaysAgo = ri(90, 1500);
      const warrantyDays = 1095 - purchasedDaysAgo; // 3-year warranty
      itAssets.push({
        asset_id: `IT-${String(itSeq++).padStart(4, '0')}`,
        type: at.type,
        model: pick(at.models),
        building_id: pick(at.locs),
        purchase_date: isoDay(daysAgo(purchasedDaysAgo)),
        warranty_end: isoDay(new Date(NOW.getTime() + warrantyDays * DAY)),
        warranty_status: warrantyDays < 0 ? 'expired' : warrantyDays < 90 ? 'expiring' : 'active',
        health_pct: warrantyDays < 0 ? ri(58, 85) : ri(80, 100),
        status: rnd() < 0.05 ? 'maintenance' : 'in service',
      });
    }
  }
  writeCSV('it_assets.csv',
    ['asset_id', 'type', 'model', 'building_id', 'purchase_date', 'warranty_end', 'warranty_status', 'health_pct', 'status'],
    itAssets);

  console.log('Done. Generated at', iso(NOW));
}

if (require.main === module) generate();
module.exports = { generate, DATA_DIR };
