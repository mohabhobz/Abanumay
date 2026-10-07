import { ROUTES } from '@/app/routes'
import { projectRows } from '@/data/mock/projects'
import { STAGES, stageMeta } from '@/data/mock/taxonomy'
import { agreements, AGR_LIMIT, AGREEMENT_STAGES, agrStageLabel } from '@/data/mock/agreements'
import { payRequests, PAY_LIMIT, PAY_STATES, payStateLabel, payStateWho } from '@/data/mock/disbursements'
import { closeRows, CLOSE_LIMIT, CLOSE_STAGES, closeStageLabel } from '@/data/mock/closing'
import { planRows, PLAN_LIMIT, PLAN_STAGES, planStageLabel } from '@/data/mock/plans'
import { regRows, REG_STATE_SAY } from '@/data/mock/registration'
import { allBudgets } from '@/data/mock/chain'
import { UPD_ROWS } from '@/data/entities/store'
import { BUDGET_REQS, REQ_KIND_SAY, eventsOf } from '@/data/budget/store'
import { EHSAN_PAYS, PORTFOLIOS, PF_STAGE_SAY, PROFILES } from '@/data/partners/store'
import { HOLDER_LABEL, type Holder } from '@/data/holders'
import { isStuck } from '@/data/plans/store'
import {
  ESC_LIMITS, ESC_RULES, heatOf, procLabel, RECIPIENT_SAY, type EscChannel, type EscProc, type EscRecipient, type Heat,
} from './escRules'

/* What is late across the modules · the escalation mechanism's one list (cross · «التصعيد»).

   Each module already knows how long a record has sat in its stage; this file reads them all into
   one shape (procedure, stage, since when, how far over, who holds it) so the late report, the
   alerts and the bell read the same rows. A row leaves the list the moment its stage changes,
   because every module resets its clock on a move · that is «حتى اتخاذ الإجراء». */

export interface EscStage { key: string; label: string; who: string; hours: number; set: (h: number) => void }

const H = 3_600_000
const nowMs = () => Date.now()
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const hoursSince = (at: string | undefined): number => {
  const t = at ? Date.parse(at) : NaN
  return Number.isFinite(t) ? Math.max(0, (nowMs() - t) / H) : 0
}

/* ── The stages of every procedure · the settings page edits these in place ── */

const limited = <K extends string>(proc: EscProc, rows: { key: K; label: string; who: string }[], table: Record<K, number>): EscStage[] =>
  rows.filter((s) => (table[s.key] ?? 0) > 0).map((s) => ({
    key: `${proc}.${s.key}`, label: s.label, who: s.who, hours: table[s.key], set: (h: number) => { table[s.key] = h },
  }))
const own = (key: string, label: string, who: string): EscStage => ({
  key, label, who, hours: ESC_LIMITS[key] ?? 0, set: (h: number) => { ESC_LIMITS[key] = h },
})
const study = (stage: string, label: string, who: string): EscStage => {
  const m = stageMeta(stage)
  return {
    key: `study.${stage}`, label, who, hours: m?.limit ?? 0,
    set: (h: number) => {
      const s = STAGES.find((x) => x.stage === stage)
      if (s) s.limit = h
      for (const p of projectRows) if (p.stage === stage) p.stageLimit = h
    },
  }
}

