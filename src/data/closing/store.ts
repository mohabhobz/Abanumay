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
import { inForceOf, annexValue } from '@/data/agreements/store'
import { hasFunding, releaseRecovered, releaseSavings, resizeIssue, resizeLink } from '@/data/budget/store'
import {
  adjustSchedule, isStopped, paidOf, scheduleOf, stopProjectPayments, unsettledSlots, usePayments,
} from '@/data/payments/store'
import { roleByKey, type RoleKey } from '@/data/roles'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import type {
  CaseKind, CaseRow, CaseStage, CloseAudit, CloseFinance, CloseRow, CloseStage, EntityFeedback, FinalReport,
  ProjectEval, Recovery, RecoveryReceipt,
} from '@/types/domain'

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

export interface CloseRules {
  /** 10.9.3 · 10.9.8 · recovered money goes back to the line at once when the recovery completes, or with each receipt */
  releaseMode: 'once' | 'gradual'
}
export const CLOSE_RULES: CloseRules = { releaseMode: 'once' }
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
const notify = (to: string[], title: string, context: string, href: string) => {
  for (const t of to) CLOSE_NOTES.unshift({ id: `cln-${CLOSE_NOTES.length + 1}`, to: t, title, context, at: actDay(), href })
}
const MGR = () => roleByKey('grants-manager').title
const CEO = () => roleByKey('ceo').title

/* ── Readers ── */

const projectOf = (id: string) => projectRows.find((p) => p.id === id)
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function isRunning(p: { statusGroup: string; stage: string }): boolean {
  return p.statusGroup === 'في التشغيل' && !p.stage.includes('الإتفاقي') && !['دراسة المشروع', 'استكمال بيانات المشروع'].includes(p.stage)
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
  return p && (isRunning(p) || p.statusGroup === 'مكتمل' || p.statusGroup === 'متعثر') ? (p.amountGranted || p.amountRequested) : 0
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
  if (!stopped && !isRunning(p)) return { ok: false, why: 'المشروع ليس «تحت التنفيذ» · لا يُفتح الإغلاق لمشروع في الدراسة أو قبل اتفاقيته · قاعدة 1' }
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
        ? `لم تكتمل خطة التنفيذ (${nf.format(Math.round(planDone(plan)))} بالمئة) ولم تنتهِ المدة${end ? ` (تنتهي ${end})` : ''} ولا قرار إنهاء معتمد · قاعدة 1`
        : `لم تنتهِ مدة التنفيذ${end ? ` (تنتهي ${end})` : ''} ولا قرار إنهاء معتمد · قاعدة 1`,
    }
  }
  if (!stopped) {
    const open = payRequests.filter((r) => r.projectId === projectId && r.state !== 'paid' && r.state !== 'closed')
    if (open.length) return { ok: false, why: `${open.length === 1 ? 'طلب صرف مفتوح' : `${open.length} طلبات صرف مفتوحة`} · قاعدة 2` }
    const due = unsettledSlots(projectId).due
    if (due.length) return { ok: false, why: `دفعة مستحقة لم تُصرف ولم تُسوَّ (الدفعة ${due.map((s) => s.no).join(' و')}) · قاعدة 2` }
  }
  return { ok: true, why: basis === 'stopped' ? 'مؤهَّل · قرار إيقاف معتمد' : basis === 'complete' ? 'مؤهَّل · اكتملت الأنشطة' : 'مؤهَّل · انتهت مدة التنفيذ', basis }
}

/** 10.9.7 · what the entity holds unused · paid minus the invoices verified */
export const savingsOf = (c: CloseRow): number => {
  const v = c.finance?.verified
  if (v === null || v === undefined) return 0
  return Math.max(0, paidToDate(c.projectId) - v)
}

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
  return [
    { key: 'pay', label: 'لا طلب صرف مفتوح', ok: !open.length, say: open.length ? `${open.length} طلب صرف مفتوح` : 'لا طلب صرف مفتوح' },
    { key: 'slots', label: 'الدفعات مصروفة أو مسوّاة', ok: isStopped(c.projectId) || !left.length, say: left.length && !isStopped(c.projectId) ? `الدفعة ${left.map((s) => s.no).join(' و')} لم تُصرف ولم تُسوَّ` : 'كل الدفعات مصروفة أو مسوّاة' },
    { key: 'finance', label: 'التقرير المالي الختامي', ok: Boolean(f && f.lines.every((l) => l.spent !== null)), say: f && f.lines.every((l) => l.spent !== null) ? 'مكتمل' : 'لم يكتمل التقرير المالي' },
    { key: 'invoices', label: 'التحقق من الفواتير', ok: f?.verified !== null && f?.verified !== undefined, say: f?.verified != null ? `تحقّق المشرف من ${nf.format(f.verified)}` : 'لم يتحقّق المشرف من الفواتير' },
    { key: 'recovery', label: 'الوفر مسترد أو بقرار', ok: sav === 0 ? recSettled(c.recovery) : Boolean(c.recovery) && recSettled(c.recovery), say: sav === 0 && !c.recovery ? 'لا وفر' : !c.recovery ? `وفر ${nf.format(sav)} بلا مطالبة` : c.recovery.state === 'decided' ? 'قرار نهائي معتمد' : c.recovery.state === 'done' ? 'اكتمل الاسترداد' : `متبقٍّ ${nf.format(recLeft(c.recovery))}` },
    { key: 'feedback', label: 'تقييم الجهة للمؤسسة', ok: Boolean(c.feedback), say: c.feedback ? 'أرسلته الجهة' : 'لم تُرسله الجهة بعد' },
  ]
}

