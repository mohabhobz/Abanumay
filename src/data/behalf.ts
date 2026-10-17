import { roleByKey, type RoleKey } from '@/data/roles'
import { stampNow } from '@/data/clock'

/* Batch 8 · 17 Oct · v3 0.def.16 · «مدير النظام (ضابط عام)».

   The system admin holds every role's permissions, so she can take over a stalled step at any stage
   and finish it herself (the user who holds it is away or can't be reached), with no separate list of
   exceptions. She does it by taking a seat on another role's behalf, with the reason · the reason is
   mandatory. While it runs, every screen offers what that role is offered, and everything she does is
   signed with her own name · the audit log reads each of her actions inside the takeover's span as
   «on behalf of» that role, with the reason (user, original role, date, action, reason).

   In production the server stamps the takeover on every event it writes · in the prototype the spans
   are kept here, append-only, and the audit log reads them. */

export interface Behalf {
  id: string
  /** The role she acts as */
  role: RoleKey
  reason: string
  by: string
  from: string
  /** Set when she ends it · open while running */
  to?: string
}

const KEY = 'ab-behalf-log'
const EVENT = 'ab:behalf'
const read = (): Behalf[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Behalf[] } catch { return [] } }
export const BEHALF_LOG: Behalf[] = read()
/* Verifier · 17 Oct · another tab's takeover is read before anything is written, and as it happens */
const reload = () => { const next = read(); BEHALF_LOG.splice(0, BEHALF_LOG.length, ...next) }
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(BEHALF_LOG)) } catch { /* storage blocked · holds for this visit */ }
  window.dispatchEvent(new Event(EVENT))
}
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { reload(); window.dispatchEvent(new Event(EVENT)) } })
export const onBehalfChange = (fn: () => void) => { window.addEventListener(EVENT, fn); return () => window.removeEventListener(EVENT, fn) }

/** The takeover running now, if any */
export const currentBehalf = (): Behalf | undefined => BEHALF_LOG.find((b) => !b.to)

/** Take a role's seat · the role and the reason are both required · the admin's own seat can't be taken */
export function startBehalf(role: RoleKey, reason: string, by: string): string[] {
  const out: string[] = []
  reload()
  if (role === 'admin') out.push('اختر دورًا غير مدير النظام')
  if (!reason.trim()) out.push(/* doc 0.def.16 */ 'اكتب سبب التولّي · ذكر السبب إلزامي')
  if (currentBehalf()) out.push('أنهِ التولّي الجاري أولًا')
  if (out.length) return out
  BEHALF_LOG.push({ id: `BH-${Date.now().toString(36)}`, role, reason: reason.trim(), by, from: stampNow() })
  save()
  return []
}

export function endBehalf(): void {
  reload()
  const b = currentBehalf()
  if (!b) return
  b.to = stampNow()
  save()
}

const local = (iso: string) => {
  const d = new Date(iso)
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`
}
/** The takeover a stamp falls in, for a name · a full ISO stamp (UTC) or a «day time» stamp written in
    the viewer's clock · a date-only stamp can't place an action inside a span, so it never matches here */
export function behalfAt(by: string, at: string): Behalf | undefined {
  if (at.length <= 10) return undefined
  const iso = at.includes('T')
  const x = iso ? at.slice(0, 16) : at.slice(0, 16)
  return BEHALF_LOG.find((b) => {
    if (b.by !== by) return false
    const from = iso ? b.from.slice(0, 16) : local(b.from)
    const to = b.to ? (iso ? b.to.slice(0, 16) : local(b.to)) : '9999'
    return x >= from && x <= to
  })
}
/** A takeover on that day · for a date-only row whose own record names the role it was taken in */
export const behalfOnDay = (by: string, day: string, role: string): Behalf | undefined =>
  BEHALF_LOG.find((b) => b.by === by && roleByKey(b.role).title === role && b.from.slice(0, 10) <= day && (b.to ?? '9999').slice(0, 10) >= day)

export const behalfSay = (b: Behalf) => `نيابةً عن ${roleByKey(b.role).title}`

/** Does `by` act as `role` now (or at an op's stamp) through a takeover · a seat held by a named person
    (the supervisor's own projects) opens to the admin who took it over (0.def.16) */
export const actsAs = (by: string, role: RoleKey, at?: string): boolean => {
  const b = at ? behalfAt(by, at) : currentBehalf()
  return Boolean(b && b.by === by && b.role === role)
}