export function escStages(proc: EscProc): EscStage[] {
  switch (proc) {
    case 'budget': return [
      own('budget.submitted', 'لدى مدير المنح', 'مدير المنح'),
      own('budget.finance', 'لدى الإدارة المالية', 'الإدارة المالية'),
      own('budget.exec', 'لدى المدير التنفيذي', 'المدير التنفيذي'),
    ]
    case 'registration': return [
      own('registration.review', 'طلب تسجيل قيد المراجعة', 'مسؤول التسجيل'),
      own('registration.completion', 'طلب تسجيل معاد للاستكمال', 'الجهة'),
      own('registration.update', 'طلب تحديث بيانات قيد المراجعة', 'مدير المنح'),
    ]
    case 'study': return [
      study('دراسة المشروع', 'دراسة مشرف المنح', 'مشرف المنح'),
      study('استكمال بيانات المشروع', 'استكمال الجهة', 'الجهة'),
    ]
    case 'approval': return (['manager', 'exec', 'committee', 'board', 'confirm'] as const).map((h) =>
      own(`approval.${h}`, h === 'confirm' ? 'تأكيد الاعتماد' : `لدى ${HOLDER_LABEL[h]}`, HOLDER_LABEL[h]))
    case 'agreement': return limited('agreement', AGREEMENT_STAGES, AGR_LIMIT)
    case 'payment': return limited('payment', PAY_STATES, PAY_LIMIT)
    case 'closing': return limited('closing', CLOSE_STAGES, CLOSE_LIMIT)
    case 'plan': return limited('plan', PLAN_STAGES, PLAN_LIMIT)
    case 'ehsan': return [own('ehsan.review', 'دفعة بانتظار المراجعة المالية', 'الإدارة المالية')]
    case 'portfolio': return [
      own('portfolio.supervisor', 'دراسة مشرف المنح', 'مشرف المنح'),
      own('portfolio.manager', 'لدى مدير المنح', 'مدير المنح'),
      own('portfolio.ceo', 'لدى الرئيس التنفيذي', 'المدير التنفيذي'),
      own('portfolio.committee', 'عند اللجنة التنفيذية', 'اللجنة التنفيذية'),
      own('portfolio.board', 'عند مجلس الأمناء', 'مجلس الأمناء'),
      own('portfolio.returned', 'معادة للشريك', 'الشريك'),
      own('portfolio.subs', 'مشاريع فرعية بانتظار الاعتماد', 'مدير المنح'),
      own('portfolio.finance', 'طلب صرف لدى المالية', 'الإدارة المالية'),
    ]
  }
}

/* ── The rows ── */

export interface EscItem {
  id: string
  proc: EscProc
  stageKey: string
  stage: string
  title: string
  sub: string
  href: string
  /** Who holds the stage now · a person, a desk's title or the entity's name */
  owner: string
  entity?: string
  hours: number
  limit: number
  heat: Heat
  /** The day the stage's limit passed */
  lateFrom: string
  /** The day it stalled · past the limit and the margin */
  stuckFrom?: string
  /** Days past the limit */
  over: number
}

function make(x: Omit<EscItem, 'heat' | 'lateFrom' | 'stuckFrom' | 'over'>): EscItem | null {
  const heat = heatOf(x.hours, x.limit, x.proc)
  if (heat === 'ok') return null
  const t = nowMs()
  const extra = ESC_RULES.stuck[x.proc]
  const margin = extra === null || extra === undefined ? x.limit : extra * 24
  return {
    ...x, heat,
    lateFrom: isoDay(t - (x.hours - x.limit) * H),
    stuckFrom: heat === 'stuck' ? isoDay(t - (x.hours - x.limit - margin) * H) : undefined,
    over: Math.max(1, Math.round((x.hours - x.limit) / 24)),
  }
}

const lastAt = (list: { at: string }[] | undefined): string | undefined =>
  list?.length ? list.map((e) => e.at).sort().at(-1) : undefined

