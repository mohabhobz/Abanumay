/**
 * خريطة المسارات · المصدر الوحيد لأي URL في التطبيق.
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
  entity: (id: string, tab?: string) => `/entities/${id}${tab && tab !== 'data' ? `/${tab}` : ''}`,

  budget: '/budget',
  budgetYear: (year: string | number) => `/budget/${year}`,

  agreements: '/agreements',
  agreement: (id: string) => `/agreements/${id}`,

  payments: '/payments',
  payment: (id: string) => `/payments/${id}`,

  reports: '/reports',
  reportTab: (tab?: string) => `/reports${tab && tab !== 'board' ? `/${tab}` : ''}`,
  /** تقرير كامل على جدولنا */
  reportView: (key: string) => `/reports/view/${key}`,
  /** ورقة مؤشرات إجراء · جوّه حالة القياس */
  report: (key: string) => `/reports/process/${key}`,
  /** شاشة من كتالوج النظام العامل */
  liveReport: (key: string) => `/reports/screen/${key}`,

  assistant: '/assistant',
  assistantThread: (id: string) => `/assistant/${id}`,

  account: '/account',
  preferences: '/account/preferences',
} as const

/**
 * الشاشة اللي المستخدم بيقع عليها بعد الدخول.
 *
 * المساعد لا «اليوم»: المستخدم بيفتح النظام وفي دماغه سؤال، مش
 * رغبة في تصفّح لوحة. المساعد بيستقبل السؤال، ولوحة اليوم بتفضل
 * مدخل من الريل لمّا يكون عايز يقرا الصورة كاملة.
 */
export const AFTER_LOGIN: string = ROUTES.assistant

/** تبويبات صفحة المشروع · الـslug في الـURL والاسم المعروض */
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

/**
 * تبويبات صفحة الجهة · نفس منطق تبويبات المشروع.
 *
 * ملف الجهة في النظام العامل **٣٥ حقلًا** موزّعة على خمس مجموعات،
 * ومعاها الحسابات البنكية وسجل القرارات. عرضها في عمود واحد بيخلّي
 * الصفحة تمرير طويل، والقارئ بيدوّر على الحقل بدل ما يقراه. */
export const ENTITY_TABS = [
  { slug: 'data', label: 'بيانات الجهة' },
  { slug: 'docs', label: 'المستندات' },
  { slug: 'banks', label: 'الحسابات البنكية' },
  { slug: 'projects', label: 'مشاريعها' },
  { slug: 'log', label: 'سجل الجهة' },
] as const

export type EntityTabSlug = (typeof ENTITY_TABS)[number]['slug']

export const DEFAULT_ENTITY_TAB: EntityTabSlug = 'data'

/**
 * تبويبات التقارير.
 *
 * النظام العامل فيه ١٤ شاشة تقرير، كل واحدة فورم فلترة لازم تملاه
 * قبل ما تشوف رقم. التقسيم هنا بيقلب الترتيب: **اللوحة** بتفتح على
 * الإجابات جاهزة، و**المُشكَّل** للسؤال اللي مش في اللوحة، و**حالة
 * القياس** آخر حاجة لأنها بتتكلم عننا لا عن المنح.
 */
export const REPORT_TABS = [
  { slug: 'board', label: 'اللوحة' },
  { slug: 'build', label: 'تقرير مُشكَّل' },
  { slug: 'catalog', label: 'كل التقارير' },
  { slug: 'coverage', label: 'حالة القياس' },
] as const

export type ReportTabSlug = (typeof REPORT_TABS)[number]['slug']

export const DEFAULT_REPORT_TAB: ReportTabSlug = 'board'

export const DEFAULT_PROJECT_TAB: ProjectTabSlug = 'data'

export const tabLabel = (slug: string): string =>
  PROJECT_TABS.find((t) => t.slug === slug)?.label ?? ''

export const tabSlug = (label: string): ProjectTabSlug =>
  PROJECT_TABS.find((t) => t.label === label)?.slug ?? DEFAULT_PROJECT_TAB

/**
 * عناصر التنقّل · مبنية على موديولات النظام الفعلية.
 * `mob` يعني يظهر في شريط الموبايل السفلي (مساحته 5 عناصر).
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

/**
 * ستة عناصر فقط.
 *
 * النظام العامل فيه 46 شاشة وقائمة جانبية بعشرات المداخل. الاختصار
 * هنا مش تبسيط شكلي: الاتفاقيات والمراسلات والمتابعات مش موديولات
 * مستقلة في ذهن المستخدم · هي حاجات بتحصل **جوّه مشروع**، فمكانها
 * تبويب في صفحة المشروع لا مدخل في الريل. اللي فضل في الريل هو
 * اللي المستخدم بيبدأ منه يومه فعلًا.
 */
export const NAV: NavItem[] = [
  { key: 'home', label: 'اليوم', to: ROUTES.home, icon: 'insight', group: 'work', mob: true },
  { key: 'projects', label: 'المشاريع', to: ROUTES.projects, icon: 'doc', group: 'work', mob: true, perm: 'projects.read' },
  { key: 'entities', label: 'الجهات', to: ROUTES.entities, icon: 'entity', group: 'work', mob: true, perm: 'entities.read' },
  { key: 'budget', label: 'الميزانية', to: ROUTES.budget, icon: 'budget', group: 'money', perm: 'budget.read' },
  { key: 'payments', label: 'الصرف', to: ROUTES.payments, icon: 'pay', group: 'money', mob: true, perm: 'payments.read' },
  { key: 'reports', label: 'التقارير', to: ROUTES.reports, icon: 'chart', group: 'knowledge', mob: true, perm: 'reports.read' },
]
