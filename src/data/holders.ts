import { APPROVAL_MATRIX, approverFor, type ApprovalRow } from './approval'
import type { AuthorityMatrix, AuthorityRole, DecisionAction, ProjectRow } from '@/types/domain'
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

export type Holder = 'supervisor' | ApprovalRow['key']

export const HOLDER_LABEL: Record<Holder, string> = {
  supervisor: 'مشرف المنح',
  manager: 'مدير المنح',
  exec: 'المدير التنفيذي',
  committee: 'اللجنة التنفيذية',
  board: 'مجلس الأمناء',
}

/** The signed-in role that acts for each seat · the committee's decision is recorded by the grants
    manager as its secretary; the board's by the executive director */
const ACTS_FOR: Record<Holder, RoleKey> = {
  supervisor: 'supervisor',
  manager: 'grants-manager',
  exec: 'ceo',
  committee: 'grants-manager',
  board: 'ceo',
}

/** Where a project under study stands · `null` once it is out of study */
export const holderOf = (row: Pick<ProjectRow, 'stage' | 'holder'>): Holder | null =>
  row.stage === 'دراسة المشروع' ? row.holder ?? 'supervisor' : null

/** The authority fan for one project · from the live matrix, with the holder marked */
export const authorityFor = (amount: number, holder: Holder | null): AuthorityMatrix => {
  const decider = approverFor(amount).key
  const stops: Holder[] = ['supervisor', ...APPROVAL_MATRIX.map((r) => r.key)]
  const at = holder ? stops.indexOf(holder) : stops.indexOf(decider) + 1
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
const nextOf = (h: Holder): Holder | null => {
  const stops: Holder[] = ['supervisor', ...APPROVAL_MATRIX.map((r) => r.key)]
  return stops[stops.indexOf(h) + 1] ?? null
}

export interface SeatOptions {
  /** The buttons in the decision bar · empty when the viewer doesn't hold the seat */
  actions: DecisionAction[]
  /** What this seat may change in the project itself, beside the decision */
  edits: string[]
  /** One line on who holds it, for anyone who doesn't */
  say: string
  mine: boolean
}

/** The options of the seat a project sits at, as seen by the signed-in role */
export const seatOptions = (holder: Holder, amount: number, viewer: RoleKey): SeatOptions => {
  const decides = holder !== 'supervisor' && approverFor(amount).key === holder
  const up = nextOf(holder)
  const upLabel = up ? HOLDER_LABEL[up] : ''
  const mine = ACTS_FOR[holder] === viewer
  const by = holder === 'committee' ? ' · يسجّل قرارها مدير المنح أمينًا للجنة' : holder === 'board' ? ' · يسجّل قراره المدير التنفيذي' : ''
  const say = `المشروع عند ${HOLDER_LABEL[holder]}${by}`

  const table: Record<Holder, { actions: DecisionAction[]; edits: string[] }> = {
    supervisor: {
      actions: [
        { label: 'توصية بالموافقة', kind: 'btn-p' },
        { label: 'طلب استكمال', kind: 'btn-2' },
        { label: 'تحويل لمجال أو مشرف آخر', kind: 'btn-2' },
        { label: 'توصية بالرفض', kind: 'btn-d' },
      ],
      edits: ['التقييم والتوصية', 'المبلغ الموصى به', 'بنود الميزانية'],
    },
    manager: {
      actions: [
        decides ? { label: 'اعتماد', kind: 'btn-p' } : { label: `رفع إلى ${upLabel}`, kind: 'btn-p' },
        { label: 'إضافة خطة', kind: 'btn-2' },
        { label: 'تعديل مبالغ الميزانية', kind: 'btn-2' },
        { label: 'إعادة للمشرف', kind: 'btn-2' },
        { label: 'اعتذار', kind: 'btn-d' },
      ],
      edits: ['المبلغ المعتمد', 'بنود الميزانية', 'إضافة خطة', 'ربط بند الميزانية'],
    },
    exec: {
      actions: [
        decides ? { label: 'اعتماد', kind: 'btn-p' } : { label: `رفع إلى ${upLabel}`, kind: 'btn-p' },
        { label: 'إعادة لمدير المنح', kind: 'btn-2' },
        { label: 'اعتذار', kind: 'btn-d' },
      ],
      edits: ['شروط الاعتماد'],
    },
    committee: {
      actions: [
        decides
          ? { label: 'تسجيل اعتماد اللجنة', kind: 'btn-p' }
          : { label: `رفع إلى ${upLabel}`, kind: 'btn-p' },
        { label: 'تسجيل إعادة بملاحظات', kind: 'btn-2' },
        { label: 'تسجيل اعتذار اللجنة', kind: 'btn-d' },
      ],
      edits: ['المبلغ المعتمد', 'شروط الاعتماد', 'محضر الاجتماع'],
    },
    board: {
      actions: [
        { label: 'تسجيل قرار المجلس', kind: 'btn-p' },
        { label: 'تسجيل إعادة', kind: 'btn-2' },
      ],
      edits: ['محضر المجلس'],
    },
  }

  const t = table[holder]
  return { actions: mine ? t.actions : [], edits: t.edits, say, mine }
}
