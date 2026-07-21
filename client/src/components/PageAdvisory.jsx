import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '../i18n';

/**
 * PageAdvisory — a slim, always-on SiA advisory strip shown at the top of
 * every page (mounted in Layout). Purple = AI advisory across the whole app.
 *
 * The advisories are MODULE-SPECIFIC: each route gets its own pool of tips
 * relevant to that page. The strip itself does NOT rotate on its own —
 * clicking it opens a centred pop-up listing that page's full pool, which the
 * user can scroll and read at their own pace. Clicking outside the box (on the
 * backdrop) or the close button dismisses it. This is the single per-page
 * AI-advisory surface — pages should not mount a second one alongside it.
 */
const POOLS = {
  // Executive Overview (high-level domain status)
  '/': {
    en: [
      'All governed domains are green-to-amber — Smart Campus Operations is the one domain in a critical state on the AHU-02 fault.',
      'Cohort readiness and academic performance remain aligned — no divergence between wellbeing and attainment this cycle.',
      'Mid-year budget utilisation is on plan; procurement has a few POs pending approval above the aging threshold.',
      'The platform aggregates 35 source systems with 34 online — figures on every module can be trusted for decisions now.',
      'Injury-risk flags from wearables are the leading readiness signal — a modified training-load plan is advised before the next exercise.',
      'Open critical/high alerts are trending down day-on-day as agentic work-orders close them out.',
      'Order-of-Merit and composite scores are current under the approved policy weights — auditable end to end.',
    ],
    ar: [
      'كل المجالات المحوكمة بين الأخضر والأصفر — عمليات الحرم الذكي هي المجال الوحيد في حالة حرجة بسبب عطل AHU-02.',
      'جاهزية الدفعة والأداء الأكاديمي متوائمان — لا تباعد بين الصحة والتحصيل هذه الدورة.',
      'استخدام الميزانية عند منتصف العام حسب الخطة؛ لدى المشتريات أوامر شراء قليلة بانتظار الموافقة تجاوزت حد التقادم.',
      'تجمع المنصة ٣٥ نظام مصدر منها ٣٤ متصل — يمكن الوثوق بأرقام كل وحدة لاتخاذ القرار الآن.',
      'إشارات خطر الإصابة من الأجهزة القابلة للارتداء هي المؤشر الأبرز للجاهزية — يُنصح بخطة حمل تدريبي معدّلة قبل التمرين القادم.',
      'الإنذارات الحرجة/العالية المفتوحة في انخفاض يومًا بعد يوم مع إغلاق أوامر العمل الآلية لها.',
      'ترتيب الجدارة والدرجات المركّبة محدّثة وفق الأوزان المعتمدة — قابلة للتدقيق من طرف إلى طرف.',
    ],
  },
  // Command Center (operational, cross-domain)
  '/executive': {
    en: [
      'Composite readiness across all four companies is holding at mission-ready — no escalation needed this cycle.',
      'Critical/high alerts are concentrated in Campus Ops and Security — both have automated actions queued in the agentic layer.',
      'Campus energy and occupancy are moving together as designed — no anomalous consumption detected today.',
      'Integration backbone health is green — the governed exchange is delivering roster and grade flows within contract.',
      'Cadet wellbeing from wearables is tracking in line with attendance — performance and academic signals remain aligned.',
      'Budget utilisation is on the mid-year plan — ICT & Digital Services is the fastest-consuming cost centre to watch.',
      'Overnight security telemetry shows a contained credential-stuffing burst — adaptive MFA absorbed it with no accounts compromised.',
    ],
    ar: [
      'الجاهزية المركّبة في السرايا الأربع ثابتة عند مستوى الجاهزية للمهام — لا حاجة للتصعيد هذه الدورة.',
      'الإنذارات الحرجة/العالية متركّزة في عمليات الحرم والأمن — ولكليهما إجراءات آلية بانتظار التنفيذ في طبقة الذكاء الوكيل.',
      'طاقة الحرم والإشغال يتحركان معًا كما هو مصمم — لا استهلاك غير معتاد اليوم.',
      'صحة العمود الفقري للتكامل خضراء — التبادل المحوكم يسلّم تدفقات القوائم والدرجات ضمن العقد.',
      'صحة الطلبة من الأجهزة القابلة للارتداء متوائمة مع الحضور — مؤشرات الأداء والأكاديميا متسقة.',
      'استخدام الميزانية حسب خطة منتصف العام — تقنية المعلومات والخدمات الرقمية هي الأسرع استهلاكًا للمراقبة.',
      'رصد الأمن الليلي محاولة حشو بيانات اعتماد محدودة — امتصّها التحقق المتكيّف دون اختراق أي حساب.',
    ],
  },
  // Digital Twin
  '/digital-twin': {
    en: [
      'The live digital twin is fused from BMS, CCTV and access telemetry — one AHU fault is highlighted on Academic Block B.',
      'Camera coverage is rendered per zone; a few offline cameras on the ORANGE network are marked for a patrol check.',
      'The air-quality overlay shows no exceedances today — CO₂ is elevated only in one high-occupancy zone.',
      'Personnel and asset positions read on the same registries as the dashboards — the twin and the KPIs never disagree.',
      'The energy heatmap by building tracks occupancy as designed — no anomalous draw detected in the last 24 hours.',
      'Enterable buildings expose their floor-level BMS state — open the Admin Block twin to drill into HVAC and room comfort.',
      'The twin is a read-only supervisory overlay on base-build systems — control actions remain with the owning platforms.',
    ],
    ar: [
      'التوأم الرقمي الحي مدمج من نظام المباني والمراقبة والدخول — عطل مناولة هواء واحد مميّز على المبنى الأكاديمي B.',
      'تغطية الكاميرات معروضة لكل منطقة؛ وبعض الكاميرات غير المتصلة على شبكة ORANGE مؤشّرة لجولة تفقّد.',
      'طبقة جودة الهواء لا تُظهر أي تجاوزات اليوم — ثاني أكسيد الكربون مرتفع فقط في منطقة عالية الإشغال.',
      'مواقع الأفراد والأصول تُقرأ من السجلات نفسها التي تغذّي اللوحات — التوأم والمؤشرات لا يختلفان أبدًا.',
      'خريطة الطاقة الحرارية لكل مبنى تتتبّع الإشغال كما صُمّمت — لا سحب غير معتاد في آخر ٢٤ ساعة.',
      'المباني القابلة للدخول تكشف حالة نظام المباني على مستوى الطابق — افتح توأم المبنى الإداري للتعمّق في التكييف وراحة الغرف.',
      'التوأم طبقة إشرافية للقراءة فقط فوق أنظمة البناء الأساسية — تبقى إجراءات التحكّم لدى المنصات المالكة.',
    ],
  },
  // Academics & Learning
  '/academic': {
    en: [
      'Cohort GPA is holding near 3.0 — Military Science & Tactics has the most at-risk cadets; prioritise its early-intervention queue.',
      'SIS ↔ LMS roster sync is running under 15 minutes; grade write-backs are current across all four colleges.',
      'The AI student-success model has flagged this term\'s at-risk cadets — a structured support plan now protects their composite scores.',
      'LMS AI-assistant usage is up week-on-week; assignment originality checks show no cross-college anomalies today.',
      'Attendance from facial-recognition T&A is tracking above 90% — no company is trending toward an attendance hold.',
      'Lab utilisation is healthy; the Cyber Range and Simulation labs are the highest-demand — watch booking contention before exams.',
      'Order-of-Merit standings are current under the approved composite weights — academic performance is the heaviest input at 40%.',
    ],
    ar: [
      'المعدل التراكمي للدفعة ثابت قرب ٣٫٠ — برنامج العلوم والتكتيكات العسكرية الأعلى في الطلبة المعرّضين للخطر؛ أعطِ الأولوية لقائمة التدخّل المبكر فيه.',
      'مزامنة القوائم بين نظام معلومات الطلبة وإدارة التعلّم تعمل في أقل من ١٥ دقيقة؛ ورصد الدرجات محدّث في الكليات الأربع.',
      'رصد نموذج نجاح الطلبة الذكي الطلبةَ المعرّضين للخطر هذا الفصل — خطة دعم منظّمة الآن تحمي درجاتهم المركّبة.',
      'استخدام مساعد التعلّم الذكي في ارتفاع أسبوعيًا؛ وفحوص أصالة الواجبات لا تُظهر تطابقًا غير معتاد بين الكليات اليوم.',
      'الحضور عبر التعرّف على الوجه يتجاوز ٩٠٪ — لا توجد سرية تتّجه نحو إيقاف بسبب الغياب.',
      'استخدام المختبرات جيّد؛ ومختبرا المدى السيبراني والمحاكاة الأعلى طلبًا — راقب تزاحم الحجوزات قبل الاختبارات.',
      'ترتيب الجدارة محدّث وفق الأوزان المركّبة المعتمدة — الأداء الأكاديمي أثقل مدخل بنسبة ٤٠٪.',
    ],
  },
  // Readiness & Performance
  '/readiness': {
    en: [
      'Squadron readiness is at mission-ready levels; Saqr Company sleep is the one metric trending low — review the night-training rotation.',
      'Wearable device-sync coverage is strong — over 90% of cadets synced within 12 hours, so today\'s readiness figures are reliable.',
      'Several cadets show ACWR above 1.4 ahead of the next exercise — a modified training load is advised to cut soft-tissue injury risk.',
      'Average HRV and body-battery are stable week-on-week; recovery is keeping pace with training volume.',
      'The HPO radar shows Sleep & Recovery as the weakest domain — a small gain there returns the most composite improvement.',
      'VO₂max distribution is holding; the lowest quartile aligns with the flagged injury-risk cadets — one list covers both.',
      'Fitness, military and conduct scores read on one cadet ID — the weakest stream is where an intervention lifts the Order of Merit most.',
    ],
    ar: [
      'جاهزية السرايا عند مستوى الجاهزية للمهام؛ ونوم سرية صقر هو المؤشر الوحيد المتّجه للانخفاض — راجع مناوبة التدريب الليلي.',
      'تغطية مزامنة الأجهزة القابلة للارتداء قوية — أكثر من ٩٠٪ من الطلبة زامنوا خلال ١٢ ساعة، لذا أرقام الجاهزية اليوم موثوقة.',
      'عدة طلبة يُظهرون نسبة حمل حاد/مزمن تفوق ١٫٤ قبل التمرين القادم — يُنصح بحمل تدريبي معدّل لخفض خطر إصابات الأنسجة الرخوة.',
      'متوسط تغيّر معدل ضربات القلب وبطارية الجسم مستقر أسبوعيًا؛ التعافي يواكب حجم التدريب.',
      'رادار الأداء العالي يُظهر النوم والتعافي كأضعف مجال — تحسّن بسيط فيه يعيد أكبر قدر من التحسّن المركّب.',
      'توزيع الأكسجين الأقصى ثابت؛ والربع الأدنى يتوافق مع الطلبة المؤشّرين بخطر الإصابة — قائمة واحدة تغطّي الاثنين.',
      'درجات اللياقة والعسكرية والانضباط تُقرأ على هوية طالب واحدة — أضعف مسار هو حيث يرفع التدخّل ترتيب الجدارة أكثر.',
    ],
  },
  // Enterprise & Finance
  '/enterprise': {
    en: [
      'Muwazana budget utilisation is on the mid-year plan — ICT & Digital Services is the fastest-consuming cost centre to watch.',
      'A few purchase orders are pending approval beyond the aging threshold — clear the most-aged first.',
      'HRMS shows vacancies against establishment concentrated in technical grades — the recruitment funnel is slow at offer stage.',
      'Attrition is within the target band; no department is trending toward a retention risk this quarter.',
      'Vendor spend is concentrated in the top suppliers — review commitments before Q3 to protect the contingency line.',
      'Room and facility utilisation is balanced — no teaching space is over-subscribed against the timetable.',
      'Procurement, finance and HR read on one master-data spine — spend and headcount reconcile without re-keying.',
    ],
    ar: [
      'استخدام ميزانية موازنة حسب خطة منتصف العام — تقنية المعلومات والخدمات الرقمية هي مركز التكلفة الأسرع استهلاكًا للمراقبة.',
      'بعض أوامر الشراء بانتظار الموافقة تجاوزت حد التقادم — عالج الأقدم أولًا.',
      'يُظهر نظام الموارد البشرية شواغر مقابل الملاك متركّزة في الرتب الفنية — قمع التوظيف بطيء عند مرحلة العرض.',
      'معدل ترك العمل ضمن النطاق المستهدف؛ لا قسم يتّجه نحو خطر استبقاء هذا الربع.',
      'إنفاق المورّدين متركّز في كبار المورّدين — راجع الالتزامات قبل الربع الثالث لحماية بند الطوارئ.',
      'استخدام الغرف والمرافق متوازن — لا توجد مساحة تدريس محجوزة فوق طاقتها مقابل الجدول.',
      'المشتريات والمالية والموارد البشرية تُقرأ على عمود بيانات رئيسي واحد — الإنفاق والملاك يتطابقان دون إعادة إدخال.',
    ],
  },
  // Smart Campus Operations
  '/campus-ops': {
    en: [
      'One BMS alarm is active — AHU-02 in Academic Block B is trending to fault; a CMMS work-order is queued for approval.',
      'Zone temperatures are near the 22.5°C setpoint; one zone is breaching on CO₂ — increase fresh-air purge before peak occupancy.',
      'Dining-facility exhaust is the top energy driver — shifting the purge cycle to 22:00 is projected to save ~210 MWh/yr.',
      'CCTV coverage is nominal with a handful of cameras offline on the ORANGE network — dispatch a patrol check to close the gap.',
      'Weapons issued out are reconciled bar a few overdue returns — the armoury WMS binds every issue to a cadet or staff holder.',
      'Parking sits at moderate occupancy with EV chargers live; ANPR barriers are clearing normally.',
      'All fire panels are online and Civil Defence certification is current — safety signals are read-only to the supervisory layer.',
    ],
    ar: [
      'إنذار واحد نشط في نظام المباني — وحدة المناولة AHU-02 في المبنى الأكاديمي B تتّجه للعطل؛ وأمر صيانة بانتظار الموافقة.',
      'حرارة المناطق قرب نقطة الضبط ٢٢٫٥°م؛ ومنطقة واحدة تتجاوز في ثاني أكسيد الكربون — زِد تنقية الهواء النقي قبل ذروة الإشغال.',
      'شفط مرفق الطعام هو المحرّك الأكبر للطاقة — نقل دورة التنقية إلى ٢٢:٠٠ يُتوقّع أن يوفّر نحو ٢١٠ ميجاواط/سنة.',
      'تغطية المراقبة طبيعية مع بضع كاميرات غير متصلة على شبكة ORANGE — أرسل جولة تفقّد لسدّ الثغرة.',
      'الأسلحة المصروفة مُسوّاة عدا بضع إرجاعات متأخرة — يربط نظام إدارة الأسلحة كل صرف بحائز من الطلبة أو الطاقم.',
      'المواقف عند إشغال متوسط وشواحن المركبات الكهربائية تعمل؛ وبوابات ANPR تعمل بشكل طبيعي.',
      'كل لوحات الحريق متصلة وشهادة الدفاع المدني سارية — إشارات السلامة للقراءة فقط لدى الطبقة الإشرافية.',
    ],
  },
  // IoT Sensors
  '/iot': {
    en: [
      'Sensor-fleet uptime is strong — a couple of nodes are in fault/degraded state with CMMS work-orders auto-raised.',
      'Wireless sensors on low battery are flagged for a swap before they drop offline — LoRaWAN nodes are the priority.',
      'Environmental sensors show CO₂ elevated only in high-occupancy zones — ventilation logic is responding as designed.',
      'Device-health averages are nominal across BACnet, Modbus and Zigbee segments — no protocol-wide outage detected.',
      'Newly added sensors are onboarding cleanly — telemetry is flowing within minutes of registration.',
      'Occupancy and lighting sensors are tracking together — daylight-harvesting is trimming load in perimeter zones.',
      'The sensor overlay is vendor-neutral over base-build systems — add or retire nodes without touching the source BMS.',
    ],
    ar: [
      'زمن تشغيل أسطول المستشعرات قوي — عقدتان في حالة عطل/تدهور مع رفع أوامر صيانة تلقائيًا.',
      'المستشعرات اللاسلكية منخفضة البطارية مؤشّرة للاستبدال قبل انقطاعها — عقد LoRaWAN هي الأولوية.',
      'المستشعرات البيئية تُظهر ثاني أكسيد الكربون مرتفعًا فقط في المناطق عالية الإشغال — منطق التهوية يستجيب كما صُمّم.',
      'متوسطات صحة الأجهزة طبيعية عبر مقاطع BACnet وModbus وZigbee — لا انقطاع على مستوى البروتوكول.',
      'المستشعرات المضافة حديثًا تنضمّ بسلاسة — القياسات تتدفّق خلال دقائق من التسجيل.',
      'مستشعرات الإشغال والإضاءة تتتبّع معًا — حصاد الضوء الطبيعي يقلّل الحمل في المناطق المحيطية.',
      'طبقة المستشعرات محايدة للمورّد فوق أنظمة البناء الأساسية — أضف أو أخرج العقد دون المساس بنظام المباني المصدر.',
    ],
  },
  // Incident Management
  '/incidents': {
    en: [
      'Open incidents are concentrated in facilities — the AHU-02 fault has an automated work-order and is the top priority.',
      'Mean time-to-acknowledge is within the service level; no critical incident is breaching its response clock.',
      'Most incidents are auto-raised from telemetry rather than manually reported — detection is ahead of user tickets.',
      'The severity mix is weighted to low/medium today — no cascade of high-severity events across domains.',
      'Recurring incidents at one zone suggest a root-cause fix beats repeated call-outs — flag it for a problem record.',
      'Security-originated incidents are contained — the overnight credential burst was absorbed with no account impact.',
      'Cross-domain incidents join on the same asset and cadet registries — responders see the full context, not a silo.',
    ],
    ar: [
      'الحوادث المفتوحة متركّزة في المرافق — عطل AHU-02 لديه أمر عمل آلي وهو الأولوية القصوى.',
      'متوسط زمن الإقرار ضمن مستوى الخدمة؛ لا حادث حرج يتجاوز ساعة استجابته.',
      'معظم الحوادث تُرفع آليًا من القياسات لا يدويًا — الاكتشاف يسبق تذاكر المستخدمين.',
      'مزيج الخطورة يميل إلى المنخفض/المتوسط اليوم — لا سلسلة أحداث عالية الخطورة عبر المجالات.',
      'تكرار الحوادث في منطقة واحدة يشير إلى أن معالجة السبب الجذري أفضل من الاستدعاءات المتكررة — أدرجها كسجل مشكلة.',
      'الحوادث ذات المنشأ الأمني محتواة — امتُصّت محاولة بيانات الاعتماد الليلية دون أثر على الحسابات.',
      'الحوادث العابرة للمجالات تلتقي على سجلات الأصول والطلبة نفسها — يرى المستجيبون السياق الكامل لا الصوامع.',
    ],
  },
  // IT Management
  '/it-ops': {
    en: [
      'Software-license utilisation is healthy — a few seats are near their entitlement cap and worth reviewing before renewal.',
      'Data-centre DCIM shows power and cooling within envelope — no rack is trending toward a thermal limit.',
      'IT asset inventory is reconciled — end-of-life devices are flagged for a refresh plan ahead of budget lock.',
      'Patch and firmware currency is strong across the estate — no critical exposure is outstanding on managed endpoints.',
      'Backup and DR status is green — recovery-point objectives are being met across the protected systems.',
      'License spend concentrates in a few vendors — consolidating overlapping tools could free budget for priority services.',
      'Service availability is above target — the platform reports 34 of 35 systems online right now.',
    ],
    ar: [
      'استخدام تراخيص البرمجيات جيّد — بعض المقاعد قرب سقف استحقاقها ويستحق المراجعة قبل التجديد.',
      'يُظهر نظام إدارة مركز البيانات الطاقة والتبريد ضمن الحدود — لا خزانة تتّجه نحو حدّها الحراري.',
      'جرد أصول تقنية المعلومات مُسوّى — الأجهزة منتهية العمر مؤشّرة لخطة تجديد قبل إقفال الميزانية.',
      'حداثة التحديثات والبرامج الثابتة قوية عبر المنشأة — لا انكشاف حرج قائم على الأجهزة المُدارة.',
      'حالة النسخ الاحتياطي والتعافي من الكوارث خضراء — يتحقّق هدف نقطة الاسترجاع عبر الأنظمة المحمية.',
      'إنفاق التراخيص متركّز في مورّدين قلائل — دمج الأدوات المتداخلة قد يحرّر ميزانية للخدمات ذات الأولوية.',
      'توفّر الخدمة فوق الهدف — تُبلّغ المنصة عن ٣٤ من ٣٥ نظامًا متصلًا الآن.',
    ],
  },
  // Security Operations
  '/security': {
    en: [
      'SIEM shows a contained credential-stuffing burst overnight — adaptive MFA absorbed it with no accounts compromised.',
      'Physical and cyber events join in one view — no correlated pattern between access-control denials and login anomalies today.',
      'IAM privileged-access reviews are current — no dormant admin accounts are outstanding beyond policy.',
      'Tailgating and denied-entry alerts are low across zones — no repeated attempt flagged at any controlled door.',
      'Threat-intel feeds are current; no active campaign is targeting the exposed services this cycle.',
      'Most security events are auto-triaged — analyst attention is reserved for the few that escalate past the playbooks.',
      'The SOC reads on the same identity spine as SIS and HRMS — every actor resolves to one person of record.',
    ],
    ar: [
      'يُظهر نظام إدارة أحداث الأمن محاولة حشو بيانات اعتماد محتواة ليلًا — امتصّها التحقق المتكيّف دون اختراق أي حساب.',
      'الأحداث المادية والسيبرانية تلتقي في عرض واحد — لا نمط مترابط بين رفض الدخول وشذوذ تسجيل الدخول اليوم.',
      'مراجعات الوصول المميّز في نظام إدارة الهوية محدّثة — لا حسابات مسؤول خاملة قائمة خارج السياسة.',
      'إنذارات التسلّل خلف الآخرين ورفض الدخول منخفضة عبر المناطق — لا محاولة متكررة على أي باب محكوم.',
      'موجزات استخبارات التهديد محدّثة؛ لا حملة نشطة تستهدف الخدمات المكشوفة هذه الدورة.',
      'معظم الأحداث الأمنية تُفرز آليًا — يُحفظ انتباه المحلّل للقليل الذي يتصاعد فوق كتيبات التشغيل.',
      'يقرأ مركز العمليات الأمنية على عمود الهوية نفسه لنظام الطلبة والموارد البشرية — كل فاعل يُحلّ إلى شخص واحد مسجّل.',
    ],
  },
  // Integration
  '/integration': {
    en: [
      'The governed exchange is green — SIS, LMS and HPO flows are delivering within their contracted windows.',
      'Cadet-ID master-data match rate is high — records join across modules without manual reconciliation.',
      'Most ICDs are approved and in force — a few are in review and worth clearing to unblock dependent flows.',
      'Managed file-transfer volume is nominal over the last 24 hours — no stuck queues or failed deliveries outstanding.',
      'Roster and grade write-backs are current — the SIS ↔ LMS contract of under 15 minutes is being met.',
      'Disaster-recovery status is green — replication is current and failover objectives are within target.',
      'One master-data spine underpins every module — spend, headcount and cadet records reconcile without re-keying.',
    ],
    ar: [
      'التبادل المحوكم أخضر — تدفقات نظام الطلبة وإدارة التعلّم والأداء العالي تُسلّم ضمن نوافذها التعاقدية.',
      'معدل تطابق البيانات الرئيسية لهوية الطالب مرتفع — تلتقي السجلات عبر الوحدات دون تسوية يدوية.',
      'معظم وثائق التحكّم بالتكامل معتمدة وسارية — بعضها قيد المراجعة ويستحق الإنجاز لفكّ حصر التدفقات المعتمدة.',
      'حجم النقل المُدار للملفات طبيعي خلال آخر ٢٤ ساعة — لا طوابير عالقة أو تسليمات فاشلة قائمة.',
      'رصد القوائم والدرجات محدّث — يتحقّق عقد أقل من ١٥ دقيقة بين نظام الطلبة وإدارة التعلّم.',
      'حالة التعافي من الكوارث خضراء — النسخ المتماثل محدّث وأهداف التبديل ضمن الهدف.',
      'عمود بيانات رئيسي واحد يدعم كل وحدة — الإنفاق والملاك وسجلات الطلبة تتطابق دون إعادة إدخال.',
    ],
  },
};

