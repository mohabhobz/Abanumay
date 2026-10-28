import { done } from '@/data/feedback'
import { liveClock } from '@/data/stageClock'
import { setPfCloseRules } from '@/data/partners/store'
import { hasLegacy } from '@/data/payments/legacy'
import { SEED_AT, actDay, asOf } from '@/data/clock'
import { useSyncExternalStore } from 'react'
import {
  CLOSE_DOCS, TODAY, closeById, closeOfProject, closeRows, closeStageLabel, evalBlockers, needsComms,
  reportBlockers, setOpenGate, setReqGate,
} from '@/data/mock/closing'
import { projectRows } from '@/data/mock/projects'
import { planDone, planOfProject } from '@/data/mock/plans'
import { stageMeta } from '@/data/mock/taxonomy'
import { payRequests } from '@/data/mock/disbursements'
import { agrFlowOf, agreementsOfProject, inForceOf, annexValue, outputsOf } from '@/data/agreements/store'
import { submitRequest } from '@/data/intake/flow'
import { hasFunding, releaseRecovered, releaseSavings, resizeIssue, resizeLink } from '@/data/budget/store'
import {
  adjustSchedule, isStopped, paidOf, scheduleOf, stopForClosing, stopProjectPayments, unsettledSlots, unpaidBeforeClosing, usePayments,
} from '@/data/payments/store'
import { roleByKey, type RoleKey } from '@/data/roles'
import { DECISIONS, holds, holdersSay } from '@/data/shared/decisions'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import type {
  CaseKind, CaseRow, CaseStage, CloseAudit, CloseFinance, CloseRow, CloseStage, EntityFeedback, FinalReport,
  EvalSeat, ProjectEval, Recovery, RecoveryReceipt, ReportUpload, SupportRedirect,
} from '@/types/domain'
import { isDone, isLive } from '@/data/status'

/* Closing and distress (BPD-010) · the actions.

   The fixture builds the closing records already in the system; this store moves them and keeps
   every move. Same model as the other procedures: an ordered list of operations kept in the
   browser and replayed at load, so a reload lands on the same state; in production each operation
   is a POST. Every operation carries its own ids, so a replay rebuilds the same records.

   Two families live here:
   · the ordinary closing · eligibility (10.4.1 · 10.4.2), the entity's report with its numbers,
     financial report and files (10.2.3 – 10.2.6), the report's approval cycle with its own returns
     (10.2.7 – 10.2.17), the evaluation's separate cycle and log (10.2.18 – 10.2.20 · 10.4.17), the
     entity's evaluation of the foundation (10.3.2), versions with their content (10.4.15 · 10.4.19)
     and the final closing that turns the project «مكتمل» once the report, the evaluation and the
     financial and administrative requirements are all done (10.4.8 · 10.4.16 · 10.4.18)
   · the distress cases (10.9) · a stop, a cut or a raise of the value, each its own record that
     goes supervisor → grants manager → CEO and changes the project only when the CEO approves;
     and the money that follows: what the entity returns (once or in instalments), what can't be
     recovered (claims, escalation, a final decision), and what goes back to the domain allocation
     (the project's budget line), at once or receipt by receipt as the policy says */

/* ── Rules · the policy the settings page edits ── */

/** v3 · 10.4.11 · the closing's approval matrix · who approves each item last · the executive by
    default, the grants manager when set so, or below a value the foundation sets · no limit is fixed
    in the code */
export type MatrixKey = 'report' | 'eval' | 'stop' | 'reduce' | 'increase' | 'savings' | 'redirect'
export interface MatrixRule { final: 'ceo' | 'grants-manager'; below?: number }
export const MATRIX_SAY: Record<MatrixKey, string> = {
  report: 'اعتماد التقرير الختامي', eval: 'اعتماد تقييم المشروع', stop: 'إيقاف المشروع أو إلغاؤه',
  reduce: 'تخفيض قيمة المشروع', increase: 'زيادة قيمة المشروع', savings: 'القرار النهائي في الوفر غير المسترد', redirect: 'إعادة توجيه الدعم',
}
/** `points` · client 28 Oct · the question takes points out of its weight (the old system's way) instead of a 1–5 rating */
export interface EvalCriterion { key: string; label: string; weight: number; points?: boolean }
export interface CloseRules {
  /** 10.9.3 · 10.9.8 · recovered money goes back to the line at once when the recovery completes, or with each receipt */
  releaseMode: 'once' | 'gradual'
  /** v3 · 0.status.9 · 10.4.11 · who records a redirection of support · an older setting · the matrix decides now */
  redirectBy?: RoleKey[]
  matrix?: Partial<Record<MatrixKey, MatrixRule>>
  /** v3 · 10.4.31 · the evaluation's questions and weights · for evaluations started after the change */
  evalCriteria?: EvalCriterion[]
}
/* Client 28 Oct · the old system's evaluation questions, each with its points · asked of every evaluator
   (the supervisor, the grants manager, the executive) · the score is the points' sum out of 100 */
export const EVAL_CRITERIA_DEFAULT: EvalCriterion[] = [
  { key: 'time', label: 'مدى التطابق بين الخطة الزمنية الأساسية والفعلية للمشروع', weight: 20, points: true },
  { key: 'outputs', label: 'مدى التطابق بين مخرجات المشروع الأساسية والفعلية', weight: 20, points: true },
  { key: 'budget', label: 'مدى التطابق بين الموازنة المالية الأساسية والفعلية للمشروع', weight: 20, points: true },
  { key: 'reach', label: 'مدى التطابق بين عدد المستفيدين الأساسي والفعلي من المشروع بشكل مباشر', weight: 10, points: true },
  { key: 'reports', label: 'جودة تقارير المشروع', weight: 20, points: true },
  { key: 'engage', label: 'مدى تفاعل الجهة في استكمال متطلبات المشروع', weight: 10, points: true },
]
/** The earlier weighted 1–5 questions · what a portfolio's closing keeps asking */
export const EVAL_CRITERIA_LEGACY: EvalCriterion[] = [
  { key: 'goals', label: 'تحقيق الأهداف والمخرجات المتفق عليها', weight: 40 },
  { key: 'quality', label: 'جودة التنفيذ', weight: 25 },
  { key: 'time', label: 'الالتزام بمدة التنفيذ', weight: 15 },
  { key: 'money', label: 'كفاءة استخدام المنحة', weight: 20 },
]
/** The questions a new evaluation asks · the settings' list, else the default */
export const evalCriteriaNow = (): EvalCriterion[] => CLOSE_RULES.evalCriteria ?? EVAL_CRITERIA_DEFAULT
export const CLOSE_RULES: CloseRules = { releaseMode: 'once', redirectBy: ['ceo'], matrix: {}, evalCriteria: EVAL_CRITERIA_DEFAULT }
/** Who approves an item last for this project · its value read against the rule */
export function approverFor(key: MatrixKey, projectId: string, value?: number): 'ceo' | 'grants-manager' {
  const r = CLOSE_RULES.matrix?.[key]
  if (!r) return 'ceo'
  if (r.final === 'grants-manager') return 'grants-manager'
  const v = value ?? grantOf(projectId)
  return r.below && v < r.below ? 'grants-manager' : 'ceo'
}
export const APPROVER_SAY = (k: 'ceo' | 'grants-manager') => (k === 'ceo' ? CEO() : MGR())
export const RELEASE_SAY: Record<CloseRules['releaseMode'], string> = {
  once: 'دفعة واحدة عند اكتمال الاسترداد',
  gradual: 'تدريجيًّا مع كل مبلغ يُستلم',
}

/** 10.3.2 · what the entity rates the foundation on */
export const FEEDBACK_ITEMS: { key: string; label: string }[] = [
  { key: 'clarity', label: 'وضوح الإجراءات والمتطلبات' },
  { key: 'speed', label: 'سرعة الصرف والردود' },
  { key: 'support', label: 'تعاون مشرف المنح ودعمه' },
  { key: 'portal', label: 'سهولة بوابة المنح' },
]

/* ── Notifications · read by the drawer ── */

export interface CloseNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const CLOSE_NOTES: CloseNote[] = []
const notify = (to: string[], title: string, context: string, href: string, at?: string) => {
  for (const t of to) CLOSE_NOTES.unshift({ id: `cln-${CLOSE_NOTES.length + 1}`, to: t, title, context, at: at ?? actDay(), href })
}
function MGR() { return roleByKey('grants-manager').title }
function CEO() { return roleByKey('ceo').title }

/* ── Readers ── */

/** v3 · 10.2.11 · 10.4.13 · media publication is reviewed when the agreement in force asks for it ·
    a clause or obligation on media appearance or publication */
export function mediaInAgreement(projectId: string): boolean {
  const a = inForceOf(projectId)
  if (!a) return false
  return agrFlowOf(a.id).clauses.some((c) => /الإعلام|الإعلامي|النشر|الظهور/.test(`${c.title} ${c.body}`))
}
/** v3 · 10.4.4 · the outputs agreed · from the project, each with what was achieved */
const agreedOutputs = (projectId: string) => outputsOf(projectId).outputs.map((text) => ({ text, achieved: '' }))

const projectOf = (id: string) => projectRows.find((p) => p.id === id)
/** Re-audit 17 Oct · a closed closing names the status its project closed on · «مغلق · مغلق بوفر» read
    «مغلق · مكتمل» for a project that kept a saving */
export const closeSayOf = (c: Pick<CloseRow, 'stage' | 'projectId'>): string => {
  if (c.stage !== 'closed') return closeStageLabel(c.stage)
  const g = projectOf(c.projectId)?.statusGroup
  return g && g !== 'مكتمل' ? `مغلق · ${g}` : closeStageLabel(c.stage)
}
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function isRunning(p: { statusGroup: string; stage: string }): boolean {
  /* v3 · 0.status.5 · 0.status.6 · in execution or already closing */
  return p.statusGroup === 'تحت التنفيذ' || p.statusGroup === 'قيد الإغلاق'
}

/** The execution's end · the project's own date, else its start plus its duration */
export function projectEnd(projectId: string): string | undefined {
  const p = projectOf(projectId)
  if (!p) return undefined
  if (p.endAt) return p.endAt
  const start = inForceOf(projectId)?.activeAt ?? p.startAt ?? p.decidedAt ?? p.submittedAt
  return start && p.durationDays ? addDays(start, p.durationDays) : undefined
}

/** Paid to date · the payments screen's own reading · from the disbursement requests whenever the
    project has a schedule there (requests, or an agreement in force), else (a project paid before
    the system) the grant.
    Batch 2 · 8 Oct · it fell back to the grant whenever no request existed, so 21020 (agreement in
    force, nothing paid) read 428,000 paid in closing and 0 in payments, and a stop asked for a
    171,200 recovery of money never paid. */
export const paidToDate = (projectId: string): number => {
  if (payRequests.some((r) => r.projectId === projectId) || scheduleOf(projectId).length || hasLegacy(projectId)) return paidOf(projectId)
  const p = projectOf(projectId)
  return p && (isRunning(p) || isDone(p.statusGroup) || p.statusGroup === 'متعثر') ? (p.amountGranted || p.amountRequested) : 0
}
export const grantOf = (projectId: string): number => {
  const p = projectOf(projectId)
  return p ? (p.amountGranted || p.amountRequested) : 0
}


/** 10.4.1 · 10.4.2 · may a closing open · and on what basis */
export function openGate(projectId: string): { ok: boolean; why: string; basis?: CloseRow['basis'] } {
  const p = projectOf(projectId)
  if (!p) return { ok: false, why: 'المشروع غير موجود' }
  const stopped = casesOfProject(projectId).some((c) => c.kind === 'stop' && (c.stage === 'approved' || c.stage === 'closed'))
  /* v3 · 11.2.13 · 11.4.12 · a project supported through an external party closes on its own card · no
     regular final report, no evaluation, the grants manager approves */
  if (p.platform) return { ok: false, why: 'مشروع مدعوم عبر جهة خارجية · يُغلق من بطاقته بمتطلبات الإغلاق وإثباتات التحويل والتنفيذ واعتماد مدير المنح' }
  if (!stopped && !isRunning(p)) return { ok: false, why: /* doc rule 1 */ 'المشروع ليس «تحت التنفيذ» · لا يُفتح الإغلاق لمشروع في الدراسة أو قبل اتفاقيته' }
  const plan = planOfProject(projectId)
  const end = projectEnd(projectId)
  const basis: CloseRow['basis'] | undefined =
    stopped ? 'stopped'
    : plan && planDone(plan) >= 100 ? 'complete'
    : end && end <= TODAY ? 'ended'
    : undefined
  if (!basis) {
    return {
      ok: false,
      why: plan
        ? /* doc rule 1 */ `لم تكتمل خطة التنفيذ (${nf.format(Math.round(planDone(plan)))} بالمئة) ولم تنتهِ المدة${end ? ` (تنتهي ${end})` : ''} ولا قرار إنهاء معتمد`
        : /* doc rule 1 */ `لم تنتهِ مدة التنفيذ${end ? ` (تنتهي ${end})` : ''} ولا قرار إنهاء معتمد`,
    }
  }
  if (!stopped) {
    /* Client 18 Oct (sheet V2 · #47) · the closing opens only once every payment is paid or settled · the
       one that follows the final report is the exception (the closing pays it) · decision 21 still stops
       an open request on that exempt payment when the closing opens */
    const due = unpaidBeforeClosing(projectId)
    if (due.length) return { ok: false, why: /* doc rule 2 */ `لا يُفتح الإغلاق قبل صرف كل الدفعات أو تسويتها (الدفعة ${due.map((s) => s.no).join(' و')}) · المستثناة الدفعة المرتبطة بالتقرير الختامي` }
  }
  return { ok: true, why: basis === 'stopped' ? 'مؤهَّل · قرار إيقاف معتمد' : basis === 'complete' ? 'مؤهَّل · اكتملت الأنشطة' : 'مؤهَّل · انتهت مدة التنفيذ', basis }
}

