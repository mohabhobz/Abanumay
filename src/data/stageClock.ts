import { actAt } from '@/data/clock'
import { foundationDaysBetween } from '@/data/intake/cycle'

/* Batch 8 · 17 Oct · cross x.5.1 · the stage clock runs.

   Every record carried its «time in stage» as a number that a move set back to zero and nothing ever
   raised, so a request that moved inside the app could never fall late · the escalation only ever saw
   the seeded ages. The number is now a clock: what was written plus the foundation's working days
   since it was written (3.4.15 · 24 units a day, lib/sla). A move writes zero and stamps the move's own
   time (the op's stamp on a replay, so a reload reads the same age), and the clock runs from there.
   A seeded age stays as written · it is the record's age on the demo's reference day. */

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The working days after a stamp, up to today · in the system's unit (24 per working day) */
export const workHoursSince = (at: string | undefined): number => {
  const t = at ? Date.parse(at) : NaN
  if (!Number.isFinite(t)) return 0
  const from = isoDay(t)
  const today = isoDay(Date.now())
  if (from >= today) return 0
  const next = new Date(`${from}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
  return foundationDaysBetween(isoDay(next.getTime()), today) * 24
}

const ARMED = new WeakSet<object>()

/** Arm a record's clock · `fresh` for a record made now, whose zero starts counting from this action */
export function liveClock<T extends object>(row: T, key: 'hoursInStage' | 'hoursInState' = 'hoursInStage', fresh = false): T {
  if (ARMED.has(row)) return row
  ARMED.add(row)
  const r = row as Record<string, unknown>
  let base = Number(r[key]) || 0
  let at: string | undefined = fresh ? actAt() : undefined
  Object.defineProperty(row, key, {
    enumerable: true, configurable: true,
    get: () => base + workHoursSince(at),
    set: (v: number) => { base = Number(v) || 0; at = actAt() },
  })
  return row
}

/** When a record's clock last started · for the «since» a screen reads */
export const armed = (row: object): boolean => ARMED.has(row)
