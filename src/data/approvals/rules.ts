import { CFG, persist, readJson } from '@/lib/config'
import type { RoleKey } from '@/data/roles'

/* Approval path rules (BPD-004 – BPD-007) · everything the four seats above the supervisor read
   besides the approval matrix's caps (which stay the one source in `data/approval.ts`).

   Each value is a setting, read by the decision bar, the approval tab, the committee and board
   sessions and the bulk decisions alike. Defaults are assumptions until the foundation confirms its
   delegation of authority, like the matrix itself. */

export interface EntityLimit {
  /** Projects approved for the same entity within the period · `null` = no limit */
  count: number | null
  /** Their total value within the period · `null` = no limit */
  total: number | null
}

export interface ApprovalRules {
  /** 4.3.2 · 4.4.19 · the grants manager may approve finally, within the matrix's manager cap */
  managerFinal: boolean
  /** 4.3.1 · 4.4.20 · the grants manager rejects finally up to this amount · above it the
      rejection is a recommendation that goes to the executive director */
  managerRejectUpTo: number
  /** 5.3.1 · 5.4.28-a · the share by which an amount may pass the executive director's cap */
  execOverPct: number
  /** Per-entity limits within the period (5.4.27-b · 5.4.28-b · 6.4.20 · 6.4.21) */
  periodDays: number
  execEntity: EntityLimit
  committeeEntity: EntityLimit
  /** 4.2.3 · 4.4.2 · from this amount a project is suggested to need a plan */
  planFrom: number
  /** 5.4.4 · no approval for a project outside the foundation's funded directions */
  requireStrategy: boolean
  /** 6.4.6 · 7.4.6 · members, quorum and the vote that carries */
  committeeMembers: string[]
  boardMembers: string[]
  quorum: number
  voting: 'majority' | 'unanimous'
  /** Who records each body's session in the system (6.2.5 · 7.2.7) */
  committeeBy: RoleKey[]
  boardBy: RoleKey[]
  /** 5.4.24 · declared conflicts of interest · the person can't decide on the entity's projects */
  conflicts: { person: string; entityId: string; reason: string }[]
  /** Batch 7 · approvals#19 · 5.4.11 · a recommendation to approve above the executive's cap goes to the
      committee on its own, without passing the executive · off until the foundation decides */
  autoReferAboveExec?: boolean
}

const DEFAULT: ApprovalRules = {
  managerFinal: false,
  managerRejectUpTo: 100_000,
  execOverPct: 5,
  periodDays: 365,
  execEntity: { count: 6, total: 3_000_000 },
  committeeEntity: { count: 10, total: 8_000_000 },
  planFrom: 300_000,
  requireStrategy: true,
  committeeMembers: ['عبدالرحمن الهليّل', 'عبدالله الدوسري', 'خالد السبيعي', 'نورة القحطاني', 'سلطان العتيبي'],
  boardMembers: ['تركي الخنيزان', 'عبدالرحمن الهليّل', 'نواف الشهري', 'خالد السبيعي', 'نورة القحطاني'],
  quorum: 3,
  voting: 'majority',
  committeeBy: ['grants-manager', 'ceo'],
  boardBy: ['ceo'],
  conflicts: [{ person: 'عبدالرحمن الهليّل', entityId: '748', reason: 'عضو في مجلس إدارة الجهة' }],
}

export const APPROVAL_RULES: ApprovalRules = readJson(CFG.approvalRules, DEFAULT)

export const saveApprovalRules = (next: ApprovalRules): void => {
  Object.assign(APPROVAL_RULES, structuredClone(next))
  persist(CFG.approvalRules, APPROVAL_RULES)
}

export const APPROVAL_RULES_DEFAULT = DEFAULT
