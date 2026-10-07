import { useSyncExternalStore } from 'react'
import {
  TODAY, payRequestById, payRequests, type PaySlot, type PaySlotState,
} from '@/data/mock/disbursements'
import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { banksOf } from '@/data/mock/payEntity'
import { agreementsOfProject, inForceOf } from '@/data/agreements/store'
import { docOf, linkOf, payYearIssue, recordPaid } from '@/data/budget/store'
import { docTitle } from '@/data/mock/budgetTree'
import { unmetBefore } from '@/data/approvals/store'
import { roleByKey, type RoleKey } from '@/data/roles'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import type { DecisionKind, PayCheck, PayDoc, PayException, PayRequest } from '@/types/domain'

/* Disbursement (BPD-009) · the actions.

   The fixture builds the requests already in the system; this store moves them and keeps every
   move. Same model as the other procedures: an ordered list of operations kept in the browser and
   replayed at load, so a reload lands on the same state; in production each operation is a POST.
   Every operation carries its own ids, so a replay rebuilds the same records.

   What the fixture alone couldn't hold:
   · the opening · a request is created by the entity from its portal (9.2.2), or a permit by the
     supervisor that waits for the entity's justification (9.1.input-4), and lands in a queue
   · the path · every decision moves the request: recommend or return (9.2.7), approve, return or
     reject (9.2.13 · 9.4.15), approve the order or return it (9.2.15), transfer (9.2.17)
   · the controls · a payment's condition (9.4.6), the agreement in force and the hold (9.4.10 ·
     9.4.11), the grant's ceiling (9.4.14) and the order before the transfer (9.4.9) stop the
     forward exits with their reason, they don't only colour a cell
   · the trace · special approvals and exceptions (9.1.input-6), the transfer's proof, and every
     transition in the log with its notification (rules 16 · 17) */

/* ── Notifications · read by the drawer ── */

export interface PayNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const PAY_NOTES: PayNote[] = []
const notify = (to: string[], r: PayRequest, title: string, href = ROUTES.payment(r.id)) => {
  for (const t of to) PAY_NOTES.unshift({ id: `pay-${PAY_NOTES.length + 1}`, to: t, title, context: `${r.projectName} · الدفعة ${r.no} من ${r.of}`, at: TODAY, href })
}
const MGR = () => roleByKey('grants-manager').title
const FIN = 'الإدارة المالية'

/* ── Readers ── */

const projectOf = (id: string) => projectRows.find((p) => p.id === id)
const isOpen = (r: PayRequest) => r.state !== 'paid' && r.state !== 'closed'

/** 9.4.1 · the agreement in force · the agreements store decides when the project has rows there */
/** Projects whose money another channel executes · the partners store registers Ehsan's (11.2.17) ·
    a registry, not an import, so the two stores stay one-way */
let ehsanGate: (projectId: string) => string = () => ''
export const setEhsanGate = (f: (projectId: string) => string) => { ehsanGate = f }
export const routedElsewhere = (projectId: string): string => ehsanGate(projectId)

export function agreementOk(projectId: string): boolean {
  if (agreementsOfProject(projectId).length) return Boolean(inForceOf(projectId))
  const own = payRequests.find((r) => r.projectId === projectId)
  return own ? own.agreement.active : false
}

/** What's left of the grant before a request · paid requests only (rule 14) */
export const paidOf = (projectId: string, except?: string): number =>
  payRequests.filter((r) => r.projectId === projectId && r.state === 'paid' && r.id !== except).reduce((s, r) => s + r.asked, 0)
export const grantOf = (projectId: string): number => {
  const p = projectOf(projectId)
  return p ? (p.amountGranted || p.amountRequested) : 0
}
export const grantLeft = (projectId: string, except?: string): number => grantOf(projectId) - paidOf(projectId, except)

/** The hold still open on the project's lines · rule 11 · undefined when it has no link */
export const holdLeft = (projectId: string): number | undefined => {
  const l = linkOf(projectId)
  return l ? l.shares.reduce((s, x) => s + x.amount - x.paid, 0) : undefined
}

/** The entity's representative · from the agreement in force (9.1.input-3) */
const REP_NAMES = ['خالد الزهراني', 'منى العتيبي', 'سعد القحطاني', 'نورة الحربي', 'ماجد الشهري']
const REP_TITLES = ['الرئيس التنفيذي', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'المدير العام']
export function repOf(projectId: string): { name: string; title: string } {
  const a = inForceOf(projectId) ?? agreementsOfProject(projectId)[0]
  if (a) return { ...a.signer }
  const n = Number(projectId) || 0
  return { name: REP_NAMES[n % REP_NAMES.length]!, title: REP_TITLES[n % REP_TITLES.length]! }
}

/* ── The schedule (9.1.input-2 · 9.4.2) ── */