/* ── Distress cases ── */

export const CASES: CaseRow[] = []
export const caseById = (id: string) => CASES.find((c) => c.id === id)
export const casesOfProject = (projectId: string) => CASES.filter((c) => c.projectId === projectId)
export const CASE_KIND_SAY: Record<CaseKind, string> = { stop: 'إيقاف المشروع', reduce: 'تخفيض القيمة', increase: 'زيادة القيمة' }
export const CASE_STAGE_SAY: Record<CaseStage, string> = {
  draft: 'عند مشرف المنح', settle: 'تسوية المصروف', manager: 'عند مدير المنح', recover: 'استرداد قبل الرفع', ceo: 'عند الرئيس التنفيذي',
  approved: 'معتمد · استرداد جارٍ', returned: 'مُعاد بملاحظات', rejected: 'مرفوض', closed: 'مقفل',
}
export const CASE_STAGE_TONE: Record<CaseStage, 'mute' | 'warn' | 'teal' | 'ok' | 'no' | 'ret'> = {
  draft: 'mute', settle: 'warn', manager: 'teal', recover: 'warn', ceo: 'teal', approved: 'warn', returned: 'ret', rejected: 'no', closed: 'ok',
}

/** 10.9.1 – 10.9.4 · where a stop lands · the phase decides the settlement it needs */
export function stopPhase(projectId: string): { key: 'before' | 'partial' | 'after' | 'future'; say: string; needsSettle: boolean } {
  const paid = paidToDate(projectId)
  const granted = grantOf(projectId)
  const s = unsettledSlots(projectId)
  if (paid <= 0) return { key: 'before', say: 'قبل أي صرف · يُحرَّر الحجز كاملًا ولا استرداد', needsSettle: false }
  if (paid >= granted) return { key: 'after', say: 'بعد تحويل كامل المنحة · تقرير تنفيذ وفواتير ثم استرداد غير المصروف', needsSettle: true }
  if (s.future.length) return { key: 'future', say: 'بعد صرف جزء ومع دفعات مستقبلية · تُوقف الدفعات القادمة ويُسوّى المصروف', needsSettle: true }
  return { key: 'partial', say: 'بعد صرف جزء · تقرير تنفيذ وفواتير واعتماد المصروف الفعلي', needsSettle: true }
}

export interface CaseAction { act: CaseAct; label: string; kind: 'btn-p' | 'btn-2' | 'btn-d'; needsNote?: boolean }
export type CaseAct = 'submit' | 'approve' | 'return' | 'reject' | 'close'
export function caseActions(c: CaseRow, role: RoleKey, asEntity = false): CaseAction[] {
  if (asEntity) return []
  if ((c.stage === 'draft' || c.stage === 'returned') && role === 'supervisor') return [{ act: 'submit', label: c.stage === 'returned' ? 'أعد الرفع لمدير المنح' : 'ارفع لمدير المنح', kind: 'btn-p' }]
  if (c.stage === 'manager' && role === 'grants-manager') return [
    { act: 'approve', label: 'وافق وارفعه للرئيس التنفيذي', kind: 'btn-p' },
    { act: 'return', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true },
  ]
  /* Re-audit 7 Oct · 10.9.3 · 10.9.5 · the money comes back before the case goes up */
  if (c.stage === 'recover' && role === 'grants-manager') return recSettled(c.recovery)
    ? [{ act: 'approve', label: 'اكتمل الاسترداد · ارفعه للرئيس التنفيذي', kind: 'btn-p' }]
    : []
  if (c.stage === 'ceo' && role === 'ceo') return [
    { act: 'approve', label: 'اعتماد القرار', kind: 'btn-p' },
    { act: 'return', label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'رفض', kind: 'btn-d', needsNote: true },
  ]
  if (c.stage === 'approved' && role === 'ceo' && recSettled(c.recovery)) return [{ act: 'close', label: 'اعتماد إقفال الحالة', kind: 'btn-p' }]
  return []
}

