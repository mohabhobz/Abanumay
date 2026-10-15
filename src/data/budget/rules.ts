import { CFG, persist, readJson } from '@/lib/config'
import type { RoleKey } from '@/data/roles'

/* Budget rules (BPD-001) · who acts at each step of a budget and of a budget operation, the
   transfer policy the system checks before a request goes anywhere, and the spending limit of each
   management level. Every value here is a setting, read by the budget screens and the checks alike.

   Every step names its roles here · the switcher plays each of them, and once the backend arrives
   the token decides. */

export type Level = 'manager' | 'exec' | 'committee' | 'board'

export interface BudgetRules {
  /** Prepares a budget and a budget operation request · «صاحب الصلاحية» (1.2.1–1.2.8 · 1.3.1) */
  prepareBy: RoleKey[]
  /** Reviews and forwards or returns (1.2.9 · 1.3.7) */
  managerBy: RoleKey[]
  /** The finance department's review (1.2.10 · 1.3.8) */
  financeBy: RoleKey[]
  /** Approves and activates (1.2.11 · 1.3.9) */
  execBy: RoleKey[]
  /** Changes a line's status on an approved budget (1.4.37) */
  statusBy: RoleKey[]
  /** Transfer policy (1.3.5) · the largest share of a line's allocation one request may move */
  maxTransferPct: number
  /** From this amount up, a request carries a supporting document */
  attachAbove: number
  /** Domains open to new projects only where an approved budget funds them (1.1.output-5) */
  requireFunding: boolean
  /** The spending limit of each level · the largest disbursement it may approve (1.1.input-6) */
  spendCaps: Record<Level, number | null>
  /** 5.4.19 · when a project's link holds money on its lines · at the grants manager's
      recommendation (an initial hold that turns final on approval), or only at the final approval
      (the link is checked and planned until then) */
  holdAt: 'recommend' | 'approval'
  /** 1.4.56 · v2 · who changed a project's budget link after its approval directly · v3 · 1.3b moves
      that to a relocation request · kept on file, read by nothing */
  relinkBy: RoleKey[]
  /** v3 · 1.3b.1 · who opens a relocation request on an approved project */
  relocateBy: RoleKey[]
  /** v3 · 1.3b.6 · who approves it (and so executes it) */
  relocateApproveBy: RoleKey[]
  /** The file's migration version · a one-time move runs once */
  migrated?: number
}

/* v3 · 1.1.desc-4 · preparing and approving the grants budget sits outside the grants department ·
   the authority holders are named here · by default finance prepares and the executive director
   reviews first (15 Oct · Mohab) */
const DEFAULT: BudgetRules = {
  prepareBy: ['finance'],
  managerBy: ['ceo'],
  financeBy: ['finance'],
  execBy: ['ceo'],
  statusBy: ['grants-manager', 'ceo'],
  maxTransferPct: 50,
  attachAbove: 500_000,
  requireFunding: true,
  spendCaps: { manager: 100_000, exec: 500_000, committee: 2_000_000, board: null },
  holdAt: 'recommend',
  relinkBy: ['grants-manager', 'ceo'],
  /* v3 · 1.3b · finance requests, the executive director approves (15 Oct · Mohab) */
  relocateBy: ['finance'],
  relocateApproveBy: ['ceo'],
  /* no `migrated` here · readJson spreads the defaults under the stored file, so a version on the
     default would mark an old file as migrated and skip the moves below */
}

export const BUDGET_RULES: BudgetRules = readJson(CFG.budgetRules, DEFAULT)
/* Re-audit 7 Oct · finance has its own seat now · a file saved while the executive stood in for it
   moves to the finance role */
/* Batch 5 · 8 Oct · once, not on every load · it rewrote a choice made after the move, so an admin
   who set the executive alone on this step lost it at the next reload with no word. The file now
   carries the version it was migrated to, and a later choice of ['ceo'] stands */
if ((BUDGET_RULES.migrated ?? 0) < 2) {
  const moved = BUDGET_RULES.financeBy.length === 1 && BUDGET_RULES.financeBy[0] === 'ceo'
  if (moved) BUDGET_RULES.financeBy = ['finance']
  BUDGET_RULES.migrated = 2
  if (moved) persist(CFG.budgetRules, BUDGET_RULES)
}
/* v3 · 15 Oct · once · a file still on the grants department's old defaults moves to the v3 ones ·
   a choice the admin made since stands */
if ((BUDGET_RULES.migrated ?? 0) < 3) {
  const same = (a: RoleKey[], b: RoleKey[]) => a.length === b.length && a.every((x) => b.includes(x))
  const old = same(BUDGET_RULES.prepareBy, ['supervisor', 'grants-manager']) && same(BUDGET_RULES.managerBy, ['grants-manager'])
  if (old) { BUDGET_RULES.prepareBy = [...DEFAULT.prepareBy]; BUDGET_RULES.managerBy = [...DEFAULT.managerBy] }
  BUDGET_RULES.migrated = 3
  if (old) persist(CFG.budgetRules, BUDGET_RULES)
}

export const saveBudgetRules = (next: BudgetRules): void => {
  Object.assign(BUDGET_RULES, structuredClone(next))
  persist(CFG.budgetRules, BUDGET_RULES)
}

export const BUDGET_RULES_DEFAULT = DEFAULT

export const LEVEL_SAY: Record<Level, string> = {
  manager: 'مدير المنح',
  exec: 'المدير التنفيذي',
  committee: 'اللجنة التنفيذية',
  board: 'مجلس الأمناء',
}

/** The lowest level whose spending limit covers the amount */
export const spendLevelFor = (amount: number): Level => {
  const order: Level[] = ['manager', 'exec', 'committee', 'board']
  return order.find((l) => {
    const cap = BUDGET_RULES.spendCaps[l]
    return cap === null || amount <= cap
  }) ?? 'board'
}
