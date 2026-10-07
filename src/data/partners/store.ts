import { useSyncExternalStore } from 'react'
import { projectRows, portfolioRows } from '@/data/mock/projects'
import { entityById, entityRows } from '@/data/mock/entities'
import {
  EHSAN_SEED, portfolios as PF_SEED, seedPayRef, type Portfolio as PfSeed, type PortfolioStage,
} from '@/data/mock/implementer'
import { stageMeta } from '@/data/mock/taxonomy'
import { finalizeHold, linkIssues, linkOf, linkProject, recordPaid, releaseSavings, unlinkProject, isPaidRef, useBudget } from '@/data/budget/store'
import { openPlanFor } from '@/data/plans/store'
import { planOfProject, planDone } from '@/data/mock/plans'
import { setEhsanGate } from '@/data/payments/store'
import { roleByKey, type RoleKey } from '@/data/roles'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'

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

const TODAY = '2026-10-06'
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

export interface EhSlot { no: number; amount: number; dueAt: string }
export interface EhOp { at: string; by: string; kind: string; ref?: string; note: string }
export interface EhClose { report: string; evidence: string[]; by: string; at: string; closedAt?: string; closedBy?: string }
const SCHEDULES = new Map<string, EhSlot[]>()
const EH_OPS = new Map<string, EhOp[]>()
const EH_CLOSE = new Map<string, EhClose>()
export const ehScheduleOf = (projectId: string) => SCHEDULES.get(projectId) ?? []
export const ehOpsOf = (projectId: string) => EH_OPS.get(projectId) ?? []
export const ehCloseOf = (projectId: string) => EH_CLOSE.get(projectId)
export const viaEhsan = (projectId: string) => projectRows.find((p) => p.id === projectId)?.platform === 'منصة إحسان'
export const ehsanProjects = () => projectRows.filter((p) => p.platform === 'منصة إحسان' && !p.archived)
const projectOf = (id: string) => projectRows.find((p) => p.id === id)
const approvedProject = (id: string) => {
  const p = projectOf(id)
  return Boolean(p && p.supportStatus === 'معتمد' && p.statusGroup !== 'في الدراسة')
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
  if (!approvedProject(projectId)) return { plan: false, schedule: false, pay: false, why: 'بعد الاعتماد النهائي للمشروع (11.2.8)' }
  const plan = planOfProject(projectId)
  const sched = ehScheduleOf(projectId).length > 0
  if (!plan) return { plan: true, schedule: false, pay: false, why: 'أعدّ خطة المشروع أولًا (11.2.16)' }
  if (!sched) return { plan: true, schedule: true, pay: false, why: 'أدخل جدول الدفعات (11.2.16)' }
  return { plan: true, schedule: true, pay: true, why: '' }
}

/** The independent project's closing checks (11.2.15 · 11.2.21) */
export function ehCloseChecks(projectId: string): { key: string; label: string; ok: boolean }[] {
  const m = ehMoney(projectId)
  const plan = planOfProject(projectId)
  const c = ehCloseOf(projectId)
  return [
    { key: 'pays', label: 'كل الدفعات المسجلة مؤكدة من الإدارة المالية', ok: m.review === 0 && m.recorded > 0 },
    { key: 'cap', label: 'الدفعات في حدود قيمة المشروع', ok: m.recorded <= m.value },
    { key: 'plan', label: 'خطة المشروع منجزة', ok: Boolean(plan && planDone(plan) >= 100) },
    { key: 'report', label: 'التقرير الختامي والشواهد مسجّلة', ok: Boolean(c?.report.trim() && c.evidence.length) },
  ]
}

/* ── Portfolios (BPD-013) ── */

export interface SubExec { status: 'لم يبدأ' | 'تحت التنفيذ' | 'مكتمل'; progress: number; reached: number; results: string; evidence: string[]; at: string; by: string }
export interface SubProject {
  id: string
  name: string
  region: string
  city?: string
  amount: number
  beneficiaries: number
  outputs: string
  files: string[]
  state: 'draft' | 'pending' | 'approved' | 'rejected'
  reason?: string
  reqId?: string
  addedBy: string
  addedAt: string
  decidedBy?: string
  decidedAt?: string
  exec?: SubExec
}
export interface PfPhase { id: string; name: string; from: string; to: string; cost: number }
export interface PfLog { at: string; by: string; what: string }
export interface PfRequest { id: string; no: number; amount: number; at: string; by: string; state: 'finance' | 'paid' | 'returned'; ref?: string; note?: string }
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
  plan: { state: 'none' | 'draft' | 'review' | 'approved' | 'returned'; phases: PfPhase[]; note?: string; by?: string }
  agreement: { state: 'none' | 'draft' | 'manager' | 'partner' | 'signed' | 'returned'; file?: string; note?: string }
  schedule: EhSlot[]
  requests: PfRequest[]
  approvals: PfApproval[]
  items: SubProject[]
  close: { report: string; evidence: string[]; by?: string; at?: string; closedBy?: string; closedAt?: string }
  log: PfLog[]
}
export const PORTFOLIOS: PortfolioRec[] = []
export const pfById = (id: string) => PORTFOLIOS.find((p) => p.id === id)
export const pfOfEntity = (entityId: string) => PORTFOLIOS.filter((p) => p.entityId === entityId)

export const PF_STAGE_SAY: Record<PortfolioStage, string> = {
  draft: 'مسودة', supervisor: 'دراسة · مشرف المنح', manager: 'بانتظار مدير المنح', ceo: 'بانتظار الرئيس التنفيذي',
  returned: 'معادة للاستكمال', approved: 'معتمدة · تحت التنفيذ', rejected: 'مرفوضة', closing: 'بانتظار الإغلاق', closed: 'مغلقة',
}
export const PF_STAGE_TONE: Record<PortfolioStage, 'mute' | 'warn' | 'teal' | 'ok' | 'no' | 'ret'> = {
  draft: 'mute', supervisor: 'warn', manager: 'warn', ceo: 'warn', returned: 'ret', approved: 'teal', rejected: 'no', closing: 'warn', closed: 'ok',
}
export const SUB_STATE_SAY: Record<SubProject['state'], string> = { draft: 'مسودة', pending: 'قيد الاعتماد', approved: 'معتمد', rejected: 'مرفوض' }
export const SUB_STATE_TONE: Record<SubProject['state'], 'mute' | 'warn' | 'ok' | 'no'> = { draft: 'mute', pending: 'warn', approved: 'ok', rejected: 'no' }

