import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, icons } from '@/components/ui'
import {
  AiMessage, Composer, Disclaimer, Welcome, useAssistant, type WelcomeCard,
} from '@/components/assistant'
import { useDockHeight } from '@/hooks/useDockHeight'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { savedChats, type SavedChat } from '@/data/mock/assistant'
import { ChatList } from './ChatList'
import { AbLeaf } from '@/components/soul'

export interface AssistantScreenProps {
  /** Header title before a conversation starts (dialog name: "Abanumay assistant"). */
  label?: string
  /** Personal welcome - constant everywhere. */
  greet: string
  /** Scope line - the only part that changes per page. */
  sub: string
  cards: WelcomeCard[]
  onClose: () => void
  /** Expand button in the header (resize toggle when the screen opens over a page). */
  headExtra?: ReactNode
  /** Cursor starts ready in the input box. */
  focusOnMount?: boolean
  /** Resets on reopening - a React key, not internal state. */
  labelledBy?: string
  /** Sidebar starts collapsed - comes from the URL on the assistant page. */
  listShut?: boolean
  onListShut?: (shut: boolean) => void
}

/**
 * The Abanumay assistant screen - one body, rendered in two places.
 *
 * There used to be two versions of the same assistant: the `/assistant` page with a chat list, a
 * large welcome, and cards, and a side panel opening from any page with a different header and no
 * chat list. So clicking "Ask Abanumay" from a project page opened something else entirely - no
 * saved conversations, and a layout unlike the one seen on first login.
 *
 * Now this component is the assistant, and the two places differ in one thing only: the frame
 * around it. A full page, or a panel over whatever page you're on. Inside both: the same list,
 * header, welcome, input, and cards.
 *
 * What changes per page is content only: the scope line ("How can I help with <x>?") and the four
 * cards. No layout is specific to a place.
 */
