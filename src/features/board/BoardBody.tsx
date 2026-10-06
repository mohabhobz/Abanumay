import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Glass, Head, Icon, Money, icons } from '@/components/ui'
import { SAUDI_REGIONS, SAUDI_VIEW } from '@/components/charts/saudi-regions'
import { usePayments } from '@/data/payments/store'
import { useClosing } from '@/data/closing/store'
import { useAgreements } from '@/data/agreements/store'
import { usePlans } from '@/data/plans/store'
import { nf, pct } from '@/lib/format'
import {
  STAGE_ORDER, boardKingdom, boardMonths, boardRegions, boardRings, boardTotals, boardWaves,
  type RegionDatum, type RingDatum, type WaveSeries,
} from './model'

/* The board's panels, without a page around them · used by the board's own page (`/insights`,
   with the assistant beside it) and at the top of Home for every role (client, 6 Oct).

   Layout (client, 6 Oct, second pass): the headline numbers first as a strip; then one geography panel where the map, the chosen region and the region ranking are a single
   piece: the list on one side picks, the map in the middle shows, the details on the other side
   explain; then the progress rings packed into a compact column beside the request waves. Widths come from the board's own width (container queries), not the window, so the
   same body works beside the assistant and full width on Home. */

const mil = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} م` : n >= 1000 ? `${Math.round(n / 1000)} ألف` : nf.format(n))
const monthFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'short' })
const monthSay = (m: string) => monthFmt.format(new Date(`${m}-15T00:00:00`))
type Totals = ReturnType<typeof boardTotals>

export function BoardBody() {
  usePayments()
  useClosing()
  useAgreements()
  usePlans()
  const totals = boardTotals()
  const rings = boardRings()
  const regions = boardRegions()
  const months = useMemo(() => boardMonths(), [])
  const waves = boardWaves(months)
  /* Nothing picked = the whole Kingdom · picking the picked region again clears it */
  const [sel, setSel] = useState<string | null>(null)
  const pick = (n: string) => setSel((cur) => (cur === n ? null : n))
  const spot = (sel && regions.find((r) => r.name === sel)) || boardKingdom()
  return (
    <div className="col gb gb-main">
      <KpiStrip totals={totals} />
      <GeoPanel regions={regions} sel={sel} onSel={pick} spot={spot} />
      <div className="gb-row">
        <RingsPanel rings={rings} />
        <WavesPanel months={months} waves={waves} />
      </div>
    </div>
  )
}

/* ── Headline numbers · four tiles, a thin gradient bar under each ── */
function KpiStrip({ totals }: { totals: Totals }) {
  const paidShare = totals.granted ? Math.round((totals.paid / totals.granted) * 100) : 0
  return (
    <div className="gb-kpis">
      <Kpi icon="budget" label="إجمالي المنح المعتمدة" value={<Money>{totals.granted}</Money>} fill={100} note={`${nf.format(totals.funded)} مشروعًا مموَّلًا`} />
      <Kpi icon="pay" label="وصل للجهات فعلًا" value={<Money>{totals.paid}</Money>} fill={paidShare} note={`${pct(paidShare)} من الممنوح`} />
      <Kpi icon="navProjects" label="المشاريع" value={<span className="num">{nf.format(totals.projects)}</span>} fill={Math.round((totals.funded / Math.max(1, totals.projects)) * 100)} note={`${nf.format(totals.funded)} منها مموَّل`} />
      <Kpi icon="users" label="المستفيدون" value={<span className="num">{nf.format(totals.beneficiaries)}</span>} fill={Math.round((totals.regions / SAUDI_REGIONS.length) * 100)} note={`${nf.format(totals.entities)} جهة · ${nf.format(totals.regions)} من ${SAUDI_REGIONS.length} مناطق`} />
    </div>
  )
}

function Kpi({ icon, label, value, fill, note }: { icon: keyof typeof icons; label: string; value: ReactNode; fill: number; note: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <Glass className="gb-kpi">
      <span className="gb-kpi-k"><Icon name={icons[icon]} size="sm" />{label}</span>
      <span className="gb-kpi-v">{value}</span>
      <svg className="gb-line" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-g`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" className="gb-st-a" />
            <stop offset="1" className="gb-st-c" />
          </linearGradient>
        </defs>
        <rect className="gb-line-t" width="100%" height="100%" />
        <rect className="gb-line-f" x={`${100 - fill}%`} width={`${fill}%`} height="100%" fill={`url(#${uid}-g)`} />
      </svg>
      <span className="sub">{note}</span>
    </Glass>
  )
}

