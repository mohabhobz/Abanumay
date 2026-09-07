import { useState, useEffect, useRef } from 'react'
import { roles, savedChats } from '../data/chat.js'
import { Rail, Background, MobileTop } from '../components/Shell.jsx'
import { Icon, icons, useMediaQuery } from '../components/ui.jsx'
import { useAssistant, AiMessage, Composer } from '../components/chat.jsx'

/* ═══════════════════════════════════════════════════════════
   مساعد أبانمي — الشاشة الكاملة

   التصميم محكوم بثلاث قواعد من الوثيقة والمكالمة:
   ١ — مخرجات AI مساندة وغير مُلزِمة، فكل إجابة فيها قرار
       بتتعلّم في الواجهة نفسها.
   ٢ — «لو الـAI هو المدخل الوحيد، اليوزر ممكن يتسحل في فلو ما
       يجاوبوش» — فالكروت اختصارات نتيجتها معروفة، مش دعوات
       لمحادثة مفتوحة.
   ٣ — «أنا امبارح دورت على كذا، عايز أثبته معايا» — فالتثبيت
       والبحث في المحادثات جزء أساسي مش زينة.
   ═══════════════════════════════════════════════════════════ */

const THINK_STEP_MS = 620
const TYPE_CHARS = 3
const TYPE_MS = 14

