import { useEffect, useRef, useState } from 'react'
import { Glass } from '@/components/ui'
import { nf } from '@/lib/format'
import { highlight } from '../components/highlight'
import { useOnScreen } from '../hooks/useOnScreen'
import { useTypedBlocks } from '../hooks/useTypedBlocks'
import type { Insight, LogEntry } from '@/types/domain'

/** المساعد بيفكّر لحظة قبل ما يبدأ يكتب — عشان القراءة تبان مُنتَجة مش محفوظة */
const THINK_MS = 900

interface AnalysisBlock {
  kind: 'breach' | 'insight'
  text: string
  bold: string[]
  danger?: string[]
  src?: string
}

export interface QuickAnalysisProps {
  /** الإجراء اللي عدّى حدّ قسمه، إن وُجد */
  breach?: LogEntry
  insights: Insight[]
  /** عدد الأيام اللي الإجراء مفتوح فيها */
  openDays?: number
  onAsk: () => void
}

/**
 * تحليلات المشروع السريعة — أول كارت في عمود السياق.
 *
 * تجاوز مدة الإجراء قراءة جوّه التحليلات مش كارت لوحده، عشان كل اللي
 * المساعد شايفه عن حالة المشروع يبقى في مكان واحد. والكتابة بتبدأ أول
 * ما الكارت يوصل للشاشة، مش وقت التحميل.
 */
export function QuickAnalysis({ breach, insights, openDays = 87, onAsk }: QuickAnalysisProps) {
  const card = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(card)
  const [thought, setThought] = useState(false)

  useEffect(() => {
    if (!onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [onScreen, thought])

  const over = breach ? Math.round((breach.hours / breach.limit - 1) * 100) : 0

  const blocks: AnalysisBlock[] = [
    ...(breach
      ? [{
          kind: 'breach' as const,
          text:
            `الإجراء استهلك ${nf.format(breach.hours)} ساعة مقابل حدّ ${nf.format(breach.limit)} — ` +
            `أي ${over}٪ فوق الحدّ، ومفتوح من ${openDays} يومًا بلا سبب مسجَّل. ` +
            `المشروع واقف على الجهة منذ طلب الاستكمال.`,
          bold: [nf.format(breach.hours), nf.format(breach.limit), `${over}٪ فوق الحدّ`, `${openDays} يومًا`],
          danger: [`${over}٪ فوق الحدّ`],
        }]
      : []),
    ...insights.map((it) => ({
      kind: 'insight' as const,
      text: it.text,
      bold: it.bold,
      src: it.src,
    })),
  ]

  const { block, chars, done } = useTypedBlocks(blocks.map((b) => b.text), thought)
  const thinking = onScreen && !thought

  return (
    <Glass className="aicard" ref={card}>
      <div className="rowf" style={{ gap: '.6rem', marginBottom: '.9rem' }}>
        <span className={`badge badge-30${done ? '' : ' pulse'}`}>
          <span className="aispark" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: '.95rem' }}>
            تحليلات المشروع السريعة
          </div>
          <div className="sub">
            {done ? (
              'قراءة آلية · استرشادية غير مُلزِمة'
            ) : (
              <>مساعد أبانمي يقرأ الملف<span className="dots"><i /><i /><i /></span></>
            )}
          </div>
        </div>
        <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>اسأل</button>
      </div>

      {thinking && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '92%' }} />
          <span style={{ width: '78%' }} />
          <span style={{ width: '56%' }} />
        </div>
      )}

      <div className="ins">
        {blocks.map((bl, i) => {
          if (i > block) return null
          const typing = i === block
          const body = typing ? bl.text.slice(0, chars) : highlight(bl.text, bl.bold, bl.danger)

          if (bl.kind === 'breach' && breach) {
            return (
              <div className={`data i flag${typing ? ' typing' : ''}`} key="breach">
                <div
                  className="rowf"
                  style={{ justifyContent: 'space-between', gap: '.5rem', marginBottom: '.5rem' }}
                >
                  <span className="itag no">تجاوز مدة الإجراء</span>
                  <span className="sub">{breach.dept}</span>
                </div>

                <div className="tx">
                  {body}
                  {typing && <span className="caret" />}
                </div>

                {!typing && (
                  <div className="rise">
                    <div className="bar over" style={{ marginTop: '.6rem' }}>
                      <i style={{ width: '100%' }} />
                      <u style={{ insetInlineStart: `${Math.round((breach.limit / breach.hours) * 100)}%` }} />
                    </div>
                    <div className="rowf" style={{ justifyContent: 'space-between', marginTop: '.35rem' }}>
                      <span className="sub">
                        الحدّ <span className="num">{nf.format(breach.limit)}</span> ساعة
                      </span>
                      <span className="sub" style={{ color: 'var(--warn)' }}>
                        المستهلَك <span className="num">{nf.format(breach.hours)}</span>
                      </span>
                    </div>
                    <div className="src">المصدر: سجل الإجراءات · حدّ قسم {breach.dept}</div>
                    <div className="rowf" style={{ gap: '.5rem', marginTop: '.75rem' }}>
                      <button className="btn btn-1 btn-sm">تذكير الجهة</button>
                      <button className="btn btn-2 btn-sm">تسجيل سبب</button>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div className={`data i${typing ? ' typing' : ''}`} key={i}>
              <div className="tx">
                {body}
                {typing && <span className="caret" />}
              </div>
              {!typing && bl.src && <div className="src rise">{bl.src}</div>}
            </div>
          )
        })}
      </div>
    </Glass>
  )
}
