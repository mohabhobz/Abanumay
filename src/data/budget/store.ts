import { useSyncExternalStore } from 'react'
import { allBudgets } from '@/data/mock/chain'
import {
  budgetDocs, budgetEditable, cascadeActive, childrenOf, docSources, docTitle, fiscalYears, freezeLine,
  fundSources, hasChildren, isLiveBudget, leavesOf, lineUsable, moneyOf, nameTaken, pathOf, restate,
  sourceByCode, treeIssues, yearById, yearOverlap,
  type BudgetDoc, type BudgetNode, type BudgetState, type FiscalYear, type FundSource, type SourceShare,
} from '@/data/mock/budgetTree'
import { projectRows } from '@/data/mock/projects'
import { payRequests } from '@/data/mock/disbursements'
import { ALL_FIELDS, CYCLE, TODAY, setFundingGate } from '@/data/intake/cycle'
import { roleByKey, type RoleKey } from '@/data/roles'
import { nf, pct } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import { BUDGET_RULES } from './rules'

/* Budget (BPD-001) · the actions.

   Fiscal years, funding sources and strategic directions are master data written here, so a year
   added in settings is the year the new-budget screen offers. Budget documents are saved, sent and
   decided here, step by step (1.2.8–1.2.12); operation requests (transfer, increase, decrease) take
   the same path and execute on their final approval (1.3); multi-year funding plans record future
   commitments and hold each year's share when the year starts (1.4.46–1.4.53). Every money change
   is a movement on the budget's own ledger, with the value before and after (1.4.5 · 1.4.35).

   Same model as intake and entities: an ordered list of operations kept in the browser and replayed
   at load, so a reload lands on the same state; in production each operation is a POST. */

/* ── Strategic directions (1.1.input-1) ── */

export interface Direction { id: string; name: string; note: string; active: boolean }

export const DIRECTIONS: Direction[] = [
  { id: 'dir-edu', name: 'تمكين التعليم النوعي', note: 'رفع جودة التعليم العام والعالي وربطه بسوق العمل', active: true },
  { id: 'dir-health', name: 'صحة المجتمع والوقاية', note: 'الرعاية الصحية والتوعية والبرامج الوقائية', active: true },
  { id: 'dir-community', name: 'التنمية المجتمعية المستدامة', note: 'تمكين الأفراد والأسر ودعم المبادرات المحلية', active: true },
  { id: 'dir-relief', name: 'الإغاثة والاستجابة العاجلة', note: 'الاحتياجات الطارئة خارج الخطة السنوية', active: true },
]

export const directionById = (id: string): Direction | undefined => DIRECTIONS.find((d) => d.id === id)

/* ── History on each budget (1.2.13) ── */

export interface BudgetEvent { at: string; by: string; text: string; note?: string; tone?: 'ok' | 'ret' | 'warn' }

const EVENTS = new Map<string, BudgetEvent[]>()
export const eventsOf = (id: string): BudgetEvent[] => EVENTS.get(id) ?? []
const log = (id: string, ev: BudgetEvent) => {
  const list = EVENTS.get(id) ?? []
  list.unshift(ev)
  EVENTS.set(id, list)
}

/* ── The ledger (1.4.5 · 1.4.24 · 1.4.35) ── */

export type MoveKind =
  | 'open' | 'transfer-out' | 'transfer-in' | 'increase' | 'decrease'
  | 'hold' | 'release' | 'paid' | 'commit' | 'uncommit' | 'annual-hold'

export const MOVE_SAY: Record<MoveKind, string> = {
  open: 'تخصيص عند الاعتماد',
  'transfer-out': 'مناقلة · خصم',
  'transfer-in': 'مناقلة · إضافة',
  increase: 'تعزيز',
  decrease: 'تخفيض',
  hold: 'حجز',
  release: 'فكّ حجز',
  paid: 'صرف',
  commit: 'التزام مستقبلي',
  uncommit: 'إلغاء التزام',
  'annual-hold': 'حجز سنوي آلي',
}

export interface Movement {
  id: string
  at: string
  docId: string
  nodeId: string
  kind: MoveKind
  amount: number
  /** The figure the movement changes · allocation, held or committed · before and after */
  before: number
  after: number
  by: string
  ref?: string
  note?: string
}

const MOVES: Movement[] = []
const move = (m: Omit<Movement, 'id'>) => MOVES.push({ ...m, id: `mv-${MOVES.length + 1}` })

export const movesOf = (docId: string, nodeId?: string): Movement[] =>
  MOVES.filter((m) => m.docId === docId && (!nodeId || m.nodeId === nodeId || isUnder(docId, m.nodeId, nodeId)))
    .sort((a, b) => b.at.localeCompare(a.at))

const isUnder = (docId: string, id: string, ancestor: string): boolean => {
  const d = docOf(docId)
  let cur = d?.nodes.find((x) => x.id === id)
  while (cur?.parentId) {
    if (cur.parentId === ancestor) return true
    const up: string = cur.parentId
    cur = d?.nodes.find((x) => x.id === up)
  }
  return false
}

/** An approved budget's opening · each line's allocation, and what was already held and paid */
const opening = (d: BudgetDoc, at: string, by: string) => {
  for (const n of leavesOf(d.nodes)) {
    if (n.parentId === null) continue
    move({ at, docId: d.id, nodeId: n.id, kind: 'open', amount: n.allocated, before: 0, after: n.allocated, by, ref: d.id })
    const m = moneyOf(d.nodes, n.id)
    if (m.paid) move({ at, docId: d.id, nodeId: n.id, kind: 'paid', amount: m.paid, before: 0, after: m.paid, by: 'الإدارة المالية', note: 'رصيد منصرف عند الاعتماد' })
    if (m.held) move({ at, docId: d.id, nodeId: n.id, kind: 'hold', amount: m.held, before: 0, after: m.held, by: 'النظام', note: 'رصيد محجوز عند الاعتماد' })
  }
}

/* ── Budget operation requests (1.3) ── */

export type ReqKind = 'transfer' | 'increase' | 'decrease'
export type ReqState = 'draft' | 'returned' | 'submitted' | 'finance' | 'exec' | 'executed' | 'rejected'

