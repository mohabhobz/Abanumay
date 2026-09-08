/**
 * مؤشرات الإجراءات — 66 مؤشرًا موزّعة على 11 إجراءً.
 *
 * المصدر: وثيقة الإجراءات اللي بعتها العميل، القسم `x.7 قياس مستوى
 * الأداء` في كل إجراء. الأسماء وآليات القياس **منقولة حرفيًا** من
 * الوثيقة — مش إعادة صياغة، عشان لما مظفر يراجع يلاقي نص وثيقته.
 *
 * القرار التصميمي الأهم هنا:
 *
 *   المؤشر اللي مش قابل للقياس بيظهر **مكتوبًا وفاضيًا**، مش مخفيًا.
 *
 * النظام العامل فيه 13 شاشة تقارير، تلاتة منها فاضية أو فلاتر بلا
 * نتيجة. إخفاء المؤشر بيخلي الفجوة تتكرر؛ عرضه ومعاه سبب غيابه
 * بيحوّل شاشة التقارير لقائمة مطالب للباك اند. النِّسبة بتتحسب في
 * `coverage` تحت، فما فيش رقم مكتوب بالإيد هنا يبوظ لما الداتا تكبر.
 *
 * وملاحظة تانية لازم تتقال للعميل: **مفيش مستهدف واحد في الوثيقة**.
 * تمانية مؤشرات بتقيس التزامًا بـ«المدة المستهدفة» أو باتفاقية
 * مستوى خدمة، ومحدش كاتب المدة كام. فالمستهدف `null` في كلها.
 */
import type { EntityRow, ProjectRow } from '@/types/domain'
import { projectRows } from './mock/projects'
import { entityRows } from './mock/entities'
import { budgetForYear, budgetByTrack } from './budget'
import { journeys } from './journey'
import { median } from './analytics'
import { ROUTES } from '@/app/routes'
import { YEARS } from './mock/taxonomy'

/** وحدة المقام — «10 من 30» لازم تقول 30 إيه */
export type Basis = 'project' | 'entity' | 'line' | 'source' | 'riyal'

/** وحدة المؤشر كما في عمود «وحدة القياس» بالوثيقة */
export type KpiUnit = 'pct' | 'days' | 'count' | 'avg'

export interface Kpi {
  /** رقمه في جدول الوثيقة */
  no: number
  /** اسم المؤشر — حرفيًا */
  name: string
  /** آلية القياس — حرفيًا */
  how: string
  unit: KpiUnit
  /** القيمة المحسوبة. `null` = الداتا اللازمة مش موجودة */
  value: number | null
  /** ناقصه إيه — بيظهر مكان الرقم */
  gap?: string
  /** البسط والمقام ووحدتهما، عشان الرقم يبان مبني على كام */
  of?: { part: number; whole: number; basis: Basis }
  /** الاتجاه الأحسن — بيحدّد لون المؤشر لما يبقى فيه مستهدف */
  better: 'up' | 'down' | 'flat'
  /** المستهدف — `null` في كلها: الوثيقة مافيهاش أي SLA */
  target: number | null
  /** الصفوف اللي طلّعت الرقم — الرقم اللي مايوصّلش لصفوفه تقرير ميّت */
  to?: string
  /** الرقم مشتقّ من `journey.ts` مش من عمود حقيقي */
  derived?: boolean
}

export interface ProcessKpis {
  /** رقم الإجراء في الوثيقة */
  id: string
  /** الـslug في الـURL */
  key: string
  no: number
  title: string
  owner: string
  kpis: Kpi[]
}

/* ═══════════════════ أدوات الحساب ═══════════════════ */

const rows: ProjectRow[] = projectRows
const ents: EntityRow[] = entityRows

const share = (part: number, whole: number): number => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/**
 * مؤشر نسبة: بيرجّع القيمة ومعاها البسط والمقام ووحدتهما.
 * المقام مش تفصيلة: «100%» من مشروع واحد رقم مضلّل، والوحدة هي اللي
 * بتمنع «73,700,000 حالة» تتكتب مكان «73,700,000 ريال».
 */
const ratio = (part: number, whole: number, basis: Basis = 'project') => ({
  value: share(part, whole),
  of: { part, whole, basis },
})

