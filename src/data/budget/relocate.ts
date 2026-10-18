import { done } from '@/data/feedback'
import { useSyncExternalStore } from 'react'
import { dayOf, stampNow } from '@/data/clock'
import { docTitle, moneyOf } from '@/data/mock/budgetTree'
import { projectRows } from '@/data/mock/projects'
import { payRequests } from '@/data/mock/disbursements'
import { roleByKey, type RoleKey } from '@/data/roles'
import { nf } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import { BUDGET_NOTES, docOf, freeOf, linkIssues, linkOf, relocateLink, type LinkShare } from './store'
import { BUDGET_RULES } from './rules'

/* v3 · 1.3b · «إعادة تسكين مشروع» · moving an approved project's funding to another line, by a
   request with its own number and state.

   The authority holder (finance by default) opens the request on the project: the current link shows,
   he draws the new one, says whether all the money moves or only what isn't paid yet (1.3b.3), writes
   the reason and attaches the decision when there is one (1.3b.2). The system checks the new link and
   the balance and shows the current and new links side by side with the payments already made and
   what the move does to each line before it runs (1.3b.4). He sends it (1.3b.5); the approver (the
   executive director by default) approves or returns it with a note (1.3b.6); on approval the system
   executes it (1.3b.7) · the money moves on the budget's own log, this file keeps the request.

   Same model as the other stores: an ordered list of operations kept in the browser and replayed at
   load · the money itself replays from the budget's log, so a reload never moves it twice. */

export type RelocState = 'draft' | 'submitted' | 'returned' | 'approved'
export const RELOC_SAY: Record<RelocState, string> = { draft: 'مسودة', submitted: 'بانتظار الاعتماد', returned: 'مُعاد للمراجعة', approved: 'معتمد ونُفّذ' }
export type RelocScope = 'unpaid' | 'all'
export const SCOPE_SAY: Record<RelocScope, string> = { unpaid: 'المبالغ غير المصروفة فقط', all: 'جميع المبالغ بما فيها المصروفة' }

export interface NewShare { docId: string; nodeId: string; amount: number }
export interface RelocEvent { at: string; by: string; text: string; note?: string }
export interface Relocation {
  id: string
  projectId: string
  projectName: string
  by: string
  at: string
  state: RelocState
  scope: RelocScope
  reason: string
  files: string[]
  /** The link as it stood when the request was written */
  from: LinkShare[]
  to: NewShare[]
  events: RelocEvent[]
  decided?: { by: string; at: string; note: string }
}

export const RELOCATIONS: Relocation[] = []
export const relocationById = (id: string): Relocation | undefined => RELOCATIONS.find((r) => r.id === id)
export const relocationsOf = (projectId: string): Relocation[] => RELOCATIONS.filter((r) => r.projectId === projectId)
export const openRelocation = (projectId: string): Relocation | undefined =>
  RELOCATIONS.find((r) => r.projectId === projectId && r.state !== 'approved')

export const mayRequestRelocation = (role: RoleKey): boolean => BUDGET_RULES.relocateBy.includes(role)
export const mayApproveRelocation = (role: RoleKey): boolean => BUDGET_RULES.relocateApproveBy.includes(role)

const titles = (roles: RoleKey[]) => roles.map((k) => roleByKey(k).title)

/** What moves · the whole link, or only what isn't paid yet */
export const movingOf = (from: LinkShare[], scope: RelocScope): number =>
  from.reduce((a, x) => a + (scope === 'unpaid' ? x.amount - x.paid : x.amount), 0)

/** The payments already made on the project · shown before the move (1.3b.4) */
export const paidPayments = (projectId: string) =>
  payRequests.filter((r) => r.projectId === projectId && r.state === 'paid').map((r) => ({ no: r.no, amount: r.asked, at: r.paidAt ?? r.dueAt }))

export interface LineEffect { key: string; label: string; budget: string; before: number; after: number; delta: number }

/** What the move does to each line's available balance · the old lines get back what leaves them,
    the new ones give what they take (1.3b.4) */
