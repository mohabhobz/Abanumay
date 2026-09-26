import { Glass, Money, Num } from '@/components/ui'
import { nf } from '@/lib/format'
import { CYCLES, plan2026, type PlanNode } from '@/data/budgetPlan'

/**
 * Budget charts - the charts drawn with real data.
 *
 * These used to be empty charts with random bars that showed the chart's shape rather than its
 * values. That was the wrong call: a screen that says "there's a chart here" without drawing it
 * reads no differently from a line of text, and a viewer rightly asks where the chart actually is.
 *
 * The layout intentionally differs from the live system: "annual spending by area" uses vertical
 * bars there across 39 targets, so the Arabic labels get written vertically, overlapping and
 * unreadable - the number is there but the width blocks it. Here the bars are horizontal: the label
 * reads horizontally as normal, and length is the measure.
 *
 * Colors: the three layers aren't independent categories, they're parts of a whole - disbursed is
 * part of committed, and committed is part of allocated. So the color is shades of one hue with
 * neutral for the remainder, not a categorical palette. The difference between them is lightness,
 * not hue, so it stays legible for color blindness, backed by a legend and written values.
 */

const SERIES = [
  { key: 'spent', label: 'المصروف', cls: 'a' },
  { key: 'unpaid', label: 'ملتزم لم يُصرف', cls: 'b' },
  { key: 'free', label: 'غير ملتزم', cls: 'c' },
] as const

interface Part { label: string; alloc: number; spent: number; unpaid: number; free: number }

const partsOf = (n: PlanNode): Part => {
  const spent = n.spent ?? 0
  /* Committed-but-not-yet-disbursed = approved minus disbursed. When approved isn't known, we fall
   back to the reserved amount - narrower, but it avoids double-counting. */
  const unpaid = Math.max(0, (n.approved ?? spent + (n.reserved ?? 0)) - spent)
  return { label: n.label, alloc: n.alloc, spent, unpaid, free: Math.max(0, n.alloc - spent - unpaid) }
}

/** All twelve areas across both tracks. */
const fields2026: PlanNode[] =
  (plan2026.children ?? []).flatMap((t) => t.children ?? [])

/* 1 - percentage spent */

/**
 * A single number, not a chart.
 *
 * "Percentage of the annual budget spent" is one value, and one value is a number tile with a
 * scale, not a bar inside a chart frame. The live system draws it as a full-width, gridded bar to
 * fill space.
 *
 * Space: this card sits next to a two-line chart on a grid, so its height is set by the chart, not
 * its own content - the content used to sit on top with the rest left empty in the middle of the
 * card. That empty space isn't breathing room, it's unused space that tells the eye something is
 * missing.
 *
 * The fix is for the number to take that space rather than leave it: a header on top (title and a
 * line explaining the percentage), the number centered in what's left in a large size, and the
 * scale and detail below it. So the card reads top to bottom with no gap, and if it grows taller
 * the number stays centered.
 */
export function SpendGauge({
  title = 'نسبة المصروف من الميزانية السنوية',
  value, of, note,
  hint = 'ما صُرف فعلًا حتى اليوم من الميزانية المخصَّصة للسنة',
}: { title?: string; value: number; of: number; note?: string; hint?: string }) {
  const pct = of ? Math.round((value / of) * 100) : 0
  return (
    <Glass className="chq">
      <span className="chq-h">
        <span className="chq-t">{title}</span>
        <span className="chq-d mut">{hint}</span>
      </span>

      <span className="chq-b">
        <span className="chq-v"><b className="num">{pct}%</b></span>
        <span className="chq-m" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
        <span className="chq-s mut">
          <Money sm>{value}</Money>
          <small className="chb-of">من</small>
          <Money sm>{of}</Money>
          {note ? <span className="chq-note">· {note}</span> : null}
        </span>
      </span>
    </Glass>
  )
}

/* 2 - spending by area */

