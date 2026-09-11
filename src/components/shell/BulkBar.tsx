import { useRef, type ReactNode } from 'react'
import { Icon, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'

export interface BulkBarProps {
  /** عدد الصفوف المحدَّدة · بيتكتب كبيرًا قبل الجملة */
  count: number
  /** الجملة: «مشروعًا محدَّدًا · المبلغ 1,240,000 ﷼» */
  sentence: ReactNode
  /** الأزرار · إجراءات الدور وأي تحكّم إضافي */
  children?: ReactNode
  onClear: () => void
}

/**
 * شريط الإجراء المجمّع.
 *
 * **نفس شريط القرار حرفيًّا**: نفس الرصيف العايم أسفل الشاشة، نفس
 * التدرّج اللي بيذوّب المحتوى تحته، نفس الحساسية للماوس. السبب إن
 * المستخدم اتعوّد على الشكل ده في صفحة المشروع، ولمّا يعلّم صفوفًا
 * في الجدول ويلاقي نفس الشريط طالعًا يبقى عارف إن دي لحظة قرار
 * من غير ما يقرا.
 *
 * وبيطلع من تحت لفوق لأنه مش كان موجود: الحركة بتقول «ده جديد بسبب
 * اللي عملته»، والكارت اللي بيظهر فجأة في نص الصفحة بيتقري كخطأ.
 *
 * الشريط عايم فوق المحتوى، فالصفحة اللي تحته لازم تزوّد مساحة ·
 * كلاس `hasdock` على `.viewstack` بيعمل ده.
 */
export function BulkBar({ count, sentence, children, onClear }: BulkBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  return (
    <div className="decdock bulkdock">
      <div className="chrome decbar bulkbar" ref={bar}>
        <div className="rowf" style={{ gap: '.7rem', minWidth: 0 }}>
          <span className="bulkn num">{count}</span>
          <span className="decsent">{sentence}</span>
        </div>

        <div className="rowf bulkacts" style={{ gap: '.5rem' }}>
          {children}
          <button
            type="button"
            className="bulkx"
            onClick={onClear}
            aria-label="إلغاء التحديد"
            title="إلغاء التحديد"
          >
            <Icon name={icons.close} size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
