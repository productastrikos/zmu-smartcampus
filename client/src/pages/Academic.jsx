import React, { useState } from 'react';
import { useApi, fmt } from '../services/api';
import KPICard, { IcoGrad, IcoAttendance, IcoAlert, IcoActivity, IcoBook, IcoCpu } from '../components/KPICard';
import { Panel, StatusChip, sevChip, Loading, PageHeader, KPIGrid, DataTable, ProgressBar } from '../components/ui';
import { TrendChart, Bars, C } from '../components/charts';
import KPIDetailPanel from '../components/KPIDetailPanel';
import ModuleLauncher from '../components/ModuleLauncher';
import SourceLink from '../components/SourceLink';
import { PORTALS } from '../config/portals';
import { useLang } from '../i18n';

const ACADEMIC_MODULES = [
  { slug: 'sis', labelKey: 'launcher.sis' },
  { slug: 'lms', labelKey: 'launcher.lms' },
  { slug: 'merit', labelKey: 'launcher.merit' },
  { slug: 'cadet-journey', labelKey: 'launcher.cadetJourney' },
];

export default function Academic() {
  const { data, error } = useApi('/academic');
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [detail, setDetail] = useState(null);
  if (error) return <Panel title="Error">{String(error)}</Panel>;
  if (!data) return <Loading text={ar ? 'جارٍ تحميل المجال الأكاديمي…' : 'Loading academic domain…'} />;
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title={ar ? 'الأكاديميات والتعلّم' : 'Academics & Learning'}
        subtitle={ar ? 'نظام معلومات الطلبة · إدارة التعلّم · المكتبة والمختبرات · تعلّم مدعوم بالذكاء الاصطناعي — قوائم الشركاء عبر دفعة واحدة من نظام الطلبة' : 'SIS · LMS · Library & Labs · AI-enabled learning — partner rosters via single push from ZMU SIS (flow 1)'}
        right={<StatusChip kind="success">{ar ? 'مزامنة SIS ↔ LMS أقل من ١٥ دقيقة' : 'SIS ↔ LMS SYNC < 15 MIN'}</StatusChip>}
      />

      {/* Redirect out to the real source portals (above the KPIs) */}
      <SourceLink portals={PORTALS.academic} />

      <KPIGrid>
        <KPICard label={ar ? 'الطلبة المسجّلون' : 'Enrolled Cadets'} value={fmt.int(k.enrolled)} icon={<IcoGrad />} rag="normal"
          subValues={[{ label: ar ? 'السعة' : 'Capacity', value: ar ? '٢٬١٠٠ مُسمّى' : '2,100 named' }]}
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
        <KPICard label={ar ? 'المعدل التراكمي' : 'Average GPA'} value={k.avgGpa} unit="/ 4.0" icon={<IcoGrad />} trend={2.4} rag="normal"
          onClick={() => setDetail({
            title: 'Average GPA', subtitle: `${k.avgGpa} / 4.0 cohort average`, source: 'SIS — Academic Records',
            content: <TrendChart data={data.gpaTerms} x="term" height={200}
              series={[{ key: 'avg_gpa', name: 'Avg GPA', color: C.blue, area: true }]} />,
          })} />
        <KPICard label={ar ? 'الحضور' : 'Attendance'} value={`${k.attendance}%`} icon={<IcoAttendance />} rag={k.attendance < 90 ? 'warning' : 'normal'}
          subValues={[{ label: ar ? 'المصدر' : 'Source', value: ar ? 'التعرّف على الوجه' : 'Facial recognition T&A' }]}
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
        <KPICard label={ar ? 'الطلبة المعرّضون للخطر' : 'At-Risk Cadets'} value={k.atRisk} icon={<IcoAlert />} rag={k.atRisk > 20 ? 'critical' : 'warning'}
          subValues={[{ label: ar ? 'الكشف' : 'Detection', value: ar ? 'نموذج تنبّؤي' : 'Predictive model' }]}
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
        <KPICard label={ar ? 'نشاط إدارة التعلّم اليوم' : 'LMS Active Today'} value={`${k.lmsActivePct}%`} icon={<IcoActivity />} trend={4.1} rag="normal"
          subValues={[{ label: ar ? 'استعلامات الذكاء الاصطناعي' : 'AI queries', value: fmt.int(k.aiQueriesToday) }]}
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
        <KPICard label={ar ? 'استخدام المختبرات' : 'Lab Utilization'} value={`${k.labUtilization}%`} icon={<IcoCpu />} rag="normal"
          subValues={[{ label: ar ? 'إعارات المكتبة' : 'Library loans', value: k.libraryLoans }]}
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

      {/* Module launch buttons — below the KPIs (open in a new tab) */}
      <ModuleLauncher items={ACADEMIC_MODULES} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title={ar ? 'تفاعل إدارة التعلّم — ٣٠ يومًا' : 'LMS Engagement — 30 Days'} sub={ar ? 'المستخدمون النشطون والتسليمات واستخدام مساعد التعلّم الذكي' : 'Active users, submissions and AI learning-assistant usage (xAPI → data lake)'}>
          <TrendChart data={data.lms30d} x="date" height={230}
            series={[
              { key: 'active', name: ar ? 'المستخدمون النشطون' : 'Active users', color: C.blue, area: true },
              { key: 'aiQueries', name: ar ? 'استعلامات المساعد الذكي' : 'AI assistant queries', color: C.violet },
              { key: 'submissions', name: ar ? 'التسليمات' : 'Submissions', color: C.green },
            ]} />
        </Panel>
        <Panel title={ar ? 'المسار الأكاديمي' : 'Academic Trajectory'} sub={ar ? 'المعدل التراكمي والدرجة المركّبة فصلًا بعد فصل' : 'Term-over-term GPA and composite score'}>
          <TrendChart data={data.gpaTerms} x="term" height={230}
            series={[
              { key: 'avg_gpa', name: ar ? 'المعدل التراكمي' : 'Avg GPA', color: C.blue },
              { key: 'composite_avg', name: ar ? 'متوسط المركّبة' : 'Composite avg', color: C.amber },
            ]}
            rightAxisKeys={['composite_avg']} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
        <Panel title={ar ? 'البرامج الأكاديمية' : 'Academic Programmes'} sub={ar ? 'تُقدَّم عبر الكليات الأكاديمية الأربع لجامعة زايد العسكرية · سجل طالب واحد' : "Delivered across Zayed Military University's four academic colleges · single cadet record"}>
          <DataTable
            columns={[
              { key: 'program', label: ar ? 'البرنامج' : 'Programme' },
              { key: 'enrolled', label: ar ? 'المسجّلون' : 'Enrolled', align: 'right' },
              { key: 'avg_gpa', label: ar ? 'المعدل' : 'Avg GPA', align: 'right' },
              { key: 'avg_attendance', label: ar ? 'الحضور ٪' : 'Attend %', align: 'right' },
              { key: 'at_risk', label: ar ? 'معرّض للخطر' : 'At-Risk', align: 'right', render: (v) => <span style={{ color: v > 8 ? 'var(--app-danger)' : 'var(--app-warning)', fontWeight: 700 }}>{v}</span> },
            ]}
            rows={data.programs} />
        </Panel>
        <Panel title={ar ? 'المعرّضون للخطر حسب البرنامج' : 'At-Risk by Program'} sub={ar ? 'نموذج نجاح الطلبة الذكي — قائمة التدخّل المبكر' : 'AI student-success model — early intervention queue'}>
          <Bars data={data.atRiskByProgram} x="full" layout="vertical" height={230} hideLegend
            series={[{ key: 'atRisk', name: ar ? 'معرّض للخطر' : 'At-risk', color: C.red }]} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Panel title={ar ? 'أنظمة المختبرات' : 'Lab Systems'} sub={ar ? 'مختبرات التدريس عبر الكليات الأكاديمية بالجامعة' : "Teaching labs across ZMU's academic colleges"}>
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

        <Panel title={ar ? 'أنظمة تقنية المكتبة' : 'Library IT Systems'} sub={ar ? 'نظام المكتبة المتكامل · أكشاك RFID · بوابات الأمن' : 'ILS · RFID kiosks · security gates'}>
          <DataTable
            columns={[
              { key: 'metric', label: ar ? 'المؤشر' : 'Metric' },
              { key: 'value', label: ar ? 'القيمة' : 'Value', align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{typeof v === 'number' ? v.toLocaleString() : v}</b> },
            ]}
            rows={data.library} />
        </Panel>

        <Panel title={ar ? 'ترتيب الجدارة — أفضل ٨' : 'Order of Merit — Top 8'} sub={ar ? 'الترتيب المركّب حسب صيغة الطرح (قابل للتدقيق)' : 'Composite ranking per RFP formula (auditable)'}>
          <DataTable
            columns={[
              { key: 'order_of_merit', label: '#', render: (v) => <b style={{ color: '#3b7de8' }}>{v}</b> },
              { key: 'name', label: ar ? 'الطالب' : 'Cadet' },
              { key: 'squadron', label: ar ? 'السرية' : 'Sqn' },
              { key: 'composite_score', label: ar ? 'المركّبة' : 'Composite', align: 'right', render: (v) => <b style={{ color: 'var(--app-text)' }}>{v}</b> },
              { key: 'gpa', label: ar ? 'المعدل' : 'GPA', align: 'right' },
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