/** Conditions on payments that carry no request yet · the agreement's requirement, else the fixture's */
const SLOT_CONDITIONS = ['رفع التقرير المرحلي الأول', 'اكتمال المرحلة الأولى من خطة التنفيذ', 'تسليم كشف المستفيدين المسجَّلين']
/** Conditions the supervisor confirmed · `projectId:no` */
const CONDS = new Map<string, { by: string; at: string; note: string }>()
const condKey = (projectId: string, no: number) => `${projectId}:${no}`
export const condConfirmed = (projectId: string, no: number) => CONDS.get(condKey(projectId, no))

export function scheduleOf(projectId: string): PaySlot[] {
  const all = payRequests.filter((r) => r.projectId === projectId)
  const first = all[0]
  const ag = inForceOf(projectId)
  let base: { no: number; amount: number; dueAt: string; requirement?: string }[] = []
  if (first) {
    const of = first.of
    const even = Math.round(first.granted / of / 1000) * 1000
    for (let no = 1; no <= of; no++) {
      const req = all.find((r) => r.no === no)
      const d = new Date(first.dueAt)
      d.setMonth(d.getMonth() + (no - first.no) * 2)
      base.push({
        no, amount: no === of ? first.granted - even * (of - 1) : even, dueAt: req?.dueAt ?? d.toISOString().slice(0, 10),
        requirement: req?.condition ?? ((no + Number(projectId)) % 2 === 0 ? SLOT_CONDITIONS[no % SLOT_CONDITIONS.length] : undefined),
      })
    }
  } else if (ag) {
    base = ag.payments.map((p) => ({ no: p.no, amount: p.amount, dueAt: p.dueAt, requirement: p.requirement }))
  }
  /* 10.9.5 · 10.9.6 · an approved value change cuts the unpaid payments from the last, or adds one */
  const adj = ADJUST.get(projectId)
  if (adj?.cut) {
    let cut = adj.cut
    for (let i = base.length - 1; i >= 0 && cut > 0; i--) {
      const b = base[i]!
      if (all.some((r) => r.no === b.no && r.state === 'paid')) continue
      const x = Math.min(cut, b.amount)
      b.amount -= x
      cut -= x
    }
    base = base.filter((b) => b.amount > 0 || all.some((r) => r.no === b.no))
  }
  for (const e of adj?.extra ?? []) base.push({ no: base.length + 1, amount: e.amount, dueAt: e.dueAt })
  const of = base.length
  const stopped = STOPPED.has(projectId)
  return base.map((b): PaySlot => {
    const reqs = all.filter((r) => r.no === b.no)
    const open = reqs.find(isOpen)
    const paid = reqs.find((r) => r.state === 'paid')
    const req = open ?? paid ?? reqs[reqs.length - 1]
    const own = open ?? paid
    const conditionMet = !b.requirement || Boolean(condConfirmed(projectId, b.no))
      || (own ? (own.checks.find((c) => c.rule === 6)?.ok ?? true) : false)
    const state: PaySlotState =
      paid ? 'paid'
      : stopped ? 'stopped'
      : SETTLED.has(condKey(projectId, b.no)) ? 'settled'
      : open ? 'pending'
      : b.dueAt > TODAY ? 'early'
      : b.requirement && !conditionMet ? 'held'
      : 'open'
    return { no: b.no, of, amount: b.amount, dueAt: b.dueAt, condition: b.requirement, conditionMet, state, requestId: req?.id }
  })
}

/* ── Closing and distress (BPD-010) · what they do to the schedule ── */

const STOPPED = new Map<string, { by: string; at: string; note: string }>()
const SETTLED = new Map<string, { by: string; at: string; note: string }>()
const ADJUST = new Map<string, { cut: number; extra: { amount: number; dueAt: string }[] }>()
export const isStopped = (projectId: string) => STOPPED.has(projectId)
export const settledOf = (projectId: string, no: number) => SETTLED.get(condKey(projectId, no))

/** 10.4.2 · what still owes a payment · due ones block opening closure, any of them blocks final closing */
export function unsettledSlots(projectId: string): { due: PaySlot[]; future: PaySlot[] } {
  const slots = scheduleOf(projectId).filter((s) => s.state !== 'paid' && s.state !== 'settled' && s.state !== 'stopped')
  return { due: slots.filter((s) => s.dueAt <= TODAY || s.state === 'pending'), future: slots.filter((s) => s.dueAt > TODAY && s.state !== 'pending') }
}

export interface PayProject { id: string; name: string; entity: string; entityId: string; can: boolean; why?: string; open: number }

