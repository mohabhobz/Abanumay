/**
 * Budget · the five values the system tracks for every line item: allocated, held, committed,
 * spent, remaining.
 *
 * Allocated is a real number from the live system (73,700,000 for 2026). The other four are
 * **computed from sample projects** — a small sample out of 4,929 projects — so the usage ratio
 * shown will naturally read low. The screen states this explicitly instead of letting the number be
 * misread.
 */
import { projectRows } from './mock/projects'
import { YEARS } from './mock/taxonomy'
import type { ProjectRow } from '@/types/domain'

export interface BudgetLine {
  key: string
  label: string
  /** Allocated */
  allocated: number
  /** Held · requests under review, not yet decided */
  reserved: number
  /** Committed · approved, with a signed agreement */
  committed: number
  /** Actually spent */
  spent: number
  /** Remaining = allocated minus held minus committed */
  remaining: number
}

const sum = (rows: ProjectRow[], pick: (p: ProjectRow) => number) =>
  rows.reduce((s, p) => s + pick(p), 0)

function line(key: string, label: string, allocated: number, rows: ProjectRow[]): BudgetLine {
  const reserved = sum(rows.filter((p) => p.statusGroup === 'في الدراسة'), (p) => p.amountRequested)
  const committed = sum(rows.filter((p) => p.supportStatus === 'معتمد'), (p) => p.amountGranted)
  const spent = sum(rows, (p) => p.amountSpent)
  return {
    key,
    label,
    allocated,
    reserved,
    committed,
    spent,
    remaining: allocated - reserved - committed,
  }
}

/** A full year's budget */
export function budgetForYear(yearId = '2026-f'): BudgetLine {
  const year = YEARS.find((y) => y.id === yearId) ?? YEARS[0]
  return line(year.id, year.label, year.budget, projectRows.filter((p) => p.year === year.id))
}

/**
 * Budget split across tracks.
 * Allocation per track isn't known in the live system (the allocation tree wasn't reachable), so
 * it's split evenly for now — an open question, still pending.
 */
export function budgetByTrack(yearId = '2026-f'): BudgetLine[] {
  const year = YEARS.find((y) => y.id === yearId) ?? YEARS[0]
  const rows = projectRows.filter((p) => p.year === year.id)
  const tracks = [...new Set(rows.map((p) => p.track))]
  const share = tracks.length ? Math.round(year.budget / tracks.length) : 0
  return tracks
    .map((t) => line(t, t, share, rows.filter((p) => p.track === t)))
    .sort((a, b) => b.committed - a.committed)
}