/** The portfolio's financial position · the ceiling counts the approved and the pending (13.4.6 · 13.2.18 · 13.4.33) */
export function pfMoney(pf: PortfolioRec) {
  const approved = pf.items.filter((x) => x.state === 'approved').reduce((s, x) => s + x.amount, 0)
  const pending = pf.items.filter((x) => x.state === 'pending').reduce((s, x) => s + x.amount, 0)
  const pays = EHSAN_PAYS.filter((p) => p.target.kind !== 'project' && p.target.pfId === pf.id)
  const reqPaid = pf.requests.filter((r) => r.state === 'paid').reduce((s, r) => s + r.amount, 0)
  const reqOpen = pf.requests.filter((r) => r.state === 'finance').reduce((s, r) => s + r.amount, 0)
  const recorded = sumOf(pays, live) + reqPaid + reqOpen
  const confirmed = sumOf(pays, (x) => x.state === 'confirmed') + reqPaid
  return {
    total: pf.total, approved, pending, available: pf.total - approved - pending,
    recorded, confirmed, spent: confirmed, remaining: pf.total - confirmed,
    approvedCount: pf.items.filter((x) => x.state === 'approved').length,
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
  if (pf.stage !== 'approved') return { ok: false, why: pf.stage === 'closed' ? 'المحفظة مغلقة' : pf.stage === 'closing' ? 'المحفظة في الإغلاق · لا مشاريع فرعية جديدة' : 'بعد الاعتماد النهائي للمحفظة (13.2.5)' }
  if (pf.plan.state !== 'approved') return { ok: false, why: 'بعد اعتماد خطة المحفظة (13.2.10)' }
  if (pf.agreement.state !== 'signed') return { ok: false, why: 'بعد توقيع اتفاقية المحفظة (13.2.10)' }
  return { ok: true, why: '' }
}

export interface SubDraft { name: string; region: string; city?: string; amount: number; beneficiaries: number; outputs: string; files: string[] }
/** Before a sub-project is saved or sent · complete, valid, not a duplicate (13.2.13 · 13.4.12 · 13.4.13) */
export function subIssues(pf: PortfolioRec, d: SubDraft, except?: string): string[] {
  const out: string[] = []
  if (!d.name.trim()) out.push('اسم المشروع الفرعي')
  if (!d.region) out.push('المنطقة')
  if (!(d.amount > 0)) out.push('قيمة المشروع الفرعي أكبر من صفر')
  if (!(d.beneficiaries > 0)) out.push('عدد المستفيدين المستهدف')
  if (!d.outputs.trim()) out.push('المخرجات المستهدفة')
  if (!d.files.length) out.push('مرفق واحد على الأقل (الدراسة أو العرض)')
  const key = (n: string, r: string) => `${n.trim().replace(/\s+/g, ' ')}|${r}`
  if (pf.items.some((x) => x.id !== except && x.state !== 'rejected' && key(x.name, x.region) === key(d.name, d.region))) out.push('مشروع بالاسم والمنطقة نفسيهما مسجّل في المحفظة')
  return out
}

/** The ceiling · what's approved and pending plus what's sent may not exceed the portfolio (13.2.14 · 13.4.14 · 13.4.15) */
export function capIssue(pf: PortfolioRec, ids: string[]): string {
  const m = pfMoney(pf)
  const ask = pf.items.filter((x) => ids.includes(x.id) && x.state === 'draft').reduce((s, x) => s + x.amount, 0)
  return ask > m.available ? `المطلوب ${nf.format(ask)} يتجاوز الرصيد المتاح في المحفظة ${nf.format(Math.max(0, m.available))} · خفّض القيمة أو أرسل جزءًا منها` : ''
}

/** Execution indicators · counts, states, progress, reach and the regions (13.2.22 · 13.4.28) */
export function pfIndicators(pf: PortfolioRec) {
  const ap = pf.items.filter((x) => x.state === 'approved')
  const by = (s: SubExec['status']) => ap.filter((x) => (x.exec?.status ?? 'لم يبدأ') === s).length
  const progress = ap.length ? Math.round(ap.reduce((s, x) => s + (x.exec?.progress ?? 0), 0) / ap.length) : 0
  const regions = new Map<string, number>()
  for (const x of ap) regions.set(x.region, (regions.get(x.region) ?? 0) + 1)
  return {
    count: ap.length, done: by('مكتمل'), running: by('تحت التنفيذ'), waiting: by('لم يبدأ'), progress,
    target: ap.reduce((s, x) => s + x.beneficiaries, 0), reached: ap.reduce((s, x) => s + (x.exec?.reached ?? 0), 0),
    regions: [...regions].sort((a, b) => b[1] - a[1]),
  }
}

/** Closing requirements on every sub-project (13.2.29 · 13.4.35) */
export function pfCloseChecks(pf: PortfolioRec): { key: string; label: string; ok: boolean }[] {
  const ap = pf.items.filter((x) => x.state === 'approved')
  const m = pfMoney(pf)
  return [
    { key: 'subs', label: 'لا مشاريع فرعية قيد الاعتماد', ok: !pf.items.some((x) => x.state === 'pending' || x.state === 'draft') },
    { key: 'done', label: 'كل المشاريع الفرعية المعتمدة مكتملة', ok: ap.length > 0 && ap.every((x) => x.exec?.status === 'مكتمل') },
    { key: 'results', label: 'النتائج الفعلية مسجّلة لكل مشروع', ok: ap.length > 0 && ap.every((x) => Boolean(x.exec?.results.trim()) && (x.exec?.reached ?? 0) > 0) },
    { key: 'pays', label: 'كل الدفعات مؤكدة ماليًّا', ok: m.recorded === m.confirmed },
    { key: 'cap', label: 'الدفعات في حدود قيمة المحفظة', ok: m.confirmed <= pf.total },
    { key: 'report', label: 'التقرير الختامي والشواهد مرفوعة من الشريك', ok: Boolean(pf.close.report.trim() && pf.close.evidence.length) },
  ]
}

/* ── Who acts · the usual path and financial authority (13.2.6) ── */

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
  if (pf.stage === 'manager' && role === 'grants-manager') return [
    { act: 'approve', label: 'موافقة ورفع للرئيس التنفيذي', kind: 'btn-p' },
    { act: 'return', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true },
  ]
  if (pf.stage === 'ceo' && role === 'ceo') return [
    { act: 'approve', label: 'اعتماد نهائي', kind: 'btn-p' },
    { act: 'return', label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true },
    { act: 'reject', label: 'رفض', kind: 'btn-d', needsNote: true },
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
  if (act === 'recommend') {
    const sh = shares ?? pf.shares
    if (!sh?.length) out.push('اختر بند الميزانية لحجز قيمة المحفظة (13.2.7)')
    else if (sh.reduce((s, x) => s + x.amount, 0) !== pf.total) out.push(`مجموع الحجز يساوي قيمة المحفظة ${nf.format(pf.total)}`)
  }
  return out
}

/* ── Operations ── */

type Op = { by: string; at: string } & (
  | { op: 'partnerReq'; entityId: string; name: string; allowed: PType[]; platform: boolean }
  | { op: 'partnerDecide'; entityId: string; outcome: 'approve' | 'reject'; note: string }
  | { op: 'partnerTypes'; entityId: string; allowed: PType[] }
  | { op: 'route'; projectId: string; platform: boolean; type: PType }
  | { op: 'pfCreate'; pf: Pick<PortfolioRec, 'id' | 'name' | 'entityId' | 'total' | 'track' | 'field' | 'goals' | 'summary' | 'files' | 'origin' | 'channel'>; send: boolean; fromProject?: string }
  | { op: 'pfAct'; id: string; act: PfAct; note: string; shares?: PortfolioRec['shares'] }
  | { op: 'pfPlan'; id: string; phases: PfPhase[] }
  | { op: 'pfPlanAct'; id: string; act: 'send' | 'approve' | 'return'; note: string }
  | { op: 'pfAgr'; id: string; act: 'draft' | 'send' | 'approve' | 'return' | 'sign'; note: string; file?: string }
  | { op: 'pfSchedule'; id: string; slots: EhSlot[] }
  | { op: 'subAdd'; pfId: string; sub: Omit<SubProject, 'state' | 'addedBy' | 'addedAt'> }
  | { op: 'subDrop'; pfId: string; subId: string }
  | { op: 'subSend'; pfId: string; reqId: string; subIds: string[] }
  | { op: 'subDecide'; pfId: string; decisions: { subId: string; outcome: 'approve' | 'reject'; reason?: string }[] }
  | { op: 'subExec'; pfId: string; subId: string; exec: Omit<SubExec, 'at' | 'by'> }
  | { op: 'pay'; pay: Omit<EhsanPay, 'state' | 'by' | 'at'> }
  | { op: 'payAct'; id: string; act: 'confirm' | 'return'; note: string }
  | { op: 'pfReq'; pfId: string; req: Pick<PfRequest, 'id' | 'no' | 'amount'> }
  | { op: 'pfReqAct'; pfId: string; reqId: string; act: 'pay' | 'return'; ref?: string; note: string }
  | { op: 'pfReport'; id: string; report: string; evidence: string[] }
  | { op: 'pfClose'; id: string }
  | { op: 'ehSchedule'; projectId: string; slots: EhSlot[] }
  | { op: 'ehOp'; projectId: string; kind: string; ref?: string; note: string }
  | { op: 'ehReport'; projectId: string; report: string; evidence: string[] }
  | { op: 'ehClose'; projectId: string }
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
  for (const t of to) PARTNER_NOTES.unshift({ id: `ptn-${PARTNER_NOTES.length + 1}`, to: t, title, context, at: TODAY, href })
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
    amountSpent: pfMoney(pf).spent, goal: `${pf.items.filter((x) => x.state === 'approved').length} مشاريع تحت المحفظة`,
    stage: PF_STAGE_SAY[pf.stage], statusGroup: pf.stage === 'closed' ? 'مكتمل' : pf.stage === 'rejected' ? 'معتذر عنه' : pf.stage === 'approved' || pf.stage === 'closing' ? 'في التشغيل' : 'في الدراسة',
    owner: pf.owner, submittedAt: pf.openedAt, track: pf.track, partnerType: 'محفظة',
  })
  if (!row) portfolioRows.push(base)
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
  const holder = p.target.kind === 'project' ? p.target.projectId : p.target.pfId
  if (linkOf(holder) && !isPaidRef(p.ref)) recordPaid(holder, p.amount, p.ref, by)
}

