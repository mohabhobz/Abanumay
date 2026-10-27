import { Link } from 'react-router-dom'
import { Stat, Glass, Head, Icon, icons, Money, Num } from '@/components/ui'
import { CountBars, SaudiMap } from '@/components/charts'
import { ROUTES } from '@/app/routes'
import { impact, type ImpactRow } from '@/data/impact'
import { useClosing } from '@/data/closing/store'
import { NOUN, countOf, nf, pct } from '@/lib/format'

/* «الأثر» · who the grants reached and where (client, 8 Oct).

   One panel, drawn the same on Today and on every report screen, because the client called it the
   reading that matters most · the full report (the «الأثر» tab) adds the map, the domains and
   goals, and the estimate against what was reached, project by project.

   Compact: the four numbers, then where (regions) and in what (tracks), five rows each. */

const TOP = 5
const bars = (rows: ImpactRow[], n = TOP) =>
  rows.slice(0, n).map((r) => ({
    key: r.key, label: r.label, value: r.beneficiaries,
    tip: `${nf.format(r.beneficiaries)} مستفيد · ${countOf(r.projects, NOUN.project)}`,
  }))

export function ImpactPanel({ full = false }: { full?: boolean }) {
  useClosing()
  const m = impact()
  /* Client, 8 Oct · separate cards, not one card holding cards · the heading sits on the page */
  const card = (title: string, rows: ReturnType<typeof bars>, hue: 'c2' | 'c3' | 'c4' | 'c5') => (
    <Glass className="impc-c">
      <Head title={title} />
      <CountBars rows={rows} total={m.estimated} unit="مستفيد" hue={hue} note="من المستفيدين كلهم" />
    </Glass>
  )
  return (
    <section className={`impc${full ? ' impc-full' : ''}`} aria-label="الأثر">
      <div className="impc-top">
        <h2 className="impc-t">الأثر</h2>
        {full
          ? <span className="sub">{countOf(m.projects, NOUN.project)} مموَّلًا</span>
          : <Link className="lnk" to={ROUTES.reportTab('impact')}>التقرير الكامل<Icon name={icons.chevron} size="sm" /></Link>}
      </div>

      {/* Client 27 Oct · the KPI row is the system's one stat card · one height, one inset */}
      <div className="stats4">
        <Stat label="المستفيدون · تقدير الجهات" value={<Num>{m.estimated}</Num>}
          note={<>في {countOf(m.projects, NOUN.project)} مموَّلًا{m.subProjects ? <> · منها <Num>{m.subProjects}</Num> فرعي في المحافظ</> : null}</>} />
        <Stat label="المُتحقّق · من التقارير الختامية" value={m.reportedProjects ? <Num>{m.reached}</Num> : '—'}
          note={m.reportedProjects ? <>مقابل تقدير <Num>{m.reportedEstimate}</Num> في {countOf(m.reportedProjects, NOUN.project)}</> : 'لم يُرسل تقرير ختامي بعد'} />
        <Stat label="نسبة التحقّق" hint="المُتحقّق ÷ تقدير المشاريع نفسها" value={m.rate === null ? '—' : pct(m.rate)} />
        <Stat label="تكلفة المستفيد" hint="الممنوح ÷ المستفيدين المقدَّرين" value={m.costPer === null ? '—' : <Money>{m.costPer}</Money>} />
      </div>

      {full && (
        <Glass className="impc-c impc-map">
          <Head title="الخريطة بالمناطق" />
          <SaudiMap
            unit="مستفيدًا"
            amounts
            points={m.regions.map((r) => ({ key: r.key, label: r.label, value: r.beneficiaries, amount: r.amount, href: `${ROUTES.projects}?region=${encodeURIComponent(r.key)}` }))}
          />
        </Glass>
      )}

      <div className="impc-g">
        {card('أين · المناطق', bars(m.regions, full ? 13 : TOP), 'c2')}
        {card('في ماذا · المسارات', bars(m.tracks), 'c3')}
        {full && card('المجالات', bars(m.fields, 8), 'c4')}
        {full && card('الأهداف', bars(m.goals, 8), 'c5')}
      </div>

      {full && (
        <Glass className="impc-c tblcard">
          <Head title="التقدير مقابل المُتحقّق" />
          {m.pairs.length ? (
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th><span className="th-t">المشروع</span></th>
                    <th><span className="th-t">المنطقة</span></th>
                    <th className="n"><span className="th-t">تقدير الجهة</span></th>
                    <th className="n"><span className="th-t">المُتحقّق</span></th>
                    <th className="n"><span className="th-t">النسبة</span></th>
                  </tr>
                </thead>
                <tbody>
                  {m.pairs.map((x) => (
                    <tr key={x.id}>
                      <td><Link className="lnk" to={x.href}>{x.name}</Link></td>
                      <td>{x.region}</td>
                      <td className="n"><span className="num">{nf.format(x.estimated)}</span></td>
                      <td className="n"><span className="num">{nf.format(x.reached)}</span></td>
                      <td className="n"><span className="num">{pct(Math.round((x.reached / Math.max(1, x.estimated)) * 100))}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="sub">لم يُرسل تقرير ختامي بعد.</p>}
        </Glass>
      )}
    </section>
  )
}
