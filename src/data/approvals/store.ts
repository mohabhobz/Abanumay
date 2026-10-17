import { typeFloorBlock } from '@/data/shared/decisions'
import { setStudyNoteGate } from '@/data/status'
import { useSyncExternalStore } from 'react'
import type { DecisionAction, ProjectRow } from '@/types/domain'
import type { LogEvent, LogField } from '@/data/mock/log'
import { SOURCE_OF } from '@/data/mock/log'
import { projectRows } from '@/data/mock/projects'
import { EXT_PRE_STAGE, stageMeta } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { capOf, type ApprovalRow } from '@/data/approval'
import { ACTS_FOR, HOLDER_LABEL, nextOf, type Holder } from '@/data/holders'
import type { RoleKey } from '@/data/roles'
import { TODAY, fundingBlock, goalFunded } from '@/data/intake/cycle'
import { dayOf, stampNow, timeOf } from '@/data/clock'
import { flowOf, intakeLog, orgOutputsOf, outputLine, setOwnHold, setSupervisorAmountHook } from '@/data/intake/flow'
import { nextSeq, replayTogether, type Stamped } from '@/data/opclock'
import { expiredMandatory } from '@/data/entities/store'
import {
  hasFunding, linkOf, unlinkProject, usableLines, directionById, docOf, fundingIssues, finalizeHold, holdAtRecommendation,
  releaseToPlanned, resizeIssue, resizeLink, lineBalances,
} from '@/data/budget/store'
import { docTitle } from '@/data/mock/budgetTree'
import { BUDGET_RULES } from '@/data/budget/rules'
import { nf } from '@/lib/format'
import { setConditionGate } from '@/data/mock/agreementNew'
import { ROUTES } from '@/app/routes'
import { APPROVAL_RULES } from './rules'
import { reasonSay } from '@/data/intake/reasons'

/* The approval path (BPD-004 – BPD-007) · the actions above the supervisor's recommendation.

   The grants manager reviews and recommends (or decides finally where settings allow), the executive
   director approves within his cap or refers up, the executive committee and the board decide in a
   recorded session with every member's vote and the minutes, and once the path is complete the
   supervisor confirms the notes and conditions were met before the project reads «معتمد». Each
   decision carries its note, lands on the project's timeline with who and when, moves the project's
   seat and status, and keeps, finalises or releases the budget hold exactly as the document says.

   Same model as intake, entities and the budget: an ordered list of operations kept in the browser
   and replayed at load; in production each operation is a POST. */

export type Level = Exclude<Holder, 'supervisor' | 'confirm'>
type Verdict =
  | 'recommend-approve' | 'recommend-reject' | 'final-approve' | 'final-reject' | 'return' | 'resubmit'
  | 'approve' | 'refer' | 'reject' | 'confirm' | 'amend'

export const VERDICT_SAY: Record<Verdict, string> = {
  'recommend-approve': 'توصية بالموافقة',
  'recommend-reject': 'توصية بالرفض',
  'final-approve': 'اعتماد نهائي',
  'final-reject': 'رفض نهائي',
  return: 'إعادة',
  resubmit: 'إعادة إرسال بعد الاستكمال',
  approve: 'اعتماد',
  refer: 'إحالة للمستوى التالي',
  reject: 'رفض نهائي',
  confirm: 'تأكيد الاعتماد',
  amend: 'تعديل قرار بإجراء رسمي',
}

export interface Rec {
  level: Holder
  verdict: Verdict
  note: string
  by: string
  at: string
  needsPlan?: boolean
  /** A return's destination */
  target?: Holder | 'consultant'
}

/** v3 · 4.2.5 · 5.4.11 · 6.4.5 · 7.4.7 · one change of the support amount · who, at which level, from
    what to what and why · shown to the levels before and kept in the project's history */
export interface AmountChange { level: Holder; by: string; at: string; from: number; to: number; reason: string; session?: string }
/** v3 · 6.4.3 · 7.4.5 · a body's decision recorded as issued whose money the balance didn't cover ·
    not a financial approval and the hold doesn't turn final until the cover is found */
export interface Coverage { level: 'committee' | 'board'; amount: number; short: string; by: string; at: string; sessionId: string; note: string; done?: { by: string; at: string } }
/** v3 · 5.2.3 · 6.2.2 · 7.2.3 · the presentation file made when the project reaches a level · its
    financial position is the one at the moment it was made */
export interface FinLine { label: string; budget: string; share: number; allocated: number; finalApproved: number; initial: number; accounting: number; available: number }
export interface FinPosition { amount: number; stage: string; lines: FinLine[]; maxRaise: number; afterDecision: number; accountingAfter: number }
export interface Brief {
  id: string
  level: Holder
  at: string
  time: string
  by: string
  amount: number
  fin: FinPosition
  recs: { level: Holder; verdict: string; note: string; by: string; at: string }[]
  orgOutputs: string[]
  entityOutputs: string[]
  conditions: string[]
  amounts: AmountChange[]
}

export interface Condition { id: string; text: string; when: 'agreement' | 'firstPay'; by: string; at: string; met?: { by: string; at: string } }
export interface MandNote { id: string; text: string; level: Holder; by: string; at: string; resolved?: { by: string; at: string; reply: string } }
export interface Opinion { id: string; dept: 'finance' | 'legal' | 'other'; ask: string; by: string; at: string; answer?: string; answeredBy?: string; answeredAt?: string }
export interface Official { id: string; text: string; by: string; at: string }

export const DEPT_SAY: Record<Opinion['dept'], string> = { finance: 'الإدارة المالية', legal: 'الإدارة القانونية', other: 'إدارة مختصة' }

export type Vote = 'approve' | 'reject' | 'return' | 'abstain'
export const VOTE_SAY: Record<Vote, string> = { approve: 'موافقة', reject: 'رفض', return: 'إعادة', abstain: 'امتناع' }
export type Outcome = 'approve' | 'refer' | 'return' | 'reject'
export const OUTCOME_SAY: Record<Outcome, string> = { approve: 'اعتماد', refer: 'إحالة لمجلس الأمناء', return: 'إعادة', reject: 'رفض' }

export interface SessionItem {
  projectId: string
  votes: Record<string, Vote>
  minutes?: string
  outcome?: Outcome
  target?: Holder
  note?: string
  /** v3 · 6.4.4 · 7.4.6 · the body's payment guidance · the detailed schedule is the agreement's ·
      a count only on a decision recorded before v3 */
  payPlan?: { count?: number; note: string }
  /** v3 · 6.4.3 · the decision was recorded as issued with its money uncovered */
  uncovered?: string
  /** v3 · 6.2.5 · votes the secretary entered for a member */
  proxied?: string[]
  decidedAt?: string
}
export interface Session {
  id: string
  body: 'committee' | 'board'
  title: string
  date: string
  members: string[]
  items: SessionItem[]
  state: 'planned' | 'closed'
  by: string
  closedAt?: string
}

export interface AppFlow {
  recs: Rec[]
  conditions: Condition[]
  notes: MandNote[]
  opinions: Opinion[]
  official: Official[]
  /** 5.2.10 · returned by the executive director · «بانتظار استكمال المراجعة» */
  awaitingReview?: { note: string; by: string; at: string }
  /** The hold's standing on the path · initial until the deciding level, final after (5.4.9 · 5.4.10) */
  hold: 'none' | 'initial' | 'final'
  /** The level that took the final decision, and when */
  decided?: { level: Level; at: string; by: string }
  needsPlan?: boolean
  /** v3 · the support amount's changes on the path, oldest first */
  amounts: AmountChange[]
  coverage?: Coverage
  briefs: Brief[]
  events: LogEvent[]
}

const FLOWS = new Map<string, AppFlow>()
export const SESSIONS: Session[] = []
export interface ApprovalNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const APPROVAL_NOTES: ApprovalNote[] = []

export const appFlowOf = (id: string): AppFlow => {
  let f = FLOWS.get(id)
  if (!f) { f = { recs: [], conditions: [], notes: [], opinions: [], official: [], hold: 'none', amounts: [], briefs: [], events: [] }; FLOWS.set(id, f) }
  return f
}
export const approvalEvents = (id: string): LogEvent[] => FLOWS.get(id)?.events ?? []
export const sessionById = (id: string): Session | undefined => SESSIONS.find((s) => s.id === id)
/** The payment mechanism the last body approved with the project · for its agreement's schedule */
export const payPlanOf = (projectId: string): SessionItem['payPlan'] =>
  [...SESSIONS].reverse().flatMap((s) => s.items).find((i) => i.projectId === projectId && i.outcome === 'approve' && i.payPlan)?.payPlan
export const sessionsOf = (projectId: string): Session[] => SESSIONS.filter((s) => s.items.some((i) => i.projectId === projectId))

const row = (id: string) => projectRows.find((p) => p.id === id)

/** The first change keeps where the path started · the supervisor's amount, else the request's */
const trailBase = (p: ProjectRow, f: AppFlow, start: number) => {
  if (f.amounts.length) return
  const st = flowOf(p.id).study
  f.amounts.push({ level: 'supervisor', by: st?.by ?? p.owner ?? '', at: st?.at ?? p.submittedAt, from: p.amountRequested, to: start, reason: st?.recommendation === 'approve' ? 'المبلغ الموصى به في الدراسة' : 'المبلغ المطلوب' })
}

/** v3 · the support amount on the path · the supervisor's recommendation, then each level's change ·
    the entity's requested amount until there is one */
export const supportAmount = (p: Pick<ProjectRow, 'amountSupport' | 'amountRequested'>): number => p.amountSupport ?? p.amountRequested

/** v3 · 5.4.8 · 5.2.3 · the project's financial position · each funding line's allocation, final
    approved, initial holds, accounting and available balances, the most the amount may rise and the
    balance the decision leaves */
