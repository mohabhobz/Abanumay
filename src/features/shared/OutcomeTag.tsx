import { Tag } from '@/components/ui'
import { OUTCOME_SAY, OUTCOME_TONE, type Outcome } from '@/data/shared/outcome'

/* Client sheet 24 Oct (#95) · the procedure's outcome · one of مكتمل / مرفوض / ملغي, in one tone per
   outcome on every page · nothing when the procedure is still under way */
export function OutcomeTag({ outcome, pending }: { outcome?: Outcome; pending?: boolean }) {
  /* In a list column the cell reads «قيد الإجراء» while under way, matching the filter's fourth option ·
     on a page header nothing shows until the procedure ends */
  if (!outcome) return pending ? <span className="sub">قيد الإجراء</span> : null
  return <span title="نتيجة الإجراء"><Tag tone={OUTCOME_TONE[outcome]}>{OUTCOME_SAY[outcome]}</Tag></span>
}
