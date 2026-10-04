import { agreements } from './agreements'
import { projectRows } from './projects'
import { budgetDocs, type BudgetDoc, type BudgetNode } from './budgetTree'
import type { ProjectRow } from '@/types/domain'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from './taxonomy'
import { NOUN, countOf } from '@/lib/format'

/* Chain · budget -> project -> agreement -> disbursements

   Warning: **the first thing discovered while wiring the chain up: it doesn't connect.** The budget
   tree `BG-2025-SA` has items like "education track · general education area · school development
   goal," while project tracks are "qualitative grants · education · university scholarships" —
   **two different vocabularies**, so any attempt to link them would return "not found" on every
   project.

   And the reason isn't a mistake: `BG-2025-SA` is **copied verbatim from the document's example**,
   and `taxonomy.ts` is **copied verbatim from the live system**. Two real sources saying two
   different things — so editing one to match the other isn't right, it would hide the discrepancy
   instead of resolving it.

   **So what was done:** a second budget for 2026, **built from the live system's vocabulary**,
   generated from the projects themselves — so the chain runs on genuinely one set of data rather
   than by wishful thinking. The mismatch between the two vocabularies was logged as an open
   question rather than swept under the rug.

   Warning: **and the generation is intentional.** If the budget were hand-typed, the moment a
   project's amount changed the chain would break while the screen still said "matches" — so it's
   computed from the projects, and the check becomes a real check. */

/** Track -> area -> goal, from the live system's vocabulary */
const cap = (n: number) => Math.ceil(n / 100_000) * 100_000

/** Projects dated 2026 · the ones the budget is built on */
const rows2026 = projectRows.filter((p) => p.year.startsWith('2026'))

function buildNodes(): BudgetNode[] {
  const out: BudgetNode[] = []
  const put = (
    id: string, label: string, kind: BudgetNode['kind'],
    parentId: string | null, allocated: number, available: number,
  ) => out.push({ id, label, kind, parentId, allocated, available, active: true, showLabel: true })

  /* The three levels are built bottom-up: the goal is computed from its projects, the area from its
     goals, and the track from its areas · so the check "children's sum = the parent" is true by
     construction */
  const byTrack = new Map<string, Map<string, Map<string, ProjectRow[]>>>()
  for (const p of rows2026) {
    if (!byTrack.has(p.track)) byTrack.set(p.track, new Map())
    const fields = byTrack.get(p.track)!
    if (!fields.has(p.field)) fields.set(p.field, new Map())
    const goals = fields.get(p.field)!
    if (!goals.has(p.goal)) goals.set(p.goal, [])
    goals.get(p.goal)!.push(p)
  }
  /* Every domain the foundation funds this year has a line, with or without a project yet · a domain
     with none opens for its first submissions on a round 250,000 per goal (1.1.output-5). Appended
     after the project-built lines, so their ids stay put. */
  for (const track of TRACKS) {
    for (const field of FIELDS_BY_TRACK[track] ?? []) {
      if (!byTrack.has(track)) byTrack.set(track, new Map())
      const fields = byTrack.get(track)!
      if (!fields.has(field)) fields.set(field, new Map())
      const goals = fields.get(field)!
      for (const g of GOALS_BY_FIELD[field] ?? []) if (!goals.has(g)) goals.set(g, [])
    }
  }

  let rootAlloc = 0
  let rootAvail = 0
  const trackNodes: { id: string; alloc: number; avail: number }[] = []

  let ti = 0
  for (const [track, fields] of byTrack) {
    ti += 1
    const tid = `t${ti}`
    let tAlloc = 0
    let tAvail = 0
    let fi = 0

    for (const [field, goals] of fields) {
      fi += 1
      const fid = `${tid}f${fi}`
      let fAlloc = 0
      let fAvail = 0
      let gi = 0

      for (const [goal, ps] of goals) {
        gi += 1
        const gid = `${fid}g${gi}`
        const granted = ps.reduce((a, x) => a + x.amountGranted, 0)
        const spent = ps.reduce((a, x) => a + x.amountSpent, 0)
        /* Allocation is rounded up to the nearest 100,000 · a budget is set in round figures, not a
           penny-precise sum of projects */
        /* The pipeline under study is part of what the line was budgeted for · its holds fit */
        const pipeline = ps.filter((x) => x.statusGroup === 'في الدراسة').reduce((a, x) => a + x.amountRequested, 0)
        const alloc = ps.length ? cap(Math.max(granted + pipeline, 100_000)) : 250_000
        put(gid, goal, 'sub', fid, alloc, alloc - spent)
        fAlloc += alloc
        fAvail += alloc - spent
      }

      /* A domain the taxonomy gives no goals carries its allocation itself · a leaf like the
         document's «تمكين الأفراد» */
      if (goals.size === 0) { fAlloc = 250_000; fAvail = 250_000 }
      put(fid, field, 'main', tid, fAlloc, fAvail)
      tAlloc += fAlloc
      tAvail += fAvail
    }

    put(tid, track, 'main', 'b0', tAlloc, tAvail)
    /* Each track serves one of the budget's directions · the report reads allocation by direction */
    out[out.length - 1].directionId = ['dir-edu', 'dir-health', 'dir-community'][(ti - 1) % 3]
    trackNodes.push({ id: tid, alloc: tAlloc, avail: tAvail })
    rootAlloc += tAlloc
    rootAvail += tAvail
  }

  put('b0', 'ميزانية المنح · 2026', 'base', null, rootAlloc, rootAvail)
  return out
}

