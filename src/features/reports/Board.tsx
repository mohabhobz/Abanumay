import { unitAfter } from '@/lib/format'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon, icons, Select } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { AnalysisCard, highlight } from '@/components/assistant'
import { useFillHeight } from '@/hooks/useFillHeight'
import { readReports } from '@/data/readings'
import { boardCards, PERIODS, type ReportCard } from '@/data/reportDefs'

/**
 * Reports dashboard.
 *
 * Each card is a question and its answer, not a report's name. The
 * current system starts from a name ("Knowledge Report") and makes you
 * fill a form before seeing a number; here the order is reversed: the
 * question ("are we learning from what we've done?") comes with the
 * number already ready for the selected period, a sentence explains what
 * the number means, the source is stated, and clicking takes you to the
 * underlying rows.
 *
 * The period control at the top is shared by everyone: year × funding
 * source, matching the system's own split (2026 for the foundation, 2023
 * for the endowment), because the two budgets are genuinely independent.
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

  /* Same sticky insights column as on the project and entity pages — this
     page needs it most: the dashboard states the numbers, and the column
     states what to do with them. The difference here is that the cards are
     shorter than the screen, so without `capSelector` the column would
     extend below the last card. The cap makes both columns end on the same line. */
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
        <span className="sub">كل رقم أدناه محسوب لهذه الفترة، ومصدره مكتوب بجانبه</span>
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
            empty="لا توجد ملاحظات على الفترة المختارة · اختر فترة أخرى."
            onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          />
        </div>
      </div>
    </>
  )
}

/**
 * Card: a fixed row grid so cards line up with each other.
 *
 * It used to be a flexible column, so a two-line sentence and a
 * three-line sentence would shift the figures and source below them out
 * of alignment, making the row look broken. Now the sentence is clamped
 * to three lines, the figures take the remaining space, and the source is
 * pinned to the bottom. The result: every card in a row lines up on the
 * same baselines.
 */
function Card({ c }: { c: ReportCard }) {
  const max = c.bars?.length ? Math.max(...c.bars.map((b) => b.v)) || 1 : 1
  const total = c.bars?.reduce((s, b) => s + b.v, 0) || 1
  const share = c.bars && c.bars.length > 2 && total > 1000

  return (
    <Link to={ROUTES.reportView(c.key)} className="rbc glass">
      <span className="rbc-h">
        <span className="rbc-i"><Icon name={icons[c.icon]} size="md" /></span>
        <span className="rbc-q">{c.question}</span>
        <Icon name={icons.chevron} size="sm" />
      </span>

      <span className="rbc-v">
        <b className="num">{c.value}</b>
        <small>{unitAfter(c.value, c.unit)}</small>
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
