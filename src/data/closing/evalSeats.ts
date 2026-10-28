import type { CloseRow, CloseStage, EvalSeat, ProjectEval } from '@/types/domain'
import type { RoleKey } from '@/data/roles'
import { approverFor } from '@/data/closing/store'

/* Client 28 Oct · a project is evaluated by the grants supervisor, the grants manager and the
   executive, each at his own stage of the evaluation's approval path · the supervisor's is the
   closing's `evaluation`, the others' are `evalReviews` */

export type EvalWho = 'supervisor' | EvalSeat

export interface EvalSeatDef { who: EvalWho; title: string; seat: string; stage: CloseStage; role: RoleKey; cap: string }

export const EVAL_SEATS: EvalSeatDef[] = [
  { who: 'supervisor', title: 'تقييم مشرف المنح', seat: 'مشرف المنح', stage: 'evalDraft', role: 'supervisor', cap: 'إعداد التقييم' },
  { who: 'manager', title: 'تقييم مدير المنح', seat: 'مدير المنح', stage: 'evalManager', role: 'grants-manager', cap: 'تقييم واعتماد' },
  { who: 'ceo', title: 'تقييم المدير التنفيذي', seat: 'المدير التنفيذي', stage: 'evalExecutive', role: 'ceo', cap: 'تقييم واعتماد' },
]

/** The seats on this closing's path · the executive only when the matrix makes him the last approver */
export const seatsOf = (c: CloseRow): EvalSeatDef[] =>
  EVAL_SEATS.filter((s) => s.who !== 'ceo' || approverFor('eval', c.projectId) === 'ceo' || c.stage === 'evalExecutive' || Boolean(c.evalReviews?.ceo))

/** A seat's evaluation, with who wrote it when the store knows */
export const evalOf = (c: CloseRow, who: EvalWho): (ProjectEval & { by?: string; at?: string }) | undefined =>
  who === 'supervisor' ? c.evaluation ?? undefined : c.evalReviews?.[who]

/** The seat the current user evaluates now · none when it isn't his stage */
export const mySeat = (c: CloseRow, role: RoleKey): EvalSeatDef | undefined =>
  seatsOf(c).find((s) => s.role === role && s.stage === c.stage)

/** The day a seat's evaluation was written · a review keeps its own · the supervisor's is read from the evaluation's log */
export const evalAt = (c: CloseRow, who: EvalWho): string | undefined => {
  if (who !== 'supervisor') return c.evalReviews?.[who]?.at
  return [...(c.evalAudit ?? [])].reverse().find((a) => /^حفظ التقييم$|^إرسال التقييم/.test(a.what))?.at
}
