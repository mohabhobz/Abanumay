import { useId } from 'react'

/**
 * Sparkline · a smooth line beside a number that shows where the figure has been heading and where
 * it stands today.
 *
 * Time runs right to left, like every chart in the system (RTL: the start sits on the right), so
 * today is the left end and carries the dot: the line "arrives" at it. Colour is the SLA along the
 * way, blended between days (within limit, near it at 80%, past it), and the soft wash under the
 * line takes today's state, so the card says at a glance where the journey ended up. The number
 * beside it stays neutral ink; colour lives on the shape only.
 *
 * Drawn on a 100 × 40 box stretched to its slot; strokes keep their width with `vector-effect`.
 * The dot is a zero-length round-capped line, which stays a circle however the box stretches.
 */
export type SparkSla = 'ok' | 'near' | 'late'

export interface SparkPoint {
  value: number
  sla: SparkSla
}

const W = 100
const H = 40
const TOP = 6
const BOTTOM = 4

const INK: Record<SparkSla, string> = {
  ok: 'var(--ch-3)',
  near: 'var(--ch-warn)',
  late: 'var(--ch-late)',
}

/* Monotone cubic through the points (Fritsch–Carlson): smooth, but it never bends past a point,
   so a flat run stays flat and a step doesn't grow a wiggle that reads as data. */
function smooth(xy: { x: number; y: number }[]): string {
  const n = xy.length
  const dx = xy.slice(1).map((p, i) => p.x - xy[i].x)
  const m = xy.slice(1).map((p, i) => (p.y - xy[i].y) / dx[i])
  const t = xy.map((_, i) => {
    if (i === 0) return m[0]
    if (i === n - 1) return m[n - 2]
    return m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) /
      ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])
  })
  let d = `M${xy[0].x},${xy[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${xy[i].x + h},${xy[i].y + t[i] * h} ${xy[i + 1].x - h},${xy[i + 1].y - t[i + 1] * h} ${xy[i + 1].x},${xy[i + 1].y}`
  }
  return d
}

export function Spark({ points, label }: { points: SparkPoint[]; label: string }) {
  const id = useId().replace(/:/g, '')
  if (points.length < 2) return null

  const max = Math.max(...points.map((p) => p.value), 1)
  const min = Math.min(...points.map((p) => p.value))
  const span = Math.max(max - min, 1)
  /* Oldest on the right (x = 100), today on the left (x = 0) */
  const xy = points.map((p, i) => ({
    x: W - (i / (points.length - 1)) * W,
    y: H - BOTTOM - ((p.value - min) / span) * (H - TOP - BOTTOM),
  }))
  const line = smooth(xy)
  const last = xy[xy.length - 1]
  const now = points[points.length - 1].sla
  const area = `${line} L${last.x},${H} L${xy[0].x},${H} Z`

  return (
    <span className={`spk s-${now}`} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {/* Stroke colour per day along the x axis · user space, so each stop sits on its day */}
          <linearGradient id={`${id}-l`} gradientUnits="userSpaceOnUse" x1={W} y1="0" x2="0" y2="0">
            {points.map((p, i) => (
              <stop key={i} offset={i / (points.length - 1)} stopColor={INK[p.sla]} />
            ))}
          </linearGradient>
          {/* The wash fades from today's colour at the line to nothing at the base */}
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={INK[now]} stopOpacity=".26" />
            <stop offset="1" stopColor={INK[now]} stopOpacity="0" />
          </linearGradient>
          {/* …and from the dot's side to the far end, so the eye lands where the line arrives */}
          <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset="1" stopColor="white" stopOpacity=".15" />
          </linearGradient>
          <mask id={`${id}-k`}>
            <rect x="0" y="0" width={W} height={H} fill={`url(#${id}-m)`} />
          </mask>
        </defs>
        <path d={area} fill={`url(#${id}-a)`} mask={`url(#${id}-k)`} />
        <path
          className="spk-l"
          d={line}
          stroke={`url(#${id}-l)`}
          vectorEffect="non-scaling-stroke"
        />
        <line className="spk-halo" x1={last.x} y1={last.y} x2={last.x} y2={last.y} vectorEffect="non-scaling-stroke" />
        <line className="spk-dot" x1={last.x} y1={last.y} x2={last.x} y2={last.y} vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  )
}
