import React, { useState } from 'react';
import KPICard, { IcoPeople, IcoBook, IcoClipboard, IcoTrendUp, IcoLock, IcoLink } from '../components/KPICard';
import { Panel, StatusChip, Loading, PageHeader, KPIGrid, DataTable, timeAgo, ProgressBar } from '../components/ui';
import { Bars, Donut, C } from '../components/charts';
import { useExt, InstitutionSwitcher, Advisory, CadetPicker } from '../components/ext';

/* Student Information System — Ellucian-class SIS over the federated MSI:
   sovereign core (ZMU · CMSL) + three delivery partners, multi-tenant via
   the institution switcher. Mirrors the :8081 environment inside the platform. */

const TABS = ['Institution Dashboard', 'Registrations · SFAREGS', 'Sections · SSASECT', 'Holds · SOAHOLD', 'Student Profile', 'Grade Entry'];

function StudentProfile({ studentId, onGrade }) {
  const { data, refresh } = useExt(`/ext/student/${studentId}`);
  if (!data?.student) return <Loading text="Loading student record…" />;
  const s = data.student;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 14, alignItems: 'start' }}>
      <Panel title={s.name} sub={`${s.username} · ${s.company} Company · Year ${s.year} · ${s.programme || '—'}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['College', s.college_label || s.college], ['GPA', s.gpa ?? '—'], ['Academic %', s.academic_pct], ['Composite', s.composite],
            ['Fitness', s.fitness?.score], ['Military', s.military?.score], ['Conduct', s.conduct?.score],
            ['Registration', s.hold ? 'HOLD' : 'Clear']].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--app-surface-soft)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: l === 'Registration' ? (s.hold ? 'var(--app-danger)' : 'var(--app-success)') : 'var(--app-text)' }}>{v ?? '—'}</div>
            </div>
          ))}
        </div>
        {s.hold_detail && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--app-danger)', background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)', borderRadius: 8, padding: '8px 10px' }}>
            ⚠ {s.hold_detail.reason}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Advisory items={[
            s.hold ? `Active conduct hold is blocking registration — a merit award restoring conduct ≥ 65 auto-releases it.`
              : (s.fitness?.score < 66 || s.conduct?.score < 66)
                ? `Stream scores flag ${s.name.split(' ')[0]} for early intervention — recommend a structured support plan before term end.`
                : `Record is in good standing across all four streams; no intervention indicated.`,
            `Composite ${s.composite} under current weights — a 5-point fitness gain would move the Order of Merit rank; see Composite & Order of Merit.`,
            `GPA ${s.gpa ?? '—'} on ${s.academic_pct}% average — academic performance is 40% of the composite, the heaviest single weight.`,
            `${s.name.split(' ')[0]} reads on one immutable Cadet ID across SIS, LMS, HPO, military and conduct — every figure on this page is joined, not re-keyed.`,
            s.fitness?.score != null ? `Streams — fitness ${s.fitness.score}, military ${s.military?.score}, conduct ${s.conduct?.score}; the weakest one is where an intervention returns the most composite.` : 'Stream scores sync nightly into the composite.',
          ]} />
        </div>
      </Panel>
      <Panel title="Transcript & Registrations" sub="Credit-weighted · grade sync to LMS governed by ICD (contract ≤ 15 min)">
        <DataTable maxHeight={420}
          columns={[
            { key: 'course_code', label: 'Course' },
            { key: 'title', label: 'Title' },
            { key: 'crn', label: 'CRN' },
            { key: 'credits', label: 'Cr', align: 'right' },
            { key: 'delivering', label: 'Delivered by' },
            { key: 'grade_pct', label: 'Grade %', align: 'right', render: (v) => v ?? '—' },
            { key: 'sync_status', label: 'Sync', render: (v) => <StatusChip kind={v === 'synced' ? 'success' : 'warning'}>{(v || '').toUpperCase()}</StatusChip> },
            ...(onGrade ? [{ key: 'id', label: '', render: (id, r) => <button className="app-timeframe-btn" onClick={() => onGrade(r, refresh)}>Edit grade</button> }] : []),
          ]}
          rows={data.registrations} />
      </Panel>
    </div>
  );
}

export default function SIS({ user }) {
  const [college, setCollege] = useState(user?.role === 'partner' ? user.college_code : 'ALL');
  const [tab, setTab] = useState(user?.role === 'cadet' ? 'Student Profile' : TABS[0]);
  const [studentId, setStudentId] = useState(user?.student_id || 1001);
  const { data, refresh } = useExt(`/ext/sis?college=${college}`);
  const { data: students } = useExt(`/ext/students?college=${college}`);
  const [msg, setMsg] = useState(null);

  if (!data) return <Loading text="Loading SIS…" />;
  const k = data.kpis;
  const isCadet = user?.role === 'cadet';
  const tabs = isCadet ? ['Student Profile'] : TABS;

  const gradeEdit = async (reg, refreshProfile) => {
    const v = window.prompt(`New grade % for ${reg.course_code} — ${reg.title}`, reg.grade_pct ?? 75);
    if (v == null) return;
    const r = await fetch('/api/ext/grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registration_id: reg.id, grade_pct: +v }) });
    const j = await r.json();
    setMsg(r.ok ? `Grade saved — GPA now ${j.gpa}, composite ${j.composite} (synced to LMS)` : j.error);
    refreshProfile?.(); refresh();
  };

  return (
    <>
      <PageHeader title="Student Information System"
        subtitle="Unified SIS/ERP across the four academic colleges of Zayed Military University · one governed cadet record · Term Fall 2026 (202610)"
        right={<InstitutionSwitcher user={user} college={college} onChange={setCollege} />} />

      {!isCadet && (
        <div className="app-timeframe-control" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button key={t} className={`app-timeframe-btn${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      )}
      {msg && <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--app-success)', fontWeight: 600 }}>{msg}</div>}

      {tab === 'Institution Dashboard' && (
        <>
          <KPIGrid>
            <KPICard label="Total Cadets" value={k.students} icon={<IcoPeople />} subValues={[{ label: 'Colleges', value: 4 }]} />
            <KPICard label="Active Sections" value={k.sections} icon={<IcoBook />} subValues={[{ label: 'Term', value: 'Fall 2026' }]} />
            <KPICard label="Registrations" value={k.registrations} icon={<IcoClipboard />} subValues={[{ label: 'Credit hours', value: k.creditHours }, { label: 'Avg load', value: k.avgLoad }]} />
            <KPICard label="Avg GPA" value={k.avgGpa} icon={<IcoTrendUp />} subValues={[{ label: 'Graded', value: k.gradedCourses }]} />
            <KPICard label="Active Holds" value={k.holds} icon={<IcoLock />} rag={k.holds > 0 ? 'warning' : 'normal'} subValues={[{ label: 'Source', value: 'Conduct register' }]} />
            <KPICard label="Pending Syncs" value={k.pendingSyncs} icon={<IcoLink />} rag={k.pendingSyncs > 0 ? 'warning' : 'normal'} subValues={[{ label: 'Contract', value: '≤ 15 min' }]} />
          </KPIGrid>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, marginBottom: 14 }}>
            <Panel title="Enrolment by College" sub="Four academic colleges of Zayed Military University">
              {data.enrolByCollege.map((c) => (
                <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '1px solid var(--app-surface-raised)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{c.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>College code {c.code}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>{c.sections} sections</span>
                  <b style={{ fontSize: 16, color: 'var(--app-text)' }}>{c.students}</b>
                </div>
              ))}
            </Panel>
            <Panel title="GPA Distribution" sub={`${k.gradedCourses} graded courses in scope`}>
              <Bars data={Object.entries(data.gradeDist).map(([g, n]) => ({ grade: g, count: n }))} x="grade" height={200} hideLegend
                series={[{ key: 'count', name: 'Courses', color: C.blue, cellColors: (d) => ({ A: C.green, B: C.blue, C: C.cyan, D: C.amber, F: C.red }[d.grade]) }]} />
            </Panel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14, marginBottom: 14 }}>
            <Panel title="Top Sections by Enrolment" sub="Capacity 40 per section">
              <DataTable maxHeight={300}
                columns={[
                  { key: 'crn', label: 'CRN' }, { key: 'course_code', label: 'Course' }, { key: 'title', label: 'Title' },
                  { key: 'instructor', label: 'Instructor' },
                  { key: 'enrolled', label: 'Enrolled / 40', render: (v) => <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 70 }}><ProgressBar pct={(v / 40) * 100} /></span><b>{v}</b></span> },
                ]}
                rows={data.topSections} />
            </Panel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Panel title="Recent Registrations" sub="RosterSync → LMS every 30 s">
                {data.recentRegistrations.slice(0, 5).map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 2px', fontSize: 12, borderBottom: '1px solid var(--app-surface-raised)' }}>
                    <span style={{ color: 'var(--app-text)' }}>{r.name}</span>
                    <span style={{ color: 'var(--app-text-faint)' }}>{r.course_code} · CRN {r.crn}</span>
                    <StatusChip kind={r.sync_status === 'synced' ? 'success' : 'warning'}>{r.sync_status === 'synced' ? 'RE' : 'RW'}</StatusChip>
                  </div>
                ))}
              </Panel>
              <Advisory items={[
                data.atRisk.length ? `${data.atRisk.length} cadets flagged at-risk on fitness/conduct — draft intervention briefs are ready in the Order of Merit view.` : 'No at-risk cadets in scope this term.',
                k.pendingSyncs > 0 ? `${k.pendingSyncs} registrations awaiting LMS sync — within the ≤ 15 min ICD contract.` : 'Grade-sync health at 100% — every enrolment confirmed to the LMS.',
              ]} />
            </div>
          </div>

          <Panel title="Holds & At-Risk" sub="Registration blocks originate in the Conduct register (score < 65) and release automatically">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
              <div>
                {data.holds.length === 0 ? <div style={{ fontSize: 12, color: 'var(--app-text-faint)' }}>No active registration holds in scope.</div>
                  : data.holds.map((h) => (
                    <div key={h.student_id} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)', fontSize: 12 }}>
                      <b style={{ color: 'var(--app-text)' }}>{h.name}</b> <span style={{ color: 'var(--app-text-faint)' }}>({h.student_id} · {h.company})</span>
                      <div style={{ color: 'var(--app-text-muted)', fontSize: 11 }}>{h.reason}</div>
                    </div>
                  ))}
              </div>
              <DataTable maxHeight={220}
                columns={[
                  { key: 'name', label: 'At-risk cadet' }, { key: 'tenant', label: 'College' },
                  { key: 'fit', label: 'Fit', align: 'right' }, { key: 'conduct', label: 'Conduct', align: 'right' },
                  { key: 'id', label: '', render: (id) => <button className="app-timeframe-btn" onClick={() => { setStudentId(id); setTab('Student Profile'); }}>Open</button> },
                ]}
                rows={data.atRisk} />
            </div>
          </Panel>
        </>
      )}

      {tab === 'Registrations · SFAREGS' && (
        <Panel title="SFAREGS — Student Course Registration" sub="Admin page · RE = registered/synced, RW = awaiting LMS sync">
          <DataTable maxHeight={520}
            columns={[
              { key: 'name', label: 'Student' }, { key: 'course_code', label: 'Course' }, { key: 'title', label: 'Title' }, { key: 'crn', label: 'CRN' },
              { key: 'grade_pct', label: 'Grade %', align: 'right', render: (v) => v ?? '—' },
              { key: 'sync_status', label: 'Status', render: (v) => <StatusChip kind={v === 'synced' ? 'success' : 'warning'}>{v === 'synced' ? 'RE REGISTERED' : 'RW PENDING'}</StatusChip> },
              { key: 'registered_at', label: 'When', render: (v) => (v ? timeAgo(v) : '—') },
            ]}
            rows={data.recentRegistrations.concat([])} />
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--app-text-faint)' }}>Showing most recent · full ledger has {k.registrations} rows in scope.</div>
        </Panel>
      )}

      {tab === 'Sections · SSASECT' && (
        <Panel title="SSASECT — Schedule of Classes" sub="Fall 2026 (202610) · seats capacity 40">
          <DataTable maxHeight={520}
            columns={[
              { key: 'crn', label: 'CRN' }, { key: 'course_code', label: 'Course' }, { key: 'title', label: 'Title' },
              { key: 'credits', label: 'Cr', align: 'right' }, { key: 'instructor', label: 'Instructor' }, { key: 'schedule', label: 'Schedule' },
              { key: 'tenant', label: 'College' },
              { key: 'enrolled', label: 'Enrolled', align: 'right' },
              { key: 'enrolled', label: 'Seats left', align: 'right', render: (v) => 40 - v },
            ]}
            rows={data.topSections} />
        </Panel>
      )}

      {tab === 'Holds · SOAHOLD' && (
        <Panel title="SOAHOLD — Registration Holds" sub="Automatic conduct holds (score < 65) block new registration with 409 · merits release them">
          {data.holds.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--app-text-faint)', padding: 8 }}>No active registration holds in scope.</div> : (
            <DataTable
              columns={[
                { key: 'student_id', label: 'ID' }, { key: 'name', label: 'Student' }, { key: 'company', label: 'Company' },
                { key: 'reason', label: 'Hold reason' },
                { key: 'placed_at', label: 'Placed', render: (v) => timeAgo(v) },
                { key: 'student_id', label: '', render: (id) => <button className="app-timeframe-btn" onClick={() => { setStudentId(id); setTab('Student Profile'); }}>Open profile</button> },
              ]}
              rows={data.holds} />
          )}
          <div style={{ marginTop: 12 }}>
            <Advisory items={['Holds here are enforcement, not punishment records — the Conduct & Discipline register is the system of record; this page only mirrors its state.']} />
          </div>
        </Panel>
      )}

      {tab === 'Student Profile' && (
        <>
          {!isCadet && students && (
            <div style={{ marginBottom: 12 }}>
              <CadetPicker cadets={students} value={studentId} onChange={(id) => setStudentId(+id)}
                labelFor={(s) => `${s.company} · ${s.tenant}`} />
            </div>
          )}
          <StudentProfile studentId={isCadet ? user.student_id : studentId} />
        </>
      )}

      {tab === 'Grade Entry' && (
        <>
          {students && (
            <div style={{ marginBottom: 12 }}>
              <CadetPicker cadets={students} value={studentId} onChange={(id) => setStudentId(+id)}
                labelFor={(s) => `${s.company} · ${s.tenant}`} />
            </div>
          )}
          <StudentProfile studentId={studentId} onGrade={gradeEdit} />
        </>
      )}
    </>
  );
}
