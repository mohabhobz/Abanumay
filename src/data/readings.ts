/**
 * Assistant readings · computed, not written.
 *
 * Each function here takes the same data the screen displays and returns readings. That means a
 * reading can't contradict what the user is looking at, and can't go stale when the data changes —
 * that's the difference between an assistant and static text.
 *
 * Once the backend is ready, this file either stays as is (computing from the rows returned) or
 * becomes a call to `GET /insights/:screen` with the same `Reading[]` shape — the UI doesn't
 * change.
 */
import type { Reading, ReadingAction } from '@/components/assistant/reading'
import type { AgreementRow, CloseRow, EntityRow, Insight, PayRequest, PlanRow, ProjectRow } from '@/types/domain'
import { PAY_STATES, payBlocked, payHeat, payStateWho } from './mock/disbursements'
import { agrBlocked, agrPaymentsBalance, agrReserveGap } from './mock/agreements'
import {
  lateActivities, planClaimed, planDone, planPlanned, planSpi, readyToClose, waitingReview,
} from './mock/plans'
import { regMissingDocs, type RegRequest } from './mock/registration'
import { closeRows, reportBlockers } from './mock/closing'
import type { EntityDetail } from './mock/entityDetail'
import { stagePressure, ENTITY_DOCS_TOTAL } from './repository'
import { projectRows } from './mock/projects'
import { budgetForYear } from './budget'
import { closingRows, gapOf, knowledgeRows } from './closing'
import type { Journey } from './journey'
import { countOf, MISSING_ITEM, nf, NOUN, pct as pctText, units } from '@/lib/format'
import { ROUTES } from '@/app/routes'

const days = (hours: number) => Math.round(hours / 24)

/* Every list page marks its toolbar + results with this id, so a reading's link filters the list
   and lands on it (see `useHashScroll`). */
const LIST = '#list'

/** Full years from a `YYYY-MM-DD` date to today · `null` if the date is invalid */
function yearsSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 31_557_600_000)
}
const millions = (n: number) => `${(n / 1_000_000).toFixed(1)} م`
const overPct = (p: ProjectRow) => Math.round(stagePressure(p) * 100 - 100)

/** The most frequent value in a list, along with its count */
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

/* A single project's journey */

/**
 * Narrating a project's journey.
 *
 * What this answers: where a project has been, where it came back to, what its latest decision was
 * and what it's waiting on, and what action it needs now.
 *
 * The difference from the action history is that history states **everything** that happened in
 * order, while this narrative states **what matters for the decision**: how far it got, how many
 * times and to whom it was sent back, who it's currently with and for how long against its limit,
 * and what's required right now. A user opening a project never reads the history from the start.
 *
 * Every sentence is built from the row itself, so it changes with the project's actual status — a
 * completed project never says "needs action", and an excused one never says "pending".
 */
export function readJourney(row: ProjectRow, j: Journey | undefined): Reading[] {
  const out: Reading[] = []
  const over = overPct(row)
  const late = row.stageLimit > 0 && stagePressure(row) > 1
  const inDays = days(row.hoursInStage)

  /* 1 · where it stands now and what's needed */
  if (row.statusGroup === 'مكتمل') {
    out.push({
      id: 'j-done',
      kind: 'note',
      label: 'الوضع الحالي',
      text: `المشروع مغلق. آخر مرحلة «${row.stage}»، و${
        row.hasFinalReport ? 'التقرير الختامي مرفوع ومعتمد' : 'التقرير الختامي لم يُرفع'
      }. لا يلزمك أي إجراء.`,
      bold: [row.stage],
      src: 'حالة المشروع · سجل الإجراءات',
    })
  } else if (row.statusGroup === 'معتذر عنه') {
    out.push({
      id: 'j-declined',
      kind: 'note',
      label: 'الوضع الحالي',
      text: `المشروع معتذر عنه${row.declineReason ? `، السبب المسجَّل «${row.declineReason}»` : ' بلا سبب مسجَّل'}. لا يلزمك أي إجراء.`,
      bold: row.declineReason ? [row.declineReason] : [],
      src: 'قرار المشروع',
    })
  } else {
    out.push({
      id: 'j-now',
      kind: late ? 'flag' : 'note',
      label: 'الوضع الحالي',
      metric: { value: nf.format(inDays), unit: 'يومًا في القسم' },
      text: late
        ? `متوقف عند «${row.stage}» منذ ${units.day(inDays)}، أي ${pctText(over)} فوق حدّ القسم. المطلوب منك: ${nextAction(row)}.`
        : `في «${row.stage}» منذ ${units.day(inDays)}، ضمن حدّ القسم. المطلوب منك: ${nextAction(row)}.`,
      bold: [row.stage, units.day(inDays), nextAction(row)],
      danger: late ? [pctText(over)] : [],
      bar: row.stageLimit > 0
        ? {
            /* In days, not hours: "2,088 hours" is a number no one compares against anything, while
               "87 days versus 38" reads at a glance */
            value: days(row.hoursInStage),
            limit: days(row.stageLimit),
            valueLabel: 'المستهلَك',
            limitLabel: 'الحدّ',
            unit: 'يومًا',
          }
        : undefined,
      src: `حدّ قسم «${row.stage}»، مؤقت لحين اعتماده`,
    })
  }

  /* The two actions that address the delay live inside the reading itself, not in a separate card.
     A reading that says "over the limit" with no way out is just a complaint.
     Meeting 1 Oct (C-11): the assistant prepares, the person acts — the reminder is a draft the
     supervisor sends himself, and the reason is the one he writes, not one the assistant records. */
  const now = out[0]
  if (now && now.kind === 'flag') {
    now.actions = [
      { label: 'جهّز مسودة تذكير', kind: 'btn-2', done: 'جُهّزت مسودة التذكير في المراسلات · راجعها وأرسلها بنفسك' },
      { label: 'أضف سبب التأخر', kind: 'btn-2', note: 'سبب التأخر', done: 'أُضيف السبب الذي كتبته إلى سجل المشروع' },
    ]
  }

  /* 2 · how many times it was sent back — this is what the history log buries among its rows */
  const back = (j?.toEntity ?? 0) + (j?.toSupervisor ?? 0)
  if (back > 0) {
    const parts: string[] = []
    if (j?.toEntity) parts.push(`${j.toEntity === 1 ? 'مرة' : `${j.toEntity} مرات`} للجهة لاستكمال البيانات`)
    if (j?.toSupervisor) parts.push(`${j.toSupervisor === 1 ? 'مرة' : `${j.toSupervisor} مرات`} إلى مشرف المنح`)
    out.push({
      id: 'j-back',
      kind: back > 1 ? 'flag' : 'note',
      label: 'مرات الإعادة',
      text: `أُعيد المشروع ${parts.join(' و')}. كل إعادة تضيف دورة مراجعة كاملة إلى المدة.`,
      bold: parts,
      src: 'سجل الإجراءات',
    })
  }

  /* 3 · who it's currently with · clarifies whether it still needs escalation */
  if (j?.decidedBy) {
    out.push({
      id: 'j-level',
      kind: 'note',
      label: 'مستوى القرار',
      text: `اتُّخذ القرار عند «${j.decidedBy}»، والمبلغ ${nf.format(row.amountGranted || row.amountRequested)} ⃁ ضمن نطاق صلاحيته.`,
      bold: [j.decidedBy, `${nf.format(row.amountGranted || row.amountRequested)} ⃁`],
      src: 'حدود الصلاحيات · مؤقتة لحين اعتمادها',
    })
  }

  return out
}

