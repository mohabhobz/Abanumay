import { SEED_AT } from '@/data/clock'
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
import { agreements } from '@/data/mock/agreements'
import { EHSAN_SEED, portfolios, seededPays } from '@/data/mock/implementer'
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

export interface YearShare { docId: string; nodeId: string; amount: number; /** Paid on this share · a multi-year project pays from its plan */ paid?: number }
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
  /** Re-audit 7 Oct · released by a return or a rejection, or closed · its money left the lines */
  released?: 'returned' | 'closed'
}

const PLANS = new Map<string, FundingPlan>()
export const planOf = (projectId: string): FundingPlan | undefined => PLANS.get(projectId)
export const allPlans = (): FundingPlan[] => [...PLANS.values()]
/** A multi-year project is funded by its plan, not by a link (1.4.44 – 1.4.53) */
const livePlan = (projectId: string): FundingPlan | undefined => {
  const p = PLANS.get(projectId)
  return p && p.kind === 'multi' && !p.released ? p : undefined
}
/** Is the project funded · by a link, or by a multi-year plan · the callers that release, pay or
    recover go through here so a multi-year project isn't skipped */
export const hasFunding = (projectId: string): boolean => Boolean(LINKS.get(projectId) || livePlan(projectId))

/* ── Project funding links (BPD-004 – BPD-007 · 1.4.7 – 1.4.15 · 1.4.27 – 1.4.32 · 1.4.56 – 1.4.58) ──

   A single-year project is funded by one or more shares, each a leaf on an approved budget with its
   own amount; the shares add up to the project's funding (1.4.7 – 1.4.9). Each share is held, paid
   and released on its own line, so every budget reports its part alone (1.4.12 · 1.4.29 · 1.4.30).

   The hold is «initial» while the project climbs the approval path and «final» once the last
   authority approves (1.4.27 · 1.4.28 · 5.4.10). When the financial policy holds at approval only
   (5.4.19), the link is «planned»: checked against the balance, not yet held. «closed» is a project
   whose unused balance went back to its lines (1.4.32). */

export interface LinkShare { docId: string; nodeId: string; amount: number; paid: number }
export type HoldStage = 'planned' | 'initial' | 'final' | 'closed'
export const HOLD_STAGE_SAY: Record<HoldStage, string> = {
  planned: 'ربط بلا حجز', initial: 'حجز مبدئي', final: 'حجز نهائي', closed: 'أُقفل وأُعيد الوفر',
}
export interface LineLink {
  projectId: string
  projectName: string
  shares: LinkShare[]
  /** The project's funding · the sum of the shares */
  amount: number
  /** The funding before the project closed or stopped · the released part left the link */
  closedFrom?: number
  stage: HoldStage
  by: string
  at: string
  /** The first share · for readers that show one line */
  docId: string
  nodeId: string
}
/** What a link request carries · one share, or several */
export interface LinkInput {
  projectId: string
  projectName: string
  by: string
  shares?: { docId: string; nodeId: string; amount: number }[]
  docId?: string
  nodeId?: string
  amount?: number
}
export type LinkChangeKind = 'link' | 'split' | 'final' | 'relink' | 'release' | 'paid' | 'unpaid' | 'savings' | 'recover' | 'resize'
export const LINK_CHANGE_SAY: Record<LinkChangeKind, string> = {
  link: 'ربط وحجز', split: 'إعادة توزيع', final: 'تثبيت الحجز', relink: 'تعديل الارتباط بعد الاعتماد',
  release: 'تحرير الحجز', paid: 'صرف', unpaid: 'تراجع عن صرف', savings: 'إعادة الوفر',
  recover: 'تحرير مبلغ مسترد', resize: 'تعديل قيمة المشروع',
}
/** One row of a project's link history (1.4.58) · kept after the link itself is released */
export interface LinkChange {
  at: string
  by: string
  kind: LinkChangeKind
  text: string
  reason?: string
  from?: LinkShare[]
  to?: LinkShare[]
  /** Paid money moved from the old lines to the new ones on a relink */
  moved?: number
  amount?: number
}

const LINKS = new Map<string, LineLink>()
const LINK_LOG = new Map<string, LinkChange[]>()
export const linkOf = (projectId: string): LineLink | undefined => LINKS.get(projectId)
export const allLinks = (): LineLink[] => [...LINKS.values()]
export const linkHistory = (projectId: string): LinkChange[] => LINK_LOG.get(projectId) ?? []
const logLink = (projectId: string, c: LinkChange) => {
  const l = LINK_LOG.get(projectId) ?? []
  l.unshift(c)
  LINK_LOG.set(projectId, l)
}
const sharesOf = (i: LinkInput): { docId: string; nodeId: string; amount: number }[] =>
  i.shares?.length ? i.shares : i.docId && i.nodeId ? [{ docId: i.docId, nodeId: i.nodeId, amount: i.amount ?? 0 }] : []

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

/** The finance officer of the seeded history · new steps are signed by whoever acts in the role */
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

/* Re-audit 7 Oct · the request carries its budget's fiscal year · it was 2026 for any year */
const nextReqId = (docId?: string): string => {
  const d = docId ? docOf(docId) : undefined
  const yr = (d && yearById(d.yearId)?.name) || TODAY.slice(0, 4)
  let i = BUDGET_REQS.filter((r) => r.id.startsWith(`BOP-${yr}-`)).length + 1
  while (BUDGET_REQS.some((r) => r.id === `BOP-${yr}-${String(i).padStart(4, '0')}`)) i++
  return `BOP-${yr}-${String(i).padStart(4, '0')}`
}
export { nextReqId }

