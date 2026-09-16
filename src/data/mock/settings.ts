import { CITIES_BY_REGION, REGIONS } from './taxonomy'
import { entityRows } from './entities'
import { budgetDocs, fiscalYears, fundSources } from './budgetTree'
import { projectRows } from './projects'

/* ═══════════════════════════════════════════════════════════
   إعدادات الموديولات · النقط د-1 إلى د-4

   ⚠️ **«إعدادات» بتلمّ تلات حاجات مختلفة، وخلطهم بيبوّظ الشاشة:**

     ماستر داتا     المدن · المناطق · التصنيفات · السنوات المالية
                    قيمة بتتعرَّف مرة وبيتبني عليها كل ريكورد بعدها
     قواعد عمل      سقف بيغيّر مين يعتمد · حد أدنى للدفعة
                    رقم بيغيّر **سلوك** إجراء لا محتوى قايمة
     تفضيلات        الثيم · الكثافة · اللغة

   التالت ده في `/account/preferences` ومالوش علاقة بالموديولات ·
   ومهم يفضل مفصول عشان محدش يدوّر على «المدن» في تفضيلاته.

   ⚠️ **والقاعدة العملية:** أي قائمة منسدلة في أي فورم = ماستر داتا
   لها مكان هنا. لو القايمة مكتوبة في الكود، يبقى في حتة ناقصة في
   الإعدادات · والملف ده هو اللي بيكشفها.

   ⚠️ **ومفيش حذف في أي مجموعة.** القيمة اللي متعلّق بيها ريكورد
   ما تتحذفش، والعمود الأخير بيقول **عدد المتعلقات** لا بيعرض زرار
   سلة. السبب ظاهر قبل المحاولة، مش رسالة خطأ بعدها (قاعدة ج-19).
   ═══════════════════════════════════════════════════════════ */

/** مين بيفتح المجموعة دي فعلًا · وده اللي بيحدد مكانها لا نوعها */
export type SettingOwner = 'مسؤول النظام' | 'إدارة المنح' | 'الإدارة المالية'

export interface SettingGroup {
  key: string
  label: string
  /** سطر واحد بيقول القيمة دي بتظهر فين في السيستم */
  where: string
  count: number
  owner: SettingOwner
  kind: 'master' | 'rule'
}

export interface SettingModule {
  key: string
  label: string
  /** مسار صفحة الإعدادات · مش مدخل في الريل (الجزء ب-4 في البريف) */
  to: string
  groups: SettingGroup[]
}

/* ═══ تصنيفات الجهة ═══
   الأربعة دول مصدرهم النظام العامل · حقل «تصنيف الجهة» في `/reg/add`،
   وهو اللي بيحدد إلزامية تلات مستندات (قاعدتا 8 و9 في إجراء التسجيل) */
export const ENTITY_TYPES = [
  'جمعية أهلية',
  'مؤسسة أهلية',
  'جهة حكومية',
  'تجارية',
] as const

/* ═══ جهات الإشراف الفني ═══
   الجهة المرخِّصة · بتتغيّر بتغيّر التنظيم، فهي ماستر داتا لا ثابت */
export const LICENSORS = [
  'المركز الوطني لتنمية القطاع غير الربحي',
  'الهيئة العامة للأوقاف',
  'وزارة التعليم',
  'وزارة الموارد البشرية والتنمية الاجتماعية',
  'وزارة الصحة',
  'وزارة الشؤون الإسلامية',
] as const

/* ═══ الفئات المستهدفة ═══
   ⚠️ **سؤال مفتوح لعمر:** القايمة دي في النظام العامل ثابتة · مش
   واضح إذا المؤسسة بتضيف فيها ولا هي مقفولة من الوزارة (س-2 في
   البريف). حطّيناها هنا على أساس إنها بتتضاف. */
export const TARGET_GROUPS = [
  'الأيتام', 'الأرامل', 'ذوو الإعاقة', 'كبار السن', 'الأسر المحتاجة',
  'طلاب العلم', 'الشباب', 'المرأة', 'الأطفال', 'اللاجئون',
] as const

/* ═══════════════════════════════════════════════════════════
   مصفوفة الاعتماد · قاعدة عمل لا ماستر داتا

   ⚠️ **الأرقام دي افتراضات.** إجراء الصرف بيقول إن المدد والسقوف
   «من الإعدادات» من غير ما يدّي قيمة واحدة · زي «القيمة المستهدفة»
   الفاضية في المؤشرات. فالشاشة بتعرضها **موسومة افتراضًا** لحد ما
   المؤسسة تدّينا الأرقام (س-1 في البريف).

   والمصفوفة بتتقري من تحت لفوق: أول صف سقفه أكبر من أو يساوي
   المبلغ هو صاحب القرار.
   ═══════════════════════════════════════════════════════════ */