/** 10.9.7 · what the entity holds unused · paid minus the spend approved from the executive financial report (10.4.6) */
export const savingsOf = (c: CloseRow): number => {
  const v = c.finance?.verified
  if (v === null || v === undefined) return 0
  return Math.max(0, paidToDate(c.projectId) - caseSettled(c.projectId) - v)
}
/** Verifier · 16 Oct · what a distress decision already settled of the paid money · received back on its
    recovery, or redirected by it · the closing doesn't claim it a second time */
export function caseSettled(projectId: string): number {
  return casesOfProject(projectId).filter((k) => k.stage === 'approved' || k.stage === 'closed').reduce((s, k) =>
    s + (k.recovery ? k.recovery.receipts.reduce((n, x) => n + x.amount, 0) : 0) + (k.applied?.redirected ?? 0), 0)
}
/** The closing's own redirect leaves this much of the saving to claim back */
export const savingsDue = (c: CloseRow): number => Math.max(0, savingsOf(c) - (c.redirect?.redirected ?? 0))

const recLeft = (r?: Recovery) => (r ? r.due - r.receipts.reduce((s, x) => s + x.amount, 0) : 0)
export const recoveryLeft = recLeft
const recSettled = (r?: Recovery) => !r || r.state === 'done' || r.state === 'decided'

/** 10.4.8 · 10.4.18 · 10.1.output-4 · every financial and administrative requirement, named */
export function requirementsOf(c: CloseRow): { key: string; label: string; ok: boolean; say: string }[] {
  const open = payRequests.filter((r) => r.projectId === c.projectId && r.state !== 'paid' && r.state !== 'closed')
  const slots = unsettledSlots(c.projectId)
  const left = [...slots.due, ...slots.future].filter((s) => s.state !== 'pending')
  const f = c.finance
  const sav = savingsOf(c)
  const due = savingsDue(c)
  return [
    { key: 'pay', label: 'لا طلب صرف مفتوح', ok: !open.length, say: open.length ? `${open.length} طلب صرف مفتوح` : 'لا طلب صرف مفتوح' },
    { key: 'slots', label: 'الدفعات مصروفة أو مسوّاة', ok: isStopped(c.projectId) || !left.length, say: left.length && !isStopped(c.projectId) ? `الدفعة ${left.map((s) => s.no).join(' و')} لم تُصرف ولم تُسوَّ` : 'كل الدفعات مصروفة أو مسوّاة' },
    { key: 'finance', label: 'التقرير المالي الختامي', ok: Boolean(f && f.lines.every((l) => l.spent !== null)), say: f && f.lines.every((l) => l.spent !== null) ? 'مكتمل' : 'لم يكتمل التقرير المالي' },
    { key: 'invoices', label: 'اعتماد المصروف من التقرير المالي التنفيذي', ok: f?.verified !== null && f?.verified !== undefined, say: f?.verified != null ? `اعتمد المشرف المصروف ${nf.format(f.verified)}` : 'لم يعتمد المشرف المصروف من التقرير المالي التنفيذي' },
    { key: 'recovery', label: 'الوفر مسترد أو بقرار', ok: due === 0 ? recSettled(c.recovery) : Boolean(c.recovery) && recSettled(c.recovery), say: c.redirect && due === 0 && !c.recovery ? `أُعيد توجيه ${nf.format(c.redirect.redirected)} بقرار معتمد` : sav === 0 && !c.recovery ? (caseSettled(c.projectId) ? 'سُوّي المصروف بقرار الحالة' : 'لا وفر') : !c.recovery ? `وفر ${nf.format(due)} بلا مطالبة` : c.recovery.state === 'decided' ? 'قرار نهائي معتمد' : c.recovery.state === 'done' ? 'اكتمل الاسترداد' : `متبقٍّ ${nf.format(recLeft(c.recovery))}` },
  ]
  /* v3 · 10.4.30 · the entity's evaluation of the foundation is deferred · optional, not a requirement */
}

/* ── Distress cases ── */

export const CASES: CaseRow[] = []
export const caseById = (id: string) => CASES.find((c) => c.id === id)
export const casesOfProject = (projectId: string) => CASES.filter((c) => c.projectId === projectId)
export const CASE_KIND_SAY: Record<CaseKind, string> = { stop: 'إيقاف المشروع', reduce: 'تخفيض القيمة', increase: 'زيادة القيمة', direct: 'إغلاق مباشر' }
/** #27 · the direct closing's fixed path · the client named it */
export const DIRECT_PATH = ['مشرف المنح', 'مدير المنح', 'المدير التنفيذي', 'الإدارة المالية']
export const CASE_STAGE_SAY: Record<CaseStage, string> = {
  draft: 'عند مشرف المنح', settle: 'تسوية المصروف', manager: 'عند مدير المنح', recover: 'استرداد قبل الرفع', ceo: 'عند المدير التنفيذي', finance: 'عند الإدارة المالية',
  approved: 'معتمد · استرداد جارٍ', returned: 'مُعاد بملاحظات', rejected: 'مرفوض', closed: 'مقفل',
}
export const CASE_STAGE_TONE: Record<CaseStage, 'mute' | 'warn' | 'teal' | 'ok' | 'no' | 'ret'> = {
  draft: 'mute', settle: 'warn', manager: 'teal', recover: 'warn', ceo: 'teal', finance: 'teal', approved: 'warn', returned: 'ret', rejected: 'no', closed: 'ok',
}

/** v3 · 10.9.1 – 10.9.3 · 10.4.28 · the outcomes a decision may take · by its kind and where the money stands */
export const OUTCOME_SAY: Record<NonNullable<CaseRow['outcome']>, string> = {
  cancel: 'إلغاء المشروع («ملغى»)', distress: 'مشروع متعثر', redirect: 'إعادة توجيه الدعم', recover: 'استرداد الفرق', annex: 'ملحق بزيادة القيمة', independent: 'مشروع مستقل جديد',
}
export function outcomesFor(kind: CaseKind, projectId: string, newAmount?: number): NonNullable<CaseRow['outcome']>[] {
  if (kind === 'direct') return []
  const paid = paidToDate(projectId)
  if (kind === 'stop') return paid <= 0 ? ['cancel'] : paid >= grantOf(projectId) ? ['cancel', 'redirect'] : ['distress', 'cancel', 'redirect']
  if (kind === 'reduce') return paid > (newAmount ?? 0) ? ['recover', 'redirect'] : ['recover']
  return ['annex', 'independent']
}

/** 10.9.1 – 10.9.4 · where a stop lands · the phase decides the settlement it needs */
export function stopPhase(projectId: string): { key: 'before' | 'partial' | 'after' | 'future'; say: string; needsSettle: boolean } {
  const paid = paidToDate(projectId)
  const granted = grantOf(projectId)
  const s = unsettledSlots(projectId)
  if (paid <= 0) return { key: 'before', say: 'قبل أي صرف · يُحرَّر الحجز كاملًا ولا استرداد', needsSettle: false }
  if (paid >= granted) return { key: 'after', say: 'بعد تحويل كامل المنحة · تقرير مالي تنفيذي وأدلة المخرجات ثم استرداد غير المستخدم أو إعادة توجيهه', needsSettle: true }
  if (s.future.length) return { key: 'future', say: 'بعد صرف جزء ومع دفعات مستقبلية · تُوقف الدفعات القادمة ويُسوّى المصروف بتقرير مالي تنفيذي', needsSettle: true }
  return { key: 'partial', say: 'بعد صرف جزء · تقرير مالي تنفيذي وأدلة المخرجات واعتماد المصروف الفعلي', needsSettle: true }
}

export interface CaseAction { act: CaseAct; label: string; kind: 'btn-p' | 'btn-2' | 'btn-d'; needsNote?: boolean }
export type CaseAct = 'submit' | 'approve' | 'return' | 'reject' | 'close'
export function caseActions(c: CaseRow, role: RoleKey, asEntity = false): CaseAction[] {
  if (asEntity) return []
  /* #27 · a direct closing walks the client's fixed path · supervisor → grants manager → CEO → finance */
  if (c.kind === 'direct') {
    if ((c.stage === 'draft' || c.stage === 'returned') && role === 'supervisor') return [{ act: 'submit', label: c.stage === 'returned' ? 'أعد الرفع لمدير المنح' : 'ارفع لمدير المنح', kind: 'btn-p' }]
    if (c.stage === 'manager' && role === 'grants-manager') return [
      { act: 'approve', label: 'وافق وارفعه للمدير التنفيذي', kind: 'btn-p' },
      { act: 'return', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true },
    ]
    if (c.stage === 'ceo' && role === 'ceo') return [
      { act: 'approve', label: 'اعتماد الإغلاق وإحالته للإدارة المالية', kind: 'btn-p' },
      { act: 'return', label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true },
      { act: 'reject', label: 'رفض', kind: 'btn-d', needsNote: true },
    ]
    if (c.stage === 'finance' && role === 'finance') return [
      { act: 'approve', label: 'اعتماد التسوية المالية وإغلاق المشروع', kind: 'btn-p' },
      { act: 'return', label: 'إعادة للمدير التنفيذي', kind: 'btn-2', needsNote: true },
    ]
    return []
  }
  if ((c.stage === 'draft' || c.stage === 'returned') && role === 'supervisor') return [{ act: 'submit', label: c.stage === 'returned' ? 'أعد الرفع لمدير المنح' : 'ارفع لمدير المنح', kind: 'btn-p' }]
  /* v3 · 10.4.11 · the grants manager approves last when the matrix says so */
  const mgrFinal = caseFinalIsMgr(c)
  if (c.stage === 'manager' && role === 'grants-manager') return [
    { act: 'approve', label: dueOf(c) > 0 && !c.recovery ? 'وافق واطلب استرداد الفرق' : mgrFinal ? 'اعتماد القرار' : 'وافق وارفعه للمدير التنفيذي', kind: 'btn-p' },
    { act: 'return', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true },
  ]
  /* Re-audit 7 Oct · 10.9.3 · 10.9.5 · the money comes back before the case goes up */
  if (c.stage === 'recover' && role === 'grants-manager') return recSettled(c.recovery)
    ? [{ act: 'approve', label: mgrFinal ? 'اكتمل الاسترداد · اعتماد القرار' : 'اكتمل الاسترداد · ارفعه للمدير التنفيذي', kind: 'btn-p' }]
    : []
  if (c.stage === 'ceo' && role === 'ceo') return [
    { act: 'approve', label: 'اعتماد القرار', kind: 'btn-p' },
    { act: 'return', label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'رفض', kind: 'btn-d', needsNote: true },
  ]
  if (c.stage === 'approved' && (role === 'ceo' || (mgrFinal && role === 'grants-manager')) && recSettled(c.recovery)) return [{ act: 'close', label: 'اعتماد إقفال الحالة', kind: 'btn-p' }]
  return []
}
/** v3 · 10.4.11 · the decision's last approver · a redirect outcome needs the redirect row as well */
export function caseFinalIsMgr(c: CaseRow): boolean {
  if (c.kind === 'direct') return false
  const own = approverFor(c.kind, c.projectId, c.kind === 'increase' ? c.newAmount : undefined) === 'grants-manager'
  return own && (c.outcome !== 'redirect' || approverFor('redirect', c.projectId) === 'grants-manager')
}
/** Who decides last on a case · its title */
export const caseApproverSay = (c: CaseRow): string => (c.kind === 'direct' ? roleByKey('finance').title : caseFinalIsMgr(c) ? MGR() : CEO())

/** Client 18 Oct (sheet V2 · #4) · a project is cancelled only once every operation on it is cancelled or
    done · no payment request in flight, no agreement in an open cycle (a draft, a review, a signature, a
    return, an annex in preparation) · what's still open, one line each */
const AGR_OPEN_SAY: Record<string, string> = { draft: 'مسودة', manager: 'عند مدير المنح', executive: 'عند المدير التنفيذي', entity: 'بانتظار توقيع الجهة', returned: 'معادة للتعديل' }
export function cancelBlockers(projectId: string): string[] {
  const out: string[] = []
  for (const r of payRequests.filter((x) => x.projectId === projectId && x.state !== 'paid' && x.state !== 'closed')) out.push(`طلب صرف مفتوح ${r.id} (الدفعة ${r.no}) · يُوقف أو يُغلق أولًا`)
  for (const a of agreementsOfProject(projectId).filter((x) => x.stage in AGR_OPEN_SAY)) out.push(`اتفاقية في دورة مفتوحة ${a.id} (${AGR_OPEN_SAY[a.stage]}) · تُلغى أو تُستكمل أولًا`)
  return out
}
/** The case ends in the project's cancellation */
const cancelsProject = (c: CaseRow) => c.kind === 'stop' && c.outcome === 'cancel'
/** This approval is the decision's last one · the project changes with it */
const finalApproval = (c: CaseRow, act: CaseAct) => act === 'approve' && (c.stage === 'ceo' || ((c.stage === 'manager' || c.stage === 'recover') && caseFinalIsMgr(c) && (dueOf(c) <= 0 || c.stage === 'recover')))

