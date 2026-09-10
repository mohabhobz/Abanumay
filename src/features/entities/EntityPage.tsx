import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  Empty, Glass, Head, Icon, icons, KV, Mono, Num, Riyal, Segments, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { initial, nf } from '@/lib/format'
import { ENTITY_DOCS_TOTAL, query, stagePressure } from '@/data/repository'
import { entityById } from '@/data/mock/entities'
import { ENTITY_DOCS, STATUS_GROUPS } from '@/data/mock/taxonomy'
import { ROUTES } from '@/app/routes'
import { activationTone, days, governanceTone, groupTone } from '@/lib/tone'
import { AnalysisCard } from '@/components/assistant'
import { useFillHeight } from '@/hooks/useFillHeight'
import { EntityTotals } from './EntityTotals'
import { readEntity } from '@/data/readings'

/**
 * صفحة الجهة.
 *
 * الغرض منها سؤال واحد: أقدر أدي المشروع ده للجهة دي؟
 * فبتحط قدام المشرف تلات حاجات جنب بعض — حالة التفعيل، وملف
 * المستندات الناقص، وسجل مشاريعها السابق معانا بنتيجته.
 * والربط في الاتجاهين: من هنا لكل مشروع، ومن كل مشروع لهنا.
 */
export default function EntityPage() {
  const { id } = useParams<{ id: string }>()
  const entity = id ? entityById(id) : undefined
  const [group, setGroup] = useState<string | undefined>()

  const projects = useMemo(() => (id ? query.entityProjects(id) : []), [id])

  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of projects) out[p.statusGroup] = (out[p.statusGroup] ?? 0) + 1
    return out
  }, [projects])

  /* الكارت الجانبي بياخد المساحة الباقية لحدّ رصيف القرار — نفس
     حساب صفحة المشروع بالظبط، عشان الشكل واحد في الصفحتين. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, {
    varName: '--ai-fill',
    reserveSelector: '.decdock .chrome, .askfab',
    min: 240,
  })

  if (!entity) return <Navigate to={ROUTES.entities} replace />

  const shown = group ? projects.filter((p) => p.statusGroup === group) : projects
  const readings = readEntity(entity, projects)

  return (
    <AppLayout assistantContext={assistFor.entity(entity)}>
      <div className="viewstack">
        <div className="screen col hasg2">
          <nav className="crumb" aria-label="مسار التنقّل">
            <Link to={ROUTES.entities} className="lb">الجهات</Link>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="now">{entity.name}</span>
          </nav>

          {/* الترويسة بنفس تشكيل صفحة المشروع: الهوية على اليمين،
              والقراءة البصرية على الشمال في نفس مكان المروحة. */}
          <header className="phead">
            <div className="pmain">
              <div className="ehead-id">
                <span className="ec-init lg">{initial(entity.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <h1 className="ptitle">{entity.name}</h1>
                  <div className="ehead-m sub">
                    <Mono>{entity.licenseNo}</Mono>
                    <span className="pc-dot" />
                    {entity.type}
                    <span className="pc-dot" />
                    <Icon path={icons.pinMap} size={14} /> {entity.region} · {entity.city}
                  </div>
                </div>
              </div>
              <div className="ehead-m" style={{ marginTop: '.9rem' }}>
                <Tag tone={activationTone(entity.activation)}>{entity.activation}</Tag>
                <Tag tone={governanceTone(entity.governance)}>الحوكمة: {entity.governance}</Tag>
                <span className="sub">{entity.licensor}</span>
              </div>
            </div>

            <div className="pgates">
              <EntityTotals entity={entity} />
            </div>
          </header>

          <div className="g2">
            <div className="col">
              {/* ═══ مشاريع الجهة — الربط العكسي ═══ */}
              <Glass>
                <Head
                  title="مشاريع الجهة"
                  meta={<><span className="num">{projects.length}</span> مشروعًا في هذا النموذج</>}
                />
                <Segments
                  active={group}
                  onChange={setGroup}
                  items={[
                    { key: '', label: 'الكل', count: projects.length },
                    ...STATUS_GROUPS.filter((g) => counts[g]).map((g) => ({
                      key: g, label: g, count: counts[g],
                    })),
                  ]}
                />

                {shown.length === 0 ? (
                  <Empty
                    title="لا مشاريع بهذه الحالة."
                    note="الجهة مسجّلة لكن ما لهاش مشاريع في هذا التصنيف."
                  />
                ) : (
                  <div className="eprj">
                    {shown.map((p) => {
                      const over = stagePressure(p) > 1
                      return (
                        <Link key={p.id} to={ROUTES.project(p.id)} className="eprj-r well">
                          <div className="eprj-h">
                            <Mono>{p.id}</Mono>
                            <Tag tone={groupTone(p.statusGroup)}>{p.statusGroup}</Tag>
                            <span className="pc-sp" />
                            <span className="num">
                              {nf.format(p.amountGranted > 0 ? p.amountGranted : p.amountRequested)}{' '}
                              <Riyal />
                            </span>
                          </div>
                          <div className="eprj-n">{p.name}</div>
                          <div className="sub eprj-f">
                            {p.stage}
                            {p.stageLimit > 0 && (
                              <>
                                {' · '}
                                <span className="num">{days(p.hoursInStage)}</span>
                                {' يومًا في القسم'}
                                {over && <span className="tag no mini">متأخر</span>}
                              </>
                            )}
                            {p.declineReason && <> · {p.declineReason}</>}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </Glass>

              <Glass>
                <Head
                  title="ملف المستندات"
                  meta={<><span className="num">{entity.docsUploaded}</span> من <span className="num">{ENTITY_DOCS_TOTAL}</span></>}
                />
                <ul className="docl">
                  {ENTITY_DOCS.map((d, i) => {
                    const up = i < entity.docsUploaded
                    return (
                      <li key={d} className={up ? 'up' : ''}>
                        <Icon path={up ? icons.check : icons.close} size={15} />
                        <span>{d}</span>
                      </li>
                    )
                  })}
                </ul>
              </Glass>

              <Glass>
                <Head title="التعريف والتواصل" />
                <KV
                  rows={[
                    { k: 'رقم الترخيص', v: <Mono>{entity.licenseNo}</Mono> },
                    { k: 'الجهة المرخِّصة', v: entity.licensor },
                    { k: 'تاريخ التسجيل', v: <Mono>{entity.registeredAt}</Mono> },
                    { k: 'الجوال', v: <Mono>{entity.mobile}</Mono> },
                    { k: 'البريد', v: <Mono>{entity.email}</Mono> },
                  ]}
                />
                <p className="sub" style={{ marginTop: '.7rem' }}>
                  بيانات التواصل هنا مموّهة عمدًا — المستودع عام.
                </p>
              </Glass>


              <Glass>
                <Head title="أداء الجهة" meta="السجل التراكمي" />
                <KV
                  rows={[
                    { k: 'مشاريع معتمدة', v: <Num>{entity.projectsApproved}</Num> },
                    { k: 'تحت التشغيل', v: <Num>{entity.projectsRunning}</Num> },
                    { k: 'مكتملة', v: <Num>{entity.projectsCompleted}</Num> },
                    { k: 'معتذر عنها', v: <Num>{entity.projectsDeclined}</Num> },
                    {
                      k: 'متعثرة',
                      v: (
                        <>
                          <Num>{entity.projectsStalled}</Num>
                          {entity.projectsStalled > 0 && <span className="dotmark" />}
                        </>
                      ),
                    },
                  ]}
                />
              </Glass>

              <Glass>
                <Head title="اذهب إلى" />
                <div className="chips">
                  <Link className="chip" to={`${ROUTES.projects}?q=${encodeURIComponent(entity.name)}`}>
                    <Icon path={icons.link} size={14} /> مشاريعها في القائمة
                  </Link>
                  <Link className="chip" to={`${ROUTES.entities}?region=${encodeURIComponent(entity.region)}`}>
                    جهات {entity.region}
                  </Link>
                </div>
              </Glass>
            </div>

            {/* ═══ العمود الجانبي — كارت واحد لازق ═══
                زي صفحة المشروع بالظبط: أداء الجهة و«اذهب إلى» نزلوا
                للعمود الرئيسي، وفضل كارت التحليلات وحده — وده اللي
                بيخلّي اللزق يشتغل بلا تمرير جوّه تمرير. */}
            <div className="col aiside" ref={aside}>
              <AnalysisCard
                readings={readings}
                title="تحليلات الجهة السريعة"
                onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
