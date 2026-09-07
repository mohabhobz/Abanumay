/**
 * خريطة المسارات — المصدر الوحيد لأي URL في التطبيق.
 *
 * ممنوع كتابة مسار كنص في أي كومبوننت. أي شاشة جديدة بتتضاف هنا الأول،
 * وكل موديول له مسار قائمة ومسار تفصيل بنفس النمط، فالربط بالباك اند
 * بيبقى تطابق مباشر: `/projects/:id` ← `GET /api/projects/:id`.
 */

export const ROUTES = {
  login: '/login',
  home: '/',

  projects: '/projects',
  project: (id: string) => `/projects/${id}`,
  projectTab: (id: string, tab: string) => `/projects/${id}/${tab}`,

  entities: '/entities',
  entity: (id: string) => `/entities/${id}`,

  budget: '/budget',
  budgetYear: (year: string | number) => `/budget/${year}`,

  agreements: '/agreements',
  agreement: (id: string) => `/agreements/${id}`,

  payments: '/payments',
  payment: (id: string) => `/payments/${id}`,

  reports: '/reports',
  report: (key: string) => `/reports/${key}`,

  assistant: '/assistant',
  assistantThread: (id: string) => `/assistant/${id}`,

  account: '/account',
  preferences: '/account/preferences',
} as const

/** تبويبات صفحة المشروع — الـslug في الـURL والاسم المعروض */
export const PROJECT_TABS = [
  { slug: 'data', label: 'بيانات المشروع' },
  { slug: 'entity', label: 'الجهة' },
  { slug: 'history', label: 'المشاريع السابقة' },
  { slug: 'agreement', label: 'الاتفاقية' },
  { slug: 'payments', label: 'الدفعات' },
  { slug: 'follow-ups', label: 'المتابعات' },
  { slug: 'log', label: 'سجل المشروع' },
  { slug: 'correspondence', label: 'المراسلات' },
] as const

export type ProjectTabSlug = (typeof PROJECT_TABS)[number]['slug']

export const DEFAULT_PROJECT_TAB: ProjectTabSlug = 'data'

export const tabLabel = (slug: string): string =>
  PROJECT_TABS.find((t) => t.slug === slug)?.label ?? ''

export const tabSlug = (label: string): ProjectTabSlug =>
  PROJECT_TABS.find((t) => t.label === label)?.slug ?? DEFAULT_PROJECT_TAB

/**
 * عناصر التنقّل — مبنية على موديولات النظام الفعلية.
 * `mob` يعني يظهر في شريط الموبايل السفلي (مساحته ٥ عناصر).
 * `perm` هو مفتاح الصلاحية اللي هيتفلتر بيه لما الباك اند يرجّع صلاحيات المستخدم.
 */
export interface NavItem {
  key: string
  label: string
  to: string
  icon: string
  group: 'work' | 'money' | 'knowledge'
  mob?: boolean
  perm?: string
}

export const NAV: NavItem[] = [
  { key: 'home', label: 'الرئيسية', to: ROUTES.home, icon: 'home', group: 'work', mob: true },
  { key: 'projects', label: 'المشاريع', to: ROUTES.projects, icon: 'doc', group: 'work', mob: true, perm: 'projects.read' },
  { key: 'entities', label: 'الجهات', to: ROUTES.entities, icon: 'entity', group: 'work', mob: true, perm: 'entities.read' },
  { key: 'budget', label: 'الميزانية', to: ROUTES.budget, icon: 'budget', group: 'money', perm: 'budget.read' },
  { key: 'agreements', label: 'الاتفاقيات', to: ROUTES.agreements, icon: 'contract', group: 'money', perm: 'agreements.read' },
  { key: 'payments', label: 'الصرف', to: ROUTES.payments, icon: 'pay', group: 'money', perm: 'payments.read' },
  { key: 'reports', label: 'التقارير', to: ROUTES.reports, icon: 'chart', group: 'knowledge', mob: true, perm: 'reports.read' },
]
