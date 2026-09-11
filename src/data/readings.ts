/**
 * قراءات المساعد · محسوبة، مش مكتوبة.
 *
 * كل دالة هنا بتاخد نفس الداتا اللي الشاشة بتعرضها وترجّع قراءات.
 * يعني القراءة ما تقدرش تتعارض مع اللي قدام المستخدم، ولا تبقى
 * قديمة لما الداتا تتغيّر · وده الفرق بين مساعد وبين نص ثابت.
 *
 * لما الباك اند يجهز، الملف ده يا إما يفضل زي ما هو (بيحسب من
 * الصفوف اللي رجعت)، يا إما يتحوّل لنداء `GET /insights/:screen`
 * بنفس شكل `Reading[]` · والواجهة ما تتغيّرش.
 */
import type { Reading, ReadingAction } from '@/components/assistant/reading'
import type { EntityRow, Insight, ProjectRow } from '@/types/domain'
import type { EntityDetail } from './mock/entityDetail'
import { stagePressure, ENTITY_DOCS_TOTAL } from './repository'
import { projectRows } from './mock/projects'
import { budgetForYear } from './budget'
import { closingRows, gapOf, knowledgeRows } from './closing'
import type { Journey } from './journey'
import { nf, units, pct as pctText } from '@/lib/format'
import { ROUTES } from '@/app/routes'

const days = (hours: number) => Math.round(hours / 24)

/** سنين كاملة من تاريخ `YYYY-MM-DD` لحد النهارده · `null` لو التاريخ غلط */
function yearsSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 31_557_600_000)
}
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

/* ═══════════════════ رحلة مشروع واحد ═══════════════════ */

/**
 * سرد رحلة المشروع.
 *
 * طلب الكلاينت: «المشروع ده كان في هنا وبعد كده رجع لهنا، ودلوقتي
 * القرار الأخراني بتاعه كذا ومتوقف على كذا ومحتاج تاخد له أكشن كذا».
 *
 * الفرق بين ده وبين سجل الإجراءات إن السجل بيقول **كل** اللي حصل
 * بالترتيب، والسرد بيقول **اللي يفرق في القرار**: فين وصل، ورجع كام
 * مرة ولمين، وواقف عند مين وبقاله قد إيه مقابل حدّه، وإيه المطلوب
 * منك دلوقتي. المستخدم اللي بيفتح مشروع عمره ما بيقرا السجل من أوله.
 *
 * كل جملة مبنية من الصف نفسه، فبتتغيّر مع حالة المشروع فعلًا ·
 * المكتمل ما بيقولش «محتاج أكشن»، والمعتذر عنه ما بيقولش «واقف».
 */
