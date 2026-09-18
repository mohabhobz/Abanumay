import type { Reading } from '@/components/assistant/reading'
import {
  ACTIVITY_SAY, TODAY, lateActivities, phaseDone, planClaimed, planDone, planIssues,
  planPlanned, planSpi, readyToClose, spiSay, waitingReview,
} from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import type { PlanRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   قراءة خطة واحدة · نفس وحدة المساعد في السيستم كله

   ⚠️ **الترتيب: اللي بيمنع، بعده اللي بيتأخّر، بعده اللي بيطمّن.**
   الكارت المقفول بيعرض `readings[0]` لمحةً · فلو التطمين فوق،
   المشرف بيقرا «ماشية» ويقفل وعنده خمس أنشطة مستنّية قبوله.

   ⚠️ **وكل قراءة معاها طريق يوصّل لها.** القراءة اللي بتقول
   «نشاطان مستنّيان» ومحدش عارف فين، بتبقى لافتة لا أداة · فالقراءة
   هنا بتودّي **للنشاط نفسه** في الشجرة.
   ═══════════════════════════════════════════════════════════ */

export function planReadings(p: PlanRow, goTo: (actId: string) => void): Reading[] {
  const out: Reading[] = []
  const live = p.stage === 'active' || p.stage === 'done'
  const grant = projectById(p.projectId)?.amountGranted ?? 0

  /* ١ · قبل الاعتماد · اللي بيمنع الإرسال */
  if (!live) {
    const issues = planIssues(p, grant)
    if (issues.length > 0) {
      out.push({
        id: 'pl-issues',
        kind: 'flag',
        label: 'يمنع الإرسال',
        metric: { value: String(issues.length), unit: 'ملاحظة' },
        text: issues.slice(0, 3).map((i) => i.say).join(' '),
        src: 'محسوبة من قواعد BPD-012 لا من رأي',
      })
    } else {
      out.push({
        id: 'pl-ok',
        kind: 'note',
        label: 'جاهزة',
        text:
          'المراحل والأنشطة والشواهد المطلوبة مكتملة، ومجموع التكلفة يساوي '
          + 'قيمة المنحة · الخطة تقدر تتبعت.',
        src: 'محسوبة من الحقول لا من رأي المساعد',
      })
    }
    return out
  }

  /* ٢ · الطابور · وده اللي بيوقّف نسبة إنجاز حقيقية */
  const queue = waitingReview(p)
  if (queue.length > 0) {
    const gap = planClaimed(p) - planDone(p)
    out.push({
      id: 'pl-queue',
      kind: 'flag',
      label: 'مستنّي مراجعتك',
      metric: { value: String(queue.length), unit: 'نشاطًا' },
      text:
        `الجهة معلنة ${planClaimed(p)}٪ والمقبول ${planDone(p)}٪ · `
        + `${gap} نقطة مش محسوبة لحدّ ما تتراجع الشواهد.`,
      bold: [`${gap} نقطة`],
      src: 'قاعدة 14 · النشاط لا يُحتسب إنجازًا قبل قبول المشرف',
      actions: [{ label: `افتح «${queue[0].name}»`, onClick: () => goTo(queue[0].id) }],
    })
  }

  /* ٣ · المتأخّر · مقاسًا على النسخة المرجعية */
  const late = lateActivities(p, TODAY)
  if (late.length > 0) {
    const worst = [...late].sort((a, b) => a.to.localeCompare(b.to))[0]
    const days = Math.round(
      (new Date(TODAY).getTime() - new Date(worst.to).getTime()) / 86_400_000,
    )
    out.push({
      id: 'pl-late',
      kind: 'flag',
      label: 'عدّى موعده',
      metric: { value: String(late.length), unit: 'نشاطًا' },
      text:
        `أقدمها «${worst.name}» متأخّر ${days} يومًا عن ${worst.to}، وحالته `
        + `«${ACTIVITY_SAY[worst.state]}».`,
      danger: [`${days} يومًا`],
      /* ⚠️ المرجع هو النسخة المرجعية لا التواريخ الحالية · قاعدة 21
         بتخلّي أي تمديد يعدّي باعتماد، فالتأخير له سند ثابت */
      src: `مقاسة على النسخة المرجعية V${p.baseline}`,
      actions: [{ label: `افتح «${worst.name}»`, onClick: () => goTo(worst.id) }],
    })
  }

  /* ٤ · أداء الجدول · بطرفيه لا لوحده */
  const spi = planSpi(p)
  const say = spiSay(spi)
  if (spi !== null) {
    out.push({
      id: 'pl-spi',
      kind: say.tone === 'ok' ? 'note' : 'flag',
      label: 'أداء الجدول',
      metric: { value: spi.toFixed(2), unit: say.say },
      text:
        `المقبول ${planDone(p)}٪ والمخطَّط لليوم ${planPlanned(p)}٪ · `
        + 'واحد صحيح معناه ماشية بالظبط مع جدولها المعتمد.',
      bar: {
        value: planDone(p),
        limit: planPlanned(p),
        valueLabel: 'المقبول',
        limitLabel: 'المخطَّط لليوم',
        unit: '٪',
      },
      src: 'SPI مشتق من BPD-012 · الوثيقة ما حدّدتش مستهدفًا',
    })
  }

  /* ٥ · المرحلة اللي فيها الشغل دلوقتي */
  const busy = p.phases.find((ph) => phaseDone(ph) < 100)
  if (busy) {
    out.push({
      id: 'pl-phase',
      kind: 'note',
      label: 'المرحلة الجارية',
      metric: { value: `${phaseDone(busy)}٪`, unit: busy.name },
      text:
        `${busy.activities.filter((a) => a.state === 'accepted').length} من `
        + `${busy.activities.length} أنشطة مقبولة · المرحلة تنتهي ${busy.to}.`,
      src: 'النسبة من الأنشطة المقبولة وحدها',
    })
  }

  /* ٦ · مؤهَّل للإغلاق · مانع اترفع */
  if (readyToClose(p)) {
    out.push({
      id: 'pl-close',
      kind: 'note',
      label: 'مؤهَّل للإغلاق',
      text:
        'كل أنشطة الخطة اتقبلت · الخطة رفعت مانع الإغلاق، والإغلاق نفسه إجراء '
        + 'تاني له قواعده (التقرير الختامي · الاتصال المؤسسي · التقييم).',
      src: 'BPD-012 · الخطة مكتملة ⇒ المشروع مؤهَّل للإغلاق',
    })
  }

  return out
}
