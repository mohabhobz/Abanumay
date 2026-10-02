/**
 * Permissions · who can do what, in which module.
 *
 * Two layers, the way the live system already works and the way admins think about it:
 *   1. The **role** carries the defaults. Changing a role changes everyone who holds it.
 *   2. The **user** may differ from their role on single cells (an override). Overrides are
 *      counted and marked, so an account that drifted from its role is visible at a glance and can
 *      be returned to it in one step.
 *
 * Actions are the same five verbs on every module, but not every verb applies everywhere: «اليوم»
 * is read-only, reports are read and export. A cell that doesn't apply is drawn as a dash, not as a
 * disabled checkbox, so the matrix reads as "can't exist" rather than "turned off".
 *
 * Records-based modules also carry a **scope**: a supervisor sees their own projects, a manager
 * their team's, the executive director all of them. Scope belongs to the role only.
 */

export type ActionKey = 'view' | 'create' | 'edit' | 'approve' | 'export'
export type Scope = 'own' | 'team' | 'all'

export const ACTIONS: { key: ActionKey; label: string; note: string }[] = [
  { key: 'view', label: 'عرض', note: 'يفتح الموديول ويقرأ سجلاته' },
  { key: 'create', label: 'إنشاء', note: 'يضيف سجلًا جديدًا' },
  { key: 'edit', label: 'تعديل', note: 'يغيّر سجلًا قائمًا' },
  { key: 'approve', label: 'اعتماد', note: 'يتخذ القرار في مرحلته' },
  { key: 'export', label: 'تصدير', note: 'ينزّل الملفات والجداول' },
]

export const SCOPES: { value: Scope; label: string }[] = [
  { value: 'own', label: 'ما يملكه' },
  { value: 'team', label: 'فريقه' },
  { value: 'all', label: 'الكل' },
]

export interface PermModule {
  key: string
  label: string
  /** What the module covers · one line under its name */
  note: string
  actions: ActionKey[]
  /** Records-based · the role decides how far the user sees */
  scoped?: boolean
  /** Changes the system for everyone · flagged in the matrix */
  admin?: boolean
}

/** Every module in the system, in the rail's order, then the system modules */
export const PERM_MODULES: PermModule[] = [
  { key: 'today', label: 'اليوم', note: 'قائمة العمل والقراءات', actions: ['view'] },
  { key: 'projects', label: 'المشاريع', note: 'الطلبات والدراسة والقرار', actions: ['view', 'create', 'edit', 'approve', 'export'], scoped: true },
  { key: 'entities', label: 'الجهات', note: 'التسجيل والملفات والتراخيص', actions: ['view', 'create', 'edit', 'approve', 'export'], scoped: true },
  { key: 'budget', label: 'الميزانية', note: 'البنود والسنوات ومصادر التمويل', actions: ['view', 'create', 'edit', 'approve', 'export'] },
  { key: 'agreements', label: 'الاتفاقيات', note: 'الصياغة والتوقيع والدفعات', actions: ['view', 'create', 'edit', 'approve', 'export'], scoped: true },
  { key: 'plans', label: 'الخطط', note: 'الخطط التنفيذية والشواهد', actions: ['view', 'create', 'edit', 'approve', 'export'], scoped: true },
  { key: 'payments', label: 'الصرف', note: 'طلبات الصرف وأوامره', actions: ['view', 'create', 'edit', 'approve', 'export'], scoped: true },
  { key: 'closings', label: 'الإغلاق', note: 'التقرير الختامي والتقييم', actions: ['view', 'create', 'edit', 'approve', 'export'], scoped: true },
  { key: 'reports', label: 'التقارير', note: 'تقارير الإجراءات والشاشات', actions: ['view', 'export'] },
  { key: 'assistant', label: 'المساعد', note: 'الأسئلة على بيانات النظام', actions: ['view'] },
  { key: 'settings', label: 'إعدادات النظام', note: 'القوائم والحدود والمدد', actions: ['view', 'edit'], admin: true },
  { key: 'permissions', label: 'الصلاحيات', note: 'الأدوار والمستخدمون', actions: ['view', 'edit'], admin: true },
]

export const moduleByKey = (k: string) => PERM_MODULES.find((m) => m.key === k)

