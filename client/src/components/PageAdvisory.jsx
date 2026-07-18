import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n';

/**
 * PageAdvisory — a slim, always-on SiA advisory strip shown at the top of
 * every page (mounted in Layout). Rotates through a pool of campus-wide AI
 * advisories on a 3-second timer. Purple = AI advisory across the whole app.
 * This is the single AI-advisory surface for the app — pages should not
 * mount a second, page-local advisory panel alongside this one.
 */
const POOL = {
  en: [
    'Composite readiness is holding at mission-ready levels across all four companies — no escalation needed this cycle.',
    'BMS AHU-02 is trending toward a fault; the agentic layer has a maintenance work-order queued for approval.',
    'IAM flagged a short credential-stuffing burst overnight — adaptive MFA absorbed it, no accounts compromised.',
    'Dining-facility exhaust is the top energy driver; shifting the purge cycle to 22:00 is projected to save ~210 MWh/yr.',
    'Saqr Company sleep scores are trending low — consider adjusting the night-training rotation before the next assessment.',
    'SIS ↔ LMS roster sync is healthy at under 15 minutes; grade write-backs are current across all colleges.',
    'Overall systems health is steady across the platform — figures on every page can be trusted for decisions right now.',
    'Cadet wellbeing (wearables) is tracking in line with attendance — performance and academic signals remain aligned.',
    'Muwazana budget utilisation is on plan at mid-year — ICT & Digital Services is the fastest-consuming cost centre to watch.',
    'Campus occupancy and energy draw are moving together as designed — no anomalous consumption detected today.',
  ],
  ar: [
    'الجاهزية المركّبة ثابتة عند مستويات الجاهزية للمهام في السرايا الأربع — لا حاجة للتصعيد هذه الدورة.',
    'وحدة المناولة AHU-02 في نظام إدارة المباني تتّجه نحو عطل؛ طبقة الذكاء الوكيل لديها أمر صيانة بانتظار الموافقة.',
    'رصد نظام إدارة الهوية محاولة حشو بيانات اعتماد قصيرة ليلًا — امتصّها التحقق المتكيّف، ولم تُخترق أي حسابات.',
    'شفط مرفق الطعام هو المحرّك الأكبر للطاقة؛ نقل دورة التنقية إلى الساعة ٢٢:٠٠ يُتوقّع أن يوفّر نحو ٢١٠ ميجاواط/سنة.',
    'درجات نوم سرية صقر تتّجه للانخفاض — يُنصح بتعديل مناوبة التدريب الليلي قبل التقييم القادم.',
    'مزامنة القوائم بين نظام معلومات الطلبة وإدارة التعلّم سليمة في أقل من ١٥ دقيقة؛ ورصد الدرجات محدّث في كل الكليات.',
    'صحة الأنظمة الإجمالية مستقرة عبر المنصة — يمكن الوثوق بالأرقام في كل صفحة لاتخاذ القرارات الآن.',
    'صحة الطلبة (الأجهزة القابلة للارتداء) متوائمة مع الحضور — مؤشرات الأداء والأكاديميا لا تزال متسقة.',
    'استخدام ميزانية موازنة يسير حسب الخطة عند منتصف العام — تقنية المعلومات والخدمات الرقمية هي الأسرع استهلاكًا.',
    'إشغال الحرم واستهلاك الطاقة يتحركان معًا كما هو مصمم — لا يوجد استهلاك غير معتاد اليوم.',
  ],
};

export default function PageAdvisory() {
  const { lang, t } = useLang();
  const items = POOL[lang] || POOL.en;
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % items.length), 3000);
    return () => clearInterval(id);
  }, [items.length]);

  // Reset when language flips so the shown text matches the active language.
  useEffect(() => { setI(0); }, [lang]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16,
      padding: '10px 14px', borderRadius: 12,
      background: 'var(--app-violet-bg)', border: '1px solid var(--app-advisory-border)',
    }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--app-advisory)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
          <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
        </svg>
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--app-advisory)', flexShrink: 0 }}>
        {t('app.aiAdvisory')}
      </span>
      <span key={i} className="animate-fade-in" style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
        {items[i]}
      </span>
      <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {items.map((_, n) => (
          <span key={n} style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--app-advisory)', opacity: n === i ? 0.9 : 0.28 }} />
        ))}
      </span>
    </div>
  );
}
