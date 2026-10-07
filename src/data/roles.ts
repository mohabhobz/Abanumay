/**
 * Roles.
 *
 * One system, but each role has a completely different question in mind:
 *
 * Grants officer: "what's on me today?"
 * Works one project at a time, with no financial threshold.
 *
 * Grants manager: "how's my team doing, and what's waiting on me?"
 * Distributes load and approves above the officer's threshold.
 *
 * Executive: "where is the portfolio heading?"
 * Doesn't open projects one by one, measures commitment and impact.
 *
 * Readings, tiers, and permissions all derive from this. The review found several dozen users and
 * over a dozen permission profiles in the live system; these three are the roles the screens were
 * designed for.
 */
import { person } from './people'
import { capOf } from './approval'
import type { CurrentUser, DecisionAction } from '@/types/domain'

export type RoleKey = 'supervisor' | 'grants-manager' | 'ceo' | 'finance' | 'comms' | 'member' | 'admin'

export interface Role {
  key: RoleKey
  name: string
  title: string
  /**
   * Two characters: first letter of the first name and first letter of the surname · all three
   * start with the same letter, so a single character wouldn't distinguish them
   */
  initial: string
  photo?: string
  /** null = recommendation only, no financial threshold */
  financialAuthority: number | null
  /** Its queue's tone: personal (my work) · supervisory (my team) · portfolio (the organization) */
  lens: 'own' | 'team' | 'portfolio'
  actions: DecisionAction[]
}

export const ROLES: Role[] = [
  {
    key: 'supervisor',
    name: 'عمر قاسم',
    title: 'مشرف المنح',
    initial: person('عمر قاسم').initial,
    photo: person('عمر قاسم').photo,
    financialAuthority: null,
    lens: 'own',
    actions: [
      { label: 'توصية بالموافقة', kind: 'btn-p' },
      { label: 'طلب استكمال', kind: 'btn-2' },
      { label: 'تحويل لمجال أو مشرف آخر', kind: 'btn-2' },
      { label: 'توصية بالرفض', kind: 'btn-d' },
    ],
  },
  {
    key: 'grants-manager',
    name: 'عبدالله الدوسري',
    title: 'مدير المنح',
    initial: person('عبدالله الدوسري').initial,
    photo: person('عبدالله الدوسري').photo,
    financialAuthority: 250_000,
    lens: 'team',
    actions: [
      { label: 'توصية بالموافقة', kind: 'btn-p' },
      { label: 'توصية بالرفض', kind: 'btn-2' },
      { label: 'إعادة للمشرف', kind: 'btn-2' },
      { label: 'رفض نهائي', kind: 'btn-d' },
    ],
  },
  {
    key: 'ceo',
    name: 'عبدالرحمن الهليّل',
    title: 'المدير التنفيذي',
    initial: person('عبدالرحمن الهليّل').initial,
    photo: person('عبدالرحمن الهليّل').photo,
    financialAuthority: 500_000,
    lens: 'portfolio',
    actions: [
      { label: 'اعتماد', kind: 'btn-p' },
      { label: 'إحالة للجنة التنفيذية', kind: 'btn-2' },
      { label: 'إعادة لمدير المنح', kind: 'btn-2' },
      { label: 'اعتذار', kind: 'btn-d' },
    ],
  },
  {
    /* Re-audit 7 Oct · finance had no seat: the executive director acted for it and the log wrote a
       fixed name. The finance officer now reviews budgets and operation requests, issues payment
       orders and transfers, confirms Ehsan payments and pays portfolio requests (1.2.10 · 9.2.15) */
    key: 'finance',
    name: 'محمد المطيري',
    title: 'الإدارة المالية',
    initial: person('محمد المطيري').initial,
    photo: person('محمد المطيري').photo,
    financialAuthority: null,
    lens: 'portfolio',
    actions: [],
  },
  {
    /* Corporate communications · reviews the final report's media requirements (10.2.12) */
    key: 'comms',
    name: 'خالد السبيعي',
    title: 'الاتصال المؤسسي',
    initial: person('خالد السبيعي').initial,
    photo: person('خالد السبيعي').photo,
    financialAuthority: null,
    lens: 'portfolio',
    actions: [],
  },
  {
    /* A member of the executive committee and the board · reads the session's files before the
       meeting and casts his own vote (6.2.3 · 7.2.3) */
    key: 'member',
    name: 'تركي الخنيزان',
    title: 'عضو اللجنة والمجلس',
    initial: person('تركي الخنيزان').initial,
    photo: person('تركي الخنيزان').photo,
    financialAuthority: null,
    lens: 'portfolio',
    actions: [],
  },
  {
    /* Cross · the escalation mechanism, the notification channels and the audit log are the system
       admin's to configure directly (9.5 clause 4) · the seat that edits them in the prototype */
    key: 'admin',
    name: 'نورة القحطاني',
    title: 'مدير النظام',
    initial: person('نورة القحطاني').initial,
    photo: person('نورة القحطاني').photo,
    financialAuthority: null,
    lens: 'portfolio',
    actions: [],
  },
]

/** The roles a business rule can name · the system admin configures, she doesn't decide */
export const STAFF_ROLES: Role[] = ROLES.filter((r) => r.key !== 'admin' && r.key !== 'member')

export const roleByKey = (key: string): Role => ROLES.find((r) => r.key === key) ?? ROLES[0]

/** Converts the role into the shape the UI consumes */
/* The financial authority comes from the approval matrix in settings (one source), not from the
   numbers written on the roles above, which stay as the defaults only. */
const AUTHORITY: Partial<Record<RoleKey, 'manager' | 'exec'>> = { 'grants-manager': 'manager', ceo: 'exec' }
const authorityOf = (role: Role): number | null => {
  const k = AUTHORITY[role.key]
  if (!k) return role.financialAuthority
  const cap = capOf(k)
  return Number.isFinite(cap) ? cap : null
}

export const asUser = (role: Role): CurrentUser => ({
  name: role.name,
  role: role.title,
  initial: role.initial,
  photo: role.photo,
  financialAuthority: authorityOf(role),
  actions: role.actions,
})

/* Current role.
   In this mock it's switched from the account menu so the difference between roles can actually be
   tested. Once there's a backend, it comes from the token and the switcher disappears. */

const KEY = 'ab-role'

export function readRole(): RoleKey {
  try {
    const saved = localStorage.getItem(KEY)
    return ROLES.some((r) => r.key === saved) ? (saved as RoleKey) : 'supervisor'
  } catch {
    return 'supervisor'
  }
}

export function writeRole(key: RoleKey): void {
  try {
    localStorage.setItem(KEY, key)
  } catch {
    /* Storage may be blocked */
  }
}

/* Staff sign-in · re-audit 7 Oct: any unknown username used to enter as staff. A username is the
   person's first name in Latin letters, their full slug or their Arabic name, and it opens their own
   seat. In production the directory answers this. */
export function staffLogin(username: string): RoleKey | null {
  const u = username.trim().toLowerCase()
  if (!u) return null
  for (const r of ROLES) {
    const slug = person(r.name).slug ?? ''
    if ([slug, slug.split('-')[0], r.name.toLowerCase(), r.key].includes(u)) return r.key
  }
  return null
}
