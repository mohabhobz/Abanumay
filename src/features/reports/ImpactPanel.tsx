import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Money, Num } from '@/components/ui'
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
  return (
    <Glass className={`impc${full ? ' impc-full' : ''}`}>
      <Head
        title="الأثر"
        meta={full
          ? <span className="sub">لمن وصلت المنح وأين · {countOf(m.projects, NOUN.project)} مموَّلًا</span>
          : <Link className="lnk" to={ROUTES.reportTab('impact')}>التقرير الكامل<Icon name={icons.chevron} size="sm" /></Link>}
      />

      <div className="impc-ks">
        <div className="impc-k">
          <span className="impc-kl">المستفيدون · تقدير الجهات</span>
          <b className="impc-kv num">{nf.format(m.estimated)}</b>
          <span className="impc-kn sub">في {countOf(m.projects, NOUN.project)} مموَّلًا</span>
        </div>
        <div className="impc-k">
          <span className="impc-kl">المُتحقّق · من التقارير الختامية</span>
          <b className="impc-kv num">{m.reportedProjects ? nf.format(m.reached) : '—'}</b>
          <span className="impc-kn sub">
            {m.reportedProjects ? <>مقابل تقدير <Num>{m.reportedEstimate}</Num> في {countOf(m.reportedProjects, NOUN.project)}</> : 'لم يُرسل تقرير ختامي بعد'}
          </span>
        </div>
        <div className="impc-k">
          <span className="impc-kl">نسبة التحقّق</span>
          <b className="impc-kv num">{m.rate === null ? '—' : pct(m.rate)}</b>
          <span className="impc-kn sub">المُتحقّق ÷ تقدير المشاريع نفسها</span>
        </div>
        <div className="impc-k">
          <span className="impc-kl">تكلفة المستفيد</span>
          <b className="impc-kv">{m.costPer === null ? '—' : <Money>{m.costPer}</Money>}</b>
          <span className="impc-kn sub">الممنوح ÷ المستفيدين المقدَّرين</span>
        </div>
      </div>

      {full && (
        <div className="impc-map">
          <SaudiMap
            unit="مستفيدًا"
            amounts
            points={m.regions.map((r) => ({ key: r.key, label: r.label, value: r.beneficiaries, amount: r.amount, href: `${ROUTES.projects}?region=${encodeURIComponent(r.key)}` }))}
          />
        </div>
      )}

      <div className="impc-g">
        <section>
          <h4 className="impc-h">أين · المناطق</h4>
          <CountBars rows={bars(m.regions, full ? 13 : TOP)} total={m.estimated} unit="مستفيد" note="من المستفيدين كلهم" />
        </section>
        <section>
          <h4 className="impc-h">في ماذا · المسارات</h4>
          <CountBars rows={bars(m.tracks)} total={m.estimated} unit="مستفيد" hue="c3" note="من المستفيدين كلهم" />
        </section>
        {full && (
          <>
            <section>
              <h4 className="impc-h">المجالات</h4>
              <CountBars rows={bars(m.fields, 8)} total={m.estimated} unit="مستفيد" hue="c4" note="من المستفيدين كلهم" />
            </section>
            <section>
              <h4 className="impc-h">الأهداف</h4>
              <CountBars rows={bars(m.goals, 8)} total={m.estimated} unit="مستفيد" hue="c5" note="من المستفيدين كلهم" />
            </section>
          </>
        )}
      </div>

      {full && (
        <section className="impc-pairs">
          <h4 className="impc-h">التقدير مقابل المُتحقّق · لكل مشروع أرسل تقريره الختامي</h4>
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
                      <td><Link className="lnk" to={ROUTES.project(x.id)}>{x.name}</Link></td>
                      <td>{x.region}</td>
                      <td className="n"><span className="num">{nf.format(x.estimated)}</span></td>
                      <td className="n"><span className="num">{nf.format(x.reached)}</span></td>
                      <td className="n"><span className="num">{pct(Math.round((x.reached / Math.max(1, x.estimated)) * 100))}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="sub">لم يُرسل تقرير ختامي بعد · تظهر المقارنة مع أول تقرير يذكر عدد المستفيدين الفعلي.</p>}
        </section>
      )}
    </Glass>
  )
}