/** One module's grant · the action set and, for scoped modules, how far it reaches */
export type Grant = { acts: ActionKey[]; scope?: Scope }
export type Grants = Record<string, Grant>

export interface PermRole {
  key: string
  label: string
  note: string
  /** Works from the entity portal, not the internal system */
  external?: boolean
  grants: Grants
}

/* Compact writing for the defaults: letters per module, scope after a colon.
   v view · c create · e edit · a approve · x export */
const L: Record<string, ActionKey> = { v: 'view', c: 'create', e: 'edit', a: 'approve', x: 'export' }
const g = (spec: Record<string, string>): Grants =>
  Object.fromEntries(
    Object.entries(spec).map(([k, s]) => {
      const [letters, scope] = s.split(':')
      return [k, { acts: [...letters].map((c) => L[c]).filter(Boolean), scope: scope as Scope | undefined }]
    }),
  )

export const PERM_ROLES: PermRole[] = [
  {
    key: 'supervisor', label: 'مشرف المنح', note: 'يدرس مشاريعه ويوصي فيها',
    grants: g({
      today: 'v', projects: 'vcex:own', entities: 'vce:own', budget: 'v', agreements: 'vce:own',
      plans: 'vcex:own', payments: 'vc:own', closings: 'vce:own', reports: 'vx', assistant: 'v',
    }),
  },
  {
    key: 'grants-manager', label: 'مدير المنح', note: 'يوزّع العمل ويعتمد حتى حدّه المالي',
    grants: g({
      today: 'v', projects: 'vceax:team', entities: 'vceax:all', budget: 'vx', agreements: 'veax:team',
      plans: 'vceax:team', payments: 'vax:team', closings: 'vceax:team', reports: 'vx', assistant: 'v',
      settings: 'v',
    }),
  },
  {
    key: 'ceo', label: 'المدير التنفيذي', note: 'يعتمد ما فوق حدّ مدير المنح',
    grants: g({
      today: 'v', projects: 'vax:all', entities: 'vx:all', budget: 'vax', agreements: 'vax:all',
      plans: 'vx:all', payments: 'vax:all', closings: 'vax:all', reports: 'vx', assistant: 'v',
      settings: 'v',
    }),
  },
  {
    key: 'board', label: 'اللجنة التنفيذية ومجلس الأمناء', note: 'قرار جماعي على ما يُرفع إليها',
    grants: g({ today: 'v', projects: 'va:all', budget: 'va', reports: 'v' }),
  },
  {
    key: 'finance', label: 'الإدارة المالية', note: 'تنفّذ الصرف وتطابقه مع الميزانية',
    grants: g({
      today: 'v', projects: 'v:all', budget: 'vcex', agreements: 'v:all', payments: 'veax:all',
      reports: 'vx', assistant: 'v',
    }),
  },
  {
    key: 'comms', label: 'الاتصال المؤسسي', note: 'يقرأ الأثر وينشر قصص النجاح',
    grants: g({ today: 'v', projects: 'v:all', entities: 'v:all', closings: 'vx:all', reports: 'vx' }),
  },
  {
    key: 'consultant', label: 'المستشار الخارجي', note: 'يدرس ما يُسند إليه فقط', external: true,
    grants: g({ projects: 've:own', entities: 'v:own', plans: 'v:own' }),
  },
  {
    key: 'entity', label: 'الجهة المستفيدة', note: 'تقدّم وتتابع طلباتها من البوابة', external: true,
    grants: g({ projects: 'vce:own', agreements: 'v:own', plans: 'vce:own', payments: 'vc:own', closings: 'vce:own' }),
  },
  {
    key: 'admin', label: 'مدير النظام', note: 'يدير المستخدمين والأدوار والإعدادات',
    grants: g({ today: 'v', reports: 'vx', settings: 've', permissions: 've' }),
  },
]

export const roleLabel = (k: string) => PERM_ROLES.find((r) => r.key === k)?.label ?? k

/** A user's cell that differs from their role · `true` granted, `false` withheld */
export type Overrides = Record<string, Partial<Record<ActionKey, boolean>>>

export interface PermUser {
  id: string
  name: string
  role: string
  active: boolean
  /** Last sign-in · display text in the mock */
  seen: string
  overrides: Overrides
}

