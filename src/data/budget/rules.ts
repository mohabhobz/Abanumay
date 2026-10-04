import { CFG, persist, readJson } from '@/lib/config'
import type { RoleKey } from '@/data/roles'

/* Budget rules (BPD-001) · who acts at each step of a budget and of a budget operation, the
   transfer policy the system checks before a request goes anywhere, and the spending limit of each
   management level. Every value here is a setting, read by the budget screens and the checks alike.

   Finance isn't a role in the prototype's switcher · the executive director previews its step, as in
   payments; once the backend arrives the token decides. */

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
}

const DEFAULT: BudgetRules = {
  prepareBy: ['supervisor', 'grants-manager'],
  managerBy: ['grants-manager'],
  financeBy: ['ceo'],
  execBy: ['ceo'],
  statusBy: ['grants-manager', 'ceo'],
  maxTransferPct: 50,
  attachAbove: 500_000,
  requireFunding: true,
  spendCaps: { manager: 100_000, exec: 500_000, committee: 2_000_000, board: null },
}

export const BUDGET_RULES: BudgetRules = readJson(CFG.budgetRules, DEFAULT)

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