export const REQ_KIND_SAY: Record<ReqKind, string> = { transfer: 'مناقلة', increase: 'تعزيز', decrease: 'تخفيض' }
export const REQ_STATE_SAY: Record<ReqState, string> = {
  draft: 'مسودة',
  returned: 'معاد للمُعِدّ',
  submitted: 'لدى مدير المنح',
  finance: 'لدى الإدارة المالية',
  exec: 'لدى المدير التنفيذي',
  executed: 'معتمد · نُفِّذ',
  rejected: 'مرفوض',
}
export const reqTone = (s: ReqState): 'ok' | 'warn' | 'ret' | 'mute' | 'no' =>
  s === 'executed' ? 'ok' : s === 'returned' ? 'ret' : s === 'draft' ? 'mute' : s === 'rejected' ? 'no' : 'warn'

export interface BudgetRequest {
  id: string
  yearId: string
  docId: string
  kind: ReqKind
  /** The line the money leaves · transfer and decrease */
  fromId?: string
  /** The line the money reaches · transfer and increase */
  toId?: string
  amount: number
  /** For an increase or a decrease on a budget with several sources · which one moves */
  source?: string
  reason: string
  files: string[]
  state: ReqState
  by: string
  createdAt: string
  submittedAt?: string
  note?: string
  events: BudgetEvent[]
  /** What the execution changed · line, allocation before and after */
  result?: { nodeId: string; label: string; before: number; after: number }[]
}

export const BUDGET_REQS: BudgetRequest[] = []
export const reqById = (id: string): BudgetRequest | undefined => BUDGET_REQS.find((r) => r.id === id)

/* ── Multi-year funding plans (1.4.46–1.4.53 · 3.2.14 · 3.2.15 · 3.4.33–3.4.35) ── */

export interface YearShare { docId: string; nodeId: string; amount: number }
export interface PlanYear {
  yearId: string
  amount: number
  /** One year's share may come from more than one budget (1.4.50) */
  shares: YearShare[]
  /** Set when the annual hold ran · the date, or the reason it couldn't */
  heldAt?: string
  refused?: string
}
export interface FundingPlan {
  projectId: string
  projectName: string
  kind: 'single' | 'multi'
  total: number
  years: PlanYear[]
  by: string
  at: string
  version: number
}

const PLANS = new Map<string, FundingPlan>()
export const planOf = (projectId: string): FundingPlan | undefined => PLANS.get(projectId)
export const allPlans = (): FundingPlan[] => [...PLANS.values()]

/* ── Project links · a single-year project held on one line ── */

export interface LineLink { projectId: string; projectName: string; docId: string; nodeId: string; amount: number; by: string; at: string }
const LINKS = new Map<string, LineLink>()
export const linkOf = (projectId: string): LineLink | undefined => LINKS.get(projectId)
export const allLinks = (): LineLink[] => [...LINKS.values()]

/* ── Notifications the budget raises · read by the drawer ── */

export interface BudgetNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const BUDGET_NOTES: BudgetNote[] = []
const notify = (to: string[], title: string, context: string, at: string, href: string) => {
  for (const t of to) BUDGET_NOTES.unshift({ id: `bn-${BUDGET_NOTES.length + 1}`, to: t, title, context, at: at.slice(0, 10), href })
}
const titlesOf = (roles: RoleKey[]) => roles.map((k) => roleByKey(k).title)

/* ── Readers ── */

export const docOf = (id: string): BudgetDoc | undefined => allBudgets.find((d) => d.id === id)
export const liveBudgets = (): BudgetDoc[] => allBudgets.filter(isLiveBudget)
export const budgetsOfYear = (yearId: string): BudgetDoc[] => allBudgets.filter((d) => d.yearId === yearId)

/** Finance isn't a role in the switcher · its step is signed by the finance department's user, as
    in disbursements, while the role settings name previews it */
export const FINANCE_ACTOR = 'محمد المطيري'

export type Step = 'prepare' | 'manager' | 'finance' | 'exec' | 'status'
const STEP_ROLES = (s: Step): RoleKey[] =>
  s === 'prepare' ? BUDGET_RULES.prepareBy
    : s === 'manager' ? BUDGET_RULES.managerBy
      : s === 'finance' ? BUDGET_RULES.financeBy
        : s === 'exec' ? BUDGET_RULES.execBy
          : BUDGET_RULES.statusBy
export const mayAct = (s: Step, role: RoleKey): boolean => STEP_ROLES(s).includes(role)
export const stepOf = (s: BudgetState | ReqState): Step | null =>
  s === 'draft' || s === 'returned' ? 'prepare' : s === 'submitted' ? 'manager' : s === 'finance' ? 'finance' : s === 'exec' ? 'exec' : null
export const whoActs = (s: BudgetState | ReqState): string => {
  const st = stepOf(s)
  return st ? STEP_ROLES(st).map((k) => (st === 'finance' ? 'الإدارة المالية' : roleByKey(k).title)).filter((x, i, a) => a.indexOf(x) === i).join(' أو ') : ''
}

/** The header's own checks · name, year, sources, period (1.4.1–1.4.4) */
export function headIssues(d: BudgetDoc): string[] {
  const out: string[] = []
  if (!d.name?.trim()) out.push('أدخل اسم الميزانية')
  if (!d.yearId) out.push('اختر السنة المالية')
  if (!(d.total > 0)) out.push('أدخل المبلغ الإجمالي')
  const src = docSources(d)
  if (!src.length) out.push('اختر مصدر تمويل واحدًا على الأقل')
  if (src.some((x) => !(x.amount > 0))) out.push('لكل مصدر تمويل مبلغه')
  if (new Set(src.map((x) => x.code)).size !== src.length) out.push('مصدر التمويل مكرّر')
  if (!d.directionIds?.length) out.push('اختر التوجه الاستراتيجي الذي تُبنى عليه الميزانية')
  const y = yearById(d.yearId)
  if (y && d.from && d.to) {
    if (d.to < d.from) out.push('تاريخ النهاية قبل تاريخ البداية')
    if (d.from < y.from || d.to > y.to) out.push(`مدة الميزانية خارج السنة المالية ${y.name}`)
  }
  const twin = d.name ? nameTaken(allBudgets, d.yearId, d.name, d.id) : undefined
  if (twin) out.push(`يوجد في السنة نفسها ميزانية بالاسم ذاته (${twin.id})`)
  return out
}

export const nextDocId = (yearId: string): string => {
  const y = yearById(yearId)?.name ?? 'NEW'
  let i = 1
  while (allBudgets.some((d) => d.id === `BG-${y}-${String(i).padStart(2, '0')}`)) i++
  return `BG-${y}-${String(i).padStart(2, '0')}`
}

