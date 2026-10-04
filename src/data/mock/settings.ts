import { APPROVAL_MATRIX, approverFor, type ApprovalRow } from '../approval'
import { CFG, hydrateRows } from '@/lib/config'
import { CITIES_BY_REGION, REGIONS } from './taxonomy'
import { entityRows } from './entities'
import { budgetDocs, fiscalYears, fundSources } from './budgetTree'
import { projectRows } from './projects'
import { NOUN, countOf } from '@/lib/format'
import { EVIDENCE_KINDS, PLAN_STAGES } from './plans'
import { CLOSE_DOCS, CLOSE_STAGES } from './closing'
import { AGREEMENT_STAGES } from './agreements'
import { PAY_STATES } from './disbursements'

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
  /** The tab on the module's settings page that holds this group · opened straight from its card */
  tab?: string
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

export { APPROVAL_MATRIX, approverFor, type ApprovalRow } from '../approval'

/* Other financial limits · all business rules */
export interface LimitRow {
  key: string
  label: string
  /** The unit is in the name, not the number · the number stays a number */
  unit: 'ريال' | 'يوم' | '%' | 'مشروع'
  value: number
  where: string
  assumed: boolean
}

export const MONEY_LIMITS: LimitRow[] = hydrateRows(CFG.limits, [
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
  {
    key: 'projectsPerEntity', label: 'أقصى عدد مشاريع للجهة في الدورة', unit: 'مشروع', value: 3,
    where: 'تقديم مشروع جديد من البوابة · يمنع ما فوقه', assumed: true,
  },
  {
    key: 'officerLoad', label: 'أقصى مشاريع قيد الدراسة للمشرف', unit: 'مشروع', value: 15,
    where: 'الإسناد الجماعي في قائمة المشاريع · ينبّه عند تجاوزه', assumed: true,
  },
], 'value')

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
        key: 'years', tab: 'years', label: 'السنوات المالية', kind: 'master', owner: 'الإدارة المالية',
        where: 'ترويسة كل ميزانية · ولا تُفتح ميزانية بدونها',
        count: fiscalYears.length,
      },
      {
        key: 'sources', tab: 'sources', label: 'مصادر التمويل', kind: 'master', owner: 'الإدارة المالية',
        where: 'ترويسة الميزانية · ميزانية بمصدر أو أكثر، ويُوزَّع كل بند على مصادرها',
        count: fundSources.length,
      },
      {
        key: 'directions', tab: 'directions', label: 'التوجهات الاستراتيجية', kind: 'master', owner: 'إدارة المنح',
        where: 'ترويسة الميزانية وبنودها · والتقرير المجمّع حسب التوجه',
        count: 4,
      },
      {
        key: 'limits', tab: 'limits', label: 'حدود الاعتماد والصرف', kind: 'rule', owner: 'الإدارة المالية',
        where: 'ربط المشروع بالميزانية · اعتماد أوامر الصرف',
        count: 4,
      },
      {
        key: 'rules', tab: 'rules', label: 'قواعد الاعتماد والمناقلة', kind: 'rule', owner: 'إدارة المنح',
        where: 'مسار اعتماد الميزانية وطلبات العمليات · فتح المجالات الممولة',
        count: 5,
      },
    ],
  },
  {
    key: 'entities',
    label: 'الجهات',
    to: '/entities/settings',
    groups: [
      {
        key: 'regions', tab: 'places', label: 'المناطق', kind: 'master', owner: 'مسؤول النظام',
        where: 'نموذج تسجيل الجهة · وتصفية المنطقة في كل قائمة',
        count: REGIONS.length,
      },
      {
        key: 'cities', tab: 'places', label: 'المدن', kind: 'master', owner: 'مسؤول النظام',
        where: 'نموذج تسجيل الجهة · والمدينة تتبع المنطقة',
        count: cityCount,
      },
      {
        key: 'types', tab: 'types', label: 'تصنيفات الجهة', kind: 'master', owner: 'إدارة المنح',
        where: 'نموذج التسجيل · والتصنيف يحدد المستندات الإلزامية',
        count: ENTITY_TYPES.length,
      },
      {
        key: 'licensors', tab: 'licensors', label: 'جهات الإشراف الفني', kind: 'master', owner: 'مسؤول النظام',
        where: 'نموذج التسجيل · وملف الجهة',
        count: LICENSORS.length,
      },
      {
        key: 'targets', tab: 'targets', label: 'الفئات المستهدفة', kind: 'master', owner: 'إدارة المنح',
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
        key: 'approval', tab: 'approval', label: 'مصفوفة الاعتماد', kind: 'rule', owner: 'إدارة المنح',
        where: 'اعتماد المشروع · واعتماد طلب الصرف',
        count: APPROVAL_MATRIX.length,
      },
      {
        key: 'path', tab: 'path', label: 'مسار الاعتماد', kind: 'rule', owner: 'إدارة المنح',
        where: 'قرار مدير المنح والمدير التنفيذي · جلسات اللجنة والمجلس · حدود الجهة',
        count: 8,
      },
      {
        key: 'limits', tab: 'limits', label: 'الحدود المالية والزمنية', kind: 'rule', owner: 'الإدارة المالية',
        where: 'إنشاء طلب الصرف · جدول الدفعات · التصعيد',
        count: MONEY_LIMITS.length,
      },
      {
        key: 'stages', tab: 'stages', label: 'مدد مراحل الاتفاقية والصرف', kind: 'rule', owner: 'إدارة المنح',
        where: 'ألوان «متأخر» · والتصعيد · وقوائم «اليوم»',
        count: AGREEMENT_STAGES.length + PAY_STATES.length,
      },
    ],
  },
  /* Plans and closing had their own settings pages but no line here, so the inventory missed
     them. */
  {
    key: 'plans',
    label: 'الخطط',
    to: '/plans/settings',
    groups: [
      {
        key: 'evidence', tab: 'evidence', label: 'أنواع الشواهد', kind: 'master', owner: 'إدارة المنح',
        where: 'خطة المشروع · وكل نشاط يُرفع له شاهد من هذه الأنواع',
        count: EVIDENCE_KINDS.length,
      },
      {
        key: 'plan-limits', tab: 'limits', label: 'حدود المراحل', kind: 'rule', owner: 'إدارة المنح',
        where: 'مراجعة الخطة · والتأخر يُحسب منها',
        count: PLAN_STAGES.length,
      },
    ],
  },
  {
    key: 'closing',
    label: 'الإغلاق',
    to: '/closings/settings',
    groups: [
      {
        key: 'close-docs', tab: 'docs', label: 'المستندات الداعمة', kind: 'master', owner: 'إدارة المنح',
        where: 'التقرير الختامي · وما يُطلب من الجهة عند الإغلاق',
        count: CLOSE_DOCS.length,
      },
      {
        key: 'close-limits', tab: 'limits', label: 'حدود المحطات', kind: 'rule', owner: 'إدارة المنح',
        where: 'دورة التقرير الختامي ودورة التقييم',
        count: CLOSE_STAGES.length,
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
