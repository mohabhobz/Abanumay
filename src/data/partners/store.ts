import { done } from '@/data/feedback'
import { openPortfolioPlan, registerPortfolioPlan, reviewPlan, savePlanPhases, sendPlanFor } from '@/data/plans/store'
import { planOfProject } from '@/data/mock/plans'
import type { PlanActivity, PlanPhase } from '@/types/domain'
import { DECISIONS, holds, holdersSay } from '@/data/shared/decisions'
import { useSyncExternalStore } from 'react'
import { projectRows, portfolioRows, subRows } from '@/data/mock/projects'
import { entityById, entityRowOf, entityRows } from '@/data/mock/entities'
import { payRequests } from '@/data/mock/disbursements'
import { TODAY, addWorkingDays } from '@/data/intake/cycle'
import { setExtMissingDocs, submitRequest } from '@/data/intake/flow'
import {
  EHSAN_SEED, portfolios as PF_SEED, seedPayRef, type Portfolio as PfSeed, type PortfolioStage,
} from '@/data/mock/implementer'
import { EXT_CLOSE_STAGE, EXT_PRE_STAGE, stageMeta } from '@/data/mock/taxonomy'
import { finalizeHold, hasFunding, linkIssues, linkOf, linkProject, recordPaid, releaseRecovered, releaseSavings, unlinkProject, isPaidRef, useBudget } from '@/data/budget/store'
import { paidOf, setEhsanGate, setExternalBefore, setExternalSchedule } from '@/data/payments/store'
import { payBlock } from '@/data/entities/store'
import { roleByKey, type RoleKey } from '@/data/roles'
import { approverFor } from '@/data/approval'
import { SESSIONS, type Vote } from '@/data/approvals/store'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { pfCriteria as pfStudyCriteria, studyScore } from '@/data/intake/criteria'

/* Strategic partners · the Ehsan platform (BPD-011) and the partners' portfolios (BPD-013).

   Same model as the other procedures: an ordered list of operations kept in the browser and
   replayed at load (each carries its own ids), so a reload lands on the same state; in production
   each operation is a POST.

   Three families live here:
   · the partner itself · its registration and approval as «شريك استراتيجي» and the project
     types it may have (11.2.1 – 11.2.3 · 13.2.1)
   · a project supported through Ehsan as a project of its own · the routing decision and tag
     (11.2.4), no agreement but a plan and a payment schedule (11.2.16 · 11.2.17), payments Ehsan
     executes and the supervisor records for finance to confirm (11.2.11 – 11.2.13 · 11.2.19 ·
     11.2.20), its follow-ups (11.2.18) and a closing the supervisor writes (11.2.21 · 11.2.22)
   · a portfolio · requested by the partner or created internally (13.2.2 · 13.2.3), studied and
     approved once as a whole and held on the budget in one go (13.2.6 · 13.2.7), then its plan and
     agreement (13.2.8 · 13.2.9), and only then its sub-projects: added gradually, submitted one or
     many at a time, each approved or rejected on its own within the portfolio's ceiling (13.2.10 –
     13.2.19), executed and reported by the partner (13.2.20 – 13.2.22), paid at the portfolio's
     level (13.2.23 – 13.2.25) and closed when every sub-project's requirements are met
     (13.2.28 – 13.2.30). A sub-project's value is an internal split of the held total, never a
     new hold (13.2.19 · 13.4.22). */

export type PType = 'independent' | 'portfolio'
export const PTYPE_SAY: Record<PType, string> = { independent: 'مشروع مستقل', portfolio: 'محفظة' }

export interface PartnerNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const PARTNER_NOTES: PartnerNote[] = []

import { actDay, asOf } from '@/data/clock'
const SUP = 'عمر قاسم'
const MGR = () => roleByKey('grants-manager').name
const CEO = () => roleByKey('ceo').name
const FIN = 'محمد المطيري'
const now = () => new Date().toISOString()
const day = (iso: string) => iso.slice(0, 10)

/* ── The partner (11.2.1 – 11.2.3 · 13.2.1) ── */

export type ProfileState = 'review' | 'approved' | 'rejected'
export interface PartnerProfile {
  entityId: string
  name: string
  /** Project types it may have · a project of another type can't be created for it (11.2.2) */
  allowed: PType[]
  /** Its payments are executed on the Ehsan platform */
  platform: boolean
  state: ProfileState
  requestedBy: string
  at: string
  note?: string
  decidedBy?: string
}
export const PROFILES: PartnerProfile[] = []
export const profileOf = (entityId: string) => PROFILES.find((p) => p.entityId === entityId)
/** Registered and approved as a strategic partner · the only entities a partner project may take */
export const isStrategic = (entityId: string) => profileOf(entityId)?.state === 'approved'
export const strategicPartners = () => PROFILES.filter((p) => p.state === 'approved')
export const typeAllowed = (entityId: string, t: PType) => Boolean(profileOf(entityId)?.allowed.includes(t))

/* ── Payments executed through Ehsan (11.2.11 · 11.4.23) and the portfolio's own requests (13.2.23) ── */

export type PayTarget = { kind: 'project'; projectId: string } | { kind: 'sub'; pfId: string; subId: string } | { kind: 'portfolio'; pfId: string }
export type EhState = 'review' | 'confirmed' | 'returned'
export interface EhsanPay {
  id: string
  target: PayTarget
  amount: number
  /** The operation's number on the platform · one record per operation, never twice (11.4.23) */
  ref: string
  paidAt: string
  docs: string[]
  note?: string
  state: EhState
  by: string
  at: string
  reviewedBy?: string
  reviewNote?: string
  /** Recorded before the payments ran this procedure (v3 · 9.4.5) · the fixture's */
  seed?: boolean
}
export const EHSAN_PAYS: EhsanPay[] = []
export const EH_STATE_SAY: Record<EhState, string> = { review: 'بانتظار المراجعة المالية', confirmed: 'مؤكدة', returned: 'معادة' }
export const EH_STATE_TONE: Record<EhState, 'warn' | 'ok' | 'ret'> = { review: 'warn', confirmed: 'ok', returned: 'ret' }
const sameTarget = (a: PayTarget, b: PayTarget) =>
  a.kind === b.kind && (a.kind === 'project' ? a.projectId === (b as typeof a).projectId : a.kind === 'sub' ? a.pfId === (b as typeof a).pfId && a.subId === (b as typeof a).subId : a.pfId === (b as typeof a).pfId)
export const paysOf = (t: PayTarget) => EHSAN_PAYS.filter((p) => sameTarget(p.target, t))
const live = (p: EhsanPay) => p.state !== 'returned'
const sumOf = (list: EhsanPay[], pick: (p: EhsanPay) => boolean) => list.filter(pick).reduce((s, p) => s + p.amount, 0)

/* ── A project of its own through Ehsan (BPD-011) ── */

/** v3 · 11.2.7 · a payment of the external document's schedule · its value, date, requirements and conditions */
export interface EhSlot { no: number; amount: number; dueAt: string; needs?: string; cond?: string }
export interface EhOp { at: string; by: string; kind: string; ref?: string; note: string }
/** v3 · 11.2.13 · 11.2.14 · the external project's closing · the supervisor gathers the requirements and the
    transfer and execution proofs (no regular final report, no evaluation), the grants manager approves or returns */
/** v3 · 11.2.14 · the closing's outcome at the grants manager's approval · «مكتمل» or «مغلق بوفر» by the money, or a cancellation, or a redirect */
export type ExtCloseOutcome = 'complete' | 'cancel' | 'redirect'
export const EXT_CLOSE_OUTCOME_SAY: Record<ExtCloseOutcome, string> = { complete: 'مكتمل · أو مغلق بوفر', cancel: 'ملغى', redirect: 'أعيد توجيه الدعم' }
export interface EhClose { report: string; evidence: string[]; by: string; at: string; state?: 'draft' | 'manager' | 'returned'; note?: string; sentAt?: string; closedAt?: string; closedBy?: string }
/** v3 · 11.2.11 · the execution's state as the authority records it from the external party's proofs */
export const EXEC_STATES = ['لم يبدأ', 'جارٍ التنفيذ', 'متعثر', 'منجز'] as const
export type ExecState = (typeof EXEC_STATES)[number]
export interface EhExec { status: ExecState; progress: number; note: string; files: string[]; by: string; at: string }
const EH_EXEC = new Map<string, EhExec[]>()
export const ehExecOf = (projectId: string): EhExec | undefined => EH_EXEC.get(projectId)?.at(-1)
export const ehExecLog = (projectId: string): EhExec[] => EH_EXEC.get(projectId) ?? []
/** v3 · 11.2.2 · the files the authority attached when creating the project */
const EXT_FILES = new Map<string, string[]>()
/** Client 20 Oct (#43 · #44) · how the support is transferred and who shares in the project ·
    the entity's own registered account, or a third party's account with its documents */
export type ExtTransfer = 'self' | 'third'
export const EXT_TRANSFER_SAY: Record<ExtTransfer, string> = { self: 'عن طريق الجهة نفسها', third: 'عن طريق طرف ثالث' }
export interface ExtThird { holder: string; bank: string; iban: string; files: string[] }
export interface ExtMeta { transfer: ExtTransfer; account?: string; third?: ExtThird; sharedWith?: string }
const EXT_META = new Map<string, ExtMeta>()
export const extMetaOf = (projectId: string): ExtMeta | undefined => EXT_META.get(projectId)
/** Re-audit 17 Oct · the highest sub-project number a portfolio ever used, dropped drafts included ·
    the next one follows it · a session counter on top made the numbers jump (S1 · S3 · S6 · S10) */
const SUB_TOP = new Map<string, number>()
/** Client 20 Oct (#19) · the last sub-project serial issued · the seed numbers first, then the replay in order */
const SUB_SERIAL = { n: 0 }
const nextSubSerial = () => `SPRJ-2026-${String(++SUB_SERIAL.n).padStart(5, '0')}`
/** Client 20 Oct (#17) · a sub-project's own history line */
const slog = (x: { log?: PfLog[] }, by: string, what: string, at: string) => { (x.log ??= []).push({ at: at.slice(0, 10), by, what }) }
/** Client 20 Oct (#20) · the portfolio's outputs and execution stages, copied onto a new sub-project ·
    the plan's activity outputs, or the portfolio's goals when the plan has none */
function pfCopy(pf: { goals: string; plan: { phases: { name: string; from: string; to: string; activities?: { output: string }[] }[] } }) {
  const fromPlan = [...new Set(pf.plan.phases.flatMap((ph) => (ph.activities ?? []).map((a) => a.output.trim()).filter(Boolean)))]
  const outputsCopy = fromPlan.length ? fromPlan : pf.goals.split(/[·،\n]/).map((x) => x.trim()).filter(Boolean)
  return { outputsCopy, phasesCopy: pf.plan.phases.map((ph) => ({ name: ph.name, from: ph.from, to: ph.to })) }
}
export const extFilesOf = (projectId: string) => EXT_FILES.get(projectId) ?? []

/* ── v3 · 11.2.1 · 11.4.1 – 11.4.3 · the external party's reference record and the simplified form ── */

/** The stages an external project takes · its own pre-execution step and its closing's approval */
export { EXT_PRE_STAGE, EXT_CLOSE_STAGE }
export const EXT_KIND = 'مشروع لجهة خارجية' as const
export type ExtPartyField = 'transfer' | 'refs'
export type ExtProjectField = 'goal' | 'description' | 'funding' | 'method' | 'region' | 'startAt' | 'files'
export const EXT_PARTY_FIELD_SAY: Record<ExtPartyField, string> = { transfer: 'بيانات الحساب البنكي', refs: 'البيانات المرجعية' }
export const EXT_PROJECT_FIELD_SAY: Record<ExtProjectField, string> = {
  goal: 'الهدف', description: 'الوصف', funding: 'مصدر التمويل', method: 'طريقة التحويل أو التنفيذ', region: 'المنطقة', startAt: 'تاريخ البدء', files: 'المرفقات المتاحة',
}
/** v3 · 11.4.2 · 11.4.3 · the minimum the foundation asks for · set by the authority */
/* Client 20 Oct (#42) · the simplified form's mandatory set is name · party · field · track · goal · amount ·
   transfer method · everything else is optional unless the authority asks for it */
export const EXT_CFG: { party: ExtPartyField[]; project: ExtProjectField[] } = { party: ['transfer'], project: ['goal', 'method'] }
export const EXT_METHODS = ['تحويل إلى حساب الجهة الخارجية', 'تنفيذ عبر منصة الجهة الخارجية', 'تحويل لطرف ثالث بمستند رسمي'] as const
export const EXT_FUNDING = ['ميزانية المنح', 'مخصص الشراكات', 'تبرع مقيّد'] as const
export const externalParties = () => entityRows.filter((e) => e.external && !e.archived)
export const isExternalParty = (entityId: string) => Boolean(entityById(entityId)?.external)
/** Who keeps the reference records and the settings · the authority over entities' registration */
export const EXT_ADMIN: RoleKey[] = ['grants-manager', 'ceo', 'admin']
/** Who creates an external project · the authority inside the system */
export const EXT_CREATE: RoleKey[] = ['supervisor', 'grants-manager']
const SCHEDULES = new Map<string, EhSlot[]>()
const EH_OPS = new Map<string, EhOp[]>()
const EH_CLOSE = new Map<string, EhClose>()
/** v3 · 8.3.28 · an external project's agreement or document, kept as a reference */
const EXT_DOCS = new Map<string, { file: string; by: string; at: string }[]>()
export const extDocsOf = (projectId: string) => EXT_DOCS.get(projectId) ?? []
/** Batch 7 · a routing the supervisor proposed and the executive hasn't decided */
export interface RouteProposal { platform: boolean; type: PType; note: string; by: string; at: string; party?: string }
const PROPOSALS = new Map<string, RouteProposal>()
/* a proposal lapses with the study · approved or refused, it no longer waits */
export const routeProposalOf = (projectId: string) => (projectOf(projectId)?.statusGroup === 'قيد الدراسة' ? PROPOSALS.get(projectId) : undefined)
export const routeProposals = () => [...PROPOSALS.keys()].filter((id) => routeProposalOf(id)).map((id) => ({ project: projectOf(id)!, ...PROPOSALS.get(id)!, partyName: entityById(PROPOSALS.get(id)!.party ?? '860')?.name }))
export const ehScheduleOf = (projectId: string) => SCHEDULES.get(projectId) ?? []
export const ehOpsOf = (projectId: string) => EH_OPS.get(projectId) ?? []
/** Every Ehsan project's operations · for the unified audit log */
export const allEhOps = (): { projectId: string; ops: EhOp[] }[] => [...EH_OPS.entries()].map(([projectId, ops]) => ({ projectId, ops }))
export const ehCloseOf = (projectId: string) => EH_CLOSE.get(projectId)
/** v3 · BPD-011 · supported through an external party · any party, the platform «منصة إحسان» one of them */
export const viaEhsan = (projectId: string) => Boolean(projectRows.find((p) => p.id === projectId)?.platform)
export const isExternalProject = viaEhsan
export const ehsanProjects = () => projectRows.filter((p) => Boolean(p.platform) && !p.archived)
export const externalProjects = ehsanProjects
const projectOf = (id: string) => projectRows.find((p) => p.id === id)
const approvedProject = (id: string) => {
  const p = projectOf(id)
  return Boolean(p && p.supportStatus === 'معتمد' && p.statusGroup !== 'قيد الدراسة')
}

/** The independent project's money · granted, recorded, confirmed, left */
export function ehMoney(projectId: string) {
  const p = projectOf(projectId)
  const list = paysOf({ kind: 'project', projectId })
  const value = p?.amountGranted || p?.amountRequested || 0
  const recorded = sumOf(list, live)
  const confirmed = sumOf(list, (x) => x.state === 'confirmed')
  return { value, recorded, confirmed, review: recorded - confirmed, left: value - recorded }
}

/** What opens on an independent project · the plan and schedule after approval (11.2.16) */
export function ehGate(projectId: string): { plan: boolean; schedule: boolean; pay: boolean; why: string } {
  if (!approvedProject(projectId)) return { plan: false, schedule: false, pay: false, why: /* doc 11.2.8 */ 'بعد الاعتماد النهائي للمشروع' }
  /* v3 · 12.2.1 · 11.4.5 · an external project has no plan in the system · its schedule opens with the approval */
  const sched = ehScheduleOf(projectId).length > 0
  if (!sched) return { plan: false, schedule: true, pay: false, why: /* doc 11.2.7 */ 'أدخل جدول الدفعات' }
  return { plan: false, schedule: true, pay: true, why: '' }
}

/** The independent project's closing checks (11.2.15 · 11.2.21) */
export function ehCloseChecks(projectId: string): { key: string; label: string; ok: boolean }[] {
  const m = ehMoney(projectId)
  const c = ehCloseOf(projectId)
  const open = payRequests.filter((r) => r.projectId === projectId && r.state !== 'paid' && r.state !== 'closed')
  const paid = paidOf(projectId)
  const x = ehExecOf(projectId)
  /* v3 · 11.2.13 · 11.4.12 · the closing requirements, the transfer proofs and the execution proofs ·
     no regular final report, no evaluation */
  return [
    /* Client 20 Oct (#45) · the closing waits until every payment is paid · if the project has any */
    { key: 'pays', label: open.length ? `جميع الدفعات مدفوعة · ${nf.format(open.length)} ${open.length === 1 ? 'دفعة لم تُصرف بعد' : 'دفعات لم تُصرف بعد'}` : 'جميع الدفعات مدفوعة · لا إذن صرف مفتوح', ok: !open.length },
    { key: 'platform', label: 'العمليات المسجلة على منصة الجهة مؤكدة من الإدارة المالية', ok: m.review === 0 },
    { key: 'cap', label: 'المصروف في حدود قيمة المشروع', ok: paid <= m.value },
    { key: 'exec', label: 'حالة التنفيذ «منجز» بإثبات من الجهة الخارجية', ok: x?.status === 'منجز' && x.files.length > 0 },
    { key: 'report', label: 'ملخص الإغلاق وإثباتاته', ok: Boolean(c?.report.trim() && c.evidence.length) },
  ]
}
/** v3 · 11.2.13 · running external projects past their period with no closing sent · the supervisor is alerted */
/** Re-audit 17 Oct · an external project created without a start date has no `endAt` · its end is
    read from its creation and its duration, so the end-of-term alert still reaches its supervisor */
export const extEndOf = (p: (typeof projectRows)[number]): string | undefined =>
  p.endAt ?? (p.durationDays ? addWorkingDays(p.startAt ?? p.submittedAt, p.durationDays, p.execDays) : undefined)
export function externalEnded(): typeof projectRows {
  return ehsanProjects().filter((p) => p.statusGroup === 'تحت التنفيذ' && (extEndOf(p) ?? '9999') <= TODAY && ehCloseOf(p.id)?.state !== 'manager' && !ehCloseOf(p.id)?.closedAt)
}
/** v3 · 11.2.14 · the closings waiting on the grants manager */
export const externalClosingsWaiting = () => ehsanProjects().filter((p) => ehCloseOf(p.id)?.state === 'manager' && !ehCloseOf(p.id)?.closedAt)

/* ── Portfolios (BPD-013) ── */

/** v3 · 0.sub.1 – 0.sub.9 · مسودة · مرفوع · قيد الدراسة · بانتظار الاعتماد · معتمد · قيد الإغلاق · مكتمل · متعثر · مستبعد/ملغى · مرفوض */
export type SubState = 'draft' | 'submitted' | 'study' | 'pending' | 'approved' | 'closing' | 'done' | 'stalled' | 'excluded' | 'rejected'
/** Approved and not taken out · its value is part of the portfolio's split */
export const SUB_LIVE: SubState[] = ['approved', 'closing', 'done', 'stalled']
export const isLiveSub = (x: { state: SubState }) => SUB_LIVE.includes(x.state)
/** v3 · 13.2.29 · the states a portfolio may close on */
export const SUB_FINAL: SubState[] = ['done', 'stalled', 'excluded', 'rejected']
/** v3 · 13.4.16 · the sub-project form's optional fields, required per portfolio */
export type SubField = 'beneficiaries' | 'outputs' | 'files' | 'city' | 'activity'
export const SUB_FIELD_SAY: Record<SubField, string> = { beneficiaries: 'المستفيدون المستهدفون', outputs: 'المخرجات المستهدفة', files: 'المرفقات', city: 'المدينة', activity: 'نشاط خطة المحفظة' }
export const SUB_FIELDS_DEFAULT: SubField[] = ['beneficiaries', 'outputs', 'files']
/** v3 · 13.4.15 · the partner's own progress field · «تحت التنفيذ» is not a sub-project state, so the field never offers it ·
    a stored or seeded «تحت التنفيذ» reads «جارٍ التنفيذ» (subExecStatus) */
export type SubExecStatus = 'لم يبدأ' | 'جارٍ التنفيذ' | 'مكتمل'
export const SUB_EXEC_STATES: readonly SubExecStatus[] = ['لم يبدأ', 'جارٍ التنفيذ', 'مكتمل']
export const subExecStatus = (v: string | undefined): SubExecStatus => (v === 'مكتمل' ? 'مكتمل' : v === 'تحت التنفيذ' || v === 'جارٍ التنفيذ' ? 'جارٍ التنفيذ' : 'لم يبدأ')
export interface SubExec { status: SubExecStatus; progress: number; reached: number; results: string; evidence: string[]; at: string; by: string }
export interface SubProject {
  id: string
  name: string
  region: string
  city?: string
  amount: number
  beneficiaries: number
  outputs: string
  files: string[]
  /** Re-audit 7 Oct · inherited from the portfolio at creation (13.2.11) */
  track?: string
  field?: string
  /** v3 · 0.sub.1 – 0.sub.9 · the sub-project's dictionary · «تحت التنفيذ» is not forced on it (13.4.15) */
  state: SubState
  reason?: string
  reqId?: string
  addedBy: string
  addedAt: string
  /** Batch 8 · x.5 · when it reached its state · the escalation counts from it */
  stateAt?: string
  decidedBy?: string
  decidedAt?: string
  exec?: SubExec
  /** v3 · 12.4.13 · the portfolio plan's activity this sub-project serves · several may serve one */
  activityId?: string
  /** v3 · 0.sub.3 · 13.2.16 · the supervisor's recommendation · an approval one holds the value */
  rec?: { outcome: 'approve' | 'reject'; note: string; by: string; at: string }
  /** The grants manager's note on an approval (13.2.16) */
  note?: string
  /** v3 · 0.sub.6 · the partner asked the foundation to approve the results */
  ready?: boolean
  /** v3 · 0.sub.6 · 0.sub.7 · 0.sub.8 · who closed it out and why */
  outcome?: { by: string; at: string; note: string }
  /** Client 20 Oct (#19) · the sub-project's own serial · SPRJ-2026-00001 · issued once, never reused */
  serial?: string
  /** Client 20 Oct (#18) · who carries it out · the portfolio's owner, an association or a company */
  implementer?: SubImplementer
  implementerName?: string
  /** Client 20 Oct (#18) · the end beneficiaries beside the direct ones · and the full cost beside the grant */
  finalBeneficiaries?: number
  cost?: number
  /** Client 20 Oct (#18) · the detailed evaluation, by the portfolio's approved model, as a file */
  evalFile?: string
  /** Client 20 Oct (#20) · copied from the portfolio when the sub-project is created · its own copy after that */
  outputsCopy?: string[]
  phasesCopy?: { name: string; from: string; to: string }[]
  /** Client 20 Oct (#27) · the results the entity records · the supervisor approves them */
  results?: SubResults
  /** Client 20 Oct (#17) · sent back · by the supervisor to the entity, or by the manager to the supervisor */
  returned?: { by: string; at: string; note: string; seat: 'supervisor' | 'grants-manager' }
  /** Client 20 Oct (#17) · its own history · the portfolio's log keeps the portfolio-level entries */
  log?: PfLog[]
}
/** Client 20 Oct (#18) · who carries a sub-project out */
export type SubImplementer = 'owner' | 'association' | 'company'
export const SUB_IMPL_SAY: Record<SubImplementer, string> = { owner: 'مالك المحفظة', association: 'جمعية', company: 'شركة' }
/** Client 20 Oct (#27) · the closing data · actual cost, actual beneficiaries, one attachment or more */
export interface SubResults { cost: number; reached: number; files: string[]; note: string; at: string; by: string }
/* Batch 7 · partners#11 · a phase carries its activities, each with its output and the evidence it
   needs (12.2.6 – 12.2.9) · the plan was phases alone */
