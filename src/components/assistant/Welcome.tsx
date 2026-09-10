import { useRef, type CSSProperties, type ReactNode } from 'react'
import { Icon, icons, type IconName } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'

export interface WelcomeCard {
  icon: string
  title: string
  /** سطر تحت العنوان: نتيجة الاختصار، مش إعادة صياغته */
  sub: string
  prompt: string
}

export interface WelcomeProps {
  /** الترحيب الشخصي — «أهلًا عمر» */
  greet: string
  /** السطر اللي بيقول **فين** هيدوّر: «كيف أقدر أساعدك في «س»؟» */
  sub: string
  cards: WelcomeCard[]
  onPick: (prompt: string) => void
  composer: ReactNode
  /** نسخة اللوح الجانبي — نفس التشكيل بمقاسات العمود الضيّق */
  compact?: boolean
}

/**
 * الحالة الأولى للمساعد — **الشكل الواحد في الشاشة الكاملة وفي اللوح**.
 *
 * قبل كده كان لكل واحد شكل: الشاشة الكاملة فيها شرارة كبيرة وترحيب
 * وسؤال ومربع كتابة وكروت بعناوين وشروح؛ واللوح فيه سطر ترحيب واحد
 * وقايمة أزرار رفيعة ومربع الكتابة تحت في الرصيف. فالمستخدم اللي
 * بيفتح اللوح من صفحة المشروع كان بيحسّ إنه دخل حاجة تانية أصغر، مش
 * إنه فتح نفس المساعد في مكان أضيق.
 *
 * دلوقتي الاتنين نفس البلوك بنفس الترتيب — شرارة، ترحيب، سؤال، كتابة،
 * كروت — واللي بيتغيّر حاجة واحدة: **الكلام اللي بيقول هيدوّر فين**.
 * في الشاشة الكاملة «كيف أقدر أساعدك اليوم؟» لأن مداه السيستم كله،
 * وفي اللوح «كيف أقدر أساعدك في «اسم المشروع»؟» لأن مداه الصفحة
 * المفتوح منها — والكروت كمان بتتغيّر معاه.
 */
export function Welcome({ greet, sub, cards, onPick, composer, compact }: WelcomeProps) {
  const grid = useRef<HTMLDivElement>(null)
  useProximity(grid, { reach: compact ? 240 : 300, selector: '.wcard' })

  return (
    <div className={`welcome${compact ? ' wmini' : ''}`}>
      <div className="whead">
        <span className="wspark"><span className="aispark" /></span>
        <div className="wtext">
          <h1 className="wgreet">{greet}</h1>
          <p className="wsub">{sub}</p>
        </div>
      </div>

      {composer}

      {/* الاختصارات تحت مربع الكتابة — الكتابة هي المدخل، ودي طرق سريعة */}
      <div className="wcards" ref={grid}>
        {cards.map((c, i) => (
          <button
            className="wcard glass"
            key={c.title}
            style={{ '--d': `${i * 70}ms` } as CSSProperties}
            onClick={() => onPick(c.prompt)}
          >
            <span className="badge badge-30"><Icon path={icons[c.icon as IconName]} /></span>
            <span className="wc-t">{c.title}</span>
            <span className="wc-s">{c.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
