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

export interface ImpactRow { key: string; label: string; beneficiaries: number; amount: number; projects: number }

export interface Impact {
  /** Funded projects · approved and not archived */
  projects: number
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
  pairs: { id: string; name: string; region: string; estimated: number; reached: number }[]
}

const group = (rows: typeof projectRows, key: (p: (typeof projectRows)[number]) => string): ImpactRow[] => {
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
  const funded = projectRows.filter((p) => p.supportStatus === 'معتمد' && !p.archived)
  const estimated = funded.reduce((n, p) => n + (p.beneficiaries || 0), 0)
  const granted = funded.reduce((n, p) => n + (p.amountGranted || 0), 0)
  const pairs = closeRows
    .filter((c) => c.stage !== 'draft' && typeof c.report.beneficiaries === 'number')
    .map((c) => {
      const p = projectRows.find((x) => x.id === c.projectId)
      return { id: c.projectId, name: c.projectName, region: p?.region ?? '', estimated: p?.beneficiaries ?? 0, reached: c.report.beneficiaries ?? 0 }
    })
    .filter((x) => x.estimated > 0)
  const reportedEstimate = pairs.reduce((n, x) => n + x.estimated, 0)
  const reached = pairs.reduce((n, x) => n + x.reached, 0)
  return {
    projects: funded.length,
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