function apply(o: Op) {
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
      if (!p || p.statusGroup !== 'في الدراسة') return
      p.platform = o.platform ? 'منصة إحسان' : undefined
      p.partnerType = isStrategic(p.entityId) ? (o.type === 'portfolio' ? 'محفظة' : 'مستقل') : undefined
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'قرار التوجيه', note: o.platform ? 'يُوجَّه الدعم عبر منصة إحسان' : 'يُدعم مباشرة دون منصة الشريك' })
      return
    }
    case 'pfCreate': {
      if (pfById(o.pf.id)) return
      const pf: PortfolioRec = {
        ...o.pf, year: o.at.slice(0, 4), stage: o.send ? 'supervisor' : 'draft', owner: SUP, openedAt: day(o.at),
        plan: { state: 'none', phases: [] }, agreement: { state: 'none' }, schedule: [], requests: [], approvals: [], items: [],
        close: { report: '', evidence: [] }, log: [],
      }
      PORTFOLIOS.push(pf)
      plog(pf, o.by, o.pf.origin === 'partner' ? 'قدّم الشريك طلب المحفظة من البوابة' : 'أنشأ مشرف المنح المحفظة', o.at)
      if (o.fromProject) {
        const p = projectOf(o.fromProject)
        if (p) { p.archived = true; p.partnerType = 'محفظة'; plog(pf, o.by, `حُوِّل المشروع ${p.id} إلى محفظة أثناء الدراسة`, o.at) }
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
        if (pf.stage === 'manager') { pf.stage = 'ceo'; plog(pf, o.by, 'وافق مدير المنح ورفعها للرئيس التنفيذي', o.at); notify([CEO()], `اعتماد نهائي · ${pf.name}`, `${nf.format(pf.total)} ريال`, ROUTES.portfolio(pf.id)) }
        else if (pf.stage === 'ceo') {
          pf.stage = 'approved'
          if (liveRun && linkOf(pf.id)) finalizeHold(pf.id, o.by)
          plog(pf, o.by, 'اعتمدها الرئيس التنفيذي نهائيًّا · ثُبّت الحجز وفُعّلت إدارتها', o.at)
          notify([pf.owner, partnerName(pf.entityId)], `اعتُمدت المحفظة · ${pf.name}`, 'الخطوة التالية: الخطة والاتفاقية', ROUTES.portfolio(pf.id))
        }
      } else if (o.act === 'return') {
        const back: Partial<Record<PortfolioStage, PortfolioStage>> = { supervisor: 'returned', manager: 'supervisor', ceo: 'manager' }
        const to = back[pf.stage]
        if (!to || !o.note.trim()) return
        pf.note = o.note
        pf.stage = to
        plog(pf, o.by, `أعاد ${to === 'returned' ? 'المحفظة للاستكمال' : 'المحفظة'} · ${o.note}`, o.at)
        notify([to === 'returned' ? (pf.origin === 'partner' ? partnerName(pf.entityId) : pf.owner) : to === 'supervisor' ? pf.owner : MGR()], `أُعيدت المحفظة · ${pf.name}`, o.note, ROUTES.portfolio(pf.id))
      } else if (o.act === 'reject') {
        if (pf.stage !== 'supervisor' && pf.stage !== 'ceo') return
        pf.stage = 'rejected'
        pf.note = o.note
        if (liveRun && linkOf(pf.id)) unlinkProject(pf.id, o.by, 'رُفضت المحفظة')
        plog(pf, o.by, `رُفضت · ${o.note}`, o.at)
        notify([pf.owner, partnerName(pf.entityId)], `رُفضت المحفظة · ${pf.name}`, o.note, ROUTES.portfolio(pf.id))
      }
      listRow(pf)
      return
    }
    case 'pfPlan': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'approved' || pf.plan.state === 'review' || pf.plan.state === 'approved') return
      pf.plan.phases = o.phases
      pf.plan.state = 'draft'
      pf.plan.by = o.by
      return
    }
    case 'pfPlanAct': {
      const pf = pfById(o.id)
      if (!pf) return
      if (o.act === 'send' && (pf.plan.state === 'draft' || pf.plan.state === 'returned') && pf.plan.phases.length) {
        pf.plan.state = 'review'
        plog(pf, o.by, 'أُرسلت خطة المحفظة لمدير المنح', o.at)
        notify([MGR()], `اعتماد خطة محفظة · ${pf.name}`, `${pf.plan.phases.length} مراحل`, ROUTES.portfolio(pf.id))
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
      if (o.act === 'draft' && (a.state === 'none' || a.state === 'returned')) a.state = 'draft'
      else if (o.act === 'send' && a.state === 'draft') { a.state = 'manager'; notify([MGR()], `اعتماد اتفاقية محفظة · ${pf.name}`, partnerName(pf.entityId), ROUTES.portfolio(pf.id)) }
      else if (o.act === 'approve' && a.state === 'manager') { a.state = 'partner'; notify([partnerName(pf.entityId)], `اتفاقية للتوقيع · ${pf.name}`, 'وقّع الاتفاقية وارفعها', `${ROUTES.portfolio(pf.id)}?as=partner`) }
      else if (o.act === 'return' && a.state === 'manager' && o.note.trim()) { a.state = 'returned'; a.note = o.note }
      else if (o.act === 'sign' && a.state === 'partner' && o.file) { a.state = 'signed'; a.file = o.file; notify([pf.owner], `وُقّعت اتفاقية المحفظة · ${pf.name}`, 'يمكن تسجيل المشاريع الفرعية', ROUTES.portfolio(pf.id)) }
      else return
      plog(pf, o.by, { draft: 'أعدّ مسودة الاتفاقية', send: 'أرسل الاتفاقية لمدير المنح', approve: 'اعتمد مدير المنح الاتفاقية · أُرسلت للشريك', return: `أعاد الاتفاقية · ${o.note}`, sign: 'وقّع الشريك الاتفاقية ورفعها' }[o.act], o.at)
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
      pf.items.push({ ...o.sub, state: 'draft', addedBy: o.by, addedAt: day(o.at) })
      return
    }
    case 'subDrop': {
      const pf = pfById(o.pfId)
      if (!pf || pf.stage === 'closed') return
      pf.items = pf.items.filter((x) => !(x.id === o.subId && x.state === 'draft'))
      return
    }
    case 'subSend': {
      const pf = pfById(o.pfId)
      if (!pf || !subsGate(pf).ok || capIssue(pf, o.subIds)) return
      const list = pf.items.filter((x) => o.subIds.includes(x.id) && x.state === 'draft')
      if (!list.length) return
      for (const x of list) { x.state = 'pending'; x.reqId = o.reqId }
      pf.approvals.push({ id: o.reqId, subIds: list.map((x) => x.id), at: day(o.at), by: o.by })
      plog(pf, o.by, `أرسل طلب اعتماد ${list.length > 1 ? `${list.length} مشاريع فرعية` : `«${list[0].name}»`} · ${nf.format(list.reduce((s, x) => s + x.amount, 0))}`, o.at)
      notify([MGR()], `اعتماد مشاريع فرعية · ${pf.name}`, `${list.length} مشروع`, ROUTES.portfolio(pf.id))
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
        x.decidedBy = o.by
        x.decidedAt = day(o.at)
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
      if (!pf || !x || x.state !== 'approved' || pf.stage === 'closed') return
      x.exec = { ...o.exec, progress: Math.max(0, Math.min(100, o.exec.progress)), at: day(o.at), by: o.by }
      plog(pf, o.by, `حدّث تنفيذ «${x.name}» · ${o.exec.status} · ${o.exec.progress}%`, o.at)
      return
    }
    case 'pay': {
      /* Validated when recorded · a replay must not re-check the reference against the budget, which
         already holds it as paid once finance confirmed */
      if (EHSAN_PAYS.some((p) => p.id === o.pay.id)) return
      const p: EhsanPay = { ...o.pay, state: 'review', by: o.by, at: day(o.at) }
      EHSAN_PAYS.push(p)
      const t = p.target
      if (t.kind === 'project') (EH_OPS.get(t.projectId) ?? EH_OPS.set(t.projectId, []).get(t.projectId)!).push({ at: day(o.at), by: o.by, kind: 'دفعة عبر إحسان', ref: p.ref, note: `سُجّلت دفعة ${nf.format(p.amount)} للمراجعة المالية` })
      else { const pf = pfById(t.pfId); if (pf) plog(pf, o.by, `سجّل دفعة عبر إحسان ${nf.format(p.amount)} · ${p.ref}`, o.at) }
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
      if (pfReqIssue(pf, o.req.no, o.req.amount)) return
      pf.requests.push({ ...o.req, at: day(o.at), by: o.by, state: 'finance' })
      plog(pf, o.by, `طلب صرف الدفعة ${o.req.no} على مستوى المحفظة · ${nf.format(o.req.amount)}`, o.at)
      notify([FIN], `طلب صرف محفظة · ${pf.name}`, nf.format(o.req.amount), ROUTES.partnersTab('finance'))
      return
    }
    case 'pfReqAct': {
      const pf = pfById(o.pfId)
      const r = pf?.requests.find((x) => x.id === o.reqId)
      if (!pf || !r || r.state !== 'finance') return
      if (o.act === 'pay') {
        if (!o.ref?.trim()) return
        r.state = 'paid'
        r.ref = o.ref
        if (liveRun && linkOf(pf.id) && !isPaidRef(o.ref)) recordPaid(pf.id, r.amount, o.ref, o.by)
        plog(pf, o.by, `صرفت المالية الدفعة ${r.no} · ${o.ref}`, o.at)
      } else {
        if (!o.note.trim()) return
        r.state = 'returned'
        r.note = o.note
        plog(pf, o.by, `أعادت المالية طلب الدفعة ${r.no} · ${o.note}`, o.at)
      }
      listRow(pf)
      return
    }
    case 'pfReport': {
      const pf = pfById(o.id)
      if (!pf || (pf.stage !== 'approved' && pf.stage !== 'closing')) return
      pf.close.report = o.report
      pf.close.evidence = o.evidence
      pf.close.by = o.by
      pf.close.at = day(o.at)
      if (pf.close.report.trim() && pf.close.evidence.length) {
        pf.stage = 'closing'
        plog(pf, o.by, 'رفع الشريك التقرير الختامي والشواهد', o.at)
        notify([pf.owner], `تقرير ختامي للمحفظة · ${pf.name}`, 'تحقّق من المتطلبات وأغلقها', ROUTES.portfolio(pf.id))
      }
      listRow(pf)
      return
    }
    case 'pfClose': {
      const pf = pfById(o.id)
      if (!pf || pf.stage !== 'closing' || pfCloseChecks(pf).some((c) => !c.ok)) return
      pf.stage = 'closed'
      pf.close.closedBy = o.by
      pf.close.closedAt = day(o.at)
      if (liveRun && linkOf(pf.id)) releaseSavings(pf.id, o.by, 'أُغلقت المحفظة')
      plog(pf, o.by, 'أُغلقت المحفظة · حُفظت بياناتها وأُعيد الوفر لبنده', o.at)
      notify([partnerName(pf.entityId)], `أُغلقت المحفظة · ${pf.name}`, 'بياناتها محفوظة للقراءة', ROUTES.portfolio(pf.id))
      listRow(pf)
      return
    }
    case 'ehSchedule': {
      if (!approvedProject(o.projectId) || !planOfProject(o.projectId)) return
      const p = projectOf(o.projectId)!
      if (o.slots.reduce((s, x) => s + x.amount, 0) !== p.amountGranted) return
      SCHEDULES.set(o.projectId, o.slots)
      ;(EH_OPS.get(p.id) ?? EH_OPS.set(p.id, []).get(p.id)!).push({ at: day(o.at), by: o.by, kind: 'جدول الدفعات', note: `${o.slots.length} دفعات بمجموع ${nf.format(p.amountGranted)}` })
      return
    }
    case 'ehOp': {
      if (!viaEhsan(o.projectId) || !o.note.trim()) return
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: o.kind, ref: o.ref, note: o.note })
      return
    }
    case 'ehReport': {
      if (!viaEhsan(o.projectId) || !approvedProject(o.projectId)) return
      const c = EH_CLOSE.get(o.projectId)
      if (c?.closedAt) return
      EH_CLOSE.set(o.projectId, { report: o.report, evidence: o.evidence, by: o.by, at: day(o.at) })
      return
    }
    case 'ehClose': {
      const c = EH_CLOSE.get(o.projectId)
      if (!c || c.closedAt || ehCloseChecks(o.projectId).some((x) => !x.ok)) return
      c.closedAt = day(o.at)
      c.closedBy = o.by
      setStage(o.projectId, 'مشروع مكتمل')
      if (liveRun && linkOf(o.projectId)) releaseSavings(o.projectId, o.by, 'أُغلق المشروع عبر إحسان')
      ;(EH_OPS.get(o.projectId) ?? EH_OPS.set(o.projectId, []).get(o.projectId)!).push({ at: day(o.at), by: o.by, kind: 'الإغلاق', note: 'أُغلق المشروع وحُدّثت حالته · مكتمل' })
      return
    }
  }
}

