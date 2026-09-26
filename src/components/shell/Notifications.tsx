import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { DateText, Icon, icons } from '@/components/ui'
import { buildNotes, isRead, markRead, NOTE_GROUPS, useReadSet } from '@/data/notifications'

/**
 * Notification bell and drawer.
 * **The bell is an item on the rail** above the avatar — present on every page (and in the
 * assistant's rail too), and on mobile it's its own slot in the bottom bar with no extra line. Its
 * number is the unread count.
 * **The drawer belongs to the floating-layer family**: it covers rather than raises, with a scrim
 * behind it; opens from the leading edge (the right in RTL, the same side as the bell); Escape and
 * the scrim close it; focus is trapped inside and returns to the bell.
 * **Quiet by rule:** no colored text or tags — unread is marked by a dot (shape) and weight (bolder
 * text), read is dimmer ink. Status sits in the group heading.
 */
export function NotificationBell({ user }: { user: { name: string } }) {
  const [open, setOpen] = useState(false)
  const notes = useMemo(() => buildNotes(user), [user])
  const read = useReadSet()
  const unread = notes.filter((n) => !isRead(n, read)).length
  const bell = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = () => { setOpen(false); bell.current?.focus() }

  useEffect(() => {
    if (!open) return
    /* First focusable element inside the drawer — the "mark all" button, or the close control. */
    panel.current?.querySelector<HTMLElement>('button,a[href]')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /* Focus trap — Tab from the last item returns to the first, and vice versa. */
  const trap = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panel.current) return
    const f = [...panel.current.querySelectorAll<HTMLElement>('button,a[href]')]
    if (!f.length) return
    const [first, last] = [f[0], f[f.length - 1]]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const label = unread ? `الإشعارات · ${unread} غير مقروء` : 'الإشعارات'

  return (
    <>
      <button
        ref={bell}
        type="button"
        className={`railitem nbell${open ? ' on' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="nbell-ic">
          <Icon name={icons.bell} active={open} />
          {unread > 0 && <b className="nbadge num" aria-hidden="true">{unread}</b>}
        </span>
        <span className="rail-l">الإشعارات</span>
        <span className="rail-tip">{label}</span>
      </button>

      {open && createPortal(
        <div className="nscrim" role="presentation" onClick={close}>
          <div
            ref={panel}
            className="ndrawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ndrawer-t"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trap}
          >
            <header className="ndrawer-h">
              <div className="ndrawer-tt">
                <h2 id="ndrawer-t">الإشعارات</h2>
                <span className="sub">{unread ? `${unread} غير مقروء` : 'كلها مقروءة'}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!unread}
                onClick={() => markRead(notes.map((n) => n.id))}
              >
                <Icon name={icons.checks} size="sm" />
                علّم الكل كمقروء
              </button>
              <button type="button" className="aclose" onClick={close} aria-label="إغلاق الإشعارات" title="إغلاق">
                <Icon name={icons.close} size="sm" />
              </button>
            </header>

            <div className="ndrawer-b">
              {NOTE_GROUPS.map((g) => {
                const rows = notes.filter((n) => n.kind === g.kind)
                if (!rows.length) return null
                return (
                  <section key={g.kind} className="ngroup" aria-labelledby={`ng-${g.kind}`}>
                    <h3 id={`ng-${g.kind}`} className="ngroup-h">
                      {g.label}
                      <span className="num">{rows.length}</span>
                    </h3>
                    <ul className="nlist">
                      {rows.map((n) => {
                        const fresh = !isRead(n, read)
                        return (
                          <li key={n.id}>
                            <Link
                              to={n.to}
                              className={`nrow${fresh ? ' unread' : ''}`}
                              onClick={() => { markRead([n.id]); setOpen(false) }}
                            >
                              <i className="ndot" aria-hidden="true" />
                              <span className="nrow-t">{n.title}</span>
                              <span className="nrow-c">{n.context}</span>
                              <span className="nrow-d"><DateText>{n.at}</DateText></span>
                              {fresh && <span className="nsr">غير مقروء</span>}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
