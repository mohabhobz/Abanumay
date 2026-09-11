import { useEffect, useRef, useState } from 'react'
import { Glass } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { icons } from '@/components/ui/icons'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import { units } from '@/lib/format'
import { ReadingBlock, ReadingPeek } from './ReadingBlock'
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
        {units.reading(readings.length)}
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
          <Icon name={open ? icons.chevronUp : icons.chevronDown} size={16} />
        </button>

        {!open && readings[0] && <ReadingPeek reading={readings[0]} />}

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

  /* ── العرض الكامل: كارت في عمود السياق ──
     بيتقفل ويتفتح زي المختصر. قبل كده كان بيفتح على طوله وياخد
     ارتفاع الشاشة كله في العمود الجانبي، فالمستخدم يوصل للمحتوى
     اللي تحته بعد تمرير طويل قبل ما يقرر إنه عايز يقراه أصلًا.
     ولمّا يتقفل الترويسة بتفضل بعدّادها، فاللي محتاج انتباه بيبان
     من غير ما الكارت يتفتح. */
  return (
    <Glass className={`qread panel aicard${open ? ' open' : ''}`} ref={box}>
      {/* الترويسة صفّ لا زرار: جوّاها زرار «اسأل»، وزرار جوّه زرار
          ترميز غلط والمتصفح بيفكّه بطرق مختلفة. الطيّ زرارّه لوحده،
          نفس `.aifold` في تحليلات المشروع. */}
      <div className="qr-head static">
        {head}
        <span className="qr-sp" />
        {onAsk && (
          <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>
            اسأل
          </button>
        )}
        <button
          className="qr-fold"
          aria-expanded={open}
          aria-label={open ? 'طيّ القراءة' : 'فتح القراءة'}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={open ? icons.chevronUp : icons.chevronDown} size={16} />
        </button>
      </div>

      {open && onScreen && !thought && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '38%' }} />
          <span style={{ width: '86%' }} />
          <span style={{ width: '64%' }} />
        </div>
      )}

      {!open && readings[0] && <ReadingPeek reading={readings[0]} />}

      {open && (
        <>
          <div className="qr-list">
            {shown.map((r, i) => (
              <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
            ))}
          </div>

          <div className="qr-foot">قراءة آلية · استرشادية غير مُلزِمة</div>
        </>
      )}
    </Glass>
  )
}
