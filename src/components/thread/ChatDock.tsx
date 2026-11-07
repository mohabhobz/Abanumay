import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Icon, icons } from '@/components/ui'
import { markSeen, threadOf, unreadOf, useThreads } from '@/data/thread'
import { Thread, type ThreadProps } from './Thread'
import { useProximity } from '@/hooks/useProximity'

/* The correspondence as a floating chat (client 21 Oct · #2).

   «التواصل مع الجهة» used to be a card at the very bottom of the closing page and a tab on the
   project page · the client asked for the shape of a messaging app: a button that stays on the
   screen with what's unread, and a window that opens over the page, so a note on the report is
   written while the report is in view, not after scrolling past it.

   One component on every screen that talks to the other side (the closing case, the project, the
   entity's portal) · the same thread inside it, so a message reads the same wherever it's opened.

   Placement · in the row of «اسأل أبانمي», to its right (client 7 Nov) · the decision bar takes the
   rest of the row · the window opens above the button. A portal on `body` · an ancestor with
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

  /* Client 7 Nov · the button sits in the row of «اسأل أبانمي», just to its right, at its height and
     in its style · the two read as one pair of floating buttons, the decision bar beside them ·
     measured into `--chat-x`, `--chat-b` and `--chat-h` on the root, from the ask button's own box
     (its offsets, not its rect · the ask button floats and leans to the cursor, and the pair must
     not jitter with it) · the button's width goes to `--chat-r` so the decision bar reserves it ·
     on mobile the rail is the bottom bar and the button rides the row of «اسأل أبانمي» at the
     start edge, so the stylesheet decides and nothing is written */
  useProximity(launcher)
  useEffect(() => {
    const root = document.documentElement
    const mob = window.matchMedia('(max-width:960px)')
    const VARS = ['--chat-x', '--chat-b', '--chat-h', '--chat-r']
    const clear = () => VARS.forEach((v) => root.style.removeProperty(v))
    const put = () => {
      if (mob.matches) { clear(); return }
      const ask = document.querySelector<HTMLElement>('.askfab')
      const me = launcher.current
      if (!ask || !ask.offsetHeight || !me) { clear(); return }
      const gap = parseFloat(getComputedStyle(root).getPropertyValue('--ask-gap')) * parseFloat(getComputedStyle(root).fontSize) || 10
      root.style.setProperty('--chat-x', `${Math.ceil(ask.offsetLeft + ask.offsetWidth + gap)}px`)
      root.style.setProperty('--chat-b', getComputedStyle(ask).bottom)
      root.style.setProperty('--chat-h', `${ask.offsetHeight}px`)
      root.style.setProperty('--chat-r', `${Math.ceil(me.offsetWidth + gap)}px`)
    }
    put()
    /* the bar comes and goes with the page's state · a light re-measure keeps up without observers */
    const t = window.setInterval(put, 600)
    window.addEventListener('resize', put)
    return () => { window.clearInterval(t); window.removeEventListener('resize', put); clear() }
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
        {/* Client 7 Nov · the icon alone · the name shows on hover and on focus */}
        <span className="chatfab-tip" aria-hidden="true">{title}</span>
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
