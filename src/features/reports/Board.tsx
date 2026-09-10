import { Link } from 'react-router-dom'
import { Icon, icons, Select } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { highlight } from '@/components/assistant'
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
 * والفترة فوق واحدة للكل: **سنة × مصدر تمويل** — نفس تقسيم النظام
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

  return (
    <>
      <div className="rbtop">
        <Select
          icon={icons.chart}
          value={period}
          all={PERIODS[0].label}
          options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(v) => onPeriod(v ?? PERIODS[0].id)}
        />
        <span className="sub">
          كل رقم تحت محسوب للفترة دي، ومصدره مكتوب جنبه
        </span>
      </div>

      <div className="rbg">
        {cards.map((c) => (
          <Card key={c.key} c={c} />
        ))}
      </div>
    </>
  )
}

function Card({ c }: { c: ReportCard }) {
  const max = c.bars?.length ? Math.max(...c.bars.map((b) => b.v)) || 1 : 1
  const total = c.bars?.reduce((s, b) => s + b.v, 0) || 1

  return (
    <Link to={ROUTES.reportView(c.key)} className={`rbc glass${c.wide ? ' wide' : ''}`}>
      <span className="rbc-h">
        <span className="badge badge-30"><Icon path={icons[c.icon]} /></span>
        <span className="rbc-q">{c.question}</span>
        <Icon path={icons.chevron} size={15} />
      </span>

      <span className="rbc-v">
        <b className="num">{c.value}</b>
        <small>{c.unit}</small>
      </span>

      <p className="rbc-r">{highlight(c.reading, c.bold ?? [], c.danger ?? [])}</p>

      {/* الرسم الصغير: نسب لا قيم مطلقة — الغرض «فين الثقل» لا
          «كام بالظبط»، والرقم الدقيق في التقرير نفسه. */}
      {c.bars && (
        <span className="rbc-b">
          {c.bars.map((b) => (
            <span className="rbc-bi" key={b.k}>
              <span className="rbc-bk">{b.k}</span>
              <span className="rbc-bt">
                <i className={b.tone ?? 'mute'} style={{ width: `${Math.round((b.v / max) * 100)}%` }} />
              </span>
              <span className="rbc-bn num">
                {c.bars!.length > 2 && b.v >= 1000 ? `${Math.round((b.v / total) * 100)}%` : b.v.toLocaleString('en-US')}
              </span>
            </span>
          ))}
        </span>
      )}

      <span className="rbc-s sub">{c.src}</span>
    </Link>
  )
}
