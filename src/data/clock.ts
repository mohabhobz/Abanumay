/* One clock for the whole prototype · re-audit 7 Oct (group 5 · dates).

   Every module used to carry its own «today»: intake 3 Oct, plans and closing 18 Sep, payments
   14 Sep, partners 6 Oct. So a decision taken now read «3 October» in the approval file and
   «14 September» in the bell, and the project log ran out of order.

   Two different things were hiding behind that one word, and they're split here:

   · `TODAY` · the demo's reference day. Readings of the seeded data use it — what is late, what is
     due, whether the intake period is open — so the sample stays stable whenever it's opened.
   · `stampNow()` / `dayOf()` · when an action happened. Every recorded decision, log line and
     notification carries the real time it was taken, stored on its op so a reload replays the same
     date instead of re-reading the clock. */

/** The demo's reference day · readings of the seeded data, never the date of an action */
export const TODAY = '2026-10-08'

/** The real time now · the stamp an action carries on its op */
export const stampNow = (): string => new Date().toISOString()

/** The day an action happened · from the op's own stamp; an old op without one reads the reference day */
export const dayOf = (at?: string): string => (at ? at.slice(0, 10) : TODAY)

/** The clock time of an action · «HH:MM» from its stamp, in the viewer's zone */
export const timeOf = (at?: string): string => {
  const d = at ? new Date(at) : new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* The action being replayed · a store sets it around each op it applies, so the helpers it calls
   (the plan and closing mutators in the mocks) write the op's own date without being passed it */
let CUR: string | undefined

/** Run `fn` as of an op's stamp · nested calls keep the outer stamp */
export function asOf<T>(at: string | undefined, fn: () => T): T {
  const was = CUR
  CUR = at ?? was
  try { return fn() } finally { CUR = was }
}

/** The day of the action running now · its op's stamp, or the real day for a live call */
export const actDay = (): string => dayOf(CUR ?? stampNow())
/** The full stamp of the action running now */
export const actAt = (): string => CUR ?? stampNow()

/** When the seeded records were made · the morning before the reference day, so a seeded hold or
    signature never sorts after something done in the app today */
export const SEED_AT = (() => {
  const d = new Date(`${TODAY}T08:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
})()