export function readJourney(row: ProjectRow, j: Journey | undefined): Reading[] {
  const out: Reading[] = []
  const over = overPct(row)
  const late = row.stageLimit > 0 && stagePressure(row) > 1
  const inDays = days(row.hoursInStage)

  /* ١ · فين واقف دلوقتي وإيه المطلوب */
  if (row.statusGroup === 'مكتمل') {
    out.push({
      id: 'j-done',
      kind: 'note',
      label: 'الوضع الحالي',
      text: `المشروع مقفول. آخر محطة «${row.stage}»، و${
        row.hasFinalReport ? 'التقرير الختامي مرفوع ومعتمد' : 'التقرير الختامي غير مرفوع'
      }. مفيش أكشن مطلوب منك.`,
      bold: [row.stage],
      src: 'حالة المشروع · سجل الإجراءات',
    })
  } else if (row.statusGroup === 'معتذر عنه') {
    out.push({
      id: 'j-declined',
      kind: 'note',
      label: 'الوضع الحالي',
      text: `المشروع معتذر عنه${row.declineReason ? `، السبب المسجَّل «${row.declineReason}»` : ' بلا سبب مسجَّل'}. مفيش أكشن مطلوب منك.`,
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
        ? `واقف عند «${row.stage}» من ${units.day(inDays)}، أي ${pctText(over)} فوق حدّ القسم. المطلوب منك: ${nextAction(row)}.`
        : `عند «${row.stage}» من ${units.day(inDays)}، وده جوّه حدّ القسم. المطلوب منك: ${nextAction(row)}.`,
      bold: [row.stage, units.day(inDays), nextAction(row)],
      danger: late ? [pctText(over)] : [],
      bar: row.stageLimit > 0
        ? {
            /* بالأيام لا بالساعات: «2,088 ساعة» رقم ما حدّش بيقارن
               بيه، و«87 يومًا مقابل 38» بتتقري من نظرة. */
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

  /* الإجراءان اللي بيعالجوا التأخير: جوّه القراءة نفسها لا في كارت
     تاني. القراءة اللي بتقول «فوق الحدّ» ومالهاش مخرج بتبقى شكوى. */
  const now = out[0]
  if (now && now.kind === 'flag') {
    now.actions = [
      { label: 'تذكير الجهة', kind: 'btn-2' },
      { label: 'تسجيل سبب التأخر', kind: 'btn-2' },
    ]
  }

  /* ٢ · رجع لورا كام مرة · ده اللي السجل بيخفيه وسط الصفوف */
  const back = (j?.toEntity ?? 0) + (j?.toSupervisor ?? 0)
  if (back > 0) {
    const parts: string[] = []
    if (j?.toEntity) parts.push(`${j.toEntity === 1 ? 'مرة' : `${j.toEntity} مرات`} للجهة لاستكمال البيانات`)
    if (j?.toSupervisor) parts.push(`${j.toSupervisor === 1 ? 'مرة' : `${j.toSupervisor} مرات`} لمشرف المنح`)
    out.push({
      id: 'j-back',
      kind: back > 1 ? 'flag' : 'note',
      label: 'رجع لورا',
      text: `المشروع اترجّع ${parts.join(' و')}. كل إعادة بتضيف دورة مراجعة كاملة على المدة.`,
      bold: parts,
      src: 'سجل الإجراءات',
    })
  }

  /* ٣ · مين اللي بتّ فيه · بيوضّح إذا كان لسه محتاج تصعيد */
  if (j?.decidedBy) {
    out.push({
      id: 'j-level',
      kind: 'note',
      label: 'مستوى القرار',
      text: `القرار اتاخد عند «${j.decidedBy}»، المبلغ ${nf.format(row.amountGranted || row.amountRequested)} ريال وقع في نطاق صلاحيته.`,
      bold: [j.decidedBy, `${nf.format(row.amountGranted || row.amountRequested)} ريال`],
      src: 'سقوف الصلاحيات · مؤقتة لحين اعتمادها',
    })
  }

  return out
}

/** الأكشن المطلوب حسب القسم اللي المشروع واقف عنده */
function nextAction(row: ProjectRow): string {
  switch (row.stage) {
    case 'دراسة المشروع': return 'تسجيل التوصية'
    case 'استكمال بيانات المشروع': return 'متابعة الجهة على الناقص'
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

/* ═══════════════════ قائمة المشاريع ═══════════════════ */

export interface ProjectsReadingInput {
  /** كل المشاريع · أساس القراءات المطلقة */
  all: ProjectRow[]
  /** الصفوف بعد الفلتر الحالي */
  filtered: ProjectRow[]
  /** هل المستخدم مفلتر أصلًا */
  isFiltered: boolean
}

export function readProjects({ all, filtered, isFiltered }: ProjectsReadingInput): Reading[] {
  const out: Reading[] = []
  const scope = isFiltered ? filtered : all

  // 1) المتأخر · أول قراءة دايمًا، لأنه السبب الوحيد اللي بيخلي
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
        `في «${worst.stage}»، أي ${over}.`,
      bold: [d, over],
      danger: [over],
      src: 'حدّ القسم الإجرائي · قيم مؤقتة لحين اعتمادها',
      to: `${ROUTES.projects}?overdue=1&sort=waiting`,
      toLabel: 'اعرضها',
    })
  }

  // 2) بلا مالك · ربع النظام، وما حدش مسؤول عنها
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

  // 3) سبب الاعتذار الأكثر تكرارًا · ده اللي بيقول فين الخلل فعلًا
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
      to: `${ROUTES.projects}?status=معتذر عنه`,
      toLabel: 'اعرضها',
    })
  }

  // 4) قراءة الشريحة الحالية · تظهر فقط لما يكون في فلتر شغّال
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

/**
 * قراءات ملف الجهة.
 *
 * السؤال اللي الصفحة بتجاوب عليه واحد: **أقدر أدّي المشروع ده للجهة
 * دي؟** فالقراءات مرتّبة على تلات طبقات بتجاوب عليه بالترتيب:
 *
 *  1) **مانع** · حاجة بتوقف التعاقد أصلًا (تفعيل غير مقبول، ملف ناقص).
 *  2) **سلوك** · إيه اللي حصل في مشاريعها معانا (تعثّر، وقوف فوق الحدّ).
 *  3) **سجل وقدرة** · نسبة الإكمال، الاعتذارات، الحمل الحالي، وإيه
 *     الملتزم لها ولسه ما وصلش.
 *
 * الأرقام كلها محسوبة من نفس الحقول اللي `EntityTotals` وبطاقة «أداء
 * الجهة» بيعرضوها، فمستحيل يتعارضوا معاها · القراءة بتفسّر الرقم اللي
 * قدام المستخدم، ما بتجيبش رقمًا تانيًا من مكان تاني.
 */
export function readEntity(
  entity: EntityRow,
  projects: ProjectRow[],
  detail?: EntityDetail,
): Reading[] {
  const out: Reading[] = []
  const missing = ENTITY_DOCS_TOTAL - entity.docsUploaded

  /* ── ١ · موانع التعاقد ── */

  /* التفعيل قبل كل حاجة: «معلق» أو «مرفوض» معناها الاتفاقية ما تتوقّعش
     أصلًا، فما ينفعش يتقري بعد ملاحظات أخفّ منه. */
  if (entity.activation !== 'مقبول') {
    const stopped = entity.activation.startsWith('معلق') || entity.activation === 'مرفوض'
    out.push({
      id: 'activation',
      kind: stopped ? 'flag' : 'note',
      label: 'التفعيل',
      metric: { value: entity.activation, unit: 'حالة التفعيل' },
      text: stopped
        ? 'التعاقد موقوف لحد ما التفعيل يتقبل، أي اعتماد دلوقتي هيقف عند توقيع الاتفاقية.'
        : 'بياناتها اتحدّثت ولسه ما اتراجعتش، فالمقارنة بجهات تانية مبنية على ملف قديم.',
      bold: [entity.activation],
      danger: stopped ? [entity.activation] : undefined,
      src: 'حقل التفعيل في ملف الجهة',
    })
  }

  /* الترخيص المنتهي مانع أقوى من الملف الناقص: الملف بيتستكمل،
     والترخيص لازم يتجدّد من جهة تانية خالص. وهو بيعدّي بالنظرة لأن
     المستند **مرفوع** · العدّاد بيقول ٨/٨ والصلاحية خلصت. */
  if (detail?.licenseExpired) {
    out.push({
      id: 'license',
      kind: 'flag',
      label: 'الترخيص منتهٍ',
      metric: { value: detail.licenseEndsAt, unit: 'انتهى الترخيص في' },
      text:
        'الاتفاقية ما تتوقّعش بترخيص منتهٍ، والملف بيعدّي في العدّاد لأن المستند مرفوع فعلًا، ' +
        'التجديد من الجهة المرخِّصة لا منّا.',
      danger: [detail.licenseEndsAt],
      src: 'ملف الجهة · تاريخ نهاية الترخيص',
      actions: [{ label: 'تذكير الجهة', kind: 'btn-2' }],
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
      text: `${n} مرفوع في الملف بس صلاحيته خلصت، فبيتحسب مكتملًا وهو مش صالح.`,
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
        'مفيش حساب بنكي مفعّل للجهة، فالصرف موقوف حتى لو المشروع اتعتمد، ' +
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
      text: 'أي مشروع لها هيقف عند اعتماد الاتفاقية لحد ما الملف يكتمل.',
      src: 'ملف الجهة المطلوب',
      bar: {
        value: entity.docsUploaded,
        limit: ENTITY_DOCS_TOTAL,
        valueLabel: 'المرفوع',
        limitLabel: 'المطلوب',
      },
      actions: [{ label: 'تذكير الجهة', kind: 'btn-2' }, { label: 'تسجيل ملاحظة', kind: 'btn-2' }],
    })
  }

  /* ── ٢ · سلوكها في مشاريعها معانا ── */

  if (entity.projectsStalled > 0) {
    const n = units.project(entity.projectsStalled, true)
    out.push({
      id: 'stalled',
      kind: 'flag',
      label: 'تعثّر سابق',
      metric: { value: String(entity.projectsStalled), unit: 'متعثّر في سجلها' },
      text:
        `${n} وقف بعد الاعتماد ولم يكتمل. التعثّر السابق بيتقري مع الطلب الجديد ` +
        `لأنه بيقول عن قدرتها على التنفيذ، لا عن ملفها الورقي.`,
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

  /* ── ٣ · سجلها وقدرتها ── */

  /* نسبة الإكمال هي أقرب رقم لسؤال «هل بتخلّص اللي بتبدأه؟».
     المقام هو المعتمد لا المكتمل + الجاري، عشان المتعثّر والمعتذر
     يفضلوا داخل الحساب · إخراجهم بيطلّع نسبة أحلى من الحقيقة. */
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
        `${entity.projectsRunning > 0 ? `، و${units.project(entity.projectsRunning, true)} لسه تحت التشغيل` : ''}.`,
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

  /* الاعتذارات بتتقري كنسبة لا كعدد: جهة اتعذر عن طلب من ثمانية غير
     جهة اتعذر عن طلب من اتنين. */
  /* تحت تلات طلبات النسبة بتكذب: جهة اتعذر عن طلبها الوحيد نسبتها
     ١٠٠٪ وهي في الحقيقة جهة لسه ما لهاش سجل. */
  const asked = entity.projectsApproved + entity.projectsDeclined
  if (entity.projectsDeclined > 0 && asked >= 3) {
    const n = units.project(entity.projectsDeclined, true)
    out.push({
      id: 'declines',
      kind: 'note',
      label: 'اعتذارات',
      metric: { value: pctText(Math.round((entity.projectsDeclined / asked) * 100)), unit: 'من طلباتها اعتُذر عنها' },
      text:
        `اعتُذر عن ${n} من ${units.project(asked, true)} تقدّمت بيها. ` +
        `سبب الاعتذار السابق بيستحق القراءة قبل الطلب الجديد، لو نفس السبب اتكرّر، القرار متكرر.`,
      bold: [n],
      src: 'أداء الجهة · السجل التراكمي',
    })
  }

  /* الحمل مش تقييمًا، معلومة توقيت: جهة شغّالة على تلاتة في نفس
     الوقت مش زي جهة فاضية، والفرق بيظهر في التنفيذ لا في الملف. */
  if (entity.projectsRunning >= 2) {
    const n = units.project(entity.projectsRunning, true)
    out.push({
      id: 'load',
      kind: 'note',
      label: 'الحمل الحالي',
      metric: { value: String(entity.projectsRunning), unit: 'تحت التشغيل الآن' },
      text: `عندها ${n} تحت التشغيل في نفس الوقت، الطلب الجديد بيضاف على الحمل ده لا على ملف فاضي.`,
      bold: [n],
      src: 'أداء الجهة · السجل التراكمي',
    })
  }

  /* «تحت الصرف» = ملتزم لها وما وصلش. الرقم ده بيقول إن فيه دفعات
     واقفة على تقارير أو مستندات، وهو أقرب مؤشر على انضباطها في
     التقارير من غير ما نفتح كل مشروع. */
  if (entity.inDisbursement > 0 && entity.grantedTotal > 0) {
    const share = Math.round((entity.inDisbursement / entity.grantedTotal) * 100)
    const amount = nf.format(entity.inDisbursement)
    out.push({
      id: 'pending-money',
      kind: 'note',
      label: 'تحت الصرف',
      metric: { value: amount, unit: 'ملتزم لها ولم يصل' },
      text:
        `${pctText(share)} من إجمالي ما مُنح لها لسه في الطريق. ` +
        `الدفعة الواقفة بتبقى مربوطة بتقرير أو مستند ناقص، فهي إشارة على انضباط التقارير.`,
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
        `درجة الحوكمة لسه غير مقيَّمة، فالمقارنة بين هذه الجهة وغيرها ` +
        `في نفس الهدف مش مكتملة عند اتخاذ القرار.`,
      bold: ['غير مقيَّمة'],
      src: 'حقل الحوكمة في ملف الجهة',
    })
  }

  /* حداثة التسجيل مش عيبًا، بس بتفسّر سجلًا قصيرًا: جهة عمرها سنة
     ما ينفعش يتحاسب سجلها زي جهة عمرها عشرة. */
  const tenure = yearsSince(entity.registeredAt)
  if (tenure !== null && tenure < 3) {
    const y = tenure === 0 ? 'أقل من سنة' : units.year(tenure, true)
    out.push({
      id: 'tenure',
      kind: 'note',
      label: 'جهة حديثة',
      metric: { value: tenure === 0 ? 'أقل من سنة' : String(tenure), unit: 'منذ التسجيل' },
      text: `مسجّلة من ${y} بس، فالسجل التراكمي فوق قصير بطبيعته، قلّته مش أداءً ضعيفًا.`,
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

/* ═══════════════════ اليوم · قراءة عرضية للسيستم ═══════════════════ */

export interface HomeReadingInput {
  projects: ProjectRow[]
  entities: EntityRow[]
  /** الدور بيحدّد **أي** قراءات تتحسب أصلًا، مش ترتيبها بس */
  lens: 'own' | 'team' | 'portfolio'
  /** اسم المستخدم · للعدسة الشخصية */
  owner: string
  /** سقف الاعتماد، null = توصية فقط */
  ceiling: number | null
  budget: { allocated: number; reserved: number; committed: number; spent: number }
}

/**
 * القراءات اللي بتقطع الموديولات.
 *
 * صفحة المشاريع بتقرأ المشاريع، وصفحة الجهات بتقرأ الجهات · لكن
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

  // أطول ما وقف في صندوقه هو · رقم شخصي، مش متوسط السيستم
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

  // ما ينتظر اعتماده هو · اللي فوق سقف المشرف
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

  // توزيع الحمل · الاختلال ده هو اللي بيصنع التأخير أصلًا
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
        `الفرق ده بيظهر في مدد الانتظار قبل ما يظهر في أي تقرير.`,
      bold: [units.project(lightest[1].length, true), lightest[0]],
      src: 'المشاريع تحت الدراسة لكل مشرف',
      to: `${ROUTES.projects}?owner=${encodeURIComponent(heaviest[0])}&status=في الدراسة`,
      toLabel: 'اعرضها',
    })
  }

  // بلا مالك · قرار الإسناد قراره هو
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

  // الأثر: المكتمل مقابل المعتذر عنه · النسبة دي هي حصيلة السنة
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

  // الشركاء: التركّز · كام جهة ماسكة أغلب الدعم
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

/** التقاطع بين المشاريع وملفات الجهات · ما يظهرش في أي شاشة لوحده */
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
      `محجوز أو ملتزم به، ${nf.format(budget.committed)} ريال التزامًا ` +
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

/** أي قسم إجرائي فيه أطول طابور · مكان أول تحسين في الزمن */
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

/**
 * قراءات الملف · نفس شكل `Reading` عشان تترسم بنفس الراسم.
 *
 * `Insight` شكل قديم من قبل ما القراءة تتوحّد. الدالة دي بتحوّله بدل
 * ما يفضل في السيستم راسمان لنفس المعنى، ولحد ما مصدر التحليلات
 * يرجّع `Reading` مباشرة.
 */
export function readInsights(items: Insight[], actions?: ReadingAction[]): Reading[] {
  return items.map((it, i) => ({
    id: `ins-${i}`,
    kind: 'note',
    text: it.text,
    bold: it.bold,
    /* المصدر بييجي من الداتا وفيه «المصدر:» مكتوبة، والراسم بيضيفها
       · فبتتشال هنا بدل ما تتكرر. */
    src: it.src.replace(/^المصدر:\s*/, ''),
    actions: i === 0 ? actions : undefined,
  }))
}

/* ═══════════════════ التقارير ═══════════════════ */

/**
 * قراءات صفحة التقارير.
 *
 * الفرق بينها وبين كروت اللوحة: الكارت بيقول **الرقم**، والقراءة
 * بتقول **اللي يتعمل بيه**. اللوحة بتجاوب «الميزانية واقفة فين؟»،
 * والقراءة بتقول إن اللي مربوط ولسه ما خرجش أكبر من اللي خرج،
 * وإن ده بيغيّر أولوية الشهر الجاي.
 *
 * وكلها محسوبة من نفس الداتا اللي الكروت بتعرضها، فمستحيل تتعارض
 * معاها · نفس قاعدة صفحتَي المشروع والجهة.
 */
export function readReports(yearId: string): Reading[] {
  const out: Reading[] = []
  const rows = projectRows.filter((p) => p.year === yearId)
  const bud = budgetForYear(yearId)

  /* ١ · المربوط مقابل المصروف · ده أهم رقم في الصفحة */
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
        `${pctText(lockedPct)} من المخصص محجوزة أو ملتزم بها، مقابل ${pctText(spentPct)} وصلت للجهات فعلًا. ` +
        `المربوط مش متاح لمشروع جديد ومش واصل للمستفيد، فهو أثقل بند في الميزانية.`,
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

  /* ٢ · فجوة الوعد · الرقم اللي النظام عنده وما بيعرضهوش */
  if (closingRows.length) {
    const g = gapOf(closingRows)
    const missed = g.total - g.metTarget
    out.push({
      id: 'r-gap',
      kind: 'flag',
      label: 'الوعد مقابل التنفيذ',
      metric: { value: String(missed), unit: 'مشروعًا لم يصل لعدد مستفيديه' },
      text:
        `من ${units.project(g.total, true)} لها تقرير ختامي، ${missed} ما وصلوش للعدد المتعاقد عليه، ` +
        `والمدة الفعلية أطول بـ${pctText(Math.abs(g.days))} في المتوسط. الأرقام دي في «التقارير الختامية» ` +
        `من سنين ومحدّش بيحسبها.`,
      bold: [String(missed)],
      danger: [String(missed)],
      src: 'التقارير الختامية · reports1_12',
      to: ROUTES.reportView('actual'),
      toLabel: 'افتح المقارنة',
    })
  }

  /* ٣ · المعرفة · حقل إلزامي بيتملّى بنقطة */
  const empty = knowledgeRows.filter((k) => k.empty).length
  if (knowledgeRows.length) {
    const emptyPct = Math.round((empty / knowledgeRows.length) * 100)
    out.push({
      id: 'r-know',
      kind: 'flag',
      label: 'المعرفة',
      metric: { value: pctText(emptyPct), unit: 'من قيود المعرفة فاضية' },
      text:
        `${empty} قيدًا من ${knowledgeRows.length} نصّهم نقطة واحدة. الحقل إلزامي، فبيتملّى عشان ` +
        `يعدّي لا عشان يُقرأ، والعلاج مش حقل تاني، العلاج إن اللي بيكتبه يشوف نتيجته.`,
      bold: [String(empty)],
      danger: [pctText(emptyPct)],
      src: 'تقرير المعرفة · reports1_13',
      to: ROUTES.reportView('knowledge'),
      toLabel: 'افتح القيود',
    })
  }

  /* ٤ · تركّز المنح · سبب اعتذار مقنّن في النظام */
  const byGoal = topCount(rows.filter((p) => p.amountGranted > 0), (p) => p.goal)
  if (byGoal && byGoal[1] > 1) {
    out.push({
      id: 'r-conc',
      kind: 'note',
      label: 'تركّز',
      metric: { value: String(byGoal[1]), unit: 'مشاريع في هدف واحد' },
      text:
        `«${byGoal[0]}» أخد ${units.project(byGoal[1], true)} في الفترة دي. التركّز مش غلط بالضرورة، ` +
        `بس «مشروع مكرر لنفس الجهة» أحد مبررات الاعتذار المقنّنة، فيستحق نظرة.`,
      bold: [byGoal[0]],
      src: 'مخصص الصرف · reports1_5',
      to: ROUTES.reportView('spend'),
      toLabel: 'افتح التوزيع',
    })
  }

  /* ٥ · المتأخر · نفس رقم لوحة العمل، بس هنا كسبب لا كعدّاد */
  const late = rows.filter((p) => stagePressure(p) > 1)
  if (late.length) {
    const worst = late.reduce((a, b) => (a.hoursInStage > b.hoursInStage ? a : b))
    out.push({
      id: 'r-late',
      kind: 'flag',
      label: 'فوق الحدّ',
      metric: { value: String(late.length), unit: 'مشروعًا فوق حدّ قسمه' },
      text:
        `أطولها «${worst.name}» واقف من ${units.day(days(worst.hoursInStage), true)} في «${worst.stage}». ` +
        `المكوث بيتقاس في النظام فعلًا، والحدّ المقارَن بيه مؤقت لحين اعتماده.`,
      bold: [worst.stage],
      danger: [String(late.length)],
      src: 'أداء الأقسام · reports1_15',
      to: ROUTES.reportView('stages'),
      toLabel: 'افتح القائمة',
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'r-clear',
      kind: 'note',
      label: 'لا ملاحظات',
      text: 'مفيش ملاحظة على الفترة دي.',
      src: 'محسوبة من تقارير الفترة',
    })
  }

  return out
}

