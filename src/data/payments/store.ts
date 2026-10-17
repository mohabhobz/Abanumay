import { EXT_CLOSE_STAGE } from '@/data/mock/taxonomy'
import { condLine, condMet, requirementOf, unmetConds } from '@/data/agreements/conds'
import type { PayCond } from '@/types/domain'
import { hasLegacy, legacyCover, legacyTotal } from './legacy'
import { DECISIONS } from '@/data/shared/decisions'
import { closeOfProject } from '@/data/mock/closing'
import { actDay, asOf } from '@/data/clock'
import { useSyncExternalStore } from 'react'
import {
  TODAY, payRequestById, payRequests, type PaySlot, type PaySlotState,
} from '@/data/mock/disbursements'
import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { banksOf } from '@/data/mock/payEntity'
import { entityById } from '@/data/mock/entities'
import { payBlock, setBankSource } from '@/data/entities/store'
import { entityDetail } from '@/data/mock/entityDetail'
import { agrTouched, agreementsOfProject, inForceOf, inForcePayments } from '@/data/agreements/store'
import { docOf, linkOf, payYearIssue, recordPaid } from '@/data/budget/store'
import { LEVEL_SAY, spendLevelFor } from '@/data/budget/rules'
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
  for (const t of to) PAY_NOTES.unshift({ id: `pay-${PAY_NOTES.length + 1}`, to: t, title, context: `${r.projectName} · الدفعة ${r.no} من ${r.of}`, at: actDay(), href })
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
/** v3 · 9.4.5 · an external project's payments run this procedure too · the authority raises the
    requirements on the external party's behalf, and finance pays nothing without the system's permit ·
    its schedule is the one the partners store keeps for it, when it has no agreement here */
export const isExternal = (projectId: string): boolean => Boolean(ehsanGate(projectId))
let externalSchedule: (projectId: string) => { no: number; amount: number; dueAt: string; requirement?: string }[] = () => []
/** What the platform paid an external project before its payments ran this procedure · the fixture's */
let externalBefore: (projectId: string) => number = () => 0
export const setExternalBefore = (f: typeof externalBefore) => { externalBefore = f }
export const setExternalSchedule = (f: typeof externalSchedule) => {
  externalSchedule = f
  gated = true
  for (const o of DEFERRED.splice(0)) { asOf(o.at, () => applyOp(o)); refreshAll() }
  emit()
}
/** Who may raise an external party's requirements on its behalf (9.4.5) */
export const PROXY_ROLES: RoleKey[] = ['supervisor', 'grants-manager']

export function agreementOk(projectId: string): boolean {
  if (agreementsOfProject(projectId).length) return Boolean(inForceOf(projectId))
  const own = payRequests.find((r) => r.projectId === projectId)
  return own ? own.agreement.active : false
}

/** Paid before the system · a completed project whose agreement is on record and that never had
    a request here · its payments were made in the old system (batch 2 · 8 Oct · the schedule read
    them as unpaid and «held» while closing read them as paid) */
export const paidBefore = (projectId: string): boolean =>
  projectOf(projectId)?.statusGroup === 'مكتمل' && !payRequests.some((r) => r.projectId === projectId)

/** What's left of the grant before a request · paid requests only (rule 14) · plus a schedule paid
    before the system */
export const paidOf = (projectId: string, except?: string): number => externalBefore(projectId) + paidHere(projectId, except)
const paidHere = (projectId: string, except?: string): number =>
  /* Batch 8 · imported vouchers of the old system replace the inference for their project */
  hasLegacy(projectId) ? legacyTotal(projectId) + payRequests.filter((r) => r.projectId === projectId && r.state === 'paid' && r.id !== except).reduce((s, r) => s + r.asked, 0)
  : paidBefore(projectId) && inForceOf(projectId) ? grantOf(projectId)
    : payRequests.filter((r) => r.projectId === projectId && r.state === 'paid' && r.id !== except).reduce((s, r) => s + r.asked, 0)
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

/** The entity's representative · from the agreement in force (9.1.input-3) · else the entity's
    own director from its file (re-audit 7 Oct · it was a name picked from a list by project number) */
export function repOf(projectId: string): { name: string; title: string } {
  const a = inForceOf(projectId) ?? agreementsOfProject(projectId)[0]
  if (a) return { ...a.signer }
  const p = projectOf(projectId)
  const e = p ? entityById(p.entityId) : undefined
  return e ? { name: entityDetail(e).directorName, title: 'المدير التنفيذي للجهة' } : { name: '', title: '' }
}

/** Batch 7 · payments#25 · the account a payment goes to · the entity's own active account on its
    file (its registration's, or one an approved update added or edited) before the mock generator ·
    a masked seed IBAN isn't an account */
export function accountOf(entityId: string): ReturnType<typeof banksOf>[number] | undefined {
  const e = entityById(entityId)
  const real = e ? entityDetail(e).banks.find((b) => b.status === 'مفعل' && !/[X•]/.test(b.iban)) : undefined
  if (real) return { id: real.id, bank: real.bank, purpose: real.shortName, iban: real.iban, active: true }
  return banksOf(entityId)[0]
}

/* v3 · 2.4.10 · a project moved to another entity pays into that entity's own active account */
setBankSource((entityId) => { const b = accountOf(entityId); return b ? { name: b.bank, active: b.active } : undefined })

/** v3 · 2.4.29 · the payment requests tied to one of the entity's bank accounts · transferred to
    its IBAN, or carried on its bank while open · the account's own financial history */
export function bankHistory(entityId: string, b: { id: string; bank: string; iban: string }): string[] {
  /* An entity holds one account per bank (the list is closed · 2.4.29), so the bank names it */
  return payRequests.filter((r) => r.entityId === entityId && (
    (r.transfer ? r.transfer.iban === b.iban || r.transfer.bank === b.bank : r.bank.name === b.bank)
  )).map((r) => r.id)
}

/* ── The schedule (9.1.input-2 · 9.4.2) ── */

/** v3 · 9.4.6 · the agreement's payments in force · an annex being prepared doesn't reach them */
const payIn = (projectId: string) => { const a = inForceOf(projectId); return a ? inForcePayments(a) : undefined }

/** v3 · 9.4.8 · what holds a payment's requirements · a report or an activity the record reads · not a
    date (9.2.1 · it stops the payment, not the upload · 9.4.7), not the interim report (its file is one
    of the requirements · 9.4.2) */
const holdOf = (projectId: string, b: { conds?: PayCond[] }) => unmetConds(projectId, b).filter((c) => c.kind !== 'date' && !(c.kind === 'report' && c.ref === 'interim'))
/** v3 · 9.4.7 · a date condition stops the permit until its day */
const dateOf = (projectId: string, b: { conds?: PayCond[] }) => unmetConds(projectId, b).filter((c) => c.kind === 'date')

/** Conditions on payments that carry no request yet · the agreement's requirement, else the fixture's */
const SLOT_CONDITIONS = ['رفع التقرير المرحلي الأول', 'اكتمال المرحلة الأولى من خطة التنفيذ', 'تسليم كشف المستفيدين المسجَّلين']
/** Conditions the supervisor confirmed · `projectId:no` */
const CONDS = new Map<string, { by: string; at: string; note: string }>()
const condKey = (projectId: string, no: number) => `${projectId}:${no}`
export const condConfirmed = (projectId: string, no: number) => CONDS.get(condKey(projectId, no))

