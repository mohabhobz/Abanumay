/**
 * السلاسل والتجميعات اللي الداشبورد بيرسمها.
 *
 * محسوبة من نفس الصفوف اللي الشاشات بتعرضها — مفيش أرقام مكتوبة
 * بالإيد هنا. لما الباك اند يجهز، الملف ده يا يفضل زي ما هو (بيجمّع
 * الصفوف اللي رجعت) يا يتحوّل لـ`GET /analytics/*` بنفس الشكل.
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

/** الوسيط — أصدق من المتوسط لما فيه صفوف شاذّة، وهي موجودة هنا */
export const median = (values: number[]): number => {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

const days = (hours: number) => Math.round(hours / 24)

/* ═══ حالة المحفظة ═══ */

export const byStatusGroup = (rows: ProjectRow[]): Bucket[] =>
  STATUS_GROUPS.map((g) => ({
    key: g,
    label: g,
    value: rows.filter((r) => r.statusGroup === g).length,
  }))

/** الأقسام الإجرائية الحيّة فقط، بترتيب مسار المشروع لا بترتيب العدد */
export const byStage = (rows: ProjectRow[]): Bucket[] => {
  const counts = tally(rows, (r) => r.stage)
  return STAGES.filter((s) => s.limit > 0 && counts.get(s.stage))
    .map((s) => ({ key: s.stage, label: s.stage, value: counts.get(s.stage) ?? 0 }))
}

/** الملتزم به لكل مسار — التوزيع المالي مش عدد المشاريع */
export const grantedByTrack = (rows: ProjectRow[]): Bucket[] =>
  toBuckets(sumBy(rows.filter((r) => r.amountGranted > 0), (r) => r.track, (r) => r.amountGranted))

export const byRegion = (rows: ProjectRow[], limit = 6): Bucket[] =>
  toBuckets(tally(rows, (r) => r.region), limit)

export const declineReasons = (rows: ProjectRow[], limit = 5): Bucket[] =>
  toBuckets(tally(rows, (r) => r.declineReason), limit)

/* ═══ الزمن — أهم قراءة في الأوديت ═══ */

/**
 * توزيع مدة المكوث في القسم الحالي.
 * الفئات مختارة على حدود قرار: أسبوعين مقبول، شهر يستدعي سؤالًا،
 * وفوق الشهرين يبقى المشروع واقف مش ماشي.
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
  /** تحت الدراسة */
  value: number
  /** وسيط أيام المكوث عنده */
  medianDays: number
  overdue: number
}

/** حمل المشرفين — الاختلال بيظهر في مدد الانتظار قبل أي تقرير */
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

/* ═══ الشركاء ═══ */

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

/** أعلى الجهات دعمًا — التركّز مؤشر أثر ومخاطرة في نفس الوقت */
export const topEntities = (rows: ProjectRow[], limit = 5): Bucket[] =>
  toBuckets(
    sumBy(rows.filter((r) => r.amountGranted > 0), (r) => r.entityName, (r) => r.amountGranted),
    limit,
  )
