import { useState, type ReactNode } from 'react'
import { nf, NOUN, nounAfter } from '@/lib/format'
import { Money } from './primitives'
import { Person } from './Person'
import type { AuthorityMatrix, AuthorityRole } from '@/types/domain'

/* Approval arc

   The approval path isn't fixed — it's a function of the amount: the arc fills up to the tier whose
   ceiling covers the amount, and everything past it fades, so the user sees who the approver is
   before reading any number. */

const TAU = Math.PI / 180

/** Ring sector between two radii and two angles */
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

/** On mobile the name wraps to two lines so it fits the sector's width */
function splitRole(text: string): string[] {
  const words = text.split(' ')
  if (words.length < 2) return [text]
  const half = Math.ceil(words.length / 2)
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')]
}

/** Status of the tier the project is currently at · comes from the action log, not hardcoded here */
export interface CurrentStandingInfo {
  by: string
  days: number
  hours: number
  limit: number
  /** First logged action, for the tier that's done */
  firstActionAt?: string
}

export interface GateArcProps {
  amount: number
  authority: AuthorityMatrix
  /** Wraps role names to two lines · details sit below the arc either way */
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

  // Approver: the first tier with a ceiling that covers the amount
  let decider = roles.findIndex((r) => r.ceiling !== null && r.ceiling >= amount)
  if (decider === -1) decider = roles.length - 1

  const decided = roles[decider] as AuthorityRole
  const uplifted = decided.uplift ? Math.round(amount * (1 + decided.uplift / 100)) : null

