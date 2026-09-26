import { NOUN, nounAfter, pct } from '@/lib/format'
import { Num } from '@/components/ui/primitives'
import type { Kpi } from '@/data/kpi'

/**
 * Metric value with its unit.
 *
 * The percent sign sits in one LTR island with its number (`pct()`, with
 * Unicode isolation marks), while the word "days" stays outside the
 * island because it's part of the Arabic sentence — both used to be
 * inside `.num`, which wrapped the word incorrectly.
 */
export function KpiValue({ kpi }: { kpi: Kpi }) {
  if (kpi.value === null) return <em className="ind-none"> </em>

  /* The LTR island wraps only the number. `.num` used to cover the whole
     value, wrapping the Arabic unit inside an LTR island: "68day" · "8 %".
     The percent sign now comes from `pct()` (isolated with its number), and
     "days" is a word in the Arabic sentence flow after `<Num>`, pluralized correctly. */
  return (
    <b className="ind-v">
      {kpi.unit === 'pct' ? <Num>{pct(kpi.value)}</Num> : <Num>{kpi.value}</Num>}
      {kpi.unit === 'days' && <small> {nounAfter(kpi.value, NOUN.day)}</small>}
    </b>
  )
}