/** What a line carries · the reasons it can't be deleted (1.4.19) */
export interface LineDeps { children: number; projects: string[]; moves: number; held: number; paid: number; committed: number }
export function lineDeps(d: BudgetDoc, nodeId: string): LineDeps {
  const sub = [nodeId, ...d.nodes.filter((x) => isUnder(d.id, x.id, nodeId)).map((x) => x.id)]
  const m = moneyOf(d.nodes, nodeId)
  const projects = new Set<string>()
  for (const l of LINKS.values()) if (l.shares.some((x) => x.docId === d.id && sub.includes(x.nodeId))) projects.add(l.projectName)
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
  | { op: 'link'; link: LinkInput; stage?: HoldStage; reason?: string }
  | { op: 'unlink'; projectId: string; by: string; reason?: string }
  | { op: 'holdFinal'; projectId: string; by: string }
  | { op: 'linkPaid'; projectId: string; amount: number; ref: string; by: string }
  | { op: 'linkUnpaid'; ref: string; by: string }
  | { op: 'linkClose'; projectId: string; by: string; note: string }
  | { op: 'linkRecover'; projectId: string; amount: number; ref: string; by: string }
  | { op: 'linkResize'; projectId: string; amount: number; ref: string; by: string; reason: string }
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

/** Money leaving a line for a project · hold already released by the caller */
const payOn = (d: BudgetDoc, nodeId: string, amount: number, at: string, by: string, ref: string, note?: string) => {
  const n = nodeOf(d, nodeId)
  if (!n) return
  freezeLine(n)
  const before = n.paid ?? 0
  n.paid = Math.max(0, before + amount)
  restate(n)
  move({ at, docId: d.id, nodeId, kind: 'paid', amount: Math.abs(amount), before, after: n.paid, by, ref, note })
}

/** Which shares each recorded payment touched · so its undo puts the money back where it came from */
const PAID_REFS = new Map<string, { projectId: string; parts: { i: number; x: number }[]; plan?: boolean }>()

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
const unplan = (p: FundingPlan, at: string, by: string, note = 'تعديل التوزيع السنوي') => {
  for (const y of p.years) {
    for (const s of y.shares) {
      const d = docOf(s.docId)
      if (!d) continue
      if (y.heldAt) { const rest = s.amount - (s.paid ?? 0); if (rest > 0) hold(d, s.nodeId, -rest, at, by, 'release', p.projectId, note) }
      else commit(d, s.nodeId, -s.amount, at, by, p.projectId)
    }
  }
}

/** The annual hold (1.4.49 · 1.4.51 · 3.4.35) · when a year starts, its share moves from commitment
    to hold on each budget that funds it · all or nothing, and only if each line has the balance */
export function runAnnualHolds(today = TODAY): void {
  for (const p of PLANS.values()) {
    /* Re-audit 7 Oct · a single-year project is held by its link at the manager's seat · holding its
       plan too held the same money twice */
    if (p.kind !== 'multi' || p.released) continue
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
        const need = s.amount - (s.paid ?? 0)
        const free = moneyOf(d.nodes, n.id).available + need
        if (free < need) why.push(`المتاح في «${n.label}» ${nf.format(Math.max(0, free))} وحصة السنة ${nf.format(s.amount)}`)
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
        const rest = s.amount - (s.paid ?? 0)
        commit(d, s.nodeId, -rest, at, 'النظام', p.projectId)
        hold(d, s.nodeId, rest, at, 'النظام', 'annual-hold', p.projectId, `حصة ${fy.name}`)
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
      const shares = sharesOf(o.link)
      if (!shares.length || linkIssues(o.link).length) return
      const id = o.link.projectId
      const prev = LINKS.get(id)
      const stage: HoldStage = prev?.stage === 'final' ? 'final' : o.stage ?? 'initial'
      const paidBefore = prev ? prev.shares.reduce((a, x) => a + x.paid, 0) : 0
      /* The old shares leave whole · their hold is released and what was paid on them moves with
         the project to the new lines (1.4.56 · 1.4.57) */
      if (prev && prev.stage !== 'planned') {
        for (const x of prev.shares) {
          const pd = docOf(x.docId)
          if (!pd) continue
          hold(pd, x.nodeId, -(x.amount - x.paid), o.at, o.link.by, 'release', id, prev.stage === 'final' ? 'تعديل الارتباط بعد الاعتماد' : 'إعادة توزيع الربط')
          if (x.paid) payOn(pd, x.nodeId, -x.paid, o.at, o.link.by, id, 'نُقل المصروف إلى الارتباط الجديد')
        }
      }
      let left = paidBefore
      const next: LinkShare[] = shares.map((x) => {
        const paid = Math.min(x.amount, left)
        left -= paid
        return { docId: x.docId, nodeId: x.nodeId, amount: x.amount, paid }
      })
      if (stage !== 'planned') {
        for (const x of next) {
          const d = docOf(x.docId)!
          hold(d, x.nodeId, x.amount, o.at, o.link.by, 'hold', id, o.link.projectName)
          if (x.paid) {
            hold(d, x.nodeId, -x.paid, o.at, o.link.by, 'release', id, 'مصروف منقول من الارتباط السابق')
            payOn(d, x.nodeId, x.paid, o.at, o.link.by, id, 'مصروف منقول من الارتباط السابق')
          }
        }
      }
      const amount = next.reduce((a, x) => a + x.amount, 0)
      LINKS.set(id, { projectId: id, projectName: o.link.projectName, shares: next, amount, stage, by: o.link.by, at: o.at, docId: next[0].docId, nodeId: next[0].nodeId })
      const kind: LinkChangeKind = !prev ? 'link' : prev.stage === 'final' ? 'relink' : 'split'
      logLink(id, {
        at: o.at, by: o.link.by, kind, reason: o.reason, from: prev?.shares.map((x) => ({ ...x })), to: next.map((x) => ({ ...x })),
        moved: kind === 'relink' && paidBefore ? paidBefore : undefined, amount,
        text: kind === 'link'
          ? `${stage === 'planned' ? 'رُبط' : 'رُبط وحُجز مبدئيًّا'} على ${next.length > 1 ? `${nf.format(next.length)} بنود` : 'بند واحد'} بمبلغ ${nf.format(amount)}`
          : kind === 'relink'
            ? `عُدّل الارتباط بعد الاعتماد · أُلغي الحجز السابق وحُجز ${nf.format(amount)} على الارتباط الجديد${paidBefore ? ` ونُقل المصروف ${nf.format(paidBefore)}` : ''}`
            : `أُعيد توزيع الارتباط على ${nf.format(next.length)} ${next.length > 1 ? 'بنود' : 'بند'} بمبلغ ${nf.format(amount)}`,
      })
      return
    }
    case 'unlink': {
      const prev = LINKS.get(o.projectId)
      const pl = prev ? undefined : livePlan(o.projectId)
      if (pl) {
        /* A multi-year project · its held years go back and its commitments are cancelled (4.4.17 ·
           5.4.20) · the plan stays on record for the supervisor to re-save on the way back */
        const back = pl.years.reduce((a, y) => a + (y.heldAt ? y.shares.reduce((b, x) => b + x.amount - (x.paid ?? 0), 0) : 0), 0)
        unplan(pl, o.at, o.by, o.reason ?? 'إلغاء الحجز')
        pl.released = 'returned'
        logLink(o.projectId, { at: o.at, by: o.by, kind: 'release', reason: o.reason, amount: back, text: back ? `حُرّرت حصص الخطة المالية وأُعيد ${nf.format(back)} وأُلغيت الالتزامات المستقبلية` : 'أُلغيت التزامات الخطة المالية' })
        return
      }
      if (!prev) return
      let back = 0
      if (prev.stage !== 'planned' && prev.stage !== 'closed') {
        for (const x of prev.shares) {
          const pd = docOf(x.docId)
          if (!pd) continue
          hold(pd, x.nodeId, -(x.amount - x.paid), o.at, o.by, 'release', prev.projectId, o.reason ?? 'إلغاء الربط')
          back += x.amount - x.paid
        }
      }
      LINKS.delete(o.projectId)
      logLink(o.projectId, {
        at: o.at, by: o.by, kind: 'release', reason: o.reason, from: prev.shares.map((x) => ({ ...x })), amount: back,
        text: back ? `حُرّر الحجز وأُعيد ${nf.format(back)} إلى ${prev.shares.length > 1 ? 'بنوده بنفس التوزيع' : 'بنده'}` : 'أُلغي الربط',
      })
      return
    }
    case 'holdFinal': {
      const l = LINKS.get(o.projectId)
      if (!l || l.stage === 'final' || l.stage === 'closed') return
      if (l.stage === 'planned') {
        if (l.shares.some((x) => { const d = docOf(x.docId); return !d || freeOf(d, x.nodeId) < x.amount })) return
        for (const x of l.shares) hold(docOf(x.docId)!, x.nodeId, x.amount, o.at, o.by, 'hold', l.projectId, `${l.projectName} · حجز عند الاعتماد`)
      }
      l.stage = 'final'
      logLink(l.projectId, { at: o.at, by: o.by, kind: 'final', amount: l.amount, text: `ثُبّت الحجز نهائيًّا بمبلغ ${nf.format(l.amount)} عند الاعتماد` })
      return
    }
    case 'linkPaid': {
      const l = LINKS.get(o.projectId)
      const pl = l ? undefined : livePlan(o.projectId)
      if (pl && !PAID_REFS.has(o.ref)) {
        /* Re-audit 7 Oct · a multi-year project pays from the year's held share (1.4.52) · it used
           to need a link it can't have, so the money stayed held */
        const yName = o.at.slice(0, 4)
        const y = pl.years.find((x) => yearById(x.yearId)?.name === yName && x.heldAt) ?? pl.years.find((x) => x.heldAt && x.shares.some((sh) => sh.amount > (sh.paid ?? 0)))
        if (!y) return
        const yi = pl.years.indexOf(y)
        const open = y.shares.map((sh) => sh.amount - (sh.paid ?? 0))
        const total = open.reduce((a, x) => a + x, 0)
        const amt = Math.min(o.amount, total)
        if (amt <= 0) return
        let left = amt
        const parts: { i: number; x: number }[] = []
        y.shares.forEach((sh, i) => {
          const last = i === y.shares.length - 1
          const x = Math.min(open[i], last ? left : Math.round(amt * open[i] / total))
          if (x <= 0) return
          left -= x
          const d = docOf(sh.docId)
          if (d) { hold(d, sh.nodeId, -x, o.at, o.by, 'release', o.ref, 'من المحجوز إلى المصروف'); payOn(d, sh.nodeId, x, o.at, o.by, o.ref, pl.projectName) }
          sh.paid = (sh.paid ?? 0) + x
          parts.push({ i: yi * 1000 + i, x })
        })
        PAID_REFS.set(o.ref, { projectId: pl.projectId, parts, plan: true })
        logLink(pl.projectId, { at: o.at, by: o.by, kind: 'paid', amount: amt, text: `صُرفت ${nf.format(amt)} (${o.ref}) من حصة ${yearById(y.yearId)?.name ?? ''}` })
        return
      }
      if (!l || l.stage === 'planned' || l.stage === 'closed' || PAID_REFS.has(o.ref)) return
      const open = l.shares.map((x) => x.amount - x.paid)
      const total = open.reduce((a, x) => a + x, 0)
      const amt = Math.min(o.amount, total)
      if (amt <= 0) return
      /* 1.4.30 · each payment splits over the budgets by what each still holds */
      let left = amt
      const parts: { i: number; x: number }[] = []
      l.shares.forEach((sh, i) => {
        const last = i === l.shares.length - 1
        const x = Math.min(open[i], last ? left : Math.round(amt * open[i] / total))
        if (x <= 0) return
        left -= x
        const d = docOf(sh.docId)
        if (d) { hold(d, sh.nodeId, -x, o.at, o.by, 'release', o.ref, 'من المحجوز إلى المصروف'); payOn(d, sh.nodeId, x, o.at, o.by, o.ref, l.projectName) }
        sh.paid += x
        parts.push({ i, x })
      })
      PAID_REFS.set(o.ref, { projectId: l.projectId, parts })
      logLink(l.projectId, { at: o.at, by: o.by, kind: 'paid', amount: amt, text: `صُرفت ${nf.format(amt)} (${o.ref})${parts.length > 1 ? ` موزّعة على ${nf.format(parts.length)} بنود` : ''}` })
      return
    }
    case 'linkUnpaid': {
      const r = PAID_REFS.get(o.ref)
      if (r?.plan) {
        const pl = PLANS.get(r.projectId)
        if (!pl) return
        for (const { i, x } of r.parts) {
          const sh = pl.years[Math.floor(i / 1000)]?.shares[i % 1000]
          const d = sh ? docOf(sh.docId) : undefined
          if (!sh || !d) continue
          payOn(d, sh.nodeId, -x, o.at, o.by, o.ref, 'تراجع عن الصرف')
          if (!pl.released) hold(d, sh.nodeId, x, o.at, o.by, 'hold', o.ref, 'تراجع عن الصرف')
          sh.paid = (sh.paid ?? 0) - x
        }
        PAID_REFS.delete(o.ref)
        logLink(pl.projectId, { at: o.at, by: o.by, kind: 'unpaid', text: `أُلغي تسجيل الصرف (${o.ref}) وعاد المبلغ محجوزًا` })
        return
      }
      const l = r ? LINKS.get(r.projectId) : undefined
      if (!r || !l) return
      for (const { i, x } of r.parts) {
        const sh = l.shares[i]
        const d = sh ? docOf(sh.docId) : undefined
        if (!sh || !d) continue
        payOn(d, sh.nodeId, -x, o.at, o.by, o.ref, 'تراجع عن الصرف')
        hold(d, sh.nodeId, x, o.at, o.by, 'hold', o.ref, 'تراجع عن الصرف')
        sh.paid -= x
      }
      PAID_REFS.delete(o.ref)
      logLink(l.projectId, { at: o.at, by: o.by, kind: 'unpaid', text: `أُلغي تسجيل الصرف (${o.ref}) وعاد المبلغ محجوزًا` })
      return
    }
    case 'linkClose': {
      const l = LINKS.get(o.projectId)
      const pl = l ? undefined : livePlan(o.projectId)
      if (pl) {
        const back = pl.years.reduce((a, y) => a + y.shares.reduce((b, x) => b + x.amount - (x.paid ?? 0), 0), 0)
        unplan(pl, o.at, o.by, 'وفر عند إغلاق المشروع')
        /* The plan now reads what was actually spent */
        for (const y of pl.years) { for (const sh of y.shares) sh.amount = sh.paid ?? 0; y.amount = y.shares.reduce((a, x) => a + x.amount, 0) }
        pl.total = pl.years.reduce((a, y) => a + y.amount, 0)
        pl.released = 'closed'
        logLink(pl.projectId, { at: o.at, by: o.by, kind: 'savings', amount: back, reason: o.note || undefined, text: back ? `أُغلق المشروع وأُعيد الوفر ${nf.format(back)} وأُلغيت التزامات السنوات القادمة` : 'أُغلق المشروع · لا وفر' })
        return
      }
      if (!l || l.stage === 'closed') return
      let back = 0
      if (l.stage !== 'planned') {
        for (const x of l.shares) {
          const rest = x.amount - x.paid
          const d = docOf(x.docId)
          if (!d || rest <= 0) continue
          hold(d, x.nodeId, -rest, o.at, o.by, 'release', l.projectId, 'وفر عند إغلاق المشروع')
          back += rest
        }
      }
      /* Re-audit 7 Oct · what was released no longer counts on the link · it kept the old amount, so
         a stopped project read «held» for money already back on its line */
      if (back) {
        l.closedFrom = l.amount
        for (const x of l.shares) x.amount = x.paid
        l.amount = l.shares.reduce((a, x) => a + x.amount, 0)
      }
      l.stage = 'closed'
      logLink(l.projectId, {
        at: o.at, by: o.by, kind: 'savings', amount: back, reason: o.note || undefined,
        text: back ? `أُغلق المشروع وأُعيد الوفر ${nf.format(back)} إلى ${l.shares.length > 1 ? 'ميزانياته بنفس التوزيع' : 'بنده'}` : 'أُغلق المشروع · لا وفر',
      })
      return
    }
    /* 10.9.3 · 10.9.8 · money the entity returned goes back to the project's line (its domain
       allocation) · paid falls on each share by what it carried, once per receipt */
    case 'linkRecover': {
      const l = LINKS.get(o.projectId)
      const pl = l ? undefined : PLANS.get(o.projectId)
      if (pl && pl.kind === 'multi' && !PAID_REFS.has(o.ref)) {
        const all = pl.years.flatMap((y) => y.shares)
        const paid = all.reduce((a, x) => a + (x.paid ?? 0), 0)
        const amt = Math.min(o.amount, paid)
        if (amt <= 0) return
        let left = amt
        all.forEach((sh, i) => {
          const last = i === all.length - 1
          const x = Math.min(sh.paid ?? 0, last ? left : Math.round(amt * (sh.paid ?? 0) / paid))
          if (x <= 0) return
          left -= x
          const d = docOf(sh.docId)
          if (d) payOn(d, sh.nodeId, -x, o.at, o.by, o.ref, 'مبلغ مسترد من الجهة · يعود إلى مخصص المجال')
          sh.paid = (sh.paid ?? 0) - x
          sh.amount -= x
        })
        for (const y of pl.years) y.amount = y.shares.reduce((a, x) => a + x.amount, 0)
        pl.total = pl.years.reduce((a, y) => a + y.amount, 0)
        PAID_REFS.set(o.ref, { projectId: pl.projectId, parts: [] })
        logLink(pl.projectId, { at: o.at, by: o.by, kind: 'recover', amount: amt, text: `أُعيد مبلغ مسترد ${nf.format(amt)} إلى مخصص المجال` })
        return
      }
      if (!l || PAID_REFS.has(o.ref)) return
      const paid = l.shares.reduce((a, x) => a + x.paid, 0)
      const amt = Math.min(o.amount, paid)
      if (amt <= 0) return
      let left = amt
      l.shares.forEach((sh, i) => {
        const last = i === l.shares.length - 1
        const x = Math.min(sh.paid, last ? left : Math.round(amt * sh.paid / paid))
        if (x <= 0) return
        left -= x
        const d = docOf(sh.docId)
        if (d) payOn(d, sh.nodeId, -x, o.at, o.by, o.ref, 'مبلغ مسترد من الجهة · يعود إلى مخصص المجال')
        sh.paid -= x
        sh.amount -= x
      })
      l.amount = l.shares.reduce((a, x) => a + x.amount, 0)
      PAID_REFS.set(o.ref, { projectId: l.projectId, parts: [] })
      logLink(l.projectId, { at: o.at, by: o.by, kind: 'recover', amount: amt, text: `أُعيد مبلغ مسترد ${nf.format(amt)} إلى مخصص المجال` })
      return
    }
    /* 10.9.5 · 10.9.6 · the project's value changed by an approved annex · the hold follows it:
       a cut releases what isn't paid, a raise holds more on the first share's line */
    case 'linkResize': {
      const l = LINKS.get(o.projectId)
      if (!l || l.stage === 'closed') return
      const diff = o.amount - l.amount
      if (!diff) return
      if (diff < 0) {
        let cut = -diff
        for (let i = l.shares.length - 1; i >= 0 && cut > 0; i--) {
          const sh = l.shares[i]!
          const x = Math.min(cut, sh.amount - sh.paid)
          if (x <= 0) continue
          const d = docOf(sh.docId)
          if (d && l.stage !== 'planned') hold(d, sh.nodeId, -x, o.at, o.by, 'release', o.ref, 'تخفيض قيمة المشروع')
          sh.amount -= x
          cut -= x
        }
      } else {
        const sh = l.shares[0]
        const d = sh ? docOf(sh.docId) : undefined
        if (!sh || !d) return
        if (l.stage !== 'planned') hold(d, sh.nodeId, diff, o.at, o.by, 'hold', o.ref, 'زيادة قيمة المشروع')
        sh.amount += diff
      }
      l.amount = l.shares.reduce((a, x) => a + x.amount, 0)
      logLink(l.projectId, { at: o.at, by: o.by, kind: 'resize', amount: Math.abs(diff), reason: o.reason, text: `${diff < 0 ? 'خُفّضت' : 'زيدت'} قيمة الارتباط إلى ${nf.format(l.amount)} بملحق معتمد` })
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
      if (prev && prev.kind === 'multi' && !prev.released) unplan(prev, o.at, o.plan.by)
      const plan: FundingPlan = { ...structuredClone(o.plan), at: o.at, version: (prev?.version ?? 0) + 1 }
      for (const y of plan.years) {
        y.heldAt = undefined; y.refused = undefined
        /* What was paid stays paid · it follows the share on the same line */
        for (const sh of y.shares) {
          const was = prev?.years.find((x) => x.yearId === y.yearId)?.shares.find((x) => x.docId === sh.docId && x.nodeId === sh.nodeId)
          sh.paid = was?.paid ?? 0
        }
      }
      /* A single-year plan only classifies · its money is the link's (no double hold) */
      if (plan.kind === 'multi') {
        for (const y of plan.years) {
          for (const sh of y.shares) {
            const d = docOf(sh.docId)
            if (d) commit(d, sh.nodeId, sh.amount - (sh.paid ?? 0), o.at, o.plan.by, plan.projectId)
          }
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
      /* Re-audit 7 Oct · a budget approved ahead of its year was dated on its first day, so the audit
         log opened on seven events of 1 January 2027 · it was approved before the year, mid-September */
      const at = d.from <= TODAY ? `${d.from}T09:00:00.000Z` : '2026-09-15T09:00:00.000Z'
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

/** The holds of projects already past the grants manager in the fixture · on the closest funded
    goal · seeded here, not by the approvals store, so the saved link operations replay on them */
function seedStudyHolds() {
  for (const p of projectRows.filter((x) => x.stage === 'دراسة المشروع' && x.holder && x.holder !== 'supervisor' && x.holder !== 'manager')) {
    const lines = usableLines('fy-2026')
    const line = lines.find((l) => l.node.label === p.goal && l.free >= p.amountRequested)
      ?? lines.filter((l) => l.free >= p.amountRequested).sort((a, b) => b.free - a.free)[0]
    if (line) seedLink({ projectId: p.id, projectName: p.name, docId: line.doc.id, nodeId: line.node.id, amount: p.amountRequested, by: 'عبدالله الدوسري' })
  }
  /* Approved and waiting for their agreement · the hold is final (8.2.1) */
  for (const p of projectRows.filter((x) => x.stage === 'اعتماد الإتفاقية' && x.decidedAt && !agreements.some((a) => a.projectId === x.id))) {
    const lines = usableLines('fy-2026')
    const line = lines.find((l) => l.node.label === p.goal && l.free >= p.amountGranted) ?? lines.filter((l) => l.free >= p.amountGranted).sort((a, b) => b.free - a.free)[0]
    if (!line) continue
    seedLink({ projectId: p.id, projectName: p.name, docId: line.doc.id, nodeId: line.node.id, amount: p.amountGranted, by: 'عبدالله الدوسري' })
    const l = LINKS.get(p.id)
    if (l) l.stage = 'final'
  }
  /* In execution with a request past the grants manager · its hold is final, so the transfer turns
     it paid (9.2.18 · 1.4.30) */
  for (const id of new Set(payRequests.filter((r) => r.state === 'manager' || r.state === 'finance').map((r) => r.projectId))) {
    const p = projectRows.find((x) => x.id === id)
    if (!p || LINKS.has(id)) continue
    const amt = p.amountGranted || p.amountRequested
    const lines = usableLines('fy-2026')
    const line = lines.find((l) => l.node.label === p.goal && l.free >= amt) ?? lines.filter((l) => l.free >= amt).sort((a, b) => b.free - a.free)[0]
    if (!line) continue
    seedLink({ projectId: p.id, projectName: p.name, docId: line.doc.id, nodeId: line.node.id, amount: amt, by: 'عبدالله الدوسري' })
    const l = LINKS.get(p.id)
    if (l) l.stage = 'final'
  }
}

/** The strategic partners' fixture (BPD-011 · BPD-013) · each approved portfolio held whole and
    final on its partner line, and what Ehsan already paid on it marked paid by reference · seeded
    here so the partners store's saved payments replay on them */
function seedPartnerHolds() {
  const d = docOf('BG-2026-SA')
  if (!d) return
  const at = '2026-02-10T08:00:00.000Z'
  const by = 'عبدالله الدوسري'
  const finalPaid = (projectId: string, name: string, line: string, amount: number, paid: { amount: number; ref: string }[]) => {
    if (!nodeOf(d, line) || LINKS.has(projectId)) return
    seedLink({ projectId, projectName: name, docId: d.id, nodeId: line, amount, by })
    const l = LINKS.get(projectId)
    if (!l) return
    l.stage = 'final'
    for (const p of paid) if (!PAID_REFS.has(p.ref)) apply({ op: 'linkPaid', projectId, amount: p.amount, ref: p.ref, by, at })
  }
  for (const pf of portfolios.filter((x) => x.stage === 'approved' && x.line)) finalPaid(pf.id, pf.name, pf.line!, pf.total, seededPays(pf))
  for (const e of EHSAN_SEED) {
    const p = projectRows.find((x) => x.id === e.projectId)
    if (p) finalPaid(p.id, p.name, e.line, p.amountGranted, e.paid)
  }
}

function hydrate() {
  seed()
  seedStudyHolds()
  seedPartnerHolds()
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
/** Link a project to one or more budget lines · holds now, or plans the hold when the policy
    holds at approval (5.4.19) · a link already final is a post-approval change, with its reason */
export const linkProject = (link: LinkInput, reason?: string): string[] => {
  /* Re-audit 7 Oct · a budget whose fiscal year ended takes no new link (a share already there stays) */
  const ended = sharesOf(link).map((x) => docOf(x.docId)).find((d) => d && yearEnded(d) && !mineOn(link.projectId, d.id, new Set(d.nodes.map((n) => n.id))))
  if (ended) return [`${docTitle(ended)} من سنة مالية انتهت · لا يُربط عليها مشروع جديد`]
  const issues = linkIssues(link)
  if (issues.length) return issues
  const prev = LINKS.get(link.projectId)
  if (prev?.stage === 'final' && !reason?.trim()) return ['سبب تعديل الارتباط بعد الاعتماد إلزامي (1.4.58)']
  if (prev?.stage === 'closed') return ['المشروع مغلق · لا يُعدَّل ارتباطه']
  run({ op: 'link', link, stage: BUDGET_RULES.holdAt === 'approval' ? 'planned' : 'initial', reason: reason?.trim() || undefined, at: now() })
  return []
}
/** The fixture's holds · applied before the saved operations replay, and not saved themselves */
export function seedLink(link: LinkInput): void {
  if (!LINKS.has(link.projectId)) apply({ op: 'link', link, stage: 'initial', at: SEED_AT })
}
export const unlinkProject = (projectId: string, by: string, reason?: string) => run({ op: 'unlink', projectId, by, reason, at: now() })
/** The last authority approved · the hold turns final (1.4.28 · 5.4.9 · 6.4.4 · 7.4.4) */
export const finalizeHold = (projectId: string, by: string) => run({ op: 'holdFinal', projectId, by, at: now() })
/** A transfer went out · the held amount turns paid on each share (1.4.30) */
export const recordPaid = (projectId: string, amount: number, ref: string, by: string) => run({ op: 'linkPaid', projectId, amount, ref, by, at: now() })
export const undoPaid = (ref: string, by: string) => run({ op: 'linkUnpaid', ref, by, at: now() })
export const isPaidRef = (ref: string): boolean => PAID_REFS.has(ref)
/** The project closed · what wasn't spent goes back to its lines (1.4.32) */
export const releaseSavings = (projectId: string, by: string, note = '') => run({ op: 'linkClose', projectId, by, note, at: now() })
/** An amount the entity returned · back to the domain allocation (10.9.3 · 10.9.8) */
export const releaseRecovered = (projectId: string, amount: number, ref: string, by: string) => run({ op: 'linkRecover', projectId, amount, ref, by, at: now() })
/** The project's value changed · the hold follows (10.9.5 · 10.9.6) */
export const resizeLink = (projectId: string, amount: number, ref: string, by: string, reason: string) => run({ op: 'linkResize', projectId, amount, ref, by, reason, at: now() })
/** What a raise needs on the first share's line · free before holding more (10.9.6) */
export function resizeIssue(projectId: string, amount: number): string {
  const l = LINKS.get(projectId)
  if (!l) return ''
  const diff = amount - l.amount
  if (diff <= 0) return ''
  const sh = l.shares[0]
  const d = sh ? docOf(sh.docId) : undefined
  const n = d && sh ? nodeOf(d, sh.nodeId) : undefined
  if (!d || !n) return 'بند الارتباط لم يعد موجودًا'
  const free = moneyOf(d.nodes, n.id).available
  return free < diff ? `لا يكفي المتاح في البند (${nf.format(Math.max(0, free))}) لزيادة الحجز ${nf.format(diff)}` : ''
}
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

/** The budget's fiscal year is over */
const yearEnded = (d: BudgetDoc): boolean => {
  const fy = yearById(d.yearId)
  return Boolean(fy && fy.to < TODAY)
}

export interface LineOption { doc: BudgetDoc; node: BudgetNode; key: string; path: string; free: number }

/** Leaves of approved budgets, usable for new projects · optionally of one fiscal year */
export function usableLines(yearId?: string): LineOption[] {
  return liveBudgets()
    /* Re-audit 7 Oct · a budget whose fiscal year ended funds no new project */
    .filter((d) => (yearId ? d.yearId === yearId : !yearEnded(d)))
    .flatMap((doc) => leavesOf(doc.nodes)
      .filter((n) => n.parentId !== null && lineUsable(doc.nodes, n.id))
      .map((node) => ({ doc, node, key: `${doc.id}/${node.id}`, path: pathOf(doc.nodes, node.id), free: freeOf(doc, node.id) })))
}

export const sourceName = (code: string): string => sourceByCode(code)?.name ?? code
export const shareSay = (s: SourceShare[]): string => s.map((x) => `${sourceName(x.code)} ${nf.format(x.amount)}`).join(' · ')

/* ── Funding checks (1.4.9 – 1.4.11 · 1.4.23 · 5.4.5 · 5.4.6 · 6.2.10 · 7.2.2) ── */

/** What the shares already on a line count for · they leave whole when the link changes */
function mineOn(projectId: string, docId: string, ids: Set<string>): number {
  const l = LINKS.get(projectId)
  if (!l || l.stage === 'planned' || l.stage === 'closed') return 0
  return l.shares.filter((x) => x.docId === docId && ids.has(x.nodeId)).reduce((a, x) => a + x.amount, 0)
}

/** Checks a link before it's set · empty when it may go · `need` is the funding the shares must
    add up to, when known */
export function linkIssues(i: LinkInput, need?: number): string[] {
  const out: string[] = []
  const shares = sharesOf(i)
  if (!shares.length) return ['اختر بند ميزانية واحدًا على الأقل']
  const seen = new Set<string>()
  for (const x of shares) {
    const d = docOf(x.docId)
    const n = d ? nodeOf(d, x.nodeId) : undefined
    if (!d || !n) { out.push('بند غير معروف'); continue }
    const name = `«${n.label}»`
    if (seen.has(`${x.docId}/${x.nodeId}`)) out.push(`${name} مكرّر · اجمع مبلغه في سطر واحد`)
    seen.add(`${x.docId}/${x.nodeId}`)
    if (!isLiveBudget(d)) out.push(`${docTitle(d)} غير معتمدة ومفعّلة · الربط على الميزانيات المعتمدة وحدها`)
    if (hasChildren(d.nodes, n.id)) out.push(`${name} بند رئيسي · الحجز على البنود الفرعية وحدها`)
    if (!lineUsable(d.nodes, n.id)) out.push(`${name} غير نشط · لا يُموَّل منه مشروع جديد`)
    if (!(x.amount > 0)) out.push(`حدّد مبلغ ${name}`)
  }
  if (out.length) return out
  /* Every level of the tree, not the leaf alone (5.4.6) · what the project already holds there
     comes back first */
  const asked = new Map<string, number>()
  for (const x of shares) {
    const d = docOf(x.docId)!
    for (const a of upChain(d, x.nodeId)) asked.set(`${d.id}/${a.id}`, (asked.get(`${d.id}/${a.id}`) ?? 0) + x.amount)
  }
  for (const [key, amt] of asked) {
    const [docId, nodeId] = key.split('/')
    const d = docOf(docId)!
    const n = nodeOf(d, nodeId)!
    const sub = new Set([nodeId, ...d.nodes.filter((x) => isUnder(d.id, x.id, nodeId)).map((x) => x.id)])
    const free = moneyOf(d.nodes, nodeId).available + mineOn(i.projectId, docId, sub)
    if (amt > free) {
      const leaf = !hasChildren(d.nodes, nodeId)
      out.push(`${leaf ? '' : 'المستوى الأعلى '}«${n.label}» ${leaf ? 'لا يكفي' : 'يتجاوز مخصصه'} · المتاح ${nf.format(Math.max(0, free))} والمطلوب ${nf.format(amt)} · العجز ${nf.format(amt - Math.max(0, free))}`)
    }
  }
  const total = shares.reduce((a, x) => a + x.amount, 0)
  if (need !== undefined && total !== need) out.push(`مجموع التوزيع ${nf.format(total)} لا يساوي تمويل المشروع ${nf.format(need)}`)
  return out
}

/** The standing check on a project's funding · before a decision, a session, or a payment
    (4.4.11 · 4.4.13 · 5.4.5 · 5.4.8 · 6.2.10 · 6.4.3 · 7.2.2 · 7.4.3) */
export function fundingIssues(projectId: string, need: number): string[] {
  const l = LINKS.get(projectId)
  const pl = l ? undefined : livePlan(projectId)
  if (pl) return planFundingIssues(pl, need)
  if (!l) {
    if (PLANS.get(projectId)?.kind === 'multi') return ['الخطة المالية متعددة السنوات أُلغي حجزها · أعد حفظها من تبويب الدراسة']
    return ['لا ارتباط مالي · اربط المشروع ببند الميزانية أولًا (4.2.12)']
  }
  const out: string[] = []
  if (l.amount !== need) out.push(`قيمة المشروع ${nf.format(need)} والارتباط ${nf.format(l.amount)} · أعد توزيع الارتباط (1.4.13)`)
  for (const x of l.shares) {
    const d = docOf(x.docId)
    const n = d ? nodeOf(d, x.nodeId) : undefined
    if (!d || !n) { out.push('بند الارتباط لم يعد موجودًا'); continue }
    if (!isLiveBudget(d)) out.push(`${docTitle(d)} لم تعد مفعّلة`)
    for (const a of upChain(d, n.id)) {
      if (moneyOf(d.nodes, a.id).available < 0) { out.push(`«${a.label}» تجاوز مخصصه · راجع المصادر قبل الاعتماد`); break }
    }
    if (l.stage === 'planned' && freeOf(d, n.id) < x.amount) out.push(`«${n.label}» لم يعد يكفي للحجز عند الاعتماد`)
  }
  return out
}

/** A multi-year project's standing check · its plan is its funding (1.4.44 – 1.4.53) · the years
    that started are held, the rest committed, and no line above runs over */
function planFundingIssues(pl: FundingPlan, need: number): string[] {
  const out: string[] = []
  if (pl.total !== need) out.push(`قيمة المشروع ${nf.format(need)} والخطة المالية ${nf.format(pl.total)} · عدّل التوزيع السنوي`)
  for (const y of pl.years) {
    const fy = yearById(y.yearId)
    if (y.refused) out.push(`${fy?.name ?? ''} · ${y.refused}`)
    else if (fy && fy.from <= TODAY && !y.heldAt) out.push(`حصة ${fy.name} لم تُحجز بعد`)
    for (const x of y.shares) {
      const d = docOf(x.docId)
      const n = d ? nodeOf(d, x.nodeId) : undefined
      if (!d || !n) { out.push('بند في الخطة لم يعد موجودًا'); continue }
      if (!isLiveBudget(d)) out.push(`${docTitle(d)} لم تعد مفعّلة`)
      for (const a of upChain(d, n.id)) {
        if (moneyOf(d.nodes, a.id).available < 0) { out.push(`«${a.label}» تجاوز مخصصه · راجع المصادر قبل الاعتماد`); break }
      }
    }
  }
  return out
}

/** A line's hold split by stage · initial and final, from the project links under it (1.4.41) ·
    holds the fixture carries without a link count as final */
export function holdSplit(d: BudgetDoc, nodeId: string): { initial: number; final: number; committed: number } {
  const sub = new Set([nodeId, ...d.nodes.filter((x) => isUnder(d.id, x.id, nodeId)).map((x) => x.id)])
  let initial = 0
  for (const l of LINKS.values()) {
    if (l.stage !== 'initial') continue
    for (const x of l.shares) if (x.docId === d.id && sub.has(x.nodeId)) initial += x.amount - x.paid
  }
  const m = moneyOf(d.nodes, nodeId)
  return { initial, final: Math.max(0, m.held - initial), committed: m.committed }
}

/** One project's funding report · each share with its held, paid and remaining (1.4.42) */
export function fundingReport(projectId: string) {
  const l = LINKS.get(projectId)
  if (!l) return undefined
  const rows = l.shares.map((x) => {
    const d = docOf(x.docId)
    const n = d ? nodeOf(d, x.nodeId) : undefined
    const live = l.stage === 'initial' || l.stage === 'final'
    return {
      share: x, doc: d, node: n, path: d && n ? pathOf(d.nodes, n.id) : x.nodeId,
      held: live ? x.amount - x.paid : 0, paid: x.paid,
      remaining: l.stage === 'closed' ? 0 : x.amount - x.paid,
      released: l.stage === 'closed' ? x.amount - x.paid : 0,
    }
  })
  const sum = (k: 'held' | 'paid' | 'remaining' | 'released') => rows.reduce((a, r) => a + r[k], 0)
  return { link: l, rows, totals: { amount: l.amount, held: sum('held'), paid: sum('paid'), remaining: sum('remaining'), released: sum('released') } }
}
