import React, { createContext, useContext, useEffect, useState } from 'react';

/* Lightweight bilingual layer (English / Arabic) with RTL, mirroring the
   AR/EN switch on zmu.ac.ae. Strings are keyed; t(key) falls back to English,
   then to the key itself, so untranslated UI never breaks. */

const STR = {
  // ── brand / chrome ──
  'app.university': { en: 'Zayed Military University', ar: 'جامعة زايد العسكرية' },
  'app.platform': { en: 'Smart Digital Campus', ar: 'الحرم الرقمي الذكي' },
  'app.restricted': { en: 'Restricted · ZMU Smart Digital Campus · Demonstration Environment — Synthetic Data', ar: 'سري · الحرم الرقمي الذكي بجامعة زايد العسكرية · بيئة عرض توضيحي — بيانات اصطناعية' },
  'app.poweredBy': { en: 'Powered by Astrikos S!aP', ar: 'مدعوم من أستريكوس S!aP' },
  'app.signout': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'app.aiAdvisory': { en: 'AI Advisory', ar: 'استشارة الذكاء الاصطناعي' },
  'app.alerts': { en: 'Alerts', ar: 'التنبيهات' },
  'app.msi': { en: 'MSI POC · ZMU-MSI-RFP-2026', ar: 'إثبات مفهوم المُكامل الرئيسي · ZMU-MSI-RFP-2026' },
  'app.governed': { en: 'Master Systems Integrator · Governed exchange backbone', ar: 'المُكامل الرئيسي للأنظمة · العمود الفقري للتبادل المُحوكم' },
  'app.openPortals': { en: 'Connected source portals — open in a new tab', ar: 'بوابات المصدر المتصلة — فتح في تبويب جديد' },

  // ── nav sections ──
  'nav.overview': { en: 'Overview', ar: 'نظرة عامة' },
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
  'login.tagline': { en: 'The integrated platform that unifies academics, readiness and campus operations — built by Astrikos on the S!aP platform.', ar: 'المنصة المتكاملة التي توحّد الأكاديميات والجاهزية وعمليات الحرم — من تطوير أستريكوس على منصة S!aP.' },

  // ── common ──
  'common.viewDetails': { en: 'View details', ar: 'عرض التفاصيل' },
  'common.aiInsights': { en: 'AI Insights', ar: 'رؤى الذكاء الاصطناعي' },
  'common.differentiator': { en: 'These portals are the source systems; the differentiator here is the AI advisory layer on top of them.', ar: 'هذه البوابات هي الأنظمة المصدرية؛ ما يميّزنا هو طبقة استشارات الذكاء الاصطناعي فوقها.' },
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
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.toggle('rtl', lang === 'ar');
    localStorage.setItem('zmu_lang', lang);
  }, [lang, dir]);
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