export function finPosition(p: ProjectRow): FinPosition | undefined {
  const l = linkOf(p.id)
  if (!l) return undefined
  const lines: FinLine[] = l.shares.map((x) => {
    const d = docOf(x.docId)
    const n = d?.nodes.find((y) => y.id === x.nodeId)
    const b = d ? lineBalances(d, x.nodeId) : { allocated: 0, finalApproved: 0, initial: 0, accounting: 0, available: 0 }
    return { label: n?.label ?? x.nodeId, budget: d ? docTitle(d) : x.docId, share: x.amount, ...b }
  })
  const amount = supportAmount(p)
  const first = lines[0]
  /* An initial hold is already out of the available balance · a planned link isn't */
  const heldNow = l.stage === 'initial' || l.stage === 'final'
  const avail = lines.reduce((a, x) => a + x.available, 0)
  return {
    amount, stage: l.stage, lines,
    /* A planned link holds nothing yet · its own amount still has to come out of the line */
    maxRaise: Math.max(0, (first?.available ?? 0) - (heldNow ? 0 : l.amount)),
    afterDecision: heldNow ? avail - Math.max(0, amount - l.amount) : avail - amount,
    accountingAfter: lines.reduce((a, x) => a + x.accounting, 0) - (l.stage === 'final' ? 0 : amount),
  }
}
/* The running op's stamp · every date an action writes is its own time, replayed the same on reload */
let OP_AT: string | undefined
const opDay = () => dayOf(OP_AT ?? stampNow())
let seq = 0
const event = (id: string, e: { action: string; by: string; fields?: LogField[]; tone?: LogEvent['tone']; actor?: LogEvent['actor']; dept?: string; files?: string[]; at?: string }) => {
  const actor = e.actor ?? 'staff'
  appFlowOf(id).events.unshift({
    id: `ap-${id}-${seq++}`, action: e.action, dept: e.dept ?? 'اعتماد المشروع', by: e.by, actor,
    at: e.at ?? opDay(), time: timeOf(OP_AT), days: 0, hours: 0, limit: 900, fields: e.fields ?? [], files: e.files,
    tone: e.tone ?? 'mute', source: SOURCE_OF[actor],
  })
}
const notify = (to: string[], projectId: string, title: string, context: string, href = ROUTES.projectTab(projectId, 'approval')) => {
  for (const t of to) APPROVAL_NOTES.unshift({ id: `apn-${APPROVAL_NOTES.length + 1}`, to: t, title, context, at: opDay(), href })
}

/* v3 · 5.2.11 · 6.4.3 · the study's level reads the return and the pending cover */
setStudyNoteGate((id) => {
  const f = FLOWS.get(id)
  if (!f) return ''
  if (f.coverage && !f.coverage.done) return 'قرار صادر بانتظار التغطية المالية'
  if (f.awaitingReview && row(id)?.holder === 'manager') return 'أعاده المدير التنفيذي'
  return ''
})

/* v3 · 6.4.12 · the supervisor re-sent with a new study amount · the trail keeps it */
setSupervisorAmountHook((id, from, to, by, at) => {
  const p = row(id)
  if (!p) return
  const f = appFlowOf(id)
  trailBase(p, f, from)
  f.amounts.push({ level: 'supervisor', by, at, from, to, reason: 'مبلغ الدراسة المحدّث عند إعادة الإرسال' })
})

/* v3 · 3.2.22 · the supervisor's balance check counts back what the project already holds */
setOwnHold((id) => { const l = linkOf(id); return l && (l.stage === 'initial' || l.stage === 'final') ? l.amount : 0 })

/* Registered by the plans store · a registry, so the approvals store doesn't import it */
let confirmHook: ((projectId: string, by: string) => void) | null = null
export const setConfirmHook = (f: (projectId: string, by: string) => void): void => { confirmHook = f }

const moveTo = (p: ProjectRow, stage: string) => {
  const meta = stageMeta(stage)
  p.stage = stage
  p.statusGroup = meta?.group ?? p.statusGroup
  p.stageLimit = meta?.limit ?? 0
  p.hoursInStage = 0
}

/* ── Readings ── */

/** The cap of a level · the executive director's carries the allowed overrun (5.4.28-a) */
export const levelCap = (l: ApprovalRow['key']): number => {
  const c = capOf(l)
  return l === 'exec' && Number.isFinite(c) ? Math.round(c * (1 + APPROVAL_RULES.execOverPct / 100)) : c
}

