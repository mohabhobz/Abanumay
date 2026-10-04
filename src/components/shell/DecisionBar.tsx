import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, MenuOpt, MenuPanel, Money, icons } from '@/components/ui'
import { useMenu } from '@/hooks/useMenu'
import { useProximity } from '@/hooks/useProximity'
import { Avatar } from './Avatar'
import type { CurrentUser, DecisionAction } from '@/types/domain'

export interface DecisionBarProps {
  user: CurrentUser
  project: { name: string; amount: number }
  /** Shortens the sentence on narrow screens. */
  compact?: boolean
  /** The page has reached its end, so the blur gradient above the bar fades out. */
  atEnd?: boolean
  /** A role-specific step shown before the actions · the grants manager's budget link */
  lead?: ReactNode
  /** The project sits at another seat · the bar says where instead of offering buttons (B-5) */
  hold?: string
  /** Runs the confirmed decision · returns the reasons it can't run yet, which the sheet shows */
  onDecide?: (a: DecisionAction, note: string) => string[] | void
  /** An action with its own form (a transfer picks a domain and a supervisor) · true = handled */
  intercept?: (a: DecisionAction) => boolean
  /** Shown in the sheet under the project line · the context of this seat's decision */
  context?: ReactNode
}

/**
 * Decision bar — fixed at the bottom of the screen, holding the amount and the role's actions.
 * Responds to the mouse before you reach it by rising, and the light follows the cursor's position.
 */
export function DecisionBar({ user, project, compact, atEnd, lead, hold, onDecide, intercept, context }: DecisionBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const more = useMenu<HTMLDivElement>()
  const moreBtn = useRef<HTMLButtonElement>(null)
  /* A phone fits three buttons in the bar. Past that, the main action (and the role's lead step)
     stay in the bar and the rest move into a "more" menu, instead of a row that scrolls sideways
     with its last button cut off. */
  /* On a wide screen the bar holds four controls; a seat with more options (the grants manager's:
     decide, add a plan, edit amounts, return, decline) keeps the first ones and folds the rest,
     instead of wrapping the bar onto a second line. */
  const room = compact ? 3 : 4
  const fold = user.actions.length + (lead ? 1 : 0) > room
  const keep = compact ? 1 : room - 1 - (lead ? 1 : 0)
  const shown = fold ? user.actions.slice(0, keep) : user.actions
  const rest = fold ? user.actions.slice(keep) : []

  /* Meeting 1 Oct (F-5) · a decision is confirmed, never taken by one tap. On a phone the
     confirmation is a bottom sheet within the thumb's reach; it restates the project and amount
     (the context a small screen hides), and a return, decline or rejection needs its reason
     written — the decision note mobile approval inboxes make mandatory for the negative paths. */
  const [pick, setPick] = useState<DecisionAction | null>(null)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const needsNote = (a: DecisionAction) => a.kind === 'btn-d' || /إعادة|اعتذار|رفض|استكمال/.test(a.label)
  const [why, setWhy] = useState<string[]>([])
  const open = (a: DecisionAction) => {
    if (intercept?.(a)) return
    setPick(a); setNote(''); setWhy([])
  }
  const confirm = (a: DecisionAction) => {
    const blocked = onDecide?.(a, note.trim())
    if (blocked && blocked.length) { setWhy(blocked); return }
    setDone(a.label)
    setPick(null)
  }

  return (
    <div className={`decdock${atEnd ? ' clear' : ''}`}>
      <div className="chrome decbar" ref={bar}>
        <div className="rowf" style={{ gap: 'var(--sp-4)', minWidth: 0 }}>
          <Avatar user={user} />
          <span className="decsent">
            {done ? (
              <>
                {done}
                <span className="decsep" />
                <span className="sub">سُجّل في سجل المشروع</span>
              </>
            ) : hold && user.actions.length === 0 ? (
              <>
                {hold}
                <span className="decsep" />
                <span className="sub">لا إجراء لك عليه في هذه المحطة</span>
              </>
            ) : compact ? (
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
          {!done && lead}
          {!done && shown.map((a) => (
            <button key={a.label} className={`btn ${a.kind}`} onClick={() => open(a)}>
              {a.label}
            </button>
          ))}
          {!done && rest.length > 0 && (
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
                    <MenuOpt key={a.label} on={false} onPick={() => { more.setOpen(false); open(a) }}>
                      {a.label}
                    </MenuOpt>
                  ))}
                </MenuPanel>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Portalled: the dock is its own stacking context (z 20), under the phone's tab bar (35) */}
      {pick && createPortal(
        <div className="bmask decsheet" role="presentation" onClick={() => setPick(null)}>
          <div
            className="chrome modal"
            role="dialog"
            aria-modal="true"
            aria-label={pick.label}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mh">
              <b>{pick.label}</b>
            </div>
            <div className="mb col">
              <p className="sub cnote">
                <b>{project.name}</b>
                <span className="decsep" />
                المبلغ <Money>{project.amount}</Money>
              </p>
              {context}
              {why.length > 0 && (
                <ul className="payq-ck decwhy">
                  {why.map((w) => (
                    <li key={w} className="no">
                      <Icon name={icons.alert} size="sm" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
              {needsNote(pick) && (
                <label className="regf">
                  <span className="lb">
                    السبب<b className="regf-r" aria-label="إلزامي">*</b>
                  </span>
                  <span className="fld">
                    <input
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      aria-label="السبب"
                      placeholder={/استكمال/.test(pick.label) ? 'ما المطلوب من الجهة · يصلها كما هو' : 'يصل مع القرار إلى صاحب الخطوة السابقة'}
                    />
                  </span>
                </label>
              )}
            </div>
            <div className="mf">
              <button
                className={`btn ${pick.kind === 'btn-d' ? 'btn-d' : 'btn-p'}`}
                disabled={needsNote(pick) && !note.trim()}
                onClick={() => confirm(pick)}
              >
                تأكيد: {pick.label}
              </button>
              <button className="btn btn-2" onClick={() => setPick(null)}>تراجع</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