export function FieldSpend({ nodes = fields2026 }: { nodes?: PlanNode[] }) {
  const parts = nodes.map(partsOf).sort((a, b) => b.alloc - a.alloc)
  const max = Math.max(...parts.map((p) => p.alloc), 1)

  return (
    <Glass className="chb">
      <span className="chb-h">
        <span className="chb-t">المصاريف السنوية حسب المجال</span>
        <span className="chb-k">
          {SERIES.map((s) => (
            <span key={s.key}><i className={s.cls} />{s.label}</span>
          ))}
        </span>
      </span>

      <div className="chb-rows">
        {parts.map((p) => (
          <div className="chb-r" key={p.label}>
            <span className="chb-lb" title={p.label}>{p.label}</span>
            <span className="chb-tr" style={{ width: `${(p.alloc / max) * 100}%` }}>
              {SERIES.map((s) => {
                const v = p[s.key]
                if (v <= 0) return null
                return (
                  <i
                    key={s.key}
                    className={s.cls}
                    style={{ width: `${(v / p.alloc) * 100}%` }}
                    title={`${p.label} · ${s.label}`}
                  />
                )
              })}
            </span>
            {/* Note: the spacing around "from" used to be typed - a space character inside the text. A typed
   space gets tangled with the icon and direction, and doesn't scale when we ask it to grow. It's
   now a declared `gap`. */}
            <span className="chb-v">
              <Money sm>{p.spent}</Money>
              <small className="chb-of">من</small>
              <small className="sub"><Money sm>{p.alloc}</Money></small>
            </span>
          </div>
        ))}
      </div>

      <p className="mut chb-n">
        يعرض النظام العامل هذا الرسم أعمدةً رأسيةً على <Num>39</Num> هدفًا، فتظهر الأسماء
        مقلوبة ومتداخلة. الأعمدة الأفقية تجعل الاسم مقروءًا، والطول هو المقياس.
      </p>
    </Glass>
  )
}

/* 3 - annual spending */

/**
 * Change over time - five cycles with short labels, so vertical bars work here: the axis has five
 * marks and their labels are written horizontally beneath them.
 */
/**
 * Annual spending - two lines, not bars.
 *
 * Paired bars used to place two bars side by side per year, so the eye reads ten blocks and has to
 * work out which goes with which. The question here isn't "how much in 2024?" - it's "does spending
 * track allocation or exceed it?", which is a question about trend, and trend reads from a line,
 * not a block.
 *
 * The line follows the reading direction: oldest on the right, newest on the left, exactly like
 * Arabic text, so the eye reads time while moving naturally.
 *
 * Glow: the glow is a blurred copy of the line itself underneath it, not a filled area under the
 * line. The difference isn't cosmetic - a filled area says "the total under the curve", a meaning
 * that doesn't apply to a ceiling. When both were filled areas, the overlap turned into a dirty
 * gray block eating half the chart. The blurred version turns the overlap into light rather than
 * sediment, and the line stays the edge.
 *
 * A stop isn't a point on the line: `CYCLES` holds five cycles, not five years - four for the
 * institution (2026...2023) and one for the endowment, sitting at 2023. Connecting them with a
 * single line would say 2023-endowment is a time step after 2023-institution and that spending
 * dropped from 847,000 to zero - which never happened; they're two different entities in the same
 * year. So the line covers the institution alone, and the endowment gets its own row below it.
 */

/** Chart coordinates - the viewBox is close to the real size so stroke width stays natural. */
const CH = { w: 680, h: 190, top: 26, bottom: 40, side: 34 }

/**
 * A smooth curve with no overshoot - monotone (Fritsch-Carlson).
 *
 * A plain cardinal spline overshoots between two far-apart points: going from 47M to 1M it used to
 * dip below zero before rising, showing a negative value that never happened. Monotone
 * interpolation computes and clamps the slope at each point, so the line stays between the two
 * values it connects.
 *
 * It also returns an evaluation function, not just a path, so the overshoot region can be computed
 * by sampling rather than an SVG mask.
 */
const spline = (pts: { x: number; y: number }[]) => {
  const n = pts.length
  /* Points come right to left (x decreasing), and the calculation needs them ascending. */
  const p = pts[0].x > pts[n - 1].x ? [...pts].reverse() : [...pts]
  const dx: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i] }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  /* Slope limit - the no-overshoot condition. */
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b)
    if (h > 3) { t[i] = (3 / h) * a * m[i]; t[i + 1] = (3 / h) * b * m[i] }
  }

  let d = `M${p[0].x} ${p[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(p[i].x + h).toFixed(2)} ${(p[i].y + t[i] * h).toFixed(2)}`
      + ` ${(p[i + 1].x - h).toFixed(2)} ${(p[i + 1].y - t[i + 1] * h).toFixed(2)}`
      + ` ${p[i + 1].x} ${p[i + 1].y.toFixed(2)}`
  }

  /** y value at any x - Hermite interpolation on the containing segment. */
  const at = (x: number): number => {
    let i = 0
    while (i < n - 2 && x > p[i + 1].x) i++
    const h = dx[i], u = Math.min(1, Math.max(0, (x - p[i].x) / h)), u2 = u * u, u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * p[i].y + (u3 - 2 * u2 + u) * h * t[i]
      + (-2 * u3 + 3 * u2) * p[i + 1].y + (u3 - u2) * h * t[i + 1]
  }
  return { d, at }
}