export default function ChatScreen({ onExit }) {
  const mobile = useMediaQuery('(max-width: 860px)')
  const me = roles[0]

  const { msgs, send: ask, stop, reset, busy } = useAssistant()
  const [chats, setChats] = useState(savedChats)
  const [openChat, setOpenChat] = useState(null)
  const [draft, setDraft] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  /* السحب بيرتّب المحادثات، والإفلات في مجموعة تانية بينقلها ليها
     — فسحب محادثة لمجموعة «مثبّتة» بيثبّتها. */
  const drop = (targetId) => {
    if (!dragId || dragId === targetId) return
    setChats((all) => {
      const from = all.findIndex((c) => c.id === dragId)
      const to = all.findIndex((c) => c.id === targetId)
      if (from === -1 || to === -1) return all
      const next = [...all]
      const [moved] = next.splice(from, 1)
      const t = next[to > from ? to - 1 : to]
      next.splice(to > from ? to - 1 : to, 0, { ...moved, pinned: t.pinned, group: t.group })
      return next
    })
    setDragId(null)
    setOverId(null)
  }

  const bodyRef = useRef(null)
  const inputRef = useRef(null)

  /* التمرير بيتبع الكتابة، إلا لو المستخدم طلّع بنفسه */
  const [stick, setStick] = useState(true)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onScroll = () => setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 90)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    // من غير الشرط ده الحالة الأولى بتتزحلق لتحت وترحيبها ما يبانش
    if (msgs.length && stick && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  })

  const send = (text) => {
    if (busy) return
    setDraft('')
    ask(text)
    if (!openChat) setOpenChat('new')
  }

  const newChat = () => {
    reset()
    setOpenChat(null)
    setListOpen(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (busy) stop()
        else if (menuId) setMenuId(null)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        newChat()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, menuId])

  /* عنوان الشاشة = عنوان المحادثة المفتوحة، أو أول سؤال في الجديدة */
  const opened = chats.find((c) => c.id === openChat)
  const firstAsk = msgs.find((m) => m.who === 'me')?.text
  const title = opened ? opened.title : firstAsk || ''

  const filtered = chats.filter((c) => !query || c.title.includes(query) || c.snippet.includes(query))
  const groups = ['مثبّتة', 'اليوم', 'أمس', 'آخر ٧ أيام']

  return (
    <>
      <Background />
      <div className="app">
        {mobile && <MobileTop user={me} />}
        <div className="shell">
          <Rail active="assistant" user={me} onNav={(k) => k !== 'assistant' && onExit?.()} onAssistant={() => {}} assistantOpen />

          {/* ═══ قائمة المحادثات ═══ */}
          <aside className={`chatlist chrome${listOpen ? ' on' : ''}`}>
            <div className="cl-head">
              <span className="cl-title">المحادثات</span>
              <button className="cl-new" onClick={newChat} title="محادثة جديدة · ⌘⇧O" aria-label="محادثة جديدة">
                <Icon path={icons.plus} size={16} />
              </button>
            </div>
            <div className="cl-search">
              <Icon path={icons.search} size={16} style={{ color: 'var(--t3)' }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في محادثاتك…" />
            </div>

            <div className="cl-body">
              {groups.map((g) => {
                const rows = filtered.filter((c) => (c.pinned ? 'مثبّتة' : c.group) === g)
                if (!rows.length) return null
                return (
                  <div key={g} className="cl-group">
                    <div className="cl-gt">{g}</div>
                    {rows.map((c) => (
                      <div
                        key={c.id}
                        className={`cl-row${openChat === c.id ? ' on' : ''}${dragId === c.id ? ' dragging' : ''}${overId === c.id ? ' over' : ''}`}
                        draggable
                        onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDragEnd={() => { setDragId(null); setOverId(null) }}
                        onDragOver={(e) => { e.preventDefault(); setOverId(c.id) }}
                        onDragLeave={() => setOverId((v) => (v === c.id ? null : v))}
                        onDrop={(e) => { e.preventDefault(); drop(c.id) }}
                      >
                        <span className="cl-grip" aria-hidden="true"><Icon path={icons.grip} size={16} /></span>
                        <button
                          className="cl-main"
                          onClick={() => {
                            setOpenChat(c.id)
                            reset()
                            setListOpen(false)
                          }}
                        >
                          <div className="cl-t">
                            {c.pinned && <Icon path={icons.pin} size={14} />}
                            {c.title}
                          </div>
                        </button>
                        <button
                          className="cl-more"
                          aria-label="خيارات"
                          onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                        >
                          <Icon path={icons.dots} size={16} />
                        </button>
                        {menuId === c.id && (
                          <div className="cl-menu chrome">
                            <button
                              onClick={() => {
                                setChats((all) => all.map((x) => (x.id === c.id ? { ...x, pinned: !x.pinned } : x)))
                                setMenuId(null)
                              }}
                            >
                              <Icon path={icons.pin} size={16} />
                              {c.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                            </button>
                            <button onClick={() => setMenuId(null)}>
                              <Icon path={icons.edit} size={16} />
                              إعادة تسمية
                            </button>
                            <button onClick={() => setMenuId(null)}>
                              <Icon path={icons.file} size={16} />
                              تصدير المحادثة
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                setChats((all) => all.filter((x) => x.id !== c.id))
                                setMenuId(null)
                              }}
                            >
                              <Icon path={icons.trash} size={16} />
                              حذف
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
              {!filtered.length && <div className="cl-empty sub">مفيش محادثات مطابقة</div>}
            </div>

            <div className="cl-foot sub">
              المحادثات محفوظة لك وحدك · <b>{chats.length}</b> محادثة
            </div>
          </aside>

          {/* ═══ عمود المحادثة ═══ */}
          <div className="chatcol">
            <header className={`chat-top${title ? '' : ' bare'}`}>
              {mobile && (
                <button className="aclose" onClick={() => setListOpen((v) => !v)} aria-label="المحادثات">
                  <Icon path={icons.menu} size={16} />
                </button>
              )}
              {/* الترويسة فاضية لحد ما يتفتح شات فعلًا */}
              {title ? (
                <>
                  <span className="badge badge-30"><span className="aispark" /></span>
                  <div className="chat-name">{title}</div>
                </>
              ) : (
                <span className="chat-name" />
              )}

              <button className="aclose" onClick={onExit} aria-label="خروج">
                <Icon path={icons.close} size={16} />
              </button>
            </header>

            <div className={`chat-body${msgs.length === 0 ? ' mid' : ''}`} ref={bodyRef}>
              {msgs.length === 0 ? (
                <Welcome
                  me={me}
                  onPick={send}
                  composer={
                    <Composer value={draft} onChange={setDraft} onSend={send} onStop={stop} busy={busy} inputRef={inputRef} />
                  }
                />
              ) : (
                <div className="thread">
                  {msgs.map((m, i) =>
                    m.who === 'me' ? (
                      <div className="cmsg me" key={i}>{m.text}</div>
                    ) : (
                      <AiMessage key={i} m={m} onFollow={send} />
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
                inputRef={inputRef}
                docked
              />
            )}
          </div>
        </div>

        {listOpen && <div className="ascrim on" onClick={() => setListOpen(false)} aria-hidden="true" />}
      </div>
    </>
  )
}

/* ═══ الحالة الأولى ═══ */
function Welcome({ me, onPick, composer }) {
  return (
    <div className="welcome">
      <div className="whead">
        <span className="wspark"><span className="aispark" /></span>
        <div className="wtext">
          <h1 className="wgreet">{me.greet}</h1>
          <p className="wsub">كيف أقدر أساعدك اليوم؟</p>
        </div>
      </div>

      <div className="wcards">
        {me.cards.map((c, i) => (
          <button className="wcard glass" key={c.title} style={{ '--d': `${i * 70}ms` }} onClick={() => onPick(c.prompt)}>
            <span className="badge badge-30"><Icon path={icons[c.icon]} /></span>
            <span className="wc-t">{c.title}</span>
            <span className="wc-s">{c.sub}</span>
          </button>
        ))}
      </div>

      {composer}
    </div>
  )
}