export interface PfActivity { id: string; name: string; output: string; evidence: string }
export interface PfPhase { id: string; name: string; from: string; to: string; cost: number; activities?: PfActivity[] }
export interface PfLog { at: string; by: string; what: string }
/* Batch 7 · partners#35 · a request carries its justification and documents, and finance takes it in
   two steps like BPD-009 · the order first («order»), then the transfer · it was one step */
/* v3 · 13.2.24 · the portfolio's payments run the payment procedure (BPD-009) · the supervisor reviews the
   requirements («supervisor» → «eligible»), creates the permit with its value («manager»), the grants manager
   approves it (the executive above his limit · «exec»), then finance's order and transfer */
export type PfReqState = 'supervisor' | 'eligible' | 'manager' | 'exec' | 'finance' | 'order' | 'paid' | 'returned'
export const PF_REQ_SAY: Record<PfReqState, string> = {
  supervisor: 'متطلبات عند مشرف المنح', eligible: 'مؤهلة للصرف · بانتظار الإذن', manager: 'إذن صرف عند مدير المنح', exec: 'إذن صرف عند المدير التنفيذي',
  finance: 'لدى المالية · أمر الصرف', order: 'أمر الصرف معتمد · بانتظار التحويل', paid: 'صُرفت', returned: 'معادة',
}
export interface PfRequest { id: string; no: number; amount: number; at: string; by: string; state: PfReqState; /** Batch 8 · x.5 · when it reached its seat · the escalation counts from it */ stateAt?: string; ref?: string; note?: string; why?: string; docs?: string[]; orderBy?: string; asked?: number; permitBy?: string }
export interface PfApproval { id: string; subIds: string[]; at: string; by: string }
export interface PortfolioRec {
  id: string
  name: string
  entityId: string
  total: number
  year: string
  track: string
  field: string
  goals: string
  summary: string
  files: string[]
  origin: 'internal' | 'partner'
  channel: 'ehsan' | 'direct'
  stage: PortfolioStage
  owner: string
  openedAt: string
  note?: string
  shares?: { docId: string; nodeId: string; amount: number }[]
  /* Batch 6 · 8 Oct · the plan and the agreement run their procedures' full paths (BPD-012 · BPD-008)
     · the plan: drafted by the partner or the supervisor, the partner's reviewed by the supervisor
     («supervisor») before the manager · the agreement: the manager, then the executive director,
     the partner's signature, then the foundation's counter-signature («foundation») before it's in
     force. The short paths skipped the supervisor's review and the executive and foundation steps */
  /** Client 18 Oct (#32) · read live from the plans module (BPD-012) · the portfolio's plan is a plan row
      there · `planId` opens it · this field is a view, written only by the fixture before the binding */
  plan: { state: 'none' | 'draft' | 'supervisor' | 'review' | 'approved' | 'returned'; phases: PfPhase[]; note?: string; by?: string; drafter?: 'partner' | 'supervisor'; planId?: string }
  agreement: { state: 'none' | 'draft' | 'manager' | 'executive' | 'partner' | 'foundation' | 'signed' | 'returned'; file?: string; note?: string; signedBy?: string; countersignedBy?: string
    /** Batch 7 · partners#12 · the agreement's text, drafted from the template with the portfolio's own terms, and each draft kept */
    body?: string[]; versions?: { no: number; at: string; by: string; body: string[] }[] }
  schedule: EhSlot[]
  requests: PfRequest[]
  approvals: PfApproval[]
  items: SubProject[]
  close: {
    report: string; evidence: string[]; by?: string; at?: string; closedBy?: string; closedAt?: string
    /** v3 · 13.2.30 · 13.4.42 · the comprehensive report's approval and the evaluation, by the closing procedure (BPD-010) */
    stage?: PfCloseStage; note?: string
    evaluation?: { criteria: { key: string; label: string; weight: number; rating: number | null }[]; notes: string }
  }
  log: PfLog[]
  /** v3 · 13.4.16 · the sub-project form's required fields for this portfolio */
  subFields?: SubField[]
  /** v3 · 13.4.17 · the portfolio's criteria agreed outside the system · their final PDF */
  criteria?: { file: string; by: string; at: string }
  /** v3 · 13.4.30 · the sub-projects' values are reliable for a geographic cost reading */
  reliable?: boolean
  /** v3 · 13.2.6 · 6.2 · 7.2 · the body's session the portfolio sits on · its members' votes and minutes */
  session?: { id: string; votes: Record<string, Vote>; minutes?: string; proxied?: string[] }
  /** v3 · 13.2.6 · 13.4.4 · the supervisor's study by the same weighted criteria as a project's (3.2.13) */
  study?: { scores: Record<string, number>; note: string; by: string; at: string }
  /** v3 · 13.4.43 · a cancellation and its recovery at the portfolio's level */
  cancel?: { by: string; at: string; reason: string }
  recovery?: { due: number; receipts: { amount: number; ref: string; file: string; by: string; at: string }[]; released: number }
}
export type PfCloseStage = 'supervisor' | 'manager' | 'executive' | 'evalDraft' | 'evalManager' | 'evalExecutive' | 'returned'
export const PF_CLOSE_SAY: Record<PfCloseStage, string> = {
  supervisor: 'التقرير الشامل عند مشرف المنح', manager: 'التقرير الشامل عند مدير المنح', executive: 'التقرير الشامل عند المدير التنفيذي',
  evalDraft: 'تقييم المحفظة · يعدّه مشرف المنح', evalManager: 'التقييم عند مدير المنح', evalExecutive: 'التقييم عند المدير التنفيذي', returned: 'معاد للشريك',
}
/* v3 · 13.2.30 · the closing procedure's matrix and evaluation questions · the closing store registers them */
let pfApprover: (key: 'report' | 'eval', value: number) => 'ceo' | 'grants-manager' = () => 'ceo'
let pfCriteria: () => { key: string; label: string; weight: number }[] = () => [{ key: 'goals', label: 'تحقيق الأهداف', weight: 40 }, { key: 'quality', label: 'جودة التنفيذ', weight: 25 }, { key: 'time', label: 'الالتزام بالمدة', weight: 15 }, { key: 'money', label: 'كفاءة الصرف', weight: 20 }]
export const setPfCloseRules = (approver: typeof pfApprover, criteria: typeof pfCriteria) => { pfApprover = approver; pfCriteria = criteria }
export const pfApproverOf = (pf: PortfolioRec, key: 'report' | 'eval') => pfApprover(key, pf.total)
export const pfEvalScore = (pf: PortfolioRec): number | null => {
  const c = pf.close.evaluation?.criteria ?? []
  if (!c.length || c.some((x) => x.rating === null)) return null
  const w = c.reduce((n, x) => n + x.weight, 0) || 1
  return Math.round(c.reduce((n, x) => n + x.weight * ((x.rating ?? 0) / 5), 0) / w * 100)
}
export const PORTFOLIOS: PortfolioRec[] = []
export const pfById = (id: string) => PORTFOLIOS.find((p) => p.id === id)
export const pfOfEntity = (entityId: string) => PORTFOLIOS.filter((p) => p.entityId === entityId)

export const PF_STAGE_SAY: Record<PortfolioStage, string> = {
  draft: 'مسودة', supervisor: 'دراسة · مشرف المنح', manager: 'بانتظار مدير المنح', ceo: 'بانتظار المدير التنفيذي', committee: 'عند اللجنة التنفيذية', board: 'عند مجلس الأمناء',
  returned: 'معادة للاستكمال', approved: 'معتمدة · تحت التنفيذ', rejected: 'مرفوضة', closing: 'قيد الإغلاق', closed: 'مغلقة', cancelled: 'ملغاة',
}
export const PF_STAGE_TONE: Record<PortfolioStage, 'mute' | 'warn' | 'teal' | 'ok' | 'no' | 'ret'> = {
  draft: 'mute', supervisor: 'warn', manager: 'warn', ceo: 'warn', committee: 'warn', board: 'warn', returned: 'ret', approved: 'teal', rejected: 'no', closing: 'warn', closed: 'ok', cancelled: 'no',
}
export const SUB_STATE_SAY: Record<SubState, string> = {
  draft: 'مسودة', submitted: 'مرفوع', study: 'قيد الدراسة', pending: 'بانتظار الاعتماد', approved: 'معتمد', closing: 'قيد الإغلاق',
  done: 'مكتمل', stalled: 'متعثر', excluded: 'مستبعد / ملغى', rejected: 'مرفوض',
}
export const SUB_STATE_TONE: Record<SubState, 'mute' | 'warn' | 'ok' | 'no' | 'teal'> = {
  draft: 'mute', submitted: 'warn', study: 'warn', pending: 'warn', approved: 'teal', closing: 'warn', done: 'ok', stalled: 'no', excluded: 'mute', rejected: 'no',
}

/** The portfolio's financial position · the ceiling counts the approved and the pending (13.4.6 · 13.2.18 · 13.4.33) */
export function pfMoney(pf: PortfolioRec) {
  const approved = pf.items.filter(isLiveSub).reduce((s, x) => s + x.amount, 0)
  /* v3 · 0.sub.3 · held inside the portfolio once the supervisor recommends it */
  const pending = pf.items.filter((x) => x.state === 'pending' && x.rec?.outcome !== 'reject').reduce((s, x) => s + x.amount, 0)
  const asked = pf.items.filter((x) => x.state === 'submitted' || x.state === 'study').reduce((s, x) => s + x.amount, 0)
  const pays = EHSAN_PAYS.filter((p) => p.target.kind !== 'project' && p.target.pfId === pf.id)
  const reqPaid = pf.requests.filter((r) => r.state === 'paid').reduce((s, r) => s + r.amount, 0)
  const reqOpen = pf.requests.filter((r) => ['supervisor', 'eligible', 'manager', 'exec', 'finance', 'order'].includes(r.state)).reduce((s, r) => s + r.amount, 0)
  const recorded = sumOf(pays, live) + reqPaid + reqOpen
  const confirmed = sumOf(pays, (x) => x.state === 'confirmed') + reqPaid
  return {
    total: pf.total, approved, pending, asked, available: pf.total - approved - pending,
    recorded, confirmed, spent: confirmed, remaining: pf.total - confirmed,
    approvedCount: pf.items.filter(isLiveSub).length,
  }
}
/** A sub-project's own money · its value is a split, its payments are the platform's (13.2.25) */
export function subMoney(pf: PortfolioRec, s: SubProject) {
  const list = paysOf({ kind: 'sub', pfId: pf.id, subId: s.id })
  const recorded = sumOf(list, live)
  const confirmed = sumOf(list, (x) => x.state === 'confirmed')
  return { recorded, confirmed, remaining: s.amount - confirmed }
}

/** Sub-projects open only after the portfolio, its plan and its agreement are approved (13.2.10 · 13.4.7) */
export function subsGate(pf: PortfolioRec): { ok: boolean; why: string } {
  if (pf.stage !== 'approved') return { ok: false, why: pf.stage === 'closed' ? 'المحفظة مغلقة' : pf.stage === 'cancelled' ? 'المحفظة ملغاة' : pf.stage === 'closing' ? 'المحفظة في الإغلاق · لا مشاريع فرعية جديدة' : /* doc 13.2.5 */ 'بعد الاعتماد النهائي للمحفظة' }
  if (pf.plan.state !== 'approved') return { ok: false, why: /* doc 13.2.10 */ 'بعد اعتماد خطة المحفظة' }
  if (pf.agreement.state !== 'signed') return { ok: false, why: /* doc 13.2.10 */ 'بعد توقيع اتفاقية المحفظة' }
  return { ok: true, why: '' }
}

export interface SubDraft { name: string; region: string; city?: string; amount: number; beneficiaries: number; outputs: string; files: string[]; activityId?: string
  /* Client 20 Oct (#18) · optional on the form · the sub-project's page completes them */
  implementer?: SubImplementer; implementerName?: string; finalBeneficiaries?: number; cost?: number; evalFile?: string }

/** v3 · 12.4.13 · the portfolio plan's activities a sub-project can serve · a phase without activities
    stands for one */
export function pfActivities(pf: PortfolioRec): { id: string; label: string }[] {
  return pf.plan.phases.flatMap((ph) => (ph.activities?.length ? ph.activities.map((a) => ({ id: a.id, label: `${ph.name} · ${a.name}` })) : [{ id: `ph:${ph.id}`, label: ph.name }]))
}
/** v3 · 12.4.13 · how an activity reads from its sub-projects · evidence beside it, or its progress
    updated · `PF_ACTIVITY_MODE` is the setting */
export const PF_ACTIVITY_MODE: { mode: 'evidence' | 'update' } = (() => { try { return JSON.parse(localStorage.getItem('ab-cfg-pf-activity') ?? '') as { mode: 'evidence' | 'update' } } catch { return { mode: 'update' } } })()
export const setPfActivityMode = (mode: 'evidence' | 'update') => { PF_ACTIVITY_MODE.mode = mode; try { localStorage.setItem('ab-cfg-pf-activity', JSON.stringify(PF_ACTIVITY_MODE)) } catch { /* blocked */ } }
export function pfActivityProgress(pf: PortfolioRec, activityId: string): { linked: number; done: number; pct: number; say: string } {
  const subs = pf.items.filter((x) => x.activityId === activityId && isLiveSub(x))
  const done = subs.filter((x) => x.state === 'done').length
  const pct = subs.length ? Math.round((done / subs.length) * 100) : 0
  const say = !subs.length ? 'لا مشاريع فرعية مرتبطة' : PF_ACTIVITY_MODE.mode === 'update'
    ? `${done} من ${subs.length} مكتمل · الإنجاز ${pct}%${done === subs.length ? ' · النشاط مكتمل' : ''}`
    : `${done} من ${subs.length} مكتمل · شواهد للنشاط`
  return { linked: subs.length, done, pct, say }
}
/** Before a sub-project is saved or sent · complete, valid, not a duplicate (13.2.13 · 13.4.12 · 13.4.13) */
export function subIssues(pf: PortfolioRec, d: SubDraft, except?: string): string[] {
  const out: string[] = []
  /* v3 · 13.4.16 · the name, region and value always · the rest as the portfolio's form asks */
  const req = pf.subFields ?? SUB_FIELDS_DEFAULT
  if (!d.name.trim()) out.push('اسم المشروع الفرعي')
  if (!d.region) out.push('المنطقة')
  if (!(d.amount > 0)) out.push('قيمة المشروع الفرعي أكبر من صفر')
  if (req.includes('beneficiaries') && !(d.beneficiaries > 0)) out.push('عدد المستفيدين المستهدف')
  if (req.includes('outputs') && !d.outputs.trim()) out.push('المخرجات المستهدفة')
  if (req.includes('files') && !d.files.length) out.push('مرفق واحد على الأقل (الدراسة أو العرض)')
  if (req.includes('city') && !d.city?.trim()) out.push('المدينة')
  if (req.includes('activity') && !d.activityId) out.push('نشاط خطة المحفظة')
  const key = (n: string, r: string) => `${n.trim().replace(/\s+/g, ' ')}|${r}`
  if (pf.items.some((x) => x.id !== except && x.state !== 'rejected' && x.state !== 'excluded' && key(x.name, x.region) === key(d.name, d.region))) out.push('مشروع بالاسم والمنطقة نفسيهما مسجّل في المحفظة')
  return out
}

/** The ceiling · what's approved and pending plus what's sent may not exceed the portfolio (13.2.14 · 13.4.14 · 13.4.15) */
export function capIssue(pf: PortfolioRec, ids: string[]): string {
  const m = pfMoney(pf)
  const ask = pf.items.filter((x) => ids.includes(x.id) && x.state === 'draft').reduce((s, x) => s + x.amount, 0)
  /* v3 · 0.sub.1 · drafts may exceed the balance · what's sent may not, with what's already sent */
  return ask > m.available - m.asked ? `المطلوب ${nf.format(ask)} يتجاوز الرصيد المتاح في المحفظة ${nf.format(Math.max(0, m.available))} · خفّض القيمة أو أرسل جزءًا منها` : ''
}

/** Execution indicators · counts, states, progress, reach and the regions (13.2.22 · 13.4.28) */
export function pfIndicators(pf: PortfolioRec) {
  const ap = pf.items.filter(isLiveSub)
  const by = (s: SubState) => ap.filter((x) => x.state === s).length
  const progress = ap.length ? Math.round(ap.reduce((s, x) => s + (x.exec?.progress ?? 0), 0) / ap.length) : 0
  const regions = new Map<string, number>()
  for (const x of ap) regions.set(x.region, (regions.get(x.region) ?? 0) + 1)
  return {
    count: ap.length, done: by('done'), running: by('approved'), closing: by('closing'), stalled: by('stalled'), waiting: by('approved'), progress,
    target: ap.reduce((s, x) => s + x.beneficiaries, 0), reached: ap.reduce((s, x) => s + (x.exec?.reached ?? 0), 0),
    regions: [...regions].sort((a, b) => b[1] - a[1]),
  }
}

/** Closing requirements on every sub-project (13.2.29 · 13.4.35) */
export function pfCloseChecks(pf: PortfolioRec): { key: string; label: string; ok: boolean }[] {
  const sent = pf.items.filter((x) => x.state !== 'draft')
  const done = pf.items.filter((x) => x.state === 'done')
  const m = pfMoney(pf)
  /* v3 · 13.2.29 · every sub-project in a final state (complete, excluded or cancelled, rejected, stalled) · drafts
     never sent are set aside at the closing */
  return [
    { key: 'subs', label: 'لا مشاريع فرعية مرفوعة أو قيد الدراسة أو بانتظار الاعتماد', ok: !pf.items.some((x) => x.state === 'submitted' || x.state === 'study' || x.state === 'pending') },
    { key: 'done', label: 'كل المشاريع الفرعية في حالة نهائية · مكتمل أو متعثر أو مستبعد أو مرفوض', ok: sent.length > 0 && sent.every((x) => SUB_FINAL.includes(x.state)) },
    { key: 'results', label: 'النتائج الفعلية للمكتمل معتمدة', ok: done.length > 0 && done.every((x) => Boolean(x.exec?.results.trim()) && (x.exec?.reached ?? 0) > 0) },
    { key: 'pays', label: 'لا طلب صرف مفتوح · الدفعات مصروفة أو معادة', ok: m.recorded === m.confirmed },
    { key: 'cap', label: 'الدفعات في حدود قيمة المحفظة', ok: m.confirmed <= pf.total },
    { key: 'report', label: 'التقرير الشامل معتمد', ok: ['evalDraft', 'evalManager', 'evalExecutive'].includes(pf.close.stage ?? '') || pf.stage === 'closed' },
    { key: 'eval', label: 'تقييم المحفظة مكتمل', ok: pfEvalScore(pf) !== null },
  ]
}

/* ── Who acts · the usual path and financial authority (13.2.6) ── */

/** The level whose cap covers the portfolio's value · its decision is final */
export const pfDecider = (pf: PortfolioRec) => approverFor(pf.total).key

export type PfAct = 'submit' | 'recommend' | 'approve' | 'return' | 'reject'
export interface PfAction { act: PfAct; label: string; kind: 'btn-p' | 'btn-2' | 'btn-d'; needsNote?: boolean }
export function pfActions(pf: PortfolioRec, role: RoleKey, asPartner = false): PfAction[] {
  if (asPartner) return (pf.stage === 'draft' || pf.stage === 'returned') && pf.origin === 'partner' ? [{ act: 'submit', label: 'إرسال الطلب', kind: 'btn-p' }] : []
  if ((pf.stage === 'draft' || pf.stage === 'returned') && pf.origin === 'internal' && role === 'supervisor') return [{ act: 'submit', label: 'إرسال للدراسة', kind: 'btn-p' }]
  if (pf.stage === 'supervisor' && role === 'supervisor') return [
    { act: 'recommend', label: 'توصية بالاعتماد وحجز القيمة', kind: 'btn-p' },
    { act: 'return', label: 'إعادة للاستكمال', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'اعتذار عن الدعم', kind: 'btn-d', needsNote: true },
  ]
  /* Re-audit 7 Oct · the portfolio climbs the approval matrix by its value like any project: the
     first level whose cap covers it decides, and the levels above the executive director record
     their decision as the committee's or the board's secretary (13.2.6 · 5.4.25) */
  const decider = pfDecider(pf)
  if (pf.stage === 'manager' && role === 'grants-manager') return [
    { act: 'approve', label: decider === 'manager' ? 'اعتماد نهائي' : 'موافقة ورفع للمدير التنفيذي', kind: 'btn-p' },
    { act: 'return', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true },
    /* v3 · 13.2.6 · the same path as a project · the manager may refuse within his authority */
    ...(decider === 'manager' ? [{ act: 'reject' as const, label: 'رفض', kind: 'btn-d' as const, needsNote: true }] : []),
  ]
  if (pf.stage === 'ceo' && role === 'ceo') return [
    { act: 'approve', label: decider === 'exec' ? 'اعتماد نهائي' : 'موافقة وإحالة للجنة التنفيذية', kind: 'btn-p' },
    { act: 'return', label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'رفض', kind: 'btn-d', needsNote: true },
  ]
  if (pf.stage === 'committee' && APPROVAL_RULES.committeeBy.includes(role)) return [
    { act: 'approve', label: decider === 'committee' ? 'تسجيل قرار اللجنة · اعتماد' : 'تسجيل قرار اللجنة · إحالة للمجلس', kind: 'btn-p', needsNote: true },
    { act: 'return', label: 'إعادة للمدير التنفيذي', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'تسجيل قرار اللجنة · رفض', kind: 'btn-d', needsNote: true },
  ]
  if (pf.stage === 'board' && APPROVAL_RULES.boardBy.includes(role)) return [
    { act: 'approve', label: 'تسجيل قرار المجلس · اعتماد', kind: 'btn-p', needsNote: true },
    { act: 'return', label: 'إعادة للجنة التنفيذية', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'تسجيل قرار المجلس · رفض', kind: 'btn-d', needsNote: true },
  ]
  return []
}
export function pfStops(pf: PortfolioRec, act: PfAct, shares?: PortfolioRec['shares']): string[] {
  const out: string[] = []
  if (act === 'submit') {
    if (!pf.name.trim() || !(pf.total > 0) || !pf.goals.trim()) out.push('أكمل اسم المحفظة وقيمتها وأهدافها')
    if (!pf.files.length) out.push('أرفق وثيقة المحفظة')
    if (!isStrategic(pf.entityId)) out.push('الجهة ليست شريكًا استراتيجيًّا معتمدًا')
  }
  /* v3 · 13.2.6 · client 18 Oct · decisions 14 and 33 · the body decides in its session like a project ·
     no per-member votes · the CEO records the body's final decision with the minutes */
  if ((pf.stage === 'committee' || pf.stage === 'board') && (act === 'approve' || act === 'reject')) {
    const it = pf.session
    if (!it) out.push('أدرج المحفظة على جدول جلسة')
    else if (!it.minutes) out.push('أرفق محضر الاجتماع')
  }
  if (act === 'recommend') {
    /* v3 · 13.2.6 · 13.4.4 · the portfolio is studied by the evaluation criteria before its recommendation */
    out.push(...pfStudyIssues(pf))
    const sh = shares ?? pf.shares
    if (!sh?.length) out.push(/* doc 13.2.7 */ 'اختر بند الميزانية لحجز قيمة المحفظة')
    else if (sh.reduce((s, x) => s + x.amount, 0) !== pf.total) out.push(`مجموع الحجز يساوي قيمة المحفظة ${nf.format(pf.total)}`)
    /* Batch 6 · a hold split across lines or budgets · each line and its levels must cover its part */
    else out.push(...linkIssues({ projectId: pf.id, projectName: pf.name, by: '', shares: sh }, pf.total))
  }
  return out
}