/** Before a payment Ehsan executed is recorded · its documents, its reference, its ceiling (11.2.11 · 11.4.12 · 11.4.22 · 13.4.32) */
export function payIssues(p: Pick<EhsanPay, 'target' | 'amount' | 'ref' | 'paidAt' | 'docs'>): string[] {
  const out: string[] = []
  if (!(p.amount > 0)) out.push('مبلغ الدفعة')
  if (!p.ref.trim()) out.push('رقم العملية على منصة إحسان')
  if (!p.paidAt) out.push('تاريخ التنفيذ')
  if (!p.docs.length) out.push('إشعار التحويل أو مستند المنصة')
  if (p.ref.trim() && (EHSAN_PAYS.some((x) => x.ref.trim() === p.ref.trim() && x.state !== 'returned') || isPaidRef(p.ref.trim()))) out.push('العملية مسجّلة من قبل · لا تُسجَّل مرتين (11.4.23)')
  const t = p.target
  if (t.kind === 'project') {
    if (!viaEhsan(t.projectId)) out.push('المشروع غير موجّه عبر إحسان')
    const g = ehGate(t.projectId)
    if (!g.pay) out.push(g.why)
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
  if (pf.channel !== 'direct') return 'دفعات هذه المحفظة تنفّذها منصة إحسان وتُسجَّل لكل مشروع فرعي'
  const slot = pf.schedule.find((s) => s.no === no)
  if (!slot) return 'الدفعة غير موجودة في جدول دفعات المحفظة'
  if (pf.requests.some((r) => r.no === no && r.state !== 'returned')) return 'طُلبت هذه الدفعة من قبل'
  if (!(amount > 0) || amount > slot.amount) return `قيمة الطلب في حدود الدفعة ${nf.format(slot.amount)}`
  const m = pfMoney(pf)
  if (amount > pf.total - m.recorded) return 'تتجاوز المتبقي من قيمة المحفظة'
  return ''
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); liveRun = true; apply(o); save(); emit() }

