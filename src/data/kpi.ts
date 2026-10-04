/**
 * Procedure indicators · 66 indicators across 11 procedures.
 *
 * Source: the procedures document, section "x.7 performance measurement" in each procedure. Names
 * and measurement methods are **copied verbatim** from the document, not reworded, so a review
 * against the document finds the same text.
 *
 * The most important design decision here:
 *
 *   an indicator that can't be measured shows up **written out and empty**, not hidden.
 *
 * The live system has 13 report screens, three of which are empty or filtered with no results.
 * Hiding the indicator would let the gap keep repeating; showing it along with why it's absent
 * turns the reports screen into a request list for the backend. The ratio is computed in `coverage`
 * below, so no hand-typed number breaks as the data grows.
 *
 * Another point that needs to be said to the client: **not a single target exists in the
 * document**. Eight indicators measure compliance against a "target duration" or a service-level
 * agreement, and no one wrote down what that duration is. So the target is `null` across all of
 * them.
 */
import type { EntityRow, ProjectRow } from '@/types/domain'
import { projectRows } from './mock/projects'
import { entityRows } from './mock/entities'
import { budgetForYear, budgetByTrack } from './budget'
import { journeys } from './journey'
import { median } from './analytics'
import { ROUTES } from '@/app/routes'
import { YEARS } from './mock/taxonomy'
import { planKpi } from './mock/plans'
import { CLOSE_TARGET_DAYS, closeKpi } from './mock/closing'
import { NOUN, countOf as countNoun } from '@/lib/format'

/** Denominator unit · "10 of 30" needs to say what the 30 is */
export type Basis = 'project' | 'entity' | 'line' | 'source' | 'riyal'

/** Indicator unit as given in the document's "unit of measurement" column */
export type KpiUnit = 'pct' | 'days' | 'count' | 'avg'

export interface Kpi {
  /** Its number in the document's table */
  no: number
  /** Indicator name · verbatim */
  name: string
  /** Measurement method · verbatim */
  how: string
  unit: KpiUnit
  /** The computed value. `null` = the needed data doesn't exist */
  value: number | null
  /** What's missing · shown in place of the number */
  gap?: string
  /** Numerator and denominator with their unit, so the number shows what it's built from */
  of?: { part: number; whole: number; basis: Basis }
  /** The better direction · decides the indicator's color once it has a target */
  better: 'up' | 'down' | 'flat'
  /** Target · `null` across all of them: the document has no SLA at all */
  target: number | null
  /** The rows behind the number · a number with no rows behind it is a dead report */
  to?: string
  /** The number is derived from `journey.ts`, not a real column */
  derived?: boolean
}

export interface ProcessKpis {
  /** The procedure's number in the document */
  id: string
  /** The URL slug */
  key: string
  no: number
  title: string
  owner: string
  kpis: Kpi[]
}

/* Calculation helpers */

const rows: ProjectRow[] = projectRows
const ents: EntityRow[] = entityRows

const share = (part: number, whole: number): number => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/**
 * Ratio indicator: returns the value along with the numerator, denominator, and their unit. The
 * denominator isn't a detail — "100%" of one project is a misleading number, and the unit is what
 * stops "73,700,000 cases" from being written where it should say "73,700,000 riyals."
 */
const ratio = (part: number, whole: number, basis: Basis = 'project') => ({
  value: share(part, whole),
  of: { part, whole, basis },
})

const decided = rows.filter((r) => r.supportStatus !== null)
const approved = rows.filter((r) => r.supportStatus === 'معتمد')
const rejected = rows.filter((r) => r.supportStatus === 'مرفوض')
const j = (r: ProjectRow) => journeys.get(r.id)

/** Median duration in days for a journey field */
const medianDays = (pool: ProjectRow[], f: (r: ProjectRow) => number | null | undefined): number | null => {
  const v = pool.map((r) => f(r)).filter((h): h is number => typeof h === 'number' && h > 0)
  return v.length ? Math.round(median(v) / 24) : null
}

const countOf = (pool: ProjectRow[], f: (r: ProjectRow) => boolean) => pool.filter(f).length

const P = ROUTES.projects
const link = (qs: string) => `${P}?${qs}`

/* Budget */

const bud = budgetForYear()
const lines = budgetByTrack()
const usedLines = lines.filter((l) => l.spent > 0 || l.committed > 0)
const drained = lines.filter((l) => l.remaining <= 0)