// Fallback pool (routes not explicitly themed).
const DEFAULT_KEY = '/';
function poolFor(pathname, lang) {
  const key = POOLS[pathname]
    ? pathname
    : pathname.startsWith('/digital-twin') ? '/digital-twin'
    : DEFAULT_KEY;
  const p = POOLS[key];
  return p[lang] || p.en;
}

const Sparkle = ({ size = 14, stroke = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
    <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
  </svg>
);

export default function PageAdvisory() {
  const { lang, t } = useLang();
  const { pathname } = useLocation();
  const items = poolFor(pathname, lang);
  const [open, setOpen] = useState(false);

  // Close the pop-up on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Clickable strip — static (no auto-rotation). Opens the pop-up. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('app.aiAdvisory')}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%', marginBottom: 16,
          padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'start',
          background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
        }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--app-advisory)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkle />
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--app-advisory)', flexShrink: 0 }}>
          {t('app.aiAdvisory')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {items[0]}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          fontSize: 10.5, fontWeight: 700, color: 'var(--app-advisory)',
          padding: '3px 9px', borderRadius: 20, background: 'var(--app-panel)', border: '1px solid var(--app-advisory-border)',
        }}>
          {lang === 'ar' ? `${items.length} توصية` : `${items.length} advisories`}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Centred pop-up — user-controlled, scrollable, click-outside to close. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, background: 'rgba(15,12,7,0.58)',
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in"
            style={{
              width: 620, maxWidth: '100%', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
              borderRadius: 16, overflow: 'hidden', background: 'var(--app-panel)',
              border: '1px solid var(--app-advisory-border)', boxShadow: 'var(--app-shadow-lg)',
            }}>
            {/* purple header */}
            <div style={{ background: 'var(--app-advisory-panel)', padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkle size={17} stroke="#fef9ef" />
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fef9ef' }}>{t('app.aiAdvisory')}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(254,249,239,0.72)' }}>
                    {lang === 'ar' ? `${items.length} توصية خاصة بهذه الصفحة` : `${items.length} advisories for this page`}
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close advisory"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fef9ef', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>

            {/* scrollable advisory list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {items.map((text, n) => (
                <div key={n} style={{
                  display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 11, marginBottom: 9,
                  background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
                }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: 'var(--app-advisory)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Sparkle size={12} />
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--app-text)', lineHeight: 1.55 }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--app-surface-raised)', fontSize: 10, color: 'var(--app-text-faint)' }}>
              {lang === 'ar' ? 'توصيات من SiA · وضع العرض · تحقّق قبل الإجراء' : 'Advisories generated by SiA · demo mode · verify before acting'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
