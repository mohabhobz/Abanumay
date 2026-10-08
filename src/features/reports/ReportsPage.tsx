import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Glass, Head, Icon, icons, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import {
  DEFAULT_REPORT_TAB, REPORT_TABS, ROUTES, type ReportTabSlug,
} from '@/app/routes'
import { isolate, nf, countOf, NOUN, nounAfter } from '@/lib/format'
import { kpiProcesses, kpiCoverage, headlineOf, measuredIn } from '@/data/kpi'
import { LIVE_REPORTS, PACKS, packByKey } from '@/data/reports'
import { KpiValue } from './KpiValue'
import { basisText } from './basis'
import { Board } from './Board'
import { Builder } from './Builder'
import { Catalog } from './Catalog'
import { ImpactPanel } from './ImpactPanel'
import { PERIODS } from '@/data/reportDefs'

/* Reports.

   The current system has 14 report screens, each a filter form that must
   be filled before any number appears — and three of them come back
   empty after filling. The finding recorded from review: "performance
   data exists but doesn't surface at decision time."

   So the structure here reverses that order:

   - Dashboard — answers are ready. Every card is a question with its
   number for the selected period, a sentence explaining it, its source,
   and a path to the rows. Filtering comes after seeing, not before.
   - Report builder — for the question not on the dashboard: dimension ×
   metric, dozens of combinations in one screen instead of one screen per question.
   - Measurement status — how many of the spec's metrics the system can
   actually measure. This is a statement about us, not about the grants,
   so it belongs as the last tab, not the first screen. */

export default function ReportsPage() {
  const { tab } = useParams<{ tab?: string }>()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<string>(PERIODS[0].id)

  const active: ReportTabSlug =
    REPORT_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_REPORT_TAB
  const PROCESSES = kpiProcesses()
  const coverage = kpiCoverage(PROCESSES)
  const measuredPct = Math.round((coverage.measured / coverage.total) * 100)

  return (
    <AppLayout assistantContext={assistFor.page('التقارير')}>
      <div className="viewstack">
        <div className={`screen col${active === 'board' ? ' hasg2 g2fit' : ''}`}>
          <header>
            <div>
              <h1 className="ptitle">التقارير</h1>
              <p className="sub mt-1">
                <span className="num">{LIVE_REPORTS.length}</span> شاشة تقرير في النظام العامل ·{' '}
                مجمّعة هنا في لوحة واحدة وأداة لتشكيل التقارير
              </p>
            </div>
            <div className="rowf gp-2">
              {/* 11.4.26 · 13.2.27 · the Ehsan projects and the sub-projects, marked by their kind */}
              <Link className="btn btn-2" to={ROUTES.partnersTab('report')}><Icon name={icons.link} />تقرير الشركاء</Link>
              <Link className="btn btn-2" to={ROUTES.glassBoard}><Icon name={icons.insight} />لوحة المؤشرات · تجريبية</Link>
            </div>
          </header>

          <Tabs
            items={REPORT_TABS}
            active={active}
            onChange={(s) => navigate(ROUTES.reportTab(s))}
          />

          {/* Client, 8 Oct · the impact on every report screen · the «الأثر» tab draws it in full */}
          {active === 'impact' ? <ImpactPanel full /> : <ImpactPanel />}
          {active === 'board' && <Board period={period} onPeriod={setPeriod} />}
          {active === 'build' && <Builder />}
          {active === 'catalog' && <Catalog />}
          {active === 'coverage' && (
            <>
          {/* Measurement status isn't decoration — it's the number the whole
              project gets measured by. */}
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
                <div className="k">مؤشرًا بلا بيانات</div>
                <div className="sub">يُذكر بجانب كل مؤشر ما ينقصه</div>
              </div>
              <div>
                <div className="v num">{coverage.noTarget}</div>
                <div className="k">مؤشرًا بلا مستهدف</div>
                <div className="sub">يقيس التزامًا بمدة لم تُحدَّد</div>
              </div>
            </div>

            <p className="mut rpcov-n">
              الوثيقة لم تحدّد مدة مستهدفة واحدة لأي مستوى في الإجراءات الـ
              <span className="num">{PROCESSES.length}</span>، رغم أن{' '}
              <span className="num">{coverage.noTarget}</span> مؤشرات تقيس الالتزام
              بمدة مستهدفة أو باتفاقية مستوى خدمة. المدد المعروضة هنا فعلية، والحدود
              المقارَنة بها مؤقتة لحين اعتمادها.
            </p>
          </Glass>

          {/* The 11 actions */}
          <section className="rpsec">
            <Head
              title="مؤشرات الإجراءات"
              meta={`${nf.format(coverage.total)} ${nounAfter(coverage.total, NOUN.indicator)} · ${countOf(PROCESSES.length, NOUN.procedure)}`}
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
                            {/* The denominator shows on the card, not just inside the sheet: "100%"
                                of
                                two projects is a misleading number if it doesn't show out of how
                                many. */}
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

          {/* Report bundles.

              This section is a build plan, not a data screen, and that wasn't
              stated anywhere — the heading just said "Report bundles" with no
              explanation, which is a label for the team, not information for the
              client. Anyone looking at it would ask "what does this section
              actually do?" — so now it's stated. */}
          <section className="rpsec">
            <Head
              title="حزم التقارير المخطَّطة"
              meta={`${PACKS.filter((p) => p.state === 'ready').length} مبنيّة · ${PACKS.filter((p) => p.state === 'next').length} في الخطة`}
            />
            <p className="mut rpsec-n">
              هذه ليست شاشات قائمة، بل <b>خطة وحدة التقارير</b>. بدل بناء شاشة لكل تقرير
              كما في النظام العامل، تُجمَع التقارير في حزم، تجيب كل حزمة عن سؤال
              واحد ولها قارئ محدد. تعرض كل بطاقة السؤال، ومحتوى الحزمة، ومن
              يقرؤها.
            </p>

            <div className="rpkg">
              {PACKS.map((k) => (
                <div key={k.key} className={`rpk glass${k.state === 'next' ? ' soon' : ''}`}>
                  <span className="rpk-i">
                    <Icon name={icons[k.icon]} size="md" />
                  </span>
                  <span className="rpk-t">
                    {k.title}
                    {k.state === 'ready' ? (
                      <Tag tone="ok">مبنيّة</Tag>
                    ) : (
                      <Tag tone="mute">التالي</Tag>
                    )}
                  </span>
                  <span className="rpk-a mut">{k.answers}</span>
                  <ul className="rpk-l">
                    {k.contains.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <span className="rpk-r mut">يقرأها: {k.readers.join(' · ')}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Versus the current system.

              The client asks "so where did my reports go?" — this table is the answer. */}
          <Glass>
            <Head
              title="تقارير النظام العامل ومكانها هنا"
              meta={`${LIVE_REPORTS.length} شاشة`}
            />
            <p className="mut rpsec-n">
              كل شاشة تقرير في <span className="mono">sys.abanumay.sa</span> وموقعها
              في الخطة. هذا الجدول يجيب عن سؤال «أين ذهبت تقاريري؟»: لم يُحذف
              أي تقرير، بل جُمعت الشاشات الثلاث عشرة في ست حزم، لأن ما كان يفرّق بينها
              هو <b>اسم التقرير</b> لا السؤال الذي تجيب عنه.
            </p>
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
                    <span className="rpm-d">{pack?.title ?? ''}</span>
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
