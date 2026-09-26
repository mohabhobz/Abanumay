import { countOf, nf, NOUN, pct } from '@/lib/format'
import { projectRows } from './mock/projects'
import { entityRows } from './mock/entities'
import { budgetForYear } from './budget'
import { closingRows, gapOf, knowledgeRows } from './closing'
import { ENTITY_DOCS_TOTAL, stagePressure } from './repository'
import { YEARS } from './mock/taxonomy'
import type { IconName } from '@/components/ui'

/**
 * Reports dashboard · every card is a question and its answer.
 *
 * What came out of reviewing the live system: fourteen report screens, each one a filter form that
 * has to be filled in before any number appears, and three of them come up empty even after that.
 * So the number exists, but the distance between it and a decision is long.
 *
 * This dashboard reverses that order: the answer comes first. Every card carries a number already
 * calculated for the selected period, a sentence explaining what it means, its source screen in the
 * system, and a path to the underlying rows. Anyone who wants to filter does so **after** seeing
 * the number, not before.
 *
 * Same rules as the analytics card: the number is calculated from the same displayed data, the
 * source is stated, and there's a path through. The difference is that this operates at the
 * organization level rather than a single row.
 */

export interface ReportCard {
  key: string
  /** The question the card answers · not the report's name */
  question: string
  icon: IconName
  /** The headline number */
  value: string
  /** The number's unit */
  unit: string
  /** The sentence explaining the number */
  reading: string
  /** Words to highlight */
  bold?: string[]
  /** Which parts render in red */
  danger?: string[]
  /** Which live-system screen this comes from */
  src: string
  /** A small bar or column chart under the number */
  bars?: { k: string; v: number; tone?: 'ok' | 'warn' | 'no' | 'mute' }[]
  /** A percentage shown in parentheses */
  ring?: { value: number; label: string }
  /** The card's size in the grid */
  wide?: boolean
}