/** Projects that can request · 9.4.1 · under execution with the agreement in force · reason when not */
export function payableProjects(entityId?: string): PayProject[] {
  const ids = new Set<string>(payRequests.map((r) => r.projectId))
  for (const a of agreements) if (inForceOf(a.projectId)) ids.add(a.projectId)
  const out: PayProject[] = []
  for (const id of ids) {
    const p = projectOf(id)
    if (!p || (entityId && p.entityId !== entityId) || ehsanGate(id)) continue
    const running = p.statusGroup === 'في التشغيل' && !p.stage.includes('الإتفاقي')
    const agr = agreementOk(id)
    const slots = scheduleOf(id)
    if (!slots.length) continue
    out.push({
      id, name: p.name, entity: p.entityName, entityId: p.entityId, can: running && agr && !STOPPED.has(id),
      why: STOPPED.has(id) ? 'أُوقف المشروع بقرار معتمد · لا صرف بعده (10.9.1)'
        : !agr ? 'الاتفاقية غير سارية · لا صرف قبل تفعيل الاتفاقية (القاعدة 1)'
        : !running ? 'المشروع ليس «تحت التنفيذ» · لا يُفتح طلب صرف لمشروع مكتمل أو موقوف (9.4.1)'
        : undefined,
      open: slots.filter((s) => s.state === 'open').length,
    })
  }
  return out.sort((a, b) => Number(b.can) - Number(a.can) || b.open - a.open)
}

/* ── Live checks · recomputed on every move, so a blocked request says which rule blocks it ── */

const WAIVED = new Set<string>()
const waived = (id: string, rule: number) => WAIVED.has(`${id}:${rule}`)

function refresh(r: PayRequest) {
  if (!isOpen(r)) return
  const ag = inForceOf(r.projectId)
  r.agreement.active = agreementOk(r.projectId)
  if (ag) r.agreement.id = ag.id
  r.spent = paidOf(r.projectId, r.id)
  const hold = holdLeft(r.projectId)
  const set = (rule: number, label: string, ok: boolean) => {
    const c = r.checks.find((x) => x.rule === rule)
    const w = waived(r.id, rule)
    const lab = w ? `${label} · باستثناء معتمد` : label
    if (c) { c.ok = ok || w; c.label = lab } else r.checks.push({ rule, label: lab, ok: ok || w })
  }
  const c3 = r.checks.find((x) => x.rule === 3)
  set(3, 'المرفقات والمستندات مكتملة', c3?.ok ?? true)
  if (r.condition) set(6, 'شرط الدفعة مستوفى', (r.checks.find((x) => x.rule === 6)?.ok ?? false) || Boolean(condConfirmed(r.projectId, r.no)))
  set(10, 'الاتفاقية سارية', r.agreement.active)
  const c11 = r.checks.find((x) => x.rule === 11)
  set(11, 'المبلغ المحجوز متوفّر', hold === undefined ? (c11?.ok ?? true) : hold >= r.asked)
  r.checks.sort((a, b) => a.rule - b.rule)
}
const refreshAll = () => { for (const r of payRequests) refresh(r) }

const STOP_SAY: Record<number, string> = { 3: 'المرفقات والمستندات غير مكتملة', 6: 'شرط الدفعة غير مستوفى', 10: 'الاتفاقية غير سارية', 11: 'المبلغ المحجوز غير متوفّر' }

/** Why a forward exit is stopped · empty when it may pass */
export type PayAct = 'recommend' | 'returnEntity' | 'approve' | 'returnSup' | 'reject' | 'order' | 'returnFin' | 'transfer'
export function payStops(r: PayRequest, act: PayAct): string[] {
  if (['returnEntity', 'returnSup', 'reject', 'returnFin'].includes(act)) return []
  const out: string[] = []
  /* 9.2.7 · the supervisor recommends on the request's own file · rules 10 and 11 are checked at
     referral to finance (9.2.14) */
  const rules = act === 'recommend' ? [3, 6] : [3, 6, 10, 11]
  for (const c of r.checks) if (!c.ok && rules.includes(c.rule)) out.push(`${STOP_SAY[c.rule] ?? c.label} · قاعدة ${c.rule}`)
  const left = grantLeft(r.projectId, r.id)
  if (r.asked > left) out.push(`المبلغ يتجاوز المتبقي من المنحة (${nf.format(Math.max(0, left))}) · قاعدة 14`)
  if (r.asked > r.due) out.push('قيمة الطلب أعلى من الدفعة المعتمدة · قاعدة 5')
  if (act !== 'recommend') {
    const y = payYearIssue(r.projectId, r.dueAt, r.asked)
    if (y) out.push(`${y} · 1.4.52`)
    if (r.no === 1) for (const c of unmetBefore(r.projectId, 'firstPay')) out.push(`شرط قبل الدفعة الأولى لم يُستوفَ: ${c.text}`)
  }
  if (act === 'order' || act === 'transfer') if (!r.bank.active) out.push('الحساب البنكي المعتمد غير نشط · المخرج 2')
  if (act === 'transfer' && !r.order) out.push('لم تعتمد الإدارة المالية أمر الصرف بعد · قاعدة 9')
  return out
}

export interface PayAction { act: PayAct; label: string; kind: DecisionKind; needsNote?: boolean; needsFile?: string; step: number }