export function relocationEffects(r: Pick<Relocation, 'from' | 'to' | 'scope'>): LineEffect[] {
  const delta = new Map<string, number>()
  for (const x of r.from) {
    const back = r.scope === 'unpaid' ? x.amount - x.paid : x.amount
    delta.set(`${x.docId}/${x.nodeId}`, (delta.get(`${x.docId}/${x.nodeId}`) ?? 0) + back)
  }
  for (const x of r.to) delta.set(`${x.docId}/${x.nodeId}`, (delta.get(`${x.docId}/${x.nodeId}`) ?? 0) - x.amount)
  return [...delta].map(([key, d]) => {
    const [docId, nodeId] = key.split('/')
    const doc = docOf(docId)
    const n = doc?.nodes.find((y) => y.id === nodeId)
    const before = doc ? moneyOf(doc.nodes, nodeId).available : 0
    return { key, label: n?.label ?? nodeId, budget: doc ? docTitle(doc) : docId, before, after: before + d, delta: d }
  })
}

/** The request's checks · before it's sent and again before it executes (1.3b.4) */
export function relocationIssues(r: Pick<Relocation, 'projectId' | 'projectName' | 'by' | 'to' | 'scope' | 'reason'> & { files?: string[] }): string[] {
  const out: string[] = []
  const l = linkOf(r.projectId)
  if (!l || l.stage !== 'final') return ['إعادة التسكين لمشروع معتمد بحجز نهائي']
  if (!r.reason.trim()) out.push('اكتب سبب إعادة التسكين')
  /* Client 18 Oct (#7) · sent only once the data the system asks for is complete · the decision or
     supporting document is part of it */
  if (r.files !== undefined && !r.files.length) out.push('أرفق القرار أو المستند الداعم')
  if (!r.to.length || r.to.some((x) => !x.docId || !x.nodeId)) out.push('اختر بند الارتباط الجديد')
  const need = movingOf(l.shares, r.scope)
  const total = r.to.reduce((a, x) => a + x.amount, 0)
  if (r.scope === 'unpaid' && need === 0) out.push('لا مبالغ غير مصروفة تُعاد تسكينها')
  if (total !== need) out.push(`مجموع الارتباط الجديد ${nf.format(total)} والمبلغ المنقول ${nf.format(need)}`)
  const same = l.shares.length === r.to.length && r.to.every((x) => l.shares.some((y) => y.docId === x.docId && y.nodeId === x.nodeId && (r.scope === 'unpaid' ? y.amount - y.paid : y.amount) === x.amount))
  if (same) out.push('الارتباط الجديد مطابق للحالي')
  if (out.length) return out
  /* The line checks (active, a leaf, an approved budget, each level covering) · the balance on each
     new line counts back what the old link releases there */
  /* Every level of each new line's tree and each source, with the whole old link counted back (exact for
     «all» · for «unpaid» the leaf check below counts back only what really leaves) */
  out.push(...linkIssues({ projectId: r.projectId, projectName: r.projectName, by: r.by, shares: r.to }))
  for (const x of r.to) {
    const d = docOf(x.docId)
    const n = d?.nodes.find((y) => y.id === x.nodeId)
    if (!d || !n) continue
    const back = l.shares.filter((y) => y.docId === x.docId && y.nodeId === x.nodeId).reduce((a, y) => a + (r.scope === 'unpaid' ? y.amount - y.paid : y.amount), 0)
    const free = freeOf(d, x.nodeId) + back
    if (x.amount > free) out.push(`الرصيد غير كافٍ في «${n.label}» · المتاح ${nf.format(Math.max(0, free))} والمطلوب ${nf.format(x.amount)} · العجز ${nf.format(x.amount - Math.max(0, free))}`)
  }
  return out
}

/* ── Operations ── */

type Op = { at: string } & (
  | { op: 'save'; req: Omit<Relocation, 'state' | 'events' | 'decided'>; send: boolean }
  | { op: 'decide'; id: string; outcome: 'approve' | 'return'; note: string; by: string }
)

const KEY = 'ab-relocate-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export function useRelocations(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}

const note = (to: string[], title: string, context: string, at: string, projectId: string) => {
  for (const t of to) BUDGET_NOTES.unshift({ id: `bn-rl-${BUDGET_NOTES.length + 1}`, to: t, title, context, at: at.slice(0, 10), href: ROUTES.projectTab(projectId, 'approval') })
}

