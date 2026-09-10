import { useRef } from 'react'
import { Money } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { Avatar } from './Avatar'
import type { CurrentUser } from '@/types/domain'

export interface DecisionBarProps {
  user: CurrentUser
  project: { name: string; amount: number }
  /** يختصر الجملة على الشاشات الضيقة */
  compact?: boolean
  /** الصفحة وصلت آخرها، فتدرّج البلور فوق الشريط بيروح */
  atEnd?: boolean
}

/**
 * شريط القرار — ثابت أسفل الشاشة، فيه المبلغ ومخارج الدور.
 * بيحسّ بالماوس قبل ما توصله فيرتفع، والضوء بيتبع مكان المؤشر.
 */
export function DecisionBar({ user, project, compact, atEnd }: DecisionBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  return (
    <div className={`decdock${atEnd ? ' clear' : ''}`}>
      <div className="chrome decbar" ref={bar}>
        <div className="rowf" style={{ gap: '.7rem', minWidth: 0 }}>
          <Avatar user={user} />
          <span className="decsent">
            {compact ? (
              <>
                اتخذ إجراءً · <Money>{project.amount}</Money>
              </>
            ) : (
              <>
                اتخذ إجراءً لـ <b>{project.name}</b>
                <span className="decsep" />
                المبلغ <Money>{project.amount}</Money>
              </>
            )}
          </span>
        </div>

        <div className="rowf" style={{ gap: '.5rem' }}>
          {user.actions.map((a) => (
            <button key={a.label} className={`btn ${a.kind}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