const nextReqId = (): string => {
  let i = BUDGET_REQS.length + 1
  while (BUDGET_REQS.some((r) => r.id === `BOP-2026-${String(i).padStart(4, '0')}`)) i++
  return `BOP-2026-${String(i).padStart(4, '0')}`
}
export { nextReqId }

/** What a line carries · the reasons it can't be deleted (1.4.19) */
export interface LineDeps { children: number; projects: string[]; moves: number; held: number; paid: number; committed: number }
export function lineDeps(d: BudgetDoc, nodeId: string): LineDeps {
  const sub = [nodeId, ...d.nodes.filter((x) => isUnder(d.id, x.id, nodeId)).map((x) => x.id)]
  const m = moneyOf(d.nodes, nodeId)
  const projects = new Set<string>()
  for (const l of LINKS.values()) if (l.docId === d.id && sub.includes(l.nodeId)) projects.add(l.projectName)
  for (const p of PLANS.values()) for (const y of p.years) for (const s of y.shares) if (s.docId === d.id && sub.includes(s.nodeId)) projects.add(p.projectName)
  for (const p of projectsOnLine(d, nodeId)) projects.add(p)
  return {
    children: childrenOf(d.nodes, nodeId).length,
    projects: [...projects],
    moves: MOVES.filter((x) => x.docId === d.id && sub.includes(x.nodeId) && x.kind !== 'open').length,
    held: m.held, paid: m.paid, committed: m.committed,
  }
}

/** The projects a generated line was built from · the 2026 budget's goals carry live projects */
function projectsOnLine(d: BudgetDoc, nodeId: string): string[] {
  if (d.id !== 'BG-2026-SA') return []
  const path = (id: string): string[] => {
    const out: string[] = []
    let cur = d.nodes.find((x) => x.id === id)
    while (cur?.parentId) { out.unshift(cur.label); const up: string = cur.parentId; cur = d.nodes.find((x) => x.id === up) }
    return out
  }
  const p = path(nodeId)
  return projectRows
    .filter((r) => r.year.startsWith('2026') && [r.track, r.field, r.goal].slice(0, p.length).every((x, i) => x === p[i]))
    .map((r) => r.name)
}

export const deleteBlock = (d: BudgetDoc, nodeId: string): string => {
  const x = lineDeps(d, nodeId)
  if (x.children) return `تحته ${nf.format(x.children)} بند · احذف ما تحته أولًا`
  if (x.projects.length) return `مرتبط بمشاريع قائمة (${nf.format(x.projects.length)})`
  if (x.held || x.paid || x.committed) return 'عليه مبالغ محجوزة أو مصروفة أو ملتزم بها'
  if (x.moves) return 'عليه حركات مالية مسجّلة'
  return ''
}

/** The supervisors responsible for a domain line · the line's own, else the intake cycle's */
export const ownersOf = (n: BudgetNode): string[] =>
  n.owners?.length ? n.owners : n.kind === 'main' ? CYCLE.domains[n.label]?.supervisors ?? [] : []

/* ── Funding gate for intake (1.1.output-5 · 1.4.37) ── */

/** Domains and goals open to new projects · active lines of an approved budget for the year */
export function fundedLines(yearName = TODAY.slice(0, 4)): { fields: Set<string>; goals: Set<string> } {
  const fields = new Set<string>()
  const goals = new Set<string>()
  for (const d of liveBudgets()) {
    if (yearById(d.yearId)?.name !== yearName) continue
    for (const n of d.nodes) {
      if (n.parentId === null || !lineUsable(d.nodes, n.id) || !(n.allocated > 0)) continue
      if (n.kind === 'main') fields.add(n.label)
      if (n.kind === 'sub') {
        const up = d.nodes.find((x) => x.id === n.parentId)
        if (up) goals.add(`${up.label}|${n.label}`)
      }
    }
  }
  return { fields, goals }
}

setFundingGate({
  field: (f) => {
    if (!BUDGET_RULES.requireFunding) return ''
    return fundedLines().fields.has(f) ? '' : 'لا بند نشطًا للمجال في ميزانية معتمدة للسنة'
  },
  goal: (field, goal) => {
    if (!BUDGET_RULES.requireFunding) return true
    const g = fundedLines().goals
    /* A domain whose goals aren't in the tree at all keeps the taxonomy's goals */
    const any = [...g].some((k) => k.startsWith(`${field}|`))
    return !any || g.has(`${field}|${goal}`)
  },
})

/* ── Operations ── */

type Op = { at: string } & (
  | { op: 'yearAdd'; year: FiscalYear; by: string }
  | { op: 'sourceAdd'; source: FundSource; by: string }
  | { op: 'sourceRename'; code: string; name: string; by: string }
  | { op: 'dirSave'; dir: Direction; by: string }
  | { op: 'docSave'; doc: BudgetDoc; by: string }
  | { op: 'docSubmit'; id: string; by: string }
  | { op: 'docDecide'; id: string; outcome: 'approve' | 'return'; note: string; by: string }
  | { op: 'lineStatus'; docId: string; nodeId: string; active: boolean; reason: string; by: string }
  | { op: 'lineOwner'; docId: string; nodeId: string; owners: string[]; by: string }
  | { op: 'link'; link: Omit<LineLink, 'at'> }
  | { op: 'unlink'; projectId: string; by: string }
  | { op: 'reqSave'; req: Omit<BudgetRequest, 'events' | 'state' | 'createdAt' | 'submittedAt' | 'result'>; send: boolean }
  | { op: 'reqDecide'; id: string; outcome: 'approve' | 'return' | 'reject'; note: string; by: string }
  | { op: 'planSave'; plan: Omit<FundingPlan, 'at' | 'version'> }
)

const KEY = 'ab-budget-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }

export function useBudget(): number {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f) } },
    () => version,
  )
}

const now = () => new Date().toISOString()

/* ── Money on lines ── */

const nodeOf = (d: BudgetDoc, id: string) => d.nodes.find((x) => x.id === id)
const upChain = (d: BudgetDoc, id: string): BudgetNode[] => {
  const out: BudgetNode[] = []
  let cur = nodeOf(d, id)
  while (cur) { out.push(cur); const up = cur.parentId; cur = up ? nodeOf(d, up) : undefined }
  return out
}