/** This role's exits at this stage · empty means the request isn't theirs (9.2.7 · 9.2.13 · 9.2.15 · 9.2.17) */
export function payActions(r: PayRequest, role: RoleKey, asEntity = false): PayAction[] {
  if (asEntity) return []
  if (r.state === 'supervisor' && role === 'supervisor') return [
    { act: 'recommend', label: 'توصية بالموافقة', kind: 'btn-p', step: 7 },
    { act: 'returnEntity', label: 'إعادة للجهة', kind: 'btn-2', needsNote: true, step: 7 },
  ]
  if (r.state === 'manager' && role === 'grants-manager') return [
    { act: 'approve', label: 'موافقة وإحالة للمالية', kind: 'btn-p', step: 13 },
    { act: 'returnSup', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true, step: 13 },
    /* Rule 15 · closing isn't deleting · the log stays readable */
    { act: 'reject', label: 'رفض نهائي وإغلاق', kind: 'btn-d', needsNote: true, step: 13 },
  ]
  /* Re-audit 7 Oct · the finance officer's own seat (9.2.15 · 9.2.17) */
  if (r.state === 'finance' && role === 'finance') return r.order
    ? [{ act: 'transfer', label: 'تنفيذ التحويل', kind: 'btn-p', needsFile: 'إثبات التحويل', step: 17 }]
    : [
        { act: 'order', label: 'اعتماد أمر الصرف', kind: 'btn-p', step: 15 },
        { act: 'returnFin', label: 'إعادة بملاحظة', kind: 'btn-2', needsNote: true, step: 15 },
      ]
  return []
}

/** Rule 18 · the entity edits only a request returned to it · after approval a change is a new request */
export const mayResubmit = (r: PayRequest): boolean => r.state === 'returned'

/** Special approvals and waivers stay open until finance approves the order (9.1.input-6) */
export const mayRecordException = (r: PayRequest, role: RoleKey): boolean =>
  isOpen(r) && !r.order && (role === 'supervisor' || role === 'grants-manager')

/** The entity's view of its requests (9.4.19) */
export const requestsOfEntity = (entityId: string): PayRequest[] =>
  payRequests.filter((r) => r.entityId === entityId)

/* ── Operations ── */

type Op = { at: string; by: string } & (
  | { op: 'create'; id: string; projectId: string; no: number; asked: number; docs: PayDoc[]; origin: 'entity' | 'supervisor'; note?: string }
  | { op: 'resubmit'; id: string; asked: number; docs: PayDoc[] }
  | { op: 'act'; id: string; act: PayAct; note: string; file?: string }
  | { op: 'cond'; projectId: string; no: number; note: string }
  | { op: 'exception'; id: string; ex: PayException }
  | { op: 'stop'; projectId: string; note: string }
  | { op: 'settle'; projectId: string; no: number; note: string }
  | { op: 'adjust'; projectId: string; cut?: number; extra?: { amount: number; dueAt: string } }
)

const KEY = 'ab-pay-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export function usePayments(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}
const now = () => new Date().toISOString()
const day = (iso: string) => iso.slice(0, 10)

const log = (r: PayRequest, step: number, who: string, role: string, what: string, at: string, note?: string, notified?: string) => {
  r.log.push({ at: day(at), who, role, what, step, note, notified })
}
const move = (r: PayRequest, s: PayRequest['state']) => { r.state = s; r.hoursInState = 0 }
const ENTITY_ROLE = 'الجهة المستفيدة'

