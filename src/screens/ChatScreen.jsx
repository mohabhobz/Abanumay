import { useState, useEffect, useRef, useCallback } from 'react'
import { roles, savedChats, respond } from '../data/chat.js'
import { Rail, Background, MobileTop } from '../components/Shell.jsx'
import { Icon, icons, Riyal, nf, useMediaQuery } from '../components/ui.jsx'

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
  const [roleIdx, setRoleIdx] = useState(0)
  const me = roles[roleIdx]

  const [chats, setChats] = useState(savedChats)
  const [openChat, setOpenChat] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuId, setMenuId] = useState(null)

  const bodyRef = useRef(null)
  const inputRef = useRef(null)
  const stopRef = useRef(false)
  const busy = msgs.some((m) => m.state && m.state !== 'done')

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

  const send = useCallback(
    (text) => {
      const q = String(text || '').trim()
      if (!q || busy) return
      stopRef.current = false
      setDraft('')
      const a = respond(q)
      setMsgs((m) => [
        ...m,
        { who: 'me', text: q },
        { who: 'ai', ...a, state: 'think', step: 0, chars: 0 },
      ])
      if (!openChat) setOpenChat('new')
    },
    [busy, openChat],
  )

  /* محرّك العرض: خطوات التفكير واحدة ورا التانية، بعدين الكتابة حرف حرف */
  useEffect(() => {
    const i = msgs.findIndex((m) => m.state && m.state !== 'done')
    if (i === -1) return
    const m = msgs[i]
    const patch = (p) => setMsgs((all) => all.map((x, j) => (j === i ? { ...x, ...p } : x)))

    if (m.state === 'think') {
      const steps = m.think || []
      if (m.step < steps.length) {
        const t = setTimeout(() => patch({ step: m.step + 1 }), THINK_STEP_MS)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => patch({ state: 'type' }), 260)
      return () => clearTimeout(t)
    }

    if (m.state === 'type') {
      const full = m.text || ''
      if (m.chars < full.length) {
        const t = setTimeout(
          () => patch({ chars: Math.min(full.length, m.chars + TYPE_CHARS) }),
          TYPE_MS,
        )
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => patch({ state: 'done' }), 200)
      return () => clearTimeout(t)
    }
  }, [msgs])

  const stop = () => {
    stopRef.current = true
    setMsgs((all) =>
      all.map((m) => (m.state && m.state !== 'done' ? { ...m, state: 'done', chars: (m.text || '').length } : m)),
    )
  }

  const newChat = () => {
    setMsgs([])
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
              <button className="btn btn-1 btn-sm newchat" onClick={newChat}>
                <Icon path={icons.plus} size={16} />
                محادثة جديدة
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
                      <div key={c.id} className={`cl-row${openChat === c.id ? ' on' : ''}`}>
                        <button
                          className="cl-main"
                          onClick={() => {
                            setOpenChat(c.id)
                            setMsgs([])
                            setListOpen(false)
                          }}
                        >
                          <div className="cl-t">
                            {c.pinned && <Icon path={icons.pin} size={14} />}
                            {c.title}
                          </div>
                          <div className="cl-s">{c.snippet}</div>
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
            <header className="chat-top">
              {mobile && (
                <button className="aclose" onClick={() => setListOpen((v) => !v)} aria-label="المحادثات">
                  <Icon path={icons.menu} size={16} />
                </button>
              )}
              <span className="badge badge-30"><span className="aispark" /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="atitle">مساعد أبانمي</div>
                <div className="sub">استرشادي · لا يتخذ أي إجراء نيابةً عنك</div>
              </div>

              {/* مبدّل الأدوار — للعرض على العميل: الكروت بتتغيّر بالدور */}
              <div className="roleswap">
                <span className="lb">أعرض كـ</span>
                <select value={roleIdx} onChange={(e) => { setRoleIdx(+e.target.value); newChat() }}>
                  {roles.map((r, i) => (
                    <option key={r.key} value={i}>{r.role}</option>
                  ))}
                </select>
              </div>

              <button className="aclose" onClick={onExit} aria-label="خروج">
                <Icon path={icons.close} size={16} />
              </button>
            </header>

            <div className="chat-body" ref={bodyRef}>
              {msgs.length === 0 ? (
                <Welcome me={me} onPick={send} />
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

            <Composer
              value={draft}
              onChange={setDraft}
              onSend={send}
              onStop={stop}
              busy={busy}
              inputRef={inputRef}
              centered={msgs.length === 0}
            />
          </div>
        </div>

        {listOpen && <div className="ascrim on" onClick={() => setListOpen(false)} aria-hidden="true" />}
      </div>
    </>
  )
}

/* ═══ الحالة الأولى ═══ */
function Welcome({ me, onPick }) {
  return (
    <div className="welcome">
      <span className="wspark"><span className="aispark" /></span>
      <h1 className="wgreet">{me.greet}</h1>
      <p className="wsub">كيف أقدر أساعدك اليوم؟</p>
      <div className="wrole lb">{me.role} · {me.scope}</div>

      <div className="wcards">
        {me.cards.map((c, i) => (
          <button className="wcard glass" key={c.title} style={{ '--d': `${i * 70}ms` }} onClick={() => onPick(c.prompt)}>
            <span className="badge badge-30"><Icon path={icons[c.icon]} /></span>
            <span className="wc-t">{c.title}</span>
            <span className="wc-s">{c.sub}</span>
          </button>
        ))}
      </div>

      <div className="wnote sub">
        المساعد بيقرأ من نفس بياناتك وصلاحياتك، وما يشوفش غير اللي تشوفه.
      </div>
    </div>
  )
}

/* ═══ رسالة المساعد ═══ */
function AiMessage({ m, onFollow }) {
  const [openThink, setOpenThink] = useState(true)
  const [copied, setCopied] = useState(false)
  const thinking = m.state === 'think'
  const typing = m.state === 'type'
  const done = m.state === 'done'
  const shown = typing ? (m.text || '').slice(0, m.chars) : m.text || ''

  useEffect(() => {
    if (done) setOpenThink(false)
  }, [done])

  const copy = () => {
    navigator.clipboard?.writeText(m.text || '').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="cmsg ai">
      {/* التفكير — بيقول إيه المصادر اللي اتفتحت، مش زينة */}
      {m.think?.length > 0 && (
        <div className={`think${thinking ? ' live' : ''}`}>
          <button className="th-head" onClick={() => setOpenThink((v) => !v)}>
            <span className="aispark th-spark" />
            <span>{thinking ? 'يفكّر' : `فكّر في ${m.think.length} خطوات`}</span>
            {thinking && <span className="dots"><i /><i /><i /></span>}
            <Icon path={icons.chevron} size={16} style={{ transform: openThink ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          </button>
          {openThink && (
            <div className="th-body">
              {m.think.slice(0, thinking ? m.step : m.think.length).map((s, i) => (
                <div className="th-step" key={i} style={{ '--d': `${i * 60}ms` }}>
                  <span className="th-dot" />
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(typing || done) && (
        <div className="ctext">
          {md(shown)}
          {typing && <span className="caret" />}
        </div>
      )}

      {done && m.block && <Block b={m.block} />}
      {done && m.more && <div className="ctext rise">{md(m.more)}</div>}

      {done && m.advisory && (
        <div className="advisory rise">
          <Icon path={icons.alert} size={16} />
          قراءة استرشادية — القرار والتوقيع يفضلوا عليك.
        </div>
      )}

      {done && m.sources?.length > 0 && (
        <div className="csrc rise">
          <span className="lb">المصادر</span>
          {m.sources.map((s) => (
            <span className="srcchip" key={s}>{s}</span>
          ))}
        </div>
      )}

      {done && (
        <div className="cact rise">
          {m.actions?.map((a) => (
            <button className={`btn ${a.kind} btn-sm`} key={a.label}>{a.label}</button>
          ))}
          <span className="cact-sp" />
          <button className="iact" onClick={copy} title="نسخ">
            <Icon path={copied ? icons.check : icons.copy} size={16} />
          </button>
          <button className="iact" title="إعادة توليد"><Icon path={icons.redo} size={16} /></button>
          <button className="iact" title="مفيدة"><Icon path={icons.up} size={16} /></button>
          <button className="iact" title="غير مفيدة"><Icon path={icons.downv} size={16} /></button>
        </div>
      )}

      {done && m.follow?.length > 0 && (
        <div className="chips rise" style={{ marginTop: '.9rem' }}>
          {m.follow.map((f) => (
            <button className="chip" key={f} onClick={() => onFollow(f)}>{f}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══ بلوكات الأدلة ═══ */
function Block({ b }) {
  if (b.kind === 'meter') {
    const pct = Math.round((b.limit / b.value) * 100)
    return (
      <div className="cblock rise">
        <div className="cb-h">
          <span className="lb">{b.label}</span>
          <span className="cb-v num">{nf.format(b.value)} <small>ساعة</small></span>
        </div>
        <div className="bar over"><i style={{ width: '100%' }} /><u style={{ insetInlineStart: `${pct}%` }} /></div>
        <div className="cb-f">
          <span className="sub">الحدّ <span className="num">{nf.format(b.limit)}</span></span>
          <span className="sub bad">{b.note}</span>
        </div>
      </div>
    )
  }

  if (b.kind === 'stats') {
    return (
      <div className="cblock rise cb-stats">
        {b.items.map((s) => (
          <div key={s.k}>
            <div className="lb">{s.k}</div>
            <div className="cb-n num">{s.v}</div>
            <div className="sub">{s.u}</div>
          </div>
        ))}
      </div>
    )
  }

  if (b.kind === 'ledger') {
    return (
      <div className="cblock rise">
        <div className="cb-led">
          {b.rows.map((r) => (
            <div key={r.k} className={r.strong ? 'strong' : ''}>
              <span>{r.k}</span>
              <span className="num">{r.v} <Riyal /></span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (b.kind === 'bars') {
    return (
      <div className="cblock rise">
        <div className="cb-bars">
          {b.items.map((it) => (
            <div key={it.k}>
              <div className="cb-bl">
                <span>{it.k}</span>
                <span className="num">{it.real}٪</span>
              </div>
              <div className="bar"><i style={{ width: `${it.real}%`, background: 'var(--teal)' }} /></div>
            </div>
          ))}
        </div>
        {b.note && <div className="sub" style={{ marginTop: '.6rem' }}>{b.note}</div>}
      </div>
    )
  }

  if (b.kind === 'list') {
    return (
      <div className="cblock rise">
        <div className="cb-list">
          {b.items.map((it) => (
            <div key={it.t}>
              <span className={`cb-dot ${it.tone}`} />
              <div>
                <div className="cb-t">{it.t}</div>
                <div className="sub">{it.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

/* ═══ الكتابة ═══ */
function Composer({ value, onChange, onSend, onStop, busy, inputRef, centered }) {
  const ta = useRef(null)
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 190) + 'px'
  }, [value])

  return (
    <div className={`composer${centered ? ' mid' : ''}`}>
      <div className="cbox chrome">
        <textarea
          ref={(el) => {
            ta.current = el
            if (inputRef) inputRef.current = el
          }}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend(value)
            }
          }}
          placeholder="اسأل عن مشروع، جهة، بند ميزانية…"
          aria-label="اكتب رسالتك"
        />
        <div className="cbox-b">
          <button className="iact" title="إرفاق ملف"><Icon path={icons.clip} size={16} /></button>
          <span className="cbox-hint sub">Enter للإرسال · Shift+Enter سطر جديد</span>
          {busy ? (
            <button className="go stop" onClick={onStop} title="إيقاف"><span className="sq" /></button>
          ) : (
            <button className="go" onClick={() => onSend(value)} disabled={!value.trim()} title="إرسال">
              <Icon path={icons.send} />
            </button>
          )}
        </div>
      </div>
      <div className="cdisc sub">قد يخطئ المساعد — راجع الأرقام قبل أي قرار.</div>
    </div>
  )
}

/* ماركداون خفيف: **بولد** وأسطر وبوليت */
function md(t) {
  return String(t)
    .split('\n')
    .map((line, i) => {
      if (!line.trim()) return <div key={i} className="mdbr" />
      const bullet = line.trim().startsWith('•')
      const parts = line.split('**')
      return (
        <div key={i} className={bullet ? 'mdli' : 'mdp'}>
          {parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : <span key={j}>{p}</span>))}
        </div>
      )
    })
}
