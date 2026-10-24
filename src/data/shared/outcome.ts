import type { Tone } from '@/types/domain'

/* Client sheet 24 Oct (#95) · «في جميع الإجراءات التي يتم اعتمادها يكون نتيجة الإجراء من ضمن خيارات
   الاعتماد (مكتمل - مرفوض - ملغي)».

   Every procedure that goes through an approval ends on one of three outcomes, named the same in
   every module. The stored states stay as they are (each module keeps its own words for where a
   request stands, and the records read back unchanged); this map reads a terminal state as its
   outcome, and a state still on its way reads none. */

export type Outcome = 'done' | 'rejected' | 'cancelled'

export const OUTCOMES: Outcome[] = ['done', 'rejected', 'cancelled']

export const OUTCOME_SAY: Record<Outcome, string> = { done: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغي' }

export const OUTCOME_TONE: Record<Outcome, Tone> = { done: 'ok', rejected: 'no', cancelled: 'mute' }

type Map<S extends string> = Partial<Record<S, Outcome>>
const read = <S extends string>(m: Map<S>) => (s: S | undefined): Outcome | undefined => (s ? m[s] : undefined)

/** Entity registration and update requests · approved / rejected */
export const regOutcome = read<string>({ approved: 'done', rejected: 'rejected' })
/** Payment requests · transferred, or finally refused and kept on record (rule 15) */
export const payOutcome = read<string>({ paid: 'done', closed: 'rejected' })
/** Agreements · in effect, or cancelled / finally refused (rule 26) */
export const agreementOutcome = read<string>({ active: 'done', cancelled: 'cancelled' })
/** Plans · every activity accepted, or stopped when the project no longer needs a plan */
export const planOutcome = read<string>({ done: 'done', cancelled: 'cancelled' })
/** A change or cancel request on an approved plan */
export const planChangeOutcome = read<string>({ approved: 'done', rejected: 'rejected' })
/** Closing · the report and the evaluation both approved */
export const closeOutcome = read<string>({ closed: 'done' })
/** Closing cases (stop · recover · redirect) */
export const caseOutcome = read<string>({ approved: 'done', closed: 'done', rejected: 'rejected' })
/** Budget transfers and requests */
export const budgetReqOutcome = read<string>({ executed: 'done', rejected: 'rejected' })
/** Portfolios */
export const portfolioOutcome = read<string>({ approved: 'done', closed: 'done', rejected: 'rejected', cancelled: 'cancelled' })
/** Portfolio sub-projects · done, refused, or excluded from the portfolio */
export const subOutcome = read<string>({ done: 'done', rejected: 'rejected', excluded: 'cancelled' })
