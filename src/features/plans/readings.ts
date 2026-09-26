import type { Reading } from '@/components/assistant/reading'
import { NOUN, countOf, nounAfter, pct, readDate } from '@/lib/format'
import {
  ACTIVITY_SAY, TODAY, lateActivities, phaseDone, planClaimed, planDone, planIssues,
  planPlanned, planSpi, readyToClose, spiSay, waitingReview,
} from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import type { PlanRow } from '@/types/domain'

/* A single plan's reading - same assistant unit used across the whole system.

   Note: order - what blocks first, then what's late, then what reassures. The closed card shows
   `readings[0]` as a preview - if reassurance came first, the supervisor would read "on track" and
   close it while five activities sit awaiting their acceptance.

   Note: every reading carries a path to where it points. A reading saying "two activities pending"
   with no way to find them is a sign, not a tool - so the reading here links to the activity itself
   in the tree. */

export function planReadings(p: PlanRow, goTo: (actId: string) => void): Reading[] {
  const out: Reading[] = []
  const live = p.stage === 'active' || p.stage === 'done'
  const grant = projectById(p.projectId)?.amountGranted ?? 0

  /* 1. Before approval - what blocks submission. */
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
          'المراحل والأنشطة والشواهد المطلوبة مكتملة، ومجموع الميزانية يساوي '
          + 'قيمة المنحة · الخطة جاهزة للإرسال.',
        src: 'محسوبة من الحقول لا من رأي المساعد',
      })
    }
    return out
  }

  /* 2. The queue - what actually holds back a real completion percentage. */
  const queue = waitingReview(p)
  if (queue.length > 0) {
    const gap = planClaimed(p) - planDone(p)
    out.push({
      id: 'pl-queue',
      kind: 'flag',
      label: 'بانتظار مراجعتك',
      metric: { value: String(queue.length), unit: nounAfter(queue.length, NOUN.activity) },
      text:
        `أعلنت الجهة ${pct(planClaimed(p))} والمقبول ${pct(planDone(p))} · `
        + `${gap} نقطة لا تُحتسب حتى تُراجَع الشواهد.`,
      bold: [`${gap} نقطة`],
      src: 'قاعدة 14 · النشاط لا يُحتسب إنجازًا قبل قبول المشرف',
      actions: [{ label: `افتح «${queue[0].name}»`, onClick: () => goTo(queue[0].id) }],
    })
  }

  /* 3. Late - measured against the baseline. */
  const late = lateActivities(p, TODAY)
  if (late.length > 0) {
    const worst = [...late].sort((a, b) => a.to.localeCompare(b.to))[0]
    const days = Math.round(
      (new Date(TODAY).getTime() - new Date(worst.to).getTime()) / 86_400_000,
    )
    out.push({
      id: 'pl-late',
      kind: 'flag',
      label: 'تجاوز موعده',
      metric: { value: String(late.length), unit: nounAfter(late.length, NOUN.activity) },
      text:
        `أقدمها «${worst.name}» متأخّر ${countOf(days, NOUN.day)} عن ${readDate(worst.to)}، وحالته `
        + `«${ACTIVITY_SAY[worst.state]}».`,
      danger: [countOf(days, NOUN.day)],
      /* Note: the reference is the baseline, not the current dates - rule 21 requires any extension
         to go through approval, so a delay has a fixed anchor. */
      src: `مقاسة على النسخة المرجعية V${p.baseline}`,
      actions: [{ label: `افتح «${worst.name}»`, onClick: () => goTo(worst.id) }],
    })
  }

  /* 4. Schedule performance - with both reference points, not alone. */
  const spi = planSpi(p)
  const say = spiSay(spi)
  if (spi !== null) {
    out.push({
      id: 'pl-spi',
      kind: say.tone === 'ok' ? 'note' : 'flag',
      label: 'أداء الجدول',
      metric: { value: spi.toFixed(2), unit: say.say },
      text:
        `المقبول ${pct(planDone(p))} والمخطَّط لليوم ${pct(planPlanned(p))} · `
        + 'القيمة 1 تعني أن الخطة تسير وفق جدولها المعتمد تمامًا.',
      bar: {
        value: planDone(p),
        limit: planPlanned(p),
        valueLabel: 'المقبول',
        limitLabel: 'المخطَّط لليوم',
        unit: '%',
      },
      src: 'مؤشر SPI مشتق من BPD-012 · لم تحدّد الوثيقة قيمة مستهدفة',
    })
  }

  /* 5. The phase currently active. */
  const busy = p.phases.find((ph) => phaseDone(ph) < 100)
  if (busy) {
    out.push({
      id: 'pl-phase',
      kind: 'note',
      label: 'المرحلة الجارية',
      metric: { value: `${pct(phaseDone(busy))}`, unit: busy.name },
      text:
        `${busy.activities.filter((a) => a.state === 'accepted').length} من `
        + `${busy.activities.length} أنشطة مقبولة · المرحلة تنتهي ${readDate(busy.to)}.`,
      src: 'النسبة من الأنشطة المقبولة وحدها',
    })
  }

  /* 6. Eligible for closing - a blocker was resolved. */
  if (readyToClose(p)) {
    out.push({
      id: 'pl-close',
      kind: 'note',
      label: 'مؤهَّل للإغلاق',
      text:
        'قُبلت كل أنشطة الخطة، فارتفع مانع الإغلاق · أما الإغلاق نفسه فإجراء '
        + 'مستقل له قواعده (التقرير الختامي · الاتصال المؤسسي · التقييم).',
      src: 'BPD-012 · الخطة مكتملة ⇒ المشروع مؤهَّل للإغلاق',
    })
  }

  return out
}
