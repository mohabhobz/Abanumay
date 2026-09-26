import type { Reading } from '@/components/assistant/reading'
import {
  CLOSE_DOCS, canStartEval, closeCycle, closeLate, closeRequirements, closeStageWho,
  evalBlockers, needsComms, reportApproved, reportBlockers, reportGap,
} from '@/data/mock/closing'
import { nf, MISSING_ITEM, nounAfter, unitAfter } from '@/lib/format'
import type { CloseRow } from '@/types/domain'

/* Reading a single closing request - the four AI outputs (11.5).

   The spec defines four outputs for the assistant in this procedure:
   1. Analyze the report and extract results and challenges
   2. Compare actual to approved and surface deviations
   3. Analyze impact indicators and give an advisory success assessment
   4. Review attachments and flag what's missing

   Note: rule 13 states these are advisory - same as rule 21 in agreements: the assistant analyzes,
   compares, and surfaces deviation, and does not approve. So no reading here says "approve" or
   "reject".

   Note: order is blocking issues first, then deviation, then reassurance - the collapsed card shows
   `readings[0]` as a preview. */

export function closeReadings(c: CloseRow): Reading[] {
  const out: Reading[] = []
  const cycle = closeCycle(c)

  /* 1 - output 4 - what's missing - and what blocks submission (rules 3 and 10). */
  const missing = reportBlockers(c)
  if (missing.length > 0) {
    const docs = missing.filter((m) => CLOSE_DOCS.some((d) => d.label === m))
    out.push({
      id: 'cl-short',
      kind: 'flag',
      label: 'يمنع إرسال التقرير',
      metric: { value: String(missing.length), unit: nounAfter(missing.length, MISSING_ITEM) },
      text:
        `${missing.slice(0, 3).join(' · ')}${missing.length > 3 ? ' وغيرها' : ''} · ` +
        `${docs.length} منها مرفقات إلزامية · تمنع القاعدة 3 الإرسال قبل ` +
        `اكتمال البيانات والمستندات الداعمة.`,
      bold: ['القاعدة 3'],
      src: 'قاعدة 4 · الحدّ الأدنى للتقرير الختامي',
    })
  }

  /* 2 - output 2 - comparison to approved - the core of the review. */
  const gaps = reportGap(c).filter((g) => g.actual !== null && g.planned > 0)
  for (const g of gaps) {
    const actual = g.actual ?? 0
    const diff = Math.round(((actual - g.planned) / g.planned) * 100)
    const off = Math.abs(diff) >= 10
    out.push({
      id: `cl-gap-${g.key}`,
      kind: off ? 'flag' : 'note',
      label: off ? `انحراف في ${g.label}` : `${g.label} مطابقة`,
      /* The sign stays inside the same isolated span - outside it, it used to read as "146%+". */
      metric: { value: `\u2066${diff > 0 ? '+' : ''}${diff}%\u2069`, unit: 'عن المعتمد' },
      text:
        `الفعلي ${nf.format(actual)} ${unitAfter(actual, g.unit)} والمعتمد ${nf.format(g.planned)} · ` +
        (off
          ? 'الفرق جوهري ويحتاج إلى تفسير في التقرير قبل الاعتماد.'
          : 'الفرق داخل المدى المعقول.'),
      bold: [`${nf.format(actual)} ${unitAfter(actual, g.unit)}`],
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

  /* 3 - output 3 - evaluation indicators - second cycle only. */
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
        `تنص القاعدة 13 على أن هذا التقييم الاسترشادي دعم للمراجعة لا بديل عنها.`,
      bold: ['القاعدة 13'],
      src: 'مخرج 3 في 11.5 · مؤشرات التقييم',
    })

    const evalShort = evalBlockers(c)
    if (evalShort.length > 0) {
      out.push({
        id: 'cl-eval-short',
        kind: 'flag',
        label: 'يمنع إرسال التقييم',
        metric: { value: String(evalShort.length), unit: nounAfter(evalShort.length, MISSING_ITEM) },
        text: evalShort.join(' · '),
        src: 'قاعدة 10 · مطبَّقة على الدورة الثانية',
      })
    }
  }

  /* 4 - the institutional-communications stage - rule 9 - and absence is stated. */
  out.push({
    id: 'cl-comms',
    kind: 'note',
    label: 'النشر الإعلامي',
    text: needsComms(c)
      ? 'تتضمن الاتفاقية التزام نشر إعلامي، فمراجعة الاتصال المؤسسي محطة في '
        + 'دورة التقرير · القاعدة 9.'
      : 'لا يوجد التزام نشر إعلامي في الاتفاقية، فتُتخطّى محطة الاتصال '
        + 'المؤسسي · القاعدة 9 تشترطها «متى كانت مطلوبة».',
    bold: ['القاعدة 9'],
    src: 'قاعدة 9 · التزامات النشر في الاتفاقية',
  })

  /* 5 - what's pending now, and with whom. */
  if (canStartEval(c)) {
    out.push({
      id: 'cl-next',
      kind: 'note',
      label: 'التقييم مستحقّ',
      text:
        'اعتمد المدير التنفيذي التقرير، فتحقّقت القاعدة 6 ويمكن بدء تقييم '
        + 'المشروع · ويُعدّه مشرف المنح لا الجهة.',
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
        `عند ${closeStageWho(c.stage) || 'المؤسسة'} · وهذه الحدود مؤقتة حتى `
        + 'تحدّدها المؤسسة (س-18).',
      src: 'حدود مؤقتة · ليست من الوثيقة',
    })
  }

  /* 6 - financial requirements - rules 8 and 18. */
  const req = closeRequirements(c)
  if (!req.ok || reportApproved(c)) {
    out.push({
      id: 'cl-req',
      kind: req.ok ? 'note' : 'flag',
      label: 'متطلبات الإغلاق',
      text: req.ok
        ? 'لا يوجد التزام مالي معلّق · فالمانع الوحيد للإغلاق النهائي هو '
          + 'اكتمال الاعتمادين (قاعدة 18).'
        : `${req.say} · وتمنع القاعدة 8 تحويل المشروع إلى «مكتمل» قبل تسويتها.`,
      bold: ['قاعدة 18'],
      src: 'قاعدة 8 و18 · وتفصيل المتطلبات سؤال مفتوح (س-15)',
    })
  }

  return out
}
