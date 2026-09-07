import { useEffect, useRef, useState } from 'react'
import Logo from '../assets/LogoColor.jsx'
import { Icon, icons, Riyal, nf } from './ui.jsx'
import { useAssistant, AiMessage, Composer, Disclaimer } from './chat.jsx'

/* الصورة الشخصية من صور التيمبليت، والحرف احتياطي لو الصورة ما حمّلتش */
function Avatar({ user }) {
  if (!user.photo) return <span className="av">{user.initial}</span>
  return <img className="pht pht-34" src={user.photo} alt="" title={`${user.name}، ${user.role}`} />
}

export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <span className="mesh" />
      <span className="grd" /><span className="grain" />
    </div>
  )
}

// mob=false يعني ما يظهرش في شريط الموبايل السفلي — مساحته ٥ عناصر بس
const NAV = [
  { key: 'home', label: 'الرئيسية', icon: icons.home, mob: true },
  { key: 'projects', label: 'المشاريع', icon: icons.doc, mob: true },
  { key: 'entities', label: 'الجهات', icon: icons.entity, mob: true },
  { key: 'budget', label: 'الميزانية', icon: icons.budget },
  { key: 'contracts', label: 'الاتفاقيات', icon: icons.contract },
  { key: 'payments', label: 'الصرف', icon: icons.pay },
  { key: 'reports', label: 'التقارير', icon: icons.chart, mob: true },
]

/* شريط علوي للموبايل: الشعار والصورة اللي كانوا في الريل */
export function MobileTop({ user }) {
  return (
    <div className="mobtop chrome">
      <span className="mark mark-38 logo"><Logo /></span>
      <span className="mobtitle">منح أبانمي</span>
      <Avatar user={user} />
    </div>
  )
}

export function Rail({ active = 'projects', onNav, user, onAssistant, assistantOpen }) {
  return (
    <nav className="rail chrome" aria-label="التنقّل الرئيسي">
      <span className="mark mark-64 logo" style={{ marginBottom: '.85rem' }}>
        <Logo />
      </span>
      {NAV.map((n) => (
        <button
          key={n.key}
          className={`${n.key === active ? 'on' : ''}${n.mob ? '' : ' nomob'}`}
          onClick={() => onNav && onNav(n.key)}
          aria-current={n.key === active ? 'page' : undefined}
        >
          <Icon path={n.icon} />
          <span>{n.label}</span>
        </button>
      ))}
      <div className="railfoot">
        <button
          className={`aitrigger${assistantOpen ? ' on' : ''}`}
          onClick={onAssistant}
          aria-expanded={assistantOpen}
          title="مساعد أبانمي · ⌘K"
        >
          <span className="aispark" />
          <span>المساعد<kbd>⌘K</kbd></span>
        </button>
        <Avatar user={user} />
      </div>
    </nav>
  )
}

export function TopBar({ crumbs, user }) {
  return (
    <div className="navbar">
      <div className="rowf" style={{ gap: '.55rem', minWidth: 0 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />}
            {i === crumbs.length - 1 ? (
              <span style={{ fontSize: '.82rem', fontFamily: 'var(--fd)', fontWeight: 500 }}>{c}</span>
            ) : (
              <span className="lb">{c}</span>
            )}
          </span>
        ))}
      </div>
      <div className="rowf" style={{ gap: '.5rem' }}>
        <div className="fld pill" style={{ padding: '.42rem .8rem' }}>
          <Icon path={icons.search} size={16} style={{ color: 'var(--t3)' }} />
          <input placeholder="بحث في المشاريع…" aria-label="بحث" />
        </div>
        <button className="btn btn-2 btn-sm">تصدير</button>
        <Avatar user={user} />
      </div>
    </div>
  )
}

