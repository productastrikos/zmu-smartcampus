/**
 * SiA Agent — fixed-response knowledge base (no external LLM call).
 * Two modes: 'generic' (campus-wide) and 'erp' (Enterprise/ERP+HRMS focused).
 * Each entry matches on keywords against the user's message; answer() receives
 * live API snapshots so replies interpolate real numbers from /api/overview
 * and /api/enterprise, making the canned responses feel current.
 */

const genericEntries = [
  {
    keywords: ['hello', 'hi', 'hey', 'help', 'what can you do'],
    question: 'What can you help me with?',
    answer: () =>
      "I'm SiA — the Smart Digital Campus assistant. Ask me about cadet attendance, readiness scores, campus energy, security alerts, budget, or any of the four domains (Learning & Academic, Military Readiness, Enterprise & Data, Campus & Smart Ops).",
  },
  {
    keywords: ['attendance', 'cadet attendance'],
    question: 'What is the current cadet attendance?',
    answer: (d) => `Average cadet attendance is ${d.overview?.kpis.attendanceAvg ?? '—'}%, sourced from facial-recognition time & attendance across all campus zones and synced to the SIS.`,
  },
  {
    keywords: ['readiness', 'composite', 'hpo', 'fitness'],
    question: 'What is the cadet readiness score right now?',
    answer: (d) => `Composite readiness across the cohort is ${d.overview?.kpis.compositeReadiness ?? '—'}/100 (40% GPA, 25% military score, 25% fitness, 10% conduct). Wearable-derived readiness from Garmin devices is ${d.overview?.kpis.wearableReadiness ?? '—'}/100.`,
  },
  {
    keywords: ['garmin', 'wearable', 'watch', 'device sync'],
    question: 'How is Garmin wearable data being used?',
    answer: () =>
      'Every cadet is issued a Garmin device. Daily HRV, sleep, training load, SpO2 and body battery pull via the Garmin Health API into a consent-governed middleware layer, then feed the HPO platform. We flag cadets with an acute:chronic workload ratio (ACWR) above 1.4 for early injury-risk intervention — see the Military Readiness module for the live queue.',
  },
  {
    keywords: ['energy', 'kwh', 'power'],
    question: 'What is campus energy consumption today?',
    answer: (d) => `Campus-wide energy draw over the last 24h is ${d.overview?.kpis.energyTodayKwh?.toLocaleString?.() ?? d.overview?.kpis.energyTodayKwh ?? '—'} kWh (${d.overview?.kpis.energyDeltaPct >= 0 ? '+' : ''}${d.overview?.kpis.energyDeltaPct ?? '—'}% vs the prior 24h), from BMS telemetry across all 12 buildings.`,
  },
  {
    keywords: ['bms', 'building management', 'hvac', 'temperature', 'occupancy'],
    question: 'What does the BMS module monitor?',
    answer: (d) => `The BMS supervisory layer ingests temperature, humidity, CO₂, occupancy, energy and water across all 12 buildings via a one-way data diode. Current campus occupancy is ${d.overview?.kpis.occupancyNow ?? '—'}%. It's a vendor-neutral overlay on the base-build BMS — see Campus & Smart Ops or the Digital Twin for live per-building data and active alarms.`,
  },
  {
    keywords: ['alert', 'alarm', 'incident', 'critical'],
    question: 'Are there any critical alerts right now?',
    answer: (d) => `There are ${d.overview?.kpis.criticalAlerts ?? '—'} critical/high alerts open out of ${d.overview?.kpis.openAlerts ?? '—'} total open. Open the bell icon in the header for the full cross-domain feed, correlated across BMS, security, readiness and integration events.`,
  },
  {
    keywords: ['security', 'siem', 'cyber', 'breach'],
    question: 'What is the current security posture?',
    answer: () =>
      'The split-SIEM (on-prem collection, sovereign-cloud analytics) ingests syslog RFC 5424 / CEF from every platform. See Security Operations for the live event timeline, open incidents and network segmentation across RED/YELLOW/ORANGE/GREY.',
  },
  {
    keywords: ['weapon', 'wms', 'armoury', 'armory'],
    question: 'How does weapon tracking work?',
    answer: () =>
      'The Weapon Management System (WMS) binds every issue/return transaction to a cadet ID at the Z09 armoury. Weapons outstanding beyond the expected window are flagged overdue automatically — see Campus & Smart Ops for the live reconciliation queue.',
  },
  {
    keywords: ['integration', 'data flow', 'diode', 'cadet id'],
    question: 'How is data integrated across systems?',
    answer: () =>
      "A single immutable Cadet ID is issued at enrolment by IAM and propagated to SIS, LMS, HPO and physical access via joiner-mover-leaver provisioning. OT telemetry (BMS/IoT) flows one-way into the data platform via a hardware diode. See Integration & Data Platform for the live status of all 8 governed data flows.",
  },
  {
    keywords: ['digital twin', 'twin', 'building'],
    question: 'What is the Campus Digital Twin?',
    answer: () =>
      "It's a live supervisory view of all 9 campus zones built on BIM/IFC geometry. Click any building to drill into its MEP assets, 24h environmental telemetry and physical security — try the Campus Digital Twin page in the sidebar.",
  },
  {
    keywords: ['thanks', 'thank you', 'bye'],
    question: 'Thanks!',
    answer: () => "You're welcome. I'm always here in the corner if you need anything else.",
  },
];