/** Approved for the same entity within the period · count and total (5.4.27-b · 5.4.28-b) */
export function entityTally(entityId: string, exceptId?: string): { count: number; total: number } {
  const from = new Date(`${TODAY}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - APPROVAL_RULES.periodDays)
  const since = from.toISOString().slice(0, 10)
  const inPath = (p: ProjectRow) => p.holder === 'confirm' && p.stage === 'دراسة المشروع'
  const hits = projectRows.filter((p) => p.id !== exceptId && p.entityId === entityId &&
    ((p.supportStatus === 'معتمد' && (p.decidedAt ?? '') >= since) || inPath(p)))
  return { count: hits.length, total: hits.reduce((a, p) => a + (p.amountGranted || supportAmount(p)), 0) }
}

/** Why a level can't approve a project for its entity · empty when it can */
export function entityLimitBlock(p: ProjectRow, level: 'exec' | 'committee'): string {
  const lim = level === 'exec' ? APPROVAL_RULES.execEntity : APPROVAL_RULES.committeeEntity
  const t = entityTally(p.entityId, p.id)
  const who = level === 'exec' ? 'المدير التنفيذي' : 'اللجنة التنفيذية'
  if (lim.count !== null && t.count + 1 > lim.count) return `تجاوز حد عدد المشاريع المعتمدة للجهة لـ${who} (${nf.format(lim.count)} خلال ${nf.format(APPROVAL_RULES.periodDays)} يومًا)`
  if (lim.total !== null && t.total + supportAmount(p) > lim.total) return `تجاوز حد إجمالي قيمة مشاريع الجهة لـ${who} (${nf.format(lim.total)})`
  return ''
}

/** 5.4.3 · the entity's standing at the decision */
export function entityBlock(p: ProjectRow): string {
  const e = entityById(p.entityId)
  if (!e) return ''
  if (e.archived) return 'الجهة مؤرشفة'
  /* v3 · 2.4.2 · «معلق» (an update under review) leaves running projects as they are · only a real
     block («غير نشط») stops the decision */
  if (e.activation === 'غير نشط') return `حساب الجهة «غير نشط» · لا يصدر قرار إلا لجهة نشطة`
  const lapsed = expiredMandatory(e)
  if (lapsed.length) return `وثائق الجهة منتهية: ${lapsed.join('، ')}`
  return ''
}

/** 5.4.4 · the project sits in a domain an approved budget funds, under an active direction */
export function strategyOf(p: ProjectRow): { ok: boolean; say: string; direction?: string } {
  const why = fundingBlock(p.field)
  if (why) return { ok: false, say: why }
  if (!goalFunded(p.field, p.goal)) return { ok: false, say: `الهدف «${p.goal}» غير ممول في ميزانية السنة` }
  const line = usableLines().find((l) => l.node.label === p.goal && l.path.includes(p.field)) ?? usableLines().find((l) => l.path.includes(p.field))
  let dir: string | undefined
  if (line) {
    let cur = line.doc.nodes.find((n) => n.id === line.node.id)
    while (cur && !dir) {
      if (cur.directionId) dir = cur.directionId
      const up: string | null = cur.parentId
      cur = up ? line.doc.nodes.find((n) => n.id === up) : undefined
    }
    if (!dir && line.doc.directionIds?.length === 1) dir = line.doc.directionIds[0]
  }
  const d = dir ? directionById(dir) : undefined
  if (d && !d.active) return { ok: false, say: `التوجه «${d.name}» موقوف`, direction: d.name }
  return { ok: true, say: d ? `يخدم التوجه «${d.name}» · المجال ممول في ميزانية معتمدة` : 'المجال ممول في ميزانية معتمدة', direction: d?.name }
}

/** 5.4.24 · a declared conflict between the person and the project's entity */
export const conflictOf = (p: ProjectRow, person: string) =>
  APPROVAL_RULES.conflicts.find((c) => c.person === person && c.entityId === p.entityId)

/** v3 · 12.2.1 · what the project's type allows for the plan decision */
export const planKind = (p: ProjectRow): 'external' | 'portfolio' | 'regular' =>
  /* BPD-011 · supported through an external party · the type «مشروع خارجي» follows it (partners store) */
  p.platform ? 'external'
    : flowOf(p.id).study?.classification === 'محفظة' || p.partnerType === 'محفظة' ? 'portfolio' : 'regular'
/** The choice the type forces · '' when the manager decides */
const forcedPlan = (p: ProjectRow): string => (planKind(p) === 'external' ? 'no' : planKind(p) === 'portfolio' ? 'yes' : '')

/** Plan needed by rule (4.4.2) · a suggestion the manager confirms or changes */
export const planSuggested = (p: ProjectRow): boolean =>
  planKind(p) === 'portfolio' || (planKind(p) !== 'external' && (supportAmount(p) >= APPROVAL_RULES.planFrom || (p.durationDays ?? 0) > 365))

const openNotes = (f: AppFlow) => f.notes.filter((n) => !n.resolved)

/** What stands before an approving or upward step at a level · empty = clear */
export function upBlockers(p: ProjectRow, level: Holder, approving: boolean, withFunding = true): string[] {
  const f = appFlowOf(p.id)
  const out: string[] = []
  const eb = entityBlock(p)
  if (eb) out.push(eb)
  if (openNotes(f).length) out.push(/* doc 5.4.14 */ `${nf.format(openNotes(f).length)} ملاحظة إلزامية لم تُعالج · لا إحالة لمستوى أعلى قبلها`)
  /* The funding is checked on every approval, and again before the project goes up to the
     committee or the board (4.4.11 · 5.4.5 · 6.2.10 · 7.2.2) */
  if (withFunding && (approving || level === 'exec' || level === 'committee')) out.push(...fundingIssues(p.id, supportAmount(p)))
  if (approving) {
    if (level !== 'manager' && APPROVAL_RULES.requireStrategy) {
      const s = strategyOf(p)
      if (!s.ok) out.push(`لا يتوافق مع توجهات المؤسسة: ${s.say}`)
    }
  }
  return out
}

/* ── Seat options · the decision bar for the signed-in role ── */

export interface SeatOptions { actions: DecisionAction[]; say: string; mine: boolean; holder: Holder }

const recorderOf = (h: Holder): RoleKey[] =>
  h === 'committee' ? APPROVAL_RULES.committeeBy : h === 'board' ? APPROVAL_RULES.boardBy : [ACTS_FOR[h]]

export function seatOptions(p: ProjectRow, holder: Holder, viewer: RoleKey, me: string): SeatOptions {
  const f = appFlowOf(p.id)
  const amount = supportAmount(p)
  /* Re-audit 7 Oct · the supervisor's seat (study and confirmation) belongs to the project's own
     supervisor, not to anyone holding the role · a project with no owner waits for assignment */
  const mine = recorderOf(holder).includes(viewer) && (holder !== 'supervisor' && holder !== 'confirm' ? true : p.owner === me)
  const by = holder === 'committee' ? ' · تُسجَّل قراراتها في جلستها' : holder === 'board' ? ' · تُسجَّل قراراته في جلسته' : ''
  /* v3 · 5.2.11 · returned by the executive director · «قيد الدراسة · مدير المنح» with his note */
  const say = f.coverage && !f.coverage.done
    ? `قرار ${HOLDER_LABEL[f.coverage.level]} صادر · بانتظار التغطية المالية · ${f.coverage.short}`
    : f.awaitingReview && holder === 'manager'
      ? `قيد الدراسة · مدير المنح · أعاده المدير التنفيذي: ${f.awaitingReview.note}`
      : `المشروع عند ${HOLDER_LABEL[holder]}${by}`
  if (!mine) return { actions: [], say, mine, holder }

  const conflict = holder !== 'supervisor' && holder !== 'confirm' ? conflictOf(p, me) : undefined
  if (conflict) {
    return {
      holder, mine, say: /* doc 5.4.24 */ `تعارض مصالح: ${conflict.reason} · يُحوَّل القرار لصاحب صلاحية بديل`,
      actions: [{ label: 'إحالة لصاحب صلاحية بديل', kind: 'btn-p', needsNote: true }],
    }
  }
  const up = (lvl: Holder, approving: boolean) => upBlockers(p, lvl, approving)[0]
  /* v3 · 12.2.1 · a portfolio always needs a plan · an external project never has one in the system */
  const pk = planKind(p)
  const planChoice = { label: 'الخطة', options: pk === 'external' ? [{ value: 'no', label: 'لا يتطلب خطة · مشروع خارجي' }] : pk === 'portfolio' ? [{ value: 'yes', label: 'يتطلب خطة · محفظة' }] : [{ value: 'yes', label: 'يتطلب خطة' }, { value: 'no', label: 'لا يتطلب خطة' }] }

  if (holder === 'supervisor') {
    const back = flowOf(p.id).returnNote
    return {
      holder, mine, say,
      actions: [
        { label: back ? 'أعد الإرسال لمدير المنح' : 'توصية بالموافقة', kind: 'btn-p' },
        { label: 'طلب استكمال', kind: 'btn-2' },
        { label: 'تحويل لمجال أو مشرف آخر', kind: 'btn-2' },
        { label: 'توصية بالرفض', kind: 'btn-d' },
      ],
    }
  }
  if (holder === 'manager') {
    const actions: DecisionAction[] = []
    if (f.awaitingReview) {
      actions.push({ label: 'أعد الإرسال للمدير التنفيذي', kind: 'btn-p', needsNote: true, blocked: up('manager', false) })
    } else {
      if (APPROVAL_RULES.managerFinal && amount <= capOf('manager') && !typeFloorBlock(p, 'manager')) {
        actions.push({ label: 'اعتماد نهائي', kind: 'btn-p', needsNote: true, choose: planChoice, blocked: up('manager', true) })
      }
      actions.push({ label: 'توصية بالموافقة', kind: APPROVAL_RULES.managerFinal && amount <= capOf('manager') ? 'btn-2' : 'btn-p', needsNote: true, choose: planChoice, blocked: up('manager', true) })
      actions.push({ label: 'توصية بالرفض', kind: 'btn-2', needsNote: true, blocked: up('manager', false) })
      /* v3 · 4.2.17 · the grants manager refuses finally whatever the amount */
      actions.push({ label: 'رفض نهائي', kind: 'btn-d', needsNote: true })
    }
    /* v3 · 1.4.33 · 4.4.18 · back to the supervisor, the grants manager says what happens to the hold ·
       4.4.8 · the consultant is never a return path · the return goes to the supervisor */
    actions.push({
      label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true,
      choose: linkOf(p.id)?.stage === 'initial' || (!linkOf(p.id) && hasFunding(p.id)) ? { label: 'الحجز', options: [{ value: 'keep', label: 'الإبقاء على الحجز' }, { value: 'release', label: 'إلغاء الحجز' }] } : undefined,
    })
    return { holder, mine, say, actions }
  }
  if (holder === 'exec') {
    const floor = typeFloorBlock(p, 'exec')
    const within = amount <= levelCap('exec') && !floor
    const lim = entityLimitBlock(p, 'exec')
    const actions: DecisionAction[] = []
    if (within) actions.push({ label: 'اعتماد', kind: 'btn-p', needsNote: true, blocked: lim || up('exec', true) })
    /* v3 · 6.4.1 · within his authority the referral needs one of the referral criteria */
    actions.push({
      label: 'إحالة للجنة التنفيذية', kind: within && !lim ? 'btn-2' : 'btn-p', needsNote: true, blocked: up('exec', false),
      choose: within && !lim ? { label: 'معيار الإحالة', options: APPROVAL_RULES.referCriteria.map((c) => ({ value: c, label: c })) } : undefined,
    })
    actions.push({ label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true })
    actions.push({ label: 'اعتذار', kind: 'btn-d', needsNote: true })
    return { holder, mine, say: within ? say : floor ? `${say} · ${floor}` : `${say} · المبلغ فوق حد المدير التنفيذي (${nf.format(levelCap('exec'))}) فالإحالة للجنة`, actions }
  }
  if (holder === 'confirm') {
    const unmet = f.conditions.filter((c) => !c.met)
    return {
      holder, mine, say: 'اكتمل مسار الاعتماد · تحقّق من استيفاء الملاحظات والشروط ثم أكّد',
      actions: [
        { label: 'تأكيد الاعتماد', kind: 'btn-p', blocked: openNotes(f).length ? 'ملاحظات إلزامية لم تُعالج' : unmet.length ? `${nf.format(unmet.length)} شرط لم يُعلَّم مستوفى في تبويب الاعتماد` : '' },
        { label: 'إعادة لصاحب القرار', kind: 'btn-2', needsNote: true },
      ],
    }
  }
  /* Committee and board · decided in their session, not from the bar */
  return { holder, mine, say: `${say} · افتح الجلسة لتسجيل التصويت والقرار`, actions: [] }
}

/* ── Operations ── */

type Op = { at: string } & Stamped & (
  | { op: 'decide'; id: string; level: Holder; verdict: Verdict; note: string; by: string; needsPlan?: boolean; target?: Rec['target']; keepHold?: boolean; criterion?: string }
  | { op: 'amount'; id: string; level: Holder; to: number; reason: string; by: string; session?: string }
  | { op: 'cover'; id: string; by: string }
  | { op: 'brief'; id: string; brief: Brief }
  | { op: 'cond'; id: string; cond: Condition }
  | { op: 'condMet'; id: string; condId: string; by: string }
  | { op: 'note'; id: string; note: MandNote }
  | { op: 'noteResolve'; id: string; noteId: string; reply: string; by: string }
  | { op: 'ask'; id: string; opinion: Opinion }
  | { op: 'answer'; id: string; opinionId: string; answer: string; by: string }
  | { op: 'official'; id: string; official: Official }
  | { op: 'conflict'; id: string; level: Holder; reason: string; by: string }
  | { op: 'session'; session: Session }
  | { op: 'agenda'; sessionId: string; projectId: string; add: boolean }
  | { op: 'vote'; sessionId: string; projectId: string; member: string; vote: Vote; by?: string }
  | { op: 'minutes'; sessionId: string; projectId: string; file: string; by: string }
  | { op: 'sessionDecide'; sessionId: string; projectId: string; outcome: Outcome; target?: Holder; note: string; payPlan?: SessionItem['payPlan']; by: string; short?: string }
  | { op: 'sessionClose'; sessionId: string; by: string }
)

const KEY = 'ab-approval-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }

export function useApprovals(): number {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f) } },
    () => version,
  )
}

const now = () => new Date().toISOString()

/** Final approval at a level · the path is complete and the hold is final · v3 · 0.status.3 · the
    project reads «معتمد» the moment the decision is recorded · the supervisor's confirmation step v2
    had is gone (5.2.16 · 6.2.11 · 7.2.8) · the conditions go to the agreement, which checks them */
const finalise = (p: ProjectRow, f: AppFlow, level: Level, by: string, fields: LogField[]) => {
  f.decided = { level, at: opDay(), by }
  f.hold = 'final'
  activate(p, by, fields)
}

/** The approved project moves on · to its agreement, or straight to execution for an independent
    project through Ehsan (11.2.17) */
const activate = (p: ProjectRow, by: string, fields: LogField[]) => {
  p.supportStatus = 'معتمد'
  /* v3 · the granted amount is the support amount the deciding level left */
  if (p.amountGranted === 0 || p.amountSupport !== undefined) p.amountGranted = supportAmount(p)
  p.decidedAt = opDay()
  p.holder = undefined
  if (p.platform && p.partnerType === 'مستقل') {
    /* v3 · 11.2.5 · approved, the hold final, then «استكمال متطلبات ما قبل التنفيذ» · the external document
       and the schedule are registered before it runs (11.2.6 – 11.2.8) */
    moveTo(p, EXT_PRE_STAGE)
    fields.push({ k: 'الحالة', v: `معتمد · استكمال متطلبات ما قبل التنفيذ · مدعوم عبر ${p.platform} · بلا اتفاقية داخلية`, strong: true })
    notify(['مدير المنح'], p.id, `اعتُمد المشروع · ${p.name}`, `مدعوم عبر ${p.platform}`, ROUTES.project(p.id))
    confirmHook?.(p.id, by)
    notify([p.owner ?? 'مشرف المنح', 'مشرف المنح'], p.id, `سجّل الوثيقة الخارجية وجدول الدفعات · ${p.name}`, 'لا اتفاقية داخلية ولا خطة · يتحول إلى «تحت التنفيذ» بعد الجدول', ROUTES.project(p.id))
    return
  }
  /* v3 · 3.2.17 · classified a portfolio in the study · the portfolio path opens now, after the approval */
  if (flowOf(p.id).study?.classification === 'محفظة') {
    moveTo(p, 'اعتماد الإتفاقية')
    fields.push({ k: 'الحالة', v: 'معتمد · مصنَّف محفظة · يُفعَّل مسار المحفظة', strong: true })
    notify([p.owner ?? 'مشرف المنح', 'مشرف المنح'], p.id, `فعّل مسار المحفظة · ${p.name}`, 'اعتُمد المشروع المصنَّف محفظة · أنشئ المحفظة وفق إجراء إدارة المحافظ', ROUTES.project(p.id))
    notify([p.entityName, 'مدير المنح'], p.id, `اعتُمد المشروع · ${p.name}`, 'إلى مسار المحفظة', ROUTES.project(p.id))
    return
  }
  moveTo(p, 'اعتماد الإتفاقية')
  fields.push({ k: 'الحالة', v: 'معتمد · إلى إعداد الاتفاقية', strong: true })
  notify([p.entityName, 'مدير المنح'], p.id, `اعتُمد المشروع · ${p.name}`, 'إلى إعداد الاتفاقية', ROUTES.project(p.id))
  /* 12.2.3 · a project that needs a plan gets its plan record opened with the agreement */
  confirmHook?.(p.id, by)
  /* 8.2.2 · the supervisor learns the project is ready for its agreement · and the conditions to carry */
  notify([p.owner ?? 'مشرف المنح', 'مشرف المنح'], p.id, `مشروع جاهز لإعداد الاتفاقية · ${p.name}`, 'اكتمل الاعتماد وثبت الحجز', ROUTES.agreementNew(p.id))
}

/** A final refusal · the request closes, the hold is released, the entity reads why (4.4.18) */
const refuse = (p: ProjectRow, f: AppFlow, stage: string, note: string, by: string) => {
  p.supportStatus = 'مرفوض'
  /* v3 · 3.4.25 · the supervisor's reason from the list stays the project's decline reason */
  const st = flowOf(p.id).study
  if (!p.declineReason && st?.recommendation === 'reject' && st.rejectReason) p.declineReason = reasonSay(st.rejectReason, st.rejectOther)
  p.amountGranted = 0
  p.holder = undefined
  moveTo(p, stage)
  f.hold = 'none'
  f.official.unshift({ id: `of-${p.id}-${f.official.length}`, text: `اعتذار المؤسسة عن دعم المشروع · ${note}`, by, at: opDay() })
  notify([p.entityName], p.id, `قرار طلبك · ${p.name}`, note, ROUTES.project(p.id))
}

const apply = (o: Op) => { OP_AT = o.at; try { applyOp(o) } finally { OP_AT = undefined } }
const applyOp = (o: Op) => {
  switch (o.op) {
    case 'decide': {
      const p = row(o.id)
      if (!p) return
      const f = appFlowOf(o.id)
      f.recs.unshift({ level: o.level, verdict: o.verdict, note: o.note, by: o.by, at: opDay(), needsPlan: o.needsPlan, target: o.target })
      const fields: LogField[] = [{ k: 'القرار', v: VERDICT_SAY[o.verdict], strong: true }]
      if (o.note) fields.push({ k: o.verdict.includes('approve') || o.verdict === 'approve' ? 'المبررات' : 'الملاحظات', v: o.note })
      if (o.needsPlan !== undefined) { f.needsPlan = o.needsPlan; fields.push({ k: 'الخطة', v: o.needsPlan ? 'يتطلب خطة' : 'لا يتطلب خطة' }) }
      if (o.criterion) fields.push({ k: 'معيار الإحالة', v: o.criterion })
      const tone: LogEvent['tone'] = /approve|confirm|refer|resubmit/.test(o.verdict) ? 'ok' : o.verdict === 'return' ? 'warn' : 'no'
      const lvl = HOLDER_LABEL[o.level]
      switch (o.verdict) {
        case 'recommend-approve':
        case 'recommend-reject': {
          /* Batch 7 · approvals#19 · above the executive's cap (or past the entity's limit with him), a
             recommendation to approve can go straight to the committee when the setting says so */
          const auto = o.verdict === 'recommend-approve' && APPROVAL_RULES.autoReferAboveExec
            && (supportAmount(p) > levelCap('exec') || Boolean(entityLimitBlock(p, 'exec')) || Boolean(typeFloorBlock(p, 'exec')))
          p.holder = auto ? 'committee' : 'exec'; p.hoursInStage = 0
          /* v3 · 1.4.30 · the recommendation to approve held the money (the action did, on the budget's
             own log) · a recommendation to refuse leaves it with the line */
          if (o.verdict === 'recommend-approve') { const h = Boolean(linkOf(p.id)) && BUDGET_RULES.holdAt !== 'approval'; f.hold = h ? 'initial' : f.hold; fields.push({ k: 'الحجز', v: h ? 'مبدئي بالمبلغ الموصى به' : 'يُحجز عند الاعتماد النهائي وفق السياسة المالية' }) } else { f.hold = 'none'; fields.push({ k: 'الحجز', v: 'لا حجز مع التوصية بالرفض' }) }
          fields.push({ k: 'الإحالة', v: auto ? /* doc 5.4.11 */ 'اللجنة التنفيذية · إحالة تلقائية فوق حد المدير التنفيذي' : 'المدير التنفيذي' })
          if (auto) notify(['المدير التنفيذي', 'مدير المنح'], p.id, `أُحيل إلى اللجنة تلقائيًا · ${p.name}`, 'المبلغ فوق حد المدير التنفيذي · ينتظر جلسة اللجنة')
          else notify(['المدير التنفيذي'], p.id, `توصية مدير المنح · ${p.name}`, `${VERDICT_SAY[o.verdict]} · ${o.note}`)
          break
        }
        case 'final-approve':
          finalise(p, f, o.level as Level, o.by, fields)
          break
        case 'final-reject':
        case 'reject':
          refuse(p, f, o.level === 'committee' ? 'مرفوض - اللجنة التنفيذية' : o.level === 'board' ? 'مرفوض - مجلس الأمناء' : 'مشروع معتذر عنه', o.note, o.by)
          /* v3 · 0.status.10 · «مرفوض» at any level · the level stays in the decision's details */
          p.refusedBy = lvl
          fields.push({ k: 'الحجز', v: 'أُلغي وعاد المبلغ للميزانية' })
          break
        case 'approve':
          fields.push({ k: 'الحجز', v: 'نهائي' })
          finalise(p, f, o.level as Level, o.by, fields)
          break
        case 'refer': {
          const to = nextOf(o.level) ?? 'board'
          p.holder = to; p.hoursInStage = 0
          fields.push({ k: 'الإحالة', v: HOLDER_LABEL[to] }, { k: 'الحجز', v: 'مبدئي · يستمر حتى القرار' })
          notify([HOLDER_LABEL[to], ...(to === 'committee' ? ['مدير المنح'] : ['المدير التنفيذي'])], p.id, `إحالة إلى ${HOLDER_LABEL[to]} · ${p.name}`, o.note)
          break
        }
        case 'return': {
          const to = o.target ?? 'manager'
          if (to === 'supervisor' || to === 'consultant') {
            /* v3 · 1.4.33 · back to study · the last held amount stays · only the grants manager may let
               it go, and says so (4.4.18) · a body's return keeps it whatever the reason (6.4.11 · 7.4.11) */
            /* An op saved before v3 carries no choice · it released the hold on the budget's log then */
            const keep = o.keepHold ?? (o.level !== 'manager' && Boolean(linkOf(o.id) || hasFunding(o.id)))
            const had = f.hold
            p.holder = 'supervisor'
            if (!keep) f.hold = 'none'
            f.awaitingReview = undefined
            /* The study tab reads the note from the intake record, where the supervisor works */
            flowOf(o.id).returnNote = o.note
            flowOf(o.id).returnStudied = undefined
            if (p.owner) notify([p.owner], p.id, `أُعيد إليك · ${p.name}`, o.note, ROUTES.projectTab(p.id, 'study'))
            fields.push({ k: 'إلى', v: 'مشرف المنح' }, { k: 'الحجز', v: had === 'none' ? 'لا حجز قائم' : keep ? `محفوظ بآخر مبلغ محجوز${o.level === 'manager' ? ' · بقرار مدير المنح' : ''}` : 'أُلغي بقرار مدير المنح · يُعاد الحجز عند التوصية القادمة' })
          } else {
            p.holder = to as Holder
            if (to === 'manager' && o.level !== 'manager') f.awaitingReview = { note: o.note, by: o.by, at: opDay() }
            fields.push({ k: 'إلى', v: HOLDER_LABEL[to as Holder] }, { k: 'الحجز', v: /* doc 4.4.16 · 6.4.8 */ 'محفوظ' })
            notify([HOLDER_LABEL[to as Holder]], p.id, `أُعيد إليك · ${p.name}`, o.note)
          }
          p.hoursInStage = 0
          if (f.decided && o.level === 'confirm') { f.decided = undefined; f.hold = 'initial' }
          break
        }
        case 'resubmit':
          f.awaitingReview = undefined
          p.holder = 'exec'; p.hoursInStage = 0
          notify(['المدير التنفيذي'], p.id, `أعاد مدير المنح الإرسال · ${p.name}`, o.note)
          break
        case 'confirm':
          /* A log written while v2's confirmation step stood · the project already moved at the decision */
          if (p.holder !== 'confirm') break
          activate(p, o.by, fields)
          break
        case 'amend':
          /* 5.4.21 · a decision isn't deleted · it's reopened by a documented act at the deciding level */
          /* Re-audit 7 Oct · reopening the decision doesn't touch the money · the budget link stays as
             it was (final after an approval), so the approval card reads what the budget holds */
          if (f.decided) {
            p.holder = f.decided.level; f.decided = undefined; f.hold = linkOf(p.id)?.stage === 'final' ? 'final' : f.hold
            /* v3 · the decision moved the project on · reopening it brings it back to the level's study */
            if (p.supportStatus === 'معتمد' && p.stage !== 'دراسة المشروع') { p.supportStatus = null; p.decidedAt = undefined; moveTo(p, 'دراسة المشروع') }
          }
          fields.push({ k: 'الإجراء', v: 'أُعيد فتح القرار بإجراء رسمي موثّق' }, { k: 'الحجز', v: f.hold === 'final' ? 'يبقى نهائيًّا حتى القرار الجديد' : 'مبدئي' })
          break
      }
      event(o.id, { action: `${lvl} · ${VERDICT_SAY[o.verdict]}`, by: o.by, fields, tone, actor: o.level === 'committee' || o.level === 'board' ? 'committee' : 'staff', dept: lvl })
      return
    }
    case 'amount': {
      /* v3 · 4.2.5 · 5.4.11 · 6.4.5 · 7.4.7 · the level fixed, raised or cut the support amount · the
         hold followed on the budget's own log (the action resized it) */
      const p = row(o.id)
      if (!p) return
      const f = appFlowOf(o.id)
      const from = supportAmount(p)
      if (from === o.to) return
      trailBase(p, f, from)
      f.amounts.push({ level: o.level, by: o.by, at: opDay(), from, to: o.to, reason: o.reason, session: o.session })
      p.amountSupport = o.to
      event(o.id, {
        action: `${HOLDER_LABEL[o.level]} · تعديل مبلغ الدعم`, by: o.by, tone: 'warn', dept: HOLDER_LABEL[o.level],
        actor: o.level === 'committee' || o.level === 'board' ? 'committee' : 'staff',
        fields: [{ k: 'المبلغ السابق', v: nf.format(from) }, { k: 'المبلغ الجديد', v: nf.format(o.to), strong: true }, { k: 'المبررات', v: o.reason }],
      })
      /* The levels before see it at once */
      notify([...new Set([p.owner ?? 'مشرف المنح', 'مدير المنح', ...(o.level === 'committee' || o.level === 'board' ? ['المدير التنفيذي'] : [])])].filter((x) => x !== o.by), p.id,
        `عُدّل مبلغ الدعم · ${p.name}`, `${HOLDER_LABEL[o.level]} · ${nf.format(from)} ← ${nf.format(o.to)} · ${o.reason}`)
      return
    }
    case 'cover': {
      /* v3 · 6.4.3 · 7.4.5 · the cover was found · the decision recorded becomes the financial approval */
      const p = row(o.id)
      const f = appFlowOf(o.id)
      const c = f.coverage
      if (!p || !c || c.done) return
      c.done = { by: o.by, at: opDay() }
      const fields: LogField[] = [{ k: 'القرار', v: `${HOLDER_LABEL[c.level]} · اعتماد`, strong: true }, { k: 'التغطية المالية', v: 'اكتملت · نفذ القرار ماليًا' }, { k: 'الحجز', v: 'نهائي' }]
      finalise(p, f, c.level, o.by, fields)
      event(o.id, { action: 'نفاذ القرار ماليًا بعد التغطية', by: o.by, tone: 'ok', fields })
      return
    }
    case 'brief': {
      const f = appFlowOf(o.id)
      if (!f.briefs.some((b) => b.id === o.brief.id)) {
        f.briefs.unshift(o.brief)
        event(o.id, { action: `ملف العرض · ${HOLDER_LABEL[o.brief.level]}`, by: o.brief.by, fields: [{ k: 'الموقف المالي', v: `حتى ${o.brief.at} ${o.brief.time}` }, { k: 'الصيغة', v: 'PDF جاهز للإرسال بالبريد' }] })
      }
      return
    }
    case 'cond': appFlowOf(o.id).conditions.push(o.cond); event(o.id, { action: 'إضافة شرط خاص', by: o.cond.by, fields: [{ k: 'الشرط', v: o.cond.text, strong: true }, { k: 'قبل', v: o.cond.when === 'agreement' ? 'توقيع الاتفاقية' : 'صرف الدفعة الأولى' }] }); return
    case 'condMet': {
      const c = appFlowOf(o.id).conditions.find((x) => x.id === o.condId)
      if (c && !c.met) { c.met = { by: o.by, at: opDay() }; event(o.id, { action: 'استيفاء شرط', by: o.by, tone: 'ok', fields: [{ k: 'الشرط', v: c.text }] }) }
      return
    }
    case 'note': appFlowOf(o.id).notes.push(o.note); event(o.id, { action: 'ملاحظة إلزامية', by: o.note.by, tone: 'warn', fields: [{ k: 'الملاحظة', v: o.note.text, strong: true }] }); return
    case 'noteResolve': {
      const n = appFlowOf(o.id).notes.find((x) => x.id === o.noteId)
      if (n && !n.resolved) { n.resolved = { by: o.by, at: opDay(), reply: o.reply }; event(o.id, { action: 'معالجة ملاحظة إلزامية', by: o.by, tone: 'ok', fields: [{ k: 'الملاحظة', v: n.text }, { k: 'المعالجة', v: o.reply }] }) }
      return
    }
    case 'ask': {
      appFlowOf(o.id).opinions.push(o.opinion)
      event(o.id, { action: `طلب رأي ${DEPT_SAY[o.opinion.dept]}`, by: o.opinion.by, fields: [{ k: 'السؤال', v: o.opinion.ask }] })
      notify([DEPT_SAY[o.opinion.dept]], o.id, `طلب رأي · ${row(o.id)?.name ?? ''}`, o.opinion.ask)
      return
    }
    case 'answer': {
      const x = appFlowOf(o.id).opinions.find((y) => y.id === o.opinionId)
      if (x && !x.answer) { x.answer = o.answer; x.answeredBy = o.by; x.answeredAt = opDay(); event(o.id, { action: `رأي ${DEPT_SAY[x.dept]}`, by: o.by, fields: [{ k: 'الرأي', v: o.answer }, { k: 'الإلزام', v: 'استشاري' }] }) }
      return
    }
    case 'official': {
      appFlowOf(o.id).official.unshift(o.official)
      event(o.id, { action: 'اعتماد ملاحظة رسمية للجهة', by: o.official.by, fields: [{ k: 'الملاحظة', v: o.official.text }] })
      const p = row(o.id)
      if (p) notify([p.entityName], o.id, `ملاحظة من المؤسسة · ${p.name}`, o.official.text, ROUTES.project(o.id))
      return
    }
    case 'conflict': {
      const p = row(o.id)
      if (!p) return
      /* The seat passes to the next level with the authority · the person never decides it */
      const to = o.level === 'manager' ? 'exec' : nextOf(o.level) ?? 'board'
      p.holder = to; p.hoursInStage = 0
      event(o.id, { action: 'تعارض مصالح · تحويل لصاحب صلاحية بديل', by: o.by, tone: 'warn', fields: [{ k: 'السبب', v: o.reason }, { k: 'إلى', v: HOLDER_LABEL[to], strong: true }] })
      notify([HOLDER_LABEL[to]], o.id, `حُوّل إليك لتعارض مصالح · ${p.name}`, o.reason)
      return
    }
    case 'session': {
      const i = SESSIONS.findIndex((s) => s.id === o.session.id)
      const isNew = i < 0
      if (i >= 0) { if (SESSIONS[i].state === 'planned') SESSIONS[i] = o.session } else SESSIONS.push(o.session)
      /* Batch 7 · approvals#37 · the members learn their session's file is ready */
      if (isNew) notify(o.session.members, o.session.items[0]?.projectId ?? '', `ملف جلسة جاهز للاطلاع · ${o.session.title}`, `${o.session.date} · ${o.session.items.length} مشروع على جدول الأعمال`, ROUTES.approvalSession(o.session.id))
      return
    }
    case 'agenda': {
      const s = sessionById(o.sessionId)
      if (!s || s.state === 'closed') return
      if (o.add && !s.items.some((x) => x.projectId === o.projectId)) {
        s.items.push({ projectId: o.projectId, votes: {} })
        notify(s.members, o.projectId, `أُضيف مشروع إلى جدول الجلسة · ${s.title}`, row(o.projectId)?.name ?? o.projectId, ROUTES.approvalSession(s.id))
      }
      if (!o.add) s.items = s.items.filter((x) => x.projectId !== o.projectId || x.outcome)
      return
    }
    case 'vote': {
      const it = itemOf(o.sessionId, o.projectId)
      const pr = row(o.projectId)
      /* 6.4.21 · a member who declared a conflict with the entity doesn't vote on its project */
      if (it && !it.outcome && sessionById(o.sessionId)?.state === 'planned' && !(pr && conflictOf(pr, o.member))) {
        it.votes[o.member] = o.vote
        /* v3 · 6.2.5 · 7.2.7 · the executive director (the secretary) may enter a member's vote · it reads so */
        const px = new Set(it.proxied ?? [])
        if (o.by && o.by !== o.member) px.add(o.member); else px.delete(o.member)
        it.proxied = [...px]
      }
      return
    }
    case 'minutes': {
      const it = itemOf(o.sessionId, o.projectId)
      if (it && sessionById(o.sessionId)?.state === 'planned') {
        it.minutes = o.file
        event(o.projectId, { action: 'إرفاق محضر الاجتماع', by: o.by, files: [o.file], actor: 'committee', dept: HOLDER_LABEL[sessionById(o.sessionId)!.body] })
      }
      return
    }
    case 'sessionDecide': {
      const s = sessionById(o.sessionId)
      const it = itemOf(o.sessionId, o.projectId)
      const p = row(o.projectId)
      if (!s || !it || !p || s.state === 'closed' || it.outcome) return
      if (sessionItemBlockers(s, it, o.outcome).length) return
      it.outcome = o.outcome; it.target = o.target; it.note = o.note; it.payPlan = o.payPlan; it.decidedAt = opDay()
      const tally = voteTally(it)
      const verdict: Verdict = o.outcome === 'approve' ? 'approve' : o.outcome === 'refer' ? 'refer' : o.outcome === 'reject' ? 'reject' : 'return'
      if (o.outcome === 'approve' && o.short) {
        /* v3 · 6.4.3 · 7.4.5 · recorded as issued · the money isn't covered, so no financial approval
           and no final hold until it is · the holder stays the body, with the decision on file */
        it.uncovered = o.short
        const f = appFlowOf(p.id)
        f.coverage = { level: s.body, amount: supportAmount(p), short: o.short, by: o.by, at: opDay(), sessionId: s.id, note: o.note }
        f.recs.unshift({ level: s.body, verdict: 'approve', note: o.note, by: o.by, at: opDay() })
        event(p.id, {
          action: `${HOLDER_LABEL[s.body]} · اعتماد · بانتظار التغطية المالية`, by: o.by, tone: 'warn', actor: 'committee', dept: HOLDER_LABEL[s.body],
          fields: [{ k: 'القرار', v: 'اعتماد · حُفظ كما صدر', strong: true }, { k: 'النفاذ المالي', v: `معلّق · ${o.short}` }, { k: 'الحجز', v: 'يبقى مبدئيًا حتى التغطية' }],
        })
        notify(['المدير التنفيذي', 'مدير المنح', 'الإدارة المالية'], p.id, `قرار بانتظار التغطية المالية · ${p.name}`, o.short)
      } else apply({ op: 'decide', id: p.id, level: s.body, verdict, note: o.note, by: o.by, target: o.target, at: o.at })
      event(p.id, {
        action: `محضر ${HOLDER_LABEL[s.body]} · ${s.title}`, by: o.by, actor: 'committee', dept: HOLDER_LABEL[s.body],
        fields: [
          { k: 'التصويت', v: `موافقة ${tally.approve} · رفض ${tally.reject} · إعادة ${tally.return} · امتناع ${tally.abstain}`, strong: true },
          ...(o.payPlan?.note ? [{ k: 'توجيهات الصرف', v: o.payPlan.count ? `${o.payPlan.count} دفعات · ${o.payPlan.note}` : o.payPlan.note }] : []),
        ],
        files: it.minutes ? [it.minutes] : undefined,
      })
      /* Cross · notifications · the session's decision reaches the parties (6.4.12 · 7.4.12) */
      notify([...new Set([p.owner ?? 'مشرف المنح', 'مدير المنح', 'المدير التنفيذي'])], p.id, `قرار ${HOLDER_LABEL[s.body]} · ${p.name}`, `${OUTCOME_SAY[o.outcome]}${o.note ? ` · ${o.note}` : ''}`)
      if (o.outcome === 'approve' && !o.short) notify([p.entityName], p.id, `اعتمد ${HOLDER_LABEL[s.body]} مشروعك · ${p.name}`, 'يتبعه إعداد الاتفاقية', ROUTES.project(p.id))
      return
    }
    case 'sessionClose': {
      const s = sessionById(o.sessionId)
      if (!s || s.state === 'closed') return
      s.state = 'closed'
      s.closedAt = opDay()
      /* Items left without a decision go back to the queue for a later session */
      s.items = s.items.filter((x) => x.outcome)
      for (const it of s.items) event(it.projectId, { action: `إقفال جلسة ${HOLDER_LABEL[s.body]} · القرار نهائي`, by: o.by, actor: 'committee', dept: HOLDER_LABEL[s.body] })
      return
    }
  }
}

const itemOf = (sid: string, pid: string) => sessionById(sid)?.items.find((x) => x.projectId === pid)

export const voteTally = (it: SessionItem) => {
  const v = Object.values(it.votes)
  return { approve: v.filter((x) => x === 'approve').length, reject: v.filter((x) => x === 'reject').length, return: v.filter((x) => x === 'return').length, abstain: v.filter((x) => x === 'abstain').length, cast: v.length }
}

/** The outcome the votes carry under the voting rule · `null` = no decision yet */
export function carried(it: SessionItem): Vote | null {
  const t = voteTally(it)
  if (t.cast < APPROVAL_RULES.quorum) return null
  const order: Vote[] = ['approve', 'reject', 'return']
  if (APPROVAL_RULES.voting === 'unanimous') {
    const voted = Object.values(it.votes).filter((x) => x !== 'abstain')
    return voted.length && voted.every((x) => x === voted[0]) ? voted[0] : null
  }
  const top = order.sort((a, b) => t[b] - t[a])[0]
  return t[top] > (t.cast - t.abstain) / 2 ? top : null
}

/** What stands before recording a session decision (6.4.6 · 6.2.10 · 7.2.2) */
export function sessionItemBlockers(s: Session, it: SessionItem, outcome: Outcome, amount?: number): string[] {
  const p = row(it.projectId)
  if (!p) return ['المشروع غير موجود']
  const out: string[] = []
  const t = voteTally(it)
  if (t.cast < APPROVAL_RULES.quorum) out.push(`لم يكتمل النصاب · سُجّل ${nf.format(t.cast)} صوت من ${nf.format(APPROVAL_RULES.quorum)}`)
  const c = carried(it)
  const want: Vote = outcome === 'refer' ? 'approve' : outcome
  if (t.cast >= APPROVAL_RULES.quorum && c !== want) out.push(`القرار لا يطابق نتيجة التصويت${c ? ` (${VOTE_SAY[c]})` : ' · لا أغلبية'}`)
  if (!it.minutes) out.push('أرفق محضر الاجتماع أولًا')
  /* v3 · 6.4.3 · 7.4.5 · the balance doesn't stop a body's decision from being recorded · an uncovered
     approval is saved as issued with its money suspended (`sessionShort`) */
  if (outcome === 'approve' || outcome === 'refer') out.push(...upBlockers(p, s.body, true, outcome === 'refer'))
  if (outcome === 'approve') {
    if ((amount ?? supportAmount(p)) > levelCap(s.body)) out.push(`المبلغ فوق حد ${HOLDER_LABEL[s.body]} · الإحالة لمجلس الأمناء`)
    if (s.body === 'committee') { const l = entityLimitBlock(p, 'committee'); if (l) out.push(l) }
    const fl = typeFloorBlock(p, s.body); if (fl) out.push(fl)
  }
  if (outcome === 'refer' && s.body === 'board') out.push('مجلس الأمناء أعلى جهة اعتماد')
  return out
}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ }
}
const run = (o: Op) => { o.seq = nextSeq(); ops.push(o); apply(o); save(); emit() }

/* ── Seed · the projects already on the path carry the recommendations that put them there ── */

function seed() {
  const at = (d: number) => { const x = new Date(`${TODAY}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10) }
  const supRec = (p: ProjectRow, d: number): Rec => ({ level: 'supervisor', verdict: 'recommend-approve', note: 'الدراسة مكتملة والمخرجات قابلة للقياس · نوصي بالموافقة', by: p.owner ?? 'عمر قاسم', at: at(d) })
  for (const p of projectRows.filter((x) => x.stage === 'دراسة المشروع' && x.holder && x.holder !== 'supervisor')) {
    const f = appFlowOf(p.id)
    f.recs.push(supRec(p, 12))
    if (p.holder !== 'manager') {
      f.recs.unshift({ level: 'manager', verdict: 'recommend-approve', note: 'الدراسة مكتملة، والتكلفة في حدود متوسط المجال، والجهة نشطة وسجلها جيد', by: 'عبدالله الدوسري', at: at(6), needsPlan: planSuggested(p) })
      f.needsPlan = planSuggested(p)
      /* The manager's recommendation held the amount · the budget store seeds that hold, before
         its saved operations replay (`seedStudyHolds`) */
      f.hold = 'initial'
    }
    if (p.holder === 'committee' || p.holder === 'board') {
      f.recs.unshift({ level: 'exec', verdict: 'refer', note: 'المبلغ فوق حد المدير التنفيذي · يُعرض على اللجنة', by: 'عبدالرحمن الهليّل', at: at(3) })
    }
  }
  /* v3 · 5.2.3 · 6.2.2 · the fixture's projects above the grants manager carry the file made when they
     arrived · its financial position is the one at load, kept as it is */
  for (const p of projectRows.filter((x) => x.stage === 'دراسة المشروع' && (x.holder === 'exec' || x.holder === 'committee' || x.holder === 'board'))) {
    const fin = finPosition(p)
    const f = appFlowOf(p.id)
    if (!fin) continue
    f.briefs.push({
      id: `br-${p.id}-1-${p.holder}`, level: p.holder!, at: at(p.holder === 'exec' ? 6 : 3), time: '09:00', by: 'النظام', amount: supportAmount(p), fin,
      recs: f.recs.map((r) => ({ level: r.level, verdict: VERDICT_SAY[r.verdict], note: r.note, by: r.by, at: r.at })),
      orgOutputs: orgOutputsOf(p.id).map(outputLine), entityOutputs: (flowOf(p.id).entityOutputs ?? []).map(outputLine), conditions: [], amounts: [],
    })
  }
  /* A planned committee session with the two referred projects on its agenda, and the board's next */
  const referred = projectRows.filter((p) => p.holder === 'committee' && p.stage === 'دراسة المشروع').map((p) => p.id)
  SESSIONS.push({
    id: 'EC-2026-10', body: 'committee', title: 'الاجتماع الدوري العاشر للجنة التنفيذية', date: '2026-10-08',
    members: [...APPROVAL_RULES.committeeMembers], items: referred.map((id) => ({ projectId: id, votes: {} })), state: 'planned', by: 'عبدالله الدوسري',
  })
  SESSIONS.push({
    id: 'EC-2026-09', body: 'committee', title: 'الاجتماع الدوري التاسع للجنة التنفيذية', date: '2026-09-10',
    members: [...APPROVAL_RULES.committeeMembers], items: [], state: 'closed', by: 'عبدالله الدوسري', closedAt: '2026-09-10',
  })
  SESSIONS.push({
    id: 'BT-2026-04', body: 'board', title: 'اجتماع مجلس الأمناء الرابع', date: '2026-10-22',
    members: [...APPROVAL_RULES.boardMembers], items: [], state: 'planned', by: 'عبدالرحمن الهليّل',
  })
  /* A condition and an official note on one decided project, to show both */
  const ex = projectRows.find((p) => p.holder === 'exec' && p.stage === 'دراسة المشروع')
  if (ex) {
    appFlowOf(ex.id).opinions.push({ id: `op-${ex.id}-0`, dept: 'finance', ask: 'هل تكفي سيولة الربع الرابع لدفعة أولى بأربعين بالمئة؟', by: 'عبدالرحمن الهليّل', at: at(1) })
  }
}