const decided = rows.filter((r) => r.supportStatus !== null)
const approved = rows.filter((r) => r.supportStatus === 'معتمد')
const rejected = rows.filter((r) => r.supportStatus === 'مرفوض')
const j = (r: ProjectRow) => journeys.get(r.id)

/** وسيط المدة بالأيام لحقل من حقول الرحلة */
const medianDays = (pool: ProjectRow[], f: (r: ProjectRow) => number | null | undefined): number | null => {
  const v = pool.map((r) => f(r)).filter((h): h is number => typeof h === 'number' && h > 0)
  return v.length ? Math.round(median(v) / 24) : null
}

const countOf = (pool: ProjectRow[], f: (r: ProjectRow) => boolean) => pool.filter(f).length

const P = ROUTES.projects
const link = (qs: string) => `${P}?${qs}`

/* ═══════════════════ BPD-002 · الميزانية ═══════════════════ */

const bud = budgetForYear()
const lines = budgetByTrack()
const usedLines = lines.filter((l) => l.spent > 0 || l.committed > 0)
const drained = lines.filter((l) => l.remaining <= 0)

/** المصادر: المؤسسة والوقف. المخصص من سنوات كل مصدر، والمصروف من صفوفه. */
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

/* ═══════════════════ الفهرس ═══════════════════ */

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
      gap: 'الإجراء كله خارج النظام: مفيش كيان «فرصة منحة» ولا سجل خبراء ولا دراسات مرتبطة في النظام العامل.',
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
      { no: 6, name: 'عدد المناقلات المالية', how: 'إجمالي طلبات المناقلات المنفذة خلال السنة المالية.', unit: 'count', value: null, gap: 'المناقلة مش ممثّلة في النموذج — شاشة المناقلات في النظام العامل ما اتقريتش (الأوديت قراءة فقط).', better: 'flat', target: null },
      { no: 7, name: 'نسبة البنود التي استنفدت مخصصاتها', how: 'عدد البنود التي وصل رصيدها إلى صفر ÷ إجمالي البنود × 100%.', unit: 'pct', ...ratio(drained.length, lines.length, 'line'), better: 'down', target: null, to: ROUTES.budget },
      { no: 8, name: 'نسبة استغلال مصدر التمويل', how: 'إجمالي المبالغ المصروفة من مصدر التمويل ÷ إجمالي المبلغ المخصص من المصدر × 100%.', unit: 'pct', ...ratio(found.spent, found.allocated, 'riyal'), better: 'up', target: null, to: link('funding=foundation') },
      { no: 9, name: 'نسبة الحجز لكل مصدر تمويل', how: 'إجمالي المبالغ المحجوزة من المصدر ÷ إجمالي المبلغ المخصص من المصدر × 100%.', unit: 'pct', ...ratio(found.reserved, found.allocated, 'riyal'), better: 'flat', target: null, to: link('funding=foundation&status=في الدراسة') },
      { no: 10, name: 'نسبة البنود متعددة مصادر التمويل', how: 'عدد البنود المرتبطة بأكثر من مصدر تمويل ÷ إجمالي بنود الميزانية × 100%.', unit: 'pct', value: null, gap: 'ربط البند بأكثر من مصدر مش ممثّل — النموذج بيربط المشروع بمصدر واحد.', better: 'flat', target: null },
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
      { no: 1, name: 'متوسط مدة معالجة طلب التسجيل', how: 'متوسط الوقت من تاريخ تقديم الطلب حتى إصدار قرار الاعتماد أو الرفض.', unit: 'days', value: null, gap: 'تاريخ قرار الجهة مش في النموذج — النظام بيعرض تاريخ التسجيل وآخر تعديل بس.', better: 'down', target: null },
      { no: 2, name: 'نسبة طلبات التسجيل المعتمدة من أول مراجعة', how: 'عدد الطلبات المعتمدة دون إعادة للاستكمال ÷ إجمالي الطلبات × 100%.', unit: 'pct', value: null, gap: 'مفيش سجل إعادة لطلب الجهة — الحالة الحالية بس هي المحفوظة.', better: 'up', target: null },
      { no: 3, name: 'متوسط عدد مرات إعادة الطلب للاستكمال', how: 'إجمالي مرات إعادة الطلبات ÷ إجمالي الطلبات.', unit: 'avg', value: null, gap: 'نفس السبب: مفيش سجل حالات لطلب التسجيل.', better: 'down', target: null },
      { no: 4, name: 'نسبة الطلبات المرفوضة بسبب عدم صحة البيانات أو الوثائق', how: 'عدد الطلبات المرفوضة لهذا السبب ÷ إجمالي الطلبات × 100%.', unit: 'pct', value: null, gap: 'سبب الرفض مقنّن للمشاريع (9 مبررات) مش للجهات.', better: 'down', target: null },
      { no: 5, name: 'عدد الجهات الجديدة المعتمدة', how: 'إجمالي الجهات التي تم اعتمادها خلال الفترة.', unit: 'count', value: ents.filter((e) => e.activation === 'مقبول').length, better: 'up', target: null, to: `${ROUTES.entities}?activation=مقبول` },
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
      { no: 2, name: 'نسبة الالتزام بالمدة المستهدفة للمراجعة', how: '(عدد المشاريع التي تمت مراجعتها ضمن المدة المستهدفة ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', value: null, gap: 'مفيش مدة مستهدفة: الوثيقة ما حدّدتش SLA لأي مستوى في الإجراءات الـ11.', better: 'up', target: null },
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
      { no: 2, name: 'نسبة القرارات ضمن المدة المستهدفة', how: 'عدد المشاريع التي صدر قرارها ضمن اتفاقية مستوى الخدمة ÷ إجمالي المشاريع × 100%.', unit: 'pct', value: null, gap: 'المؤشر بيقيس «اتفاقية مستوى الخدمة» ومفيش اتفاقية مستوى خدمة مكتوبة في الوثيقة.', better: 'up', target: null },
      { no: 3, name: 'نسبة المشاريع المعادة إلى مدير المنح', how: 'عدد المشاريع المعادة لاستكمال الملاحظات ÷ إجمالي المشاريع المستلمة × 100%.', unit: 'pct', value: null, gap: 'الإعادة من التنفيذي لمدير المنح مش مسجّلة كحدث مستقل.', better: 'down', target: null },
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
      { no: 2, name: 'متوسط مدة إصدار قرار اللجنة', how: 'متوسط الزمن من تاريخ انعقاد الاجتماع حتى اعتماد القرار في النظام.', unit: 'days', value: null, gap: 'تاريخ انعقاد الاجتماع مش في النظام — المحاضر مرفوعة كملفات بلا تاريخ منظّم.', better: 'down', target: null },
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
      { no: 1, name: 'نسبة المشاريع المعروضة ضمن المدة المحددة', how: 'عدد المشاريع التي عرضت ضمن المدة المستهدفة ÷ إجمالي المشاريع المحالة × 100%.', unit: 'pct', value: null, gap: 'مفيش مدة مستهدفة للعرض على المجلس في الوثيقة.', better: 'up', target: null },
      { no: 2, name: 'متوسط مدة إصدار قرار اللجنة', how: 'متوسط الزمن من تاريخ انعقاد الاجتماع حتى اعتماد القرار في النظام.', unit: 'days', value: null, gap: 'تاريخ انعقاد الاجتماع مش مسجّل في النظام.', better: 'down', target: null },
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
      { no: 2, name: 'نسبة الاتفاقيات المنجزة ضمن المدة المستهدفة', how: '(عدد الاتفاقيات المعتمدة ضمن المدة المستهدفة ÷ إجمالي الاتفاقيات) × 100%.', unit: 'pct', value: null, gap: 'مفيش مدة مستهدفة لإعداد الاتفاقية في الوثيقة.', better: 'up', target: null },
      { no: 3, name: 'متوسط مدة دورة اعتماد الاتفاقية', how: 'متوسط الزمن من إرسال الاتفاقية للاعتماد حتى اكتمال جميع الاعتمادات.', unit: 'days', value: null, gap: 'دورة الاعتماد سبع مراحل (إلكترونية وورقية ومالية وتنفيذية)، والنموذج بيمسك المدة الكلية بس.', better: 'down', target: null },
      { no: 4, name: 'نسبة الاتفاقيات المعادة للتعديل', how: '(عدد الاتفاقيات المعادة للمراجعة أو التعديل ÷ إجمالي الاتفاقيات) × 100%.', unit: 'pct', value: null, gap: 'الإعادة للتعديل مش حدثًا مسجّلًا — «اعتماد الإتفاقية» قسم واحد بلا حالات فرعية.', better: 'down', target: null },
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
      { no: 2, name: 'نسبة طلبات الصرف المنجزة ضمن المدة المستهدفة', how: '(عدد طلبات الصرف المنجزة ضمن المدة المحددة ÷ إجمالي طلبات الصرف) × 100%.', unit: 'pct', value: null, gap: 'مفيش مدة مستهدفة لطلب الصرف في الوثيقة.', better: 'up', target: null },
      { no: 3, name: 'متوسط مدة تنفيذ الصرف المالي', how: 'متوسط الزمن من اعتماد مدير المنح حتى تنفيذ التحويل المالي.', unit: 'days', value: null, gap: 'الاعتماد والتحويل مرحلتان مختلفتان في النظام (إذن الصرف · سند الصرف) والمدة بينهما مش مفصولة.', better: 'down', target: null },
      { no: 4, name: 'نسبة الالتزام بجدول الدفعات', how: '(عدد الدفعات المصروفة في موعدها ÷ إجمالي الدفعات المستحقة) × 100%.', unit: 'pct', value: null, gap: 'جدول الدفعات موجود جوّه صفحة المشروع، ومفيش تجميع له على مستوى المحفظة.', better: 'up', target: null },
    ],
  },

  {
    id: 'BPD-011',
    key: 'bpd-011',
    no: 11,
    title: 'إغلاق المشروع',
    owner: 'إدارة المنح',
    kpis: [
      { no: 1, name: 'متوسط مدة إغلاق المشروع', how: 'متوسط عدد الأيام من إنشاء طلب التقرير الختامي حتى اعتماد الإغلاق النهائي للمشروع.', unit: 'days', value: medianDays(rows, (r) => j(r)?.closing), better: 'down', target: null, derived: true, to: link('status=مكتمل') },
      { no: 2, name: 'نسبة المشاريع المغلقة ضمن المدة المستهدفة', how: '(عدد المشاريع التي تم إغلاقها ضمن المدة المستهدفة ÷ إجمالي المشاريع المغلقة) × 100%.', unit: 'pct', value: null, gap: 'مفيش مدة مستهدفة للإغلاق في الوثيقة.', better: 'up', target: null },
      { no: 3, name: 'متوسط مدة إعداد التقرير الختامي', how: 'متوسط الزمن من إنشاء طلب التقرير الختامي حتى إرسال التقرير من الجهة المستفيدة.', unit: 'days', value: null, gap: 'الطلب والرفع قسمان مستقلان في النظام، وتاريخ كل منهما مش في النموذج.', better: 'down', target: null },
      { no: 4, name: 'نسبة المشاريع التي تم إغلاقها بعد استكمال جميع المتطلبات', how: '(عدد المشاريع التي استوفت جميع متطلبات الإغلاق ÷ إجمالي المشاريع المغلقة) × 100%.', unit: 'pct', ...(() => { const pool = rows.filter((r) => r.statusGroup === 'مكتمل'); return ratio(countOf(pool, (r) => r.hasFinalReport), pool.length) })(), better: 'up', target: null, to: link('status=مكتمل') },
    ],
  },
]

/* ═══════════════════ مجاميع ═══════════════════ */

export const ALL_KPIS: Kpi[] = PROCESSES.flatMap((p) => p.kpis)

export interface KpiCoverage {
  total: number
  measured: number
  missing: number
  /** مؤشرات بتقيس التزامًا بمدة مستهدفة غير موجودة أصلًا */
  noTarget: number
}

/** المؤشر اللي اسمه نفسه بيفترض مدة متفق عليها ومفيش مدة متفق عليها */
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

/** المؤشر الرئيسي للإجراء — أول مؤشر له قيمة */
export const headlineOf = (p: ProcessKpis): Kpi | undefined => p.kpis.find((k) => k.value !== null)
