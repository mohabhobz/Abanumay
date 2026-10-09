/**
 * Configurable values · meeting 1 Oct, change list item 9: financial limits, approval levels,
 * escalation durations and counts change from settings, never in code.
 *
 * Every rule table in the data layer is a plain exported object. At load, `hydrate` lays the
 * values saved from settings over its defaults **in place**, so every reader (the inbox, the SLA
 * colours, the project page) sees the configured number without knowing where it came from. A save
 * writes the new values and lays them over the same object again.
 *
 * Storage is the browser in the prototype; in production it is a settings table on the server.
 */
const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Overlay saved values on a record of numbers (stage limits and the like) */
export function hydrate<T extends Record<string, number>>(key: string, target: T): T {
  const v = read(key)
  if (v && typeof v === 'object') {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (k in target && typeof n === 'number' && Number.isFinite(n)) (target as Record<string, number>)[k] = n
    }
  }
  return target
}

/** Overlay saved values on a list of rows, matched by `key`, on one numeric field */
export function hydrateRows<R extends { key: string }>(key: string, rows: R[], field: keyof R): R[] {
  const v = read(key)
  if (v && typeof v === 'object') {
    for (const r of rows) {
      const n = (v as Record<string, unknown>)[r.key]
      if (n === null || (typeof n === 'number' && Number.isFinite(n))) {
        ;(r as Record<string, unknown>)[field as string] = n
        ;(r as Record<string, unknown>).assumed = false
      }
    }
  }
  return rows
}

/** A whole saved object, or the default when nothing is saved · for non-numeric settings
    (a period, a list of supervisors, a mode) that `hydrate` doesn't cover */
export function readJson<T>(key: string, fallback: T): T {
  const v = read(key)
  return v && typeof v === 'object' ? ({ ...fallback, ...(v as object) } as T) : fallback
}

export function persist(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Storage blocked · the value still applies for this visit */
  }
}

/** Saved at all? · a configured value stops showing «افتراضي» */
export const isConfigured = (key: string): boolean => read(key) !== null

export const CFG = {
  approval: 'ab-cfg-approval',
  limits: 'ab-cfg-limits',
  planLimits: 'ab-cfg-plan-limits',
  closeLimits: 'ab-cfg-close-limits',
  agrLimits: 'ab-cfg-agr-limits',
  payLimits: 'ab-cfg-pay-limits',
  /** Grant intake cycle · period, open domains, supervisors, distribution (BPD-003 · 3.2–3.4) */
  cycle: 'ab-cfg-cycle',
  criteria: 'ab-cfg-criteria',
  consultants: 'ab-cfg-consultants',
  prospects: 'ab-cfg-prospects',
  /** Entity registration and update rules · BPD-002 */
  entityRules: 'ab-cfg-entity-rules',
  /** Budget approval roles, transfer policy and spending limits · BPD-001 */
  budgetRules: 'ab-cfg-budget-rules',
  /** Approval path · manager's final authority, rejection cap, per-entity limits, sessions · BPD-004–007 */
  approvalRules: 'ab-cfg-approval-rules',
  /** Shared escalation · stall margin per procedure, alert levels and recipients (cross · 9.5) */
  escalation: 'ab-cfg-escalation',
  /** Stage limits of the procedures that had none · budget, registration, approval seats, partners */
  escLimits: 'ab-cfg-esc-limits',
  /** The project stages' limits (study and completion) · were fixed in code */
  stageLimits: 'ab-cfg-stage-limits',
  /** Notification channels per audience and topic · in-app, email, SMS */
  notify: 'ab-cfg-notify',
  /** Batch 8 · the client's open decisions, each built both ways behind one setting */
  decisions: 'ab-cfg-decisions',
  /** Batch 8 · message templates per topic and channel */
  templates: 'ab-cfg-templates',
} as const