/* ── Seed · the partners, the fixture's portfolios and the Ehsan project ── */

function fromSeed(s: PfSeed): PortfolioRec {
  const stage = s.stage ?? 'approved'
  const at = s.openedAt
  const pf: PortfolioRec = {
    id: s.id, name: s.name, entityId: s.entityId, total: s.total, year: s.year,
    track: s.track ?? 'المنح الانتشاري', field: s.field ?? 'الإغاثة', goals: s.goals ?? '', summary: s.goals ?? '',
    files: ['وثيقة المحفظة.pdf'], origin: s.origin ?? 'internal', channel: s.channel ?? 'ehsan', stage, owner: s.owner ?? SUP, openedAt: at,
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
    schedule: s.channel === 'direct' && stage === 'approved' ? [
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
        addedBy: partnerName(s.entityId), addedAt: at, decidedBy: state === 'approved' || state === 'rejected' ? 'عبدالله الدوسري' : undefined,
        exec: state === 'approved' ? { status: x.status, progress: x.progress ?? 0, reached: x.reached ?? 0, results: x.results ?? '', evidence: x.status === 'مكتمل' ? ['تقرير الإنجاز.pdf'] : [], at, by: partnerName(s.entityId) } : undefined,
      }
    }),
  }
  pf.log.push({ at, by: pf.owner, what: pf.origin === 'partner' ? 'قدّم الشريك طلب المحفظة من البوابة' : 'أنشأ مشرف المنح المحفظة' })
  if (stage === 'approved') pf.log.push({ at, by: CEO(), what: 'اعتمدها الرئيس التنفيذي نهائيًّا · ثُبّت الحجز' })
  if (pf.items.some((x) => x.state === 'pending')) pf.approvals.push({ id: `AR-${s.id.slice(-3)}-1`, subIds: pf.items.filter((x) => x.state === 'pending').map((x) => x.id), at: '2026-09-28', by: pf.owner })
  for (const x of s.items.filter((i) => i.spent > 0 && (i.state ?? 'approved') === 'approved')) {
    EHSAN_PAYS.push({
      id: `EP-${x.id}`, target: { kind: 'sub', pfId: s.id, subId: x.id }, amount: x.spent, ref: seedPayRef(s.id, x.id), paidAt: at,
      docs: ['إشعار منصة إحسان.pdf'], state: 'confirmed', by: pf.owner, at, reviewedBy: FIN,
    })
  }
  return pf
}

