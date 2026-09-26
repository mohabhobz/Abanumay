import { CITIES_BY_REGION, REGIONS } from './taxonomy'
import { entityRows } from './entities'
import { budgetDocs, fiscalYears, fundSources } from './budgetTree'
import { projectRows } from './projects'
import { NOUN, countOf } from '@/lib/format'

/* Module settings.

   "Settings" lumps together three different things, and mixing them breaks the screen:

   Master data: cities, regions, classifications, fiscal years — a value defined once that every
   later record builds on
   Business rules: a threshold that changes who approves, a minimum payment amount — a number that
   changes an action's **behavior**, not a list's content
   Preferences: theme, density, language

   The third lives in account preferences and has nothing to do with modules — it's important to
   keep it separate so no one goes looking for "cities" in their preferences.

   The practical rule: any dropdown in any form is master data that belongs here. If a list is
   hardcoded, that's a gap in settings — and this file is what surfaces it.

   No delete in any group. A value that a record depends on can't be deleted, and the last column
   shows the **count of dependents** rather than a trash button. The reason is visible before the
   attempt, not as an error message afterward. */

/** Who actually opens this group · this decides its placement, not its type */
export type SettingOwner = 'مسؤول النظام' | 'إدارة المنح' | 'الإدارة المالية'

export interface SettingGroup {
  key: string
  label: string
  /** One line stating where this value shows up in the system */
  where: string
  count: number
  owner: SettingOwner
  kind: 'master' | 'rule'
}

export interface SettingModule {
  key: string
  label: string
  /** Settings page path · not yet wired into the router */
  to: string
  groups: SettingGroup[]
}

/* Entity classifications
   These four come from the live system's "entity classification" field in the registration form,
   which determines whether three documents are required. */
/* This list comes from the client's live screens — it used to be four ("government entity" and
   "commercial") and became five by name: endowment, civil councils, non-profit company, and
   "government" no longer appears in the registration portal at all (it stays in the `ENTITY_TYPES`
   taxonomy for existing entities). */
export const ENTITY_TYPES = [
  'جمعية أهلية',
  'مؤسسة أهلية',
  'شركة غير ربحية',
  'وقف',
  'المجالس الأهلية',
] as const

/* Technical supervising authorities
   The licensing body · changes as regulation changes, so it's master data, not a constant. */
export const LICENSORS = [
  'المركز الوطني لتنمية القطاع غير الربحي',
  'الهيئة العامة للأوقاف',
  'وزارة التعليم',
  'وزارة الموارد البشرية والتنمية الاجتماعية',
  'وزارة الصحة',
  'وزارة الشؤون الإسلامية',
] as const

/* Target categories
   Open question: this list is fixed in the live system — unclear whether the organization can add
   to it or whether it's locked by the ministry. Included here on the assumption that it can be
   extended. */
export const TARGET_GROUPS = [
  'الأيتام', 'الأرامل', 'ذوو الإعاقة', 'كبار السن', 'الأسر المحتاجة',
  'طلاب العلم', 'الشباب', 'المرأة', 'الأطفال', 'اللاجئون',
] as const

/* Approval matrix · a business rule, not master data.

   These numbers are assumptions. The disbursement flow states that durations and thresholds come
   from settings without giving a value — like the empty "target value" in the indicators. So the
   screen shows them flagged as assumptions until the organization provides real figures.

   The matrix reads bottom-up: the first row whose threshold is greater than or equal to the amount
   is the decision-maker. */
export interface ApprovalRow {
  key: string
  role: string
  /** Up to how much · `null` means no cap above it */
  upTo: number | null
  assumed: boolean
}

export const APPROVAL_MATRIX: ApprovalRow[] = [
  { key: 'supervisor', role: 'مشرف المنح', upTo: 100_000, assumed: true },
  { key: 'manager', role: 'مدير المنح', upTo: 500_000, assumed: true },
  { key: 'exec', role: 'المدير التنفيذي', upTo: 2_000_000, assumed: true },
  { key: 'board', role: 'مجلس الإدارة', upTo: null, assumed: true },
]

/** Who approves a given amount · the same reading the screen explains */
export const approverFor = (amount: number): ApprovalRow =>
  APPROVAL_MATRIX.find((r) => r.upTo === null || amount <= r.upTo) ??
  APPROVAL_MATRIX[APPROVAL_MATRIX.length - 1]

