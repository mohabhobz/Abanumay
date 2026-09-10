import { nf, pct } from '@/lib/format'
import { projectRows } from './mock/projects'
import { entityRows } from './mock/entities'
import { budgetForYear } from './budget'
import { closingRows, gapOf, knowledgeRows } from './closing'
import { ENTITY_DOCS_TOTAL, stagePressure } from './repository'
import { YEARS } from './mock/taxonomy'
import type { IconName } from '@/components/ui'

/**
 * لوحة التقارير — **كل كارت سؤال وإجابته**.
 *
 * الملاحظة اللي طلعت من قراءة النظام العامل: أربعتاشر شاشة تقرير،
 * كل واحدة **فورم فلترة** لازم تملاه قبل ما تشوف رقم، وتلاتة منها
 * بتطلع فاضية بعد ما تملاه. يعني الرقم موجود والمسافة بينه وبين
 * القرار طويلة.
 *
 * فاللوحة دي بتقلب الترتيب: **الإجابة الأول**. كل كارت فيه رقم
 * محسوب للفترة المختارة، وجملة بتقول الرقم معناه إيه، ومصدره من
 * أي شاشة في النظام، وطريق للصفوف نفسها. اللي عايز يفلتر بيفلتر
 * **بعد** ما يشوف، لا قبل.
 *
 * ونفس قواعد كارت التحليلات: الرقم محسوب من نفس الداتا المعروضة،
 * والمصدر مكتوب، وفيه طريق. الفرق إن ده على مستوى المؤسسة لا على
 * مستوى صف واحد.
 */

export interface ReportCard {
  key: string
  /** السؤال اللي الكارت بيجاوب عليه — مش اسم التقرير */
  question: string
  icon: IconName
  /** الرقم الكبير */
  value: string
  /** وحدة الرقم */
  unit: string
  /** الجملة اللي بتفسّر الرقم */
  reading: string
  /** الكلمات اللي تتبرز */
  bold?: string[]
  /** اللي منها يتلوّن أحمر */
  danger?: string[]
  /** من أي شاشة في النظام العامل */
  src: string
  /** شريط أو أعمدة صغيرة تحت الرقم */
  bars?: { k: string; v: number; tone?: 'ok' | 'warn' | 'no' | 'mute' }[]
  /** نسبة تتعرض كقوس */
  ring?: { value: number; label: string }
  /** حجم الكارت في الشبكة */
  wide?: boolean
}

