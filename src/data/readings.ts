/**
 * قراءات المساعد — محسوبة، مش مكتوبة.
 *
 * كل دالة هنا بتاخد نفس الداتا اللي الشاشة بتعرضها وترجّع قراءات.
 * يعني القراءة ما تقدرش تتعارض مع اللي قدام المستخدم، ولا تبقى
 * قديمة لما الداتا تتغيّر — وده الفرق بين مساعد وبين نص ثابت.
 *
 * لما الباك اند يجهز، الملف ده يا إما يفضل زي ما هو (بيحسب من
 * الصفوف اللي رجعت)، يا إما يتحوّل لنداء `GET /insights/:screen`
 * بنفس شكل `Reading[]` — والواجهة ما تتغيّرش.
 */
import type { Reading } from '@/components/assistant/reading'
import type { EntityRow, ProjectRow } from '@/types/domain'
import { stagePressure, ENTITY_DOCS_TOTAL } from './repository'
import { nf, units, pct as pctText } from '@/lib/format'
import { ROUTES } from '@/app/routes'

const days = (hours: number) => Math.round(hours / 24)
const millions = (n: number) => `${(n / 1_000_000).toFixed(1)} م`
const overPct = (p: ProjectRow) => Math.round(stagePressure(p) * 100 - 100)

/** أكثر قيمة تكرارًا في قائمة، ومعاها عددها */
function topCount<T>(items: T[], key: (t: T) => string | null | undefined) {
  const tally = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    if (k) tally.set(k, (tally.get(k) ?? 0) + 1)
  }
  let best: [string, number] | null = null
  for (const entry of tally) if (!best || entry[1] > best[1]) best = entry
  return best
}

/* ═══════════════════ قائمة المشاريع ═══════════════════ */

export interface ProjectsReadingInput {
  /** كل المشاريع — أساس القراءات المطلقة */
  all: ProjectRow[]
  /** الصفوف بعد الفلتر الحالي */
  filtered: ProjectRow[]
  /** هل المستخدم مفلتر أصلًا */
  isFiltered: boolean
}

export function readProjects({ all, filtered, isFiltered }: ProjectsReadingInput): Reading[] {
  const out: Reading[] = []
  const scope = isFiltered ? filtered : all

  // 1) المتأخر — أول قراءة دايمًا، لأنه السبب الوحيد اللي بيخلي
  //    مشروعًا يقعد شهورًا من غير ما حد ياخد باله
  const late = scope.filter((p) => stagePressure(p) > 1)
  if (late.length) {
    const worst = late.reduce((a, b) => (a.hoursInStage > b.hoursInStage ? a : b))
    const d = units.day(days(worst.hoursInStage), true)
    const over = `${pctText(overPct(worst))} فوق الحدّ`
    out.push({
      id: 'late',
      kind: 'flag',
      label: 'تجاوز مدة الإجراء',
      metric: { value: String(late.length), unit: 'فوق حدّ القسم' },
      text:
        `${late.length === 1 ? 'وهو' : 'أطولها'} «${worst.name}» واقف من ${d} ` +
        `في «${worst.stage}» — أي ${over}.`,
      bold: [d, over],
      danger: [over],
      src: 'حدّ القسم الإجرائي · قيم مؤقتة لحين اعتمادها',
      to: `${ROUTES.projects}?overdue=1&sort=waiting`,
      toLabel: 'اعرضها',
    })
  }

  // 2) بلا مالك — ربع النظام، وما حدش مسؤول عنها
  const orphan = scope.filter((p) => p.owner === null)
  if (orphan.length) {
    const money = orphan.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    const m = `${millions(money)} ريال`
    out.push({
      id: 'orphan',
      kind: 'flag',
      label: 'بلا مالك',
      metric: { value: String(orphan.length), unit: 'بلا مالك' },
      text:
        `بقيمة ${m}. ما فيش موظف مسؤول عن متابعة أيٍّ منها، ` +
        `فبتتأخر من غير ما حد يلاحظ.`,
      bold: [m],
      src: 'عمود المالك في جدول المشاريع',
      to: `${ROUTES.projects}?unowned=1`,
      toLabel: 'إسناد جماعي',
    })
  }

  // 3) سبب الاعتذار الأكثر تكرارًا — ده اللي بيقول فين الخلل فعلًا
  const declined = scope.filter((p) => p.declineReason)
  const topReason = topCount(declined, (p) => p.declineReason)
  if (topReason && declined.length >= 3) {
    const [reason, hits] = topReason
    const n = units.project(declined.length, true)
    const c = units.case(hits, true)
    const pct = pctText(Math.round((hits / declined.length) * 100))
    out.push({
      id: 'decline',
      kind: 'note',
      label: 'أنماط الاعتذار',
      metric: { value: pct, unit: 'من الاعتذارات' },
      text: `سببها «${reason}» — ${c} من ${n} معتذر عنها في هذه الشريحة.`,
      bold: [`«${reason}»`, c],
      src: 'مبررات الاعتذار المقنّنة (9 مبررات)',
      to: `${ROUTES.projects}?status=معتذر عنه`,
      toLabel: 'اعرضها',
    })
  }

  // 4) قراءة الشريحة الحالية — تظهر فقط لما يكون في فلتر شغّال
  if (isFiltered && filtered.length) {
    const money = filtered.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    const avgWeight = Math.round(filtered.reduce((s, p) => s + p.weight, 0) / filtered.length)
    const topEntity = topCount(filtered, (p) => p.entityName)
    const m = `${nf.format(money)} ريال`
    out.push({
      id: 'scope',
      kind: 'note',
      label: 'الشريحة المعروضة',
      metric: { value: String(filtered.length), unit: `من ${all.length} معروض` },
      text:
        `قيمتها ${m} ومتوسط وزنها ${avgWeight}` +
        (topEntity && topEntity[1] > 1
          ? `، وأكثر جهة فيها «${topEntity[0]}» بـ${units.project(topEntity[1], true)}.`
          : '.'),
      bold: [m, `${avgWeight}`],
      src: 'محسوبة من الصفوف المعروضة',
    })
  }

  return out
}

