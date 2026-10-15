/* v3 · 3.4.15 · the SLA counts the foundation's working days only.

   Every stage limit and every «time in stage» is kept in one unit across the system · 24 units per
   working day · so the screens that divide by 24 read working days, the settings edit working days,
   and the escalation compares like with like. The limits were first written as calendar hours; a
   calendar week holds five working days, so a default converts once by 5/7 and rounds to a whole
   working day (900 calendar hours ≈ 37.5 days ≈ 27 working days). A value saved from the settings
   is already in working days. */

export const WD = 24

/** A default written in calendar hours · the same span in working days, in the system's unit */
export const workDayLimit = (calendarHours: number): number =>
  calendarHours > 0 ? Math.max(1, Math.round((calendarHours / 24) * (5 / 7))) * WD : calendarHours

/** A table of defaults · each converted */
export const workDayLimits = <T extends Record<string, number>>(t: T): T =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, workDayLimit(v)])) as T

/** A seeded «time in stage» written as calendar hours · the same span in working-day units */
export const seedWorkHours = (h: number): number => (h > 0 ? Math.round((h * 5) / 7) : h)

/* Limits saved from the settings before the SLA moved to working days were calendar days · they
   convert once, so a saved «7 days» reads 5 working days, not 7 */
const SLA_KEYS = ['ab-cfg-stage-limits', 'ab-cfg-agr-limits', 'ab-cfg-close-limits', 'ab-cfg-pay-limits', 'ab-cfg-plan-limits', 'ab-cfg-esc-limits']
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('ab-sla-v') !== '2') {
    for (const k of SLA_KEYS) {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const v = JSON.parse(raw) as Record<string, unknown>
      for (const [kk, n] of Object.entries(v)) if (typeof n === 'number') v[kk] = workDayLimit(n)
      localStorage.setItem(k, JSON.stringify(v))
    }
    localStorage.setItem('ab-sla-v', '2')
  }
} catch { /* storage blocked · the defaults hold */ }