/** Move a line's allocation, and every line above it up to (not including) `stopAt` */
const shiftUp = (d: BudgetDoc, id: string, delta: number, source: string | undefined, stopAt: string | null) => {
  for (const n of upChain(d, id)) {
    if (n.id === stopAt) break
    freezeLine(n)
    n.allocated += delta
    if (n.sources?.length) {
      const code = source ?? n.sources[0].code
      const s = n.sources.find((x) => x.code === code) ?? n.sources[0]
      s.amount += delta
    }
    restate(n)
    if (n.parentId === null) {
      d.total += delta
      if (d.sources?.length) {
        const s = d.sources.find((x) => x.code === (source ?? d.sources![0].code)) ?? d.sources[0]
        s.amount += delta
      }
    }
  }
}

const lca = (d: BudgetDoc, a: string, b: string): string | null => {
  const up = new Set(upChain(d, a).map((x) => x.id))
  return upChain(d, b).find((x) => up.has(x.id))?.id ?? null
}

/** Free balance of a leaf · what a request may take without touching held, committed or paid (1.3.5) */
export const freeOf = (d: BudgetDoc, id: string): number => moneyOf(d.nodes, id).available

/** Checks a request before it's sent and again before it executes (1.3.4 · 1.3.5 · 1.4.33 · 1.4.34) */
export function reqIssues(r: Pick<BudgetRequest, 'docId' | 'kind' | 'fromId' | 'toId' | 'amount' | 'reason' | 'files' | 'source'>): string[] {
  const out: string[] = []
  const d = docOf(r.docId)
  if (!d) return ['اختر الميزانية']
  if (!isLiveBudget(d)) out.push('الميزانية غير معتمدة · العمليات على الميزانيات المعتمدة وحدها')
  if (!(r.amount > 0)) out.push('أدخل مبلغ العملية')
  if (!r.reason.trim()) out.push('اكتب سبب العملية')
  const leaf = (id?: string) => (id ? nodeOf(d, id) : undefined)
  const from = leaf(r.fromId)
  const to = leaf(r.toId)
  if (r.kind !== 'increase') {
    if (!from) out.push('اختر البند المنقول منه')
    else {
      if (hasChildren(d.nodes, from.id)) out.push(`«${from.label}» له بنود تحته · العمليات على البنود الفرعية`)
      const free = freeOf(d, from.id)
      if (r.amount > free) out.push(`المتاح في «${from.label}» ${nf.format(free)} · لا تمس العملية المحجوز والملتزم به والمصروف`)
      const cap = Math.floor(from.allocated * BUDGET_RULES.maxTransferPct / 100)
      if (r.kind === 'transfer' && r.amount > cap) out.push(`السياسة المالية: لا تتجاوز المناقلة ${pct(BUDGET_RULES.maxTransferPct)} من مخصص البند (${nf.format(cap)})`)
    }
  }
  if (r.kind !== 'decrease') {
    if (!to) out.push('اختر البند المنقول إليه')
    else {
      if (hasChildren(d.nodes, to.id)) out.push(`«${to.label}» له بنود تحته · العمليات على البنود الفرعية`)
      if (!lineUsable(d.nodes, to.id)) out.push(`«${to.label}» غير نشط · لا يستقبل مبالغ جديدة`)
    }
  }
  if (r.kind === 'transfer' && from && to && from.id === to.id) out.push('البند المنقول منه هو المنقول إليه')
  /* Both ends belong to the same budget · a request carries one budget, and its lines come from it */
  if (r.kind === 'transfer' && ((r.fromId && !from) || (r.toId && !to))) out.push('المناقلة داخل الميزانية نفسها فقط · لا بين ميزانيتين')
  if (r.amount >= BUDGET_RULES.attachAbove && r.files.length === 0) out.push(`من ${nf.format(BUDGET_RULES.attachAbove)} فأكثر يلزم مرفق داعم`)
  if (docSources(d).length > 1 && r.kind !== 'transfer' && !r.source) out.push('اختر مصدر التمويل الذي تجري عليه العملية')
  return out
}

const execute = (r: BudgetRequest, at: string, by: string) => {
  const d = docOf(r.docId)
  if (!d) return
  const touched = new Map<string, { label: string; before: number }>()
  const mark = (id: string) => { for (const n of upChain(d, id)) if (!touched.has(n.id)) touched.set(n.id, { label: n.label, before: n.allocated }) }
  if (r.fromId) mark(r.fromId)
  if (r.toId) mark(r.toId)
  if (r.kind === 'transfer' && r.fromId && r.toId) {
    const top = lca(d, r.fromId, r.toId)
    const fBefore = nodeOf(d, r.fromId)!.allocated
    const tBefore = nodeOf(d, r.toId)!.allocated
    shiftUp(d, r.fromId, -r.amount, r.source, top)
    shiftUp(d, r.toId, r.amount, r.source, top)
    move({ at, docId: d.id, nodeId: r.fromId, kind: 'transfer-out', amount: r.amount, before: fBefore, after: fBefore - r.amount, by, ref: r.id, note: r.reason })
    move({ at, docId: d.id, nodeId: r.toId, kind: 'transfer-in', amount: r.amount, before: tBefore, after: tBefore + r.amount, by, ref: r.id, note: r.reason })
  } else if (r.kind === 'increase' && r.toId) {
    const b = nodeOf(d, r.toId)!.allocated
    shiftUp(d, r.toId, r.amount, r.source, null)
    move({ at, docId: d.id, nodeId: r.toId, kind: 'increase', amount: r.amount, before: b, after: b + r.amount, by, ref: r.id, note: r.reason })
  } else if (r.kind === 'decrease' && r.fromId) {
    const b = nodeOf(d, r.fromId)!.allocated
    shiftUp(d, r.fromId, -r.amount, r.source, null)
    move({ at, docId: d.id, nodeId: r.fromId, kind: 'decrease', amount: r.amount, before: b, after: b - r.amount, by, ref: r.id, note: r.reason })
  }
  r.result = [...touched].map(([nodeId, v]) => ({ nodeId, label: v.label, before: v.before, after: nodeOf(d, nodeId)?.allocated ?? v.before }))
    .filter((x) => x.before !== x.after)
  log(d.id, { at, by, text: `نُفِّذ ${REQ_KIND_SAY[r.kind]} ${r.id} بمبلغ ${nf.format(r.amount)}`, tone: 'ok' })
}

/* ── Holds and commitments ── */

const hold = (d: BudgetDoc, nodeId: string, amount: number, at: string, by: string, kind: MoveKind, ref: string, note?: string) => {
  const n = nodeOf(d, nodeId)
  if (!n) return
  freezeLine(n)
  const before = n.held ?? 0
  n.held = before + amount
  restate(n)
  move({ at, docId: d.id, nodeId, kind, amount: Math.abs(amount), before, after: n.held, by, ref, note })
}