export function caseStops(c: CaseRow, act: CaseAct): string[] {
  if (act === 'return' || act === 'reject') return []
  const out: string[] = []
  if (c.kind === 'stop' && c.stage !== 'draft' && c.stage !== 'returned' && stopPhase(c.projectId).needsSettle && c.settlement?.actual == null) out.push('لم يُعتمد المصروف الفعلي بعد تقرير الجهة وفواتيرها · 10.9.3')
  if (c.kind === 'stop' && (c.stage === 'draft' || c.stage === 'returned') && c.paid > 0 && c.settlement?.actual == null) out.push('اعتمد المصروف الفعلي بعد تقرير الجهة وفواتيرها أولًا · 10.9.3')
  if (c.kind === 'reduce' && !c.annex) out.push('ارفع ملحق الاتفاقية · 10.9.5')
  if (c.kind === 'increase' && act === 'approve' && c.stage === 'ceo') {
    const i = resizeIssue(c.projectId, c.newAmount ?? 0)
    if (i) out.push(i)
  }
  if (act === 'close' && !recSettled(c.recovery)) out.push('لم يكتمل الاسترداد ولا قرار نهائي بشأنه · 10.9.8')
  if (act === 'approve' && c.stage === 'recover' && !recSettled(c.recovery)) out.push('لم يكتمل استرداد الفرق ولا قرار نهائي بشأنه · 10.9.3 · 10.9.5')
  return out
}

/* ── Live state ── */

const FIN_SPLIT: { label: string; share: number }[] = [
  { label: 'تكاليف التنفيذ المباشرة', share: 0.75 },
  { label: 'التشغيل والإدارة', share: 0.25 },
]
const financeFor = (c: CloseRow): CloseFinance => {
  const g = grantOf(c.projectId)
  const spent = c.report.budget
  return {
    lines: FIN_SPLIT.map((x, i) => ({
      label: x.label,
      approved: i === FIN_SPLIT.length - 1 ? g - Math.round(g * FIN_SPLIT[0]!.share) : Math.round(g * x.share),
      spent: spent === null ? null : i === FIN_SPLIT.length - 1 ? spent - Math.round(spent * FIN_SPLIT[0]!.share) : Math.round(spent * x.share),
    })),
    settlements: '',
    verified: null,
  }
}

const PAST_SUPERVISOR: CloseStage[] = ['comms', 'manager', 'executive', 'reportDone', 'evalDraft', 'evalManager', 'evalExecutive', 'closed']
const FEEDBACK_SEEDED: CloseStage[] = ['evalManager', 'closed']

/* ── Operations ── */