export function DecisionBar({ user, project, compact, atEnd }) {
  const ref = useRef(null)

  /* تفاعل من بعيد: الشريط بيحسّ بالماوس قبل ما توصله،
     فبيرتفع شوية والضوء بيتبع مكان المؤشر. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const REACH = 260
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const dy = Math.max(0, r.top - e.clientY)
      const near = Math.max(0, 1 - dy / REACH)
      el.style.setProperty('--near', near.toFixed(3))
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    }
    const onLeave = () => el.style.setProperty('--near', '0')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className={`decdock${atEnd ? ' clear' : ''}`}>
    <div className="chrome decbar" ref={ref}>
      <div className="rowf" style={{ gap: '.7rem', minWidth: 0 }}>
        <Avatar user={user} />
        <span className="decsent">
          {compact ? (
            <>اتخذ إجراءً · <span className="num">{nf.format(project.amount)}</span> <Riyal /></>
          ) : (
            <>
              اتخذ إجراءً لـ <b>{project.name}</b>
              <span className="decsep" />
              المبلغ <span className="num">{nf.format(project.amount)}</span> <Riyal />
            </>
          )}
        </span>
      </div>
      <div className="rowf" style={{ gap: '.5rem' }}>
        {user.actions.map((a) => (
          <button key={a.label} className={`btn ${a.kind}`}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   لوح المساعد — بيفتح من أي صفحة على الجانب الشمال.
   العنوان اسم الشيء اللي أنت فيه، مش «مساعد أبانمي»،
   والترحيب بيسأل عنه بالاسم، وتحته اختصارات لنفس السياق.
   ═══════════════════════════════════════════════════════════ */
const CTX_FALLBACK = {
  title: 'منح أبانمي',
  sub: '',
  greet: 'أقدر أساعدك إزاي؟',
  cards: [{ icon: 'alert', title: 'إيه اللي بانتظار قراري؟', prompt: 'إيه اللي بانتظار قراري؟' }],
}

export function Assistant({ open, onClose, onFull, ctx = CTX_FALLBACK }) {
  const { msgs, send, stop, reset, busy } = useAssistant()
  const [draft, setDraft] = useState('')
  const bodyRef = useRef(null)

  /* بدل الخطوط الفاصلة: تدرّج بيتلاشى عند حافة التمرير —
     بيظهر وأنت في النص، وبيختفي أول ما توصل الأول أو الآخر. */
  const [edge, setEdge] = useState({ top: false, bot: false })
  const measure = () => {
    const el = bodyRef.current
    if (!el) return
    const more = el.scrollHeight - el.clientHeight
    setEdge({ top: el.scrollTop > 6, bot: more > 6 && el.scrollTop < more - 6 })
  }

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    measure()
  }, [msgs, open])

  const ask = (t) => {
    if (busy) return
    setDraft('')
    send(t)
  }

  return (
    <>
      <div className={`ascrim${open ? ' on' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`apanel chrome${open ? ' on' : ''}`} role="dialog" aria-label={`مساعد · ${ctx.title}`} aria-hidden={!open}>
        <div className="ahead">
          <span className="badge badge-30"><span className="aispark" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="atitle">{ctx.title}</div>
            <div className="sub">{ctx.sub}</div>
          </div>
          {msgs.length > 0 && (
            <button className="aclose" onClick={reset} title="محادثة جديدة" aria-label="محادثة جديدة">
              <Icon path={icons.plus} size={16} />
            </button>
          )}
          <button className="aclose" onClick={onFull} title="فتح كصفحة كاملة" aria-label="فتح كصفحة كاملة">
            <Icon path={icons.expand} size={16} />
          </button>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon path={icons.close} size={16} />
          </button>
        </div>

        <div className={`abodywrap${edge.top ? ' fadetop' : ''}${edge.bot ? ' fadebot' : ''}`}>
        <div className="abody" ref={bodyRef} onScroll={measure}>
          {msgs.length === 0 ? (
            <div className="awelcome">
              <div className="agreet">{ctx.greet}</div>
              <div className="acards">
                {ctx.cards.map((c, i) => (
                  <button className="acard" key={c.title} style={{ '--d': `${i * 60}ms` }} onClick={() => ask(c.prompt)}>
                    <span className="badge badge-30"><Icon path={icons[c.icon]} /></span>
                    <span>{c.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            msgs.map((m, i) =>
              m.who === 'me' ? (
                <div className="cmsg me" key={i}>{m.text}</div>
              ) : (
                <AiMessage key={i} m={m} onFollow={ask} />
              ),
            )
          )}
        </div>
        </div>

        <div className="afoot">
          <Composer value={draft} onChange={setDraft} onSend={ask} onStop={stop} busy={busy} />
          <Disclaimer />
        </div>
      </aside>
    </>
  )
}
