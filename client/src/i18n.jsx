import React, { createContext, useContext, useEffect, useState } from 'react';

/* Lightweight bilingual layer (English / Arabic) with RTL, mirroring the
   AR/EN switch on zmu.ac.ae. Strings are keyed; t(key) falls back to English,
   then to the key itself, so untranslated UI never breaks. */

const STR = {
  // ── brand / chrome ──
  'app.university': { en: 'Zayed Military University', ar: 'جامعة زايد العسكرية' },
  'app.platform': { en: 'Smart Digital Campus', ar: 'الحرم الرقمي الذكي' },
  'app.restricted': { en: 'Restricted · ZMU Smart Digital Campus · Demonstration Environment — Synthetic Data', ar: 'سري · الحرم الرقمي الذكي بجامعة زايد العسكرية · بيئة عرض توضيحي — بيانات اصطناعية' },
  'app.signout': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'app.aiAdvisory': { en: 'AI Advisory', ar: 'استشارة الذكاء الاصطناعي' },
  'app.alerts': { en: 'Alerts', ar: 'التنبيهات' },
  'app.msi': { en: 'MSI POC · ZMU-MSI-RFP-2026', ar: 'إثبات مفهوم المُكامل الرئيسي · ZMU-MSI-RFP-2026' },
  'app.governed': { en: 'Master Systems Integrator · Governed exchange backbone', ar: 'المُكامل الرئيسي للأنظمة · العمود الفقري للتبادل المُحوكم' },

  // ── nav sections ──
  'nav.overview': { en: 'Overview', ar: 'نظرة عامة' },
  'nav.academicCore': { en: 'Academic Core', ar: 'النواة الأكاديمية' },
  'nav.readinessStreams': { en: 'Readiness Streams', ar: 'مسارات الجاهزية' },
  'nav.coreModules': { en: 'Core Modules', ar: 'الوحدات الأساسية' },
  'nav.platform': { en: 'Platform', ar: 'المنصة' },

  // ── nav / page titles ──
  'page.executive': { en: 'Executive Overview', ar: 'النظرة التنفيذية' },
  'page.command': { en: 'Command Center', ar: 'مركز القيادة' },
  'page.twin': { en: 'Campus Digital Twin', ar: 'التوأم الرقمي للحرم' },
  'page.academic': { en: 'Academics & Learning', ar: 'الأكاديميات والتعلّم' },
  'page.readiness': { en: 'Readiness & Performance', ar: 'الجاهزية والأداء' },
  'page.enterprise': { en: 'Enterprise & Finance', ar: 'المؤسسة والمالية' },
  'page.campus': { en: 'Smart Campus Operations', ar: 'عمليات الحرم الذكي' },
  'page.iot': { en: 'IoT Sensors & Devices', ar: 'حساسات وأجهزة إنترنت الأشياء' },
  'page.incidents': { en: 'Incident Management — CCTV', ar: 'إدارة الحوادث — المراقبة' },
  'page.sis': { en: 'Student Information System', ar: 'نظام معلومات الطلبة' },
  'page.lms': { en: 'Learning Management', ar: 'إدارة التعلّم' },
  'page.merit': { en: 'Composite & Order of Merit', ar: 'الدرجة المركّبة وترتيب الجدارة' },
  'page.hpo': { en: 'HPO Fitness & Readiness', ar: 'اللياقة والجاهزية' },
  'page.military': { en: 'Military Training Record', ar: 'سجل التدريب العسكري' },
  'page.conduct': { en: 'Conduct & Discipline', ar: 'السلوك والانضباط' },
  'page.cadetJourney': { en: 'Cadet Journey', ar: 'رحلة الطالب' },
  'page.itops': { en: 'Enterprise IT & DCIM', ar: 'تقنية المعلومات المؤسسية و DCIM' },
  'page.security': { en: 'Security Operations', ar: 'عمليات الأمن' },
  'page.integration': { en: 'Integration & Data', ar: 'التكامل والبيانات' },

  // ── roles ──
  'role.executive': { en: 'Executive', ar: 'تنفيذي' },
  'role.superadmin': { en: 'Super Admin', ar: 'المشرف العام' },

  // ── login ──
  'login.title': { en: 'Sign in', ar: 'تسجيل الدخول' },
  'login.subtitle': { en: 'Access the ZMU Smart Digital Campus platform.', ar: 'الدخول إلى منصة الحرم الرقمي الذكي بجامعة زايد العسكرية.' },
  'login.chooseRole': { en: 'Choose a role to sign in', ar: 'اختر دورًا لتسجيل الدخول' },
  'login.execDesc': { en: 'High-level KPIs & AI insights for senior leadership', ar: 'مؤشرات عالية المستوى ورؤى الذكاء الاصطناعي للقيادة العليا' },
  'login.adminDesc': { en: 'Full access to every module and page', ar: 'وصول كامل لكل وحدة وصفحة' },
  'login.role': { en: 'Role', ar: 'الدور' },
  'login.rolePlaceholder': { en: 'Select your role', ar: 'اختر دورك' },
  'login.username': { en: 'Username', ar: 'اسم المستخدم' },
  'login.usernamePlaceholder': { en: 'Enter username', ar: 'أدخل اسم المستخدم' },
  'login.password': { en: 'Password', ar: 'كلمة المرور' },
  'login.passwordPlaceholder': { en: 'Enter password', ar: 'أدخل كلمة المرور' },
  'login.signIn': { en: 'Sign in', ar: 'تسجيل الدخول' },
  'login.or': { en: 'or', ar: 'أو' },
  'login.uaepass': { en: 'Continue with UAE Pass / SSO', ar: 'المتابعة عبر الهوية الرقمية / الدخول الموحد' },
  'login.tabSso': { en: 'SSO', ar: 'الدخول الموحد' },
  'login.tabPassword': { en: 'Username & Password', ar: 'اسم المستخدم وكلمة المرور' },
  'login.ssoHint': { en: 'Choose your role, then continue with UAE Pass / SSO — no password needed.', ar: 'اختر دورك، ثم تابع عبر الهوية الرقمية / الدخول الموحد — دون الحاجة لكلمة مرور.' },
  'login.credsHint': { en: 'Demo accounts — executive / executive · superadmin / superadmin', ar: 'حسابات تجريبية — executive / executive · superadmin / superadmin' },

  // ── status (RAG chips come from API data in English) ──
  'status.normal': { en: 'Normal', ar: 'طبيعي' },
  'status.warning': { en: 'Warning', ar: 'تحذير' },
  'status.critical': { en: 'Critical', ar: 'حرج' },
  'status.online': { en: 'Online', ar: 'متصل' },
  'status.offline': { en: 'Offline', ar: 'غير متصل' },
  'status.degraded': { en: 'Degraded', ar: 'متدهور' },
  'status.fault': { en: 'Fault', ar: 'عطل' },
  'status.healthy': { en: 'Healthy', ar: 'سليم' },

  // ── Executive Overview ──
  'exec.subtitle': { en: 'A plain-language snapshot for senior leadership — click any KPI for a one-line explanation and the detail behind it.', ar: 'لمحة بلغة واضحة للقيادة العليا — انقر على أي مؤشر لعرض شرح موجز والتفاصيل خلفه.' },
  'exec.kpi.composite': { en: 'Composite Readiness', ar: 'الجاهزية المركّبة' },
  'exec.kpi.wellbeing': { en: 'Cadet Wellbeing', ar: 'صحة الطلبة' },
  'exec.kpi.openIssues': { en: 'Open Issues', ar: 'المسائل المفتوحة' },
  'exec.kpi.systemsHealth': { en: 'Systems Health', ar: 'صحة الأنظمة' },
  'exec.kpi.occupancy': { en: 'Campus Occupancy', ar: 'إشغال الحرم' },
  'exec.kpi.availability': { en: 'Platform Availability', ar: 'توافر المنصة' },
  'exec.sub.cadets': { en: 'Cadets', ar: 'الطلبة' },
  'exec.sub.source': { en: 'Source', ar: 'المصدر' },
  'exec.sub.trackers': { en: 'Fitness trackers', ar: 'أجهزة تتبّع اللياقة' },
  'exec.sub.totalOpen': { en: 'Total open', ar: 'إجمالي المفتوح' },
  'exec.sub.systems': { en: 'Systems', ar: 'الأنظمة' },
  'exec.sub.energyToday': { en: 'Energy today', ar: 'الطاقة اليوم' },
  'exec.sub.attendance': { en: 'Attendance', ar: 'الحضور' },
  'exec.panel.usageEnergy': { en: 'Building Usage vs Energy — 24h', ar: 'استخدام المباني مقابل الطاقة — ٢٤ ساعة' },
  'exec.panel.usageEnergySub': { en: 'How campus usage compares with how much energy it takes to run', ar: 'مقارنة استخدام الحرم بكمية الطاقة اللازمة لتشغيله' },
  'exec.panel.wellbeingTrend': { en: 'Cadet Wellbeing Trend', ar: 'اتجاه صحة الطلبة' },
  'exec.panel.wellbeingTrendSub': { en: 'Daily wellbeing score across the cohort, most recent period', ar: 'درجة الصحة اليومية عبر الدفعة، أحدث فترة' },
  'exec.aiSub': { en: 'SiA — rotating executive brief', ar: 'المساعد الذكي — موجز تنفيذي متجدّد' },
  'exec.panel.programme': { en: 'Programme Health', ar: 'صحة البرنامج' },
  'exec.panel.programmeSub': { en: 'Four areas leadership tracks, at a glance', ar: 'أربعة مجالات تتابعها القيادة، في لمحة' },

  // ── Command Center ──
  'cc.title': { en: 'Campus Command Center', ar: 'مركز قيادة الحرم' },
  'cc.subtitle': { en: 'Unified operational picture across Learning, Readiness, Enterprise and Smart Operations — single cadet ID, governed exchange backbone', ar: 'صورة تشغيلية موحّدة عبر التعلّم والجاهزية والمؤسسة والعمليات الذكية — هوية طالب واحدة، عمود فقري للتبادل المُحوكم' },
  'cc.systemsOnline': { en: 'SYSTEMS ONLINE', ar: 'أنظمة متصلة' },
  'cc.kpi.cadets': { en: 'Cadets Enrolled', ar: 'الطلبة المسجّلون' },
  'cc.kpi.composite': { en: 'Composite Readiness', ar: 'الجاهزية المركّبة' },
  'cc.kpi.occupancy': { en: 'Campus Occupancy', ar: 'إشغال الحرم' },
  'cc.kpi.energy': { en: 'Energy — 24h', ar: 'الطاقة — ٢٤ ساعة' },
  'cc.kpi.alerts': { en: 'Critical / High Alerts', ar: 'تنبيهات حرجة / عالية' },
  'cc.kpi.integration': { en: 'Integration Health', ar: 'صحة التكامل' },
  'cc.sub.companies': { en: 'Companies', ar: 'السرايا' },
  'cc.sub.wearable': { en: 'Wearable readiness', ar: 'جاهزية الأجهزة القابلة للارتداء' },
  'cc.sub.vsPrev': { en: 'vs prev 24h', ar: 'مقابل ٢٤ ساعة سابقة' },
  'cc.sub.openTotal': { en: 'Open total', ar: 'إجمالي المفتوح' },
  'cc.sub.budgetUsed': { en: 'Budget used', ar: 'الميزانية المستخدمة' },
  'cc.panel.occEnergy': { en: 'Campus Occupancy vs Energy — 24h', ar: 'إشغال الحرم مقابل الطاقة — ٢٤ ساعة' },
  'cc.panel.occEnergySub': { en: 'Cross-module correlation · IoT occupancy (flow 5) against BMS energy telemetry', ar: 'ترابط بين الوحدات · إشغال إنترنت الأشياء مقابل قياسات طاقة نظام إدارة المباني' },
  'cc.panel.company': { en: 'Company Readiness', ar: 'جاهزية السرايا' },
  'cc.panel.companySub': { en: 'Composite score (40% GPA · 25% military · 25% fitness · 10% conduct)', ar: 'الدرجة المركّبة (٤٠٪ معدل · ٢٥٪ عسكري · ٢٥٪ لياقة · ١٠٪ سلوك)' },
  'cc.panel.agentic': { en: 'Agentic AI — Recommendations & Actions', ar: 'الذكاء الاصطناعي الوكيل — توصيات وإجراءات' },
  'cc.panel.agenticSub': { en: 'Autonomous correlation across OT, HPO, energy and security domains', ar: 'ترابط ذاتي عبر مجالات التقنية التشغيلية واللياقة والطاقة والأمن' },
  'cc.panel.latestAlerts': { en: 'Latest Cross-Domain Alerts', ar: 'أحدث التنبيهات عبر المجالات' },
  'cc.panel.latestAlertsSub': { en: 'Correlated feed — full list in the bell panel', ar: 'موجز مترابط — القائمة الكاملة في لوحة التنبيهات' },
  'cc.loading': { en: 'Loading command center…', ar: 'جارٍ تحميل مركز القيادة…' },

  // ── common ──
  'common.loadingExec': { en: 'Loading executive overview…', ar: 'جارٍ تحميل النظرة التنفيذية…' },
  'common.viewDetails': { en: 'View details', ar: 'عرض التفاصيل' },
  'common.aiInsights': { en: 'AI Insights', ar: 'رؤى الذكاء الاصطناعي' },
  'common.openModules': { en: 'Open module — new tab', ar: 'فتح الوحدة — تبويب جديد' },
  'common.all': { en: 'All', ar: 'الكل' },
  'common.add': { en: 'Add', ar: 'إضافة' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.online': { en: 'Online', ar: 'متصل' },
  'common.offline': { en: 'Offline', ar: 'غير متصل' },
  'common.fault': { en: 'Fault', ar: 'عطل' },
};

const LangCtx = createContext({ lang: 'en', dir: 'ltr', t: (k) => k, toggle: () => {} });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('zmu_lang') || 'en');
  // Layout stays left-to-right in both languages — Arabic swaps the *words*
  // only, we deliberately do not mirror the UI (no RTL flip).
  const dir = 'ltr';
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.remove('rtl');
    localStorage.setItem('zmu_lang', lang);
  }, [lang]);
  const t = (key) => {
    const s = STR[key];
    if (!s) return key;
    return s[lang] || s.en || key;
  };
  const toggle = () => setLang((l) => (l === 'en' ? 'ar' : 'en'));
  return <LangCtx.Provider value={{ lang, dir, t, toggle }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

/** AR / EN toggle button — matches the header pill on zmu.ac.ae */
export function LangToggle({ style }) {
  const { lang, toggle } = useLang();
  return (
    <button className="icon-btn" onClick={toggle} title={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 800, letterSpacing: '0.02em', ...style }}>
      {lang === 'en' ? 'ع' : 'EN'}
    </button>
  );
}
