import { APPROVAL_MATRIX, approverFor, type ApprovalRow } from './approval'
import type { AuthorityMatrix, AuthorityRole, ProjectRow } from '@/types/domain'
import type { RoleKey } from './roles'

/* Who holds a project under study, and what each holder may do · meeting 1 Oct, item B-5.

   A project under study sits with one decision-maker at a time: the grants supervisor (who
   recommends), then up the approval matrix — grants manager, executive director, executive
   committee, board — until it reaches the level whose cap covers its amount. The client asked for a
   project standing at each of them, with the options that belong to that seat: the grants manager
   can add a plan or edit budget amounts, the executive can only decide or send it up.

   Two rules make this one map rather than per-screen logic:
   - the path comes from `APPROVAL_MATRIX` (settings), so changing a cap re-routes every project;
   - the options belong to the seat, not to the signed-in role: a grants manager opening a project
     that sits with the executive sees where it is and why, not buttons he cannot use. */

/** `confirm` · the path is complete and the supervisor verifies the notes and conditions before the
    project reads «معتمد» (5.2.15 · 6.2.11 · 7.2.8) */
export type Holder = 'supervisor' | ApprovalRow['key'] | 'confirm'

export const HOLDER_LABEL: Record<Holder, string> = {
  supervisor: 'مشرف المنح',
  manager: 'مدير المنح',
  exec: 'المدير التنفيذي',
  committee: 'اللجنة التنفيذية',
  board: 'مجلس الأمناء',
  confirm: 'تأكيد مشرف المنح',
}

/** The signed-in role that acts for each seat · the committee's decision is recorded by the grants
    manager as its secretary; the board's by the executive director */
export const ACTS_FOR: Record<Holder, RoleKey> = {
  supervisor: 'supervisor',
  manager: 'grants-manager',
  exec: 'ceo',
  committee: 'grants-manager',
  board: 'ceo',
  confirm: 'supervisor',
}

/** Where a project under study stands · `null` once it is out of study */
export const holderOf = (row: Pick<ProjectRow, 'stage' | 'holder'>): Holder | null =>
  row.stage === 'دراسة المشروع' ? row.holder ?? 'supervisor' : null

/** The authority fan for one project · from the live matrix, with the holder marked */
export const authorityFor = (amount: number, holder: Holder | null): AuthorityMatrix => {
  const decider = approverFor(amount).key
  const stops: Holder[] = ['supervisor', ...APPROVAL_MATRIX.map((r) => r.key)]
  /* At the supervisor's confirmation every level has passed */
  const at = holder === 'confirm' ? stops.length : holder ? stops.indexOf(holder) : stops.indexOf(decider) + 1
  const state = (i: number): AuthorityRole['state'] => (i < at ? 'done' : i === at ? 'now' : 'pending')
  return {
    provisional: APPROVAL_MATRIX.some((r) => r.assumed),
    roles: [
      { role: 'تقديم الجهة', ceiling: null, kind: 'submit', state: 'done' },
      { role: 'مشرف المنح', ceiling: null, kind: 'recommend', state: state(0) },
      ...APPROVAL_MATRIX.map((r, i): AuthorityRole => ({
        role: r.role,
        ceiling: r.upTo,
        kind: r.upTo === null ? 'final' : undefined,
        state: state(i + 1),
        ...(r.key === 'committee' ? { note: 'للمشروع الواحد' } : {}),
      })),
    ],
  }
}

/** The seat above · where "send up" goes */
export const nextOf = (h: Holder): Holder | null => {
  if (h === 'confirm') return null
  const stops: Holder[] = ['supervisor', ...APPROVAL_MATRIX.map((r) => r.key)]
  return stops[stops.indexOf(h) + 1] ?? null
}

/* The seat's buttons and what it may change live in `data/approvals/store.ts` (`seatOptions`) · they
   read the approval rules, the budget hold and the entity's standing, which this file can't import
   without a cycle. */
