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
import { nf, units } from '@/lib/format'
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

  // ١) المتأخر — أول قراءة دايمًا، لأنه السبب الوحيد اللي بيخلي
  //    مشروعًا يقعد شهورًا من غير ما حد ياخد باله
  const late = scope.filter((p) => stagePressure(p) > 1)
  if (late.length) {
    const worst = late.reduce((a, b) => (a.hoursInStage > b.hoursInStage ? a : b))
    const n = units.project(late.length, true)
    const d = units.day(days(worst.hoursInStage), true)
    const over = `${overPct(worst)}٪ فوق الحدّ`
    out.push({
      id: 'late',
      kind: 'flag',
      label: 'تجاوز مدة الإجراء',
      text:
        `فيه ${n} فوق حدّ القسم. ${late.length === 1 ? 'وهو' : 'أطولها'} ` +
        `«${worst.name}» واقف من ${d} في «${worst.stage}» — أي ${over}.`,
      bold: [n, d, over],
      danger: [over],
      src: 'حدّ القسم الإجرائي · قيم مؤقتة لحين اعتمادها',
      to: `${ROUTES.projects}?overdue=1&sort=waiting`,
      toLabel: 'اعرضها',
    })
  }

  // ٢) بلا مالك — ربع النظام، وما حدش مسؤول عنها
  const orphan = scope.filter((p) => p.owner === null)
  if (orphan.length) {
    const money = orphan.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    const n = units.project(orphan.length, true)
    const m = `${millions(money)} ريال`
    out.push({
      id: 'orphan',
      kind: 'flag',
      label: 'بلا مالك',
      text:
        `فيه ${n} بلا مالك بقيمة ${m}. ما فيش موظف مسؤول عن متابعة ` +
        `أيٍّ منها، فبتتأخر من غير ما حد يلاحظ.`,
      bold: [n, m],
      src: 'عمود المالك في جدول المشاريع',
      to: `${ROUTES.projects}?unowned=1`,
      toLabel: 'إسناد جماعي',
    })
  }

  // ٣) سبب الاعتذار الأكثر تكرارًا — ده اللي بيقول فين الخلل فعلًا
  const declined = scope.filter((p) => p.declineReason)
  const topReason = topCount(declined, (p) => p.declineReason)
  if (topReason && declined.length >= 3) {
    const [reason, hits] = topReason
    const n = units.project(declined.length, true)
    const c = units.case(hits, true)
    const pct = `${Math.round((hits / declined.length) * 100)}٪`
    out.push({
      id: 'decline',
      kind: 'note',
      label: 'أنماط الاعتذار',
      text:
        `${pct} من الاعتذارات سببها «${reason}» — ${c} من ${n} معتذر عنها ` +
        `في هذه الشريحة.`,
      bold: [pct, `«${reason}»`, c],
      src: 'مبررات الاعتذار المقنّنة (٩ مبررات)',
      to: `${ROUTES.projects}?status=معتذر عنه`,
      toLabel: 'اعرضها',
    })
  }

  // ٤) قراءة الشريحة الحالية — تظهر فقط لما يكون في فلتر شغّال
  if (isFiltered && filtered.length) {
    const money = filtered.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    const avgWeight = Math.round(filtered.reduce((s, p) => s + p.weight, 0) / filtered.length)
    const topEntity = topCount(filtered, (p) => p.entityName)
    const ratio = `${filtered.length} من ${all.length}`
    const m = `${nf.format(money)} ريال`
    out.push({
      id: 'scope',
      kind: 'note',
      label: 'الشريحة المعروضة',
      text:
        `الفلتر الحالي بيعرض ${ratio} مشروعًا، قيمتها ${m} ومتوسط وزنها ${avgWeight}` +
        (topEntity && topEntity[1] > 1
          ? `، وأكثر جهة فيها «${topEntity[0]}» بـ${units.project(topEntity[1], true)}.`
          : '.'),
      bold: [ratio, m, `${avgWeight}`],
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
    const n = units.entity(incomplete.length, true)
    const r = units.project(running, true)
    out.push({
      id: 'docs',
      kind: 'flag',
      label: 'ملفات ناقصة',
      text:
        `فيه ${n} من ${scope.length} ملفها ناقص، وعندها ${r} تحت التشغيل. ` +
        `الاتفاقية الإلكترونية ما تُعتمد قبل اكتمال الملف، فالمشاريع دي هتقف.`,
      bold: [n, r],
      src: 'ملف الجهة = ٨ مستندات',
      to: `${ROUTES.entities}?docs=1`,
      toLabel: 'اعرضها',
    })
  }

  const held = scope.filter((e) => e.activation.startsWith('معلق'))
  if (held.length) {
    const declined = held.reduce((s, e) => s + e.projectsDeclined, 0)
    const n = units.entity(held.length, true)
    const d = units.project(declined, true)
    out.push({
      id: 'held',
      kind: 'note',
      label: 'جهات معلّقة',
      text:
        `فيه ${n} معلّقة، ولها ${d} معتذر عنها. ` +
        `يستحق المراجعة: هل التعليق هو السبب في الاعتذار؟`,
      bold: [n, d],
      src: 'حالة التفعيل في سجل الشركاء',
    })
  }

  const stalled = scope.filter((e) => e.projectsStalled > 0)
  if (stalled.length) {
    const worst = stalled.reduce((a, b) => (a.projectsStalled > b.projectsStalled ? a : b))
    const n = units.entity(stalled.length, true)
    const w = `${units.project(worst.projectsStalled, true)} متعثر`
    out.push({
      id: 'stalled',
      kind: 'flag',
      label: 'تعثّر',
      text:
        `فيه ${n} عندها مشاريع متعثرة، أبرزها «${worst.name}» بـ${w} ` +
        `رغم أن إجمالي دعمها ${millions(worst.grantedTotal)} ريال.`,
      bold: [n, `«${worst.name}»`, w, `${millions(worst.grantedTotal)} ريال`],
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
    const m = units.doc(missing, true)
    out.push({
      id: 'docs',
      kind: 'flag',
      label: 'ملف ناقص',
      text:
        `ملف الجهة ناقص ${m} من ${ENTITY_DOCS_TOTAL}. ` +
        `أي مشروع لها هيقف عند اعتماد الاتفاقية لحد ما الملف يكتمل.`,
      bold: [m],
      danger: [m],
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
    const n = units.project(late.length, true)
    const d = units.day(days(worst.hoursInStage), true)
    out.push({
      id: 'late',
      kind: 'flag',
      label: 'مشروع واقف',
      text:
        `فيه ${n} من مشاريع الجهة فوق حدّ القسم، ` +
        `${late.length === 1 ? 'وهو' : 'أطولها'} «${worst.name}» واقف من ${d} ` +
        `في «${worst.stage}».`,
      bold: [n, d],
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
      text:
        `${n} في نفس الهدف «${topGoal[0]}». ` +
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