const apply = (o: Op) => {
  switch (o.op) {
    case 'save': {
      let r = relocationById(o.req.id)
      if (r && r.state !== 'draft' && r.state !== 'returned') return
      if (!r) {
        r = { ...structuredClone(o.req), state: 'draft', events: [{ at: o.at, by: o.req.by, text: 'أُنشئ الطلب' }] }
        RELOCATIONS.unshift(r)
      } else Object.assign(r, structuredClone(o.req))
      if (o.send) {
        r.state = 'submitted'
        r.events.unshift({ at: o.at, by: o.req.by, text: `أُرسل إلى ${titles(BUDGET_RULES.relocateApproveBy).join(' أو ')} للاعتماد النهائي` })
        note(titles(BUDGET_RULES.relocateApproveBy), `طلب إعادة تسكين · ${r.id}`, `${r.projectName} · ${nf.format(movingOf(r.from, r.scope))} · ${SCOPE_SAY[r.scope]}`, o.at, r.projectId)
      } else r.events.unshift({ at: o.at, by: o.req.by, text: 'حُفظ مسودة' })
      return
    }
    case 'decide': {
      const r = relocationById(o.id)
      if (!r || r.state !== 'submitted') return
      r.decided = { by: o.by, at: o.at, note: o.note }
      if (o.outcome === 'approve') {
        r.state = 'approved'
        r.events.unshift({ at: o.at, by: o.by, text: 'اعتُمد الطلب ونُفّذت إعادة التسكين تلقائيًا', note: o.note || undefined })
        note([r.by, 'مدير المنح'], `نُفّذت إعادة التسكين · ${r.id}`, r.projectName, o.at, r.projectId)
      } else {
        r.state = 'returned'
        r.events.unshift({ at: o.at, by: o.by, text: 'أُعيد للمراجعة وإجراء التعديلات', note: o.note })
        note([r.by], `أُعيد طلب إعادة التسكين · ${r.id}`, o.note, o.at, r.projectId)
      }
      return
    }
  }
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ } }
const run = (o: Op) => { ops.push(o); apply(o); save(); emit(); done(o.op, 'الميزانية') }

try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
for (const o of ops) apply(o)

const now = () => new Date().toISOString()

export const nextRelocationId = (): string => `RL-2026-${String(RELOCATIONS.length + 1).padStart(3, '0')}`

/** Save the request, or send it for the final approval (1.3b.5) · the reasons it can't be sent */
export function saveRelocation(req: Omit<Relocation, 'state' | 'events' | 'decided' | 'from' | 'at'>, send: boolean): string[] {
  const l = linkOf(req.projectId)
  if (!l || l.stage !== 'final') return ['إعادة التسكين لمشروع معتمد بحجز نهائي']
  const prev = relocationById(req.id)
  if (prev && prev.state !== 'draft' && prev.state !== 'returned') return ['الطلب ليس في يد مقدّمه']
  if (send) { const why = relocationIssues(req); if (why.length) return why }
  run({ op: 'save', req: { ...req, from: l.shares.map((x) => ({ ...x })), at: prev?.at ?? dayOf(stampNow()) }, send, at: now() })
  return []
}

/** The approver's decision (1.3b.6) · approval executes the move at once (1.3b.7) */
export function decideRelocation(id: string, outcome: 'approve' | 'return', noteText: string, by: string): string[] {
  const r = relocationById(id)
  if (!r || r.state !== 'submitted') return ['الطلب ليس بانتظار الاعتماد']
  if (outcome === 'return' && !noteText.trim()) return ['اكتب ملاحظات الإعادة']
  if (outcome === 'approve') {
    /* the document was checked at sending · the execution re-checks the money only */
    const why = relocationIssues({ ...r, files: undefined })
    if (why.length) return why
    const p = projectRows.find((x) => x.id === r.projectId)
    const before = JSON.stringify(linkOf(r.projectId)?.shares)
    relocateLink({ projectId: r.projectId, projectName: p?.name ?? r.projectName, by, shares: r.to }, `إعادة تسكين ${r.id} · ${r.reason}`, r.scope === 'unpaid', r.id)
    /* The move is the budget's own operation · if it didn't run, the request isn't approved */
    if (JSON.stringify(linkOf(r.projectId)?.shares) === before) return ['تعذّر تنفيذ إعادة التسكين على الميزانية · راجع أرصدة البنود ومستوياتها']
  }
  run({ op: 'decide', id, outcome, note: noteText.trim(), by, at: now() })
  return []
}

/** Requests waiting for the signed-in approver · for the inbox */
export const relocationsWaiting = (role: RoleKey): Relocation[] =>
  mayApproveRelocation(role) ? RELOCATIONS.filter((r) => r.state === 'submitted') : mayRequestRelocation(role) ? RELOCATIONS.filter((r) => r.state === 'returned') : []