/**
 * Sources: the Foundation and the endowment. Allocated comes from each source's years, spent from
 * its rows.
 */
const bySource = (src: 'foundation' | 'waqf') => {
  const suffix = src === 'foundation' ? '-f' : '-w'
  const allocated = YEARS.filter((y) => y.id.endsWith(suffix)).reduce((s, y) => s + y.budget, 0)
  const pool = rows.filter((r) => r.funding === src)
  return {
    allocated,
    spent: pool.reduce((s, r) => s + r.amountSpent, 0),
    reserved: pool.filter((r) => r.statusGroup === 'في الدراسة').reduce((s, r) => s + r.amountRequested, 0),
  }
}
const found = bySource('foundation')
const waqf = bySource('waqf')
const sourcesUnused = [found, waqf].filter((s) => s.spent === 0 && s.reserved === 0).length

/* Index */

export const PROCESSES: ProcessKpis[] = [
  {
    id: 'BPD-001',
    key: 'bpd-001',
    no: 1,
    title: 'الإلمام والاستكشاف',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'نسبة إنجاز فرص المنح ضمن المدة المحددة', how: 'عدد فرص المنح المكتملة ضمن المدة الزمنية ÷ إجمالي فرص المنح × 100%.', unit: 'pct', value: null, better: 'up', target: null },
      { no: 2, name: 'متوسط مدة إعداد فرصة المنح', how: 'متوسط عدد الأيام من إسناد فرصة المنح حتى اعتمادها.', unit: 'days', value: null, better: 'down', target: null },
      { no: 3, name: 'نسبة فرص المنح المعتمدة من أول مراجعة', how: 'عدد فرص المنح المعتمدة من أول مرة ÷ إجمالي فرص المنح × 100%.', unit: 'pct', value: null, better: 'up', target: null },
      { no: 4, name: 'عدد الخبراء المشاركين في دراسة كل فرصة منح', how: 'متوسط عدد الخبراء الذين تمت الاستفادة منهم لكل فرصة منح.', unit: 'avg', value: null, better: 'up', target: null },
      { no: 5, name: 'عدد الجهات ذات العلاقة المشاركة', how: 'متوسط عدد الجهات التي تمت مقابلتها أو الاستفادة منها لكل فرصة منح.', unit: 'avg', value: null, better: 'up', target: null },
      { no: 6, name: 'عدد الدراسات والأبحاث الموثقة', how: 'متوسط عدد الدراسات والأبحاث المسجلة لكل فرصة منح.', unit: 'avg', value: null, better: 'up', target: null },
      { no: 7, name: 'عدد الأنظمة واللوائح الموثقة', how: 'متوسط عدد الأنظمة واللوائح المرتبطة بكل فرصة منح.', unit: 'avg', value: null, better: 'up', target: null },
      { no: 8, name: 'نسبة فرص المنح المرتبطة برؤية المملكة 2030', how: 'عدد فرص المنح المرتبطة بالرؤية ÷ إجمالي فرص المنح × 100%.', unit: 'pct', value: null, better: 'up', target: null },
      { no: 9, name: 'عدد المشاريع المقترحة الناتجة عن الإلمام والاستكشاف', how: 'إجمالي المشاريع أو المبادرات التي تم تسجيلها نتيجة الإجراء.', unit: 'count', value: null, better: 'up', target: null },
      { no: 10, name: 'عدد الجهات المقترح استقطابها', how: 'إجمالي الجهات الجديدة التي تم تسجيلها ضمن فرص المنح.', unit: 'count', value: null, better: 'up', target: null },
      { no: 11, name: 'عدد الخبراء المضافين إلى قاعدة المعرفة', how: 'إجمالي الخبراء الذين تمت إضافتهم والاستفادة منهم خلال الفترة.', unit: 'count', value: null, better: 'up', target: null },
    ].map((k) => ({
      ...k,
      gap: 'الإجراء كله خارج النظام: لا يوجد في النظام العامل كيان «فرصة منحة» ولا سجل للخبراء ولا دراسات مرتبطة.',
    })) as Kpi[],
  },

  {
    id: 'BPD-002',
    key: 'bpd-002',
    no: 2,
    title: 'إعداد ميزانية المنح',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'نسبة استغلال الميزانية', how: 'إجمالي المبالغ المصروفة ÷ إجمالي المبالغ المخصصة × 100%.', unit: 'pct', ...ratio(bud.spent, bud.allocated, 'riyal'), better: 'up', target: null, to: ROUTES.budget },
      { no: 2, name: 'نسبة الرصيد المتبقي', how: 'إجمالي الرصيد المتبقي ÷ إجمالي المبالغ المخصصة × 100%.', unit: 'pct', ...ratio(bud.remaining, bud.allocated, 'riyal'), better: 'flat', target: null, to: ROUTES.budget },
      { no: 3, name: 'نسبة الحجز من الميزانية', how: 'إجمالي المبالغ المحجوزة ÷ إجمالي المبالغ المخصصة × 100%.', unit: 'pct', ...ratio(bud.reserved, bud.allocated, 'riyal'), better: 'flat', target: null, to: link('status=في الدراسة') },
      { no: 4, name: 'عدد البنود المستغلة', how: 'عدد بنود الميزانية التي تم استخدامها مقارنة بإجمالي البنود.', unit: 'pct', ...ratio(usedLines.length, lines.length, 'line'), better: 'up', target: null, to: ROUTES.budget },
      { no: 5, name: 'نسبة البنود غير المستخدمة', how: 'عدد البنود التي لم يتم الحجز أو الصرف عليها ÷ إجمالي البنود × 100%.', unit: 'pct', ...ratio(lines.length - usedLines.length, lines.length, 'line'), better: 'down', target: null, to: ROUTES.budget },
      { no: 6, name: 'عدد المناقلات المالية', how: 'إجمالي طلبات المناقلات المنفذة خلال السنة المالية.', unit: 'count', value: null, gap: 'المناقلة غير ممثّلة في النموذج، ولم تُقرأ شاشة المناقلات في النظام العامل (المراجعة كانت للقراءة فقط).', better: 'flat', target: null },
      { no: 7, name: 'نسبة البنود التي استنفدت مخصصاتها', how: 'عدد البنود التي وصل رصيدها إلى صفر ÷ إجمالي البنود × 100%.', unit: 'pct', ...ratio(drained.length, lines.length, 'line'), better: 'down', target: null, to: ROUTES.budget },
      { no: 8, name: 'نسبة استغلال مصدر التمويل', how: 'إجمالي المبالغ المصروفة من مصدر التمويل ÷ إجمالي المبلغ المخصص من المصدر × 100%.', unit: 'pct', ...ratio(found.spent, found.allocated, 'riyal'), better: 'up', target: null, to: link('funding=foundation') },
      { no: 9, name: 'نسبة الحجز لكل مصدر تمويل', how: 'إجمالي المبالغ المحجوزة من المصدر ÷ إجمالي المبلغ المخصص من المصدر × 100%.', unit: 'pct', ...ratio(found.reserved, found.allocated, 'riyal'), better: 'flat', target: null, to: link('funding=foundation&status=في الدراسة') },
      { no: 10, name: 'نسبة البنود متعددة مصادر التمويل', how: 'عدد البنود المرتبطة بأكثر من مصدر تمويل ÷ إجمالي بنود الميزانية × 100%.', unit: 'pct', value: null, gap: 'ربط البند بأكثر من مصدر غير ممثّل، إذ يربط النموذج المشروع بمصدر واحد.', better: 'flat', target: null },
      { no: 11, name: 'نسبة المشاريع ذات التمويل المشترك', how: 'عدد المشاريع الممولة من أكثر من مصدر ÷ إجمالي المشاريع الممولة × 100%.', unit: 'pct', ...ratio(countOf(approved, (r) => r.shared), approved.length), better: 'flat', target: null, to: link('shared=1') },
      { no: 12, name: 'نسبة مصادر التمويل غير المستخدمة', how: 'عدد مصادر التمويل التي لم يتم الحجز أو الصرف منها ÷ إجمالي مصادر التمويل المعتمدة × 100%.', unit: 'pct', ...ratio(sourcesUnused, 2, 'source'), better: 'down', target: null },
      { no: 13, name: 'نسبة الأرصدة غير المستغلة حسب المصدر', how: 'الرصيد غير المستخدم في مصدر التمويل ÷ إجمالي مخصصات المصدر × 100%.', unit: 'pct', ...ratio(Math.max(0, waqf.allocated - waqf.spent), waqf.allocated, 'riyal'), better: 'down', target: null, to: link('funding=waqf') },
    ],
  },

  {
    id: 'BPD-003',
    key: 'bpd-003',
    no: 3,
    title: 'تسجيل واعتماد الجهات المستفيدة',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'متوسط مدة معالجة طلب التسجيل', how: 'متوسط الوقت من تاريخ تقديم الطلب حتى إصدار قرار الاعتماد أو الرفض.', unit: 'days', value: null, gap: 'تاريخ قرار الجهة غير موجود في النموذج، ويعرض النظام تاريخ التسجيل وآخر تعديل فقط.', better: 'down', target: null },
      { no: 2, name: 'نسبة طلبات التسجيل المعتمدة من أول مراجعة', how: 'عدد الطلبات المعتمدة دون إعادة للاستكمال ÷ إجمالي الطلبات × 100%.', unit: 'pct', value: null, gap: 'لا يوجد سجل لإعادة طلب الجهة، ولا تُحفظ إلا الحالة الحالية.', better: 'up', target: null },
      { no: 3, name: 'متوسط عدد مرات إعادة الطلب للاستكمال', how: 'إجمالي مرات إعادة الطلبات ÷ إجمالي الطلبات.', unit: 'avg', value: null, gap: 'للسبب نفسه: لا يوجد سجل حالات لطلب التسجيل.', better: 'down', target: null },
      { no: 4, name: 'نسبة الطلبات المرفوضة بسبب عدم صحة البيانات أو الوثائق', how: 'عدد الطلبات المرفوضة لهذا السبب ÷ إجمالي الطلبات × 100%.', unit: 'pct', value: null, gap: 'أسباب الرفض مقنّنة للمشاريع (9 مبررات) وليست للجهات.', better: 'down', target: null },
      { no: 5, name: 'عدد الجهات الجديدة المعتمدة', how: 'إجمالي الجهات التي تم اعتمادها خلال الفترة.', unit: 'count', value: ents.filter((e) => e.activation === 'نشط').length, better: 'up', target: null, to: `${ROUTES.entities}?activation=نشط` },
      { no: 6, name: 'عدد الجهات الجديدة المرفوضة', how: 'إجمالي الجهات التي تم رفضها خلال الفترة.', unit: 'count', value: ents.filter((e) => e.activation === 'مرفوض').length, better: 'down', target: null, to: `${ROUTES.entities}?activation=مرفوض` },
    ],
  },

  {
    id: 'BPD-004',
    key: 'bpd-004',
    no: 4,
    title: 'استقبال ودراسة المشاريع',
    owner: 'مشرف المنح',
    kpis: [
      { no: 1, name: 'متوسط مدة دراسة المشروع', how: 'متوسط عدد الأيام من تاريخ إسناد المشروع إلى مشرف المنح حتى تسجيل التوصية.', unit: 'days', value: medianDays(rows, (r) => j(r)?.study), better: 'down', target: null, derived: true, to: link('sort=waiting') },
      { no: 2, name: 'نسبة الالتزام بالمدة المستهدفة للدراسة', how: '(عدد المشاريع التي تمت دراستها ضمن المدة المحددة ÷ إجمالي المشاريع المدروسة) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => r.stageLimit > 0 && r.hoursInStage <= r.stageLimit), countOf(rows, (r) => r.stageLimit > 0)), better: 'up', target: null, to: link('overdue=1') },
      { no: 3, name: 'متوسط عدد المشاريع التي تمت دراستها لكل مشرف', how: 'إجمالي المشاريع التي درسها المشرف خلال الفترة ÷ عدد المشرفين.', unit: 'avg', value: Math.round(countOf(rows, (r) => r.owner !== null) / Math.max(1, new Set(rows.map((r) => r.owner).filter(Boolean)).size)), better: 'flat', target: null, to: P },
      { no: 4, name: 'نسبة المشاريع المحولة بين المشرفين', how: '(عدد المشاريع المحولة إلى مشرف آخر ÷ إجمالي المشاريع) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => j(r)?.transferred === true), rows.length), better: 'down', target: null, derived: true },
      { no: 5, name: 'نسبة المشاريع المعادة لاستكمال البيانات', how: '(عدد المشاريع المعادة للجهة لاستكمال البيانات ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => (j(r)?.toEntity ?? 0) > 0), rows.length), better: 'down', target: null, derived: true, to: link('stage=استكمال بيانات المشروع') },
      { no: 6, name: 'نسبة المشاريع المكتملة البيانات من أول إرسال', how: '(عدد المشاريع التي لم تتطلب استكمال بيانات ÷ إجمالي المشاريع) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => (j(r)?.toEntity ?? 0) === 0), rows.length), better: 'up', target: null, derived: true },
    ],
  },

  {
    id: 'BPD-005',
    key: 'bpd-005',
    no: 5,
    title: 'دور مدير المنح',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'متوسط مدة مراجعة المشاريع', how: 'متوسط عدد الأيام من تاريخ استلام المشروع حتى تسجيل قرار مدير المنح.', unit: 'days', value: medianDays(decided, (r) => j(r)?.manager), better: 'down', target: null, derived: true },
      { no: 2, name: 'نسبة الالتزام بالمدة المستهدفة للمراجعة', how: '(عدد المشاريع التي تمت مراجعتها ضمن المدة المستهدفة ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', value: null, gap: 'لا توجد مدة مستهدفة: لم تحدّد الوثيقة اتفاقية مستوى خدمة لأي مستوى في الإجراءات الـ11.', better: 'up', target: null },
      { no: 3, name: 'نسبة المشاريع المعادة إلى مشرف المنح', how: '(عدد المشاريع المعادة لاستكمال الدراسة ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(decided, (r) => (j(r)?.toSupervisor ?? 0) > 0), decided.length), better: 'down', target: null, derived: true },
      { no: 4, name: 'نسبة المشاريع المحالة إلى المدير التنفيذي', how: '(عدد المشاريع المحالة إلى المدير التنفيذي ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(decided, (r) => j(r)?.decidedBy !== null && j(r)?.decidedBy !== 'مدير المنح'), decided.length), better: 'flat', target: null, derived: true },
      { no: 5, name: 'نسبة الرفض النهائي ضمن صلاحيات مدير المنح', how: '(عدد المشاريع المرفوضة ضمن سقف مدير المنح ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(rejected, (r) => r.amountRequested <= 250_000), decided.length), better: 'flat', target: null, to: link('support=مرفوض') },
      { no: 6, name: 'نسبة المشاريع التي تم حجز ميزانيتها من أول مراجعة', how: '(عدد المشاريع التي تم حجز مخصصاتها المالية دون إعادة الدراسة ÷ إجمالي المشاريع الموافق عليها) × 100%.', unit: 'pct', ...ratio(countOf(approved, (r) => j(r)?.reservedFirstPass === true), approved.length), better: 'up', target: null, derived: true },
    ],
  },

  {
    id: 'BPD-006',
    key: 'bpd-006',
    no: 6,
    title: 'دور المدير التنفيذي',
    owner: 'الإدارة التنفيذية',
    kpis: [
      { no: 1, name: 'متوسط مدة المراجعة التنفيذية', how: 'متوسط الزمن من استلام المشروع حتى تسجيل قرار الرئيس التنفيذي.', unit: 'days', value: medianDays(decided, (r) => j(r)?.exec), better: 'down', target: null, derived: true },
      { no: 2, name: 'نسبة القرارات ضمن المدة المستهدفة', how: 'عدد المشاريع التي صدر قرارها ضمن اتفاقية مستوى الخدمة ÷ إجمالي المشاريع × 100%.', unit: 'pct', value: null, gap: 'يقيس المؤشر الالتزام بـ«اتفاقية مستوى الخدمة»، ولا توجد اتفاقية مستوى خدمة مكتوبة في الوثيقة.', better: 'up', target: null },
      { no: 3, name: 'نسبة المشاريع المعادة إلى مدير المنح', how: 'عدد المشاريع المعادة لاستكمال الملاحظات ÷ إجمالي المشاريع المستلمة × 100%.', unit: 'pct', value: null, gap: 'الإعادة من المدير التنفيذي إلى مدير المنح غير مسجّلة حدثًا مستقلًا.', better: 'down', target: null },
      { no: 4, name: 'متوسط عدد مرات إعادة المشروع', how: 'إجمالي مرات الإعادة ÷ عدد المشاريع المعادة.', unit: 'avg', value: (() => { const back = decided.filter((r) => (j(r)?.toSupervisor ?? 0) > 0); return back.length ? Math.round((back.reduce((s, r) => s + (j(r)?.toSupervisor ?? 0), 0) / back.length) * 10) / 10 : null })(), better: 'down', target: null, derived: true },
    ],
  },

  {
    id: 'BPD-007',
    key: 'bpd-007',
    no: 7,
    title: 'دور اللجنة التنفيذية',
    owner: 'اللجنة التنفيذية',
    kpis: [
      { no: 1, name: 'متوسط مدة دراسة المشروع في اللجنة التنفيذية', how: 'متوسط عدد الأيام من تاريخ إحالة المشروع إلى اللجنة حتى صدور القرار النهائي.', unit: 'days', value: medianDays(decided, (r) => j(r)?.committee), better: 'down', target: null, derived: true },
      { no: 2, name: 'متوسط مدة إصدار قرار اللجنة', how: 'متوسط الزمن من تاريخ انعقاد الاجتماع حتى اعتماد القرار في النظام.', unit: 'days', value: null, gap: 'تاريخ انعقاد الاجتماع غير موجود في النظام، والمحاضر مرفوعة ملفاتٍ بلا تاريخ منظّم.', better: 'down', target: null },
      { no: 3, name: 'نسبة المشاريع المعتمدة من أول عرض', how: '(عدد المشاريع التي تمت التوصية بالموافقة عليها من أول عرض ÷ إجمالي المشاريع المعروضة) × 100%.', unit: 'pct', ...(() => { const pool = decided.filter((r) => j(r)?.committee !== null); return ratio(countOf(pool, (r) => j(r)?.firstPass === true), pool.length) })(), better: 'up', target: null, derived: true },
      { no: 4, name: 'نسبة المشاريع المرفوضة', how: '(عدد المشاريع التي أوصت اللجنة برفضها ÷ إجمالي المشاريع المعروضة) × 100%.', unit: 'pct', ...(() => { const pool = decided.filter((r) => j(r)?.committee !== null); return ratio(countOf(pool, (r) => r.supportStatus === 'مرفوض'), pool.length) })(), better: 'down', target: null },
    ],
  },

  {
    id: 'BPD-008',
    key: 'bpd-008',
    no: 8,
    title: 'دور مجلس الأمناء',
    owner: 'مجلس الأمناء',
    kpis: [
      { no: 1, name: 'نسبة المشاريع المعروضة ضمن المدة المحددة', how: 'عدد المشاريع التي عرضت ضمن المدة المستهدفة ÷ إجمالي المشاريع المحالة × 100%.', unit: 'pct', value: null, gap: 'لا توجد في الوثيقة مدة مستهدفة للعرض على المجلس.', better: 'up', target: null },
      { no: 2, name: 'متوسط مدة إصدار قرار اللجنة', how: 'متوسط الزمن من تاريخ انعقاد الاجتماع حتى اعتماد القرار في النظام.', unit: 'days', value: null, gap: 'تاريخ انعقاد الاجتماع غير مسجّل في النظام.', better: 'down', target: null },
      { no: 3, name: 'نسبة المشاريع التي صدر قرار بشأنها من أول عرض', how: 'عدد المشاريع التي تم البت فيها من أول اجتماع ÷ إجمالي المشاريع المعروضة × 100%.', unit: 'pct', ...(() => { const pool = decided.filter((r) => j(r)?.decidedBy === 'مجلس الأمناء'); return ratio(countOf(pool, (r) => j(r)?.firstPass === true), pool.length) })(), better: 'up', target: null, derived: true },
      { no: 4, name: 'نسبة المشاريع المرفوضة', how: 'عدد المشاريع المرفوضة ÷ إجمالي المشاريع المعروضة × 100%.', unit: 'pct', ...(() => { const pool = decided.filter((r) => j(r)?.decidedBy === 'مجلس الأمناء'); return ratio(countOf(pool, (r) => r.supportStatus === 'مرفوض'), pool.length) })(), better: 'down', target: null },
    ],
  },

  {
    id: 'BPD-009',
    key: 'bpd-009',
    no: 9,
    title: 'الاتفاقيات',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'متوسط مدة إعداد الاتفاقية', how: 'متوسط عدد الأيام من إحالة المشروع إلى مرحلة إعداد الاتفاقية حتى اعتماد الاتفاقية.', unit: 'days', value: medianDays(rows, (r) => j(r)?.agreement), better: 'down', target: null, derived: true, to: link('stage=اعتماد الإتفاقية') },
      { no: 2, name: 'نسبة الاتفاقيات المنجزة ضمن المدة المستهدفة', how: '(عدد الاتفاقيات المعتمدة ضمن المدة المستهدفة ÷ إجمالي الاتفاقيات) × 100%.', unit: 'pct', value: null, gap: 'لا توجد في الوثيقة مدة مستهدفة لإعداد الاتفاقية.', better: 'up', target: null },
      { no: 3, name: 'متوسط مدة دورة اعتماد الاتفاقية', how: 'متوسط الزمن من إرسال الاتفاقية للاعتماد حتى اكتمال جميع الاعتمادات.', unit: 'days', value: null, gap: 'دورة الاعتماد سبع مراحل (إلكترونية وورقية ومالية وتنفيذية)، والنموذج يسجّل المدة الكلية فقط.', better: 'down', target: null },
      { no: 4, name: 'نسبة الاتفاقيات المعادة للتعديل', how: '(عدد الاتفاقيات المعادة للمراجعة أو التعديل ÷ إجمالي الاتفاقيات) × 100%.', unit: 'pct', value: null, gap: 'الإعادة للتعديل ليست حدثًا مسجّلًا، و«اعتماد الإتفاقية» قسم واحد بلا حالات فرعية.', better: 'down', target: null },
    ],
  },

  /* Project plans
     Warning: **the document gives no indicators at all for this procedure.** These four are derived
     from its own rules, and all are `derived` with `target: null`, exactly like the agreement and
     disbursement indicators, whose targets are also empty. Presenting them as if they came from the
     document would have anyone building on top of them assume they did. */
  {
    id: 'BPD-012',
    key: 'bpd-012',
    no: 12,
    title: 'خطط المشاريع',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'متوسط مدة اعتماد الخطة', how: 'متوسط الأيام من فتح الخطة حتى تثبيت النسخة المرجعية.', unit: 'days', value: planKpi().approveDays, better: 'down', target: null, derived: true, to: ROUTES.plans },
      { no: 2, name: 'نسبة الخطط الملتزمة بجدولها', how: '(الخطط التي يبلغ أداء جدولها 0.95 فأكثر ÷ الخطط قيد التنفيذ) × 100%.', unit: 'pct', value: planKpi().onTrackPct, better: 'up', target: null, derived: true, to: ROUTES.plans },
      { no: 3, name: 'نسبة الأنشطة المتأخّرة', how: '(الأنشطة التي تجاوزت موعدها ولم تُقبل ÷ إجمالي الأنشطة) × 100%.', unit: 'pct', value: planKpi().latePct, better: 'down', target: null, derived: true, to: `${ROUTES.plans}?late=1` },
      /* Warning: this indicator is **about the Foundation itself**, not about entities — a growing
         queue means review is falling behind while the entity keeps working and the ratio stalls.
         That's what makes this measurable at all. */
      { no: 4, name: 'الأنشطة بانتظار مراجعة المؤسسة', how: 'عدد الأنشطة التي أفادت الجهة باكتمالها ولم تُراجع بعد (قاعدة 14).', unit: 'count', value: planKpi().waiting, better: 'down', target: null, derived: true, to: `${ROUTES.plans}?wait=1` },
    ],
  },

  {
    id: 'BPD-010',
    key: 'bpd-010',
    no: 10,
    title: 'صرف الدفعات',
    owner: 'الإدارة المالية',
    kpis: [
      { no: 1, name: 'متوسط مدة معالجة طلب الصرف', how: 'متوسط عدد الأيام من تقديم طلب الصرف حتى تنفيذ عملية الصرف.', unit: 'days', value: medianDays(rows, (r) => j(r)?.payout), better: 'down', target: null, derived: true, to: ROUTES.payments },
      { no: 2, name: 'نسبة طلبات الصرف المنجزة ضمن المدة المستهدفة', how: '(عدد طلبات الصرف المنجزة ضمن المدة المحددة ÷ إجمالي طلبات الصرف) × 100%.', unit: 'pct', value: null, gap: 'لا توجد في الوثيقة مدة مستهدفة لطلب الصرف.', better: 'up', target: null },
      { no: 3, name: 'متوسط مدة تنفيذ الصرف المالي', how: 'متوسط الزمن من اعتماد مدير المنح حتى تنفيذ التحويل المالي.', unit: 'days', value: null, gap: 'الاعتماد والتحويل مرحلتان مختلفتان في النظام (إذن الصرف · سند الصرف) والمدة بينهما غير مفصولة.', better: 'down', target: null },
      { no: 4, name: 'نسبة الالتزام بجدول الدفعات', how: '(عدد الدفعات المصروفة في موعدها ÷ إجمالي الدفعات المستحقة) × 100%.', unit: 'pct', value: null, gap: 'جدول الدفعات موجود داخل صفحة المشروع، ولا يوجد تجميع له على مستوى المحفظة.', better: 'up', target: null },
    ],
  },

  {
    id: 'BPD-011',
    key: 'bpd-011',
    no: 11,
    title: 'إغلاق المشروع',
    owner: 'إدارة المنح',
    /* Warning: **indicators 2 and 3 became measurable only after this module was built.** They used
       to both be `gap`, for two different reasons: the second has no target duration in the
       document, and the third has "request and submission are two independent sections, and neither
       has a date field in the mock." Both are resolved here rather than in the live system: the
       target duration is **ours, provisional** (`CLOSE_TARGET_DAYS`, an open question), and the
       submission date now comes from the audit log. So the number now comes from our own mock
       rather than from missing columns, and this note exists so whoever comes after knows the
       second one's target is still an assumption. */
    kpis: [
      { no: 1, name: 'متوسط مدة إغلاق المشروع', how: 'متوسط عدد الأيام من إنشاء طلب التقرير الختامي حتى اعتماد الإغلاق النهائي للمشروع.', unit: 'days', value: closeKpi().avg, better: 'down', target: null, derived: true, to: ROUTES.closings },
      { no: 2, name: 'نسبة المشاريع المغلقة ضمن المدة المستهدفة', how: `(عدد المشاريع التي تم إغلاقها ضمن المدة المستهدفة ÷ إجمالي المشاريع المغلقة) × 100%. والمدة المستهدفة ${countNoun(CLOSE_TARGET_DAYS, NOUN.day)}، وهي افتراض مؤقت وليست من الوثيقة.`, unit: 'pct', value: closeKpi().inTimePct, better: 'up', target: null, derived: true, to: ROUTES.closings },
      { no: 3, name: 'متوسط مدة إعداد التقرير الختامي', how: 'متوسط الزمن من إنشاء طلب التقرير الختامي حتى إرسال التقرير من الجهة المستفيدة · من سجلّ التدقيق (قاعدة 11).', unit: 'days', value: closeKpi().prepDays, better: 'down', target: null, derived: true, to: ROUTES.closings },
      { no: 4, name: 'نسبة المشاريع التي تم إغلاقها بعد استكمال جميع المتطلبات', how: '(عدد المشاريع التي استوفت جميع متطلبات الإغلاق ÷ إجمالي المشاريع المغلقة) × 100%. والمتطلبات المحسوبة هي التي يعرفها النظام (قاعدة 8 · س-15 مفتوح).', unit: 'pct', value: closeKpi().fullPct, better: 'up', target: null, derived: true, to: ROUTES.closings },
    ],
  },
]

/* Totals */

export const ALL_KPIS: Kpi[] = PROCESSES.flatMap((p) => p.kpis)

export interface KpiCoverage {
  total: number
  measured: number
  missing: number
  /** Indicators that measure compliance against a target duration that doesn't actually exist */
  noTarget: number
}

/** An indicator whose own name assumes an agreed-upon duration, and there is no agreed-upon duration */
const NEEDS_SLA = /المدة المستهدفة|المدة المحددة|مستوى الخدمة/

export const coverage: KpiCoverage = {
  total: ALL_KPIS.length,
  measured: ALL_KPIS.filter((k) => k.value !== null).length,
  missing: ALL_KPIS.filter((k) => k.value === null).length,
  noTarget: ALL_KPIS.filter((k) => NEEDS_SLA.test(k.name) || NEEDS_SLA.test(k.how)).length,
}

export const measuredIn = (p: ProcessKpis): number => p.kpis.filter((k) => k.value !== null).length

export const processByKey = (key: string): ProcessKpis | undefined =>
  PROCESSES.find((p) => p.key === key)

/** The procedure's headline indicator · the first indicator that has a value */
export const headlineOf = (p: ProcessKpis): Kpi | undefined => p.kpis.find((k) => k.value !== null)