function seed() {
  const at = '2026-01-15'
  PROFILES.push(
    { entityId: '860', name: 'منصة إحسان', allowed: ['independent', 'portfolio'], platform: true, state: 'approved', requestedBy: SUP, at, decidedBy: 'عبدالله الدوسري' },
    { entityId: '861', name: 'المحافظ الخيرية', allowed: ['portfolio'], platform: false, state: 'approved', requestedBy: SUP, at, decidedBy: 'عبدالله الدوسري' },
  )
  /* A partner registered internally and still waiting for the grants manager (11.2.1 · 13.2.1) */
  const pending = entityRows.find((e) => e.id === '834')
  if (pending) PROFILES.push({ entityId: pending.id, name: pending.name, allowed: ['portfolio'], platform: false, state: 'review', requestedBy: SUP, at: '2026-09-30' })
  for (const s of PF_SEED) PORTFOLIOS.push(fromSeed(s))
  for (const e of EHSAN_SEED) {
    const p = projectOf(e.projectId)
    if (!p) continue
    SCHEDULES.set(p.id, [
      { no: 1, amount: 400_000, dueAt: '2026-06-15' },
      { no: 2, amount: 500_000, dueAt: '2026-10-15' },
      { no: 3, amount: p.amountGranted - 900_000, dueAt: '2027-02-15' },
    ])
    for (const x of e.paid) EHSAN_PAYS.push({ id: `EP-${x.ref}`, target: { kind: 'project', projectId: p.id }, amount: x.amount, ref: x.ref, paidAt: '2026-06-16', docs: ['إشعار منصة إحسان.pdf'], state: 'confirmed', by: SUP, at: '2026-06-16', reviewedBy: FIN })
    EH_OPS.set(p.id, [
      { at: '2026-03-18', by: SUP, kind: 'قرار التوجيه', note: 'يُوجَّه الدعم عبر منصة إحسان · مشروع مستقل' },
      { at: '2026-06-16', by: SUP, kind: 'دفعة عبر إحسان', ref: 'EH-21060-1', note: 'نفّذت المنصة الدفعة الأولى 400,000' },
      { at: '2026-08-20', by: SUP, kind: 'زيارة ميدانية', note: 'اكتمل ترميم 30 منزلًا من 90 · الجودة مطابقة' },
    ])
  }
}

