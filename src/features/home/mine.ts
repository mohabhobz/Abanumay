import { projectRows } from '@/data/mock/projects'
import { payRequests } from '@/data/mock/disbursements'
import { entityById } from '@/data/mock/entities'
import type { RoleKey } from '@/data/roles'
import type { ProjectRow } from '@/types/domain'

/* «اليوم» · the money and the partners behind the role's own work (meeting 1 Oct, E-6 and E-8).

   The page is personal, so both read the projects the role works on — not the whole system:
     supervisor        the projects he owns
     grants manager    his team's projects (every supervisor reports to him)
     executive         the portfolio
   and only granted projects: a project under study has no budget yet. */

export const myProjects = (role: RoleKey, me: string): ProjectRow[] =>
  projectRows.filter((p) => p.amountGranted > 0 && p.type !== 'محفظة' && (role !== 'supervisor' || p.owner === me))

export interface Budget {
  granted: number
  spent: number
  /** Held by open disbursement requests · committed but not yet transferred */
  reserved: number
  remaining: number
  projects: number
}

/** E-6 · spent, reserved and remaining across the role's granted projects */
export const budgetOf = (rows: ProjectRow[]): Budget => {
  const ids = new Set(rows.map((p) => p.id))
  const granted = rows.reduce((a, p) => a + p.amountGranted, 0)
  const spent = rows.reduce((a, p) => a + Math.min(p.amountSpent, p.amountGranted), 0)
  const open = payRequests
    .filter((r) => ids.has(r.projectId) && r.state !== 'paid' && r.state !== 'closed')
    .reduce((a, r) => a + r.asked, 0)
  const reserved = Math.min(open, Math.max(0, granted - spent))
  return { granted, spent, reserved, remaining: Math.max(0, granted - spent - reserved), projects: rows.length }
}

export interface TopEntity {
  id: string
  name: string
  total: number
  projects: number
  /** Fiscal years covered · the ranking is kept across years, not reset each one */
  years: string[]
}

/** E-8 · the role's own top-supported entities, summed over every year of its projects */
export const topEntities = (rows: ProjectRow[], n = 4): TopEntity[] => {
  const by = new Map<string, TopEntity>()
  for (const p of rows) {
    const e = by.get(p.entityId) ?? {
      id: p.entityId, name: entityById(p.entityId)?.name ?? p.entityName, total: 0, projects: 0, years: [],
    }
    e.total += p.amountGranted
    e.projects += 1
    const y = p.year.slice(0, 4)
    if (!e.years.includes(y)) e.years.push(y)
    by.set(p.entityId, e)
  }
  return [...by.values()].sort((a, b) => b.total - a.total).slice(0, n)
    .map((e) => ({ ...e, years: e.years.sort() }))
}