function apply(o: Op) {
  switch (o.op) {
    case 'create': {
      if (payRequestById(o.id)) return
      const p = projectOf(o.projectId)
      const slot = scheduleOf(o.projectId).find((s) => s.no === o.no)
      if (!p || !slot) return
      const bank = banksOf(p.entityId)[0]
      const l = linkOf(p.id)
      const total = l?.shares.reduce((s, x) => s + x.amount, 0) ?? 0
      const sources = l && total
        ? l.shares.map((x) => ({ name: (() => { const d = docOf(x.docId); return d ? docTitle(d) : 'ميزانية المنح' })(), share: Math.round((x.amount / total) * 100) }))
        : [{ name: 'ميزانية المنح 2026', share: 100 }]
      const ag = inForceOf(p.id)
      const first = payRequests.find((x) => x.projectId === p.id)
      const docsOk = o.docs.length >= REQUEST_NEEDS.length
      const r: PayRequest = {
        id: o.id, projectId: p.id, projectName: p.name, entityId: p.entityId, entityName: p.entityName,
        no: slot.no, of: slot.of, due: slot.amount, asked: o.asked, dueAt: slot.dueAt,
        state: o.origin === 'entity' ? 'supervisor' : 'returned', hoursInState: 0,
        condition: slot.condition,
        checks: [
          { label: 'المرفقات والمستندات مكتملة', ok: docsOk, rule: 3 },
          ...(slot.condition ? [{ label: 'شرط الدفعة مستوفى', ok: slot.conditionMet, rule: 6 } as PayCheck] : []),
        ],
        bank: { name: bank?.bank ?? 'مصرف الراجحي', active: bank?.active ?? true },
        sources, owner: p.owner ?? roleByKey('supervisor').name, at: day(o.at),
        agreement: { id: ag?.id ?? `AG-${p.id}`, active: agreementOk(p.id), endsAt: p.endAt ?? first?.agreement.endsAt ?? '' },
        granted: grantOf(p.id), spent: paidOf(p.id), reserved: slot.amount, docs: o.docs, log: [],
        origin: o.origin, permit: o.origin === 'supervisor', rep: repOf(p.id), exceptions: [],
        note: o.origin === 'supervisor' ? (o.note?.trim() || 'إذن صرف من مشرف المنح · أرفق التقارير والمستندات وأرسل الطلب') : undefined,
      }
      payRequests.push(r)
      refresh(r)
      log(r, 1, 'النظام', 'النظام', 'أتاح إنشاء طلب الصرف · استحقت الدفعة واستُوفيت شروط التقديم', o.at)
      if (o.origin === 'entity') {
        log(r, 2, o.by, ENTITY_ROLE, `أنشأت طلب الصرف وأرفقت ${o.docs.length} من التقارير والمستندات · ${r.rep?.name} · ${r.rep?.title}`, o.at)
        log(r, 3, 'النظام', 'النظام', 'تحقّق من اكتمال البيانات والمتطلبات الإلزامية', o.at)
        log(r, 4, 'النظام', 'النظام', 'أرسل الطلب إلى مشرف المنح', o.at, undefined, 'مشرف المنح · طلب صرف جديد')
        notify([r.owner], r, 'طلب صرف جديد بانتظار مراجعتك')
      } else {
        log(r, 2, o.by, 'مشرف المنح', 'أنشأ إذن الصرف وأرسله إلى الجهة لإرفاق المسوّغات', o.at, r.note, 'الجهة المستفيدة · إذن صرف بانتظار مسوّغاتك')
        notify([r.entityName], r, 'إذن صرف بانتظار مسوّغاتك', `${ROUTES.payment(r.id)}?as=entity`)
      }
      return
    }
    case 'resubmit': {
      const r = payRequestById(o.id)
      if (!r || r.state !== 'returned') return
      r.asked = o.asked
      for (const d of o.docs) {
        const i = r.docs.findIndex((x) => x.kind === d.kind)
        if (i >= 0) r.docs[i] = d
        else r.docs.push(d)
      }
      const c3 = r.checks.find((c) => c.rule === 3)
      if (c3) c3.ok = REQUEST_NEEDS.every((n) => r.docs.some((d) => d.kind === n.kind))
      const wasPermit = r.permit
      r.permit = false
      r.note = undefined
      r.returnedBy = undefined
      move(r, 'supervisor')
      refresh(r)
      log(r, 11, o.by, ENTITY_ROLE, wasPermit ? 'أرفقت المسوّغات وأرسلت الطلب' : 'استكملت الملاحظات وأعادت إرسال الطلب', o.at)
      log(r, 4, 'النظام', 'النظام', 'أرسل الطلب إلى مشرف المنح', o.at, undefined, 'مشرف المنح · طلب صرف مُعاد إرساله')
      notify([r.owner], r, wasPermit ? 'وصلت مسوّغات إذن الصرف من الجهة' : 'أعادت الجهة إرسال طلب الصرف')
      return
    }
    case 'act': {
      const r = payRequestById(o.id)
      if (!r) return
      const note = o.note.trim() || undefined
      switch (o.act) {
        case 'recommend':
          if (r.state !== 'supervisor') return
          move(r, 'manager')
          log(r, 5, o.by, 'مشرف المنح', 'راجع الطلب وتحقّق من المتطلبات والتقارير', o.at)
          log(r, 7, o.by, 'مشرف المنح', 'سجّل التوصية بالموافقة', o.at, note)
          log(r, 12, 'النظام', 'النظام', 'أرسل الطلب إلى مدير المنح', o.at, undefined, 'مدير المنح · طلب بانتظار الاعتماد')
          notify([MGR()], r, 'طلب صرف بانتظار اعتمادك')
          return
        case 'returnEntity':
          if (r.state !== 'supervisor' || !note) return
          r.note = note; r.returnedBy = 'supervisor'
          move(r, 'returned')
          log(r, 7, o.by, 'مشرف المنح', 'أعاد الطلب للجهة مع توضيح الملاحظات', o.at, note)
          log(r, 10, 'النظام', 'النظام', 'حدّث حالة الطلب وأشعر الجهة بالملاحظات', o.at, undefined, 'الجهة المستفيدة · الطلب مُعاد للاستكمال')
          notify([r.entityName], r, 'طلب الصرف مُعاد للاستكمال', `${ROUTES.payment(r.id)}?as=entity`)
          return
        case 'approve':
          if (r.state !== 'manager') return
          move(r, 'finance')
          r.note = undefined
          log(r, 13, o.by, 'مدير المنح', 'راجع الطلب واعتمده', o.at, note)
          log(r, 14, 'النظام', 'النظام', 'تحقّق من سريان الاتفاقية وتوفّر المبلغ المحجوز، ثم أرسل الطلب إلى الإدارة المالية', o.at, undefined, 'الإدارة المالية · طلب بانتظار أمر الصرف')
          notify([FIN, roleByKey('finance').name], r, 'طلب صرف بانتظار أمر الصرف')
          return
        case 'returnSup':
          if (r.state !== 'manager' || !note) return
          r.note = note; r.returnedBy = 'manager'
          move(r, 'supervisor')
          log(r, 13, o.by, 'مدير المنح', 'أعاد الطلب إلى مشرف المنح', o.at, note, 'مشرف المنح · طلب مُعاد من مدير المنح')
          notify([r.owner], r, 'أعاد مدير المنح طلب الصرف')
          return
        case 'reject':
          if (r.state !== 'manager' || !note) return
          r.note = note; r.closedAt = day(o.at)
          move(r, 'closed')
          log(r, 13, o.by, 'مدير المنح', 'رفض الطلب رفضًا نهائيًّا وأغلقه مع الاحتفاظ بسجله', o.at, note, 'الجهة المستفيدة · رُفض طلب الصرف')
          notify([r.entityName], r, 'رُفض طلب الصرف نهائيًّا', `${ROUTES.payment(r.id)}?as=entity`)
          notify([r.owner], r, 'رفض مدير المنح طلب الصرف')
          return
        case 'order':
          if (r.state !== 'finance' || r.order) return
          r.order = { at: day(o.at), by: o.by }
          log(r, 15, o.by, FIN, 'راجعت الطلب واعتمدت أمر الصرف', o.at, note)
          log(r, 16, 'النظام', 'النظام', 'أنشأ أمر الصرف وربطه بالمشروع والاتفاقية والدفعة ومصادر التمويل', o.at)
          return
        case 'returnFin':
          if (r.state !== 'finance' || r.order || !note) return
          r.note = note; r.returnedBy = 'finance'
          move(r, 'manager')
          log(r, 15, o.by, FIN, 'أعادت الطلب إلى مدير المنح بملاحظة', o.at, note, 'مدير المنح · طلب مُعاد من الإدارة المالية')
          notify([MGR()], r, 'أعادت الإدارة المالية طلب الصرف')
          return
        case 'transfer': {
          if (r.state !== 'finance' || !r.order || !o.file) return
          const b = banksOf(r.entityId).find((x) => x.bank === r.bank.name) ?? banksOf(r.entityId)[0]
          r.transfer = { at: day(o.at), by: o.by, bank: r.bank.name, iban: b?.iban ?? '', proof: o.file }
          r.paidAt = day(o.at)
          r.docs.push({ name: o.file, kind: 'إثبات التحويل', at: day(o.at), size: '—' })
          move(r, 'paid')
          r.checks = r.checks.map((c) => ({ ...c, ok: true }))
          log(r, 17, o.by, FIN, `نفّذت التحويل إلى الحساب البنكي المعتمد · ${r.bank.name}`, o.at)
          log(r, 18, 'النظام', 'النظام', 'حدّث حالة الدفعة إلى (تم الصرف) وحوّل المبلغ من محجوز إلى مصروف', o.at)
          log(r, 19, 'النظام', 'النظام', 'أشعر الجهة بتنفيذ الصرف', o.at, undefined, 'الجهة المستفيدة · نُفّذ الصرف')
          notify([r.entityName], r, 'نُفّذ صرف الدفعة', `${ROUTES.payment(r.id)}?as=entity`)
          notify([r.owner], r, 'نُفّذ صرف الدفعة')
          return
        }
      }
      return
    }
    case 'cond': {
      CONDS.set(condKey(o.projectId, o.no), { by: o.by, at: day(o.at), note: o.note })
      const r = payRequests.find((x) => x.projectId === o.projectId && x.no === o.no && isOpen(x))
      if (r) {
        const c = r.checks.find((x) => x.rule === 6)
        if (c) c.ok = true
        log(r, 5, o.by, 'مشرف المنح', 'أكّد استيفاء شرط الدفعة', o.at, o.note)
      }
      return
    }
    /* 10.9.1 · 10.9.4 · a stop closes the open requests (their log stays) and holds every future payment */
    case 'stop': {
      STOPPED.set(o.projectId, { by: o.by, at: day(o.at), note: o.note })
      for (const r of payRequests.filter((x) => x.projectId === o.projectId && isOpen(x))) {
        r.note = `أُوقف المشروع بقرار معتمد · ${o.note}`
        r.closedAt = day(o.at)
        move(r, 'closed')
        log(r, 13, o.by, 'الرئيس التنفيذي', 'أُغلق الطلب بقرار إيقاف المشروع', o.at, o.note, 'الجهة المستفيدة · أُوقف المشروع')
      }
      return
    }
    case 'settle':
      SETTLED.set(condKey(o.projectId, o.no), { by: o.by, at: day(o.at), note: o.note })
      return
    case 'adjust': {
      const a = ADJUST.get(o.projectId) ?? { cut: 0, extra: [] }
      if (o.cut) a.cut += o.cut
      if (o.extra) a.extra.push(o.extra)
      ADJUST.set(o.projectId, a)
      return
    }
    case 'exception': {
      const r = payRequestById(o.id)
      if (!r || !isOpen(r) || r.order) return
      r.exceptions = [...(r.exceptions ?? []), o.ex]
      if (o.ex.kind === 'waiver' && o.ex.rule) WAIVED.add(`${r.id}:${o.ex.rule}`)
      const step = r.state === 'manager' ? 13 : 5
      log(r, step, o.ex.by, o.ex.role, o.ex.kind === 'waiver' ? `سجّل استثناءً من القاعدة ${o.ex.rule}` : 'سجّل موافقة خاصة على الطلب', o.at, o.ex.text)
      return
    }
  }
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); apply(o); refreshAll(); save(); emit() }