setConditionGate((projectId) => {
  const u = unmetBefore(projectId, 'agreement')
  return u.length ? `شرط قبل التوقيع لم يُستوفَ: ${u[0].text}` : ''
})

function hydrate() {
  seed()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  /* Re-audit 7 Oct · with the study's log, in the order things happened · replayed one after the
     other, a return to the supervisor landed after his resubmission and a reload undid it */
  const intake = intakeLog()
  replayTogether([...(intake ? [intake] : []), { ops, apply }])
}
hydrate()

/* ── Actions ── */

const id6 = () => Math.random().toString(36).slice(2, 8)

/** Run a decision from the bar · returns the reasons it can't run, which the bar shows */
/** The last authority approved · the budget hold turns final with it (1.4.28 · 5.4.9) */
const settleHold = (id: string, me: string) => {
  const l = linkOf(id)
  if (l && FLOWS.get(id)?.hold === 'final' && l.stage !== 'final' && l.stage !== 'closed') finalizeHold(id, me)
}

/** v3 · 6.4.12 · 7.4.12 · the amount changed since the hold · on the way up again the hold follows it
    when the line has the balance · the standing check says what's short when it hasn't */
function syncHold(p: ProjectRow, me: string): void {
  const l = linkOf(p.id)
  const want = supportAmount(p)
  if (!l || l.stage === 'closed' || l.stage === 'final' || l.amount === want) return
  if (!resizeIssue(p.id, want)) resizeLink(p.id, want, p.id, me, 'تحديث آلي للحجز إلى مبلغ الدعم الحالي')
}

