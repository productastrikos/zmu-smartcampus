/**
 * Extended modules API — SIS · LMS · HPO · Military · Conduct · RBAC · Merit.
 * Mirrors the ZMU demo environment portals (:8081/:8082/:8086/:8087/:8088)
 * inside this platform, on the same 48-officer-cadet roster, with live demo
 * levers held in memory (reset on restart, like the source environment).
 */
const path = require('path');
const load = (f) => require(path.join(__dirname, f));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (n) => Math.round(n * 10) / 10;

function registerExt(app, express) {
  /* ── state (deep-copied so levers can mutate) ─────────────── */
  const cadets = JSON.parse(JSON.stringify(load('cadets.json')));
  const sections = load('sections.json');
  const registrations = JSON.parse(JSON.stringify(load('registrations.json')));
  const colleges = load('colleges.json');
  const programmes = load('programmes.json');
  const users = load('users.json');

  const byId = new Map(cadets.map((c) => [c.id, c]));
  const secByCode = new Map(sections.map((s) => [s.course_code, s]));

  // registration holds (conduct < 65 places an automatic hold)
  const holds = new Map(); // student_id -> { reason, placed_at }
  cadets.forEach((c) => {
    if (c.conduct?.hold || (c.conduct?.score ?? 100) < 65) {
      holds.set(c.id, { reason: 'Conduct standing below 65 — automatic registration hold', placed_at: new Date().toISOString() });
    }
  });

  // composite weights — versioned, commandant-editable (defaults per demo)
  const weightVersions = [{
    version: 1, weights: { academic: 40, military: 25, fitness: 20, conduct: 15 },
    set_by: 'system', set_at: new Date().toISOString(), note: 'Baseline policy',
  }];
  const currentWeights = () => weightVersions[weightVersions.length - 1].weights;

  /* ── helpers ──────────────────────────────────────────────── */
  const scopeCadets = (college) => (college && college !== 'ALL' ? cadets.filter((c) => c.college_code === college) : cadets);

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

  const meritTable = (college) => scopeCadets(college)
    .map((c) => ({
      id: c.id, name: c.name, company: c.company, year: c.year,
      college_code: c.college_code, tenant: c.tenant,
      academic_pct: round1(gradePctOf(c.id) ?? 0), gpa: gpaOf(c.id),
      fitness: c.fitness?.score ?? null, military: c.military?.score ?? null, conduct: c.conduct?.score ?? null,
      hold: holds.has(c.id),
      composite: compositeOf(c),
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

  /* ── auth / RBAC ──────────────────────────────────────────── */
  app.post('/api/auth/login', express.json(), (req, res) => {
    const { username } = req.body || {};
    const u = users.find((x) => x.username === (username || '').trim().toLowerCase());
    if (!u) return res.status(401).json({ error: 'Unknown user — use one of the demo accounts' });
    const cadet = u.student_id ? byId.get(u.student_id) : (u.role === 'cadet' ? cadets.find((c) => c.username === u.username) : null);
    res.json({
      username: u.username, role: u.role,
      name: `${u.firstname} ${u.lastname}`.trim(),
      college_code: u.college_code || null,
      student_id: cadet ? cadet.id : null,
    });
  });
  app.get('/api/auth/users', (req, res) => {
    res.json(users.filter((u) => u.role !== 'cadet').concat(users.filter((u) => u.role === 'cadet').slice(0, 3)));
  });

  /* ── colleges / institution switcher ──────────────────────── */
  app.get('/api/ext/colleges', (req, res) => res.json(colleges));

  /* ── SIS ──────────────────────────────────────────────────── */
  app.get('/api/ext/sis', (req, res) => {
    const college = req.query.college || 'ALL';
    const cs = scopeCadets(college);
    const ids = new Set(cs.map((c) => c.id));
    const secs = college === 'ALL' ? sections : sections.filter((s) => s.college_code === college);
    const regs = registrations.filter((r) => ids.has(r.student_id));
    const graded = regs.filter((r) => r.grade_pct != null);
    const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    graded.forEach((r) => { dist[r.grade_pct >= 90 ? 'A' : r.grade_pct >= 80 ? 'B' : r.grade_pct >= 70 ? 'C' : r.grade_pct >= 60 ? 'D' : 'F']++; });
    const gpas = cs.map((c) => gpaOf(c.id)).filter((g) => g != null);
    const enrolByCollege = colleges.map((cl) => ({ code: cl.code, tenant: cl.tenant, name: cl.name, students: cadets.filter((c) => c.college_code === cl.code).length, sections: sections.filter((s) => s.college_code === cl.code).length }));
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
      atRisk: cs.map((c) => ({ id: c.id, name: c.name, tenant: c.tenant, fit: c.fitness?.score ?? 0, conduct: c.conduct?.score ?? 0 }))
        .filter((c) => c.fit < 66 || c.conduct < 66)
        .sort((a, b) => (a.fit + a.conduct) - (b.fit + b.conduct)).slice(0, 8),
      syncHealth: { synced: regs.filter((r) => r.sync_status === 'synced').length, pending: regs.filter((r) => r.sync_status !== 'synced').length },
    });
  });

  app.get('/api/ext/students', (req, res) => {
    const college = req.query.college || 'ALL';
    res.json(scopeCadets(college).map((c) => ({
      id: c.id, username: c.username, name: c.name, company: c.company, year: c.year,
      college_code: c.college_code, tenant: c.tenant, programme: c.programme,
      fitness: c.fitness?.score, military: c.military?.score, conduct: c.conduct?.score,
      gpa: gpaOf(c.id), hold: holds.has(c.id),
    })));
  });

  app.get('/api/ext/student/:id', (req, res) => {
    const c = byId.get(+req.params.id);
    if (!c) return res.status(404).json({ error: 'unknown student' });
    const regs = registrations.filter((r) => r.student_id === c.id).map((r) => {
      const s = secByCode.get(r.course_code) || {};
      return { ...r, title: s.title, credits: s.credits || 3, instructor: s.instructor, crn: s.crn, delivering: s.tenant };
    });
    res.json({
      student: { ...c, gpa: gpaOf(c.id), academic_pct: round1(gradePctOf(c.id) ?? 0), hold: holds.has(c.id), hold_detail: holds.get(c.id) || null, composite: compositeOf(c) },
      registrations: regs,
    });
  });

  // faculty grade entry — updates a registration's grade (grade sync demo)
  app.post('/api/ext/grade', express.json(), (req, res) => {
    const { registration_id, grade_pct } = req.body || {};
    const r = registrations.find((x) => x.id === +registration_id);
    if (!r) return res.status(404).json({ error: 'unknown registration' });
    r.grade_pct = clamp(+grade_pct, 0, 100);
    r.sync_status = 'synced';
    res.json({ ok: true, registration: r, gpa: gpaOf(r.student_id), composite: compositeOf(byId.get(r.student_id)) });
  });

  // registration attempt — blocked with 409 when a hold exists (demo lever 3)
  app.post('/api/ext/register', express.json(), (req, res) => {
    const { student_id, course_code } = req.body || {};
    const c = byId.get(+student_id);
    if (!c) return res.status(404).json({ error: 'unknown student' });
    if (holds.has(c.id)) return res.status(409).json({ error: 'Registration blocked — active hold', hold: holds.get(c.id) });
    if (!secByCode.has(course_code)) return res.status(404).json({ error: 'unknown course' });
    if (registrations.some((r) => r.student_id === c.id && r.course_code === course_code)) return res.status(409).json({ error: 'Already registered' });
    const reg = { id: Math.max(...registrations.map((r) => r.id)) + 1, student_id: c.id, course_code, sync_status: 'pending', grade_pct: null, registered_at: new Date().toISOString() };
    registrations.push(reg);
    setTimeout(() => { reg.sync_status = 'synced'; }, 15000); // RosterSync contract ≤ 15 min, demo: 15 s
    res.json({ ok: true, registration: reg });
  });

  /* ── LMS (Moodle-class) ───────────────────────────────────── */
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
    res.json({
      colleges,
      courses: college === 'ALL' ? lmsCourses : lmsCourses.filter((c) => c.college_code === college),
    });
  });
  // originality report — CS120 Assignment 1 cross-college match (REQ-LAA-015c)
  app.get('/api/ext/lms/originality/:code', (req, res) => {
    const course = lmsCourses.find((c) => c.course_code === req.params.code);
    if (!course) return res.status(404).json({ error: 'unknown course' });
    const enrolled = registrations.filter((r) => r.course_code === course.course_code).map((r) => byId.get(r.student_id)).filter(Boolean);
    const flagged = enrolled.find((c) => c.name.startsWith('Khalid')) || enrolled[0];
    const zmuMatch = cadets.find((c) => c.college_code === 'CMSL');
    res.json({
      course: course.course_code, assignment: 'Assignment 1',
      submissions: enrolled.map((c) => ({
        student_id: c.id, name: c.name, college_code: c.college_code, tenant: c.tenant,
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

  /* ── streams: HPO / Military / Conduct ────────────────────── */
  const streamRow = {
    hpo: (c) => ({ score: c.fitness?.score, band: c.fitness?.band, ...c.fitness }),
    military: (c) => ({ score: c.military?.score, band: c.military?.band, ...c.military }),
    conduct: (c) => ({ score: c.conduct?.score, band: c.conduct?.band, standing: standingOf(c.conduct?.score ?? 0), hold: holds.has(c.id), ...c.conduct }),
  };
  app.get('/api/ext/stream/:which', (req, res) => {
    const fn = streamRow[req.params.which];
    if (!fn) return res.status(404).json({ error: 'unknown stream' });
    const college = req.query.college || 'ALL';
    res.json(scopeCadets(college).map((c) => ({
      id: c.id, name: c.name, company: c.company, year: c.year, college_code: c.college_code, tenant: c.tenant,
      ...fn(c),
    })));
  });

  // lever 2 — record fitness test → readiness & composite recompute
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

  // lever — record military evaluation
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

  // lever 3 — award merit / record demerit → auto SIS hold below 65
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

  /* ── composite weights + Order of Merit ───────────────────── */
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
  app.get('/api/ext/merit', (req, res) => res.json({ weights: currentWeights(), table: meritTable(req.query.college || 'ALL') }));
}

module.exports = { registerExt };