/* ═══════════════════ قائمة الجهات ═══════════════════ */

export function readEntities(all: EntityRow[], filtered: EntityRow[], isFiltered: boolean): Reading[] {
  const out: Reading[] = []
  const scope = isFiltered ? filtered : all

  const incomplete = scope.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL)
  if (incomplete.length) {
    const running = incomplete.reduce((s, e) => s + e.projectsRunning, 0)
    const r = units.project(running, true)
    out.push({
      id: 'docs',
      kind: 'flag',
      label: 'ملفات ناقصة',
      metric: { value: String(incomplete.length), unit: `من ${scope.length} ملفها ناقص` },
      text:
        `وعندها ${r} تحت التشغيل. الاتفاقية الإلكترونية ما تُعتمد قبل ` +
        `اكتمال الملف، فالمشاريع دي هتقف.`,
      bold: [r],
      src: 'ملف الجهة = 8 مستندات',
      to: `${ROUTES.entities}?docs=1`,
      toLabel: 'اعرضها',
    })
  }

  const held = scope.filter((e) => e.activation.startsWith('معلق'))
  if (held.length) {
    const declined = held.reduce((s, e) => s + e.projectsDeclined, 0)
    const d = units.project(declined, true)
    out.push({
      id: 'held',
      kind: 'note',
      label: 'جهات معلّقة',
      metric: { value: String(held.length), unit: 'جهة معلّقة' },
      text:
        `ولها ${d} معتذر عنها. يستحق المراجعة: هل التعليق هو السبب ` +
        `في الاعتذار؟`,
      bold: [d],
      src: 'حالة التفعيل في سجل الشركاء',
    })
  }

  const stalled = scope.filter((e) => e.projectsStalled > 0)
  if (stalled.length) {
    const worst = stalled.reduce((a, b) => (a.projectsStalled > b.projectsStalled ? a : b))
    const w = `${units.project(worst.projectsStalled, true)} متعثر`
    out.push({
      id: 'stalled',
      kind: 'flag',
      label: 'تعثّر',
      metric: { value: String(stalled.length), unit: 'جهة بمشاريع متعثرة' },
      text:
        `أبرزها «${worst.name}» بـ${w} رغم أن إجمالي دعمها ` +
        `${millions(worst.grantedTotal)} ريال.`,
      bold: [`«${worst.name}»`, w, `${millions(worst.grantedTotal)} ريال`],
      danger: [w],
      src: 'تقارير الشركاء',
      to: ROUTES.entity(worst.id),
      toLabel: 'افتح ملفها',
    })
  }

  return out
}

/* ═══════════════════ صفحة الجهة ═══════════════════ */