const money = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} م` : nf.format(n))

/** الفترة = سنة × مصدر تمويل، زي فلتر النظام بالظبط */
export const PERIODS = YEARS.map((y) => ({ id: y.id, label: y.label }))

export function boardCards(yearId: string): ReportCard[] {
  const rows = projectRows.filter((p) => p.year === yearId)
  const bud = budgetForYear(yearId)
  /* الختامي والمعرفة **تراكميان**: التقرير الختامي بيترفع بعد سنة
     أو اتنين من سنة المنحة، فلو اتفلتروا بسنة المنحة الكارت بيقرا
     على مشروعين ويطلع متوسطًا بلا معنى. الفلتر فوق بيحكم المال
     والخط الإجرائي، ودول بيقروا كل اللي اتقفل. */
  const closing = closingRows
  const know = knowledgeRows

  const out: ReportCard[] = []

  /* ١ · الميزانية — الرقم اللي المؤسسة كلها بتتقاس بيه */
  const usedPct = bud.allocated ? Math.round((bud.spent / bud.allocated) * 100) : 0
  const lockedPct = bud.allocated
    ? Math.round(((bud.reserved + bud.committed) / bud.allocated) * 100)
    : 0
  out.push({
    key: 'budget',
    question: 'الميزانية واقفة فين؟',
    icon: 'budget',
    value: pct(usedPct),
    unit: 'من المخصص وصل فعلًا',
    reading:
      `المخصص ${money(bud.allocated)} ريال، منها ${money(bud.spent)} مصروف و${money(bud.committed)} ملتزم بها ` +
      `و${money(bud.reserved)} محجوزة لطلبات تحت الدراسة — يعني ${pct(lockedPct)} مربوطة ولسه ما خرجتش.`,
    bold: [money(bud.spent), pct(lockedPct)],
    src: 'تقارير الميزانية · reports1_1',
    /* الأربعة بيقسّموا المخصص بلا تداخل: المصروف جزء من الملتزم،
       فلو الاتنين اتعرضوا كاملين المجموع بيتعدّى المخصص والنِّسب
       بتكدب. «ملتزم لم يُصرف» هو الفرق بينهم. */
    bars: [
      { k: 'مصروف', v: bud.spent, tone: 'ok' },
      { k: 'ملتزم لم يُصرف', v: Math.max(0, bud.committed - bud.spent), tone: 'warn' },
      { k: 'محجوز', v: bud.reserved, tone: 'mute' },
      { k: 'متبقٍ', v: Math.max(0, bud.remaining), tone: 'mute' },
    ],
    ring: { value: usedPct, label: 'مصروف' },
    wide: true,
  })

  /* ٢ · المخطط مقابل الفعلي — أهم سؤال، وأول مرة يتعرض */
  if (closing.length) {
    const g = gapOf(closing)
    out.push({
      key: 'actual',
      question: 'الوعد اتنفّذ ولا لأ؟',
      icon: 'chart',
      value: `${g.days > 0 ? '+' : ''}${pct(g.days)}`,
      unit: 'فرق المدة الفعلية عن المخططة',
      reading:
        `على ${nf.format(g.total)} تقريرًا ختاميًا: المدة الفعلية أطول بـ${pct(Math.abs(g.days))} في المتوسط، ` +
        `والمستفيدون الفعليون أقل بـ${pct(Math.abs(g.beneficiaries))}، و${nf.format(g.metTarget)} مشروعًا بس ` +
        `وصل للعدد المتعاقد عليه.`,
      bold: [pct(Math.abs(g.days)), pct(Math.abs(g.beneficiaries))],
      danger: [pct(Math.abs(g.days))],
      src: 'التقارير الختامية · reports1_12 — كل ما اكتمل، لا سنة المنحة',
      bars: [
        { k: 'تجاوز مدته', v: g.lateCount, tone: 'no' },
        { k: 'في موعده', v: g.total - g.lateCount, tone: 'ok' },
      ],
      wide: true,
    })
  }

  /* ٣ · الصرف حسب الهدف — فين تركّز المال */
  const byGoal = new Map<string, number>()
  for (const p of rows) if (p.amountGranted > 0) byGoal.set(p.goal, (byGoal.get(p.goal) ?? 0) + p.amountGranted)
  const goals = [...byGoal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (goals.length) {
    const total = [...byGoal.values()].reduce((a, b) => a + b, 0)
    const topShare = Math.round((goals[0][1] / total) * 100)
    out.push({
      key: 'spend',
      question: 'المال رايح فين؟',
      icon: 'chart',
      value: pct(topShare),
      unit: 'من المعتمد في هدف واحد',
      reading:
        `أعلى هدف استهلاكًا «${goals[0][0]}» بـ${money(goals[0][1])} ريال من إجمالي ${money(total)}. ` +
        `أعلى خمسة أهداف بياخدوا ${pct(Math.round((goals.reduce((s, g) => s + g[1], 0) / total) * 100))} من المعتمد.`,
      bold: [goals[0][0], money(goals[0][1])],
      src: 'مخصص الصرف · reports1_5 — المصاريف السنوية حسب الهدف',
      bars: goals.map(([k, v]) => ({ k, v, tone: 'ok' as const })),
    })
  }

  /* ٤ · الشركاء — الجهة اللي هتوقف الاتفاقية */
  const short = entityRows.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL)
  const stalled = entityRows.filter((e) => e.projectsStalled > 0)
  out.push({
    key: 'partners',
    question: 'مين من الجهات هيوقفني؟',
    icon: 'entity',
    value: nf.format(short.length),
    unit: `جهة ملفها ناقص من ${nf.format(entityRows.length)}`,
    reading:
      `${nf.format(short.length)} جهة ملفها الورقي ناقص، فأي اعتماد لها بيقف عند توقيع الاتفاقية. ` +
      `و${nf.format(stalled.length)} جهة عندها مشروع متعثّر لم يُغلق.`,
    bold: [`${nf.format(short.length)} جهة`],
    danger: [`${nf.format(short.length)} جهة`],
    src: 'تقارير الشركاء · reports1_2',
    bars: [
      { k: 'ملفها مكتمل', v: entityRows.length - short.length, tone: 'ok' },
      { k: 'ناقص', v: short.length, tone: 'no' },
    ],
  })

  /* ٥ · الأداء الداخلي — فين المشاريع بتقف */
  const late = rows.filter((p) => stagePressure(p) > 1)
  const byStage = new Map<string, number>()
  for (const p of late) byStage.set(p.stage, (byStage.get(p.stage) ?? 0) + 1)
  const worst = [...byStage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  out.push({
    key: 'stages',
    question: 'المشاريع بتقف فين؟',
    icon: 'clock',
    value: nf.format(late.length),
    unit: 'مشروعًا فوق حدّ قسمه',
    reading: worst.length
      ? `أكتر قسم بيوقف عنده المشاريع «${worst[0][0]}» بـ${nf.format(worst[0][1])} مشروعًا. ` +
        `المكوث بيتقاس فعلًا في النظام، والحدّ المقارَن بيه مؤقت لحين اعتماده.`
      : 'مفيش مشروع فوق حدّ قسمه في الفترة دي.',
    bold: worst.length ? [worst[0][0]] : [],
    danger: [nf.format(late.length)],
    src: 'أداء الأقسام · reports1_15',
    bars: worst.map(([k, v]) => ({ k, v, tone: 'no' as const })),
  })

  /* ٦ · المعرفة — الحقل الإلزامي اللي بيتملّى بنقطة */
  if (know.length) {
    const real = know.filter((k) => k.real).length
    const empty = know.filter((k) => k.empty).length
    out.push({
      key: 'knowledge',
      question: 'بنتعلّم من اللي عملناه؟',
      icon: 'doc',
      value: pct(Math.round((real / know.length) * 100)),
      unit: 'من قيود المعرفة فيها درس مكتوب',
      reading:
        `${nf.format(know.length)} قيدًا في تقرير المعرفة، ${nf.format(empty)} منها نصّها نقطة واحدة ` +
        `و${nf.format(real)} بس فيها درس فعلي. الحقل إلزامي، فبيتملّى عشان يعدّي لا عشان يُقرأ.`,
      bold: [nf.format(real)],
      danger: [nf.format(empty)],
      src: 'تقرير المعرفة · reports1_13 — كل القيود المرفوعة',
      bars: [
        { k: 'درس مكتوب', v: real, tone: 'ok' },
        { k: 'نصّ قصير', v: know.length - real - empty, tone: 'warn' },
        { k: 'نقطة', v: empty, tone: 'no' },
      ],
    })
  }

  return out
}