/* ── Operations ── */

type Op = { by: string; at: string } & (
  | { op: 'partnerReq'; entityId: string; name: string; allowed: PType[]; platform: boolean }
  | { op: 'partnerDecide'; entityId: string; outcome: 'approve' | 'reject'; note: string }
  | { op: 'partnerTypes'; entityId: string; allowed: PType[] }
  | { op: 'route'; projectId: string; platform: boolean; type: PType; party?: string }
  /* Batch 7 · partners#4 · the supervisor proposes the routing in the study, the executive decides it
     (11.1.input-1 · 11.2.4) · it was one click for either */
  | { op: 'routePropose'; projectId: string; platform: boolean; type: PType; note: string; party?: string }
  | { op: 'routeDecide'; projectId: string; accept: boolean; note: string }
  | { op: 'pfCreate'; pf: Pick<PortfolioRec, 'id' | 'name' | 'entityId' | 'total' | 'track' | 'field' | 'goals' | 'summary' | 'files' | 'origin' | 'channel'>; send: boolean; fromProject?: string }
  | { op: 'pfAct'; id: string; act: PfAct; note: string; shares?: PortfolioRec['shares']; final?: boolean }
  | { op: 'pfPlan'; id: string; phases: PfPhase[] }
  | { op: 'pfPlanAct'; id: string; act: 'send' | 'toManager' | 'approve' | 'return'; note: string }
  | { op: 'pfAgr'; id: string; act: 'draft' | 'send' | 'approve' | 'return' | 'sign' | 'countersign'; note: string; file?: string }
  | { op: 'pfSchedule'; id: string; slots: EhSlot[] }
  | { op: 'subAdd'; pfId: string; sub: Omit<SubProject, 'state' | 'addedBy' | 'addedAt'> }
  | { op: 'subDrop'; pfId: string; subId: string }
  | { op: 'subSend'; pfId: string; reqId: string; subIds: string[] }
  | { op: 'subDecide'; pfId: string; decisions: { subId: string; outcome: 'approve' | 'reject'; reason?: string; note?: string }[] }
  | { op: 'subStudy'; pfId: string; subIds: string[] }
  | { op: 'subRec'; pfId: string; decisions: { subId: string; outcome: 'approve' | 'reject'; note: string }[] }
  | { op: 'subComplete'; pfId: string; subId: string; act: 'approve' | 'return'; note: string }
  | { op: 'subStall'; pfId: string; subId: string; reason: string }
  | { op: 'subExclude'; pfId: string; subId: string; reason: string }
  /* Client 20 Oct (#17) · the supervisor sends it back to the entity or rejects it outright · the manager
     returns it to the supervisor for completion */
  | { op: 'subReturn'; pfId: string; subId: string; note: string; seat: 'supervisor' | 'grants-manager' }
  | { op: 'subRejectDirect'; pfId: string; subId: string; note: string }
  /* Client 20 Oct (#18 · #27) · the sub-project's own data · and the results the entity sends */
  | { op: 'subInfo'; pfId: string; subId: string; info: Pick<SubProject, 'implementer' | 'implementerName' | 'city' | 'finalBeneficiaries' | 'cost' | 'evalFile'> }
  | { op: 'subResults'; pfId: string; subId: string; cost: number; reached: number; files: string[]; note: string }
  | { op: 'pfForm'; id: string; fields: SubField[] }
  | { op: 'pfCriteria'; id: string; file: string }
  | { op: 'pfReliable'; id: string; on: boolean }
  | { op: 'pfAgenda'; id: string; sessionId: string }
  | { op: 'pfVote'; id: string; member: string; vote: Vote; proxied: boolean }
  | { op: 'pfMinutes'; id: string; file: string }
  | { op: 'pfCloseAct'; id: string; act: 'approve' | 'return'; note: string; next?: PfCloseStage }
  | { op: 'pfEvalSave'; id: string; criteria: { key: string; label: string; weight: number; rating: number | null }[]; notes: string }
  | { op: 'pfEvalAct'; id: string; act: 'send' | 'approve' | 'return'; note: string; toExec?: boolean }
  | { op: 'pfCancel'; id: string; reason: string; recover: number }
  | { op: 'pfStudy'; id: string; scores: Record<string, number>; note: string }
  | { op: 'pfRecReceipt'; id: string; amount: number; ref: string; file: string }
  | { op: 'subExec'; pfId: string; subId: string; exec: Omit<SubExec, 'at' | 'by'> }
  | { op: 'pay'; pay: Omit<EhsanPay, 'state' | 'by' | 'at'> }
  | { op: 'payAct'; id: string; act: 'confirm' | 'return'; note: string }
  | { op: 'pfReq'; pfId: string; req: Pick<PfRequest, 'id' | 'no' | 'amount' | 'why' | 'docs'> }
  | { op: 'pfReqAct'; pfId: string; reqId: string; act: 'qualify' | 'permit' | 'approve' | 'order' | 'pay' | 'return'; ref?: string; note: string; amount?: number; toExec?: boolean }
  | { op: 'pfReport'; id: string; report: string; evidence: string[] }
  | { op: 'extDoc'; projectId: string; file: string }
  | { op: 'subLink'; pfId: string; subId: string; activityId: string }
  | { op: 'pfClose'; id: string }
  | { op: 'ehSchedule'; projectId: string; slots: EhSlot[] }
  | { op: 'ehOp'; projectId: string; kind: string; ref?: string; note: string }
  | { op: 'ehReport'; projectId: string; report: string; evidence: string[] }
  | { op: 'ehClose'; projectId: string }
  | { op: 'extParty'; id: string; name: string; region: string; city: string; transfer: string; refs: string }
  | { op: 'extCfg'; party: ExtPartyField[]; project: ExtProjectField[] }
  | { op: 'extFiles'; projectId: string; files: string[] }
  | { op: 'extMeta'; projectId: string; meta: ExtMeta }
  | { op: 'ehExec'; projectId: string; exec: Omit<EhExec, 'by' | 'at'> }
  | { op: 'ehCloseSend'; projectId: string; report: string; evidence: string[] }
  | { op: 'ehCloseAct'; projectId: string; act: 'approve' | 'return'; note: string; paid?: number; outcome?: ExtCloseOutcome; redirect?: { purpose: string; decision: string; file: string } }
)

const KEY = 'ab-partner-ops'
let ops: Op[] = []
let version = 0
let liveRun = false
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
/** Re-renders on a partner move · and on a budget move, since the holds are read from it */
export function usePartners(): number {
  useBudget()
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}

const notify = (to: string[], title: string, context: string, href: string) => {
  for (const t of to) PARTNER_NOTES.unshift({ id: `ptn-${PARTNER_NOTES.length + 1}`, to: t, title, context, at: actDay(), href })
}
const plog = (pf: PortfolioRec, by: string, what: string, at: string) => { pf.log.push({ at: day(at), by, what }) }
const partnerName = (entityId: string) => entityById(entityId)?.name ?? profileOf(entityId)?.name ?? ''

/** The projects list carries a portfolio as a row of its own type · created ones join it */
function listRow(pf: PortfolioRec) {
  const row = portfolioRows.find((r) => r.portfolioId === pf.id)
  const base = row ?? (portfolioRows[0] ? { ...portfolioRows[0] } : undefined)
  if (!base) return
  Object.assign(base, {
    id: pf.id, name: pf.name, entityId: pf.entityId, entityName: partnerName(pf.entityId), portfolioId: pf.id,
    amountRequested: pf.total, amountGranted: pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed' ? pf.total : 0,
    amountSpent: pfMoney(pf).spent, goal: `${pf.items.filter(isLiveSub).length} مشاريع تحت المحفظة`,
    stage: PF_STAGE_SAY[pf.stage], statusGroup: pf.stage === 'closed' ? 'مكتمل' : pf.stage === 'rejected' ? 'مرفوض' : pf.stage === 'cancelled' ? 'ملغى' : pf.stage === 'closing' ? 'قيد الإغلاق' : pf.stage === 'approved' ? 'تحت التنفيذ' : 'قيد الدراسة',
    owner: pf.owner, submittedAt: pf.openedAt, track: pf.track, partnerType: 'محفظة',
  })
  if (!row) portfolioRows.push(base)
  /* v3 · 13.2.27 · its approved sub-projects join the general lists, marked «مشروع فرعي» and tied to it */
  for (let i = subRows.length - 1; i >= 0; i--) if (subRows[i]!.portfolioId === pf.id) subRows.splice(i, 1)
  /* Re-audit 17 Oct · v3 · 13.4.15 · a sub-project's dictionary has no «تحت التنفيذ» · approved reads «معتمد» */
  const SG: Partial<Record<SubState, string>> = { approved: 'معتمد', closing: 'قيد الإغلاق', done: 'مكتمل', stalled: 'متعثر' }
  for (const x of pf.items.filter(isLiveSub)) {
    subRows.push({
      ...base, id: `${pf.id}/${x.id}`, name: x.name, region: x.region, city: x.city ?? '', track: x.track ?? pf.track, field: x.field ?? pf.field, goal: pf.name,
      amountRequested: x.amount, amountGranted: x.amount, amountSpent: 0, beneficiaries: x.beneficiaries, stage: SUB_STATE_SAY[x.state],
      statusGroup: (SG[x.state] ?? 'معتمد') as typeof base.statusGroup, type: 'مشروع فرعي', portfolioId: pf.id, partnerType: undefined,
    })
  }
}

const setStage = (projectId: string, stage: string) => {
  const p = projectOf(projectId)
  const meta = stageMeta(stage)
  if (!p || !meta) return
  p.stage = stage
  p.statusGroup = meta.group
  p.stageLimit = meta.limit
  p.hoursInStage = 0
}

/** A confirmed payment is money Ehsan already paid · recorded once on the hold by its reference, never a new disbursement (11.4.23) */
function settleOnBudget(p: EhsanPay, by: string) {
  if (!liveRun) return
  /* v3 · 9.4.5 · a project's money left on the system's permit · its transfer moved the hold already */
  if (p.target.kind === 'project') return
  const holder = p.target.pfId
  if (hasFunding(holder) && !isPaidRef(p.ref)) recordPaid(holder, p.amount, p.ref, by)
}

/** The final step of a portfolio's closing · its data kept, its savings back on the line (13.2.31) */
function closeOut(pf: PortfolioRec, by: string, at: string) {
  pf.stage = 'closed'
  pf.close.closedBy = by
  pf.close.closedAt = day(at)
  pf.close.stage = undefined
  /* drafts never sent are set aside, on the log */
  const drafts = pf.items.filter((x) => x.state === 'draft')
  if (drafts.length) { pf.items = pf.items.filter((x) => x.state !== 'draft'); plog(pf, 'النظام', `استُبعدت ${drafts.length} مسودة لم تُرفع`, at) }
  if (liveRun && hasFunding(pf.id)) releaseSavings(pf.id, by, 'أُغلقت المحفظة')
  plog(pf, by, 'أُغلقت المحفظة وفق إجراء الإغلاق · حُفظت بياناتها ومشاريعها الفرعية ونتائجها وأُعيد الوفر لبنده', at)
  notify([partnerName(pf.entityId)], `أُغلقت المحفظة · ${pf.name}`, 'بياناتها محفوظة للقراءة', ROUTES.portfolio(pf.id))
  listRow(pf)
}
const sessionSay = (pf: PortfolioRec) => {
  const it = pf.session
  if (!it) return ''
  return `جلسة ${it.id} · قرار الجهة كما ورد في المحضر${it.minutes ? ` · المحضر ${it.minutes}` : ''}`
}