function hydrate() {
  seed()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
  liveRun = true
  for (const pf of PORTFOLIOS) listRow(pf)
}
hydrate()

/* The payments module routes an Ehsan project's money here, not to the entity's requests (11.2.17) */
setEhsanGate((projectId) => (viaEhsan(projectId) ? 'دفعاته تنفّذها منصة إحسان وتُسجَّل من صفحة المشروع' : ''))

/* ── Actions ── */

export const requestPartner = (entityId: string, name: string, allowed: PType[], platform: boolean, by: string) =>
  run({ op: 'partnerReq', entityId, name, allowed, platform, by, at: now() })
export const decidePartner = (entityId: string, outcome: 'approve' | 'reject', note: string, by: string) =>
  run({ op: 'partnerDecide', entityId, outcome, note, by, at: now() })
export const setPartnerTypes = (entityId: string, allowed: PType[], by: string) => run({ op: 'partnerTypes', entityId, allowed, by, at: now() })

/** The routing decision on a project under study · the platform and the type (11.2.4 · 11.2.5) */
export function routeProject(projectId: string, platform: boolean, type: PType, by: string): string[] {
  const p = projectOf(projectId)
  if (!p) return ['المشروع غير موجود']
  if (p.statusGroup !== 'في الدراسة') return ['يُحدَّد التوجيه والنوع قبل الاعتماد فقط']
  if (isStrategic(p.entityId) && !typeAllowed(p.entityId, type)) return [`«${PTYPE_SAY[type]}» غير مسموح لهذا الشريك (11.2.2)`]
  if (platform && !isStrategic('860')) return ['منصة إحسان غير معتمدة شريكًا استراتيجيًّا']
  run({ op: 'route', projectId, platform, type, by, at: now() })
  return []
}

export const nextPortfolioId = () => `PF-2026-${String(PORTFOLIOS.length + 1).padStart(3, '0')}`
export function createPortfolio(v: Omit<Extract<Op, { op: 'pfCreate' }>['pf'], 'id'>, send: boolean, by: string, fromProject?: string): { id?: string; errors: string[] } {
  const errors: string[] = []
  if (!isStrategic(v.entityId)) errors.push('اختر شريكًا استراتيجيًّا معتمدًا (13.4.1)')
  else if (!typeAllowed(v.entityId, 'portfolio')) errors.push('المحفظة غير مسموحة لهذا الشريك (11.2.2)')
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
  run({ op: 'pfAct', id, act, note, shares, by, at: now() })
  return []
}
export const savePfPlan = (id: string, phases: PfPhase[], by: string) => run({ op: 'pfPlan', id, phases, by, at: now() })
export function actOnPfPlan(id: string, act: 'send' | 'approve' | 'return', note: string, by: string): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  if (act === 'send') {
    const cost = pf.plan.phases.reduce((s, x) => s + x.cost, 0)
    if (!pf.plan.phases.length) return ['أضف مرحلة واحدة على الأقل']
    if (pf.plan.phases.some((x) => !x.name.trim() || !x.from || !x.to || x.to < x.from)) return ['أكمل اسم كل مرحلة وتاريخيها']
    if (cost !== pf.total) return [`مجموع تكلفة المراحل ${nf.format(cost)} يساوي قيمة المحفظة ${nf.format(pf.total)}`]
  }
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  run({ op: 'pfPlanAct', id, act, note, by, at: now() })
  return []
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