/* Other financial limits · all business rules */
export interface LimitRow {
  key: string
  label: string
  /** The unit is in the name, not the number · the number stays a number */
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

/* Settings inventory · what the `/settings` page reads from.

   Counts here are calculated from the data itself, not hardcoded — so as a group grows, the
   inventory grows with it with no one needing to remember to update it. */
const cityCount = Object.values(CITIES_BY_REGION).reduce((a, c) => a + c.length, 0)

export const SETTING_MODULES: SettingModule[] = [
  {
    key: 'budget',
    label: 'الميزانية',
    to: '/budget/settings',
    groups: [
      {
        key: 'years', label: 'السنوات المالية', kind: 'master', owner: 'الإدارة المالية',
        where: 'ترويسة كل ميزانية · ولا تُفتح ميزانية بدونها',
        count: fiscalYears.length,
      },
      {
        key: 'sources', label: 'مصادر التمويل', kind: 'master', owner: 'الإدارة المالية',
        where: 'ترويسة الميزانية · وتُعرَّف الميزانية بالسنة والمصدر معًا',
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
        where: 'نموذج تسجيل الجهة · وتصفية المنطقة في كل قائمة',
        count: REGIONS.length,
      },
      {
        key: 'cities', label: 'المدن', kind: 'master', owner: 'مسؤول النظام',
        where: 'نموذج تسجيل الجهة · والمدينة تتبع المنطقة',
        count: cityCount,
      },
      {
        key: 'types', label: 'تصنيفات الجهة', kind: 'master', owner: 'إدارة المنح',
        where: 'نموذج التسجيل · والتصنيف يحدد المستندات الإلزامية',
        count: ENTITY_TYPES.length,
      },
      {
        key: 'licensors', label: 'جهات الإشراف الفني', kind: 'master', owner: 'مسؤول النظام',
        where: 'نموذج التسجيل · وملف الجهة',
        count: LICENSORS.length,
      },
      {
        key: 'targets', label: 'الفئات المستهدفة', kind: 'master', owner: 'إدارة المنح',
        where: 'نموذج المشروع · وتقارير الأثر',
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

/* Dependents · what blocks deletion */
export const regionUsed = (r: string) =>
  entityRows.filter((e) => e.region === r).length

export const typeUsed = (t: string) =>
  entityRows.filter((e) => e.type === t).length

export const licensorUsed = (l: string) =>
  entityRows.filter((e) => e.licensor === l).length

export const cityUsed = (c: string) =>
  entityRows.filter((e) => e.city === c).length

/* Dependency chain.

   One rule, previously applied in only one place. Budget settings showed "how many budgets this
   year" while the budget and project themselves showed nothing — half the rule written down.

   The chain: year → budget → project → agreement and payments.
   Each link shows the **count of what depends on it** in place of a delete button — the reason is
   visible before the attempt, not as an error message afterward.

   The count is calculated from the data, not hardcoded — so a newly linked record grows the number
   on its own. */
export interface Deps {
  /** Total count · zero means deletion is allowed */
  count: number
  /** The sentence shown · empty if there are no dependents */
  say: string
}

/**
 * How many projects are linked to a budget · a project links to its year.
 *
 * Matched by the string's **prefix**, not equality: a budget year is `2026` while a project year is
 * `2026-f` or `2026-w` — an exact match would always return zero, and the rule would look like it's
 * working while it's actually blind.
 */
export const budgetDeps = (yearName: string): Deps => {
  const n = projectRows.filter((p) => p.year.startsWith(yearName)).length
  return { count: n, say: n ? `مشاريع مرتبطة بها: ${n}` : '' }
}

/** The project has agreements and payments · the last link in the chain */
export const projectDeps = (agreements: number, payments: number): Deps => {
  const n = agreements + payments
  const parts: string[] = []
  if (agreements) parts.push(`${agreements} اتفاقية`)
  if (payments) parts.push(`${countOf(payments, NOUN.payment)}`)
  return { count: n, say: parts.join(' و') }
}

export const yearUsed = (id: string) =>
  budgetDocs.filter((d) => d.yearId === id).length

/**
 * How many projects fall under this tier's cap · reading the matrix against real data.
 *
 * This column isn't decoration: it's what surfaces a wrong threshold. If one tier ends up covering
 * half of all projects, the tier below it is set too low — and the number says so without anyone
 * having to calculate it.
 */
export const projectsUnder = (row: ApprovalRow): number =>
  projectRows.filter((p) => approverFor(p.amountGranted).key === row.key).length
