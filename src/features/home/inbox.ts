/**
 * Today's inbox · what waits on each role, as the client listed it (3 Oct 2026).
 *
 *   مشرف المنح      مشاريع للدراسة · مشاريع المحافظ للاعتماد · اتفاقيات · الدفعات · خطط المشاريع ·
 *                   النشاطات · التقارير الختامية · التقييمات
 *   مدير المنح      مشاريع للاعتماد · مشاريع المحافظ للاعتماد · اتفاقيات · الدفعات · خطط المشاريع ·
 *                   التقارير الختامية · التقييمات · مناقلات الميزانية
 *   المدير التنفيذي  مشاريع المدير التنفيذي · مشاريع اللجنة التنفيذية · مشاريع مجلس الأمناء ·
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
import { holderOf } from '@/data/holders'
import { fixtures, stagePressure } from '@/data/repository'
import { agreements, AGR_LIMIT } from '@/data/mock/agreements'
import { agrHolder } from '@/data/agreements/store'
import { payRequests, PAY_LIMIT } from '@/data/mock/disbursements'
import { payableProjects, scheduleOf } from '@/data/payments/store'
import { planRows, PLAN_LIMIT, waitingReview } from '@/data/mock/plans'
import { closeRows, CLOSE_LIMIT } from '@/data/mock/closing'
import { CASES, CASE_KIND_SAY, CASE_STAGE_SAY, caseActions, endedUnclosed, openGate } from '@/data/closing/store'
import { projectById } from '@/data/mock/projects'
import { BUDGET_STATE_SAY, docTitle, type BudgetState } from '@/data/mock/budgetTree'
import { allBudgets } from '@/data/mock/chain'
import { TODAY } from '@/data/intake/cycle'
import { BUDGET_REQS, REQ_KIND_SAY, REQ_STATE_SAY, eventsOf, mayAct, stepOf } from '@/data/budget/store'
import { projectCode } from '@/lib/format'
import { rowCode, rowHref, isPortfolio } from '@/features/projects/list/columns'
import type { RoleKey } from '@/data/roles'
import { EHSAN_PAYS, PF_CLOSE_SAY, PF_REQ_SAY, PF_STAGE_SAY, PORTFOLIOS, externalClosingsWaiting, externalEnded, routeProposals } from '@/data/partners/store'
import { SESSIONS, appFlowOf } from '@/data/approvals/store'
import { RELOC_SAY, movingOf, relocationsWaiting } from '@/data/budget/relocate'
import { mayApprovePlan } from '@/data/plans/auth'
import { escItems } from '@/data/shared/escalation'
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
  /** 17 Oct · it came back to this seat for a change or a completion · its own lane on «اليوم» */
  returned?: boolean
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

const studying = () => fixtures.projects.filter((p) => p.statusGroup === 'قيد الدراسة')

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

const agreementsAt = (stages: string[], owner?: string, holderKey?: RoleKey): InboxQueue => ({
  key: 'agreements',
  label: 'الاتفاقيات',
  note: stages.includes('draft') ? 'صياغة ومراجعة قبل الرفع' : 'بانتظار اعتمادك',
  icon: 'contract',
  all: `${ROUTES.agreements}?stage=${stages.join(',')}`,
  items: agreements
    /* By who holds it, not the stage alone · an executive's return sits with the grants manager,
       and a signed agreement with the foundation's representative (8.2.19 · 8.4.15) */
    .filter((a) => (holderKey ? agrHolder(a) === holderKey || (holderKey === 'supervisor' && a.kind === 'ورقية' && agrHolder(a) === 'entity') : stages.includes(a.stage)) && (!owner || a.owner === owner))
    .map((a) => ({
      id: a.id, code: a.id.toUpperCase(), title: a.projectName, sub: a.entityName, amount: a.amount,
      days: d(a.hoursInStage), late: late(a.hoursInStage, AGR_LIMIT[a.stage]), limit: d(AGR_LIMIT[a.stage]), region: regionOf(a.projectId), city: cityOf(a.projectId), to: ROUTES.agreement(a.id), returned: a.stage === 'returned',
    }))
    .sort(byWait),
})

