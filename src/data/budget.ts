/**
 * الميزانية — القيم الخمس اللي النظام بيمسك بيها كل بند:
 * مخصص · محجوز · ملتزم به · مصروف · متبقٍ.
 *
 * المخصص رقم حقيقي من النظام العامل (٧٣٬٧٠٠٬٠٠٠ لسنة ٢٠٢٦).
 * الأربعة الباقية **محسوبة من المشاريع التجريبية**، وهي عيّنة صغيرة
 * من ٤٬٩٢٩ مشروعًا — فنسبة الاستهلاك اللي هتظهر منخفضة بطبيعتها.
 * الشاشة بتقول ده صراحة بدل ما تسيب الرقم يتقري غلط.
 */
import { projectRows } from './mock/projects'
import { YEARS } from './mock/taxonomy'
import type { ProjectRow } from '@/types/domain'

export interface BudgetLine {
  key: string
  label: string
  /** المخصص */
  allocated: number
  /** المحجوز — طلبات تحت الدراسة، لسه ما اتقرّرش فيها */
  reserved: number
  /** الملتزم به — معتمد وموقّعة اتفاقيته */
  committed: number
  /** المصروف فعلًا */
  spent: number
  /** المتبقّي = المخصص − المحجوز − الملتزم به */
  remaining: number
}

const sum = (rows: ProjectRow[], pick: (p: ProjectRow) => number) =>
  rows.reduce((s, p) => s + pick(p), 0)

function line(key: string, label: string, allocated: number, rows: ProjectRow[]): BudgetLine {
  const reserved = sum(rows.filter((p) => p.statusGroup === 'في الدراسة'), (p) => p.amountRequested)
  const committed = sum(rows.filter((p) => p.supportStatus === 'معتمد'), (p) => p.amountGranted)
  const spent = sum(rows, (p) => p.amountSpent)
  return {
    key,
    label,
    allocated,
    reserved,
    committed,
    spent,
    remaining: allocated - reserved - committed,
  }
}

/** ميزانية سنة كاملة */
export function budgetForYear(yearId = '2026-f'): BudgetLine {
  const year = YEARS.find((y) => y.id === yearId) ?? YEARS[0]
  return line(year.id, year.label, year.budget, projectRows.filter((p) => p.year === year.id))
}

/**
 * توزيع الميزانية على المسارات.
 * المخصص لكل مسار غير معلوم في النظام العامل (ما وصلناش لشجرة
 * التخصيص)، فبنقسّمه بالتساوي مؤقتًا — سؤال قائم لمظفر.
 */
export function budgetByTrack(yearId = '2026-f'): BudgetLine[] {
  const year = YEARS.find((y) => y.id === yearId) ?? YEARS[0]
  const rows = projectRows.filter((p) => p.year === year.id)
  const tracks = [...new Set(rows.map((p) => p.track))]
  const share = tracks.length ? Math.round(year.budget / tracks.length) : 0
  return tracks
    .map((t) => line(t, t, share, rows.filter((p) => p.track === t)))
    .sort((a, b) => b.committed - a.committed)
}
