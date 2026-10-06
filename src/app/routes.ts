/**
 * Route map — the single source for every URL in the app.
 * Never hardcode a path as a string in a component. Any new screen is added here first, and every
 * module follows the same list-route / detail-route pattern, so mapping to the backend is a direct
 * match: `/projects/:id` maps to `GET /api/projects/:id`.
 */

export const ROUTES = {
  login: '/login',
  /** Password reset · public, self-service (2.3.pw) */
  forgot: '/forgot',
  home: '/',
  /** The combined dashboard that was the home page until 3 Oct 2026 · now its own category in
      Reports (meeting 1 Oct, E-9); the old `/overview` address redirects here. */
  overview: '/reports/overview',
  /** The happy path · one record of each procedure, end to end (meeting 1 Oct, A-7) · own branch */
  journey: '/journey',
  /** The glass infographic board · a trial for every role (client, 6 Oct) · reached from Reports */
  glassBoard: '/insights',
  /** The consultant's screen on one referred project (3.2.20) */
  advice: (projectId: string) => `/advice/${projectId}`,

  projects: '/projects',
  /** Project and disbursement business rules — approval matrix and limits. */
  projectSettings: '/projects/settings',
  /** Create project — a staged form with a completion percentage. */
  projectNew: '/projects/new',
  /**
   * Implementing partner portfolio.
   * ⚠️ **A portfolio isn't a project, so it has no row in `/projects`.** It's a parent entity with
   * projects under it, and its route is kept separate so it doesn't collide with project ids.
   */
  portfolio: (id: string) => `/projects/portfolio/${id}`,
  project: (id: string) => `/projects/${id}`,
  projectTab: (id: string, tab: string) => `/projects/${id}/${tab}`,

  /**
   * Settings inventory.
   * ⚠️ **Intentionally not on the rail.** The rail holds a fixed set of items by design, and
   * whoever opens this screen is a system admin adjusting it once a year — so it's entered from the
   * account menu, and from each module's own header linking to its own page.
   */
  settings: '/settings',
  /** Roles and users × every module · the system admin's screen, opened from the account menu. */
  permissions: '/settings/permissions',

  entities: '/entities',
  entity: (id: string, tab?: string) => `/entities/${id}${tab && tab !== 'data' ? `/${tab}` : ''}`,
  /** Register a new entity — this creates a **request**, not an entity. */
  entityRegister: '/entities/register',
  /**
   * Create entity account — **a screen in its own right, styled like login**.
   * ⚠️ **The account isn't a step in the form, it's the door that leads to it.** It used to be a
   * step inside the stepper, so the entity would open registration and see a "missing" badge over
   * something it hadn't reached yet — and this account is what the request is saved against and
   * returned to, so it behaves more like login than like request data.
   * So the order becomes: terms, then **account**, then form. The step stays marked "done" in the
   * stepper because the entity has, in fact, passed it.
   */
  entityRegisterAccount: '/entities/register/account',
  /** Register an entity from inside the system — created immediately, with no review. */
  entityNew: '/entities/new',
  /** Entity master data — regions, cities, and classifications. */
  entitySettings: '/entities/settings',
  /**
   * Entity gate.
   * ⚠️ **This is the entity's own screen for its request, not an internal screen.** It opens with
   * an account created at registration and shows a single request and its status — the entity's
   * full account is only created after approval.
   */
  entityPortal: '/entities/portal',
  /** The entity's update request for its own file · public, opened from its portal (2.3.upd) */
  entityUpdate: '/entities/portal/update',
  /** Update requests inbox and review · internal */
  entityUpdates: '/entities/updates',
  entityUpdateReview: (id: string) => `/entities/updates/${id}`,
  /** Archived entities · the system administrator's own search (2.4.29) */
  entityArchive: '/entities/archive',
  /** Registration request queue — five states. */
  entityRequests: '/entities/requests',
  entityRequest: (id: string) => `/entities/requests/${id}`,

  budget: '/budget',
  budgetYear: (year: string | number) => `/budget/${year}`,
  /** Budget settings — fiscal years and funding sources (master data). */
  budgetSettings: '/budget/settings',
  /** Create budget — header plus line-item tree. */
  budgetNew: '/budget/new',
  /** Budget list. */
  budgetDoc: (id: string) => `/budget/doc/${id}`,
  /** Budget operation requests · transfer, increase, decrease (1.3) */
  budgetOps: '/budget/ops',
  budgetOpNew: '/budget/ops/new',
  budgetOp: (id: string) => `/budget/ops/${id}`,
  /** Consolidated report across budgets (1.4.6) */
  budgetReport: '/budget/report',

  /** Executive committee and board · referred projects, sessions, votes, minutes (BPD-006 · BPD-007) */
  committee: '/approvals/committee',
  board: '/approvals/board',
  approvalSession: (id: string) => `/approvals/sessions/${id}`,

  agreements: '/agreements',
  agreement: (id: string) => `/agreements/${id}`,
  /**
   * Set up an agreement.
   * ⚠️ The project is in the URL because the agreement is created **for a project**, not from the
   * queue — so the natural entry point is the "Agreement" tab on the project page.
   */
  agreementNew: (projectId?: string) =>
    `/agreements/new${projectId ? `?project=${projectId}` : ''}`,

  /* Project implementation plan.
     ⚠️ **A module, not a tab, for the same reason as agreements.** The plan is an independent
     process with its own approval cycle (supervisor to manager), and moving it between stages
     doesn't change the project's status. A supervisor with several plans awaiting review across
     projects can't track them one project page at a time.
     The tab on the project page still has its place: it answers "what's this project's plan", while
     the queue answers "what's on my plate." */
  plans: '/plans',
  plan: (id: string) => `/plans/${id}`,
  /** Plan editor — structure is open before approval, requires a change request after. */
  planEdit: (id: string) => `/plans/${id}/edit`,
  /** Create a plan for a project — the project is in the URL, like the agreement. */
  planNew: (projectId?: string) =>
    `/plans/new${projectId ? `?project=${projectId}` : ''}`,
  /** Plan settings — evidence types and stage limits. */
  planSettings: '/plans/settings',

  /* Project closure.
     ⚠️ **A module, not a tab, for the same reason as agreement and plan** — and more strongly:
     moving the closing report between review stages **doesn't affect the project's status**, which
     stays "in progress" until the report, evaluation, and requirements are all complete together.
     So closure is **its own record with its own status**, and the tab on the project page still
     answers "where's this project's closure", while the queue answers "what's on my plate." */
  closings: '/closings',
  closing: (id: string) => `/closings/${id}`,
  /** Final report editor — written by the entity. */
  closingReport: (id: string) => `/closings/${id}/report`,
  /** Project evaluation editor — written by the supervisor after the report is approved. */
  closingEval: (id: string) => `/closings/${id}/evaluation`,
  /** Closure settings — supporting documents and stage limits. */
  closingSettings: '/closings/settings',
  /** Distress cases · a stop or a change of value (10.9) · `new` before `:id` */
  distresses: '/closings/cases',
  distress: (id: string) => `/closings/cases/${id}`,
  distressNew: (projectId: string, kind: string) => `/closings/cases/new?project=${projectId}&kind=${kind}`,

  payments: '/payments',
  payment: (id: string) => `/payments/${id}`,
  /** Create a disbursement request — steps 1 and 2; the project is optional in the URL. */
  paymentNew: (projectId?: string) =>
    `/payments/new${projectId ? `?project=${projectId}` : ''}`,
  /** Resubmit a returned request. */
  paymentEdit: (id: string) => `/payments/${id}/edit`,
  /** Disbursement order — the first output. */
  paymentOrder: (id: string) => `/payments/${id}/order`,
  /** Overdue and stalled report — escalation mechanism. */
  paymentsLate: '/payments/late',

  reports: '/reports',
  reportTab: (tab?: string) => `/reports${tab && tab !== 'board' ? `/${tab}` : ''}`,
  /** Full report on our own schedule. */
  reportView: (key: string) => `/reports/view/${key}`,
  /** Process indicator sheet — inside the measurement view. */
  report: (key: string) => `/reports/process/${key}`,
  /** A screen from the legacy system's catalog. */
  liveReport: (key: string) => `/reports/screen/${key}`,

  assistant: '/assistant',
  assistantThread: (id: string) => `/assistant/${id}`,

  account: '/account',
  preferences: '/account/preferences',
} as const