export function readEntity(entity: EntityRow, projects: ProjectRow[]): Reading[] {
  const out: Reading[] = []
  const missing = ENTITY_DOCS_TOTAL - entity.docsUploaded

  if (missing > 0) {
    out.push({
      id: 'docs',
      kind: 'flag',
      label: 'ملف ناقص',
      metric: { value: String(missing), unit: `مستندات ناقصة من ${ENTITY_DOCS_TOTAL}` },
      text: 'أي مشروع لها هيقف عند اعتماد الاتفاقية لحد ما الملف يكتمل.',
      src: 'ملف الجهة المطلوب',
      bar: {
        value: entity.docsUploaded,
        limit: ENTITY_DOCS_TOTAL,
        valueLabel: 'المرفوع',
        limitLabel: 'المطلوب',
      },
      actions: [{ label: 'تذكير الجهة', kind: 'btn-1' }, { label: 'تسجيل ملاحظة', kind: 'btn-2' }],
    })
  }

  if (entity.governance === 'لم تُقيَّم') {
    out.push({
      id: 'gov',
      kind: 'note',
      label: 'الحوكمة',
      text:
        `درجة الحوكمة لسه غير مقيَّمة، فالمقارنة بين هذه الجهة وغيرها ` +
        `في نفس الهدف مش مكتملة عند اتخاذ القرار.`,
      bold: ['غير مقيَّمة'],
      src: 'حقل الحوكمة في ملف الجهة',
    })
  }

  const late = projects.filter((p) => stagePressure(p) > 1)
  if (late.length) {
    const worst = late.reduce((a, b) => (a.hoursInStage > b.hoursInStage ? a : b))
    const d = units.day(days(worst.hoursInStage), true)
    out.push({
      id: 'late',
      kind: 'flag',
      label: 'مشروع واقف',
      metric: { value: String(late.length), unit: 'من مشاريعها فوق الحدّ' },
      text:
        `${late.length === 1 ? 'وهو' : 'أطولها'} «${worst.name}» واقف من ${d} ` +
        `في «${worst.stage}».`,
      bold: [d],
      danger: [d],
      src: 'سجل الإجراءات',
      to: ROUTES.project(worst.id),
      toLabel: 'افتح المشروع',
    })
  }

  const topGoal = topCount(projects, (p) => p.goal)
  if (topGoal && topGoal[1] > 1) {
    const n = `${topGoal[1]} من مشاريعها`
    out.push({
      id: 'concentration',
      kind: 'note',
      label: 'تركّز',
      metric: { value: String(topGoal[1]), unit: 'في نفس الهدف' },
      text:
        `${n} «${topGoal[0]}». ` +
        `«مشروع مكرر لنفس الجهة» أحد مبررات الاعتذار المقنّنة، فيستحق التدقيق.`,
      bold: [n, `«${topGoal[0]}»`],
      src: 'شجرة المسار ← المجال ← الهدف',
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'clear',
      kind: 'note',
      label: 'لا ملاحظات',
      text: 'ملف الجهة مكتمل، ولا مشروع من مشاريعها متجاوز حدّ قسمه.',
      src: 'محسوبة من ملف الجهة ومشاريعها',
    })
  }

  return out
}

/* ═══════════════════ اليوم — قراءة عرضية للسيستم ═══════════════════ */

export interface HomeReadingInput {
  projects: ProjectRow[]
  entities: EntityRow[]
  /** الدور بيحدّد **أي** قراءات تتحسب أصلًا، مش ترتيبها بس */
  lens: 'own' | 'team' | 'portfolio'
  /** اسم المستخدم — للعدسة الشخصية */
  owner: string
  /** سقف الاعتماد، null = توصية فقط */
  ceiling: number | null
  budget: { allocated: number; reserved: number; committed: number; spent: number }
}

/**
 * القراءات اللي بتقطع الموديولات.
 *
 * صفحة المشاريع بتقرأ المشاريع، وصفحة الجهات بتقرأ الجهات — لكن
 * أخطر الملاحظات بتقع **بين** الاتنين: مشروع معتمد لجهة ملفها ناقص،
 * أو بند شغل نص مخصصه في شهرين. الشاشة دي هي المكان الوحيد اللي
 * بيشوف السيستم كله مرة واحدة، فقراءاتها عرضية بطبيعتها.
 *
 * والقراءات **مش واحدة لكل الأدوار**: المشرف بيشوف صندوقه، ومدير
 * المنح بيشوف حمل فريقه وما ينتظر اعتماده، والمدير التنفيذي بيشوف
 * المحفظة. نفس الداتا، تلات أسئلة مختلفة.
 */
