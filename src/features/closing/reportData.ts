import { projectRows } from '@/data/mock/projects'
import type { CloseRow } from '@/types/domain'

/* The final report's data · client meeting 21 Oct · read by the editor and the review page (report.tsx) */

/** #4 · what every final report holds · the template only changes how it looks */
export const REPORT_TERMS: string[] = [
  'عدد المستفيدين الفعلي مقابل المستهدف',
  'مدة التنفيذ الفعلية',
  'الميزانية الإجمالية للمشروع ومبلغ دعم المؤسسة · المستهدف والفعلي',
  'كل مخرج متفق عليه وما تحقق منه',
  'أبرز النتائج المحققة · والتحديات إن وُجدت',
  'الشواهد · صور التنفيذ وأدلة المخرجات',
]

export type TvaKey = 'ben' | 'days' | 'total' | 'support'
export interface TvaRow { key: TvaKey; label: string; target: number; actual: number | null; money?: boolean; unit?: string }

/** #5 · #6 · the four measured rows · the target from the approved project */
export function targetRows(c: CloseRow): TvaRow[] {
  const pr = projectRows.find((p) => p.id === c.projectId)
  const r = c.report
  return [
    { key: 'ben', label: 'عدد المستفيدين', target: pr?.beneficiaries ?? 0, actual: r.beneficiaries, unit: 'مستفيد' },
    { key: 'days', label: 'مدة التنفيذ', target: pr?.durationDays ?? 0, actual: r.days, unit: 'يوم' },
    { key: 'total', label: 'الميزانية الإجمالية للمشروع', target: pr?.amountRequested ?? 0, actual: r.projectValue ?? null, money: true },
    { key: 'support', label: 'مبلغ دعم المؤسسة', target: pr?.amountGranted ?? 0, actual: r.budget, money: true },
  ]
}


/** #11 · the closing by the project's type · a regular project's report is required · a stopped one
    closes on its state's requirements · portfolios and external projects close in their own pages */
export const closeKindSay = (c: CloseRow): string =>
  c.basis === 'stopped' ? 'مشروع موقوف · متطلبات إغلاق حسب حالته' : 'مشروع عادي · تقرير ختامي إلزامي'
