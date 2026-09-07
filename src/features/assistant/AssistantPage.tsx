import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Background, MobileTop, Rail } from '@/components/shell'
import { Icon, icons, type IconName } from '@/components/ui'
import { AiMessage, Composer, Disclaimer, useAssistant } from '@/components/assistant'
import { useProximity } from '@/hooks/useProximity'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { roles, savedChats, type AssistantRole, type SavedChat } from '@/data/mock/assistant'
import { fixtures } from '@/data/repository'
import { ROUTES } from '@/app/routes'
import { ChatList } from './ChatList'

/**
 * مساعد أبانمي — الشاشة الكاملة.
 *
 * محكومة بثلاث قواعد من الوثيقة والمكالمة:
 * 1 — مخرجات AI مساندة وغير مُلزِمة، فكل إجابة فيها قرار بتتعلّم في الواجهة.
 * 2 — «لو الـAI هو المدخل الوحيد، اليوزر ممكن يتسحل في فلو ما يجاوبوش»،
 *     فالكروت اختصارات نتيجتها معروفة مش دعوات لمحادثة مفتوحة.
 * 3 — التثبيت والبحث في المحادثات جزء أساسي مش زينة.
 */
export default function AssistantPage() {
  const navigate = useNavigate()
  const mobile = useIsMobile()

  const role = roles[0] as AssistantRole
  const me = { ...fixtures.currentUser, greet: role.greet, cards: role.cards }

  const { msgs, send: ask, stop, reset, busy } = useAssistant()
  const [chats, setChats] = useState<SavedChat[]>(savedChats)
  const [openChat, setOpenChat] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [listOpen, setListOpen] = useState(false)

  const body = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement | null>(null)

  /* التمرير بيتبع الكتابة، إلا لو المستخدم طلّع بنفسه */
  const [stick, setStick] = useState(true)
  useEffect(() => {
    const el = body.current
    if (!el) return
    const onScroll = () => setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 90)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  })
  useEffect(() => {
    // من غير شرط الرسائل، الحالة الأولى بتتزحلق لتحت وترحيبها ما يبانش
    if (msgs.length && stick && body.current) {
      body.current.scrollTop = body.current.scrollHeight
    }
  })

  const send = (text: string) => {
    if (busy) return
    setDraft('')
    ask(text)
    if (!openChat) setOpenChat('new')
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

  /* عنوان الشاشة = عنوان المحادثة المفتوحة، أو أول سؤال في الجديدة.
     فاضي لحد ما يتفتح شات فعلًا. */
  const opened = chats.find((c) => c.id === openChat)
  const firstAsk = msgs.find((m) => m.who === 'me')?.text
  const title = opened ? opened.title : firstAsk ?? ''

  return (
    <>
      <Background />
      <div className="app">
        {mobile && <MobileTop user={fixtures.currentUser} />}

        <div className="shell">
          <Rail
            user={fixtures.currentUser}
            onAssistant={() => {}}
            assistantOpen
            onSignOut={() => navigate(ROUTES.login)}
          />

          <ChatList
            chats={chats}
            onChange={setChats}
            openId={openChat}
            onOpen={(id) => { setOpenChat(id); reset(); setListOpen(false) }}
            onNew={newChat}
            open={listOpen}
          />

          <div className="chatcol">
            {/* العنوان جوّه عمود بنفس عرض المحادثة تحته، عشان يبدأ من
                نفس السطر — الترويسة اللي بتاخد عرض الشاشة كانت بتسيب
                العنوان معلّقًا في الحافة بعيدًا عن أول كلمة في الرد. */}
            <header className={`chat-top${title ? '' : ' bare'}`}>
              <div className="chat-top-in">
                {mobile && (
                  <button
                    className="aclose"
                    onClick={() => setListOpen((v) => !v)}
                    aria-label="المحادثات"
                  >
                    <Icon path={icons.menu} size={16} />
                  </button>
                )}

                {title ? (
                  <>
                    <span className="badge badge-30"><span className="aispark" /></span>
                    <div className="chat-name">{title}</div>
                  </>
                ) : (
                  <span className="chat-name" />
                )}

                <button className="aclose" onClick={() => navigate(-1)} aria-label="خروج">
                  <Icon path={icons.close} size={16} />
                </button>
              </div>
            </header>

            <div className={`chat-body${msgs.length === 0 ? ' mid' : ''}`} ref={body}>
              {msgs.length === 0 ? (
                <>
                  <Welcome
                    greet={me.greet}
                    cards={me.cards}
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
                  {/* التنبيه في آخر الصفحة خالص — معلومة مش خطوة */}
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

            {!stick && msgs.length > 0 && (
              <button className="tobottom chrome" onClick={() => setStick(true)} aria-label="آخر المحادثة">
                <Icon path={icons.down} size={16} />
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
        </div>

        {listOpen && (
          <div className="ascrim on" onClick={() => setListOpen(false)} aria-hidden="true" />
        )}
      </div>
    </>
  )
}

/* ═══ الحالة الأولى ═══ */

interface WelcomeProps {
  greet: string
  cards: AssistantRole['cards']
  onPick: (prompt: string) => void
  composer: ReactNode
}

function Welcome({ greet, cards, onPick, composer }: WelcomeProps) {
  const grid = useRef<HTMLDivElement>(null)
  useProximity(grid, { reach: 300, selector: '.wcard' })

  return (
    <div className="welcome">
      <div className="whead">
        <span className="wspark"><span className="aispark" /></span>
        <div className="wtext">
          <h1 className="wgreet">{greet}</h1>
          <p className="wsub">كيف أقدر أساعدك اليوم؟</p>
        </div>
      </div>

      {composer}

      {/* الاختصارات تحت مربع الكتابة — الكتابة هي المدخل، ودي طرق سريعة */}
      <div className="wcards" ref={grid}>
        {cards.map((c, i) => (
          <button
            className="wcard glass"
            key={c.title}
            style={{ '--d': `${i * 70}ms` } as CSSProperties}
            onClick={() => onPick(c.prompt)}
          >
            <span className="badge badge-30"><Icon path={icons[c.icon as IconName]} /></span>
            <span className="wc-t">{c.title}</span>
            <span className="wc-s">{c.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
