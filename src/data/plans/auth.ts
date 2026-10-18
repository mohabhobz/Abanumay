import { CFG, persist, readJson } from '@/lib/config'
import { liveDay } from '@/data/clock'
import { STAFF_DIRECTORY, roleByKey, type RoleKey } from '@/data/roles'

/* v3 · 12.2.11 · who approves a project plan · the grants manager by default, or an authority holder
   he delegates to for a period · the plan records the actual approver's name, the date, and that he
   approved by delegation. A setting, read by the plan's decision bar and its change requests alike. */

export interface PlanDelegation { to: RoleKey; until: string; by: string; at: string; note?: string }
export interface PlanAuth {
  /** Approve a plan and decide its change requests in their own right */
  approveBy: RoleKey[]
  delegations: PlanDelegation[]
}

const DEFAULT: PlanAuth = { approveBy: ['grants-manager'], delegations: [] }

export const PLAN_AUTH: PlanAuth = readJson(CFG.planAuth, DEFAULT)

export const savePlanAuth = (next: PlanAuth): void => {
  Object.assign(PLAN_AUTH, structuredClone(next))
  persist(CFG.planAuth, PLAN_AUTH)
}

/** A delegation in force for the role today · undefined when none */
export const delegationOf = (role: RoleKey, day = liveDay()): PlanDelegation | undefined =>
  PLAN_AUTH.delegations.find((d) => d.to === role && d.until >= day)

/* Re-audit 17 Oct · the personal delegation in «التفويض والإجازة» (account preferences) is read here · an
   approver away hands his plan approvals to the colleague he named, for the dates he set */
interface Personal { on: boolean; from: string; to: string; delegate: string; scope: 'all' | 'approvals'; who?: string }
export function personalDelegation(name: string | undefined, day = liveDay()): Personal | undefined {
  if (!name) return undefined
  let d: Personal | null = null
  try { d = JSON.parse(localStorage.getItem('ab-delegation') ?? 'null') as Personal | null } catch { d = null }
  if (!d?.on || !d.who || d.delegate !== name || !d.from || !d.to || d.from > day || day > d.to) return undefined
  const from = STAFF_DIRECTORY.find((a) => a.name === d!.who)
  return from && PLAN_AUTH.approveBy.includes(from.role) ? d : undefined
}

export const mayApprovePlan = (role: RoleKey, name?: string): boolean =>
  PLAN_AUTH.approveBy.includes(role) || Boolean(delegationOf(role)) || Boolean(personalDelegation(name))

/** How the approval reads on the plan · in his own right, or by delegation from whom */
export const approvalCapacity = (role: RoleKey, name?: string): string => {
  if (PLAN_AUTH.approveBy.includes(role)) return roleByKey(role).title
  const d = delegationOf(role)
  if (d) return `${roleByKey(role).title} · بالتفويض من ${d.by} حتى ${d.until}`
  const p = personalDelegation(name)
  return p ? `${roleByKey(role).title} · بالتفويض من ${p.who} حتى ${p.to}` : roleByKey(role).title
}
