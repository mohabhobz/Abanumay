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