export function caseStops(c: CaseRow, act: CaseAct): string[] {
  if (act === 'return' || act === 'reject') return []
  const out: string[] = []
  if (c.kind === 'stop' && c.stage !== 'draft' && c.stage !== 'returned' && stopPhase(c.projectId).needsSettle && c.settlement?.actual == null) out.push(/* doc 10.9.3 */ 'لم يُعتمد المصروف الفعلي من التقرير المالي التنفيذي وأدلة المخرجات')
  if (c.kind === 'stop' && (c.stage === 'draft' || c.stage === 'returned') && c.paid > 0 && c.settlement?.actual == null) out.push(/* doc 10.9.3 */ 'اعتمد المصروف الفعلي من التقرير المالي التنفيذي وأدلة المخرجات أولًا')
  if (c.outcome === 'redirect' && (!c.redirect?.purpose || !c.redirect.decision || !c.redirect.file)) out.push(/* doc 10.9.2 */ 'وثّق إعادة التوجيه · الغرض والقرار ومستنده')
  if (c.kind === 'reduce' && !c.annex) out.push(/* doc 10.9.5 */ 'ارفع ملحق الاتفاقية')
  if (c.kind === 'increase' && c.outcome !== 'independent' && act === 'approve' && (c.stage === 'ceo' || c.stage === 'manager')) {
    const i = resizeIssue(c.projectId, c.newAmount ?? 0)
    if (i) out.push(i)
  }
  /* Client 18 Oct (sheet V2 · #4) · checked at the approval that cancels the project · warned at its creation */
  if (cancelsProject(c) && finalApproval(c, act)) out.push(...cancelBlockers(c.projectId).map((x) => `لا يُلغى المشروع قبل إلغاء عملياته · ${x}`))
  if (act === 'close' && !recSettled(c.recovery)) out.push(/* doc 10.9.8 */ 'لم يكتمل الاسترداد ولا قرار نهائي بشأنه')
  if (act === 'approve' && c.stage === 'recover' && !recSettled(c.recovery)) out.push(/* doc 10.9.3 · 10.9.5 */ 'لم يكتمل استرداد الفرق ولا قرار نهائي بشأنه')
  return out
}

/* ── Live state ── */

/* Client 21 Oct (#6) · the costs are two figures, not a split by line · the project's whole budget and
   the foundation's support · the financial report carries the support line alone, read from the
   report's actual support figure · no settlements text */
export const SUPPORT_LINE = 'مبلغ دعم المؤسسة'
const financeLines = (c: CloseRow): CloseFinance['lines'] => [{ label: SUPPORT_LINE, approved: grantOf(c.projectId), spent: c.report.budget }]
const financeFor = (c: CloseRow): CloseFinance => ({ lines: financeLines(c), settlements: '', verified: null })

const PAST_SUPERVISOR: CloseStage[] = ['comms', 'manager', 'executive', 'reportDone', 'evalDraft', 'evalManager', 'evalExecutive', 'closed']
const FEEDBACK_SEEDED: CloseStage[] = ['evalManager', 'closed']

/* ── After the final closing · v3 · 10.4.32 · read and archive · a change only by a documented exception ── */

export type ExcField = 'beneficiaries' | 'days' | 'budget' | 'outcomes'
export const EXC_FIELDS: { key: ExcField; label: string; num: boolean }[] = [
  { key: 'beneficiaries', label: 'عدد المستفيدين الفعلي', num: true },
  { key: 'days', label: 'مدة التنفيذ الفعلية', num: true },
  { key: 'budget', label: 'مبلغ دعم المؤسسة الفعلي', num: true },
  { key: 'outcomes', label: 'النتائج الفعلية', num: false },
]

/* ── The entity's file · v3 · 10.4.30 · a simple average of its projects' evaluations and its lessons ── */

const ENTITY_LESSONS = new Map<string, { text: string; by: string; at: string }>()
export const entityLessons = (entityId: string) => ENTITY_LESSONS.get(entityId)
/** An evaluation's score out of 100 · from its weighted questions, else the older 1–5 rating */
export function evalScore(e: ProjectEval | null | undefined): number | null {
  if (!e) return null
  if (e.criteria?.length) {
    const rated = e.criteria.filter((x) => x.rating !== null)
    if (rated.length !== e.criteria.length) return null
    const w = e.criteria.reduce((s, x) => s + x.weight, 0) || 1
    /* a points question counts its points · a 1–5 question its share of its weight */
    return Math.round(e.criteria.reduce((s, x) => s + (x.points ? Math.min(x.rating ?? 0, x.weight) : x.weight * ((x.rating ?? 0) / 5)), 0) / w * 100)
  }
  return e.score === null ? null : e.score * 20
}
export function entityEvalSummary(entityId: string): { avg: number | null; n: number; projects: { id: string; name: string; score: number }[] } {
  const rows = closeRows.filter((c) => c.entityId === entityId && c.stage === 'closed')
    .map((c) => ({ id: c.id, name: c.projectName, score: evalScore(c.evaluation) }))
    .filter((x): x is { id: string; name: string; score: number } => x.score !== null)
  return { avg: rows.length ? Math.round(rows.reduce((s, x) => s + x.score, 0) / rows.length) : null, n: rows.length, projects: rows }
}

/* ── Operations ── */

type ReportPatch = Partial<Pick<FinalReport, 'beneficiaries' | 'budget' | 'days' | 'outcomes' | 'risks' | 'projectValue' | 'outputs' | 'contribution' | 'template'>> & { finance?: Pick<CloseFinance, 'lines' | 'settlements'> }
type RecOwner = { kind: 'close' | 'case'; id: string }
type Op = { at: string; by: string } & (
  | { op: 'open'; id: string; projectId: string; basis: NonNullable<CloseRow['basis']>; mediaRequired?: boolean; outputs?: { text: string; achieved: string }[]; verified?: number; payStopped?: number }
  | { op: 'save'; id: string; patch: ReportPatch }
  | { op: 'doc'; id: string; key: string; file?: string }
  | { op: 'link'; id: string; label: string; url: string }
  | { op: 'files'; id: string; files: Omit<ReportUpload, 'at' | 'by'>[] }
  | { op: 'fileDrop'; id: string; fileId: string }
  | { op: 'reopen'; id: string; reason: string; role: string }
  | { op: 'send'; id: string }
  | { op: 'act'; id: string; act: 'approve' | 'return'; note: string; file?: string; invoices?: boolean }
  | { op: 'exception'; id: string; field: ExcField; value: string; reason: string; decision: string; file: string; role: string }
  | { op: 'lessons'; entityId: string; text: string }
  | { op: 'caseLink'; id: string; projectId: string }
  | { op: 'verify'; id: string; amount: number; note: string }
  | { op: 'evalStart'; id: string }
  | { op: 'evalSave'; id: string; evaluation: ProjectEval }
  | { op: 'evalSend'; id: string }
  | { op: 'evalReview'; id: string; seat: EvalSeat; evaluation: ProjectEval }
  | { op: 'evalAct'; id: string; act: 'approve' | 'return'; note: string }
  | { op: 'feedback'; id: string; feedback: Omit<EntityFeedback, 'at' | 'by'> }
  | { op: 'rules'; rules: CloseRules }
  | { op: 'recOpen'; owner: RecOwner; rec: Omit<Recovery, 'receipts' | 'claims' | 'escalations' | 'released' | 'state'> }
  | { op: 'recReceipt'; owner: RecOwner; receipt: RecoveryReceipt }
  | { op: 'recFail'; owner: RecOwner; text: string; file?: string }
  | { op: 'recEscalate'; owner: RecOwner; step: string; text: string; file?: string }
  | { op: 'recDecide'; owner: RecOwner; kind: NonNullable<Recovery['decision']>['kind']; text: string; file?: string }
  | { op: 'caseCreate'; row: Pick<CaseRow, 'id' | 'projectId' | 'kind' | 'reason' | 'newAmount' | 'annex' | 'extra' | 'outcome' | 'redirect' | 'file'> & { paid?: number; granted?: number } }
  | { op: 'caseDoc'; id: string; key: 'report' | 'evidence' | 'invoices' | 'annex'; file: string }
  | { op: 'caseSettle'; id: string; actual: number }
  | { op: 'caseAct'; id: string; act: CaseAct; note: string }
  | { op: 'redirect'; id: string; v: Omit<SupportRedirect, 'by' | 'at'> }
)

const KEY = 'ab-close-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
/** Re-renders on a closing move · and on a payments move, since the requirements read them */
export function useClosing(): number {
  usePayments()
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}
const now = () => new Date().toISOString()
const day = (iso: string) => iso.slice(0, 10)

const log = (c: CloseRow, by: string, what: string, at: string) => { c.audit.push({ at: day(at), by, what }) }
const elog = (c: CloseRow, by: string, what: string, at: string) => { (c.evalAudit ??= []).push({ at: day(at), by, what }) }
const clog = (c: CaseRow, by: string, what: string, at: string) => { c.log.push({ at: day(at), by, what }) }
const move = (c: CloseRow, s: CloseStage) => { c.stage = s; c.hoursInStage = 0 }

/** The project's stage follows its closing · «تحت التنفيذ» throughout, «مكتمل» at the end (10.4.16) */
const setProjectStage = (projectId: string, stage: string) => {
  const p = projectOf(projectId)
  const meta = stageMeta(stage)
  if (!p || !meta) return
  p.stage = stage
  /* 18 Oct · 10.9.2 · a redirect the decision already landed keeps its status through the closing */
  p.statusGroup = p.redirect ? 'أعيد توجيه الدعم' : meta.group
  p.stageLimit = meta.limit
  p.hoursInStage = 0
}

/** Verifier · 16 Oct · a stopped project keeps the status its decision gave it («ملغى» · «متعثر») · its closing settles
    the money without walking it back into the closing stages */
const closeStage = (c: CloseRow, stage: string) => { if (c.basis !== 'stopped') setProjectStage(c.projectId, stage) }

const recOf = (o: RecOwner): Recovery | undefined =>
  o.kind === 'close' ? closeById(o.id)?.recovery : caseById(o.id)?.recovery
const projectOfOwner = (o: RecOwner): string | undefined =>
  o.kind === 'close' ? closeById(o.id)?.projectId : caseById(o.id)?.projectId
const ownerLog = (o: RecOwner, by: string, what: string, at: string) => {
  if (o.kind === 'close') { const c = closeById(o.id); if (c) log(c, by, what, at) }
  else { const c = caseById(o.id); if (c) clog(c, by, what, at) }
}

const snapshot = (c: CloseRow, cycle: 'report' | 'eval', by: string, at: string, say: string) => {
  const list = cycle === 'report' ? c.versions : c.evalVersions
  ;(c.snapshots ??= []).push({
    cycle, no: list.length, at: day(at), by, say,
    report: cycle === 'report' ? structuredClone(c.report) : undefined,
    evaluation: cycle === 'eval' && c.evaluation ? structuredClone(c.evaluation) : undefined,
  })
}

/** Released money and the plan · 'once' waits for the full amount, 'gradual' moves with each receipt */
let live = false
const release = (projectId: string, amount: number, ref: string, by: string) => {
  if (live && amount > 0 && hasFunding(projectId)) releaseRecovered(projectId, amount, ref, by)
}