function apply(o: Op) { asOf(o.at, () => applyOp(o)) }
function applyOp(o: Op) {
  switch (o.op) {
    case 'partnerReq': {
      if (profileOf(o.entityId)) return
      PROFILES.push({ entityId: o.entityId, name: o.name, allowed: o.allowed, platform: o.platform, state: 'review', requestedBy: o.by, at: day(o.at) })
      notify([MGR()], `اعتماد شريك استراتيجي · ${o.name}`, 'سُجّلت الجهة بنوع «شريك استراتيجي» · بانتظار اعتمادك', ROUTES.partners)
      return
    }
    case 'partnerDecide': {
      const p = profileOf(o.entityId)
      if (!p || p.state !== 'review') return
      p.state = o.outcome === 'approve' ? 'approved' : 'rejected'
      p.note = o.note || undefined
      p.decidedBy = o.by
      notify([p.requestedBy], `${o.outcome === 'approve' ? 'اعتُمد' : 'رُفض'} الشريك الاستراتيجي`, p.name, ROUTES.partners)
      return
    }
    case 'partnerTypes': {
      const p = profileOf(o.entityId)
      if (p && o.allowed.length) p.allowed = o.allowed
      return
    }
    case 'route': {
      const p = projectOf(o.projectId)
      /* Re-audit 7 Oct · the stage is checked when the decision is taken, not on replay: at load the
         project has already moved on (approved, in execution), and the routing used to drop away */
      if (!p || (liveRun && p.statusGroup !== 'قيد الدراسة')) return
      /* v3 · BPD-011 · the external party chosen · an older routing named the platform alone */
      const party = o.platform ? entityById(o.party ?? '860') : undefined
      p.platform = o.platform ? party?.name ?? 'منصة إحسان' : undefined
      p.externalId = o.platform ? party?.id ?? '860' : undefined
      p.type = o.platform ? 'مشروع خارجي' : p.type === 'مشروع خارجي' ? 'مشروع عادي' : p.type
      /* Batch 4 · 8 Oct · a regular entity's project routed through Ehsan is an independent project
         too · the type was set only for a strategic partner's projects, so 21038 read «مستقل» on its
         Ehsan card and agreement tab (`viaEhsan`) and «عادي» on its data tab and approval path ·
         a portfolio stays a strategic partner's only */
      const strategic = isStrategic(p.entityId)
      p.partnerType = o.platform || strategic ? (strategic && o.type === 'portfolio' ? 'محفظة' : 'مستقل') : undefined
      /* Replayed after the approval path · an independent project through Ehsan approved earlier
         belongs in execution, not at the agreement (11.2.17) */
      if (!liveRun && p.platform && p.partnerType === 'مستقل' && p.stage === 'اعتماد الإتفاقية') setStage(p.id, ehScheduleOf(p.id).length ? 'المشرف إذن الصرف' : EXT_PRE_STAGE)
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'قرار التوجيه', note: o.platform ? `يُدعم عبر جهة خارجية · ${p.platform}` : 'يُدعم مباشرة دون جهة خارجية' })
      return
    }
    case 'routePropose': {
      const p = projectOf(o.projectId)
      if (!p || (liveRun && p.statusGroup !== 'قيد الدراسة')) return
      PROPOSALS.set(p.id, { platform: o.platform, type: o.type, note: o.note, by: o.by, at: day(o.at), party: o.party })
      const via = o.platform ? `عبر ${entityById(o.party ?? '860')?.name ?? 'جهة خارجية'}` : 'دعم مباشر'
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'اقتراح التوجيه', note: `${via}${o.note ? ` · ${o.note}` : ''}` })
      notify([roleByKey('ceo').name], `اقتراح توجيه بانتظار قرارك · ${p.name}`, via, ROUTES.project(p.id))
      return
    }
    case 'routeDecide': {
      const p = projectOf(o.projectId)
      const pr = p && PROPOSALS.get(p.id)
      if (!p || !pr || (liveRun && p.statusGroup !== 'قيد الدراسة')) return
      PROPOSALS.delete(p.id)
      if (o.accept) applyOp({ op: 'route', projectId: p.id, platform: pr.platform, type: pr.type, party: pr.party, by: o.by, at: o.at })
      else (EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'رفض اقتراح التوجيه', note: o.note || 'يبقى التوجيه كما هو' })
      return
    }
    case 'pfCreate': {
      if (pfById(o.pf.id)) return
      const pf: PortfolioRec = {
        /* v3 · 11.4.11 · 13.4.36 · paid at the portfolio's level · no platform channel */
        ...o.pf, channel: 'direct', year: o.at.slice(0, 4), stage: o.send ? 'supervisor' : 'draft', owner: SUP, openedAt: day(o.at),
        plan: { state: 'none', phases: [] }, agreement: { state: 'none' }, schedule: [], requests: [], approvals: [], items: [],
        close: { report: '', evidence: [] }, log: [],
      }
      PORTFOLIOS.push(pf)
      if (liveRun) bindPfPlan(pf)
      plog(pf, o.by, o.pf.origin === 'partner' ? 'قدّم الشريك طلب المحفظة من البوابة' : 'أنشأ مشرف المنح المحفظة', o.at)
      if (o.fromProject) {
        const p = projectOf(o.fromProject)
        if (p) {
          /* v3 · 3.2.17 · the approved project opens the portfolio path · its hold moves with it, so the
             portfolio holds its own and the line isn't held twice */
          if (liveRun && hasFunding(p.id)) unlinkProject(p.id, o.by, 'فُعّل مسار المحفظة · الحجز ينتقل إلى المحفظة')
          p.archived = true; p.partnerType = 'محفظة'
          plog(pf, o.by, p.supportStatus === 'معتمد' ? `فُعّل مسار المحفظة للمشروع المعتمد ${p.id}` : `حُوِّل المشروع ${p.id} إلى محفظة`, o.at)
        }
      }
      if (o.send) plog(pf, o.by, 'أُرسلت للدراسة', o.at)
      listRow(pf)
      if (o.send) notify([SUP], `طلب محفظة · ${pf.name}`, partnerName(pf.entityId), ROUTES.portfolio(pf.id))
      return
    }
    case 'pfAct': {
      const pf = pfById(o.id)
      if (!pf) return
      if (o.act === 'submit') {
        if (pf.stage !== 'draft' && pf.stage !== 'returned') return
        pf.stage = 'supervisor'
        plog(pf, o.by, 'أُرسلت للدراسة', o.at)
        notify([pf.owner], `طلب محفظة للدراسة · ${pf.name}`, partnerName(pf.entityId), ROUTES.portfolio(pf.id))
      } else if (o.act === 'recommend') {
        if (pf.stage !== 'supervisor' || !o.shares?.length) return
        pf.shares = o.shares
        if (liveRun) linkProject({ projectId: pf.id, projectName: pf.name, by: o.by, shares: o.shares })
        pf.stage = 'manager'
        plog(pf, o.by, `أوصى بالاعتماد وحجز ${nf.format(pf.total)} مبدئيًّا`, o.at)
        notify([MGR()], `اعتماد محفظة · ${pf.name}`, `${nf.format(pf.total)} ريال`, ROUTES.portfolio(pf.id))
      } else if (o.act === 'approve') {
        const LEVEL: Partial<Record<PortfolioStage, Exclude<ReturnType<typeof pfDecider>, never>>> = { manager: 'manager', ceo: 'exec', committee: 'committee', board: 'board' }
        const SAY: Partial<Record<PortfolioStage, string>> = { manager: 'مدير المنح', ceo: 'المدير التنفيذي', committee: 'اللجنة التنفيذية', board: 'مجلس الأمناء' }
        const NEXT: Partial<Record<PortfolioStage, PortfolioStage>> = { manager: 'ceo', ceo: 'committee', committee: 'board' }
        const lvl = LEVEL[pf.stage]
        if (!lvl) return
        const voted = pf.session ? ` · ${sessionSay(pf)}` : ''
        if (pf.session) pf.session = undefined
        /* the level that decides, as decided then · a later change of the matrix doesn't reroute the replay */
        if ((o.final ?? lvl === pfDecider(pf)) || !NEXT[pf.stage]) {
          const who = SAY[pf.stage]
          pf.stage = 'approved'
          if (liveRun && linkOf(pf.id)) finalizeHold(pf.id, o.by)
          /* client 18 Oct (#32) · 13.2.8 · its plan opens in the plans module */
          /* 18 Oct · on replay too · the plan's own ops wait for it (quiet: no notices again) */
          openPortfolioPlan(pf.id, !liveRun)
          plog(pf, o.by, `${who === 'اللجنة التنفيذية' ? 'اعتمدتها' : 'اعتمدها'} ${who} نهائيًّا${voted}${o.note ? ` · ${o.note}` : ''} · ثُبّت الحجز وفُعّلت إدارتها`, o.at)
          notify([pf.owner, partnerName(pf.entityId)], `اعتُمدت المحفظة · ${pf.name}`, 'الخطوة التالية: الخطة والاتفاقية', ROUTES.portfolio(pf.id))
        } else {
          const to = NEXT[pf.stage]!
          plog(pf, o.by, `وافق ${SAY[pf.stage]} ورفعها إلى ${SAY[to]}${voted}${o.note ? ` · ${o.note}` : ''}`, o.at)
          pf.stage = to
          notify([to === 'ceo' ? CEO() : to === 'committee' ? 'مدير المنح' : 'المدير التنفيذي'], `اعتماد محفظة · ${pf.name}`, `${nf.format(pf.total)} ريال · عند ${SAY[to]}`, ROUTES.portfolio(pf.id))
        }
      } else if (o.act === 'return') {
        const back: Partial<Record<PortfolioStage, PortfolioStage>> = { supervisor: 'returned', manager: 'supervisor', ceo: 'manager', committee: 'ceo', board: 'committee' }
        const to = back[pf.stage]
        if (!to || !o.note.trim()) return
        pf.note = o.note
        pf.stage = to
        pf.session = undefined
        plog(pf, o.by, `أعاد ${to === 'returned' ? 'المحفظة للاستكمال' : 'المحفظة'} · ${o.note}`, o.at)
        notify([to === 'returned' ? (pf.origin === 'partner' ? partnerName(pf.entityId) : pf.owner) : to === 'supervisor' ? pf.owner : to === 'ceo' ? CEO() : MGR()], `أُعيدت المحفظة · ${pf.name}`, o.note, ROUTES.portfolio(pf.id))
      } else if (o.act === 'reject') {
        if (!['supervisor', 'manager', 'ceo', 'committee', 'board'].includes(pf.stage)) return
        const voted = pf.session ? ` · ${sessionSay(pf)}` : ''
        pf.session = undefined
        pf.stage = 'rejected'
        pf.note = `${o.note}${voted}`
        if (liveRun && linkOf(pf.id)) unlinkProject(pf.id, o.by, 'رُفضت المحفظة')
        plog(pf, o.by, `رُفضت · ${o.note}`, o.at)
        notify([pf.owner, partnerName(pf.entityId)], `رُفضت المحفظة · ${pf.name}`, o.note, ROUTES.portfolio(pf.id))
      }
      listRow(pf)
      return
    }
    case 'pfPlan': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'approved' || pf.plan.state === 'review' || pf.plan.state === 'supervisor' || pf.plan.state === 'approved') return
      pf.plan.phases = o.phases
      pf.plan.state = 'draft'
      pf.plan.by = o.by
      pf.plan.drafter = o.by === partnerName(pf.entityId) ? 'partner' : 'supervisor'
      /* v3 · 13.2.32 · every change on the portfolio is on its log */
      plog(pf, o.by, `حفظ مسودة خطة المحفظة · ${o.phases.length} مراحل`, o.at)
      return
    }
    case 'pfPlanAct': {
      const pf = pfById(o.id)
      if (!pf) return
      if (o.act === 'send' && (pf.plan.state === 'draft' || pf.plan.state === 'returned') && pf.plan.phases.length) {
        /* 12.2.6 · the partner's draft goes to the supervisor first · the supervisor's own to the manager */
        if (pf.plan.drafter === 'partner') {
          pf.plan.state = 'supervisor'
          plog(pf, o.by, 'أرسل الشريك خطة المحفظة لمشرف المنح', o.at)
          notify([pf.owner], `مراجعة خطة محفظة · ${pf.name}`, `${pf.plan.phases.length} مراحل من الشريك`, ROUTES.portfolio(pf.id))
        } else {
          pf.plan.state = 'review'
          plog(pf, o.by, 'أُرسلت خطة المحفظة لمدير المنح', o.at)
          notify([MGR()], `اعتماد خطة محفظة · ${pf.name}`, `${pf.plan.phases.length} مراحل`, ROUTES.portfolio(pf.id))
        }
      } else if (o.act === 'toManager' && pf.plan.state === 'supervisor') {
        pf.plan.state = 'review'
        plog(pf, o.by, 'راجع مشرف المنح خطة الشريك وأحالها لمدير المنح', o.at)
        notify([MGR()], `اعتماد خطة محفظة · ${pf.name}`, `${pf.plan.phases.length} مراحل`, ROUTES.portfolio(pf.id))
      } else if (o.act === 'return' && pf.plan.state === 'supervisor' && o.note.trim()) {
        pf.plan.state = 'returned'
        pf.plan.note = o.note
        plog(pf, o.by, `أعاد المشرف الخطة للشريك · ${o.note}`, o.at)
        notify([partnerName(pf.entityId)], `أُعيدت خطة المحفظة · ${pf.name}`, o.note, `${ROUTES.portfolio(pf.id)}?as=partner`)
      } else if (o.act === 'approve' && pf.plan.state === 'review') {
        pf.plan.state = 'approved'
        plog(pf, o.by, 'اعتمد مدير المنح خطة المحفظة', o.at)
      } else if (o.act === 'return' && pf.plan.state === 'review' && o.note.trim()) {
        pf.plan.state = 'returned'
        pf.plan.note = o.note
        plog(pf, o.by, `أعاد خطة المحفظة · ${o.note}`, o.at)
      }
      return
    }
    case 'pfAgr': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'approved') return
      const a = pf.agreement
      let first = false
      if (o.act === 'draft' && (a.state === 'none' || a.state === 'returned')) {
        first = true
        a.state = 'draft'
        a.body = pfAgreementText(pf)
        a.versions = [...(a.versions ?? []), { no: (a.versions?.length ?? 0) + 1, at: day(o.at), by: o.by, body: a.body }]
      }
      else if (o.act === 'send' && a.state === 'draft') { first = true; a.state = 'manager'; notify([MGR()], `اعتماد اتفاقية محفظة · ${pf.name}`, partnerName(pf.entityId), ROUTES.portfolio(pf.id)) }
      /* Batch 6 · the agreements procedure's steps (8.2.13 – 8.2.29) · manager → executive → partner →
         the foundation's counter-signature → in force */
      const was = a.state
      if (first) { /* draft or send · applied above · logged below */ }
      else if (o.act === 'approve' && a.state === 'manager') { a.state = 'executive'; notify([roleByKey('ceo').name], `اعتماد اتفاقية محفظة · ${pf.name}`, partnerName(pf.entityId), ROUTES.portfolio(pf.id)) }
      else if (o.act === 'approve' && a.state === 'executive') { a.state = 'partner'; notify([partnerName(pf.entityId)], `اتفاقية للتوقيع · ${pf.name}`, 'وقّع الاتفاقية وارفعها', `${ROUTES.portfolio(pf.id)}?as=partner`) }
      else if (o.act === 'return' && (a.state === 'manager' || a.state === 'executive') && o.note.trim()) { a.state = 'returned'; a.note = o.note; notify([pf.owner], `أُعيدت اتفاقية المحفظة · ${pf.name}`, o.note, ROUTES.portfolio(pf.id)) }
      else if (o.act === 'sign' && a.state === 'partner' && o.file) { a.state = 'foundation'; a.file = o.file; a.signedBy = o.by; notify([MGR(), pf.owner], `وقّع الشريك اتفاقية المحفظة · ${pf.name}`, 'بانتظار توقيع ممثل المؤسسة', ROUTES.portfolio(pf.id)) }
      else if (o.act === 'countersign' && a.state === 'foundation') { a.state = 'signed'; a.countersignedBy = o.by; notify([pf.owner, partnerName(pf.entityId)], `سرت اتفاقية المحفظة · ${pf.name}`, 'يمكن تسجيل المشاريع الفرعية', ROUTES.portfolio(pf.id)) }
      else return
      const SAY: Record<string, string> = {
        draft: 'أعدّ مسودة الاتفاقية من النموذج', send: 'أرسل الاتفاقية لمدير المنح',
        approve: was === 'manager' ? 'اعتمد مدير المنح الاتفاقية · أُحيلت للمدير التنفيذي' : 'اعتمد المدير التنفيذي الاتفاقية · أُرسلت للشريك',
        return: `أعاد الاتفاقية · ${o.note}`, sign: 'وقّع الشريك الاتفاقية ورفعها', countersign: 'وقّع ممثل المؤسسة الاتفاقية · سرت',
      }
      plog(pf, o.by, SAY[o.act], o.at)
      return
    }
    case 'pfSchedule': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'approved' || pf.channel !== 'direct') return
      if (o.slots.reduce((s, x) => s + x.amount, 0) > pf.total) return
      pf.schedule = o.slots
      plog(pf, o.by, `حدّث جدول دفعات المحفظة · ${o.slots.length} دفعات`, o.at)
      return
    }
    case 'subAdd': {
      const pf = pfById(o.pfId)
      if (!pf || !subsGate(pf).ok || pf.items.some((x) => x.id === o.sub.id)) return
      SUB_TOP.set(pf.id, Math.max(SUB_TOP.get(pf.id) ?? 0, Number(o.sub.id.split('-S')[1]) || 0))
      /* Client 20 Oct (#19 · #20) · its serial, and its own copy of the portfolio's outputs and stages */
      const nx: SubProject = { ...o.sub, track: pf.track, field: pf.field, state: 'draft', addedBy: o.by, addedAt: day(o.at), serial: nextSubSerial(), ...pfCopy(pf) }
      slog(nx, o.by, `أنشأ المسودة · ${nf.format(o.sub.amount)} · نُسخت مخرجات المحفظة ومراحل تنفيذها`, o.at)
      pf.items.push(nx)
      plog(pf, o.by, `أضاف مسودة مشروع فرعي «${o.sub.name}» · ${nf.format(o.sub.amount)}${o.sub.files.length ? ` · ${o.sub.files.join('، ')}` : ''}`, o.at)
      return
    }
    case 'subDrop': {
      const pf = pfById(o.pfId)
      if (!pf || pf.stage === 'closed') return
      const x = pf.items.find((i) => i.id === o.subId && i.state === 'draft')
      if (!x) return
      pf.items = pf.items.filter((i) => i !== x)
      /* v3 · 13.2.32 · the draft's removal is on the log · the partner is told when it isn't his own */
      plog(pf, o.by, `حذف مسودة المشروع الفرعي «${x.name}»`, o.at)
      if (o.by !== partnerName(pf.entityId)) notify([partnerName(pf.entityId)], `حُذفت مسودة مشروع فرعي · ${pf.name}`, x.name, `${ROUTES.portfolio(pf.id)}?as=partner`)
      return
    }
    case 'subSend': {
      const pf = pfById(o.pfId)
      if (!pf || !subsGate(pf).ok || capIssue(pf, o.subIds)) return
      const list = pf.items.filter((x) => o.subIds.includes(x.id) && x.state === 'draft')
      if (!list.length) return
      /* v3 · 0.sub.1 · «مرفوع» · the supervisor studies it first (0.sub.2) */
      for (const x of list) { x.state = 'submitted'; x.reqId = o.reqId; x.stateAt = o.at; x.returned = undefined; slog(x, o.by, 'رفعته الجهة لمشرف المنح', o.at) }
      pf.approvals.push({ id: o.reqId, subIds: list.map((x) => x.id), at: day(o.at), by: o.by })
      plog(pf, o.by, `رفع ${list.length > 1 ? `${list.length} مشاريع فرعية` : `«${list[0].name}»`} للمراجعة · ${nf.format(list.reduce((s, x) => s + x.amount, 0))}`, o.at)
      notify([pf.owner], `مشاريع فرعية للدراسة · ${pf.name}`, `${list.length} مشروع`, ROUTES.portfolio(pf.id))
      listRow(pf)
      return
    }
    case 'subDecide': {
      const pf = pfById(o.pfId)
      if (!pf) return
      let ok = 0
      let no = 0
      for (const d of o.decisions) {
        const x = pf.items.find((i) => i.id === d.subId)
        if (!x || x.state !== 'pending') continue
        if (d.outcome === 'reject' && !d.reason?.trim()) continue
        x.state = d.outcome === 'approve' ? 'approved' : 'rejected'
        x.reason = d.outcome === 'reject' ? d.reason : undefined
        x.note = d.note?.trim() || undefined
        x.decidedBy = o.by
        x.decidedAt = day(o.at)
        slog(x, o.by, d.outcome === 'approve' ? `اعتمده مدير المنح${x.note ? ` · ${x.note}` : ''} · جاري التنفيذ` : `رفضه مدير المنح · ${d.reason}`, o.at)
        if (d.outcome === 'approve') { ok++; x.exec ??= { status: 'لم يبدأ', progress: 0, reached: 0, results: '', evidence: [], at: day(o.at), by: o.by } } else no++
      }
      if (ok + no) {
        plog(pf, o.by, `قرار على ${ok + no} مشروع فرعي · ${ok} معتمد${no ? ` و${no} مرفوض` : ''}`, o.at)
        notify([pf.owner, partnerName(pf.entityId)], `قرار المشاريع الفرعية · ${pf.name}`, `${ok} معتمد${no ? ` · ${no} مرفوض` : ''}`, ROUTES.portfolio(pf.id))
      }
      listRow(pf)
      return
    }
    case 'subExec': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || (x.state !== 'approved' && x.state !== 'closing') || pf.stage === 'closed') return
      x.exec = { ...o.exec, status: subExecStatus(o.exec.status), progress: Math.max(0, Math.min(100, o.exec.progress)), at: day(o.at), by: o.by }
      /* v3 · 0.sub.5 · results and evidence being recorded · «قيد الإغلاق» · 0.sub.6 · «مكتمل» only once the
         foundation approves them */
      if (o.exec.results.trim() || o.exec.evidence.length) x.state = 'closing'
      x.ready = o.exec.status === 'مكتمل'
      plog(pf, o.by, `حدّث نتائج «${x.name}» · إنجاز ${o.exec.progress} بالمئة${x.ready ? ' · طلب اعتماد النتائج' : ''}`, o.at)
      slog(x, o.by, `حدّث التنفيذ · إنجاز ${o.exec.progress} بالمئة${x.ready ? ' · طلب اعتماد النتائج' : ''}`, o.at)
      if (x.ready) notify([pf.owner], `اعتماد نتائج مشروع فرعي · ${pf.name}`, x.name, ROUTES.portfolio(pf.id))
      listRow(pf)
      return
    }
    case 'subStudy': {
      const pf = pfById(o.pfId)
      if (!pf) return
      const list = pf.items.filter((x) => o.subIds.includes(x.id) && x.state === 'submitted')
      for (const x of list) { x.state = 'study'; x.stateAt = o.at; slog(x, o.by, 'بدأ مشرف المنح الدراسة', o.at) }
      if (list.length) plog(pf, o.by, `بدأ مشرف المنح دراسة ${list.length > 1 ? `${list.length} مشاريع فرعية` : `«${list[0].name}»`}`, o.at)
      return
    }
    case 'subRec': {
      const pf = pfById(o.pfId)
      if (!pf) return
      let n = 0
      for (const d of o.decisions) {
        const x = pf.items.find((i) => i.id === d.subId)
        if (!x || (x.state !== 'study' && x.state !== 'submitted')) continue
        x.state = 'pending'
        x.stateAt = o.at
        x.rec = { outcome: d.outcome, note: d.note, by: o.by, at: day(o.at) }
        slog(x, o.by, `${d.outcome === 'approve' ? 'أوصى بالموافقة' : 'أوصى بالرفض'}${d.note ? ` · ${d.note}` : ''} · أُحيل لمدير المنح`, o.at)
        n++
      }
      if (n) {
        plog(pf, o.by, `أوصى مشرف المنح على ${n} مشروع فرعي · أُحيلت لمدير المنح · قيمة الموصى باعتماده محجوزة داخل المحفظة`, o.at)
        notify([MGR()], `اعتماد مشاريع فرعية · ${pf.name}`, `${n} مشروع بتوصية المشرف`, ROUTES.portfolio(pf.id))
      }
      listRow(pf)
      return
    }
    case 'subComplete': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || x.state !== 'closing') return
      if (o.act === 'return') {
        if (!o.note.trim()) return
        x.ready = false
        x.outcome = { by: o.by, at: day(o.at), note: o.note }
        plog(pf, o.by, `أعاد نتائج «${x.name}» للشريك · ${o.note}`, o.at)
        slog(x, o.by, `أعاد النتائج للجهة · ${o.note}`, o.at)
        notify([partnerName(pf.entityId)], `أُعيدت نتائج مشروع فرعي · ${pf.name}`, o.note, `${ROUTES.portfolio(pf.id)}?as=partner`)
        return
      }
      x.state = 'done'
      x.ready = false
      x.outcome = { by: o.by, at: day(o.at), note: o.note }
      plog(pf, o.by, `اعتمد نتائج «${x.name}» · مكتمل · دون تقرير ختامي مستقل`, o.at)
      slog(x, o.by, `اعتمد مشرف المنح النتائج · مغلق${o.note ? ` · ${o.note}` : ''}`, o.at)
      listRow(pf)
      return
    }
    case 'subStall': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || (x.state !== 'approved' && x.state !== 'closing') || !o.reason.trim()) return
      x.state = 'stalled'
      x.outcome = { by: o.by, at: day(o.at), note: o.reason }
      plog(pf, o.by, `«${x.name}» متعثر · ${o.reason}`, o.at)
      slog(x, o.by, `متعثر · ${o.reason}`, o.at)
      notify([partnerName(pf.entityId)], `مشروع فرعي متعثر · ${pf.name}`, x.name, `${ROUTES.portfolio(pf.id)}?as=partner`)
      listRow(pf)
      return
    }
    case 'subExclude': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || !['pending', 'approved', 'closing', 'stalled'].includes(x.state) || !o.reason.trim()) return
      x.state = 'excluded'
      x.outcome = { by: o.by, at: day(o.at), note: o.reason }
      /* v3 · 13.4.14 · its history kept · its value back in the portfolio's balance · a replacement takes the
         regular path */
      plog(pf, o.by, `استُبعد «${x.name}» · ${o.reason} · عادت قيمته ${nf.format(x.amount)} إلى رصيد المحفظة`, o.at)
      slog(x, o.by, `استُبعد · ${o.reason}`, o.at)
      notify([partnerName(pf.entityId)], `استُبعد مشروع فرعي · ${pf.name}`, `${x.name} · ${o.reason}`, `${ROUTES.portfolio(pf.id)}?as=partner`)
      listRow(pf)
      return
    }
    case 'subReturn': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || !o.note.trim()) return
      /* the supervisor returns what's with him to the entity · the manager returns a pending one to the supervisor */
      if (o.seat === 'supervisor' ? !['submitted', 'study'].includes(x.state) : x.state !== 'pending') return
      x.state = o.seat === 'supervisor' ? 'draft' : 'study'
      x.stateAt = o.at
      x.rec = undefined
      x.returned = { by: o.by, at: day(o.at), note: o.note, seat: o.seat }
      plog(pf, o.by, `${o.seat === 'supervisor' ? 'أعاد مشرف المنح' : 'أعاد مدير المنح'} «${x.name}» للاستكمال · ${o.note}`, o.at)
      slog(x, o.by, `${o.seat === 'supervisor' ? 'أعاده للجهة' : 'أعاده لمشرف المنح للاستكمال'} · ${o.note}`, o.at)
      if (o.seat === 'supervisor') notify([partnerName(pf.entityId)], `أُعيد مشروع فرعي للاستكمال · ${pf.name}`, `${x.name} · ${o.note}`, `${ROUTES.subProject(pf.id, x.id)}?as=partner`)
      else notify([pf.owner], `أُعيد مشروع فرعي للاستكمال · ${pf.name}`, `${x.name} · ${o.note}`, ROUTES.subProject(pf.id, x.id))
      listRow(pf)
      return
    }
    case 'subRejectDirect': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || !['submitted', 'study'].includes(x.state) || !o.note.trim()) return
      x.state = 'rejected'
      x.stateAt = o.at
      x.reason = o.note
      x.decidedBy = o.by
      x.decidedAt = day(o.at)
      plog(pf, o.by, `رفض مشرف المنح «${x.name}» مباشرة · ${o.note}`, o.at)
      slog(x, o.by, `رفضه مشرف المنح مباشرة · ${o.note}`, o.at)
      notify([partnerName(pf.entityId)], `رُفض مشروع فرعي · ${pf.name}`, `${x.name} · ${o.note}`, `${ROUTES.subProject(pf.id, x.id)}?as=partner`)
      listRow(pf)
      return
    }
    case 'subInfo': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || ['rejected', 'excluded', 'done'].includes(x.state)) return
      Object.assign(x, o.info)
      slog(x, o.by, 'حدّث بيانات المشروع الفرعي', o.at)
      return
    }
    case 'subResults': {
      const pf = pfById(o.pfId)
      const x = pf?.items.find((i) => i.id === o.subId)
      if (!pf || !x || (x.state !== 'approved' && x.state !== 'closing') || pf.stage === 'closed') return
      x.results = { cost: o.cost, reached: o.reached, files: o.files, note: o.note, at: day(o.at), by: o.by }
      /* the portfolio's indicators read the execution record · the results fill it */
      x.exec = { status: 'مكتمل', progress: 100, reached: o.reached, results: o.note, evidence: o.files, at: day(o.at), by: o.by }
      x.state = 'closing'
      x.ready = true
      x.outcome = undefined
      plog(pf, o.by, `أرسل نتائج «${x.name}» لاعتماد مشرف المنح · ${nf.format(o.reached)} مستفيد · التكلفة الفعلية ${nf.format(o.cost)}`, o.at)
      slog(x, o.by, `أرسل النتائج · ${nf.format(o.reached)} مستفيد · ${nf.format(o.cost)} ريال · ${o.files.length} مرفق`, o.at)
      notify([pf.owner], `اعتماد نتائج مشروع فرعي · ${pf.name}`, x.name, ROUTES.subProject(pf.id, x.id))
      listRow(pf)
      return
    }
    case 'pfForm': {
      const pf = pfById(o.id)
      if (!pf) return
      pf.subFields = [...o.fields]
      plog(pf, o.by, `حدّث نموذج المشروع الفرعي · ${o.fields.length ? o.fields.map((f) => SUB_FIELD_SAY[f]).join('، ') : 'الاسم والمنطقة والقيمة وحدها'}`, o.at)
      return
    }
    case 'pfCriteria': {
      const pf = pfById(o.id)
      if (!pf) return
      pf.criteria = { file: o.file, by: o.by, at: day(o.at) }
      plog(pf, o.by, `حفظ معايير المحفظة المعتمدة · ${o.file}`, o.at)
      return
    }
    case 'pfReliable': {
      const pf = pfById(o.id)
      if (!pf) return
      pf.reliable = o.on
      plog(pf, o.by, o.on ? 'أقرّ أن قيم المشاريع الفرعية موثوقة للتوزيع الجغرافي للتكلفة' : 'قيم المشاريع الفرعية لا تُستخدم للتوزيع الجغرافي للتكلفة', o.at)
      return
    }
    case 'pfAgenda': {
      const pf = pfById(o.id)
      if (!pf || (pf.stage !== 'committee' && pf.stage !== 'board')) return
      pf.session = { id: o.sessionId, votes: {} }
      plog(pf, o.by, `أُدرجت على جدول جلسة ${o.sessionId}`, o.at)
      return
    }
    case 'pfVote': {
      const pf = pfById(o.id)
      if (!pf?.session) return
      pf.session.votes[o.member] = o.vote
      if (o.proxied) pf.session.proxied = [...new Set([...(pf.session.proxied ?? []), o.member])]
      return
    }
    case 'pfMinutes': {
      const pf = pfById(o.id)
      if (!pf?.session) return
      pf.session.minutes = o.file
      plog(pf, o.by, `أرفق محضر الجلسة · ${o.file}`, o.at)
      return
    }
    case 'pay': {
      /* Validated when recorded · a replay must not re-check the reference against the budget, which
         already holds it as paid once finance confirmed */
      if (EHSAN_PAYS.some((p) => p.id === o.pay.id)) return
      const p: EhsanPay = { ...o.pay, state: 'review', by: o.by, at: day(o.at) }
      EHSAN_PAYS.push(p)
      const t = p.target
      if (t.kind === 'project') (EH_OPS.get(t.projectId) ?? EH_OPS.set(t.projectId, []).get(t.projectId)!).push({ at: day(o.at), by: o.by, kind: 'عملية على منصة الجهة', ref: p.ref, note: `سُجّلت عملية ${nf.format(p.amount)} للمراجعة المالية` })
      else { const pf = pfById(t.pfId); if (pf) plog(pf, o.by, `سجّل عملية ${nf.format(p.amount)} · ${p.ref}`, o.at) }
      notify([FIN], `دفعة عبر إحسان للمراجعة · ${nf.format(p.amount)}`, p.ref, ROUTES.partnersTab('finance'))
      return
    }
    case 'payAct': {
      const p = EHSAN_PAYS.find((x) => x.id === o.id)
      if (!p || p.state !== 'review') return
      if (o.act === 'return' && !o.note.trim()) return
      p.state = o.act === 'confirm' ? 'confirmed' : 'returned'
      p.reviewedBy = o.by
      p.reviewNote = o.note || undefined
      if (p.state === 'confirmed') settleOnBudget(p, o.by)
      const t = p.target
      if (t.kind === 'project') (EH_OPS.get(t.projectId) ?? EH_OPS.set(t.projectId, []).get(t.projectId)!).push({ at: day(o.at), by: o.by, kind: o.act === 'confirm' ? 'تأكيد مالي' : 'إعادة مالية', ref: p.ref, note: o.act === 'confirm' ? `أكّدت المالية الدفعة ${nf.format(p.amount)}` : o.note })
      else {
        const pf = pfById(t.pfId)
        if (pf) { plog(pf, o.by, o.act === 'confirm' ? `أكّدت المالية الدفعة ${p.ref}` : `أعادت المالية الدفعة ${p.ref} · ${o.note}`, o.at); listRow(pf) }
      }
      notify([p.by], o.act === 'confirm' ? `أُكّدت الدفعة ${p.ref}` : `أُعيدت الدفعة ${p.ref}`, o.note || nf.format(p.amount), t.kind === 'project' ? ROUTES.project(t.projectId) : ROUTES.portfolio(t.pfId))
      return
    }
    case 'pfReq': {
      const pf = pfById(o.pfId)
      if (!pf || pf.stage !== 'approved' || pf.channel !== 'direct' || pf.requests.some((r) => r.id === o.req.id)) return
      /* checked when raised · on replay the partner's account reads its state now, not then */
      if (liveRun && pfReqIssue(pf, o.req.no, o.req.amount)) return
      /* v3 · 13.2.24 · the requirements go to the supervisor first, like any payment (BPD-009) */
      pf.requests.push({ ...o.req, asked: o.req.amount, at: day(o.at), by: o.by, state: 'supervisor', stateAt: o.at })
      plog(pf, o.by, `رفع متطلبات الدفعة ${o.req.no} على مستوى المحفظة · ${nf.format(o.req.amount)}`, o.at)
      notify([pf.owner], `متطلبات دفعة محفظة · ${pf.name}`, nf.format(o.req.amount), ROUTES.portfolio(pf.id))
      return
    }
    case 'pfReqAct': {
      const pf = pfById(o.pfId)
      const r = pf?.requests.find((x) => x.id === o.reqId)
      if (!pf || !r || r.state === 'paid' || r.state === 'returned') return
      /* Verifier · 17 Oct · once closed or cancelled, a request only goes back · its savings were released */
      if ((pf.stage === 'closed' || pf.stage === 'cancelled') && o.act !== 'return') return
      if (o.act === 'qualify') {
        if (r.state !== 'supervisor') return
        r.state = 'eligible'
        plog(pf, o.by, `اعتمد مشرف المنح متطلبات الدفعة ${r.no} · مؤهلة للصرف`, o.at)
      } else if (o.act === 'permit') {
        if (r.state !== 'eligible' || !(o.amount && o.amount > 0)) return
        r.amount = o.amount
        r.permitBy = o.by
        r.state = 'manager'
        plog(pf, o.by, `أنشأ إذن صرف الدفعة ${r.no} · ${nf.format(o.amount)}`, o.at)
        notify([MGR()], `إذن صرف محفظة بانتظار اعتمادك · ${pf.name}`, nf.format(o.amount), ROUTES.portfolio(pf.id))
      } else if (o.act === 'approve') {
        /* client 18 Oct · decision 41 · no spending limit · only an older save carries toExec */
        if (r.state === 'manager' && o.toExec) {
          r.state = 'exec'
          plog(pf, o.by, `وافق مدير المنح على إذن الدفعة ${r.no} · فوق حدّه فأُحيل للمدير التنفيذي`, o.at)
          notify([CEO()], `إذن صرف محفظة بانتظار اعتمادك · ${pf.name}`, nf.format(r.amount), ROUTES.portfolio(pf.id))
        } else if (r.state === 'manager' || r.state === 'exec') {
          const who = r.state === 'exec' ? 'المدير التنفيذي' : 'مدير المنح'
          r.state = 'finance'
          plog(pf, o.by, `اعتمد ${who} إذن الدفعة ${r.no} · أُحيل للمالية`, o.at)
          notify([FIN], `طلب صرف محفظة · ${pf.name}`, nf.format(r.amount), ROUTES.partnersTab('finance'))
        } else return
      } else if (o.act === 'order') {
        if (r.state !== 'finance') return
        r.state = 'order'
        r.orderBy = o.by
        plog(pf, o.by, `اعتمدت المالية أمر صرف الدفعة ${r.no}`, o.at)
      } else if (o.act === 'pay') {
        if (r.state !== 'order' || !o.ref?.trim()) return
        r.state = 'paid'
        r.ref = o.ref
        if (liveRun && hasFunding(pf.id) && !isPaidRef(o.ref)) recordPaid(pf.id, r.amount, o.ref, o.by)
        plog(pf, o.by, `صرفت المالية الدفعة ${r.no} · ${o.ref}`, o.at)
      } else {
        if (!o.note.trim()) return
        const from = r.state
        r.state = 'returned'
        r.note = o.note
        plog(pf, o.by, `${from === 'finance' || from === 'order' ? 'أعادت المالية' : 'أُعيد'} طلب الدفعة ${r.no} · ${o.note}`, o.at)
        notify([pf.origin === 'partner' ? partnerName(pf.entityId) : pf.owner], `أُعيد طلب دفعة المحفظة · ${pf.name}`, o.note, ROUTES.portfolio(pf.id))
      }
      r.stateAt = o.at
      listRow(pf)
      return
    }
    case 'pfReport': {
      const pf = pfById(o.id)
      if (!pf || (pf.stage !== 'approved' && pf.stage !== 'closing')) return
      /* Verifier · 17 Oct · not while it's under review · and only once every sub-project is out of execution */
      if (pf.close.stage && pf.close.stage !== 'returned' && pf.close.stage !== 'supervisor') return
      if (liveRun && pf.items.some((x) => ['submitted', 'study', 'pending', 'approved', 'closing'].includes(x.state))) return
      pf.close.report = o.report
      pf.close.evidence = o.evidence
      pf.close.by = o.by
      pf.close.at = day(o.at)
      if (pf.close.report.trim() && pf.close.evidence.length) {
        pf.stage = 'closing'
        /* Re-audit 17 Oct · a second upload while it already sits with the supervisor replaces the files ·
           it says so once, not «رفع» again */
        const again = pf.close.stage === 'supervisor'
        /* v3 · 13.2.30 · the comprehensive report goes through the closing procedure's review */
        if (!pf.close.stage || pf.close.stage === 'returned') pf.close.stage = 'supervisor'
        pf.close.note = undefined
        plog(pf, o.by, again ? 'حدّث الشريك التقرير الشامل والشواهد قبل المراجعة' : 'رفع الشريك التقرير الشامل للمحفظة والشواهد', o.at)
        if (!again) notify([pf.owner], `تقرير شامل للمحفظة · ${pf.name}`, 'راجعه وفق إجراء الإغلاق', ROUTES.portfolio(pf.id))
      }
      listRow(pf)
      return
    }
    case 'pfClose': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'closing' || (liveRun && pfCloseChecks(pf).some((c) => !c.ok))) return
      closeOut(pf, o.by, o.at)
      return
    }
    case 'pfCloseAct': {
      const pf = pfById(o.id)
      const st = pf?.close.stage
      if (!pf || pf.stage !== 'closing' || !st || !['supervisor', 'manager', 'executive'].includes(st)) return
      if (o.act === 'return') {
        if (!o.note.trim()) return
        pf.close.stage = 'returned'
        pf.close.note = o.note
        plog(pf, o.by, `أعاد التقرير الشامل للشريك · ${o.note}`, o.at)
        notify([partnerName(pf.entityId)], `أُعيد التقرير الشامل للمحفظة · ${pf.name}`, o.note, `${ROUTES.portfolio(pf.id)}?as=partner`)
        return
      }
      /* the next seat as the matrix said when approved · the closing store's matrix is installed after this replay */
      const next: PfCloseStage = o.next ?? (st === 'supervisor' ? 'manager' : st === 'manager' && pfApproverOf(pf, 'report') === 'ceo' ? 'executive' : 'evalDraft')
      pf.close.stage = next
      if (next === 'evalDraft') pf.close.evaluation ??= { criteria: pfCriteria().map((c) => ({ ...c, rating: null })), notes: '' }
      plog(pf, o.by, next === 'evalDraft' ? 'اعتُمد التقرير الشامل · يبدأ تقييم المحفظة' : `اعتمد التقرير الشامل · أُحيل إلى ${next === 'manager' ? 'مدير المنح' : 'المدير التنفيذي'}`, o.at)
      notify([next === 'manager' ? MGR() : next === 'executive' ? CEO() : pf.owner], `${next === 'evalDraft' ? 'ابدأ تقييم المحفظة' : 'تقرير شامل بانتظار اعتمادك'} · ${pf.name}`, partnerName(pf.entityId), ROUTES.portfolio(pf.id))
      return
    }
    case 'pfEvalSave': {
      const pf = pfById(o.id)
      if (!pf || pf.close.stage !== 'evalDraft') return
      pf.close.evaluation = { criteria: structuredClone(o.criteria), notes: o.notes }
      plog(pf, o.by, 'حفظ تقييم المحفظة', o.at)
      return
    }
    case 'pfEvalAct': {
      const pf = pfById(o.id)
      const st = pf?.close.stage
      if (!pf || !st) return
      if (o.act === 'send') {
        if (st !== 'evalDraft' || pfEvalScore(pf) === null) return
        pf.close.stage = 'evalManager'
        plog(pf, o.by, `أرسل تقييم المحفظة لمدير المنح · الدرجة ${pfEvalScore(pf)} من 100`, o.at)
        notify([MGR()], `تقييم محفظة بانتظار اعتمادك · ${pf.name}`, `${pfEvalScore(pf)} من 100`, ROUTES.portfolio(pf.id))
        return
      }
      if (o.act === 'return') {
        if (!o.note.trim() || (st !== 'evalManager' && st !== 'evalExecutive')) return
        pf.close.stage = st === 'evalExecutive' ? 'evalManager' : 'evalDraft'
        pf.close.note = o.note
        plog(pf, o.by, `أعاد تقييم المحفظة · ${o.note}`, o.at)
        return
      }
      if (st === 'evalManager' && (o.toExec ?? pfApproverOf(pf, 'eval') === 'ceo')) {
        pf.close.stage = 'evalExecutive'
        plog(pf, o.by, 'اعتمد مدير المنح التقييم · أُحيل للمدير التنفيذي', o.at)
        notify([CEO()], `تقييم محفظة بانتظار اعتمادك · ${pf.name}`, `${pfEvalScore(pf)} من 100`, ROUTES.portfolio(pf.id))
        return
      }
      if (st !== 'evalManager' && st !== 'evalExecutive') return
      if (liveRun && pfCloseChecks(pf).some((c) => !c.ok && c.key !== 'report')) return
      plog(pf, o.by, `اعتُمد تقييم المحفظة · ${pfEvalScore(pf)} من 100`, o.at)
      closeOut(pf, o.by, o.at)
      return
    }
    case 'pfStudy': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'supervisor') return
      pf.study = { scores: { ...o.scores }, note: o.note, by: o.by, at: day(o.at) }
      plog(pf, o.by, `دراسة المحفظة بمعايير التقييم · ${studyScore(o.scores, pfStudyCriteria())} من 100${o.note ? ` · ${o.note}` : ''}`, o.at)
      return
    }
    case 'pfCancel': {
      const pf = pfById(o.id)
      if (!pf || (pf.stage !== 'approved' && pf.stage !== 'closing') || !o.reason.trim()) return
      pf.stage = 'cancelled'
      pf.cancel = { by: o.by, at: day(o.at), reason: o.reason }
      for (const x of pf.items) if (!SUB_FINAL.includes(x.state) && x.state !== 'draft') { x.state = 'excluded'; x.outcome = { by: o.by, at: day(o.at), note: 'أُلغيت المحفظة' } }
      for (const r of pf.requests) if (!['paid', 'returned'].includes(r.state)) { r.state = 'returned'; r.note = 'أُلغيت المحفظة' }
      if (liveRun && hasFunding(pf.id)) releaseSavings(pf.id, o.by, 'أُلغيت المحفظة')
      /* v3 · 13.4.43 · what's to come back is claimed on the portfolio's relationship, not per sub-project */
      if (o.recover > 0) pf.recovery = { due: o.recover, receipts: [], released: 0 }
      plog(pf, o.by, `أُلغيت المحفظة · ${o.reason}${o.recover > 0 ? ` · يُسترد ${nf.format(o.recover)} على مستوى المحفظة` : ''} · حُرّر غير المصروف إلى بنده`, o.at)
      notify([pf.owner, partnerName(pf.entityId)], `أُلغيت المحفظة · ${pf.name}`, o.reason, ROUTES.portfolio(pf.id))
      listRow(pf)
      return
    }
    case 'pfRecReceipt': {
      const pf = pfById(o.id)
      const rc = pf?.recovery
      if (!pf || !rc) return
      const got = rc.receipts.reduce((n, x) => n + x.amount, 0)
      if (!(o.amount > 0) || o.amount > rc.due - got) return
      rc.receipts.push({ amount: o.amount, ref: o.ref, file: o.file, by: o.by, at: day(o.at) })
      if (liveRun && hasFunding(pf.id)) releaseRecovered(pf.id, o.amount, `PF-REC-${pf.id}-${rc.receipts.length}`, o.by)
      rc.released += o.amount
      plog(pf, o.by, `استُلم ${nf.format(o.amount)} من الشريك · ${o.ref} · المتبقي ${nf.format(rc.due - got - o.amount)}`, o.at)
      return
    }
    case 'ehSchedule': {
      /* Verifier · 17 Oct · the plan condition stayed here after v3 dropped the plan · every new external
         project's schedule was refused on replay and live while the screen said «سُجّل» */
      if (!approvedProject(o.projectId)) return
      const p = projectOf(o.projectId)!
      const sum = o.slots.reduce((s, x) => s + x.amount, 0)
      /* v3 · 11.2.8 · the payments don't exceed the approved value */
      if (!(sum > 0) || sum > p.amountGranted) return
      SCHEDULES.set(o.projectId, o.slots)
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'جدول الدفعات', note: `${o.slots.length === 1 ? 'دفعة واحدة' : `${o.slots.length} دفعات`} بمجموع ${nf.format(sum)} من ${nf.format(p.amountGranted)}` })
      /* v3 · 11.2.8 · the schedule registered · the project moves to «تحت التنفيذ» */
      if (p.stage === EXT_PRE_STAGE) {
        setStage(p.id, 'المشرف إذن الصرف')
        ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: 'النظام', kind: 'الحالة', note: 'تحقّق النظام من ألا يتجاوز الجدول قيمة المشروع · وحوّل حالته إلى «تحت التنفيذ»' })
      }
      return
    }
    case 'ehOp': {
      if (!viaEhsan(o.projectId) || !o.note.trim()) return
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: o.kind, ref: o.ref, note: o.note })
      return
    }
    case 'subLink': {
      const pf = pfById(o.pfId)
      const sb = pf?.items.find((x) => x.id === o.subId)
      if (pf && sb && (o.activityId === '' || pfActivities(pf).some((x) => x.id === o.activityId))) {
        sb.activityId = o.activityId || undefined
        plog(pf, o.by, o.activityId ? `ربط «${sb.name}» بنشاط ${pfActivities(pf).find((x) => x.id === o.activityId)?.label ?? o.activityId}` : `فكّ ربط «${sb.name}» بنشاط الخطة`, o.at)
      }
      return
    }
    case 'extDoc': {
      const l = EXT_DOCS.get(o.projectId) ?? []
      if (!l.some((x) => x.file === o.file)) {
        l.push({ file: o.file, by: o.by, at: o.at.slice(0, 10) })
        /* Re-audit 17 Oct · v3 · 11.4.15 · the external document is on the project's operations and the audit log */
        ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'الوثيقة الخارجية', note: `سُجّلت الوثيقة الخارجية · ${o.file}` })
      }
      EXT_DOCS.set(o.projectId, l)
      return
    }
    case 'extParty': {
      if (entityById(o.id)) return
      const e = entityRowOf(o.id, o.name, 'جهة خارجية', '—', o.region || '—', o.city || '—', 'نشط', 'لم تُقيَّم', 0, [0, 0, 0, 0, 0], [0, 0, 0], day(o.at), '')
      e.external = { transfer: o.transfer || undefined, refs: o.refs || undefined, by: o.by, at: day(o.at) }
      e.email = ''
      entityRows.push(e)
      return
    }
    case 'extCfg':
      EXT_CFG.party = [...o.party]
      EXT_CFG.project = [...o.project]
      return
    case 'extMeta':
      EXT_META.set(o.projectId, structuredClone(o.meta))
      if (o.meta.third?.files.length) EXT_FILES.set(o.projectId, [...(EXT_FILES.get(o.projectId) ?? []), ...o.meta.third.files])
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'طريقة التحويل',
        note: `${EXT_TRANSFER_SAY[o.meta.transfer]}${o.meta.third ? ` · ${o.meta.third.holder} · ${o.meta.third.bank}` : ''}${o.meta.sharedWith ? ` · جهة مشاركة: ${entityById(o.meta.sharedWith)?.name ?? o.meta.sharedWith}` : ''}` })
      return
    case 'extFiles':
      EXT_FILES.set(o.projectId, [...(EXT_FILES.get(o.projectId) ?? []), ...o.files])
      /* Re-audit 17 Oct · v3 · 11.4.15 · the creation's attachments are on the record too */
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'مرفقات الإنشاء', note: o.files.join('، ') })
      return
    case 'ehExec': {
      if (!viaEhsan(o.projectId) || ehCloseOf(o.projectId)?.closedAt) return
      const l = EH_EXEC.get(o.projectId) ?? []
      l.push({ ...structuredClone(o.exec), by: o.by, at: day(o.at) })
      EH_EXEC.set(o.projectId, l)
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'حالة التنفيذ', note: `${o.exec.status} · ${nf.format(o.exec.progress)} بالمئة${o.exec.note ? ` · ${o.exec.note}` : ''}${o.exec.files.length ? ` · ${o.exec.files.join('، ')}` : ''}` })
      return
    }
    case 'ehCloseSend': {
      const p = projectOf(o.projectId)
      const c0 = EH_CLOSE.get(o.projectId)
      if (!p || !viaEhsan(p.id) || c0?.closedAt || c0?.state === 'manager') return
      EH_CLOSE.set(p.id, { report: o.report, evidence: o.evidence, by: o.by, at: day(o.at), state: 'manager', sentAt: day(o.at) })
      /* checked when sent · on replay the payments log hasn't run yet (it waits for this store) */
      if (liveRun && ehCloseChecks(p.id).some((x) => !x.ok)) { EH_CLOSE.set(p.id, { ...c0, report: o.report, evidence: o.evidence, by: o.by, at: day(o.at), state: c0?.state ?? 'draft' }); return }
      setStage(p.id, EXT_CLOSE_STAGE)
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'الإغلاق', note: `جمع مشرف المنح متطلبات الإغلاق وإثباتات التحويل والتنفيذ · ${o.evidence.length} إثباتات · أُحيل إلى مدير المنح` })
      notify([MGR()], `إغلاق مشروع خارجي بانتظار اعتمادك · ${p.name}`, p.platform ?? EXT_KIND, ROUTES.project(p.id))
      return
    }
    case 'ehCloseAct': {
      const p = projectOf(o.projectId)
      const c = EH_CLOSE.get(o.projectId)
      if (!p || !c || c.state !== 'manager' || c.closedAt) return
      if (o.act === 'return') {
        if (!o.note.trim()) return
        c.state = 'returned'
        c.note = o.note.trim()
        setStage(p.id, 'المشرف إذن الصرف')
        ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'الإغلاق', note: `أعاده مدير المنح لاستكمال المتطلبات · ${c.note}` })
        notify([p.owner ?? SUP], `أُعيد إغلاق المشروع الخارجي · ${p.name}`, c.note, ROUTES.project(p.id))
        return
      }
      c.closedAt = day(o.at)
      c.closedBy = o.by
      c.state = undefined
      /* what was paid when approved · carried in the op, since the payments log replays after this one */
      const paidNow = o.paid ?? paidOf(p.id)
      const unpaid = Math.max(0, (p.amountGranted || 0) - paidNow)
      const outcome = o.outcome ?? 'complete'
      let say: string
      if (outcome === 'cancel') {
        /* v3 · 11.2.14 · a cancellation · «ملغى» · what wasn't paid goes back to its line */
        setStage(p.id, 'مشروع ملغي')
        say = `ملغى${unpaid > 0 ? ` · حُرّر غير المصروف ${nf.format(unpaid)} إلى البند` : ''}`
        if (liveRun && hasFunding(p.id)) releaseSavings(p.id, o.by, 'أُلغي المشروع الخارجي عند إغلاقه')
      } else if (outcome === 'redirect' && o.redirect) {
        /* v3 · 11.2.14 · 10.9.2 · the support turned to a new purpose by a documented decision · the unpaid part is released */
        p.redirect = { original: p.amountGranted || 0, used: paidNow, redirected: paidNow, purpose: o.redirect.purpose, decision: o.redirect.decision, decisionFile: o.redirect.file, evidence: [...c.evidence], by: o.by, at: day(o.at) }
        setStage(p.id, 'مشروع مكتمل')
        say = `أعيد توجيه الدعم · ${o.redirect.purpose} · القرار ${o.redirect.decision}${unpaid > 0 ? ` · حُرّر غير المصروف ${nf.format(unpaid)} إلى البند` : ''}`
        if (liveRun && hasFunding(p.id)) releaseSavings(p.id, o.by, 'أعيد توجيه دعم المشروع الخارجي')
      } else {
        /* v3 · 11.2.14 · «مكتمل», or «مغلق بوفر» when part of the value went unpaid · the rest is released */
        if (unpaid > 0) p.closeSavings = { amount: unpaid, fate: 'غير المصروف عاد إلى بند الميزانية' }
        setStage(p.id, 'مشروع مكتمل')
        say = unpaid > 0 ? `مغلق بوفر ${nf.format(unpaid)} حُرّر إلى البند` : 'مكتمل'
        if (liveRun && hasFunding(p.id)) releaseSavings(p.id, o.by, 'أُغلق المشروع الخارجي')
      }
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'الإغلاق', note: `اعتمد مدير المنح الإغلاق · ${say}${o.note ? ` · ${o.note}` : ''}` })
      notify([p.owner ?? SUP], `اعتُمد إغلاق المشروع الخارجي · ${p.name}`, say, ROUTES.project(p.id))
      return
    }
    case 'ehReport': {
      if (!viaEhsan(o.projectId) || !approvedProject(o.projectId)) return
      const c = EH_CLOSE.get(o.projectId)
      if (c?.closedAt || c?.state === 'manager') return
      EH_CLOSE.set(o.projectId, { report: o.report, evidence: o.evidence, by: o.by, at: day(o.at), state: c?.state === 'returned' ? 'returned' : 'draft', note: c?.note })
      /* Batch 7 · cross#25 · the final report's filing is an operation on the log too */
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'ملخص الإغلاق', note: `حُفظ ملخص الإغلاق · ${o.evidence.length} إثباتات` })
      return
    }
    case 'ehClose': {
      const c = EH_CLOSE.get(o.projectId)
      if (!c || c.closedAt || (liveRun && ehCloseChecks(o.projectId).some((x) => !x.ok))) return
      c.closedAt = day(o.at)
      c.closedBy = o.by
      setStage(o.projectId, 'مشروع مكتمل')
      if (liveRun && hasFunding(o.projectId)) releaseSavings(o.projectId, o.by, 'أُغلق المشروع الخارجي')
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'الإغلاق', note: 'أُغلق المشروع وحُدّثت حالته · مكتمل' })
      return
    }
  }
}