export function YearSpend() {
  /* Oldest first in the row - and in RTL the start of the row is the right side, so time follows the
   reading direction.
     The endowment cycle is excluded from the line: it isn't another year, it's a different entity
     in the same year - shown below in its own row. */
  const rows = [...CYCLES].filter((c) => !c.activeWaqf).reverse()
  const waqf = CYCLES.find((c) => c.activeWaqf)
  const max = Math.max(...rows.map((c) => Math.max(c.alloc, c.spent)), 1)
  const { w, h, top, bottom, side } = CH
  const plotH = h - top - bottom
  const stepX = (w - side * 2) / (rows.length - 1)
  /* First point on the right: the axis is flipped manually since SVG has no direction. */
  const X = (i: number) => w - side - i * stepX
  const Y = (v: number) => top + plotH * (1 - v / max)

  const pAlloc = rows.map((c, i) => ({ x: X(i), y: Y(c.alloc) }))
  const pSpent = rows.map((c, i) => ({ x: X(i), y: Y(c.spent) }))

  const sAlloc = spline(pAlloc)
  const sSpent = spline(pSpent)
  const overYears = rows.filter((c) => c.spent > c.alloc).map((c) => c.label.split(' ')[0])

  /* Overshoot region - computed by sampling, not a mask.
     A mask subtracts one area from another, so the result covers everything under both lines rather
     than just what's between them. Here we measure at each sample: if spending is above allocation
     (smaller y) we start a segment and close it as soon as it drops back below - so exactly the
     difference gets colored. */
  const SAMPLES = 160
  const x0 = Math.min(pAlloc[0].x, pAlloc[pAlloc.length - 1].x)
  const x1 = Math.max(pAlloc[0].x, pAlloc[pAlloc.length - 1].x)
  const overBands: string[] = []
  let run: { x: number; a: number; s: number }[] = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map((q) => `${q.x.toFixed(1)} ${q.s.toFixed(1)}`).join(' L')
      const bot = [...run].reverse().map((q) => `${q.x.toFixed(1)} ${q.a.toFixed(1)}`).join(' L')
      overBands.push(`M${top} L${bot} Z`)
    }
    run = []
  }
  for (let i = 0; i <= SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / SAMPLES
    const av = sAlloc.at(x), sv = sSpent.at(x)
    if (sv < av - 0.15) run.push({ x, a: av, s: sv })
    else flush()
  }
  flush()

  return (
    <Glass className="chy">
      <span className="chb-h">
        <span className="chb-t">المصاريف السنوية</span>
        {/* The legend draws what's actually drawn: a solid line and a dotted line, not two squares. A square
   says "block", and the chart uses lines; the dotted entry in the legend is the same dotted style
   in the chart. The overshoot color signals a problem, so it belongs in the legend, not only in a
   margin note. */}
        <span className="chb-k">
          <span><i className="ln a" />المصروف</span>
          <span><i className="ln c" />المخصص</span>
          <span><i className="ov" />تجاوز المخصص</span>
        </span>
      </span>

      <svg
        className="chy-svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`المصروف مقابل المخصص عبر ${rows.length} دورات`}
      >
        <defs>
          {/* Glow - a blur on a copy of the line itself. Overlap between two glows turns into light, not
   sediment, and the line on top stays sharp. */}
          <filter id="chyG" x="-8%" y="-30%" width="116%" height="160%">
            {/* A wider blur = a softer halo - a narrow blur gave a second edge next to the line, which read as heavy. */}
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Grid lines - only three, with values at the edge. */}
        {[0, 0.5, 1].map((f) => (
          <line key={f} className="chy-grid"
            x1={side} x2={w - side} y1={top + plotH * f} y2={top + plotH * f} />
        ))}

        {/* One filled area across the whole chart, meaning overshoot. There used to be a gradient fill under
   each line too, making three fills, and the eye couldn't tell which one meant something. The glow
   carries the weight, and the single fill becomes the actual signal.
           Computed by sampling: at each sample, if spending is above allocation, open a segment and
           close it as soon as it drops back - so exactly the difference gets colored. */}
        {overBands.map((d, i) => <path key={i} className="chy-over" d={d} />)}

        <g filter="url(#chyG)" aria-hidden="true">
          <path className="chy-glow c" d={sAlloc.d} />
          <path className="chy-glow a" d={sSpent.d} />
        </g>

        <path className="chy-line c" d={sAlloc.d} />
        <path className="chy-line a" d={sSpent.d} />

        {rows.map((c, i) => (
          <g key={c.id}>
            <circle className="chy-dot c" cx={X(i)} cy={Y(c.alloc)} r="3" />
            <circle className={`chy-dot a${c.spent > c.alloc ? ' over' : ''}`}
              cx={X(i)} cy={Y(c.spent)} r="4" />
            {/* The number is the spending figure, so it sits above the spending point, not above whichever line
   is higher - it used to sit above the allocation point in 2026 and read as if it were that value.
   */}
            <text className="chy-val" x={X(i)} y={Math.max(12, Y(c.spent) - 11)}>
              {nf.format(Math.round(c.spent / 1_000_000))}M
            </text>
            {/* The allocation figure is written only when the two lines are far enough apart - when they're
   close together the numbers overlap and the second one adds nothing, and the gap itself is the
   signal, not the two values. At 2026 the gap is 29 million, so the ceiling has to be stated. */}
            {Math.abs(Y(c.alloc) - Y(c.spent)) > 18 && (
              <text className="chy-val c" x={X(i)}
                y={Y(c.alloc) < Y(c.spent) ? Math.max(11, Y(c.alloc) - 9) : Y(c.alloc) + 16}>
                {nf.format(Math.round(c.alloc / 1_000_000))}M
              </text>
            )}
            <text className="chy-x" x={X(i)} y={h - 16}>{c.label.split(' · ')[0]}</text>
            <text className="chy-x2" x={X(i)} y={h - 4}>{c.label.split(' · ')[1]}</text>
          </g>
        ))}
      </svg>

      {/* The endowment - not a point on the line, so it gets its own row. */}
      {waqf && (
        <span className="chy-side">
          <span className="chy-side-t">الوقف</span>
          <span className="chy-side-v">
            دورة <span className="num">{waqf.label.split(' · ')[0]}</span> · مخصص{' '}
            <Money sm>{waqf.alloc}</Money> · مصروف <Money sm>{waqf.spent}</Money>
          </span>
        </span>
      )}

      <p className="mut chb-n">
        المنطقة الملوّنة بين الخطّين تعني صرفًا تجاوز المخصص، وقد حدث في{' '}
        {overYears.map((y, i) => (
          <span key={y}>
            {i > 0 && ' و'}
            <span className="num">{y}</span>
          </span>
        ))}. ويظهر الوقف خارج الخطّ لأنه جهة أخرى في السنة نفسها، لا سنة تالية.
      </p>
    </Glass>
  )
}