/** The action required, based on the department the project is currently in */
function nextAction(row: ProjectRow): string {
  switch (row.stage) {
    case 'دراسة المشروع': return 'تسجيل التوصية'
    case 'استكمال بيانات المشروع': return 'متابعة الجهة لاستكمال النواقص'
    case 'اعتماد الإتفاقية':
    case 'اعتماد الإتفاقية الكترونيًا':
    case 'الإتفاقيات الورقية': return 'اعتماد الاتفاقية'
    case 'المشرف إذن الصرف':
    case 'إذن صرف معاد': return 'إصدار إذن الصرف'
    case 'اصدار سند الصرف': return 'إصدار سند الصرف'
    case 'رفع سند القبض والقيد': return 'رفع سند القبض'
    case 'رفع تقرير مرحلي': return 'مطالبة الجهة بالتقرير المرحلي'
    case 'طلب التقرير الختامي':
    case 'رفع التقرير الختامي': return 'مطالبة الجهة بالتقرير الختامي'
    case 'اعتماد التقرير الختامي': return 'اعتماد التقرير الختامي'
    case 'تقييم المشروع': return 'تسجيل التقييم'
    default: return 'مراجعة الملف'
  }
}

/* Project list */

export interface ProjectsReadingInput {
  /** All projects · the basis for absolute readings */
  all: ProjectRow[]
  /** Rows after the active filter */
  filtered: ProjectRow[]
  /** Whether the user has a filter applied at all */
  isFiltered: boolean
}

