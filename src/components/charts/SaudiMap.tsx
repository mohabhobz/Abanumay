import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SAUDI_REGIONS, SAUDI_VIEW } from './saudi-regions'

/* ═══════════════════════════════════════════════════════════
   خريطة المملكة — كثافة لونية على الحدود الإدارية الحقيقية

   قائمة الأشرطة كانت بتقول «الرياض 6، القصيم 4» — رقم ورا رقم،
   والعين لازم تركّب الجغرافيا في دماغها. الخريطة بتقولها في نظرة:
   الدعم متكوّم في الوسط، والشمال شبه فاضي. ده استنتاج ما بيطلعش
   من جدول مهما رتّبته.

   والكثافة أصدق من النقاط هنا: النقطة بتقول «فيه حاجة في المكان
   ده»، والتعبئة بتقول «المنطقة دي نصيبها كذا» — والمنطقة هي وحدة
   القرار في النظام لا النقطة.

   والسُّلَّم **خمس درجات مقطوعة مش تدرّج مستمر**: العين ما بتفرّقش
   بين درجتين متجاورتين في تدرّج مستمر، لكنها بتفرّق بين خمس درجات
   واضحة.
   ═══════════════════════════════════════════════════════════ */

/** درجات التعبئة — من «لا شيء» إلى «الأعلى» */
const STEPS = [
  'rgba(20,69,71,.055)',
  'rgba(0,165,155,.20)',
  'rgba(0,165,155,.38)',
  'rgba(0,165,155,.62)',
  '#0B857E',
] as const

export interface MapPoint {
  key: string
  label: string
  value: number
  note?: string
  href?: string
}

export function SaudiMap({ points, unit = 'مشروعًا' }: { points: MapPoint[]; unit?: string }) {
  const [hot, setHot] = useState<string | null>(null)

  /** القيمة لكل منطقة بالاسم — الخريطة بتتكلم بأسماء النظام */
  const byName = useMemo(() => {
    const m = new Map<string, MapPoint>()
    for (const p of points) m.set(p.key, p)
    return m
  }, [points])

  const max = Math.max(...points.map((p) => p.value), 1)
  const step = (v: number) => (v <= 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)))

  const onMap = (k: string) => SAUDI_REGIONS.some((r) => r.name === k)
  /** مناطق مالهاش موقع على الخريطة — «عموم المملكة» مثلًا */
  const offMap = points.filter((p) => !onMap(p.key))
  const active = hot ? SAUDI_REGIONS.find((r) => r.name === hot) : undefined
  const activeVal = hot ? byName.get(hot) : undefined
  const ranked = [...points].filter((p) => onMap(p.key)).sort((a, b) => b.value - a.value)

  return (
    <div className="map">
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

          {/* الرقم على المنطقة المؤشَّر عليها فقط — ثلاتاشر رقم على
              الخريطة في نفس الوقت بيخنقوها */}
          {active && activeVal && (
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

        {/* التلميح كعنصر HTML — النص العربي بيتلف أحسن بره الـSVG */}
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
              <span className="num">{activeVal.value}</span> {unit}
            </span>
            {activeVal.note && <span className="map-tip-n">{activeVal.note}</span>}
          </div>
        )}
      </div>

      <div className="map-foot">
        {/* السُّلَّم: من غيره الكثافة تبقى زخرفة */}
        <div className="map-scale" aria-hidden="true">
          <span className="num">0</span>
          {STEPS.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
          <span className="num">{max}</span>
        </div>

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
      </div>
    </div>
  )
}