function collect(proc: EscProc): EscItem[] {
  const out: (EscItem | null)[] = []
  switch (proc) {
    case 'budget': {
      for (const d of allBudgets) {
        if (!['submitted', 'finance', 'exec'].includes(d.state)) continue
        const k = `budget.${d.state}`
        out.push(make({
          id: `esc-bd-${d.id}`, proc, stageKey: k, stage: escLabel(k), title: d.name ?? `ميزانية ${d.yearId}`, sub: d.id,
          href: ROUTES.budgetDoc(d.id), owner: escWho(k), hours: hoursSince(lastAt(eventsOf(d.id))), limit: ESC_LIMITS[k] ?? 0,
        }))
      }
      for (const r of BUDGET_REQS) {
        if (!['submitted', 'finance', 'exec'].includes(r.state)) continue
        const k = `budget.${r.state}`
        out.push(make({
          id: `esc-br-${r.id}`, proc, stageKey: k, stage: escLabel(k), title: `${REQ_KIND_SAY[r.kind]} · ${r.id}`, sub: r.reason,
          href: ROUTES.budgetOp(r.id), owner: escWho(k), hours: hoursSince(lastAt(r.events) ?? r.submittedAt), limit: ESC_LIMITS[k] ?? 0,
        }))
      }
      break
    }
    case 'registration': {
      for (const r of regRows) {
        if (r.state !== 'review' && r.state !== 'completion') continue
        const k = r.state === 'review' ? 'registration.review' : 'registration.completion'
        out.push(make({
          id: `esc-rg-${r.id}`, proc, stageKey: k, stage: REG_STATE_SAY[r.state], title: `طلب تسجيل · ${r.name}`, sub: `${r.type} · ${r.city}`,
          href: ROUTES.entityRequest(r.id), owner: r.state === 'completion' ? r.name : escWho(k), entity: r.name,
          hours: hoursSince(lastAt(r.events) ?? r.submittedAt), limit: ESC_LIMITS[k] ?? 0,
        }))
      }
      for (const u of UPD_ROWS) {
        if (u.state !== 'review') continue
        out.push(make({
          id: `esc-up-${u.id}`, proc, stageKey: 'registration.update', stage: escLabel('registration.update'), title: `تحديث بيانات · ${u.entityName}`, sub: u.id,
          href: ROUTES.entityUpdateReview(u.id), owner: escWho('registration.update'), entity: u.entityName,
          hours: hoursSince(lastAt(u.events) ?? u.submittedAt), limit: ESC_LIMITS['registration.update'] ?? 0,
        }))
      }
      break
    }
    case 'study': {
      for (const p of projectRows) {
        const seat = p.stage === 'دراسة المشروع' && (!p.holder || p.holder === 'supervisor')
        if (!seat && p.stage !== 'استكمال بيانات المشروع') continue
        const k = `study.${p.stage}`
        out.push(make({
          id: `esc-st-${p.id}`, proc, stageKey: k, stage: p.stage, title: p.name, sub: p.entityName, href: ROUTES.project(p.id),
          owner: p.stage === 'استكمال بيانات المشروع' ? p.entityName : p.owner ?? 'مدير المنح', entity: p.entityName,
          hours: p.hoursInStage, limit: stageMeta(p.stage)?.limit ?? 0,
        }))
      }
      break
    }
    case 'approval': {
      for (const p of projectRows) {
        if (p.stage !== 'دراسة المشروع' || !p.holder || p.holder === 'supervisor') continue
        const h = p.holder as Holder
        const k = `approval.${h}`
        out.push(make({
          id: `esc-ap-${p.id}`, proc, stageKey: k, stage: escLabel(k), title: p.name, sub: p.entityName, href: ROUTES.projectTab(p.id, 'approval'),
          owner: h === 'confirm' ? p.owner ?? 'مشرف المنح' : HOLDER_LABEL[h], entity: p.entityName, hours: p.hoursInStage, limit: ESC_LIMITS[k] ?? 0,
        }))
      }
      break
    }
    case 'agreement': {
      for (const a of agreements) {
        const k = `agreement.${a.stage}`
        out.push(make({
          id: `esc-ag-${a.id}`, proc, stageKey: k, stage: agrStageLabel(a.stage), title: a.projectName, sub: `${a.id} · ${a.entityName}`,
          href: ROUTES.agreement(a.id), owner: a.stage === 'entity' ? a.entityName : a.stage === 'draft' || a.stage === 'returned' ? a.owner : AGREEMENT_STAGES.find((s) => s.key === a.stage)?.who ?? a.owner,
          entity: a.entityName, hours: a.hoursInStage, limit: AGR_LIMIT[a.stage] ?? 0,
        }))
      }
      break
    }
    case 'payment': {
      for (const r of payRequests) {
        const k = `payment.${r.state}`
        out.push(make({
          id: `esc-py-${r.id}`, proc, stageKey: k, stage: payStateLabel(r.state), title: `الدفعة ${r.no} من ${r.of} · ${r.projectName}`, sub: r.entityName,
          href: ROUTES.payment(r.id), owner: r.state === 'returned' ? r.entityName : r.state === 'supervisor' ? r.owner : payStateWho(r.state) || r.owner,
          entity: r.entityName, hours: r.hoursInState, limit: PAY_LIMIT[r.state] ?? 0,
        }))
      }
      break
    }
    case 'closing': {
      for (const c of closeRows) {
        const k = `closing.${c.stage}`
        const who = CLOSE_STAGES.find((s) => s.key === c.stage)?.who ?? ''
        out.push(make({
          id: `esc-cl-${c.id}`, proc, stageKey: k, stage: closeStageLabel(c.stage), title: c.projectName, sub: c.entityName,
          href: ROUTES.closing(c.id), owner: c.stage === 'draft' ? c.entityName : who === 'مشرف المنح' ? c.owner : who || c.owner,
          entity: c.entityName, hours: c.hoursInStage, limit: CLOSE_LIMIT[c.stage] ?? 0,
        }))
      }
      break
    }
    case 'plan': {
      for (const p of planRows) {
        const k = `plan.${p.stage}`
        out.push(make({
          id: `esc-pl-${p.id}`, proc, stageKey: k, stage: planStageLabel(p.stage), title: p.projectName, sub: p.entityName,
          href: ROUTES.plan(p.id), owner: p.stage === 'draft' || p.stage === 'returned' ? p.entityName : p.stage === 'manager' ? 'مدير المنح' : p.owner,
          entity: p.entityName, hours: p.hoursInStage, limit: PLAN_LIMIT[p.stage] ?? 0,
        }))
        /* An activity past its end · late from its date, stalled by the plan's own rule (12.4.25) */
        if (p.stage !== 'active') continue
        for (const a of p.phases.flatMap((ph) => ph.activities)) {
          if (a.state === 'accepted' || !a.to || Date.parse(a.to) >= nowMs()) continue
          const over = (nowMs() - Date.parse(a.to)) / H
          const stuck = isStuck(a, isoDay(nowMs()))
          const t = nowMs()
          const marginDays = ESC_RULES.stuck.plan ?? 30
          out.push({
            id: `esc-pa-${p.id}-${a.id}`, proc, stageKey: 'plan.activity', stage: 'نشاط تجاوز تاريخ نهايته', title: a.name, sub: p.projectName,
            href: ROUTES.plan(p.id), owner: a.state === 'claimed' ? p.owner : p.entityName, entity: p.entityName,
            hours: over, limit: 0, heat: stuck ? 'stuck' : 'late', lateFrom: a.to,
            stuckFrom: stuck ? isoDay(Math.min(t, Date.parse(a.to) + marginDays * 24 * H)) : undefined,
            over: Math.max(1, Math.round(over / 24)),
          })
        }
      }
      break
    }
    case 'ehsan': {
      for (const x of EHSAN_PAYS) {
        if (x.state !== 'review') continue
        const pf = x.target.kind !== 'project' ? PORTFOLIOS.find((f) => f.id === (x.target as { pfId: string }).pfId) : undefined
        const pid = x.target.kind === 'project' ? x.target.projectId : undefined
        const name = pid ? projectRows.find((p) => p.id === pid)?.name ?? pid : pf?.name ?? ''
        out.push(make({
          id: `esc-eh-${x.id}`, proc, stageKey: 'ehsan.review', stage: escLabel('ehsan.review'), title: `دفعة ${x.ref} · ${name}`, sub: 'نفّذتها منصة إحسان',
          href: `${ROUTES.partners}?tab=finance`, owner: escWho('ehsan.review'), hours: hoursSince(x.at), limit: ESC_LIMITS['ehsan.review'] ?? 0,
        }))
      }
      break
    }
    case 'portfolio': {
      for (const pf of PORTFOLIOS) {
        const partner = PROFILES.find((p) => p.entityId === pf.entityId)?.name ?? ''
        const since = lastAt(pf.log) ?? pf.openedAt
        if (['supervisor', 'manager', 'ceo', 'committee', 'board', 'returned'].includes(pf.stage)) {
          const k = `portfolio.${pf.stage}`
          out.push(make({
            id: `esc-pf-${pf.id}`, proc, stageKey: k, stage: PF_STAGE_SAY[pf.stage], title: pf.name, sub: partner, href: ROUTES.portfolio(pf.id),
            owner: pf.stage === 'supervisor' ? pf.owner : pf.stage === 'returned' ? partner : escWho(k), entity: partner, hours: hoursSince(since), limit: ESC_LIMITS[k] ?? 0,
          }))
        }
        const pending = pf.items.filter((s) => s.state === 'pending')
        if (pending.length) {
          out.push(make({
            id: `esc-ps-${pf.id}`, proc, stageKey: 'portfolio.subs', stage: escLabel('portfolio.subs'), title: `${pending.length} مشاريع فرعية · ${pf.name}`, sub: partner,
            href: ROUTES.portfolio(pf.id), owner: escWho('portfolio.subs'), entity: partner,
            hours: hoursSince(pending.map((s) => s.addedAt).sort().at(-1)), limit: ESC_LIMITS['portfolio.subs'] ?? 0,
          }))
        }
        for (const r of pf.requests.filter((x) => x.state === 'finance')) {
          out.push(make({
            id: `esc-pr-${pf.id}-${r.id}`, proc, stageKey: 'portfolio.finance', stage: escLabel('portfolio.finance'), title: `الدفعة ${r.no} · ${pf.name}`, sub: partner,
            href: ROUTES.portfolio(pf.id), owner: escWho('portfolio.finance'), entity: partner, hours: hoursSince(r.at), limit: ESC_LIMITS['portfolio.finance'] ?? 0,
          }))
        }
      }
      break
    }
  }
  return out.filter((x): x is EscItem => x !== null)
}

const labelCache = new Map<string, { label: string; who: string }>()
function stageInfo(k: string) {
  if (!labelCache.size) {
    for (const p of ['budget', 'registration', 'approval', 'ehsan', 'portfolio'] as EscProc[]) for (const s of escStages(p)) labelCache.set(s.key, s)
  }
  return labelCache.get(k)
}
const escLabel = (k: string) => stageInfo(k)?.label ?? k
const escWho = (k: string) => stageInfo(k)?.who ?? ''

/** Every late or stalled record, worst first */
export function escItems(proc?: EscProc): EscItem[] {
  const procs: EscProc[] = proc ? [proc] : ['budget', 'registration', 'study', 'approval', 'agreement', 'payment', 'closing', 'plan', 'ehsan', 'portfolio']
  return procs.flatMap(collect).sort((a, b) => (a.heat === b.heat ? b.over - a.over : a.heat === 'stuck' ? -1 : 1))
}

export function escCounts(): Record<EscProc, { late: number; stuck: number }> {
  const out = {} as Record<EscProc, { late: number; stuck: number }>
  for (const it of escItems()) {
    const c = (out[it.proc] ??= { late: 0, stuck: 0 })
    if (it.heat === 'stuck') c.stuck++
    else c.late++
  }
  return out
}

/* ── Alerts · once on the late day, then daily while stalled ── */

export interface EscAlert {
  id: string
  item: EscItem
  level: 'late' | 'stalled'
  /** The day it went out */
  at: string
  /** The stall's day count on that alert · 1 on the first daily alert */
  day?: number
  to: string[]
  channels: EscChannel[]
}

const resolve = (r: EscRecipient, it: EscItem): string | undefined =>
  r === 'owner' ? it.owner : r === 'entity' ? it.entity : r === 'manager' ? 'مدير المنح' : r === 'ceo' ? 'المدير التنفيذي' : RECIPIENT_SAY.admin

const recipients = (list: EscRecipient[], it: EscItem): string[] =>
  [...new Set(list.map((r) => resolve(r, it)).filter((x): x is string => Boolean(x)))]

/** The alerts the rules sent · the daily ones are kept for the last `days` days of each stall */
export function escAlerts(days = 14): EscAlert[] {
  const out: EscAlert[] = []
  const today = isoDay(nowMs())
  for (const it of escItems()) {
    out.push({ id: `${it.id}-late`, item: it, level: 'late', at: it.lateFrom, to: recipients(ESC_RULES.late.to, it), channels: ESC_RULES.late.channels })
    if (it.heat !== 'stuck' || !it.stuckFrom) continue
    const first = Date.parse(it.stuckFrom)
    const total = Math.max(1, Math.round((Date.parse(today) - first) / (24 * H)) + 1)
    for (let n = Math.max(1, total - days + 1); n <= total; n++) {
      out.push({
        id: `${it.id}-d${n}`, item: it, level: 'stalled', at: isoDay(first + (n - 1) * 24 * H), day: n,
        to: recipients(ESC_RULES.stalled.to, it), channels: ESC_RULES.stalled.channels,
      })
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** Today's view · one late alert per record plus the latest daily alert of each stall */
export function escAlertsFor(name: string, role: string): EscAlert[] {
  const seen = new Set<string>()
  return escAlerts(1).filter((a) => {
    if (!a.channels.includes('app') || !(a.to.includes(name) || a.to.includes(role))) return false
    const k = `${a.item.id}-${a.level}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const escProcSay = procLabel