/** Before a payment Ehsan executed is recorded · its documents, its reference, its ceiling (11.2.11 · 11.4.12 · 11.4.22 · 13.4.32) */
export function payIssues(p: Pick<EhsanPay, 'target' | 'amount' | 'ref' | 'paidAt' | 'docs'>): string[] {
  const out: string[] = []
  if (!(p.amount > 0)) out.push('مبلغ الدفعة')
  if (!p.ref.trim()) out.push('رقم العملية على منصة الجهة الخارجية')
  if (!p.paidAt) out.push('تاريخ التنفيذ')
  if (!p.docs.length) out.push('إشعار التحويل أو مستند المنصة')
  if (p.ref.trim() && (EHSAN_PAYS.some((x) => x.ref.trim() === p.ref.trim() && x.state !== 'returned') || isPaidRef(p.ref.trim()))) out.push(/* doc 11.4.23 */ 'العملية مسجّلة من قبل · لا تُسجَّل مرتين')
  const t = p.target
  if (t.kind === 'project') {
    if (!viaEhsan(t.projectId)) out.push('المشروع غير مدعوم عبر جهة خارجية')
    const g = ehGate(t.projectId)
    if (!g.pay) out.push(g.why)
    /* v3 · 9.4.5 · finance pays nothing without the system's permit · the platform's operation is
       recorded against what the permits paid */
    const covered = paidOf(t.projectId) - sumOf(paysOf(t), live)
    if (p.amount > covered) out.push(/* doc 9.4.5 */ `لا تُسجَّل دفعة قبل صرفها بإذن صرف من النظام · المتاح ${nf.format(Math.max(0, covered))}`)
    const m = ehMoney(t.projectId)
    if (p.amount > m.left) out.push(`تتجاوز المتبقي من قيمة المشروع ${nf.format(Math.max(0, m.left))}`)
  } else {
    const pf = pfById(t.pfId)
    if (!pf || pf.stage !== 'approved') out.push('المحفظة غير معتمدة أو مغلقة')
    else {
      const m = pfMoney(pf)
      if (p.amount > pf.total - m.recorded) out.push(`تتجاوز المتبقي من قيمة المحفظة ${nf.format(Math.max(0, pf.total - m.recorded))}`)
      if (t.kind === 'sub') {
        const s = pf.items.find((x) => x.id === t.subId)
        if (!s || s.state !== 'approved') out.push('المشروع الفرعي غير معتمد')
        else if (p.amount > s.amount - subMoney(pf, s).recorded) out.push(`تتجاوز المتبقي من المشروع الفرعي ${nf.format(Math.max(0, s.amount - subMoney(pf, s).recorded))}`)
      }
    }
  }
  return out
}

