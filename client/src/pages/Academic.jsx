import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoGrad, IcoAttendance, IcoAlert, IcoActivity, IcoBook, IcoCpu } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, ProgressBar } from '../components/ui';
import { TrendChart, Bars, C } from '../components/charts';
import PortalBar from '../components/PortalBar';
import { PORTALS } from '../config/portals';
import KPIDetailPanel from '../components/KPIDetailPanel';

export default function Academic() {
  const { data, error } = useApi('/academic');
  const [detail, setDetail] = useState(null);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text="Loading academic domain…" />;
  const k = data.kpis;

  return (
    <>
      <PortalBar portals={PORTALS.academic} />
      <PageHeader
        title="Academics & Learning"
        subtitle="SIS · LMS · Library & Labs · AI-enabled learning — partner rosters via single push from ZMU SIS (flow 1)"
        right={<StatusChip kind="success">SIS ↔ LMS SYNC &lt; 15 MIN</StatusChip>}
      />

      <KPIGrid>
        <KPICard label="Enrolled Cadets" value={fmt.int(k.enrolled)} icon={<IcoGrad />} rag="normal"
          subValues={[{ label: 'Capacity', value: '2,100 named' }]}
          onClick={() => setDetail({
            title: 'Enrolled Cadets', subtitle: `${k.enrolled} enrolled · sized for 2,100 named cadets`, source: 'SIS',
            content: (
              <DataTable
                columns={[
                  { key: 'program', label: 'Program' },
                  { key: 'partner', label: 'Partner' },
                  { key: 'enrolled', label: 'Enrolled', align: 'right' },
                ]}
                rows={data.programs} />
            ),
          })} />
        <KPICard label="Average GPA" value={k.avgGpa} unit="/ 4.0" icon={<IcoGrad />} trend={2.4} rag="normal"
          onClick={() => setDetail({
            title: 'Average GPA', subtitle: `${k.avgGpa} / 4.0 cohort average`, source: 'SIS — Academic Records',
            content: <TrendChart data={data.gpaTerms} x="term" height={200}
              series={[{ key: 'avg_gpa', name: 'Avg GPA', color: C.blue, area: true }]} />,
          })} />
        <KPICard label="Attendance" value={`${k.attendance}%`} icon={<IcoAttendance />} rag={k.attendance < 90 ? 'warning' : 'normal'}
          subValues={[{ label: 'Source', value: 'Facial recognition T&A' }]}
          onClick={() => setDetail({
            title: 'Attendance', subtitle: `${k.attendance}% cohort average`, source: 'Facial Recognition T&A',
            content: (
              <DataTable
                columns={[
                  { key: 'program', label: 'Program' },
                  { key: 'avg_attendance', label: 'Attend %', align: 'right' },
                ]}
                rows={data.programs} />
            ),
          })} />
        <KPICard label="At-Risk Cadets" value={k.atRisk} icon={<IcoAlert />} rag={k.atRisk > 20 ? 'critical' : 'warning'}
          subValues={[{ label: 'Detection', value: 'Predictive model' }]}
          onClick={() => setDetail({
            title: 'At-Risk Cadets', subtitle: `${k.atRisk} flagged by the AI student-success model`, source: 'AI Predictive Analytics',
            stats: [
              { label: 'At-risk', value: k.atRisk, sub: 'of 300 cadets', tone: 'down' },
              { label: 'Avg GPA', value: k.avgGpa },
              { label: 'Attendance', value: `${k.attendance}%` },
            ],
            content: <Bars data={data.atRiskByProgram} x="full" layout="vertical" height={220} hideLegend
              series={[{ key: 'atRisk', name: 'At-risk', color: C.red }]} />,
          })} />
        <KPICard label="LMS Active Today" value={`${k.lmsActivePct}%`} icon={<IcoActivity />} trend={4.1} rag="normal"
          subValues={[{ label: 'AI queries', value: fmt.int(k.aiQueriesToday) }]}
          onClick={() => setDetail({
            title: 'LMS Active Today', subtitle: `${k.lmsActivePct}% of named users active · ${fmt.int(k.aiQueriesToday)} AI queries today`, source: 'LMS · xAPI',
            stats: [
              { label: 'Active today', value: `${k.lmsActivePct}%`, tone: 'up' },
              { label: 'AI queries', value: fmt.int(k.aiQueriesToday), sub: 'today' },
              { label: 'Lab util', value: `${k.labUtilization}%` },
            ],
            content: <TrendChart data={data.lms30d} x="date" height={220}
              series={[
                { key: 'active', name: 'Active users', color: C.blue, area: true },
                { key: 'aiQueries', name: 'AI queries', color: C.violet },
              ]} />,
          })} />
        <KPICard label="Lab Utilization" value={`${k.labUtilization}%`} icon={<IcoCpu />} rag="normal"
          subValues={[{ label: 'Library loans', value: k.libraryLoans }]}
          onClick={() => setDetail({
            title: 'Lab Utilization', subtitle: `${k.labUtilization}% average across 27 labs`, source: 'Lab Systems',
            content: data.labs.map((l) => (
              <div key={l.lab} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--app-text)' }}>{l.lab}</span>
                  <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{l.utilization_pct}%</span>
                </div>
                <ProgressBar pct={l.utilization_pct} />
              </div>
            )),
          })} />
      </KPIGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="LMS Engagement — 30 Days" sub="Active users, submissions and AI learning-assistant usage (xAPI → data lake)">
          <TrendChart data={data.lms30d} x="date" height={230}
            series={[
              { key: 'active', name: 'Active users', color: C.blue, area: true },
              { key: 'aiQueries', name: 'AI assistant queries', color: C.violet },
              { key: 'submissions', name: 'Submissions', color: C.green },
            ]} />
        </Panel>
        <Panel title="Academic Trajectory" sub="Term-over-term GPA and composite score">
          <TrendChart data={data.gpaTerms} x="term" height={230}
            series={[
              { key: 'avg_gpa', name: 'Avg GPA', color: C.blue },
              { key: 'composite_avg', name: 'Composite avg', color: C.amber },
            ]}
            rightAxisKeys={['composite_avg']} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title="Academic Programmes" sub="Delivered across Zayed Military University's four academic colleges · single cadet record">
          <DataTable
            columns={[
              { key: 'program', label: 'Programme' },
              { key: 'enrolled', label: 'Enrolled', align: 'right' },
              { key: 'avg_gpa', label: 'Avg GPA', align: 'right' },
              { key: 'avg_attendance', label: 'Attend %', align: 'right' },
              { key: 'at_risk', label: 'At-Risk', align: 'right', render: (v) => <span style={{ color: v > 8 ? 'var(--app-danger)' : 'var(--app-warning)', fontWeight: 700 }}>{v}</span> },
            ]}
            rows={data.programs} />
        </Panel>
        <Panel title="At-Risk by Program" sub="AI student-success model — early intervention queue">
          <Bars data={data.atRiskByProgram} x="full" layout="vertical" height={230} hideLegend
            series={[{ key: 'atRisk', name: 'At-risk', color: C.red }]} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Panel title="Lab Systems" sub="Teaching labs across ZMU's academic colleges">
          {data.labs.map((l) => (
            <div key={l.lab} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                <span style={{ color: 'var(--app-text)' }}>{l.lab} <span style={{ color: 'var(--app-text-faint)' }}>· {l.workstations} ws</span></span>
                <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>
                  {l.utilization_pct}%{l.faults_open > 0 && <span style={{ color: 'var(--app-danger)' }}> · {l.faults_open} faults</span>}
                </span>
              </div>
              <ProgressBar pct={l.utilization_pct} />
            </div>
          ))}
        </Panel>

        <Panel title="Library IT Systems" sub="ILS · RFID kiosks · security gates">
          <DataTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value', align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{typeof v === 'number' ? v.toLocaleString() : v}</b> },
            ]}
            rows={data.library} />
        </Panel>

        <Panel title="Order of Merit — Top 8" sub="Composite ranking per RFP formula (auditable)">
          <DataTable
            columns={[
              { key: 'order_of_merit', label: '#', render: (v) => <b style={{ color: '#3b7de8' }}>{v}</b> },
              { key: 'name', label: 'Cadet' },
              { key: 'squadron', label: 'Sqn' },
              { key: 'composite_score', label: 'Composite', align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{v}</b> },
              { key: 'gpa', label: 'GPA', align: 'right' },
            ]}
            rows={data.meritTop} />
        </Panel>
      </div>

      <KPIDetailPanel open={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.subtitle} source={detail?.source} stats={detail?.stats}>
        {detail?.content}
      </KPIDetailPanel>
    </>
  );
}