/** What a request carries · rule 3 · each one a file, the representative's acknowledgment beside them */
export const REQUEST_NEEDS: { kind: string; label: string }[] = [
  { kind: 'تقرير', label: 'التقرير المرحلي للفترة السابقة' },
  { kind: 'كشف', label: 'كشف المستفيدين المسجَّلين' },
  { kind: 'فواتير', label: 'فواتير ومستندات الصرف السابق' },
]

/* ── Seed · the fixture's requests take their origin, representative and live checks ── */

function seed() {
  for (const r of payRequests) {
    r.origin ??= 'entity'
    r.rep ??= repOf(r.projectId)
    r.exceptions ??= []
    /* A request already with finance past the manager has its order once the fixture says so ·
       half of them, so both stations of the finance desk show */
    if (r.state === 'paid') {
      const at = r.log.find((e) => e.step === 15)?.at ?? r.paidAt ?? r.at
      r.order = { at, by: 'ريم الشمري' }
      const b = banksOf(r.entityId).find((x) => x.bank === r.bank.name)
      r.transfer = { at: r.paidAt ?? at, by: 'ريم الشمري', bank: r.bank.name, iban: b?.iban ?? '', proof: 'إشعار التحويل البنكي.pdf' }
    }
  }
  const fin = payRequests.filter((r) => r.state === 'finance')
  fin.forEach((r, i) => {
    if (i % 2) return
    const at = r.log[r.log.length - 1]?.at ?? r.at
    r.order = { at, by: 'ريم الشمري' }
    r.log.push({ at, who: 'ريم الشمري', role: FIN, what: 'راجعت الطلب واعتمدت أمر الصرف', step: 15 })
    r.log.push({ at, who: 'النظام', role: 'النظام', what: 'أنشأ أمر الصرف وربطه بالمشروع والاتفاقية والدفعة ومصادر التمويل', step: 16 })
  })
}