/** A portfolio-level request · on its schedule, inside the portfolio's value (13.2.24 · 13.4.29 · 13.4.32) */
export function pfReqIssue(pf: PortfolioRec, no: number, amount: number): string {
  if (pf.channel !== 'direct') return 'دفعات المحفظة على مستوى المحفظة الرئيسية'
  /* v3 · 0.ent.8 · 2.4.22 · a partner whose account is «غير نشط» or archived is not paid */
  const blocked = payBlock(entityById(pf.entityId))
  if (blocked) return blocked
  const slot = pf.schedule.find((s) => s.no === no)
  if (!slot) return 'الدفعة غير موجودة في جدول دفعات المحفظة'
  if (pf.requests.some((r) => r.no === no && r.state !== 'returned')) return 'طُلبت هذه الدفعة من قبل'
  if (!(amount > 0) || amount > slot.amount) return `قيمة الطلب في حدود الدفعة ${nf.format(slot.amount)}`
  const m = pfMoney(pf)
  if (amount > pf.total - m.recorded) return 'تتجاوز المتبقي من قيمة المحفظة'
  return ''
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); liveRun = true; apply(o); save(); emit(); done(o.op, 'الشركاء') }

/* ── Seed · the partners, the fixture's portfolios and the Ehsan project ── */

function fromSeed(s: PfSeed): PortfolioRec {
  const stage = s.stage ?? 'approved'
  const at = s.openedAt
  const pf: PortfolioRec = {
    /* Re-audit 17 Oct · moved off the platform to the portfolios partner · its name follows the move */
    id: s.id, name: s.entityId === '860' ? s.name.replace(/^محفظة إحسان/, 'المحافظ الخيرية') : s.name, entityId: s.entityId === '860' ? '861' : s.entityId, total: s.total, year: s.year,
    track: s.track ?? 'المنح الانتشاري', field: s.field ?? 'الإغاثة', goals: s.goals ?? '', summary: s.goals ?? '',
    /* v3 · 11.4.11 · no portfolio through an external party · the fixture's platform portfolios belong to the
       portfolios partner, paid at the portfolio's level (13.4.36) */
    files: ['وثيقة المحفظة.pdf'], origin: s.origin ?? 'internal', channel: 'direct', stage, owner: s.owner ?? SUP, openedAt: at,
    shares: s.line ? [{ docId: 'BG-2026-SA', nodeId: s.line, amount: s.total }] : undefined,
    plan: {
      state: s.plan ?? 'none', by: s.owner ?? SUP,
      phases: s.plan && s.plan !== 'none' ? [
        { id: 'ph1', name: 'الإعداد واستقبال المشاريع', from: at, to: '2026-06-30', cost: Math.round(s.total * 0.4) },
        { id: 'ph2', name: 'التنفيذ والمتابعة', from: '2026-07-01', to: '2026-11-30', cost: Math.round(s.total * 0.5) },
        { id: 'ph3', name: 'التقارير والإغلاق', from: '2026-12-01', to: '2026-12-31', cost: s.total - Math.round(s.total * 0.4) - Math.round(s.total * 0.5) },
      ] : [],
    },
    agreement: { state: s.agreement ?? 'none', file: s.agreement === 'signed' ? 'اتفاقية المحفظة الموقعة.pdf' : undefined },
    schedule: stage === 'approved' ? [
      { no: 1, amount: Math.round(s.total * 0.4), dueAt: '2026-11-01' },
      { no: 2, amount: Math.round(s.total * 0.4), dueAt: '2027-02-01' },
      { no: 3, amount: s.total - 2 * Math.round(s.total * 0.4), dueAt: '2027-05-01' },
    ] : [],
    requests: [], approvals: [], close: { report: '', evidence: [] }, log: [],
    items: s.items.map((x) => {
      const state = x.state ?? 'approved'
      return {
        id: x.id, name: x.name, region: x.region, amount: x.amount, beneficiaries: x.beneficiaries ?? 0, outputs: x.outputs ?? '',
        files: ['دراسة المشروع.pdf'], state, reason: x.reason, reqId: state === 'pending' ? `AR-${s.id.slice(-3)}-1` : undefined,
        rec: state === 'pending' ? { outcome: 'approve' as const, note: 'الدراسة مكتملة · نوصي بالاعتماد', by: s.owner ?? SUP, at } : undefined,
        addedBy: partnerName(s.entityId), addedAt: at, decidedBy: state === 'approved' || state === 'rejected' ? 'عبدالله الدوسري' : undefined,
        exec: state === 'approved' ? { status: subExecStatus(x.status), progress: x.progress ?? 0, reached: x.reached ?? 0, results: x.results ?? '', evidence: x.status === 'مكتمل' ? ['تقرير الإنجاز.pdf'] : [], at, by: partnerName(s.entityId) } : undefined,
      }
    }),
  }
  /* A seeded agreement past «none» carries its generated text like one drafted live */
  if (pf.agreement.state !== 'none') { pf.agreement.body = pfAgreementText(pf); pf.agreement.versions = [{ no: 1, at, by: pf.owner, body: pf.agreement.body }] }
  pf.log.push({ at, by: pf.owner, what: pf.origin === 'partner' ? 'قدّم الشريك طلب المحفظة من البوابة' : 'أنشأ مشرف المنح المحفظة' })
  if (stage === 'approved') pf.log.push({ at, by: CEO(), what: 'اعتمدها المدير التنفيذي نهائيًّا · ثُبّت الحجز' })
  if (pf.items.some((x) => x.state === 'pending')) pf.approvals.push({ id: `AR-${s.id.slice(-3)}-1`, subIds: pf.items.filter((x) => x.state === 'pending').map((x) => x.id), at: '2026-09-28', by: pf.owner })
  /* v3 · 13.4.37 · what the fixture paid is the portfolio's payments, not the sub-projects' · against its schedule */
  let paid = s.items.filter((i) => i.spent > 0 && (i.state ?? 'approved') === 'approved').reduce((n, x) => n + x.spent, 0)
  for (const slot of pf.schedule) {
    if (paid <= 0) break
    const amount = Math.min(paid, slot.amount)
    pf.requests.push({ id: `PR-${s.id.slice(-3)}-${slot.no}`, no: slot.no, amount, asked: slot.amount, at, by: pf.owner, state: 'paid', ref: seedPayRef(s.id, `D${slot.no}`), why: 'دفعة قبل النظام', docs: ['إشعار التحويل.pdf'] })
    paid -= amount
  }
  for (const x of pf.items) if (x.state === 'approved' && x.exec?.status === 'مكتمل') { x.state = 'done'; x.outcome = { by: pf.owner, at, note: 'اعتُمدت النتائج' } }
  /* Client 20 Oct (#18 – #20 · #27) · the seeded sub-projects carry the client's fields, a serial, the
     portfolio's copied outputs and stages, and the results the completed ones closed on */
  const copy = pfCopy(pf)
  for (const x of pf.items) {
    const e = SUB_SEED_EXTRA[x.id]
    Object.assign(x, { serial: nextSubSerial(), ...copy, outputsCopy: [...copy.outputsCopy], phasesCopy: copy.phasesCopy.map((p) => ({ ...p })) })
    if (e) Object.assign(x, { city: e.city, implementer: e.impl, implementerName: e.implName ?? (e.impl === 'owner' ? partnerName(pf.entityId) : undefined), finalBeneficiaries: e.final, cost: e.cost, evalFile: 'التقييم التفصيلي.pdf' })
    slog(x, x.addedBy, `أضاف الشريك «${x.name}» · ${nf.format(x.amount)}`, at)
    if (x.decidedBy) slog(x, x.decidedBy, x.state === 'rejected' ? `رفضه مدير المنح · ${x.reason ?? ''}` : 'اعتمده مدير المنح', at)
    if (x.state === 'done' && x.exec) {
      x.results = { cost: e?.cost ?? x.amount, reached: x.exec.reached, files: x.exec.evidence.length ? x.exec.evidence : ['تقرير الإنجاز.pdf'], note: x.exec.results, at, by: x.addedBy }
      slog(x, pf.owner, 'اعتمد مشرف المنح النتائج · مغلق', at)
    }
  }
  return pf
}
/* Client 20 Oct (#18) · the seeded sub-projects' data as the client's sheet lists it */
const SUB_SEED_EXTRA: Record<string, { city: string; impl: SubImplementer; implName?: string; final: number; cost: number }> = {
  'PF-1': { city: 'متعددة', impl: 'owner', final: 3_200, cost: 2_000_000 },
  'PF-2': { city: 'الرياض', impl: 'association', implName: 'جمعية البر بالرياض', final: 30_000, cost: 1_950_000 },
  'PF-3': { city: 'مكة المكرمة', impl: 'company', implName: 'شركة البناء المتين للمقاولات', final: 600, cost: 1_520_000 },
  'PF-4': { city: 'تبوك', impl: 'association', implName: 'جمعية البر بتبوك', final: 3_000, cost: 800_000 },
  'PF-5': { city: 'الرياض', impl: 'owner', final: 150, cost: 1_500_000 },
  'PF-6': { city: 'بريدة', impl: 'company', implName: 'شركة المعرفة للتدريب', final: 12_000, cost: 1_180_000 },
  'PF-7': { city: 'حائل', impl: 'company', implName: 'شركة التقنية المتقدمة', final: 2_400, cost: 640_000 },
  'PF-7B': { city: 'جيزان', impl: 'association', implName: 'جمعية تعليم جيزان', final: 1_000, cost: 400_000 },
}

function seed() {
  const at = '2026-01-15'
  PROFILES.push(
    /* v3 · 11.4.1 · 11.4.11 · the platform is an external party's reference record (seed below), not a strategic partner */

    { entityId: '861', name: 'المحافظ الخيرية', allowed: ['portfolio'], platform: false, state: 'approved', requestedBy: SUP, at, decidedBy: 'عبدالله الدوسري' },
  )
  /* A partner registered internally and still waiting for the grants manager (11.2.1 · 13.2.1) */
  const pending = entityRows.find((e) => e.id === '834')
  if (pending) PROFILES.push({ entityId: pending.id, name: pending.name, allowed: ['portfolio'], platform: false, state: 'review', requestedBy: SUP, at: '2026-09-30' })
  /* v3 · 11.2.1 · the platform is an external party · a reference record, no portal account */
  const eh = entityById('860')
  if (eh) eh.external = { refs: 'منصة حكومية لدعم الجهات الخيرية · رقم الاتفاقية الإطارية EH-2023-17', by: SUP, at }
  /* v3 · 11.4.14 · the type «مشروع خارجي» is the project supported through an external party · the fixture's
     older «مشروع خارجي» rows ran an internal agreement and plan as regular projects, and read as such */
  for (const p of projectRows) {
    if (p.platform && !p.externalId) p.externalId = '860'
    if (p.platform) p.type = 'مشروع خارجي'
    else if (p.type === 'مشروع خارجي') p.type = 'مشروع عادي'
  }
  for (const s of PF_SEED) PORTFOLIOS.push(fromSeed(s))
  /* v3 · 13.2.6 · a seeded portfolio past its study carries a completed one */
  for (const pf of PORTFOLIOS) if (!['draft', 'returned', 'supervisor'].includes(pf.stage) && !pf.study)
    pf.study = { scores: Object.fromEntries(pfStudyCriteria().map((c, i) => [c.key, 4 + (i % 2)])), note: 'دراسة مرحّلة من النظام السابق', by: pf.owner, at: pf.openedAt }
  for (const e of EHSAN_SEED) {
    const p = projectOf(e.projectId)
    if (!p) continue
    SCHEDULES.set(p.id, [
      { no: 1, amount: 400_000, dueAt: '2026-06-15' },
      { no: 2, amount: 500_000, dueAt: '2026-10-15' },
      { no: 3, amount: p.amountGranted - 900_000, dueAt: '2027-02-15' },
    ])
    for (const x of e.paid) EHSAN_PAYS.push({ id: `EP-${x.ref}`, target: { kind: 'project', projectId: p.id }, amount: x.amount, ref: x.ref, paidAt: '2026-06-16', docs: ['إشعار منصة إحسان.pdf'], state: 'confirmed', by: SUP, at: '2026-06-16', reviewedBy: FIN, seed: true })
    EH_OPS.set(p.id, [
      { at: '2026-03-18', by: SUP, kind: 'قرار التوجيه', note: 'يُوجَّه الدعم عبر منصة إحسان · مشروع مستقل' },
      { at: '2026-06-16', by: SUP, kind: 'دفعة عبر إحسان', ref: 'EH-21060-1', note: 'نفّذت المنصة الدفعة الأولى 400,000' },
      { at: '2026-08-20', by: SUP, kind: 'زيارة ميدانية', note: 'اكتمل ترميم 30 منزلًا من 90 · الجودة مطابقة' },
    ])
  }
}

const AUTO = 'ph:'
const split = (n: number, i: number) => (i === n - 1 ? 100 - Math.floor(100 / n) * (n - 1) : Math.floor(100 / n))
const PF_PLAN_VIEW = { draft: 'draft', returned: 'returned', supervisor: 'supervisor', manager: 'review', active: 'approved', done: 'approved', cancelled: 'none' } as const
function hydrate() {
  seed()
  /* 18 Oct · #32 · the plans bind before the replay · a sub-project op checks the plan's state */
  for (const pf of PORTFOLIOS) bindPfPlan(pf)
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
  liveRun = true
  for (const pf of PORTFOLIOS) listRow(pf)
  /* v3 · 11.2.13 · the external project's period ended · the supervisor is alerted, dated at its end */
  for (const p of externalEnded()) notify([p.owner ?? SUP], `انتهت مدة المشروع الخارجي · ${p.name}`, 'اجمع متطلبات الإغلاق وإثباتات التحويل والتنفيذ وارفعها لمدير المنح', ROUTES.project(p.id))
}
hydrate()

/* Re-audit 17 Oct · v3 · 11.4.3 · the simplified form's attachments are what an external project needs ·
   required only when the settings ask for them */
setExtMissingDocs((projectId) => (EXT_CFG.project.includes('files') && !extFilesOf(projectId).length && !extDocsOf(projectId).length ? ['مرفقات المشروع من النموذج المبسط'] : []))
/* The payments module routes an Ehsan project's money here, not to the entity's requests (11.2.17) */
setEhsanGate((projectId) => (viaEhsan(projectId) ? `${EXT_KIND} · يرفع صاحب الصلاحية متطلباته نيابةً عن الجهة الخارجية` : ''))
/* v3 · 9.4.5 · its payments run the payment procedure · on the schedule kept here */
setExternalBefore((projectId) => (viaEhsan(projectId) ? EHSAN_PAYS.filter((p) => p.seed && p.target.kind === 'project' && p.target.projectId === projectId).reduce((s, p) => s + p.amount, 0) : 0))
/* v3 · 11.2.7 · the slot's requirements and conditions are what the payment's requirements read */
setExternalSchedule((projectId) => (viaEhsan(projectId) ? ehScheduleOf(projectId).map((x) => ({ no: x.no, amount: x.amount, dueAt: x.dueAt, requirement: [x.needs, x.cond && `شرط: ${x.cond}`].filter(Boolean).join(' · ') || undefined })) : []))

/* ── Actions ── */

export const requestPartner = (entityId: string, name: string, allowed: PType[], platform: boolean, by: string) =>
  run({ op: 'partnerReq', entityId, name, allowed, platform, by, at: now() })
export const decidePartner = (entityId: string, outcome: 'approve' | 'reject', note: string, by: string) =>
  run({ op: 'partnerDecide', entityId, outcome, note, by, at: now() })
export const setPartnerTypes = (entityId: string, allowed: PType[], by: string) => run({ op: 'partnerTypes', entityId, allowed, by, at: now() })

/** The routing decision on a project under study · the platform and the type (11.2.4 · 11.2.5) */
/** v3 · 11.4.1 · the party a support goes through · an approved reference record */
const partyIssue = (party: string | undefined): string => {
  const e = entityById(party ?? '860')
  if (!e || !e.external || e.archived) return 'اختر جهة خارجية لها سجل مرجعي معتمد'
  return ''
}
export function routeProject(projectId: string, platform: boolean, type: PType, by: string, party?: string, role?: RoleKey): string[] {
  const p = projectOf(projectId)
  if (!p) return ['المشروع غير موجود']
  if (role && role !== 'ceo') return ['يقرّ التوجيه المدير التنفيذي']
  if (p.statusGroup !== 'قيد الدراسة') return ['يُحدَّد التوجيه والنوع قبل الاعتماد فقط']
  if (isStrategic(p.entityId) && !typeAllowed(p.entityId, type)) return [/* doc 11.2.2 */ `«${PTYPE_SAY[type]}» غير مسموح لهذا الشريك`]
  if (platform && partyIssue(party)) return [partyIssue(party)]
  /* the project's own entity is the external party's reference record · it has no portal to be supported directly */
  if (!platform && isExternalParty(p.entityId)) return ['المشروع لجهة خارجية بلا حساب بوابة · لا يُدعم مباشرة']
  if (platform && DECISIONS.ehsanEntities === 'strategic' && !isStrategic(p.entityId) && !isExternalParty(p.entityId)) return ['التوجيه عبر جهة خارجية للشركاء الاستراتيجيين المعتمدين فقط (قرار المؤسسة)']
  run({ op: 'route', projectId, platform, type, party: platform ? party ?? '860' : undefined, by, at: now() })
  return []
}

/** Batch 7 · the supervisor's proposal · the executive decides it with `decideRoute` */
export function proposeRoute(projectId: string, platform: boolean, type: PType, note: string, by: string, party?: string, role?: RoleKey): string[] {
  const p = projectOf(projectId)
  if (!p) return ['المشروع غير موجود']
  if (role && role !== 'supervisor') return ['يقترح التوجيه مشرف المنح']
  if (p.statusGroup !== 'قيد الدراسة') return ['يُقترح التوجيه أثناء الدراسة فقط']
  if (isStrategic(p.entityId) && !typeAllowed(p.entityId, type)) return [/* doc 11.2.2 */ `«${PTYPE_SAY[type]}» غير مسموح لهذا الشريك`]
  if (platform && partyIssue(party)) return [partyIssue(party)]
  /* the project's own entity is the external party's reference record · it has no portal to be supported directly */
  if (!platform && isExternalParty(p.entityId)) return ['المشروع لجهة خارجية بلا حساب بوابة · لا يُدعم مباشرة']
  if (platform && DECISIONS.ehsanEntities === 'strategic' && !isStrategic(p.entityId) && !isExternalParty(p.entityId)) return ['التوجيه عبر جهة خارجية للشركاء الاستراتيجيين المعتمدين فقط (قرار المؤسسة)']
  run({ op: 'routePropose', projectId, platform, type, note, party: platform ? party ?? '860' : undefined, by, at: now() })
  return []
}
export function decideRoute(projectId: string, accept: boolean, note: string, by: string, role?: RoleKey): string[] {
  if (role && role !== 'ceo') return ['يقرّ التوجيه المدير التنفيذي']
  if (!PROPOSALS.get(projectId)) return ['لا اقتراح توجيه بانتظار القرار']
  if (projectOf(projectId)?.statusGroup !== 'قيد الدراسة') return ['يُقرّ التوجيه أثناء الدراسة فقط']
  if (!accept && !note.trim()) return ['اكتب سبب رفض الاقتراح']
  const pr = PROPOSALS.get(projectId)!
  const pp = projectOf(projectId)
  if (accept && pr.platform && pp && DECISIONS.ehsanEntities === 'strategic' && !isStrategic(pp.entityId) && !isExternalParty(pp.entityId)) return ['التوجيه عبر جهة خارجية للشركاء الاستراتيجيين المعتمدين فقط (قرار المؤسسة)']
  run({ op: 'routeDecide', projectId, accept, note, by, at: now() })
  return []
}

export const nextPortfolioId = () => `PF-2026-${String(PORTFOLIOS.length + 1).padStart(3, '0')}`
export function createPortfolio(v: Omit<Extract<Op, { op: 'pfCreate' }>['pf'], 'id'>, send: boolean, by: string, fromProject?: string): { id?: string; errors: string[] } {
  const errors: string[] = []
  if (!isStrategic(v.entityId)) errors.push(/* doc 13.4.1 */ 'اختر شريكًا استراتيجيًّا معتمدًا')
  else if (!typeAllowed(v.entityId, 'portfolio')) errors.push(/* doc 11.2.2 */ 'المحفظة غير مسموحة لهذا الشريك')
  if (!v.name.trim()) errors.push('اسم المحفظة')
  if (!(v.total > 0)) errors.push('قيمة المحفظة')
  if (!v.goals.trim()) errors.push('أهداف المحفظة')
  if (!v.track || !v.field) errors.push('المسار والمجال المعتمدان')
  if (send && !v.files.length) errors.push('وثيقة المحفظة')
  if (errors.length) return { errors }
  const id = nextPortfolioId()
  run({ op: 'pfCreate', pf: { ...v, id }, send, fromProject, by, at: now() })
  return { id, errors: [] }
}
/* ── v3 · 13.2.6 · 13.4.4 · the portfolio's study by the evaluation criteria ── */
/** The weighted study score out of 100 · null before any study */
export const pfStudyScore = (pf: PortfolioRec): number | null => (pf.study ? studyScore(pf.study.scores, pfStudyCriteria()) : null)
/** What the study still lacks · every criterion rated 1 – 5 */
export function pfStudyIssues(pf: PortfolioRec): string[] {
  if (!pf.study) return ['ادرس المحفظة بمعايير التقييم قبل التوصية']
  const miss = pfStudyCriteria().filter((c) => !(pf.study!.scores[c.key] >= 1))
  return miss.length ? [`قيّم معايير الدراسة كلها · ناقص: ${miss.map((c) => c.label).join('، ')}`] : []
}
/** The supervisor saves the study at the study stage */
export function savePfStudy(id: string, scores: Record<string, number>, note: string, by: string, role: RoleKey): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  if (role !== 'supervisor') return ['يدرس المحفظة مشرف المنح']
  if (pf.stage !== 'supervisor') return ['تُدرس المحفظة في مرحلة الدراسة']
  const bad = Object.entries(scores).filter(([, v]) => !(v >= 1 && v <= 5))
  if (bad.length) return ['الدرجة من 1 إلى 5']
  run({ op: 'pfStudy', id, scores, note: note.trim(), by, at: now() })
  return []
}
export function actOnPortfolio(id: string, act: PfAct, note: string, by: string, shares?: PortfolioRec['shares']): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  const stops = pfStops(pf, act, shares)
  if (stops.length) return stops
  if ((act === 'return' || act === 'reject') && !note.trim()) return ['اكتب السبب']
  if (act === 'recommend' && shares) {
    const bad = linkIssues({ projectId: pf.id, projectName: pf.name, by, shares }, pf.total)
    if (bad.length) return bad
  }
  const LEVEL: Partial<Record<PortfolioStage, string>> = { manager: 'manager', ceo: 'exec', committee: 'committee', board: 'board' }
  run({ op: 'pfAct', id, act, note, shares, final: act === 'approve' ? LEVEL[pf.stage] === pfDecider(pf) : undefined, by, at: now() })
  return []
}
/* ── The portfolio's plan · client 18 Oct (#32) · through the plans module (BPD-012) ──
   The plan is a plan row keyed by the portfolio's id. Its phases are the plans module's · a phase
   with no activity of its own carries one standing for it (`ph:<phase>`), so the sub-projects that
   serve the phase keep their tie. The old `pfPlan` / `pfPlanAct` ops stay for replaying older saves. */

