// ═══ الكومبوننتس الأساسية للنظام ═══
// كلها بتستخدم كلاسات الديزاين سيستم من index.css، صفر بوردر

import { forwardRef, useState } from 'react'

export const nf = new Intl.NumberFormat('en-US')

export function Icon({ path, size = 20, style }) {
  return (
    <svg
      className={size === 16 ? 'ic ic-14' : 'ic'}
      viewBox="0 0 24 24"
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  )
}

export const icons = {
  home: '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/>',
  doc: '<path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4"/><path d="M10 13h5"/><path d="M10 16h5"/>',
  entity: '<path d="M5 20V8l7-4 7 4v12"/><path d="M10 20v-6h4v6"/>',
  budget: '<path d="M6 5v14"/><path d="M6 9h7"/><path d="M6 15h7"/><circle cx="17" cy="9" r="2"/><circle cx="17" cy="15" r="2"/>',
  contract: '<path d="M6 4h12v16l-6-3-6 3z"/>',
  pay: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16"/>',
  chart: '<path d="M5 19V9"/><path d="M10 19V5"/><path d="M15 19v-7"/><path d="M20 19v-11"/>',
  chat: '<path d="M20 12c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L5 20l1.3-3.1C5.2 15.7 4 14 4 12c0-3.9 3.6-7 8-7s8 3.1 8 7z"/>',
  alert: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  chevron: '<path d="M14 6l-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  file: '<path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4"/>',
  clip: '<path d="M15 8l-6 6a2.5 2.5 0 003.5 3.5l6.5-6.5a4.5 4.5 0 00-6.4-6.3L6 11.6"/>',
  send: '<path d="M20 12H6"/><path d="M12 6l-6 6 6 6"/>',
  spark: '<path d="M12 3.6l2.1 6.3 6.3 2.1-6.3 2.1-2.1 6.3-2.1-6.3L3.6 12l6.3-2.1z"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  expand: '<path d="M14 4h6v6"/><path d="M20 4l-7 7"/><path d="M10 20H4v-6"/><path d="M4 20l7-7"/>',
}

export const Glass = forwardRef(function Glass({ children, className = '', ...rest }, ref) {
  return (
    <div className={`glass ${className}`} ref={ref} {...rest}>
      {children}
    </div>
  )
})

export function Head({ title, meta }) {
  return (
    <div className="hd">
      <h3>{title}</h3>
      {meta && <span className="meta">{meta}</span>}
    </div>
  )
}