export interface ApprovalRow {
  key: string
  role: string
  /** لغاية كام · و`null` يعني مفيش سقف فوقه */
  upTo: number | null
  assumed: boolean
}

export const APPROVAL_MATRIX: ApprovalRow[] = [
  { key: 'supervisor', role: 'مشرف المنح', upTo: 100_000, assumed: true },
  { key: 'manager', role: 'مدير المنح', upTo: 500_000, assumed: true },
  { key: 'exec', role: 'المدير التنفيذي', upTo: 2_000_000, assumed: true },
  { key: 'board', role: 'مجلس الإدارة', upTo: null, assumed: true },
]

/** مين بيعتمد مبلغ كذا · نفس القراءة اللي الشاشة بتشرحها */
export const approverFor = (amount: number): ApprovalRow =>
  APPROVAL_MATRIX.find((r) => r.upTo === null || amount <= r.upTo) ??
  APPROVAL_MATRIX[APPROVAL_MATRIX.length - 1]

/* ═══ حدود مالية تانية · كلها قواعد عمل ═══ */
export interface LimitRow {
  key: string
  label: string
  /** الوحدة في الاسم لا في الرقم · الرقم بيفضل رقمًا */
  unit: 'ريال' | 'يوم' | '%'
  value: number
  where: string
  assumed: boolean
}

export const MONEY_LIMITS: LimitRow[] = [
  {
    key: 'minPay', label: 'الحد الأدنى للدفعة الواحدة', unit: 'ريال', value: 5_000,
    where: 'إنشاء طلب صرف · خطوة 2', assumed: true,
  },
  {
    key: 'firstPayPct', label: 'أقصى نسبة للدفعة الأولى', unit: '%', value: 40,
    where: 'جدول الدفعات في الاتفاقية', assumed: true,
  },
  {
    key: 'lateDays', label: 'الدفعة تُعدّ متأخرة بعد', unit: 'يوم', value: 15,
    where: 'تقرير المتأخر والمتعثر · آلية التصعيد 9.5', assumed: true,
  },
  {
    key: 'agrDays', label: 'مهلة توقيع الاتفاقية', unit: 'يوم', value: 30,
    where: 'إجراء الاتفاقيات · قاعدة 23', assumed: true,
  },
]

/* ═══════════════════════════════════════════════════════════
   جرد الإعدادات · اللي صفحة `/settings` بتقرا منه

   ⚠️ العدّ هنا **محسوب من الداتا نفسها** لا مكتوب برقم · فلو
   مجموعة كبرت، الجرد بيكبر معاها من غير ما حد يفتكر يعدّله.
   ═══════════════════════════════════════════════════════════ */
const cityCount = Object.values(CITIES_BY_REGION).reduce((a, c) => a + c.length, 0)

export const SETTING_MODULES: SettingModule[] = [
  {
    key: 'budget',
    label: 'الميزانية',
    to: '/budget/settings',
    groups: [
      {
        key: 'years', label: 'السنوات المالية', kind: 'master', owner: 'الإدارة المالية',
        where: 'ترويسة أي ميزانية · وما تعرفش تفتح ميزانية من غيرها',
        count: fiscalYears.length,
      },
      {
        key: 'sources', label: 'مصادر التمويل', kind: 'master', owner: 'الإدارة المالية',
        where: 'ترويسة الميزانية · والميزانية بتتعرّف بـ(سنة + مصدر)',
        count: fundSources.length,
      },
    ],
  },
  {
    key: 'entities',
    label: 'الجهات',
    to: '/entities/settings',
    groups: [
      {
        key: 'regions', label: 'المناطق', kind: 'master', owner: 'مسؤول النظام',
        where: 'فورم تسجيل الجهة · وفلتر المنطقة في كل قايمة',
        count: REGIONS.length,
      },
      {
        key: 'cities', label: 'المدن', kind: 'master', owner: 'مسؤول النظام',
        where: 'فورم تسجيل الجهة · والمدينة تابعة للمنطقة',
        count: cityCount,
      },
      {
        key: 'types', label: 'تصنيفات الجهة', kind: 'master', owner: 'إدارة المنح',
        where: 'فورم التسجيل · والتصنيف بيغيّر المستندات الإلزامية',
        count: ENTITY_TYPES.length,
      },
      {
        key: 'licensors', label: 'جهات الإشراف الفني', kind: 'master', owner: 'مسؤول النظام',
        where: 'فورم التسجيل · وملف الجهة',
        count: LICENSORS.length,
      },
      {
        key: 'targets', label: 'الفئات المستهدفة', kind: 'master', owner: 'إدارة المنح',
        where: 'فورم المشروع · وتقارير الأثر',
        count: TARGET_GROUPS.length,
      },
    ],
  },
  {
    key: 'projects',
    label: 'المشاريع والصرف',
    to: '/projects/settings',
    groups: [
      {
        key: 'approval', label: 'مصفوفة الاعتماد', kind: 'rule', owner: 'إدارة المنح',
        where: 'اعتماد المشروع · واعتماد طلب الصرف',
        count: APPROVAL_MATRIX.length,
      },
      {
        key: 'limits', label: 'الحدود المالية والزمنية', kind: 'rule', owner: 'الإدارة المالية',
        where: 'إنشاء طلب الصرف · جدول الدفعات · التصعيد',
        count: MONEY_LIMITS.length,
      },
    ],
  },
]

