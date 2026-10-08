import { useSyncExternalStore } from 'react'
import type { DecisionAction, ProjectRow } from '@/types/domain'
import type { LogEvent, LogField } from '@/data/mock/log'
import { SOURCE_OF } from '@/data/mock/log'
import { projectRows } from '@/data/mock/projects'
import { stageMeta } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { capOf, type ApprovalRow } from '@/data/approval'
import { ACTS_FOR, HOLDER_LABEL, nextOf, type Holder } from '@/data/holders'
import type { RoleKey } from '@/data/roles'
import { TODAY, fundingBlock, goalFunded } from '@/data/intake/cycle'
import { dayOf, stampNow, timeOf } from '@/data/clock'
import { flowOf, intakeLog, referConsultant } from '@/data/intake/flow'
import { nextSeq, replayTogether, type Stamped } from '@/data/opclock'
import { expiredMandatory } from '@/data/entities/store'
import { hasFunding, linkOf, unlinkProject, usableLines, directionById, docOf, fundingIssues, finalizeHold } from '@/data/budget/store'
import { nf } from '@/lib/format'
import { setConditionGate } from '@/data/mock/agreementNew'
import { ROUTES } from '@/app/routes'
import { APPROVAL_RULES } from './rules'

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
  /** 6.1.input-4 · 7.1.output-3 · the payments the decision settles */
  payPlan?: { count: number; note: string }
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
  events: LogEvent[]
}

const FLOWS = new Map<string, AppFlow>()
export const SESSIONS: Session[] = []
export interface ApprovalNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const APPROVAL_NOTES: ApprovalNote[] = []

export const appFlowOf = (id: string): AppFlow => {
  let f = FLOWS.get(id)
  if (!f) { f = { recs: [], conditions: [], notes: [], opinions: [], official: [], hold: 'none', events: [] }; FLOWS.set(id, f) }
  return f
}
export const approvalEvents = (id: string): LogEvent[] => FLOWS.get(id)?.events ?? []
export const sessionById = (id: string): Session | undefined => SESSIONS.find((s) => s.id === id)
/** The payment mechanism the last body approved with the project · for its agreement's schedule */
export const payPlanOf = (projectId: string): SessionItem['payPlan'] =>
  [...SESSIONS].reverse().flatMap((s) => s.items).find((i) => i.projectId === projectId && i.outcome === 'approve' && i.payPlan)?.payPlan
export const sessionsOf = (projectId: string): Session[] => SESSIONS.filter((s) => s.items.some((i) => i.projectId === projectId))

const row = (id: string) => projectRows.find((p) => p.id === id)
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
  return { count: hits.length, total: hits.reduce((a, p) => a + (p.amountGranted || p.amountRequested), 0) }
}

/** Why a level can't approve a project for its entity · empty when it can */
export function entityLimitBlock(p: ProjectRow, level: 'exec' | 'committee'): string {
  const lim = level === 'exec' ? APPROVAL_RULES.execEntity : APPROVAL_RULES.committeeEntity
  const t = entityTally(p.entityId, p.id)
  const who = level === 'exec' ? 'المدير التنفيذي' : 'اللجنة التنفيذية'
  if (lim.count !== null && t.count + 1 > lim.count) return `تجاوز حد عدد المشاريع المعتمدة للجهة لـ${who} (${nf.format(lim.count)} خلال ${nf.format(APPROVAL_RULES.periodDays)} يومًا)`
  if (lim.total !== null && t.total + p.amountRequested > lim.total) return `تجاوز حد إجمالي قيمة مشاريع الجهة لـ${who} (${nf.format(lim.total)})`
  return ''
}