const money = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} م` : nf.format(n))

/** Period = year × funding source, exactly matching the system's filter */
export const PERIODS = YEARS.map((y) => ({ id: y.id, label: y.label }))

export function boardCards(yearId: string): ReportCard[] {
  const rows = projectRows.filter((p) => p.year === yearId)
  const bud = budgetForYear(yearId)
  /* The final report and "lessons learned" fields are cumulative: the final report is submitted one
     or two years after the grant year, so filtering strictly by grant year would make the card read
     from only two projects and produce a meaningless average. The filter above governs money and
     process flow; these two read everything that has closed. */
  const closing = closingRows
  const know = knowledgeRows

  const out: ReportCard[] = []

  /* 1 · budget · the figure the whole organization is measured against */
  const usedPct = bud.allocated ? Math.round((bud.spent / bud.allocated) * 100) : 0
  const lockedPct = bud.allocated
    ? Math.round(((bud.reserved + bud.committed) / bud.allocated) * 100)
    : 0
  out.push({
    key: 'budget',
    question: 'أين وصلت الميزانية؟',
    icon: 'budget',
    value: pct(usedPct),
    unit: 'من المخصص صُرف فعلًا',
    reading:
      `المخصص ${money(bud.allocated)} ⃁، منها ${money(bud.spent)} مصروفة و${money(bud.committed)} ملتزم بها ` +
      `و${money(bud.reserved)} محجوزة لطلبات تحت الدراسة، أي أن ${pct(lockedPct)} مربوطة ولم تُصرف بعد.`,
    bold: [money(bud.spent), pct(lockedPct)],
    src: 'تقارير الميزانية · reports1_1',
    /* The four figures split the allocation without overlap: disbursed is part of committed, so
       showing both at full value would push the total past the allocation and the percentages would
       be misleading. "Committed, not disbursed" is the gap between them. */
    bars: [
      { k: 'مصروف', v: bud.spent, tone: 'ok' },
      { k: 'ملتزم لم يُصرف', v: Math.max(0, bud.committed - bud.spent), tone: 'warn' },
      { k: 'محجوز', v: bud.reserved, tone: 'mute' },
      { k: 'متبقٍ', v: Math.max(0, bud.remaining), tone: 'mute' },
    ],
    ring: { value: usedPct, label: 'مصروف' },
    wide: true,
  })

  /* 2 · planned vs. actual · the most important question, shown here for the first time */
  if (closing.length) {
    const g = gapOf(closing)
    out.push({
      key: 'actual',
      question: 'هل نُفّذ ما وُعد به؟',
      icon: 'chart',
      value: `\u2066${g.days > 0 ? '+' : ''}${g.days}%\u2069`,
      unit: 'فرق المدة الفعلية عن المخططة',
      reading:
        `على ${countOf(g.total, NOUN.finalReport)}: المدة الفعلية أطول بـ${pct(Math.abs(g.days))} في المتوسط، ` +
        `والمستفيدون الفعليون أقل بـ${pct(Math.abs(g.beneficiaries))}، و${countOf(g.metTarget, NOUN.project)} فقط ` +
        `وصل إلى العدد المتعاقد عليه.`,
      bold: [pct(Math.abs(g.days)), pct(Math.abs(g.beneficiaries))],
      danger: [pct(Math.abs(g.days))],
      src: 'التقارير الختامية · reports1_12 · كل ما اكتمل، لا سنة المنحة',
      bars: [
        { k: 'تجاوز مدته', v: g.lateCount, tone: 'no' },
        { k: 'في موعده', v: g.total - g.lateCount, tone: 'ok' },
      ],
      wide: true,
    })
  }

  /* 3 · disbursement by goal · where the money is concentrated */
  const byGoal = new Map<string, number>()
  for (const p of rows) if (p.amountGranted > 0) byGoal.set(p.goal, (byGoal.get(p.goal) ?? 0) + p.amountGranted)
  const goals = [...byGoal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (goals.length) {
    const total = [...byGoal.values()].reduce((a, b) => a + b, 0)
    const topShare = Math.round((goals[0][1] / total) * 100)
    out.push({
      key: 'spend',
      question: 'أين يذهب المال؟',
      icon: 'chart',
      value: pct(topShare),
      unit: 'من المعتمد في هدف واحد',
      reading:
        `أعلى هدف استهلاكًا «${goals[0][0]}» بـ${money(goals[0][1])} ⃁ من إجمالي ${money(total)}. ` +
        `وتستحوذ أعلى خمسة أهداف على ${pct(Math.round((goals.reduce((s, g) => s + g[1], 0) / total) * 100))} من المعتمد.`,
      bold: [goals[0][0], money(goals[0][1])],
      src: 'مخصص الصرف · reports1_5 · المصروفات السنوية حسب الهدف',
      bars: goals.map(([k, v]) => ({ k, v, tone: 'ok' as const })),
    })
  }

  /* 4 · partners · the entity that will hold up an agreement */
  const short = entityRows.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL)
  const stalled = entityRows.filter((e) => e.projectsStalled > 0)
  out.push({
    key: 'partners',
    question: 'أي الجهات ستعطّل الاعتماد؟',
    icon: 'entity',
    value: nf.format(short.length),
    unit: `جهة ملفها ناقص من ${nf.format(entityRows.length)}`,
    reading:
      `${countOf(short.length, NOUN.entity)} ملفها الورقي ناقص، فأي اعتماد لها يتوقف عند توقيع الاتفاقية. ` +
      `و${countOf(stalled.length, NOUN.entity)} لديها مشروع متعثّر لم يُغلق.`,
    bold: [`${countOf(short.length, NOUN.entity)}`],
    danger: [`${countOf(short.length, NOUN.entity)}`],
    src: 'تقارير الشركاء · reports1_2',
    bars: [
      { k: 'ملفها مكتمل', v: entityRows.length - short.length, tone: 'ok' },
      { k: 'ناقص', v: short.length, tone: 'no' },
    ],
  })

  /* 5 · internal performance · where projects stand */
  const late = rows.filter((p) => stagePressure(p) > 1)
  const byStage = new Map<string, number>()
  for (const p of late) byStage.set(p.stage, (byStage.get(p.stage) ?? 0) + 1)
  const worst = [...byStage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  out.push({
    key: 'stages',
    question: 'أين تتوقف المشاريع؟',
    icon: 'clock',
    value: nf.format(late.length),
    unit: 'مشروعًا فوق حدّ قسمه',
    reading: worst.length
      ? `أكثر قسم تتوقف عنده المشاريع «${worst[0][0]}» بـ${countOf(worst[0][1], NOUN.project)}. ` +
        `المكوث يُقاس فعلًا في النظام، والحدّ المقارَن به مؤقت لحين اعتماده.`
      : 'لا يوجد مشروع فوق حدّ قسمه في هذه الفترة.',
    bold: worst.length ? [worst[0][0]] : [],
    danger: [nf.format(late.length)],
    src: 'أداء الأقسام · reports1_15',
    bars: worst.map(([k, v]) => ({ k, v, tone: 'no' as const })),
  })

  /* 6 · "lessons learned" · a required field usually filled with a single bullet point */
  if (know.length) {
    const real = know.filter((k) => k.real).length
    const empty = know.filter((k) => k.empty).length
    out.push({
      key: 'knowledge',
      question: 'هل نتعلّم مما أنجزناه؟',
      icon: 'doc',
      value: pct(Math.round((real / know.length) * 100)),
      unit: 'من قيود المعرفة فيها درس مكتوب',
      reading:
        `${countOf(know.length, NOUN.entry)} في تقرير المعرفة، ${nf.format(empty)} منها نصّها نقطة واحدة ` +
        `و${nf.format(real)} فقط فيها درس فعلي. الحقل إلزامي، فيُملأ لتجاوزه لا ليُقرأ.`,
      bold: [nf.format(real)],
      danger: [nf.format(empty)],
      src: 'تقرير المعرفة · reports1_13 · كل القيود المرفوعة',
      bars: [
        { k: 'درس مكتوب', v: real, tone: 'ok' },
        { k: 'نصّ قصير', v: know.length - real - empty, tone: 'warn' },
        { k: 'نقطة', v: empty, tone: 'no' },
      ],
    })
  }

  return out
}
