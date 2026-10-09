/**
 * Procedure indicators · numbered as in the procedures document v2.0 (BPD-001 budget … BPD-013
 * portfolios), from each procedure's «x.8 performance measurement» section.
 *
 * Re-audit 7 Oct · the list used to open on «BPD-001 الإلمام والاستكشاف» — eleven empty indicators
 * for a procedure v2.0 doesn't have — which pushed every number after it one step off (budget read
 * BPD-002, payments BPD-010 …). That procedure is gone and the numbers follow the document.
 *
 * Where the text comes from is said per procedure (`source`), not once for all of them:
 *
 *   · `doc`        names and methods copied verbatim from the document
 *   · `paraphrase` the document's formulas, in our wording (Ehsan · portfolios · plans)
 *   · `ours`       the document gives none · derived from the procedure's own rules (none today)
 *
 * and an indicator we added on top of the document's carries `ours: true`. The page used to say
 * «copied verbatim» over all of them, which wasn't true for the last three.
 *
 * The most important design decision here:
 *
 *   an indicator that can't be measured shows up **written out and empty**, not hidden.
 *
 * Hiding the indicator would let the gap keep repeating; showing it along with why it's absent
 * turns the reports screen into a request list for the backend.
 *
 * Another point that needs to be said to the client: **not a single target exists in the
 * document**. Where an indicator measures compliance against a duration, the duration comes from the
 * escalation settings or the stage limits, and the page says so.
 */
import type { ProjectRow } from '@/types/domain'
import { projectRows } from './mock/projects'
import { journeys } from './journey'
import { ROUTES } from '@/app/routes'
import { planKpi } from './mock/plans'
import { CLOSE_TARGET_DAYS, closeKpi } from './mock/closing'
import { NOUN, countOf as countNoun } from '@/lib/format'
import { regRows } from './mock/registration'
import { payRequests, PAY_TARGET_DAYS } from './mock/disbursements'
import { planRows, lateActivities } from './mock/plans'
import { stageMeta } from './mock/taxonomy'
import { allBudgets } from './mock/chain'
import { leavesOf, moneyOf, docSources, isLiveBudget } from './mock/budgetTree'
import { BUDGET_REQS } from './budget/store'
import { appFlowOf, SESSIONS } from './approvals/store'
import { flowOf } from './intake/flow'
import { isStuck, PLAN_LOG } from './plans/store'
import { EHSAN_PAYS, PORTFOLIOS, ehCloseOf, ehMoney, ehsanProjects, pfMoney } from './partners/store'
import { ESC_LIMITS } from './shared/escRules'
import { capOf } from './approval'
import { TODAY } from './clock'
import { agrTargetDays, agrWasReturned, agreements } from './mock/agreements'
import { yearById } from './mock/budgetTree'

/** Denominator unit · "10 of 30" needs to say what the 30 is */
export type Basis = 'project' | 'entity' | 'line' | 'source' | 'riyal' | 'agreement' | 'activity' | 'beneficiary'

/** Indicator unit as given in the document's "unit of measurement" column */
export type KpiUnit = 'pct' | 'days' | 'count' | 'avg'

export interface Kpi {
  /** Its number in the document's table */
  no: number
  /** Indicator name · verbatim */
  name: string
  /** Measurement method · verbatim */
  how: string
  unit: KpiUnit
  /** The computed value. `null` = the needed data doesn't exist */
  value: number | null
  /** What's missing · shown in place of the number */
  gap?: string
  /** Numerator and denominator with their unit, so the number shows what it's built from */
  of?: { part: number; whole: number; basis: Basis }
  /** The better direction · decides the indicator's color once it has a target */
  better: 'up' | 'down' | 'flat'
  /** Target · `null` across all of them: the document has no SLA at all */
  target: number | null
  /** The rows behind the number · a number with no rows behind it is a dead report */
  to?: string
  /** The number is derived from `journey.ts`, not a real column */
  derived?: boolean
  /** The same indicator per source, per level or per kind · when the document asks «لكل…» */
  split?: { label: string; value: number }[]
  /** Not in the document · added by us on top of its list */
  ours?: boolean
}

export interface ProcessKpis {
  /** The procedure's number in the document */
  id: string
  /** The URL slug */
  key: string
  no: number
  title: string
  owner: string
  /** Where the names and methods come from · see the header */
  source: 'doc' | 'paraphrase' | 'ours'
  kpis: Kpi[]
}

/* Calculation helpers

   Every indicator is built on each call (`kpiProcesses()`), so a decision taken a minute ago is in
   the number · the list used to be computed once at load. And «متوسط» is the mean, as the document
   writes it · it used to be the median, which is a different statistic (cross · KPIs). */

const share = (part: number, whole: number): number => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/**
 * Ratio indicator: returns the value along with the numerator, denominator, and their unit. The
 * denominator isn't a detail — "100%" of one project is a misleading number, and the unit is what
 * stops "73,700,000 cases" from being written where it should say "73,700,000 riyals."
 */
const ratio = (part: number, whole: number, basis: Basis = 'project') => ({
  value: share(part, whole),
  of: { part, whole, basis },
})

const mean = (v: number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
/** Mean days over a pool · the recorded duration where the decisions are on record, the derived
    journey where they aren't (re-audit 7 Oct · a decision taken in the app now moves the mean) */
const meanRec = (pool: ProjectRow[], rec: (r: ProjectRow) => number | null, hours: (r: ProjectRow) => number | null | undefined): { value: number | null; derived: boolean } => {
  let fell = false
  const v = pool.map((r) => {
    const d = rec(r)
    if (d !== null) return d
    const h = hours(r)
    if (typeof h === 'number' && h > 0) { fell = true; return h / 24 }
    return null
  }).filter((x): x is number => x !== null)
  const m = mean(v)
  return { value: m === null ? null : Math.round(m), derived: fell }
}
const dayDiff = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000))
const countOf = (pool: ProjectRow[], f: (r: ProjectRow) => boolean) => pool.filter(f).length

const P = ROUTES.projects
const link = (qs: string) => `${P}?${qs}`
const YEAR = TODAY.slice(0, 4)