const commit = (d: BudgetDoc, nodeId: string, amount: number, at: string, by: string, ref: string) => {
  const n = nodeOf(d, nodeId)
  if (!n) return
  const before = n.committed ?? 0
  n.committed = Math.max(0, before + amount)
  move({ at, docId: d.id, nodeId, kind: amount >= 0 ? 'commit' : 'uncommit', amount: Math.abs(amount), before, after: n.committed, by, ref })
}

/** Paid on a project within a fiscal year · from the disbursement requests (1.4.52) */
export const paidInYear = (projectId: string, yearName: string): number =>
  payRequests.filter((r) => r.projectId === projectId && r.state === 'paid' && (r.paidAt ?? '').startsWith(yearName))
    .reduce((a, r) => a + r.asked, 0)

/** Will a payment fit its year's share · empty when it does, or when the project has no plan */
export function payYearIssue(projectId: string, dueAt: string, asked: number): string {
  const p = PLANS.get(projectId)
  if (!p || p.kind !== 'multi') return ''
  const yName = dueAt.slice(0, 4)
  const y = p.years.find((x) => yearById(x.yearId)?.name === yName)
  if (!y) return `لا حصة للمشروع في السنة المالية ${yName}`
  const left = y.amount - paidInYear(projectId, yName)
  if (!y.heldAt) return `حصة ${yName} لم تُحجز بعد · الصرف في حدود المحجوز للسنة`
  return asked > left ? `الدفعة تتجاوز المتبقي من حصة ${yName} (${nf.format(left)})` : ''
}

/** A plan's checks (1.4.46 · 1.4.47 · 1.4.50 · 3.4.33 · 3.4.34 · 1.4.53) */
export function planIssues(p: Omit<FundingPlan, 'at' | 'version' | 'by'>): string[] {
  const out: string[] = []
  if (!(p.total > 0)) out.push('أدخل قيمة التمويل المعتمد')
  if (!p.years.length) out.push('أضف سنة مالية واحدة على الأقل')
  if (p.kind === 'single' && p.years.length > 1) out.push('مشروع السنة الواحدة له سنة مالية واحدة')
  if (p.kind === 'multi' && p.years.length < 2) out.push('المشروع متعدد السنوات يمتد على سنتين ماليتين أو أكثر')
  if (new Set(p.years.map((y) => y.yearId)).size !== p.years.length) out.push('السنة المالية مكرّرة في التوزيع')
  const sum = p.years.reduce((a, y) => a + y.amount, 0)
  if (sum !== p.total) out.push(`مجموع حصص السنوات ${nf.format(sum)} وقيمة التمويل المعتمد ${nf.format(p.total)}`)
  for (const y of p.years) {
    const yn = yearById(y.yearId)?.name ?? ''
    if (!(y.amount > 0)) out.push(`حدّد مبلغ سنة ${yn}`)
    const s = y.shares.reduce((a, x) => a + x.amount, 0)
    if (y.shares.length && s !== y.amount) out.push(`حصة ${yn} من الميزانيات ${nf.format(s)} ومبلغ السنة ${nf.format(y.amount)}`)
    for (const sh of y.shares) {
      const d = docOf(sh.docId)
      const n = d ? nodeOf(d, sh.nodeId) : undefined
      if (!d || !n) { out.push(`اختر بند الميزانية لحصة ${yn}`); continue }
      if (d.yearId !== y.yearId) out.push(`«${docTitle(d)}» ليست من ميزانيات سنة ${yn}`)
      if (!lineUsable(d.nodes, n.id)) out.push(`«${n.label}» غير نشط · لا يُموَّل منه مشروع جديد`)
      if (hasChildren(d.nodes, n.id)) out.push(`«${n.label}» له بنود تحته · الحجز على البنود الفرعية`)
    }
    const paid = paidInYear(p.projectId, yn)
    if (y.amount < paid) out.push(`صُرف من حصة ${yn} ${nf.format(paid)} · لا تقل الحصة عمّا صُرف فعلًا`)
  }
  return out
}

/** Undo a plan's money effects before it's replaced · holds released, commitments cancelled */
const unplan = (p: FundingPlan, at: string, by: string) => {
  for (const y of p.years) {
    for (const s of y.shares) {
      const d = docOf(s.docId)
      if (!d) continue
      if (y.heldAt) hold(d, s.nodeId, -s.amount, at, by, 'release', p.projectId, 'تعديل التوزيع السنوي')
      else commit(d, s.nodeId, -s.amount, at, by, p.projectId)
    }
  }
}

/** The annual hold (1.4.49 · 1.4.51 · 3.4.35) · when a year starts, its share moves from commitment
    to hold on each budget that funds it · all or nothing, and only if each line has the balance */
export function runAnnualHolds(today = TODAY): void {
  for (const p of PLANS.values()) {
    for (const y of p.years) {
      const fy = yearById(y.yearId)
      if (!fy || fy.from > today || y.heldAt) continue
      const at = fy.from > p.at.slice(0, 10) ? fy.from : p.at.slice(0, 10)
      const why: string[] = []
      if (!y.shares.length) why.push('لم تُحدَّد الميزانية التي تموّل حصة السنة')
      for (const s of y.shares) {
        const d = docOf(s.docId)
        const n = d ? nodeOf(d, s.nodeId) : undefined
        if (!d || !n) { why.push('بند الحصة غير موجود'); continue }
        if (!isLiveBudget(d)) why.push(`«${docTitle(d)}» غير معتمدة بعد`)
        /* The share's own commitment is part of what it may take */
        const free = moneyOf(d.nodes, n.id).available + s.amount
        if (free < s.amount) why.push(`المتاح في «${n.label}» ${nf.format(Math.max(0, free))} وحصة السنة ${nf.format(s.amount)}`)
      }
      if (why.length) {
        if (y.refused !== why[0]) {
          y.refused = why[0]
          notify(['مشرف المنح', 'مدير المنح', 'الإدارة المالية'], `تعذّر الحجز السنوي · ${p.projectName}`, `${fy.name} · ${why[0]}`, at, ROUTES.projectTab(p.projectId, 'study'))
        }
        continue
      }
      for (const s of y.shares) {
        const d = docOf(s.docId)!
        commit(d, s.nodeId, -s.amount, at, 'النظام', p.projectId)
        hold(d, s.nodeId, s.amount, at, 'النظام', 'annual-hold', p.projectId, `حصة ${fy.name}`)
      }
      y.heldAt = at
      y.refused = undefined
    }
  }
}