export const budget2026: BudgetDoc = {
  id: 'BG-2026-SA',
  name: 'ميزانية المنح 2026',
  description: 'مبنية على بنود النظام العامل ومشاريعه · المسار ثم المجال ثم الهدف',
  directionIds: ['dir-edu', 'dir-health', 'dir-community'],
  yearId: 'fy-2026',
  sourceCode: 'SA',
  from: '2026-01-01',
  to: '2026-12-31',
  total: 0,
  state: 'approved',
  nodes: [],
}

{
  const nodes = buildNodes()
  budget2026.nodes = nodes
  budget2026.total = nodes.find((n) => n.parentId === null)?.allocated ?? 0
}

/** Every budget · the document's example plus the one built on the live system */
export const allBudgets: BudgetDoc[] = [...budgetDocs, budget2026]

/**
 * Warning: **this resolver has to live here, not in `budgetTree`.**
 * `budget2026` is generated from the projects, and the projects have no relation to the budget tree
 * — if `budgetTree` imported it, it would create an import cycle. Screens read from here, and the
 * fixture stays a one-way addition.
 */
export const budgetDocOf = (id: string): BudgetDoc | undefined =>
  allBudgets.find((d) => d.id === id)

/* Chain links for a single project

   Each link says: its own value, the expected value from the one before it, and whether they match.
   A link that doesn't match **is stated**, not hidden. */
export type LinkState = 'ok' | 'gap' | 'none'

export interface ChainLink {
  key: 'budget' | 'project' | 'agreement' | 'payments'
  label: string
  /** Name or number identifying the link */
  name: string
  value: number
  /** The sentence explaining the number */
  say: string
  state: LinkState
  /** A link to the link's own screen, if it has one */
  to?: string
}

export const goalNodeOf = (p: ProjectRow): BudgetNode | undefined =>
  budget2026.nodes.find((n) => n.kind === 'sub' && n.label === p.goal)

export function projectChain(p: ProjectRow): ChainLink[] {
  const node = goalNodeOf(p)
  const ag = agreements.find((a) => a.projectId === p.id && a.stage !== 'cancelled')
  const schedule = ag ? ag.payments.reduce((a, x) => a + x.amount, 0) : 0

  const links: ChainLink[] = []

  /* 1 · budget · the goal the project falls under */
  links.push({
    key: 'budget',
    label: 'الميزانية',
    name: node ? node.label : 'غير مرتبط ببند',
    value: node?.allocated ?? 0,
    say: node
      ? `مخصص الهدف · والمشروع واحد من ${rows2026.filter((x) => x.goal === p.goal).length} تحته`
      : 'المشروع غير مرتبط ببند في الميزانية',
    state: node ? (node.allocated >= p.amountGranted ? 'ok' : 'gap') : 'none',
    to: node ? `/budget/doc/${budget2026.id}` : undefined,
  })

  /* 2 · project · the approved amount */
  links.push({
    key: 'project',
    label: 'المشروع',
    name: p.name,
    value: p.amountGranted,
    say: p.amountGranted > 0 ? 'المبلغ المعتمد بعد الدراسة' : 'لم يُحجز له مخصص بعد',
    state: p.amountGranted > 0 ? 'ok' : 'none',
  })

  /* 3 · agreement · its value must equal the approved amount (step 11) */
  links.push({
    key: 'agreement',
    label: 'الاتفاقية',
    name: ag ? ag.id : 'غير موجودة',
    value: ag?.amount ?? 0,
    say: ag
      ? ag.amount === p.amountGranted
        ? 'قيمتها تساوي المعتمد · خطوة 11'
        : 'قيمتها مختلفة عن المعتمد · خطوة 11'
      : 'تُعدّ الاتفاقية بعد الاعتماد',
    state: ag ? (ag.amount === p.amountGranted ? 'ok' : 'gap') : 'none',
    to: ag ? `/agreements/${ag.id}` : undefined,
  })

  /* 4 · disbursements · the schedule's total must equal the agreement (rule 8) */
  links.push({
    key: 'payments',
    label: 'جدول الدفعات',
    name: ag ? `${countOf(ag.payments.length, NOUN.payment)}` : 'غير موجود',
    value: schedule,
    say: ag
      ? schedule === ag.amount
        ? 'المجموع يساوي قيمة الاتفاقية · قاعدة 8'
        : 'المجموع مختلف عن قيمة الاتفاقية · قاعدة 8'
      : 'الجدول جزء من الاتفاقية',
    state: ag ? (schedule === ag.amount ? 'ok' : 'gap') : 'none',
  })

  return links
}

/** Broken links · zero means the chain holds */
export const chainGaps = (p: ProjectRow): number =>
  projectChain(p).filter((l) => l.state === 'gap').length