let subSeq = 0
export function addSub(pfId: string, d: SubDraft, by: string): { id?: string; errors: string[] } {
  const pf = pfById(pfId)
  if (!pf) return { errors: ['المحفظة غير موجودة'] }
  const g = subsGate(pf)
  if (!g.ok) return { errors: [g.why] }
  const bad = subIssues(pf, d)
  if (bad.length) return { errors: bad }
  const id = `${pf.id.slice(-3)}-S${pf.items.length + 1 + subSeq++}`
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
export function decideSubs(pfId: string, decisions: { subId: string; outcome: 'approve' | 'reject'; reason?: string }[], by: string): string[] {
  if (!decisions.length) return ['اختر مشروعًا واحدًا على الأقل']
  if (decisions.some((d) => d.outcome === 'reject' && !d.reason?.trim())) return ['سبب الرفض إلزامي لكل مشروع مرفوض (13.2.16)']
  run({ op: 'subDecide', pfId, decisions, by, at: now() })
  return []
}
export function updateSubExec(pfId: string, subId: string, exec: Omit<SubExec, 'at' | 'by'>, by: string): string[] {
  if (exec.status === 'مكتمل' && (!exec.results.trim() || !(exec.reached > 0) || !exec.evidence.length)) return ['المكتمل يحتاج النتائج والمستفيدين الفعليين والشواهد (13.2.21)']
  run({ op: 'subExec', pfId, subId, exec, by, at: now() })
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
export function requestPfPay(pfId: string, no: number, amount: number, by: string): string[] {
  const pf = pfById(pfId)
  if (!pf) return ['المحفظة غير موجودة']
  const why = pfReqIssue(pf, no, amount)
  if (why) return [why]
  run({ op: 'pfReq', pfId, req: { id: `PR-${pf.id.slice(-3)}-${pf.requests.length + 1}`, no, amount }, by, at: now() })
  return []
}
export function actOnPfReq(pfId: string, reqId: string, act: 'pay' | 'return', note: string, by: string, ref?: string): string[] {
  if (act === 'pay' && !ref?.trim()) return ['رقم أمر التحويل']
  if (act === 'return' && !note.trim()) return ['اكتب سبب الإعادة']
  run({ op: 'pfReqAct', pfId, reqId, act, ref, note, by, at: now() })
  return []
}
export function submitPfReport(id: string, report: string, evidence: string[], by: string): string[] {
  if (!report.trim()) return ['نص التقرير الختامي']
  if (!evidence.length) return ['شاهد واحد على الأقل']
  run({ op: 'pfReport', id, report, evidence, by, at: now() })
  return []
}
export function closePortfolio(id: string, by: string): string[] {
  const pf = pfById(id)
  if (!pf) return ['المحفظة غير موجودة']
  if (pf.stage !== 'closing') return ['بعد رفع التقرير الختامي']
  const miss = pfCloseChecks(pf).filter((c) => !c.ok)
  if (miss.length) return miss.map((c) => c.label)
  run({ op: 'pfClose', id, by, at: now() })
  return []
}

export function saveEhSchedule(projectId: string, slots: EhSlot[], by: string): string[] {
  const p = projectOf(projectId)
  if (!p) return ['المشروع غير موجود']
  const g = ehGate(projectId)
  if (!g.schedule) return [g.why]
  if (slots.some((x) => !(x.amount > 0) || !x.dueAt)) return ['أكمل قيمة كل دفعة وتاريخها']
  const sum = slots.reduce((s, x) => s + x.amount, 0)
  if (sum !== p.amountGranted) return [`مجموع الجدول ${nf.format(sum)} يساوي قيمة المشروع ${nf.format(p.amountGranted)}`]
  run({ op: 'ehSchedule', projectId, slots, by, at: now() })
  return []
}
export function addEhOp(projectId: string, kind: string, note: string, by: string, ref?: string): string[] {
  if (!note.trim()) return ['اكتب ما جرى']
  run({ op: 'ehOp', projectId, kind, note, ref, by, at: now() })
  return []
}
/** The supervisor opens the plan of an Ehsan project · there's no entity on the portal to draft it (11.2.16) */
export function openEhsanPlan(projectId: string, by: string): string[] {
  const g = ehGate(projectId)
  if (!g.plan) return [g.why]
  if (planOfProject(projectId)) return []
  openPlanFor(projectId, 'supervisor', 'مشروع عبر منصة إحسان · يعدّ المشرف الخطة', by)
  return []
}
export function saveEhReport(projectId: string, report: string, evidence: string[], by: string): string[] {
  if (!report.trim()) return ['نص التقرير الختامي']
  if (!evidence.length) return ['شاهد واحد على الأقل']
  run({ op: 'ehReport', projectId, report, evidence, by, at: now() })
  return []
}
export function closeEhsanProject(projectId: string, by: string): string[] {
  const miss = ehCloseChecks(projectId).filter((x) => !x.ok)
  if (miss.length) return miss.map((x) => x.label)
  run({ op: 'ehClose', projectId, by, at: now() })
  return []
}

export const resetPartners = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }

/* ── Finance desk · what waits for the financial review (11.2.13 · 11.2.20 · 13.2.24) ── */
export function financeQueue() {
  return {
    pays: EHSAN_PAYS.filter((p) => p.state === 'review'),
    requests: PORTFOLIOS.flatMap((pf) => pf.requests.filter((r) => r.state === 'finance').map((r) => ({ pf, r }))),
  }
}

/* ── The reports' view · Ehsan projects and the sub-projects, each marked (11.4.26 · 13.2.27) ── */
export interface PartnerReportRow { key: string; kind: 'مشروع عبر إحسان' | 'محفظة' | 'مشروع فرعي'; name: string; partner: string; region: string; value: number; paid: number; state: string; href: string }
export function partnerReport(): PartnerReportRow[] {
  const out: PartnerReportRow[] = []
  for (const p of ehsanProjects()) {
    const m = ehMoney(p.id)
    out.push({ key: p.id, kind: 'مشروع عبر إحسان', name: p.name, partner: p.entityName, region: p.region, value: m.value, paid: m.confirmed, state: p.stage, href: ROUTES.project(p.id) })
  }
  for (const pf of PORTFOLIOS) {
    const m = pfMoney(pf)
    out.push({ key: pf.id, kind: 'محفظة', name: pf.name, partner: partnerName(pf.entityId), region: 'متعدد', value: pf.total, paid: m.confirmed, state: PF_STAGE_SAY[pf.stage], href: ROUTES.portfolio(pf.id) })
    for (const s of pf.items.filter((x) => x.state === 'approved')) {
      out.push({ key: `${pf.id}/${s.id}`, kind: 'مشروع فرعي', name: s.name, partner: pf.name, region: s.region, value: s.amount, paid: subMoney(pf, s).confirmed, state: s.exec?.status ?? 'لم يبدأ', href: `${ROUTES.portfolio(pf.id)}#${s.id}` })
    }
  }
  return out
}
