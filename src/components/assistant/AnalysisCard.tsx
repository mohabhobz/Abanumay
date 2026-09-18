import { useEffect, useRef, useState } from 'react'
import { Glass, Icon, icons } from '@/components/ui'
import { ReadingBlock, ReadingPeek } from './ReadingBlock'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import type { Reading } from './reading'

/** المساعد بيفكّر لحظة قبل ما يبدأ يكتب · عشان القراءة تبان مُنتَجة مش محفوظة */
const THINK_MS = 900

export interface AnalysisCardProps {
  /** كل ما المساعد بيقوله عن الكيان ده · الرحلة والقراءات */
  readings: Reading[]
  onAsk: () => void
  /** «تحليلات المشروع السريعة» · «تحليلات الجهة السريعة» */
  title?: string
  /** نصّ زرار الدعوة · «حلّل المشروع» افتراضيًا */
  cta?: string
  /**
   * الجملة اللي بتتقال لمّا مفيش قراءات.
   *
   * ⚠️ **الكارت ما بيختفيش · هو بيقول إنه مفيش حاجة.** كان بيرجّع
   * `null`، وفي لوحة التقارير القراءات محسوبة من **الفترة
   * المختارة** · يعني تبديل الفترة كان بيشيل العمود الجانبي كله
   * من الشاشة، والتخطيط بينطّ من عمودين لعمود.
   *
   * وده نفس اللي حصل في `QuickRead` مع الفلاتر · الغياب بيتقري
   * عطلًا، و«مفيش ملاحظات» إجابة.
   */
  empty?: string
  /**
   * زرار «اسأل» ظاهر؟
   *
   * ⚠️ **بوّابة التسجيل مالهاش مساعد أصلًا.** الجهة اللي بتسجّل
   * مالهاش حساب، فمفيش ريل ولا محادثات ولا ⌘K · وزرار بيفتح حاجة
   * مش موجودة أسوأ من غيابه. الكارت بيتقفل على القراءة وحدها هناك.
   */
  ask?: boolean
}

/**
 * كارت التحليلات · **المكان الوحيد** اللي المساعد بيتكلم فيه عن
 * الكيان المفتوح (مشروع أو جهة).
 *
 * قبل كده كان فيه اتنين: شريط «رحلة المشروع» فوق التبويبات، وكارت
 * «تحليلات المشروع» في عمود السياق · والاتنين بيقولوا نفس الحاجة
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
 * بيعيدش الحساب · إعادة الكتابة كل مرة بتبقى استعراضًا لا معلومة.
 *
 * ⚠️ مهلة «بيقرا» في النموذج ده مكان استدعاء السيرفر. لما يبقى فيه
 * باك اند، الحالة دي بتبقى انتظار حقيقي لا مؤقّتًا.
 */
export function AnalysisCard({
  readings, onAsk, title: heading = 'تحليلات المشروع السريعة', cta, ask = true, empty,
}: AnalysisCardProps) {
  const card = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(card)
  const [thought, setThought] = useState(false)
  /** اتطلب التحليل مرة على الأقل · بيفضل محسوبًا بعد كده */
  const [armed, setArmed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!armed || !onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [armed, onScreen, thought])

  /* ⚠️ القراءة الهادية مبنيّة هنا لا في كل شاشة · نفس `QuickRead` */
  const calm: Reading[] = [{
    id: 'ai-calm',
    kind: 'note',
    text: empty ?? 'مفيش ملاحظات في النطاق الحالي · غيّر النطاق تشوف أكتر.',
  }]
  const list = readings.length > 0 ? readings : calm

  const { block, chars, done } = useTypedBlocks(list.map((r) => r.text), thought)
  const thinking = armed && onScreen && !thought
  const flags = list.filter((r) => r.kind === 'flag').length

  const title = (
    <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 'var(--fs-4)' }}>{heading}</div>
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

          {/* عدّاد القراءات اتشال: رقمٌ عن حاجة لسه ما اتقرتش · بيشغل
              سطرًا كامل من غير ما يقول للمستخدم يعمل إيه. اللي بيفضل
              هو التنبيه لو فيه، لأنه بيغيّر القرار. */}
          {flags > 0 && (
            <div className="aishut-m">
              <span className="qr-count no">
                <span className="num">{flags}</span> تحتاج انتباه
              </span>
            </div>
          )}

          {/* لمحة أهمّ قراءة: «واقف فين ومحتاج إيه» أول سؤال بيتسأل،
              فبيتقري من غير ضغطة، والتفصيل بيتحسب بالطلب. */}
          {list[0] && (
            <p className="aishut-p">
              {list[0].metric && (
                <b className={list[0].kind === 'flag' ? 'bad' : undefined}>
                  {list[0].metric.value} {list[0].metric.unit} {' '}
                </b>
              )}
              {list[0].text}
            </p>
          )}

          {/* دعوة مساعِدة لا دعوة الشاشة: الفعل الأساسي في صفحة
              المشروع هو «توصية بالموافقة» في رصيف القرار. دعوة
              أساسية واحدة في الشاشة · والباقي ثانوي. */}
          <button className="btn btn-2 aishut-go" onClick={() => { setArmed(true); setOpen(true) }}>
            {cta ?? (heading.includes('الجهة') ? 'حلّل ملف الجهة' : 'حلّل المشروع')}
          </button>
        </div>
      </Glass>
    )
  }

  return (
    <Glass className="aicard aiopen" ref={card}>
      <div className="rowf" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
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
        {ask && (
          <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>اسأل</button>
        )}
        <button
          className="aifold"
          aria-expanded={open}
          aria-label={open ? 'إخفاء التحليل' : 'إظهار التحليل'}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={open ? icons.chevronUp : icons.chevronDown} size={16} />
        </button>
      </div>

      {open && thinking && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '92%' }} />
          <span style={{ width: '78%' }} />
          <span style={{ width: '56%' }} />
        </div>
      )}

      {!open && list[0] && <ReadingPeek reading={list[0]} />}

      {/* الرندر الشرطي لا `hidden`: `.qr-list` ليها بادنج وحدود في
          الـCSS، والخاصية بتتغلب عليها فالكارت بيفضل مفتوحًا. */}
      {open && (
        <div className="qr-list aiscroll">
          {list.map((r, i) => (
            <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
          ))}
        </div>
      )}
    </Glass>
  )
}