/** The presentation file at a level · made when the project arrives there (5.2.3 · 6.2.2 · 7.2.3) ·
    its financial position is read now and kept as it is */
function makeBrief(p: ProjectRow, level: Holder, me: string): void {
  if (level !== 'exec' && level !== 'committee' && level !== 'board') return
  const fin = finPosition(p)
  if (!fin) return
  const f = appFlowOf(p.id)
  const at = stampNow()
  const brief: Brief = {
    id: `br-${p.id}-${f.briefs.length + 1}-${level}`, level, at: dayOf(at), time: timeOf(at), by: me, amount: supportAmount(p), fin,
    recs: f.recs.map((r) => ({ level: r.level, verdict: VERDICT_SAY[r.verdict], note: r.note, by: r.by, at: r.at })),
    orgOutputs: orgOutputsOf(p.id).map(outputLine),
    entityOutputs: (flowOf(p.id).entityOutputs ?? []).map(outputLine),
    conditions: f.conditions.map((c) => c.text),
    amounts: f.amounts.map((x) => ({ ...x })),
  }
  run({ op: 'brief', id: p.id, brief, at: now() })
}
/** Each level the decision just sent the project to gets its file */
const briefOnArrival = (p: ProjectRow, before: Holder | undefined, me: string) => {
  if (p.holder && p.holder !== before && p.stage === 'دراسة المشروع') makeBrief(p, p.holder, me)
}

