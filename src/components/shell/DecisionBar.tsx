import { useRef, type ReactNode } from 'react'
import { Icon, MenuOpt, MenuPanel, Money, icons } from '@/components/ui'
import { useMenu } from '@/hooks/useMenu'
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
  /** A role-specific step shown before the actions · the grants manager's budget link */
  lead?: ReactNode
}

/**
 * Decision bar — fixed at the bottom of the screen, holding the amount and the role's actions.
 * Responds to the mouse before you reach it by rising, and the light follows the cursor's position.
 */
export function DecisionBar({ user, project, compact, atEnd, lead }: DecisionBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const more = useMenu<HTMLDivElement>()
  const moreBtn = useRef<HTMLButtonElement>(null)
  /* A phone fits three buttons in the bar. Past that, the main action (and the role's lead step)
     stay in the bar and the rest move into a "more" menu, instead of a row that scrolls sideways
     with its last button cut off. */
  const fold = !!compact && user.actions.length + (lead ? 1 : 0) > 3
  const shown = fold ? user.actions.slice(0, 1) : user.actions
  const rest = fold ? user.actions.slice(1) : []

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
          {lead}
          {shown.map((a) => (
            <button key={a.label} className={`btn ${a.kind}`}>
              {a.label}
            </button>
          ))}
          {rest.length > 0 && (
            <div className="fsel" ref={more.box}>
              <button
                ref={moreBtn}
                type="button"
                className="btn btn-2"
                aria-haspopup="menu"
                aria-expanded={more.open}
                aria-label="إجراءات أخرى"
                onClick={() => more.setOpen((x) => !x)}
              >
                <Icon name={icons.dots} size="sm" />
              </button>
              {more.open && (
                <MenuPanel one up end float={{ anchor: moreBtn, pop: more.pop }}>
                  {rest.map((a) => (
                    <MenuOpt key={a.label} on={false} onPick={() => more.setOpen(false)}>
                      {a.label}
                    </MenuOpt>
                  ))}
                </MenuPanel>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