export function readHome(input: HomeReadingInput): Reading[] {
  const { lens } = input
  if (lens === 'team') return readForManager(input)
  if (lens === 'portfolio') return readForExecutive(input)
  return readForSupervisor(input)
}

/* ── مشرف المنح: «إيه اللي عليّ النهارده؟» ── */
function readForSupervisor({ projects, entities, owner }: HomeReadingInput): Reading[] {
  const out: Reading[] = []

  const mine = projects.filter((p) => p.owner === owner && p.statusGroup === 'في الدراسة')
  const mineLate = mine.filter((p) => stagePressure(p) > 1)
  if (mine.length) {
    const money = mine.reduce((s, p) => s + p.amountRequested, 0)
    out.push({
      id: 'inbox',
      kind: mineLate.length ? 'flag' : 'note',
      label: 'صندوقك',
      metric: { value: String(mine.length), unit: 'تحت الدراسة' },
      text:
        `قيمتها ${nf.format(money)} ريال` +
        (mineLate.length
          ? `، منها ${units.project(mineLate.length, true)} فوق حدّ القسم.`
          : `، ولا واحد منها عدّى حدّ قسمه.`),
      bold: [`${nf.format(money)} ريال`,
        ...(mineLate.length ? [units.project(mineLate.length, true)] : [])],
      danger: mineLate.length ? [units.project(mineLate.length, true)] : [],
      src: 'المشاريع المسندة إليك',
      to: `${ROUTES.projects}?owner=${encodeURIComponent(owner)}&status=في الدراسة`,
      toLabel: 'افتح صندوقك',
    })
  }

  out.push(...blockedReading(projects, entities))

  // أطول ما وقف في صندوقه هو — رقم شخصي، مش متوسط السيستم
  const mineSorted = [...mine].sort((a, b) => stagePressure(b) - stagePressure(a))
  const worst = mineSorted[0]
  if (worst && worst.stageLimit > 0) {
    out.push({
      id: 'oldest',
      kind: stagePressure(worst) > 1 ? 'flag' : 'note',
      label: 'أقدم ما عندك',
      metric: { value: String(days(worst.hoursInStage)), unit: 'يومًا واقف' },
      text:
        `«${worst.name}» في «${worst.stage}». كل يوم زيادة هنا هو يوم ` +
        `الجهة مستنية فيه ردًّا.`,
      bold: [`«${worst.name}»`],
      src: 'مدة المكوث في القسم',
      to: ROUTES.project(worst.id),
      toLabel: 'افتحه',
    })
  }

  return out
}

/* ── مدير المنح: «فريقي ماشي إزاي، وإيه اللي واقف عندي؟» ── */
function readForManager({ projects, entities, ceiling, budget }: HomeReadingInput): Reading[] {
  const out: Reading[] = []

  // ما ينتظر اعتماده هو — اللي فوق سقف المشرف
  const waiting = projects.filter(
    (p) => p.statusGroup === 'في الدراسة' && (ceiling === null || p.amountRequested > ceiling),
  )
  if (waiting.length) {
    const money = waiting.reduce((s, p) => s + p.amountRequested, 0)
    out.push({
      id: 'approvals',
      kind: 'flag',
      label: 'ينتظر اعتمادك',
      metric: { value: String(waiting.length), unit: 'فوق سقف المشرف' },
      text:
        `قيمتها ${nf.format(money)} ريال. المشرف يوصي، لكن الاعتماد ` +
        `عند هذا المبلغ قرارك أنت.`,
      bold: [`${nf.format(money)} ريال`],
      src: 'سقوف الاعتماد · قيم مؤقتة لحين اعتمادها',
      to: `${ROUTES.projects}?status=في الدراسة&sort=amount`,
      toLabel: 'اعرضها',
    })
  }

  // توزيع الحمل — الاختلال ده هو اللي بيصنع التأخير أصلًا
  const load = new Map<string, ProjectRow[]>()
  for (const p of projects) {
    if (p.statusGroup !== 'في الدراسة') continue
    const k = p.owner ?? '—'
    load.set(k, [...(load.get(k) ?? []), p])
  }
  const owned = [...load.entries()].filter(([k]) => k !== '—')
  if (owned.length > 1) {
    const heaviest = owned.reduce((a, b) => (a[1].length > b[1].length ? a : b))
    const lightest = owned.reduce((a, b) => (a[1].length < b[1].length ? a : b))
    out.push({
      id: 'load',
      kind: heaviest[1].length - lightest[1].length > 1 ? 'flag' : 'note',
      label: 'توزيع الحمل',
      metric: { value: String(heaviest[1].length), unit: `عند ${heaviest[0]}` },
      text:
        `مقابل ${units.project(lightest[1].length, true)} عند ${lightest[0]}. ` +
        `الفرق ده بيظهر في مدد الانتظار قبل ما يظهر في أي تقرير.`,
      bold: [units.project(lightest[1].length, true), lightest[0]],
      src: 'المشاريع تحت الدراسة لكل مشرف',
      to: `${ROUTES.projects}?owner=${encodeURIComponent(heaviest[0])}&status=في الدراسة`,
      toLabel: 'اعرضها',
    })
  }

  // بلا مالك — قرار الإسناد قراره هو
  const orphan = projects.filter((p) => p.owner === null)
  if (orphan.length) {
    const money = orphan.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    out.push({
      id: 'orphan',
      kind: 'flag',
      label: 'بلا مالك',
      metric: { value: String(orphan.length), unit: 'محتاجة إسناد' },
      text:
        `بقيمة ${nf.format(money)} ريال. ما فيش موظف مسؤول عن متابعة ` +
        `أيٍّ منها، فبتتأخر من غير ما حد يلاحظ.`,
      bold: [`${nf.format(money)} ريال`],
      src: 'عمود المالك في جدول المشاريع',
      to: `${ROUTES.projects}?unowned=1`,
      toLabel: 'إسناد جماعي',
    })
  }

  out.push(...blockedReading(projects, entities))
  out.push(bottleneckReading(projects) ?? budgetReading(budget))

  return out
}