/** v3 · 4.2.5 · 5.4.11 · 6.4.5 · 7.4.7 · fix, raise or cut the support amount at the level that holds
    the project · with its reason · the hold follows when the line has the balance, and a raise it
    can't cover is refused (outside a session · a body's decision is recorded as issued, 6.4.3) */
export function changeAmount(p: ProjectRow, level: Holder, to: number, reason: string, me: string, session?: string): string[] {
  if (p.stage !== 'دراسة المشروع' || (p.holder ?? 'supervisor') !== level) return ['المشروع ليس عند هذه المحطة']
  if (!(to > 0)) return ['أدخل مبلغ الدعم']
  if (!reason.trim()) return ['اكتب مبررات تعديل المبلغ']
  const from = supportAmount(p)
  if (to === from) return ['المبلغ لم يتغيّر']
  const l = linkOf(p.id)
  if (l && l.stage !== 'planned') {
    const why = resizeIssue(p.id, to)
    if (why && !session) return [why]
    if (!why) resizeLink(p.id, to, p.id, me, `تعديل مبلغ الدعم · ${HOLDER_LABEL[level]} · ${reason.trim()}`)
  } else if (l?.stage === 'planned' && l.amount !== to) {
    /* A drawn link with no hold yet · redrawn on its first line, held at the recommendation */
    resizeLink(p.id, to, p.id, me, `تعديل مبلغ الدعم · ${HOLDER_LABEL[level]}`)
  }
  run({ op: 'amount', id: p.id, level, to, reason: reason.trim(), by: me, session, at: now() })
  return []
}

