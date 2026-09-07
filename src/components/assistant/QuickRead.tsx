import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glass } from '@/components/ui/primitives'
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
 * بتلبس نفس زجاج السيستم زي أي كارت تاني: المساعد جزء من الواجهة
 * مش طبقة فوقها، والتمييز بييجي من **الشرارة والكتابة الحيّة**
 * مش من سطح بلون تاني.
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
      <span className={`badge badge-30${done ? '' : ' pulse'}`}>
        <span className="aispark" />
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
      <Glass className={`qread strip${open ? ' open' : ''}`} ref={box}>
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
      </Glass>
    )
  }

  /* ── العرض الكامل: كارت في عمود السياق ── */
  return (
    <Glass className="qread panel aicard" ref={box}>
      <div className="qr-head static">
        {head}
        <span className="qr-sp" />
        {onAsk && (
          <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>
            اسأل
          </button>
        )}
      </div>

      {onScreen && !thought && (
        <div className="skel" aria-hidden="true">
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
    </Glass>
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
      {r.label && (
        <div className="qr-lbl">
          <span className={`itag${r.kind === 'flag' ? ' no' : ''}`}>{r.label}</span>
        </div>
      )}

      {/* الرقم في أول السطر لا فوقه: الرقم الضخم كان بياخد وزنًا
          أكبر من الجملة نفسها، والصفحة كانت بتمتلي أرقامًا حمرا. */}
      <div className="qr-tx">
        {r.metric && (
          <>
            <b className="qr-lead num">{r.metric.value}</b>
            <span className="qr-unit">{r.metric.unit}</span>
            {' — '}
          </>
        )}
        {body}
        {typing && <span className="caret" />}
      </div>

      {!typing && (
        <div className="rise">
          {r.bar && (
            <>
              <div className="bar">
                <i
                  style={{
                    width: `${Math.min(100, (r.bar.value / r.bar.limit) * 100)}%`,
                    background: 'linear-gradient(90deg,var(--teal),var(--lime))',
                  }}
                />
              </div>
              <div className="qr-barl">
                <span className="sub">{r.bar.limitLabel} <span className="num">{nf.format(r.bar.limit)}</span></span>
                <span className="sub">{r.bar.valueLabel} <span className="num">{nf.format(r.bar.value)}</span></span>
              </div>
            </>
          )}

          {r.src && <div className="src">المصدر: {r.src}</div>}

          {(r.to || r.actions) && (
            <div className="qr-acts">
              {r.to && (
                <Link className="btn btn-1 btn-sm" to={r.to}>
                  {r.toLabel ?? 'اعرضها'}
                  <Icon path={icons.chevron} size={14} />
                </Link>
              )}
              {r.actions?.map((a) => (
                <button key={a.label} className={`btn ${a.kind ?? 'btn-2'} btn-sm`} onClick={a.onClick}>
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
