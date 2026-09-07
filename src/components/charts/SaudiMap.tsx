import { useState } from 'react'
import { Link } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════
   خريطة المملكة

   قائمة الأشرطة كانت بتقول «الرياض 6، القصيم 4» — رقم ورا رقم،
   والعين لازم تركّب الجغرافيا في دماغها. الخريطة بتقولها في نظرة:
   الدعم متكوّم في الوسط والشرق، والشمال شبه فاضي. ده استنتاج
   ما بيطلعش من جدول مهما رتّبته.

   الحدود مبسّطة عن قصد — دي رسم توضيحي لمواقع المناطق، مش
   خريطة مساحية. والنقطة حجمها من جذر العدد لا العدد نفسه، لأن
   العين بتقارن **مساحات** الدوائر لا أقطارها.
   ═══════════════════════════════════════════════════════════ */

/**
 * الحدود المبسّطة — محسوبة من نقاط حدودية تقريبية بإسقاط مستوٍ
 * مصحَّح بجيب تمام العرض (24.5°)، عشان النِّسب ما تتفلطحش.
 * دي رسم توضيحي لمواقع المناطق، مش خريطة مساحية.
 */
const OUTLINE =
  'M26,156 L72,163 L115,125 L143,101 L159,77 L192,46 L209,21 L263,34 L329,72' +
  'L451,163 L531,168 L571,172 L613,194 L629,235 L664,266 L684,287 L686,311' +
  'L695,335 L714,369 L738,383 L769,405 L904,479 L928,509 L908,604 L769,651' +
  'L638,671 L551,743 L464,728 L385,731 L367,778 L359,733 L315,661 L272,608' +
  'L237,565 L207,503 L183,446 L150,393 L111,350 L89,307 L54,244 L32,206 Z'

/** مواقع المناطق — مراكز تقريبية بنفس الإسقاط */
const SPOTS: Record<string, [number, number]> = {
  'الرياض': [539, 381],
  'مكة المكرمة': [272, 537],
  'المدينة المنورة': [228, 383],
  'القصيم': [400, 302],
  'المنطقة الشرقية': [651, 345],
  'عسير': [368, 656],
  'تبوك': [111, 206],
  'حائل': [320, 244],
  'الحدود الشمالية': [346, 105],
  'جيزان': [372, 743],
  'نجران': [446, 709],
  'الباحة': [311, 604],
  'الجوف': [228, 134],
}

const W = 960
const H = 800

export interface MapPoint {
  key: string
  label: string
  value: number
  /** نص إضافي في التلميح — مبلغ مثلًا */
  note?: string
  href?: string
}

export function SaudiMap({
  points,
  unit = 'مشروعًا',
}: {
  points: MapPoint[]
  unit?: string
}) {
  const [hot, setHot] = useState<string | null>(null)

  const placed = points.filter((p) => SPOTS[p.key])
  const elsewhere = points.filter((p) => !SPOTS[p.key])
  const max = Math.max(...placed.map((p) => p.value), 1)
  /* الحجم من الجذر: العين بتقارن مساحة الدائرة، فلو القطر خطي
     تبقى الفروق مضخّمة أضعافًا. */
  const radius = (v: number) => 16 + 30 * Math.sqrt(v / max)

  const active = placed.find((p) => p.key === hot)

  return (
    <div className="map">
      <div className="map-c">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="map-svg" role="img" aria-label="توزيع المشاريع على مناطق المملكة">
          <defs>
            <linearGradient id="mapfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,165,155,.10)" />
              <stop offset="100%" stopColor="rgba(20,69,71,.06)" />
            </linearGradient>
            <filter id="mapglow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="10" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d={OUTLINE}
            fill="url(#mapfill)"
            stroke="rgba(20,69,71,.30)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {placed.map((p) => {
            const [x, y] = SPOTS[p.key]
            const r = radius(p.value)
            const on = hot === p.key
            return (
              <g
                key={p.key}
                className={`map-g${on ? ' on' : ''}`}
                onPointerEnter={() => setHot(p.key)}
                onPointerLeave={() => setHot(null)}
              >
                {/* هالة واسعة عشان الهدف يبقى سهل التصويب عليه */}
                <circle cx={x} cy={y} r={Math.max(r + 18, 34)} fill="transparent" />
                <circle className="map-halo" cx={x} cy={y} r={r + 10} />
                <circle className="map-dot" cx={x} cy={y} r={r} filter={on ? 'url(#mapglow)' : undefined} />
                <text className="map-num" x={x} y={y} textAnchor="middle" dominantBaseline="central">
                  {p.value}
                </text>
              </g>
            )
          })}
        </svg>

        {/* التلميح فوق الخريطة كعنصر HTML — النص العربي بيتلف أحسن
            بره الـSVG، والتموضع بالنسبة المئوية بيتبع تحجيم الرسم */}
        {active && (
          <div
            className="map-tip"
            style={{
              left: `${(SPOTS[active.key][0] / W) * 100}%`,
              top: `${(SPOTS[active.key][1] / H) * 100}%`,
            }}
          >
            <b>{active.label}</b>
            <span>
              <span className="num">{active.value}</span> {unit}
            </span>
            {active.note && <span className="map-tip-n">{active.note}</span>}
          </div>
        )}
      </div>

      {/* الترتيب تحت الخريطة كشرائح: الخريطة بتقول الشكل، والشرائح
          بتقول الترتيب — والخريطة بتاخد عرض الكارت كله */}
      <div className="map-rank">
        {[...placed].sort((a, b) => b.value - a.value).slice(0, 6).map((p) => {
          const inner = (
            <>
              <span className="map-rank-l">{p.label}</span>
              <b className="num">{p.value}</b>
            </>
          )
          return p.href ? (
            <Link
              key={p.key}
              to={p.href}
              className={`map-chip${hot === p.key ? ' on' : ''}`}
              onPointerEnter={() => setHot(p.key)}
              onPointerLeave={() => setHot(null)}
            >
              {inner}
            </Link>
          ) : (
            <span key={p.key} className="map-chip">{inner}</span>
          )
        })}
        {elsewhere.map((p) => (
          <span key={p.key} className="map-chip off">
            <span className="map-rank-l">{p.label}</span>
            <b className="num">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
