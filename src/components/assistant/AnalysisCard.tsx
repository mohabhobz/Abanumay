import { useEffect, useRef, useState } from 'react'
import { Glass, Icon, icons } from '@/components/ui'
import { units } from '@/lib/format'
import { ReadingBlock, ReadingPeek } from './ReadingBlock'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import type { Reading } from './reading'

/** المساعد بيفكّر لحظة قبل ما يبدأ يكتب — عشان القراءة تبان مُنتَجة مش محفوظة */
const THINK_MS = 900

export interface AnalysisCardProps {
  /** كل ما المساعد بيقوله عن الكيان ده — الرحلة والقراءات */
  readings: Reading[]
  onAsk: () => void
  /** «تحليلات المشروع السريعة» · «تحليلات الجهة السريعة» */
  title?: string
}

/**
 * كارت التحليلات — **المكان الوحيد** اللي المساعد بيتكلم فيه عن
 * الكيان المفتوح (مشروع أو جهة).
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
export function AnalysisCard({ readings, onAsk, title: heading = 'تحليلات المشروع السريعة' }: AnalysisCardProps) {
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
    <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: '.95rem' }}>{heading}</div>
  )

  /* ── مقفول: بوستر في نص الكارت ──
     العمود الجانبي فيه كارت واحد بيملا الارتفاع المتاح، فالحالة
     المقفولة مش سطر صغير فوق فراغ: الشرارة والعنوان واللمحة والزرار
     في نص الكارت رأسيًا. الفراغ اللي كان على الشمال بقى هو المساحة
     اللي بتخلّي الدعوة تتشاف. */
  if (!armed) {
    return (
      <Glass className="aicard aishut" ref={card}>
        <div className="aishut-c">
          <span className="badge badge-44"><span className="aispark" /></span>

          <h2 className="aishut-t">{heading}</h2>

          <div className="aishut-m">
            <span className="qr-count">{units.reading(readings.length)}</span>
            {flags > 0 && (
              <span className="qr-count no">
                <span className="num">{flags}</span> تحتاج انتباه
              </span>
            )}
          </div>

          {/* لمحة أهمّ قراءة: «واقف فين ومحتاج إيه» أول سؤال بيتسأل،
              فبيتقري من غير ضغطة، والتفصيل بيتحسب بالطلب. */}
          {readings[0] && (
            <p className="aishut-p">
              {readings[0].metric && (
                <b className={readings[0].kind === 'flag' ? 'bad' : undefined}>
                  {readings[0].metric.value} {readings[0].metric.unit} —{' '}
                </b>
              )}
              {readings[0].text}
            </p>
          )}

          <button className="btn btn-p aishut-go" onClick={() => { setArmed(true); setOpen(true) }}>
            {heading.includes('الجهة') ? 'حلّل ملف الجهة' : 'حلّل المشروع'}
          </button>
        </div>
      </Glass>
    )
  }

  return (
    <Glass className="aicard aiopen" ref={card}>
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
        <div className="qr-list aiscroll">
          {readings.map((r, i) => (
            <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
          ))}
        </div>
      )}
    </Glass>
  )
}
