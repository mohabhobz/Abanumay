import { projectRows } from '@/data/mock/projects'
import { payRequests } from '@/data/mock/disbursements'
import { agreements } from '@/data/mock/agreements'
import { closeRows } from '@/data/mock/closing'
import { planRows, planDone } from '@/data/mock/plans'
import { entityRows } from '@/data/mock/entities'
import { grantOf, paidToDate } from '@/data/closing/store'
import { SAUDI_REGIONS } from '@/components/charts/saudi-regions'
import type { Reading } from '@/components/assistant/reading'
import type { IconName } from '@/components/ui'
import type { ProjectStatusGroup } from '@/types/domain'
import { nf } from '@/lib/format'

/* The glass board's numbers (trial · client, 6 Oct).

   Every figure is computed from the same rows the module screens show, so the board can't drift
   from them: grants and regions from the project list, money paid from the closing store's
   `paidToDate` (which already counts projects paid before the system), plans from the weighted
   plan completion, agreements and closings from their own stages. Nothing here is typed by hand. */

const live = () => projectRows.filter((p) => !p.archived && p.type !== 'محفظة')
const funded = (g: ProjectStatusGroup) => g === 'في التشغيل' || g === 'مكتمل' || g === 'متعثر'

export interface RingDatum { key: string; label: string; value: number; part: number; whole: number; unit: string; icon: IconName; hue: 1 | 2 | 3 | 4 | 5 }
export interface RegionDatum { name: string; projects: number; granted: number; beneficiaries: number; entities: number; stages: { key: ProjectStatusGroup; n: number }[] }
export interface WaveSeries { key: string; label: string; hue: 2 | 4 | 5; values: number[] }

export const STAGE_ORDER: ProjectStatusGroup[] = ['في الدراسة', 'في التشغيل', 'متعثر', 'مكتمل', 'معتذر عنه']

export function boardTotals() {
  const ps = live()
  const fundedRows = ps.filter((p) => funded(p.statusGroup))
  const granted = fundedRows.reduce((s, p) => s + grantOf(p.id), 0)
  const paid = fundedRows.reduce((s, p) => s + Math.min(grantOf(p.id), paidToDate(p.id)), 0)
  return {
    projects: ps.length,
    funded: fundedRows.length,
    granted,
    paid,
    entities: entityRows.length,
    beneficiaries: ps.reduce((s, p) => s + p.beneficiaries, 0),
    regions: new Set(ps.map((p) => p.region).filter((r) => SAUDI_REGIONS.some((x) => x.name === r))).size,
  }
}

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export function boardRings(): RingDatum[] {
  const t = boardTotals()
  const plans = planRows.length
  const planAvg = plans ? Math.round(planRows.reduce((s, p) => s + planDone(p), 0) / plans) : 0
  const plansDone = planRows.filter((p) => planDone(p) >= 100).length
  const agrLive = agreements.filter((a) => a.stage !== 'cancelled')
  const agrActive = agrLive.filter((a) => a.stage === 'active').length
  const closed = closeRows.filter((c) => c.stage === 'closed').length
  return [
    { key: 'paid', label: 'وصل للجهات من المنح', value: share(t.paid, t.granted), part: t.paid, whole: t.granted, unit: 'ريال', icon: 'pay', hue: 2 },
    { key: 'plans', label: 'متوسط إنجاز الخطط', value: planAvg, part: plansDone, whole: plans, unit: 'خطة مكتملة', icon: 'plan', hue: 4 },
    { key: 'agr', label: 'اتفاقيات سارية', value: share(agrActive, agrLive.length), part: agrActive, whole: agrLive.length, unit: 'اتفاقية', icon: 'contract', hue: 5 },
    { key: 'close', label: 'إغلاقات مكتملة', value: share(closed, closeRows.length), part: closed, whole: closeRows.length, unit: 'إغلاق', icon: 'navClosings', hue: 3 },
  ]
}

const regionOf = (name: string, rows: ReturnType<typeof live>): RegionDatum => ({
  name,
  projects: rows.length,
  granted: rows.filter((p) => funded(p.statusGroup)).reduce((s, p) => s + p.amountGranted, 0),
  beneficiaries: rows.reduce((s, p) => s + p.beneficiaries, 0),
  entities: new Set(rows.map((p) => p.entityId)).size,
  stages: STAGE_ORDER.map((k) => ({ key: k, n: rows.filter((p) => p.statusGroup === k).length })),
})

export function boardRegions(): RegionDatum[] {
  const ps = live()
  return SAUDI_REGIONS.map((r) => regionOf(r.name, ps.filter((p) => p.region === r.name)))
    .sort((a, b) => b.granted - a.granted || b.projects - a.projects)
}

/** The whole Kingdom in the same shape as a region · what the details column shows when no region
    is picked (projects marked «عموم المملكة» count here, though they sit on no region) */
export const boardKingdom = (): RegionDatum => regionOf('المملكة العربية السعودية', live())

/** Eighteen months ending with the last full one · the current month is still filling, so a
    wave ending on it would always dip to zero at the edge */
export function boardMonths(now = new Date()): string[] {
  const out: string[] = []
  for (let i = 18; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function boardWaves(months: string[]): WaveSeries[] {
  const ps = live()
  const per = (dates: (string | undefined)[]) => months.map((m) => dates.filter((d) => d?.slice(0, 7) === m).length)
  return [
    { key: 'in', label: 'طلبات المنح الواردة', hue: 2, values: per(ps.map((p) => p.submittedAt)) },
    { key: 'dec', label: 'قرارات المنح', hue: 5, values: per(ps.map((p) => p.decidedAt)) },
    { key: 'pay', label: 'طلبات الصرف', hue: 4, values: per(payRequests.map((r) => r.at)) },
  ]
}

/** The assistant's column on the board · three readings from the same numbers */
export function boardReadings(): Reading[] {
  const t = boardTotals()
  const regs = boardRegions()
  const top = regs.slice(0, 3)
  const topShare = share(top.reduce((s, r) => s + r.granted, 0), regs.reduce((s, r) => s + r.granted, 0))
  const empty = regs.filter((r) => r.projects === 0).map((r) => r.name)
  const stalled = live().filter((p) => p.statusGroup === 'متعثر').length
  const out: Reading[] = [
    {
      id: 'gb-paid', kind: 'note', label: 'الصرف',
      metric: { value: nf.format(t.granted - t.paid), unit: 'ريال لم يُصرف بعد' },
      text: `من ${nf.format(t.granted)} ممنوحة لـ${nf.format(t.funded)} مشروعًا مموَّلًا.`,
      src: 'قيمة المنحة ناقص المصروف حتى الآن',
    },
    {
      id: 'gb-conc', kind: topShare >= 60 ? 'flag' : 'note', label: 'تركّز جغرافي',
      metric: { value: String(topShare), unit: 'بالمئة في 3 مناطق' },
      text: `${top.map((r) => r.name).join(' و')} تستحوذ على معظم المنح${empty.length ? ` · ولا مشروع في ${empty.join(' و')}` : ''}.`,
      src: 'المنح المعتمدة حسب منطقة المشروع',
    },
  ]
  if (stalled) out.push({ id: 'gb-stall', kind: 'flag', label: 'تعثّر', metric: { value: String(stalled), unit: stalled === 1 ? 'مشروع' : 'مشاريع' }, text: 'في مجموعة «متعثر» · راجع حالات التعثر.', src: '10.9' })
  return out
}