function hydrate() {
  seed()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  refreshAll()
  for (const o of ops) { apply(o); refreshAll() }
}
hydrate()

/* ── Actions ── */

export const nextRequestId = (): string => `SR-2026-${String(11_400 + payRequests.length).padStart(5, '0')}`

/** 9.2.2 · the entity's request · or 9.1.input-4 · the supervisor's permit */
export function createRequest(v: { projectId: string; no: number; asked: number; docs: PayDoc[]; origin: 'entity' | 'supervisor'; note?: string }, by: string): { id?: string; errors: string[] } {
  const p = payableProjects().find((x) => x.id === v.projectId)
  if (!p) return { errors: ['المشروع غير متاح للصرف'] }
  if (!p.can) return { errors: [p.why ?? 'المشروع غير متاح للصرف'] }
  const slot = scheduleOf(v.projectId).find((s) => s.no === v.no)
  if (!slot) return { errors: ['الدفعة غير موجودة في الجدول'] }
  const errors: string[] = []
  if (slot.state === 'pending') errors.push('للدفعة طلب مفتوح · قاعدة 4')
  if (slot.state === 'paid') errors.push('الدفعة مصروفة')
  if (slot.state === 'early') errors.push('الدفعة لم تستحق بعد · قاعدة 2')
  if (slot.state === 'held') errors.push('شرط الدفعة غير مستوفى · قاعدة 6')
  if (slot.state === 'stopped') errors.push('أُوقف المشروع بقرار · لا صرف بعده')
  if (slot.state === 'settled') errors.push('سُوّيت الدفعة · لا تُصرف')
  if (v.asked <= 0) errors.push('أدخل قيمة الطلب')
  if (v.asked > slot.amount) errors.push('القيمة أعلى من الدفعة المعتمدة · قاعدة 5')
  if (v.asked > grantLeft(v.projectId)) errors.push('القيمة تتجاوز المتبقي من المنحة · قاعدة 14')
  if (v.origin === 'entity' && v.docs.length < REQUEST_NEEDS.length) errors.push('ينقص من المتطلبات · قاعدة 3')
  if (errors.length) return { errors }
  const id = nextRequestId()
  run({ op: 'create', id, ...v, by, at: now() })
  return { id, errors: [] }
}