/* ── Rings · compact: a small donut with its label beside it, the percent on the arc's knob ── */
function RingsPanel({ rings }: { rings: RingDatum[] }) {
  return (
    <Glass className="gb-rings">
      <Head title="مؤشرات التقدّم" />
      <div className="gb-rings-g">
        {rings.map((r) => <Ring key={r.key} r={r} />)}
      </div>
    </Glass>
  )
}

function Ring({ r }: { r: RingDatum }) {
  const uid = useId().replace(/:/g, '')
  /* drawn 1:1 (88 units = 88px) so the knob's text renders at its token size */
  const C = 44
  const R = 32
  const v = Math.max(0, Math.min(100, r.value))
  const a = (v / 100) * Math.PI * 2 - Math.PI / 2
  const kx = C + R * Math.cos(a)
  const ky = C + R * Math.sin(a)
  const money = r.unit === 'ريال'
  return (
    <div className={`gb-ring h${r.hue}`}>
      <div className="gb-ring-f">
        <svg viewBox="0 0 88 88" role="img" aria-label={`${r.label} ${pct(v)}`}>
          <defs>
            <linearGradient id={`${uid}-r`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="gb-st-h0" />
              <stop offset="1" className="gb-st-h1" />
            </linearGradient>
          </defs>
          <circle className="gb-ring-t" cx={C} cy={C} r={R} />
          {v > 0 && (
            <circle
              className="gb-ring-a" cx={C} cy={C} r={R}
              stroke={`url(#${uid}-r)`} pathLength={100}
              strokeDasharray={`${v} 100`} transform={`rotate(-90 ${C} ${C})`}
            />
          )}
          <g className="gb-knob" transform={`translate(${kx} ${ky})`}>
            <circle r="16" />
            <text dy="0.35em">{pct(v)}</text>
          </g>
        </svg>
        <span className="gb-ring-i"><Icon name={icons[r.icon]} size="sm" /></span>
      </div>
      <div className="gb-ring-l">
        <b>{r.label}</b>
        <span className="sub">{money ? `${mil(r.part)} من ${mil(r.whole)} ريال` : `${nf.format(r.part)} من ${nf.format(r.whole)} ${r.unit}`}</span>
      </div>
    </div>
  )
}

/* ── Geography · ranking, map and the chosen region as one panel ── */
function GeoPanel({ regions, sel, onSel, spot }: {
  regions: RegionDatum[]; sel: string | null; onSel: (n: string) => void; spot: RegionDatum
}) {
  const uid = useId().replace(/:/g, '')
  const [hot, setHot] = useState<string | null>(null)
  const by = new Map(regions.map((r) => [r.name, r]))
  const max = Math.max(...regions.map((r) => r.projects), 1)
  const hub = SAUDI_REGIONS.find((r) => r.name === 'الرياض')
  const tip = hot ? SAUDI_REGIONS.find((r) => r.name === hot) : undefined
  const tipD = hot ? by.get(hot) : undefined
  const rows = regions.filter((r) => r.granted > 0).slice(0, 8)
  const top = Math.max(...rows.map((r) => r.granted), 1)
  const stTop = Math.max(...spot.stages.map((s) => s.n), 1)
  const size = (n: number) => (n === 0 ? 's0' : n >= stTop ? 's2' : 's1')
  const all = !sel
  const regionTotal = regions.reduce((s, r) => s + r.granted, 0)
  const share = all ? 100 : regionTotal ? Math.round((spot.granted / regionTotal) * 100) : 0
  const served = regions.filter((r) => r.projects > 0).length

  return (
    <Glass className="gb-geo">
      <Head title="المنح على خريطة المملكة" meta={<span className="sub">حجم النقطة بعدد المشاريع · اختر منطقة من الخريطة أو القائمة</span>} />
      <div className="gb-geo-b">
        {/* the chosen region · start side */}
        <section className="gb-spot" aria-live="polite">
          <div className="gb-spot-h">
            <h4>{spot.name}</h4>
            {/* always in the row, hidden when there's nothing to clear · so picking a region never moves what's below */}
            <button type="button" className={`btn btn-ghost btn-sm gb-spot-x${all ? ' off' : ''}`} tabIndex={all ? -1 : undefined} aria-hidden={all || undefined} onClick={() => sel && onSel(sel)}>عرض المملكة كلها</button>
          </div>
          <div className="gb-spot-m">
            <span className="gb-spot-k">المنح المعتمدة</span>
            <span className="gb-spot-v"><Money>{spot.granted}</Money></span>
            <svg className="gb-line" aria-hidden="true">
              <rect className="gb-line-t" width="100%" height="100%" />
              <rect className="gb-line-f gb-line-sh" x={`${100 - share}%`} width={`${share}%`} height="100%" />
            </svg>
            <span className="sub">
              {all
                ? <>إجمالي <b className="num">{nf.format(served)}</b> منطقة من {SAUDI_REGIONS.length} · اختر منطقة لتفاصيلها</>
                : <><b className="num">{pct(share)}</b> من إجمالي منح المناطق</>}
            </span>
          </div>
          <dl className="gb-stats">
            <div><dt>المشاريع</dt><dd className="num">{nf.format(spot.projects)}</dd></div>
            <div><dt>المستفيدون</dt><dd className="num">{nf.format(spot.beneficiaries)}</dd></div>
            <div><dt>الجهات</dt><dd className="num">{nf.format(spot.entities)}</dd></div>
          </dl>
          <div className="gb-spot-t">
            <h5 className="gb-sub">{all ? 'مراحل المشاريع' : 'مراحل مشاريعها'}</h5>
            <ol className="gb-tl" aria-label="مراحل مشاريع المنطقة">
              {STAGE_ORDER.map((k) => {
                const n = spot.stages.find((s) => s.key === k)?.n ?? 0
                return (
                  <li key={k} className={size(n)}>
                    <span className="gb-tl-v num">{nf.format(n)}</span>
                    <i className="gb-tl-d" aria-hidden="true" />
                    <span className="gb-tl-k">{k}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* the map · middle */}
        <svg className="gb-map-s" viewBox={`0 0 ${SAUDI_VIEW.w} ${SAUDI_VIEW.h}`} role="img" aria-label="توزيع المشاريع على مناطق المملكة">
          <defs>
            <linearGradient id={`${uid}-land`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="gb-st-a" />
              <stop offset="1" className="gb-st-b" />
            </linearGradient>
            <radialGradient id={`${uid}-dot`}>
              <stop offset="0" className="gb-st-glow" />
              <stop offset="1" className="gb-st-none" />
            </radialGradient>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {SAUDI_REGIONS.map((r) => {
            const n = by.get(r.name)?.projects ?? 0
            return (
              <path
                key={r.key}
                d={r.d}
                className={`gb-reg${r.name === sel ? ' on' : ''}${r.name === hot ? ' hot' : ''}`}
                fill={`url(#${uid}-land)`}
                fillOpacity={n ? 0.28 + 0.62 * (n / max) : 0.1}
                onMouseEnter={() => setHot(r.name)}
                onMouseLeave={() => setHot(null)}
                onClick={() => onSel(r.name)}
              >
                <title>{`${r.name} · ${nf.format(n)} مشروعًا`}</title>
              </path>
            )
          })}

          {hub && SAUDI_REGIONS.filter((r) => r.name !== hub.name && (by.get(r.name)?.projects ?? 0) > 0).map((r) => {
            const [x1, y1] = hub.c
            const [x2, y2] = r.c
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.32
            return <path key={`a-${r.key}`} className="gb-arc" d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} pathLength={1} filter={`url(#${uid}-glow)`} />
          })}

          {SAUDI_REGIONS.map((r) => {
            const n = by.get(r.name)?.projects ?? 0
            if (!n) return null
            const rad = 7 + 16 * Math.sqrt(n / max)
            return (
              <g key={`d-${r.key}`} className={`gb-pt${r.name === sel ? ' on' : ''}`} transform={`translate(${r.c[0]} ${r.c[1]})`} onClick={() => onSel(r.name)}>
                <circle r={rad * 2.4} fill={`url(#${uid}-dot)`} />
                <circle className="gb-pt-c" r={rad} filter={`url(#${uid}-glow)`} />
                <circle className="gb-pt-k" r={rad * 0.42} />
              </g>
            )
          })}

          {tip && tipD && (
            <g className="gb-tip" transform={`translate(${tip.c[0]} ${tip.c[1] - 44})`} aria-hidden="true">
              <rect x={-150} y={-62} width={300} height={74} rx={14} />
              <text y={-30}>{tip.name}</text>
              <text className="gb-tip-v" y={0}>{`${nf.format(tipD.projects)} مشروعًا · ${mil(tipD.granted)} ريال`}</text>
            </g>
          )}
        </svg>

        {/* the ranking · end side, each row picks the region */}
        <section className="gb-bars">
          <h4 className="gb-sub">المنح حسب المنطقة</h4>
          <svg className="gb-defs" aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-b`} x1="1" y1="0" x2="0" y2="0">
                <stop offset="0" className="gb-st-a" />
                <stop offset="1" className="gb-st-b" />
              </linearGradient>
            </defs>
          </svg>
          <ul className="gb-bars-l">
            {rows.map((r) => {
              const w = Math.max(2, (r.granted / top) * 100)
              return (
                <li key={r.name}>
                  <button type="button" className={`gb-bar${r.name === sel ? ' on' : ''}`} aria-pressed={r.name === sel} onClick={() => onSel(r.name)}>
                    <span className="gb-bar-n">{r.name}</span>
                    <span className="gb-bar-v num">{mil(r.granted)}</span>
                    <svg className="gb-bar-s" aria-hidden="true">
                      <rect className="gb-bar-t" width="100%" height="100%" />
                      <rect className="gb-bar-f" x={`${100 - w}%`} width={`${w}%`} height="100%" fill={`url(#${uid}-b)`} />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Glass>
  )
}

/* ── Waves · three counts on one axis, overlapping gradient areas, time right to left ── */
function WavesPanel({ months, waves }: { months: string[]; waves: WaveSeries[] }) {
  const uid = useId().replace(/:/g, '')
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(900)
  const [at, setAt] = useState(months.length - 1)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 200
  const padT = 16
  const padB = 30
  const n = months.length
  const max = Math.max(...waves.flatMap((s) => s.values), 1)
  const top = Math.ceil(max / 2) * 2
  /* Oldest on the right, this month on the left */
  const x = (i: number) => W - (i / (n - 1)) * W
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB)
  const line = (vals: number[]) => {
    const p = vals.map((v, i) => [x(i), y(v)] as const)
    let d = `M${p[0][0]} ${p[0][1]}`
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i]
      const p1 = p[i]
      const p2 = p[i + 1]
      const p3 = p[i + 2] ?? p2
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`
    }
    return d
  }
  const order = [...waves].sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0))
  const pick = (cx: number) => {
    const i = Math.round(((W - cx) / W) * (n - 1))
    setAt(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <Glass className="gb-waves">
      <Head title="حركة الطلبات" meta={<span className="sub">آخر {n} شهرًا · <b>{monthSay(months[at])} {months[at].slice(0, 4)}</b></span>} />
      <dl className="gb-leg">
        {waves.map((s) => (
          <div key={s.key} className={`h${s.hue}`}>
            <dt><i className="gb-sw" aria-hidden="true" />{s.label}</dt>
            <dd className="num">{nf.format(s.values[at])}</dd>
          </div>
        ))}
      </dl>
      <div className="gb-waves-b" ref={box}>
        <svg
          className="gb-waves-s" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="الطلبات الواردة والقرارات وطلبات الصرف شهريًّا"
          onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); pick(((e.clientX - b.left) / b.width) * W) }}
          onMouseLeave={() => setAt(n - 1)}
        >
          <defs>
            {waves.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1" className={`h${s.hue}`}>
                <stop offset="0" className="gb-st-w0" />
                <stop offset="1" className="gb-st-w1" />
              </linearGradient>
            ))}
          </defs>
          {[0, top / 2, top].map((t) => (
            <g key={t} className="gb-grid">
              <line x1={0} x2={W} y1={y(t)} y2={y(t)} />
              <text x={W} y={y(t) - 4}>{nf.format(t)}</text>
            </g>
          ))}
          {order.map((s) => (
            <g key={s.key} className={`gb-wave h${s.hue}`}>
              <path className="gb-wave-a" d={`${line(s.values)} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${uid}-${s.key})`} />
              <path className="gb-wave-l" d={line(s.values)} />
            </g>
          ))}
          <line className="gb-cross" x1={x(at)} x2={x(at)} y1={padT} y2={y(0)} />
          {waves.map((s) => <circle key={s.key} className={`gb-mk h${s.hue}`} cx={x(at)} cy={y(s.values[at])} r={5} />)}
          {months.map((m, i) => (i % 3 === (n - 1) % 3 ? <text key={m} className="gb-mo" x={x(i)} y={H - 8}>{monthSay(m)}</text> : null))}
        </svg>
      </div>
    </Glass>
  )
}