/** The fixture's schedule for a project that has no agreement row here · read off its requests */
function fixtureBase(projectId: string): { no: number; amount: number; dueAt: string; requirement?: string; conds?: PayCond[] }[] {
  const all = payRequests.filter((r) => r.projectId === projectId)
  const first = all[0]
  if (!first) return []
  const out: { no: number; amount: number; dueAt: string; requirement?: string }[] = []
  const of = first.of
  const even = Math.round(first.granted / of / 1000) * 1000
  for (let no = 1; no <= of; no++) {
    const req = all.find((r) => r.no === no)
    const d = new Date(first.dueAt)
    d.setMonth(d.getMonth() + (no - first.no) * 2)
    out.push({
      no, amount: no === of ? first.granted - even * (of - 1) : even, dueAt: req?.dueAt ?? d.toISOString().slice(0, 10),
      requirement: req?.condition ?? ((no + Number(projectId)) % 2 === 0 ? SLOT_CONDITIONS[no % SLOT_CONDITIONS.length] : undefined),
    })
  }
  return out
}

export function scheduleOf(projectId: string): PaySlot[] {
  const all = payRequests.filter((r) => r.projectId === projectId)
  const ag = payIn(projectId)
  /* v3 · 9.1.input-2 · the agreement in force is the schedule · its values, dates and conditions,
     requests or not · a project with no agreement row here reads the fixture's */
  let base: { no: number; amount: number; dueAt: string; requirement?: string; conds?: PayCond[] }[] = []
  if (ag) {
    /* v3 · 8.2.9 · the structured conditions read their records · the note beside them is confirmed by hand */
    base = ag.map((p) => ({ no: p.no, amount: p.amount, dueAt: p.dueAt, requirement: requirementOf(p) || undefined, conds: p.conds }))
  } else if (isExternal(projectId) && externalSchedule(projectId).length) {
    base = externalSchedule(projectId).map((p) => ({ ...p }))
  } else {
    base = fixtureBase(projectId)
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
  const before = paidBefore(projectId) && !hasLegacy(projectId)
  const legacy = legacyCover(projectId, base)
  /* an external project's payments the platform made before the procedure · the schedule's first ones */
  let ext = externalBefore(projectId)
  const extPaid = new Set<number>()
  for (const b of base) { if (ext >= b.amount) { extPaid.add(b.no); ext -= b.amount } else break }
  /* Re-audit 7 Oct · the payments went in order · v3 · 9.4.7 · a payment whose requirements are
     complete is paid, before its planned date too · the order stays a foundation's decision, off by
     default (settings › قرارات المؤسسة) */
  let blocked = false
  return base.map((b): PaySlot => {
    const prevBlocked = blocked
    const reqs = all.filter((r) => r.no === b.no)
    const open = reqs.find(isOpen)
    const paid = reqs.find((r) => r.state === 'paid')
    const req = open ?? paid ?? reqs[reqs.length - 1]
    const own = open ?? paid
    /* 9.4.8 · a date, an activity or a report not met yet holds the payment · the agreement's date
       condition is its «لا صرف قبل تاريخ» (9.4.7) */
    const auto = holdOf(projectId, b)
    /* an output's evidence is read by hand at the payment's review · so is the note beside the structured ones */
    const byHand = (b.conds ?? []).some((c) => condMet(projectId, c).met === null)
    const handNote = byHand || ((b.requirement ?? '').trim() && (b.conds ?? []).map(condLine).join(' · ') !== b.requirement)
    const conditionMet = (b.conds?.length ? !auto.length && (!handNote || Boolean(condConfirmed(projectId, b.no))) : !b.requirement || Boolean(condConfirmed(projectId, b.no)))
      || (own ? (own.checks.find((c) => c.rule === 6)?.ok ?? true) : false)
    /* a permit below the payment's value · the rest stays eligible for a permit of its own (9.4.4) */
    const paidSum = reqs.filter((r) => r.state === 'paid').reduce((x, r) => x + r.asked, 0)
    const partial = Boolean(paid) && !open && paidSum < b.amount && !before && !legacy.has(b.no)
    const state: PaySlotState =
      partial ? (stopped ? 'stopped' : SETTLED.has(condKey(projectId, b.no)) ? 'settled' : 'eligible')
      : paid || before || legacy.has(b.no) || extPaid.has(b.no) ? 'paid'
      : stopped ? 'stopped'
      : SETTLED.has(condKey(projectId, b.no)) ? 'settled'
      : open ? 'pending'
      : prevBlocked ? 'queued'
      : auto.length ? 'held'
      : noCycle(b) ? 'eligible'
      : 'open'
    if (DECISIONS.payNext !== 'off' && state !== 'paid' && state !== 'settled' && (state !== 'pending' || DECISIONS.payNext === 'paid')) blocked = true
    return {
      no: b.no, of, amount: b.amount, dueAt: b.dueAt, condition: b.requirement, conditionMet, state, requestId: req?.id,
      legacy: paid ? undefined : legacy.get(b.no), ahead: b.dueAt > TODAY, needs: partial ? [] : needsOf(b),
      left: partial ? b.amount - paidSum : undefined, notBefore: dateOf(projectId, b)[0]?.ref,
    }
  })
}

/** v3 · 9.2.2 · a first or only payment carries no requirements cycle of its own unless the agreement
    names one · it is eligible from the activation */
const noCycle = (b: { no: number; requirement?: string; conds?: PayCond[] }) =>
  b.no === 1 && !b.conds?.length && !b.requirement?.trim()

/** v3 · 9.2.2 · 9.4.2 · «متطلبات الدفعة» · what the agreement ties the payment to, each one a file ·
    a date isn't a file (the system reads it) · a payment tied to nothing still reports its period */
export function needsOf(b: { no: number; requirement?: string; conds?: PayCond[] }): { kind: string; label: string }[] {
  if (noCycle(b)) return []
  const out: { kind: string; label: string }[] = []
  for (const c of b.conds ?? []) {
    if (c.kind === 'report') out.push({ kind: `report:${c.ref}`, label: c.ref === 'final' ? 'التقرير الختامي' : 'التقرير المرحلي' })
    else if (c.kind === 'activity') out.push({ kind: `activity:${c.ref}`, label: `شواهد إنجاز النشاط · ${c.label}` })
    else if (c.kind === 'output') out.push({ kind: `output:${c.ref}`, label: `شواهد المخرج · ${c.label}` })
  }
  const note = (b.requirement ?? '').trim()
  const structured = (b.conds ?? []).map(condLine).join(' · ')
  const free = b.conds?.length ? (note && note !== structured ? note.replace(structured, '').replace(/^ · /, '').trim() : '') : note
  if (free) out.push({ kind: 'note', label: free })
  if (!out.length) out.push({ kind: 'تقرير', label: 'تقرير الإنجاز للفترة السابقة' })
  return out
}

/** v3 · 10.4.2 · while the project's closing is open no payment's requirements go up · except the
    last one, which follows the final report (the one the agreement ties to it, or the schedule's last) */
const tiedToFinal = (s: { conds?: PayCond[] }) => Boolean(s.conds?.some((c) => c.kind === 'report' && c.ref === 'final'))
export function closingBlock(projectId: string, no: number, of?: number): string {
  /* Verifier · 17 Oct · an external project's closing at the grants manager · nothing more is raised or permitted */
  if (projectRows.find((p) => p.id === projectId)?.stage === EXT_CLOSE_STAGE) return 'إغلاق المشروع الخارجي عند مدير المنح · لا تُرفع متطلبات ولا يُنشأ إذن'
  const c = closeOfProject(projectId)
  if (!c || c.stage === 'closed') return ''
  const b = payIn(projectId)?.find((p) => p.no === no)
  if ((b && tiedToFinal(b)) || (of !== undefined && no === of)) return ''
  return `للمشروع إغلاق مفتوح (${c.id}) · لا تُرفع متطلبات دفعة ولا يُنشأ إذن صرف أثناءه إلا للدفعة الأخيرة`
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

export interface PayProject { id: string; name: string; entity: string; entityId: string; can: boolean; why?: string; open: number; raise: number; external?: boolean }

/** Projects that can request · 9.4.1 · under execution with the agreement in force · reason when not */
export function payableProjects(entityId?: string): PayProject[] {
  const ids = new Set<string>(payRequests.map((r) => r.projectId))
  for (const a of agreements) if (inForceOf(a.projectId)) ids.add(a.projectId)
  /* v3 · 9.4.5 · an external project's payments run here too */
  for (const p of projectRows) if (isExternal(p.id) && externalSchedule(p.id).length) ids.add(p.id)
  const out: PayProject[] = []
  for (const id of ids) {
    const p = projectOf(id)
    if (!p || (entityId && p.entityId !== entityId)) continue
    /* Re-audit 7 Oct · a project already at its final report or evaluation isn't paid anew */
    /* v3 · 0.status.5 · a payment runs only «تحت التنفيذ» · the agreement in force and the plan, when
       required, approved */
    /* a payment tied to the final report is paid while the closing runs (closingBlock) */
    const slots = scheduleOf(id)
    const running = p.statusGroup === 'تحت التنفيذ' || (p.statusGroup === 'قيد الإغلاق' && slots.some((s) => s.state !== 'paid' && s.state !== 'settled' && !closingBlock(id, s.no, s.of)))
    const external = isExternal(id)
    /* 8.3.28 · an external project's agreement is a reference document · its schedule is the record */
    const agr = external ? true : agreementOk(id)
    if (!slots.length) continue
    /* v3 · 0.ent.8 · 2.4.22 · no payment while the entity's account is «غير نشط» or archived */
    const blocked = payBlock(entityById(p.entityId))
    out.push({
      id, name: p.name, entity: p.entityName, entityId: p.entityId, can: running && agr && !STOPPED.has(id) && !blocked,
      why: STOPPED.has(id) ? /* doc 10.9.1 */ 'أُوقف المشروع بقرار معتمد · لا صرف بعده'
        : blocked ? blocked
        : !agr ? /* doc rule 1 */ 'الاتفاقية غير سارية · لا صرف قبل تفعيل الاتفاقية'
        : !running ? /* doc 9.4.1 · v3 0.status.5 */ `المشروع «${p.statusGroup}» · لا تُرفع متطلبات ولا يُنشأ إذن صرف إلا لمشروع «تحت التنفيذ»`
        : undefined,
      open: slots.filter((s) => s.state === 'open' || s.state === 'eligible').length, raise: slots.filter((s) => s.state === 'open').length, external,
    })
  }
  return out.sort((a, b) => Number(b.can) - Number(a.can) || b.open - a.open)
}

/* ── Live checks · recomputed on every move, so a blocked request says which rule blocks it ── */

const WAIVED = new Set<string>()
const waived = (id: string, rule: number) => WAIVED.has(`${id}:${rule}`)

function refresh(r: PayRequest) {
  if (!isOpen(r)) return
  /* the record follows its payment · a value change (10.9.5) or an annex (9.4.6) reaches it */
  const sl = scheduleOf(r.projectId).find((x) => x.no === r.no)
  if (sl) { r.due = sl.left ?? sl.amount; if (sl.condition !== undefined) r.condition = sl.condition }
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
  set(3, 'متطلبات الدفعة مكتملة', c3?.ok ?? true)
  if (r.condition) set(6, 'شروط الدفعة مستوفاة', (r.checks.find((x) => x.rule === 6)?.ok ?? false) || Boolean(condConfirmed(r.projectId, r.no)))
  set(10, 'الاتفاقية سارية', r.agreement.active)
  const c11 = r.checks.find((x) => x.rule === 11)
  set(11, 'المبلغ المحجوز متوفّر', hold === undefined ? (c11?.ok ?? true) : hold >= r.asked)
  r.checks.sort((a, b) => a.rule - b.rule)
}
const refreshAll = () => { for (const r of payRequests) refresh(r) }

const STOP_SAY: Record<number, string> = {
  3: /* doc 9.4.2 */ 'متطلبات الدفعة غير مكتملة', 6: /* doc 9.4.8 */ 'شروط الدفعة غير مستوفاة',
  10: /* doc 9.4.12 */ 'الاتفاقية غير سارية', 11: /* doc 9.4.13 */ 'المبلغ المحجوز غير متوفّر',
}

/** Why a forward exit is stopped · empty when it may pass */
export type PayAct = 'qualify' | 'permit' | 'recommend' | 'returnEntity' | 'approve' | 'returnSup' | 'reject' | 'order' | 'returnFin' | 'transfer' | 'cancel'
const BACK: PayAct[] = ['returnEntity', 'returnSup', 'reject', 'returnFin', 'cancel']
export function payStops(r: PayRequest, act: PayAct, amount = r.asked): string[] {
  if (BACK.includes(act)) return []
  const out: string[] = []
  /* 9.2.7 · the supervisor approves the requirements on their own file · 9.4.2 · every requirement,
     condition and attachment is met before the permit · rules 10 and 11 at the permit and after */
  /* 9.2.5 · 9.2.7 · what the record can't read (an output's evidence, a note) is the supervisor's own
     review · his approval confirms it · what it can read (a date, an activity, a report) must be met */
  const rules = act === 'qualify' ? [3] : [3, 6, 10, 11]
  for (const c of r.checks) if (!c.ok && rules.includes(c.rule)) out.push(STOP_SAY[c.rule] ?? c.label)
  const pb = payIn(r.projectId)?.find((x) => x.no === r.no)
  if (act === 'qualify' && pb) { const un = holdOf(r.projectId, pb); if (un.length) out.push(`${STOP_SAY[6]} · ${un.map(condLine).join(' · ')}`) }
  /* 9.4.7 · the agreement's «لا صرف قبل تاريخ» · and what holds the payment, read again at the permit */
  if (act === 'permit' && pb) { const un = [...holdOf(r.projectId, pb), ...dateOf(r.projectId, pb)]; if (un.length) out.push(`${STOP_SAY[6]} · ${un.map(condLine).join(' · ')}`) }
  /* v3 · 0.ent.8 · 2.4.22 · every forward step stops while the entity's account is «غير نشط» ·
     a suspension, a revocation or an expired mandatory document · or the entity is archived */
  const blocked = isExternal(r.projectId) ? '' : payBlock(entityById(r.entityId))
  if (blocked) out.push(blocked)
  /* v3 · 0.status.5 · a payment opens only «تحت التنفيذ» · a permit already on its way finishes while
     the closing runs (the closing waits for it · 10.4.2) · on any other status no payment step moves */
  const pst = projectOf(r.projectId)?.statusGroup
  if (pst && pst !== 'تحت التنفيذ' && pst !== 'قيد الإغلاق') out.push(`المشروع «${pst}» · لا صرف إلا لمشروع «تحت التنفيذ»`)
  if (act === 'qualify' || act === 'permit') { const cb = closingBlock(r.projectId, r.no, r.of); if (cb) out.push(cb) }
  if (act !== 'qualify') {
    const left = grantLeft(r.projectId, r.id)
    if (amount > left) out.push(/* doc 9.4.16 */ `المبلغ يتجاوز المتبقي من المنحة (${nf.format(Math.max(0, left))})`)
    if (amount > r.due) out.push(/* doc 9.4.4 */ 'قيمة الإذن أعلى من الدفعة المعتمدة')
    if (!(amount > 0)) out.push('أدخل قيمة الإذن')
    const y = payYearIssue(r.projectId, r.dueAt, amount)
    if (y) out.push(/* doc 1.4.52 */ `${y}`)
    if (r.no === 1) for (const c of unmetBefore(r.projectId, 'firstPay')) out.push(`شرط قبل الدفعة الأولى لم يُستوفَ: ${c.text}`)
  }
  if (act === 'order' || act === 'transfer') if (!r.bank.active) out.push('الحساب البنكي المعتمد غير نشط · المخرج 2')
  if (act === 'transfer' && !r.order) out.push(/* doc 9.4.11 */ 'لم تعتمد الإدارة المالية أمر الصرف بعد')
  return out
}

export interface PayAction { act: PayAct; label: string; kind: DecisionKind; needsNote?: boolean; needsFile?: string; needsAmount?: boolean; confirm?: string; step: number }

/** v3 · 9.4.24 · who may cancel a permit before the transfer */
export const CANCEL_ROLES: RoleKey[] = ['grants-manager', 'ceo']
const permitLive = (r: PayRequest) => ['manager', 'exec', 'finance'].includes(r.state) && !r.transfer

/** This role's exits at this stage · empty means the record isn't theirs (9.2.7 · 9.2.10 · 9.2.12 ·
    9.2.14 · 9.2.16 · 9.4.24) */
export function payActions(r: PayRequest, role: RoleKey, asEntity = false): PayAction[] {
  if (asEntity) return []
  const cancel: PayAction[] = permitLive(r) && CANCEL_ROLES.includes(role)
    ? [{ act: 'cancel', label: 'إلغاء إذن الصرف', kind: 'btn-d', needsNote: true, step: 24 }] : []
  if (r.state === 'supervisor' && role === 'supervisor') return [
    { act: 'qualify', label: 'اعتماد المتطلبات · مؤهلة للصرف', kind: 'btn-p', step: 7 },
    { act: 'returnEntity', label: 'إعادة للجهة', kind: 'btn-2', needsNote: true, step: 7 },
  ]
  /* 9.2.10 · the supervisor creates the permit by hand · the system never does */
  if (r.state === 'eligible' && role === 'supervisor') return [
    { act: 'permit', label: 'إنشاء إذن الصرف', kind: 'btn-p', needsAmount: true, step: 10 },
    ...(r.origin === 'supervisor' ? [] : [{ act: 'returnEntity' as const, label: 'إعادة المتطلبات للجهة', kind: 'btn-2' as const, needsNote: true, step: 7 }]),
  ]
  if (r.state === 'manager' && role === 'grants-manager') return [
    /* Batch 2 · the label says where the approval sends it · above the manager's limit it goes to
       the executive, not finance (1.1.input-6) */
    { act: 'approve', label: spendLevelFor(r.asked) === 'manager' ? 'اعتماد الإذن وإحالته للمالية' : `اعتماد الإذن وإحالته إلى ${LEVEL_SAY.exec}`, kind: 'btn-p', step: 12 },
    { act: 'returnSup', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true, step: 12 },
    /* Rule 17 · closing isn't deleting · the log stays readable */
    { act: 'reject', label: 'رفض نهائي وإغلاق', kind: 'btn-d', needsNote: true, step: 12 },
    ...cancel,
  ]
  /* Re-audit 7 Oct · above the manager's spending limit the executive approves the disbursement
     (1.1.input-6) · and above his, he records the body's decision that allowed it */
  if (r.state === 'exec' && role === 'ceo') return [
    { act: 'approve', label: 'اعتماد الصرف وإحالة للمالية', kind: 'btn-p', needsNote: spendLevelFor(r.asked) !== 'exec', step: 12 },
    { act: 'returnSup', label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true, step: 12 },
    ...cancel,
  ]
  /* Re-audit 7 Oct · the finance officer's own seat (9.2.14 · 9.2.16) */
  if (r.state === 'finance' && role === 'finance') return r.order
    ? [{ act: 'transfer', label: 'تنفيذ التحويل', kind: 'btn-p', needsFile: 'إثبات التحويل', confirm: 'تأكيد تنفيذ التحويل', step: 16 }]
    : [
        { act: 'order', label: 'اعتماد أمر الصرف', kind: 'btn-p', step: 14 },
        { act: 'returnFin', label: 'إعادة بملاحظة', kind: 'btn-2', needsNote: true, step: 14 },
      ]
  return cancel
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
  /* `origin: 'supervisor'` on a create is the old permit-first direction · kept for an older log's replay */
  | { op: 'create'; id: string; projectId: string; no: number; asked?: number; docs: PayDoc[]; origin: 'entity' | 'proxy' | 'supervisor'; note?: string }
  /* v3 · 9.2.2 · 9.2.10 · a first or only payment with no condition · straight to the permit */
  | { op: 'permitNew'; id: string; projectId: string; no: number; asked: number; note?: string }
  | { op: 'payee'; id: string; name: string; ref: string; doc: string }
  | { op: 'resubmit'; id: string; asked?: number; docs: PayDoc[] }
  | { op: 'act'; id: string; act: PayAct; note: string; file?: string; amount?: number; role?: string }
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

/* v3 · 9.4.5 · an external project's schedule is the partners store's, registered after this store
   loads · its records and every move on them wait for it, then replay in order */
let gated = false
const DEFERRED: Op[] = []
function apply(o: Op) {
  /* Batch 7 · 17 Oct · a project is routed to an external party by the partners log, which replays after this
     one · a record raised on it replayed as a regular project's and was lost · the whole log waits for the
     partners store (loaded next, main.tsx), then replays in order */
  if (!gated) { DEFERRED.push(o); return }
  asOf(o.at, () => applyOp(o))
}
function applyOp(o: Op) {
  switch (o.op) {
    case 'create':
    case 'permitNew': {
      if (payRequestById(o.id)) return
      const p = projectOf(o.projectId)
      const slot = scheduleOf(o.projectId).find((s) => s.no === o.no)
      if (!p || !slot) return
      const bank = accountOf(p.entityId)
      const l = linkOf(p.id)
      const total = l?.shares.reduce((s, x) => s + x.amount, 0) ?? 0
      const sources = l && total
        ? l.shares.map((x) => ({ name: (() => { const d = docOf(x.docId); return d ? docTitle(d) : 'ميزانية المنح' })(), share: Math.round((x.amount / total) * 100) }))
        : [{ name: 'ميزانية المنح 2026', share: 100 }]
      const ag = inForceOf(p.id)
      const first = payRequests.find((x) => x.projectId === p.id)
      const needs = slot.needs ?? []
      const docs = o.op === 'create' ? o.docs : []
      const docsOk = needs.every((n) => docs.some((d) => d.kind === n.kind))
      const legacyPermit = o.op === 'create' && o.origin === 'supervisor'
      const direct = o.op === 'permitNew'
      const r: PayRequest = {
        id: o.id, projectId: p.id, projectName: p.name, entityId: p.entityId, entityName: p.entityName,
        no: slot.no, of: slot.of, due: slot.left ?? slot.amount, asked: direct ? o.asked : slot.amount, dueAt: slot.dueAt,
        state: direct ? 'manager' : legacyPermit ? 'returned' : 'supervisor', hoursInState: 0,
        condition: slot.condition,
        checks: [
          { label: 'متطلبات الدفعة مكتملة', ok: direct || docsOk, rule: 3 },
          ...(slot.condition ? [{ label: 'شروط الدفعة مستوفاة', ok: slot.conditionMet, rule: 6 } as PayCheck] : []),
        ],
        /* v3 · 11.2.1 · an external party's transfer details are its reference record's */
        bank: entityById(p.entityId)?.external?.transfer ? { name: entityById(p.entityId)!.external!.transfer!, active: true } : { name: bank?.bank ?? 'مصرف الراجحي', active: bank?.active ?? true },
        sources, owner: p.owner ?? roleByKey('supervisor').name, at: day(o.at),
        agreement: { id: ag?.id ?? `AG-${p.id}`, active: isExternal(p.id) || agreementOk(p.id), endsAt: p.endAt ?? first?.agreement.endsAt ?? '' },
        granted: grantOf(p.id), spent: paidOf(p.id), reserved: slot.amount, docs, log: [],
        origin: direct ? 'supervisor' : legacyPermit ? 'entity' : o.origin, needs, rep: repOf(p.id), exceptions: [],
        permitAt: direct ? { at: day(o.at), by: o.by } : undefined,
        note: legacyPermit ? (o.note?.trim() || 'أرفق متطلبات الدفعة وأرسلها') : undefined,
      }
      payRequests.push(r)
      refresh(r)
      const ahead = slot.dueAt > day(o.at) ? ` · قبل تاريخها المخطط ${slot.dueAt}` : ''
      if (direct) {
        log(r, 1, 'النظام', 'النظام', slot.left !== undefined ? `أتاح باقي الدفعة للصرف · ${nf.format(slot.left)} · اعتُمدت متطلباتها مع إذنها السابق` : `أتاح الدفعة ${slot.no === slot.of ? 'الوحيدة' : 'الأولى'} للصرف منذ تفعيل الاتفاقية · لا دورة متطلبات مستقلة لها`, o.at)
        log(r, 10, o.by, 'مشرف المنح', `أنشأ إذن الصرف يدويًّا · ${nf.format(r.asked)}${ahead}`, o.at, o.note?.trim() || undefined)
        log(r, 11, 'النظام', 'النظام', 'أحال إذن الصرف إلى مدير المنح للاعتماد', o.at, undefined, 'مدير المنح · إذن صرف بانتظار الاعتماد')
        notify([MGR()], r, 'إذن صرف بانتظار اعتمادك')
        return
      }
      log(r, 1, 'النظام', 'النظام', `عرض متطلبات الدفعة وفق جدول الدفعات${ahead}`, o.at)
      if (o.origin === 'proxy') {
        log(r, 2, o.by, 'صاحب الصلاحية', `رفع متطلبات الدفعة نيابةً عن الجهة الخارجية وأثبتها · ${docs.length} ${docs.length === 1 ? 'مستند' : 'مستندات'}`, o.at)
      } else if (!legacyPermit) {
        log(r, 2, o.by, ENTITY_ROLE, `رفعت متطلبات الدفعة · ${docs.length} ${docs.length === 1 ? 'مستند' : 'مستندات'} · ${r.rep?.name} · ${r.rep?.title}`, o.at)
      }
      if (legacyPermit) {
        log(r, 2, o.by, 'مشرف المنح', 'أتاح للجهة رفع متطلبات الدفعة', o.at, r.note, 'الجهة المستفيدة · متطلبات دفعة بانتظارك')
        notify([r.entityName], r, 'متطلبات دفعة بانتظارك', `${ROUTES.payment(r.id)}?as=entity`)
        return
      }
      log(r, 3, 'النظام', 'النظام', 'تحقّق من اكتمال متطلبات الدفعة الإلزامية', o.at)
      log(r, 4, 'النظام', 'النظام', 'أحال متطلبات الدفعة إلى مشرف المنح', o.at, undefined, 'مشرف المنح · متطلبات جديدة للمراجعة')
      notify([r.owner], r, 'متطلبات دفعة جديدة بانتظار مراجعتك')
      return
    }
    case 'payee': {
      const r = payRequestById(o.id)
      if (!r || !PAYEE_STATES.includes(r.state)) return
      r.payee = { name: o.name, ref: o.ref, doc: o.doc, by: o.by, at: day(o.at) }
      log(r, 10, o.by, 'مشرف المنح', `${r.payee && r.payee.at !== day(o.at) ? 'عدّل' : 'سجّل'} التحويل لطرف ثالث · المستفيد الفعلي ${o.name} · المرجع ${o.ref} · المستند المبرّر ${o.doc}`, o.at)
      /* the transfer goes to the actual beneficiary named on the permit */
      r.bank = { name: `${o.name} · ${o.ref}`, active: true }
      return
    }
    case 'resubmit': {
      const r = payRequestById(o.id)
      if (!r || r.state !== 'returned') return
      r.asked = r.due
      for (const d of o.docs) {
        const i = r.docs.findIndex((x) => x.kind === d.kind)
        if (i >= 0) r.docs[i] = d
        else r.docs.push(d)
      }
      const c3 = r.checks.find((c) => c.rule === 3)
      if (c3) c3.ok = needsFor(r).every((n) => r.docs.some((d) => d.kind === n.kind))
      r.note = undefined
      r.returnedBy = undefined
      move(r, 'supervisor')
      refresh(r)
      log(r, 9, o.by, r.origin === 'proxy' ? 'صاحب الصلاحية' : ENTITY_ROLE, 'استكملت النقص وأعادت رفع متطلبات الدفعة', o.at)
      log(r, 4, 'النظام', 'النظام', 'أحال متطلبات الدفعة إلى مشرف المنح', o.at, undefined, 'مشرف المنح · متطلبات مُعاد رفعها')
      notify([r.owner], r, 'أُعيد رفع متطلبات الدفعة')
      return
    }
    case 'act': {
      const r = payRequestById(o.id)
      if (!r) return
      const note = o.note.trim() || undefined
      switch (o.act) {
        /* An older log's recommendation · the requirements approved and the permit in one move */
        case 'recommend':
          if (r.state !== 'supervisor' && r.state !== 'eligible') return
          r.permitAt = { at: day(o.at), by: o.by }
          move(r, 'manager')
          log(r, 7, o.by, 'مشرف المنح', 'اعتمد متطلبات الدفعة · مؤهلة للصرف', o.at, note)
          log(r, 10, o.by, 'مشرف المنح', 'أنشأ إذن الصرف', o.at)
          log(r, 11, 'النظام', 'النظام', 'أحال إذن الصرف إلى مدير المنح للاعتماد', o.at, undefined, 'مدير المنح · إذن صرف بانتظار الاعتماد')
          notify([MGR()], r, 'إذن صرف بانتظار اعتمادك')
          return
        /* v3 · 9.2.7 · the requirements approved · the payment is «مؤهلة للصرف» · no permit yet */
        case 'qualify': {
          if (r.state !== 'supervisor') return
          move(r, 'eligible')
          r.note = undefined
          if (r.condition && !condConfirmed(r.projectId, r.no)) CONDS.set(condKey(r.projectId, r.no), { by: o.by, at: day(o.at), note: 'تحقّق منها المشرف عند مراجعة المتطلبات' })
          const c6 = r.checks.find((x) => x.rule === 6)
          if (c6) c6.ok = true
          log(r, 5, o.by, 'مشرف المنح', 'راجع متطلبات الدفعة والتقارير المرفوعة', o.at)
          log(r, 7, o.by, 'مشرف المنح', 'اعتمد المتطلبات · أصبحت الدفعة «مؤهلة للصرف»', o.at, note, 'الجهة المستفيدة · اعتُمدت متطلبات الدفعة')
          notify([r.entityName], r, 'اعتُمدت متطلبات الدفعة · مؤهلة للصرف', `${ROUTES.payment(r.id)}?as=entity`)
          return
        }
        /* v3 · 9.2.10 · the permit · created by hand by the supervisor, never by the system */
        case 'permit': {
          if (r.state !== 'eligible') return
          const amt = o.amount && o.amount > 0 ? Math.min(o.amount, r.due) : r.due
          r.asked = amt
          r.permitAt = { at: day(o.at), by: o.by }
          r.note = undefined
          r.returnedBy = undefined
          move(r, 'manager')
          refresh(r)
          log(r, 10, o.by, 'مشرف المنح', `أنشأ إذن الصرف يدويًّا · ${nf.format(amt)}${r.dueAt > day(o.at) ? ` · قبل تاريخ الدفعة المخطط ${r.dueAt}` : ''}`, o.at, note)
          log(r, 11, 'النظام', 'النظام', 'أحال إذن الصرف إلى مدير المنح للاعتماد', o.at, undefined, 'مدير المنح · إذن صرف بانتظار الاعتماد')
          notify([MGR()], r, 'إذن صرف بانتظار اعتمادك')
          return
        }
        case 'returnEntity':
          if ((r.state !== 'supervisor' && r.state !== 'eligible') || !note) return
          r.note = note; r.returnedBy = 'supervisor'
          move(r, 'returned')
          log(r, 7, o.by, 'مشرف المنح', 'أعاد متطلبات الدفعة للجهة مع توضيح النقص', o.at, note)
          log(r, 8, 'النظام', 'النظام', 'حدّث حالة متطلبات الدفعة وأشعر الجهة بالنقص المطلوب استكماله', o.at, undefined, 'الجهة المستفيدة · متطلبات الدفعة مُعادة للاستكمال')
          if (r.origin === 'proxy') notify([r.log.find((e) => e.step === 2)?.who ?? r.owner], r, 'متطلبات الدفعة مُعادة للاستكمال · نيابةً عن الجهة الخارجية')
          else notify([r.entityName], r, 'متطلبات الدفعة مُعادة للاستكمال', `${ROUTES.payment(r.id)}?as=entity`)
          return
        /* v3 · 9.4.24 · a permit cancelled before the transfer · the payment goes back to «مؤهلة للصرف» ·
           a transferred one isn't cancelled, it's recovered or redirected through the closing */
        case 'cancel': {
          if (!permitLive(r) || !note) return
          const who = o.role ?? 'مدير المنح'
          r.cancels = [...(r.cancels ?? []), { at: day(o.at), by: o.by, role: who, note }]
          r.permitAt = undefined
          r.order = undefined
          r.note = note; r.returnedBy = undefined
          move(r, 'eligible')
          log(r, 24, o.by, who, 'ألغى إذن الصرف قبل تنفيذ التحويل · عادت الدفعة «مؤهلة للصرف»', o.at, note, 'مشرف المنح · أُلغي إذن الصرف')
          notify([r.owner], r, 'أُلغي إذن الصرف · الدفعة مؤهلة لإذن جديد')
          return
        }
        case 'approve':
          if (r.state !== 'manager' && r.state !== 'exec') return
          /* Re-audit 7 Oct · the spending limits are read here (1.1.input-6) · a disbursement above the
             manager's limit goes to the executive before finance */
          if (r.state === 'manager' && spendLevelFor(r.asked) !== 'manager') {
            move(r, 'exec')
            r.note = undefined
            log(r, 12, o.by, 'مدير المنح', `راجع إذن الصرف ووافق عليه · المبلغ فوق حد صرفه فأُحيل إلى المدير التنفيذي`, o.at, note, 'المدير التنفيذي · إذن صرف فوق حد مدير المنح')
            notify([roleByKey('ceo').name], r, 'إذن صرف بانتظار اعتمادك')
            return
          }
          if (r.state === 'exec') {
            const lvl = spendLevelFor(r.asked)
            move(r, 'finance')
            r.note = undefined
            log(r, 12, o.by, 'المدير التنفيذي', lvl === 'exec' ? 'اعتمد الصرف في حدّه' : `اعتمد الصرف بقرار ${LEVEL_SAY[lvl]}`, o.at, note)
            log(r, 13, 'النظام', 'النظام', 'تحقّق من سريان الاتفاقية وتوفّر المبلغ المحجوز، ثم أحال إذن الصرف إلى الإدارة المالية', o.at, undefined, 'الإدارة المالية · إذن بانتظار أمر الصرف')
            notify([FIN, roleByKey('finance').name], r, 'إذن صرف بانتظار أمر الصرف')
            return
          }
          move(r, 'finance')
          r.note = undefined
          log(r, 12, o.by, 'مدير المنح', 'راجع إذن الصرف واعتمده', o.at, note)
          log(r, 13, 'النظام', 'النظام', 'تحقّق من سريان الاتفاقية وتوفّر المبلغ المحجوز، ثم أحال إذن الصرف إلى الإدارة المالية', o.at, undefined, 'الإدارة المالية · إذن بانتظار أمر الصرف')
          notify([FIN, roleByKey('finance').name], r, 'إذن صرف بانتظار أمر الصرف')
          return
        /* 9.2.12 · the permit goes back to the supervisor · the payment stays eligible, its permit to redo */
        case 'returnSup': {
          if ((r.state !== 'manager' && r.state !== 'exec') || !note) return
          r.note = note; r.returnedBy = 'manager'
          r.permitAt = undefined
          const from = r.state
          move(r, 'eligible')
          log(r, 12, o.by, from === 'exec' ? 'المدير التنفيذي' : 'مدير المنح', 'أعاد إذن الصرف إلى مشرف المنح لاستكمال الملاحظات', o.at, note, 'مشرف المنح · إذن صرف مُعاد')
          notify([r.owner], r, 'أُعيد إذن الصرف لاستكمال الملاحظات')
          return
        }
        case 'reject':
          if (r.state !== 'manager' || !note) return
          r.note = note; r.closedAt = day(o.at)
          move(r, 'closed')
          log(r, 12, o.by, 'مدير المنح', 'رفض إذن الصرف رفضًا نهائيًّا وأغلقه مع الاحتفاظ بسجله', o.at, note, 'الجهة المستفيدة · رُفض صرف الدفعة')
          notify([r.entityName], r, 'رُفض صرف الدفعة نهائيًّا', `${ROUTES.payment(r.id)}?as=entity`)
          notify([r.owner], r, 'رفض مدير المنح إذن الصرف')
          return
        case 'order':
          if (r.state !== 'finance' || r.order) return
          r.order = { at: day(o.at), by: o.by }
          log(r, 14, o.by, FIN, 'راجعت إذن الصرف واعتمدت أمر الصرف', o.at, note)
          log(r, 15, 'النظام', 'النظام', 'أنشأ أمر الصرف وربطه بالمشروع والاتفاقية والدفعة ومصادر التمويل', o.at)
          return
        case 'returnFin':
          if (r.state !== 'finance' || r.order || !note) return
          r.note = note; r.returnedBy = 'finance'
          move(r, 'manager')
          log(r, 14, o.by, FIN, 'أعادت إذن الصرف إلى مدير المنح بملاحظة', o.at, note, 'مدير المنح · إذن مُعاد من الإدارة المالية')
          notify([MGR()], r, 'أعادت الإدارة المالية إذن الصرف')
          return
        case 'transfer': {
          if (r.state !== 'finance' || !r.order || !o.file) return
          const own = accountOf(r.entityId)
          const b = own && own.bank === r.bank.name ? own : banksOf(r.entityId).find((x) => x.bank === r.bank.name) ?? own
          r.transfer = { at: day(o.at), by: o.by, bank: r.bank.name, iban: b?.iban ?? '', proof: o.file }
          r.paidAt = day(o.at)
          r.docs.push({ name: o.file, kind: 'إثبات التحويل', at: day(o.at), size: '—' })
          move(r, 'paid')
          r.checks = r.checks.map((c) => ({ ...c, ok: true }))
          log(r, 16, o.by, FIN, `نفّذت التحويل إلى الحساب البنكي المعتمد · ${r.bank.name}`, o.at)
          log(r, 17, 'النظام', 'النظام', 'حدّث حالة الدفعة إلى (تم الصرف) وحوّل المبلغ من محجوز إلى مصروف', o.at)
          log(r, 18, 'النظام', 'النظام', 'أشعر الجهة بتنفيذ الصرف', o.at, undefined, 'الجهة المستفيدة · نُفّذ الصرف')
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
        log(r, 12, o.by, 'الرئيس التنفيذي', 'أُغلق السجل بقرار إيقاف المشروع', o.at, o.note, 'الجهة المستفيدة · أُوقف المشروع')
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
      const step = r.state === 'manager' ? 12 : 5
      log(r, step, o.ex.by, o.ex.role, o.ex.kind === 'waiver' ? `سجّل استثناءً من القاعدة ${o.ex.rule}` : 'سجّل موافقة خاصة على الدفعة', o.at, o.ex.text)
      return
    }
  }
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); apply(o); refreshAll(); save(); emit() }

/** What a record of the seed carries · the requirements before v3 named them per payment */
export const REQUEST_NEEDS: { kind: string; label: string }[] = [
  { kind: 'تقرير', label: 'التقرير المرحلي للفترة السابقة' },
  { kind: 'كشف', label: 'كشف المستفيدين المسجَّلين' },
  { kind: 'فواتير', label: 'فواتير ومستندات الصرف السابق' },
]

/** v3 · 9.2.2 · the record's requirements · the agreement's for a new one, the old fixed list for the seed's */
export const needsFor = (r: PayRequest): { kind: string; label: string }[] => r.needs ?? REQUEST_NEEDS

/* ── Seed · the fixture's requests take their origin, representative and live checks ── */

function seed() {
  /* Re-audit 16 Oct · 9.1.input-2 · an older fixture agreement and its project's requests disagreed on
     the schedule (an agreement of 2 payments, requests numbered to 4) · the requests are the record, so
     the agreement in force takes their schedule once, and from then on the agreement is the source */
  for (const pid of new Set(payRequests.map((r) => r.projectId))) {
    const ag = inForceOf(pid)
    if (!ag || agrTouched(ag.id) || ag.payments.some((x) => x.reqDueAt || x.conds?.length)) continue
    const fx = fixtureBase(pid)
    const same = fx.length === ag.payments.length && fx.every((b, i) => b.amount === ag.payments[i]!.amount)
    const tot = fx.reduce((x, b) => x + b.amount, 0) || 1
    if (!same && fx.length) ag.payments = fx.map((b) => ({ no: b.no, amount: b.amount, share: Math.round((b.amount / tot) * 100), dueAt: b.dueAt, requirement: b.requirement ?? '' }))
  }
  for (const r of payRequests) {
    r.origin ??= 'entity'
    r.rep ??= repOf(r.projectId)
    r.exceptions ??= []
    /* v3 · 9.2.10 · a record past the supervisor carries the permit he created */
    const p10 = r.log.find((e) => e.step === 10)
    if (p10 && ['manager', 'exec', 'finance', 'paid'].includes(r.state)) r.permitAt = { at: p10.at, by: p10.who }
    /* A request already with finance past the manager has its order once the fixture says so ·
       half of them, so both stations of the finance desk show */
    if (r.state === 'paid') {
      const at = r.log.find((e) => e.step === 14)?.at ?? r.paidAt ?? r.at
      r.order = { at, by: 'ريم الشمري' }
      const b = banksOf(r.entityId).find((x) => x.bank === r.bank.name)
      r.transfer = { at: r.paidAt ?? at, by: 'ريم الشمري', bank: r.bank.name, iban: b?.iban ?? '', proof: 'إشعار التحويل البنكي.pdf' }
    }
  }
  /* v3 · 9.2.7 · two records whose requirements the supervisor approved · «مؤهلة للصرف», the permit his to create */
  for (const r of payRequests.filter((x) => x.state === 'supervisor' && x.checks.every((c) => c.ok) && !closingBlock(x.projectId, x.no, x.of) && !payStops(x, 'qualify').length).slice(0, 2)) {
    const at = r.log[r.log.length - 1]?.at ?? r.at
    r.state = 'eligible'
    r.hoursInState = 20
    r.log.push({ at, who: r.owner, role: 'مشرف المنح', what: 'راجع متطلبات الدفعة والتقارير المرفوعة', step: 5 })
    r.log.push({ at, who: r.owner, role: 'مشرف المنح', what: 'اعتمد المتطلبات · أصبحت الدفعة «مؤهلة للصرف»', step: 7, notified: 'الجهة المستفيدة · اعتُمدت متطلبات الدفعة' })
  }
  const fin = payRequests.filter((r) => r.state === 'finance')
  fin.forEach((r, i) => {
    if (i % 2) return
    const at = r.log[r.log.length - 1]?.at ?? r.at
    r.order = { at, by: 'ريم الشمري' }
    r.log.push({ at, who: 'ريم الشمري', role: FIN, what: 'راجعت إذن الصرف واعتمدت أمر الصرف', step: 14 })
    r.log.push({ at, who: 'النظام', role: 'النظام', what: 'أنشأ أمر الصرف وربطه بالمشروع والاتفاقية والدفعة ومصادر التمويل', step: 15 })
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

/** The next free number · after the highest one used, so a seed with gaps never hands out an id twice */
export const nextRequestId = (): string =>
  `SR-2026-${String(Math.max(11_399, ...payRequests.map((r) => Number(r.id.slice(-5)) || 0)) + 1).padStart(5, '0')}`

/** v3 · 9.2.2 · the payment's requirements · raised by the entity from its portal, or by the authority
    on an external party's behalf (9.4.5) · no amount: the payment's value is the schedule's */
export function createRequest(v: { projectId: string; no: number; docs: PayDoc[]; origin: 'entity' | 'proxy' }, by: string, role?: RoleKey): { id?: string; errors: string[] } {
  const p = payableProjects().find((x) => x.id === v.projectId)
  if (!p) return { errors: ['المشروع غير متاح للصرف'] }
  if (!p.can) return { errors: [p.why ?? 'المشروع غير متاح للصرف'] }
  const slot = scheduleOf(v.projectId).find((s) => s.no === v.no)
  if (!slot) return { errors: ['الدفعة غير موجودة في الجدول'] }
  const errors: string[] = []
  if (v.origin === 'proxy' && !p.external) errors.push('الرفع نيابةً عن الجهة للمشاريع المدعومة عبر جهات خارجية فقط')
  if (v.origin === 'proxy' && role && !PROXY_ROLES.includes(role)) errors.push('الرفع نيابةً عن الجهة لصاحب الصلاحية')
  if (v.origin === 'entity' && p.external) errors.push('ترفع متطلبات الجهة الخارجية نيابةً عنها من داخل النظام')
  errors.push(...slotStops(slot, v.projectId))
  if (slot.state === 'eligible') errors.push('الدفعة مؤهلة للصرف بلا دورة متطلبات · ينشئ مشرف المنح إذن الصرف')
  const needs = slot.needs ?? []
  if (needs.some((n) => !v.docs.some((d) => d.kind === n.kind))) errors.push(/* doc 9.2.3 */ 'ينقص من متطلبات الدفعة')
  if (errors.length) return { errors }
  const id = nextRequestId()
  run({ op: 'create', id, ...v, by, at: now() })
  return { id, errors: [] }
}

/** Why a payment can't be raised or permitted now · the same reasons the schedule shows */
function slotStops(slot: PaySlot, projectId: string): string[] {
  const out: string[] = []
  if (slot.state === 'pending') out.push(/* doc 9.4.3 */ 'للدفعة إذن أو متطلبات مفتوحة')
  if (slot.state === 'paid') out.push('الدفعة مصروفة')
  if (slot.state === 'queued') out.push('قرار المؤسسة: تُصرف الدفعات بترتيبها · لم تبدأ الدفعة السابقة بعد')
  if (slot.state === 'held') out.push(/* doc 9.4.8 */ `الدفعة مرتبطة بشرط لم يُستوفَ بعد · ${slot.condition ?? ''}`.trim())
  if (slot.state === 'stopped') out.push('أُوقف المشروع بقرار · لا صرف بعده')
  if (slot.state === 'settled') out.push('سُوّيت الدفعة · لا تُصرف')
  const cb = closingBlock(projectId, slot.no, slot.of)
  if (cb) out.push(cb)
  return out
}

/** v3 · 9.2.2 · 9.2.10 · a first or only payment with no condition of its own · the supervisor creates
    its permit straight from the schedule */
export function createPermit(v: { projectId: string; no: number; asked: number; note?: string }, by: string, role: RoleKey): { id?: string; errors: string[] } {
  if (role !== 'supervisor') return { errors: ['ينشئ إذن الصرف مشرف المنح'] }
  const p = payableProjects().find((x) => x.id === v.projectId)
  if (!p) return { errors: ['المشروع غير متاح للصرف'] }
  if (!p.can) return { errors: [p.why ?? 'المشروع غير متاح للصرف'] }
  const slot = scheduleOf(v.projectId).find((s) => s.no === v.no)
  if (!slot) return { errors: ['الدفعة غير موجودة في الجدول'] }
  const errors = slotStops(slot, v.projectId)
  if (slot.state !== 'eligible' && !errors.length) errors.push('الدفعة لها متطلبات · يُنشأ الإذن بعد اعتمادها')
  if (!(v.asked > 0)) errors.push('أدخل قيمة الإذن')
  if (v.asked > (slot.left ?? slot.amount)) errors.push(/* doc 9.4.4 */ slot.left !== undefined ? 'قيمة الإذن أعلى من باقي الدفعة' : 'قيمة الإذن أعلى من الدفعة المعتمدة')
  if (slot.notBefore) errors.push(/* doc 9.4.7 */ `لا صرف قبل ${slot.notBefore} · شرط الاتفاقية`)
  if (v.asked > grantLeft(v.projectId)) errors.push(/* doc 9.4.16 */ 'القيمة تتجاوز المتبقي من المنحة')
  if (slot.no === 1) for (const c of unmetBefore(v.projectId, 'firstPay')) errors.push(`شرط قبل الدفعة الأولى لم يُستوفَ: ${c.text}`)
  const y = payYearIssue(v.projectId, slot.dueAt, v.asked)
  if (y) errors.push(y)
  if (!isExternal(v.projectId)) { const blocked = payBlock(entityById(p.entityId)); if (blocked) errors.push(blocked) }
  if (errors.length) return { errors }
  const id = nextRequestId()
  run({ op: 'permitNew', id, ...v, by, at: now() })
  return { id, errors: [] }
}

/** v3 · 11.2.10 · the permit's states before the transfer order · the payee may be set */
const PAYEE_STATES: PayRequest['state'][] = ['supervisor', 'eligible', 'manager', 'exec']
export const mayPayee = (r: PayRequest, role: RoleKey) => role === 'supervisor' && isExternal(r.projectId) && PAYEE_STATES.includes(r.state)
/** v3 · 11.2.10 · 11.4.10 · a transfer to a third party · its formal document, the actual beneficiary and the reference */
export function setPayee(id: string, v: { name: string; ref: string; doc: string }, by: string, role: RoleKey): string[] {
  const r = payRequestById(id)
  if (!r) return ['السجل غير موجود']
  if (!isExternal(r.projectId)) return ['التحويل لطرف ثالث للمشروع المدعوم عبر جهة خارجية']
  if (!mayPayee(r, role)) return ['يُسجَّل قبل أمر الصرف · من مشرف المنح']
  const out: string[] = []
  if (!v.doc) out.push('المستند أو الاتفاقية الرسمية المبرّرة')
  if (!v.name.trim()) out.push('اسم المستفيد الفعلي')
  if (!v.ref.trim()) out.push('المرجع')
  if (out.length) return out
  run({ op: 'payee', id, name: v.name.trim(), ref: v.ref.trim(), doc: v.doc, by, at: now() })
  return []
}

/** 9.2.9 · the entity (or the authority, for an external party) completes what was missing */
export function resubmitRequest(id: string, docs: PayDoc[], by: string, role?: RoleKey, asEntity = false): string[] {
  const r = payRequestById(id)
  if (!r) return ['السجل غير موجود']
  if (r.origin === 'proxy' ? asEntity || (role !== undefined && !PROXY_ROLES.includes(role)) : !asEntity && role !== undefined) return ['يستكمل المتطلبات من رفعها · الجهة من بوابتها، أو صاحب الصلاحية نيابةً عن الجهة الخارجية']
  if (!mayResubmit(r)) return [/* doc 9.4.20 */ 'لا تُعدَّل المتطلبات بعد اعتمادها']
  const have = new Set([...r.docs.map((d) => d.kind), ...docs.map((d) => d.kind)])
  if (needsFor(r).some((n) => !have.has(n.kind))) return [/* doc 9.2.3 */ 'ينقص من متطلبات الدفعة']
  run({ op: 'resubmit', id, docs, by, at: now() })
  return []
}

/** A decision on the request · the store refuses what its stage or controls don't allow */
export function actOnPay(id: string, act: PayAct, note: string, by: string, role: RoleKey, file?: string, amount?: number): string[] {
  const r = payRequestById(id)
  if (!r) return ['السجل غير موجود']
  const a = payActions(r, role).find((x) => x.act === act)
  if (!a) return ['الإجراء غير متاح لك في هذه المرحلة']
  if (a.needsNote && !note.trim()) return [act === 'cancel' ? 'سبب الإلغاء إلزامي · 9.4.24' : 'اكتب الملاحظات أولًا']
  if (a.needsFile && !file) return [`ارفع ${a.needsFile} أولًا`]
  const stops = payStops(r, act, act === 'permit' ? (amount ?? r.due) : r.asked)
  if (stops.length) return stops
  run({ op: 'act', id, act, note, file, amount: act === 'permit' ? (amount ?? r.due) : undefined, role: roleByKey(role).title, by, at: now() })
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
  if (!r) return ['السجل غير موجود']
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
  if (s.state === 'paid' || s.state === 'pending') return ['للدفعة إذن أو صرف · لا تُسوّى']
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
