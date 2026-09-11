import { nf } from '@/lib/format'
import type { Kpi } from '@/data/kpi'

/**
 * قيمة المؤشر بوحدتها.
 *
 * الوحدة `small` مش span عادي: النسبة جوّه جملة عربية بتتقلب
 * («%94» بدل «94%») لأن خوارزمية الاتجاه بتاخد علامة النسبة على
 * اتجاه الجملة. `.num` في الـCSS بيعزل الرقم وعلامته في جزيرة
 * اتجاهها ثابت، فالوحدة لازم تفضل جوّه العنصر المعزول.
 */
export function KpiValue({ kpi }: { kpi: Kpi }) {
  if (kpi.value === null) return <em className="ind-none"> </em>

  return (
    <b className="ind-v num">
      {nf.format(kpi.value)}
      {kpi.unit === 'pct' && <small>%</small>}
      {kpi.unit === 'days' && <small> يوم</small>}
    </b>
  )
}
