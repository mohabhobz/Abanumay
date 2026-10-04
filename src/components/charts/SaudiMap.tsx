import { nf, unitAfter } from '@/lib/format'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SAUDI_REGIONS, SAUDI_VIEW } from './saudi-regions'

/* Map of the Kingdom — color density on real administrative boundaries.

   A list of bars used to say "Riyadh 6, Qassim 4" — number after number, and the eye had to
   reconstruct the geography in its head. The map says it at a glance: support is clustered in the
   center, the north is nearly empty — a conclusion no table gives you no matter how you sort it.

   Density reads truer than dots here: a dot says "something is at this spot," a fill says "this
   region's share is X" — and the region is the unit of decision in the system, not the point.

   The scale is **five discrete steps, not a continuous gradient**: the eye can't tell two adjacent
   steps apart in a continuous gradient, but it can tell five distinct steps apart. */

/**
 * Fill steps — from "none" to "highest". Values live in the CSS so dark mode can flip them from one
 * place.
 */
const STEPS = [
  'var(--map-0)',
  'var(--map-1)',
  'var(--map-2)',
  'var(--map-3)',
  'var(--map-4)',
] as const

export interface MapPoint {
  key: string
  label: string
  value: number
  note?: string
  href?: string
  /** Money behind the region · written beside it on the map when `amounts` is on */
  amount?: number
}

/** A row of the list under the map · regions by default, or cities when passed */
export interface MapRow { key: string; label: string; value: number; amount?: number; href?: string }