function build(): ProcessKpis[] {
const rows: ProjectRow[] = projectRows
const decided = rows.filter((r) => r.supportStatus !== null)
const approved = rows.filter((r) => r.supportStatus === 'معتمد')
const rejected = rows.filter((r) => r.supportStatus === 'مرفوض')
const j = (r: ProjectRow) => journeys.get(r.id)
const recsOf = (r: ProjectRow) => appFlowOf(r.id).recs

/* Budget · on the lines of the approved budgets' trees, not the tracks (cross · KPIs) */

const docs = allBudgets.filter(isLiveBudget)
const leaves = docs.flatMap((d) => leavesOf(d.nodes).map((n) => ({ d, n, m: moneyOf(d.nodes, n.id) })))
const L = (f: (x: (typeof leaves)[number]) => number) => leaves.reduce((s, x) => s + f(x), 0)
const allocated = L((x) => x.m.allocated)
const usedLines = leaves.filter((x) => x.m.paid + x.m.held + x.m.committed > 0)
const drained = leaves.filter((x) => x.m.available <= 0)
const multi = leaves.filter((x) => (x.n.sources?.length ?? docSources(x.d).length) > 1)
/* Re-audit 7 Oct · «خلال السنة المالية» · the transfers executed on this year's budgets, not every year's */
const transfers = BUDGET_REQS.filter((r) => r.kind === 'transfer' && r.state === 'executed' && (yearById(r.yearId)?.name ?? '') === YEAR)
/* Per source · each line's money split by its sources' shares */
const srcMap = new Map<string, { allocated: number; paid: number; held: number }>()
for (const x of leaves) {
  const ss = x.n.sources?.length ? x.n.sources : docSources(x.d)
  const tot = ss.reduce((s, y) => s + y.amount, 0) || 1
  for (const y of ss) {
    const k = srcMap.get(y.code) ?? { allocated: 0, paid: 0, held: 0 }
    const f = y.amount / tot
    k.allocated += x.m.allocated * f; k.paid += x.m.paid * f; k.held += (x.m.held + x.m.committed) * f
    srcMap.set(y.code, k)
  }
}
const srcs = [...srcMap.entries()]
const S = (f: (v: { allocated: number; paid: number; held: number }) => number) => srcs.map(([code, v]) => ({ label: code, value: share(f(v), v.allocated) }))
const sAll = srcs.reduce((a, [, v]) => ({ allocated: a.allocated + v.allocated, paid: a.paid + v.paid, held: a.held + v.held }), { allocated: 0, paid: 0, held: 0 })
const sourcesUnused = srcs.filter(([, v]) => v.paid === 0 && v.held === 0).length

/* Registration · from the requests' own history */

const regDecided = regRows.filter((r) => (r.state === 'approved' || r.state === 'rejected') && r.decidedAt && r.submittedAt)
const returns = (r: (typeof regRows)[number]) => (r.events ?? []).filter((e) => e.kind === 'return').length
const regYear = regRows.filter((r) => (r.decidedAt ?? '').startsWith(YEAR))
/* Re-audit 7 Oct · the document divides by every request, not the decided ones · drafts aren't requests yet */
const regSent = regRows.filter((r) => r.state !== 'draft')

/* Study and the approval seats · the recorded decisions, with the journey where none is recorded */

const studied = rows.filter((r) => flowOf(r.id).study?.recommendation || j(r)?.study)
const studyLimit = (stageMeta('دراسة المشروع')?.limit ?? 900)
const supervisors = new Set(studied.map((r) => r.owner).filter(Boolean))
const reachedManager = rows.filter((r) => j(r)?.manager !== null && j(r)?.manager !== undefined || recsOf(r).some((x) => x.level === 'manager'))
const reachedExec = rows.filter((r) => j(r)?.exec !== null && j(r)?.exec !== undefined || recsOf(r).some((x) => x.level === 'exec'))
/* Re-audit 7 Oct · the durations from the decisions on record · a seat's time runs from the decision
   that sent the project to it until its own. The journey is the fallback for the seeded rows */
const recAt = (r: ProjectRow, level: string) => recsOf(r).find((x) => x.level === level)?.at
const seatDays = (r: ProjectRow, level: string, from: string): number | null => {
  const mine = recAt(r, level), prev = recsOf(r).find((x) => x.level === from && (!mine || x.at <= mine))?.at
  return mine && prev ? dayDiff(prev, mine) : null
}
const studyDays = (r: ProjectRow): number | null => {
  const st = flowOf(r.id).study?.at
  return st && r.submittedAt ? dayDiff(r.submittedAt, st) : null
}
const studyRec = meanRec(studied, studyDays, (r) => j(r)?.study)
const studyIn = (r: ProjectRow) => { const d = studyDays(r); return d !== null ? d * 24 <= studyLimit : within(j(r)?.study, studyLimit) }
const studyHas = (r: ProjectRow) => studyDays(r) !== null || Boolean(j(r)?.study)
const mgrRec = meanRec(reachedManager, (r) => seatDays(r, 'manager', 'supervisor'), (r) => j(r)?.manager)
const mgrLim = ESC_LIMITS['approval.manager'] ?? 120
const mgrIn = (r: ProjectRow) => { const d = seatDays(r, 'manager', 'supervisor'); return d !== null ? d * 24 <= mgrLim : within(j(r)?.manager, mgrLim) }
const execRec = meanRec(reachedExec, (r) => seatDays(r, 'exec', 'manager'), (r) => j(r)?.exec)
const execLim = ESC_LIMITS['approval.exec'] ?? 120
const execIn = (r: ProjectRow) => { const d = seatDays(r, 'exec', 'manager'); return d !== null ? d * 24 <= execLim : within(j(r)?.exec, execLim) }
const execReturns = (r: ProjectRow) => recsOf(r).filter((x) => x.level === 'exec' && x.verdict === 'return').length
const within = (h: number | null | undefined, lim: number) => typeof h === 'number' && h > 0 && h <= lim
const sessionsOf = (body: 'committee' | 'board') => SESSIONS.filter((x) => x.body === body)
const decisionLag = (body: 'committee' | 'board') => mean(sessionsOf(body).flatMap((x) => x.items.filter((i) => i.decidedAt).map((i) => dayDiff(x.date, i.decidedAt!))))
/* Batch 5 · 8 Oct · the committee's study time and «from the first presentation» read the sessions on
   record · a project's first session is the earliest one listing it, and it passed first time when
   that session decided it (approve, refer up or reject · not a return). The journey stays the
   fallback for the seeded rows no session lists, and the indicator says «derived» when it used it. */
const bodyItems = (body: 'committee' | 'board') => {
  const m = new Map<string, { date: string; decidedAt?: string; outcome?: string; first: boolean }>()
  for (const x of [...sessionsOf(body)].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const i of x.items) {
      const was = m.get(i.projectId)
      if (!was) m.set(i.projectId, { date: x.date, decidedAt: i.decidedAt, outcome: i.outcome, first: true })
      else if (!was.decidedAt || was.outcome === 'return') m.set(i.projectId, { date: x.date, decidedAt: i.decidedAt, outcome: i.outcome, first: false })
    }
  }
  return m
}
const committeeItems = bodyItems('committee')
const boardDecided = bodyItems('board')
const referAt = (r: ProjectRow) => recsOf(r).find((x) => x.verdict === 'refer' && x.level === 'exec')?.at
const committeeDays = (r: ProjectRow): number | null => {
  const it = committeeItems.get(r.id), from = referAt(r)
  return it?.decidedAt && it.outcome !== 'return' && from ? dayDiff(from, it.decidedAt) : null
}
const committeePool = [...new Set([...decided.filter((r) => j(r)?.committee !== null && j(r)?.committee !== undefined), ...rows.filter((r) => committeeItems.get(r.id)?.decidedAt)])]
const committeeRec = meanRec(committeePool, committeeDays, (r) => j(r)?.committee)
/** Passed at its first presentation · the sessions, else the journey · and whether the journey was used */
const firstPassOf = (items: Map<string, { decidedAt?: string; outcome?: string; first: boolean }>, pool: ProjectRow[]) => {
  let fell = false
  const ok = pool.filter((r) => {
    const it = items.get(r.id)
    if (it?.decidedAt) return it.first && it.outcome !== 'return'
    fell = true
    return j(r)?.firstPass === true
  }).length
  return { ok, derived: fell }
}
const committeeShown = committeePool
const committeeFirst = firstPassOf(committeeItems, committeeShown)
const boardShown = [...new Set([...decided.filter((r) => j(r)?.decidedBy === 'مجلس الأمناء'), ...rows.filter((r) => boardDecided.get(r.id)?.decidedAt)])]
const boardFirst = firstPassOf(boardDecided, boardShown)
/** BPD-004 #6 · held from the first review · a project on record held with no return on its path */
const heldFirstOf = () => {
  let fell = false
  const ok = approved.filter((r) => {
    const recs = recsOf(r)
    if (recs.length) return !recs.some((x) => x.verdict === 'return')
    fell = true
    return j(r)?.reservedFirstPass === true
  }).length
  return { ok, derived: fell }
}
const heldFirst = heldFirstOf()
const boardItems = sessionsOf('board').flatMap((x) => x.items.map((i) => ({ x, i })))
const boardOnTime = boardItems.filter(({ x, i }) => {
  const sent = recsOf(rows.find((r) => r.id === i.projectId) ?? rows[0]).find((r) => r.verdict === 'refer')?.at
  return sent ? dayDiff(sent, x.date) * 24 <= (ESC_LIMITS['approval.board'] ?? 504) : true
})

