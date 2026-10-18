/* 17 Oct · «اليوم» · the page answers «what do I do now?», not «how is the foundation?».

   Everything here is the signed-in person's own work and nothing else (client, 17 Oct: each role
   sees what is its own · nothing of anybody else's). It reads the same role queues the module lists
   show (`inbox.ts`), so a count here is the count behind each module's own list, and turns them into:

     · one next step · the most pressing item, with one action
     · four lanes · due today (late or its limit ends today) · returned to me · waiting on me · coming
     · progress · what I did today and this week, from the audit log under my own name, and what
       moved forward after my step (a project approved after my recommendation, a payment paid after
       my permit, a project closed)

   The order (client, 17 Oct): late first, the most overdue first · then the nearest to the end of
   its limit (the limits are the escalation rules') · then the larger amount. */

import { ROUTES } from '@/app/routes'
import type { RoleKey } from '@/data/roles'
import { inboxFor, type InboxItem, type InboxQueue } from './inbox'
import { auditRows, type AuditRow } from '@/data/shared/audit'
import { payRequests } from '@/data/mock/disbursements'
import { actOnPay, payActions, payStops, type PayAction } from '@/data/payments/store'
import { projectRows } from '@/data/mock/projects'
import { closeRows } from '@/data/mock/closing'
import { SESSIONS } from '@/data/approvals/store'
import { liveDay, TODAY } from '@/data/clock'
import { payableProjects, scheduleOf } from '@/data/payments/store'
import { projectById } from '@/data/mock/projects'

export type Lane = 'due' | 'returned' | 'waiting' | 'coming'
export const LANE_SAY: Record<Lane, string> = {
  due: 'مستحق اليوم',
  returned: 'أُعيد إليك',
  waiting: 'بانتظارك',
  coming: 'قادم',
}
export const LANE_NOTE: Record<Lane, string> = {
  due: 'تجاوز مدته أو تنتهي مدته اليوم',
  returned: 'رجع إليك للتعديل أو الاستكمال',
  waiting: 'في محطتك وضمن مدته',
  coming: 'يصلك أو يحين موعده قريبًا',
}

export interface QuickAct { label: string; run: () => string[] }

export interface TodayItem extends InboxItem {
  queue: string
  queueKey: string
  icon: InboxQueue['icon']
  lane: Lane
  /** Days left on its limit · negative when over · null when the stage has none */
  left: number | null
  /** One sentence on why it's where it is */
  why: string
  /** A confirmation that needs no file and no reading · runs from the card (client, 17 Oct) */
  quick?: QuickAct
  /** A date the «why» points at · drawn with <DateText> */
  date?: string
}

const RETURNED = /أُعيد|مُعاد|معادة|returned/

function laneOf(i: InboxItem): Lane {
  const left = i.limit > 0 ? i.limit - i.days : null
  if (i.late || (left !== null && left <= 0)) return 'due'
  if (i.returned || RETURNED.test(i.sub)) return 'returned'
  return 'waiting'
}

const dayWord = (n: number) => (n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? `${n} أيام` : `${n} يومًا`)

function whyOf(i: InboxItem, lane: Lane, left: number | null): string {
  if (lane === 'due') return left !== null && left < 0 ? `متأخر ${dayWord(-left)} عن مدته` : left === 0 ? 'تنتهي مدته اليوم' : 'تجاوز مدته'
  if (lane === 'returned') return 'رجع إليك · أكمله وأعد إرساله'
  if (left !== null) return `يتبقى ${dayWord(left)} على مدته`
  return i.days > 0 ? `ينتظرك منذ ${dayWord(i.days)}` : 'وصلك ويحتاج إجراءك'
}

/* The one kind of step the card runs itself: a forward confirmation on a payment at this seat ·
   no file, no amount, no note, no stop · the rest open their record */
function quickOf(i: InboxItem, role: RoleKey, me: string): QuickAct | undefined {
  const r = payRequests.find((x) => x.id === i.id)
  if (!r) return undefined
  const a = payActions(r, role).find((x: PayAction) => x.kind === 'btn-p' && !x.needsFile && !x.needsAmount && !x.needsNote)
  if (!a || payStops(r, a.act).length) return undefined
  return { label: a.label, run: () => actOnPay(r.id, a.act, '', me, role) }
}

/** Ordered: late first (most overdue first), then nearest to its limit, then the larger amount */
export function byPressure(a: TodayItem, b: TodayItem): number {
  const la = a.lane === 'due' ? 0 : 1
  const lb = b.lane === 'due' ? 0 : 1
  if (la !== lb) return la - lb
  const ra = a.left ?? Number.POSITIVE_INFINITY
  const rb = b.left ?? Number.POSITIVE_INFINITY
  if (ra !== rb) return ra - rb
  if ((b.amount ?? 0) !== (a.amount ?? 0)) return (b.amount ?? 0) - (a.amount ?? 0)
  return b.days - a.days
}

/* «قادم» · what reaches this seat soon · sessions it sits in, and the supervisor's scheduled
   payments whose date comes within two weeks (the entity raises them, then they come to him) */
function comingFor(role: RoleKey, me: string): TodayItem[] {
  const out: TodayItem[] = []
  const day = TODAY
  const in14 = new Date(Date.parse(`${day}T12:00:00Z`) + 14 * 864e5).toISOString().slice(0, 10)
  for (const s of SESSIONS.filter((x) => x.state === 'planned' && x.date >= day)) {
    const mine = role === 'member' ? false /* his sessions are his work queue already */
      : role === 'grants-manager' ? s.body === 'committee'
      : role === 'ceo' ? s.body === 'board' || s.members.includes(me)
      : false
    if (!mine) continue
    out.push(base({
      id: `ses-${s.id}`, code: s.id, title: s.title, sub: `${s.body === 'committee' ? 'اللجنة التنفيذية' : 'مجلس الأمناء'} · ${s.items.length} بنود على جدولها`,
      days: 0, late: false, limit: 0, to: `/approvals/sessions/${s.id}`,
    }, 'الجلسات', 'sessions', 'checks', 'coming', 'موعدها', s.date))
  }
  if (role === 'supervisor') {
    for (const p of payableProjects()) {
      if (projectById(p.id)?.owner !== me) continue
      for (const sl of scheduleOf(p.id).filter((x) => x.state === 'open' && x.dueAt >= day && x.dueAt <= in14)) {
        out.push(base({
          id: `due-${p.id}-${sl.no}`, code: `${p.id} · ${sl.no}`, title: p.name, sub: `الدفعة ${sl.no} من ${sl.of} · ترفع الجهة متطلباتها ثم تصلك`,
          amount: sl.amount, days: 0, late: false, limit: 0, to: ROUTES.payments,
        }, 'الدفعات', 'payments-coming', 'pay', 'coming', 'موعدها المخطط', sl.dueAt))
      }
    }
  }
  return out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
}

function base(i: InboxItem, queue: string, queueKey: string, icon: InboxQueue['icon'], lane: Lane, why: string, date?: string): TodayItem {
  return { ...i, queue, queueKey, icon, lane, left: null, why, date }
}

export interface TodayQueue { key: string; label: string; icon: InboxQueue['icon']; count: number; late: number; all: string }

export interface Today {
  items: TodayItem[]
  /** The next step · the head of the ordered work */
  next?: TodayItem
  byLane: Record<Lane, TodayItem[]>
  /** The role's own queues · its stages as personal queues (brief 4) */
  queues: TodayQueue[]
  progress: Progress
}

export function todayFor(role: RoleKey, me: string): Today {
  /* The executive's view of what sits at the committee isn't his to act on · it stays off his day */
  const qs = inboxFor(role, me).filter((q) => !(role === 'ceo' && q.key === 'committee'))
  const seen = new Set<string>()
  const items: TodayItem[] = []
  for (const q of qs) {
    for (const i of q.items) {
      const k = `${q.key}|${i.id}`
      if (seen.has(k)) continue
      seen.add(k)
      const lane = laneOf(i)
      const left = i.limit > 0 ? i.limit - i.days : null
      items.push({ ...i, queue: q.label, queueKey: q.key, icon: q.icon, lane, left, why: whyOf(i, lane, left), quick: quickOf(i, role, me) })
    }
  }
  items.sort(byPressure)
  const coming = comingFor(role, me)
  const byLane: Record<Lane, TodayItem[]> = {
    due: items.filter((x) => x.lane === 'due'),
    returned: items.filter((x) => x.lane === 'returned'),
    waiting: items.filter((x) => x.lane === 'waiting'),
    coming,
  }
  const queues = qs.filter((q) => q.items.length).map((q) => ({
    key: q.key, label: q.label, icon: q.icon, count: q.items.length, late: q.items.filter((i) => i.late).length, all: q.all,
  }))
  return { items, next: items[0], byLane, queues, progress: progressFor(me, items.length) }
}

/* ── Progress · from the audit log under my own name ── */

export interface Moved { text: string; href: string }
export interface Progress {
  today: number
  week: number
  /** today's share of the day's work: done ÷ (done + still open) */
  share: number
  moved: Moved[]
  /** never acted in the system · the first-visit line */
  first: boolean
}

const day10 = (s: string) => s.slice(0, 10)

export function progressFor(me: string, open: number): Progress {
  const mine = auditRows().filter((r) => r.by === me)
  const now = liveDay()
  const weekFrom = new Date(Date.parse(`${now}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10)
  const today = mine.filter((r) => day10(r.at) === now).length
  const weekRows = mine.filter((r) => day10(r.at) >= weekFrom && day10(r.at) <= now)
  return {
    today,
    week: weekRows.length,
    share: today + open > 0 ? today / (today + open) : 1,
    moved: movedBy(weekRows),
    first: mine.length === 0,
  }
}

/* What moved forward after my step this week · each record once, its outcome read live */
function movedBy(rows: AuditRow[]): Moved[] {
  const out: Moved[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (seen.has(r.href)) continue
    seen.add(r.href)
    const pay = payRequests.find((x) => r.href === ROUTES.payment(x.id))
    if (pay && pay.state === 'paid') { out.push({ text: `صُرفت الدفعة ${pay.no} · ${pay.projectName}`, href: r.href }); continue }
    const cl = closeRows.find((x) => r.href === ROUTES.closing(x.id))
    if (cl && cl.stage === 'closed') { out.push({ text: `أُغلق مشروع ${cl.projectName}`, href: r.href }); continue }
    const pr = projectRows.find((x) => r.href.startsWith(ROUTES.project(x.id)))
    if (pr && pr.supportStatus === 'معتمد') out.push({ text: `اعتُمد مشروع ${pr.name}`, href: ROUTES.project(pr.id) })
  }
  return out.slice(0, 4)
}
