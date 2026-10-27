import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Icon, icons } from '@/components/ui'
import { markSeen, threadOf, unreadOf, useThreads } from '@/data/thread'
import { Thread, type ThreadProps } from './Thread'

/* The correspondence as a floating chat (client 21 Oct · #2).

   «التواصل مع الجهة» used to be a card at the very bottom of the closing page and a tab on the
   project page · the client asked for the shape of a messaging app: a button that stays on the
   screen with what's unread, and a window that opens over the page, so a note on the report is
   written while the report is in view, not after scrolling past it.

   One component on every screen that talks to the other side (the closing case, the project, the
   entity's portal) · the same thread inside it, so a message reads the same wherever it's opened.

   Placement · the start edge (the right, in Arabic) · the end edge is «اسأل أبانمي», and the
   decision bar runs between them along the bottom, so the button sits above the bar at the start
   edge and the window opens above the button. A portal on `body` · an ancestor with
   `backdrop-filter` would otherwise become the containing block of `position:fixed`. */

export interface ChatDockProps extends ThreadProps {
  /** The window's title · «التواصل مع الجهة» for staff, «التواصل مع المؤسسة» for the entity */
  title: string
}

export function ChatDock({ title, ...thread }: ChatDockProps) {
  useThreads()
  const [open, setOpen] = useState(false)
  const launcher = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const unread = unreadOf(thread.channel, thread.me, thread.messages)
  const total = threadOf(thread.channel, thread.messages).length

  /* Where the button sits · beside the rail at the start edge (it widens when opened and the user
     can drag it), and just above the decision bar when the page has one (the bar's own place
     depends on the page, so it's measured, not assumed) · measured into `--chat-x` and `--chat-b`
     on the root · on mobile the rail is the bottom bar and the button rides the row of
     «اسأل أبانمي», so the stylesheet decides and nothing is written */
  useEffect(() => {
    const root = document.documentElement
    const mob = window.matchMedia('(max-width:960px)')
    const put = () => {
      if (mob.matches) { root.style.removeProperty('--chat-x'); root.style.removeProperty('--chat-b'); return }
      /* client review 22 Oct · above «اسأل أبانمي» at the end edge, the column of floating
         buttons · at the start edge the button sat over the content column's labels */
      const ask = document.querySelector('.askfab')?.getBoundingClientRect()
      if (ask && ask.height > 0) {
        root.style.setProperty('--chat-x', `${Math.max(0, Math.floor(ask.left))}px`)
        root.style.setProperty('--chat-b', `${Math.ceil(window.innerHeight - ask.top) + 8}px`)
        root.style.setProperty('--chat-w', `${Math.ceil(ask.width)}px`)
      } else { root.style.removeProperty('--chat-x'); root.style.removeProperty('--chat-b'); root.style.removeProperty('--chat-w') }
    }
    put()
    /* the bar comes and goes with the page's state · a light re-measure keeps up without observers */
    const t = window.setInterval(put, 600)
    window.addEventListener('resize', put)
    return () => {
      window.clearInterval(t); window.removeEventListener('resize', put)
      root.style.removeProperty('--chat-x'); root.style.removeProperty('--chat-b'); root.style.removeProperty('--chat-w')
    }
  }, [])

  /* open · what's on it is read · the field takes the focus · Escape closes and returns focus */
  useEffect(() => {
    if (!open) return
    markSeen(thread.channel, thread.me)
    const t = window.setTimeout(() => panel.current?.querySelector('textarea')?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      /* a file preview over the window closes first */
      if (e.key !== 'Escape' || document.querySelector('.fprev')) return
      setOpen(false)
      launcher.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, thread.channel, thread.me, unread])

  return createPortal(
    <>
      <Button plain
        ref={launcher}
        type="button"
        className={`chatfab${open ? ' on' : ''}`}
        aria-expanded={open}
        aria-controls="chatpop"
        aria-label={unread ? `${title} · ${unread} غير مقروءة` : title}
        onClick={() => setOpen((x) => !x)}
      >
        <Icon name={icons.chat} size="sm" />
        <span className="chatfab-t">{title}</span>
        {unread > 0 && <b className="chatfab-n">{unread}</b>}
      </Button>

      {open && (
        <div ref={panel} id="chatpop" className="chatpop" role="dialog" aria-label={title}>
          <div className="chatpop-h">
            <span className="badge badge-30"><Icon name={icons.chat} /></span>
            <div className="chatpop-t">
              <b>{title}</b>
              <span className="sub">{thread.me === 'staff' ? thread.entityName : 'مؤسسة سليمان أبانمي'}{total ? ` · ${total} رسائل` : ''}</span>
            </div>
            <Button plain type="button" className="aclose" aria-label="أغلق المحادثة" onClick={() => { setOpen(false); launcher.current?.focus() }}>
              <Icon name={icons.close} size="sm" />
            </Button>
          </div>
          <Thread {...thread} />
        </div>
      )}
    </>,
    document.body,
  )
}