type ReportPatch = Partial<Pick<FinalReport, 'beneficiaries' | 'budget' | 'days' | 'outcomes' | 'risks'>> & { finance?: Pick<CloseFinance, 'lines' | 'settlements'> }
type RecOwner = { kind: 'close' | 'case'; id: string }
type Op = { at: string; by: string } & (
  | { op: 'open'; id: string; projectId: string; basis: NonNullable<CloseRow['basis']> }
  | { op: 'save'; id: string; patch: ReportPatch }
  | { op: 'doc'; id: string; key: string; file?: string }
  | { op: 'link'; id: string; label: string; url: string }
  | { op: 'send'; id: string }
  | { op: 'act'; id: string; act: 'approve' | 'return'; note: string; file?: string }
  | { op: 'verify'; id: string; amount: number; note: string }
  | { op: 'evalStart'; id: string }
  | { op: 'evalSave'; id: string; evaluation: ProjectEval }
  | { op: 'evalSend'; id: string }
  | { op: 'evalAct'; id: string; act: 'approve' | 'return'; note: string }
  | { op: 'feedback'; id: string; feedback: Omit<EntityFeedback, 'at' | 'by'> }
  | { op: 'rules'; rules: CloseRules }
  | { op: 'recOpen'; owner: RecOwner; rec: Omit<Recovery, 'receipts' | 'claims' | 'escalations' | 'released' | 'state'> }
  | { op: 'recReceipt'; owner: RecOwner; receipt: RecoveryReceipt }
  | { op: 'recFail'; owner: RecOwner; text: string; file?: string }
  | { op: 'recEscalate'; owner: RecOwner; step: string; text: string }
  | { op: 'recDecide'; owner: RecOwner; kind: NonNullable<Recovery['decision']>['kind']; text: string }
  | { op: 'caseCreate'; row: Pick<CaseRow, 'id' | 'projectId' | 'kind' | 'reason' | 'newAmount' | 'annex' | 'extra'> }
  | { op: 'caseDoc'; id: string; key: 'report' | 'invoices' | 'annex'; file: string }
  | { op: 'caseSettle'; id: string; actual: number }
  | { op: 'caseAct'; id: string; act: CaseAct; note: string }
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
  p.statusGroup = meta.group
  p.stageLimit = meta.limit
  p.hoursInStage = 0
}

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
        report: { beneficiaries: null, budget: null, days: null, outcomes: '', risks: '', docs: [], links: [] },
        evaluation: null, versions: [{ no: 1, at: day(o.at), by: o.by, say: 'طلب التقرير الختامي' }], evalVersions: [],
        audit: [], mediaRequired: true, owner, openedAt: day(o.at), hoursInStage: 0, basis: o.basis, evalAudit: [], snapshots: [],
      }
      c.finance = financeFor(c)
      closeRows.push(c)
      log(c, o.by, `إنشاء طلب التقرير الختامي · ${o.basis === 'stopped' ? 'بقرار إيقاف' : o.basis === 'complete' ? 'اكتملت الأنشطة' : 'انتهت مدة التنفيذ'} · وأُبلغت الجهة بالمتطلبات`, o.at)
      setProjectStage(p.id, 'طلب التقرير الختامي')
      notify([p.entityName], 'طلب التقرير الختامي لمشروعك', p.name, `${ROUTES.closing(c.id)}?as=entity`)
      return
    }
    case 'save': {
      const c = closeById(o.id)
      if (!c || (c.stage !== 'draft' && c.stage !== 'returned')) return
      const { finance, ...rest } = o.patch
      Object.assign(c.report, rest)
      if (finance) c.finance = { ...(c.finance ?? financeFor(c)), ...structuredClone(finance) }
      log(c, o.by, 'حفظ بيانات التقرير الختامي', o.at)
      return
    }
    case 'doc': {
      const c = closeById(o.id)
      if (!c || c.stage === 'closed' || c.report.docs.includes(o.key)) return
      c.report.docs.push(o.key)
      if (o.file) c.report.files = { ...c.report.files, [o.key]: o.file }
      log(c, o.by, `إرفاق ${CLOSE_DOCS.find((d) => d.key === o.key)?.label ?? o.key}${o.file ? ` · ${o.file}` : ''}`, o.at)
      return
    }
    case 'link': {
      const c = closeById(o.id)
      if (!c || c.stage === 'closed') return
      c.report.links.push({ label: o.label, url: o.url })
      log(c, o.by, 'إضافة رابط تخزين سحابي', o.at)
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
      setProjectStage(c.projectId, 'اعتماد التقرير الختامي')
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
        snapshot(c, 'report', o.by, o.at, `قبل الإعادة من ${closeStageLabel(from)}`)
        move(c, 'returned')
        c.returnedTo = 'draft'
        c.note = note
        c.versions.push({ no: c.versions.length + 1, at: day(o.at), by: o.by, say: `إعادة من ${closeStageLabel(from)}` })
        log(c, o.by, `إعادة بملاحظات · إصدار ${c.versions.length}`, o.at)
        setProjectStage(c.projectId, 'رفع التقرير الختامي')
        notify([c.entityName], 'التقرير الختامي مُعاد للاستكمال', c.projectName, `${ROUTES.closing(c.id)}?as=entity`)
        return
      }
      const next: Partial<Record<CloseStage, CloseStage>> = {
        supervisor: needsComms(c) ? 'comms' : 'manager', comms: 'manager', manager: 'executive', executive: 'reportDone',
      }
      const to = next[c.stage]
      if (!to) return
      if (c.stage === 'comms') log(c, o.by, `اعتماد الاتصال المؤسسي لمتطلبات النشر الإعلامي${o.file ? ` · ${o.file}` : ''}`, o.at)
      c.note = undefined
      move(c, to)
      log(c, o.by, to === 'reportDone' ? 'اعتماد التقرير الختامي · إقفال الدورة الأولى' : `اعتماد · إحالة إلى ${closeStageLabel(to)}`, o.at)
      if (to === 'reportDone') {
        setProjectStage(c.projectId, 'تقييم المشروع')
        notify([c.owner], 'اعتُمد التقرير الختامي · ابدأ التقييم', c.projectName, ROUTES.closing(c.id))
        notify([c.entityName], 'اعتُمد تقريرك الختامي · قيّم تجربتك مع المؤسسة', c.projectName, `${ROUTES.closing(c.id)}?as=entity`)
      } else if (to === 'comms') notify([roleByKey('comms').title], 'تقرير ختامي بانتظار مراجعة النشر', c.projectName, ROUTES.closing(c.id))
      else if (to === 'manager') notify([MGR()], 'تقرير ختامي بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
      else if (to === 'executive') notify([CEO()], 'تقرير ختامي بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
      return
    }
    case 'verify': {
      const c = closeById(o.id)
      if (!c || c.stage === 'closed') return
      c.finance = { ...(c.finance ?? financeFor(c)), verified: o.amount, verifiedBy: o.by, verifiedAt: day(o.at) }
      log(c, o.by, `التحقق من الفواتير بمبلغ ${nf.format(o.amount)}${o.note ? ` · ${o.note}` : ''}`, o.at)
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
      if (c.stage === 'evalManager') {
        move(c, 'evalExecutive')
        c.note = undefined
        elog(c, o.by, 'اعتماد التقييم · إحالة إلى المدير التنفيذي', o.at)
        notify([CEO()], 'تقييم مشروع بانتظار اعتمادك', c.projectName, ROUTES.closing(c.id))
        return
      }
      if (c.stage !== 'evalExecutive' || requirementsOf(c).some((x) => !x.ok)) return
      move(c, 'closed')
      c.note = undefined
      c.closedAt = day(o.at)
      elog(c, o.by, 'اعتماد التقييم', o.at)
      log(c, o.by, 'الإغلاق النهائي · المشروع «مكتمل» وأُرشف ملفه', o.at)
      setProjectStage(c.projectId, 'مشروع مكتمل')
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
        if (pid && p && p.statusGroup !== 'متعثر' && p.statusGroup !== 'مكتمل') { setProjectStage(pid, 'مشروع متعثر'); ownerLog(o.owner, 'النظام', 'حُوّلت حالة المشروع إلى «مشروع متعثر» لتعذّر الاسترداد', o.at) }
      }
      return
    }
    case 'recEscalate': {
      const r = recOf(o.owner)
      if (!r || r.state !== 'failed') return
      r.escalations.push({ at: day(o.at), by: o.by, step: o.step, text: o.text })
      ownerLog(o.owner, o.by, `تصعيد نظامي · ${o.step}`, o.at)
      return
    }
    case 'recDecide': {
      const r = recOf(o.owner)
      if (!r || r.state !== 'failed') return
      r.decision = { at: day(o.at), by: o.by, text: o.text, kind: o.kind }
      r.state = 'decided'
      ownerLog(o.owner, o.by, `قرار نهائي بشأن الرصيد غير المسترد (${nf.format(recLeft(r))}) · ${DECISION_SAY[o.kind]}`, o.at)
      return
    }
    case 'caseCreate': {
      if (caseById(o.row.id)) return
      const p = projectOf(o.row.projectId)
      if (!p) return
      const c: CaseRow = {
        ...structuredClone(o.row), projectName: p.name, entityId: p.entityId, entityName: p.entityName, stage: 'draft',
        openedBy: o.by, openedAt: day(o.at), granted: grantOf(p.id), paid: paidToDate(p.id), log: [],
      }
      if (c.kind === 'stop' && c.paid > 0) {
        c.settlement = { actual: null }
        c.stage = 'settle'
      }
      CASES.push(c)
      clog(c, o.by, `فتح ${CASE_KIND_SAY[c.kind]} · ${c.reason}`, o.at)
      if (c.stage === 'settle') {
        clog(c, 'النظام', 'طُلب من الجهة تقرير التنفيذ والفواتير لتسوية المصروف', o.at)
        notify([p.entityName], 'مطلوب تقرير تنفيذ وفواتير لتسوية المصروف', p.name, `${ROUTES.distress(c.id)}?as=entity`)
      }
      return
    }
    case 'caseDoc': {
      const c = caseById(o.id)
      if (!c || c.stage === 'closed' || c.stage === 'rejected') return
      if (o.key === 'annex') c.annex = o.file
      else c.settlement = { ...(c.settlement ?? { actual: null }), [o.key]: o.file }
      clog(c, o.by, o.key === 'annex' ? `إرفاق ملحق الاتفاقية · ${o.file}` : `${o.key === 'report' ? 'رفعت الجهة تقرير التنفيذ' : 'رفعت الجهة الفواتير'} · ${o.file}`, o.at)
      return
    }
    case 'caseSettle': {
      const c = caseById(o.id)
      if (!c || c.stage !== 'settle' || !c.settlement?.report || !c.settlement.invoices) return
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
          if (!note || (c.stage !== 'manager' && c.stage !== 'ceo')) return
          c.note = note
          c.returnedTo = c.stage === 'ceo' ? 'manager' : 'draft'
          c.stage = c.stage === 'ceo' ? 'manager' : 'returned'
          clog(c, o.by, `إعادة بملاحظات إلى ${c.stage === 'manager' ? 'مدير المنح' : 'مشرف المنح'}`, o.at)
          return
        case 'reject':
          if (!note || c.stage !== 'ceo') return
          c.note = note
          c.stage = 'rejected'
          c.decidedAt = day(o.at)
          clog(c, o.by, 'رفض الرئيس التنفيذي القرار', o.at)
          return
        case 'approve':
          /* Re-audit 7 Oct · 10.9.3 · 10.9.5 · a stop or a cut that leaves money with the entity asks
             for it back first · the case goes to the executive once it's back or decided */
          if (c.stage === 'manager' && dueOf(c) > 0 && !c.recovery) {
            const due = dueOf(c)
            const reason = c.kind === 'stop' ? 'الرصيد غير المستخدم بعد اعتماد المصروف الفعلي' : 'فرق التخفيض عمّا صُرف'
            c.stage = 'recover'
            c.note = undefined
            c.recovery = { id: `RC-${c.id}`, source: c.kind === 'stop' ? 'stop' : 'reduce', due, reason, openedAt: day(o.at), openedBy: o.by, receipts: [], claims: [], escalations: [], released: 0, state: 'open' }
            clog(c, o.by, `موافقة مدير المنح · مطالبة الجهة بإعادة ${nf.format(due)} قبل الرفع للرئيس التنفيذي`, o.at)
            notify([c.entityName], `مطالبة بإعادة ${nf.format(due)}`, c.projectName, `${ROUTES.distress(c.id)}?as=entity`)
            return
          }
          if (c.stage === 'recover') {
            if (!recSettled(c.recovery)) return
            c.stage = 'ceo'
            clog(c, o.by, 'اكتمل الاسترداد أو صدر قرار بشأنه · رفع للرئيس التنفيذي', o.at)
            notify([CEO()], `${CASE_KIND_SAY[c.kind]} بانتظار اعتمادك`, c.projectName, ROUTES.distress(c.id))
            return
          }
          if (c.stage === 'manager') {
            c.stage = 'ceo'
            c.note = undefined
            clog(c, o.by, 'موافقة مدير المنح · رفع للرئيس التنفيذي', o.at)
            notify([CEO()], `${CASE_KIND_SAY[c.kind]} بانتظار اعتمادك`, c.projectName, ROUTES.distress(c.id))
            return
          }
          if (c.stage !== 'ceo') return
          c.decidedAt = day(o.at)
          clog(c, o.by, 'اعتماد الرئيس التنفيذي', o.at)
          applyCase(c, o.by, o.at)
          return
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
  if (c.kind === 'stop') return Math.max(0, c.paid - (c.settlement?.actual ?? c.paid))
  if (c.kind === 'reduce') return Math.max(0, c.paid - (c.newAmount ?? c.granted))
  return 0
}

