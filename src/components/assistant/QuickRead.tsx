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
   * `panel` = كارت كامل في عمود السياق (صفحة المشروع والجهة).
   * `bar`   = سطر واحد فوق النتائج بينفتح (شاشات القوائم، مفيش عمود جانبي).
   */
  variant?: 'panel' | 'bar'
  title?: string
  /** يفتح لوح المساعد الكامل */
  onAsk?: () => void
}

/**
 * القراءة السريعة — نفس فكرة صفحة المشروع، متاحة في أي شاشة.
 *
 * الشاشة ما بتكتبش نصًّا: بتسلّم `Reading[]` محسوبة من نفس الداتا
 * المعروضة (شوف `data/readings.ts`). الكومبوننت ده مسؤول عن حاجة
 * واحدة — إن القراءة تتقال بنفس الصوت في كل مكان: تفكير قصير، كتابة
 * حرف حرف، رقم مُبرز، مصدر تحته، وطريق يوصّلك للصفوف اللي بتتكلم عنها.
 *
 * وشكلها بيختلف حسب المكان لا حسب المحتوى: كارت في العمود الجانبي
 * لما يكون فيه عمود، وسطر بينفتح فوق القائمة لما ما يكونش فيه.
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

  /* ── العرض المختصر: سطر واحد فوق النتائج ── */
  if (variant === 'bar') {
    return (
      <Glass className={`qread strip${open ? ' open' : ''}`} ref={box}>
        <button
          className="qread-h"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={`badge badge-30${done ? '' : ' pulse'}`}>
            <span className="aispark" />
          </span>
          <span className="qread-t">{title}</span>
          {flags > 0 && (
            <span className="qread-n no">
              <span className="num">{flags}</span> تحتاج انتباه
            </span>
          )}
          <span className="qread-n">
            <span className="num">{readings.length}</span> قراءات
          </span>
          <span className="pc-sp" />
          <Icon path={open ? icons.chevronUp : icons.chevronDown} size={16} />
        </button>

        {!open && readings[0] && (
          <div className="qread-peek sub trim1">{readings[0].text}</div>
        )}

        {open && (
          <div className="qread-list">
            {shown.map((r, i) => (
              <ReadingBlock
                key={r.id}
                reading={r}
                typing={i === block}
                chars={chars}
                hidden={i > block}
              />
            ))}
          </div>
        )}
      </Glass>
    )
  }

  /* ── العرض الكامل: كارت في عمود السياق ── */
  return (
    <Glass className="qread aicard" ref={box}>
      <div className="rowf" style={{ gap: '.6rem', marginBottom: '.9rem' }}>
        <span className={`badge badge-30${done ? '' : ' pulse'}`}>
          <span className="aispark" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: '.95rem' }}>{title}</div>
          <div className="sub">
            {done ? (
              'قراءة آلية · استرشادية غير مُلزِمة'
            ) : (
              <>مساعد أبانمي يقرأ<span className="dots"><i /><i /><i /></span></>
            )}
          </div>
        </div>
        {onAsk && (
          <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>اسأل</button>
        )}
      </div>

      {onScreen && !thought && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '92%' }} />
          <span style={{ width: '78%' }} />
          <span style={{ width: '56%' }} />
        </div>
      )}

      <div className="ins">
        {shown.map((r, i) => (
          <ReadingBlock
            key={r.id}
            reading={r}
            typing={i === block}
            chars={chars}
            hidden={i > block}
          />
        ))}
      </div>
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
    <div className={`data i${r.kind === 'flag' ? ' flag' : ''}${typing ? ' typing' : ''}`}>
      {r.label && (
        <div className="rowf" style={{ justifyContent: 'space-between', marginBottom: '.5rem' }}>
          <span className={`itag${r.kind === 'flag' ? ' no' : ''}`}>{r.label}</span>
        </div>
      )}

      <div className="tx">
        {body}
        {typing && <span className="caret" />}
      </div>

      {!typing && (
        <div className="rise">
          {r.bar && (
            <>
              <div className="bar over" style={{ marginTop: '.6rem' }}>
                <i style={{ width: `${Math.min(100, (r.bar.value / r.bar.limit) * 100)}%` }} />
              </div>
              <div className="rowf" style={{ justifyContent: 'space-between', marginTop: '.35rem' }}>
                <span className="sub">
                  {r.bar.limitLabel} <span className="num">{nf.format(r.bar.limit)}</span>
                </span>
                <span className="sub">
                  {r.bar.valueLabel} <span className="num">{nf.format(r.bar.value)}</span>
                </span>
              </div>
            </>
          )}

          {r.src && <div className="src">المصدر: {r.src}</div>}

          {(r.to || r.actions) && (
            <div className="rowf" style={{ gap: '.5rem', marginTop: '.7rem' }}>
              {r.to && (
                <Link className="btn btn-1 btn-sm" to={r.to}>
                  <Icon path={icons.link} size={14} />
                  {r.toLabel ?? 'اعرضها'}
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