const paymentsAt = (state: 'supervisor' | 'eligible' | 'manager' | 'exec' | 'finance', owner?: string): InboxQueue => ({
  key: state === 'eligible' ? 'payments-eligible' : 'payments',
  label: state === 'eligible' ? 'مؤهلة للصرف' : 'الدفعات',
  note: state === 'supervisor' ? 'متطلبات دفعات بانتظار مراجعتك' : state === 'eligible' ? 'دفعات مؤهلة للصرف · أنشئ إذن الصرف' : state === 'finance' ? 'أوامر صرف وتحويلات بانتظارك' : 'أذونات صرف بانتظار اعتمادك قبل المالية',
  icon: 'pay',
  all: `${ROUTES.payments}?state=${state}`,
  items: payRequests
    .filter((r) => r.state === state && (!owner || r.owner === owner))
    .map((r) => ({
      id: r.id, code: r.id.toUpperCase(), title: r.projectName, sub: `${r.entityName} · الدفعة ${r.no} من ${r.of}`,
      amount: r.asked, days: d(r.hoursInState), late: late(r.hoursInState, PAY_LIMIT[r.state]), limit: d(PAY_LIMIT[r.state]), region: regionOf(r.projectId), city: cityOf(r.projectId), to: ROUTES.payment(r.id),
    }))
    /* v3 · 9.2.2 · 9.2.10 · 9.4.5 · a payment eligible from the activation has no record yet · and an
       external party's open payments wait for the authority to raise them · both are the supervisor's */
    .concat(state !== 'eligible' ? [] : payableProjects().filter((p) => p.can).flatMap((p) => scheduleOf(p.id)
      .filter((sl) => (sl.state === 'eligible' && !(sl.requestId && payRequests.some((r) => r.id === sl.requestId && r.state !== 'paid' && r.state !== 'closed'))) || (p.external && sl.state === 'open'))
      .map((sl) => ({
        id: `slot-${p.id}-${sl.no}`, code: `${p.id} · ${sl.no}`, title: p.name,
        sub: `${p.entity} · الدفعة ${sl.no} من ${sl.of} · ${sl.state === 'eligible' ? 'أنشئ إذن الصرف' : 'ارفع المتطلبات نيابةً عن الجهة الخارجية'}`,
        amount: sl.left ?? sl.amount, days: 0, late: false, limit: 0, region: regionOf(p.id), city: cityOf(p.id),
        to: `${ROUTES.paymentNew(p.id)}&pay=${sl.no}`,
      }))))
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

const closingsAt = (key: 'reports' | 'evals', stages: string[], owner?: string, note?: string): InboxQueue => ({
  key,
  label: key === 'reports' ? 'التقارير الختامية' : 'التقييمات',
  note: note ?? (key === 'reports' ? 'مقارنة المعتمد بالتنفيذ الفعلي' : 'دورة اعتماد مستقلّة عن التقرير'),
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

/** v3 · 10.2.1 · projects whose execution period ended with no closing yet · the supervisor checks and opens it */
const endedQueue = (me: string): InboxQueue => ({
  key: 'ended',
  label: 'انتهت مدة تنفيذها',
  note: 'تحقّق من اكتمال التنفيذ وافتح متطلبات الإغلاق · الحالة لا تتغيّر تلقائيًّا',
  icon: 'navClosings',
  all: ROUTES.closings,
  /* Verifier · 16 Oct · his own projects, and only those whose closing can open now (no payment in flight) */
  items: endedUnclosed().filter((p) => (!p.owner || p.owner === me) && openGate(p.id).ok).map((p) => ({
    id: `end-${p.id}`, code: p.id, title: p.name, sub: p.entityName, days: 0, late: false, limit: 0,
    region: regionOf(p.id), city: cityOf(p.id), to: ROUTES.projectTab(p.id, 'closing'),
  })),
})

/** v3 · 11.2.13 · 11.2.14 · the external projects · the supervisor's ended ones and the grants manager's closings */
const externalQueue = (role: RoleKey, me: string): InboxQueue => ({
  key: 'external',
  label: role === 'supervisor' ? 'مشاريع خارجية انتهت مدتها' : 'إغلاقات مشاريع خارجية',
  note: role === 'supervisor' ? 'اجمع متطلبات الإغلاق وإثباتات التحويل والتنفيذ وارفعها لمدير المنح' : 'اعتمد الإغلاق أو أعده للمشرف · بلا تقرير ختامي ولا تقييم',
  icon: 'navClosings',
  all: ROUTES.partnersTab('ehsan'),
  items: (role === 'supervisor' ? externalEnded().filter((p) => !p.owner || p.owner === me) : externalClosingsWaiting()).map((p) => ({
    id: `ext-${p.id}`, code: p.id, title: p.name, sub: p.platform ?? '', days: 0, late: false, limit: 0, region: regionOf(p.id), city: cityOf(p.id), to: ROUTES.project(p.id),
  })),
})

/** Verifier · 16 Oct · v3 · 10.9 · the distress decisions waiting on this seat · the supervisor's settlement included */
const casesQueue = (role: RoleKey, me: string): InboxQueue => ({
  key: 'cases',
  label: 'حالات التعثّر والتعديل',
  note: role === 'supervisor' ? 'تسوية المصروف ورفع القرار' : role === 'finance' ? 'إغلاق مباشر بانتظار التسوية المالية' : 'إيقاف أو تخفيض أو زيادة أو إغلاق مباشر بانتظار قرارك',
  icon: 'navClosings',
  all: ROUTES.distresses,
  items: CASES.filter((c) => {
    if (role === 'supervisor') {
      const mine = c.openedBy === me || projectById(c.projectId)?.owner === me
      return mine && ((c.stage === 'settle' && Boolean(c.settlement?.report) && Boolean(c.settlement?.evidence || c.settlement?.invoices)) || caseActions(c, role).length > 0)
    }
    return caseActions(c, role).length > 0
  }).map((c) => ({
    id: c.id, code: c.id, title: c.projectName, sub: `${CASE_KIND_SAY[c.kind]} · ${CASE_STAGE_SAY[c.stage]}`, days: 0, late: false, limit: 0,
    region: regionOf(c.projectId), city: cityOf(c.projectId), to: ROUTES.distress(c.id),
  })),
})

/** v3 · BPD-013 · what waits on this seat across the portfolios · the portfolio's own stage, its sub-projects,
    its payments and its closing · read from the live records, each seat its own */
const portfolioItems = (role: RoleKey): InboxQueue => {
  const items: InboxItem[] = []
  const add = (pf: (typeof PORTFOLIOS)[number], code: string, title: string, sub: string, amount?: number, anchor = '') =>
    items.push({ id: `${pf.id}-${code}-${items.length}`, code: pf.id, title, sub, amount, days: 0, late: false, limit: 0, to: `${ROUTES.portfolio(pf.id)}${anchor}` })
  const stage = { supervisor: 'supervisor', 'grants-manager': 'manager', ceo: 'ceo' } as Record<string, string>
  const reqSeat = { supervisor: ['supervisor', 'eligible'], 'grants-manager': ['manager'], ceo: ['exec'] } as Record<string, string[]>
  const subSeat = { supervisor: ['submitted', 'study'], 'grants-manager': ['pending'] } as Record<string, string[]>
  const closeSeat = { supervisor: ['supervisor', 'evalDraft'], 'grants-manager': ['manager', 'evalManager'], ceo: ['executive', 'evalExecutive'] } as Record<string, string[]>
  for (const pf of PORTFOLIOS) {
    if (pf.stage === stage[role]) add(pf, 'stage', pf.name, `اعتماد المحفظة · ${PF_STAGE_SAY[pf.stage]}`, pf.total)
    const subs = pf.items.filter((x) => (subSeat[role] ?? []).includes(x.state))
    if (subs.length) add(pf, 'subs', `${subs.length} مشروع فرعي · ${pf.name}`, role === 'supervisor' ? 'مرفوعة للدراسة والتوصية' : 'بتوصية المشرف · بانتظار قرارك', subs.reduce((n, x) => n + x.amount, 0))
    if (role === 'supervisor') { const res = pf.items.filter((x) => x.state === 'closing' && x.ready); if (res.length) add(pf, 'res', `${res.length} نتائج للاعتماد · ${pf.name}`, 'طلب الشريك اعتماد النتائج') }
    for (const q of pf.requests.filter((x) => (reqSeat[role] ?? []).includes(x.state))) add(pf, q.id, `الدفعة ${q.no} · ${pf.name}`, PF_REQ_SAY[q.state], q.amount)
    if ((closeSeat[role] ?? []).includes(pf.close.stage ?? '')) add(pf, 'close', pf.name, PF_CLOSE_SAY[pf.close.stage!])
  }
  return { key: 'portfolios', label: 'المحافظ', note: 'الاعتماد والمشاريع الفرعية والدفعات والإغلاق · ما ينتظرك أنت', icon: 'grid', all: ROUTES.partnersTab('portfolios'), items }
}
/** v3 · 11.2.4 · the routing proposals waiting on the executive */
const routeQueue = (): InboxQueue => ({
  key: 'routes', label: 'اقتراحات التوجيه عبر جهة خارجية', note: 'اقترحها مشرف المنح في الدراسة · أقرّها أو ارفضها', icon: 'grid', all: ROUTES.partnersTab('ehsan'),
  items: routeProposals().map((x) => ({ id: `rt-${x.project.id}`, code: x.project.id, title: x.project.name, sub: x.platform ? `عبر ${x.partyName ?? 'جهة خارجية'}` : 'دعم مباشر', days: 0, late: false, limit: 0, to: ROUTES.project(x.project.id) })),
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

/* Budgets and budget operation requests at this role's step (1.2.8–1.2.11 · 1.3.6–1.3.9) */
const budgets = (role: RoleKey): InboxQueue => {
  /* A draft isn't waiting on anyone · a returned one waits on whoever prepares */
  const mine = (st: string) => {
    const step = stepOf(st as BudgetState)
    if (!step) return false
    return step === 'prepare' ? st === 'returned' && mayAct('prepare', role) : mayAct(step, role)
  }
  const docs = allBudgets.filter((b) => mine(b.state))
  const reqs = BUDGET_REQS.filter((r) => mine(r.state))
  const ago = (at?: string) => (at ? Math.max(0, Math.round((Date.parse(`${TODAY}T12:00:00Z`) - Date.parse(at)) / 86_400_000)) : 0)
  return {
    key: 'budgets',
    label: 'الميزانية',
    note: 'ميزانيات وطلبات عمليات عند خطوتك',
    icon: 'budget',
    all: ROUTES.budgetOps,
    items: [
      ...docs.map((b) => ({
        id: b.id, code: b.id, title: docTitle(b), sub: BUDGET_STATE_SAY[b.state], amount: b.total,
        days: ago(eventsOf(b.id)[0]?.at), late: false, limit: 0, to: ROUTES.budgetDoc(b.id), returned: b.state === 'returned',
      })),
      ...reqs.map((r) => ({
        id: r.id, code: r.id, title: `${REQ_KIND_SAY[r.kind]} · ${docTitle(allBudgets.find((d) => d.id === r.docId)!)}`,
        sub: REQ_STATE_SAY[r.state], amount: r.amount,
        days: ago(r.events[0]?.at), late: false, limit: 0, to: ROUTES.budgetOp(r.id), returned: r.state === 'returned',
      })),
    ],
  }
}

/* v3 · 1.3b · relocation requests at this role's step · 6.4.3 · bodies' decisions waiting for their cover */
const relocations = (role: RoleKey): InboxQueue => ({
  key: 'relocations', label: 'طلبات إعادة التسكين', note: role === 'ceo' ? 'تنتظر اعتمادك · تُنفَّذ تلقائيًا عند الاعتماد' : 'أُعيدت إليك للتعديل', icon: 'budget', all: ROUTES.budgetOps,
  items: relocationsWaiting(role).map((r) => ({
    id: r.id, code: r.id, title: r.projectName, sub: RELOC_SAY[r.state], amount: movingOf(r.from, r.scope),
    days: 0, late: false, limit: 0, region: regionOf(r.projectId), to: ROUTES.projectTab(r.projectId, 'approval'), returned: role !== 'ceo',
  })),
})
const uncovered = (): InboxQueue => ({
  key: 'uncovered', label: 'قرارات بانتظار التغطية المالية', note: 'صدر القرار ولم ينفذ ماليًا · يُعالج الرصيد بمناقلة أو تعزيز ثم ينفّذه المدير التنفيذي أو مدير المنح', icon: 'budget', all: `${ROUTES.projects}?status=قيد الدراسة`,
  items: fixtures.projects.filter((p) => { const c = appFlowOf(p.id).coverage; return c && !c.done }).map((p) => ({ ...fromProject(p), to: ROUTES.projectTab(p.id, 'approval') })),
})

/* ── Per role, in the client's order ── */

export function inboxFor(role: RoleKey, me: string): InboxQueue[] {
  const single = studying().filter((p) => !isPortfolio(p))

  if (role === 'supervisor') {
    return [
      projectsQueue('study', 'مشاريع للدراسة', 'مسندة إليك وتنتظر توصيتك',
        single.filter((p) => p.owner === me && holderOf(p) === 'supervisor'), `${ROUTES.projects}?tab=mine`),
      /* Client 18 Oct · decision 11 · the path is complete · the supervisor confirms the notes and
         conditions before the project reads «معتمد» */
      projectsQueue('confirm', 'اعتماد ينتظر تأكيدك', 'اكتمل مسار القرار · تحقّق من الملاحظات والشروط ثم أكّد',
        single.filter((p) => p.owner === me && holderOf(p) === 'confirm'), `${ROUTES.projects}?tab=mine`),
      /* v3 · 0.status.3 · approved after the confirmation · the supervisor's next step is the agreement */
      projectsQueue('approved', 'معتمدة تنتظر الاتفاقية', 'صدر الاعتماد · أعدّ الاتفاقية وانقل الشروط إليها',
        single.filter((p) => p.owner === me && p.statusGroup === 'معتمد'), `${ROUTES.projects}?status=معتمد`),
      portfolioItems(role),
      agreementsAt(['draft', 'returned'], undefined, 'supervisor'),
      paymentsAt('supervisor'),
      paymentsAt('eligible'),
      plansAt('supervisor'),
      activities(),
      closingsAt('reports', ['supervisor']),
      closingsAt('evals', ['reportDone', 'evalDraft']),
      endedQueue(me),
      externalQueue(role, me),
      casesQueue(role, me),
      budgets(role),
    ]
  }

  if (role === 'grants-manager') {
    return [
      /* B-5 · what sits at his seat now · he approves within his cap and sends the rest up */
      projectsQueue('approve', 'مشاريع للاعتماد', 'عندك الآن · تعتمد ما في حدّك وترفع ما فوقه',
        single.filter((p) => holderOf(p) === 'manager'), `${ROUTES.projects}?status=قيد الدراسة&sort=amount`),
      projectsQueue('committee-sec', 'قرارات اللجنة للتسجيل', 'عند اللجنة التنفيذية · تسجّلها أمينًا للجنة في جلستها',
        single.filter((p) => holderOf(p) === 'committee'), ROUTES.committee),
      portfolioItems(role),
      agreementsAt(['manager', 'returned'], undefined, 'grants-manager'),
      paymentsAt('manager'),
      plansAt('manager'),
      closingsAt('reports', ['manager']),
      closingsAt('evals', ['evalManager']),
      casesQueue(role, me),
      externalQueue(role, me),
      transfers('manager'),
      budgets(role),
      uncovered(),
    ]
  }

  /* Re-audit 7 Oct · the seats that had none */
  if (role === 'finance') {
    const t = Date.parse(`${TODAY}T12:00:00Z`)
    return [
      paymentsAt('finance'),
      budgets(role),
      relocations(role),
      uncovered(),
      /* Client sheet 24 Oct (#27) · the direct closings waiting on finance's settlement */
      casesQueue(role, me),
      {
        key: 'ehsan', label: 'عمليات منصات الجهات الخارجية', note: 'راجع مستنداتها وأكّد حالتها', icon: 'pay', all: ROUTES.partnersTab('finance'),
        items: EHSAN_PAYS.filter((x) => x.state === 'review').map((x) => ({
          id: x.id, code: x.ref, title: `دفعة ${x.ref}`, sub: 'نفّذتها منصة الجهة الخارجية', amount: x.amount,
          days: Math.max(0, Math.round((t - Date.parse(x.at)) / 864e5)), late: false, limit: 3, to: ROUTES.partnersTab('finance'),
        })),
      },
      {
        key: 'pfreq', label: 'طلبات صرف المحافظ', note: 'على مستوى المحفظة وفق جدولها', icon: 'grid', all: ROUTES.partnersTab('finance'),
        items: PORTFOLIOS.flatMap((pf) => pf.requests.filter((r) => r.state === 'finance' || r.state === 'order').map((r) => ({
          id: `${pf.id}-${r.id}`, code: pf.id, title: `الدفعة ${r.no} · ${pf.name}`, sub: 'طلب صرف محفظة', amount: r.amount,
          days: Math.max(0, Math.round((t - Date.parse(r.at)) / 864e5)), late: false, limit: 3, to: ROUTES.partnersTab('finance'),
        }))),
      },
    ]
  }
  if (role === 'comms') {
    return [closingsAt('reports', ['comms'], undefined, 'متطلبات النشر الإعلامي في التقرير الختامي')]
  }
  if (role === 'member') {
    /* The projects on the agenda of a planned session he sits on · read before the meeting (6.2.3 · 7.2.3) */
    const onAgenda = SESSIONS.filter((x) => x.state === 'planned' && x.members.includes(me))
    return onAgenda.map((x) => ({
      key: `session-${x.id}`, label: x.title, note: `${x.body === 'committee' ? 'اللجنة التنفيذية' : 'مجلس الأمناء'} · اطّلع على ملفات جدول الأعمال قبل الاجتماع`, icon: 'checks' as const,
      all: `/approvals/sessions/${x.id}`,
      items: x.items.flatMap((it) => {
        const p = fixtures.projects.find((y) => y.id === it.projectId)
        return p ? [{ ...fromProject(p), to: `/approvals/sessions/${x.id}`, sub: it.outcome ? `قُرّر · ${p.entityName}` : `على جدول الأعمال · ${p.entityName}` }] : []
      }),
    }))
  }
  if (role === 'admin') {
    return [{
      key: 'stalled', label: 'المتعثر في كل الإجراءات', note: 'من آلية التصعيد · راجع المدد والمستلمين', icon: 'insight',
      all: `${ROUTES.escalation}?heat=stuck`,
      items: escItems().filter((x) => x.heat === 'stuck').slice(0, 40).map((x) => ({
        id: x.id, code: x.stage, title: x.title, sub: x.sub, days: x.over, late: true, limit: 0, to: x.href,
      })),
    }]
  }

  return [
    /* 5.2.1 · what the grants manager forwarded with his recommendation */
    projectsQueue('ceo', 'محالة من مدير المنح', 'بتوصيته · تعتمد ما في حدّك وتحيل ما فوقه للجنة',
      single.filter((p) => holderOf(p) === 'exec'),
      `${ROUTES.projects}?status=قيد الدراسة&sort=amount`),
    projectsQueue('committee', 'عند اللجنة التنفيذية', 'تُعرض في جلستها القادمة',
      single.filter((p) => holderOf(p) === 'committee'), ROUTES.committee),
    projectsQueue('board', 'عند مجلس الأمناء', 'يسجّل قراره المدير التنفيذي في جلسته',
      single.filter((p) => holderOf(p) === 'board'), ROUTES.board),
    agreementsAt(['executive', 'entity'], undefined, 'ceo'),
    /* v3 · 12.2.11 · plans reach the executive only by a delegation in force */
    ...(mayApprovePlan('ceo') ? [plansAt('manager')] : []),
    paymentsAt('exec'),
    portfolioItems(role),
    routeQueue(),
    closingsAt('reports', ['executive']),
    closingsAt('evals', ['evalExecutive']),
    casesQueue(role, me),
    budgets(role),
    transfers('executive'),
    relocations(role),
    uncovered(),
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
