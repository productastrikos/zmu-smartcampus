import React, { useState } from 'react';
import { Panel, StatusChip, Loading, PageHeader, DataTable, ProgressBar } from '../components/ui';
import { useExt, InstitutionSwitcher, Advisory } from '../components/ext';

/* Learning Management — Moodle-class LMS: 20 live courses across the four
   College tenants, originality (plagiarism) checking with cross-college
   masking (REQ-LAA-015c) and Safe Exam Browser quizzes (REQ-LAA-005). */

const ACT_ICON = { quiz: '📝', assignment: '📄', attendance: '📅' };

function Originality({ code, user, onClose }) {
  const { data } = useExt(`/ext/lms/originality/${code}`);
  if (!data) return <Loading text="Running originality analysis…" />;
  // tenant admins / partner registrars only see matches inside their own college — the ZMU cadet is masked
  const masked = user?.role === 'partner' && data.match && data.match.matched_college_code !== user.college_code;
  return (
    <Panel title={`Originality Report — ${data.course} · ${data.assignment}`} sub="Turnitin-compatible similarity screening on submission"
      right={<button className="app-timeframe-btn" onClick={onClose}>✕ Close report</button>}>
      {data.match && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 9, background: 'var(--app-warning-bg)', border: '1px solid var(--app-warning-border)', fontSize: 12.5 }}>
          <b style={{ color: 'var(--app-text)' }}>⚠ {data.match.overlap_pct}% cross-college match:</b>{' '}
          <span style={{ color: 'var(--app-text-muted)' }}>
            {data.match.name} ↔ {masked ? <i>ZMU cadet (identity masked outside owning tenant — REQ-LAA-015c)</i> : `${data.match.matched_name} (${data.match.matched_tenant})`}
          </span>
        </div>
      )}
      <DataTable maxHeight={360}
        columns={[
          { key: 'name', label: 'Submission' }, { key: 'tenant', label: 'College' },
          { key: 'originality_pct', label: 'Similarity', render: (v, r) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 90 }}><ProgressBar pct={v} color={r.flagged ? 'var(--app-danger)' : undefined} /></span>
              <b style={{ color: r.flagged ? 'var(--app-danger)' : 'var(--app-success)' }}>{v}%</b>
            </span>
          ) },
          { key: 'flagged', label: 'Status', render: (v) => <StatusChip kind={v ? 'danger' : 'success'}>{v ? 'FLAGGED' : 'CLEAR'}</StatusChip> },
        ]}
        rows={data.submissions} />
      <div style={{ marginTop: 12 }}>
        <Advisory items={[
          data.match ? 'The flagged overlap clusters in the methodology section — recommend an academic-integrity interview before grading, per the assessment policy.' : 'No significant similarity detected in this cohort.',
          'Repeat-submission similarity trends are available to the owning tenant only; cross-college identities stay masked.',
        ]} />
      </div>
    </Panel>
  );
}

export default function LMS({ user }) {
  const [college, setCollege] = useState(user?.role === 'partner' ? user.college_code : (user?.role === 'cadet' ? 'ALL' : 'ALL'));
  const [report, setReport] = useState(null);
  const { data } = useExt(`/ext/lms?college=${college}`);
  if (!data) return <Loading text="Loading LMS…" />;

  const byCollege = {};
  data.courses.forEach((c) => { (byCollege[c.college] ||= []).push(c); });

  return (
    <>
      <PageHeader title="Learning Management"
        subtitle="20 live courses across four College tenants · originality screening on submission · Safe Exam Browser high-stakes quizzes"
        right={<InstitutionSwitcher user={user} college={college} onChange={setCollege} />} />

      {report ? <Originality code={report} user={user} onClose={() => setReport(null)} /> : (
        <>
          {Object.entries(byCollege).map(([collegeName, courses]) => (
            <Panel key={collegeName} title={collegeName} sub={`${courses[0].tenant} tenant · ${courses.length} courses`} style={{ marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {courses.map((c) => (
                  <div key={c.course_code} style={{ background: 'var(--app-surface-soft)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--app-panel-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <b style={{ fontSize: 13.5, color: 'var(--app-text)' }}>{c.course_code} — {c.title}</b>
                      <span style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>{c.enrolled} enrolled</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginBottom: 8 }}>{c.instructor} · {c.schedule} · avg grade {c.avg_grade || '—'}%</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {c.activities.map((a) => (
                        <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--app-text-muted)' }}>
                          <span>{ACT_ICON[a.type]}</span>
                          <span style={{ flex: 1 }}>{a.name}{a.type === 'quiz' ? ` · ${a.questions} questions` : a.type === 'assignment' ? ` · ${a.submissions} submissions` : ` · ${a.sessions} sessions · ${a.avg_pct}% attendance`}</span>
                          {a.seb && <StatusChip kind="danger">SEB REQUIRED</StatusChip>}
                          {a.originality && (
                            <button className="app-timeframe-btn" onClick={() => setReport(c.course_code)}>Originality</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
          <Advisory items={[
            'Engagement is a leading indicator: cohorts below 85% attendance track ~8% lower on quiz scores — nudge low-engagement cadets via the cadet app.',
            'MS201 Quiz 1 enforces Safe Exam Browser (REQ-LAA-005); exam-integrity events feed the split-SIEM like every other platform.',
            'Grade edits here flow to the SIS transcript via GradeSync (30 s) and re-rank the Order of Merit — try Faculty Grade Entry in the SIS.',
          ]} />
        </>
      )}
    </>
  );
}