export function AssistantScreen({
  label, greet, sub, cards, onClose, headExtra, focusOnMount, labelledBy,
  listShut, onListShut,
}: AssistantScreenProps) {
  const mobile = useIsMobile()

  const { msgs, send: ask, stop, reset, busy } = useAssistant()
  const [chats, setChats] = useState<SavedChat[]>(savedChats)
  const [openChat, setOpenChat] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [listOpen, setListOpen] = useState(false)
  /* Note: collapse state lives in the URL when the screen is a full page - if it stayed as component
   state, the inventory would never render the sidebar collapsed, the same blind spot fixed
   elsewhere for signup steps and the partnership-type card. A panel opening over another page has
   no URL, so it falls back to state. */
  /* Closed by default - same decision as the full page (see `AssistantPage`). */
  const [shutLocal, setShutLocal] = useState(true)
  const shut = listShut ?? shutLocal
  const setShut = (x: boolean) => (onListShut ? onListShut(x) : setShutLocal(x))

  const body = useRef<HTMLDivElement>(null)
  const col = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement | null>(null)

  /* Spacing below the last message equals the input box's real, measured height. */
  useDockHeight(col)

  /* Note: the answer is read from the top. Scroll used to stick to the bottom of the conversation, so
   a long answer showed its tail with the start hidden under the header. Now every new question
   jumps to the top of the space and the answer continues below it, with no auto-scroll after that -
   anyone who wants the end has a "jump to latest" button. */
  const [atEnd, setAtEnd] = useState(true)
  useEffect(() => {
    const el = body.current
    if (!el) return
    const onScroll = () => setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 90)
    onScroll()
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  })
  const asks = msgs.filter((m) => m.who === 'me').length
  useEffect(() => {
    const el = body.current
    if (!asks || !el) return
    const mine = el.querySelectorAll<HTMLElement>('.cmsg.me')
    const last = mine[mine.length - 1]
    if (!last) return
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0
    el.scrollTo({
      top: last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - pad,
      behavior: asks > 1 ? 'smooth' : 'auto',
    })
  }, [asks])
  const toEnd = () => body.current?.scrollTo({ top: body.current.scrollHeight, behavior: 'smooth' })

  /* Note: a new conversation appears in the list under its own name. It used to be that the first
   question opened a thread simply identified as `'new'` - meaning the card a user clicked led to a
   conversation with no row of its own, so leaving it meant losing it. Now a real row is created
   under "today" titled with the question itself, and the screen opens on it. */
  const send = (text: string) => {
    if (busy) return
    setDraft('')
    ask(text)
    if (openChat) return

    const id = `c-${Date.now()}`
    setChats((list) => [
      { id, title: text.trim(), snippet: text.trim(), at: 'الآن', group: 'اليوم' },
      ...list,
    ])
    setOpenChat(id)
  }

  const newChat = () => {
    reset()
    setOpenChat(null)
    setListOpen(false)
    setTimeout(() => input.current?.focus(), 60)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && busy) stop()
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        newChat()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* A user opens the assistant with a question already in mind, so the cursor is ready to type
   without hunting for the input. Not on mobile - focusing there raises the keyboard over half the
   screen before anything is read. */
  useEffect(() => {
    if (mobile || !focusOnMount) return
    const id = setTimeout(() => input.current?.focus(), 400)
    return () => clearTimeout(id)
  }, [mobile, focusOnMount])

  /* Screen title = the open conversation's title, or the first question in a new one. Empty until a
   chat actually opens. */
  const opened = chats.find((c) => c.id === openChat)
  const firstAsk = msgs.find((m) => m.who === 'me')?.text
  const title = opened ? opened.title : firstAsk ?? label ?? ''

  return (
    <>
      <ChatList
        chats={chats}
        onChange={setChats}
        openId={openChat}
        onOpen={(id) => { setOpenChat(id); reset(); setListOpen(false) }}
        onNew={newChat}
        open={listOpen}
        shut={shut}
        onShut={() => setShut(true)}
      />

      <div className="chatcol" ref={col}>
        {/* Note: the title sits in a column matching the conversation's width below it, so it starts at the
   same edge - a full-width header left the title floating far from the first word of the reply. */}
        <header className={`chat-top${title ? '' : ' bare'}`}>
          <div className="chat-top-in">
            {mobile ? (
              <button
                className="aclose"
                onClick={() => setListOpen((v) => !v)}
                aria-label="المحادثات"
              >
                <Icon name={icons.menu} size="sm" />
              </button>
            ) : shut && (
              /* Position of the collapsed sidebar - the button restores it from the same side it left, so the
   motion reads as returning, not opening something new. */
              <button
                className="aclose aclose-list"
                onClick={() => setShut(false)}
                title="أظهر المحادثات"
                aria-label="أظهر المحادثات"
              >
                <Icon name={icons.panel} size="sm" />
              </button>
            )}

            {title ? (
              <>
                <span className="badge badge-30"><AbLeaf /></span>
                <div className="chat-name" id={labelledBy}>{title}</div>
              </>
            ) : (
              <span className="chat-name" id={labelledBy} />
            )}

            {headExtra}

            <button className="aclose" onClick={onClose} aria-label="أغلق المساعد">
              <Icon name={icons.close} size="sm" />
            </button>
          </div>
        </header>

        <div className={`chat-body${msgs.length === 0 ? ' mid' : ''}`} ref={body}>
          {msgs.length === 0 ? (
            <>
              <Welcome
                greet={greet}
                sub={sub}
                cards={cards}
                onPick={send}
                composer={
                  <Composer
                    value={draft}
                    onChange={setDraft}
                    onSend={send}
                    onStop={stop}
                    busy={busy}
                    inputRef={input}
                  />
                }
              />
              {/* Alert sits at the very end of the page - information, not a step. */}
              <Disclaimer />
            </>
          ) : (
            <div className="thread">
              {msgs.map((m, i) =>
                m.who === 'me' ? (
                  <div className="cmsg me" key={i}>{m.text}</div>
                ) : (
                  <AiMessage key={i} message={m} onFollow={send} />
                ),
              )}
            </div>
          )}
        </div>

        {!atEnd && msgs.length > 0 && (
          <button className="tobottom chrome" onClick={toEnd} aria-label="انتقل إلى آخر المحادثة">
            <Icon name={icons.down} size="sm" />
          </button>
        )}

        {msgs.length > 0 && (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={send}
            onStop={stop}
            busy={busy}
            inputRef={input}
            docked
          />
        )}
      </div>

      {listOpen && (
        <div className="ascrim on" onClick={() => setListOpen(false)} aria-hidden="true" />
      )}
    </>
  )
}
