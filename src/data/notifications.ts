/**
 * Notifications · what has reached the user and needs to be seen.
 *
 * Not a new data source. Every notification here is derived from the same rows the cards already
 * show (projects, disbursement, agreements, closure, registration requests) — so the badge count on
 * the bell matches the card's count, and once the backend is ready this file becomes a `GET
 * /notifications` call with the same shape.
 *
 * The "needs attention" card that used to sit at the bottom of the home page was removed and moved
 * here: an overdue item is information that should reach the user on any screen, not a row on a
 * single dashboard.
 *
 * Read status is session state (`sessionStorage`), lasting only as long as the injected session.
 */
import { useSyncExternalStore } from 'react'
import { ROUTES } from '@/app/routes'
import { query, stagePressure } from './repository'
import { payHeat, payRequests, payStateLabel } from './mock/disbursements'
import { agrHeat, agreements, agrStageLabel } from './mock/agreements'
import { closeLate, closeRows, closeStageLabel } from './mock/closing'
import { regRows } from './mock/registration'
import { entityById } from './mock/entities'
import { countOf, NOUN, projectCode } from '@/lib/format'

export type NoteKind = 'decide' | 'msg' | 'late' | 'info'

/**
 * Who or what the notification comes from · drives the mark at the start of the card.
 * An entity or a project shows the entity's logo (the entity icon, or the project icon, until a
 * logo is uploaded); a message or comment shows the sender's photo; anything the system raised
 * on its own shows the Abanumay mark.
 */
export type NoteFrom =
  | { type: 'entity'; logo?: string }
  | { type: 'project'; logo?: string }
  | { type: 'person'; name: string }
  | { type: 'system' }

export interface Note {
  id: string
  kind: NoteKind
  title: string
  /** One line of context · where it's from and what happened */
  context: string
  /** Event day (YYYY-MM-DD) · rendered via `<DateText>` */
  at: string
  to: string
  from: NoteFrom
}

/** Ordered drawer groups · the heading states **why** the notification arrived */
export const NOTE_GROUPS: { kind: NoteKind; label: string }[] = [
  { kind: 'decide', label: 'يحتاج قرارك' },
  { kind: 'msg', label: 'رسائل وتعليقات' },
  { kind: 'late', label: 'تجاوز حدّه الزمني' },
  { kind: 'info', label: 'للعلم' },
]

const HOUR = 3_600_000
const dayOf = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString().slice(0, 10)
const days = (h: number) => Math.max(1, Math.round(h / 24))

const projectFrom = (entityId?: string): NoteFrom =>
  ({ type: 'project', logo: entityId ? entityById(entityId)?.logo : undefined })

