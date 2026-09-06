import { useEffect, useRef } from 'react'
import Logo from '../assets/LogoColor.jsx'
import { Icon, icons, Riyal, nf } from './ui.jsx'

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
        <span className="av">{user.initial}</span>
      </div>
    </div>
  )
}

export function DecisionBar({ user, project, compact }) {
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
    <div className="decdock">
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
   مساعد أبانمي — طبقة عابرة، مش قسم في النظام
   موجود في كل شاشة من نفس الزر في الريل ومن ⌘K،
   وبيفتح فوق المحتوى مش جنبه، فالشاشة ما تتزحزحش.
   ═══════════════════════════════════════════════════════════ */
export function Assistant({ open, onClose, context }) {
  return (
    <>
      <div className={`ascrim${open ? ' on' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`apanel chrome${open ? ' on' : ''}`} role="dialog" aria-label="مساعد أبانمي" aria-hidden={!open}>
        <div className="ahead">
          <span className="badge badge-30"><span className="aispark" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="atitle">مساعد أبانمي</div>
            <div className="sub">استرشادي · لا يتخذ أي إجراء</div>
          </div>
          <button className="aclose" title="فتح كصفحة كاملة" aria-label="فتح كصفحة كاملة">
            <Icon path={icons.expand} size={16} />
          </button>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon path={icons.close} size={16} />
          </button>
        </div>

        {/* بيقول لك إنه شايف نفس اللي أنت شايفه */}
        <div className="actx">
          <span className="lb">يقرأ الآن</span>
          <div className="actxv">{context.title}</div>
          <div className="sub">{context.sub}</div>
        </div>

        <div className="abody">
          <div className="amsg me">ليه المشروع متأخر؟</div>

          <div className="amsg ai">
            الإجراء مفتوح من <b>٨٧ يومًا</b> وقد استهلك <b>2,092</b> ساعة مقابل حدّ <b>900</b>. المشروع راجع للجهة في <b>٦ أغسطس</b> بطلب استكمال، ولم يصل منها ردّ بعدها.
            <div className="asrc">المصدر: سجل الإجراءات · حدّ قسم دراسة المشروع</div>
          </div>

          <div className="amsg ai">
            الجهة نفسها لديها مشروع آخر في الدراسة منذ مايو، ومشروع ثالث اعتُذر عنه. النمط يشير إلى بطء في استجابة الجهة لا في المؤسسة.
            <div className="asrc">المصدر: سجل مشاريع جمعية النوابغ</div>
          </div>

          <div className="lb" style={{ marginTop: '1.1rem', marginBottom: '.5rem' }}>اقتراحات لهذه الشاشة</div>
          <div className="chips">
            <button className="chip">قارن بمشاريع الجهة</button>
            <button className="chip">راجع الموازنة المرفقة</button>
            <button className="chip">اكتب رسالة تذكير</button>
            <button className="chip">لخّص المشروع في نصف صفحة</button>
          </div>
        </div>

        <div className="afoot">
          <div className="ask free">
            <span className="ph">اسأل عن هذا المشروع…</span>
            <button className="attach"><Icon path={icons.clip} /></button>
            <button className="go"><Icon path={icons.send} /></button>
          </div>
        </div>
      </aside>
    </>
  )
}