/* Agreements · from their own log and the stage limits (re-audit 7 Oct · the three used to be empty
   with a note that the returns weren't recorded, long after the module started recording them) */

const agrAll = agreements.filter((a) => a.stage !== 'cancelled')
const agrPrep = agrAll.filter((a) => a.stage === 'active' && a.activeAt).map((a) => ({ a, days: dayDiff(a.openedAt, a.activeAt!) }))
/** The target · the sum of the stage limits a new agreement runs through, in days */
const AGR_TARGET = agrTargetDays()
const agrCycle = agrPrep.map(({ a }) => { const sent = a.log.find((e) => e.step === 12)?.at; return sent ? dayDiff(sent, a.activeAt!) : null }).filter((x): x is number => x !== null)

/* Payments · from submission to transfer, over every request */

const paid = payRequests.filter((r) => r.state === 'paid' && r.paidAt)
const today = TODAY
const due = payRequests.filter((r) => r.dueAt <= today)

/* Plans · by count, against what is due */

const acts = planRows.flatMap((p) => p.phases.flatMap((ph) => ph.activities.map((a) => ({ p, a }))))
const dueActs = acts.filter(({ a }) => a.to && a.to <= today)
const lateOrStuck = planRows.reduce((n, p) => n + lateActivities(p).length, 0) + acts.filter(({ a }) => isStuck(a) && !(a.to && a.to < today)).length
const accepted = acts.filter(({ a }) => a.state === 'accepted')
const firstOk = accepted.filter(({ a }) => !(a.notes ?? []).some((n) => n.kind === 'reject'))
/* Re-audit 7 Oct · the denominator is every activity the foundation reviewed · accepted, or returned at least once */
const reviewedActs = acts.filter(({ a }) => a.state === 'accepted' || (a.notes ?? []).some((n) => n.kind === 'reject'))
const actDays = accepted.map(({ p, a }) => {
  const claim = PLAN_LOG.find((e) => e.planId === p.id && e.what.startsWith('تقديم نشاط') && e.what.endsWith(a.name))?.at
  const from = claim ?? a.evidence.map((e) => e.uploadedAt).sort().at(-1)
  return from && a.doneAt ? dayDiff(from, a.doneAt) : null
}).filter((x): x is number => x !== null)

/* Ehsan and portfolios */

const eh = ehsanProjects()
const ehMoneyAll = eh.map((p) => ehMoney(p.id))
const ehClosed = eh.filter((p) => p.statusGroup === 'مكتمل')
/* Re-audit 7 Oct · late counts the stalled too, over the projects in execution, not over all of them */
const ehRunning = eh.filter((p) => p.statusGroup === 'في التشغيل' || p.statusGroup === 'متعثر')
const ehLate = ehRunning.filter((p) => p.statusGroup === 'متعثر' || (p.endAt && p.endAt < today))
/* Re-audit 7 Oct · an Ehsan project closes in the partners' record, not in the closing module ·
   reading `closeRows` meant this was never measured */
const ehCloseDays = eh.map((p) => {
  const c = ehCloseOf(p.id)
  if (!c?.closedAt) return null
  const from = p.endAt && p.endAt <= c.closedAt ? p.endAt : c.at
  return dayDiff(from, c.closedAt)
}).filter((x): x is number => x !== null)
const pfs = PORTFOLIOS
const subs = pfs.flatMap((pf) => pf.items)
const subsSent = subs.filter((x) => x.state !== 'draft')
const subsOk = subs.filter((x) => x.state === 'approved')
/* The portfolios whose value is approved · the base of «utilization» */
const pfLive = pfs.filter((pf) => pf.stage === 'approved' || pf.stage === 'closed')
const pfMoneyAll = pfs.map((pf) => pfMoney(pf))
const pfLate = pfs.filter((pf) => pf.stage === 'approved' && pf.plan.phases.length && pf.plan.phases.every((ph) => ph.to < today))