/* ═══ المتعلقات · اللي بيمنع الحذف ═══ */
export const regionUsed = (r: string) =>
  entityRows.filter((e) => e.region === r).length

export const typeUsed = (t: string) =>
  entityRows.filter((e) => e.type === t).length

export const licensorUsed = (l: string) =>
  entityRows.filter((e) => e.licensor === l).length

export const cityUsed = (c: string) =>
  entityRows.filter((e) => e.city === c).length

/* ═══════════════════════════════════════════════════════════
   سلسلة المتعلقات · ج-19

   ⚠️ **القاعدة واحدة والتطبيق كان في مكان واحد بس.** إعدادات
   الميزانية كانت بتعرض «كام ميزانية على السنة دي»، والميزانية
   نفسها والمشروع ما كانش عليهم حاجة · يعني نص القاعدة مكتوب.

   والسلسلة: سنة ← ميزانية ← مشروع ← اتفاقية ودفعات.
   وكل حلقة بتعرض **عدد اللي بعدها** مكان زرار الحذف · السبب ظاهر
   قبل المحاولة، مش رسالة خطأ بعدها.

   ⚠️ **والعدّ بيتحسب من الداتا لا مكتوب برقم** · فلو ارتبط ريكورد
   جديد، الرقم بيكبر لوحده.
   ═══════════════════════════════════════════════════════════ */
export interface Deps {
  /** العدد الكلي · صفر يعني الحذف مسموح */
  count: number
  /** الجملة اللي بتتقال · فاضية لو مفيش متعلقات */
  say: string
}

/**
 * كام مشروع مرتبط بميزانية · المشروع بيتربط بسنتها.
 *
 * ⚠️ المطابقة **ببداية النصّ** لا بالتساوي: سنة الميزانية `2026`
 * وسنة المشروع `2026-f` (المؤسسة) أو `2026-w` (الوقف) · فالتساوي
 * كان هيرجّع صفرًا دايمًا، والقاعدة تبان شغّالة وهي عمياء.
 */
export const budgetDeps = (yearName: string): Deps => {
  const n = projectRows.filter((p) => p.year.startsWith(yearName)).length
  return { count: n, say: n ? `${n} مشروعًا عليها` : '' }
}

/** المشروع عليه اتفاقيات ودفعات · آخر حلقة في السلسلة */
export const projectDeps = (agreements: number, payments: number): Deps => {
  const n = agreements + payments
  const parts: string[] = []
  if (agreements) parts.push(`${agreements} اتفاقية`)
  if (payments) parts.push(`${payments} دفعة`)
  return { count: n, say: parts.join(' و') }
}

export const yearUsed = (id: string) =>
  budgetDocs.filter((d) => d.yearId === id).length

/**
 * كام مشروع بيقع تحت سقف الدور ده · قراءة المصفوفة على داتا حقيقية.
 *
 * ⚠️ العمود ده مش زينة: هو اللي بيكشف سقفًا غلط. لو «مجلس الإدارة»
 * طلع تحته نص المشاريع، يبقى السقف اللي تحته واطي · والرقم بيقول
 * كده من غير ما حد يحسب.
 */
export const projectsUnder = (row: ApprovalRow): number =>
  projectRows.filter((p) => approverFor(p.amountGranted).key === row.key).length
