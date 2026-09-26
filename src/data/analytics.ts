/**
 * The series and aggregations the dashboard renders.
 *
 * Computed from the same rows the screens display — nothing here is hand-typed. Once the backend is
 * ready, this file either stays as-is (aggregating rows that come back) or turns into `GET
 * /analytics/*` with the same shape.
 */
import type { EntityRow, ProjectRow } from '@/types/domain'
import { stagePressure, ENTITY_DOCS_TOTAL } from './repository'
import { STAGES, STATUS_GROUPS } from './mock/taxonomy'

export interface Bucket {
  key: string
  label: string
  value: number
}

const tally = <T>(rows: T[], key: (r: T) => string | null | undefined) => {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

const sumBy = <T>(rows: T[], key: (r: T) => string | null | undefined, val: (r: T) => number) => {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + val(r))
  }
  return m
}

const toBuckets = (m: Map<string, number>, limit?: number): Bucket[] =>
  [...m.entries()]
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)

/** Median · more reliable than the mean when there are outlier rows, and there are some here */
export const median = (values: number[]): number => {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

const days = (hours: number) => Math.round(hours / 24)

/* Portfolio status */

export const byStatusGroup = (rows: ProjectRow[]): Bucket[] =>
  STATUS_GROUPS.map((g) => ({
    key: g,
    label: g,
    value: rows.filter((r) => r.statusGroup === g).length,
  }))

/** Only live procedural sections, ordered by the project's stage path, not by count */
export const byStage = (rows: ProjectRow[]): Bucket[] => {
  const counts = tally(rows, (r) => r.stage)
  return STAGES.filter((s) => s.limit > 0 && counts.get(s.stage))
    .map((s) => ({ key: s.stage, label: s.stage, value: counts.get(s.stage) ?? 0 }))
}

/** Committed amount per track · the financial split, not the project count */
export const grantedByTrack = (rows: ProjectRow[]): Bucket[] =>
  toBuckets(sumBy(rows.filter((r) => r.amountGranted > 0), (r) => r.track, (r) => r.amountGranted))

/** Every region with projects · the map needs all of them, not just the top ones */
export const byRegion = (rows: ProjectRow[], limit?: number): Bucket[] =>
  toBuckets(tally(rows, (r) => r.region), limit)

export const declineReasons = (rows: ProjectRow[], limit = 5): Bucket[] =>
  toBuckets(tally(rows, (r) => r.declineReason), limit)

/* Time · the most important reading in the audit */

/**
 * Distribution of time spent in the current stage.
 * Buckets are chosen at decision boundaries: two weeks is fine, a month raises a question, and past
 * two months the project counts as stalled, not progressing.
 */
export const ageingBuckets = (rows: ProjectRow[]): Bucket[] => {
  const live = rows.filter((r) => r.stageLimit > 0)
  const edges: [string, (d: number) => boolean][] = [
    ['0–7', (d) => d <= 7],
    ['8–15', (d) => d > 7 && d <= 15],
    ['16–30', (d) => d > 15 && d <= 30],
    ['31–60', (d) => d > 30 && d <= 60],
    ['+60', (d) => d > 60],
  ]
  return edges.map(([label, test]) => ({
    key: label,
    label,
    value: live.filter((r) => test(days(r.hoursInStage))).length,
  }))
}

export interface OwnerLoad {
  key: string
  label: string
  /** Under review */
  value: number
  /** Median days spent there */
  medianDays: number
  overdue: number
}

/** Reviewer workload · imbalance shows up in wait times before any report does */
export const ownerLoad = (rows: ProjectRow[]): OwnerLoad[] => {
  const live = rows.filter((r) => r.statusGroup === 'في الدراسة')
  const names = [...new Set(live.map((r) => r.owner ?? 'بلا مالك'))]
  return names
    .map((name) => {
      const mine = live.filter((r) => (r.owner ?? 'بلا مالك') === name)
      return {
        key: name,
        label: name,
        value: mine.length,
        medianDays: median(mine.map((r) => days(r.hoursInStage))),
        overdue: mine.filter((r) => stagePressure(r) > 1).length,
      }
    })
    .sort((a, b) => b.value - a.value)
}

/* Partners */

export interface EntityHealth {
  ready: number
  incomplete: number
  held: number
  stalled: number
}

export const entityHealth = (entities: EntityRow[]): EntityHealth => ({
  ready: entities.filter(
    (e) => e.docsUploaded >= ENTITY_DOCS_TOTAL && e.activation === 'مقبول',
  ).length,
  incomplete: entities.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL).length,
  held: entities.filter((e) => e.activation.startsWith('معلق')).length,
  stalled: entities.filter((e) => e.projectsStalled > 0).length,
})

/** Top-funded entities · concentration is both an impact signal and a risk signal */
export const topEntities = (rows: ProjectRow[], limit = 5): Bucket[] =>
  toBuckets(
    sumBy(rows.filter((r) => r.amountGranted > 0), (r) => r.entityName, (r) => r.amountGranted),
    limit,
  )
