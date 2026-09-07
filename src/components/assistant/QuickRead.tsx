import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { icons } from '@/components/ui/icons'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import { nf } from '@/lib/format'
import { highlight } from './highlight'
import type { Reading } from './reading'

/** المساعد بيفكّر لحظة قبل ما يبدأ يكتب — عشان القراءة تبان مُنتَجة مش محفوظة */
const THINK_MS = 900

export interface QuickReadProps {
  readings: Reading[]
  /**
   * `panel` = كارت كامل في عمود السياق (اليوم وصفحة الجهة).
   * `bar`   = سطر واحد فوق النتائج بينفتح (شاشات القوائم).
   */
  variant?: 'panel' | 'bar'
  title?: string
  /** يفتح لوح المساعد الكامل */
  onAsk?: () => void
}

/**
 * القراءة السريعة — صوت المساعد في أي شاشة.
 *
 * السطح هنا **داكن عن قصد**، وهو السطح الداكن الوحيد في السيستم.
 * كل حاجة تانية زجاج فاتح على خلفية فاتحة، فأول ما القراءة تظهر
 * العين بتروح لها من غير ما تدوّر. والسبب مش زخرفة: ده مش عرض
 * لبيانات المستخدم، ده **رأي مُنتَج** — لازم يبان إنه صوت تاني في
 * الغرفة، وإنه مسؤولية مختلفة (استرشادي، غير مُلزِم).
 *
 * وكل قراءة بتبدأ برقمها كبيرًا: القراءة اللي رقمها جوّه فقرة
 * بتتقري، واللي رقمها قدامها بتتشاف.
 */
export function QuickRead({
  readings,
  variant = 'panel',
  title = 'قراءة سريعة',
  onAsk,
}: QuickReadProps) {
  const box = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(box)
  const [thought, setThought] = useState(false)
  const [open, setOpen] = useState(variant === 'panel')

  useEffect(() => {
    if (!onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [onScreen, thought])

  const shown = open ? readings : readings.slice(0, 1)
  const { block, chars, done } = useTypedBlocks(shown.map((r) => r.text), thought)
  const flags = readings.filter((r) => r.kind === 'flag').length

  if (readings.length === 0) return null

  const head = (
    <>
      <span className={`qr-mark${done ? '' : ' live'}`}>
        <Icon path={icons.insight} size={17} />
      </span>
      <span className="qr-title">{title}</span>
      {flags > 0 && (
        <span className="qr-count no">
          <span className="num">{flags}</span> تحتاج انتباه
        </span>
      )}
      <span className="qr-count">
        <span className="num">{readings.length}</span> قراءات
      </span>
    </>
  )

  /* ── العرض المختصر: سطر واحد فوق النتائج ── */
  if (variant === 'bar') {
    return (
      <div className={`qread strip${open ? ' open' : ''}`} ref={box}>
        <button className="qr-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {head}
          <span className="qr-sp" />
          <Icon path={open ? icons.chevronUp : icons.chevronDown} size={16} />
        </button>

        {!open && readings[0] && (
          <div className="qr-peek">
            {readings[0].metric && (
              <b className={readings[0].kind === 'flag' ? 'bad' : undefined}>
                {readings[0].metric.value}
              </b>
            )}
            <span className="trim1">
              {readings[0].metric ? `${readings[0].metric.unit} — ` : ''}
              {readings[0].text}
            </span>
          </div>
        )}

        {open && (
          <div className="qr-list">
            {shown.map((r, i) => (
              <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ── العرض الكامل: كارت في عمود السياق ── */
  return (
    <div className="qread panel" ref={box}>
      <div className="qr-head static">
        {head}
        <span className="qr-sp" />
        {onAsk && (
          <button className="qr-ask" onClick={onAsk} disabled={!done}>
            اسأل
          </button>
        )}
      </div>

      {onScreen && !thought && (
        <div className="qr-skel" aria-hidden="true">
          <span style={{ width: '38%' }} />
          <span style={{ width: '86%' }} />
          <span style={{ width: '64%' }} />
        </div>
      )}

      <div className="qr-list">
        {shown.map((r, i) => (
          <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
        ))}
      </div>

      <div className="qr-foot">قراءة آلية · استرشادية غير مُلزِمة</div>
    </div>
  )
}

/* قراءة واحدة — نفس التركيب في العرضين */
function ReadingBlock({
  reading: r,
  typing,
  chars,
  hidden,
}: {
  reading: Reading
  typing: boolean
  chars: number
  hidden: boolean
}) {
  if (hidden) return null
  const body = typing ? r.text.slice(0, chars) : highlight(r.text, r.bold, r.danger)

  return (
    <div className={`qr-item${r.kind === 'flag' ? ' flag' : ''}${typing ? ' typing' : ''}`}>
      {r.label && <div className="qr-lbl">{r.label}</div>}

      {r.metric && (
        <div className="qr-metric">
          <b className="num">{r.metric.value}</b>
          <span>{r.metric.unit}</span>
        </div>
      )}

      <div className="qr-tx">
        {body}
        {typing && <span className="caret" />}
      </div>

      {!typing && (
        <div className="rise">
          {r.bar && (
            <>
              <div className="qr-bar">
                <i style={{ width: `${Math.min(100, (r.bar.value / r.bar.limit) * 100)}%` }} />
              </div>
              <div className="qr-barl">
                <span>{r.bar.limitLabel} <span className="num">{nf.format(r.bar.limit)}</span></span>
                <span>{r.bar.valueLabel} <span className="num">{nf.format(r.bar.value)}</span></span>
              </div>
            </>
          )}

          {r.src && <div className="qr-src">المصدر: {r.src}</div>}

          {(r.to || r.actions) && (
            <div className="qr-acts">
              {r.to && (
                <Link className="qr-btn qr-go" to={r.to}>
                  {r.toLabel ?? 'اعرضها'}
                  <Icon path={icons.chevron} size={14} />
                </Link>
              )}
              {r.actions?.map((a) => (
                <button key={a.label} className="qr-btn" onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
