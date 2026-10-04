import type { ReactNode } from 'react'
import { isolate, nf, pct } from '@/lib/format'

/* Chart set.

   All hand-written SVG — no charting library in the project, because charting libraries bring their
   own colors, fonts, and edges, which clashes with the design system instead of serving it. These
   shapes are simple and the math is small, so a library wouldn't be worth its cost.

   Color rule: **color describes state, not quantity.** Numbers are written in the normal text
   color; color belongs to the bar or dot. */

export { SaudiMap, type MapPoint, type MapRow } from './SaudiMap'
export { Spark, type SparkPoint, type SparkSla } from './Spark'
export { StageFlow, Lollipop, Waffle, Pareto, Meters, RankBars, MoneyRing, type Hue, type StageDatum, type LolliDatum, type Part, type MeterDatum, type RingPart } from './forms'

export const CHART_COLORS = [
  'var(--ch-1)', 'var(--ch-2)', 'var(--ch-3)',
  'var(--ch-4)', 'var(--ch-5)', 'var(--ch-6)',
] as const

/** Text ink over each color — measured at 4.5:1; see `:root` in the CSS. */
export const CHART_INKS = [
  'var(--on-ch-1)', 'var(--on-ch-2)', 'var(--on-ch-3)',
  'var(--on-ch-4)', 'var(--on-ch-5)', 'var(--on-ch-6)',
] as const

/* -- Horizontal bar list, removed --
   `BarList` was used only on "Today," and six cards drawn with it made the page one long table.
   Replaced with per-question shapes, so it has no consumers left; its two inline styles were
   removed with it. */

/* -- Vertical bars --
   For a continuous range (duration) — axis order carries meaning here, unlike nominal categories. */
export interface Column {
  key: string
  label: string
  value: number
  color?: string
}

export function Columns({ cols, unit }: { cols: Column[]; unit?: string }) {
  const max = Math.max(...cols.map((c) => c.value), 1)

  return (
    <div className="chcols">
      {cols.map((c) => (
        <div className="chcol" key={c.key}>
          {/* The number sits inside the bar, right on top of it — it used to be on its own line
              above all the bars, far from the shape it describes. */}
          <span className="chcol-t">
            <i
              style={{
                height: `${Math.max(3, (c.value / max) * 100)}%`,
                background: c.color ?? 'var(--ch-2)',
              }}
            >
              <span className="chcol-v num">{c.value}</span>
            </i>
          </span>
          <span className="chcol-l">{c.label}</span>
        </div>
      ))}
      {unit && <span className="chcol-u">{unit}</span>}
    </div>
  )
}

/* -- The slice --
   A type shared between the ring, the stacked bar, and the legend. */
export interface Slice {
  key: string
  label: string
  value: number
  color: string
  /** Text ink over this color — if a number is written on top of the color. */
  ink?: string
}

/* -- Ring --
   Restored in place of the stacked column, per the client's decision. It later became thinner and
   the percentage moved off the arc to sit next to its name in the legend: the reader reads "in-kind
   grants 51%" as one line, and the ring gives the shares their shape. ⚠️ This reverses an earlier
   "number on the arc" decision, which needs the client's sign-off. */
export function Donut({
  slices,
  total,
  centerValue,
  centerLabel,
  size,
}: {
  slices: Slice[]
  total?: number
  centerValue: ReactNode
  centerLabel: string
  size?: number
}) {
  const sum = total ?? slices.reduce((s, x) => s + x.value, 0)
  /* Radius 52 and stroke 12, so the outer edge sits at 58 inside a 128 viewBox. */
  const r = 52
  const w = 12
  const c = 2 * Math.PI * r
  const gap = slices.length > 1 ? 1.6 : 0
  let offset = 0

  return (
    <div className="chdonut">
      <svg
        viewBox="0 0 128 128"
        {...(size ? { width: size, height: size } : {})}
        role="img"
        aria-hidden="true"
      >
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--track)" strokeWidth={w} />
        {slices.map((s) => {
          const frac = sum > 0 ? s.value / sum : 0
          const len = Math.max(0, frac * c - gap)
          const dash = `${len} ${c - len}`
          const rot = (offset / c) * 360 - 90
          offset += frac * c
          return (
            <circle
              key={s.key}
              cx="64"
              cy="64"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={w}
              strokeDasharray={dash}
              strokeLinecap="butt"
              transform={`rotate(${rot} 64 64)`}
            />
          )
        })}

      </svg>

      <div className="chdonut-c">
        {/* A value can come with its own unit (e.g. "10.7M") — `.num` used to apply to both, so the
            Arabic unit got wrapped inside an LTR island. Isolation now applies to the digits alone. */}
        <b>{typeof centerValue === 'string' ? isolate(centerValue) : centerValue}</b>
        <span>{centerLabel}</span>
      </div>
    </div>
  )
}

/* -- Stacked bar --
   For breaking down a single amount: layers on one ruler read clearer than several rings. */
export function StackBar({ parts, total }: { parts: Slice[]; total: number }) {
  return (
    <div className="chstack">
      <div className="chstack-t">
        {parts.map((p) => (
          <i
            key={p.key}
            style={{ width: `${total > 0 ? (p.value / total) * 100 : 0}%`, background: p.color }}
            title={`${p.label}: ${nf.format(p.value)}`}
          />
        ))}
      </div>
    </div>
  )
}

/** Legend — dot, color, name, and value. */
export function Legend({
  items,
  format = (v: number) => nf.format(v),
  /** Horizontal row with no values — for when the value is written on the chart itself. */
  inline,
  /** Sum of the shares — when passed, the horizontal row writes the percentage next to the name. */
  pctOf,
}: {
  items: Slice[]
  format?: (v: number) => string
  inline?: boolean
  pctOf?: number
}) {
  return (
    <dl className={`chleg${inline ? ' chleg-in' : ''}`}>
      {items.map((i) => (
        <div key={i.key}>
          <dt><span className="chdot" style={{ background: i.color }} />{i.label}</dt>
          {!inline && <dd className="num">{format(i.value)}</dd>}
          {inline && pctOf ? <dd className="num">{pct(Math.round((i.value / pctOf) * 100))}</dd> : null}
        </div>
      ))}
    </dl>
  )
}