const erpEntries = [
  {
    keywords: ['hello', 'hi', 'hey', 'help', 'what can you do'],
    question: 'What can you help me with?',
    answer: () =>
      "I'm the SiA ERP Assistant. Ask me about budget utilization, procurement status, headcount, attrition, cash flow, or the DoF statutory interface.",
  },
  {
    keywords: ['budget', 'muwazana', 'utilization'],
    question: 'What is our current budget utilization?',
    answer: (d) => `Overall Muwazana budget utilization is ${d.enterprise?.kpis.budgetUsedPct ?? '—'}% against the ${d.enterprise?.kpis.budgetTotal ?? '—'}M AED total budget — versus a 50% mid-year plan. Check Enterprise & Data Continuity for the cost-center breakdown.`,
  },
  {
    keywords: ['procurement', 'purchase order', 'po', 'pending approval'],
    question: 'How many purchase orders are pending?',
    answer: (d) => `There are ${d.enterprise?.kpis.posPendingApproval ?? '—'} POs pending approval, with ${d.enterprise?.kpis.openPoValue ?? '—'}M AED in open PO value across the pipeline (Draft → Paid).`,
  },
  {
    keywords: ['headcount', 'staff', 'employees', 'workforce'],
    question: 'What is our current headcount?',
    answer: (d) => `Current headcount is ${d.enterprise?.kpis.headcount ?? '—'} against an establishment of ${d.enterprise?.kpis.establishment ?? '—'}, leaving ${d.enterprise?.kpis.vacancies ?? '—'} vacancies. Outsourced manpower accounts for ${d.enterprise?.kpis.outsourced ?? '—'} of that headcount.`,
  },
  {
    keywords: ['attrition', 'turnover', 'resign'],
    question: 'What is the attrition rate?',
    answer: (d) => `Average attrition across departments is ${d.enterprise?.kpis.attrition ?? '—'}%. Facilities & Campus Ops and ICT & Digital Services run the highest, largely driven by outsourced-manpower turnover.`,
  },
  {
    keywords: ['hrms', 'recruitment', 'hiring', 'onboarding'],
    question: 'How does the HRMS recruitment pipeline look?',
    answer: () =>
      'The HRMS covers the full hire-to-retire lifecycle: manpower request → approved vacancy → shortlist → interview → security clearance → offer → onboarding. See the Recruitment Funnel panel in Enterprise & Data for live counts at each stage.',
  },
  {
    keywords: ['cash', 'cashflow', 'treasury', 'inflow', 'outflow'],
    question: 'What does our cash flow look like?',
    answer: () =>
      'Treasury tracks monthly inflow, outflow and Department of Finance transfers over a rolling 12 months — see the Cash Flow chart in Enterprise & Data Continuity.',
  },
  {
    keywords: ['dof', 'department of finance', 'statutory'],
    question: 'How does the DoF interface work?',
    answer: () =>
      'The ERP pushes a statutory interface to the Department of Finance (chart of accounts, GL postings, budget transfers) on a scheduled batch each night, governed by an approved ICD.',
  },
  {
    keywords: ['room', 'scheduling', 'booking', 'space'],
    question: 'What is room utilization like?',
    answer: (d) => `Average room/space utilization across classrooms, labs, meeting rooms and training grounds is ${d.enterprise?.kpis.roomUtilization ?? '—'}%, from the Enterprise Master Scheduling module.`,
  },
  {
    keywords: ['supplier', 'vendor'],
    question: 'How are suppliers managed?',
    answer: () =>
      'The ERP supplier portal covers prequalification, EOI/RFQ/RFP responses, PO issuance and invoice matching — every supplier interaction is tied to the master supplier record for a single source of truth.',
  },
  {
    keywords: ['thanks', 'thank you', 'bye'],
    question: 'Thanks!',
    answer: () => "Happy to help — ping me anytime you need an ERP number.",
  },
];

function match(entries, text) {
  const lower = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const e of entries) {
    const score = e.keywords.reduce((s, k) => s + (lower.includes(k) ? k.length : 0), 0);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return bestScore > 0 ? best : null;
}

export function askSia(mode, text, ctx) {
  const entries = mode === 'erp' ? erpEntries : genericEntries;
  const hit = match(entries, text);
  if (hit) return hit.answer(ctx || {});
  // No keyword match — answer with a randomly shuffled fixed response so the
  // agent always returns something useful (demo mode, no live LLM).
  const pool = entries.filter((e) => !e.keywords.includes('hello') && !e.keywords.includes('thanks'));
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const prefix = mode === 'erp'
    ? "I don't have that exact figure, but here's a related ERP insight: "
    : "I don't have that exact answer, but here's something relevant: ";
  return prefix + pick.answer(ctx || {});
}

export function suggestedQuestions(mode) {
  const entries = mode === 'erp' ? erpEntries : genericEntries;
  return entries.filter((e) => !e.keywords.includes('hello')).slice(0, 6).map((e) => e.question);
}
