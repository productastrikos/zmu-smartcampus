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
  // launcher button labels — same modules, "Analytics" framing (below the KPIs)
  'launcher.sis': { en: 'Student Information System Analytics', ar: 'تحليلات نظام معلومات الطلبة' },
  'launcher.lms': { en: 'Learning Management Analytics', ar: 'تحليلات إدارة التعلّم' },
  'launcher.merit': { en: 'Composite & Order of Merit Analytics', ar: 'تحليلات الدرجة المركّبة وترتيب الجدارة' },
  'launcher.cadetJourney': { en: 'Cadet Journey Analytics', ar: 'تحليلات رحلة الطالب' },
  'launcher.hpo': { en: 'HPO Fitness & Readiness Analytics', ar: 'تحليلات اللياقة والجاهزية' },
  'launcher.military': { en: 'Military Training Record Analytics', ar: 'تحليلات سجل التدريب العسكري' },
  'launcher.conduct': { en: 'Conduct & Discipline Analytics', ar: 'تحليلات السلوك والانضباط' },
  'page.itops': { en: 'Enterprise IT & DCIM', ar: 'تقنية المعلومات المؤسسية و DCIM' },
  'page.security': { en: 'Security Operations', ar: 'عمليات الأمن' },
  'page.integration': { en: 'Integration & Data', ar: 'التكامل والبيانات' },
  'page.analytics': { en: 'Analytics', ar: 'التحليلات' },

  // ── roles ──
  'role.executive': { en: 'Executive', ar: 'تنفيذي' },
  'role.superadmin': { en: 'Super Admin', ar: 'المشرف العام' },
  'role.academics': { en: 'Head of Academics', ar: 'رئيس الشؤون الأكاديمية' },
  'role.readiness': { en: 'Military Head', ar: 'رئيس الشؤون العسكرية' },
  'role.finance': { en: 'Finance Head', ar: 'رئيس المالية' },
  'role.ithead': { en: 'IT Head', ar: 'رئيس تقنية المعلومات' },
  'role.security': { en: 'Security Head', ar: 'رئيس الأمن' },
  'role.facility': { en: 'Facility Management Head', ar: 'رئيس إدارة المرافق' },

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
  'login.credsHint': { en: 'Demo accounts — pick a role; username = password (e.g. executive / executive)', ar: 'حسابات تجريبية — اختر دورًا؛ اسم المستخدم = كلمة المرور (مثال: executive / executive)' },

  // ── status (RAG chips come from API data in English) ──
  'status.normal': { en: 'Normal', ar: 'طبيعي' },
  'status.warning': { en: 'Warning', ar: 'تحذير' },
  'status.critical': { en: 'Critical', ar: 'حرج' },
  'status.online': { en: 'Online', ar: 'متصل' },
  'status.offline': { en: 'Offline', ar: 'غير متصل' },
  'status.degraded': { en: 'Degraded', ar: 'متدهور' },
  'status.fault': { en: 'Fault', ar: 'عطل' },
  'status.healthy': { en: 'Healthy', ar: 'سليم' },
  'severity.critical': { en: 'Critical', ar: 'حرج' },
  'severity.high': { en: 'High', ar: 'عالٍ' },
  'severity.medium': { en: 'Medium', ar: 'متوسط' },
  'severity.low': { en: 'Low', ar: 'منخفض' },

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
  // extra executive KPIs + panels
  'exec.kpi.attendance': { en: 'Attendance', ar: 'الحضور' },
  'exec.kpi.budget': { en: 'Budget Utilization', ar: 'استخدام الميزانية' },
  'exec.kpi.deviceHealth': { en: 'Device Health', ar: 'صحة الأجهزة' },
  'exec.kpi.energyConsumption': { en: 'Energy Consumption — 24h', ar: 'استهلاك الطاقة — ٢٤ ساعة' },
  'exec.sub.midYearPlan': { en: 'Mid-year plan 50%', ar: 'خطة منتصف العام ٥٠٪' },
  'exec.sub.devicesOnline': { en: 'Online', ar: 'متصل' },
  'exec.sub.vsPrev': { en: 'vs prev 24h', ar: 'مقابل ٢٤ ساعة سابقة' },
  'exec.twinSnapshot': { en: 'Campus Digital Twin — Live', ar: 'التوأم الرقمي للحرم — مباشر' },
  'exec.twinHottest': { en: 'Busiest', ar: 'الأكثر ازدحامًا' },
  'exec.twinLow': { en: 'Low', ar: 'منخفض' },
  'exec.twinMed': { en: 'Medium', ar: 'متوسط' },
  'exec.twinHigh': { en: 'High', ar: 'مرتفع' },
  'exec.twinAvg': { en: 'Avg density', ar: 'متوسط الكثافة' },
  'exec.twinLayerHeat': { en: 'Heatmap', ar: 'الخريطة الحرارية' },
  'exec.panel.readinessDomains': { en: 'Five Readiness Domains', ar: 'مجالات الجاهزية الخمسة' },
  'exec.panel.readinessDomainsSub': { en: 'HPO mandatory domains — cohort average', ar: 'المجالات الإلزامية لتحسين الأداء — متوسط الدفعة' },
  'exec.panel.companyShare': { en: 'Composite Readiness by Company', ar: 'الجاهزية المركّبة حسب السرية' },
  'exec.panel.companyShareSub': { en: 'Share of cohort composite score', ar: 'حصة الدرجة المركّبة للدفعة' },
  'exec.kpi.cadetsEnrolled': { en: 'Cadets Enrolled', ar: 'الطلبة المسجّلون' },
  'exec.kpi.highInjuryRisk': { en: 'High Injury Risk', ar: 'خطر إصابة مرتفع' },
  'exec.kpi.deviceSync': { en: 'Device Sync Rate', ar: 'معدّل مزامنة الأجهزة' },
  'exec.kpi.avgSleep': { en: 'Avg Sleep', ar: 'متوسط النوم' },
  'exec.panel.companyComparison': { en: 'Company Readiness Comparison', ar: 'مقارنة جاهزية السرايا' },
  'exec.panel.companyComparisonSub': { en: 'Composite, fitness and academic side by side', ar: 'المركّبة واللياقة والأكاديمي جنبًا إلى جنب' },
  'exec.panel.recoveryTrend': { en: 'Recovery Trend — HRV & Sleep', ar: 'اتجاه التعافي — تقلّب النبض والنوم' },
  'exec.panel.recoveryTrendSub': { en: 'Daily cohort average, most recent period', ar: 'متوسط الدفعة اليومي، أحدث فترة' },
  'exec.panel.alertsBySeverity': { en: 'Open Alerts by Severity', ar: 'التنبيهات المفتوحة حسب الخطورة' },
  'exec.panel.alertsBySeveritySub': { en: 'Current cross-domain alert mix', ar: 'مزيج التنبيهات الحالي عبر المجالات' },
  'exec.panel.domainHealth': { en: 'Domain Health Overview', ar: 'نظرة عامة على صحة المجالات' },
  'exec.panel.domainHealthSub': { en: 'Status mix across the four tracked domains', ar: 'مزيج الحالة عبر المجالات الأربعة المتابَعة' },
  'exec.panel.twin': { en: 'Campus Digital Twin — Snapshot', ar: 'التوأم الرقمي للحرم — لمحة' },
  'exec.panel.twinSub': { en: 'Real campus footprint & live asset overview (full interactive twin is operations-only)', ar: 'مخطط الحرم الحقيقي ونظرة على الأصول الحيّة (التوأم التفاعلي الكامل للعمليات فقط)' },
  'exec.panel.topRankers': { en: 'Top Rankers — Order of Merit', ar: 'الأوائل — ترتيب الجدارة' },
  'exec.panel.topRankersSub': { en: 'Highest composite scores across the cohort', ar: 'أعلى الدرجات المركّبة عبر الدفعة' },
  'exec.panel.budgetByCostCenter': { en: 'Budget vs Actual by Cost Center', ar: 'الميزانية مقابل الفعلي حسب مركز التكلفة' },
  'exec.panel.budgetByCostCenterSub': { en: 'Muwazana spend to date against allocated budget', ar: 'الإنفاق حتى تاريخه مقابل الميزانية المخصّصة' },
  'exec.panel.budgetForecast': { en: 'Budget Forecast — Next Quarter', ar: 'توقّع الميزانية — الربع القادم' },
  'exec.panel.budgetForecastSub': { en: 'Projected monthly outflow at current burn rate', ar: 'الإنفاق الشهري المتوقّع بمعدّل الاستهلاك الحالي' },
  'exec.panel.criticalDevices': { en: 'Critical Device Health', ar: 'صحة الأجهزة الحرجة' },
  'exec.panel.criticalDevicesSub': { en: 'Faulted / degraded devices needing attention', ar: 'الأجهزة المعطّلة / المتدهورة التي تحتاج انتباهًا' },
  'exec.panel.energyByZone': { en: 'Buildings — Energy & Consumption', ar: 'المباني — الطاقة والاستهلاك' },
  'exec.panel.energyByZoneSub': { en: 'Per-building energy draw — last 24 hours', ar: 'استهلاك الطاقة لكل مبنى — آخر ٢٤ ساعة' },
  'exec.col.rank': { en: 'Rank', ar: 'الترتيب' },
  'exec.col.cadet': { en: 'Cadet', ar: 'الطالب' },
  'exec.col.company': { en: 'Company', ar: 'السرية' },
  'exec.col.composite': { en: 'Composite', ar: 'المركّبة' },
  'exec.col.costCenter': { en: 'Cost Center', ar: 'مركز التكلفة' },
  'exec.col.budget': { en: 'Budget M', ar: 'الميزانية م' },
  'exec.col.actual': { en: 'Actual M', ar: 'الفعلي م' },
  'exec.col.device': { en: 'Device', ar: 'الجهاز' },
  'exec.col.building': { en: 'Building', ar: 'المبنى' },
  'exec.col.health': { en: 'Health', ar: 'الصحة' },
  'exec.col.status': { en: 'Status', ar: 'الحالة' },
  'exec.forecast': { en: 'Forecast', ar: 'توقّع' },
  'exec.actual': { en: 'Actual', ar: 'فعلي' },
  // Smart Watch — command-staff wellness
  'exec.watch.title': { en: 'Smart Watch — Command Staff Wellness', ar: 'الساعة الذكية — صحة كوادر القيادة' },
  'exec.watch.sub': { en: 'Aggregate from smart watch devices issued to senior officers · wearable health platform', ar: 'مُجمّع من الساعات الذكية الموزّعة على كبار الضباط · منصة الصحة القابلة للارتداء' },
  'exec.watch.synced': { en: 'Synced', ar: 'مُزامن' },
  'exec.watch.move': { en: 'Move', ar: 'الحركة' },
  'exec.watch.exercise': { en: 'Exercise', ar: 'التمرين' },
  'exec.watch.stand': { en: 'Stand', ar: 'الوقوف' },
  'exec.watch.hr': { en: 'Heart rate', ar: 'نبض القلب' },
  'exec.watch.hrv': { en: 'HRV', ar: 'تقلّب النبض' },
  'exec.watch.steps': { en: 'Steps', ar: 'الخطوات' },
  'exec.watch.energy': { en: 'Active energy', ar: 'الطاقة النشطة' },
  'exec.watch.foot': { en: 'Consent-governed wearable middleware · staff cohort, separate from cadet Garmin feed.', ar: 'وسيط أجهزة قابلة للارتداء محكوم بالموافقة · فئة الكوادر، منفصلة عن تغذية غارمين للطلبة.' },

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
  'common.sourceSystem': { en: 'Source system', ar: 'النظام المصدر' },
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
