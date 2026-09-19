import type { Reading } from '@/components/assistant/reading'
import {
  CLOSE_DOCS, canStartEval, closeCycle, closeLate, closeRequirements, closeStageWho,
  evalBlockers, needsComms, reportApproved, reportBlockers, reportGap,
} from '@/data/mock/closing'
import { nf } from '@/lib/format'
import type { CloseRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   قراءة طلب إغلاق واحد · مخرجات الذكاء الأربعة (11.5)

   الوثيقة بتحدّد أربعة مخرجات للمساعد في الإجراء ده:
     ١ · تحليل التقرير واستخلاص النتائج والتحديات
     ٢ · **مقارنة الفعلي بالمعتمد** وإبراز الانحرافات
     ٣ · تحليل مؤشرات الأثر وتقييم استرشادي للنجاح
     ٤ · مراجعة المرفقات والتنبيه للناقص

   ⚠️ **والقاعدة 13 بتقول إنها استرشادية** · نفس قاعدة 21 في
   الاتفاقيات: المساعد بيحلّل وبيقارن وبيطلع الانحراف · **وما
   بيعتمدش**. فمفيش قراءة هنا بتقول «اعتمد» ولا «ارفض».

   ⚠️ **والترتيب: اللي بيمنع، بعده الانحراف، بعده اللي بيطمّن** ·
   الكارت المقفول بيعرض `readings[0]` لمحةً.
   ═══════════════════════════════════════════════════════════ */

export function closeReadings(c: CloseRow): Reading[] {
  const out: Reading[] = []
  const cycle = closeCycle(c)

  /* ١ · مخرج 4 · الناقص · وده اللي بيمنع الإرسال (قاعدة 3 و10) */
  const missing = reportBlockers(c)
  if (missing.length > 0) {
    const docs = missing.filter((m) => CLOSE_DOCS.some((d) => d.label === m))
    out.push({
      id: 'cl-short',
      kind: 'flag',
      label: 'يمنع إرسال التقرير',
      metric: { value: String(missing.length), unit: 'بند ناقص' },
      text:
        `${missing.slice(0, 3).join(' · ')}${missing.length > 3 ? ' وغيرها' : ''} · ` +
        `${docs.length} منها مرفقات إلزامية · القاعدة 3 بتمنع الإرسال قبل ` +
        `اكتمال البيانات والمستندات الداعمة.`,
      bold: ['القاعدة 3'],
      src: 'قاعدة 4 · الحدّ الأدنى للتقرير الختامي',
    })
  }

  /* ٢ · مخرج 2 · المقارنة بالمعتمد · قلب المراجعة */
  const gaps = reportGap(c).filter((g) => g.actual !== null && g.planned > 0)
  for (const g of gaps) {
    const actual = g.actual ?? 0
    const diff = Math.round(((actual - g.planned) / g.planned) * 100)
    const off = Math.abs(diff) >= 10
    out.push({
      id: `cl-gap-${g.key}`,
      kind: off ? 'flag' : 'note',
      label: off ? `انحراف في ${g.label}` : `${g.label} مطابقة`,
      metric: { value: `${diff > 0 ? '+' : ''}${diff}%`, unit: 'عن المعتمد' },
      text:
        `الفعلي ${nf.format(actual)} ${g.unit} والمعتمد ${nf.format(g.planned)} · ` +
        (off
          ? 'الفرق جوهري ومحتاج تفسير في التقرير قبل الاعتماد.'
          : 'الفرق داخل المدى المعقول.'),
      bold: [`${nf.format(actual)} ${g.unit}`],
      src: 'قاعدة 4 · بيانات المشروع المعتمدة والاتفاقية',
      bar: {
        value: actual,
        limit: g.planned,
        valueLabel: 'الفعلي',
        limitLabel: 'المعتمد',
        unit: g.unit,
      },
    })
  }

  /* ٣ · مخرج 3 · مؤشرات التقييم · الدورة التانية وحدها */
  if (cycle === 'eval' && c.evaluation) {
    const hit = c.evaluation.indicators.filter(
      (i) => i.actual !== null && i.actual >= i.target,
    ).length
    const all = c.evaluation.indicators.length
    out.push({
      id: 'cl-ind',
      kind: hit === all ? 'note' : 'flag',
      label: 'مؤشرات الأثر',
      metric: { value: `${hit}/${all}`, unit: 'مؤشرًا بلغ مستهدفه' },
      text:
        `التقدير الاسترشادي ${c.evaluation.score ?? '·'} من 5 · ` +
        `القاعدة 13 بتقول إن التقييم الاسترشادي ده دعم للمراجعة لا بديل عنها.`,
      bold: ['القاعدة 13'],
      src: 'مخرج 3 في 11.5 · مؤشرات التقييم',
    })

    const evalShort = evalBlockers(c)
    if (evalShort.length > 0) {
      out.push({
        id: 'cl-eval-short',
        kind: 'flag',
        label: 'يمنع إرسال التقييم',
        metric: { value: String(evalShort.length), unit: 'بند ناقص' },
        text: evalShort.join(' · '),
        src: 'قاعدة 10 · مطبَّقة على الدورة التانية',
      })
    }
  }

  /* ٤ · محطة الاتصال المؤسسي · قاعدة 9 · والغياب بيتقال */
  out.push({
    id: 'cl-comms',
    kind: 'note',
    label: 'النشر الإعلامي',
    text: needsComms(c)
      ? 'الاتفاقية فيها التزام نشر إعلامي، فمراجعة الاتصال المؤسسي محطة في '
        + 'دورة التقرير · القاعدة 9.'
      : 'مفيش التزام نشر إعلامي في الاتفاقية، فمحطة الاتصال المؤسسي '
        + 'بتتخطّى · القاعدة 9 بتقول «متى كانت مطلوبة».',
    bold: ['القاعدة 9'],
    src: 'قاعدة 9 · التزامات النشر في الاتفاقية',
  })

  /* ٥ · اللي واقف دلوقتي · وعند مين */
  if (canStartEval(c)) {
    out.push({
      id: 'cl-next',
      kind: 'note',
      label: 'التقييم مستحقّ',
      text:
        'التقرير اتعتمد من المدير التنفيذي، فالقاعدة 6 خلاص اتحقّقت وتقييم '
        + 'المشروع يقدر يبدأ · وبيعدّه مشرف المنح لا الجهة.',
      bold: ['القاعدة 6'],
      src: 'قاعدة 6 و17 · دورتان مستقلّتان',
    })
  } else if (closeLate(c)) {
    out.push({
      id: 'cl-late',
      kind: 'flag',
      label: 'متأخر عن حدّ المحطة',
      metric: { value: String(Math.round(c.hoursInStage / 24)), unit: 'يومًا في المحطة' },
      text:
        `عند ${closeStageWho(c.stage) || 'المؤسسة'} · والحدود دي مؤقتة لحدّ ما `
        + 'المؤسسة تحدّدها (س-18).',
      src: 'حدود مؤقتة · مش من الوثيقة',
    })
  }

  /* ٦ · المتطلبات المالية · قاعدة 8 و18 */
  const req = closeRequirements(c)
  if (!req.ok || reportApproved(c)) {
    out.push({
      id: 'cl-req',
      kind: req.ok ? 'note' : 'flag',
      label: 'متطلبات الإغلاق',
      text: req.ok
        ? 'مفيش التزام مالي معلّق · فالإغلاق النهائي مانعه الوحيد اكتمال '
          + 'الاعتمادين (قاعدة 18).'
        : `${req.say} · والقاعدة 8 بتمنع تحويل المشروع لـ«مكتمل» قبل تسويتها.`,
      bold: ['قاعدة 18'],
      src: 'قاعدة 8 و18 · وتفصيل المتطلبات سؤال مفتوح (س-15)',
    })
  }

  return out
}