/** The CEO approved · the project changes now, not before (10.9.1 – 10.9.6) */
function applyCase(c: CaseRow, by: string, at: string) {
  const p = projectOf(c.projectId)
  if (!p) return
  let due = 0
  let reason = ''
  if (c.kind === 'stop') {
    if (live) stopProjectPayments(c.projectId, c.reason, by)
    setProjectStage(c.projectId, 'مشروع موقوف')
    if (live) releaseSavings(c.projectId, by, 'إيقاف المشروع · تحرير المحجوز غير المصروف')
    due = Math.max(0, c.paid - (c.settlement?.actual ?? c.paid))
    reason = 'الرصيد غير المستخدم بعد اعتماد المصروف الفعلي'
    clog(c, 'النظام', 'أُوقف المشروع وطلبات صرفه ودفعاته القادمة، وحُرّر المحجوز غير المصروف إلى مخصص المجال', at)
  } else {
    const to = c.newAmount ?? c.granted
    p.amountGranted = to
    /* Re-audit 7 Oct · the agreement's value follows, by its annex */
    if (live) annexValue(c.projectId, to, c.id, by, c.reason, c.annex)
    if (c.kind === 'reduce') {
      if (live) {
        resizeLink(c.projectId, Math.max(to, c.paid), c.id, by, c.reason)
        adjustSchedule(c.projectId, { cut: c.granted - to }, by)
      }
      due = Math.max(0, c.paid - to)
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
  notify([c.entityName], `${CASE_KIND_SAY[c.kind]} · اعتمد الرئيس التنفيذي القرار`, c.projectName, `${ROUTES.distress(c.id)}?as=entity`)
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); live = true; apply(o); save(); emit() }

/* ── Seed · the fixture's records take their finance, feedback and separate evaluation log ── */

function seed() {
  for (const c of closeRows) {
    c.finance ??= financeFor(c)
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
}
hydrate()

setOpenGate(openGate)
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
  const id = `CL-${2050 + closeRows.length}`
  run({ op: 'open', id, projectId, basis: g.basis, by, at: now() })
  return { id, errors: [] }
}
export const saveReport = (id: string, patch: ReportPatch, by: string) => run({ op: 'save', id, patch, by, at: now() })
export const attachDoc = (id: string, key: string, by: string, file?: string) => run({ op: 'doc', id, key, file, by, at: now() })
export function addLink(id: string, label: string, url: string, by: string): string[] {
  if (!/^https?:\/\//.test(url.trim())) return ['الرابط غير صالح']
  run({ op: 'link', id, label: label.trim() || 'رابط تخزين سحابي', url: url.trim(), by, at: now() })
  return []
}
export function sendClosingReport(id: string, by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  const m = reportBlockers(c)
  if (m.length) return [`ينقص: ${m[0]} · قاعدة 3`]
  run({ op: 'send', id, by, at: now() })
  return []
}

export interface CloseAct { kind: 'report' | 'eval' | 'start' | 'evalSend'; act: 'approve' | 'return' | 'start' | 'send'; label: string; btn: 'btn-p' | 'btn-2'; needsNote?: boolean; needsFile?: string; gated?: boolean; why: string }

/** Each role's exits on a closing · the returns say where they go (10.2.13 · 10.2.19 · 10.2.20) */
export function closeActions(c: CloseRow, role: RoleKey): CloseAct[] {
  const back = 'إعادة للجهة بملاحظات'
  if (c.stage === 'supervisor' && role === 'supervisor') return [
    { kind: 'report', act: 'approve', label: 'اعتماد التقرير وإحالته', btn: 'btn-p', gated: true, why: 'خطوة 7 · مراجعة مشرف المنح ثم الاتصال المؤسسي أو مدير المنح' },
    { kind: 'report', act: 'return', label: back, btn: 'btn-2', needsNote: true, why: 'قاعدة 19 · تعود الإعادة إلى الجهة وتُنشئ إصدارًا جديدًا' },
  ]
  /* Re-audit 7 Oct · corporate communications reviews in its own seat (10.2.12 · 10.2.13) */
  if (c.stage === 'comms' && role === 'comms') return [
    { kind: 'report', act: 'approve', label: 'اعتماد متطلبات النشر', btn: 'btn-p', why: 'قاعدة 9 · مراجعة النشر الإعلامي متى كانت مطلوبة' },
    { kind: 'report', act: 'return', label: 'إعادة للمشرف بملاحظات النشر', btn: 'btn-2', needsNote: true, why: '10.2.13 · تعود ملاحظات النشر إلى مشرف المنح' },
  ]
  if (c.stage === 'manager' && role === 'grants-manager') return [
    { kind: 'report', act: 'approve', label: 'اعتماد التقرير وإحالته للتنفيذي', btn: 'btn-p', gated: true, why: 'خطوة 11 · اعتماد مدير المنح ثم المدير التنفيذي' },
    { kind: 'report', act: 'return', label: back, btn: 'btn-2', needsNote: true, why: 'قاعدة 19 · كل إعادة تُنشئ إصدارًا جديدًا' },
  ]
  if (c.stage === 'executive' && role === 'ceo') return [
    { kind: 'report', act: 'approve', label: 'اعتماد التقرير الختامي', btn: 'btn-p', gated: true, why: 'قاعدة 6 · اعتماد المدير التنفيذي يفتح التقييم' },
    { kind: 'report', act: 'return', label: back, btn: 'btn-2', needsNote: true, why: 'تعود الإعادة إلى الجهة كاتبة التقرير' },
  ]
  if (c.stage === 'reportDone' && role === 'supervisor') return [
    { kind: 'start', act: 'start', label: 'ابدأ تقييم المشروع', btn: 'btn-p', why: 'قاعدة 6 · يبدأ التقييم بعد اعتماد المدير التنفيذي' },
  ]
  if (c.stage === 'evalDraft' && role === 'supervisor') return [
    { kind: 'evalSend', act: 'send', label: 'إرسال التقييم لمدير المنح', btn: 'btn-p', gated: true, why: 'قاعدة 17 · دورة اعتماد مستقلّة بسجلّ منفصل' },
  ]
  if (c.stage === 'evalManager' && role === 'grants-manager') return [
    { kind: 'eval', act: 'approve', label: 'اعتماد التقييم وإحالته للتنفيذي', btn: 'btn-p', why: 'قاعدة 17 · محطتان في دورة التقييم' },
    { kind: 'eval', act: 'return', label: 'إعادة لمشرف المنح بملاحظات', btn: 'btn-2', needsNote: true, why: '10.2.19 · يُعدّ المشرف التقييم فتعود إليه' },
  ]
  if (c.stage === 'evalExecutive' && role === 'ceo') return [
    { kind: 'eval', act: 'approve', label: 'اعتماد التقييم والإغلاق النهائي', btn: 'btn-p', gated: true, why: 'قاعدة 8 و18 · الإغلاق يحتاج التقرير والتقييم والمتطلبات معًا' },
    { kind: 'eval', act: 'return', label: 'إعادة لمدير المنح بملاحظات', btn: 'btn-2', needsNote: true, why: '10.2.20 · يعيد المدير التنفيذي التقييم إلى مدير المنح' },
  ]
  return []
}

/** What stops a gated exit · named, the first one shown */
export function closeStops(c: CloseRow, a: CloseAct): string[] {
  if (a.act === 'return') return []
  if (a.kind === 'report' && a.gated) {
    const m = reportBlockers(c)
    if (m.length) return [`ينقص: ${m[0]} · قاعدة 4`]
    if (c.stage === 'supervisor' && c.finance?.verified == null) return ['تحقّق من الفواتير أولًا · 10.9.7']
  }
  if (a.kind === 'evalSend') { const e = evalBlockers(c); if (e.length) return [`${e[0]} · قاعدة 10`] }
  if (a.kind === 'eval' && c.stage === 'evalExecutive') return requirementsOf(c).filter((x) => !x.ok).map((x) => `${x.say} · قاعدة 18`)
  return []
}

export function actOnClosing(id: string, a: CloseAct, note: string, by: string, role: RoleKey, file?: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  if (!closeActions(c, role).some((x) => x.label === a.label)) return ['الإجراء غير متاح لك في هذه المرحلة']
  if (a.needsNote && !note.trim()) return ['اكتب سبب الإعادة أولًا']
  if (a.needsFile && !file) return [`ارفع ${a.needsFile} أولًا`]
  const stops = closeStops(c, a)
  if (stops.length) return stops
  if (a.kind === 'start') run({ op: 'evalStart', id, by, at: now() })
  else if (a.kind === 'evalSend') run({ op: 'evalSend', id, by, at: now() })
  else if (a.kind === 'eval') run({ op: 'evalAct', id, act: a.act as 'approve' | 'return', note, by, at: now() })
  else run({ op: 'act', id, act: a.act as 'approve' | 'return', note, file, by, at: now() })
  return []
}

export function verifyInvoices(id: string, amount: number, note: string, by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  if (!(amount >= 0)) return ['أدخل مبلغ الفواتير المتحقّق منها']
  if (amount > paidToDate(c.projectId) + (c.report.budget ?? 0)) return ['المبلغ أكبر من المصروف والميزانية الفعلية']
  run({ op: 'verify', id, amount, note, by, at: now() })
  return []
}
export const saveEvaluation = (id: string, evaluation: ProjectEval, by: string) => run({ op: 'evalSave', id, evaluation, by, at: now() })
export function sendFeedback(id: string, scores: Record<string, number>, comment: string, by: string): string[] {
  if (FEEDBACK_ITEMS.some((x) => !scores[x.key])) return ['قيّم كل البنود']
  run({ op: 'feedback', id, feedback: { scores, comment }, by, at: now() })
  return []
}
export const saveCloseRules = (rules: CloseRules, by: string) => run({ op: 'rules', rules, by, at: now() })

/* Recovery · shared by the closing's savings and the distress cases */

export function openSavingsRecovery(id: string, by: string): string[] {
  const c = closeById(id)
  if (!c) return ['الطلب غير موجود']
  const due = savingsOf(c)
  if (due <= 0) return ['لا وفر يستوجب الاسترداد']
  if (c.recovery) return ['المطالبة مفتوحة']
  run({ op: 'recOpen', owner: { kind: 'close', id }, rec: { id: `RC-${id}`, source: 'savings', due, reason: 'وفر المشروع · المصروف ناقص الفواتير المتحقّق منها', openedAt: day(now()), openedBy: by }, by, at: now() })
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
export function failRecovery(owner: RecOwner, text: string, by: string, file?: string): string[] {
  if (!text.trim()) return ['اذكر المطالبات المرسلة وردّ الجهة']
  run({ op: 'recFail', owner, text: text.trim(), file, by, at: now() })
  return []
}
export const ESCALATION_STEPS = ['إنذار رسمي', 'مطالبة عبر الإدارة القانونية', 'إحالة إلى الجهة المختصة']
export function escalateRecovery(owner: RecOwner, step: string, text: string, by: string): string[] {
  if (!step) return ['اختر خطوة التصعيد']
  run({ op: 'recEscalate', owner, step, text: text.trim(), by, at: now() })
  return []
}
export function decideRecovery(owner: RecOwner, kind: NonNullable<Recovery['decision']>['kind'], text: string, by: string, role: RoleKey): string[] {
  if (role !== 'ceo') return ['القرار النهائي للرئيس التنفيذي']
  if (!text.trim()) return ['اكتب نص القرار']
  run({ op: 'recDecide', owner, kind, text: text.trim(), by, at: now() })
  return []
}

/* Distress cases */

export const nextCaseId = () => `TS-${3001 + CASES.length}`
export function createCase(v: { projectId: string; kind: CaseKind; reason: string; newAmount?: number; annex?: string; extra?: { amount: number; dueAt: string } }, by: string): { id?: string; errors: string[] } {
  const p = projectOf(v.projectId)
  if (!p) return { errors: ['المشروع غير موجود'] }
  if (!v.reason.trim()) return { errors: ['اكتب سبب القرار'] }
  if (casesOfProject(v.projectId).some((c) => !['closed', 'rejected'].includes(c.stage))) return { errors: ['للمشروع حالة تعثّر مفتوحة'] }
  if (!['في التشغيل', 'متعثر'].includes(p.statusGroup) || p.stage === 'مشروع موقوف') return { errors: ['يُتّخذ القرار على مشروع معتمد تحت التنفيذ'] }
  const g = grantOf(v.projectId)
  const paid = paidToDate(v.projectId)
  if (v.kind === 'reduce') {
    if (!v.newAmount || v.newAmount >= g) return { errors: ['القيمة الجديدة أقل من الحالية في التخفيض'] }
    if (!v.annex) return { errors: ['ارفع ملحق الاتفاقية · 10.9.5'] }
  }
  if (v.kind === 'increase') {
    if (!v.newAmount || v.newAmount <= g) return { errors: ['القيمة الجديدة أكبر من الحالية في الزيادة'] }
    const i = resizeIssue(v.projectId, v.newAmount)
    if (i) return { errors: [i] }
  }
  const id = nextCaseId()
  run({ op: 'caseCreate', row: { id, projectId: v.projectId, kind: v.kind, reason: v.reason.trim(), newAmount: v.newAmount, annex: v.annex, extra: v.extra }, by, at: now() })
  void paid
  return { id, errors: [] }
}
export const attachCaseDoc = (id: string, key: 'report' | 'invoices' | 'annex', file: string, by: string) => run({ op: 'caseDoc', id, key, file, by, at: now() })
export function settleCase(id: string, actual: number, by: string): string[] {
  const c = caseById(id)
  if (!c) return ['الحالة غير موجودة']
  if (!c.settlement?.report || !c.settlement.invoices) return ['لم ترفع الجهة تقرير التنفيذ والفواتير بعد']
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
  return []
}

export const resetClosing = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }
