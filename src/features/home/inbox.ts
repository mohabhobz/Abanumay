/**
 * Today's inbox · what waits on each role, as the client listed it (3 Oct 2026).
 *
 *   مشرف المنح      مشاريع للدراسة · مشاريع المحافظ للاعتماد · اتفاقيات · الدفعات · خطط المشاريع ·
 *                   النشاطات · التقارير الختامية · التقييمات
 *   مدير المنح      مشاريع للاعتماد · مشاريع المحافظ للاعتماد · اتفاقيات · الدفعات · خطط المشاريع ·
 *                   التقارير الختامية · التقييمات · مناقلات الميزانية
 *   المدير التنفيذي  مشاريع الرئيس التنفيذي · مشاريع اللجنة التنفيذية · مشاريع مجلس الأمناء ·
 *                   الاتفاقيات · التقارير الختامية · التقييمات · الميزانيات · مناقلات الميزانيات
 *
 * Each queue reads the module's own records at the stage that sits with the role, so a count here
 * is the same number the module's list shows behind its «الكل» link. The order is the client's.
 *
 * Only «مشاريع للدراسة» is narrowed to the signed-in supervisor. The other modules' sample records
 * are spread over people who aren't roles here, so filtering them by owner would empty the demo;
 * with real data every supervisor queue takes the same `owner` filter.
 *
 * Projects that climb above the executive director go by amount: up to the grants manager's limit
 * with the manager, then the executive director, then the executive committee, then the board. The
 * bands come from the approval matrix in «إعدادات المشاريع والصرف» (src/data/approval.ts).
 */
import { ROUTES } from '@/app/routes'
import { capOf } from '@/data/approval'
import { holderOf } from '@/data/holders'
import { fixtures, stagePressure } from '@/data/repository'
import { agreements, AGR_LIMIT } from '@/data/mock/agreements'
import { payRequests, PAY_LIMIT } from '@/data/mock/disbursements'
import { planRows, PLAN_LIMIT, waitingReview } from '@/data/mock/plans'
import { closeRows, CLOSE_LIMIT } from '@/data/mock/closing'
import { budgetDocs, docTitle } from '@/data/mock/budgetTree'
import { portfolios } from '@/data/mock/implementer'
import { projectCode } from '@/lib/format'
import { rowCode, rowHref, isPortfolio } from '@/features/projects/list/columns'
import type { RoleKey } from '@/data/roles'
import type { ProjectRow } from '@/types/domain'

export interface InboxItem {
  id: string
  code: string
  title: string
  sub: string
  amount?: number
  days: number
  late: boolean
  /** Region of the project behind the item · places it on the map; absent for budget items */
  region?: string
  /** City of the project · the swipe list under the map (meeting 1 Oct, E-5) */
  city?: string
  /** The stage's limit in days · 0 when the stage has none. Feeds the SLA colour of the trend lines */
  limit: number
  to: string
}

export interface InboxQueue {
  key: string
  label: string
  /** What the queue holds · one line under its title */
  note: string
  items: InboxItem[]
  /** The module list filtered to this queue */
  all: string
  icon: 'navProjects' | 'contract' | 'pay' | 'navPlans' | 'checks' | 'navClosings' | 'insight' | 'budget' | 'grid'
}

/** A record's region through its project · agreements, payments, plans and closings carry the id */
const regionOf = (projectId: string): string | undefined =>
  fixtures.projects.find((p) => p.id === projectId)?.region
const cityOf = (projectId: string): string | undefined =>
  fixtures.projects.find((p) => p.id === projectId)?.city

const d = (hours: number) => Math.max(0, Math.round(hours / 24))
const late = (hours: number, limit: number) => limit > 0 && hours > limit
const byWait = (a: InboxItem, b: InboxItem) => Number(b.late) - Number(a.late) || b.days - a.days

/* Approval bands by amount · read from the approval matrix in settings, so changing a cap there
   moves projects between the executive's, the committee's and the board's queues here. */
const CEO_UPTO = () => capOf('exec')
const BOARD_FROM = () => capOf('committee')

const studying = () => fixtures.projects.filter((p) => p.statusGroup === 'في الدراسة')

const fromProject = (p: ProjectRow): InboxItem => ({
  id: p.id,
  code: isPortfolio(p) ? rowCode(p) : projectCode(p.id, p.year),
  title: p.name,
  sub: p.entityName,
  amount: p.amountRequested,
  days: d(p.hoursInStage),
  late: stagePressure(p) > 1,
  limit: d(p.stageLimit),
  region: p.region,
  city: p.city,
  to: rowHref(p),
})

const projectsQueue = (
  key: string, label: string, note: string, rows: ProjectRow[], all: string, icon: InboxQueue['icon'] = 'navProjects',
): InboxQueue => ({ key, label, note, items: rows.map(fromProject).sort(byWait), all, icon })

/* ── Module queues, parameterised by the stage that sits with the role ── */

const agreementsAt = (stages: string[], owner?: string): InboxQueue => ({
  key: 'agreements',
  label: 'الاتفاقيات',
  note: stages.includes('draft') ? 'صياغة ومراجعة قبل الرفع' : 'بانتظار اعتمادك',
  icon: 'contract',
  all: `${ROUTES.agreements}?stage=${stages.join(',')}`,
  items: agreements
    .filter((a) => stages.includes(a.stage) && (!owner || a.owner === owner))
    .map((a) => ({
      id: a.id, code: a.id.toUpperCase(), title: a.projectName, sub: a.entityName, amount: a.amount,
      days: d(a.hoursInStage), late: late(a.hoursInStage, AGR_LIMIT[a.stage]), limit: d(AGR_LIMIT[a.stage]), region: regionOf(a.projectId), city: cityOf(a.projectId), to: ROUTES.agreement(a.id),
    }))
    .sort(byWait),
})

const paymentsAt = (state: 'supervisor' | 'manager', owner?: string): InboxQueue => ({
  key: 'payments',
  label: 'الدفعات',
  note: state === 'supervisor' ? 'طلبات صرف وصلت إلى مرحلتك' : 'بانتظار اعتمادك قبل المالية',
  icon: 'pay',
  all: `${ROUTES.payments}?state=${state}`,
  items: payRequests
    .filter((r) => r.state === state && (!owner || r.owner === owner))
    .map((r) => ({
      id: r.id, code: r.id.toUpperCase(), title: r.projectName, sub: `${r.entityName} · الدفعة ${r.no} من ${r.of}`,
      amount: r.asked, days: d(r.hoursInState), late: late(r.hoursInState, PAY_LIMIT[r.state]), limit: d(PAY_LIMIT[r.state]), region: regionOf(r.projectId), city: cityOf(r.projectId), to: ROUTES.payment(r.id),
    }))
    .sort(byWait),
})

const plansAt = (stage: 'supervisor' | 'manager', owner?: string): InboxQueue => ({
  key: 'plans',
  label: 'خطط المشاريع',
  note: stage === 'supervisor' ? 'مراجعة فنية للمراحل والأنشطة' : 'اعتمادك يثبّت النسخة المرجعية',
  icon: 'navPlans',
  all: `${ROUTES.plans}?stage=${stage}`,
  items: planRows
    .filter((p) => p.stage === stage && (!owner || p.owner === owner))
    .map((p) => ({
      id: p.id, code: p.id.toUpperCase(), title: p.projectName, sub: p.entityName,
      days: d(p.hoursInStage), late: late(p.hoursInStage, PLAN_LIMIT[p.stage]), limit: d(PLAN_LIMIT[p.stage]), region: regionOf(p.projectId), city: cityOf(p.projectId), to: ROUTES.plan(p.id),
    }))
    .sort(byWait),
})

/** Activities the entity marked done · they don't count toward progress until accepted (rule 14) */
const activities = (owner?: string): InboxQueue => ({
  key: 'activities',
  label: 'النشاطات',
  note: 'أعلنتها الجهة مكتملة · لا تُحتسب قبل قبولك',
  icon: 'checks',
  all: `${ROUTES.plans}?wait=1`,
  items: planRows
    .filter((p) => !owner || p.owner === owner)
    .flatMap((p) => waitingReview(p).map((a) => ({
      id: `${p.id}-${a.id}`, code: p.id.toUpperCase(), title: a.name, sub: p.projectName,
      days: Math.max(0, Math.round((Date.parse('2026-09-14') - Date.parse(a.doneAt ?? a.to)) / 864e5)),
      late: false, limit: 0, region: regionOf(p.projectId), city: cityOf(p.projectId), to: `${ROUTES.plan(p.id)}#act-${a.id}`,
    })))
    .sort(byWait),
})

const closingsAt = (key: 'reports' | 'evals', stages: string[], owner?: string): InboxQueue => ({
  key,
  label: key === 'reports' ? 'التقارير الختامية' : 'التقييمات',
  note: key === 'reports' ? 'مقارنة المعتمد بالتنفيذ الفعلي' : 'دورة اعتماد مستقلّة عن التقرير',
  icon: key === 'reports' ? 'navClosings' : 'insight',
  all: `${ROUTES.closings}?stage=${stages.join(',')}`,
  items: closeRows
    .filter((c) => stages.includes(c.stage) && (!owner || c.owner === owner))
    .map((c) => ({
      id: c.id, code: c.id.toUpperCase(), title: c.projectName, sub: c.entityName,
      days: d(c.hoursInStage), late: late(c.hoursInStage, CLOSE_LIMIT[c.stage]), limit: d(CLOSE_LIMIT[c.stage]), region: regionOf(c.projectId), city: cityOf(c.projectId),
      to: key === 'reports' ? ROUTES.closing(c.id) : ROUTES.closingEval(c.id),
    }))
    .sort(byWait),
})

/** Projects inside a portfolio that haven't started · each needs its own approval */
const portfolioItems = (note: string): InboxQueue => ({
  key: 'portfolios',
  label: 'مشاريع المحافظ للاعتماد',
  note,
  icon: 'grid',
  all: `${ROUTES.projects}?tab=portfolios`,
  items: portfolios.flatMap((pf) => pf.items.filter((x) => x.status === 'لم يبدأ').map((x) => ({
    id: x.id, code: x.id, title: x.name, sub: pf.name, amount: x.amount,
    days: 0, late: false, limit: 0, region: x.region, to: ROUTES.portfolio(pf.id),
  }))),
})

/* ── Budget transfers · no module yet, so a small sample until the transfers screen exists ── */

export const BUDGET_TRANSFERS = [
  { id: 'TR-2026-014', from: 'هدف البرامج الوقائية', to: 'هدف دعم المستشفيات', amount: 400_000, by: 'محمد المطيري', hours: 52, with: 'manager' },
  { id: 'TR-2026-015', from: 'هدف البحث العلمي', to: 'هدف المنح الدراسية', amount: 250_000, by: 'عبدالله الدوسري', hours: 130, with: 'manager' },
  { id: 'TR-2026-011', from: 'مسار تفطير الصائمين', to: 'مسار التنمية المجتمعية', amount: 1_200_000, by: 'عبدالله الدوسري', hours: 26, with: 'executive' },
  { id: 'TR-2026-012', from: 'هدف حملات التوعية', to: 'هدف الأجهزة الطبية', amount: 600_000, by: 'سلطان العتيبي', hours: 190, with: 'executive' },
] as const

const transfers = (who: 'manager' | 'executive'): InboxQueue => ({
  key: 'transfers',
  label: who === 'manager' ? 'مناقلات الميزانية' : 'مناقلات الميزانيات',
  note: 'نقل مبلغ بين بنود الميزانية',
  icon: 'grid',
  all: ROUTES.budget,
  items: BUDGET_TRANSFERS.filter((t) => t.with === who).map((t) => ({
    id: t.id, code: t.id, title: `من «${t.from}» إلى «${t.to}»`, sub: `طلبها ${t.by}`,
    amount: t.amount, days: d(t.hours), late: t.hours > 120, limit: 5, to: ROUTES.budget,
  })).sort(byWait),
})

const budgets = (): InboxQueue => ({
  key: 'budgets',
  label: 'الميزانيات',
  note: 'وثائق ميزانية رُفعت للاعتماد',
  icon: 'budget',
  all: ROUTES.budget,
  items: budgetDocs.filter((b) => b.state === 'submitted').map((b) => ({
    id: b.id, code: b.id, title: docTitle(b), sub: `${b.from} — ${b.to}`, amount: b.total,
    days: 0, late: false, limit: 0, to: ROUTES.budgetDoc(b.id),
  })),
})

/* ── Per role, in the client's order ── */

export function inboxFor(role: RoleKey, me: string): InboxQueue[] {
  const single = studying().filter((p) => !isPortfolio(p))

  if (role === 'supervisor') {
    return [
      projectsQueue('study', 'مشاريع للدراسة', 'مسندة إليك وتنتظر توصيتك',
        single.filter((p) => p.owner === me && holderOf(p) === 'supervisor'), `${ROUTES.projects}?tab=mine`),
      portfolioItems('تنتظر توصيتك قبل أن تبدأ'),
      agreementsAt(['draft', 'returned']),
      paymentsAt('supervisor'),
      plansAt('supervisor'),
      activities(),
      closingsAt('reports', ['supervisor']),
      closingsAt('evals', ['reportDone', 'evalDraft']),
    ]
  }

  if (role === 'grants-manager') {
    return [
      /* B-5 · what sits at his seat now · he approves within his cap and sends the rest up */
      projectsQueue('approve', 'مشاريع للاعتماد', 'عندك الآن · تعتمد ما في حدّك وترفع ما فوقه',
        single.filter((p) => holderOf(p) === 'manager'), `${ROUTES.projects}?status=في الدراسة&sort=amount`),
      projectsQueue('committee-sec', 'قرارات اللجنة للتسجيل', 'عند اللجنة التنفيذية · تسجّلها أمينًا للجنة',
        single.filter((p) => holderOf(p) === 'committee'), `${ROUTES.projects}?status=في الدراسة&sort=amount`),
      portfolioItems('تنتظر اعتمادك قبل أن تبدأ'),
      agreementsAt(['manager']),
      paymentsAt('manager'),
      plansAt('manager'),
      closingsAt('reports', ['manager']),
      closingsAt('evals', ['evalManager']),
      transfers('manager'),
    ]
  }

  return [
    projectsQueue('ceo', 'مشاريع الرئيس التنفيذي', 'فوق حدّ مدير المنح وضمن حدّك',
      single.filter((p) => holderOf(p) === 'exec' && p.amountRequested <= CEO_UPTO()),
      `${ROUTES.projects}?status=في الدراسة&sort=amount`),
    projectsQueue('committee', 'مشاريع اللجنة التنفيذية', 'ترفعها إلى اللجنة التنفيذية',
      single.filter((p) => ['exec', 'committee'].includes(holderOf(p) ?? '') && p.amountRequested > CEO_UPTO() && p.amountRequested <= BOARD_FROM()),
      `${ROUTES.projects}?status=في الدراسة&sort=amount`),
    projectsQueue('board', 'مشاريع مجلس الأمناء', 'ترفعها إلى مجلس الأمناء',
      single.filter((p) => ['exec', 'committee', 'board'].includes(holderOf(p) ?? '') && p.amountRequested > BOARD_FROM()),
      `${ROUTES.projects}?status=في الدراسة&sort=amount`),
    agreementsAt(['executive']),
    closingsAt('reports', ['executive']),
    closingsAt('evals', ['evalExecutive']),
    budgets(),
    transfers('executive'),
  ]
}

/* ── Trend over the last days · for the sparklines in the top strip ──
   There is no stored history yet, so the line is rebuilt from the waiting items' own ages: an item
   that has waited 9 days was in the queue on each of the last 9 days, at the age it had then. That
   is exact for what is still open and leaves out what was closed meanwhile, so the line reads as
   "how this backlog built up", which is the question the strip asks. With a history table it
   becomes a plain daily count. */

export type Sla = 'ok' | 'near' | 'late'

export interface TrendPoint {
  /** Days before today · 0 is today */
  ago: number
  value: number
  sla: Sla
}

const NEAR = 0.8

const itemSla = (age: number, limit: number): Sla =>
  limit <= 0 ? 'ok' : age > limit ? 'late' : age > limit * NEAR ? 'near' : 'ok'

/** The day's SLA from the set open that day · a third late is a breach, any late or near is a warning */
const setSla = (states: Sla[]): Sla => {
  if (!states.length) return 'ok'
  const lateShare = states.filter((x) => x === 'late').length / states.length
  if (lateShare >= 1 / 3) return 'late'
  return states.some((x) => x !== 'ok') ? 'near' : 'ok'
}

const open = (items: InboxItem[], ago: number) =>
  items.filter((i) => i.days >= ago).map((i) => itemSla(i.days - ago, i.limit))

export const TREND_DAYS = 14

const range = () => Array.from({ length: TREND_DAYS }, (_, k) => TREND_DAYS - 1 - k)

/** Open items per day */
export const backlogTrend = (items: InboxItem[]): TrendPoint[] =>
  range().map((ago) => {
    const s = open(items, ago)
    return { ago, value: s.length, sla: setSla(s) }
  })

/** Items past their limit per day */
export const lateTrend = (items: InboxItem[]): TrendPoint[] =>
  range().map((ago) => {
    const s = open(items, ago)
    const n = s.filter((x) => x === 'late').length
    return { ago, value: n, sla: n === 0 ? (s.includes('near') ? 'near' : 'ok') : setSla(s) }
  })

/** Age of the oldest open item per day, coloured against that item's own limit */
export const oldestTrend = (items: InboxItem[]): TrendPoint[] =>
  range().map((ago) => {
    const live = items.filter((i) => i.days >= ago)
    const top = [...live].sort((a, b) => b.days - a.days)[0]
    return top
      ? { ago, value: top.days - ago, sla: itemSla(top.days - ago, top.limit) }
      : { ago, value: 0, sla: 'ok' }
  })

/** Share of open items within their limit per day, as a percentage · 100 when nothing is open */
export const complianceTrend = (items: InboxItem[]): TrendPoint[] =>
  range().map((ago) => {
    const s = open(items, ago)
    const ok = s.length ? Math.round((s.filter((x) => x !== 'late').length / s.length) * 100) : 100
    return { ago, value: ok, sla: ok >= 90 ? 'ok' : ok >= 75 ? 'near' : 'late' }
  })

/** Riyals waiting per day */
export const amountTrend = (items: InboxItem[]): TrendPoint[] =>
  range().map((ago) => {
    const live = items.filter((i) => i.days >= ago)
    return {
      ago,
      value: live.reduce((a, i) => a + (i.amount ?? 0), 0),
      sla: setSla(live.map((i) => itemSla(i.days - ago, i.limit))),
    }
  })
