import { readJson, persist } from '@/lib/config'
import { TODAY, planRows } from '@/data/mock/plans'
import type { PlanActivity, PlanRow } from '@/types/domain'

/* Client meeting 20 Oct (#32 · #34 · #35) · an activity's execution status and its serial.

   The status the client asked for is read from the dates and two settings, not stored:
     لم يحن وقته · before its planned start
     جاري التنفيذ · between start and end (and up to the delay margin)
     متأخر      · past its end by more than the delay margin
     متعثر      · past its end by more than the stall margin
     مكتمل      · the entity pressed «مكتمل» · it then waits for the supervisor's check
   The supervisor's check is a second column (مقبول / غير مقبول), so «مكتمل» never reads as counted. */

export interface ActTiming { delayDays: number; stallDays: number }
const KEY = 'ab-cfg-plan-act'
export const ACT_TIMING_DEFAULT: ActTiming = { delayDays: 5, stallDays: 10 }
export const ACT_TIMING: ActTiming = readJson<ActTiming>(KEY, ACT_TIMING_DEFAULT)

/** The settings rule · the stall margin can never be shorter than the delay margin */
export function timingIssues(t: ActTiming): string[] {
  const out: string[] = []
  if (!Number.isInteger(t.delayDays) || t.delayDays < 0) out.push('مدة التأخير عدد أيام صحيح')
  if (!Number.isInteger(t.stallDays) || t.stallDays < 0) out.push('مدة التعثّر عدد أيام صحيح')
  if (t.stallDays < t.delayDays) out.push('مدة التعثّر لا تكون أقل من مدة التأخير')
  return out
}
export function saveActTiming(t: ActTiming): string[] {
  const e = timingIssues(t)
  if (e.length) return e
  ACT_TIMING.delayDays = t.delayDays
  ACT_TIMING.stallDays = t.stallDays
  persist(KEY, ACT_TIMING)
  return []
}

export type ActProgress = 'notYet' | 'doing' | 'late' | 'stuck' | 'done'
export const PROGRESS_SAY: Record<ActProgress, string> = {
  notYet: 'لم يحن وقته', doing: 'جاري التنفيذ', late: 'متأخر', stuck: 'متعثر', done: 'مكتمل',
}
export const PROGRESS_TONE: Record<ActProgress, 'mute' | 'ret' | 'warn' | 'no' | 'ok'> = {
  notYet: 'mute', doing: 'ret', late: 'warn', stuck: 'no', done: 'ok',
}
const daysPast = (to: string, today: string) => Math.round((Date.parse(today) - Date.parse(to)) / 86_400_000)

export function progressOf(a: PlanActivity, today = TODAY, t: ActTiming = ACT_TIMING): ActProgress {
  if (a.state === 'claimed' || a.state === 'accepted') return 'done'
  if (a.from && a.from > today) return 'notYet'
  if (a.to) {
    const past = daysPast(a.to, today)
    if (past > t.stallDays) return 'stuck'
    if (past > t.delayDays) return 'late'
  }
  return 'doing'
}

/** The supervisor's check · '' while nothing was submitted */
export type ActVerify = 'ok' | 'no' | 'wait' | ''
export const verifyOf = (a: PlanActivity): ActVerify =>
  a.state === 'accepted' ? 'ok' : a.state === 'rejected' ? 'no' : a.state === 'claimed' ? 'wait' : ''
export const VERIFY_SAY: Record<Exclude<ActVerify, ''>, string> = { ok: 'مقبول', no: 'غير مقبول', wait: 'بانتظار التحقق' }

/* ── #34 · the activity's serial · ACTV-2026-00001 ──
   Sequential across the system and never reused: a serial is assigned the first time an activity is
   seen and kept, so a new plan added later doesn't shift the serials of the ones before it. The
   fixture's activities take theirs first, in a stable order (plan opening date, then plan id). */
const SKEY = 'ab-plan-actv'
const SERIALS = new Map<string, string>(Object.entries(readJson<Record<string, string>>(SKEY, {})))
let last = [...SERIALS.values()].reduce((m, s) => Math.max(m, Number(s.slice(-5)) || 0), 0)
const year = () => TODAY.slice(0, 4)
function assign(key: string): string {
  last += 1
  const s = `ACTV-${year()}-${String(last).padStart(5, '0')}`
  SERIALS.set(key, s)
  return s
}
function seedSerials(rows: PlanRow[]) {
  const sorted = [...rows].sort((a, b) => (a.openedAt || '').localeCompare(b.openedAt || '') || a.id.localeCompare(b.id))
  let added = false
  for (const p of sorted) for (const ph of p.phases) for (const a of ph.activities) {
    const k = `${p.id}:${a.id}`
    if (!SERIALS.has(k)) { assign(k); added = true }
  }
  if (added) persist(SKEY, Object.fromEntries(SERIALS))
}
seedSerials(planRows)
/** Activity ids repeat across plans (a1, a2 …), so the serial is keyed by plan and activity */
export function actSerial(planId: string, actId: string): string {
  const k = `${planId}:${actId}`
  const has = SERIALS.get(k)
  if (has) return has
  const s = assign(k)
  persist(SKEY, Object.fromEntries(SERIALS))
  return s
}
