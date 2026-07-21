/**
 * Extended API — lean.
 *  · Auth: two roles only — executive (high-level view) and superadmin (all).
 *  · IoT: live sensor & device-health inventory per building, with in-memory
 *    add / delete (the differentiator vs a read-only NEST-style view).
 * (The SIS / LMS / stream / merit portals were replaced by redirect links to
 * the real source systems, so their endpoints were removed.)
 */
const path = require('path');
const load = (f) => require(path.join(__dirname, f));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (n) => Math.round(n * 10) / 10;

function registerExt(app, express, db) {
  /* ── auth ──
     Two demo accounts, each with a fixed password matching its username:
       executive / executive   ·   superadmin / superadmin
     SSO (UAE Pass) button signs in with password 'sso', which is accepted. */
  const USERS = {
    executive: { username: 'executive', password: 'executive', role: 'executive', name: 'Executive Command' },
    superadmin: { username: 'superadmin', password: 'superadmin', role: 'superadmin', name: 'Platform Administrator' },
    academics: { username: 'academics', password: 'academics', role: 'academics', name: 'Head of Academics' },
    readiness: { username: 'readiness', password: 'readiness', role: 'readiness', name: 'Military Head' },
    finance: { username: 'finance', password: 'finance', role: 'finance', name: 'Finance Head' },
    ithead: { username: 'ithead', password: 'ithead', role: 'ithead', name: 'IT Head' },
    security: { username: 'security', password: 'security', role: 'security', name: 'Security Head' },
    facility: { username: 'facility', password: 'facility', role: 'facility', name: 'Facility Management Head' },
    squadron1: { username: 'squadron1', password: 'squadron1', role: 'squadron1', name: 'Squadron Leader 1' },
    squadron2: { username: 'squadron2', password: 'squadron2', role: 'squadron2', name: 'Squadron Leader 2' },
  };
  app.post('/api/auth/login', express.json(), (req, res) => {
    const { username, password, role } = req.body || {};
    const u = USERS[(username || '').trim().toLowerCase()];
    if (!u) return res.status(401).json({ error: 'Unknown account — pick a role to auto-fill a demo login' });
    if (role && role !== u.role) return res.status(401).json({ error: 'Selected role does not match this account' });
    const pw = String(password || '');
    if (pw !== u.password && pw !== 'sso') return res.status(401).json({ error: 'Incorrect password for this account' });
    const { password: _pw, ...safe } = u;
    res.json({ ...safe, email: `${u.username}@zmu.ac.ae` });
  });

  /* ── IoT sensors & device health ──────────────────────────
     Seeded once from the campus buildings; mutated in memory by the
     add/delete levers (resets on restart, like the other demo state). */
  const buildings = (db.buildings || []).map((b) => ({ id: b.building_id, name: b.name }));
  const FLOORS = ['G', 'L1', 'L2', 'L3', 'Roof'];
  const TYPES = {
    environmental: { subtypes: ['Temperature', 'Humidity', 'CO₂', 'Air Quality (PM2.5)'], units: ['°C', '%RH', 'ppm', 'µg/m³'], wireless: true },
    occupancy:     { subtypes: ['PIR Motion', 'People Counter', 'Desk Occupancy'], units: ['', 'persons', ''], wireless: true },
    lighting:      { subtypes: ['Smart Luminaire', 'Daylight Sensor', 'DALI Gateway'], units: ['%', 'lux', ''], wireless: false },
    energy:        { subtypes: ['Power Meter', 'Sub-meter', 'Solar Inverter'], units: ['kW', 'kWh', 'kW'], wireless: false },
    hvac:          { subtypes: ['AHU Controller', 'FCU Thermostat', 'VAV Damper'], units: ['°C', '°C', '%'], wireless: false },
    security:      { subtypes: ['Door Contact', 'Motion Detector', 'Glass-break'], units: ['', '', ''], wireless: true },
    water:         { subtypes: ['Leak Detector', 'Flow Meter'], units: ['', 'L/min'], wireless: true },
  };
  const TYPE_LIST = Object.keys(TYPES);

  let _seed = 0xC0FFEE;
  const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
  const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const rf = (a, b, d = 1) => +(rnd() * (b - a) + a).toFixed(d);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  let sensors = [];
  let seq = 1;
  const readingFor = (type, subIdx) => {
    const cfg = TYPES[type];
    const unit = cfg.units[subIdx] || '';
    let val;
    switch (type) {
      case 'environmental': val = subIdx === 0 ? rf(20, 26) : subIdx === 1 ? ri(38, 60) : subIdx === 2 ? ri(430, 1100) : rf(4, 32); break;
      case 'occupancy': val = subIdx === 1 ? ri(0, 40) : (rnd() < 0.5 ? 'Clear' : 'Detected'); break;
      case 'lighting': val = subIdx === 0 ? ri(0, 100) : subIdx === 1 ? ri(80, 900) : 'Bus OK'; break;
      case 'energy': val = subIdx === 2 ? rf(0, 12) : rf(2, 48); break;
      case 'hvac': val = subIdx === 2 ? ri(20, 100) : rf(21, 24); break;
      case 'security': val = subIdx === 0 ? (rnd() < 0.92 ? 'Closed' : 'Open') : (rnd() < 0.9 ? 'Secure' : 'Alarm'); break;
      case 'water': val = subIdx === 0 ? (rnd() < 0.96 ? 'Dry' : 'Wet') : rf(0, 40); break;
      default: val = rf(0, 100);
    }
    return { reading: val, unit };
  };
  const makeSensor = (b, type, subIdx, statusHint) => {
    const cfg = TYPES[type];
    const sub = cfg.subtypes[subIdx];
    const wireless = cfg.wireless;
    let status = statusHint || (rnd() < 0.08 ? (rnd() < 0.5 ? 'fault' : 'degraded') : (rnd() < 0.04 ? 'offline' : 'online'));
    const health = status === 'online' ? ri(88, 100) : status === 'degraded' ? ri(60, 82) : status === 'fault' ? ri(28, 55) : ri(0, 20);
    const { reading, unit } = readingFor(type, subIdx);
    return {
      id: `SEN-${String(seq++).padStart(4, '0')}`,
      building_id: b.id, building: b.name, floor: pick(FLOORS),
      type, subtype: sub, name: `${sub} · ${b.id}-${ri(1, 40)}`,
      status, health_pct: health,
      battery_pct: wireless ? (status === 'offline' ? ri(0, 8) : ri(status === 'online' ? 45 : 10, 100)) : null,
      wireless, reading, unit,
      firmware: `v${ri(1, 4)}.${ri(0, 9)}.${ri(0, 9)}`,
      last_seen_min: status === 'offline' ? ri(60, 2880) : ri(0, 5),
      protocol: pick(['LoRaWAN', 'BACnet/IP', 'Zigbee', 'Modbus', 'KNX', 'MQTT']),
    };
  };
  // seed: several sensors per building, biased by building type
  buildings.forEach((b) => {
    const n = ri(5, 8);
    for (let i = 0; i < n; i++) {
      const type = pick(TYPE_LIST);
      makeSensorInto(b, type);
    }
  });
  function makeSensorInto(b, type, statusHint) {
    const cfg = TYPES[type];
    const subIdx = ri(0, cfg.subtypes.length - 1);
    sensors.push(makeSensor(b, type, subIdx, statusHint));
  }
  // guarantee a couple of live "situations" for the demo
  if (sensors[3]) { sensors[3].status = 'fault'; sensors[3].health_pct = 34; }
  if (sensors[7]) { sensors[7].status = 'degraded'; sensors[7].health_pct = 71; }

  const summarise = () => {
    const online = sensors.filter((s) => s.status === 'online').length;
    const faults = sensors.filter((s) => s.status === 'fault' || s.status === 'degraded').length;
    const offline = sensors.filter((s) => s.status === 'offline').length;
    const batt = sensors.filter((s) => s.battery_pct != null);
    const lowBatt = batt.filter((s) => s.battery_pct < 20).length;
    const byType = TYPE_LIST.map((tp) => {
      const list = sensors.filter((s) => s.type === tp);
      return { type: tp, total: list.length, online: list.filter((s) => s.status === 'online').length, faults: list.filter((s) => s.status === 'fault' || s.status === 'degraded').length };
    });
    return {
      kpis: {
        total: sensors.length, online, offline, faults,
        avgHealth: sensors.length ? Math.round(sensors.reduce((a, s) => a + s.health_pct, 0) / sensors.length) : 0,
        uptime: sensors.length ? +((online / sensors.length) * 100).toFixed(1) : 0,
        lowBattery: lowBatt, avgBattery: batt.length ? Math.round(batt.reduce((a, s) => a + s.battery_pct, 0) / batt.length) : 0,
      },
      byType,
      buildings: buildings.map((b) => b.id),
      types: TYPE_LIST,
      typeCatalogue: TYPES,
    };
  };

  app.get('/api/iot/sensors', (req, res) => {
    const { building, type } = req.query;
    let list = sensors;
    if (building && building !== 'ALL') list = list.filter((s) => s.building_id === building);
    if (type && type !== 'ALL') list = list.filter((s) => s.type === type);
    res.json({ ...summarise(), sensors: [...list].sort((a, b) => a.health_pct - b.health_pct) });
  });

  app.post('/api/iot/sensors', express.json(), (req, res) => {
    const { building_id, type, subtype, name, floor } = req.body || {};
    const b = buildings.find((x) => x.id === building_id) || buildings[0];
    if (!TYPES[type]) return res.status(400).json({ error: 'unknown sensor type' });
    const cfg = TYPES[type];
    const subIdx = Math.max(0, cfg.subtypes.indexOf(subtype));
    const s = makeSensor(b, type, subIdx < 0 ? 0 : subIdx, 'online');
    if (name) s.name = name;
    if (floor) s.floor = floor;
    s.health_pct = 100; s.last_seen_min = 0;
    sensors.unshift(s);
    res.json({ ok: true, sensor: s, kpis: summarise().kpis });
  });

  app.delete('/api/iot/sensors/:id', (req, res) => {
    const before = sensors.length;
    sensors = sensors.filter((s) => s.id !== req.params.id);
    if (sensors.length === before) return res.status(404).json({ error: 'unknown sensor' });
    res.json({ ok: true, removed: req.params.id, kpis: summarise().kpis });
  });

  /* ══════════════════════════════════════════════════════════════════
     Extended academic modules — SIS · LMS · HPO · Military · Conduct ·
     Composite / Order of Merit. Restored for the Super-Admin views on the
     same 48-officer-cadet roster, with live demo levers held in memory
     (reset on restart). No source-portal redirects — everything is served
     from this platform.
     ════════════════════════════════════════════════════════════════ */
  const extCadets = JSON.parse(JSON.stringify(load('cadets.json')));
  const sections = load('sections.json');
  const registrations = JSON.parse(JSON.stringify(load('registrations.json')));
  const colleges = load('colleges.json');
  const programmes = load('programmes.json');

  const byId = new Map(extCadets.map((c) => [c.id, c]));
  const secByCode = new Map(sections.map((s) => [s.course_code, s]));

  const holds = new Map();
  extCadets.forEach((c) => {
    if (c.conduct?.hold || (c.conduct?.score ?? 100) < 65) {
      holds.set(c.id, { reason: 'Conduct standing below 65 — automatic registration hold', placed_at: new Date().toISOString() });
    }
  });

  const weightVersions = [{
    version: 1, weights: { academic: 40, military: 25, fitness: 20, conduct: 15 },
    set_by: 'system', set_at: new Date().toISOString(), note: 'Baseline policy',
  }];
  const currentWeights = () => weightVersions[weightVersions.length - 1].weights;

  // Squadron scoping — the client appends ?squads=Falcon,Oryx for a squadron
  // leader; the extended modules filter their cadet roster by company so a
  // leader only ever sees their own cadets (in sync with the dashboard).
  const squadSetOf = (req) => {
    const raw = req && req.query && req.query.squads;
    if (!raw) return null;
    const s = new Set(String(raw).split(',').map((x) => x.trim()).filter(Boolean));
    return s.size ? s : null;
  };
  const scopeCadets = (college, req) => {
    let list = (college && college !== 'ALL') ? extCadets.filter((c) => c.college_code === college) : extCadets;
    const sq = squadSetOf(req);
    if (sq) list = list.filter((c) => sq.has(c.company));
    return list;
  };
  const gradePctOf = (id) => {
    const rs = registrations.filter((r) => r.student_id === id && r.grade_pct != null);
    return rs.length ? rs.reduce((s, r) => s + r.grade_pct, 0) / rs.length : null;
  };
  const gpaOf = (id) => {
    const rs = registrations.filter((r) => r.student_id === id && r.grade_pct != null);
    if (!rs.length) return null;
    const pts = rs.map((r) => (r.grade_pct >= 90 ? 4 : r.grade_pct >= 80 ? 3 : r.grade_pct >= 70 ? 2 : r.grade_pct >= 60 ? 1 : 0));
    return round1(pts.reduce((s, p) => s + p, 0) / pts.length * 10) / 10;
  };
  const compositeOf = (c) => {
    const w = currentWeights();
    const academicPct = gradePctOf(c.id) ?? 70;
    return round1((w.academic * academicPct + w.military * (c.military?.score ?? 0) + w.fitness * (c.fitness?.score ?? 0) + w.conduct * (c.conduct?.score ?? 0)) / 100);
  };
  const meritTable = (college, req) => scopeCadets(college, req)
    .map((c) => ({
      id: c.id, name: c.name, company: c.company, year: c.year,
      college_code: c.college_code, tenant: c.college_label,
      academic_pct: round1(gradePctOf(c.id) ?? 0), gpa: gpaOf(c.id),
      fitness: c.fitness?.score ?? null, military: c.military?.score ?? null, conduct: c.conduct?.score ?? null,
      hold: holds.has(c.id), composite: compositeOf(c),
    }))
    .sort((a, b) => b.composite - a.composite)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const fitnessScore = (runSec, pushups, situps) => clamp(Math.round(
    clamp((840 - runSec) / 300 * 40, 0, 40) + clamp(pushups * 0.45, 0, 30) + clamp(situps * 0.4, 0, 30),
  ), 0, 100);
  const bandFit = (s) => (s >= 90 ? 'Outstanding' : s >= 80 ? 'Excellent' : s >= 70 ? 'Good' : s >= 60 ? 'Pass' : 'Below standard');
  const bandMil = (s) => (s >= 90 ? 'Expert' : s >= 80 ? 'Proficient' : s >= 65 ? 'Developing' : 'Below standard');
  const bandCon = (s) => (s >= 90 ? 'Exemplary' : s >= 75 ? 'Good' : s >= 65 ? 'Watch' : 'At risk');
  const standingOf = (s) => (s >= 90 ? 'Exemplary' : s >= 75 ? 'Good Standing' : s >= 65 ? 'Under Review' : 'Probation');
  const syncConductHold = (c) => {
    if (c.conduct.score < 65) {
      if (!holds.has(c.id)) holds.set(c.id, { reason: 'Conduct standing below 65 — automatic registration hold', placed_at: new Date().toISOString() });
      c.conduct.hold = true;
    } else if (holds.has(c.id) && holds.get(c.id).reason.startsWith('Conduct')) {
      holds.delete(c.id);
      c.conduct.hold = false;
    }
  };

  app.get('/api/ext/colleges', (req, res) => res.json(colleges));

  app.get('/api/ext/sis', (req, res) => {
    const college = req.query.college || 'ALL';
    const cs = scopeCadets(college, req);
    const ids = new Set(cs.map((c) => c.id));
    const secs = college === 'ALL' ? sections : sections.filter((s) => s.college_code === college);
    const regs = registrations.filter((r) => ids.has(r.student_id));
    const graded = regs.filter((r) => r.grade_pct != null);
    const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    graded.forEach((r) => { dist[r.grade_pct >= 90 ? 'A' : r.grade_pct >= 80 ? 'B' : r.grade_pct >= 70 ? 'C' : r.grade_pct >= 60 ? 'D' : 'F']++; });
    const gpas = cs.map((c) => gpaOf(c.id)).filter((g) => g != null);
    const squadAll = scopeCadets('ALL', req); // squad-scoped across every college
    const enrolByCollege = colleges.map((cl) => ({ code: cl.code, tenant: cl.tenant, name: cl.name, students: squadAll.filter((c) => c.college_code === cl.code).length, sections: sections.filter((s) => s.college_code === cl.code).length }));
    const secEnrol = secs.map((s) => ({ ...s, enrolled: registrations.filter((r) => r.course_code === s.course_code && ids.has(r.student_id)).length }));
    const holdRows = [...holds.entries()].filter(([id]) => ids.has(id)).map(([id, h]) => ({ ...h, ...(({ name, company, college_code }) => ({ name, company, college_code }))(byId.get(id)), student_id: id }));
    res.json({
      term: 'Fall 2026 (202610)',
      kpis: {
        students: cs.length, sections: secs.length, registrations: regs.length,
        avgGpa: gpas.length ? round1(gpas.reduce((s, g) => s + g, 0) / gpas.length) : 0,
        holds: holdRows.length, pendingSyncs: regs.filter((r) => r.sync_status !== 'synced').length,
        creditHours: regs.length * 3, avgLoad: cs.length ? round1(regs.length * 3 / cs.length) : 0,
        gradedCourses: graded.length,
      },
      enrolByCollege, gradeDist: dist,
      programmes: programmes.filter((p) => college === 'ALL' || p.college_code === college),
      topSections: [...secEnrol].sort((a, b) => b.enrolled - a.enrolled),
      recentRegistrations: [...regs].sort((a, b) => (b.registered_at || '').localeCompare(a.registered_at || '')).slice(0, 8)
        .map((r) => ({ ...r, name: byId.get(r.student_id)?.name, title: secByCode.get(r.course_code)?.title, crn: secByCode.get(r.course_code)?.crn })),
      holds: holdRows,
      atRisk: cs.map((c) => ({ id: c.id, name: c.name, tenant: c.college_label, fit: c.fitness?.score ?? 0, conduct: c.conduct?.score ?? 0 }))
        .filter((c) => c.fit < 66 || c.conduct < 66)
        .sort((a, b) => (a.fit + a.conduct) - (b.fit + b.conduct)).slice(0, 8),
      syncHealth: { synced: regs.filter((r) => r.sync_status === 'synced').length, pending: regs.filter((r) => r.sync_status !== 'synced').length },
    });
  });

  app.get('/api/ext/students', (req, res) => {
    const college = req.query.college || 'ALL';
    res.json(scopeCadets(college, req).map((c) => ({
      id: c.id, username: c.username, name: c.name, company: c.company, year: c.year,
      college_code: c.college_code, tenant: c.college_label, programme: c.programme,
      fitness: c.fitness?.score, military: c.military?.score, conduct: c.conduct?.score,
      gpa: gpaOf(c.id), hold: holds.has(c.id),
    })));
  });

  app.get('/api/ext/student/:id', (req, res) => {
    const c = byId.get(+req.params.id);
    if (!c) return res.status(404).json({ error: 'unknown student' });
    const sq = squadSetOf(req);
    if (sq && !sq.has(c.company)) return res.status(403).json({ error: 'cadet outside your squadron' });
    const regs = registrations.filter((r) => r.student_id === c.id).map((r) => {
      const s = secByCode.get(r.course_code) || {};
      return { ...r, title: s.title, credits: s.credits || 3, instructor: s.instructor, crn: s.crn, delivering: s.tenant };
    });
    res.json({
      student: { ...c, gpa: gpaOf(c.id), academic_pct: round1(gradePctOf(c.id) ?? 0), hold: holds.has(c.id), hold_detail: holds.get(c.id) || null, composite: compositeOf(c) },
      registrations: regs,
    });
  });

  app.post('/api/ext/grade', express.json(), (req, res) => {
    const { registration_id, grade_pct } = req.body || {};
    const r = registrations.find((x) => x.id === +registration_id);
    if (!r) return res.status(404).json({ error: 'unknown registration' });
    r.grade_pct = clamp(+grade_pct, 0, 100);
    r.sync_status = 'synced';
    res.json({ ok: true, registration: r, gpa: gpaOf(r.student_id), composite: compositeOf(byId.get(r.student_id)) });
  });

  app.post('/api/ext/register', express.json(), (req, res) => {
    const { student_id, course_code } = req.body || {};
    const c = byId.get(+student_id);
    if (!c) return res.status(404).json({ error: 'unknown student' });
    if (holds.has(c.id)) return res.status(409).json({ error: 'Registration blocked — active hold', hold: holds.get(c.id) });
    if (!secByCode.has(course_code)) return res.status(404).json({ error: 'unknown course' });
    if (registrations.some((r) => r.student_id === c.id && r.course_code === course_code)) return res.status(409).json({ error: 'Already registered' });
    const reg = { id: Math.max(...registrations.map((r) => r.id)) + 1, student_id: c.id, course_code, sync_status: 'pending', grade_pct: null, registered_at: new Date().toISOString() };
    registrations.push(reg);
    setTimeout(() => { reg.sync_status = 'synced'; }, 15000);
    res.json({ ok: true, registration: reg });
  });

  const lmsCourses = sections.map((s, i) => {
    const enrolled = registrations.filter((r) => r.course_code === s.course_code);
    const seb = s.course_code === 'MS201';
    return {
      ...s,
      enrolled: enrolled.length,
      avg_grade: round1(enrolled.filter((r) => r.grade_pct != null).reduce((a, r, _, arr) => a + r.grade_pct / arr.length, 0)),
      activities: [
        { type: 'quiz', name: 'Quiz 1', seb, questions: 12 + (i % 5) * 4, status: 'open' },
        { type: 'assignment', name: 'Assignment 1', originality: true, submissions: Math.max(1, Math.round(enrolled.length * 0.8)) },
        { type: 'attendance', name: 'Attendance', sessions: 24, avg_pct: 88 + (i % 9) },
      ],
    };
  });
  app.get('/api/ext/lms', (req, res) => {
    const college = req.query.college || 'ALL';
    let courses = college === 'ALL' ? lmsCourses : lmsCourses.filter((c) => c.college_code === college);
    const sq = squadSetOf(req);
    if (sq) {
      // Recount enrolment / grades / submissions using only the squadron's cadets.
      const ids = new Set(extCadets.filter((c) => sq.has(c.company)).map((c) => c.id));
      courses = courses.map((c) => {
        const enr = registrations.filter((r) => r.course_code === c.course_code && ids.has(r.student_id));
        const graded = enr.filter((r) => r.grade_pct != null);
        return {
          ...c,
          enrolled: enr.length,
          avg_grade: graded.length ? round1(graded.reduce((a, r) => a + r.grade_pct, 0) / graded.length) : 0,
          activities: c.activities.map((a) => (a.type === 'assignment' ? { ...a, submissions: Math.max(0, Math.round(enr.length * 0.8)) } : a)),
        };
      });
    }
    res.json({ colleges, courses });
  });
  app.get('/api/ext/lms/originality/:code', (req, res) => {
    const course = lmsCourses.find((c) => c.course_code === req.params.code);
    if (!course) return res.status(404).json({ error: 'unknown course' });
    const sq = squadSetOf(req);
    let enrolled = registrations.filter((r) => r.course_code === course.course_code).map((r) => byId.get(r.student_id)).filter(Boolean);
    if (sq) enrolled = enrolled.filter((c) => sq.has(c.company));
    const flagged = enrolled.find((c) => c.name.startsWith('Khalid')) || enrolled[0];
    const zmuMatch = extCadets.find((c) => c.college_code === 'CMSL');
    res.json({
      course: course.course_code, assignment: 'Assignment 1',
      submissions: enrolled.map((c) => ({
        student_id: c.id, name: c.name, college_code: c.college_code, tenant: c.college_label,
        originality_pct: c.id === flagged?.id ? 50 : 4 + (c.id % 14),
        flagged: c.id === flagged?.id,
      })),
      match: flagged && zmuMatch ? {
        student_id: flagged.id, name: flagged.name,
        matched_student_id: zmuMatch.id, matched_name: zmuMatch.name,
        matched_college_code: zmuMatch.college_code, matched_tenant: zmuMatch.tenant,
        overlap_pct: 50, note: 'Cross-college textual match — masked outside owning tenant (REQ-LAA-015c)',
      } : null,
    });
  });

  const streamRow = {
    hpo: (c) => ({ score: c.fitness?.score, band: c.fitness?.band, ...c.fitness }),
    military: (c) => ({ score: c.military?.score, band: c.military?.band, ...c.military }),
    conduct: (c) => ({ score: c.conduct?.score, band: c.conduct?.band, standing: standingOf(c.conduct?.score ?? 0), hold: holds.has(c.id), ...c.conduct }),
  };
  app.get('/api/ext/stream/:which', (req, res) => {
    const fn = streamRow[req.params.which];
    if (!fn) return res.status(404).json({ error: 'unknown stream' });
    const college = req.query.college || 'ALL';
    res.json(scopeCadets(college, req).map((c) => ({
      id: c.id, name: c.name, company: c.company, year: c.year, college_code: c.college_code, tenant: c.college_label,
      ...fn(c),
    })));
  });

  app.post('/api/ext/hpo/test', express.json(), (req, res) => {
    const { student_id, run_sec, pushups, situps } = req.body || {};
    const c = byId.get(+student_id);
    if (!c || !c.fitness) return res.status(404).json({ error: 'unknown cadet' });
    const score = fitnessScore(+run_sec, +pushups, +situps);
    const delta = score - c.fitness.score;
    Object.assign(c.fitness, {
      score, band: bandFit(score),
      run_2400m_sec: +run_sec, run_mmss: `${Math.floor(run_sec / 60)}:${String(run_sec % 60).padStart(2, '0')}`,
      pushups: +pushups, situps: +situps,
    });
    c.fitness.events = [{ type: 'fitness_test', run_sec: +run_sec, pushups: +pushups, situps: +situps, delta, score_after: score, at: new Date().toISOString() }, ...(c.fitness.events || [])];
    res.json({ ok: true, score, band: c.fitness.band, delta, composite: compositeOf(c) });
  });

  app.post('/api/ext/military/eval', express.json(), (req, res) => {
    const { student_id, leadership, marksmanship_pct, tactical } = req.body || {};
    const c = byId.get(+student_id);
    if (!c || !c.military) return res.status(404).json({ error: 'unknown cadet' });
    const score = clamp(Math.round(0.25 * (+leadership * 20) + 0.45 * (+marksmanship_pct) + 0.30 * (+tactical)), 0, 100);
    const delta = score - c.military.score;
    Object.assign(c.military, {
      score, band: bandMil(score), leadership_eval: +leadership,
      marksmanship_pct: +marksmanship_pct, marksmanship: +marksmanship_pct >= 90 ? 'Expert' : +marksmanship_pct >= 75 ? 'Sharpshooter' : 'Marksman',
      tactical_assessment: +tactical,
    });
    c.military.events = [{ type: 'evaluation', leadership: +leadership, marksmanship_pct: +marksmanship_pct, tactical: +tactical, delta, score_after: score, at: new Date().toISOString() }, ...(c.military.events || [])];
    res.json({ ok: true, score, band: c.military.band, delta, composite: compositeOf(c) });
  });

  app.post('/api/ext/conduct/event', express.json(), (req, res) => {
    const { student_id, type, points, note } = req.body || {};
    const c = byId.get(+student_id);
    if (!c || !c.conduct) return res.status(404).json({ error: 'unknown cadet' });
    const pts = Math.abs(+points || 1) * (type === 'demerit' ? -1 : 1);
    c.conduct.score = clamp(c.conduct.score + pts * 2, 0, 100);
    c.conduct.band = bandCon(c.conduct.score);
    c.conduct.standing = standingOf(c.conduct.score);
    c.conduct.honour_standing = c.conduct.standing;
    if (type === 'demerit') c.conduct.demerits = (c.conduct.demerits || 0) + 1; else c.conduct.merits = (c.conduct.merits || 0) + 1;
    c.conduct.ledger = [{ date_label: 'Just now', type, points: pts, note: note || (type === 'demerit' ? 'Recorded demerit' : 'Awarded merit') }, ...(c.conduct.ledger || [])];
    syncConductHold(c);
    res.json({ ok: true, score: c.conduct.score, standing: c.conduct.standing, hold: holds.has(c.id), composite: compositeOf(c) });
  });

  app.get('/api/ext/weights', (req, res) => res.json({ current: weightVersions[weightVersions.length - 1], history: weightVersions }));
  app.put('/api/ext/weights', express.json(), (req, res) => {
    const role = req.headers['x-role'];
    if (!['commandant', 'superadmin'].includes(role)) return res.status(403).json({ error: 'Only the Commandant may set composite weights' });
    const { academic, military, fitness, conduct, note } = req.body || {};
    const w = { academic: +academic, military: +military, fitness: +fitness, conduct: +conduct };
    const total = w.academic + w.military + w.fitness + w.conduct;
    if (Math.round(total) !== 100) return res.status(400).json({ error: `Weights must total 100 (got ${total})` });
    weightVersions.push({ version: weightVersions.length + 1, weights: w, set_by: req.headers['x-user'] || role, set_at: new Date().toISOString(), note: note || 'Policy update' });
    res.json({ ok: true, current: weightVersions[weightVersions.length - 1] });
  });
  app.get('/api/ext/merit', (req, res) => res.json({ weights: currentWeights(), table: meritTable(req.query.college || 'ALL', req) }));
}

module.exports = { registerExt };
