import { fiscalYears } from '@/data/mock/budgetTree'
import type { BudgetDoc, BudgetNode } from '@/data/mock/budgetTree'
import { usableLines } from '@/data/budget/store'

export interface LineOpt {
  doc: BudgetDoc
  node: BudgetNode
  key: string
}

/** Lines of the project's year first · any approved budget's lines may join a split (1.4.7) */
export function linesFor(year: string): LineOpt[] {
  const name = year.slice(0, 4)
  const fy = fiscalYears.find((y) => y.name === name)
  const ofYear = fy ? usableLines(fy.id) : []
  const rest = usableLines().filter((l) => !ofYear.some((x) => x.key === l.key))
  return [...ofYear, ...rest].map(({ doc, node, key }) => ({ doc, node, key }))
}


/* 4.6.3 · the best split of a project's amount over budget lines (client 18 Oct · #37: one budget is
   one funding source, so a split over sources is a split over lines of different budgets).
   The rule, advisory · the store's own checks still decide:
   1. the preferred line (the project's goal, or the row already picked) takes as much as its
      available balance allows;
   2. what is left goes to the other lines that serve the same goal (the same label in another
      budget · another source) first, then to the lines under the same field, then any line of the
      project's year · within each group, the line with the most headroom (available over allocated)
      first, so no budget is drained before another has room;
   3. each part stays within its line's available balance · what nothing covers is the shortfall. */
export interface SplitSuggestion { rows: { key: string; amount: number }[]; short: number; why: string }

export function suggestLineSplit(lines: LineOpt[], amount: number, preferKey: string, avail: (l: LineOpt) => number): SplitSuggestion {
  if (amount <= 0 || !lines.length) return { rows: [], short: amount, why: '' }
  const first = lines.find((l) => l.key === preferKey)
  const parentLabel = (l: LineOpt) => l.doc.nodes.find((x) => x.id === l.node.parentId)?.label
  const headroom = (l: LineOpt) => (l.node.allocated > 0 ? avail(l) / l.node.allocated : 0)
  const group = (l: LineOpt) => !first ? 2
    : l.node.label === first.node.label ? 0
    : parentLabel(l) && parentLabel(l) === parentLabel(first) ? 1
    : l.doc.yearId === first.doc.yearId ? 2 : 3
  const rest = lines.filter((l) => l.key !== first?.key && avail(l) > 0)
    .sort((a, b) => group(a) - group(b) || headroom(b) - headroom(a))
  const rows: { key: string; amount: number }[] = []
  let left = amount
  for (const l of first ? [first, ...rest] : rest) {
    if (left <= 0) break
    const take = Math.min(left, Math.max(0, avail(l)))
    if (take <= 0) continue
    rows.push({ key: l.key, amount: take })
    left -= take
  }
  const why = rows.length <= 1
    ? 'بند واحد يغطي المبلغ كله'
    : 'يُملأ البند الأقرب لهدف المشروع حتى رصيده المتاح، ثم الباقي من بنود الهدف نفسه في ميزانيات المصادر الأخرى، فبنود المجال نفسه، والأوسع متاحًا نسبةً إلى مخصصه أولًا'
  return { rows, short: Math.max(0, left), why }
}