/** v3 · 6.4.3 · what the balance leaves uncovered for a body's approval · '' = covered */
export function sessionShort(p: ProjectRow): string {
  return fundingIssues(p.id, supportAmount(p))[0] ?? ''
}

/** v3 · 6.4.3 · 7.4.5 · the cover was found (a transfer, a raise of the line or a relink) · the
    decision recorded becomes the financial approval · the reasons it can't yet */
export function completeCoverage(p: ProjectRow, me: string): string[] {
  const f = appFlowOf(p.id)
  if (!f.coverage || f.coverage.done) return ['لا قرار بانتظار التغطية']
  syncHold(p, me)
  const why = fundingIssues(p.id, supportAmount(p))
  if (why.length) return why
  run({ op: 'cover', id: p.id, by: me, at: now() })
  settleHold(p.id, me)
  return []
}

export function decide(p: ProjectRow, level: Holder, label: string, note: string, choice: string, me: string): string[] {
  if (p.stage !== 'دراسة المشروع' || (p.holder ?? 'supervisor') !== level) return ['المشروع ليس عند هذه المحطة']
  const at = now()
  const before = p.holder
  const go = (verdict: Verdict, extra: Partial<Extract<Op, { op: 'decide' }>> = {}) => {
    run({ op: 'decide', id: p.id, level, verdict, note, by: me, at, ...extra })
    briefOnArrival(p, before, me)
  }
  /* v3 · 6.4.12 · an amount changed since the hold · the hold follows before the checks read it */
  if (/اعتماد|توصية بالموافقة|أعد الإرسال|إحالة/.test(label)) syncHold(p, me)
  const block = (approving: boolean) => upBlockers(p, level, approving)
  /* The checks before the recommendation's hold · a planned link reads the line's balance itself */
  switch (label) {
    case 'إحالة لصاحب صلاحية بديل': run({ op: 'conflict', id: p.id, level, reason: note, by: me, at }); return []
    case 'اعتماد نهائي': {
      const fl = typeFloorBlock(p, 'manager'); if (fl) return [fl]
      if (forcedPlan(p)) choice = forcedPlan(p)
      if (!choice) return ['حدّد إن كان المشروع يتطلب خطة']
      const b = block(true); if (b.length) return b
      const held = holdAtRecommendation(p.id, me); if (held.length) return held
      go('final-approve', { needsPlan: choice === 'yes' }); settleHold(p.id, me); return []
    }
    case 'توصية بالموافقة': {
      /* v3 · 12.2.1 · the type decides for a portfolio and an external project */
      if (forcedPlan(p)) choice = forcedPlan(p)
      if (!choice) return [/* doc 4.2.3 */ 'حدّد إن كان المشروع يتطلب خطة']
      /* v3 · 4.2.14 · 4.4.13 · the recommendation holds the money · a line short of it stops the
         recommendation with the shortfall named */
      const b = block(true); if (b.length) return b
      const held = holdAtRecommendation(p.id, me); if (held.length) return held
      go('recommend-approve', { needsPlan: choice === 'yes' }); return []
    }
    case 'توصية بالرفض': {
      const b = upBlockers(p, level, false, false); if (b.length) return b
      if (linkOf(p.id)?.stage === 'initial') releaseToPlanned(p.id, me, 'توصية بالرفض · لا حجز')
      go('recommend-reject'); return []
    }
    case 'رفض نهائي': {
      /* v3 · 4.2.17 · whatever the amount */
      if (hasFunding(p.id)) unlinkProject(p.id, me, 'رفض نهائي من مدير المنح')
      go('final-reject'); return []
    }
    case 'إعادة للمشرف': {
      /* v3 · 1.4.33 · 4.4.18 · keep the last held amount, or release it · the grants manager's call */
      const l = linkOf(p.id)
      const held = l?.stage === 'initial' || (!l && hasFunding(p.id))
      if (held && choice !== 'keep' && choice !== 'release') return ['حدّد الإجراء بشأن الحجز المالي: الإبقاء أو الإلغاء']
      /* Nothing held (a link drawn at his seat, or none) · nothing to keep or release · the drawn link stays */
      const keep = !held || choice === 'keep'
      if (!keep) {
        /* The money goes back to the line · the drawn link stays for the next recommendation to hold
           again · a multi-year plan has no drawn link, so its holds are released whole */
        if (l) releaseToPlanned(p.id, me, /* doc 4.4.18 */ 'إعادة المشروع للمشرف · إلغاء الحجز بقرار مدير المنح')
        else unlinkProject(p.id, me, 'إعادة المشروع للمشرف · إلغاء الحجز بقرار مدير المنح')
      }
      go('return', { target: 'supervisor', keepHold: keep })
      return []
    }
    case 'أعد الإرسال للمدير التنفيذي': { const b = block(false); if (b.length) return b; go('resubmit'); return [] }
    case 'اعتماد': {
      if (supportAmount(p) > levelCap('exec')) return [/* doc 5.4.11 */ `المبلغ فوق حد المدير التنفيذي (${nf.format(levelCap('exec'))}) · الإحالة للجنة`]
      const lim = entityLimitBlock(p, 'exec'); if (lim) return [lim, 'تُحال للجنة التنفيذية']
      const fl = typeFloorBlock(p, 'exec'); if (fl) return [fl]
      const b = block(true); if (b.length) return b
      go('approve'); settleHold(p.id, me); return []
    }
    case 'إحالة للجنة التنفيذية': {
      const b = block(false); if (b.length) return b
      /* v3 · 6.4.1 · within the executive's authority, only on a referral criterion */
      const within = supportAmount(p) <= levelCap('exec') && !typeFloorBlock(p, 'exec') && !entityLimitBlock(p, 'exec')
      if (within && !choice) return ['المبلغ ضمن صلاحية المدير التنفيذي · اختر معيار الإحالة للجنة']
      go('refer', { criterion: within ? choice : 'تجاوز حدود صلاحية المدير التنفيذي' }); return []
    }
    case 'إعادة لمدير المنح': go('return', { target: 'manager' }); return []
    case 'اعتذار': if (hasFunding(p.id)) unlinkProject(p.id, me, 'اعتذار المدير التنفيذي'); go('reject'); return []
    case 'تأكيد الاعتماد': {
      const f = appFlowOf(p.id)
      if (openNotes(f).length) return ['ملاحظات إلزامية لم تُعالج']
      const unmet = f.conditions.filter((c) => !c.met)
      if (unmet.length) return unmet.map((c) => `شرط لم يُستوفَ: ${c.text}`)
      go('confirm'); return []
    }
    case 'إعادة لصاحب القرار': { const f = appFlowOf(p.id); go('return', { target: f.decided?.level ?? 'exec' }); return [] }
  }
  return []
}