export function toPlanPhase(ph: PfPhase): PlanPhase {
  const acts: PlanActivity[] = ph.activities?.length
    ? ph.activities.map((a, i, xs) => ({ id: a.id, name: a.name, state: 'todo', from: ph.from, to: ph.to, needs: [a.evidence?.trim() || 'شاهد الإنجاز'], evidence: [], weight: split(xs.length, i), output: a.output }))
    : [{ id: `${AUTO}${ph.id}`, name: ph.name, state: 'todo', from: ph.from, to: ph.to, needs: ['تقرير إنجاز المرحلة'], evidence: [], weight: 100 }]
  return { id: ph.id, name: ph.name, from: ph.from, to: ph.to, cost: ph.cost, activities: acts }
}
export function fromPlanPhase(ph: PlanPhase): PfPhase {
  return {
    id: ph.id, name: ph.name, from: ph.from, to: ph.to, cost: ph.cost,
    activities: ph.activities.filter((a) => !a.id.startsWith(AUTO)).map((a) => ({ id: a.id, name: a.name, output: a.output ?? '', evidence: a.needs[0] ?? '' })),
  }
}
function pfPlanView(pf: PortfolioRec): PortfolioRec['plan'] {
  const p = planOfProject(pf.id)
  if (!p) return { state: 'none', phases: [] }
  const phases = p.phases.map(fromPlanPhase)
  return {
    state: p.stage === 'draft' && !phases.length ? 'none' : PF_PLAN_VIEW[p.stage], phases, note: p.stage === 'returned' || p.stage === 'supervisor' ? p.note : undefined,
    by: p.owner, drafter: p.drafter === 'entity' ? 'partner' : 'supervisor', planId: p.id,
  }
}
/* hoisted functions and constants above hydrate() · bindPfPlan runs from it (18 Oct · TDZ) */
function pfEnd(pf: PortfolioRec) { return pf.plan.phases.map((x) => x.to).filter(Boolean).sort().at(-1) }
/** Registers the portfolio with the plans module · its fixture plan becomes the plan row · from then
    on `pf.plan` reads the row */
function bindPfPlan(pf: PortfolioRec) {
  const was = pf.plan
  const open = ['approved', 'closing', 'closed'].includes(pf.stage)
  registerPortfolioPlan(
    { kind: 'portfolio', id: pf.id, name: pf.name, entityId: pf.entityId, entityName: partnerName(pf.entityId), owner: pf.owner, total: pf.total, from: pf.openedAt, to: pfEnd(pf), running: () => pf.agreement.state === 'signed' },
    open ? { state: was.state, phases: was.phases.map(toPlanPhase), drafter: was.drafter === 'supervisor' ? 'supervisor' : 'entity' } : undefined,
  )
  Object.defineProperty(pf, 'plan', { get: () => pfPlanView(pf), set() { /* the plans module holds it */ }, enumerable: true, configurable: true })
}

/** Kept for older callers · writes the draft through the plans module */
export function savePfPlan(id: string, phases: PfPhase[], by: string): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  const planId = pf.plan.planId ?? openPortfolioPlan(id)
  if (!planId) return ['تُعدّ الخطة بعد الاعتماد النهائي للمحفظة']
  savePlanPhases(planId, phases.map(toPlanPhase), by)
  return []
}
/** Kept for older callers · each step is the plans module's own (12.2.6 – 12.2.11) */
export function actOnPfPlan(id: string, act: 'send' | 'toManager' | 'approve' | 'return', note: string, by: string): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  const planId = pf.plan.planId
  if (!planId) return ['لم تُفتح خطة المحفظة بعد']
  if (act === 'send') {
    const cost = pf.plan.phases.reduce((s, x) => s + x.cost, 0)
    if (!pf.plan.phases.length) return ['أضف مرحلة واحدة على الأقل']
    if (pf.plan.phases.some((x) => !x.name.trim() || !x.from || !x.to || x.to < x.from)) return ['أكمل اسم كل مرحلة وتاريخيها']
    if (pf.plan.phases.some((x) => (x.activities ?? []).some((a) => !a.name.trim() || !a.output.trim()))) return ['أكمل اسم كل نشاط ومخرجه أو احذفه']
    if (cost !== pf.total) return [`مجموع تكلفة المراحل ${nf.format(cost)} يساوي قيمة المحفظة ${nf.format(pf.total)}`]
    const st = planOfProject(id)?.stage
    sendPlanFor(planId, by === partnerName(pf.entityId) ? 'entity' : 'supervisor', by)
    return planOfProject(id)?.stage === st ? ['تحقق من مراحل الخطة وأنشطتها وتواريخها'] : []
  }
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  if (act === 'toManager') return reviewPlan(planId, 'toManager', note, by, 'supervisor')
  if (act === 'approve') return reviewPlan(planId, 'approve', note, by, 'grants-manager')
  return pf.plan.state === 'supervisor' ? reviewPlan(planId, 'returnEntity', note, by, 'supervisor') : reviewPlan(planId, 'managerReturn', note, by, 'grants-manager')
}
export function actOnPfAgreement(id: string, act: Extract<Op, { op: 'pfAgr' }>['act'], note: string, by: string, file?: string): string[] {
  if (act === 'sign' && !file) return ['ارفع الاتفاقية الموقعة']
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  run({ op: 'pfAgr', id, act, note, file, by, at: now() })
  return []
}
export function savePfSchedule(id: string, slots: EhSlot[], by: string): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  const sum = slots.reduce((s, x) => s + x.amount, 0)
  if (slots.some((x) => !(x.amount > 0) || !x.dueAt)) return ['أكمل قيمة كل دفعة وتاريخها']
  if (sum > pf.total) return [`مجموع الدفعات ${nf.format(sum)} يتجاوز قيمة المحفظة`]
  run({ op: 'pfSchedule', id, slots, by, at: now() })
  return []
}

export function addSub(pfId: string, d: SubDraft, by: string): { id?: string; errors: string[] } {
  const pf = pfById(pfId)
  if (!pf) return { errors: ['المحفظة غير موجودة'] }
  const g = subsGate(pf)
  if (!g.ok) return { errors: [g.why] }
  const bad = subIssues(pf, d)
  if (bad.length) return { errors: bad }
  if (d.activityId && !pfActivities(pf).some((x) => x.id === d.activityId)) return { errors: ['النشاط ليس في خطة المحفظة'] }
  /* Verifier · 17 Oct · past the highest number in use · the count reused a dropped draft's id after a reload */
  const top = Math.max(SUB_TOP.get(pf.id) ?? 0, ...pf.items.map((x) => Number(x.id.split('-S')[1]) || 0))
  const id = `${pf.id.slice(-3)}-S${top + 1}`
  run({ op: 'subAdd', pfId, sub: { id, ...d }, by, at: now() })
  return { id, errors: [] }
}
export const dropSub = (pfId: string, subId: string, by: string) => run({ op: 'subDrop', pfId, subId, by, at: now() })
export function sendSubs(pfId: string, subIds: string[], by: string): string[] {
  const pf = pfById(pfId)
  if (!pf) return ['المحفظة غير موجودة']
  const list = pf.items.filter((x) => subIds.includes(x.id) && x.state === 'draft')
  if (!list.length) return ['اختر مشروعًا فرعيًّا واحدًا على الأقل من المسودات']
  for (const x of list) {
    const bad = subIssues(pf, x, x.id)
    if (bad.length) return [`«${x.name}» ينقصه: ${bad.join('، ')}`]
  }
  const cap = capIssue(pf, subIds)
  if (cap) return [cap]
  run({ op: 'subSend', pfId, reqId: `AR-${pf.id.slice(-3)}-${pf.approvals.length + 1}`, subIds: list.map((x) => x.id), by, at: now() })
  return []
}
export function decideSubs(pfId: string, decisions: { subId: string; outcome: 'approve' | 'reject'; reason?: string; note?: string }[], by: string, role: RoleKey = 'grants-manager'): string[] {
  if (role !== 'grants-manager') return ['يقرر مدير المنح المشروع الفرعي بعد توصية المشرف']
  if (!decisions.length) return ['اختر مشروعًا واحدًا على الأقل']
  const pf = pfById(pfId)
  if (pf && decisions.some((d) => pf.items.find((x) => x.id === d.subId)?.state !== 'pending')) return [/* doc 0.sub.3 */ 'يُقرَّر بعد توصية مشرف المنح · «بانتظار الاعتماد»']
  if (decisions.some((d) => d.outcome === 'reject' && !d.reason?.trim())) return [/* doc 13.2.16 */ 'سبب الرفض إلزامي لكل مشروع مرفوض']
  /* Verifier · 17 Oct · a sub-project the supervisor advised against isn't held · approving it must fit the balance */
  if (pf) {
    const unheld = pf.items.filter((x) => decisions.some((d) => d.subId === x.id && d.outcome === 'approve') && x.rec?.outcome === 'reject').reduce((n, x) => n + x.amount, 0)
    if (unheld > pfMoney(pf).available) return [`اعتماده يتجاوز الرصيد المتاح في المحفظة ${nf.format(Math.max(0, pfMoney(pf).available))}`]
  }
  run({ op: 'subDecide', pfId, decisions, by, at: now() })
  return []
}
/** v3 · 0.sub.2 · 13.2.16 · the supervisor studies what the partner sent */
export function studySubs(pfId: string, subIds: string[], by: string, role: RoleKey): string[] {
  if (role !== 'supervisor') return ['يدرس المشروع الفرعي مشرف المنح']
  const pf = pfById(pfId)
  if (!pf?.items.some((x) => subIds.includes(x.id) && x.state === 'submitted')) return ['اختر من المرفوع']
  run({ op: 'subStudy', pfId, subIds, by, at: now() })
  return []
}
/** v3 · 0.sub.3 · 13.2.16 · his recommendation · an approval one is held inside the portfolio (13.4.6) */
export function recommendSubs(pfId: string, decisions: { subId: string; outcome: 'approve' | 'reject'; note: string }[], by: string, role: RoleKey): string[] {
  if (role !== 'supervisor') return ['يوصي مشرف المنح']
  const pf = pfById(pfId)
  if (!pf) return ['المحفظة غير موجودة']
  if (!decisions.length) return ['اختر مشروعًا واحدًا على الأقل']
  if (decisions.some((d) => !['study', 'submitted'].includes(pf.items.find((x) => x.id === d.subId)?.state ?? ''))) return ['يوصى على المرفوع أو قيد الدراسة']
  if (decisions.some((d) => d.outcome === 'reject' && !d.note.trim())) return ['اكتب سبب التوصية بالرفض']
  const hold = pf.items.filter((x) => decisions.some((d) => d.subId === x.id && d.outcome === 'approve')).reduce((n, x) => n + x.amount, 0)
  if (hold > pfMoney(pf).available) return [`الموصى باعتماده ${nf.format(hold)} يتجاوز الرصيد المتاح ${nf.format(Math.max(0, pfMoney(pf).available))}`]
  run({ op: 'subRec', pfId, decisions, by, at: now() })
  return []
}
export function updateSubExec(pfId: string, subId: string, exec: Omit<SubExec, 'at' | 'by'>, by: string): string[] {
  /* v3 · 0.sub.6 · «مكتمل» here asks the foundation to approve the results · it needs them all */
  if (exec.status === 'مكتمل' && (!exec.results.trim() || !(exec.reached > 0) || !exec.evidence.length)) return [/* doc 13.2.21 */ 'طلب اعتماد النتائج يحتاج النتائج والمستفيدين الفعليين والشواهد']
  run({ op: 'subExec', pfId, subId, exec, by, at: now() })
  return []
}
/** v3 · 0.sub.6 · the supervisor approves the results · «مكتمل» with no separate final report */
export function completeSub(pfId: string, subId: string, act: 'approve' | 'return', note: string, by: string, role: RoleKey): string[] {
  if (role !== 'supervisor') return ['يعتمد النتائج مشرف المنح']
  const x = pfById(pfId)?.items.find((i) => i.id === subId)
  if (!x || x.state !== 'closing') return ['بعد تسجيل النتائج · «قيد الإغلاق»']
  if (act === 'approve' && !x.ready) return ['لم يطلب الشريك اعتماد النتائج بعد']
  if (act === 'return' && !note.trim()) return ['اكتب ما ينقص']
  run({ op: 'subComplete', pfId, subId, act, note: note.trim(), by, at: now() })
  return []
}
/** v3 · 0.sub.7 · couldn't be completed, as the partner and the foundation set */
export function stallSub(pfId: string, subId: string, reason: string, by: string, role: RoleKey): string[] {
  if (role !== 'supervisor' && role !== 'grants-manager') return ['لصاحب الصلاحية']
  const x = pfById(pfId)?.items.find((i) => i.id === subId)
  if (!x || (x.state !== 'approved' && x.state !== 'closing')) return ['يتعثر المعتمد أو قيد الإغلاق وحده']
  if (!reason.trim()) return ['اكتب سبب التعثر']
  run({ op: 'subStall', pfId, subId, reason: reason.trim(), by, at: now() })
  return []
}
/** v3 · 0.sub.8 · 13.4.14 · a substantive change · excluded or cancelled, its history kept, its value back */
export function excludeSub(pfId: string, subId: string, reason: string, by: string, role: RoleKey): string[] {
  if (role !== 'supervisor' && role !== 'grants-manager') return ['لصاحب الصلاحية']
  const x = pfById(pfId)?.items.find((i) => i.id === subId)
  if (!x || !['pending', 'approved', 'closing', 'stalled'].includes(x.state)) return ['يُستبعد ما بعد التوصية فقط · المسودة تُحذف']
  if (!reason.trim()) return ['اكتب سبب الاستبعاد أو الإلغاء']
  run({ op: 'subExclude', pfId, subId, reason: reason.trim(), by, at: now() })
  return []
}
/* ── Client 20 Oct (#17 – #20 · #27) · the sub-project's own page ── */
/** A sub-project with its portfolio */
export function subOf(pfId: string, subId: string): { pf: PortfolioRec; sub: SubProject } | undefined {
  const pf = pfById(pfId)
  const sub = pf?.items.find((x) => x.id === subId)
  return pf && sub ? { pf, sub } : undefined
}
/** The sub-project's path · the entity → the supervisor → the grants manager → execution → the results'
    approval → closed · the step it stands on */
export const SUB_STEPS = ['الجهة', 'مشرف المنح', 'مدير المنح', 'جاري التنفيذ', 'اعتماد النتائج', 'مغلق'] as const
export function subStep(x: SubProject): number {
  switch (x.state) {
    case 'draft': return 0
    case 'submitted': case 'study': return 1
    case 'pending': return 2
    case 'approved': case 'stalled': return 3
    case 'closing': return x.ready ? 4 : 3
    case 'done': return 5
    default: return x.rec ? 2 : 1
  }
}
/** The supervisor sends it back to the entity · the grants manager back to the supervisor (client 20 Oct #17) */
export function returnSub(pfId: string, subId: string, note: string, by: string, role: RoleKey): string[] {
  const x = subOf(pfId, subId)?.sub
  if (!x) return ['المشروع الفرعي غير موجود']
  if (!note.trim()) return ['اكتب ما ينقص']
  if (role === 'supervisor') {
    if (!['submitted', 'study'].includes(x.state)) return ['يُعاد للجهة ما عند مشرف المنح']
    run({ op: 'subReturn', pfId, subId, note: note.trim(), seat: 'supervisor', by, at: now() })
    return []
  }
  if (role === 'grants-manager') {
    if (x.state !== 'pending') return ['يُعاد ما بانتظار قرار مدير المنح']
    run({ op: 'subReturn', pfId, subId, note: note.trim(), seat: 'grants-manager', by, at: now() })
    return []
  }
  return ['لصاحب الصلاحية']
}
/** The supervisor rejects it outright · no recommendation to the manager (client 20 Oct #17) */
export function rejectSubDirect(pfId: string, subId: string, note: string, by: string, role: RoleKey): string[] {
  if (role !== 'supervisor') return ['يرفض مباشرة مشرف المنح']
  const x = subOf(pfId, subId)?.sub
  if (!x || !['submitted', 'study'].includes(x.state)) return ['يُرفض مباشرة المرفوع أو قيد الدراسة']
  if (!note.trim()) return ['اكتب سبب الرفض']
  run({ op: 'subRejectDirect', pfId, subId, note: note.trim(), by, at: now() })
  return []
}
/** The sub-project's own data · the entity or the supervisor completes it (client 20 Oct #18) */
export function saveSubInfo(pfId: string, subId: string, info: Extract<Op, { op: 'subInfo' }>['info'], by: string): string[] {
  const x = subOf(pfId, subId)?.sub
  if (!x) return ['المشروع الفرعي غير موجود']
  if (['rejected', 'excluded', 'done'].includes(x.state)) return ['أُغلق المشروع الفرعي · لا تعديل']
  if (info.finalBeneficiaries !== undefined && info.finalBeneficiaries < 0) return ['عدد المستفيد النهائي غير صحيح']
  if (info.cost !== undefined && info.cost > 0 && info.cost < x.amount) return ['التكلفة الكلية لا تقل عن قيمة المنحة']
  run({ op: 'subInfo', pfId, subId, info, by, at: now() })
  return []
}
/** The entity records the results · the supervisor approves them with `completeSub` (client 20 Oct #27) */
export function submitSubResults(pfId: string, subId: string, v: { cost: number; reached: number; files: string[]; note: string }, by: string): string[] {
  const x = subOf(pfId, subId)?.sub
  if (!x || (x.state !== 'approved' && x.state !== 'closing')) return ['تُسجَّل النتائج بعد اعتماد المشروع الفرعي']
  if (x.state === 'closing' && x.ready) return ['النتائج عند مشرف المنح']
  const out: string[] = []
  if (!(v.cost > 0)) out.push('التكلفة الفعلية')
  if (!(v.reached > 0)) out.push('المستفيدون الفعليون')
  if (!v.files.length) out.push('مرفق واحد على الأقل')
  if (out.length) return [`ينقص: ${out.join('، ')}`]
  run({ op: 'subResults', pfId, subId, ...v, note: v.note.trim(), by, at: now() })
  return []
}
export function savePfForm(id: string, fields: SubField[], by: string, role: RoleKey): string[] {
  if (role !== 'supervisor' && role !== 'grants-manager') return ['يُعدّ النموذج صاحب الصلاحية']
  run({ op: 'pfForm', id, fields, by, at: now() })
  return []
}
export function attachPfCriteria(id: string, file: string, by: string, role: RoleKey): string[] {
  if (role !== 'supervisor' && role !== 'grants-manager') return ['يحفظ المعايير صاحب الصلاحية']
  if (!/\.pdf$/i.test(file)) return ['المعايير بصيغة PDF']
  run({ op: 'pfCriteria', id, file, by, at: now() })
  return []
}
export const setPfReliable = (id: string, on: boolean, by: string) => run({ op: 'pfReliable', id, on, by, at: now() })
/** v3 · 13.2.6 · the portfolio sits on the body's session like any project */
export function pfToSession(id: string, sessionId: string, by: string, role: RoleKey): string[] {
  const pf = pfById(id)
  if (!pf || (pf.stage !== 'committee' && pf.stage !== 'board')) return ['المحفظة ليست عند اللجنة أو المجلس']
  const body = pf.stage === 'committee' ? 'committee' : 'board'
  if (!(body === 'committee' ? APPROVAL_RULES.committeeBy : APPROVAL_RULES.boardBy).includes(role)) return ['يُدرجها أمين الجلسة']
  const ss = SESSIONS.find((x) => x.id === sessionId)
  if (!ss || ss.body !== body || ss.state !== 'planned') return ['اختر جلسة قادمة للجهة نفسها']
  run({ op: 'pfAgenda', id, sessionId, by, at: now() })
  return []
}
export const pfSessions = (pf: PortfolioRec) => SESSIONS.filter((x) => x.state === 'planned' && x.body === (pf.stage === 'board' ? 'board' : 'committee'))
/** Retired 18 Oct (client decisions 14 · 33) · no per-member votes · the `pfVote` op still replays */
export function castPfVote(_id: string, _member: string, _vote: Vote, _by: string, _role: RoleKey): string[] {
  return ['لا تصويت للأعضاء في النظام · يسجّل المدير التنفيذي قرار الجهة النهائي مع المحضر (قرار المؤسسة)']
}
export function attachPfMinutes(id: string, file: string, by: string): string[] {
  if (!pfById(id)?.session) return ['المحفظة ليست على جدول جلسة']
  run({ op: 'pfMinutes', id, file, by, at: now() })
  return []
}
/** v3 · 13.2.30 · the comprehensive report's review, by the closing procedure's seats */
export function actOnPfClose(id: string, act: 'approve' | 'return', note: string, by: string, role: RoleKey): string[] {
  const pf = pfById(id)
  const st = pf?.close.stage
  if (!pf || !st) return ['لا تقرير شامل قيد المراجعة']
  const seat = st === 'supervisor' ? 'supervisor' : st === 'manager' ? 'grants-manager' : st === 'executive' ? 'ceo' : ''
  if (role !== seat) return ['ليس في محطتك']
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  const next: PfCloseStage | undefined = act === 'approve' ? (st === 'supervisor' ? 'manager' : st === 'manager' && pfApproverOf(pf, 'report') === 'ceo' ? 'executive' : 'evalDraft') : undefined
  run({ op: 'pfCloseAct', id, act, note: note.trim(), next, by, at: now() })
  return []
}
export function savePfEval(id: string, criteria: { key: string; label: string; weight: number; rating: number | null }[], notes: string, by: string, role: RoleKey): string[] {
  if (role !== 'supervisor') return ['يُعدّ التقييم مشرف المنح']
  run({ op: 'pfEvalSave', id, criteria, notes, by, at: now() })
  return []
}
export function actOnPfEval(id: string, act: 'send' | 'approve' | 'return', note: string, by: string, role: RoleKey): string[] {
  const pf = pfById(id)
  const st = pf?.close.stage
  if (!pf || !st) return ['لا تقييم']
  const seat = st === 'evalDraft' ? 'supervisor' : st === 'evalManager' ? 'grants-manager' : st === 'evalExecutive' ? 'ceo' : ''
  if (role !== seat) return ['ليس في محطتك']
  if (act === 'send' && pfEvalScore(pf) === null) return ['قيّم كل الأسئلة']
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  if (act === 'approve' && (st === 'evalExecutive' || pfApproverOf(pf, 'eval') === 'grants-manager')) {
    const miss = pfCloseChecks(pf).filter((c) => !c.ok && c.key !== 'report' && c.key !== 'eval')
    if (miss.length) return miss.map((c) => c.label)
  }
  run({ op: 'pfEvalAct', id, act, note: note.trim(), toExec: act === 'approve' && st === 'evalManager' ? pfApproverOf(pf, 'eval') === 'ceo' : undefined, by, at: now() })
  return []
}
/** v3 · 13.4.43 · a cancelled portfolio · by the executive (the portfolio's approver) · its recovery on the portfolio */
export function cancelPortfolio(id: string, reason: string, recover: number, by: string, role: RoleKey): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  /* Client 18 Oct · #34 · a system permission */
  if (!holds('portfolioCancelBy', role)) return [`يلغي المحفظة ${holdersSay('portfolioCancelBy')} (صلاحية في قرارات المؤسسة)`]
  if (pf.stage !== 'approved' && pf.stage !== 'closing') return ['تُلغى محفظة معتمدة قبل إغلاقها']
  if (!reason.trim()) return ['اكتب سبب الإلغاء']
  const paid = pfMoney(pf).confirmed
  if (recover < 0 || recover > paid) return [`المسترد بين 0 والمصروف ${nf.format(paid)}`]
  run({ op: 'pfCancel', id, reason: reason.trim(), recover, by, at: now() })
  return []
}
export function recordPfReceipt(id: string, amount: number, ref: string, file: string, by: string, role: RoleKey): string[] {
  const rc = pfById(id)?.recovery
  if (!rc) return ['لا مطالبة']
  if (role !== 'finance' && role !== 'supervisor') return ['تسجّله المالية أو مشرف المنح']
  if (!ref.trim() || !file) return ['مرجع التحويل وإشعاره']
  const left = rc.due - rc.receipts.reduce((n, x) => n + x.amount, 0)
  if (!(amount > 0) || amount > left) return [`المبلغ بين 1 و${nf.format(left)}`]
  run({ op: 'pfRecReceipt', id, amount, ref: ref.trim(), file, by, at: now() })
  return []
}

