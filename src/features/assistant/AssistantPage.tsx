import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Background, MobileTop, Rail } from '@/components/shell'
import { Icon, icons } from '@/components/ui'
import { AiMessage, Composer, Disclaimer, Welcome, useAssistant } from '@/components/assistant'
import { useDockHeight } from '@/hooks/useDockHeight'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { roles, savedChats, type AssistantRole, type SavedChat } from '@/data/mock/assistant'
import { fixtures } from '@/data/repository'
import { ROUTES } from '@/app/routes'
import { signOut } from '@/data/session'
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
  const col = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement | null>(null)

  /* المسافة تحت آخر رسالة = ارتفاع مربع الكتابة الحقيقي، مقيسًا */
  useDockHeight(col)

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

  /* دي أول شاشة بعد الدخول، فالمؤشر بيبقى جاهز في مربع الكتابة:
     المستخدم بيفتح النظام وفي دماغه سؤال، والمفروض يكتبه على طول
     من غير ما يدوّر على مكان الكتابة. على الموبايل لأ — الفوكس
     بيطلّع الكيبورد فوق نص الشاشة قبل ما يقرا حاجة. */
  useEffect(() => {
    if (mobile) return
    const id = setTimeout(() => input.current?.focus(), 400)
    return () => clearTimeout(id)
  }, [mobile])

  /* عنوان الشاشة = عنوان المحادثة المفتوحة، أو أول سؤال في الجديدة.
     فاضي لحد ما يتفتح شات فعلًا. */
  const opened = chats.find((c) => c.id === openChat)
  const firstAsk = msgs.find((m) => m.who === 'me')?.text
  const title = opened ? opened.title : firstAsk ?? ''

  return (
    <>
      <Background />
      <div className="app">
        {mobile && <MobileTop user={fixtures.currentUser} onSignOut={() => { signOut(); navigate(ROUTES.login, { replace: true }) }} />}

        <div className="shell">
          <Rail
            user={fixtures.currentUser}
            onSignOut={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}
          />

          <ChatList
            chats={chats}
            onChange={setChats}
            openId={openChat}
            onOpen={(id) => { setOpenChat(id); reset(); setListOpen(false) }}
            onNew={newChat}
            open={listOpen}
          />

          <div className="chatcol" ref={col}>
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
                    sub="كيف أقدر أساعدك اليوم؟"
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
