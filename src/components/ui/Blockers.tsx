import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Glass, Head, Num, Tag } from './primitives'
import { Icon } from './Icon'
import { icons } from './icons'
import { MISSING_ITEM, nounAfter } from '@/lib/format'

export interface Blocker {
  /** Where the blocker points (e.g. "agreement data") — optional. */
  head?: ReactNode
  text: ReactNode
  /** A reason or reference on the opposite side of the line. */
  why?: ReactNode
  /** How many items are missing inside this line (a section's fields) — default 1. */
  n?: number
}

/** A single count — the tag and the dock read it from here, so they never diverge. */
export const blockerCount = (items: Blocker[]): number =>
  items.reduce((s, b) => s + (b.n ?? 1), 0)

/**
 * "What blocks sending" card — **one version** for the whole system.
 * ⚠️ There used to be three versions of the same role: a text tag ("complete"), a number bubble
 * with no word ("6"), a bold list. Worse, the first one said "complete, ready to send" over an
 * **empty** tree with sending disabled.
 * Three explicit states, each with its own tag and sentence:
 *   - `empty`: no content to check yet — "start with..." rather than "complete"
 *   - blockers: counted in words, plus the list
 *   - ready: `ready`, stated only when there's content and nothing is blocking
 */
export function Blockers({
  items, ready, empty, title = 'ما يمنع الإرسال', noun = MISSING_ITEM,
}: {
  items: Blocker[]
  /** The count — must match the send-button's own count on the same screen. */
  noun?: { one: string; few: string; many: string }
  ready: ReactNode
  /** Content that doesn't exist yet — overrides "ready." */
  empty?: ReactNode
  title?: string
}) {
  /* ⚠️ **The count is items, not sections.** The tag used to count lines ("5 notes") while the dock
     counted fields ("13") for the same thing. Now both use the same shared count and the same unit. */
  const n = blockerCount(items)
  const tag = empty
    ? <Tag tone="mute">لا محتوى بعد</Tag>
    : n
      ? <Tag tone="warn"><Num>{n}</Num> {nounAfter(n, noun)}</Tag>
      : <Tag tone="ok">جاهز للإرسال</Tag>
  return (
    <Glass>
      <Head title={title} meta={tag} />
      {empty
        ? <p className="sub cnote">{empty}</p>
        : n === 0
          ? <p className="sub cnote">{ready}</p>
          : (
            <ul className="blockers">
              {items.map((b, k) => (
                <li key={k}>
                  <Icon name={icons.alert} size="sm" />
                  <span>{b.head && <><b>{b.head}</b> · </>}{b.text}</span>
                  {b.why && <span className="payq-r">{b.why}</span>}
                </li>
              ))}
            </ul>
          )}
    </Glass>
  )
}

/**
 * Why sending is disabled, **next to the button** in the decision bar.
 * The disabled button used to be silent (an enabled-looking label next to a grayed-out button),
 * with the count sitting far up the page. The correct version existed only on one screen; now it's
 * the same everywhere there's a dock.
 *
 * Client 23 Oct (the recording · 37:02) · «ما يمنع» opens in a popup from the action bar, not as a
 * card inside the page · given its `items`, the count is a button that opens them, each with where it
 * points · every action on a screen sits in the bar.
 */
export function DockWhy({ n, noun = MISSING_ITEM, items, title = 'ما يمنع الإرسال', label = 'قبل الإرسال' }: {
  n: number
  noun?: { one: string; few: string; many: string }
  items?: Blocker[]
  title?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  if (n <= 0) return null
  return (
    <>
      <span className="decsep" />
      {/* "13 missing items missing" used to say "missing" twice — this phrasing works with any
          count (items, notes) and uses the same word as the card's own tag. */}
      {items?.length
        ? <button type="button" className="lnk" onClick={() => setOpen(true)}>{title} · <Num>{n}</Num> {nounAfter(n, noun)}</button>
        : <span className="sub">{label}: <Num>{n}</Num> {nounAfter(n, noun)}</span>}
      {open && items && <StopsPopup title={title} items={items} noun={noun} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The blockers in a popup · the one list, the same lines as the card */
export function StopsPopup({ title, items, noun = MISSING_ITEM, onClose, foot }: {
  title: string
  items: Blocker[]
  noun?: { one: string; few: string; many: string }
  onClose: () => void
  foot?: ReactNode
}) {
  const n = blockerCount(items)
  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="chrome modal modal-w" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mh"><Icon name={icons.alert} size="md" /><b>{title}</b>{n > 0 && <Tag tone="warn"><Num>{n}</Num> {nounAfter(n, noun)}</Tag>}</div>
        <div className="mb col">
          <ul className="blockers" onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) onClose() }}>
            {items.map((b, k) => (
              <li key={k}>
                <Icon name={icons.alert} size="sm" />
                <span>{b.head && <><b>{b.head}</b> · </>}{b.text}</span>
                {b.why && <span className="payq-r">{b.why}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="mf">{foot}<button type="button" className="btn btn-2" onClick={onClose}>إغلاق</button></div>
      </div>
    </div>,
    document.body,
  )
}
