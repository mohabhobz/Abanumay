import { useState, type ReactNode } from 'react'
import { nf } from '@/lib/format'
import { Riyal } from './primitives'
import type { AuthorityMatrix, AuthorityRole } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   قوس الاعتماد

   مسار الاعتماد مش ثابت، هو دالة في المبلغ: القوس بيمتلي لحدّ الدور
   اللي سقفه يستوعب المبلغ، واللي بعده يبهت — فالمستخدم يشوف مين
   صاحب القرار قبل ما يقرأ رقم.
   ═══════════════════════════════════════════════════════════ */

const TAU = Math.PI / 180

/** قطاع حلقي بين نصف قطرين وزاويتين */
function arcPath(cx: number, cy: number, R: number, r: number, a0: number, a1: number): string {
  const p = (rad: number, a: number): [number, number] => [
    cx + rad * Math.cos(a * TAU),
    cy - rad * Math.sin(a * TAU),
  ]
  const [x1, y1] = p(R, a0)
  const [x2, y2] = p(R, a1)
  const [x3, y3] = p(r, a1)
  const [x4, y4] = p(r, a0)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M${x1} ${y1} A${R} ${R} 0 ${large} 0 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 1 ${x4} ${y4} Z`
}

/** على الموبايل الاسم بيتقسم سطرين عشان يدخل في عرض القطاع */
function splitRole(text: string): string[] {
  const words = text.split(' ')
  if (words.length < 2) return [text]
  const half = Math.ceil(words.length / 2)
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')]
}

/** حالة الدور الواقف عنده المشروع — بتيجي من سجل الإجراءات، مش مكتوبة هنا */
export interface CurrentStandingInfo {
  by: string
  days: number
  hours: number
  limit: number
  /** أول إجراء مسجَّل، للدور اللي خلص */
  firstActionAt?: string
}

export interface GateArcProps {
  amount: number
  authority: AuthorityMatrix
  /** يقسّم أسماء الأدوار سطرين ويحرّك التفاصيل تحت القوس */
  compact?: boolean
  standing?: CurrentStandingInfo
}

interface Detail {
  k: string
  t: string
  lines: ReactNode[]
  src: string
}

const CX = 380
const CY = 44
const R_OUT = 330
const R_IN = 192
const R_TEXT = 262
const GAP = 4

export function GateArc({ amount, authority, compact = false, standing }: GateArcProps) {
  const roles = authority.roles
  const [hover, setHover] = useState<number | null>(null)

  // صاحب القرار: أول دور له سقف يستوعب المبلغ
  let decider = roles.findIndex((r) => r.ceiling !== null && r.ceiling >= amount)
  if (decider === -1) decider = roles.length - 1

  const span = 180 / roles.length
  const decided = roles[decider] as AuthorityRole
  const uplifted = decided.uplift ? Math.round(amount * (1 + decided.uplift / 100)) : null

  /** القراءة اللي تظهر في جوف القوس — لكل حالة سؤال مختلف */
  const detail = (role: AuthorityRole, i: number): Detail => {
    if (i > decider) {
      // مش مطلوبة: الأهم هو الرقم اللي بيفعّلها
      let gate: number | null = null
      for (let j = i - 1; j >= 0; j--) {
        const c = roles[j]?.ceiling
        if (c) { gate = c; break }
      }
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
      const over = standing ? Math.round((standing.hours / standing.limit) * 100) : null
      return {
        k: 'واقف هنا الآن',
        t: role.role,
        lines: standing
          ? [
              <><b>{standing.by}</b> · مفتوح من <b>{standing.days}</b> يومًا</>,
              <>
                <b>{nf.format(standing.hours)}</b> ساعة مقابل حدّ <b>{nf.format(standing.limit)}</b>
                {over !== null && over > 100 && <> — <span className="bad">{over}% فوق الحدّ</span></>}
              </>,
              role.kind === 'recommend' ? 'صلاحيته توصية فقط، لا قرار مالي' : null,
            ]
          : [role.kind === 'recommend' ? 'صلاحيته توصية فقط، لا قرار مالي' : null],
        src: 'المصدر: سجل الإجراءات',
      }
    }

    if (role.state === 'done') {
      return {
        k: 'تمّت',
        t: role.role,
        lines: [
          'الجهة قدّمت المشروع ودخل الدراسة',
          standing?.firstActionAt ? <>أول إجراء مسجَّل <b>{standing.firstActionAt}</b></> : null,
        ],
        src: 'المصدر: سجل المشروع',
      }
    }

    const up = role.uplift ? Math.round(amount * (1 + role.uplift / 100)) : null
    return {
      k: i === decider ? 'صاحب القرار في هذا المبلغ' : 'ضمن المسار',
      t: role.role,
      lines: [
        role.ceiling
          ? <>سقفه <b>{nf.format(role.ceiling)}</b> — يستوعب <b>{nf.format(amount)}</b></>
          : null,
        up ? <>يقدر يزيد حتى <b>{nf.format(up)}</b> (+{role.uplift}%) أو يخفّض</> : null,
      ],
      src: 'المصدر: مصفوفة الصلاحيات',
    }
  }

  /** القطاع الواقفين عنده يترسم آخر واحد عشان ظله ما يتغطّاش */
  const paintOrder = (() => {
    const order = roles.map((_, i) => i)
    const now = roles.findIndex((r) => r.state === 'now')
    if (now > -1) {
      order.splice(order.indexOf(now), 1)
      order.push(now)
    }
    return order
  })()

  const skin = (role: AuthorityRole, i: number) => {
    if (i > decider) return { fill: '#144547', op: 0.06, cls: 'skip' }
    if (role.state === 'now') return { fill: '#144547', op: 0.92, cls: 'now' }
    if (role.state === 'done') return { fill: '#1E8F5B', op: 0.34, cls: 'done' }
    return { fill: '#00A59B', op: 0.16, cls: 'wait' }
  }

  const active = hover === null ? null : detail(roles[hover] as AuthorityRole, hover)

  const fallbackLines = (
    <>
      {uplifted && decided.ceiling && (
        <div className="fhl">
          سقفه <b>{nf.format(decided.ceiling)}</b> · يزيد حتى <b>{nf.format(uplifted)}</b> <Riyal />
        </div>
      )}
      {authority.provisional && <div className="fhp">السقوف مؤقتة، بانتظار العميل</div>}
    </>
  )

  const activeLines = active && (
    <>
      {active.lines.filter(Boolean).map((line, j) => (
        <div className="fhl" key={j}>{line}</div>
      ))}
      <div className="fhs">{active.src}</div>
    </>
  )

  return (
    <div className="garc">
      <svg
        viewBox="0 0 760 440"
        role="img"
        aria-label={`مسار الاعتماد، صاحب القرار ${decided.role}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* التدرّج بإحداثيات المستخدم عشان يفضل مربوط بالقوس نفسه،
              والمستطيل أوسع من الـviewBox عشان ما يقصّش ظل القطاع النشط */}
          <linearGradient id="fanFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="440">
            <stop offset="0.06" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="0.38" stopColor="#fff" stopOpacity="0.82" />
            <stop offset="0.76" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="fanMask" maskUnits="userSpaceOnUse" x="-160" y="-160" width="1080" height="760">
            <rect x="-160" y="-160" width="1080" height="760" fill="url(#fanFade)" />
          </mask>
          <filter id="fanShadow" x="-45%" y="-45%" width="190%" height="190%">
            <feDropShadow dx="0" dy="9" stdDeviation="13" floodColor="#0E3234" floodOpacity="0.28" />
          </filter>
        </defs>

        <g>
          {paintOrder.map((i) => {
            const role = roles[i] as AuthorityRole
            const a0 = -(i + 1) * span + GAP / 2
            const a1 = -i * span - GAP / 2
            const mid = (a0 + a1) / 2
            const sk = skin(role, i)
            // الخطوة الواقفين عندها أكبر من الباقي، فبتقرا قبل أي حاجة
            const isNow = sk.cls === 'now'
            const rOut = isNow ? R_OUT + 20 : R_OUT
            const rIn = isNow ? R_IN - 12 : R_IN
            const rText = isNow ? R_TEXT + 4 : R_TEXT
            const tx = CX + rText * Math.cos(mid * TAU)
            const ty = CY - rText * Math.sin(mid * TAU)

            return (
              <g key={role.role} className="fanslot" style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>
                <g
                  className={`fan ${sk.cls}${i === decider ? ' dec' : ''}${hover === i ? ' hov' : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onClick={() => setHover(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={role.role}
                >
                  <g opacity={sk.op} mask="url(#fanMask)">
                    <path
                      d={arcPath(CX, CY, rOut, rIn, a0, a1)}
                      fill={sk.fill}
                      stroke={sk.fill}
                      strokeWidth="11"
                      strokeLinejoin="round"
                      filter={isNow ? 'url(#fanShadow)' : undefined}
                    />
                  </g>
                  <text x={tx} y={ty + (compact ? -14 : 0)} textAnchor="middle">
                    {(compact ? splitRole(role.role) : [role.role]).map((line, k) => (
                      <tspan key={k} x={tx} dy={k === 0 ? 0 : compact ? 26 : 0} className="fanrole">
                        {line}
                      </tspan>
                    ))}
                    <tspan x={tx} dy={compact ? 25 : 20} className="fancap">
                      {role.ceiling
                        ? nf.format(role.ceiling)
                        : role.kind === 'submit'
                          ? 'تمّ'
                          : role.kind === 'recommend'
                            ? compact ? 'توصية' : 'توصية فقط'
                            : 'بلا سقف'}
                    </tspan>
                  </text>
                  <title>
                    {`${role.role} — ${
                      role.ceiling
                        ? `سقفه ${nf.format(role.ceiling)}`
                        : role.kind === 'recommend'
                          ? 'توصية فقط'
                          : 'بلا سقف'
                    }`}
                  </title>
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      {/* جوف نصف الدائرة: قراءة واحدة بتتبدّل حسب القطاع تحت الماوس.
          على الموبايل الجوف بيشيل العنوان بس، والباقي بينزل تحت القوس. */}
      <div className="fanhole" key={hover === null ? 'base' : hover}>
        <div className="fhk">{active ? active.k : 'صاحب القرار في هذا المبلغ'}</div>
        <div className="fht">{active ? active.t : decided.role}</div>
        {!compact && (active ? activeLines : fallbackLines)}
      </div>

      {compact && (
        <div className="fanfoot" key={hover === null ? 'fbase' : `f${hover}`}>
          {active ? activeLines : fallbackLines}
        </div>
      )}
    </div>
  )
}