/* 4 - completion plan */

/**
 * "Completion plan" is a field in the allocation editor (`num`) set to 100 for every line item,
 * except Da'wah, and Hajj & Ramadan: zero. That means nine and a half million sits outside the
 * strategic-completion calculation with no indicator on screen.
 *
 * Note: this chart shows the stored field, not the computed completion percentage the live system
 * reports - we weren't able to read that formula.
 */
export function PlanCoverage({ nodes = fields2026 }: { nodes?: PlanNode[] }) {
  const total = nodes.reduce((s, n) => s + n.alloc, 0)
  const inPlan = nodes.filter((n) => n.plan > 0).reduce((s, n) => s + n.alloc, 0)
  const out = nodes.filter((n) => n.plan === 0)

  return (
    <Glass className="chb">
      <span className="chb-h">
        <span className="chb-t">خطة الإنجاز المعلَنة لكل مجال</span>
        <span className="chb-k">
          <span><i className="a" />ضمن الخطة</span>
          <span><i className="c" />خارجها</span>
        </span>
      </span>

      <div className="chb-rows">
        {[...nodes].sort((a, b) => b.alloc - a.alloc).map((n) => (
          <div className="chb-r" key={n.id}>
            <span className="chb-lb" title={n.label}>{n.label}</span>
            <span className="chb-tr" style={{ width: '100%' }}>
              <i
                className={n.plan > 0 ? 'a' : 'c'}
                style={{ width: `${Math.max(2, n.plan)}%` }}
                title={`${n.label} · خطة الإنجاز ${n.plan}%`}
              />
            </span>
            <span className="chb-v"><b className="num">{n.plan}%</b></span>
          </div>
        ))}
      </div>

      <p className="mut chb-n">
        <b><Money sm>{total - inPlan}</Money></b> من <Money sm>{total}</Money> خارج
        حساب الإنجاز: {out.map((n) => n.label).join(' و')} خطة إنجازها <span className="num">0</span>{' '}
        وباقي المجالات <span className="num">100</span>. ولا توجد إشارة إلى ذلك في الشاشة.
      </p>
    </Glass>
  )
}