  /** The reading shown inside the arc · a different question for each state */
  const detail = (role: AuthorityRole, i: number): Detail => {
    if (i > decider) {
      // Not required — what matters is the number that activates it
      let gate: number | null = null
      for (let j = i - 1; j >= 0; j--) {
        const c = roles[j]?.ceiling
        if (c) { gate = c; break }
      }
      return {
        k: 'غير مطلوبة لهذا المبلغ',
        t: role.role,
        lines: [
          gate ? <>تبدأ فيما يزيد على <b>{nf.format(gate)}</b></> : null,
          role.ceiling
            ? <>حدها المالي <b>{nf.format(role.ceiling)}</b>{role.note ? ` ${role.note}` : ''}</>
            : 'بلا حد مالي، وهي المرجع الأخير',
        ],
        src: 'المصدر: مصفوفة الصلاحيات',
      }
    }

    if (role.state === 'now') {
      const over = standing ? Math.round((standing.hours / standing.limit) * 100) : null
      return {
        k: 'متوقف هنا الآن',
        t: role.role,
        lines: standing
          ? [
              <><Person name={standing.by} quiet={false} /> · مفتوح منذ <b>{standing.days}</b> {nounAfter(standing.days, NOUN.day)}</>,
              <>
                <b>{nf.format(standing.hours)}</b> ساعة مقابل حدّ <b>{nf.format(standing.limit)}</b>
                {over !== null && over > 100 && <>، <span className="bad"><span className="num">{over}%</span> فوق الحدّ</span></>}
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
        lines: role.kind === 'submit'
          ? [
              'قدّمت الجهة المشروع، وانتقل إلى الدراسة',
              standing?.firstActionAt ? <>أول إجراء مسجَّل <b>{standing.firstActionAt}</b></> : null,
            ]
          : [role.kind === 'recommend' ? 'أوصى وأحال المشروع للمستوى التالي' : 'رفع المشروع لأنّ مبلغه فوق حدّه المالي'],
        src: 'المصدر: سجل المشروع',
      }
    }

    const up = role.uplift ? Math.round(amount * (1 + role.uplift / 100)) : null
    return {
      k: i === decider ? 'صاحب القرار في هذا المبلغ' : 'ضمن المسار',
      t: role.role,
      lines: [
        role.ceiling
          ? <>حده المالي <b>{nf.format(role.ceiling)}</b>، ويستوعب <b>{nf.format(amount)}</b></>
          : null,
        up ? <>يمكنه الرفع حتى <b>{nf.format(up)}</b> <span className="num">(+{role.uplift}%)</span> أو التخفيض</> : null,
      ],
      src: 'المصدر: مصفوفة الصلاحيات',
    }
  }

  const skin = (role: AuthorityRole, i: number): SlotCls => {
    if (i > decider) return 'skip'
    if (role.state === 'now') return 'now'
    if (role.state === 'done') return 'done'
    return 'wait'
  }

  const slots: Slot[] = roles.map((role, i) => {
    const cap = (c: boolean) =>
      role.ceiling
        ? nf.format(role.ceiling)
        : role.kind === 'submit'
          ? 'تمّ'
          : role.kind === 'recommend'
            ? c ? 'توصية' : 'توصية فقط'
            : 'بلا حد مالي'
    return {
      key: role.role,
      label: role.role,
      cap: cap(false),
      capCompact: cap(true),
      cls: skin(role, i),
      raised: role.state === 'now',
      dec: i === decider,
      detail: detail(role, i),
    }
  })

  const fallback: (ReactNode | null)[] = [
    uplifted && decided.ceiling ? (
      <>
        حده المالي <b className="num">{nf.format(decided.ceiling)}</b> · يمكنه الرفع حتى{' '}
        <Money>{uplifted}</Money>
      </>
    ) : null,
    authority.provisional ? (
      <span className="fhp">الحدود المالية مؤقتة، بانتظار تأكيد العميل</span>
    ) : null,
  ]

  return (
    <Fan
      slots={slots}
      compact={compact}
      aria={`مسار الاعتماد، صاحب القرار ${decided.role}`}
      restK="صاحب القرار في هذا المبلغ"
      restT={decided.role}
      rest={fallback}
    />
  )
}

/* Step arc

   The same fan, driven by a process's own steps instead of the authority matrix. Used by the
   agreement and closing pages so all three detail pages share one header chart. */

export type GateStepState = 'done' | 'now' | 'pending' | 'skip'

export interface GateStep {
  /** Name inside the sector - who holds the step, like the project's roles */
  label: string
  /** Heading of the hover reading · defaults to `label` */
  title?: string
  /** Short line under the name inside the sector */
  cap: string
  state: GateStepState
  /** Reading shown under the arc when the step is hovered */
  lines?: ReactNode[]
  src?: string
}

export interface StepArcProps {
  steps: GateStep[]
  /** Key and name shown in the hollow center at rest */
  holderKey: string
  holder: string
  /** Up to two lines under the arc at rest */
  rest?: (ReactNode | null)[]
  compact?: boolean
  /** Accessible name of the whole chart */
  aria: string
}

const STEP_KEY: Record<GateStepState, string> = {
  done: 'تمّت',
  now: 'صاحب القرار الآن',
  pending: 'ضمن المسار',
  skip: 'لا تنطبق على هذا الطلب',
}

const STEP_CLS: Record<GateStepState, SlotCls> = {
  done: 'done',
  now: 'now',
  pending: 'wait',
  skip: 'skip',
}

export function StepArc({ steps, holderKey, holder, rest = [], compact = false, aria }: StepArcProps) {
  const slots: Slot[] = steps.map((s) => ({
    key: s.label,
    label: s.label,
    cap: s.cap,
    capCompact: s.cap,
    cls: STEP_CLS[s.state],
    raised: s.state === 'now',
    // The hollow center already names the holder; the dark 'now' sector keeps its light ink.
    dec: false,
    detail: { k: STEP_KEY[s.state], t: s.title ?? s.label, lines: s.lines ?? [], src: s.src ?? '' },
  }))
  return <Fan slots={slots} compact={compact} aria={aria} restK={holderKey} restT={holder} rest={rest} />
}

/* Shared renderer */

type SlotCls = 'skip' | 'now' | 'done' | 'wait'

interface Slot {
  key: string
  label: string
  cap: string
  capCompact: string
  cls: SlotCls
  /** Drawn last so its shadow isn't covered */
  raised: boolean
  dec: boolean
  detail: Detail
}

const SKIN: Record<SlotCls, { fill: string; op: number }> = {
  skip: { fill: '#144547', op: 0.06 },
  now: { fill: '#144547', op: 0.92 },
  done: { fill: '#1E8F5B', op: 0.34 },
  wait: { fill: '#00A59B', op: 0.16 },
}

interface FanProps {
  slots: Slot[]
  compact: boolean
  aria: string
  restK: string
  restT: string
  rest: (ReactNode | null)[]
}

function Fan({ slots, compact, aria, restK, restT, rest }: FanProps) {
  const [hover, setHover] = useState<number | null>(null)
  const span = 180 / slots.length

  /** The sector the process is currently at is drawn last so its shadow isn't covered */
  const paintOrder = (() => {
    const order = slots.map((_, i) => i)
    const now = slots.findIndex((s) => s.raised)
    if (now > -1) {
      order.splice(order.indexOf(now), 1)
      order.push(now)
    }
    return order
  })()

  const active = hover === null ? null : (slots[hover] as Slot).detail

  /* ═══════════════════════════════════════════════════════════
     Three fixed rows, always · so hover cannot move the page

     The caption used to render only the rows it had: one line at
     rest, three on hover. The block grew, the card grew with it,
     and everything below the fan slid down the moment the pointer
     touched a sector. Reading a chart must never move the page
     you are reading it on.

     So the caption is always exactly three rows — two detail lines
     and a source — and an empty row holds a non-breaking space.
     The height is then structural, not a number someone has to
     keep in sync with the longest state.
     ═══════════════════════════════════════════════════════════ */
  const NB = '\u00A0'

  const rows = active ? active.lines.filter(Boolean) : rest.filter(Boolean)
  const src = active && active.src ? active.src : null

  return (
    <div className="garc">
      {/* The chart and the hollow center share one box · the ratios in `.fanhole` must be computed
          from the **drawing box**, not the whole card, otherwise the detail line below stretches
          the parent, the ratio yields a larger number, and the box overflows again. */}
      <div className="garc-p">
      <svg
        viewBox="0 0 760 440"
        role="img"
        aria-label={aria}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* The gradient uses user-space coordinates so it stays anchored to the arc itself, and
              the rectangle is wider than the viewBox so it doesn't clip the active sector's shadow */}
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
            const slot = slots[i] as Slot
            const a0 = -(i + 1) * span + GAP / 2
            const a1 = -i * span - GAP / 2
            const mid = (a0 + a1) / 2
            const sk = { ...SKIN[slot.cls], cls: slot.cls }
            // The step the project is currently at is larger than the rest, so it reads first,
            // before anything else
            const isNow = sk.cls === 'now'
            const rOut = isNow ? R_OUT + 20 : R_OUT
            const rIn = isNow ? R_IN - 12 : R_IN
            const rText = isNow ? R_TEXT + 4 : R_TEXT
            const tx = CX + rText * Math.cos(mid * TAU)
            const ty = CY - rText * Math.sin(mid * TAU)

            return (
              <g key={slot.key} className="fanslot" style={{ '--d': `calc(var(--mo-stagger) * ${i * 1.5})` } as React.CSSProperties}>
                <g
                  className={`fan ${sk.cls}${slot.dec ? ' dec' : ''}${hover === i ? ' hov' : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onClick={() => setHover(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={slot.label}
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
                    {(compact ? splitRole(slot.label) : [slot.label]).map((line, k) => (
                      <tspan key={k} x={tx} dy={k === 0 ? 0 : compact ? 26 : 0} className="fanrole">
                        {line}
                      </tspan>
                    ))}
                    <tspan x={tx} dy={compact ? 25 : 20} className="fancap">
                      {compact ? slot.capCompact : slot.cap}
                    </tspan>
                  </text>
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Half-circle hollow center
          The hollow center has a **fixed, known area**: a half-disc of radius 180 (`R_IN` minus the
          expansion the active step takes). What used to sit inside it had a **variable length**: a
          key, a title, and three or four lines of detail depending on which sector is hovered.

          Variable content in a fixed area means overflow. The measurement: the farthest corner of
          the text box sat at a distance of **280** from the arc's center, and the boundary is
          **180** — 100 pixels intruding into the sectors, which is what buried "ceiling 1,000,000"
          under "entity submission."

          The fix: the hollow center takes only the **fixed part** (key and name), and the variable
          detail goes below the arc, exactly like the compact layout already does. Both layouts are
          now one behavior, so the bug can't come back through the other one. */}
      <div className="fanhole" key={hover === null ? 'base' : hover}>
        <div className="fhk">{active ? active.k : restK}</div>
        <div className="fht">{active ? active.t : restT}</div>
      </div>
      </div>

      <div className="fanfoot" key={hover === null ? 'fbase' : `f${hover}`}>
        <div className="fhl">{rows[0] ?? NB}</div>
        <div className="fhl">{rows[1] ?? NB}</div>
        <div className="fhs">{src ?? NB}</div>
      </div>
    </div>
  )
}
