import { useEffect, useRef, useState } from 'react'
import { Glass, Icon, icons } from '@/components/ui'
import { units } from '@/lib/format'
import { ReadingBlock, ReadingPeek } from '@/components/assistant/ReadingBlock'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import type { Reading } from '@/components/assistant'

/** المساعد بيفكّر لحظة قبل ما يبدأ يكتب — عشان القراءة تبان مُنتَجة مش محفوظة */
const THINK_MS = 900

export interface QuickAnalysisProps {
  /** كل ما المساعد بيقوله عن المشروع ده — الرحلة والقراءات */
  readings: Reading[]
  onAsk: () => void
}

/**
 * تحليلات المشروع — **المكان الوحيد** اللي المساعد بيتكلم فيه عن
 * المشروع.
 *
 * قبل كده كان فيه اتنين: شريط «رحلة المشروع» فوق التبويبات، وكارت
 * «تحليلات المشروع» في عمود السياق — والاتنين بيقولوا نفس الحاجة
 * بصياغتين. «واقف عند دراسة المشروع من 87 يومًا، 132% فوق الحدّ»
 * كانت مكتوبة مرتين في نفس الشاشة بشكلين مختلفين. اتوحّدوا هنا.
 *
 * **بالطلب لا تلقائيًا.** طلب الكلاينت: «يبقى موجود السكشن زي ما هو
 * عادي صغير لسه ما اتفتحش، ولما تطلب اعمل لي تحليلات يبتدي يعمل لك
 * التحليلات». السبب اللي وراه إن عمود السياق كان بياخد ارتفاع الشاشة
 * كلها قبل ما المستخدم يقرا المشروع نفسه.
 *
 * ومع ذلك الكارت المقفول **بيعرض لمحة أهمّ قراءة**: السؤال الأول
 * اللي المستخدم بيفتح المشروع عشانه («واقف فين ومحتاج إيه») يتقري
 * من غير ضغطة، والتفصيل بيتحسب بالطلب.
 *
 * وبعد أول تشغيل بيفضل محسوبًا: القفل والفتح بيداري ويوري، ما
 * بيعيدش الحساب — إعادة الكتابة كل مرة بتبقى استعراضًا لا معلومة.
 *
 * ⚠️ مهلة «بيقرا» في النموذج ده مكان استدعاء السيرفر. لما يبقى فيه
 * باك اند، الحالة دي بتبقى انتظار حقيقي لا مؤقّتًا.
 */
export function QuickAnalysis({ readings, onAsk }: QuickAnalysisProps) {
  const card = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(card)
  const [thought, setThought] = useState(false)
  /** اتطلب التحليل مرة على الأقل — بيفضل محسوبًا بعد كده */
  const [armed, setArmed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!armed || !onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [armed, onScreen, thought])

  const { block, chars, done } = useTypedBlocks(readings.map((r) => r.text), thought)
  const thinking = armed && onScreen && !thought
  const flags = readings.filter((r) => r.kind === 'flag').length

  if (readings.length === 0) return null

  const title = (
    <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: '.95rem' }}>
      تحليلات المشروع السريعة
    </div>
  )

  /* ── مقفول: العنوان + عدّاد + لمحة أهمّ قراءة ── */
  if (!armed) {
    return (
      <Glass className="aicard aishut" ref={card}>
        <div className="rowf" style={{ gap: '.6rem' }}>
          <span className="badge badge-30"><span className="aispark" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {title}
            <div className="sub">
              {units.reading(readings.length)}
              {flags > 0 && <span className="itag no aishut-f">{flags} تحتاج انتباه</span>}
            </div>
          </div>
          <button className="btn btn-1 btn-sm" onClick={() => { setArmed(true); setOpen(true) }}>
            حلّل المشروع
          </button>
        </div>

        {readings[0] && <ReadingPeek reading={readings[0]} />}
      </Glass>
    )
  }

  return (
    <Glass className="aicard" ref={card}>
      <div className="rowf" style={{ gap: '.6rem', marginBottom: '.9rem' }}>
        <span className={`badge badge-30${done ? '' : ' pulse'}`}>
          <span className="aispark" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {title}
          <div className="sub">
            {done ? (
              'قراءة آلية · استرشادية غير مُلزِمة'
            ) : (
              <>مساعد أبانمي يقرأ الملف<span className="dots"><i /><i /><i /></span></>
            )}
          </div>
        </div>
        <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>اسأل</button>
        <button
          className="aifold"
          aria-expanded={open}
          aria-label={open ? 'إخفاء التحليل' : 'إظهار التحليل'}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon path={open ? icons.chevronUp : icons.chevronDown} size={16} />
        </button>
      </div>

      {open && thinking && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '92%' }} />
          <span style={{ width: '78%' }} />
          <span style={{ width: '56%' }} />
        </div>
      )}

      {!open && readings[0] && <ReadingPeek reading={readings[0]} />}

      {/* الرندر الشرطي لا `hidden`: `.qr-list` ليها بادنج وحدود في
          الـCSS، والخاصية بتتغلب عليها فالكارت بيفضل مفتوحًا. */}
      {open && (
        <div className="qr-list">
          {readings.map((r, i) => (
            <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
          ))}
        </div>
      )}
    </Glass>
  )
}