return [
  {
    id: 'BPD-001',
    key: 'bpd-001',
    no: 1,
    title: 'إعداد ميزانية المنح',
    owner: 'إدارة المنح',
    source: 'doc',
    kpis: [
      { no: 1, name: 'نسبة استغلال الميزانية', how: 'إجمالي المبالغ المصروفة ÷ إجمالي المبالغ المخصصة × 100%.', unit: 'pct', ...ratio(L((x) => x.m.paid), allocated, 'riyal'), better: 'up', target: null, to: ROUTES.budget },
      { no: 2, name: 'نسبة الرصيد المتبقي', how: 'إجمالي الرصيد المتبقي ÷ إجمالي المبالغ المخصصة × 100%.', unit: 'pct', ...ratio(L((x) => Math.max(0, x.m.available)), allocated, 'riyal'), better: 'flat', target: null, to: ROUTES.budget },
      { no: 3, name: 'نسبة الحجز من الميزانية', how: 'إجمالي المبالغ المحجوزة ÷ إجمالي المبالغ المخصصة × 100%.', unit: 'pct', ...ratio(L((x) => x.m.held + x.m.committed), allocated, 'riyal'), better: 'flat', target: null, to: ROUTES.budget },
      { no: 4, name: 'عدد البنود المستغلة', how: 'عدد بنود الميزانية التي تم استخدامها مقارنة بإجمالي البنود.', unit: 'pct', ...ratio(usedLines.length, leaves.length, 'line'), better: 'up', target: null, to: ROUTES.budget },
      { no: 5, name: 'نسبة البنود غير المستخدمة', how: 'عدد البنود التي لم يتم الحجز أو الصرف عليها ÷ إجمالي البنود × 100%.', unit: 'pct', ...ratio(leaves.length - usedLines.length, leaves.length, 'line'), better: 'down', target: null, to: ROUTES.budget },
      { no: 6, name: 'عدد المناقلات المالية', how: 'إجمالي طلبات المناقلات المنفذة خلال السنة المالية.', unit: 'count', value: transfers.length, better: 'flat', target: null, to: ROUTES.budgetOps },
      { no: 7, name: 'نسبة البنود التي استنفدت مخصصاتها', how: 'عدد البنود التي وصل رصيدها إلى صفر ÷ إجمالي البنود × 100%.', unit: 'pct', ...ratio(drained.length, leaves.length, 'line'), better: 'down', target: null, to: ROUTES.budget },
      { no: 8, name: 'نسبة استغلال مصدر التمويل', how: 'إجمالي المبالغ المصروفة من مصدر التمويل ÷ إجمالي المبلغ المخصص من المصدر × 100%.', unit: 'pct', ...ratio(sAll.paid, sAll.allocated, 'riyal'), split: S((v) => v.paid), better: 'up', target: null, to: ROUTES.budget },
      { no: 9, name: 'نسبة الحجز لكل مصدر تمويل', how: 'إجمالي المبالغ المحجوزة من المصدر ÷ إجمالي المبلغ المخصص من المصدر × 100%.', unit: 'pct', ...ratio(sAll.held, sAll.allocated, 'riyal'), split: S((v) => v.held), better: 'flat', target: null, to: ROUTES.budget },
      { no: 10, name: 'نسبة البنود متعددة مصادر التمويل', how: 'عدد البنود المرتبطة بأكثر من مصدر تمويل ÷ إجمالي بنود الميزانية × 100%.', unit: 'pct', ...ratio(multi.length, leaves.length, 'line'), better: 'flat', target: null, to: ROUTES.budget },
      { no: 11, name: 'نسبة المشاريع ذات التمويل المشترك', how: 'عدد المشاريع الممولة من أكثر من مصدر ÷ إجمالي المشاريع الممولة × 100%.', unit: 'pct', ...ratio(countOf(approved, (r) => r.shared), approved.length), better: 'flat', target: null, to: link('shared=1') },
      { no: 12, name: 'نسبة مصادر التمويل غير المستخدمة', how: 'عدد مصادر التمويل التي لم يتم الحجز أو الصرف منها ÷ إجمالي مصادر التمويل المعتمدة × 100%.', unit: 'pct', ...ratio(sourcesUnused, srcs.length, 'source'), better: 'down', target: null },
      { no: 13, name: 'نسبة الأرصدة غير المستغلة حسب المصدر', how: 'الرصيد غير المستخدم في مصدر التمويل ÷ إجمالي مخصصات المصدر × 100%.', unit: 'pct', ...ratio(Math.max(0, sAll.allocated - sAll.paid - sAll.held), sAll.allocated, 'riyal'), split: S((v) => Math.max(0, v.allocated - v.paid - v.held)), better: 'down', target: null, to: ROUTES.budget },
    ],
  },

  {
    id: 'BPD-002',
    key: 'bpd-002',
    no: 2,
    title: 'تسجيل واعتماد الجهات المستفيدة',
    owner: 'إدارة المنح',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة معالجة طلب التسجيل', how: 'متوسط الوقت من تاريخ تقديم الطلب حتى إصدار قرار الاعتماد أو الرفض.', unit: 'days', value: (() => { const m = mean(regDecided.map((r) => dayDiff(r.submittedAt, r.decidedAt!))); return m === null ? null : Math.round(m) })(), better: 'down', target: null, to: ROUTES.entityRequests },
      { no: 2, name: 'نسبة طلبات التسجيل المعتمدة من أول مراجعة', how: 'عدد الطلبات المعتمدة دون إعادة للاستكمال ÷ إجمالي الطلبات × 100%.', unit: 'pct', ...ratio(regDecided.filter((r) => r.state === 'approved' && returns(r) === 0).length, regSent.length, 'entity'), better: 'up', target: null, to: ROUTES.entityRequests },
      { no: 3, name: 'متوسط عدد مرات إعادة الطلب للاستكمال', how: 'إجمالي مرات إعادة الطلبات ÷ إجمالي الطلبات.', unit: 'avg', value: regSent.length ? Math.round((regSent.reduce((n, r) => n + returns(r), 0) / regSent.length) * 10) / 10 : null, better: 'down', target: null, to: ROUTES.entityRequests },
      { no: 4, name: 'نسبة الطلبات المرفوضة بسبب عدم صحة البيانات أو الوثائق', how: 'عدد الطلبات المرفوضة لهذا السبب ÷ إجمالي الطلبات × 100%.', unit: 'pct', ...ratio(regRows.filter((r) => r.state === 'rejected' && r.rejectReason === 'data').length, regSent.length, 'entity'), better: 'down', target: null, to: `${ROUTES.entityRequests}?state=rejected` },
      { no: 5, name: 'عدد الجهات الجديدة المعتمدة', how: 'إجمالي الجهات التي تم اعتمادها خلال الفترة.', unit: 'count', value: regYear.filter((r) => r.state === 'approved').length, better: 'up', target: null, to: `${ROUTES.entityRequests}?state=approved` },
      { no: 6, name: 'عدد الجهات الجديدة المرفوضة', how: 'إجمالي الجهات التي تم رفضها خلال الفترة.', unit: 'count', value: regYear.filter((r) => r.state === 'rejected').length, better: 'down', target: null, to: `${ROUTES.entityRequests}?state=rejected` },
    ],
  },

  {
    id: 'BPD-003',
    key: 'bpd-003',
    no: 3,
    title: 'استقبال ودراسة المشاريع',
    owner: 'مشرف المنح',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة دراسة المشروع', how: 'متوسط عدد الأيام من تاريخ إسناد المشروع إلى مشرف المنح حتى تسجيل التوصية.', unit: 'days', value: studyRec.value, better: 'down', target: null, derived: studyRec.derived, to: link('sort=waiting') },
      { no: 2, name: 'نسبة الالتزام بالمدة المستهدفة للدراسة', how: '(عدد المشاريع التي تمت دراستها ضمن المدة المحددة ÷ إجمالي المشاريع المدروسة) × 100%.', unit: 'pct', ...ratio(countOf(studied, studyIn), countOf(studied, studyHas)), better: 'up', target: null, derived: studyRec.derived, to: link('overdue=1') },
      { no: 3, name: 'متوسط عدد المشاريع التي تمت دراستها لكل مشرف', how: 'إجمالي المشاريع التي درسها المشرف خلال الفترة ÷ عدد المشرفين.', unit: 'avg', value: supervisors.size ? Math.round((studied.length / supervisors.size) * 10) / 10 : null, better: 'flat', target: null, to: P },
      { no: 4, name: 'نسبة المشاريع المحولة بين المشرفين', how: '(عدد المشاريع المحولة إلى مشرف آخر ÷ إجمالي المشاريع) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => j(r)?.transferred === true || flowOf(r.id).pastStudies.length > 0), rows.length), better: 'down', target: null, derived: true },
      { no: 5, name: 'نسبة المشاريع المعادة لاستكمال البيانات', how: '(عدد المشاريع المعادة للجهة لاستكمال البيانات ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => (j(r)?.toEntity ?? 0) > 0 || flowOf(r.id).versions.length > 1), rows.length), better: 'down', target: null, derived: true, to: link('stage=استكمال بيانات المشروع') },
      { no: 6, name: 'نسبة المشاريع المكتملة البيانات من أول إرسال', how: '(عدد المشاريع التي لم تتطلب استكمال بيانات ÷ إجمالي المشاريع) × 100%.', unit: 'pct', ...ratio(countOf(rows, (r) => (j(r)?.toEntity ?? 0) === 0 && flowOf(r.id).versions.length <= 1), rows.length), better: 'up', target: null, derived: true },
    ],
  },

  {
    id: 'BPD-004',
    key: 'bpd-004',
    no: 4,
    title: 'دور مدير المنح',
    owner: 'إدارة المنح',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة مراجعة المشاريع', how: 'متوسط عدد الأيام من تاريخ استلام المشروع حتى تسجيل قرار مدير المنح.', unit: 'days', value: mgrRec.value, better: 'down', target: null, derived: mgrRec.derived },
      { no: 2, name: 'نسبة الالتزام بالمدة المستهدفة للمراجعة', how: `(عدد المشاريع التي تمت مراجعتها ضمن المدة المستهدفة ÷ إجمالي المشاريع المستلمة) × 100%. والمدة ${countNoun(Math.round((ESC_LIMITS['approval.manager'] ?? 120) / 24), NOUN.day)} من آلية التصعيد.`, unit: 'pct', ...ratio(countOf(reachedManager, mgrIn), reachedManager.length), better: 'up', target: null, derived: mgrRec.derived, to: `${ROUTES.escalation}?proc=approval` },
      { no: 3, name: 'نسبة المشاريع المعادة إلى مشرف المنح', how: '(عدد المشاريع المعادة لاستكمال الدراسة ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(reachedManager, (r) => recsOf(r).some((x) => x.level === 'manager' && x.verdict === 'return') || (j(r)?.toSupervisor ?? 0) > 0), reachedManager.length), better: 'down', target: null, derived: true },
      { no: 4, name: 'نسبة المشاريع المحالة إلى المدير التنفيذي', how: '(عدد المشاريع المحالة إلى المدير التنفيذي ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(reachedManager, (r) => recsOf(r).some((x) => x.level === 'manager' && /recommend|refer/.test(x.verdict)) || (j(r)?.decidedBy !== null && j(r)?.decidedBy !== undefined && j(r)?.decidedBy !== 'مدير المنح')), reachedManager.length), better: 'flat', target: null, derived: true },
      { no: 5, name: 'نسبة الرفض النهائي ضمن صلاحيات مدير المنح', how: '(عدد المشاريع المرفوضة ضمن سقف مدير المنح ÷ إجمالي المشاريع المستلمة) × 100%.', unit: 'pct', ...ratio(countOf(rejected, (r) => recsOf(r).some((x) => x.level === 'manager' && x.verdict === 'final-reject') || (r.amountRequested <= capOf('manager') && !recsOf(r).length)), reachedManager.length), better: 'flat', target: null, to: link('support=مرفوض') },
      { no: 6, name: 'نسبة المشاريع التي تم حجز ميزانيتها من أول مراجعة', how: '(عدد المشاريع التي تم حجز مخصصاتها المالية دون إعادة الدراسة ÷ إجمالي المشاريع الموافق عليها) × 100%.', unit: 'pct', ...ratio(heldFirst.ok, approved.length), better: 'up', target: null, derived: heldFirst.derived },
    ],
  },

  {
    id: 'BPD-005',
    key: 'bpd-005',
    no: 5,
    title: 'دور المدير التنفيذي',
    owner: 'الإدارة التنفيذية',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة المراجعة التنفيذية', how: 'متوسط الزمن من استلام المشروع حتى تسجيل قرار الرئيس التنفيذي.', unit: 'days', value: execRec.value, better: 'down', target: null, derived: execRec.derived },
      { no: 2, name: 'نسبة القرارات ضمن المدة المستهدفة', how: `عدد المشاريع التي صدر قرارها ضمن اتفاقية مستوى الخدمة ÷ إجمالي المشاريع × 100%. والمدة ${countNoun(Math.round((ESC_LIMITS['approval.exec'] ?? 120) / 24), NOUN.day)} من آلية التصعيد.`, unit: 'pct', ...ratio(countOf(reachedExec, execIn), reachedExec.length), better: 'up', target: null, derived: execRec.derived, to: `${ROUTES.escalation}?proc=approval` },
      { no: 3, name: 'نسبة المشاريع المعادة إلى مدير المنح', how: 'عدد المشاريع المعادة لاستكمال الملاحظات ÷ إجمالي المشاريع المستلمة × 100%.', unit: 'pct', ...ratio(countOf(reachedExec, (r) => execReturns(r) > 0), reachedExec.length), better: 'down', target: null },
      { no: 4, name: 'متوسط عدد مرات إعادة المشروع', how: 'إجمالي مرات الإعادة ÷ عدد المشاريع المعادة.', unit: 'avg', value: (() => { const back = reachedExec.filter((r) => execReturns(r) > 0); return back.length ? Math.round((back.reduce((n, r) => n + execReturns(r), 0) / back.length) * 10) / 10 : null })(), gap: reachedExec.some((r) => execReturns(r) > 0) ? undefined : 'لم يُعِد المدير التنفيذي أي مشروع بعد · يُحسب من إعاداته المسجّلة.', better: 'down', target: null },
    ],
  },

  {
    id: 'BPD-006',
    key: 'bpd-006',
    no: 6,
    title: 'دور اللجنة التنفيذية',
    owner: 'اللجنة التنفيذية',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة دراسة المشروع في اللجنة التنفيذية', how: 'متوسط عدد الأيام من تاريخ إحالة المشروع إلى اللجنة حتى صدور القرار النهائي · من الإحالة المسجّلة وقرار الجلسة.', unit: 'days', value: committeeRec.value, better: 'down', target: null, derived: committeeRec.derived, to: ROUTES.committee },
      { no: 2, name: 'متوسط مدة إصدار قرار اللجنة', how: 'متوسط الزمن من تاريخ انعقاد الاجتماع حتى اعتماد القرار في النظام.', unit: 'days', value: (() => { const m = decisionLag('committee'); return m === null ? null : Math.round(m) })(), gap: decisionLag('committee') === null ? 'لا جلسة للجنة صدر فيها قرار بعد · يُحسب من تاريخ الجلسة وتاريخ القرار.' : undefined, better: 'down', target: null, to: ROUTES.committee },
      { no: 3, name: 'نسبة المشاريع المعتمدة من أول عرض', how: '(عدد المشاريع التي تمت التوصية بالموافقة عليها من أول عرض ÷ إجمالي المشاريع المعروضة) × 100%.', unit: 'pct', ...ratio(committeeFirst.ok, committeeShown.length), better: 'up', target: null, derived: committeeFirst.derived, to: ROUTES.committee },
      { no: 4, name: 'نسبة المشاريع المرفوضة', how: '(عدد المشاريع التي أوصت اللجنة برفضها ÷ إجمالي المشاريع المعروضة) × 100%.', unit: 'pct', ...(() => { const pool = decided.filter((r) => j(r)?.committee !== null); return ratio(countOf(pool, (r) => r.supportStatus === 'مرفوض'), pool.length) })(), better: 'down', target: null },
    ],
  },

  {
    id: 'BPD-007',
    key: 'bpd-007',
    no: 7,
    title: 'دور مجلس الأمناء',
    owner: 'مجلس الأمناء',
    source: 'doc',
    kpis: [
      { no: 1, name: 'نسبة المشاريع المعروضة ضمن المدة المحددة', how: `عدد المشاريع التي عرضت ضمن المدة المستهدفة ÷ إجمالي المشاريع المحالة × 100%. والمدة ${countNoun(Math.round((ESC_LIMITS['approval.board'] ?? 504) / 24), NOUN.day)} من آلية التصعيد.`, unit: 'pct', ...ratio(boardOnTime.length, boardItems.length), gap: boardItems.length ? undefined : 'لا مشروع عُرض على المجلس في جلسة مسجّلة بعد.', better: 'up', target: null, to: ROUTES.board },
      { no: 2, name: 'متوسط مدة إصدار قرار اللجنة', how: 'متوسط الزمن من تاريخ انعقاد الاجتماع حتى اعتماد القرار في النظام.', unit: 'days', value: (() => { const m = decisionLag('board'); return m === null ? null : Math.round(m) })(), gap: decisionLag('board') === null ? 'لا جلسة للمجلس صدر فيها قرار بعد · يُحسب من تاريخ الجلسة وتاريخ القرار.' : undefined, better: 'down', target: null, to: ROUTES.board },
      { no: 3, name: 'نسبة المشاريع التي صدر قرار بشأنها من أول عرض', how: 'عدد المشاريع التي تم البت فيها من أول اجتماع ÷ إجمالي المشاريع المعروضة × 100%.', unit: 'pct', ...ratio(boardFirst.ok, boardShown.length), better: 'up', target: null, derived: boardFirst.derived, to: ROUTES.board },
      { no: 4, name: 'نسبة المشاريع المرفوضة', how: 'عدد المشاريع المرفوضة ÷ إجمالي المشاريع المعروضة × 100%.', unit: 'pct', ...(() => { const pool = decided.filter((r) => j(r)?.decidedBy === 'مجلس الأمناء'); return ratio(countOf(pool, (r) => r.supportStatus === 'مرفوض'), pool.length) })(), better: 'down', target: null },
    ],
  },

  {
    id: 'BPD-008',
    key: 'bpd-008',
    no: 8,
    title: 'الاتفاقيات',
    owner: 'إدارة المنح',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة إعداد الاتفاقية', how: 'متوسط عدد الأيام من إحالة المشروع إلى مرحلة إعداد الاتفاقية حتى اعتماد الاتفاقية.', unit: 'days', value: (() => { const m = mean(agrPrep.map((x) => x.days)); return m === null ? null : Math.round(m) })(), gap: agrPrep.length ? undefined : 'لم تسرِ اتفاقية بعد · يُحسب من فتح الاتفاقية حتى سريانها.', better: 'down', target: null, to: ROUTES.agreements },
      { no: 2, name: 'نسبة الاتفاقيات المنجزة ضمن المدة المستهدفة', how: `(عدد الاتفاقيات المعتمدة ضمن المدة المستهدفة ÷ إجمالي الاتفاقيات) × 100%. والمدة ${countNoun(AGR_TARGET, NOUN.day)} · مجموع مدد مراحل الاتفاقية في الإعدادات.`, unit: 'pct', ...ratio(agrPrep.filter((x) => x.days <= AGR_TARGET).length, agrAll.length, 'agreement'), better: 'up', target: null, to: ROUTES.agreements },
      { no: 3, name: 'متوسط مدة دورة اعتماد الاتفاقية', how: 'متوسط الزمن من إرسال الاتفاقية للاعتماد حتى اكتمال جميع الاعتمادات · من سجل الاتفاقية.', unit: 'days', value: (() => { const m = mean(agrCycle); return m === null ? null : Math.round(m) })(), gap: agrCycle.length ? undefined : 'لا اتفاقية اكتملت اعتماداتها بعد إرسالها · يُحسب من سجلها.', better: 'down', target: null, to: ROUTES.agreements },
      { no: 4, name: 'نسبة الاتفاقيات المعادة للتعديل', how: '(عدد الاتفاقيات المعادة للمراجعة أو التعديل ÷ إجمالي الاتفاقيات) × 100% · الإعادة من سجل الاتفاقية.', unit: 'pct', ...ratio(agrAll.filter(agrWasReturned).length, agrAll.length, 'agreement'), better: 'down', target: null, to: `${ROUTES.agreements}?stage=returned` },
    ],
  },

  {
    id: 'BPD-009',
    key: 'bpd-009',
    no: 9,
    title: 'صرف الدفعات',
    owner: 'الإدارة المالية',
    source: 'doc',
    kpis: [
      { no: 1, name: 'متوسط مدة معالجة طلب الصرف', how: 'متوسط عدد الأيام من تقديم طلب الصرف حتى تنفيذ عملية الصرف.', unit: 'days', value: (() => { const m = mean(paid.map((r) => dayDiff(r.at, r.paidAt!))); return m === null ? null : Math.round(m) })(), better: 'down', target: null, to: ROUTES.payments },
      { no: 2, name: 'نسبة طلبات الصرف المنجزة ضمن المدة المستهدفة', how: `(عدد طلبات الصرف المنجزة ضمن المدة المحددة ÷ إجمالي طلبات الصرف) × 100%. والمدة ${countNoun(PAY_TARGET_DAYS, NOUN.day)}.`, unit: 'pct', ...ratio(paid.filter((r) => dayDiff(r.at, r.paidAt!) <= PAY_TARGET_DAYS).length, payRequests.length), better: 'up', target: null, to: ROUTES.payments },
      { no: 3, name: 'متوسط مدة تنفيذ الصرف المالي', how: 'متوسط الزمن من اعتماد مدير المنح حتى تنفيذ التحويل المالي.', unit: 'days', value: (() => { const m = mean(paid.map((r) => { const a = r.log.find((e) => e.step === 13)?.at; return a ? dayDiff(a, r.paidAt!) : null }).filter((x): x is number => x !== null)); return m === null ? null : Math.round(m) })(), better: 'down', target: null, to: ROUTES.payments },
      { no: 4, name: 'نسبة الالتزام بجدول الدفعات', how: '(عدد الدفعات المصروفة في موعدها ÷ إجمالي الدفعات المستحقة) × 100%.', unit: 'pct', ...ratio(due.filter((r) => r.paidAt && r.paidAt <= r.dueAt).length, due.length), better: 'up', target: null, to: `${ROUTES.payments}` },
    ],
  },

  {
    id: 'BPD-010',
    key: 'bpd-010',
    no: 10,
    title: 'إغلاق المشروع',
    owner: 'إدارة المنح',
    source: 'doc',
    /* Warning: **indicators 2 and 3 became measurable only after this module was built.** They used
       to both be `gap`, for two different reasons: the second has no target duration in the
       document, and the third has "request and submission are two independent sections, and neither
       has a date field in the mock." Both are resolved here rather than in the live system: the
       target duration is **ours, provisional** (`CLOSE_TARGET_DAYS`, an open question), and the
       submission date now comes from the audit log. So the number now comes from our own mock
       rather than from missing columns, and this note exists so whoever comes after knows the
       second one's target is still an assumption. */
    kpis: [
      { no: 1, name: 'متوسط مدة إغلاق المشروع', how: 'متوسط عدد الأيام من إنشاء طلب التقرير الختامي حتى اعتماد الإغلاق النهائي للمشروع.', unit: 'days', value: closeKpi().avg, better: 'down', target: null, derived: true, to: ROUTES.closings },
      { no: 2, name: 'نسبة المشاريع المغلقة ضمن المدة المستهدفة', how: `(عدد المشاريع التي تم إغلاقها ضمن المدة المستهدفة ÷ إجمالي المشاريع المغلقة) × 100%. والمدة المستهدفة ${countNoun(CLOSE_TARGET_DAYS, NOUN.day)}، وهي افتراض مؤقت وليست من الوثيقة.`, unit: 'pct', value: closeKpi().inTimePct, better: 'up', target: null, derived: true, to: ROUTES.closings },
      { no: 3, name: 'متوسط مدة إعداد التقرير الختامي', how: 'متوسط الزمن من إنشاء طلب التقرير الختامي حتى إرسال التقرير من الجهة المستفيدة · من سجلّ التدقيق (قاعدة 11).', unit: 'days', value: closeKpi().prepDays, better: 'down', target: null, derived: true, to: ROUTES.closings },
      { no: 4, name: 'نسبة المشاريع التي تم إغلاقها بعد استكمال جميع المتطلبات', how: '(عدد المشاريع التي استوفت جميع متطلبات الإغلاق ÷ إجمالي المشاريع المغلقة) × 100%. والمتطلبات المحسوبة هي التي يعرفها النظام (قاعدة 8 · س-15 مفتوح).', unit: 'pct', value: closeKpi().fullPct, better: 'up', target: null, derived: true, to: ROUTES.closings },
    ],
  },
  /* Ehsan and the portfolios · the document lists the indicators in BPD-011 and BPD-013; they
     had no row here at all (cross · KPIs) */
  {
    id: 'BPD-011',
    key: 'bpd-011',
    no: 11,
    title: 'مشاريع إحسان',
    owner: 'إدارة المنح',
    source: 'paraphrase',
    kpis: [
      { no: 1, name: 'نسبة إنجاز مشاريع إحسان', how: '(مشاريع إحسان المكتملة ÷ إجمالي مشاريع إحسان) × 100%.', unit: 'pct', ...ratio(ehClosed.length, eh.length), better: 'up', target: null, to: `${ROUTES.partners}?tab=ehsan` },
      { no: 2, name: 'نسبة المشاريع المتأخرة أو المتعثرة', how: '(مشاريع إحسان التي تجاوزت نهاية مدتها ولم تكتمل أو تعثّرت ÷ مشاريع إحسان الجاري تنفيذها) × 100%.', unit: 'pct', ...ratio(ehLate.length, ehRunning.length), better: 'down', target: null, to: `${ROUTES.escalation}?proc=ehsan` },
      { no: 3, name: 'نسبة تنفيذ الدفعات', how: '(قيمة الدفعات المؤكدة ÷ إجمالي قيمة مشاريع إحسان) × 100%.', unit: 'pct', ...ratio(ehMoneyAll.reduce((n, m) => n + m.confirmed, 0), ehMoneyAll.reduce((n, m) => n + m.value, 0), 'riyal'), better: 'up', target: null, to: `${ROUTES.partners}?tab=finance` },
      { no: 4, name: 'متوسط مدة الإغلاق', how: 'متوسط الأيام من اكتمال التنفيذ حتى إغلاق مشروع إحسان · من سجل الإغلاق في إحسان.', unit: 'days', value: (() => { const m = mean(ehCloseDays); return m === null ? null : Math.round(m) })(), gap: ehCloseDays.length ? undefined : 'لم يُغلق مشروع إحسان بعد · يُحسب من نهاية التنفيذ حتى الإغلاق.', better: 'down', target: null, to: `${ROUTES.partners}?tab=ehsan` },
      { no: 5, name: 'الدفعات بانتظار المراجعة المالية', how: 'عدد دفعات المنصة التي لم تؤكدها الإدارة المالية بعد.', unit: 'count', value: EHSAN_PAYS.filter((x) => x.state === 'review').length, better: 'down', target: null, ours: true, to: `${ROUTES.partners}?tab=finance` },
    ],
  },
  /* Project plans · section 12.8 (batch 5 · 8 Oct)
     The page said the document gives no indicators for this procedure, and the source was `ours`.
     That was wrong: 12.8 lists four. They come first, in the document's order and in our wording
     (`paraphrase`), and the two we derived from its rules follow, marked «ليس في الوثيقة». */
  {
    id: 'BPD-012',
    key: 'bpd-012',
    no: 12,
    title: 'خطط المشاريع',
    owner: 'إدارة المنح',
    source: 'paraphrase',
    kpis: [
      { no: 1, name: 'نسبة اكتمال أنشطة الخطة', how: '(الأنشطة المقبولة ÷ إجمالي أنشطة الخطط) × 100% · بالعدد لا بالتكلفة.', unit: 'pct', ...ratio(accepted.length, acts.length, 'activity'), better: 'up', target: null, to: ROUTES.plans },
      { no: 2, name: 'نسبة الأنشطة المتأخرة', how: '(الأنشطة التي تجاوزت موعدها ولم تُقبل أو تعثّرت ÷ الأنشطة المستحقة حتى اليوم) × 100%.', unit: 'pct', ...ratio(lateOrStuck, Math.max(lateOrStuck, dueActs.length), 'activity'), better: 'down', target: null, to: `${ROUTES.plans}?late=1` },
      { no: 3, name: 'نسبة القبول من أول مراجعة', how: '(الأنشطة المقبولة دون إعادة ÷ الأنشطة التي راجعتها المؤسسة) × 100%.', unit: 'pct', ...ratio(firstOk.length, reviewedActs.length, 'activity'), better: 'up', target: null, to: ROUTES.plans },
      { no: 4, name: 'متوسط مدة اعتماد النشاط', how: 'متوسط الأيام من تقديم النشاط للقبول حتى قبوله.', unit: 'days', value: (() => { const m = mean(actDays); return m === null ? null : Math.round(m) })(), better: 'down', target: null, to: ROUTES.plans },
      { no: 5, name: 'متوسط مدة اعتماد الخطة', how: 'متوسط الأيام من فتح الخطة حتى تثبيت النسخة المرجعية.', unit: 'days', value: planKpi().approveDays, better: 'down', target: null, derived: true, ours: true, to: ROUTES.plans },
      { no: 6, name: 'الأنشطة بانتظار مراجعة المؤسسة', how: 'عدد الأنشطة التي أفادت الجهة باكتمالها ولم تُراجع بعد (قاعدة 14).', unit: 'count', value: planKpi().waiting, better: 'down', target: null, ours: true, to: `${ROUTES.plans}?wait=1` },
    ],
  },

  {
    id: 'BPD-013',
    key: 'bpd-013',
    no: 13,
    title: 'المحافظ',
    owner: 'إدارة المنح',
    source: 'paraphrase',
    kpis: [
      { no: 1, name: 'نسبة استغلال قيمة المحفظة', how: '(قيم المشاريع الفرعية المعتمدة ÷ القيمة المعتمدة للمحافظ) × 100%.', unit: 'pct', ...ratio(pfLive.reduce((n, pf) => n + pfMoney(pf).approved, 0), pfLive.reduce((n, pf) => n + pf.total, 0), 'riyal'), better: 'up', target: null, to: `${ROUTES.partners}?tab=portfolios` },
      { no: 2, name: 'نسبة اعتماد المشاريع الفرعية', how: '(المشاريع الفرعية المعتمدة ÷ المشاريع الفرعية المرسلة للاعتماد) × 100%.', unit: 'pct', ...ratio(subsOk.length, subsSent.length), better: 'up', target: null, to: `${ROUTES.partners}?tab=portfolios` },
      { no: 3, name: 'نسبة إنجاز المشاريع الفرعية', how: '(المشاريع الفرعية المكتملة ÷ المشاريع الفرعية المعتمدة) × 100%.', unit: 'pct', ...ratio(subsOk.filter((x) => x.exec?.status === 'مكتمل').length, subsOk.length), better: 'up', target: null, to: `${ROUTES.partners}?tab=portfolios` },
      { no: 4, name: 'نسبة تحقيق مستهدفات المستفيدين', how: '(المستفيدون الفعليون ÷ المستفيدون المستهدفون في المشاريع الفرعية المعتمدة) × 100%.', unit: 'pct', ...ratio(subsOk.reduce((n, x) => n + (x.exec?.reached ?? 0), 0), subsOk.reduce((n, x) => n + x.beneficiaries, 0), 'beneficiary'), better: 'up', target: null, to: `${ROUTES.partners}?tab=portfolios` },
      { no: 5, name: 'نسبة الصرف من المحافظ', how: '(المصروف المؤكد ÷ إجمالي قيمة المحافظ) × 100%.', unit: 'pct', ...ratio(pfMoneyAll.reduce((n, m) => n + m.confirmed, 0), pfMoneyAll.reduce((n, m) => n + m.total, 0), 'riyal'), better: 'up', target: null, ours: true, to: `${ROUTES.partners}?tab=finance` },
      { no: 6, name: 'نسبة المحافظ المتأخرة', how: '(المحافظ التي انقضت مراحل خطتها ولم تُغلق ÷ المحافظ المعتمدة) × 100%.', unit: 'pct', ...ratio(pfLate.length, pfs.filter((x) => x.stage === 'approved').length), better: 'down', target: null, ours: true, to: `${ROUTES.escalation}?proc=portfolio` },
    ],
  },
]
}