/** 9.2.11 · the entity completes the notes and resubmits */
export function resubmitRequest(id: string, asked: number, docs: PayDoc[], by: string): string[] {
  const r = payRequestById(id)
  if (!r) return ['الطلب غير موجود']
  if (!mayResubmit(r)) return ['لا يُعدَّل الطلب بعد اعتماده · التعديل بطلب جديد (قاعدة 18)']
  if (asked <= 0 || asked > r.due) return ['القيمة أعلى من الدفعة المعتمدة · قاعدة 5']
  if (asked > grantLeft(r.projectId, r.id)) return ['القيمة تتجاوز المتبقي من المنحة · قاعدة 14']
  const have = new Set([...r.docs.map((d) => d.kind), ...docs.map((d) => d.kind)])
  if (REQUEST_NEEDS.some((n) => !have.has(n.kind))) return ['ينقص من المتطلبات · قاعدة 3']
  run({ op: 'resubmit', id, asked, docs, by, at: now() })
  return []
}

/** A decision on the request · the store refuses what its stage or controls don't allow */
export function actOnPay(id: string, act: PayAct, note: string, by: string, role: RoleKey, file?: string): string[] {
  const r = payRequestById(id)
  if (!r) return ['الطلب غير موجود']
  const a = payActions(r, role).find((x) => x.act === act)
  if (!a) return ['الإجراء غير متاح لك في هذه المرحلة']
  if (a.needsNote && !note.trim()) return ['اكتب الملاحظات أولًا · القاعدتان 7 و8']
  if (a.needsFile && !file) return [`ارفع ${a.needsFile} أولًا`]
  const stops = payStops(r, act)
  if (stops.length) return stops
  run({ op: 'act', id, act, note, file, by, at: now() })
  /* 1.4.30 · the transfer turns the held amount paid on each funding share · the budget keeps its
     own operation, so it isn't replayed twice */
  if (act === 'transfer') recordPaid(r.projectId, r.asked, r.id, by)
  return []
}

/** 9.4.6 · the supervisor confirms a payment's condition is met */
export function confirmCondition(projectId: string, no: number, note: string, by: string): string[] {
  if (!note.trim()) return ['اذكر ما استُوفي به الشرط']
  run({ op: 'cond', projectId, no, note, by, at: now() })
  return []
}

/** 9.1.input-6 · a special approval, or a waiver of rule 3 or 6 · the grants manager alone waives */
export function recordException(id: string, v: { kind: PayException['kind']; rule?: 3 | 6; text: string; file?: string }, by: string, role: RoleKey): string[] {
  const r = payRequestById(id)
  if (!r) return ['الطلب غير موجود']
  if (!mayRecordException(r, role)) return ['لا تُسجَّل الاستثناءات بعد اعتماد أمر الصرف']
  if (!v.text.trim()) return ['اكتب نص الموافقة أو الاستثناء']
  if (v.kind === 'waiver' && role !== 'grants-manager') return ['الاستثناء من الشروط صلاحية مدير المنح']
  if (v.kind === 'waiver' && !v.rule) return ['اختر الشرط المستثنى']
  const ex: PayException = { id: `ex-${r.id}-${(r.exceptions?.length ?? 0) + 1}`, kind: v.kind, rule: v.rule, text: v.text.trim(), by, role: roleByKey(role).title, at: day(now()), file: v.file }
  run({ op: 'exception', id, ex, by, at: now() })
  return []
}

/** 10.9.1 · applied by the distress case once the CEO approves the stop */
export const stopProjectPayments = (projectId: string, note: string, by: string) => run({ op: 'stop', projectId, note, by, at: now() })
/** 10.4.2 · the supervisor settles an obligation instead of paying it, with its reason */
export function settleSlot(projectId: string, no: number, note: string, by: string): string[] {
  if (!note.trim()) return ['اذكر سبب التسوية']
  const s = scheduleOf(projectId).find((x) => x.no === no)
  if (!s) return ['الدفعة غير موجودة']
  if (s.state === 'paid' || s.state === 'pending') return ['للدفعة طلب أو صرف · لا تُسوّى']
  run({ op: 'settle', projectId, no, note, by, at: now() })
  return []
}
/** 10.9.5 · 10.9.6 · an approved value change reaches the schedule */
export const adjustSchedule = (projectId: string, v: { cut?: number; extra?: { amount: number; dueAt: string } }, by: string) =>
  run({ op: 'adjust', projectId, ...v, by, at: now() })

export const resetPayments = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }

/** A picked file as a request document · the name keeps its extension so the thumbnail reads it */
export const docFromFile = (f: File, kind: string): PayDoc => ({
  name: f.name, kind, at: day(now()), size: `${Math.max(1, Math.round(f.size / 1024))} ك.ب`,
})
