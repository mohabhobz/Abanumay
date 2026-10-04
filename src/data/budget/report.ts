import {
  docSources, docTitle, levelOf, leavesOf, moneyOf, splitOf, type BudgetDoc, type BudgetNode, type LineMoney,
} from '@/data/mock/budgetTree'
import { allBudgets } from '@/data/mock/chain'
import { projectRows } from '@/data/mock/projects'
import { allLinks, allPlans, directionById, sourceName } from './store'

/* Consolidated reports across budgets (1.4.6) · each budget keeps its own balances, and this reads
   them side by side: by track, domain, goal, strategic direction, funding source or project, for
   one fiscal year or all of them. A row says how many budgets carry it and splits into each one, so
   the total never hides which budget the money sits in. */

export type GroupBy = 'track' | 'field' | 'goal' | 'direction' | 'source' | 'project'

export const GROUP_SAY: Record<GroupBy, string> = {
  track: 'المسار', field: 'المجال', goal: 'الهدف', direction: 'التوجه الاستراتيجي', source: 'مصدر التمويل', project: 'المشروع',
}

export interface Part { docId: string; title: string; money: LineMoney }
export interface ReportRow { key: string; label: string; money: LineMoney; parts: Part[] }

const zero = (): LineMoney => ({ allocated: 0, held: 0, committed: 0, paid: 0, available: 0 })
const add = (a: LineMoney, b: LineMoney, f = 1): LineMoney => ({
  allocated: a.allocated + Math.round(b.allocated * f),
  held: a.held + Math.round(b.held * f),
  committed: a.committed + Math.round(b.committed * f),
  paid: a.paid + Math.round(b.paid * f),
  available: a.available + Math.round(b.available * f),
})

/** The line at a given depth above a node · level 1 is the track, level 2 the domain */
const atLevel = (d: BudgetDoc, n: BudgetNode, lvl: number): BudgetNode | undefined => {
  let cur: BudgetNode | undefined = n
  while (cur && levelOf(d.nodes, cur.id) > lvl) {
    const up: string | null = cur.parentId
    cur = up ? d.nodes.find((x) => x.id === up) : undefined
  }
  return cur && levelOf(d.nodes, cur.id) === lvl ? cur : undefined
}

const directionOf = (d: BudgetDoc, n: BudgetNode): string => {
  let cur: BudgetNode | undefined = n
  while (cur) {
    if (cur.directionId) return cur.directionId
    const up: string | null = cur.parentId
    cur = up ? d.nodes.find((x) => x.id === up) : undefined
  }
  return d.directionIds?.length === 1 ? d.directionIds[0] : ''
}

export function consolidate(by: GroupBy, docs: BudgetDoc[] = allBudgets): ReportRow[] {
  const rows = new Map<string, ReportRow>()
  const put = (key: string, label: string, d: BudgetDoc, m: LineMoney, f = 1) => {
    const r = rows.get(key) ?? { key, label, money: zero(), parts: [] }
    r.money = add(r.money, m, f)
    const p = r.parts.find((x) => x.docId === d.id)
    if (p) p.money = add(p.money, m, f)
    else r.parts.push({ docId: d.id, title: docTitle(d), money: add(zero(), m, f) })
    rows.set(key, r)
  }

  if (by === 'project') {
    const ids = new Set(docs.map((d) => d.id))
    /* The 2026 budget is built from its projects · each one carries its granted and spent amounts */
    const gen = docs.find((d) => d.id === 'BG-2026-SA')
    if (gen) {
      for (const r of projectRows.filter((x) => x.year.startsWith('2026') && x.amountGranted > 0)) {
        put(r.id, r.name, gen, { ...zero(), allocated: r.amountGranted, paid: r.amountSpent, available: r.amountGranted - r.amountSpent })
      }
    }
    /* Each share reports on its own budget (1.4.12 · 1.4.42) */
    for (const l of allLinks()) {
      for (const x of l.shares) {
        const d = docs.find((y) => y.id === x.docId)
        if (!d) continue
        const live = l.stage === 'initial' || l.stage === 'final'
        put(l.projectId, l.projectName, d, { ...zero(), allocated: x.amount, held: live ? x.amount - x.paid : 0, paid: x.paid })
      }
    }
    for (const p of allPlans()) {
      for (const y of p.years) {
        for (const s of y.shares) {
          if (!ids.has(s.docId)) continue
          const d = docs.find((x) => x.id === s.docId)!
          put(p.projectId, p.projectName, d, y.heldAt
            ? { ...zero(), allocated: s.amount, held: s.amount }
            : { ...zero(), allocated: s.amount, committed: s.amount })
        }
      }
    }
    return [...rows.values()].sort((a, b) => b.money.allocated - a.money.allocated)
  }

  for (const d of docs) {
    for (const n of leavesOf(d.nodes)) {
      if (n.parentId === null) continue
      const m = moneyOf(d.nodes, n.id)
      if (by === 'goal') { put(n.label, n.label, d, m); continue }
      if (by === 'track' || by === 'field') {
        const top = atLevel(d, n, by === 'track' ? 1 : 2) ?? (by === 'field' ? atLevel(d, n, 1) : undefined)
        if (top) put(top.label, top.label, d, m)
        continue
      }
      if (by === 'direction') {
        const id = directionOf(d, n)
        put(id || 'none', id ? directionById(id)?.name ?? id : 'بلا توجه محدد', d, m)
        continue
      }
      /* By source · a line's money splits by its share of each source */
      const split = splitOf(d, n.id) ?? docSources(d).map((s) => ({ code: s.code, amount: n.allocated / Math.max(1, docSources(d).length) }))
      const whole = split.reduce((a, s) => a + s.amount, 0) || 1
      for (const s of split) put(s.code, sourceName(s.code), d, m, s.amount / whole)
    }
  }
  return [...rows.values()].sort((a, b) => b.money.allocated - a.money.allocated)
}

export const totalOf = (rows: ReportRow[]): LineMoney => rows.reduce((a, r) => add(a, r.money), zero())
