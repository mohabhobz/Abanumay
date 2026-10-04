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

export type RoleKey = 'supervisor' | 'grants-manager' | 'ceo'

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
      { label: 'اعتماد', kind: 'btn-p' },
      { label: 'رفع للجنة التنفيذية', kind: 'btn-2' },
      { label: 'إعادة للمشرف', kind: 'btn-2' },
      { label: 'اعتذار', kind: 'btn-d' },
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
      { label: 'رفع لمجلس الأمناء', kind: 'btn-2' },
      { label: 'إعادة لمدير المنح', kind: 'btn-2' },
      { label: 'اعتذار', kind: 'btn-d' },
    ],
  },
]

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
