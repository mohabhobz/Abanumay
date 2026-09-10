import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Glass, Head, Icon, icons, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import {
  DEFAULT_REPORT_TAB, REPORT_TABS, ROUTES, type ReportTabSlug,
} from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import { PROCESSES, coverage, headlineOf, measuredIn } from '@/data/kpi'
import { LIVE_REPORTS, PACKS, packByKey } from '@/data/reports'
import { KpiValue } from './KpiValue'
import { basisText } from './basis'
import { Board } from './Board'
import { Builder } from './Builder'
import { PERIODS } from '@/data/reportDefs'

/* ═══════════════════════════════════════════════════════════
   التقارير.

   النظام العامل فيه ١٤ شاشة تقرير، كل واحدة **فورم فلترة** لازم
   تملاه قبل ما تشوف رقم — وتلاتة منها بتطلع فاضية بعد ما تملاه.
   النتيجة اللي الأوديت كتبها: «داتا الأداء موجودة ولا تظهر عند
   القرار».

   فالتقسيم هنا بيقلب الترتيب:

    · **اللوحة** — الإجابات جاهزة. كل كارت سؤال ورقمه للفترة
      المختارة وجملة بتفسّره ومصدره وطريق للصفوف. الفلترة بعد
      الشوفان لا قبله.
    · **تقرير مُشكَّل** — للسؤال اللي مش في اللوحة: بُعد × مقياس،
      أربعين توليفة بشاشة واحدة بدل شاشة لكل سؤال.
    · **حالة القياس** — كام مؤشر من الوثيقة النظام يقدر يقيسه.
      ده بيتكلم **عننا** لا عن المنح، فمكانه آخر تاب لا أول شاشة.
   ═══════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const { tab } = useParams<{ tab?: string }>()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<string>(PERIODS[0].id)

  const active: ReportTabSlug =
    REPORT_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_REPORT_TAB
  const measuredPct = Math.round((coverage.measured / coverage.total) * 100)

  return (
    <AppLayout assistantContext={assistFor.page('التقارير')}>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <span className="now">التقارير</span>
          </nav>

          <header>
            <div>
              <h1 className="ptitle">التقارير</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <span className="num">{LIVE_REPORTS.length}</span> شاشة تقرير في النظام العامل ·{' '}
                مجموعة هنا في لوحة واحدة وأداة تشكيل
              </p>
            </div>
          </header>

          <Tabs
            items={REPORT_TABS}
            active={active}
            onChange={(s) => navigate(ROUTES.reportTab(s))}
          />

          {active === 'board' && <Board period={period} onPeriod={setPeriod} />}
          {active === 'build' && <Builder />}
          {active === 'coverage' && (
            <>
          {/* ═══ حالة القياس ═══
              مش زينة: ده الرقم اللي المشروع كله بيتقاس بيه. */}
          <Glass className="rpcov">
            <Head
              title="ما الذي يمكن قياسه اليوم"
              meta="من مؤشرات وثيقة الإجراءات"
            />

            <div className="rpcov-b" aria-hidden="true">
              <i style={{ width: `${measuredPct}%` }} />
            </div>

            <div className="rpcov-g">
              <div>
                <div className="v num">{coverage.measured}</div>
                <div className="k">مؤشرًا يُقاس الآن</div>
                <div className="sub">
                  <span className="num">{measuredPct}%</span> من الوثيقة
                </div>
              </div>
              <div>
                <div className="v num">{coverage.missing}</div>
                <div className="k">مؤشرًا بلا داتا</div>
                <div className="sub">كل واحد مكتوب جنبه ناقصه إيه</div>
              </div>
              <div>
                <div className="v num">{coverage.noTarget}</div>
                <div className="k">مؤشرًا بلا مستهدف</div>
                <div className="sub">يقيس التزامًا بمدة لم تُحدَّد</div>
              </div>
            </div>

            <p className="sub rpcov-n">
              الوثيقة لم تحدّد مدة مستهدفة واحدة لأي مستوى في الإجراءات الـ
              <span className="num">{PROCESSES.length}</span>، رغم أن{' '}
              <span className="num">{coverage.noTarget}</span> مؤشرات تقيس الالتزام
              بمدة مستهدفة أو باتفاقية مستوى خدمة. المدد المعروضة هنا فعلية، والحدود
              المقارَنة بها مؤقتة لحين اعتمادها.
            </p>
          </Glass>

          {/* ═══ الإجراءات الـ11 ═══ */}
          <section className="rpsec">
            <Head
              title="مؤشرات الإجراءات"
              meta={`${nf.format(coverage.total)} مؤشرًا · ${PROCESSES.length} إجراءات`}
            />

            <div className="rppg">
              {PROCESSES.map((p) => {
                const head = headlineOf(p)
                const done = measuredIn(p)
                return (
                  <Link key={p.key} to={ROUTES.report(p.key)} className="rpp glass">
                    <span className="rpp-h">
                      <span className="rpp-n num">{String(p.no).padStart(2, '0')}</span>
                      <span className="rpp-id num">{p.id}</span>
                    </span>

                    <span className="rpp-t">{p.title}</span>
                    <span className="rpp-o sub">{p.owner}</span>

                    <span className="rpp-v">
                      {head ? (
                        <>
                          <KpiValue kpi={head} />
                          <small className="sub">
                            {isolate(head.name)}
                            {/* المقام على البطاقة لا جوّه الورقة بس: «100%»
                                من مشروعين رقم مضلّل لو ما بانش من كام. */}
                            {head.of && (
                              <>
                                {' · من '}
                                {isolate(basisText(head.of.whole, head.of.basis))}
                              </>
                            )}
                          </small>
                        </>
                      ) : (
                        <em className="rpp-none">لا يُقاس بعد</em>
                      )}
                    </span>

                    <span className="rpp-c">
                      <span className="rpp-cb" aria-hidden="true">
                        {p.kpis.map((k, i) => (
                          <i key={i} className={k.value !== null ? 'on' : ''} />
                        ))}
                      </span>
                      <span className="sub">
                        <span className="num">{done}</span> من{' '}
                        <span className="num">{p.kpis.length}</span>
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ═══ حزم التقارير ═══ */}
          <section className="rpsec">
            <Head title="حزم التقارير" meta="من الفيججام · S11" />

            <div className="rpkg">
              {PACKS.map((k) => (
                <div key={k.key} className={`rpk glass${k.state === 'next' ? ' soon' : ''}`}>
                  <span className="rpk-i">
                    <Icon path={icons[k.icon]} size={20} />
                  </span>
                  <span className="rpk-t">
                    {k.title}
                    {k.state === 'ready' ? (
                      <Tag tone="ok">مبنيّة</Tag>
                    ) : (
                      <Tag tone="mute">التالي</Tag>
                    )}
                  </span>
                  <span className="rpk-a sub">{k.answers}</span>
                  <ul className="rpk-l">
                    {k.contains.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <span className="rpk-r sub">يقرأها: {k.readers.join(' · ')}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ مقابل النظام العامل ═══
              العميل بيسأل «طيب تقاريري راحت فين؟» — الجدول ده الرد. */}
          <Glass>
            <Head
              title="تقارير النظام العامل ومكانها هنا"
              meta={`${LIVE_REPORTS.length} شاشة`}
            />
            <div className="rpmap">
              {LIVE_REPORTS.map((r) => {
                const pack = packByKey(r.pack)
                return (
                  <div key={r.path} className="rpm">
                    <span className="rpm-t">{r.title}</span>
                    <span className="rpm-p">
                      <code className="mono">{r.path}</code>
                      {r.flaw && <Tag tone="no">{r.flaw}</Tag>}
                    </span>
                    <span className="rpm-a" aria-hidden="true">←</span>
                    <span className="rpm-d">{pack?.title ?? '—'}</span>
                  </div>
                )
              })}
            </div>
          </Glass>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
