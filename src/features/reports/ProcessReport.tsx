import { Link, Navigate, useParams } from 'react-router-dom'
import { BackTo, Glass, Head, Icon, icons, StepLink } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { ROUTES } from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import { PROCESSES, measuredIn, processByKey } from '@/data/kpi'
import { KpiValue } from './KpiValue'
import { basisText } from './basis'

/* Single-process metrics sheet.

   Three rules govern this screen:

   1. The measurement formula sits under every number, always. The spec
   writes out each metric's formula, and a number without its formula can
   be read wrong — "rejection rate" out of what? Out of what's shown, or
   the total? That difference changes the decision.

   2. A metric with no value is still shown. Hiding it lets the gap pass
   unnoticed; showing it with the reason it's missing turns it into a
   concrete backend requirement.

   3. Every number links to its underlying rows. This is the answer to
   the review's criticism: a report that ends at a number is of no use —
   one that opens onto the rows lets the decision be made from inside them. */

export default function ProcessReport() {
  const { key = '' } = useParams()
  const p = processByKey(key)

  if (!p) return <Navigate to={ROUTES.reports} replace />

  const i = PROCESSES.indexOf(p)
  const prev = PROCESSES[i - 1]
  const next = PROCESSES[i + 1]
  const done = measuredIn(p)

  /* If every metric is blocked by the same reason, that reason is stated
     once at the top instead of repeating under every line. Repetition
     turns information into noise. */
  const gaps = new Set(p.kpis.map((k) => k.gap ?? ''))
  const sharedGap = gaps.size === 1 && p.kpis[0].gap ? p.kpis[0].gap : null

  return (
    <AppLayout assistantContext={assistFor.page(`مؤشرات ${p.title}`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo to={ROUTES.reports} label="التقارير" />

          <header className="rph">
            <div>
              <h1 className="ptitle">{p.title}</h1>
              <p className="sub mt-1">
                <span className="num">{p.id}</span> · مالك الإجراء: {p.owner} ·{' '}
                <span className="num">{done}</span> من{' '}
                <span className="num">{p.kpis.length}</span> مؤشرات قابلة للقياس
              </p>
            </div>

            <nav className="rpnav" aria-label="التنقّل بين الإجراءات">
              {/* The arrow comes from `StepLink` — it used to be hand-drawn backwards. */}
              {prev && <StepLink to={ROUTES.report(prev.key)} dir="prev">{prev.title}</StepLink>}
              {next && <StepLink to={ROUTES.report(next.key)} dir="next">{next.title}</StepLink>}
            </nav>
          </header>

          <Glass>
            <Head
              title="مؤشرات الأداء"
              meta="النصوص منقولة حرفيًا من وثيقة الإجراءات · القسم x.7"
            />

            {sharedGap && (
              <div className="ind-g ind-gx">{isolate(sharedGap)}</div>
            )}

            <ol className="indl">
              {p.kpis.map((k) => (
                <li key={k.no} className={`ind${k.value === null ? ' gap' : ''}`}>
                  <span className="ind-n num">{String(k.no).padStart(2, '0')}</span>

                  <div className="ind-b">
                    <div className="ind-t">
                      {isolate(k.name)}
                      {/* "Derived" is a reading cue, not a status: a muted `Tag` would fall
                          below the contrast threshold and visually compete with the status
                          badges used elsewhere in the system. */}
                      {k.derived && <span className="ind-d">مشتقّ</span>}
                    </div>
                    <div className="ind-h sub">{isolate(k.how)}</div>

                    {k.gap && !sharedGap && <div className="ind-g">{isolate(k.gap)}</div>}

                    <div className="ind-f">
                      {k.of && (
                        <span className="sub">
                          <span className="num">{nf.format(k.of.part)}</span> من{' '}
                          {isolate(basisText(k.of.whole, k.of.basis))}
                        </span>
                      )}
                      <span className="sub">
                        المستهدف: {k.target === null ? 'لم يُحدَّد في الوثيقة' : <span className="num">{k.target}</span>}
                      </span>
                      {k.to && (
                        <Link to={k.to} className="ind-to">
                          <Icon name={icons.link} size="sm" />
                          اعرض الصفوف
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="ind-r">
                    <KpiValue kpi={k} />
                  </div>
                </li>
              ))}
            </ol>
          </Glass>

          <p className="sub rpfoot">
            «مشتقّ» يعني أن الرقم محسوب من بيانات الصف لا من عمود مستقل. يسجّل النظام
            العامل مدد المستويات فعلًا (<span className="num">13</span> عمودًا للمدة في جدول
            المشاريع)، وحين تتيحها الـ<span className="num">API</span>{' '}
            ستحلّ هذه الأعمدة محل الاشتقاق.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