export function Tag({ tone = '', children }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function Num({ children }) {
  return <span className="num">{typeof children === 'number' ? nf.format(children) : children}</span>
}

/* رمز الريال الرسمي U+20C1، بيتعرض من خط الرمز المرفق */
export function Riyal({ style }) {
  return (
    <span className="rs" style={style} role="img" aria-label="ريال سعودي">
      {'\u20C1'}
    </span>
  )
}

export function Mono({ children }) {
  return <span className="mono">{children}</span>
}

export function KV({ rows }) {
  return (
    <dl className="kv">
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Steps({ gates }) {
  return (
    <div className="steps">
      {gates.map((g, i) => (
        <div key={i} className={`step ${g.state}`}>
          <div className="k">{g.note}</div>
          <div className="n2">{g.role}</div>
        </div>
      ))}
    </div>
  )
}

/* نسخة رأسية من مؤشر البوابات، بتتقرا كسُلّم اعتماد */
export function VSteps({ gates }) {
  return (
    <div className="stepv">
      {gates.map((g, i) => (
        <div key={i} className={`s ${g.state}`}>
          <div>
            <div className="n2">{g.role}</div>
            <div className="k">{g.note}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══ سُلّم السقوف ═══
   مسار الاعتماد مش ثابت، هو دالة في المبلغ. الكومبوننت ده بيحسب
   أول دور سقفه يستوعب المبلغ، ويبيّن إن اللي فوقه غير مطلوب — وليه. */
export function CeilingLadder({ amount, authority, currentRole }) {
  const roles = authority.roles
  // أول دور له سقف ويستوعب المبلغ، هو صاحب القرار
  let decider = roles.findIndex((r, i) => i > 0 && r.ceiling !== null && r.ceiling >= amount)
  if (decider === -1) decider = roles.length - 1 // تعدّى كل السقوف، يروح للمجلس

  return (
    <div className="lad">
      {roles.map((r, i) => {
        const isNow = r.role === currentRole
        const isDecider = i === decider
        const off = i > decider
        const fill = r.ceiling ? Math.min(100, (amount / r.ceiling) * 100) : null
        return (
          <div key={r.role} className={`lrow${isNow ? ' now' : ''}${isDecider ? ' decide' : ''}${off ? ' off' : ''}`}>
            <span className="ldot" />
            <div className="lmain">
              <div className="lrole">{r.role}</div>
              <div className="lnote">
                {isNow && 'الحالية · بانتظار الجهة'}
                {!isNow && isDecider && (
                  <>
                    صاحب القرار
                    {r.uplift ? (
                      <> · يقدر يزيد المبلغ حتى <span className="num">{nf.format(Math.round(amount * (1 + r.uplift / 100)))}</span> (+{r.uplift}٪)</>
                    ) : null}
                  </>
                )}
                {!isNow && !isDecider && (off ? 'غير مطلوبة، المبلغ دون السقف' : 'ضمن المسار')}
              </div>
            </div>
            <div className="lcap">
              <div className="lnum mono">
                {r.ceiling ? nf.format(r.ceiling) : r.kind === 'recommend' ? 'توصية' : 'بلا سقف'}
              </div>
              {fill !== null && (
                <div className="lbar">
                  <i style={{ width: `${fill}%` }} />
                </div>
              )}
            </div>
          </div>
        )
      })}
      {authority.provisional && (
        <div className="lprov">السقوف مؤقتة لحين تأكيدها من العميل</div>
      )}
    </div>
  )
}

/* ═══ قوس الاعتماد ═══
   نفس منطق سُلّم السقوف، بس كمقياس نصف دائري: القوس بيمتلي
   لحد الدور اللي سقفه يستوعب المبلغ، واللي بعده يبهت. */
const TAU = Math.PI / 180
function arcPath(cx, cy, R, r, a0, a1) {
  const p = (rad, a) => [cx + rad * Math.cos(a * TAU), cy - rad * Math.sin(a * TAU)]
  const [x1, y1] = p(R, a0), [x2, y2] = p(R, a1)
  const [x3, y3] = p(r, a1), [x4, y4] = p(r, a0)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M${x1} ${y1} A${R} ${R} 0 ${large} 0 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 1 ${x4} ${y4} Z`
}

export function GateArc({ amount, authority }) {
  const roles = authority.roles
  // صاحب القرار: أول دور له سقف يستوعب المبلغ
  let decider = roles.findIndex((r) => r.ceiling !== null && r.ceiling >= amount)
  if (decider === -1) decider = roles.length - 1

  // البادنج ثابت في الـviewBox، فأي قطاع يبقى أكتيف ما يتقصّش ولا يزحزح اللاي-أوت
  const cx = 380, cy = 44, R = 330, r = 192, TR = 262
  const SPAN = 180 / roles.length
  const GAP = 4
  const d = roles[decider]
  const uplifted = d.uplift ? Math.round(amount * (1 + d.uplift / 100)) : null

  const [hi, setHi] = useState(null)

  /* المعلومة اللي تظهر في الجوف لما تهوفر على قطاع.
     كل حالة ليها سؤال مختلف، فالكارت مش واحد لكلهم. */
  const detail = (role, i) => {
    if (i > decider) {
      // مش مطلوبة: الأهم هو الرقم اللي بيفعّلها
      let gate = null
      for (let j = i - 1; j >= 0; j--) if (roles[j].ceiling) { gate = roles[j].ceiling; break }
      return {
        k: 'غير مطلوبة لهذا المبلغ',
        t: role.role,
        lines: [
          gate ? <>تبدأ من فوق <b>{nf.format(gate)}</b></> : null,
          role.ceiling
            ? <>سقفها <b>{nf.format(role.ceiling)}</b>{role.note ? ` ${role.note}` : ''}</>
            : 'بلا سقف — آخر مرجع',
        ],
        src: 'المصدر: مصفوفة الصلاحيات',
      }
    }
    if (role.state === 'now') {
      return {
        k: 'واقف هنا الآن',
        t: role.role,
        lines: [
          <><b>سلطان العتيبي</b> · مفتوح من <b>٨٧ يومًا</b></>,
          <><b>2,092</b> ساعة مقابل حدّ <b>900</b> — <span className="bad">132٪ فوق الحدّ</span></>,
          'صلاحيته توصية فقط، لا قرار مالي',
        ],
        src: 'المصدر: سجل الإجراءات',
      }
    }
    if (role.state === 'done') {
      return {
        k: 'تمّت',
        t: role.role,
        lines: ['الجهة قدّمت المشروع ودخل الدراسة', <>أول إجراء مسجَّل <b>١١-٠٥-٢٠٢٦</b></>],
        src: 'المصدر: سجل المشروع',
      }
    }
    const up = role.uplift ? Math.round(amount * (1 + role.uplift / 100)) : null
    return {
      k: i === decider ? 'صاحب القرار في هذا المبلغ' : 'ضمن المسار',
      t: role.role,
      lines: [
        role.ceiling ? <>سقفه <b>{nf.format(role.ceiling)}</b> — يستوعب <b>{nf.format(amount)}</b></> : null,
        up ? <>يقدر يزيد حتى <b>{nf.format(up)}</b> (+{role.uplift}٪) أو يخفّض</> : null,
      ],
      src: 'المصدر: مصفوفة الصلاحيات',
    }
  }

  // ثلاث حالات + الأدوار اللي المبلغ ما وصلهاش
  const skin = (role, i) => {
    if (i > decider) return { fill: '#144547', op: 0.06, cls: 'skip' }
    if (role.state === 'now') return { fill: '#144547', op: 0.92, cls: 'now' }
    if (role.state === 'done') return { fill: '#1E8F5B', op: 0.34, cls: 'done' }
    return { fill: '#00A59B', op: 0.16, cls: 'wait' }
  }

  return (
    <div className="garc">
      <svg viewBox="0 0 760 440" role="img" aria-label={`مسار الاعتماد، صاحب القرار ${d.role}`} onMouseLeave={() => setHi(null)}>
        <defs>
          <linearGradient id="fanFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.06" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="0.38" stopColor="#fff" stopOpacity="0.82" />
            <stop offset="0.76" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="fanMask">
            <rect x="0" y="0" width="760" height="440" fill="url(#fanFade)" />
          </mask>
          <filter id="fanShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="9" stdDeviation="13" floodColor="#0E3234" floodOpacity="0.28" />
          </filter>
        </defs>

        <g>
          {roles.map((role, i) => {
            const a0 = -(i + 1) * SPAN + GAP / 2
            const a1 = -i * SPAN - GAP / 2
            const mid = (a0 + a1) / 2
            const sk = skin(role, i)
            // الخطوة الواقفين عندها أكبر من الباقي، فبتقرا قبل أي حاجة
            const isNow = sk.cls === 'now'
            const RR = isNow ? R + 20 : R
            const rr = isNow ? r - 12 : r
            const tr = isNow ? TR + 4 : TR
            const tx = cx + tr * Math.cos(mid * TAU)
            const ty = cy - tr * Math.sin(mid * TAU)
            return (
              <g key={role.role} className="fanslot" style={{ '--d': `${i * 90}ms` }}>
              <g
                className={`fan ${sk.cls}${i === decider ? ' dec' : ''}${hi === i ? ' hov' : ''}`}
                onMouseEnter={() => setHi(i)}
                onFocus={() => setHi(i)}
                tabIndex={0}
                role="button"
                aria-label={role.role}
              >
                <g opacity={sk.op} mask="url(#fanMask)">
                  <path
                    d={arcPath(cx, cy, RR, rr, a0, a1)}
                    fill={sk.fill}
                    stroke={sk.fill}
                    strokeWidth="11"
                    strokeLinejoin="round"
                    filter={isNow ? 'url(#fanShadow)' : undefined}
                  />
                </g>
                <text x={tx} y={ty} textAnchor="middle">
                  <tspan x={tx} dy="0" className="fanrole">{role.role}</tspan>
                  <tspan x={tx} dy="20" className="fancap">
                    {role.ceiling
                      ? nf.format(role.ceiling)
                      : role.kind === 'submit'
                      ? 'تمّ'
                      : role.kind === 'recommend'
                      ? 'توصية فقط'
                      : 'بلا سقف'}
                  </tspan>
                </text>
                <title>{`${role.role} — ${role.ceiling ? `سقفه ${nf.format(role.ceiling)}` : role.kind === 'recommend' ? 'توصية فقط' : 'بلا سقف'}`}</title>
              </g>
              </g>
            )
          })}
        </g>

      </svg>

      {/* جوف نصف الدائرة: قراءة واحدة، بتتبدّل حسب القطاع اللي تحت الماوس */}
      <div className="fanhole" key={hi === null ? 'base' : hi}>
        {hi === null ? (
          <>
            <div className="fhk">صاحب القرار في هذا المبلغ</div>
            <div className="fht">{d.role}</div>
            {uplifted && (
              <div className="fhl">
                سقفه <b>{nf.format(d.ceiling)}</b> · يزيد حتى <b>{nf.format(uplifted)}</b> <Riyal />
              </div>
            )}
            {authority.provisional && <div className="fhp">السقوف مؤقتة، بانتظار العميل</div>}
          </>
        ) : (
          (() => {
            const x = detail(roles[hi], hi)
            return (
              <>
                <div className="fhk">{x.k}</div>
                <div className="fht">{x.t}</div>
                {x.lines.filter(Boolean).map((l, j) => (
                  <div className="fhl" key={j}>{l}</div>
                ))}
                <div className="fhs">{x.src}</div>
              </>
            )
          })()
        )}
      </div>
    </div>
  )
}

export function Tabs({ items, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === active}
          className={`tab ${t === active ? 'on' : ''}`}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

const dotColor = { teal: 'var(--teal)', lime: 'var(--lime)', ok: 'var(--ok)', warn: 'var(--warn)', ret: 'var(--ret)', no: 'var(--no)', mute: 'rgba(var(--edgeC),.4)' }

export function Timeline({ events }) {
  return (
    <div className="tl">
      {events.map((e, i) => (
        <div className="ev" key={i}>
          <span className="dt" style={{ background: dotColor[e.tone] || dotColor.mute }} />
          <div>
            <div className="tx">{e.title}</div>
            {e.by && <div className="by">{e.by}</div>}
            {e.foot && <div className="sub" style={{ marginTop: '.35rem', color: e.footTone }}>{e.foot}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Empty({ title, note, actions }) {
  return (
    <div className="well empty">
      <div className="t">{title}</div>
      {note && <div className="sub" style={{ marginTop: '.3rem' }}>{note}</div>}
      {actions && <div className="emptyact">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, unit, note, bar }) {
  return (
    <div className="glass stat">
      <div className="lb">{label}</div>
      <div className="v">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {bar && (
        <div className="bar">
          <i style={{ width: bar.w, background: bar.c }} />
        </div>
      )}
      {note && (
        <div
          className="sub trim1"
          style={{ marginTop: bar ? '.4rem' : '.6rem' }}
          title={typeof note === 'string' ? note : undefined}
        >
          {note}
        </div>
      )}
    </div>
  )
}
