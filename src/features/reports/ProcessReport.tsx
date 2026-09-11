import { Link, Navigate, useParams } from 'react-router-dom'
import { Glass, Head, Icon, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { ROUTES } from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import { PROCESSES, measuredIn, processByKey } from '@/data/kpi'
import { KpiValue } from './KpiValue'
import { basisText } from './basis'

/* ═══════════════════════════════════════════════════════════
   ورقة مؤشرات إجراء واحد.

   ثلاث قواعد بتحكم الشاشة دي:

   1. **آلية القياس تحت كل رقم، دايمًا.** الوثيقة كاتبة لكل مؤشر
      صيغته، والرقم من غير صيغته بيتقري غلط — «نسبة المشاريع
      المرفوضة» من إيه؟ من المعروض ولا من الكل؟ الفرق بيغيّر القرار.

   2. **المؤشر اللي مالوش قيمة بيتكتب برضو.** إخفاؤه بيخلي الفجوة
      تعدّي؛ كتابته ومعاها سبب غيابه بتحوّلها لمطلب على الباك اند.

   3. **كل رقم بيوصّل لصفوفه.** ده الرد على نقد الأوديت: التقرير
      اللي بينتهي عند الرقم مالوش لازمة، اللي بيفتح على الصفوف
      بيخلي القرار يتاخد من جوّه.
   ═══════════════════════════════════════════════════════════ */

export default function ProcessReport() {
  const { key = '' } = useParams()
  const p = processByKey(key)

  if (!p) return <Navigate to={ROUTES.reports} replace />

  const i = PROCESSES.indexOf(p)
  const prev = PROCESSES[i - 1]
  const next = PROCESSES[i + 1]
  const done = measuredIn(p)

  /* لو كل المؤشرات واقفة على نفس السبب، السبب بيتكتب مرة فوق بدل
     ما يتكرر تحت كل سطر. التكرار بيحوّل المعلومة لضوضاء. */
  const gaps = new Set(p.kpis.map((k) => k.gap ?? ''))
  const sharedGap = gaps.size === 1 && p.kpis[0].gap ? p.kpis[0].gap : null

  return (
    <AppLayout assistantContext={assistFor.page(`مؤشرات ${p.title}`)}>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <Link to={ROUTES.reports}>التقارير</Link>
            <span aria-hidden="true">/</span>
            <span className="now">{p.title}</span>
          </nav>

          <header className="rph">
            <div>
              <h1 className="ptitle">{p.title}</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <span className="num">{p.id}</span> · مالك الإجراء: {p.owner} ·{' '}
                <span className="num">{done}</span> من{' '}
                <span className="num">{p.kpis.length}</span> مؤشرات قابلة للقياس
              </p>
            </div>

            <nav className="rpnav" aria-label="التنقّل بين الإجراءات">
              {prev && (
                <Link to={ROUTES.report(prev.key)} className="btn btn-2">
                  <Icon name={icons.chevron} size={15} />
                  {prev.title}
                </Link>
              )}
              {next && (
                <Link to={ROUTES.report(next.key)} className="btn btn-2">
                  {next.title}
                  <Icon name={icons.chevron} size={15} style={{ rotate: '180deg' }} />
                </Link>
              )}
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
                      {/* «مشتقّ» علامة قراءة لا حالة: `Tag` بنبرة خافتة
                          بتنزل تحت حدّ التباين، وبتتنافس بصريًّا مع
                          شارات الحالة في باقي السيستم. */}
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
                          <Icon name={icons.link} size={14} />
                          الصفوف
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
            «مشتقّ» يعني الرقم محسوب من بيانات الصف لا من عمود مستقل. النظام العامل
            بيسجّل مدد المستويات فعلًا (<span className="num">13</span> عمود مدة في جدول
            المشاريع)، والأعمدة دي هتحلّ محل الاشتقاق أول ما الـ<span className="num">API</span>{' '}
            يسلّمها.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