export function buildNotes(user: { name: string }): Note[] {
  const out: Note[] = []

  /* Needs your decision */
  for (const p of query.projects({ owner: user.name, status: 'في الدراسة', sort: 'waiting', pageSize: 3 }).rows) {
    out.push({
      id: `dec-${p.id}`, kind: 'decide', title: p.name,
      context: `${projectCode(p.id, p.year)} · ${p.stage} · ${p.entityName}`,
      at: dayOf(p.hoursInStage * HOUR), to: ROUTES.project(p.id), from: projectFrom(p.entityId),
    })
  }
  for (const r of regRows.filter((x) => x.state === 'review')) {
    out.push({
      id: `reg-${r.id}`, kind: 'decide', title: `طلب تسجيل · ${r.name}`,
      context: `${r.type} · ${r.city} · بانتظار المراجعة`,
      at: r.submittedAt, to: ROUTES.entityRequest(r.id), from: { type: 'entity' },
    })
  }

  /* Messages and comments · the sender's face leads the card */
  const MSGS: { by: string; body: string }[] = [
    { by: 'عبدالله الدوسري', body: 'راجعت الدراسة، نحتاج تحديث بند التشغيل قبل العرض على اللجنة.' },
    { by: 'ريم الشمري', body: 'أرفقت مؤشرات الأداء للربع الأخير في ملف المشروع.' },
  ]
  query.projects({ owner: user.name, sort: 'waiting', pageSize: MSGS.length }).rows.forEach((p, i) => {
    const m = MSGS[i]
    out.push({
      id: `msg-${p.id}`, kind: 'msg', title: `${m.by} علّق على «${p.name}»`,
      context: m.body,
      at: dayOf((i + 1) * 5 * HOUR), to: ROUTES.project(p.id), from: { type: 'person', name: m.by },
    })
  })

  /* Past its limit */
  for (const p of query.projects({ overdue: true, sort: 'waiting', pageSize: 4 }).rows) {
    const over = p.hoursInStage - p.stageLimit
    out.push({
      id: `late-${p.id}`, kind: 'late', title: p.name,
      context: `${p.stage} · ${countOf(days(over), NOUN.day)} فوق الحدّ · ${p.owner ?? 'بلا مالك'}`,
      at: dayOf(over * HOUR), to: ROUTES.project(p.id), from: projectFrom(p.entityId),
    })
  }
  for (const r of payRequests.filter((x) => payHeat(x) !== 'ok').slice(0, 3)) {
    out.push({
      id: `pay-${r.id}`, kind: 'late', title: `الدفعة ${r.no} من ${r.of} · ${r.projectName}`,
      context: `${payStateLabel(r.state)} · ${payHeat(r) === 'stuck' ? 'متعثّرة' : 'متأخّرة'} منذ ${countOf(days(r.hoursInState), NOUN.day)}`,
      at: dayOf(r.hoursInState * HOUR), to: ROUTES.payment(r.id), from: projectFrom(r.entityId),
    })
  }
  for (const a of agreements.filter((x) => agrHeat(x) !== 'ok').slice(0, 2)) {
    out.push({
      id: `agr-${a.id}`, kind: 'late', title: `اتفاقية · ${a.projectName}`,
      context: `${agrStageLabel(a.stage)} · ${a.entityName}`,
      at: dayOf(a.hoursInStage * HOUR), to: ROUTES.agreement(a.id), from: projectFrom(a.entityId),
    })
  }
  for (const c of closeRows.filter(closeLate).slice(0, 2)) {
    out.push({
      id: `cls-${c.id}`, kind: 'late', title: `إغلاق · ${c.projectName}`,
      context: `${closeStageLabel(c.stage)} · ${c.entityName}`,
      at: dayOf(c.hoursInStage * HOUR), to: ROUTES.closing(c.id), from: projectFrom(c.entityId),
    })
  }

  /* For your awareness */
  for (const r of regRows.filter((x) => x.state === 'approved' && x.decidedAt).slice(0, 2)) {
    out.push({
      id: `ok-${r.id}`, kind: 'info', title: `اعتُمد تسجيل ${r.name}`,
      context: `${r.type} · ${r.city}${r.reviewDays ? ` · خلال ${countOf(r.reviewDays, NOUN.day)}` : ''}`,
      at: r.decidedAt!, to: ROUTES.entityRequest(r.id), from: { type: 'entity' },
    })
  }
  const stalled = query.projects({ overdue: true }).rows.filter((p) => stagePressure(p) > 2).length
  if (stalled) {
    out.push({
      id: 'info-stalled', kind: 'info', title: 'ملخّص التعثّر الأسبوعي',
      context: `${stalled} ${stalled === 1 ? 'مشروع تجاوز' : 'مشاريع تجاوزت'} ضعف حدّ القسم`,
      at: dayOf(24 * HOUR), to: `${ROUTES.projects}?overdue=1&sort=waiting`, from: { type: 'system' },
    })
  }
  return out
}

/* Read state · a small store with subscribers */
const KEY = 'ab-notes-read'
const subs = new Set<() => void>()
let cache: Set<string> | null = null

function load(): Set<string> {
  if (cache) return cache
  try { cache = new Set(JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[]) }
  catch { cache = new Set() }
  return cache
}
function save(next: Set<string>) {
  cache = next
  try { sessionStorage.setItem(KEY, JSON.stringify([...next])) } catch { /* Private to the session · state lives in memory
                                                                            only */ }
  subs.forEach((f) => f())
}

/** "For your awareness" arrives already read · everything else is unread until opened */
export const isRead = (n: Note, read: Set<string>) => n.kind === 'info' || read.has(n.id)
export const markRead = (ids: string[]) => save(new Set([...load(), ...ids]))

export function useReadSet(): Set<string> {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f) },
    load,
    load,
  )
}