/* ── Apply ── */

const register = (d: BudgetDoc) => {
  allBudgets.push(d)
  budgetDocs.push(d)
}

const syncOwners = (d: BudgetDoc) => {
  for (const n of d.nodes) {
    if (!n.owners?.length || !ALL_FIELDS.includes(n.label)) continue
    const dom = CYCLE.domains[n.label]
    if (!dom) continue
    /* The budget names who supervises the domain · the intake cycle distributes to exactly them */
    dom.supervisors = [...n.owners]
  }
}

const apply = (o: Op) => {
  switch (o.op) {
    case 'yearAdd': {
      if (fiscalYears.some((y) => y.id === o.year.id || y.name === o.year.name)) return
      if (yearOverlap(fiscalYears, o.year.from, o.year.to)) return
      fiscalYears.push(o.year)
      fiscalYears.sort((a, b) => b.from.localeCompare(a.from))
      return
    }
    case 'sourceAdd': {
      if (fundSources.some((s) => s.code === o.source.code)) return
      fundSources.push(o.source)
      return
    }
    case 'sourceRename': {
      const s = fundSources.find((x) => x.code === o.code)
      if (s) s.name = o.name
      return
    }
    case 'dirSave': {
      const i = DIRECTIONS.findIndex((x) => x.id === o.dir.id)
      if (i >= 0) DIRECTIONS[i] = o.dir
      else DIRECTIONS.push(o.dir)
      return
    }
    case 'docSave': {
      const cur = docOf(o.doc.id)
      if (cur && !budgetEditable(cur.state)) return
      const next = structuredClone(o.doc)
      next.state = cur?.state ?? 'draft'
      if (cur) Object.assign(cur, next)
      else {
        register(next)
        log(next.id, { at: o.at, by: o.by, text: 'أُنشئت الميزانية كمسودة' })
      }
      if (cur) log(cur.id, { at: o.at, by: o.by, text: 'حُفظت التعديلات' })
      return
    }
    case 'docSubmit': {
      const d = docOf(o.id)
      if (!d || !budgetEditable(d.state)) return
      if (headIssues(d).length || treeIssues(d).length) return
      d.state = 'submitted'
      log(d.id, { at: o.at, by: o.by, text: 'أُرسلت إلى مدير المنح للمراجعة' })
      notify(titlesOf(BUDGET_RULES.managerBy), `ميزانية للمراجعة · ${docTitle(d)}`, `أرسلها ${o.by}`, o.at, ROUTES.budgetDoc(d.id))
      return
    }
    case 'docDecide': {
      const d = docOf(o.id)
      if (!d) return
      const from = d.state
      const next: Partial<Record<BudgetState, BudgetState>> = o.outcome === 'approve'
        ? { submitted: 'finance', finance: 'exec', exec: 'approved' }
        : { submitted: 'returned', finance: 'submitted', exec: 'finance' }
      const to = next[from]
      if (!to) return
      d.state = to
      const say: Record<string, string> = {
        'submitted>finance': 'وافق مدير المنح وأحالها إلى الإدارة المالية',
        'finance>exec': 'وافقت الإدارة المالية وأحالتها إلى المدير التنفيذي',
        'exec>approved': 'اعتمدها المدير التنفيذي وفُعّلت في النظام',
        'submitted>returned': 'أعادها مدير المنح إلى مُعِدّها',
        'finance>submitted': 'أعادتها الإدارة المالية إلى مدير المنح',
        'exec>finance': 'أعادها المدير التنفيذي إلى الإدارة المالية',
      }
      log(d.id, { at: o.at, by: o.by, text: say[`${from}>${to}`] ?? '', note: o.note || undefined, tone: o.outcome === 'approve' ? 'ok' : 'ret' })
      if (to === 'approved') {
        opening(d, o.at, o.by)
        syncOwners(d)
        notify(['مدير المنح', 'مشرف المنح'], `اعتُمدت ${docTitle(d)}`, 'مفعّلة · متاحة لربط المشاريع والحجز', o.at, ROUTES.budgetDoc(d.id))
      } else {
        const st = stepOf(to)
        const who = st === 'prepare' ? ['مشرف المنح'] : st ? [...(st === 'finance' ? ['الإدارة المالية'] : []), ...titlesOf(STEP_ROLES(st))] : []
        notify(who, `${o.outcome === 'approve' ? 'ميزانية للمراجعة' : 'ميزانية معادة'} · ${docTitle(d)}`, o.note || say[`${from}>${to}`] || '', o.at, ROUTES.budgetDoc(d.id))
      }
      return
    }
    case 'lineStatus': {
      const d = docOf(o.docId)
      if (!d) return
      const changed = cascadeActive(d.nodes, o.nodeId, o.active)
      const n = nodeOf(d, o.nodeId)
      if (!changed.length || !n) return
      log(d.id, {
        at: o.at, by: o.by,
        text: `${o.active ? 'فُعِّل' : 'أُوقف'} «${n.label}»${changed.length > 1 ? ` ومعه ${nf.format(changed.length - 1)} بند تحته` : ''}`,
        note: o.reason || undefined, tone: o.active ? 'ok' : 'warn',
      })
      return
    }
    case 'lineOwner': {
      const d = docOf(o.docId)
      const n = d ? nodeOf(d, o.nodeId) : undefined
      if (!d || !n) return
      n.owners = o.owners.length ? [...o.owners] : undefined
      if (isLiveBudget(d)) syncOwners({ ...d, nodes: [n] })
      log(d.id, { at: o.at, by: o.by, text: o.owners.length ? `أُسند «${n.label}» إلى ${o.owners.join(' و')}` : `أُلغي إسناد «${n.label}»` })
      return
    }
    case 'link': {
      const d = docOf(o.link.docId)
      if (!d || !isLiveBudget(d) || !lineUsable(d.nodes, o.link.nodeId)) return
      const prev = LINKS.get(o.link.projectId)
      if (prev) {
        const pd = docOf(prev.docId)
        if (pd) hold(pd, prev.nodeId, -prev.amount, o.at, o.link.by, 'release', prev.projectId, 'تغيير بند الربط')
      }
      hold(d, o.link.nodeId, o.link.amount, o.at, o.link.by, 'hold', o.link.projectId, o.link.projectName)
      LINKS.set(o.link.projectId, { ...o.link, at: o.at })
      return
    }
    case 'unlink': {
      const prev = LINKS.get(o.projectId)
      if (!prev) return
      const pd = docOf(prev.docId)
      if (pd) hold(pd, prev.nodeId, -prev.amount, o.at, o.by, 'release', prev.projectId, 'إلغاء الربط')
      LINKS.delete(o.projectId)
      return
    }
    case 'reqSave': {
      let r = reqById(o.req.id)
      if (r && r.state !== 'draft' && r.state !== 'returned') return
      if (!r) {
        r = { ...structuredClone(o.req), state: 'draft', createdAt: o.at, events: [{ at: o.at, by: o.req.by, text: 'أُنشئ الطلب' }] }
        BUDGET_REQS.unshift(r)
      } else Object.assign(r, structuredClone(o.req))
      if (o.send) {
        if (reqIssues(r).length) return
        r.state = 'submitted'
        r.submittedAt = o.at
        r.events.unshift({ at: o.at, by: o.req.by, text: 'أُرسل إلى مدير المنح للاعتماد' })
        notify(titlesOf(BUDGET_RULES.managerBy), `طلب ${REQ_KIND_SAY[r.kind]} · ${r.id}`, `${nf.format(r.amount)} · ${docTitle(docOf(r.docId)!)}`, o.at, ROUTES.budgetOp(r.id))
      }
      return
    }
    case 'reqDecide': {
      const r = reqById(o.id)
      if (!r) return
      const from = r.state
      if (o.outcome === 'reject') {
        if (!['submitted', 'finance', 'exec'].includes(from)) return
        r.state = 'rejected'
        r.note = o.note
        r.events.unshift({ at: o.at, by: o.by, text: 'رُفض الطلب', note: o.note, tone: 'ret' })
        return
      }
      const next: Partial<Record<ReqState, ReqState>> = o.outcome === 'approve'
        ? { submitted: 'finance', finance: 'exec', exec: 'executed' }
        : { submitted: 'returned', finance: 'submitted', exec: 'finance' }
      const to = next[from]
      if (!to) return
      if (to === 'executed' && reqIssues(r).length) return
      r.state = to
      r.note = o.outcome === 'return' ? o.note : r.note
      const say: Record<string, string> = {
        'submitted>finance': 'وافق مدير المنح وأحاله إلى الإدارة المالية',
        'finance>exec': 'وافقت الإدارة المالية وأحالته إلى المدير التنفيذي',
        'exec>executed': 'اعتمده المدير التنفيذي ونُفِّذ آليًا',
        'submitted>returned': 'أعاده مدير المنح إلى مُعِدّه',
        'finance>submitted': 'أعادته الإدارة المالية إلى مدير المنح',
        'exec>finance': 'أعاده المدير التنفيذي إلى الإدارة المالية',
      }
      r.events.unshift({ at: o.at, by: o.by, text: say[`${from}>${to}`] ?? '', note: o.note || undefined, tone: o.outcome === 'approve' ? 'ok' : 'ret' })
      if (to === 'executed') execute(r, o.at, o.by)
      const st = stepOf(to)
      const who = to === 'executed' ? ['مشرف المنح', 'مدير المنح']
        : st === 'prepare' ? ['مشرف المنح']
          : st ? [...(st === 'finance' ? ['الإدارة المالية'] : []), ...titlesOf(STEP_ROLES(st))] : []
      notify(who, `طلب ${REQ_KIND_SAY[r.kind]} ${r.id} · ${REQ_STATE_SAY[to]}`, o.note || say[`${from}>${to}`] || '', o.at, ROUTES.budgetOp(r.id))
      return
    }
    case 'planSave': {
      const prev = PLANS.get(o.plan.projectId)
      if (planIssues(o.plan).length) return
      if (prev) unplan(prev, o.at, o.plan.by)
      const plan: FundingPlan = { ...structuredClone(o.plan), at: o.at, version: (prev?.version ?? 0) + 1 }
      for (const y of plan.years) { y.heldAt = undefined; y.refused = undefined }
      for (const y of plan.years) {
        for (const s of y.shares) {
          const d = docOf(s.docId)
          if (d) commit(d, s.nodeId, s.amount, o.at, o.plan.by, plan.projectId)
        }
      }
      PLANS.set(plan.projectId, plan)
      runAnnualHolds()
      return
    }
  }
}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ }
}