export const amendDecision = (p: ProjectRow, note: string, me: string) => run({ op: 'decide', id: p.id, level: appFlowOf(p.id).decided?.level ?? 'exec', verdict: 'amend', note, by: me, at: now() })
export const addCondition = (id: string, text: string, when: Condition['when'], by: string) => run({ op: 'cond', id, cond: { id: `c-${id6()}`, text, when, by, at: dayOf(stampNow()) }, at: now() })
export const meetCondition = (id: string, condId: string, by: string) => run({ op: 'condMet', id, condId, by, at: now() })
export const addMandNote = (id: string, text: string, level: Holder, by: string) => run({ op: 'note', id, note: { id: `n-${id6()}`, text, level, by, at: dayOf(stampNow()) }, at: now() })
export const resolveNote = (id: string, noteId: string, reply: string, by: string) => run({ op: 'noteResolve', id, noteId, reply, by, at: now() })
export const askOpinion = (id: string, dept: Opinion['dept'], ask: string, by: string) => run({ op: 'ask', id, opinion: { id: `o-${id6()}`, dept, ask, by, at: dayOf(stampNow()) }, at: now() })
export const answerOpinion = (id: string, opinionId: string, answer: string, by: string) => run({ op: 'answer', id, opinionId, answer, by, at: now() })
export const makeOfficial = (id: string, text: string, by: string) => run({ op: 'official', id, official: { id: `of-${id6()}`, text, by, at: dayOf(stampNow()) }, at: now() })
export const declareConflict = (p: ProjectRow, level: Holder, reason: string, me: string) => run({ op: 'conflict', id: p.id, level, reason, by: me, at: now() })
export const saveSession = (s: Session) => run({ op: 'session', session: s, at: now() })
export const setAgenda = (sessionId: string, projectId: string, add: boolean) => run({ op: 'agenda', sessionId, projectId, add, at: now() })
/** Re-audit 7 Oct · each member casts his own vote from his own account · the secretary records the
    minutes and the decision, not the members' votes (6.4.6 · 7.4.6) */
export function castVote(sessionId: string, projectId: string, member: string, vote: Vote, by: string, role?: RoleKey): string[] {
  const s = sessionById(sessionId)
  /* v3 · 6.2.5 · 7.2.7 · the executive director records each member's decision · a member votes from
     his own account too */
  if (member !== by && !(s && role === 'ceo' && mayRecord(s.body, role))) return ['يصوّت العضو بنفسه من حسابه أو يسجّله المدير التنفيذي']
  const p = row(projectId)
  if (!s?.members.includes(member)) return ['ليس عضوًا في هذه الجلسة']
  if (p && conflictOf(p, member)) return ['أُعلن تعارض مصالح مع الجهة · لا يصوّت على مشروعها']
  run({ op: 'vote', sessionId, projectId, member, vote, by, at: now() })
  return []
}
export const attachMinutes = (sessionId: string, projectId: string, file: string, by: string) => run({ op: 'minutes', sessionId, projectId, file, by, at: now() })
export const decideInSession = (sessionId: string, projectId: string, outcome: Outcome, note: string, by: string, target?: Holder, payPlan?: SessionItem['payPlan'], amount?: { to: number; reason: string }): string[] => {
  const p = row(projectId)
  const s = sessionById(sessionId)
  if (!p || !s) return ['الجلسة أو المشروع غير موجود']
  const before = p.holder
  const it = itemOf(sessionId, projectId)
  if (!it || it.outcome || s.state === 'closed') return ['القرار مسجّل أو الجلسة مقفلة']
  /* Validate before any money moves · a blocked decision leaves the hold as it was */
  const moved = amount && amount.to !== supportAmount(p) && (outcome === 'approve' || outcome === 'refer') ? amount : undefined
  const pre = sessionItemBlockers(s, it, outcome, moved?.to)
  if (pre.length) return pre
  if (moved && !moved.reason.trim()) return ['اكتب مبررات تعديل المبلغ']
  /* A referral carries the hold up · a raise it can't hold is refused (7.2.2) · only an approval is
     recorded uncovered (6.4.3) */
  if (outcome === 'refer' && moved && moved.to > supportAmount(p)) { const w = resizeIssue(p.id, moved.to); if (w) return [w] }
  /* v3 · 6.4.5 · 7.4.7 · the body fixes, raises or cuts the amount with its decision */
  if (moved) {
    const amount = moved
    const why = changeAmount(p, s.body, amount.to, amount.reason, by, sessionId)
    if (why.length) return why
  }
  if (outcome === 'approve' || outcome === 'refer') syncHold(p, by)
  /* Batch 7 · a multi-year project's held years leave too · v3 · 6.4.11 · 7.4.11 · a return keeps the
     hold whatever the stage it goes back to · only a refusal releases it */
  if (outcome === 'reject' && hasFunding(projectId)) unlinkProject(projectId, by, 'رفض في الجلسة')
  const short = outcome === 'approve' ? sessionShort(p) : ''
  run({ op: 'sessionDecide', sessionId, projectId, outcome, target, note, payPlan, by, short: short || undefined, at: now() })
  if (!short) settleHold(projectId, by)
  briefOnArrival(p, before, by)
  return []
}
export const closeSession = (sessionId: string, by: string) => run({ op: 'sessionClose', sessionId, by, at: now() })

export const nextSessionId = (body: Session['body']) => {
  const pre = body === 'committee' ? 'EC' : 'BT'
  let i = 1
  while (SESSIONS.some((s) => s.id === `${pre}-2026-${String(i).padStart(2, '0')}`)) i++
  return `${pre}-2026-${String(i).padStart(2, '0')}`
}

/** Projects waiting for a body's session · referred and not yet on an open session's agenda */
export const awaitingSession = (body: Session['body']): ProjectRow[] =>
  projectRows.filter((p) => p.stage === 'دراسة المشروع' && p.holder === body && !(FLOWS.get(p.id)?.coverage && !FLOWS.get(p.id)?.coverage?.done))

export const mayRecord = (body: Session['body'], role: RoleKey) => recorderOf(body).includes(role)

/** Conditions that stop the agreement or the first payment (5.4.16) */
export const unmetBefore = (projectId: string, when: Condition['when']): Condition[] =>
  (FLOWS.get(projectId)?.conditions ?? []).filter((c) => c.when === when && !c.met)

/** The approval budget line a project holds on · for the executive panel */
export const holdLine = (projectId: string) => {
  const l = linkOf(projectId)
  if (!l) return undefined
  const d = docOf(l.docId)
  return { link: l, doc: d, node: d?.nodes.find((n) => n.id === l.nodeId) }
}

export const resetApprovals = () => {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  location.reload()
}

/** Bulk decisions from the projects list · each project passes its own guards (5.4.11 · 5.4.14) */
export function decideMany(ids: readonly string[], label: string, note: string, viewer: RoleKey, me: string): { done: string[]; held: { id: string; why: string }[] } {
  const done: string[] = []
  const held: { id: string; why: string }[] = []
  for (const id of ids) {
    const p = row(id)
    if (!p || p.stage !== 'دراسة المشروع' || !p.holder) { held.push({ id, why: 'ليس في مسار الاعتماد' }); continue }
    const seat = seatOptions(p, p.holder, viewer, me)
    const a = seat.actions.find((x) => x.label === label)
    if (!a) { held.push({ id, why: seat.mine ? 'القرار غير متاح على هذا المشروع' : seat.say }); continue }
    if (a.blocked) { held.push({ id, why: a.blocked }); continue }
    if (a.choose && label !== 'إعادة للمشرف') { held.push({ id, why: 'يحتاج اختيارًا لكل مشروع من صفحته' }); continue }
    const why = decide(p, p.holder, label, note, '', me)
    if (why.length) held.push({ id, why: why[0] })
    else done.push(id)
  }
  return { done, held }
}
