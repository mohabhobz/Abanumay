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
  /** قواعد عمل المشاريع والصرف · مصفوفة الاعتماد والحدود · د-2 */
  projectSettings: '/projects/settings',
  project: (id: string) => `/projects/${id}`,
  projectTab: (id: string, tab: string) => `/projects/${id}/${tab}`,

  /**
   * جرد الإعدادات · د-1
   *
   * ⚠️ **مش مدخل في الريل عن قصد.** الريل سبع عناصر ومقصود إنه
   * سبعة، واللي بيفتح الشاشة دي مسؤول نظام بيظبّط مرة في السنة ·
   * فمدخلها من قايمة الحساب، ومن ترويسة كل موديول لصفحته وحده.
   */
  settings: '/settings',

  entities: '/entities',
  entity: (id: string, tab?: string) => `/entities/${id}${tab && tab !== 'data' ? `/${tab}` : ''}`,
  /** تسجيل جهة جديدة · BPD-002 · واللي بيتعمل **طلب** لا جهة (قاعدة 2) */
  entityRegister: '/entities/register',
  /** تسجيل جهة من داخل النظام · قاعدة 32 · وبتتولد فورًا بلا مراجعة */
  entityNew: '/entities/new',
  /** ماستر داتا الجهات · المناطق والمدن والتصنيفات · د-3 */
  entitySettings: '/entities/settings',
  /** صندوق طلبات التسجيل · خمس حالات · قاعدة 26 */
  entityRequests: '/entities/requests',
  entityRequest: (id: string) => `/entities/requests/${id}`,

  budget: '/budget',
  budgetYear: (year: string | number) => `/budget/${year}`,
  /** إعدادات الميزانية · السنوات المالية ومصادر التمويل (ماستر داتا) */
  budgetSettings: '/budget/settings',
  /** إنشاء ميزانية · ترويسة + شجرة بنود */
  budgetNew: '/budget/new',
  /** ميزانية قائمة */
  budgetDoc: (id: string) => `/budget/doc/${id}`,

  agreements: '/agreements',
  agreement: (id: string) => `/agreements/${id}`,

  payments: '/payments',
  payment: (id: string) => `/payments/${id}`,
  /** إنشاء طلب صرف · خطوات 1 و2 · والمشروع اختياري في الرابط */
  paymentNew: (projectId?: string) =>
    `/payments/new${projectId ? `?project=${projectId}` : ''}`,
  /** إعادة إرسال طلب معاد · خطوة 11 */
  paymentEdit: (id: string) => `/payments/${id}/edit`,
  /** أمر الصرف · خطوة 16 · المخرج الأول */
  paymentOrder: (id: string) => `/payments/${id}/order`,
  /** تقرير المتأخر والمتعثر · آلية التصعيد 9.5 بند 3 */
  paymentsLate: '/payments/late',

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
 * سبعة عناصر.
 *
 * النظام العامل فيه 46 شاشة وقائمة جانبية بعشرات المداخل. الاختصار
 * هنا مش تبسيط شكلي: المراسلات والمتابعات مش موديولات مستقلة في ذهن
 * المستخدم · هي حاجات بتحصل **جوّه مشروع**، فمكانها تبويب في صفحة
 * المشروع لا مدخل في الريل. اللي في الريل هو اللي المستخدم بيبدأ
 * منه يومه فعلًا.
 *
 * ⚠️ **والاتفاقيات كانت في القايمة دي، واتشالت منها لما الوثيقة
 * وصلت.** التعليق ده كان بيقول إنها «بتحصل جوّه مشروع»، وده كان
 * صحيحًا وإحنا شايفين تابًا في صفحة المشروع بس. لكن BPD-008 قاعدة
 * 23 بتقول إن **الاتفاقية إجراء مستقل بسجلّه واعتماداته
 * وإصداراته**، وقاعدة 25 بتقول إن انتقالها بين مراحلها ما بيغيّرش
 * حالة المشروع · يعني اتفاقية عند المدير التنفيذي ومشروعها مكتوب
 * عليه «إعداد الاتفاقية».
 *
 * والأثر العملي إن المشرف اللي عنده تسع اتفاقيات في أربع مراحل ما
 * يقدرش يتابعهم من صفحات المشاريع واحدة واحدة · فالموديول اتبنى،
 * والمدخل رجع. وسيبنا التاب في صفحة المشروع مكانه: هو بيجاوب «إيه
 * اتفاقية المشروع ده»، والصندوق بيجاوب «إيه اللي واقف عندي».
 */
export const NAV: NavItem[] = [
  { key: 'home', label: 'اليوم', to: ROUTES.home, icon: 'insight', group: 'work', mob: true },
  { key: 'projects', label: 'المشاريع', to: ROUTES.projects, icon: 'doc', group: 'work', mob: true, perm: 'projects.read' },
  { key: 'entities', label: 'الجهات', to: ROUTES.entities, icon: 'entity', group: 'work', mob: true, perm: 'entities.read' },
  { key: 'budget', label: 'الميزانية', to: ROUTES.budget, icon: 'budget', group: 'money', perm: 'budget.read' },
  /* الاتفاقية قبل الصرف في السلسلة · قاعدة 1 في إجراء الصرف بتمنع
     أي طلب قبل تفعيلها، فترتيبها في الريل بيتبع ترتيب الشغل */
  { key: 'agreements', label: 'الاتفاقيات', to: ROUTES.agreements, icon: 'contract', group: 'money', perm: 'agreements.read' },
  { key: 'payments', label: 'الصرف', to: ROUTES.payments, icon: 'pay', group: 'money', mob: true, perm: 'payments.read' },
  { key: 'reports', label: 'التقارير', to: ROUTES.reports, icon: 'chart', group: 'knowledge', mob: true, perm: 'reports.read' },
]
