import type { AgreementPayment, PayCond } from '@/types/domain'
import { projectRows } from '@/data/mock/projects'
import { planOfProject } from '@/data/mock/plans'
import { closeRows } from '@/data/mock/closing'
import { orgOutputsOf, outputLine } from '@/data/intake/flow'
import { liveDay } from '@/data/clock'

/* v3 · 8.2.9 · 8.1.output-4 · 12.4.14 · a payment's conditions, structured · a date, an activity of
   the project's plan, a report, or one of the foundation's outputs · one or several on the same
   payment · each read against the record it names, so «is this payment's condition met» is a reading,
   not a supervisor's memory of a line of free text. The free text stays as a note beside them. */

export const COND_SAY: Record<PayCond['kind'], string> = { date: 'تاريخ', activity: 'نشاط من الخطة', report: 'تقرير', output: 'مخرج' }

export const REPORTS: { ref: string; label: string }[] = [
  { ref: 'interim', label: 'التقرير المرحلي' },
  { ref: 'final', label: 'التقرير الختامي' },
]

export interface CondOption { kind: PayCond['kind']; ref: string; label: string }

/** What a payment of this project may be tied to · the plan's activities, the reports, the outputs */
export function condOptions(projectId: string): CondOption[] {
  const plan = planOfProject(projectId)
  const acts = plan ? plan.phases.flatMap((ph) => ph.activities.map((a) => ({ kind: 'activity' as const, ref: a.id, label: `${ph.name} · ${a.name}` }))) : []
  const outs = orgOutputsOf(projectId).map((o, i) => ({ kind: 'output' as const, ref: String(i), label: outputLine(o) }))
  return [...acts, ...REPORTS.map((r) => ({ kind: 'report' as const, ...r })), ...outs]
}

export const condLine = (c: PayCond): string => (c.kind === 'date' ? `بعد تاريخ ${c.ref}` : `${COND_SAY[c.kind]}: ${c.label}`)

/** The payment's condition as one line · the structured ones, then the note */
export const requirementOf = (p: Pick<AgreementPayment, 'requirement' | 'conds'>): string =>
  [...(p.conds ?? []).map(condLine), ...(p.requirement?.trim() ? [p.requirement.trim()] : [])].join(' · ')

/** Is the condition met · `null` when the record can't tell (an output's evidence is read at the
    payment's review) */
export function condMet(projectId: string, c: PayCond): { met: boolean | null; say: string } {
  if (c.kind === 'date') return c.ref <= liveDay() ? { met: true, say: 'حلّ التاريخ' } : { met: false, say: `لم يحلّ بعد · ${c.ref}` }
  if (c.kind === 'activity') {
    const a = planOfProject(projectId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === c.ref)
    if (!a) return { met: false, say: 'النشاط لم يعد في الخطة' }
    return a.state === 'accepted' ? { met: true, say: `قُبل النشاط${a.doneAt ? ` · ${a.doneAt}` : ''}` } : { met: false, say: 'النشاط لم يُقبل بعد' }
  }
  if (c.kind === 'report') {
    const p = projectRows.find((x) => x.id === projectId)
    if (c.ref === 'interim') return p?.hasInterimReport ? { met: true, say: 'رُفع التقرير المرحلي' } : { met: false, say: 'لم يُرفع التقرير المرحلي' }
    const cl = closeRows.find((x) => x.projectId === projectId)
    const ok = Boolean(cl && ['reportDone', 'evalDraft', 'evalManager', 'evalExecutive', 'closed'].includes(cl.stage))
    return ok ? { met: true, say: 'اعتُمد التقرير الختامي' } : { met: false, say: 'لم يُعتمد التقرير الختامي' }
  }
  return { met: null, say: 'يُتحقق من شواهده عند مراجعة متطلبات الدفعة' }
}

/** A payment's conditions not met yet · for the payment's readiness */
export const unmetConds = (projectId: string, p: Pick<AgreementPayment, 'conds'>): PayCond[] =>
  (p.conds ?? []).filter((c) => condMet(projectId, c).met === false)