/** The procedures' indicators, computed now · every page reads this, not a copy from load */
export const kpiProcesses = (): ProcessKpis[] => build()

/* Totals */

export interface KpiCoverage {
  total: number
  measured: number
  missing: number
  /** Indicators that measure compliance against a target duration that doesn't actually exist */
  noTarget: number
}

/** An indicator whose own name assumes an agreed-upon duration, and there is no agreed-upon duration */
const NEEDS_SLA = /المدة المستهدفة|المدة المحددة|مستوى الخدمة/

export function kpiCoverage(list: ProcessKpis[] = build()): KpiCoverage {
  const all = list.flatMap((p) => p.kpis)
  return {
    total: all.length,
    measured: all.filter((k) => k.value !== null).length,
    missing: all.filter((k) => k.value === null).length,
    /* A target duration that now comes from the escalation settings is no longer missing */
    noTarget: all.filter((k) => (NEEDS_SLA.test(k.name) || NEEDS_SLA.test(k.how)) && k.value === null).length,
  }
}

export const measuredIn = (p: ProcessKpis): number => p.kpis.filter((k) => k.value !== null).length

export const processByKey = (key: string, list: ProcessKpis[] = build()): ProcessKpis | undefined =>
  list.find((p) => p.key === key)

/** The procedure's headline indicator · the first indicator that has a value */
export const headlineOf = (p: ProcessKpis): Kpi | undefined => p.kpis.find((k) => k.value !== null)
