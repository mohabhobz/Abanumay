/**
 * Project journey through the process · durations, repeat rounds, and the level where it was
 * decided.
 *
 * Warning: this file is **derived**, not a source. The live system does track these durations (the
 * projects table has 13 duration columns, and there are 50 procedural sections), but those columns
 * weren't pulled into the mock because the audit was read-only. So rather than leave half the
 * metrics empty, the journey is derived from the row itself in a **deterministic** way: the same
 * project gives the same numbers on every load, and the distribution comes from `hoursInStage`,
 * `submittedAt`, `decidedAt`, and the amount — so the numbers stay consistent with what the other
 * screens show, rather than being random alongside it.
 *
 * Once the API delivers the real duration columns, this file is removed entirely and the `Journey`
 * interface fills from the backend with no changes to the screens.
 */
import type { ProjectRow } from '@/types/domain'
import { projectRows } from './mock/projects'

/** The level where the final decision was made */
export type DecisionLevel =
  | 'مدير المنح'
  | 'المدير التنفيذي'
  | 'اللجنة التنفيذية'
  | 'مجلس الأمناء'

/** Approval ceilings · same numbers as in `roles.ts`, temporary pending confirmation */
const CEILING_MANAGER = 250_000
const CEILING_CEO = 500_000
const CEILING_COMMITTEE = 2_000_000

export interface Journey {
  /** Grants supervisor: from project assignment to logging the recommendation · in hours */
  study: number | null
  /** Grants manager: from receipt to logging the decision */
  manager: number | null
  /** Executive director */
  exec: number | null
  /** Executive committee · from referral to decision */
  committee: number | null
  /** Drafting and approving the agreement */
  agreement: number | null
  /** Processing the first disbursement request */
  payout: number | null
  /** From requesting the closing report to closing out */
  closing: number | null
  /** Number of times the request was sent back to the entity for missing data */
  toEntity: number
  /** Number of times the project was sent back from manager to supervisor */
  toSupervisor: number
  /** Transferred between two supervisors */
  transferred: boolean
  /** The level where it was actually decided · null means not decided yet */
  decidedBy: DecisionLevel | null
  /** Decided on the first review, no repeat rounds */
  firstPass: boolean
  /** Its budget was held from the first review */
  reservedFirstPass: boolean
}

/* Deterministic randomness
   A hash function on the id: same input always gives the same output. The goal is a reasonable
   distribution, not "nice" numbers — if every project took the same duration, the metric would be
   meaningless. */
const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/** A number within a range, derived from the id plus a text seed that varies per field */
const pick = (id: string, salt: string, min: number, max: number): number =>
  Math.round(min + hash(`${id}:${salt}`) * (max - min))

/** Section ordering · a project in a later section has passed the ones before it */
const ORDER = [
  'استكمال بيانات المشروع',
  'دراسة المشروع',
  'اعتماد الإتفاقية',
  'اعتماد الإتفاقية الكترونيًا',
  'الإتفاقيات الورقية',
  'المشرف إذن الصرف',
  'إذن صرف معاد',
  'اصدار سند الصرف',
  'رفع سند القبض والقيد',
  'رفع تقرير مرحلي',
  'طلب التقرير الختامي',
  'رفع التقرير الختامي',
  'اعتماد التقرير الختامي',
  'تقييم المشروع',
  'مشروع مكتمل',
]

/**
 * Where the project stands in the chain. Stalled and withdrawn projects are handled by their own
 * status.
 */
const reach = (row: ProjectRow): number => {
  if (row.statusGroup === 'مكتمل') return ORDER.length - 1
  if (row.statusGroup === 'معتذر عنه') return 1
  if (row.statusGroup === 'متعثر') return ORDER.indexOf('رفع تقرير مرحلي')
  const i = ORDER.indexOf(row.stage)
  return i < 0 ? 1 : i
}

const daysBetween = (a?: string, b?: string): number | null => {
  if (!a || !b) return null
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null
}

/** The level where it was decided · determined by the approved amount against the ceilings */
const levelFor = (amount: number): DecisionLevel =>
  amount <= CEILING_MANAGER
    ? 'مدير المنح'
    : amount <= CEILING_CEO
      ? 'المدير التنفيذي'
      : amount <= CEILING_COMMITTEE
        ? 'اللجنة التنفيذية'
        : 'مجلس الأمناء'

export function journeyOf(row: ProjectRow): Journey {
  const at = reach(row)
  const decided = row.supportStatus !== null
  const id = row.id

  /* Review duration: if the project has been decided, the real duration from submission to decision
     exists, and it's split between the supervisor and the manager rather than invented. If it's
     still under review, the current time spent is the duration. */
  const total = daysBetween(row.submittedAt, row.decidedAt)
  const studyShare = 0.55 + hash(`${id}:split`) * 0.3

  const study =
    total !== null
      ? Math.max(1, Math.round(total * 24 * studyShare))
      : row.stage === 'دراسة المشروع' || row.stage === 'استكمال بيانات المشروع'
        ? row.hoursInStage
        : at >= 2
          ? pick(id, 'study', 120, 1_400)
          : null

  const manager =
    total !== null ? Math.max(1, Math.round(total * 24 * (1 - studyShare))) : at >= 2 ? pick(id, 'mgr', 24, 600) : null

  const level = decided && row.amountGranted > 0 ? levelFor(row.amountGranted) : null

  return {
    study,
    manager,
    exec: level === 'المدير التنفيذي' || level === 'اللجنة التنفيذية' || level === 'مجلس الأمناء'
      ? pick(id, 'exec', 24, 480)
      : null,
    committee: level === 'اللجنة التنفيذية' || level === 'مجلس الأمناء' ? pick(id, 'cmt', 168, 1_100) : null,
    agreement: at >= 2 ? pick(id, 'agr', 72, 900) : null,
    payout: at >= 5 ? pick(id, 'pay', 48, 700) : null,
    closing: at >= ORDER.indexOf('طلب التقرير الختامي') ? pick(id, 'cls', 240, 1_600) : null,
    /* A repeat round is the exception, not the rule. Items in "project data completion" have
       genuinely been sent back at least once — the section itself is the evidence. The rest get a
       lower rate: the audit found this section small relative to the portfolio. */
    toEntity: row.stage === 'استكمال بيانات المشروع'
      ? (hash(`${id}:te`) < 0.25 ? 2 : 1)
      : hash(`${id}:te2`) < 0.06
        ? 2
        : hash(`${id}:te2`) < 0.24
          ? 1
          : 0,
    toSupervisor: at >= 2 && hash(`${id}:ts`) < 0.18 ? 1 : 0,
    transferred: hash(`${id}:tr`) < 0.12,
    decidedBy: level,
    firstPass: hash(`${id}:fp`) < 0.62,
    reservedFirstPass: hash(`${id}:rs`) < 0.78,
  }
}

/** Journey per row · computed once */
export const journeys: Map<string, Journey> = new Map(
  projectRows.map((r) => [r.id, journeyOf(r)]),
)