let paySeq = 0
export function recordEhsanPay(v: Pick<EhsanPay, 'target' | 'amount' | 'ref' | 'paidAt' | 'docs' | 'note'>, by: string): string[] {
  const bad = payIssues(v)
  if (bad.length) return bad
  run({ op: 'pay', pay: { ...v, ref: v.ref.trim(), id: `EP-${Date.now().toString(36)}${paySeq++}` }, by, at: now() })
  return []
}
export function reviewEhsanPay(id: string, act: 'confirm' | 'return', note: string, by: string): string[] {
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  run({ op: 'payAct', id, act, note, by, at: now() })
  return []
}
export function requestPfPay(pfId: string, no: number, amount: number, by: string, justification = '', docs: string[] = []): string[] {
  const pf = pfById(pfId)
  if (!pf) return ['المحفظة غير موجودة']
  const why = pfReqIssue(pf, no, amount)
  if (why) return [why]
  if (!justification.trim()) return [/* doc 9.2.3 */ 'اكتب مبرّر الطلب وما أُنجز']
  if (!docs.length) return ['أرفق مستندًا واحدًا على الأقل · تقرير الإنجاز أو الفواتير']
  run({ op: 'pfReq', pfId, req: { id: `PR-${pf.id.slice(-3)}-${pf.requests.length + 1}`, no, amount, why: justification.trim(), docs }, by, at: now() })
  return []
}
export function actOnPfReq(pfId: string, reqId: string, act: 'qualify' | 'permit' | 'approve' | 'order' | 'pay' | 'return', note: string, by: string, ref?: string, role?: RoleKey, amount?: number): string[] {
  const pf = pfById(pfId)
  const r = pf?.requests.find((x) => x.id === reqId)
  /* v3 · 13.2.24 · BPD-009's seats · the supervisor, the grants manager (the executive above his limit), finance */
  if (r && role) {
    const seat: Partial<Record<PfReqState, RoleKey[]>> = { supervisor: ['supervisor'], eligible: ['supervisor'], manager: ['grants-manager'], exec: ['ceo'], finance: ['finance'], order: ['finance'] }
    if (!seat[r.state]?.includes(role)) return ['ليس في محطتك']
  }
  if (act === 'qualify' && r?.state !== 'supervisor') return ['تُعتمد المتطلبات عند مشرف المنح']
  if (act === 'permit') {
    if (r?.state !== 'eligible') return ['يُنشأ الإذن بعد تأهل الدفعة']
    const slot = pf?.schedule.find((s) => s.no === r.no)
    if (!(amount && amount > 0) || (slot && amount > slot.amount)) return [`قيمة الإذن في حدود الدفعة ${nf.format(slot?.amount ?? 0)}`]
  }
  if (act === 'approve' && r?.state !== 'manager' && r?.state !== 'exec') return ['لا إذن بانتظار الاعتماد']
  /* v3 · 0.ent.8 · the order and the transfer stop too while the account is blocked · a return stays open */
  const blocked = act !== 'return' && pf ? payBlock(entityById(pf.entityId)) : ''
  if (blocked) return [blocked]
  if (act === 'order' && r?.state !== 'finance') return ['بعد اعتماد الإذن']
  if (act === 'pay' && r?.state !== 'order') return ['يُعتمد أمر الصرف أولًا']
  if (act === 'pay' && !ref?.trim()) return ['رقم أمر التحويل']
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  if (pf && (pf.stage === 'closed' || pf.stage === 'cancelled') && act !== 'return') return ['المحفظة مغلقة أو ملغاة']
  run({ op: 'pfReqAct', pfId, reqId, act, ref, note, amount, toExec: undefined, by, at: now() })
  return []
}
export function submitPfReport(id: string, report: string, evidence: string[], by: string): string[] {
  const pf0 = pfById(id)
  if (pf0?.items.some((x) => ['submitted', 'study', 'pending', 'approved', 'closing'].includes(x.state))) return [/* doc 13.2.29 */ 'بعد أن تصل المشاريع الفرعية كلها حالة نهائية · مكتمل أو متعثر أو مستبعد أو مرفوض']
  if (pf0?.close.stage && pf0.close.stage !== 'returned' && pf0.close.stage !== 'supervisor') return ['التقرير الشامل قيد المراجعة']
  if (!report.trim()) return ['نص التقرير الختامي']
  if (!evidence.length) return ['شاهد واحد على الأقل']
  run({ op: 'pfReport', id, report, evidence, by, at: now() })
  return []
}
/** v3 · 13.2.31 · the closing completes with the evaluation's approval (`actOnPfEval`) · this names what's left */
export function closePortfolio(id: string, by: string): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  if (pf.stage !== 'closing') return ['بعد رفع التقرير الشامل']
  const miss = pfCloseChecks(pf).filter((c) => !c.ok)
  if (miss.length) return miss.map((c) => c.label)
  void by
  return [/* doc 13.2.31 */ 'تُغلق المحفظة باعتماد تقييمها من صاحب الصلاحية']
}

export function saveEhSchedule(projectId: string, slots: EhSlot[], by: string): string[] {
  const p = projectOf(projectId)
  if (!p) return ['المشروع غير موجود']
  const g = ehGate(projectId)
  if (!g.schedule) return [g.why]
  if (!slots.length) return ['دفعة واحدة على الأقل · أو الدفعة الوحيدة وفق الواقع المالي']
  if (slots.some((x) => !(x.amount > 0) || !x.dueAt)) return ['أكمل قيمة كل دفعة وتاريخها']
  const sum = slots.reduce((s, x) => s + x.amount, 0)
  /* v3 · 11.2.8 · the total doesn't exceed the approved value · less is allowed */
  if (sum > p.amountGranted) return [`مجموع الجدول ${nf.format(sum)} يتجاوز قيمة المشروع ${nf.format(p.amountGranted)}`]
  if (payRequests.some((r) => r.projectId === projectId)) return ['بدأ الصرف على الجدول · يُعدَّل بقرار تعديل القيمة']
  run({ op: 'ehSchedule', projectId, slots: slots.map((x) => ({ ...x, needs: x.needs?.trim() || undefined, cond: x.cond?.trim() || undefined })), by, at: now() })
  return []
}
export function addEhOp(projectId: string, kind: string, note: string, by: string, ref?: string): string[] {
  if (!note.trim()) return ['اكتب ما جرى']
  run({ op: 'ehOp', projectId, kind, note, ref, by, at: now() })
  return []
}
/** The supervisor opens the plan of an Ehsan project · there's no entity on the portal to draft it (11.2.16) */
export function openEhsanPlan(projectId: string, by: string): string[] {
  /* v3 · 12.2.1 · no plan is made for an external project */
  void projectId; void by
  return ['المشروع الخارجي لا يتطلب خطة · لا تُنشأ له خطة في النظام']
}
/** v3 · 12.4.13 · tie an existing sub-project to a portfolio plan activity, or untie it */
export function linkSubActivity(pfId: string, subId: string, activityId: string, by: string): string[] {
  const pf = pfById(pfId)
  if (!pf?.items.some((x) => x.id === subId)) return ['المشروع الفرعي غير موجود']
  if (activityId && !pfActivities(pf).some((x) => x.id === activityId)) return ['النشاط ليس في خطة المحفظة']
  run({ op: 'subLink', pfId, subId, activityId, by, at: now() })
  return []
}
export function addExtDoc(projectId: string, file: string, by: string): string[] {
  if (!viaEhsan(projectId)) return ['للمشروع الخارجي وحده']
  if (!/\.pdf$/i.test(file)) return ['الاتفاقية أو الوثيقة الخارجية بصيغة PDF']
  run({ op: 'extDoc', projectId, file, by, at: now() })
  return []
}
export function saveEhReport(projectId: string, report: string, evidence: string[], by: string): string[] {
  if (!report.trim()) return ['نص التقرير الختامي']
  if (!evidence.length) return ['شاهد واحد على الأقل']
  run({ op: 'ehReport', projectId, report, evidence, by, at: now() })
  return []
}
/** v3 · 11.2.13 · the supervisor sends the gathered requirements and proofs to the grants manager */
export function closeEhsanProject(projectId: string, by: string, report?: string, evidence?: string[]): string[] {
  const c = ehCloseOf(projectId)
  const rep = report ?? c?.report ?? ''
  const ev = evidence ?? c?.evidence ?? []
  if (c?.closedAt) return ['أُغلق المشروع']
  if (c?.state === 'manager') return ['الإغلاق عند مدير المنح']
  if (!rep.trim()) return ['ملخص الإغلاق']
  if (!ev.length) return ['إثبات واحد على الأقل · إثباتات التحويل والتنفيذ']
  const miss = ehCloseChecks(projectId).filter((x) => !x.ok && x.key !== 'report')
  if (miss.length) return miss.map((x) => x.label)
  run({ op: 'ehCloseSend', projectId, report: rep.trim(), evidence: ev, by, at: now() })
  return []
}
/** v3 · 11.2.14 · the grants manager approves the closing or returns it */
export function decideExternalClosing(projectId: string, act: 'approve' | 'return', note: string, by: string, role: RoleKey,
  outcome: ExtCloseOutcome = 'complete', redirect?: { purpose: string; decision: string; file: string }): string[] {
  if (role !== 'grants-manager') return ['يعتمد إغلاق المشروع الخارجي مدير المنح']
  if (ehCloseOf(projectId)?.state !== 'manager') return ['لا إغلاق بانتظار الاعتماد']
  if (act === 'return' && !note.trim()) return ['اكتب ما ينقص']
  if (act === 'approve') { const miss = ehCloseChecks(projectId).filter((x) => !x.ok); if (miss.length) return miss.map((x) => x.label) }
  /* v3 · 11.2.14 · a cancellation carries its reason · a redirect its new purpose, decision number and document (10.9.2) */
  if (act === 'approve' && outcome === 'cancel' && !note.trim()) return ['اكتب سبب الإلغاء']
  if (act === 'approve' && outcome === 'redirect' && (!redirect?.purpose.trim() || !redirect.decision.trim() || !redirect.file)) return ['وثّق إعادة التوجيه · الغرض الجديد ورقم القرار ومستنده']
  run({ op: 'ehCloseAct', projectId, act, note: note.trim(), paid: paidOf(projectId), outcome: act === 'approve' ? outcome : undefined,
    redirect: act === 'approve' && outcome === 'redirect' ? { purpose: redirect!.purpose.trim(), decision: redirect!.decision.trim(), file: redirect!.file } : undefined, by, at: now() })
  return []
}
/** v3 · 11.2.11 · the execution's state from the external party's proofs */
export function recordExec(projectId: string, v: { status: ExecState; progress: number; note: string; files: string[] }, by: string, role: RoleKey): string[] {
  if (!EXT_CREATE.includes(role)) return ['يحدّث حالة التنفيذ صاحب الصلاحية']
  if (!viaEhsan(projectId)) return ['للمشروع الخارجي وحده']
  if (!EXEC_STATES.includes(v.status)) return ['اختر حالة التنفيذ']
  if (!(v.progress >= 0 && v.progress <= 100)) return ['نسبة الإنجاز بين 0 و100']
  if (v.status === 'منجز' && !v.files.length) return ['أرفق إثبات التنفيذ من الجهة الخارجية']
  run({ op: 'ehExec', projectId, exec: { status: v.status, progress: v.progress, note: v.note.trim(), files: v.files }, by, at: now() })
  return []
}

/* v3 · 11.2.1 · the reference record · 11.4.2 · its minimum data from the settings */
export function createExternalParty(v: { name: string; region: string; city: string; transfer: string; refs: string }, by: string, role: RoleKey): { id?: string; errors: string[] } {
  if (!EXT_ADMIN.includes(role)) return { errors: ['يُنشئ السجل المرجعي صاحب صلاحية تسجيل الجهات واعتمادها'] }
  const errors: string[] = []
  if (!v.name.trim()) errors.push('اسم الجهة الخارجية')
  if (entityRows.some((e) => e.name.trim() === v.name.trim() && !e.archived)) errors.push('للجهة سجل من قبل')
  for (const f of EXT_CFG.party) if (!v[f].trim()) errors.push(EXT_PARTY_FIELD_SAY[f])
  if (errors.length) return { errors }
  /* numeric like every entity id · the entity file derives its fixture details from the number */
  let n = 9001
  while (entityById(String(n))) n++
  const id = String(n)
  run({ op: 'extParty', id, name: v.name.trim(), region: v.region, city: v.city, transfer: v.transfer.trim(), refs: v.refs.trim(), by, at: now() })
  return { id, errors: [] }
}
export function saveExtCfg(cfg: { party: ExtPartyField[]; project: ExtProjectField[] }, by: string, role: RoleKey): string[] {
  if (!EXT_ADMIN.includes(role)) return ['الإعداد لصاحب الصلاحية']
  run({ op: 'extCfg', party: cfg.party, project: cfg.project, by, at: now() })
  return []
}
/** v3 · 11.2.2 · 11.4.3 · the authority creates the project inside the system with the simplified data ·
    it then goes through the regular study and approval (11.2.4) */
export interface ExtProjectDraft {
  name: string; party: string; track: string; field: string; goal: string; description: string; amount: number; days: number; funding: string; method: string; region: string; startAt: string; files: string[]
  /** Client 20 Oct (#43) · the transfer method · the entity's own account, or a third party's */
  transfer?: ExtTransfer | ''
  account?: string
  third?: ExtThird
  /** Client 20 Oct (#44) · «هل يوجد جهة مشاركة؟» · the sharing entity from the system's list */
  shared?: boolean
  sharedWith?: string
}
const ibanOk = (x: string) => /^SA\d{22}$/.test(x.replace(/\s+/g, '').toUpperCase())
export function externalDraftIssues(v: ExtProjectDraft): string[] {
  const out: string[] = []
  if (!v.name.trim()) out.push('اسم المشروع')
  if (partyIssue(v.party)) out.push(partyIssue(v.party))
  if (!v.track) out.push('المسار')
  if (!v.field) out.push('المجال')
  if (!v.goal) out.push('الهدف')
  if (!(v.amount > 0)) out.push('المبلغ')
  /* a legacy draft names the method in words · it counts as the transfer method */
  if (!v.transfer && !v.method) out.push('طريقة التحويل')
  if (v.transfer === 'self' && !v.account) out.push('حساب الجهة البنكي')
  if (v.transfer === 'third') {
    if (!v.third?.holder.trim()) out.push('اسم صاحب حساب الطرف الثالث')
    if (!v.third?.bank) out.push('بنك الطرف الثالث')
    if (!v.third?.iban.trim()) out.push('آيبان الطرف الثالث')
    else if (!ibanOk(v.third.iban)) out.push('آيبان الطرف الثالث بصيغة SA و22 رقمًا')
    if (!v.third?.files.length) out.push('مستند حساب الطرف الثالث')
  }
  if (v.shared && !v.sharedWith) out.push('الجهة المشاركة')
  const has: Record<ExtProjectField, boolean> = { goal: Boolean(v.goal), description: Boolean(v.description.trim()), funding: Boolean(v.funding), method: Boolean(v.transfer || v.method), region: Boolean(v.region), startAt: Boolean(v.startAt), files: v.files.length > 0 }
  for (const f of EXT_CFG.project) if (!has[f] && !out.includes(EXT_PROJECT_FIELD_SAY[f]) && f !== 'goal' && f !== 'method') out.push(EXT_PROJECT_FIELD_SAY[f])
  return out
}
export function createExternalProject(v: ExtProjectDraft, by: string, role: RoleKey): { id?: string; errors: string[] } {
  if (!EXT_CREATE.includes(role)) return { errors: ['يُنشئ المشروع الخارجي صاحب الصلاحية داخل النظام'] }
  const errors = externalDraftIssues(v)
  if (errors.length) return { errors }
  const party = entityById(v.party)!
  const method = v.transfer ? EXT_TRANSFER_SAY[v.transfer] : v.method
  const id = submitRequest({
    entityId: party.id, external: party.id, externalName: party.name, name: v.name.trim(), track: v.track, field: v.field, goal: v.goal,
    region: v.region || party.region, city: party.city, amountRequested: String(v.amount), workDays: v.days > 0 ? String(v.days) : '', reach: '0',
    objectives: v.description.trim(), outputs: '', startAt: v.startAt, method, funding: v.funding,
  }, [], by, false)
  if (v.files.length) run({ op: 'extFiles', projectId: id, files: v.files, by, at: now() })
  if (v.transfer) {
    const meta: ExtMeta = { transfer: v.transfer, ...(v.transfer === 'self' ? { account: v.account } : { third: { holder: v.third!.holder.trim(), bank: v.third!.bank, iban: v.third!.iban.replace(/\s+/g, '').toUpperCase(), files: v.third!.files } }), ...(v.shared && v.sharedWith ? { sharedWith: v.sharedWith } : {}) }
    run({ op: 'extMeta', projectId: id, meta, by, at: now() })
  }
  return { id, errors: [] }
}

export const resetPartners = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }

/* ── Finance desk · what waits for the financial review (11.2.13 · 11.2.20 · 13.2.24) ── */
export function financeQueue() {
  return {
    pays: EHSAN_PAYS.filter((p) => p.state === 'review'),
    requests: PORTFOLIOS.flatMap((pf) => pf.requests.filter((r) => r.state === 'finance' || r.state === 'order').map((r) => ({ pf, r }))),
  }
}

/* ── The reports' view · Ehsan projects and the sub-projects, each marked (11.4.26 · 13.2.27) ── */
export interface PartnerReportRow { key: string; kind: typeof EXT_KIND | 'محفظة' | 'مشروع فرعي'; name: string; partner: string; region: string; value: number; paid: number; state: string; href: string }
export function partnerReport(): PartnerReportRow[] {
  const out: PartnerReportRow[] = []
  for (const p of ehsanProjects()) {
    const m = ehMoney(p.id)
    out.push({ key: p.id, kind: EXT_KIND, name: p.name, partner: p.platform ?? p.entityName, region: p.region, value: m.value, paid: paidOf(p.id), state: p.statusGroup, href: ROUTES.project(p.id) })
  }
  for (const pf of PORTFOLIOS) {
    const m = pfMoney(pf)
    out.push({ key: pf.id, kind: 'محفظة', name: pf.name, partner: partnerName(pf.entityId), region: 'متعدد', value: pf.total, paid: m.confirmed, state: PF_STAGE_SAY[pf.stage], href: ROUTES.portfolio(pf.id) })
    for (const s of pf.items.filter(isLiveSub)) {
      out.push({ key: `${pf.id}/${s.id}`, kind: 'مشروع فرعي', name: s.name, partner: pf.name, region: s.region, value: s.amount, paid: subMoney(pf, s).confirmed, state: SUB_STATE_SAY[s.state], href: `${ROUTES.portfolio(pf.id)}#${s.id}` })
    }
  }
  return out
}

/** Batch 7 · partners#12 · the portfolio agreement's clauses from its own terms (13.2.9) */
export function pfAgreementText(pf: PortfolioRec): string[] {
  const partner = partnerName(pf.entityId)
  const sched = pf.schedule.length
    ? pf.schedule.map((x) => `الدفعة ${x.no}: ${nf.format(x.amount)} ريال في ${x.dueAt}`).join('؛ ')
    : pf.channel === 'ehsan' ? 'تُنفَّذ الدفعات عبر منصة إحسان لكل مشروع فرعي وتؤكدها الإدارة المالية' : 'وفق جدول الدفعات الملحق'
  return [
    `الطرف الأول: مؤسسة سليمان عبدالعزيز أبانمي الأهلية · الطرف الثاني: ${partner}.`,
    `موضوع الاتفاقية: محفظة «${pf.name}» في مسار ${pf.track} ومجال ${pf.field}، بقيمة إجمالية ${nf.format(pf.total)} ريال لسنة ${pf.year}.`,
    `الأهداف: ${pf.goals || '—'}.`,
    /* doc 13.2.18 */ 'تحكم هذه الاتفاقية المشاريع الفرعية كلها تحت المحفظة، ولا تُبرم اتفاقية لكل مشروع فرعي · يُعتمد كل مشروع فرعي في حدود الرصيد المتاح.',
    `آلية الصرف: ${sched}.`,
    `خطة المحفظة: ${pf.plan.phases.length ? pf.plan.phases.map((ph) => `${ph.name} (${ph.from} – ${ph.to})`).join('، ') : 'تُرفق الخطة المعتمدة ملحقًا'}.`,
    'يلتزم الطرف الثاني برفع تقارير التنفيذ لكل مشروع فرعي، وبالتقرير الختامي للمحفظة وشواهده قبل الإغلاق.',
    'تسري الاتفاقية من تاريخ توقيع ممثل المؤسسة بعد توقيع الطرف الثاني.',
  ]
}

/* ── Partner closings on the closings desk (11.2.21 · 13.2.26) ──
   Batch 4 · 8 Oct · a portfolio's closing and an Ehsan project's closing ran on their own pages and
   never showed in /closings. They keep their own procedure (no final-report cycle of BPD-010), so the
   desk lists them in their own section, each with where its closing stands and a link to it. */
export interface PartnerClosing {
  id: string
  kind: 'portfolio' | 'ehsan'
  name: string
  partner: string
  owner: string
  state: 'running' | 'closing' | 'closed'
  /** The report's day, or the closing's */
  at?: string
  href: string
}
export const PARTNER_CLOSE_SAY: Record<PartnerClosing['state'], string> = {
  running: 'تحت التنفيذ · بانتظار التقرير الختامي أو متطلبات الإغلاق',
  closing: 'رُفعت المتطلبات · بانتظار اعتماد الإغلاق',
  closed: 'مغلق',
}
export function partnerClosings(): PartnerClosing[] {
  const out: PartnerClosing[] = []
  for (const pf of PORTFOLIOS) {
    if (pf.stage !== 'approved' && pf.stage !== 'closing' && pf.stage !== 'closed') continue
    out.push({
      id: pf.id, kind: 'portfolio', name: pf.name, partner: partnerName(pf.entityId), owner: pf.owner,
      state: pf.stage === 'closed' ? 'closed' : pf.stage === 'closing' ? 'closing' : 'running',
      at: pf.close.closedAt ?? pf.close.at, href: ROUTES.portfolio(pf.id),
    })
  }
  for (const p of ehsanProjects()) {
    if (p.supportStatus !== 'معتمد') continue
    const c = ehCloseOf(p.id)
    out.push({
      id: p.id, kind: 'ehsan', name: p.name, partner: p.platform ?? p.entityName, owner: p.owner ?? '',
      state: c?.closedAt ? 'closed' : c?.state === 'manager' ? 'closing' : 'running', at: c?.closedAt ?? c?.sentAt ?? c?.at, href: ROUTES.project(p.id),
    })
  }
  const ORDER = { closing: 0, running: 1, closed: 2 } as const
  return out.sort((a, b) => ORDER[a.state] - ORDER[b.state])
}