export const PERM_USERS: PermUser[] = [
  { id: 'u01', name: 'نورة القحطاني', role: 'admin', active: true, seen: 'الآن', overrides: {} },
  { id: 'u02', name: 'عمر قاسم', role: 'supervisor', active: true, seen: 'قبل 10 دقائق', overrides: {} },
  { id: 'u03', name: 'سعود البريكان', role: 'supervisor', active: true, seen: 'اليوم', overrides: { payments: { export: true } } },
  { id: 'u04', name: 'عزام الخريف', role: 'supervisor', active: true, seen: 'أمس', overrides: {} },
  { id: 'u05', name: 'أحمد العبداللطيف', role: 'supervisor', active: false, seen: 'قبل 3 أسابيع', overrides: {} },
  { id: 'u06', name: 'حصة النملة', role: 'supervisor', active: true, seen: 'اليوم', overrides: { budget: { export: true } } },
  { id: 'u07', name: 'عبدالله الدوسري', role: 'grants-manager', active: true, seen: 'اليوم', overrides: {} },
  { id: 'u08', name: 'عبدالرحمن الهليّل', role: 'ceo', active: true, seen: 'أمس', overrides: {} },
  { id: 'u09', name: 'تركي الخنيزان', role: 'board', active: true, seen: 'قبل أسبوع', overrides: {} },
  { id: 'u10', name: 'محمد المطيري', role: 'finance', active: true, seen: 'اليوم', overrides: { payments: { create: true } } },
  { id: 'u11', name: 'سلطان العتيبي', role: 'finance', active: true, seen: 'أمس', overrides: {} },
  { id: 'u12', name: 'خالد السبيعي', role: 'comms', active: true, seen: 'قبل 4 أيام', overrides: {} },
  { id: 'u13', name: 'د. سامي الفايز', role: 'consultant', active: true, seen: 'قبل يومين', overrides: {} },
]

export interface PermLogRow {
  id: string
  at: string
  by: string
  target: string
  change: string
}

export const PERM_LOG: PermLogRow[] = [
  { id: 'l3', at: '2026-09-28', by: 'نورة القحطاني', target: 'محمد المطيري', change: 'منح «إنشاء» في الصرف خارج دوره' },
  { id: 'l2', at: '2026-09-21', by: 'نورة القحطاني', target: 'أحمد العبداللطيف', change: 'إيقاف الحساب · إجازة طويلة' },
  { id: 'l1', at: '2026-09-14', by: 'نورة القحطاني', target: 'دور مشرف المنح', change: 'إضافة «تصدير» في الخطط' },
]

/* ── Stored state · the admin's edits, read back by «صلاحياتي» in account settings ── */

export interface PermState {
  roles: PermRole[]
  users: PermUser[]
  log: PermLogRow[]
}

export const PERM_KEY = 'ab-perm'
export const PERM_INITIAL: PermState = { roles: PERM_ROLES, users: PERM_USERS, log: PERM_LOG }

/* ── Derivations ── */

/** Effective grant of one cell · the override wins, otherwise the role */
export const effective = (role: PermRole | undefined, ov: Overrides, mod: string, act: ActionKey): boolean => {
  const o = ov[mod]?.[act]
  if (o !== undefined) return o
  return Boolean(role?.grants[mod]?.acts.includes(act))
}

/** Modules the user can open at all */
export const moduleCount = (role: PermRole | undefined, ov: Overrides) =>
  PERM_MODULES.filter((m) => effective(role, ov, m.key, 'view')).length

export const overrideCount = (ov: Overrides) =>
  Object.values(ov).reduce((n, m) => n + Object.keys(m ?? {}).length, 0)

/**
 * Separation of duties · one person shouldn't both raise a request and approve it in the same
 * module. These are warnings, not blocks: a small team sometimes needs it, but the admin should see
 * it was a choice.
 */
export const SOD_PAIRS: { mod: string; a: ActionKey; b: ActionKey }[] = [
  { mod: 'payments', a: 'create', b: 'approve' },
  { mod: 'budget', a: 'edit', b: 'approve' },
  { mod: 'agreements', a: 'create', b: 'approve' },
]

export const conflicts = (role: PermRole | undefined, ov: Overrides) =>
  SOD_PAIRS.filter((p) => effective(role, ov, p.mod, p.a) && effective(role, ov, p.mod, p.b))