/** 5.4.3 · the entity's standing at the decision */
export function entityBlock(p: ProjectRow): string {
  const e = entityById(p.entityId)
  if (!e) return ''
  if (e.archived) return 'الجهة مؤرشفة'
  if (e.activation !== 'نشط' && e.activation !== 'محدث') return `حالة الجهة «${e.activation}» · لا يصدر قرار إلا لجهة نشطة`
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

/** Plan needed by rule (4.4.2) · a suggestion the manager confirms or changes */
export const planSuggested = (p: ProjectRow): boolean =>
  p.amountRequested >= APPROVAL_RULES.planFrom || (p.durationDays ?? 0) > 365

const openNotes = (f: AppFlow) => f.notes.filter((n) => !n.resolved)

/** What stands before an approving or upward step at a level · empty = clear */
export function upBlockers(p: ProjectRow, level: Holder, approving: boolean): string[] {
  const f = appFlowOf(p.id)
  const out: string[] = []
  const eb = entityBlock(p)
  if (eb) out.push(eb)
  if (openNotes(f).length) out.push(`${nf.format(openNotes(f).length)} ملاحظة إلزامية لم تُعالج · لا إحالة لمستوى أعلى قبلها (5.4.14)`)
  /* The funding is checked on every approval, and again before the project goes up to the
     committee or the board (4.4.11 · 5.4.5 · 6.2.10 · 7.2.2) */
  if (approving || level === 'exec' || level === 'committee') out.push(...fundingIssues(p.id, p.amountRequested))
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
  const amount = p.amountRequested
  /* Re-audit 7 Oct · the supervisor's seat (study and confirmation) belongs to the project's own
     supervisor, not to anyone holding the role · a project with no owner waits for assignment */
  const mine = recorderOf(holder).includes(viewer) && (holder !== 'supervisor' && holder !== 'confirm' ? true : p.owner === me)
  const by = holder === 'committee' ? ' · تُسجَّل قراراتها في جلستها' : holder === 'board' ? ' · تُسجَّل قراراته في جلسته' : ''
  const say = f.awaitingReview && holder === 'manager'
    ? `بانتظار استكمال المراجعة عند مدير المنح · ${f.awaitingReview.note}`
    : `المشروع عند ${HOLDER_LABEL[holder]}${by}`
  if (!mine) return { actions: [], say, mine, holder }

  const conflict = holder !== 'supervisor' && holder !== 'confirm' ? conflictOf(p, me) : undefined
  if (conflict) {
    return {
      holder, mine, say: `تعارض مصالح: ${conflict.reason} · يُحوَّل القرار لصاحب صلاحية بديل (5.4.24)`,
      actions: [{ label: 'إحالة لصاحب صلاحية بديل', kind: 'btn-p', needsNote: true }],
    }
  }
  const up = (lvl: Holder, approving: boolean) => upBlockers(p, lvl, approving)[0]
  const planChoice = { label: 'الخطة', options: [{ value: 'yes', label: 'يتطلب خطة' }, { value: 'no', label: 'لا يتطلب خطة' }] }

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
      if (APPROVAL_RULES.managerFinal && amount <= capOf('manager')) {
        actions.push({ label: 'اعتماد نهائي', kind: 'btn-p', needsNote: true, choose: planChoice, blocked: up('manager', true) })
      }
      actions.push({ label: 'توصية بالموافقة', kind: APPROVAL_RULES.managerFinal && amount <= capOf('manager') ? 'btn-2' : 'btn-p', needsNote: true, choose: planChoice, blocked: up('manager', true) })
      actions.push({ label: 'توصية بالرفض', kind: 'btn-2', needsNote: true, blocked: up('manager', false) })
      if (amount <= APPROVAL_RULES.managerRejectUpTo) actions.push({ label: 'رفض نهائي', kind: 'btn-d', needsNote: true })
    }
    const ref = flowOf(p.id).referral
    actions.push({
      label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true,
      choose: ref ? { label: 'إلى', options: [{ value: 'supervisor', label: 'مشرف المنح' }, { value: 'consultant', label: 'المستشار ومعه المشرف' }] } : undefined,
    })
    return { holder, mine, say, actions }
  }
  if (holder === 'exec') {
    const within = amount <= levelCap('exec')
    const lim = entityLimitBlock(p, 'exec')
    const actions: DecisionAction[] = []
    if (within) actions.push({ label: 'اعتماد', kind: 'btn-p', needsNote: true, blocked: lim || up('exec', true) })
    actions.push({ label: 'إحالة للجنة التنفيذية', kind: within && !lim ? 'btn-2' : 'btn-p', needsNote: true, blocked: up('exec', false) })
    actions.push({ label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true })
    actions.push({ label: 'اعتذار', kind: 'btn-d', needsNote: true })
    return { holder, mine, say: within ? say : `${say} · المبلغ فوق حد المدير التنفيذي (${nf.format(levelCap('exec'))}) فالإحالة للجنة`, actions }
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
  | { op: 'decide'; id: string; level: Holder; verdict: Verdict; note: string; by: string; needsPlan?: boolean; target?: Rec['target'] }
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
  | { op: 'vote'; sessionId: string; projectId: string; member: string; vote: Vote }
  | { op: 'minutes'; sessionId: string; projectId: string; file: string; by: string }
  | { op: 'sessionDecide'; sessionId: string; projectId: string; outcome: Outcome; target?: Holder; note: string; payPlan?: SessionItem['payPlan']; by: string }
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

/** Final approval at a level · the path is complete, the hold is final, the supervisor confirms */
const finalise = (p: ProjectRow, f: AppFlow, level: Level, by: string) => {
  f.decided = { level, at: opDay(), by }
  f.hold = 'final'
  p.holder = 'confirm'
  p.hoursInStage = 0
  notify([p.owner ?? 'مشرف المنح'], p.id, `اكتمل اعتماد ${p.name}`, `${HOLDER_LABEL[level]} · تحقّق من الشروط وأكّد`)
}

/** A final refusal · the request closes, the hold is released, the entity reads why (4.4.18) */
const refuse = (p: ProjectRow, f: AppFlow, stage: string, note: string, by: string) => {
  p.supportStatus = 'مرفوض'
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
      const tone: LogEvent['tone'] = /approve|confirm|refer|resubmit/.test(o.verdict) ? 'ok' : o.verdict === 'return' ? 'warn' : 'no'
      const lvl = HOLDER_LABEL[o.level]
      switch (o.verdict) {
        case 'recommend-approve':
        case 'recommend-reject':
          p.holder = 'exec'; p.hoursInStage = 0
          if (o.verdict === 'recommend-approve') f.hold = linkOf(p.id) ? 'initial' : f.hold
          fields.push({ k: 'الإحالة', v: 'المدير التنفيذي' })
          notify(['المدير التنفيذي'], p.id, `توصية مدير المنح · ${p.name}`, `${VERDICT_SAY[o.verdict]} · ${o.note}`)
          break
        case 'final-approve':
          finalise(p, f, o.level as Level, o.by)
          break
        case 'final-reject':
        case 'reject':
          refuse(p, f, o.level === 'committee' ? 'مرفوض - اللجنة التنفيذية' : o.level === 'board' ? 'مرفوض - مجلس الأمناء' : 'مشروع معتذر عنه', o.note, o.by)
          fields.push({ k: 'الحجز', v: 'أُلغي وعاد المبلغ للميزانية' })
          break
        case 'approve':
          finalise(p, f, o.level as Level, o.by)
          fields.push({ k: 'الحجز', v: 'نهائي' })
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
            /* Back to study · the hold is released and the budget is checked again on the way back (4.4.17 · 6.4.9) */
            p.holder = 'supervisor'
            f.hold = 'none'
            f.awaitingReview = undefined
            /* The study tab reads the note from the intake record, where the supervisor works */
            flowOf(o.id).returnNote = o.note
            flowOf(o.id).returnStudied = undefined
            if (p.owner) notify([p.owner], p.id, `أُعيد إليك · ${p.name}`, o.note, ROUTES.projectTab(p.id, 'study'))
            fields.push({ k: 'إلى', v: to === 'consultant' ? 'المستشار ومشرف المنح' : 'مشرف المنح' }, { k: 'الحجز', v: 'أُلغي · يُعاد التحقق عند العودة' })
          } else {
            p.holder = to as Holder
            if (to === 'manager' && o.level !== 'manager') f.awaitingReview = { note: o.note, by: o.by, at: opDay() }
            fields.push({ k: 'إلى', v: HOLDER_LABEL[to as Holder] }, { k: 'الحجز', v: 'محفوظ (4.4.16 · 6.4.8)' })
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
          p.supportStatus = 'معتمد'
          if (p.amountGranted === 0) p.amountGranted = p.amountRequested
          p.decidedAt = opDay()
          p.holder = undefined
          /* Re-audit 7 Oct · 11.2.17 · an independent project through Ehsan has no agreement · it goes
             straight to execution with its plan and payment schedule */
          if (p.platform === 'منصة إحسان' && p.partnerType === 'مستقل') {
            moveTo(p, 'المشرف إذن الصرف')
            fields.push({ k: 'الحالة', v: 'معتمد · إلى التنفيذ عبر منصة إحسان · بلا اتفاقية', strong: true })
            notify([p.entityName, 'مدير المنح'], p.id, `اعتُمد المشروع · ${p.name}`, 'إلى التنفيذ عبر منصة إحسان', ROUTES.project(p.id))
            confirmHook?.(p.id, o.by)
            notify([p.owner ?? 'مشرف المنح', 'مشرف المنح'], p.id, `أعدّ خطة المشروع وجدول دفعاته · ${p.name}`, 'معفى من الاتفاقية · يُنفَّذ عبر منصة إحسان', ROUTES.project(p.id))
            break
          }
          moveTo(p, 'اعتماد الإتفاقية')
          fields.push({ k: 'الحالة', v: 'معتمد · إلى إعداد الاتفاقية', strong: true })
          notify([p.entityName, 'مدير المنح'], p.id, `اعتُمد المشروع · ${p.name}`, 'إلى إعداد الاتفاقية', ROUTES.project(p.id))
          /* 12.2.3 · a project that needs a plan gets its plan record opened with the agreement */
          confirmHook?.(p.id, o.by)
          /* 8.2.2 · the supervisor learns the project is ready for its agreement */
          notify([p.owner ?? 'مشرف المنح', 'مشرف المنح'], p.id, `مشروع جاهز لإعداد الاتفاقية · ${p.name}`, 'اكتمل الاعتماد وثبت الحجز', ROUTES.agreementNew(p.id))
          break
        case 'amend':
          /* 5.4.21 · a decision isn't deleted · it's reopened by a documented act at the deciding level */
          /* Re-audit 7 Oct · reopening the decision doesn't touch the money · the budget link stays as
             it was (final after an approval), so the approval card reads what the budget holds */
          if (f.decided) { p.holder = f.decided.level; f.decided = undefined; f.hold = linkOf(p.id)?.stage === 'final' ? 'final' : f.hold }
          fields.push({ k: 'الإجراء', v: 'أُعيد فتح القرار بإجراء رسمي موثّق' }, { k: 'الحجز', v: f.hold === 'final' ? 'يبقى نهائيًّا حتى القرار الجديد' : 'مبدئي' })
          break
      }
      event(o.id, { action: `${lvl} · ${VERDICT_SAY[o.verdict]}`, by: o.by, fields, tone, actor: o.level === 'committee' || o.level === 'board' ? 'committee' : 'staff', dept: lvl })
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
      if (i >= 0) { if (SESSIONS[i].state === 'planned') SESSIONS[i] = o.session } else SESSIONS.push(o.session)
      return
    }
    case 'agenda': {
      const s = sessionById(o.sessionId)
      if (!s || s.state === 'closed') return
      if (o.add && !s.items.some((x) => x.projectId === o.projectId)) s.items.push({ projectId: o.projectId, votes: {} })
      if (!o.add) s.items = s.items.filter((x) => x.projectId !== o.projectId || x.outcome)
      return
    }
    case 'vote': {
      const it = itemOf(o.sessionId, o.projectId)
      const pr = row(o.projectId)
      /* 6.4.21 · a member who declared a conflict with the entity doesn't vote on its project */
      if (it && !it.outcome && sessionById(o.sessionId)?.state === 'planned' && !(pr && conflictOf(pr, o.member))) it.votes[o.member] = o.vote
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
      apply({ op: 'decide', id: p.id, level: s.body, verdict, note: o.note, by: o.by, target: o.target, at: o.at })
      event(p.id, {
        action: `محضر ${HOLDER_LABEL[s.body]} · ${s.title}`, by: o.by, actor: 'committee', dept: HOLDER_LABEL[s.body],
        fields: [
          { k: 'التصويت', v: `موافقة ${tally.approve} · رفض ${tally.reject} · إعادة ${tally.return} · امتناع ${tally.abstain}`, strong: true },
          ...(o.payPlan ? [{ k: 'آلية الدفعات', v: `${o.payPlan.count} دفعات · ${o.payPlan.note}` }] : []),
        ],
        files: it.minutes ? [it.minutes] : undefined,
      })
      /* Cross · notifications · the session's decision reaches the parties (6.4.12 · 7.4.12) */
      notify([...new Set([p.owner ?? 'مشرف المنح', 'مدير المنح', 'المدير التنفيذي'])], p.id, `قرار ${HOLDER_LABEL[s.body]} · ${p.name}`, `${OUTCOME_SAY[o.outcome]}${o.note ? ` · ${o.note}` : ''}`)
      if (o.outcome === 'approve') notify([p.entityName], p.id, `اعتمد ${HOLDER_LABEL[s.body]} مشروعك · ${p.name}`, 'يتبعه تأكيد الاعتماد وإعداد الاتفاقية', ROUTES.project(p.id))
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
export function sessionItemBlockers(s: Session, it: SessionItem, outcome: Outcome): string[] {
  const p = row(it.projectId)
  if (!p) return ['المشروع غير موجود']
  const out: string[] = []
  const t = voteTally(it)
  if (t.cast < APPROVAL_RULES.quorum) out.push(`لم يكتمل النصاب · سُجّل ${nf.format(t.cast)} صوت من ${nf.format(APPROVAL_RULES.quorum)}`)
  const c = carried(it)
  const want: Vote = outcome === 'refer' ? 'approve' : outcome
  if (t.cast >= APPROVAL_RULES.quorum && c !== want) out.push(`القرار لا يطابق نتيجة التصويت${c ? ` (${VOTE_SAY[c]})` : ' · لا أغلبية'}`)
  if (!it.minutes) out.push('أرفق محضر الاجتماع أولًا')
  if (outcome === 'approve' || outcome === 'refer') out.push(...upBlockers(p, s.body, true))
  if (outcome === 'approve') {
    if (p.amountRequested > levelCap(s.body)) out.push(`المبلغ فوق حد ${HOLDER_LABEL[s.body]} · الإحالة لمجلس الأمناء`)
    if (s.body === 'committee') { const l = entityLimitBlock(p, 'committee'); if (l) out.push(l) }
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

export function decide(p: ProjectRow, level: Holder, label: string, note: string, choice: string, me: string): string[] {
  if (p.stage !== 'دراسة المشروع' || (p.holder ?? 'supervisor') !== level) return ['المشروع ليس عند هذه المحطة']
  const at = now()
  const go = (verdict: Verdict, extra: Partial<Extract<Op, { op: 'decide' }>> = {}) =>
    run({ op: 'decide', id: p.id, level, verdict, note, by: me, at, ...extra })
  const block = (approving: boolean) => upBlockers(p, level, approving)
  switch (label) {
    case 'إحالة لصاحب صلاحية بديل': run({ op: 'conflict', id: p.id, level, reason: note, by: me, at }); return []
    case 'اعتماد نهائي': { const b = block(true); if (b.length) return b; if (!choice) return ['حدّد إن كان المشروع يتطلب خطة']; go('final-approve', { needsPlan: choice === 'yes' }); settleHold(p.id, me); return [] }
    case 'توصية بالموافقة': { const b = block(true); if (b.length) return b; if (!choice) return ['حدّد إن كان المشروع يتطلب خطة (4.2.3)']; go('recommend-approve', { needsPlan: choice === 'yes' }); return [] }
    case 'توصية بالرفض': { const b = block(false); if (b.length) return b; go('recommend-reject'); return [] }
    case 'رفض نهائي': {
      if (p.amountRequested > APPROVAL_RULES.managerRejectUpTo) return ['المبلغ فوق حد الرفض النهائي لمدير المنح · يُرفع بتوصية للمدير التنفيذي (4.2.15)']
      if (hasFunding(p.id)) unlinkProject(p.id, me, 'رفض نهائي من مدير المنح')
      go('final-reject'); return []
    }
    case 'إعادة للمشرف': {
      if (hasFunding(p.id)) unlinkProject(p.id, me, 'إعادة المشروع للمشرف (4.4.17)')
      const target = choice === 'consultant' ? 'consultant' : 'supervisor'
      go('return', { target })
      if (target === 'consultant') { const r = flowOf(p.id).referral; if (r) referConsultant(p.id, r.consultant, me) }
      return []
    }
    case 'أعد الإرسال للمدير التنفيذي': { const b = block(false); if (b.length) return b; go('resubmit'); return [] }
    case 'اعتماد': {
      if (p.amountRequested > levelCap('exec')) return [`المبلغ فوق حد المدير التنفيذي (${nf.format(levelCap('exec'))}) · الإحالة للجنة (5.4.11)`]
      const lim = entityLimitBlock(p, 'exec'); if (lim) return [lim, 'تُحال للجنة التنفيذية']
      const b = block(true); if (b.length) return b
      go('approve'); settleHold(p.id, me); return []
    }
    case 'إحالة للجنة التنفيذية': { const b = block(false); if (b.length) return b; go('refer'); return [] }
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
export function castVote(sessionId: string, projectId: string, member: string, vote: Vote, by: string): string[] {
  if (member !== by) return ['يصوّت العضو بنفسه من حسابه']
  const s = sessionById(sessionId)
  const p = row(projectId)
  if (!s?.members.includes(member)) return ['ليس عضوًا في هذه الجلسة']
  if (p && conflictOf(p, member)) return ['أُعلن تعارض مصالح مع الجهة · لا يصوّت على مشروعها']
  run({ op: 'vote', sessionId, projectId, member, vote, at: now() })
  return []
}
export const attachMinutes = (sessionId: string, projectId: string, file: string, by: string) => run({ op: 'minutes', sessionId, projectId, file, by, at: now() })
export const decideInSession = (sessionId: string, projectId: string, outcome: Outcome, note: string, by: string, target?: Holder, payPlan?: SessionItem['payPlan']) => {
  const p = row(projectId)
  if (p && (outcome === 'reject' || (outcome === 'return' && target === 'supervisor')) && linkOf(projectId)) {
    unlinkProject(projectId, by, outcome === 'reject' ? 'رفض في الجلسة' : 'إعادة للدراسة أو لتعديل جوهري · يُعاد التحقق عند العودة (6.4.9)')
  }
  run({ op: 'sessionDecide', sessionId, projectId, outcome, target, note, payPlan, by, at: now() })
  settleHold(projectId, by)
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
  projectRows.filter((p) => p.stage === 'دراسة المشروع' && p.holder === body)

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