export function readProjects({ all, filtered, isFiltered }: ProjectsReadingInput): Reading[] {
  const out: Reading[] = []
  const scope = isFiltered ? filtered : all

  // 1) Delayed · always the first reading, since it's the one reason a project can sit for months
  // with no one noticing
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
        `${late.length === 1 ? 'وهو' : 'أطولها'} «${worst.name}»، متوقف منذ ${d} ` +
        `في «${worst.stage}»، أي ${over}.`,
      bold: [d, over],
      danger: [over],
      src: 'حدّ القسم الإجرائي · قيم مؤقتة لحين اعتمادها',
      to: `${ROUTES.projects}?overdue=1&sort=waiting${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  // 2) Unowned · a quarter of the system, with no one responsible
  const orphan = scope.filter((p) => p.owner === null)
  if (orphan.length) {
    const money = orphan.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    const m = `${millions(money)} ⃁`
    out.push({
      id: 'orphan',
      kind: 'flag',
      label: 'بلا مالك',
      metric: { value: String(orphan.length), unit: 'بلا مالك' },
      text:
        `بقيمة ${m}. لا يتابع أيًّا منها موظف مسؤول، ` +
        `فتتأخر دون أن يلاحظ أحد.`,
      bold: [m],
      src: 'عمود المالك في جدول المشاريع',
      to: `${ROUTES.projects}?unowned=1${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  // 3) The most common excusal reason · this is what actually points to where the problem is
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
      text: `سببها «${reason}»، ${c} من ${n} معتذر عنها في هذه الشريحة.`,
      bold: [`«${reason}»`, c],
      src: 'مبررات الاعتذار المقنّنة (9 مبررات)',
      to: `${ROUTES.projects}?status=معتذر عنه${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  // 4) Reading for the current filter slice · shown only when a filter is active
  if (isFiltered && filtered.length) {
    const money = filtered.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    const avgWeight = Math.round(filtered.reduce((s, p) => s + p.weight, 0) / filtered.length)
    const topEntity = topCount(filtered, (p) => p.entityName)
    const m = `${nf.format(money)} ⃁`
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

/* Entity list */

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
        `ولديها ${r} تحت التنفيذ. لا تُعتمد الاتفاقية الإلكترونية قبل ` +
        `اكتمال الملف، فستتوقف هذه المشاريع.`,
      bold: [r],
      src: 'ملف الجهة = 8 مستندات',
      to: `${ROUTES.entities}?docs=1${LIST}`,
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
        `ولها ${d} معتذر عنها. يستحق التحقق: هل التعليق هو سبب ` +
        `الاعتذار؟`,
      bold: [d],
      src: 'حالة التفعيل في سجل الشركاء',
      to: `${ROUTES.entities}?activation=${[...new Set(held.map((e) => e.activation))].join(',')}${LIST}`,
      toLabel: 'اعرضها',
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
        `${millions(worst.grantedTotal)} ⃁.`,
      bold: [`«${worst.name}»`, w, `${millions(worst.grantedTotal)} ⃁`],
      danger: [w],
      src: 'تقارير الشركاء',
      to: ROUTES.entity(worst.id),
      toLabel: 'اعرضها',
    })
  }

  return out
}

/* Entity page */

/**
 * Entity file readings.
 *
 * The page answers one question: can this project be given to this entity? So readings are ordered
 * in three layers that answer it in sequence:
 *
 * 1) Blocker · something that stops contracting outright (inactive/rejected status, incomplete
 * file).
 * 2) Behavior · what's happened on its projects with us (stalling, being over its limit).
 * 3) Track record and capacity · completion rate, excusals, current load, and what's committed to
 * it but not yet disbursed.
 *
 * Every figure is calculated from the same fields shown elsewhere on the entity flow and the
 * "entity performance" card, so they can never contradict each other — the reading explains the
 * number in front of the user, it doesn't fetch a different one from somewhere else.
 */
export function readEntity(
  entity: EntityRow,
  projects: ProjectRow[],
  detail?: EntityDetail,
): Reading[] {
  const out: Reading[] = []
  const missing = ENTITY_DOCS_TOTAL - entity.docsUploaded

  /* 1 · contracting blockers */

  /* Activation status comes before anything else: "suspended" or "rejected" means an agreement
     isn't even expected, so it shouldn't be read after lighter notes. */
  if (entity.activation !== 'نشط') {
    const stopped = entity.activation.startsWith('معلق') || entity.activation === 'مرفوض'
    out.push({
      id: 'activation',
      kind: stopped ? 'flag' : 'note',
      label: 'التفعيل',
      metric: { value: entity.activation, unit: 'حالة التفعيل' },
      text: stopped
        ? 'التعاقد موقوف حتى يُقبل التفعيل، وأي اعتماد الآن سيتوقف عند توقيع الاتفاقية.'
        : 'حُدّثت بياناتها ولم تُراجع بعد، فالمقارنة بالجهات الأخرى مبنية على ملف قديم.',
      bold: [entity.activation],
      danger: stopped ? [entity.activation] : undefined,
      src: 'حقل التفعيل في ملف الجهة',
    })
  }

  /* An expired license is a stronger blocker than an incomplete file: a file gets completed, while
     a license has to be renewed by a separate authority entirely. And it passes at a glance because
     the document is **uploaded** — the counter reads 8/8 while validity has expired. */
  if (detail?.licenseExpired) {
    out.push({
      id: 'license',
      kind: 'flag',
      label: 'الترخيص منتهٍ',
      metric: { value: detail.licenseEndsAt, unit: 'انتهى الترخيص في', date: true },
      text:
        'لا تُوقَّع الاتفاقية بترخيص منتهٍ، ويظهر الملف مكتملًا في العدّاد لأن المستند مرفوع فعلًا. ' +
        'ويُجدَّد الترخيص لدى الجهة المرخِّصة لا لدى المؤسسة.',
      danger: [detail.licenseEndsAt],
      src: 'ملف الجهة · تاريخ نهاية الترخيص',
      actions: [{ label: 'جهّز مسودة تذكير', kind: 'btn-2', done: 'جُهّزت مسودة التذكير في المراسلات · راجعها وأرسلها بنفسك' }],
    })
  }

  const expiredDocs = detail?.docs.filter((d) => d.expired).length ?? 0
  if (expiredDocs > 0) {
    const n = units.doc(expiredDocs, true)
    out.push({
      id: 'docs-expired',
      kind: 'flag',
      label: 'مستندات منتهية',
      metric: { value: String(expiredDocs), unit: 'مرفوع وانتهت صلاحيته' },
      text: `${n} مرفوع في الملف لكن صلاحيته انتهت، فيُحتسب مكتملًا وهو غير صالح.`,
      bold: [n],
      danger: [n],
      src: 'ملف المستندات · تواريخ الصلاحية',
    })
  }

  const deadBank = detail?.banks.every((b) => b.status !== 'مفعل')
  if (detail && detail.banks.length > 0 && deadBank) {
    out.push({
      id: 'bank',
      kind: 'flag',
      label: 'لا حساب مفعّل',
      text:
        'لا يوجد حساب بنكي مفعّل للجهة، فالصرف موقوف حتى لو اعتُمد المشروع. ' +
        `آخر سبب مسجَّل: «${detail.banks[0].reason ?? 'بانتظار التفعيل'}».`,
      bold: ['الصرف موقوف'],
      src: 'الحسابات البنكية',
    })
  }

  if (missing > 0) {
    out.push({
      id: 'docs',
      kind: 'flag',
      label: 'ملف ناقص',
      metric: { value: String(missing), unit: `مستندات ناقصة من ${ENTITY_DOCS_TOTAL}` },
      text: 'سيتوقف أي مشروع لها عند اعتماد الاتفاقية حتى يكتمل الملف.',
      src: 'ملف الجهة المطلوب',
      bar: {
        value: entity.docsUploaded,
        limit: ENTITY_DOCS_TOTAL,
        valueLabel: 'المرفوع',
        limitLabel: 'المطلوب',
      },
      actions: [{ label: 'جهّز مسودة تذكير', kind: 'btn-2', done: 'جُهّزت مسودة التذكير في المراسلات · راجعها وأرسلها بنفسك' }, { label: 'أضف ملاحظتك', kind: 'btn-2', note: 'الملاحظة', done: 'أُضيفت ملاحظتك إلى ملف الجهة' }],
    })
  }

  /* 2 · its behavior on projects with us */

  if (entity.projectsStalled > 0) {
    const n = units.project(entity.projectsStalled, true)
    out.push({
      id: 'stalled',
      kind: 'flag',
      label: 'تعثّر سابق',
      metric: { value: String(entity.projectsStalled), unit: 'متعثّر في سجلها' },
      text:
        `${n} توقف بعد الاعتماد ولم يكتمل. يُقرأ التعثّر السابق مع الطلب الجديد ` +
        `لأنه يدل على قدرتها على التنفيذ، لا على ملفها الورقي.`,
      bold: [n],
      danger: [n],
      src: 'أداء الجهة · السجل التراكمي',
    })
  }

  const late = projects.filter((p) => stagePressure(p) > 1)
  if (late.length) {
    const worst = late.reduce((a, b) => (a.hoursInStage > b.hoursInStage ? a : b))
    const d = units.day(days(worst.hoursInStage), true)
    out.push({
      id: 'late',
      kind: 'flag',
      label: 'مشروع متوقف',
      metric: { value: String(late.length), unit: 'من مشاريعها فوق الحدّ' },
      text:
        `${late.length === 1 ? 'وهو' : 'أطولها'} «${worst.name}»، متوقف منذ ${d} ` +
        `في «${worst.stage}».`,
      bold: [d],
      danger: [d],
      src: 'سجل الإجراءات',
      to: ROUTES.project(worst.id),
      toLabel: 'اعرضها',
    })
  }

  /* 3 · its track record and capacity */

  /* Completion rate is the closest number to the question "does it finish what it starts?". The
     denominator is approved requests, not completed + in progress, so stalled and excused ones stay
     inside the calculation — excluding them would produce a nicer number than reality. */
  if (entity.projectsApproved > 0) {
    const rate = Math.round((entity.projectsCompleted / entity.projectsApproved) * 100)
    const done = units.project(entity.projectsCompleted, true)
    out.push({
      id: 'record',
      kind: 'note',
      label: 'سجل الإكمال',
      metric: { value: pctText(rate), unit: 'من معتمداتها اكتملت' },
      text:
        `أكملت ${done} من ${entity.projectsApproved}` +
        `${entity.projectsRunning > 0 ? `، و${units.project(entity.projectsRunning, true)} لا تزال تحت التنفيذ` : ''}.`,
      bold: [done],
      src: 'أداء الجهة · السجل التراكمي',
      bar: {
        value: entity.projectsCompleted,
        limit: entity.projectsApproved,
        valueLabel: 'المكتمل',
        limitLabel: 'المعتمد',
      },
    })
  }

  /* Excusals read as a rate, not a count: an entity excused on one out of eight requests differs
     from one excused on one out of two. */
  /* Under three requests the rate becomes misleading: an entity excused on its only request shows
     100%, when in reality it just has no track record yet. */
  const asked = entity.projectsApproved + entity.projectsDeclined
  if (entity.projectsDeclined > 0 && asked >= 3) {
    const n = units.project(entity.projectsDeclined, true)
    out.push({
      id: 'declines',
      kind: 'note',
      label: 'اعتذارات',
      metric: { value: pctText(Math.round((entity.projectsDeclined / asked) * 100)), unit: 'من طلباتها اعتُذر عنها' },
      text:
        `اعتُذر عن ${n} من ${units.project(asked, true)} تقدّمت بها. ` +
        `يستحق سبب الاعتذار السابق القراءة قبل الطلب الجديد، فإن تكرّر السبب تكرّر القرار.`,
      bold: [n],
      src: 'أداء الجهة · السجل التراكمي',
    })
  }

  /* Load isn't a judgment, it's timing information: an entity working three projects at once isn't
     the same as an idle one, and the difference shows up in execution, not in the file. */
  if (entity.projectsRunning >= 2) {
    const n = units.project(entity.projectsRunning, true)
    out.push({
      id: 'load',
      kind: 'note',
      label: 'الحمل الحالي',
      metric: { value: String(entity.projectsRunning), unit: 'تحت التنفيذ الآن' },
      text: `لديها ${n} تحت التنفيذ في الوقت نفسه، والطلب الجديد يُضاف إلى هذا الحمل لا إلى ملف فارغ.`,
      bold: [n],
      src: 'أداء الجهة · السجل التراكمي',
    })
  }

  /* "Pending disbursement" = committed but not yet delivered. This number says some payments are
     stuck on reports or documents, and it's the closest indicator of an entity's reporting
     discipline without opening every project. */
  if (entity.inDisbursement > 0 && entity.grantedTotal > 0) {
    const share = Math.round((entity.inDisbursement / entity.grantedTotal) * 100)
    const amount = nf.format(entity.inDisbursement)
    out.push({
      id: 'pending-money',
      kind: 'note',
      label: 'تحت الصرف',
      metric: { value: amount, unit: 'ملتزم لها ولم يصل' },
      text:
        `${pctText(share)} من إجمالي ما مُنح لها لم يصل بعد. ` +
        `الدفعة المتوقفة ترتبط عادةً بتقرير أو مستند ناقص، فهي مؤشر على انضباط التقارير.`,
      bold: [amount],
      src: 'ملف الصرف · إجمالي الممنوح',
      bar: {
        value: entity.grantedTotal - entity.inDisbursement,
        limit: entity.grantedTotal,
        valueLabel: 'وصل فعلًا',
        limitLabel: 'إجمالي الممنوح',
      },
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

  if (entity.governance === 'لم تُقيَّم') {
    out.push({
      id: 'gov',
      kind: 'note',
      label: 'الحوكمة',
      text:
        `درجة الحوكمة غير مقيَّمة بعد، فالمقارنة بين هذه الجهة وغيرها ` +
        `في الهدف نفسه غير مكتملة عند اتخاذ القرار.`,
      bold: ['غير مقيَّمة'],
      src: 'حقل الحوكمة في ملف الجهة',
    })
  }

  /* Recent registration isn't a flaw, but it explains a short track record: a one-year-old entity
     shouldn't be judged the same way as a ten-year-old one. */
  const tenure = yearsSince(entity.registeredAt)
  if (tenure !== null && tenure < 3) {
    const y = tenure === 0 ? 'أقل من سنة' : units.year(tenure, true)
    out.push({
      id: 'tenure',
      kind: 'note',
      label: 'جهة حديثة',
      metric: { value: tenure === 0 ? 'أقل من سنة' : String(tenure), unit: 'منذ التسجيل' },
      text: `مسجّلة منذ ${y} فقط، فالسجل التراكمي أعلاه قصير بطبيعته، وقلّته لا تعني ضعف الأداء.`,
      bold: [y],
      src: `تاريخ التسجيل · ${entity.registeredAt}`,
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

/* Home · a cross-cutting system reading */

export interface HomeReadingInput {
  projects: ProjectRow[]
  entities: EntityRow[]
  /** Role determines **which** readings get computed at all, not just their order */
  lens: 'own' | 'team' | 'portfolio'
  /** Username · for the personal lens */
  owner: string
  /** Approval threshold, null = recommendation only */
  ceiling: number | null
  budget: { allocated: number; reserved: number; committed: number; spent: number }
}

/**
 * Cross-module readings.
 *
 * The projects page reads projects, and the entities page reads entities — but the most important
 * observations sit **between** the two: an approved project for an entity with an incomplete file,
 * or a line item that's half-spent with two months left. This screen is the only place that sees
 * the whole system at once, so its readings are cross-cutting by nature.
 *
 * And readings aren't the same for every role: an officer sees their own queue, a manager sees
 * their team's load and what awaits their approval, and an executive sees the portfolio. Same data,
 * three different questions.
 */
export function readHome(input: HomeReadingInput): Reading[] {
  const { lens } = input
  if (lens === 'team') return readForManager(input)
  if (lens === 'portfolio') return readForExecutive(input)
  return readForSupervisor(input)
}

/* Grants officer: "what's on me today?" */
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
        `قيمتها ${nf.format(money)} ⃁` +
        (mineLate.length
          ? `، منها ${units.project(mineLate.length, true)} فوق حدّ القسم.`
          : `، ولم يتجاوز أيٌّ منها حدّ قسمه.`),
      bold: [`${nf.format(money)} ⃁`,
        ...(mineLate.length ? [units.project(mineLate.length, true)] : [])],
      danger: mineLate.length ? [units.project(mineLate.length, true)] : [],
      src: 'المشاريع المسندة إليك',
      to: `${ROUTES.projects}?owner=${encodeURIComponent(owner)}&status=في الدراسة${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  out.push(...blockedReading(projects, entities))

  /* Closure sits in the officer's queue for two different reasons — one isn't theirs to act on (the
     entity is writing the report), and one is entirely theirs (evaluation, which they complete
     after executive approval). The first resolves with a message, the second with work — so what
     they say is what's actually theirs to do. */
  const mineClose = closeRows.filter((c) => c.owner === owner)
  const evalDue = mineClose.filter((c) => c.stage === 'reportDone' || c.stage === 'evalDraft')
  if (evalDue.length) {
    out.push({
      id: 'cl-mine',
      kind: 'flag',
      label: 'تقييم مطلوب منك',
      metric: { value: String(evalDue.length), unit: 'مشروع بانتظار تقييمك' },
      text:
        `اعتمد المدير التنفيذي التقرير الختامي، فتحقّقت القاعدة 6 · ` +
        `وإعداد تقييم المشروع مسؤولية مشرف المنح لا الجهة، ودورة اعتماده منفصلة.`,
      bold: ['القاعدة 6'],
      src: 'قواعد الإغلاق 6 و17',
      to: ROUTES.closings,
      toLabel: 'اعرضها',
    })
  }

  // The longest item has sat in their queue · a personal figure, not a system average
  const mineSorted = [...mine].sort((a, b) => stagePressure(b) - stagePressure(a))
  const worst = mineSorted[0]
  if (worst && worst.stageLimit > 0) {
    out.push({
      id: 'oldest',
      kind: stagePressure(worst) > 1 ? 'flag' : 'note',
      label: 'أقدم ما عندك',
      metric: { value: String(days(worst.hoursInStage)), unit: 'يومًا دون تقدّم' },
      text:
        `«${worst.name}» في «${worst.stage}». كل يوم إضافي هنا يوم ` +
        `تنتظر فيه الجهة ردًّا.`,
      bold: [`«${worst.name}»`],
      src: 'مدة المكوث في القسم',
      to: ROUTES.project(worst.id),
      toLabel: 'اعرضها',
    })
  }

  return out
}

/* Grants manager: "how's my team doing, and what's waiting on me?" */
function readForManager({ projects, entities, ceiling, budget }: HomeReadingInput): Reading[] {
  const out: Reading[] = []

  // Pending their approval · anything over the officer's threshold
  const waiting = projects.filter(
    (p) => p.statusGroup === 'في الدراسة' && (ceiling === null || p.amountRequested > ceiling),
  )
  if (waiting.length) {
    const money = waiting.reduce((s, p) => s + p.amountRequested, 0)
    out.push({
      id: 'approvals',
      kind: 'flag',
      label: 'ينتظر اعتمادك',
      metric: { value: String(waiting.length), unit: 'فوق حد صلاحية المشرف' },
      text:
        `قيمتها ${nf.format(money)} ⃁. يوصي المشرف، أما اعتماد ` +
        `هذا المبلغ فقرارك أنت.`,
      bold: [`${nf.format(money)} ⃁`],
      src: 'حدود الاعتماد · قيم مؤقتة لحين اعتمادها',
      to: `${ROUTES.projects}?status=في الدراسة&sort=amount${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  // Load distribution · this imbalance is what actually creates delay
  const load = new Map<string, ProjectRow[]>()
  for (const p of projects) {
    if (p.statusGroup !== 'في الدراسة') continue
    const k = p.owner ?? 'بلا مالك'
    load.set(k, [...(load.get(k) ?? []), p])
  }
  const owned = [...load.entries()].filter(([k]) => k !== 'بلا مالك')
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
        `يظهر هذا الفرق في مدد الانتظار قبل أن يظهر في أي تقرير.`,
      bold: [units.project(lightest[1].length, true), lightest[0]],
      src: 'المشاريع تحت الدراسة لكل مشرف',
      to: `${ROUTES.projects}?owner=${encodeURIComponent(heaviest[0])}&status=في الدراسة${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  // Unowned · assignment is theirs to decide
  const orphan = projects.filter((p) => p.owner === null)
  if (orphan.length) {
    const money = orphan.reduce((s, p) => s + (p.amountGranted || p.amountRequested), 0)
    out.push({
      id: 'orphan',
      kind: 'flag',
      label: 'بلا مالك',
      metric: { value: String(orphan.length), unit: 'بحاجة إلى إسناد' },
      text:
        `بقيمة ${nf.format(money)} ⃁. لا يتابع أيًّا منها موظف ` +
        `مسؤول، فتتأخر دون أن يلاحظ أحد.`,
      bold: [`${nf.format(money)} ⃁`],
      src: 'عمود المالك في جدول المشاريع',
      to: `${ROUTES.projects}?unowned=1${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  out.push(...blockedReading(projects, entities))
  out.push(bottleneckReading(projects) ?? budgetReading(budget))

  return out
}

/* Executive: "where is the portfolio heading?" */
function readForExecutive({ projects, entities, budget }: HomeReadingInput): Reading[] {
  const out: Reading[] = []

  out.push(budgetReading(budget))

  // Impact: completed vs. excused · this ratio is the year's real outcome
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
        `${nf.format(Math.round(done.reduce((s, p) => s + p.amountGranted, 0) / Math.max(1, beneficiaries)))} ⃁ للمستفيد.`,
      bold: [units.project(done.length, true)],
      src: 'المشاريع المكتملة وتقاريرها الختامية',
      to: `${ROUTES.projects}?status=مكتمل${LIST}`,
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
        `ارتفاع المعدل يعني إمّا أن الطلبات خارج النطاق، وإمّا أن ` +
        `الشروط غير واضحة للجهات قبل التقديم.`,
      bold: [units.project(declined.length, true)],
      src: 'مبررات الاعتذار المقنّنة',
      to: `${ROUTES.projects}?status=معتذر عنه${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  // Partners: concentration · how many entities hold most of the support
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
      label: 'تركّز الدعم',
      metric: { value: `${share}%`, unit: 'عند ثلاث جهات' },
      text:
        `من إجمالي الممنوح، وأعلاها «${ranked[0][0]}» بـ${nf.format(ranked[0][1])} ⃁. ` +
        `التركّز يرفع الأثر ويرفع المخاطرة في الوقت نفسه.`,
      bold: [`«${ranked[0][0]}»`, `${nf.format(ranked[0][1])} ⃁`],
      src: 'الممنوح لكل جهة',
      to: `${ROUTES.entities}?sort=granted${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  out.push(...blockedReading(projects, entities))

  return out
}

/* Readings shared across more than one role */

/** The intersection between projects and entity files · doesn't appear on any single screen */
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
      `بقيمة ${nf.format(money)} ⃁ تحت التنفيذ. اعتماد الاتفاقية ` +
      `يتوقف على مستندات الجهة، لا على المشروع.`,
    bold: [`${nf.format(money)} ⃁`],
    src: 'تقاطع جدول المشاريع مع ملفات الجهات',
    to: `${ROUTES.entities}?docs=1${LIST}`,
    toLabel: 'اعرضها',
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
      `محجوز أو ملتزم به، ${nf.format(budget.committed)} ⃁ التزامًا ` +
      `و${nf.format(budget.reserved)} حجزًا مقابل مخصص ${nf.format(budget.allocated)}.`,
    bold: [`${nf.format(budget.committed)} ⃁`, `${nf.format(budget.reserved)}`],
    bar: {
      value: used,
      limit: budget.allocated,
      valueLabel: 'محجوز وملتزم',
      limitLabel: 'المخصص',
    },
    src: 'المخصص من النظام العامل · الباقي محسوب من العيّنة التجريبية',
    to: ROUTES.budget,
    toLabel: 'اعرضها',
  }
}

/** Which department has the longest queue · the first place to improve turnaround time */
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
      `هنا يظهر أثر أي تحسين في الزمن أولًا.`,
    bold: [`«${stage}»`, units.project(rows.length, true)],
    src: 'مدة المكوث في القسم لكل مشروع',
    to: `${ROUTES.projects}?stage=${encodeURIComponent(stage)}&sort=waiting${LIST}`,
    toLabel: 'اعرضها',
  }
}

/**
 * Legacy-format readings, converted to the same `Reading` shape so they render with the same
 * renderer.
 *
 * `Insight` is an older shape from before readings were unified. This function converts it so the
 * system doesn't end up with two renderers for the same kind of content, until the analytics source
 * returns `Reading` directly.
 */
export function readInsights(items: Insight[], actions?: ReadingAction[]): Reading[] {
  return items.map((it, i) => ({
    id: `ins-${i}`,
    kind: 'note',
    text: it.text,
    bold: it.bold,
    /* The source comes from the data already prefixed with "Source:", and the renderer adds its own
       — so it's stripped here instead of being duplicated. */
    src: it.src.replace(/^المصدر:\s*/, ''),
    actions: i === 0 ? actions : undefined,
  }))
}

/* Reports */

/**
 * Reports page readings.
 *
 * The difference from dashboard cards: a card states the number, a reading states what to do about
 * it. The dashboard answers "where does the budget stand?", while a reading states that what's
 * committed but not yet disbursed is larger than what's gone out, and that this changes next
 * month's priority.
 *
 * All of these are calculated from the same data the cards display, so they can never contradict
 * them — same principle as the project and entity pages.
 */
export function readReports(yearId: string): Reading[] {
  const out: Reading[] = []
  const rows = projectRows.filter((p) => p.year === yearId)
  const bud = budgetForYear(yearId)

  /* 1 · committed vs. disbursed · the most important figure on the page */
  if (bud.allocated > 0) {
    const locked = bud.reserved + bud.committed
    const lockedPct = Math.round((locked / bud.allocated) * 100)
    const spentPct = Math.round((bud.spent / bud.allocated) * 100)
    out.push({
      id: 'r-locked',
      kind: locked > bud.spent * 2 ? 'flag' : 'note',
      label: 'المال المربوط',
      metric: { value: pctText(lockedPct), unit: 'مربوطة ولم تخرج' },
      text:
        `${pctText(lockedPct)} من المخصص محجوزة أو ملتزم بها، مقابل ${pctText(spentPct)} وصلت إلى الجهات فعلًا. ` +
        `المربوط غير متاح لمشروع جديد ولم يصل إلى المستفيد، فهو أثقل بند في الميزانية.`,
      bold: [pctText(lockedPct)],
      danger: locked > bud.spent * 2 ? [pctText(lockedPct)] : undefined,
      src: 'تقارير الميزانية · reports1_1',
      bar: {
        value: bud.spent,
        limit: bud.allocated,
        valueLabel: 'المصروف',
        limitLabel: 'المخصص',
      },
    })
  }

  /* 2 · the promise gap · a number the system has but doesn't display */
  if (closingRows.length) {
    const g = gapOf(closingRows)
    const missed = g.total - g.metTarget
    out.push({
      id: 'r-gap',
      kind: 'flag',
      label: 'الوعد مقابل التنفيذ',
      metric: { value: String(missed), unit: 'مشروعًا لم يصل لعدد مستفيديه' },
      text:
        `من ${units.project(g.total, true)} لها تقرير ختامي، ${missed} لم تصل إلى العدد المتعاقد عليه، ` +
        `والمدة الفعلية أطول بـ${pctText(Math.abs(g.days))} في المتوسط. هذه الأرقام موجودة في «التقارير الختامية» ` +
        `منذ سنوات ولا يحسبها أحد.`,
      bold: [String(missed)],
      danger: [String(missed)],
      src: 'التقارير الختامية · reports1_12',
      to: ROUTES.reportView('actual'),
      toLabel: 'اعرضها',
    })
  }

  /* 3 · "lessons learned" · a required field usually filled with a single bullet point */
  const empty = knowledgeRows.filter((k) => k.empty).length
  if (knowledgeRows.length) {
    const emptyPct = Math.round((empty / knowledgeRows.length) * 100)
    out.push({
      id: 'r-know',
      kind: 'flag',
      label: 'المعرفة',
      metric: { value: pctText(emptyPct), unit: 'من قيود المعرفة فارغة' },
      text:
        `${countOf(empty, NOUN.entry)} من ${knowledgeRows.length} نصّها نقطة واحدة. الحقل إلزامي، فيُملأ لتجاوزه ` +
        `لا ليُقرأ. والعلاج ليس حقلًا آخر، بل أن يرى كاتبه أثر ما يكتب.`,
      bold: [String(empty)],
      danger: [pctText(emptyPct)],
      src: 'تقرير المعرفة · reports1_13',
      to: ROUTES.reportView('knowledge'),
      toLabel: 'اعرضها',
    })
  }

  /* 4 · grant concentration · a standardized excusal reason in the system */
  const byGoal = topCount(rows.filter((p) => p.amountGranted > 0), (p) => p.goal)
  if (byGoal && byGoal[1] > 1) {
    out.push({
      id: 'r-conc',
      kind: 'note',
      label: 'تركّز',
      metric: { value: String(byGoal[1]), unit: 'مشاريع في هدف واحد' },
      text:
        `«${byGoal[0]}» نال ${units.project(byGoal[1], true)} في هذه الفترة. التركّز ليس خطأً بالضرورة، ` +
        `لكن «مشروع مكرر لنفس الجهة» أحد مبررات الاعتذار المقنّنة، فيستحق نظرة.`,
      bold: [byGoal[0]],
      src: 'مخصص الصرف · reports1_5',
      to: ROUTES.reportView('spend'),
      toLabel: 'اعرضها',
    })
  }

  /* 5 · delayed · the same figure as the work queue, but here as a cause rather than a counter */
  const late = rows.filter((p) => stagePressure(p) > 1)
  if (late.length) {
    const worst = late.reduce((a, b) => (a.hoursInStage > b.hoursInStage ? a : b))
    out.push({
      id: 'r-late',
      kind: 'flag',
      label: 'فوق الحدّ',
      metric: { value: String(late.length), unit: 'مشروعًا فوق حدّ قسمه' },
      text:
        `أطولها «${worst.name}»، متوقف منذ ${units.day(days(worst.hoursInStage), true)} في «${worst.stage}». ` +
        `المكوث يُقاس فعلًا في النظام، والحدّ المقارَن به مؤقت لحين اعتماده.`,
      bold: [worst.stage],
      danger: [String(late.length)],
      src: 'أداء الأقسام · reports1_15',
      to: ROUTES.reportView('stages'),
      toLabel: 'اعرضها',
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'r-clear',
      kind: 'note',
      label: 'لا ملاحظات',
      text: 'لا توجد ملاحظات على هذه الفترة.',
      src: 'محسوبة من تقارير الفترة',
    })
  }

  return out
}


/* Disbursement queue */

/**
 * Disbursement queue readings.
 *
 * The question this queue answers is one: what's stuck, and why? So the reading doesn't just count
 * requests (the tiers above already do that), it states the reason: who is stalling, which rule
 * blocks the most requests, and where the pressure is.
 *
 * Escalation used to be a standalone banner above the filters, and it moved into a reading here —
 * not for looks, but because a banner states a number while a reading states its cause along with a
 * path to resolve it, the same pattern every screen in this system follows.
 */
export function readPayments(rows: PayRequest[], isFiltered: boolean): Reading[] {
  const out: Reading[] = []
  const open = rows.filter((r) => r.state !== 'paid' && r.state !== 'closed')
  if (open.length === 0) return out

  const scope = isFiltered ? 'في النطاق الحالي' : 'في الصندوق'

  /* 1 · stalled · past double the stage's time limit */
  const stuck = open.filter((r) => payHeat(r) === 'stuck')
  if (stuck.length) {
    const worst = stuck.reduce((a, b) => (a.hoursInState > b.hoursInState ? a : b))
    const d = `${countOf(days(worst.hoursInState), NOUN.day)}`
    out.push({
      id: 'p-stuck',
      kind: 'flag',
      label: 'تعثّر',
      metric: { value: String(stuck.length), unit: `طلب متعثر ${scope}` },
      text:
        `أطولها «${worst.projectName}»، متوقف ${d} عند ${payStateWho(worst.state)}. ` +
        `تتطلب آلية التصعيد تقريرًا شاملًا بالمتأخر والمتعثر.`,
      bold: [`«${worst.projectName}»`, d],
      danger: [d],
      src: 'مدة المرحلة · آلية التصعيد 9.5',
      to: `${ROUTES.payments}?heat=stuck${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  /* 2 · conditionally held · which rule holds the most */
  const blocked = open.filter(payBlocked)
  if (blocked.length) {
    const tally = new Map<number, { label: string; n: number }>()
    for (const r of blocked) {
      for (const c of r.checks) {
        if (c.ok) continue
        const cur = tally.get(c.rule)
        tally.set(c.rule, { label: c.label, n: (cur?.n ?? 0) + 1 })
      }
    }
    let top: { rule: number; label: string; n: number } | null = null
    for (const [rule, x] of tally) if (!top || x.n > top.n) top = { rule, ...x }
    const sum = blocked.reduce((s, r) => s + r.asked, 0)
    out.push({
      id: 'p-hold',
      kind: 'flag',
      label: 'موقوف بشرط',
      metric: { value: String(blocked.length), unit: `طلب لا يمكن تمريره` },
      text: top
        ? `بقيمة ${millions(sum)} ⃁. أكثر الأسباب تكرارًا «${top.label}» في ` +
          `${countOf(top.n, NOUN.request)} · قاعدة ${top.rule} في الوثيقة.`
        : `بقيمة ${millions(sum)} ⃁، وسببها الحساب البنكي غير المعتمد.`,
      bold: [`${millions(sum)} ⃁`, ...(top ? [`«${top.label}»`] : [])],
      src: 'قواعد الصرف 3 · 6 · 10 · 11',
      to: `${ROUTES.payments}?hold=1${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  /* 3 · where the pressure is · the stage carrying the most requests */
  const byState = new Map<string, number>()
  for (const r of open) byState.set(r.state, (byState.get(r.state) ?? 0) + 1)
  let peak: [string, number] | null = null
  for (const e of byState) if (!peak || e[1] > peak[1]) peak = e
  if (peak) {
    const meta = PAY_STATES.find((s) => s.key === peak![0])
    const share = Math.round((peak[1] / open.length) * 100)
    out.push({
      id: 'p-load',
      kind: 'note',
      label: 'مكان الضغط',
      metric: { value: String(peak[1]), unit: `طلب عند ${meta?.who ?? 'المرحلة'}` },
      text:
        `أي أن ${pctText(share)} من الطلبات المفتوحة متوقفة في مرحلة واحدة ` +
        `(الخطوات ${meta?.steps} في الوثيقة).`,
      bold: [pctText(share)],
      src: 'توزيع الطلبات على المراحل',
      to: `${ROUTES.payments}?state=${peak[0]}${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  return out
}

/* Agreements */

/**
 * Agreements queue readings.
 *
 * The question here isn't "how many agreements are there", it's what's blocking activation. Because
 * the agreement is what unlocks all disbursement: no payment request is possible before an
 * agreement is activated, so every day of delay here pushes a payment back — which is exactly what
 * the second reading states, in numbers.
 */
export function readAgreements(rows: AgreementRow[], isFiltered: boolean): Reading[] {
  const out: Reading[] = []
  const open = rows.filter((a) => a.stage !== 'active' && a.stage !== 'cancelled')
  if (open.length === 0) return out

  const scope = isFiltered ? 'في النطاق الحالي' : 'تحت الإعداد'

  /* 1 · held up on approval · which check is stopping it */
  const blocked = open.filter(agrBlocked)
  if (blocked.length) {
    const unbalanced = blocked.filter((a) => !agrPaymentsBalance(a).balanced).length
    const gapped = blocked.filter((a) => agrReserveGap(a) !== 0).length
    const worst = unbalanced >= gapped
      ? { n: unbalanced, why: 'جدول الدفعات لا يساوي قيمة المنحة', rule: 'القاعدة 8' }
      : { n: gapped, why: 'فرق بين قيمة الاتفاقية والمخصص المحجوز', rule: 'الخطوة 11' }
    out.push({
      id: 'a-block',
      kind: 'flag',
      label: 'موقوفة عن الاعتماد',
      metric: { value: String(blocked.length), unit: `اتفاقية ${scope}` },
      text:
        `أكثر الأسباب «${worst.why}» في ${worst.n} منها · و${worst.rule} تمنع ` +
        `الإرسال للاعتماد قبل استيفائه.`,
      bold: [`«${worst.why}»`, worst.rule],
      src: 'قواعد الاتفاقيات 8 و9 · الخطوة 11',
      to: `${ROUTES.agreements}?hold=1${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  /* 2 · impact on disbursement · this is what actually matters */
  const waiting = open.filter((a) => a.stage !== 'draft')
  if (waiting.length) {
    const sum = waiting.reduce((s, a) => s + a.amount, 0)
    const pays = waiting.reduce((s, a) => s + a.payments.length, 0)
    out.push({
      id: 'a-block-pay',
      kind: 'note',
      label: 'الأثر على الصرف',
      metric: { value: nf.format(sum), unit: '⃁ موقوفة في دورة الاعتماد' },
      text:
        `على ${countOf(pays, NOUN.payment)} مجدولة · ` +
        `القاعدة 1 في إجراء الصرف تمنع أي طلب قبل تفعيل الاتفاقية، ` +
        `فكل يوم توقف هنا يؤخّر دفعة هناك.`,
      bold: [`${countOf(pays, NOUN.payment)}`],
      src: /* doc BPD-009 */ ' قاعدة 1 · جداول الدفعات في الاتفاقيات',
    })
  }

  /* 3 · returns · every return restarts the full approval cycle */
  const again = rows.filter((a) => a.version > 1)
  if (again.length) {
    out.push({
      id: 'a-again',
      kind: again.length > rows.length / 4 ? 'flag' : 'note',
      label: 'دورات متكرّرة',
      metric: { value: pctText(Math.round((again.length / rows.length) * 100)), unit: 'لها إصدار ثانٍ' },
      text:
        `تنص القاعدة 12 على أن الإعادة للتعديل تعيد دورة الاعتماد كاملة ` +
        `مع الاحتفاظ بالاعتمادات السابقة · وهذا هو المؤشر 4 في الوثيقة.`,
      src: 'إصدارات الاتفاقيات · قاعدة 24',
    })
  }

  return out
}

/* Registration requests.

   The first reading here isn't about the requests, it's about their cause. Most requests in the
   live system sit in "pending completion" rather than "rejected" — meaning the hold-up is missing
   documents, not ineligibility. That distinction is what determines the action: a missing document
   resolves with a message; ineligibility doesn't. */
export function readRegRequests(rows: RegRequest[], isFiltered: boolean): Reading[] {
  const out: Reading[] = []
  if (rows.length === 0) return out
  const scope = isFiltered ? 'في النطاق المعروض' : 'في الصندوق'

  /* 1 · gaps · requirements themselves vary by classification */
  const short = rows.filter((r) => r.state !== 'rejected' && regMissingDocs(r).length > 0)
  if (short.length) {
    const docs = short.reduce((s, r) => s + regMissingDocs(r).length, 0)
    out.push({
      id: 'rg-docs',
      kind: 'flag',
      label: 'ملفات ناقصة',
      metric: { value: String(short.length), unit: `طلب ملفه ناقص ${scope}` },
      text:
        `وإجمالي النواقص ${countOf(docs, NOUN.requiredDoc)}. القاعدة 4 تمنع الإرسال ` +
        `قبل اكتمالها، والمطلوب نفسه يتغيّر بتصنيف الجهة · ثلاثة مستندات ` +
        `إلزامية للجهات التجارية وحدها.`,
      bold: [countOf(docs, NOUN.requiredDoc)],
      src: 'مستندات النظام العامل · نموذج /reg/add',
    })
  }

  /* 2 · governance self-declared as zero · the form itself prompts "enter 0" */
  const zero = rows.filter((r) => r.governanceClaim === 0)
  if (zero.length) {
    out.push({
      id: 'rg-gov',
      kind: 'note',
      label: 'حوكمة غير مقيَّمة',
      metric: {
        value: pctText(Math.round((zero.length / rows.length) * 100)),
        unit: 'أقرّت بصفر',
      },
      text:
        `يطلب النظام من الجهة «في حال عدم إجراء تقييم الحوكمة ضع 0»، ` +
        `فالصفر هنا يعني «لم تُقيَّم» لا «ضعيفة» · والرقم إقرار من ` +
        `الجهة لا تقييم من المؤسسة.`,
      danger: ['إقرار من الجهة'],
      src: 'حقل درجة الحوكمة في نموذج التسجيل',
    })
  }

  /* 3 · held up on gaps, not rejection · this is the most important split in the queue */
  const back = rows.filter((r) => r.state === 'completion').length
  const no = rows.filter((r) => r.state === 'rejected').length
  if (back > no) {
    out.push({
      id: 'rg-back',
      kind: 'note',
      label: 'التوقف بسبب النواقص',
      metric: { value: String(back), unit: 'بانتظار الاستكمال' },
      text:
        `مقابل ${no} مرفوضًا. أي أن ما يوقف الطلبات نواقص ملف ` +
        `تُحل برسالة، لا عدم أهلية · والقاعدة 31 تُلزم بكتابة السبب ` +
        `في الحالتين.`,
      bold: [`${no} مرفوضًا`],
      src: 'حالات الطلب · قاعدة 26',
      to: `${ROUTES.entityRequests}?state=completion${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  return out
}

/* Plan readings.

   The first reading is the officer's own queue, not overall plan status. The question opening this
   queue isn't "how are plans doing", it's "what's on me". An activity the entity has uploaded
   evidence for and marked done stays uncounted until the officer accepts it — so this queue is
   holding back a real completion percentage, not just administrative overhead. */
export function readPlans(rows: PlanRow[], isFiltered: boolean): Reading[] {
  const out: Reading[] = []
  if (rows.length === 0) return out
  const scope = isFiltered ? 'في النطاق الحالي' : 'في الصندوق'

  /* 1 · the queue · activities the entity marked done, awaiting acceptance */
  const queue = rows.flatMap((p) => waitingReview(p).map((a) => ({ p, a })))
  if (queue.length) {
    const plans = new Set(queue.map((x) => x.p.id)).size
    const worst = rows
      .filter((p) => waitingReview(p).length > 0)
      .sort((a, b) => planClaimed(b) - planDone(b) - (planClaimed(a) - planDone(a)))[0]
    const gap = worst ? planClaimed(worst) - planDone(worst) : 0
    out.push({
      id: 'p-queue',
      kind: 'flag',
      label: 'بانتظار مراجعتك',
      metric: { value: String(queue.length), unit: `نشاطًا ${scope}` },
      text:
        `في ${countOf(plans, NOUN.plan)} · وأكبر فرق في «${worst?.projectName ?? ''}»: ` +
        `أعلنت الجهة ${pctText(planClaimed(worst))} والمقبول ${pctText(planDone(worst))}، ` +
        `أي ${gap} نقطة غير محسوبة حتى تُراجع.`,
      bold: [`${gap} نقطة`],
      src: 'قاعدة 14 · لا يُحتسب النشاط إنجازًا إلا بعد قبول المشرف',
      to: `${ROUTES.plans}?wait=1${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  /* 2 · behind schedule · this is what actually changes a decision */
  const behind = rows.filter((p) => {
    const v = planSpi(p)
    return v !== null && v < 0.8
  })
  if (behind.length) {
    const worst = behind.sort((a, b) => (planSpi(a) ?? 1) - (planSpi(b) ?? 1))[0]
    const acts = rows.reduce((s, p) => s + lateActivities(p).length, 0)
    out.push({
      id: 'p-late',
      kind: 'flag',
      label: 'متأخّر عن الخطة',
      metric: { value: String(behind.length), unit: `خطة ${scope}` },
      text:
        `و${countOf(acts, NOUN.activity)} تجاوز موعده ولم يُقبل · أبعدها «${worst.projectName}» ` +
        `بأداء جدول ${(planSpi(worst) ?? 0).toFixed(2)} (المنجَز ${pctText(planDone(worst))} ` +
        `والمخطَّط لليوم ${pctText(planPlanned(worst))}).`,
      danger: [`${(planSpi(worst) ?? 0).toFixed(2)}`],
      /* Compared against the baseline, not current dates · any extension has to go through
         approval, so deviation has a fixed reference point */
      src: `النسخة المرجعية V${worst.baseline} · قاعدة 21`,
      to: `${ROUTES.plans}?late=1${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  /* 3 · eligible for closure · a blocker was lifted and no one noticed */
  const close = rows.filter((p) => readyToClose(p) && p.stage !== 'done')
  if (close.length) {
    out.push({
      id: 'p-close',
      kind: 'note',
      label: 'مؤهَّل للإغلاق',
      metric: { value: String(close.length), unit: 'مشروعًا' },
      text:
        'قُبلت كل أنشطة خطته · ورفعت الخطة مانع الإغلاق، والإغلاق نفسه ' +
        'إجراء آخر له قواعده (التقرير الختامي · الاتصال المؤسسي · التقييم).',
      src: /* doc BPD-012 */ 'الخطة مكتملة ⇒ المشروع مؤهَّل للإغلاق',
    })
  }

  return out
}

/* Closure readings.

   The first reading is about what's held up on the entity, not the request count. Rules require the
   entity to complete the final report before submission, and the usual hold-up in this module
   happens there: an open request that the entity simply hasn't submitted. That's a reading that
   resolves with a message, not a decision.

   The second states something no other screen shows: deviation. Rules require both actual
   beneficiaries and actual budget — so the moment a report arrives, the difference between approved
   and actual becomes computable. This is a gap the organization has across hundreds of reports with
   no screen stating it. */
export function readClosings(rows: CloseRow[], isFiltered: boolean): Reading[] {
  const out: Reading[] = []
  if (rows.length === 0) return out
  const scope = isFiltered ? 'في النطاق الحالي' : 'في الصندوق'

  /* 1 · held up on the entity */
  const atEntity = rows.filter((c) => c.stage === 'draft' || c.stage === 'returned')
  if (atEntity.length) {
    const docs = atEntity.reduce((s, c) => s + reportBlockers(c).length, 0)
    const worst = [...atEntity].sort((a, b) => b.hoursInStage - a.hoursInStage)[0]
    out.push({
      id: 'cl-entity',
      kind: 'flag',
      label: 'بانتظار الجهة',
      metric: { value: String(atEntity.length), unit: `طلب ${scope}` },
      text:
        `${countOf(docs, MISSING_ITEM)} في المجموع · وأطولها «${worst.projectName}»، ` +
        `متوقف منذ ${countOf(Math.round(worst.hoursInStage / 24), NOUN.day)} · القاعدة 3 تمنع ` +
        `الإرسال قبل اكتمال البيانات والمرفقات.`,
      bold: [countOf(docs, MISSING_ITEM), 'القاعدة 3'],
      src: 'قواعد الإغلاق 3 و4 و10',
      to: `${ROUTES.closings}?stage=draft,returned${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  /* 2 · deviation · approved vs. actual */
  const withReport = rows.filter(
    (c) => c.report.beneficiaries !== null && c.report.budget !== null,
  )
  if (withReport.length) {
    const gaps = withReport.map((c) => {
      const pr = projectRows.find((p) => p.id === c.projectId)
      const planned = pr?.beneficiaries ?? 0
      const actual = c.report.beneficiaries ?? 0
      return { c, planned, actual, diff: planned > 0 ? Math.round(((actual - planned) / planned) * 100) : 0 }
    })
    const under = gaps.filter((g) => g.diff < -10)
    const worst = [...gaps].sort((a, b) => a.diff - b.diff)[0]
    out.push({
      id: 'cl-gap',
      kind: under.length > 0 ? 'flag' : 'note',
      label: 'المعتمد مقابل الفعلي',
      metric: { value: String(under.length), unit: 'تقرير تحت المستهدف بأكثر من 10%' },
      text:
        `من ${countOf(withReport.length, NOUN.report)} وصل · وأكبر فرق في «${worst.c.projectName}»: ` +
        `${nf.format(worst.actual)} مستفيدًا مقابل ${nf.format(worst.planned)} معتمدًا · ` +
        `والقاعدة 4 هي التي تجعل هذه المقارنة ممكنة.`,
      bold: [`${nf.format(worst.actual)} مستفيدًا`, 'القاعدة 4'],
      src: 'قاعدة 4 في إجراء الإغلاق · بيانات المشروع المعتمدة',
    })
  }

  /* 3 · the evaluation still waiting its turn */
  const ready = rows.filter((c) => c.stage === 'reportDone')
  if (ready.length) {
    out.push({
      id: 'cl-eval',
      kind: 'note',
      label: 'تقييم مستحقّ',
      metric: { value: String(ready.length), unit: 'تقرير معتمد لم يبدأ تقييمه' },
      text:
        `القاعدة 6 تمنع بدء التقييم قبل اعتماد المدير التنفيذي · ` +
        `وقد اعتُمد، فالخطوة التالية الآن عند مشرف المنح.`,
      bold: ['القاعدة 6'],
      src: 'قاعدة 6 · دورتان مستقلّتان (قاعدة 17)',
      to: `${ROUTES.closings}?stage=reportDone${LIST}`,
      toLabel: 'اعرضها',
    })
  }

  return out
}