/* ── المدير التنفيذي: «المحفظة رايحة فين؟» ── */
function readForExecutive({ projects, entities, budget }: HomeReadingInput): Reading[] {
  const out: Reading[] = []

  out.push(budgetReading(budget))

  // الأثر: المكتمل مقابل المعتذر عنه — النسبة دي هي حصيلة السنة
  const done = projects.filter((p) => p.statusGroup === 'مكتمل')
  const declined = projects.filter((p) => p.statusGroup === 'معتذر عنه')
  const beneficiaries = done.reduce((s, p) => s + p.beneficiaries, 0)
  if (done.length) {
    out.push({
      id: 'impact',
      kind: 'note',
      label: 'الأثر',
      metric: { value: nf.format(beneficiaries), unit: 'مستفيد من المكتمل' },
      text:
        `عبر ${units.project(done.length, true)} مكتمل بتكلفة وسيطة ` +
        `${nf.format(Math.round(done.reduce((s, p) => s + p.amountGranted, 0) / Math.max(1, beneficiaries)))} ريال للمستفيد.`,
      bold: [units.project(done.length, true)],
      src: 'المشاريع المكتملة وتقاريرها الختامية',
      to: `${ROUTES.projects}?status=مكتمل`,
      toLabel: 'اعرضها',
    })
  }

  if (declined.length) {
    const rate = Math.round((declined.length / projects.length) * 100)
    out.push({
      id: 'decline',
      kind: rate > 50 ? 'flag' : 'note',
      label: 'معدّل الاعتذار',
      metric: { value: `${rate}%`, unit: 'من الطلبات' },
      text:
        `${units.project(declined.length, true)} من ${projects.length}. ` +
        `المعدل العالي بيعني إمّا أن الطلبات خارج النطاق، وإمّا أن ` +
        `الشروط غير واضحة للجهات قبل التقديم.`,
      bold: [units.project(declined.length, true)],
      src: 'مبررات الاعتذار المقنّنة',
      to: `${ROUTES.projects}?status=معتذر عنه`,
      toLabel: 'اعرضها',
    })
  }

  // الشركاء: التركّز — كام جهة ماسكة أغلب الدعم
  const byEntity = new Map<string, number>()
  for (const p of projects) {
    if (p.amountGranted > 0) {
      byEntity.set(p.entityName, (byEntity.get(p.entityName) ?? 0) + p.amountGranted)
    }
  }
  const ranked = [...byEntity.entries()].sort((a, b) => b[1] - a[1])
  const totalGranted = ranked.reduce((s, e) => s + e[1], 0)
  if (ranked.length >= 3 && totalGranted > 0) {
    const top3 = ranked.slice(0, 3).reduce((s, e) => s + e[1], 0)
    const share = Math.round((top3 / totalGranted) * 100)
    out.push({
      id: 'concentration',
      kind: share > 60 ? 'flag' : 'note',
      label: 'تركّز الشركاء',
      metric: { value: `${share}%`, unit: 'عند ثلاث جهات' },
      text:
        `من إجمالي الممنوح، وأعلاها «${ranked[0][0]}» بـ${nf.format(ranked[0][1])} ريال. ` +
        `التركّز بيرفع الأثر وبيرفع المخاطرة في نفس الوقت.`,
      bold: [`«${ranked[0][0]}»`, `${nf.format(ranked[0][1])} ريال`],
      src: 'الممنوح لكل جهة',
      to: `${ROUTES.entities}?sort=granted`,
      toLabel: 'الجهات',
    })
  }

  out.push(...blockedReading(projects, entities))

  return out
}