function apply(o: Op) { asOf(o.at, () => applyOp(o)) }
function applyOp(o: Op) {
  switch (o.op) {
    case 'open': {
      if (closeOfProject(o.projectId) || closeById(o.id)) return
      const p = projectOf(o.projectId)
      if (!p) return
      const owner = p.owner ?? o.by
      const c: CloseRow = {
        id: o.id, projectId: p.id, projectName: p.name, entityId: p.entityId, entityName: p.entityName, stage: 'draft',
        report: { beneficiaries: null, budget: null, days: null, outcomes: '', risks: '', docs: [], links: [], projectValue: null, outputs: structuredClone(o.outputs ?? agreedOutputs(p.id)), contribution: '' },
        evaluation: null, versions: [{ no: 1, at: day(o.at), by: o.by, say: 'طلب التقرير الختامي' }], evalVersions: [],
        audit: [], mediaRequired: o.mediaRequired ?? mediaInAgreement(p.id), owner, openedAt: day(o.at), hoursInStage: 0, basis: o.basis, evalAudit: [], snapshots: [],
      }
      c.finance = financeFor(c)
      /* Verifier · 16 Oct · a stop already approved the actual spend on its case (10.9.3) · the closing starts from it */
      if (o.verified !== undefined) c.finance = { ...c.finance, verified: o.verified, verifiedBy: 'النظام', verifiedAt: day(o.at) }
      closeRows.push(liveClock(c, 'hoursInStage', true))
      log(c, o.by, `${o.basis === 'stopped' ? 'إنشاء متطلبات إغلاق مشروع موقوف (تقرير مالي تنفيذي وأدلة المخرجات)' : 'إنشاء طلب التقرير الختامي'} · ${o.basis === 'stopped' ? 'بقرار إيقاف' : o.basis === 'complete' ? 'اكتملت الأنشطة' : 'انتهت مدة التنفيذ'} · ${c.mediaRequired ? 'الاتفاقية تطلب النشر الإعلامي' : 'لا نشر إعلامي في الاتفاقية'} · وأُبلغت الجهة بالمتطلبات`, o.at)
      if (o.payStopped) log(c, o.by, `أُوقف ${o.payStopped === 1 ? 'طلب صرف مفتوح' : `${o.payStopped} طلبات صرف مفتوحة`} لبدء الإغلاق · تُسوّى دفعته في الإغلاق`, o.at)
      closeStage(c, 'طلب التقرير الختامي')
      notify([p.entityName], 'طلب التقرير الختامي لمشروعك', p.name, `${ROUTES.closing(c.id)}?as=entity`)
      return
    }
    case 'save': {
      const c = closeById(o.id)
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned')) return
      const { finance, ...rest } = o.patch
      Object.assign(c.report, rest)
      /* Client 21 Oct (#6) · an older save carried its lines · a new one derives the support line from the report */
      if (finance) c.finance = { ...(c.finance ?? financeFor(c)), ...structuredClone(finance) }
      else c.finance = { ...(c.finance ?? financeFor(c)), lines: financeLines(c), settlements: '' }
      log(c, o.by, 'حفظ بيانات التقرير الختامي', o.at)
      return
    }
    case 'doc': {
      const c = closeById(o.id)
      /* v3 · 10.4.23 · the version locks once sent · files change only after a formal return */
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned')) return
      /* Verifier · 16 Oct · before sending, or after a formal return, a document may be replaced · the
         earlier one stays in the version's snapshot */
      const again = c.report.docs.includes(o.key)
      if (!again) c.report.docs.push(o.key)
      if (o.file) c.report.files = { ...c.report.files, [o.key]: o.file }
      log(c, o.by, `${again ? 'استبدال' : 'إرفاق'} ${CLOSE_DOCS.find((d) => d.key === o.key)?.label ?? o.key}${o.file ? ` · ${o.file}` : ''}`, o.at)
      return
    }
    case 'link': {
      const c = closeById(o.id)
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned')) return
      c.report.links.push({ label: o.label, url: o.url })
      log(c, o.by, 'إضافة رابط تخزين خارجي', o.at)
      return
    }
    case 'files': {
      const c = closeById(o.id)
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned') || !o.files.length) return
      const list = (c.report.uploads ??= [])
      for (const f of o.files) if (!list.some((x) => x.id === f.id)) list.push({ ...f, at: day(o.at), by: o.by })
      log(c, o.by, `رفع ${o.files.length === 1 ? `ملف · ${o.files[0]!.name}` : `${o.files.length} ملفات · ${o.files.map((x) => x.name).join('، ')}`}`, o.at)
      return
    }
    case 'fileDrop': {
      const c = closeById(o.id)
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned')) return
      const f = c.report.uploads?.find((x) => x.id === o.fileId)
      if (!f) return
      c.report.uploads = c.report.uploads!.filter((x) => x.id !== o.fileId)
      log(c, o.by, `حذف ملف · ${f.name}`, o.at)
      return
    }
    case 'reopen': {
      /* Client 21 Oct (#16) · a closed project opens again only by its permission and a recorded reason ·
         the closed report and evaluation stay as versions · the money already settled doesn't move */
      const c = closeById(o.id)
      if (!c || c.stage !== 'closed' || !o.reason.trim()) return
      snapshot(c, 'report', o.by, o.at, 'قبل إعادة الفتح')
      if (c.evaluation) snapshot(c, 'eval', o.by, o.at, 'قبل إعادة الفتح')
      c.versions.push({ no: c.versions.length + 1, at: day(o.at), by: o.by, say: `إعادة فتح بعد الإغلاق · ${o.reason.trim()}` })
      move(c, 'returned')
      c.returnedTo = 'draft'
      c.note = o.reason.trim()
      c.closedAt = undefined
      log(c, o.by, `إعادة فتح المشروع بعد الإغلاق النهائي (${o.role}) · السبب: ${o.reason.trim()} · التسويات المالية المعتمدة لا تتغير`, o.at)
      closeStage(c, 'رفع التقرير الختامي')
      notify([c.entityName], 'أُعيد فتح الإغلاق · حدّث التقرير الختامي', c.projectName, `${ROUTES.closing(c.id)}?as=entity`)
      notify([c.owner], 'أُعيد فتح إغلاق مشروع', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'send': {
      const c = closeById(o.id)
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned') || reportBlockers(c).length) return
      const back = c.stage === 'returned' && c.returnedTo && c.returnedTo !== 'draft' ? c.returnedTo : 'supervisor'
      move(c, back)
      c.note = undefined
      c.returnedTo = undefined
      log(c, o.by, 'إرسال التقرير الختامي', o.at)
      closeStage(c, 'اعتماد التقرير الختامي')
      notify([c.owner], 'وصل التقرير الختامي للمراجعة', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'act': {
      const c = closeById(o.id)
      if (!c) return
      const note = o.note.trim()
      if (o.act === 'return') {
        if (!note || !['supervisor', 'comms', 'manager', 'executive'].includes(c.stage)) return
        /* 10.2.13 · outreach's return reaches the supervisor · every other return reaches the entity */
        if (c.stage === 'comms') {
          move(c, 'supervisor')
          c.note = note
          log(c, o.by, 'إعادة الاتصال المؤسسي إلى مشرف المنح بملاحظات النشر', o.at)
          notify([c.owner], 'أعاد الاتصال المؤسسي التقرير الختامي', c.projectName, ROUTES.closing(c.id))
          return
        }
        const from = c.stage
        /* v3 · 10.4.6 · the authority may ask for the detailed invoices · with its reason */
        if (o.invoices) c.invoicesAsked = { at: day(o.at), by: o.by, note }
        snapshot(c, 'report', o.by, o.at, `قبل الإعادة من ${closeStageLabel(from)}`)
        /* Verifier · 16 Oct · the approved spend is approved again from the resent report */
        if (c.finance && c.finance.verified != null) c.finance = { ...c.finance, verified: null, verifiedBy: undefined, verifiedAt: undefined }
        move(c, 'returned')
        c.returnedTo = 'draft'
        c.note = note
        c.versions.push({ no: c.versions.length + 1, at: day(o.at), by: o.by, say: `إعادة من ${closeStageLabel(from)}` })
        log(c, o.by, `${o.invoices ? 'طلب الفواتير التفصيلية' : 'إعادة بملاحظات'} · إصدار ${c.versions.length}`, o.at)
        closeStage(c, 'رفع التقرير الختامي')
        notify([c.entityName], 'التقرير الختامي مُعاد للاستكمال', c.projectName, `${ROUTES.closing(c.id)}?as=entity`)
        return
      }
      /* v3 · 10.2.15 · 10.4.9 · after the grants manager · the next authority by the matrix · the report
         is approved at the manager when the matrix makes him its last approver */
      const next: Partial<Record<CloseStage, CloseStage>> = {
        supervisor: needsComms(c) ? 'comms' : 'manager', comms: 'manager', manager: approverFor('report', c.projectId) === 'grants-manager' ? 'reportDone' : 'executive', executive: 'reportDone',
      }
      const to = next[c.stage]
      if (!to) return
      if (c.stage === 'comms') log(c, o.by, `اعتماد الاتصال المؤسسي لمتطلبات النشر الإعلامي${o.file ? ` · ${o.file}` : ''}`, o.at)
      c.note = undefined
      move(c, to)
      log(c, o.by, to === 'reportDone' ? 'اعتماد التقرير الختامي · إقفال الدورة الأولى' : `اعتماد · إحالة إلى ${closeStageLabel(to)}`, o.at)
      if (to === 'reportDone') {
        closeStage(c, 'تقييم المشروع')
        notify([c.owner], 'اعتُمد التقرير الختامي · ابدأ التقييم', c.projectName, ROUTES.closing(c.id))
        notify([c.entityName], 'اعتُمد تقريرك الختامي · قيّم تجربتك مع المؤسسة', c.projectName, `${ROUTES.closing(c.id)}?as=entity`)
      } else if (to === 'comms') notify([roleByKey('comms').title], 'تقرير ختامي بانتظار مراجعة النشر', c.projectName, ROUTES.closing(c.id))
      else if (to === 'manager') notify([MGR()], 'تقرير ختامي بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
      else if (to === 'executive') notify([CEO()], 'تقرير ختامي بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'verify': {
      const c = closeById(o.id)
      /* the spend is approved at the supervisor's review · locked once the report goes on */
      if (!c || c.stage !== 'supervisor') return
      c.finance = { ...(c.finance ?? financeFor(c)), verified: o.amount, verifiedBy: o.by, verifiedAt: day(o.at) }
      log(c, o.by, `اعتماد المصروف الفعلي من التقرير المالي التنفيذي ${nf.format(o.amount)}${o.note ? ` · ${o.note}` : ''}`, o.at)
      return
    }
    case 'evalStart': {
      const c = closeById(o.id)
      if (!c || c.stage !== 'reportDone') return
      const pr = projectOf(c.projectId)
      move(c, 'evalDraft')
      c.evaluation = {
        indicators: [
          { name: 'عدد المستفيدين', target: pr?.beneficiaries ?? 0, actual: c.report.beneficiaries, unit: 'مستفيد' },
          { name: 'نسبة رضا المستفيدين', target: 85, actual: null, unit: '%' },
          { name: 'نسبة إنجاز الأنشطة', target: 100, actual: null, unit: '%' },
        ],
        impact: '', lessons: '', score: null,
        /* v3 · 10.4.31 · the questions and weights in force now · a later change leaves this one as it is */
        criteria: (CLOSE_RULES.evalCriteria ?? EVAL_CRITERIA_DEFAULT).map((x) => ({ ...x, rating: null })),
      }
      c.evalVersions.push({ no: 1, at: day(o.at), by: o.by, say: 'إعداد التقييم' })
      elog(c, o.by, 'بدء إعداد تقييم المشروع', o.at)
      return
    }
    case 'evalSave': {
      const c = closeById(o.id)
      if (!c || c.stage !== 'evalDraft') return
      c.evaluation = structuredClone(o.evaluation)
      elog(c, o.by, 'حفظ التقييم', o.at)
      return
    }
    /* Client 28 Oct · the grants manager and the executive each evaluate the project at their own stage */
    case 'evalReview': {
      const c = closeById(o.id)
      if (!c || c.stage !== (o.seat === 'manager' ? 'evalManager' : 'evalExecutive')) return
      ;(c.evalReviews ??= {})[o.seat] = { ...structuredClone(o.evaluation), by: o.by, at: day(o.at) }
      elog(c, o.by, o.seat === 'manager' ? 'حفظ تقييم مدير المنح' : 'حفظ تقييم المدير التنفيذي', o.at)
      return
    }
    case 'evalSend': {
      const c = closeById(o.id)
      if (!c || c.stage !== 'evalDraft' || evalBlockers(c).length) return
      move(c, 'evalManager')
      c.note = undefined
      elog(c, o.by, 'إرسال التقييم إلى مدير المنح', o.at)
      notify([MGR()], 'تقييم مشروع بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'evalAct': {
      const c = closeById(o.id)
      if (!c) return
      const note = o.note.trim()
      if (o.act === 'return') {
        if (!note || (c.stage !== 'evalManager' && c.stage !== 'evalExecutive')) return
        /* 10.2.19 · 10.2.20 · the manager returns to the supervisor, the CEO to the manager */
        const to: CloseStage = c.stage === 'evalExecutive' ? 'evalManager' : 'evalDraft'
        snapshot(c, 'eval', o.by, o.at, `قبل الإعادة من ${closeStageLabel(c.stage)}`)
        c.evalVersions.push({ no: c.evalVersions.length + 1, at: day(o.at), by: o.by, say: `إعادة من ${closeStageLabel(c.stage)}` })
        move(c, to)
        c.note = note
        elog(c, o.by, `إعادة التقييم إلى ${to === 'evalDraft' ? 'مشرف المنح' : 'مدير المنح'} · إصدار ${c.evalVersions.length}`, o.at)
        notify([to === 'evalDraft' ? c.owner : MGR()], 'التقييم مُعاد بملاحظات', c.projectName, ROUTES.closing(c.id))
        return
      }
      if (c.stage === 'evalManager' && approverFor('eval', c.projectId) === 'ceo') {
        move(c, 'evalExecutive')
        c.note = undefined
        elog(c, o.by, 'اعتماد التقييم · إحالة إلى المدير التنفيذي', o.at)
        notify([CEO()], 'تقييم مشروع بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
        return
      }
      if ((c.stage !== 'evalExecutive' && c.stage !== 'evalManager') || requirementsOf(c).some((x) => !x.ok)) return
      move(c, 'closed')
      c.note = undefined
      c.closedAt = day(o.at)
      elog(c, o.by, 'اعتماد التقييم', o.at)
      log(c, o.by, 'الإغلاق النهائي · أُرشف ملف المشروع', o.at)
      /* v3 · 0.status.8 · 10.2.20 · a saving left · the unpaid part of the grant and what was
         recovered from the entity · the project reads «مغلق بوفر» with the value and where it went */
      {
        const p = projectOf(c.projectId)
        const unpaid = Math.max(0, grantOf(c.projectId) - paidToDate(c.projectId))
        const back = c.recovery ? c.recovery.receipts.reduce((s, x) => s + x.amount, 0) : 0
        /* Verifier · 16 Oct · a decision's redirect (10.9.2) lands on the project now, at its final closing */
        const caseRedirect = casesOfProject(c.projectId).find((k) => k.applied && (k.stage === 'approved' || k.stage === 'closed'))?.applied
        if (p && (c.redirect || caseRedirect)) p.redirect = c.redirect ?? caseRedirect
        else if (p && c.basis !== 'stopped' && unpaid + back > 0) p.closeSavings = { amount: unpaid + back, fate: back > 0 ? 'استُرد من الجهة وعاد إلى بند الميزانية' : 'غير المصروف عاد إلى بند الميزانية' }
      }
      closeStage(c, 'مشروع مكتمل')
      /* 1.4.32 · what's held and unpaid goes back to the line · the recovered savings, if released once */
      if (live) releaseSavings(c.projectId, o.by, 'الإغلاق النهائي')
      if (c.recovery && CLOSE_RULES.releaseMode === 'once') {
        const got = c.recovery.receipts.reduce((s, x) => s + x.amount, 0) - c.recovery.released
        release(c.projectId, got, `${c.recovery.id}-all`, o.by)
        c.recovery.released += Math.max(0, got)
      }
      notify([c.entityName], 'أُغلق مشروعك نهائيًّا', c.projectName, `${ROUTES.closing(c.id)}?as=entity`)
      notify([c.owner], 'اكتمل إغلاق المشروع', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'feedback': {
      const c = closeById(o.id)
      if (!c || c.feedback) return
      c.feedback = { ...structuredClone(o.feedback), at: day(o.at), by: o.by }
      log(c, o.by, 'أرسلت الجهة تقييمها للمؤسسة', o.at)
      return
    }
    case 'rules':
      Object.assign(CLOSE_RULES, o.rules)
      return
    case 'exception': {
      const c = closeById(o.id)
      if (!c || c.stage !== 'closed') return
      const f = EXC_FIELDS.find((x) => x.key === o.field)
      if (!f) return
      const was = String(c.report[o.field] ?? '')
      if (f.num) (c.report as unknown as Record<string, number>)[o.field] = Number(o.value)
      else c.report.outcomes = o.value
      ;(c.exceptions ??= []).push({ at: day(o.at), by: o.by, role: o.role, field: f.label, was, now: o.value, reason: o.reason, decision: o.decision, file: o.file })
      log(c, o.by, `تعديل استثنائي موثّق بعد الإغلاق · ${f.label}: ${was || '—'} ← ${o.value} · القرار ${o.decision} · ${o.reason}`, o.at)
      return
    }
    case 'lessons':
      ENTITY_LESSONS.set(o.entityId, { text: o.text, by: o.by, at: day(o.at) })
      return
    case 'caseLink': {
      const c = caseById(o.id)
      if (c) { c.independentId = o.projectId; clog(c, 'النظام', `فُتح مشروع مستقل ${o.projectId} للجهة نفسها · يمرّ بدورة الدراسة والاعتماد`, o.at) }
      return
    }
    case 'redirect': {
      /* v3 · 0.status.9 · 10.9.7 · a formal decision redirects the support within the same relationship ·
         the project reads «أعيد توجيه الدعم» once its closing ends (a stop decision's redirect may land earlier ·
         decisions · redirectStatusAt) */
      const c = closeById(o.id)
      if (!c || c.stage === 'closed' || c.redirect) return
      c.redirect = { ...o.v, by: o.by, at: day(o.at) }
      log(c, o.by, `إعادة توجيه الدعم · ${nf.format(o.v.redirected)} من ${nf.format(o.v.original)} · ${o.v.purpose} · القرار ${o.v.decision}`, o.at)
      notify([c.entityName, c.owner], 'قرار إعادة توجيه الدعم', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'recOpen': {
      const rec: Recovery = { ...o.rec, receipts: [], claims: [], escalations: [], released: 0, state: 'open' }
      if (o.owner.kind === 'close') { const c = closeById(o.owner.id); if (!c || c.recovery) return; c.recovery = rec }
      else { const c = caseById(o.owner.id); if (!c || c.recovery) return; c.recovery = rec }
      ownerLog(o.owner, o.by, `مطالبة الجهة بإعادة ${nf.format(rec.due)} · ${rec.reason}`, o.at)
      const pid = projectOfOwner(o.owner)
      const p = pid ? projectOf(pid) : undefined
      if (p) notify([p.entityName], `مطالبة بإعادة ${nf.format(rec.due)}`, p.name, o.owner.kind === 'close' ? `${ROUTES.closing(o.owner.id)}?as=entity` : `${ROUTES.distress(o.owner.id)}?as=entity`)
      return
    }
    case 'recReceipt': {
      const r = recOf(o.owner)
      if (!r || (r.state !== 'open' && r.state !== 'failed' && !(r.state === 'decided' && r.decision?.kind === 'installments'))) return
      if (o.receipt.amount <= 0 || o.receipt.amount > recLeft(r)) return
      r.receipts.push(o.receipt)
      ownerLog(o.owner, o.by, `استلام ${nf.format(o.receipt.amount)} · مرجع ${o.receipt.ref} · المتبقي ${nf.format(recLeft(r))}`, o.at)
      const pid = projectOfOwner(o.owner)!
      if (CLOSE_RULES.releaseMode === 'gradual') { release(pid, o.receipt.amount, o.receipt.id, o.by); r.released += o.receipt.amount }
      if (recLeft(r) <= 0) {
        r.state = 'done'
        ownerLog(o.owner, o.by, 'اكتمل الاسترداد', o.at)
        if (CLOSE_RULES.releaseMode === 'once' && o.owner.kind === 'case') {
          const got = r.receipts.reduce((s, x) => s + x.amount, 0) - r.released
          release(pid, got, `${r.id}-all`, o.by)
          r.released += got
        }
      }
      return
    }
    case 'recFail': {
      const r = recOf(o.owner)
      if (!r || r.state === 'done' || r.state === 'decided') return
      r.claims.push({ at: day(o.at), by: o.by, text: o.text, file: o.file })
      r.state = 'failed'
      ownerLog(o.owner, o.by, `إثبات مطالبة · تعذّر الاسترداد · المتبقي ${nf.format(recLeft(r))}`, o.at)
      /* Re-audit 7 Oct · 10.9.9 · the project reads «متعثر» while the balance can't be recovered */
      {
        const pid = projectOfOwner(o.owner)
        const p = pid ? projectOf(pid) : undefined
        if (pid && p && p.statusGroup !== 'متعثر' && !isDone(p.statusGroup)) { setProjectStage(pid, 'مشروع متعثر'); ownerLog(o.owner, 'النظام', 'حُوّلت حالة المشروع إلى «مشروع متعثر» لتعذّر الاسترداد', o.at) }
      }
      return
    }
    case 'recEscalate': {
      const r = recOf(o.owner)
      if (!r || r.state !== 'failed') return
      r.escalations.push({ at: day(o.at), by: o.by, step: o.step, text: o.text, file: o.file })
      ownerLog(o.owner, o.by, `تصعيد نظامي · ${o.step}${o.file ? ` · ${o.file}` : ''}`, o.at)
      return
    }
    case 'recDecide': {
      const r = recOf(o.owner)
      if (!r || r.state !== 'failed') return
      r.decision = { at: day(o.at), by: o.by, text: o.text, kind: o.kind, file: o.file }
      r.state = 'decided'
      ownerLog(o.owner, o.by, `قرار نهائي بشأن الرصيد غير المسترد (${nf.format(recLeft(r))}) · ${DECISION_SAY[o.kind]}${o.file ? ` · ${o.file}` : ''}`, o.at)
      return
    }
    case 'caseCreate': {
      if (caseById(o.row.id)) return
      const p = projectOf(o.row.projectId)
      if (!p) return
      const c: CaseRow = {
        ...structuredClone(o.row), projectName: p.name, entityId: p.entityId, entityName: p.entityName, stage: 'draft',
        openedBy: o.by, openedAt: day(o.at), granted: o.row.granted ?? grantOf(p.id), paid: o.row.paid ?? paidToDate(p.id), log: [],
      }
      if (c.kind === 'stop' && c.paid > 0) {
        c.settlement = { actual: null }
        c.stage = 'settle'
      }
      CASES.push(c)
      clog(c, o.by, `فتح ${CASE_KIND_SAY[c.kind]} · ${c.reason}`, o.at)
      if (c.stage === 'settle') {
        clog(c, 'النظام', 'طُلب من الجهة التقرير المالي التنفيذي وأدلة المخرجات لما صُرف', o.at)
        notify([p.entityName], 'مطلوب تقرير مالي تنفيذي وأدلة المخرجات لتسوية المصروف', p.name, `${ROUTES.distress(c.id)}?as=entity`)
      }
      return
    }
    case 'caseDoc': {
      const c = caseById(o.id)
      if (!c || c.stage === 'closed' || c.stage === 'rejected') return
      if (o.key === 'annex') c.annex = o.file
      else c.settlement = { ...(c.settlement ?? { actual: null }), [o.key]: o.file }
      clog(c, o.by, o.key === 'annex' ? `إرفاق ملحق الاتفاقية · ${o.file}` : `${o.key === 'report' ? 'رفعت الجهة التقرير المالي التنفيذي' : o.key === 'evidence' ? 'رفعت الجهة أدلة المخرجات' : 'رفعت الجهة الفواتير'} · ${o.file}`, o.at)
      return
    }
    case 'caseSettle': {
      const c = caseById(o.id)
      if (!c || c.stage !== 'settle' || !c.settlement?.report || !(c.settlement.evidence || c.settlement.invoices)) return
      c.settlement = { ...c.settlement, actual: o.actual, approvedBy: o.by, approvedAt: day(o.at) }
      c.stage = 'draft'
      clog(c, o.by, `اعتماد المصروف الفعلي ${nf.format(o.actual)} من ${nf.format(c.paid)} المصروف`, o.at)
      return
    }
    case 'caseAct': {
      const c = caseById(o.id)
      if (!c) return
      const note = o.note.trim()
      switch (o.act) {
        case 'submit':
          if (c.stage !== 'draft' && c.stage !== 'returned') return
          c.stage = 'manager'
          c.note = undefined
          clog(c, o.by, 'رفع الحالة إلى مدير المنح', o.at)
          notify([MGR()], `${CASE_KIND_SAY[c.kind]} بانتظار قرارك`, c.projectName, ROUTES.distress(c.id))
          return
        case 'return':
          if (!note || (c.stage !== 'manager' && c.stage !== 'ceo' && c.stage !== 'finance')) return
          c.note = note
          c.returnedTo = c.stage === 'finance' ? 'ceo' : c.stage === 'ceo' ? 'manager' : 'draft'
          c.stage = c.stage === 'finance' ? 'ceo' : c.stage === 'ceo' ? 'manager' : 'returned'
          clog(c, o.by, `إعادة بملاحظات إلى ${c.stage === 'ceo' ? 'المدير التنفيذي' : c.stage === 'manager' ? 'مدير المنح' : 'مشرف المنح'}`, o.at)
          if (c.stage === 'ceo') notify([CEO()], `${CASE_KIND_SAY[c.kind]} مُعاد من الإدارة المالية`, c.projectName, ROUTES.distress(c.id))
          return
        case 'reject':
          if (!note || c.stage !== 'ceo') return
          c.note = note
          c.stage = 'rejected'
          c.decidedAt = day(o.at)
          clog(c, o.by, 'رفض المدير التنفيذي القرار', o.at)
          return
        case 'approve': {
          /* #27 · the direct closing · each approval moves it one seat · finance's closes the project */
          if (c.kind === 'direct') {
            if (c.stage === 'manager') {
              c.stage = 'ceo'; c.note = undefined
              clog(c, o.by, 'موافقة مدير المنح · رفع للمدير التنفيذي', o.at)
              notify([CEO()], 'إغلاق مباشر بانتظار اعتمادك', c.projectName, ROUTES.distress(c.id))
            } else if (c.stage === 'ceo') {
              c.stage = 'finance'; c.note = undefined
              clog(c, o.by, 'اعتماد المدير التنفيذي · إحالة للإدارة المالية للتسوية والإغلاق', o.at)
              notify([roleByKey('finance').title], 'إغلاق مباشر بانتظار التسوية المالية', c.projectName, ROUTES.distress(c.id))
            } else if (c.stage === 'finance') {
              c.decidedAt = day(o.at)
              applyDirect(c, o.by, o.at, note)
            }
            return
          }
          /* Re-audit 7 Oct · 10.9.3 · 10.9.5 · a stop or a cut that leaves money with the entity asks
             for it back first · the case goes to the executive once it's back or decided */
          if (c.stage === 'manager' && dueOf(c) > 0 && !c.recovery) {
            const due = dueOf(c)
            const reason = c.kind === 'stop' ? 'الرصيد غير المستخدم بعد اعتماد المصروف الفعلي' : 'فرق التخفيض عمّا صُرف'
            c.stage = 'recover'
            c.note = undefined
            c.recovery = { id: `RC-${c.id}`, source: c.kind === 'stop' ? 'stop' : 'reduce', due, reason, openedAt: day(o.at), openedBy: o.by, receipts: [], claims: [], escalations: [], released: 0, state: 'open' }
            clog(c, o.by, `موافقة مدير المنح · مطالبة الجهة بإعادة ${nf.format(due)} قبل الاعتماد`, o.at)
            notify([c.entityName], `مطالبة بإعادة ${nf.format(due)}`, c.projectName, `${ROUTES.distress(c.id)}?as=entity`)
            return
          }
          const mf = caseFinalIsMgr(c)
          if (c.stage === 'recover') {
            if (!recSettled(c.recovery)) return
            if (mf) { c.decidedAt = day(o.at); clog(c, o.by, 'اكتمل الاسترداد · اعتماد مدير المنح وفق مصفوفة الصلاحيات', o.at); applyCase(c, o.by, o.at); return }
            c.stage = 'ceo'
            clog(c, o.by, 'اكتمل الاسترداد أو صدر قرار بشأنه · رفع للمدير التنفيذي', o.at)
            notify([CEO()], `${CASE_KIND_SAY[c.kind]} بانتظار اعتمادك`, c.projectName, ROUTES.distress(c.id))
            return
          }
          if (c.stage === 'manager' && mf) {
            c.note = undefined
            c.decidedAt = day(o.at)
            clog(c, o.by, 'اعتماد مدير المنح وفق مصفوفة الصلاحيات', o.at)
            applyCase(c, o.by, o.at)
            return
          }
          if (c.stage === 'manager') {
            c.stage = 'ceo'
            c.note = undefined
            clog(c, o.by, 'موافقة مدير المنح · رفع للمدير التنفيذي', o.at)
            notify([CEO()], `${CASE_KIND_SAY[c.kind]} بانتظار اعتمادك`, c.projectName, ROUTES.distress(c.id))
            return
          }
          if (c.stage !== 'ceo') return
          c.decidedAt = day(o.at)
          clog(c, o.by, 'اعتماد المدير التنفيذي', o.at)
          applyCase(c, o.by, o.at)
          return
        }
        case 'close':
          if (c.stage !== 'approved' || !recSettled(c.recovery)) return
          c.stage = 'closed'
          clog(c, o.by, 'اعتماد إقفال الحالة', o.at)
          return
      }
      return
    }
  }
}

export const DECISION_SAY: Record<NonNullable<Recovery['decision']>['kind'], string> = {
  writeoff: 'شطب الرصيد', installments: 'جدولة السداد', pursue: 'متابعة المطالبة نظاميًّا',
}

/** What the entity owes back from a stop or a cut · known before the executive decides */
function dueOf(c: CaseRow): number {
  /* v3 · 10.9.2 · 10.9.3 · 10.4.28 · what's redirected isn't claimed back */
  if (c.outcome === 'redirect') return 0
  if (c.kind === 'stop') return Math.max(0, c.paid - (c.settlement?.actual ?? c.paid))
  if (c.kind === 'reduce') return Math.max(0, c.paid - (c.newAmount ?? c.granted))
  return 0
}

/** #27 · finance settled a direct closing · the open requests and the payments still ahead stop, what's
    held and unpaid goes back to the line, and the project is complete · no final report, no evaluation */
function applyDirect(c: CaseRow, by: string, at: string, note: string) {
  const p = projectOf(c.projectId)
  if (!p) return
  const stopped = payRequests.filter((r) => r.projectId === c.projectId && r.state !== 'paid' && r.state !== 'closed').map((r) => r.id)
  const unpaid = Math.max(0, grantOf(c.projectId) - paidToDate(c.projectId))
  if (live) stopProjectPayments(c.projectId, `إغلاق مباشر ${c.id} · ${c.reason}`, by)
  if (live) releaseSavings(c.projectId, by, `إغلاق مباشر ${c.id}`)
  setProjectStage(c.projectId, 'مشروع مكتمل')
  p.closedDirect = { id: c.id, at: day(at) }
  if (unpaid > 0) p.closeSavings = { amount: unpaid, fate: 'غير المصروف عاد إلى بند الميزانية بالإغلاق المباشر' }
  c.finance = { by, at: day(at), note, released: unpaid, stopped }
  c.stage = 'closed'
  c.note = undefined
  clog(c, by, `اعتماد الإدارة المالية للتسوية${note ? ` · ${note}` : ''}`, at)
  clog(c, 'النظام', `أُغلق المشروع مباشرة · ${stopped.length ? `أُغلقت ${stopped.length} طلبات صرف مفتوحة (${stopped.join('، ')}) · ` : ''}${unpaid > 0 ? `حُرّر ${nf.format(unpaid)} غير مصروف إلى بند الميزانية · ` : ''}الحالة: مشروع مكتمل`, at)
  notify([c.entityName], 'أُغلق مشروعك', c.projectName, `${ROUTES.distress(c.id)}?as=entity`)
  notify([p.owner ?? MGR()], 'اكتمل الإغلاق المباشر', c.projectName, ROUTES.distress(c.id))
}

/** The CEO approved · the project changes now, not before (10.9.1 – 10.9.6) */
function applyCase(c: CaseRow, by: string, at: string) {
  const p = projectOf(c.projectId)
  if (!p) return
  let due = 0
  let reason = ''
  const redirectOf = (redirected: number, used: number): SupportRedirect => ({
    original: c.granted, used, redirected, purpose: c.redirect?.purpose ?? '', decision: c.redirect?.decision ?? '', decisionFile: c.redirect?.file ?? '',
    evidence: [c.settlement?.evidence ?? c.redirect?.file ?? ''].filter(Boolean), by, at: day(at),
  })
  if (c.kind === 'stop') {
    if (live) stopProjectPayments(c.projectId, c.reason, by)
    /* v3 · 10.9.1 – 10.9.3 · the status the decision chose · «ملغى», «متعثر», or «أعيد توجيه الدعم» */
    setProjectStage(c.projectId, c.outcome === 'distress' ? 'مشروع متعثر' : 'مشروع موقوف')
    if (live) releaseSavings(c.projectId, by, 'إيقاف المشروع · تحرير المحجوز غير المصروف')
    const actual = c.settlement?.actual ?? c.paid
    if (c.outcome === 'redirect') {
      c.applied = redirectOf(Math.max(0, c.paid - actual), actual)
      /* 18 Oct · 10.9.2 – 10.9.4 · v3 · the status follows the decision · or, by the foundation's choice, waits
         for the final closing (decisions · redirectStatusAt) */
      if (DECISIONS.redirectStatusAt !== 'closing') { p.redirect = c.applied; p.statusGroup = 'أعيد توجيه الدعم' }
      clog(c, 'النظام', `أُعيد توجيه الرصيد غير المستخدم ${nf.format(Math.max(0, c.paid - actual))} · ${c.redirect?.purpose ?? ''} · القرار ${c.redirect?.decision ?? ''}`, at)
    }
    due = c.outcome === 'redirect' ? 0 : Math.max(0, c.paid - actual)
    reason = 'الرصيد غير المستخدم بعد اعتماد المصروف الفعلي'
    clog(c, 'النظام', `أُوقف المشروع وطلبات صرفه ودفعاته القادمة، وحُرّر المحجوز غير المصروف إلى مخصص المجال · الحالة: ${c.outcome === 'distress' ? 'متعثر' : c.outcome === 'redirect' ? 'أعيد توجيه الدعم' : 'ملغى'}`, at)
  } else if (c.kind === 'increase' && c.outcome === 'independent') {
    clog(c, 'النظام', `اعتُمدت الزيادة مشروعًا مستقلًّا بقيمة ${nf.format((c.newAmount ?? c.granted) - c.granted)} · لا تتغيّر قيمة المشروع الأصلي ولا حجزه`, at)
  } else {
    const to = c.newAmount ?? c.granted
    p.amountGranted = to
    /* Re-audit 7 Oct · the agreement's value follows, by its annex */
    if (live) annexValue(c.projectId, to, c.id, by, c.reason, c.annex)
    if (c.kind === 'reduce') {
      if (live) {
        /* Verifier · 16 Oct · a difference recovered before the decision already lowered the link's paid and amount */
        const got = c.recovery ? c.recovery.receipts.reduce((s, x) => s + x.amount, 0) : 0
        resizeLink(c.projectId, Math.max(to, c.paid - got), c.id, by, c.reason)
        adjustSchedule(c.projectId, { cut: c.granted - to }, by)
      }
      due = c.outcome === 'redirect' ? 0 : Math.max(0, c.paid - to)
      if (c.outcome === 'redirect' && c.paid > to) c.applied = redirectOf(c.paid - to, to)
      reason = 'فرق التخفيض عمّا صُرف'
    } else if (live) {
      resizeLink(c.projectId, to, c.id, by, c.reason)
      adjustSchedule(c.projectId, { extra: c.extra ?? { amount: to - c.granted, dueAt: addDays(actDay(), 30) } }, by)
    }
    clog(c, 'النظام', `حُدّثت قيمة المشروع إلى ${nf.format(to)}${c.kind === 'increase' ? ' وأُضيفت دفعة إضافية وزيد الحجز' : ' وخُفّض الحجز والجدول'}`, at)
  }
  if (c.recovery) c.stage = 'closed'
  else if (due > 0) {
    c.stage = 'approved'
    c.recovery = { id: `RC-${c.id}`, source: c.kind === 'stop' ? 'stop' : 'reduce', due, reason, openedAt: day(at), openedBy: by, receipts: [], claims: [], escalations: [], released: 0, state: 'open' }
    clog(c, by, `مطالبة الجهة بإعادة ${nf.format(due)} · ${reason}`, at)
    notify([c.entityName], `مطالبة بإعادة ${nf.format(due)}`, c.projectName, `${ROUTES.distress(c.id)}?as=entity`)
  } else c.stage = 'closed'
  notify([c.entityName], `${CASE_KIND_SAY[c.kind]} · اعتُمد القرار`, c.projectName, `${ROUTES.distress(c.id)}?as=entity`)
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); live = true; apply(o); save(); emit(); done(o.op, 'الإغلاق') }

/* ── Seed · the fixture's records take their finance, feedback and separate evaluation log ── */

function seed() {
  for (const c of closeRows) {
    c.finance ??= financeFor(c)
    /* Verifier · 16 Oct · a fixture record not yet past the supervisor reads its media review from the agreement */
    if (['draft', 'returned', 'supervisor'].includes(c.stage)) c.mediaRequired = mediaInAgreement(c.projectId)
    /* v3 · 10.4.6 · the fixture's financial documents stand as its executive financial report · 10.4.4 ·
       a report already sent carries the project's value and its outputs as achieved */
    if (c.report.docs.includes('invoices') && !c.report.docs.includes('finrep')) c.report.docs.push('finrep')
    if (c.stage !== 'draft' && c.stage !== 'returned') {
      c.report.projectValue ??= grantOf(c.projectId)
      c.report.outputs ??= agreedOutputs(c.projectId).map((x) => ({ ...x, achieved: 'تحقّق وفق التقرير الختامي' }))
      c.report.template ??= 'own'
    } else {
      c.report.projectValue ??= null
      c.report.outputs ??= agreedOutputs(c.projectId)
    }
    if (PAST_SUPERVISOR.includes(c.stage) && c.report.budget !== null) {
      c.finance.verified = c.report.budget
      c.finance.verifiedBy = c.owner
      c.finance.verifiedAt = c.openedAt
    }
    if (FEEDBACK_SEEDED.includes(c.stage)) c.feedback = { scores: { clarity: 4, speed: 3, support: 5, portal: 4 }, comment: 'التواصل مع المشرف كان واضحًا · والصرف تأخّر في الدفعة الثانية.', by: c.entityName, at: c.openedAt }
    /* Rule 17 · the evaluation's lines move to their own log */
    const isEval = (a: CloseAudit) => /التقييم/.test(a.what)
    c.evalAudit = c.audit.filter(isEval)
    c.audit = c.audit.filter((a) => !isEval(a))
    c.snapshots ??= []
  }
  /* One of each distress station the fixture doesn't have on its own */
  const pick = (id: string) => projectOf(id)
  const at = SEED_AT
  const sup = 'عمر قاسم'
  if (pick('20817')) {
    apply({ op: 'caseCreate', row: { id: 'TS-3001', projectId: '20817', kind: 'stop', reason: 'توقّفت الجهة عن التنفيذ بعد المرحلة الأولى لخلاف مع المقاول' }, by: sup, at })
  }
  if (pick('20845')) {
    apply({ op: 'caseCreate', row: { id: 'TS-3002', projectId: '20845', kind: 'reduce', reason: 'أُلغي مكوّن التأثيث بعد تبرّع جهة أخرى به', newAmount: 1_600_000, annex: 'ملحق تعديل الاتفاقية.pdf' }, by: sup, at })
    apply({ op: 'caseAct', id: 'TS-3002', act: 'submit', note: '', by: sup, at })
    apply({ op: 'caseAct', id: 'TS-3002', act: 'approve', note: '', by: roleByKey('grants-manager').name, at })
  }
}

function hydrate() {
  seed()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
  live = true
  /* v3 · 10.2.1 · the execution's period ended · the supervisor is alerted · the project's status doesn't change */
  /* Verifier · 16 Oct · dated at the period's end, so a reload doesn't make them read new */
  for (const p of endedUnclosed()) notify([p.owner ?? roleByKey('supervisor').name], 'انتهت مدة تنفيذ المشروع · تحقّق من اكتمال التنفيذ وافتح متطلبات الإغلاق', p.name, ROUTES.projectTab(p.id, 'closing'), projectEnd(p.id))
}

/** v3 · 10.2.1 · running projects past their period with no closing yet · for the supervisor's alert and queue */
export function endedUnclosed(): typeof projectRows {
  return projectRows.filter((p) => p.statusGroup === 'تحت التنفيذ' && !p.platform && !closeOfProject(p.id) && (projectEnd(p.id) ?? '9999') <= TODAY)
}
hydrate()

setOpenGate(openGate)
/* v3 · 13.2.30 · a portfolio closes by this procedure's matrix and evaluation questions */
/* a portfolio's closing keeps its 1–5 questions · the points questions are the project evaluation's */
setPfCloseRules((k, v) => approverFor(k, '', v), () => { const l = evalCriteriaNow(); return l.some((x) => x.points) ? EVAL_CRITERIA_LEGACY : l })
setReqGate((c) => {
  if (c.stage === 'closed') return { ok: true, say: 'اكتملت المتطلبات المالية والإدارية' }
  const miss = requirementsOf(c).filter((x) => !x.ok)
  return { ok: !miss.length, say: miss.length ? miss.map((x) => x.say).join(' · ') : 'اكتملت المتطلبات المالية والإدارية' }
})

/* ── Actions ── */

export function openClosing(projectId: string, by: string): { id?: string; errors: string[] } {
  const has = closeOfProject(projectId)
  if (has) return { id: has.id, errors: [] }
  const g = openGate(projectId)
  if (!g.ok || !g.basis) return { errors: [g.why] }
  /* Verifier · 16 Oct · past the highest id in use · the fixture's own ids sit above 2050 + its count */
  const id = `CL-${Math.max(2050, ...closeRows.map((x) => Number(x.id.replace(/\D/g, '')) || 0)) + 1}`
  const stop = g.basis === 'stopped' ? casesOfProject(projectId).find((k) => k.kind === 'stop' && (k.stage === 'approved' || k.stage === 'closed')) : undefined
  /* Client 18 Oct · decision 21 · the open payment requests stop with the opening */
  const payStopped = stopForClosing(projectId, id, by)
  run({ op: 'open', id, projectId, basis: g.basis, mediaRequired: mediaInAgreement(projectId), outputs: agreedOutputs(projectId), verified: stop ? (stop.settlement?.actual ?? stop.paid) : undefined, payStopped: payStopped || undefined, by, at: now() })
  return { id, errors: [] }
}
export const saveReport = (id: string, patch: ReportPatch, by: string) => run({ op: 'save', id, patch, by, at: now() })
export const attachDoc = (id: string, key: string, by: string, file?: string) => run({ op: 'doc', id, key, file, by, at: now() })

/* Client 21 Oct (#7) · the execution files go to the foundation's storage, not to a drive link ·
   the record names each file · its bytes, in this prototype, live for the session as an object URL */
const FILE_URLS = new Map<string, string>()
/** The file's address in the storage · empty when its bytes aren't on this device (an older session) */
export const reportFileUrl = (fileId: string): string => FILE_URLS.get(fileId) ?? ''
const UPLOAD_MAX_MB = 200
export function addReportFiles(id: string, files: File[], by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  if (c.stage !== 'draft' && c.stage !== 'returned') return ['تُرفع الملفات قبل الإرسال أو بعد إعادة رسمية']
  const big = files.filter((f) => f.size > UPLOAD_MAX_MB * 1024 * 1024)
  if (big.length) return [`${big.map((f) => f.name).join('، ')} أكبر من ${UPLOAD_MAX_MB} ميجابايت`]
  const rows = files.map((f) => {
    const fid = `UP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    try { FILE_URLS.set(fid, URL.createObjectURL(f)) } catch { /* no object URLs here · the record still names it */ }
    return { id: fid, name: f.name, type: f.type || 'application/octet-stream', size: f.size }
  })
  if (rows.length) run({ op: 'files', id, files: rows, by, at: now() })
  return []
}
export const dropReportFile = (id: string, fileId: string, by: string) => run({ op: 'fileDrop', id, fileId, by, at: now() })

/** Client 21 Oct (#16) · reopening a closed project is a dedicated permission · the grants manager or the system admin */
export const mayReopen = (c: CloseRow, role: RoleKey): boolean => c.stage === 'closed' && (role === 'grants-manager' || role === 'admin')
export function reopenClosing(id: string, reason: string, by: string, role: RoleKey): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  if (c.stage !== 'closed') return ['يُعاد فتح المشروع بعد إغلاقه النهائي فقط']
  if (!mayReopen(c, role)) return ['إعادة الفتح صلاحية لمدير المنح ومدير النظام']
  if (!reason.trim()) return ['سبب إعادة الفتح إلزامي']
  run({ op: 'reopen', id, reason: reason.trim(), role: roleByKey(role).title, by, at: now() })
  return []
}
export function addLink(id: string, label: string, url: string, by: string): string[] {
  if (!/^https?:\/\//.test(url.trim())) return ['الرابط غير صالح']
  run({ op: 'link', id, label: label.trim() || 'رابط تخزين سحابي', url: url.trim(), by, at: now() })
  return []
}
export function sendClosingReport(id: string, by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  const m = reportBlockers(c)
  if (m.length) return [/* doc rule 3 */ `ينقص: ${m[0]}`]
  run({ op: 'send', id, by, at: now() })
  return []
}

export interface CloseAct { kind: 'report' | 'eval' | 'start' | 'evalSend'; act: 'approve' | 'return' | 'start' | 'send'; label: string; btn: 'btn-p' | 'btn-2'; needsNote?: boolean; needsFile?: string; gated?: boolean; why: string; invoices?: boolean }

/** Each role's exits on a closing · the returns say where they go (10.2.13 · 10.2.19 · 10.2.20) */
export function closeActions(c: CloseRow, role: RoleKey): CloseAct[] {
  const back = 'إعادة للجهة بملاحظات'
  if (c.stage === 'supervisor' && role === 'supervisor') return [
    { kind: 'report', act: 'approve', label: 'اعتماد التقرير وإحالته', btn: 'btn-p', gated: true, why: /* doc step 7 */ 'مراجعة مشرف المنح ثم الاتصال المؤسسي أو مدير المنح' },
    { kind: 'report', act: 'return', label: back, btn: 'btn-2', needsNote: true, why: /* doc rule 19 */ ' · تعود الإعادة إلى الجهة وتُنشئ إصدارًا جديدًا' },
    /* Client 21 Oct (#8) · the invoices aren't required, as a rule with no exception · the request that
       made them mandatory left the dock · the entity may still attach them as a supporting document */
  ]
  /* Re-audit 7 Oct · corporate communications reviews in its own seat (10.2.12 · 10.2.13) */
  if (c.stage === 'comms' && role === 'comms') return [
    { kind: 'report', act: 'approve', label: 'اعتماد متطلبات النشر', btn: 'btn-p', why: /* doc rule 9 */ ' · مراجعة النشر الإعلامي متى كانت مطلوبة' },
    { kind: 'report', act: 'return', label: 'إعادة للمشرف بملاحظات النشر', btn: 'btn-2', needsNote: true, why: /* doc 10.2.13 */ 'تعود ملاحظات النشر إلى مشرف المنح' },
  ]
  if (c.stage === 'manager' && role === 'grants-manager') return [
    approverFor('report', c.projectId) === 'grants-manager'
      ? { kind: 'report', act: 'approve', label: 'اعتماد التقرير الختامي', btn: 'btn-p', gated: true, why: /* doc 10.2.15 */ ' · مدير المنح المعتمد النهائي وفق مصفوفة الصلاحيات' }
      : { kind: 'report', act: 'approve', label: 'اعتماد التقرير وإحالته للتنفيذي', btn: 'btn-p', gated: true, why: /* doc 10.2.15 */ 'اعتماد مدير المنح ثم صاحب الصلاحية التالي وفق المصفوفة' },
    { kind: 'report', act: 'return', label: back, btn: 'btn-2', needsNote: true, why: /* doc rule 19 */ ' · كل إعادة تُنشئ إصدارًا جديدًا' },
  ]
  if (c.stage === 'executive' && role === 'ceo') return [
    { kind: 'report', act: 'approve', label: 'اعتماد التقرير الختامي', btn: 'btn-p', gated: true, why: /* doc rule 6 */ ' · اعتماد المدير التنفيذي يفتح التقييم' },
    { kind: 'report', act: 'return', label: back, btn: 'btn-2', needsNote: true, why: 'تعود الإعادة إلى الجهة كاتبة التقرير' },
  ]
  if (c.stage === 'reportDone' && role === 'supervisor') return [
    { kind: 'start', act: 'start', label: 'ابدأ تقييم المشروع', btn: 'btn-p', why: /* doc rule 6 */ ' · يبدأ التقييم بعد اعتماد التقرير الختامي' },
  ]
  if (c.stage === 'evalDraft' && role === 'supervisor') return [
    { kind: 'evalSend', act: 'send', label: 'إرسال التقييم لمدير المنح', btn: 'btn-p', gated: true, why: /* doc rule 17 */ ' · دورة اعتماد مستقلّة بسجلّ منفصل' },
  ]
  if (c.stage === 'evalManager' && role === 'grants-manager') return [
    approverFor('eval', c.projectId) === 'grants-manager'
      ? { kind: 'eval', act: 'approve', label: 'اعتماد التقييم والإغلاق النهائي', btn: 'btn-p', gated: true, why: /* doc 10.2.19 */ ' · مدير المنح المعتمد النهائي وفق مصفوفة الصلاحيات' }
      : { kind: 'eval', act: 'approve', label: 'اعتماد التقييم وإحالته للتنفيذي', btn: 'btn-p', why: /* doc 10.2.19 */ ' · صاحب الصلاحية التالي وفق المصفوفة' },
    { kind: 'eval', act: 'return', label: 'إعادة لمشرف المنح بملاحظات', btn: 'btn-2', needsNote: true, why: /* doc 10.2.19 */ 'يُعدّ المشرف التقييم فتعود إليه' },
  ]
  if (c.stage === 'evalExecutive' && role === 'ceo') return [
    { kind: 'eval', act: 'approve', label: 'اعتماد التقييم والإغلاق النهائي', btn: 'btn-p', gated: true, why: /* doc rule 8 · 18 */ ' · الإغلاق يحتاج التقرير والتقييم والمتطلبات معًا' },
    { kind: 'eval', act: 'return', label: 'إعادة لمدير المنح بملاحظات', btn: 'btn-2', needsNote: true, why: /* doc 10.2.20 */ 'يعيد المدير التنفيذي التقييم إلى مدير المنح' },
  ]
  return []
}

/** What stops a gated exit · named, the first one shown */
export function closeStops(c: CloseRow, a: CloseAct): string[] {
  if (a.act === 'return') return []
  if (a.kind === 'report' && a.gated) {
    const m = reportBlockers(c)
    if (m.length) return [/* doc rule 4 */ `ينقص: ${m[0]}`]
    if (c.stage === 'supervisor' && c.finance?.verified == null) return [/* doc 10.4.6 */ 'اعتمد المصروف من التقرير المالي التنفيذي أولًا']
  }
  if (a.kind === 'evalSend') { const e = evalBlockers(c); if (e.length) return [/* doc rule 10 */ `${e[0]}`] }
  if (a.kind === 'eval' && a.gated) return requirementsOf(c).filter((x) => !x.ok).map((x) => /* doc rule 18 */ `${x.say}`)
  return []
}

export function actOnClosing(id: string, act: CloseAct, note: string, by: string, role: RoleKey, file?: string): string[] {
  let a = act
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  const m = closeActions(c, role).find((x) => x.label === a.label)
  if (!m) return ['الإجراء غير متاح لك في هذه المرحلة']
  a = m
  if (a.needsNote && !note.trim()) return ['اكتب سبب الإعادة أولًا']
  if (a.needsFile && !file) return [`ارفع ${a.needsFile} أولًا`]
  const stops = closeStops(c, a)
  if (stops.length) return stops
  if (a.kind === 'start') run({ op: 'evalStart', id, by, at: now() })
  else if (a.kind === 'evalSend') run({ op: 'evalSend', id, by, at: now() })
  else if (a.kind === 'eval') run({ op: 'evalAct', id, act: a.act as 'approve' | 'return', note, by, at: now() })
  else run({ op: 'act', id, act: a.act as 'approve' | 'return', note, file, invoices: a.invoices, by, at: now() })
  return []
}

/** The most a supervisor can approve · the larger of what was paid and the financial report's lines */
export const finLinesTotal = (c: CloseRow): number => (c.finance?.lines ?? []).reduce((s, l) => s + (l.spent ?? 0), 0)
export const spendCap = (c: CloseRow): number => Math.max(paidToDate(c.projectId) - caseSettled(c.projectId), finLinesTotal(c))
/** v3 · 10.4.6 · the supervisor approves the actual spend from the executive financial report */
export function verifyInvoices(id: string, amount: number, note: string, by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  if (c.stage !== 'supervisor') return ['يُعتمد المصروف عند مراجعة مشرف المنح · وبعد اعتماد التقرير لا يتغيّر']
  if (!(amount >= 0)) return ['أدخل المصروف الفعلي المعتمد']
  if (amount > spendCap(c)) return [`المبلغ أكبر من المصروف ومجموع التقرير المالي (${nf.format(spendCap(c))})`]
  run({ op: 'verify', id, amount, note, by, at: now() })
  return []
}
export const saveEvaluation = (id: string, evaluation: ProjectEval, by: string) => run({ op: 'evalSave', id, evaluation, by, at: now() })
/** Client 28 Oct · an approver's own evaluation · at his stage only */
export const saveEvalReview = (id: string, seat: EvalSeat, evaluation: ProjectEval, by: string) => run({ op: 'evalReview', id, seat, evaluation, by, at: now() })
export function sendFeedback(id: string, scores: Record<string, number>, comment: string, by: string): string[] {
  if (FEEDBACK_ITEMS.some((x) => !scores[x.key])) return ['قيّم كل البنود']
  run({ op: 'feedback', id, feedback: { scores, comment }, by, at: now() })
  return []
}
export const saveCloseRules = (rules: CloseRules, by: string) => run({ op: 'rules', rules, by, at: now() })

/** v3 · 10.4.32 · who may record a change after the final closing · the report's last approver, or the executive */
export const mayException = (c: CloseRow, role: RoleKey): boolean => c.stage === 'closed' && (role === 'ceo' || role === approverFor('report', c.projectId))
export function recordException(id: string, v: { field: ExcField; value: string; reason: string; decision: string; file: string }, by: string, role: RoleKey): string[] {
  const c = closeById(id)
  if (!c) return ['الإغلاق غير موجود']
  if (c.stage !== 'closed') return ['التعديل الاستثنائي بعد الإغلاق النهائي فقط · قبله يُعدَّل بالإعادة']
  if (!mayException(c, role)) return ['الإجراء الاستثنائي لصاحب الصلاحية']
  const f = EXC_FIELDS.find((x) => x.key === v.field)
  const out: string[] = []
  if (!f) out.push('اختر الحقل')
  if (!v.value.trim() || (f?.num && !(Number(v.value) >= 0))) out.push('القيمة الجديدة')
  if (!v.reason.trim()) out.push('سبب التعديل')
  if (!v.decision.trim()) out.push('رقم القرار')
  if (!v.file) out.push('مستند القرار')
  if (out.length) return out
  run({ op: 'exception', id, ...v, value: v.value.trim(), reason: v.reason.trim(), decision: v.decision.trim(), role: roleByKey(role).title, by, at: now() })
  return []
}
export function saveEntityLessons(entityId: string, text: string, by: string, role: RoleKey): string[] {
  if (!['supervisor', 'grants-manager', 'ceo'].includes(role)) return ['يُحرّر الدروس المستفادة إدارة المنح']
  if (!text.trim()) return ['اكتب الدروس المستفادة']
  run({ op: 'lessons', entityId, text: text.trim(), by, at: now() })
  return []
}

/** v3 · 0.status.9 · what a redirection starts from · the grant, what the verified invoices used, and
    the most that can move */
export function redirectBase(c: CloseRow): { original: number; used: number; max: number } {
  /* Verifier · 16 Oct · only the paid money the entity holds unused · the unpaid hold goes back to the line on its own */
  const original = grantOf(c.projectId)
  const used = c.finance?.verified ?? paidToDate(c.projectId)
  return { original, used, max: c.finance?.verified == null ? 0 : Math.max(0, savingsOf(c) - (c.recovery ? c.recovery.due : 0)) }
}
/** v3 · 10.4.11 · a redirection of support is a significant financial decision · the matrix's approver, or the executive */
export const mayRedirect = (role: RoleKey, projectId?: string): boolean => role === 'ceo' || (projectId !== undefined && role === approverFor('redirect', projectId))
export function redirectSupport(id: string, v: { redirected: number; purpose: string; decision: string; decisionFile: string; evidence: string[] }, by: string, role: RoleKey): string[] {
  const c = closeById(id)
  if (!c) return ['الإغلاق غير موجود']
  if (!mayRedirect(role, c.projectId)) return ['إعادة توجيه الدعم لصاحب الصلاحية · المدير التنفيذي افتراضيًّا']
  if (c.stage === 'closed') return ['أُغلق المشروع نهائيًّا']
  if (c.redirect) return ['سُجّل قرار إعادة التوجيه من قبل']
  const b = redirectBase(c)
  const out: string[] = []
  if (c.finance?.verified == null) return ['اعتمد المصروف الفعلي من التقرير المالي التنفيذي أولًا']
  if (!(v.redirected > 0)) out.push('المبلغ المعاد توجيهه')
  else if (v.redirected > b.max) out.push(`المعاد توجيهه في حدود غير المستخدم (${nf.format(b.max)})`)
  if (!v.purpose.trim()) out.push('الغرض الجديد داخل العلاقة نفسها')
  if (!v.decision.trim()) out.push('رقم القرار')
  if (!v.decisionFile) out.push('مستند القرار')
  if (!v.evidence.length) out.push('شاهد واحد على الأقل')
  if (out.length) return out
  run({ op: 'redirect', id, v: { original: b.original, used: b.used, redirected: v.redirected, purpose: v.purpose.trim(), decision: v.decision.trim(), decisionFile: v.decisionFile, evidence: v.evidence }, by, at: now() })
  return []
}

/* Recovery · shared by the closing's savings and the distress cases */

export function openSavingsRecovery(id: string, by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  const due = savingsDue(c)
  if (due <= 0) return ['لا وفر يستوجب الاسترداد']
  if (c.recovery) return ['المطالبة مفتوحة']
  run({ op: 'recOpen', owner: { kind: 'close', id }, rec: { id: `RC-${id}`, source: 'savings', due, reason: c.redirect ? 'وفر المشروع بعد المعاد توجيهه · المصروف ناقص المعتمد من التقرير المالي التنفيذي' : 'وفر المشروع · المصروف ناقص المعتمد من التقرير المالي التنفيذي', openedAt: day(now()), openedBy: by }, by, at: now() })
  return []
}
export function recordReceipt(owner: RecOwner, amount: number, ref: string, file: string, by: string): string[] {
  const r = recOf(owner)
  if (!r) return ['لا مطالبة']
  if (!ref.trim()) return ['أدخل مرجع التحويل للمطابقة']
  if (!file) return ['ارفع إشعار التحويل']
  if (!(amount > 0)) return ['أدخل المبلغ المستلم']
  if (amount > recLeft(r)) return [`المبلغ أكبر من المتبقي (${nf.format(recLeft(r))})`]
  run({ op: 'recReceipt', owner, receipt: { id: `${r.id}-${r.receipts.length + 1}`, at: day(now()), amount, ref: ref.trim(), file, by }, by, at: now() })
  return []
}
/* Client 18 Oct (sheet V2 · #42 · #48) · every distress and recovery step is a permission, and none runs
   without its supporting document */
export function failRecovery(owner: RecOwner, text: string, by: string, file?: string, role?: RoleKey): string[] {
  if (role && !holds('distressBy', role) && !holds('recoveryBy', role)) return [`إثبات تعذّر الاسترداد لـ${holdersSay('distressBy')} (صلاحية في قرارات المؤسسة)`]
  if (!text.trim()) return ['اذكر المطالبات المرسلة وردّ الجهة']
  if (!file) return ['ارفع إثبات المطالبات المرسلة']
  run({ op: 'recFail', owner, text: text.trim(), file, by, at: now() })
  return []
}
export const ESCALATION_STEPS = ['إنذار رسمي', 'مطالبة عبر الإدارة القانونية', 'إحالة إلى الجهة المختصة']
export function escalateRecovery(owner: RecOwner, step: string, text: string, by: string, file?: string, role?: RoleKey): string[] {
  if (role && !holds('recoveryBy', role) && !holds('distressBy', role)) return [`التصعيد لـ${holdersSay('recoveryBy')} أو ${holdersSay('distressBy')} (صلاحية في قرارات المؤسسة)`]
  if (!step) return ['اختر خطوة التصعيد']
  if (!file) return ['ارفع مستند خطوة التصعيد']
  run({ op: 'recEscalate', owner, step, text: text.trim(), file, by, at: now() })
  return []
}
export function decideRecovery(owner: RecOwner, kind: NonNullable<Recovery['decision']>['kind'], text: string, by: string, role: RoleKey, file?: string): string[] {
  if (!holds('recoveryBy', role)) return [`القرار في الرصيد غير المسترد لـ${holdersSay('recoveryBy')} (صلاحية في قرارات المؤسسة)`]
  if (!text.trim()) return ['اكتب نص القرار']
  if (!file) return ['ارفع مستند القرار']
  run({ op: 'recDecide', owner, kind, text: text.trim(), file, by, at: now() })
  return []
}

/* Distress cases */

export const nextCaseId = () => `TS-${3001 + CASES.length}`
export function createCase(v: { projectId: string; kind: CaseKind; reason: string; file?: string; newAmount?: number; annex?: string; extra?: { amount: number; dueAt: string }; outcome?: CaseRow['outcome']; redirect?: CaseRow['redirect'] }, by: string, role?: RoleKey): { id?: string; errors: string[] } {
  const p = projectOf(v.projectId)
  if (!p) return { errors: ['المشروع غير موجود'] }
  if (!v.reason.trim()) return { errors: ['اكتب سبب القرار'] }
  if (casesOfProject(v.projectId).some((c) => !['closed', 'rejected'].includes(c.stage))) return { errors: ['للمشروع حالة تعثّر مفتوحة'] }
  if (v.kind === 'direct') {
    /* #27 · an independent procedure · not over a closing already running */
    const open = closeOfProject(v.projectId)
    if (open && open.stage !== 'closed') return { errors: [`للمشروع إغلاق قائم ${open.id} · يُستكمل من صفحته`] }
    if (!isLive(p.statusGroup) && p.statusGroup !== 'متعثر') return { errors: ['يُغلق مباشرة مشروع معتمد تحت التنفيذ'] }
    if (role && !holds('distressBy', role)) return { errors: [`فتح الإغلاق المباشر لـ${holdersSay('distressBy')} (صلاحية في قرارات المؤسسة)`] }
    const id = nextCaseId()
    run({ op: 'caseCreate', row: { id, paid: paidToDate(v.projectId), granted: grantOf(v.projectId), projectId: v.projectId, kind: 'direct', reason: v.reason.trim(), file: v.file }, by, at: now() })
    return { id, errors: [] }
  }
  if (!(isLive(p.statusGroup) || p.statusGroup === 'متعثر') || p.stage === 'مشروع موقوف') return { errors: ['يُتّخذ القرار على مشروع معتمد تحت التنفيذ'] }
  const g = grantOf(v.projectId)
  const paid = paidToDate(v.projectId)
  if (v.kind === 'reduce') {
    if (!v.newAmount || v.newAmount >= g) return { errors: ['القيمة الجديدة أقل من الحالية في التخفيض'] }
    if (!v.annex) return { errors: [/* doc 10.9.5 */ 'ارفع ملحق الاتفاقية'] }
  }
  if (v.kind === 'increase') {
    if (!v.newAmount || v.newAmount <= g) return { errors: ['القيمة الجديدة أكبر من الحالية في الزيادة'] }
    const i = v.outcome === 'independent' ? '' : resizeIssue(v.projectId, v.newAmount)
    if (i) return { errors: [i] }
  }
  const allowed = outcomesFor(v.kind, v.projectId, v.newAmount)
  const outcome = v.outcome ?? allowed[0]
  if (!outcome || !allowed.includes(outcome)) return { errors: [`النتيجة غير متاحة لهذه الحالة · المتاح: ${allowed.map((x) => OUTCOME_SAY[x]).join('، ')}`] }
  /* Client 18 Oct (sheet V2 · #42) · opening a distress case is a system permission */
  if (role && !(v.kind === 'reduce' || outcome === 'annex') && !holds('distressBy', role)) return { errors: [`فتح حالة التعثر لـ${holdersSay('distressBy')} (صلاحية في قرارات المؤسسة)`] }
  /* Client 18 Oct · #17 · a value annex (a cut · a raise by annex) is a system permission */
  if (role && (v.kind === 'reduce' || outcome === 'annex') && !holds('annexBy', role)) return { errors: [`قرار ملحق القيمة لـ${holdersSay('annexBy')} (صلاحية في قرارات المؤسسة)`] }
  if (outcome === 'redirect' && (!v.redirect?.purpose.trim() || !v.redirect.decision.trim() || !v.redirect.file)) return { errors: [/* doc 10.9.2 */ 'وثّق إعادة التوجيه · الغرض الجديد ورقم القرار ومستنده'] }
  if (v.kind === 'reduce' && outcome === 'redirect' && paid <= (v.newAmount ?? 0)) return { errors: ['لا فرق مصروف يُعاد توجيهه'] }
  const id = nextCaseId()
  run({ op: 'caseCreate', row: { id, paid, granted: g, projectId: v.projectId, kind: v.kind, reason: v.reason.trim(), newAmount: v.newAmount, annex: v.annex, extra: v.extra, outcome, redirect: outcome === 'redirect' ? { purpose: v.redirect!.purpose.trim(), decision: v.redirect!.decision.trim(), file: v.redirect!.file } : undefined }, by, at: now() })
  return { id, errors: [] }
}
export const attachCaseDoc = (id: string, key: 'report' | 'evidence' | 'invoices' | 'annex', file: string, by: string) => run({ op: 'caseDoc', id, key, file, by, at: now() })
export function settleCase(id: string, actual: number, by: string): string[] {
  const c = caseById(id)
  if (!c) return ['الحالة غير موجودة']
  if (!c.settlement?.report || !(c.settlement.evidence || c.settlement.invoices)) return ['لم ترفع الجهة التقرير المالي التنفيذي وأدلة المخرجات بعد']
  if (!(actual >= 0) || actual > c.paid) return [`المصروف الفعلي بين 0 و${nf.format(c.paid)}`]
  run({ op: 'caseSettle', id, actual, by, at: now() })
  return []
}
export function actOnCase(id: string, act: CaseAct, note: string, by: string, role: RoleKey): string[] {
  const c = caseById(id)
  if (!c) return ['الحالة غير موجودة']
  const a = caseActions(c, role).find((x) => x.act === act)
  if (!a) return ['الإجراء غير متاح لك في هذه المرحلة']
  if (a.needsNote && !note.trim()) return ['اكتب الملاحظة أولًا']
  const stops = caseStops(c, act)
  if (stops.length) return stops
  run({ op: 'caseAct', id, act, note, by, at: now() })
  /* v3 · 10.4.28 · a raise approved as a separate project · its request opens for the same entity,
     linked to this one, and goes through study and approval like any other */
  if (c.kind === 'increase' && c.outcome === 'independent' && (c.stage === 'closed' || c.stage === 'approved') && !c.independentId) {
    const p = projectOf(c.projectId)
    if (p) {
      const pid = submitRequest({
        entityId: p.entityId, name: `${p.name} · امتداد`, track: p.track, field: p.field, goal: p.goal, region: p.region, city: p.city,
        amountRequested: String((c.newAmount ?? c.granted) - c.granted), workDays: String(p.durationDays || 90), reach: String(p.beneficiaries || 0),
        objectives: `امتداد للمشروع ${p.id} بقرار ${c.id} · ${c.reason}`, outputs: '',
      }, [], by, false)
      run({ op: 'caseLink', id, projectId: pid, by, at: now() })
    }
  }
  return []
}

export const resetClosing = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }
