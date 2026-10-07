import { ROUTES } from '@/app/routes'
import { CFG, persist, readJson } from '@/lib/config'
import { entityRows } from '@/data/mock/entities'
import { regRows } from '@/data/mock/registration'
import { person } from '@/data/people'
import { ROLES } from '@/data/roles'
import { FLOW_NOTES } from '@/data/intake/flow'
import { CYCLE, openFields } from '@/data/intake/cycle'
import { BUDGET_NOTES } from '@/data/budget/store'
import { APPROVAL_NOTES } from '@/data/approvals/store'
import { AGR_NOTES } from '@/data/agreements/store'
import { PLAN_NOTES } from '@/data/plans/store'
import { PAY_NOTES } from '@/data/payments/store'
import { CLOSE_NOTES } from '@/data/closing/store'
import { PARTNER_NOTES } from '@/data/partners/store'
import { ENTITY_NOTES } from '@/data/entities/store'
import { passwordEvents } from '@/data/entities/auth'
import { CHANNEL_SAY, type EscChannel } from './escRules'
import { escAlerts } from './escalation'
import { TOPIC_SAY, type Topic } from './topics'

/* The notification hub · cross «الإشعارات».

   Every module already writes what it tells whom (`*_NOTES`, filled as its operations replay). What
   was missing is the delivery: everything stayed inside the system, the entity had no copy by email
   or SMS, and three events had no notice at all (the cycle opening, the registration results, a
   password change). This file is the one place that turns a notice into messages: it reads every
   module's list, adds those three and the escalation alerts, decides the audience (an entity or a
   staff member), and sends one message per channel the settings give that audience and topic.

   The outbox is derived, not stored · the same replay that rebuilds the notices rebuilds what was
   sent, so the log can't drift from the events. In production each message is a row the mail and
   SMS gateways report back on. */

export { TOPIC_SAY, type Topic } from './topics'

export type Audience = 'entity' | 'staff'
export const AUDIENCE_SAY: Record<Audience, string> = { entity: 'الجهات', staff: 'فريق المؤسسة' }

export interface NotifyRules { channels: Record<Audience, Record<Topic, EscChannel[]>>; savedBy?: string; savedAt?: string }

const ALL: Topic[] = Object.keys(TOPIC_SAY) as Topic[]
const fill = (f: (t: Topic) => EscChannel[]) => Object.fromEntries(ALL.map((t) => [t, f(t)])) as Record<Topic, EscChannel[]>
const URGENT: Topic[] = ['registration', 'account', 'decision', 'agreement', 'payment']
const DEFAULT: NotifyRules = {
  channels: {
    entity: fill((t) => (t === 'budget' ? ['app'] : URGENT.includes(t) ? ['app', 'email', 'sms'] : ['app', 'email'])),
    staff: fill((t) => (t === 'escalation' ? ['app', 'email'] : ['app', 'email'])),
  },
}
export const NOTIFY_RULES: NotifyRules = readJson(CFG.notify, DEFAULT)
NOTIFY_RULES.channels = {
  entity: { ...DEFAULT.channels.entity, ...NOTIFY_RULES.channels?.entity },
  staff: { ...DEFAULT.channels.staff, ...NOTIFY_RULES.channels?.staff },
}
export const saveNotifyRules = (next: NotifyRules, by: string): void => {
  Object.assign(NOTIFY_RULES, next, { savedBy: by, savedAt: new Date().toISOString().slice(0, 10) })
  persist(CFG.notify, NOTIFY_RULES)
}

/* ── Notices · every module's list in one shape ── */

export interface Notice { id: string; to: string; title: string; context: string; at: string; href: string; topic: Topic }

const tagged = (list: { id: string; to: string; title: string; context: string; at: string; href?: string; projectId?: string }[], topic: Topic): Notice[] =>
  list.map((n) => ({ id: n.id, to: n.to, title: n.title, context: n.context, at: n.at, href: n.href ?? (n.projectId ? ROUTES.project(n.projectId) : ROUTES.home), topic }))

/** The cycle opened · every active entity is told the period, the deadline and the open domains (3.2.6) */
function cycleNotices(): Notice[] {
  const fields = openFields(CYCLE.from)
  if (!fields.length) return []
  return entityRows.filter((e) => e.activation === 'نشط' && !e.archived).map((e) => ({
    id: `cy-${CYCLE.from}-${e.id}`, to: e.name, topic: 'cycle' as const, at: CYCLE.from, href: ROUTES.entityPortal,
    title: `فُتح باب التقديم · ${CYCLE.name}`,
    context: `من ${CYCLE.from} حتى ${CYCLE.to} · المجالات المتاحة: ${fields.slice(0, 4).join('، ')}${fields.length > 4 ? ` و${fields.length - 4} غيرها` : ''}`,
  }))
}

function accountNotices(): Notice[] {
  return passwordEvents().map(({ account, at, created }) => ({
    id: `pw-${account.id}-${at}`, to: account.name, topic: 'account' as const, at: at.slice(0, 10), href: ROUTES.login,
    title: created ? 'أُنشئ حساب البوابة' : 'تغيّرت كلمة المرور بنجاح',
    context: created ? 'يمكنك الدخول ومتابعة طلبك' : 'إن لم تكن أنت من غيّرها فتواصل مع المؤسسة فورًا',
  }))
}

function escalationNotices(): Notice[] {
  return escAlerts(7).flatMap((a) => a.to.map((to) => ({
    id: `${a.id}-${to}`, to, topic: 'escalation' as const, at: a.at, href: a.item.href,
    title: a.level === 'late' ? `تجاوز مدته · ${a.item.title}` : `متعثر · اليوم ${a.day} · ${a.item.title}`,
    context: `${a.item.stage} · ${a.item.over} يومًا فوق المدة`,
  })))
}

export function allNotices(): Notice[] {
  return [
    ...cycleNotices(),
    ...tagged(ENTITY_NOTES, 'registration'),
    ...accountNotices(),
    ...tagged(FLOW_NOTES, 'project'),
    ...tagged(APPROVAL_NOTES, 'decision'),
    ...tagged(AGR_NOTES, 'agreement'),
    ...tagged(PAY_NOTES, 'payment'),
    ...tagged(PLAN_NOTES, 'plan'),
    ...tagged(CLOSE_NOTES, 'closing'),
    ...tagged(PARTNER_NOTES, 'partners'),
    ...tagged(BUDGET_NOTES, 'budget'),
    ...escalationNotices(),
  ].sort((a, b) => b.at.localeCompare(a.at))
}

/* ── Addresses ── */

const entityNames = () => new Set([...entityRows.map((e) => e.name), ...regRows.map((r) => r.name)])
export const audienceOf = (to: string): Audience => (entityNames().has(to) ? 'entity' : 'staff')

const ROLE_NAME = (title: string) => ROLES.find((r) => r.title === title)?.name
/** Where a message goes · the entity's registered email and mobile, a staff member's work address */
export function addressOf(to: string, channel: EscChannel): string {
  if (channel === 'app') return to
  const e = entityRows.find((x) => x.name === to)
  const r = e ? undefined : regRows.find((x) => x.name === to)
  if (e || r) return channel === 'email' ? (e?.email ?? r?.clerkEmail ?? r?.acctEmail ?? '') : (e?.mobile ?? r?.clerkMobile ?? '')
  const who = ROLE_NAME(to) ?? to
  const slug = person(who).slug
  return channel === 'email' ? `${slug ?? 'desk'}@abanumay.org.sa` : '05XXXXXXXX'
}

/* ── The outbox ── */

export interface Message {
  id: string
  notice: Notice
  audience: Audience
  channel: EscChannel
  address: string
  /** The gateway's answer · a missing address can't be sent */
  state: 'sent' | 'failed'
}

export function outbox(): Message[] {
  const out: Message[] = []
  for (const n of allNotices()) {
    const audience = audienceOf(n.to)
    for (const channel of NOTIFY_RULES.channels[audience][n.topic] ?? ['app']) {
      const address = addressOf(n.to, channel)
      out.push({ id: `${n.id}-${channel}`, notice: n, audience, channel, address, state: address ? 'sent' : 'failed' })
    }
  }
  return out
}

/** What an entity sees on its portal · its own notices, newest first */
export const entityNotices = (name: string): Notice[] => allNotices().filter((n) => n.to === name)

export const channelSay = (c: EscChannel) => CHANNEL_SAY[c]