const run = (o: Op) => {
  ops.push(o)
  apply(o)
  save()
  emit()
}

/* ── Seed · what the fixture already carries ── */

function seed() {
  for (const d of allBudgets) {
    if (d.state === 'approved') {
      const at = `${d.from}T09:00:00.000Z`
      log(d.id, { at, by: 'عبدالرحمن الهليّل', text: 'اعتمدها المدير التنفيذي وفُعّلت في النظام', tone: 'ok' })
      log(d.id, { at, by: FINANCE_ACTOR, text: 'وافقت الإدارة المالية وأحالتها إلى المدير التنفيذي', tone: 'ok' })
      log(d.id, { at, by: 'عبدالله الدوسري', text: 'وافق مدير المنح وأحالها إلى الإدارة المالية', tone: 'ok' })
      log(d.id, { at, by: 'عمر قاسم', text: 'أُرسلت إلى مدير المنح للمراجعة' })
      opening(d, at, 'عبدالرحمن الهليّل')
    } else if (d.state === 'submitted') {
      log(d.id, { at: '2026-09-28T10:30:00.000Z', by: 'عمر قاسم', text: 'أُرسلت إلى مدير المنح للمراجعة' })
    } else {
      log(d.id, { at: '2026-09-20T08:00:00.000Z', by: 'عمر قاسم', text: 'أُنشئت الميزانية كمسودة' })
    }
  }

  /* Two requests on the 2026 budget · one waiting on the grants manager, one on finance */
  const d = docOf('BG-2026-SA')
  const leaves = d ? leavesOf(d.nodes).filter((n) => n.parentId !== null && freeOf(d, n.id) > 0).sort((a, b) => freeOf(d, b.id) - freeOf(d, a.id)) : []
  if (d && leaves.length >= 2) {
    const [a, b] = leaves
    const amt = Math.min(50_000, Math.floor(freeOf(d, a.id) / 10_000) * 10_000)
    BUDGET_REQS.push({
      id: 'BOP-2026-0001', yearId: d.yearId, docId: d.id, kind: 'transfer', fromId: a.id, toId: b.id, amount: amt,
      reason: `إعادة توجيه الوفر في «${a.label}» إلى «${b.label}» بعد اكتمال الدراسات`, files: [],
      state: 'submitted', by: 'عمر قاسم', createdAt: '2026-09-29T09:00:00.000Z', submittedAt: '2026-09-29T09:10:00.000Z',
      events: [
        { at: '2026-09-29T09:10:00.000Z', by: 'عمر قاسم', text: 'أُرسل إلى مدير المنح للاعتماد' },
        { at: '2026-09-29T09:00:00.000Z', by: 'عمر قاسم', text: 'أُنشئ الطلب' },
      ],
    })
    BUDGET_REQS.push({
      id: 'BOP-2026-0002', yearId: d.yearId, docId: d.id, kind: 'increase', toId: b.id, amount: 200_000,
      reason: 'تعزيز الهدف لاستيعاب مشاريع الدورة الثانية', files: ['قرار مجلس الأمناء بالتعزيز.pdf'],
      state: 'finance', by: 'عبدالله الدوسري', createdAt: '2026-09-24T11:00:00.000Z', submittedAt: '2026-09-24T11:05:00.000Z',
      events: [
        { at: '2026-09-25T13:20:00.000Z', by: 'عبدالله الدوسري', text: 'وافق مدير المنح وأحاله إلى الإدارة المالية', tone: 'ok' },
        { at: '2026-09-24T11:05:00.000Z', by: 'عبدالله الدوسري', text: 'أُرسل إلى مدير المنح للاعتماد' },
        { at: '2026-09-24T11:00:00.000Z', by: 'عبدالله الدوسري', text: 'أُنشئ الطلب' },
      ],
    })
  }

  /* A multi-year project · two thirds next year, recorded as a commitment on the 2027 budget; this
     year's third held on 1 January's run (here: on the plan's date) */
  const y27 = docOf('BG-2027-SA')
  if (d && y27) {
    const p = projectRows.find((r) => r.year.startsWith('2026') && r.track && d.nodes.some((n) => n.label === r.goal && n.kind === 'sub'))
    const leaf = p ? d.nodes.find((n) => n.label === p.goal && n.kind === 'sub') : undefined
    if (p && leaf) {
      const total = Math.max(300_000, Math.floor(p.amountRequested / 10_000) * 10_000)
      const now26 = Math.min(Math.floor(total / 3 / 10_000) * 10_000, Math.max(0, Math.floor(freeOf(d, leaf.id) / 10_000) * 10_000))
      const share26 = now26 > 0 ? now26 : 10_000
      const plan: FundingPlan = {
        projectId: p.id, projectName: p.name, kind: 'multi', total, by: p.owner ?? 'عمر قاسم',
        at: '2026-09-15T09:00:00.000Z', version: 1,
        years: [
          { yearId: 'fy-2026', amount: share26, shares: [{ docId: d.id, nodeId: leaf.id, amount: share26 }] },
          { yearId: 'fy-2027', amount: total - share26, shares: [{ docId: y27.id, nodeId: 'y111', amount: total - share26 }] },
        ],
      }
      for (const y of plan.years) for (const s of y.shares) commit(docOf(s.docId)!, s.nodeId, s.amount, plan.at, plan.by, plan.projectId)
      PLANS.set(p.id, plan)
    }
  }
}