/** Compact millions for a label on the map · "2.4م" */
const mil = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} م` : `${Math.round(n / 1000)} ألف`)

export function SaudiMap({ points, unit = 'مشروعًا', amounts = false, list }: {
  points: MapPoint[]
  unit?: string
  /** Meeting 1 Oct, E-5 · the amount beside each region, not only on hover */
  amounts?: boolean
  /** Rows under the map · when longer than five it becomes a swipe row instead of wrapping */
  list?: MapRow[]
}) {
  const [hot, setHot] = useState<string | null>(null)

  /** Value per region by name — the map speaks in the system's own region names. */
  const byName = useMemo(() => {
    const m = new Map<string, MapPoint>()
    for (const p of points) m.set(p.key, p)
    return m
  }, [points])

  const max = Math.max(...points.map((p) => p.value), 1)
  const step = (v: number) => (v <= 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)))

  const onMap = (k: string) => SAUDI_REGIONS.some((r) => r.name === k)
  /** Regions with no position on the map — e.g. "nationwide". */
  const offMap = points.filter((p) => !onMap(p.key))
  const active = hot ? SAUDI_REGIONS.find((r) => r.name === hot) : undefined
  const activeVal = hot ? byName.get(hot) : undefined
  const ranked = [...points].filter((p) => onMap(p.key)).sort((a, b) => b.value - a.value)
  const topAmt = new Set(
    [...points].filter((p) => onMap(p.key) && (p.amount ?? 0) > 0)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 4).map((p) => p.key),
  )

  return (
    <div className="map">
      {/* The box takes the available height, and the drawing inside keeps its proportions fixed —
          the tooltip is positioned as a percentage of the viewBox, so any mismatch in that ratio
          would throw it off its spot. */}
      <div className="map-slot">
      <div className="map-c">
        <svg
          viewBox={`0 0 ${SAUDI_VIEW.w} ${SAUDI_VIEW.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="map-svg"
          role="img"
          aria-label="توزيع المشاريع على مناطق المملكة"
        >
          {SAUDI_REGIONS.map((r) => {
            const point = byName.get(r.name)
            const v = point?.value ?? 0
            const on = hot === r.name
            const shape = (
              <path
                d={r.d}
                fill={STEPS[step(v)]}
                className={`map-r${on ? ' on' : ''}${v > 0 ? ' has' : ''}`}
              />
            )
            return (
              <g
                key={r.key}
                className="map-rg"
                onPointerEnter={() => setHot(r.name)}
                onPointerLeave={() => setHot(null)}
              >
                {point?.href && v > 0 ? (
                  <Link to={point.href} aria-label={`${r.name}: ${v}`}>{shape}</Link>
                ) : (
                  shape
                )}
              </g>
            )
          })}

          {/* Amounts beside the regions (E-5) · only where there is money, so the map stays
              quiet where nothing is. The hovered count then moves to the tooltip alone. */}
          {amounts && SAUDI_REGIONS.map((r) => {
            const a = byName.get(r.name)?.amount ?? 0
            /* The four largest only: small neighbouring regions (Madinah, Qassim, Hail) can't
               hold a label each without overlapping · the rest read on hover and in the list */
            if (a <= 0 || !topAmt.has(r.name)) return null
            return (
              <text key={`amt-${r.key}`} className={`map-amt${hot === r.name ? ' on' : ''}`} x={r.c[0]} y={r.c[1]}
                textAnchor="middle" dominantBaseline="central">
                {mil(a)}
              </text>
            )
          })}

          {/* The number shows only on the hovered region — that many numbers on the map at once
              would clutter it. */}
          {!amounts && active && activeVal && (
            <text
              className="map-num"
              x={active.c[0]}
              y={active.c[1]}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {activeVal.value}
            </text>
          )}
        </svg>

        {/* The tooltip is an HTML element — Arabic text wraps better outside the SVG. */}
        {active && activeVal && (
          <div
            className="map-tip"
            style={{
              left: `${(active.c[0] / SAUDI_VIEW.w) * 100}%`,
              top: `${(active.c[1] / SAUDI_VIEW.h) * 100}%`,
            }}
          >
            <b>{activeVal.label}</b>
            <span>
              <span className="num">{activeVal.value}</span> {unitAfter(activeVal.value, unit)}
            </span>
            {activeVal.amount ? <span><span className="num">{nf.format(activeVal.amount)}</span> ريال</span> : null}
            {activeVal.note && <span className="map-tip-n">{activeVal.note}</span>}
          </div>
        )}
      </div>
      </div>

      <div className="map-foot">
        {/* The scale — without it, the density is just decoration. */}
        <div className="map-scale" aria-hidden="true">
          <span className="num">0</span>
          {STEPS.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
          <span className="num">{max}</span>
        </div>

        {list ? (
          /* E-5 · a long list swipes sideways instead of wrapping into a block under the map */
          <div className={`map-rank${list.length > 5 ? ' map-swipe' : ''}`}>
            {list.map((p) => {
              const body = (
                <>
                  <span className="map-rank-l">{p.label}</span>
                  <b className="num">{p.value}</b>
                  {p.amount ? <span className="sub num">{mil(p.amount)}</span> : null}
                </>
              )
              return p.href
                ? <Link key={p.key} to={p.href} className="map-chip">{body}</Link>
                : <span key={p.key} className="map-chip">{body}</span>
            })}
          </div>
        ) : (
        <div className="map-rank">
          {ranked.slice(0, 5).map((p) =>
            p.href ? (
              <Link
                key={p.key}
                to={p.href}
                className={`map-chip${hot === p.key ? ' on' : ''}`}
                onPointerEnter={() => setHot(p.key)}
                onPointerLeave={() => setHot(null)}
              >
                <span className="map-rank-l">{p.label}</span>
                <b className="num">{p.value}</b>
              </Link>
            ) : (
              <span key={p.key} className="map-chip">
                <span className="map-rank-l">{p.label}</span>
                <b className="num">{p.value}</b>
              </span>
            ),
          )}
          {offMap.map((p) => (
            <span key={p.key} className="map-chip off" title="بلا منطقة محدّدة">
              <span className="map-rank-l">{p.label}</span>
              <b className="num">{p.value}</b>
            </span>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
