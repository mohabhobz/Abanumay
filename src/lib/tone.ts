/**
 * Converts system statuses into color tones.
 *
 * One place so the same status gets the same color on every screen —
 * the card, the table, the project page, and the entity page.
 */
import type { Tone } from '@/types/domain'

/**
 * Status → tone: single source of truth.
 *
 * "Stalled" used to be red on `/payments/late` and amber on
 * `/payments`, and "behind schedule" was red — because every screen
 * kept its own mapping. Every tone table (`PLAN_TONE`, `CLOSE_TONE`,
 * `REG_TONE`, `HEAT_TONE`, …) now takes its values from here, and a
 * check fails if the same status text is ever rendered with two
 * different tones.
 *
 * The rule: delay, stalling, missing, and returned are amber; red is
 * reserved for rejection and termination only; ongoing review is teal;
 * completed is green.
 */
export const TONE = {
  draft: 'mute',
  review: 'teal',
  active: 'ret',
  done: 'ok',
  late: 'warn',
  stuck: 'warn',
  missing: 'warn',
  returned: 'warn',
  rejected: 'no',
  expired: 'no',
} as const satisfies Record<string, Tone>

/**
 * Action urgency (on time · overdue · stalled) — used in disbursement
 * and agreement tables and cards.
 */
export const HEAT_TONE = { ok: TONE.done, late: TONE.late, stuck: TONE.stuck } as const

/** The project's five-way status group. */
export const groupTone = (group: string): Tone => {
  switch (group) {
    case 'في الدراسة': return 'ret'
    case 'في التشغيل': return 'brand'
    case 'مكتمل': return 'ok'
    case 'متعثر': return TONE.stuck
    default: return 'no'
  }
}

/** Entity activation status — the first thing read before any decision. */
export const activationTone = (activation: string): Tone => {
  switch (activation) {
    case 'نشط': return 'ok'
    case 'ملغى الاعتماد': return 'no'
    case 'محدث': return 'ret'
    case 'مرفوض': return 'no'
    default: return 'warn'
  }
}

export const governanceTone = (governance: string): Tone => {
  switch (governance) {
    case 'ممتازة': return 'ok'
    case 'جيدة': return 'brand'
    case 'مقبولة': return 'ret'
    case 'ضعيفة': return 'no'
    default: return 'mute'
  }
}

/** Hours in the system, days in the interface. */
export const days = (hours: number): number => Math.round(hours / 24)

/** Progress bar color: green below the threshold, yellow near it, red above it. */
export const pressureColor = (pressure: number): string =>
  pressure > 1 ? 'var(--no)' : pressure > 0.75 ? 'var(--warn)' : 'var(--teal)'