function hydrate() {
  seed()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
  runAnnualHolds()
}
hydrate()

/* ── Actions ── */

export const addYear = (year: FiscalYear, by: string) => run({ op: 'yearAdd', year, by, at: now() })
export const addSource = (source: FundSource, by: string) => run({ op: 'sourceAdd', source, by, at: now() })
export const renameSource = (code: string, name: string, by: string) => run({ op: 'sourceRename', code, name, by, at: now() })
export const saveDirection = (dir: Direction, by: string) => run({ op: 'dirSave', dir, by, at: now() })
export const saveBudget = (doc: BudgetDoc, by: string) => run({ op: 'docSave', doc, by, at: now() })
export const submitBudget = (id: string, by: string) => run({ op: 'docSubmit', id, by, at: now() })
export const decideBudget = (id: string, outcome: 'approve' | 'return', note: string, by: string) =>
  run({ op: 'docDecide', id, outcome, note, by, at: now() })
export const setLineStatus = (docId: string, nodeId: string, active: boolean, reason: string, by: string) =>
  run({ op: 'lineStatus', docId, nodeId, active, reason, by, at: now() })
export const setLineOwners = (docId: string, nodeId: string, owners: string[], by: string) =>
  run({ op: 'lineOwner', docId, nodeId, owners, by, at: now() })
export const linkProject = (link: Omit<LineLink, 'at'>) => run({ op: 'link', link, at: now() })
/** A link the fixture already carries (a project seeded on the approval path) · applied, not recorded,
    and never over a link the user made */
export const seedLink = (link: Omit<LineLink, 'at'>) => {
  if (!LINKS.has(link.projectId)) apply({ op: 'link', link, at: `${TODAY}T08:00:00.000Z` })
}
export const unlinkProject = (projectId: string, by: string) => run({ op: 'unlink', projectId, by, at: now() })
export const saveRequest = (req: Omit<BudgetRequest, 'events' | 'state' | 'createdAt' | 'submittedAt' | 'result'>, send: boolean) =>
  run({ op: 'reqSave', req, send, at: now() })
export const decideRequest = (id: string, outcome: 'approve' | 'return' | 'reject', note: string, by: string) =>
  run({ op: 'reqDecide', id, outcome, note, by, at: now() })
export const savePlan = (plan: Omit<FundingPlan, 'at' | 'version'>) => run({ op: 'planSave', plan, at: now() })

export const resetBudget = () => {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  location.reload()
}

/* ── Lines a picker offers ── */

export interface LineOption { doc: BudgetDoc; node: BudgetNode; key: string; path: string; free: number }

/** Leaves of approved budgets, usable for new projects · optionally of one fiscal year */
export function usableLines(yearId?: string): LineOption[] {
  return liveBudgets()
    .filter((d) => !yearId || d.yearId === yearId)
    .flatMap((doc) => leavesOf(doc.nodes)
      .filter((n) => n.parentId !== null && lineUsable(doc.nodes, n.id))
      .map((node) => ({ doc, node, key: `${doc.id}/${node.id}`, path: pathOf(doc.nodes, node.id), free: freeOf(doc, node.id) })))
}

export const sourceName = (code: string): string => sourceByCode(code)?.name ?? code
export const shareSay = (s: SourceShare[]): string => s.map((x) => `${sourceName(x.code)} ${nf.format(x.amount)}`).join(' · ')