/**
 * The screen a user lands on after login.
 * The assistant, not "Today": a user opens the system with a question in mind, not a wish to browse
 * a dashboard. The assistant takes the question, and the daily dashboard stays reachable from the
 * rail for when they want the full picture.
 */
export const AFTER_LOGIN: string = ROUTES.assistant

/** Project page tabs — the slug in the URL, the display name shown. */
export const PROJECT_TABS = [
  { slug: 'data', label: 'بيانات المشروع' },
  /* Procedure 3 · the supervisor's study, its criteria, budget and the consultant */
  { slug: 'study', label: 'الدراسة' },
  /* Procedures 4–7 · the decision file on the approval path */
  { slug: 'approval', label: 'الاعتماد' },
  { slug: 'entity', label: 'الجهة' },
  { slug: 'history', label: 'المشاريع السابقة' },
  { slug: 'agreement', label: 'الاتفاقية' },
  { slug: 'plan', label: 'الخطة' },
  { slug: 'payments', label: 'الدفعات' },
  /* Closure after payments — opening it before payments are settled is blocked, so its order in the
     tabs follows the workflow order. */
  { slug: 'closing', label: 'الإغلاق' },
  { slug: 'follow-ups', label: 'المتابعات' },
  /* Manual activities sit right before the log: they are added here and read there. */
  { slug: 'activities', label: 'الفعاليات' },
  { slug: 'log', label: 'سجل المشروع' },
  { slug: 'correspondence', label: 'المراسلات' },
] as const