/* ── قراءات مشتركة بين أكتر من دور ── */

/** التقاطع بين المشاريع وملفات الجهات — ما يظهرش في أي شاشة لوحده */
function blockedReading(projects: ProjectRow[], entities: EntityRow[]): Reading[] {
  const short = new Set(
    entities.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL).map((e) => e.id),
  )
  const blocked = projects.filter(
    (p) => p.statusGroup === 'في التشغيل' && short.has(p.entityId),
  )
  if (!blocked.length) return []
  const money = blocked.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
  return [{
    id: 'blocked',
    kind: 'flag',
    label: 'مهدَّدة بالتوقف',
    metric: { value: String(blocked.length), unit: 'لجهات ملفها ناقص' },
    text:
      `بقيمة ${nf.format(money)} ريال تحت التشغيل. اعتماد الاتفاقية ` +
      `بيقف على مستندات الجهة، مش على المشروع.`,
    bold: [`${nf.format(money)} ريال`],
    src: 'تقاطع جدول المشاريع مع ملفات الجهات',
    to: `${ROUTES.entities}?docs=1`,
    toLabel: 'الجهات الناقصة',
  }]
}

function budgetReading(budget: HomeReadingInput['budget']): Reading {
  const used = budget.reserved + budget.committed
  const pct = budget.allocated ? Math.round((used / budget.allocated) * 100) : 0
  return {
    id: 'budget',
    kind: 'note',
    label: 'الميزانية',
    metric: { value: `${pct}%`, unit: 'من مخصص 2026' },
    text:
      `محجوز أو ملتزم به — ${nf.format(budget.committed)} ريال التزامًا ` +
      `و${nf.format(budget.reserved)} حجزًا مقابل مخصص ${nf.format(budget.allocated)}.`,
    bold: [`${nf.format(budget.committed)} ريال`, `${nf.format(budget.reserved)}`],
    bar: {
      value: used,
      limit: budget.allocated,
      valueLabel: 'محجوز وملتزم',
      limitLabel: 'المخصص',
    },
    src: 'المخصص من النظام العامل · الباقي محسوب من العيّنة التجريبية',
    to: ROUTES.budget,
    toLabel: 'الميزانية',
  }
}

/** أي قسم إجرائي فيه أطول طابور — مكان أول تحسين في الزمن */
function bottleneckReading(projects: ProjectRow[]): Reading | null {
  const live = projects.filter((p) => p.stageLimit > 0)
  const byStage = new Map<string, ProjectRow[]>()
  for (const p of live) byStage.set(p.stage, [...(byStage.get(p.stage) ?? []), p])

  const avg = (rows: ProjectRow[]) =>
    rows.reduce((s, p) => s + stagePressure(p), 0) / rows.length

  let worst: [string, ProjectRow[]] | null = null
  for (const entry of byStage) if (!worst || avg(entry[1]) > avg(worst[1])) worst = entry
  if (!worst) return null

  const [stage, rows] = worst
  const avgDays = Math.round(rows.reduce((s, p) => s + p.hoursInStage, 0) / rows.length / 24)
  return {
    id: 'bottleneck',
    kind: 'note',
    label: 'أطول طابور',
    metric: { value: String(avgDays), unit: 'يومًا متوسط المكوث' },
    text:
      `في «${stage}»، على ${units.project(rows.length, true)}. ` +
      `ده المكان اللي أي تحسين في الزمن هيبان فيه أولًا.`,
    bold: [`«${stage}»`, units.project(rows.length, true)],
    src: 'مدة المكوث في القسم لكل مشروع',
    to: `${ROUTES.projects}?stage=${encodeURIComponent(stage)}&sort=waiting`,
    toLabel: 'اعرضها',
  }
}
