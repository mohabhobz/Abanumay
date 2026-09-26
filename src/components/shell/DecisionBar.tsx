import { useRef } from 'react'
import { Money } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { Avatar } from './Avatar'
import type { CurrentUser } from '@/types/domain'

export interface DecisionBarProps {
  user: CurrentUser
  project: { name: string; amount: number }
  /** Shortens the sentence on narrow screens. */
  compact?: boolean
  /** The page has reached its end, so the blur gradient above the bar fades out. */
  atEnd?: boolean
}

/**
 * Decision bar — fixed at the bottom of the screen, holding the amount and the role's actions.
 * Responds to the mouse before you reach it by rising, and the light follows the cursor's position.
 */
export function DecisionBar({ user, project, compact, atEnd }: DecisionBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  return (
    <div className={`decdock${atEnd ? ' clear' : ''}`}>
      <div className="chrome decbar" ref={bar}>
        <div className="rowf" style={{ gap: 'var(--sp-4)', minWidth: 0 }}>
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

        <div className="rowf gp-2">
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
