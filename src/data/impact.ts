/* The impact reading · «لمن وصلت المنح وأين» (client, 8 Oct).

   It was a bundle card on the reports page marked «next», with nothing behind it. The client asked
   for it on every report screen and on Today, so it's one reading here and one panel
   (`ImpactPanel`) that every one of them draws.

   Three questions, from the bundle's own list:
     · the beneficiaries · the entities' estimate against what the closing reports say was reached
     · where · beneficiaries and money per region
     · in what · per track, domain and goal
   and the cost of one beneficiary on top.

   The estimate is every funded project's own figure. «Reached» exists only where a final report
   was sent, so the ratio compares the two on those projects alone · comparing the reached figure
   with the whole portfolio's estimate would read as a failure that is only an unclosed year. */
import { projectRows } from './mock/projects'
import { closeRows } from './mock/closing'
import { PORTFOLIOS } from './partners/store'
import { ROUTES } from '@/app/routes'

export interface ImpactRow { key: string; label: string; beneficiaries: number; amount: number; projects: number }

export interface Impact {
  /** Funded projects · approved and not archived · with the portfolios' approved sub-projects */
  projects: number
  /** Of them, a portfolio's sub-projects */
  subProjects: number
  /** The entities' estimate over every funded project */
  estimated: number
  granted: number
  /** One beneficiary's cost · granted ÷ estimated */
  costPer: number | null
  /** Projects whose final report states who was reached */
  reportedProjects: number
  /** The estimate of those same projects · the base of the ratio */
  reportedEstimate: number
  reached: number
  /** reached ÷ reportedEstimate · `null` until a report states a figure */
  rate: number | null
  regions: ImpactRow[]
  tracks: ImpactRow[]
  fields: ImpactRow[]
  goals: ImpactRow[]
  /** Estimate against reached, per reported project · the full report's table */
  pairs: { id: string; name: string; region: string; estimated: number; reached: number; href: string }[]
}

/* Batch 6 · 8 Oct · a portfolio's approved sub-projects are funded projects too · they reach people in
   their own regions, and the readings left them out (the portfolio isn't a project row). Each is a
   unit here with its own region, track and field, its goal the portfolio's, and «reached» from its
   execution report once complete (13.2.21). */
interface Unit { id: string; name: string; region: string; track: string; field: string; goal: string; beneficiaries: number; amountGranted: number }
const subUnits = (): (Unit & { reached: number | null })[] =>
  PORTFOLIOS.filter((pf) => pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed').flatMap((pf) =>
    pf.items.filter((x) => x.state === 'approved').map((x) => ({
      id: `${pf.id}/${x.id}`, name: x.name, region: x.region, track: x.track ?? pf.track, field: x.field ?? pf.field, goal: pf.goals.split(/[\n·،]/)[0]?.trim() || pf.name,
      beneficiaries: x.beneficiaries, amountGranted: x.amount,
      reached: x.exec?.status === 'مكتمل' && typeof x.exec.reached === 'number' ? x.exec.reached : null,
    })))

const group = (rows: Unit[], key: (p: Unit) => string): ImpactRow[] => {
  const m = new Map<string, ImpactRow>()
  for (const p of rows) {
    const k = key(p) || 'غير محدد'
    const x = m.get(k) ?? { key: k, label: k, beneficiaries: 0, amount: 0, projects: 0 }
    x.beneficiaries += p.beneficiaries || 0
    x.amount += p.amountGranted || 0
    x.projects += 1
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => b.beneficiaries - a.beneficiaries)
}

export function impact(): Impact {
  const subs = subUnits()
  const projects: Unit[] = projectRows.filter((p) => p.supportStatus === 'معتمد' && !p.archived).map((p) => ({
    id: p.id, name: p.name, region: p.region, track: p.track, field: p.field, goal: p.goal, beneficiaries: p.beneficiaries || 0, amountGranted: p.amountGranted || 0,
  }))
  const funded: Unit[] = [...projects, ...subs]
  const estimated = funded.reduce((n, p) => n + (p.beneficiaries || 0), 0)
  const granted = funded.reduce((n, p) => n + (p.amountGranted || 0), 0)
  const pairs = closeRows
    .filter((c) => c.stage !== 'draft' && typeof c.report.beneficiaries === 'number')
    .map((c) => {
      const p = projectRows.find((x) => x.id === c.projectId)
      return { id: c.projectId, name: c.projectName, region: p?.region ?? '', estimated: p?.beneficiaries ?? 0, reached: c.report.beneficiaries ?? 0, href: ROUTES.project(c.projectId) }
    })
    .filter((x) => x.estimated > 0)
    .concat(subs.filter((x) => x.reached !== null && x.beneficiaries > 0).map((x) => ({ id: x.id, name: `${x.name} · محفظة`, region: x.region, estimated: x.beneficiaries, reached: x.reached ?? 0, href: ROUTES.portfolio(x.id.split('/')[0]!) })))
  const reportedEstimate = pairs.reduce((n, x) => n + x.estimated, 0)
  const reached = pairs.reduce((n, x) => n + x.reached, 0)
  return {
    projects: funded.length,
    subProjects: subs.length,
    estimated,
    granted,
    costPer: estimated ? Math.round(granted / estimated) : null,
    reportedProjects: pairs.length,
    reportedEstimate,
    reached,
    rate: reportedEstimate ? Math.round((reached / reportedEstimate) * 100) : null,
    regions: group(funded, (p) => p.region),
    tracks: group(funded, (p) => p.track),
    fields: group(funded, (p) => p.field),
    goals: group(funded, (p) => p.goal),
    pairs,
  }
}
