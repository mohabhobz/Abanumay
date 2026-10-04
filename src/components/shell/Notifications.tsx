import { useFlow } from '@/data/intake/flow'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Logo from '@/assets/LogoColor'
import { DateText, EntityMark, Face, Icon, icons } from '@/components/ui'
import { buildNotes, isRead, markRead, NOTE_GROUPS, useReadSet, type NoteFrom } from '@/data/notifications'

/** The card's leading mark: sender photo, entity/project logo, or the Abanumay mark for the system. */
function NoteMark({ from }: { from: NoteFrom }) {
  if (from.type === 'person') return <span className="nmark"><Face name={from.name} size="lg" /></span>
  if (from.type === 'system') return <span className="nmark nmark-sys" aria-hidden="true"><Logo /></span>
  if (from.type === 'project' && !from.logo) {
    return <span className="nmark ec-init ec-mark" aria-hidden="true"><Icon name={icons.navProjects} /></span>
  }
  return <span className="nmark"><EntityMark logo={from.logo} /></span>
}

/**
 * Notification bell and drawer.
 * On desktop the bell is a rail item above the avatar; on mobile it sits in the top header
 * (`place="top"`). Its number is the unread count.
 * **The drawer belongs to the floating-layer family**: it covers rather than raises, with a scrim
 * behind it; it opens from the left edge (inline-end in RTL) on every screen size, away from the
 * rail, so the navigation stays readable beside it. Escape and the scrim close it; focus is
 * trapped inside and returns to the bell.
 * **Each notification is a card.** Unread and read differ by the card's background (a light brand
 * tint vs. the neutral surface) and by weight, never by colored text or a dot. The card leads with
 * who it's from and puts the date under the description.
 */
export function NotificationBell({ user, place = 'rail' }: { user: { name: string }; place?: 'rail' | 'top' }) {
  const [open, setOpen] = useState(false)
  /* Intake actions add notes while the app is open · re-read when one runs */
  const flowV = useFlow()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notes = useMemo(() => buildNotes(user), [user, flowV])
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
        className={`${place === 'rail' ? 'railitem ' : 'nbell-top '}nbell${open ? ' on' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="nbell-ic">
          <Icon name={icons.bell} active={open} />
          {unread > 0 && <b className="nbadge num" aria-hidden="true">{unread}</b>}
        </span>
        {place === 'rail' && <span className="rail-l">الإشعارات</span>}
        {place === 'rail' && <span className="rail-tip">{label}</span>}
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
                              className={`ncard${fresh ? ' unread' : ''}`}
                              onClick={() => { markRead([n.id]); setOpen(false) }}
                            >
                              <NoteMark from={n.from} />
                              <span className="ncard-b">
                                <span className="nrow-t">{n.title}</span>
                                <span className="nrow-c">{n.context}</span>
                                <span className="nrow-d"><DateText>{n.at}</DateText></span>
                              </span>
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