export type ProjectTabSlug = (typeof PROJECT_TABS)[number]['slug']

/**
 * Entity page tabs — same logic as the project tabs.
 * The legacy system's entity record has **35 fields** across five groups, plus bank accounts and a
 * decision log. Showing them in a single column makes for a long scroll, and the reader ends up
 * searching for a field instead of reading it.
 */
export const ENTITY_TABS = [
  { slug: 'data', label: 'بيانات الجهة' },
  { slug: 'docs', label: 'المستندات' },
  { slug: 'banks', label: 'الحسابات البنكية' },
  { slug: 'projects', label: 'مشاريعها' },
  /* 2.4.1 · its registration and update requests, each with its own history */
  { slug: 'requests', label: 'طلباتها' },
  { slug: 'log', label: 'سجل الجهة' },
] as const

export type EntityTabSlug = (typeof ENTITY_TABS)[number]['slug']

export const DEFAULT_ENTITY_TAB: EntityTabSlug = 'data'

/**
 * Report tabs.
 * The legacy system has 14 report screens, each a filter form to fill in before seeing a number.
 * This breakdown flips the order: **Dashboard** opens with answers ready, **Custom** is for the
 * question not on the dashboard, and **Measurement status** comes last because it's about us, not
 * about the grants.
 */
export const REPORT_TABS = [
  { slug: 'board', label: 'اللوحة' },
  /* E-9 · the combined dashboard, moved off «اليوم» into Reports as its own category */
  { slug: 'overview', label: 'اللوحة المجمّعة' },
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
 * Navigation items — built from the system's actual modules.
 * `mob` means it shows in the bottom mobile bar (four modules plus the profile, whose menu lists the
 * remaining modules).
 * `perm` is the permission key used to filter it once the backend returns the user's permissions.
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
 * Seven items.
 * The legacy system has 46 screens and a sidebar with dozens of entries. This isn't a cosmetic
 * simplification: correspondence and follow-ups aren't independent modules in the user's mind —
 * they happen **inside a project**, so they belong as a tab on the project page, not an entry on
 * the rail. What's on the rail is what the user actually starts their day from.
 * ⚠️ **Agreements used to be in this list, and were removed once the spec arrived.** The comment
 * here used to say they "happen inside a project", which was true, and only a tab on the project
 * page was shown. But the spec says an **agreement is an independent process with its own record,
 * approvals, and versions**, and that moving it between stages doesn't change the project's status
 * — so an agreement can sit with an executive while its project still shows "agreement in
 * progress".
 * In practice, a supervisor with several agreements across stages couldn't track them from the
 * project pages one at a time — so the module was built, and the rail entry came back. The tab on
 * the project page stays where it was: it answers "what's this project's agreement", while the
 * queue answers "what's on my plate."
 */
export const NAV: NavItem[] = [
  /* ⚠️ **Dashboard icon, not a star.** It used to be the star icon, which is the assistant's icon
     everywhere else in the system, so "Today" read as "another assistant." Today is numbers and
     readings, so its icon is a dashboard. */
  { key: 'home', label: 'اليوم', to: ROUTES.home, icon: 'dashboard', group: 'work', mob: true },
  { key: 'projects', label: 'المشاريع', to: ROUTES.projects, icon: 'navProjects', group: 'work', mob: true, perm: 'projects.read' },
  { key: 'entities', label: 'الجهات', to: ROUTES.entities, icon: 'entity', group: 'work', mob: true, perm: 'entities.read' },
  { key: 'budget', label: 'الميزانية', to: ROUTES.budget, icon: 'budget', group: 'money', perm: 'budget.read' },
  /* Agreement before disbursement in the sequence — the disbursement process blocks any request
     before it's active, so the rail order follows the workflow order. */
  { key: 'agreements', label: 'الاتفاقيات', to: ROUTES.agreements, icon: 'contract', group: 'money', perm: 'agreements.read' },
  /* Plan after agreement: both happen in parallel after approval, and the agreement is what unlocks
     disbursement, so it comes first in the workflow. */
  { key: 'plans', label: 'الخطط', to: ROUTES.plans, icon: 'navPlans', group: 'money', perm: 'agreements.read' },
  { key: 'payments', label: 'الصرف', to: ROUTES.payments, icon: 'pay', group: 'money', mob: true, perm: 'payments.read' },
  /* Closure last in the sequence — opening it before payments are settled is blocked, so it sits
     after disbursement in the rail, as it does in the workflow. */
  { key: 'closings', label: 'الإغلاق', to: ROUTES.closings, icon: 'navClosings', group: 'money', perm: 'agreements.read' },
  { key: 'reports', label: 'التقارير', to: ROUTES.reports, icon: 'chart', group: 'knowledge', perm: 'reports.read' },
]
