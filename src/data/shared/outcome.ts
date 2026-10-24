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
/** Portfolios · an approved portfolio is still under way (its sub-projects run) · it ends closed */
export const portfolioOutcome = read<string>({ closed: 'done', rejected: 'rejected', cancelled: 'cancelled' })
/** Portfolio sub-projects · done, refused, or excluded from the portfolio */
export const subOutcome = read<string>({ done: 'done', rejected: 'rejected', excluded: 'cancelled' })
/** Projects (and portfolios read as projects) · from the main status · a redirected support ends the
    original procedure, so it reads cancelled; a stalled project is still under way */
export const projectOutcome = read<string>({
  'مكتمل': 'done', 'مغلق بوفر': 'done', 'مرفوض': 'rejected', 'ملغى': 'cancelled', 'أعيد توجيه الدعم': 'cancelled',
})
/** Budget documents · approved and in force, or retired */
export const budgetDocOutcome = read<string>({ approved: 'done', closed: 'done', rejected: 'rejected', cancelled: 'cancelled' })
/** Relocation requests (1.3b) */
export const relocOutcome = read<string>({ approved: 'done', rejected: 'rejected', cancelled: 'cancelled' })

/* ── The «النتيجة» filter · one shape in every list ── */

/** The filter's values · the three outcomes and «قيد الإجراء» for a procedure still on its way */
export type OutcomePick = Outcome | 'open'

export const OUTCOME_PICKS: { value: OutcomePick; label: string }[] = [
  { value: 'done', label: OUTCOME_SAY.done },
  { value: 'rejected', label: OUTCOME_SAY.rejected },
  { value: 'cancelled', label: OUTCOME_SAY.cancelled },
  { value: 'open', label: 'قيد الإجراء' },
]

export const OUTCOME_PICK_SAY: Record<OutcomePick, string> = { ...OUTCOME_SAY, open: 'قيد الإجراء' }

/** A row passes when no outcome is picked, or its outcome (or «قيد الإجراء») is one of the picks */
export const outcomeMatches = (o: Outcome | undefined, picks: readonly string[]): boolean =>
  !picks.length || picks.includes(o ?? 'open')

/** The filter's options with the count each one would show · counted over the rows the other filters
    leave, so a count always equals what picking it lists */
export function outcomeOptions<T>(rows: readonly T[], of: (r: T) => Outcome | undefined): { value: string; label: string }[] {
  const n: Record<OutcomePick, number> = { done: 0, rejected: 0, cancelled: 0, open: 0 }
  for (const r of rows) n[of(r) ?? 'open'] += 1
  return OUTCOME_PICKS.map((p) => ({ value: p.value, label: `${p.label} (${n[p.value]})` }))
}
