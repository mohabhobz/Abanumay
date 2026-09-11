import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, icons } from '@/components/ui'
import {
  AiMessage, Composer, Disclaimer, Welcome, useAssistant, type WelcomeCard,
} from '@/components/assistant'
import { useDockHeight } from '@/hooks/useDockHeight'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { savedChats, type SavedChat } from '@/data/mock/assistant'
import { ChatList } from './ChatList'

export interface AssistantScreenProps {
  /** الترحيب الشخصي · «أهلًا عمر» · ثابت في كل مكان */
  greet: string
  /** سطر المدى · **ده وحده اللي بيتغيّر حسب الصفحة** */
  sub: string
  cards: WelcomeCard[]
  onClose: () => void
  /** زرار زيادة في الترويسة (مبدّل المقاس لمّا الشاشة بتتفتح فوق صفحة) */
  headExtra?: ReactNode
  /** المؤشر يبدأ جاهز في مربع الكتابة */
  focusOnMount?: boolean
  /** بيتصفّر لمّا تتفتح من جديد · مفتاح React لا حالة داخلية */
  labelledBy?: string
}

/**
 * شاشة مساعد أبانمي · **جسم واحد، بيتعرض في مكانين**.
 *
 * كان في السيستم **نسختان** من نفس المساعد: صفحة `/assistant`
 * بقايمة محادثات وترحيب كبير وكروت، ولوح جانبي بيفتح من أي صفحة
 * بترويسة تانية وبلا قايمة محادثات. فاللي بيدوس «اسأل أبانمي» من
 * صفحة المشروع كان بيدخل حاجة تانية · محادثاته مش معاه، والشكل
 * مش اللي شافه أول ما دخل النظام.
 *
 * دلوقتي المكوّن ده هو المساعد، والمكانان بيفرّقوا في حاجة واحدة:
 * **الإطار اللي حواليه**. صفحة كاملة، أو لوح فوق الصفحة اللي أنت
 * فيها. وجوّه الاتنين: نفس القايمة، نفس الترويسة، نفس الترحيب،
 * نفس مربع الكتابة، نفس الكروت.
 *
 * واللي بيتغيّر حسب الصفحة **الكونتنت وحده**: سطر المدى («كيف
 * أقدر أساعدك في «س»؟») والكروت الأربعة. مفيش تشكيل خاص بمكان.
 */
export function AssistantScreen({
  greet, sub, cards, onClose, headExtra, focusOnMount, labelledBy,
}: AssistantScreenProps) {
  const mobile = useIsMobile()

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

  /* المستخدم بيفتح المساعد وفي دماغه سؤال، فالمؤشر جاهز يكتبه من
     غير ما يدوّر على مكان الكتابة. على الموبايل لأ · الفوكس بيطلّع
     الكيبورد فوق نص الشاشة قبل ما يقرا حاجة. */
  useEffect(() => {
    if (mobile || !focusOnMount) return
    const id = setTimeout(() => input.current?.focus(), 400)
    return () => clearTimeout(id)
  }, [mobile, focusOnMount])

  /* عنوان الشاشة = عنوان المحادثة المفتوحة، أو أول سؤال في الجديدة.
     فاضي لحد ما يتفتح شات فعلًا. */
  const opened = chats.find((c) => c.id === openChat)
  const firstAsk = msgs.find((m) => m.who === 'me')?.text
  const title = opened ? opened.title : firstAsk ?? ''

  return (
    <>
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
            نفس السطر · الترويسة اللي بتاخد عرض الشاشة كانت بتسيب
            العنوان معلّقًا في الحافة بعيدًا عن أول كلمة في الرد. */}
        <header className={`chat-top${title ? '' : ' bare'}`}>
          <div className="chat-top-in">
            {mobile && (
              <button
                className="aclose"
                onClick={() => setListOpen((v) => !v)}
                aria-label="المحادثات"
              >
                <Icon name={icons.menu} size={16} />
              </button>
            )}

            {title ? (
              <>
                <span className="badge badge-30"><span className="aispark" /></span>
                <div className="chat-name" id={labelledBy}>{title}</div>
              </>
            ) : (
              <span className="chat-name" id={labelledBy} />
            )}

            {headExtra}

            <button className="aclose" onClick={onClose} aria-label="خروج">
              <Icon name={icons.close} size={16} />
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
              {/* التنبيه في آخر الصفحة خالص · معلومة مش خطوة */}
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
            <Icon name={icons.down} size={16} />
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
