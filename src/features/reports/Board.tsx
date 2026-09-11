import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon, icons, Select } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { AnalysisCard, highlight } from '@/components/assistant'
import { useFillHeight } from '@/hooks/useFillHeight'
import { readReports } from '@/data/readings'
import { boardCards, PERIODS, type ReportCard } from '@/data/reportDefs'

/**
 * لوحة التقارير.
 *
 * كل كارت **سؤال وإجابته**، مش اسم تقرير. النظام العامل بيبدأ من
 * الاسم («تقرير المعرفة») ويطلب منك تملا فورم عشان تشوف رقم؛ هنا
 * الترتيب معكوس: السؤال («بنتعلّم من اللي عملناه؟») والرقم جاهز
 * للفترة المختارة، والجملة بتقول الرقم معناه إيه، والمصدر مكتوب،
 * والضغط بيوصّلك للصفوف نفسها.
 *
 * والفترة فوق واحدة للكل: **سنة × مصدر تمويل** · نفس تقسيم النظام
 * (2026 المؤسسة · 2023 الوقف)، لأن الميزانيتين مستقلتين فعلًا.
 */
export function Board({
  period,
  onPeriod,
}: {
  period: string
  onPeriod: (id: string) => void
}) {
  const cards = boardCards(period)
  const readings = readReports(period)

  /* نفس عمود التحليلات اللازق اللي في المشروع والجهة · الصفحة دي
     أكتر واحدة محتاجاه: اللوحة بتقول الأرقام، والعمود بيقول اللي
     يتعمل بيها.
     الفرق هنا إن الكروت أقصر من الشاشة، فمن غير `capSelector` الكارت
     بيمتدّ تحت آخر كارت. السقف بيخلّي العمودين يخلصوا في نفس السطر. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, {
    varName: '--ai-fill',
    reserveSelector: '.decdock, .askfab',
    capSelector: '.rbg',
    min: 240,
  })

  return (
    <>
      <div className="rbtop">
        <Select
          icon={icons.chart}
          value={period}
          allowEmpty={false}
          options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(v) => onPeriod(v ?? PERIODS[0].id)}
        />
        <span className="sub">كل رقم تحت محسوب للفترة دي، ومصدره مكتوب جنبه</span>
      </div>

      <div className="g2">
        <div className="col">
          <div className="rbg">
            {cards.map((c) => (
              <Card key={c.key} c={c} />
            ))}
          </div>
        </div>

        <div className="col aiside" ref={aside}>
          <AnalysisCard
            readings={readings}
            title="تحليلات التقارير السريعة"
            cta="حلّل الفترة"
            onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          />
        </div>
      </div>
    </>
  )
}

/**
 * الكارت: شبكة صفوف ثابتة عشان الكروت تتسطّر مع بعضها.
 *
 * قبل كده كان عمودًا مرنًا، فالجملة اللي سطرين والجملة اللي تلاتة
 * كانوا بيزحزحوا الأعمدة والمصدر تحتيهم · فالصف يبان مكسور. دلوقتي
 * الجملة مقصوصة عند تلات سطور، والأعمدة بتاخد المساحة الباقية،
 * والمصدر ملزوق في القاع. النتيجة: كل كارت في الصف بنفس الخطوط.
 */
function Card({ c }: { c: ReportCard }) {
  const max = c.bars?.length ? Math.max(...c.bars.map((b) => b.v)) || 1 : 1
  const total = c.bars?.reduce((s, b) => s + b.v, 0) || 1
  const share = c.bars && c.bars.length > 2 && total > 1000

  return (
    <Link to={ROUTES.reportView(c.key)} className="rbc glass">
      <span className="rbc-h">
        <span className="rbc-i"><Icon name={icons[c.icon]} size={17} /></span>
        <span className="rbc-q">{c.question}</span>
        <Icon name={icons.chevron} size={15} />
      </span>

      <span className="rbc-v">
        <b className="num">{c.value}</b>
        <small>{c.unit}</small>
      </span>

      <p className="rbc-r">{highlight(c.reading, c.bold ?? [], c.danger ?? [])}</p>

      {c.bars && (
        <span className="rbc-b">
          {c.bars.map((b) => (
            <span className="rbc-bi" key={b.k}>
              <span className="rbc-bk" title={b.k}>{b.k}</span>
              <span className="rbc-bt">
                <i className={b.tone ?? 'mute'} style={{ width: `${Math.max(1, Math.round((b.v / max) * 100))}%` }} />
              </span>
              <span className="rbc-bn">
                <span className="num">
                  {share ? `${Math.round((b.v / total) * 100)}%` : b.v.toLocaleString('en-US')}
                </span>
              </span>
            </span>
          ))}
        </span>
      )}

      <span className="rbc-s mut">{c.src}</span>
    </Link>
  )
}
